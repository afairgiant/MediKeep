"""What app.log persists for an exception (issue #1200).

Handlers answer with a fixed message and log the exception, so the log file is the
only place the cause is recorded. The JSON formatter only serialises a whitelist of
extra fields, so each field that carries a cause has to be on it, and SQLAlchemy's
bound parameter values (which can be patient data) must not be persisted with it.
"""

import json
import logging
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

from starlette.requests import Request

from app.core.http.error_handling import (
    MedicalRecordsAPIException,
    create_fallback_exception_handler,
    handle_database_errors,
)
from app.core.logging.config import (
    MedicalRecordsJSONFormatter,
    get_logger,
    redact_sql_parameters,
)
from app.core.logging.constants import LogFields
from app.core.logging.helpers import log_endpoint_error

VALUE = "PATIENT-NAME-JANE-DOE"
formatter = MedicalRecordsJSONFormatter()


def _record(message="msg", exc_info=None, **extra) -> logging.LogRecord:
    record = logging.LogRecord("t", logging.ERROR, __file__, 1, message, (), exc_info)
    for key, value in extra.items():
        setattr(record, key, value)
    return record


def _persisted(record: logging.LogRecord) -> dict:
    return json.loads(formatter.format(record))


@pytest.fixture
def integrity_error() -> IntegrityError:
    """A genuine SQLAlchemy error whose text includes the value being written."""
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            text("create table t (id integer primary key, name text unique)")
        )
        connection.execute(text("insert into t (name) values (:n)"), {"n": VALUE})
    with pytest.raises(IntegrityError) as raised:
        with engine.begin() as connection:
            connection.execute(text("insert into t (name) values (:n)"), {"n": VALUE})
    assert VALUE in str(
        raised.value
    ), "the premise: SQLAlchemy puts the value in str(e)"
    return raised.value


class TestErrorFieldIsPersisted:
    def test_the_error_field_is_in_the_entry(self):
        entry = _persisted(_record(**{LogFields.ERROR: "the cause"}))

        assert entry["error"] == "the cause"

    def test_an_entry_without_one_has_no_error_key(self):
        assert "error" not in _persisted(_record())

    def test_the_fields_that_were_already_persisted_are_unchanged(self):
        entry = _persisted(
            _record(event="x", category="app", user_id=3, ip="127.0.0.1", error="e")
        )

        assert (entry["event"], entry["category"], entry["user_id"], entry["ip"]) == (
            "x",
            "app",
            "3",
            "127.0.0.1",
        )

    def test_log_endpoint_error_cause_reaches_the_file(self):
        """The helper used by ~150 call sites: its `error` was silently dropped."""
        captured = []

        class Grab(logging.Handler):
            def emit(self, record):
                captured.append(record)

        logger = get_logger("formatter_probe", "app")
        logger.addHandler(Grab())
        logger.setLevel(logging.DEBUG)
        request = MagicMock()
        request.client.host = "127.0.0.1"
        request.headers = {}

        log_endpoint_error(logger, request, "Failed", Exception("CAUSE-XYZ"), user_id=1)

        assert _persisted(captured[0])["error"] == "CAUSE-XYZ"


