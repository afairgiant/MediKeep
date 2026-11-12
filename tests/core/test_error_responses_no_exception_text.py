"""Regression guard for issue #1200: exception text must not reach API responses.

Raw exception text can reveal file paths, SQL, library versions and internal
state. Handlers that catch unexpected failures must log the exception and
return a fixed message.

Scope of the scan
-----------------
Only handlers whose exception type can carry text we did not write are checked:
``Exception``, a bare ``except``, OS errors, database errors and the
Paperless/Papra client errors. Handlers for ``ValueError`` and for project
domain exceptions are deliberately exempt: those carry messages written by our
own service code (for example "Cannot share patient with yourself") that the
UI relies on.

A second rule covers the other half: a handler that replaces such an exception
with a fixed message must log the exception, since the log is then the only place
the cause is recorded.
"""

import ast
from pathlib import Path

import pytest

APP_DIR = Path(__file__).resolve().parents[2] / "app"

# Exception types whose text may come from outside our code.
LEAKY_EXCEPTION_TYPES = {
    "Exception",
    "BaseException",
    "OSError",
    "IOError",
    "EnvironmentError",
    "SQLAlchemyError",
    "DBAPIError",
    "OperationalError",
    "IntegrityError",
    "PaperlessClientError",
    "PaperlessConnectionError",
    "PaperlessUploadError",
    "NewPaperlessConnectionError",
    "PapraClientError",
    "PapraConnectionError",
    "PapraUploadError",
}

# Callables that build an HTTP error response.
RESPONSE_CALLS = {
    "HTTPException",
    "JSONResponse",
    "APIException",
    "MedicalRecordsAPIException",
    "ValidationException",
    "UnauthorizedException",
    "ForbiddenException",
    "NotFoundException",
    "ConflictException",
    "DatabaseException",
    "BusinessLogicException",
    "ServiceUnavailableException",
    # Builders from integration_errors: feeding them exception text is a leak too.
    "IntegrationFailure",
    "integration_http_exception",
}

# The only ways exception information may reach a response. Each returns text
# built from types, errno and strings we wrote, never from str(exc).
SANITIZER_CALLS = {
    "describe_integration_failure",
    "classify_connection_failure",
    "integration_error_response",
    "raise_if_integration_failure",
}
# Attributes holding text we wrote (see IntegrationFailureInfo).
SAFE_ATTRIBUTES = {"integration_message", "integration_code", "upstream_status"}

# Keyword arguments that never reach the response body.
NON_RESPONSE_KWARGS = {
    "request",
    "original_error",
    "headers",
    "error_code",
    "data",
    "context",
}


def _callee_name(call: ast.Call):
    func = call.func
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return None


def _names_in(node: ast.AST) -> set:
    """Names a node reads, ignoring only the sanctioned ways of using an exception."""
    names = set()

    def visit(current: ast.AST) -> None:
        if isinstance(current, ast.Call) and _callee_name(current) in SANITIZER_CALLS:
            # The first argument is the exception being described. The rest (the
            # provider name, a fallback message) still reaches the response, so it
            # is scanned like any other argument.
            for argument in current.args[1:]:
                visit(argument)
            for keyword in current.keywords:
                visit(keyword.value)
            return
        if isinstance(current, ast.Attribute) and current.attr in SAFE_ATTRIBUTES:
            return
        if isinstance(current, ast.Name):
            names.add(current.id)
        for child in ast.iter_child_nodes(current):
            visit(child)

    visit(node)
    return names


def _handler_type_names(handler: ast.ExceptHandler) -> set:
    if handler.type is None:
        return {"Exception"}
    elements = (
        handler.type.elts if isinstance(handler.type, ast.Tuple) else [handler.type]
    )
    names = set()
    for element in elements:
        if isinstance(element, ast.Name):
            names.add(element.id)
        elif isinstance(element, ast.Attribute):
            names.add(element.attr)
    return names


