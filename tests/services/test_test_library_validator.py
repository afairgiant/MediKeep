"""Unit tests for the test library validator."""

import pytest

from app.services.test_library_validator import (
    CollisionResult,
    Severity,
    validate_test_library,
)


def _make_test(test_name, abbreviation=None, common_names=None, test_code=None):
    """Build a minimal test dict for fixtures."""
    entry = {"test_name": test_name}
    if abbreviation is not None:
        entry["abbreviation"] = abbreviation
    if common_names is not None:
        entry["common_names"] = common_names
    if test_code is not None:
        entry["test_code"] = test_code
    return entry


class TestValidatorHappyPath:
    def test_empty_list_returns_no_collisions(self):
        assert validate_test_library([]) == []

    def test_single_valid_test_returns_no_collisions(self):
        tests = [
            _make_test("Glucose", abbreviation="GLU", common_names=["Blood Sugar"])
        ]
        assert validate_test_library(tests) == []

    def test_tests_with_only_test_name_are_valid(self):
        tests = [_make_test("Alpha"), _make_test("Beta")]
        assert validate_test_library(tests) == []


class TestDuplicateTestName:
    def test_duplicate_test_name_is_error(self):
        tests = [_make_test("Glucose"), _make_test("Glucose")]
        results = validate_test_library(tests)
        assert len(results) == 1
        assert results[0].severity == Severity.ERROR
        assert results[0].collision_type == "duplicate_test_name"
        assert results[0].key == "glucose"

    def test_duplicate_test_name_is_case_insensitive(self):
        tests = [_make_test("Glucose"), _make_test("GLUCOSE")]
        results = validate_test_library(tests)
        assert len(results) == 1
        assert results[0].collision_type == "duplicate_test_name"

    def test_duplicate_test_name_is_whitespace_insensitive(self):
        tests = [_make_test("Glucose"), _make_test("  Glucose  ")]
        results = validate_test_library(tests)
        assert len(results) == 1


class TestDuplicateAbbreviation:
    def test_two_tests_sharing_abbreviation_is_error(self):
        tests = [
            _make_test("Albumin/Globulin Ratio", abbreviation="AG"),
            _make_test("Anion Gap", abbreviation="AG"),
        ]
        results = [
            r
            for r in validate_test_library(tests)
            if r.collision_type == "duplicate_abbreviation"
        ]
        assert len(results) == 1
        assert results[0].severity == Severity.ERROR
        assert results[0].key == "ag"
        assert sorted(results[0].conflicting_tests) == [
            "Albumin/Globulin Ratio",
            "Anion Gap",
        ]

    def test_missing_abbreviation_is_not_a_collision(self):
        tests = [_make_test("Alpha"), _make_test("Beta")]
        assert validate_test_library(tests) == []


class TestDuplicateCommonName:
    def test_two_tests_sharing_common_name_is_error(self):
        tests = [
            _make_test("Glucose", common_names=["Sugar"]),
            _make_test("Fructose", common_names=["Sugar"]),
        ]
        results = [
            r
            for r in validate_test_library(tests)
            if r.collision_type == "duplicate_common_name"
        ]
        assert len(results) == 1
        assert results[0].severity == Severity.ERROR
        assert results[0].key == "sugar"

    def test_overlapping_common_names_produce_one_result_per_overlap(self):
        tests = [
            _make_test("A", common_names=["x", "y"]),
            _make_test("B", common_names=["x", "y"]),
        ]
        results = [
            r
            for r in validate_test_library(tests)
            if r.collision_type == "duplicate_common_name"
        ]
        assert len(results) == 2
        keys = sorted(r.key for r in results)
        assert keys == ["x", "y"]


class TestDuplicateTestCode:
    def test_two_tests_sharing_test_code_is_error(self):
        tests = [
            _make_test("A", test_code="1742-6"),
            _make_test("B", test_code="1742-6"),
        ]
        results = [
            r
            for r in validate_test_library(tests)
            if r.collision_type == "duplicate_test_code"
        ]
        assert len(results) == 1
        assert results[0].severity == Severity.ERROR
        assert results[0].key == "1742-6"

    def test_missing_test_code_is_not_a_collision(self):
        tests = [_make_test("A"), _make_test("B")]
        assert validate_test_library(tests) == []


