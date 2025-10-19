"""
Tests for standardized test CRUD operations.

Tests the dual database compatibility (PostgreSQL and SQLite)
for standardized tests with JSON array fields.
"""
import pytest
from sqlalchemy.orm import Session

from app.crud import standardized_test
from app.models.models import StandardizedTest


class TestStandardizedTestCRUD:
    """Test CRUD operations for standardized tests."""

    def test_create_test(self, db_session: Session):
        """Test creating a standardized test with JSON array."""
        test_data = {
            "loinc_code": "6690-2",
            "test_name": "White Blood Cell Count",
            "short_name": "WBC",
            "common_names": ["WBC", "Leukocyte Count", "White Count"],
            "category": "Hematology",
            "default_unit": "10*3/uL",
            "is_common": True,
            "display_order": 1
        }

        test = standardized_test.create_test(db_session, test_data)

        assert test.id is not None
        assert test.loinc_code == "6690-2"
        assert test.test_name == "White Blood Cell Count"
        assert test.short_name == "WBC"
        assert test.common_names == ["WBC", "Leukocyte Count", "White Count"]
        assert test.category == "Hematology"
        assert test.is_common is True

    def test_get_test_by_id(self, db_session: Session):
        """Test retrieving a test by ID."""
        test_data = {
            "loinc_code": "2345-7",
            "test_name": "Glucose",
            "short_name": "GLU",
            "common_names": ["Blood Sugar", "Glucose"],
            "category": "Chemistry",
            "default_unit": "mg/dL",
            "is_common": True
        }

        created_test = standardized_test.create_test(db_session, test_data)
        retrieved_test = standardized_test.get_test_by_id(db_session, created_test.id)

        assert retrieved_test is not None
        assert retrieved_test.id == created_test.id
        assert retrieved_test.test_name == "Glucose"

    def test_get_test_by_loinc(self, db_session: Session):
        """Test retrieving a test by LOINC code."""
        test_data = {
            "loinc_code": "718-7",
            "test_name": "Hemoglobin",
            "short_name": "Hgb",
            "common_names": ["Hemoglobin", "Hb"],
            "category": "Hematology",
            "default_unit": "g/dL",
            "is_common": True
        }

        standardized_test.create_test(db_session, test_data)
        retrieved_test = standardized_test.get_test_by_loinc(db_session, "718-7")

        assert retrieved_test is not None
        assert retrieved_test.loinc_code == "718-7"
        assert retrieved_test.test_name == "Hemoglobin"

    def test_get_test_by_name(self, db_session: Session):
        """Test retrieving a test by name (case-insensitive)."""
        test_data = {
            "loinc_code": "2951-2",
            "test_name": "Sodium",
            "short_name": "Na",
            "common_names": ["Sodium", "Na"],
            "category": "Chemistry",
            "default_unit": "mmol/L",
            "is_common": True
        }

        standardized_test.create_test(db_session, test_data)

        # Test case-insensitive matching
        retrieved_test = standardized_test.get_test_by_name(db_session, "sodium")
        assert retrieved_test is not None
        assert retrieved_test.test_name == "Sodium"

        retrieved_test2 = standardized_test.get_test_by_name(db_session, "SODIUM")
        assert retrieved_test2 is not None
        assert retrieved_test2.test_name == "Sodium"