def _tainted_names(handler: ast.ExceptHandler) -> set:
    """Names holding exception text: the bound name plus anything derived from it."""
    tainted = {handler.name}
    changed = True
    while changed:
        changed = False
        for stmt in ast.walk(handler):
            if not isinstance(stmt, (ast.Assign, ast.AnnAssign, ast.AugAssign)):
                continue
            if stmt.value is None or not (_names_in(stmt.value) & tainted):
                continue
            targets = stmt.targets if isinstance(stmt, ast.Assign) else [stmt.target]
            for target in targets:
                for name in _names_in(target):
                    if name not in tainted:
                        tainted.add(name)
                        changed = True
    return tainted


def find_exception_text_leaks(source: str) -> list:
    """Return (line, snippet) for each leaky handler that echoes its exception."""
    leaks = []
    for handler in (
        n for n in ast.walk(ast.parse(source)) if isinstance(n, ast.ExceptHandler)
    ):
        if not handler.name or not (
            _handler_type_names(handler) & LEAKY_EXCEPTION_TYPES
        ):
            continue
        tainted = _tainted_names(handler)
        for call in (n for n in ast.walk(handler) if isinstance(n, ast.Call)):
            callee = _callee_name(call)
            if callee not in RESPONSE_CALLS and callee not in SANITIZER_CALLS:
                continue
            # A sanitizer is handed the exception as its first argument by design.
            positional = call.args[1:] if callee in SANITIZER_CALLS else call.args
            arguments = list(positional) + [
                kw.value for kw in call.keywords if kw.arg not in NON_RESPONSE_KWARGS
            ]
            if any(_names_in(arg) & tainted for arg in arguments):
                leaks.append((call.lineno, ast.unparse(call)[:100]))
    return leaks


# ------------------------------------------------------------------ logging rule

LOG_METHODS = {"debug", "info", "warning", "error", "critical", "log"}
# Helpers that answer with an HTTPException built from the exception they are given.
RESPONSE_HELPERS = {"integration_error_response", "raise_if_integration_failure"}


def _is_logging_call(call: ast.Call) -> bool:
    func = call.func
    if isinstance(func, ast.Attribute) and (
        func.attr in LOG_METHODS or func.attr == "exception"
    ):
        base = func.value
        name = (
            base.id
            if isinstance(base, ast.Name)
            else base.attr if isinstance(base, ast.Attribute) else ""
        )
        return name.lower().endswith("logger") or name in ("log", "logging")
    name = _callee_name(call) or ""
    return name.startswith("log_") or name.startswith("_log_")


def _handler_logs_exception(handler: ast.ExceptHandler) -> bool:
    tainted = _tainted_names(handler)
    for call in (n for n in ast.walk(handler) if isinstance(n, ast.Call)):
        arguments = list(call.args) + [kw.value for kw in call.keywords]
        if _is_logging_call(call):
            # logger.exception() records the active exception without being handed it.
            if isinstance(call.func, ast.Attribute) and call.func.attr == "exception":
                return True
            if any(_names_in(arg) & tainted for arg in arguments):
                return True
            if any(
                kw.arg == "exc_info" and getattr(kw.value, "value", None) is True
                for kw in call.keywords
            ):
                return True
        # API exceptions log their own `context=` when they are constructed.
        if _callee_name(call) in RESPONSE_CALLS and any(
            kw.arg == "context" and _names_in(kw.value) & tainted
            for kw in call.keywords
        ):
            return True
    return False


def find_unlogged_exception_handlers(source: str) -> list:
    """(line, type names) of leaky-type handlers that answer without logging the exception."""
    unlogged = []
    for handler in (
        n for n in ast.walk(ast.parse(source)) if isinstance(n, ast.ExceptHandler)
    ):
        types = _handler_type_names(handler)
        if handler.type is None or not (types & LEAKY_EXCEPTION_TYPES):
            continue
        answers = any(
            isinstance(n, ast.Call)
            and _callee_name(n) in (RESPONSE_CALLS | RESPONSE_HELPERS)
            for n in ast.walk(handler)
        )
        if not answers:
            continue
        # An unnamed handler cannot hand the exception to the logger at all.
        if handler.name is None or not _handler_logs_exception(handler):
            unlogged.append((handler.lineno, ",".join(sorted(types))))
    return unlogged


