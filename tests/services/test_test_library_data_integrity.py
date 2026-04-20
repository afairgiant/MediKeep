"""
Data integrity check: the shipped test_library.json must have no error-level
collisions. Warnings are printed for visibility but do not fail the test.
"""

import json
from pathlib import Path

import pytest

from app.services.test_library_validator import (
    CollisionResult,
    Severity,
    validate_test_library,
)

TEST_LIBRARY_PATH = (
    Path(__file__).resolve().parents[2] / "shared" / "data" / "test_library.json"
)


@pytest.fixture(scope="module")
def test_library_entries():
    assert (
        TEST_LIBRARY_PATH.exists()
    ), f"test_library.json not found at {TEST_LIBRARY_PATH}"
    with TEST_LIBRARY_PATH.open(encoding="utf-8") as f:
        data = json.load(f)
    assert "tests" in data, "test_library.json missing top-level 'tests' key"
    return data["tests"]


def _format_results(results: list[CollisionResult]) -> str:
    return "\n".join(
        f"  [{r.severity.value}] {r.collision_type} '{r.key}': {r.message}"
        for r in results
    )


def test_no_error_level_collisions_in_shipped_library(test_library_entries, capsys):
    results = validate_test_library(test_library_entries)
    errors = [r for r in results if r.severity == Severity.ERROR]
    warnings = [r for r in results if r.severity == Severity.WARNING]

    if warnings:
        print("\nTest library warnings (non-blocking):")
        print(_format_results(warnings))

    assert not errors, (
        f"Found {len(errors)} error-level collision(s) in shipped test_library.json:\n"
        + _format_results(errors)
    )