class TestSqlParametersAreNotPersisted:
    def test_in_the_error_field(self, integrity_error):
        entry = _persisted(_record(**{LogFields.ERROR: str(integrity_error)}))

        assert "UNIQUE constraint failed" in entry["error"]
        assert VALUE not in entry["error"]
        assert "[parameters: redacted]" in entry["error"]

    def test_in_a_message_that_embeds_the_exception(self, integrity_error):
        """Many handlers log f"...{str(e)}", which never went through the error field."""
        entry = _persisted(_record(message=f"Failed to save: {integrity_error}"))

        assert "UNIQUE constraint failed" in entry["message"]
        assert VALUE not in entry["message"]

    def test_in_a_traceback(self, integrity_error):
        try:
            raise integrity_error
        except IntegrityError:
            import sys

            record = _record("with traceback", exc_info=sys.exc_info())

        assert VALUE not in _persisted(record)["traceback"]

    @pytest.mark.parametrize(
        ("text_in", "secrets"),
        [
            ("boom: nothing to remove", []),
            (
                "x\n[SQL: s]\n[parameters: [('a1',), ('x]y',)]]\n(Background on this error at: u)",
                ["a1", "x]y"],
            ),
            ("failed [parameters: ('s1',)] and then more text", ["s1"]),
            (
                "[parameters: ('s1',)]\n(Background on this error at: u) / "
                "[parameters: ('s2',)]\n(Background on this error at: u)",
                ["s1", "s2"],
            ),
        ],
    )
    def test_redaction_edge_cases(self, text_in, secrets):
        redacted = redact_sql_parameters(text_in)

        assert not any(secret in redacted for secret in secrets)
        if not secrets:
            assert redacted == text_in

    def test_the_statement_and_constraint_stay_for_diagnosis(self, integrity_error):
        redacted = redact_sql_parameters(str(integrity_error))

        assert "UNIQUE constraint failed: t.name" in redacted
        assert "[SQL: insert into t (name) values (?)]" in redacted
        assert "Background on this error" in redacted


class TestOtherPathsThatCarryACause:
    """The cause also travels under keys other than `error`; none may be dropped."""

    def test_original_error_is_persisted_and_redacted(self):
        entry = _persisted(
            _record(original_error=f"UNIQUE failed\n[parameters: ('{VALUE}',)]")
        )

        assert "UNIQUE failed" in entry["original_error"]
        assert VALUE not in entry["original_error"]

    def test_handle_database_errors_cause_reaches_the_file(
        self, integrity_error, caplog
    ):
        caplog.set_level(logging.DEBUG)

        with pytest.raises(MedicalRecordsAPIException):
            with handle_database_errors(request=None):
                raise integrity_error

        persisted = "\n".join(formatter.format(r) for r in caplog.records)
        assert "UNIQUE constraint failed: t.name" in persisted
        assert VALUE not in persisted


def _request() -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/probe",
            "headers": [],
            "client": ("127.0.0.1", 1234),
            "query_string": b"",
            "server": ("testserver", 80),
            "scheme": "http",
        }
    )


class TestUnhandledExceptionsKeepTheirCause:
    """The global catch-all used to log only "Unhandled exception on GET /probe"."""

    @pytest.mark.asyncio
    async def test_cause_and_traceback_reach_the_file(self, caplog):
        caplog.set_level(logging.DEBUG)
        handler = create_fallback_exception_handler()

        try:
            raise RuntimeError("UNHANDLED-CAUSE-XYZ")
        except RuntimeError as exc:
            await handler(_request(), exc)

        entry = next(
            _persisted(r)
            for r in caplog.records
            if r.getMessage().startswith("Unhandled")
        )
        assert "RuntimeError: UNHANDLED-CAUSE-XYZ" in entry["traceback"]
        assert entry["event"] == "unhandled_exception"

    @pytest.mark.asyncio
    async def test_works_when_the_handler_runs_outside_an_except_block(self, caplog):
        """Starlette can call it after the except block has ended."""
        caplog.set_level(logging.DEBUG)
        handler = create_fallback_exception_handler()
        exc = RuntimeError("UNHANDLED-CAUSE-XYZ")
        try:
            raise exc
        except RuntimeError:
            pass

        await handler(_request(), exc)

        entry = next(
            _persisted(r)
            for r in caplog.records
            if r.getMessage().startswith("Unhandled")
        )
        assert "UNHANDLED-CAUSE-XYZ" in entry["traceback"]

    @pytest.mark.asyncio
    async def test_sql_parameters_are_removed_from_the_persisted_traceback(
        self, integrity_error, caplog
    ):
        caplog.set_level(logging.DEBUG)
        handler = create_fallback_exception_handler()

        await handler(_request(), integrity_error)

        entry = next(
            _persisted(r)
            for r in caplog.records
            if r.getMessage().startswith("Unhandled")
        )
        assert "UNIQUE constraint failed" in entry["traceback"]
        assert VALUE not in entry["traceback"]