class TestLeakDetector:
    """The scanner itself must catch real leak shapes, or the guard is worthless."""

    @pytest.mark.parametrize(
        "body",
        [
            'raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")',
            "raise HTTPException(status_code=500, detail=str(e))",
            "raise HTTPException(500, str(e))",
            'raise HTTPException(status_code=500, detail=f"Failed: {e}")',
            "msg = str(e)\n    raise HTTPException(status_code=400, detail=msg)",
            'raise DatabaseException(message=f"Save failed: {e}", request=request)',
            'return JSONResponse(status_code=500, content={"error": str(e)})',
            # The sanctioned attribute must not become a way to fall back to str(e).
            'raise HTTPException(500, getattr(e, "integration_message", str(e)))',
            "raise HTTPException(500, e.integration_message or str(e))",
            'raise HTTPException(500, f"{e.integration_message}: {e}")',
            'raise integration_http_exception(IntegrationFailure("integration_error", str(e)))',
            # The exception handed to a sanitizer is fine; anything else it is
            # given still reaches the response.
            'raise integration_error_response(e, "Papra", str(e))',
            'raise integration_error_response(e, "Papra", f"Papra error: {e}")',
            "raise_if_integration_failure(e, str(e))",
            "raise HTTPException(500, describe_integration_failure(e, str(e)).message)",
        ],
    )
    def test_detects_leak(self, body):
        source = f"try:\n    pass\nexcept Exception as e:\n    {body}\n"
        assert find_exception_text_leaks(source)

    @pytest.mark.parametrize(
        "handler_type",
        ["OSError", "PaperlessClientError", "SQLAlchemyError", "(OSError, KeyError)"],
    )
    def test_detects_leak_for_other_leaky_types(self, handler_type):
        source = (
            f"try:\n    pass\nexcept {handler_type} as e:\n"
            '    raise HTTPException(status_code=400, detail=f"Error: {e}")\n'
        )
        assert find_exception_text_leaks(source)

    @pytest.mark.parametrize(
        "source",
        [
            # fixed message, exception only logged
            "try:\n    pass\nexcept Exception as e:\n"
            "    logger.error('x', extra={'error': str(e)})\n"
            '    raise HTTPException(status_code=500, detail="Failed to do it")\n',
            # exception kept for logging only
            "try:\n    pass\nexcept Exception as e:\n"
            '    raise DatabaseException(message="Error saving", original_error=e, request=request)\n',
            # chaining is not a response body
            "try:\n    pass\nexcept Exception as e:\n"
            '    raise HTTPException(status_code=500, detail="Failed") from e\n',
            # authored-message types are exempt by design
            "try:\n    pass\nexcept ValueError as e:\n"
            "    raise HTTPException(status_code=400, detail=str(e))\n",
            "try:\n    pass\nexcept PatientNotFoundError as e:\n"
            "    raise HTTPException(status_code=404, detail=str(e))\n",
            # sanctioned ways to describe an integration failure
            "try:\n    pass\nexcept PapraClientError as e:\n"
            "    raise HTTPException(status_code=400, detail=e.integration_message)\n",
            "try:\n    pass\nexcept PapraClientError as e:\n"
            '    failure = describe_integration_failure(e, "Papra")\n'
            "    raise integration_http_exception(failure)\n",
            "try:\n    pass\nexcept PapraClientError as e:\n"
            '    raise integration_error_response(e, "Papra", "Papra error")\n',
            "try:\n    pass\nexcept Exception as e:\n"
            '    raise_if_integration_failure(e, "Papra")\n'
            '    raise HTTPException(status_code=500, detail="Failed")\n',
        ],
    )
    def test_ignores_safe_handlers(self, source):
        assert find_exception_text_leaks(source) == []


