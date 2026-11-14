"""Regression test for the bandit B105/B107 annotations from #1198.

Every string literal that bandit would report as a possible hardcoded password
must carry an explicit ``# nosec B105`` (or ``# nosec B107``) with a reason.
That keeps the bandit report quiet for reviewed constants so a genuinely new
credential finding stands out.

Bandit is not a test dependency, so this mirrors its matching rules for the two
checks the ticket covers: string assignments and string argument defaults.
"""

import ast
import re
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[2] / "app"

# Copied from bandit.plugins.general_hardcoded_password so the test detects the
# same names bandit does without requiring bandit at test time.
RE_WORDS = "(pas+wo?r?d|pass(phrase)?|pwd|token|secrete?)"
RE_CANDIDATES = re.compile(
    "(^{0}$|_{0}_|^{0}_|_{0}$)".format(RE_WORDS), re.IGNORECASE
)


def _iter_candidates(tree):
    """Yield (rule_id, line_number) for B105/B107 candidates in *tree*."""
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            value = node.value
            if not (isinstance(value, ast.Constant) and isinstance(value.value, str)):
                continue
            if not value.value:
                continue
            for target in node.targets:
                if isinstance(target, ast.Name):
                    name = target.id
                elif isinstance(target, ast.Attribute):
                    name = target.attr
                else:
                    continue
                if RE_CANDIDATES.search(name):
                    yield "B105", value.lineno
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            args = node.args
            defaults = [None] * (len(args.args) - len(args.defaults))
            defaults.extend(args.defaults)
            for arg, default in zip(args.args, defaults):
                if not (
                    isinstance(default, ast.Constant)
                    and isinstance(default.value, str)
                    and default.value
                ):
                    continue
                if RE_CANDIDATES.search(arg.arg):
                    yield "B107", default.lineno


def _unannotated_candidates():
    missing = []
    for path in sorted(APP_DIR.rglob("*.py")):
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=str(path))
        lines = source.splitlines()
        for rule, lineno in _iter_candidates(tree):
            line = lines[lineno - 1]
            annotation = re.search(
                r"# nosec {}\b.*-\s*\S".format(rule), line
            )
            if annotation is None:
                rel = path.relative_to(APP_DIR.parent)
                missing.append(f"{rel}:{lineno} ({rule})")
    return missing


def test_hardcoded_password_candidates_are_annotated():
    """Each reviewed B105/B107 constant has a nosec annotation and reason."""
    missing = _unannotated_candidates()
    assert not missing, (
        "Bandit B105/B107 candidates without a `# nosec <id> - <reason>` "
        "annotation:\n  " + "\n  ".join(missing)
    )