class TestStandardizedTestSearch:
    """Test search functionality for standardized tests."""

    @pytest.fixture(autouse=True)
    def setup_test_data(self, db_session: Session):
        """Create test data for search tests."""
        tests_data = [
            {
                "loinc_code": "6690-2",
                "test_name": "White Blood Cell Count",
                "short_name": "WBC",
                "common_names": ["WBC", "Leukocyte Count", "White Count"],
                "category": "Hematology",
                "default_unit": "10*3/uL",
                "is_common": True,
                "display_order": 1
            },
            {
                "loinc_code": "2345-7",
                "test_name": "Glucose",
                "short_name": "GLU",
                "common_names": ["Blood Sugar", "Glucose"],
                "category": "Chemistry",
                "default_unit": "mg/dL",
                "is_common": True,
                "display_order": 2
            },
            {
                "loinc_code": "718-7",
                "test_name": "Hemoglobin",
                "short_name": "Hgb",
                "common_names": ["Hemoglobin", "Hb"],
                "category": "Hematology",
                "default_unit": "g/dL",
                "is_common": True,
                "display_order": 3
            },
            {
                "loinc_code": "2951-2",
                "test_name": "Sodium",
                "short_name": "Na",
                "common_names": ["Sodium", "Na"],
                "category": "Chemistry",
                "default_unit": "mmol/L",
                "is_common": False,
                "display_order": 4
            }
        ]

        standardized_test.bulk_create_tests(db_session, tests_data)

    def test_search_by_exact_name(self, db_session: Session):
        """Test searching by exact test name."""
        results = standardized_test.search_tests(db_session, "Glucose")

        assert len(results) > 0
        assert results[0].test_name == "Glucose"

    def test_search_by_short_name(self, db_session: Session):
        """Test searching by short name."""
        results = standardized_test.search_tests(db_session, "WBC")

        assert len(results) > 0
        assert results[0].short_name == "WBC"

    def test_search_by_common_name(self, db_session: Session):
        """Test searching by common name (JSON array field)."""
        results = standardized_test.search_tests(db_session, "Blood Sugar")

        assert len(results) > 0
        assert "Blood Sugar" in results[0].common_names

    def test_search_case_insensitive(self, db_session: Session):
        """Test case-insensitive search."""
        results_lower = standardized_test.search_tests(db_session, "glucose")
        results_upper = standardized_test.search_tests(db_session, "GLUCOSE")
        results_mixed = standardized_test.search_tests(db_session, "Glucose")

        assert len(results_lower) > 0
        assert len(results_upper) > 0
        assert len(results_mixed) > 0
        assert results_lower[0].id == results_upper[0].id == results_mixed[0].id

    def test_search_partial_match(self, db_session: Session):
        """Test partial matching."""
        results = standardized_test.search_tests(db_session, "blood")

        # Should match "White Blood Cell Count" (test_name contains "blood")
        assert len(results) >= 1
        assert any("Blood" in test.test_name for test in results)

    def test_search_with_special_characters(self, db_session: Session):
        """Test search with LIKE special characters (% and _)."""
        # These should be escaped and not treated as wildcards
        results = standardized_test.search_tests(db_session, "test%")

        # Should return 0 results since no test name contains literal "test%"
        assert len(results) == 0

    def test_search_by_category(self, db_session: Session):
        """Test filtering by category."""
        results = standardized_test.search_tests(db_session, "glu", category="Chemistry")

        assert len(results) > 0
        assert all(test.category == "Chemistry" for test in results)

    def test_search_empty_query(self, db_session: Session):
        """Test search with empty query returns common tests."""
        results = standardized_test.search_tests(db_session, "")

        # Should return only common tests
        assert len(results) > 0
        assert all(test.is_common for test in results)

    def test_search_with_limit(self, db_session: Session):
        """Test search result limiting."""
        results = standardized_test.search_tests(db_session, "", limit=2)

        assert len(results) <= 2


class TestStandardizedTestUpdate:
    """Test update operations for standardized tests."""

    def test_update_test(self, db_session: Session):
        """Test updating a standardized test."""
        test_data = {
            "loinc_code": "6690-2",
            "test_name": "White Blood Cell Count",
            "short_name": "WBC",
            "common_names": ["WBC"],
            "category": "Hematology",
            "default_unit": "10*3/uL",
            "is_common": False
        }

        test = standardized_test.create_test(db_session, test_data)

        # Update the test
        updates = {
            "is_common": True,
            "common_names": ["WBC", "Leukocyte Count", "White Count"]
        }

        updated_test = standardized_test.update_test(db_session, test.id, updates)

        assert updated_test is not None
        assert updated_test.is_common is True
        assert len(updated_test.common_names) == 3
        assert "Leukocyte Count" in updated_test.common_names

    def test_update_nonexistent_test(self, db_session: Session):
        """Test updating a test that doesn't exist."""
        result = standardized_test.update_test(db_session, 99999, {"is_common": True})

        assert result is None


class TestStandardizedTestDelete:
    """Test delete operations for standardized tests."""

    def test_delete_test(self, db_session: Session):
        """Test deleting a standardized test."""
        test_data = {
            "loinc_code": "6690-2",
            "test_name": "White Blood Cell Count",
            "short_name": "WBC",
            "common_names": ["WBC"],
            "category": "Hematology",
            "default_unit": "10*3/uL",
            "is_common": True
        }

        test = standardized_test.create_test(db_session, test_data)
        test_id = test.id

        # Delete the test
        result = standardized_test.delete_test(db_session, test_id)

        assert result is True

        # Verify it's gone
        deleted_test = standardized_test.get_test_by_id(db_session, test_id)
        assert deleted_test is None

    def test_delete_nonexistent_test(self, db_session: Session):
        """Test deleting a test that doesn't exist."""
        result = standardized_test.delete_test(db_session, 99999)

        assert result is False