class TestIntraTestDuplicatesAreIgnored:
    def test_abbreviation_listed_in_own_common_names_is_not_a_collision(self):
        tests = [
            _make_test(
                "Alanine Aminotransferase",
                abbreviation="ALT",
                common_names=["ALT", "SGPT"],
            )
        ]
        assert validate_test_library(tests) == []

    def test_same_common_name_listed_twice_in_one_test_is_not_a_collision(self):
        tests = [_make_test("A", common_names=["X", "X"])]
        assert validate_test_library(tests) == []

    def test_empty_common_names_entries_are_ignored(self):
        tests = [
            _make_test("A", common_names=["Sugar", ""]),
            _make_test("B", common_names=["", "Salt"]),
        ]
        results = [
            r
            for r in validate_test_library(tests)
            if r.collision_type == "duplicate_common_name"
        ]
        assert results == []

    def test_whitespace_only_common_names_entries_are_ignored(self):
        tests = [
            _make_test("A", common_names=["   "]),
            _make_test("B", common_names=["\t"]),
        ]
        results = [
            r
            for r in validate_test_library(tests)
            if r.collision_type == "duplicate_common_name"
        ]
        assert results == []

    def test_whitespace_only_abbreviation_is_ignored(self):
        tests = [
            _make_test("A", abbreviation="   "),
            _make_test("B", abbreviation="\t"),
        ]
        results = [
            r
            for r in validate_test_library(tests)
            if r.collision_type == "duplicate_abbreviation"
        ]
        assert results == []


class TestCrossFieldCollisionIsWarning:
    def test_test_a_abbreviation_matches_test_b_common_name_is_warning(self):
        tests = [
            _make_test("Alpha", abbreviation="GLU"),
            _make_test("Beta", common_names=["GLU"]),
        ]
        results = validate_test_library(tests)
        warnings = [r for r in results if r.severity == Severity.WARNING]
        assert len(warnings) == 1
        assert warnings[0].collision_type == "cross_field_collision"

    def test_test_a_abbreviation_matches_test_b_test_name_is_warning(self):
        tests = [
            _make_test("Alpha", abbreviation="BETA"),
            _make_test("Beta"),
        ]
        results = validate_test_library(tests)
        warnings = [r for r in results if r.severity == Severity.WARNING]
        assert len(warnings) == 1
        assert warnings[0].collision_type == "cross_field_collision"

    def test_no_cross_field_warning_when_same_test(self):
        tests = [_make_test("ALT", abbreviation="ALT")]
        results = validate_test_library(tests)
        warnings = [r for r in results if r.severity == Severity.WARNING]
        assert warnings == []


class TestResultOrdering:
    def test_results_sorted_by_severity_then_type_then_key(self):
        tests = [
            _make_test("A", abbreviation="X"),
            _make_test("B", abbreviation="X"),
            _make_test("Zebra"),
            _make_test("Zebra"),
            _make_test("C", test_code="999"),
            _make_test("D", test_code="999"),
        ]
        results = validate_test_library(tests)
        error_types = [
            r.collision_type for r in results if r.severity == Severity.ERROR
        ]
        assert error_types == [
            "duplicate_abbreviation",
            "duplicate_test_code",
            "duplicate_test_name",
        ]


class TestMultiwayCollisions:
    def test_three_tests_sharing_abbreviation(self):
        tests = [
            _make_test("A", abbreviation="X"),
            _make_test("B", abbreviation="X"),
            _make_test("C", abbreviation="X"),
        ]
        results = [
            r
            for r in validate_test_library(tests)
            if r.collision_type == "duplicate_abbreviation"
        ]
        assert len(results) == 1
        assert results[0].conflicting_tests == ("A", "B", "C")
        assert "3 tests" in results[0].message


class TestMalformedInput:
    def test_non_list_input_raises(self):
        with pytest.raises(TypeError):
            validate_test_library({"tests": []})  # type: ignore[arg-type]

    def test_missing_test_name_raises(self):
        with pytest.raises(ValueError, match="test_name"):
            validate_test_library([{"abbreviation": "X"}])

    def test_empty_test_name_raises(self):
        with pytest.raises(ValueError, match="empty 'test_name'"):
            validate_test_library([{"test_name": "   "}])
