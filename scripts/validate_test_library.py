"""
CLI: validate shared/data/test_library.json for collision integrity.

Exit codes:
  0 — no errors (warnings may be present and are printed to stdout)
  1 — one or more error-level collisions
  2 — JSON file missing or malformed
  3 — unexpected validator exception
"""

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.services.test_library_validator import (  # noqa: E402
    CollisionResult,
    Severity,
    validate_test_library,
)

TEST_LIBRARY_PATH = REPO_ROOT / "shared" / "data" / "test_library.json"


def _print_group(label: str, results: list[CollisionResult]) -> None:
    if not results:
        return
    print(f"\n{label}:")
    for r in results:
        print(f"  {r.collision_type} '{r.key}'")
        for name in r.conflicting_tests:
            print(f"    - {name}")


def main() -> int:
    try:
        with TEST_LIBRARY_PATH.open(encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"ERROR: test library not found at {TEST_LIBRARY_PATH}", file=sys.stderr)
        return 2
    except json.JSONDecodeError as e:
        print(f"ERROR: test_library.json is not valid JSON: {e}", file=sys.stderr)
        return 2

    if "tests" not in data or not isinstance(data["tests"], list):
        print(
            "ERROR: test_library.json missing top-level 'tests' list", file=sys.stderr
        )
        return 2

    try:
        results = validate_test_library(data["tests"])
    except Exception as e:  # pragma: no cover — defensive
        print(f"ERROR: validator raised unexpected exception: {e}", file=sys.stderr)
        return 3

    errors = [r for r in results if r.severity == Severity.ERROR]
    warnings = [r for r in results if r.severity == Severity.WARNING]

    _print_group("ERRORS", errors)
    _print_group("WARNINGS", warnings)

    total_tests = len(data["tests"])
    print(
        f"\nChecked {total_tests} tests: "
        f"{len(errors)} error(s), {len(warnings)} warning(s)."
    )

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