class TestStandardizedTestBulkOperations:
    """Test bulk operations for standardized tests."""

    def test_bulk_create_tests(self, db_session: Session):
        """Test bulk creating standardized tests."""
        tests_data = [
            {
                "loinc_code": "6690-2",
                "test_name": "White Blood Cell Count",
                "short_name": "WBC",
                "common_names": ["WBC", "Leukocyte Count"],
                "category": "Hematology",
                "default_unit": "10*3/uL",
                "is_common": True
            },
            {
                "loinc_code": "2345-7",
                "test_name": "Glucose",
                "short_name": "GLU",
                "common_names": ["Blood Sugar", "Glucose"],
                "category": "Chemistry",
                "default_unit": "mg/dL",
                "is_common": True
            }
        ]

        count = standardized_test.bulk_create_tests(db_session, tests_data)

        assert count == 2

        # Verify they exist
        test1 = standardized_test.get_test_by_loinc(db_session, "6690-2")
        test2 = standardized_test.get_test_by_loinc(db_session, "2345-7")

        assert test1 is not None
        assert test2 is not None

    def test_count_tests(self, db_session: Session):
        """Test counting tests."""
        tests_data = [
            {
                "loinc_code": "6690-2",
                "test_name": "White Blood Cell Count",
                "short_name": "WBC",
                "common_names": ["WBC"],
                "category": "Hematology",
                "default_unit": "10*3/uL",
                "is_common": True
            },
            {
                "loinc_code": "2345-7",
                "test_name": "Glucose",
                "short_name": "GLU",
                "common_names": ["Glucose"],
                "category": "Chemistry",
                "default_unit": "mg/dL",
                "is_common": True
            }
        ]

        standardized_test.bulk_create_tests(db_session, tests_data)

        total_count = standardized_test.count_tests(db_session)
        assert total_count == 2

        hematology_count = standardized_test.count_tests(db_session, category="Hematology")
        assert hematology_count == 1

    def test_clear_all_tests(self, db_session: Session):
        """Test clearing all tests."""
        tests_data = [
            {
                "loinc_code": "6690-2",
                "test_name": "White Blood Cell Count",
                "short_name": "WBC",
                "common_names": ["WBC"],
                "category": "Hematology",
                "default_unit": "10*3/uL",
                "is_common": True
            }
        ]

        standardized_test.bulk_create_tests(db_session, tests_data)

        count = standardized_test.clear_all_tests(db_session)
        assert count == 1

        # Verify all tests are gone
        remaining_count = standardized_test.count_tests(db_session)
        assert remaining_count == 0


class TestStandardizedTestHelperMethods:
    """Test helper methods for standardized tests."""

    def test_get_common_tests(self, db_session: Session):
        """Test getting common tests."""
        tests_data = [
            {
                "loinc_code": "6690-2",
                "test_name": "White Blood Cell Count",
                "short_name": "WBC",
                "common_names": ["WBC"],
                "category": "Hematology",
                "default_unit": "10*3/uL",
                "is_common": True,
                "display_order": 1
            },
            {
                "loinc_code": "2345-7",
                "test_name": "Glucose",
                "short_name": "GLU",
                "common_names": ["Glucose"],
                "category": "Chemistry",
                "default_unit": "mg/dL",
                "is_common": False,
                "display_order": 2
            }
        ]

        standardized_test.bulk_create_tests(db_session, tests_data)

        common_tests = standardized_test.get_common_tests(db_session)

        assert len(common_tests) == 1
        assert common_tests[0].test_name == "White Blood Cell Count"

    def test_get_tests_by_category(self, db_session: Session):
        """Test getting tests by category."""
        tests_data = [
            {
                "loinc_code": "6690-2",
                "test_name": "White Blood Cell Count",
                "short_name": "WBC",
                "common_names": ["WBC"],
                "category": "Hematology",
                "default_unit": "10*3/uL",
                "is_common": True,
                "display_order": 1
            },
            {
                "loinc_code": "2345-7",
                "test_name": "Glucose",
                "short_name": "GLU",
                "common_names": ["Glucose"],
                "category": "Chemistry",
                "default_unit": "mg/dL",
                "is_common": True,
                "display_order": 2
            }
        ]

        standardized_test.bulk_create_tests(db_session, tests_data)

        hematology_tests = standardized_test.get_tests_by_category(db_session, "Hematology")

        assert len(hematology_tests) == 1
        assert hematology_tests[0].category == "Hematology"

    def test_get_autocomplete_options(self, db_session: Session):
        """Test getting autocomplete options."""
        tests_data = [
            {
                "loinc_code": "6690-2",
                "test_name": "White Blood Cell Count",
                "short_name": "WBC",
                "common_names": ["WBC"],
                "category": "Hematology",
                "default_unit": "10*3/uL",
                "is_common": True
            }
        ]

        standardized_test.bulk_create_tests(db_session, tests_data)

        options = standardized_test.get_autocomplete_options(db_session, "wbc")

        assert len(options) > 0
        assert options[0]["label"] == "White Blood Cell Count"
        assert options[0]["loinc_code"] == "6690-2"
        assert options[0]["category"] == "Hematology"