class TestUnloggedHandlerDetector:
    """The logging rule must catch the real shapes, and accept every way of logging."""

    @pytest.mark.parametrize(
        "source",
        [
            "try:\n    pass\nexcept Exception as e:\n"
            '    raise HTTPException(status_code=500, detail="x")\n',
            # unnamed: nothing can be logged
            "try:\n    pass\nexcept IntegrityError:\n"
            '    raise HTTPException(status_code=409, detail="x")\n',
            # logs, but not the exception
            "try:\n    pass\nexcept OSError as e:\n"
            '    logger.error("failed")\n'
            '    raise HTTPException(status_code=500, detail="x")\n',
            # original_error is stored on the exception, not logged
            "try:\n    pass\nexcept Exception as e:\n"
            '    raise DatabaseException(message="x", original_error=e)\n',
            "try:\n    pass\nexcept PaperlessConnectionError as e:\n"
            '    raise integration_error_response(e, "Paperless", "x")\n',
        ],
    )
    def test_flags_unlogged(self, source):
        assert find_unlogged_exception_handlers(source)

    @pytest.mark.parametrize(
        "log_line",
        [
            'logger.error("x", extra={"error": str(e)})',
            'app_logger.error(f"failed: {e}")',
            'self.logger.warning("x", extra={"error": str(e)})',
            'log_endpoint_error(logger, request, "x", e)',
            'log_external_service(logger, service="s", operation="o", success=False, error=str(e))',
            'logger.exception("x")',
            'logger.error("x", exc_info=True)',
        ],
    )
    def test_accepts_every_way_of_logging_the_exception(self, log_line):
        source = (
            "try:\n    pass\nexcept Exception as e:\n"
            f"    {log_line}\n"
            '    raise HTTPException(status_code=500, detail="x")\n'
        )
        assert find_unlogged_exception_handlers(source) == []

    def test_accepts_context_on_an_api_exception_which_logs_it(self):
        source = (
            "try:\n    pass\nexcept SQLAlchemyError as e:\n"
            '    ctx = {"original_error": str(e)}\n'
            '    raise DatabaseException(message="x", context=ctx)\n'
        )
        assert find_unlogged_exception_handlers(source) == []

    def test_ignores_handlers_that_do_not_answer_or_are_not_leaky(self):
        assert (
            find_unlogged_exception_handlers(
                "try:\n    pass\nexcept Exception as e:\n    cleanup()\n"
            )
            == []
        )
        assert (
            find_unlogged_exception_handlers(
                "try:\n    pass\nexcept ValueError as e:\n"
                "    raise HTTPException(status_code=400, detail=str(e))\n"
            )
            == []
        )


def _app_python_files():
    return sorted(p for p in APP_DIR.rglob("*.py") if "__pycache__" not in p.parts)


def test_scan_covers_the_app_package():
    assert len(_app_python_files()) > 100


def test_no_exception_text_in_api_responses():
    """No handler for an unexpected failure may echo its exception to the client."""
    offenders = []
    for path in _app_python_files():
        for line, snippet in find_exception_text_leaks(
            path.read_text(encoding="utf-8")
        ):
            offenders.append(f"{path.relative_to(APP_DIR.parent)}:{line}  {snippet}")

    assert not offenders, (
        "Exception text is returned in API responses. Log the exception and "
        "return a fixed message instead:\n" + "\n".join(offenders)
    )


def test_exceptions_replaced_by_a_fixed_message_are_logged():
    """Where the response hides the cause, the log must record it."""
    offenders = []
    for path in _app_python_files():
        for line, types in find_unlogged_exception_handlers(
            path.read_text(encoding="utf-8")
        ):
            offenders.append(
                f"{path.relative_to(APP_DIR.parent)}:{line}  except {types}"
            )

    assert not offenders, (
        "These handlers answer with a message that hides the exception but do not "
        "log it. Bind the exception and pass it to the logger:\n" + "\n".join(offenders)
    )
