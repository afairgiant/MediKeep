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


def test_duplicate_display_order_is_an_error():
    """The next duplicate display_order must fail the shipped-library check."""
    tests = [
        {"test_name": "Test A", "display_order": 1},
        {"test_name": "Test B", "display_order": 1},
    ]
    results = validate_test_library(tests)
    dupes = [
        r
        for r in results
        if r.severity == Severity.ERROR and r.collision_type == "duplicate_display_order"
    ]
    assert dupes and dupes[0].conflicting_tests == ("Test A", "Test B")


def test_lipid_ratio_entries_have_loinc_codes(test_library_entries):
    """Each lipid ratio entry names the one LOINC test it stands for (#1221)."""
    missing = [
        entry["test_name"]
        for entry in test_library_entries
        if entry.get("category") == "lipids"
        and entry.get("default_unit") == "ratio"
        and not entry.get("test_code")
    ]
    assert not missing, f"Lipid ratio entries without test_code: {missing}"
