"""
Tests for Standardized Tests API endpoints.

Tests LOINC-based test search, autocomplete, and category filtering.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.models import StandardizedTest
from tests.utils.user import create_random_user, create_user_token_headers


class TestStandardizedTestsAPI:
    """Test Standardized Tests API endpoints."""

    @pytest.fixture
    def authenticated_headers(self, db_session: Session):
        """Create authentication headers."""
        user_data = create_random_user(db_session)
        return create_user_token_headers(user_data["user"].username)

    @pytest.fixture
    def sample_tests(self, db_session: Session):
        """Create sample standardized tests for testing."""
        tests = [
            StandardizedTest(
                loinc_code="6690-2",
                test_name="Leukocytes [#/volume] in Blood",
                short_name="WBC",
                default_unit="10^3/uL",
                category="hematology",
                common_names=["White Blood Cell Count", "WBC", "Leukocyte Count"],
                is_common=True,
                display_order=1
            ),
            StandardizedTest(
                loinc_code="789-8",
                test_name="Erythrocytes [#/volume] in Blood",
                short_name="RBC",
                default_unit="10^6/uL",
                category="hematology",
                common_names=["Red Blood Cell Count", "RBC", "Erythrocyte Count"],
                is_common=True,
                display_order=2
            ),
            StandardizedTest(
                loinc_code="718-7",
                test_name="Hemoglobin [Mass/volume] in Blood",
                short_name="Hgb",
                default_unit="g/dL",
                category="hematology",
                common_names=["Hemoglobin", "Hgb", "Hb"],
                is_common=True,
                display_order=3
            ),
            StandardizedTest(
                loinc_code="2093-3",
                test_name="Cholesterol [Mass/volume] in Serum or Plasma",
                short_name="Cholesterol",
                default_unit="mg/dL",
                category="lipids",
                common_names=["Total Cholesterol", "Cholesterol"],
                is_common=True,
                display_order=10
            ),
            StandardizedTest(
                loinc_code="2085-9",
                test_name="Cholesterol in HDL [Mass/volume] in Serum or Plasma",
                short_name="HDL",
                default_unit="mg/dL",
                category="lipids",
                common_names=["HDL Cholesterol", "HDL", "Good Cholesterol"],
                is_common=True,
                display_order=11
            ),
            StandardizedTest(
                loinc_code="2571-8",
                test_name="Triglyceride [Mass/volume] in Serum or Plasma",
                short_name="Trig",
                default_unit="mg/dL",
                category="lipids",
                common_names=["Triglycerides", "Trig"],
                is_common=False,
                display_order=12
            ),
        ]

        db_session.bulk_save_objects(tests)
        db_session.commit()

        # Refresh to get IDs
        return db_session.query(StandardizedTest).all()

    # ========== Search Tests ==========

    def test_search_by_test_name(self, client: TestClient, sample_tests, authenticated_headers):
        """Test searching for tests by name."""
        response = client.get(
            "/api/v1/standardized-tests/search?query=Hemoglobin",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data['total'] >= 1
        test_names = [t['test_name'] for t in data['tests']]
        assert any('Hemoglobin' in name for name in test_names)

    def test_search_by_short_name(self, client: TestClient, sample_tests, authenticated_headers):
        """Test searching for tests by short name."""
        response = client.get(
            "/api/v1/standardized-tests/search?query=WBC",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data['total'] >= 1
        assert any(t['short_name'] == 'WBC' for t in data['tests'])

    def test_search_by_loinc_code(self, client: TestClient, sample_tests, authenticated_headers):
        """Test searching for tests by LOINC code."""
        response = client.get(
            "/api/v1/standardized-tests/search?query=6690-2",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data['total'] >= 1
        assert any(t['loinc_code'] == '6690-2' for t in data['tests'])

    def test_search_partial_match(self, client: TestClient, sample_tests, authenticated_headers):
        """Test partial text matching in search."""
        response = client.get(
            "/api/v1/standardized-tests/search?query=Chol",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data['total'] >= 2  # Should match both Total Cholesterol and HDL Cholesterol
        test_names = [t['test_name'] for t in data['tests']]
        assert any('Cholesterol' in name for name in test_names)

    def test_search_with_category_filter(self, client: TestClient, sample_tests, authenticated_headers):
        """Test searching with category filter."""
        response = client.get(
            "/api/v1/standardized-tests/search?query=&category=hematology",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data['total'] >= 3
        assert all(t['category'] == 'hematology' for t in data['tests'])

    def test_search_empty_query_returns_common_tests(self, client: TestClient, sample_tests, authenticated_headers):
        """Test that empty search query returns common tests."""
        response = client.get(
            "/api/v1/standardized-tests/search?query=",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data['total'] >= 1
        assert all(t['is_common'] for t in data['tests'])

    def test_search_no_results(self, client: TestClient, sample_tests, authenticated_headers):
        """Test search with no matching results."""
        response = client.get(
            "/api/v1/standardized-tests/search?query=NonexistentTestName123",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 0
        assert len(data['tests']) == 0

    def test_search_limit_parameter(self, client: TestClient, sample_tests, authenticated_headers):
        """Test limit parameter in search."""
        response = client.get(
            "/api/v1/standardized-tests/search?query=&limit=2",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data['tests']) <= 2

    # ========== Autocomplete Tests ==========

    def test_autocomplete_basic(self, client: TestClient, sample_tests, authenticated_headers):
        """Test basic autocomplete functionality."""
        response = client.get(
            "/api/v1/standardized-tests/autocomplete?query=WBC",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert any('WBC' in opt['label'] or 'WBC' in opt['value'] for opt in data)

    def test_autocomplete_returns_formatted_options(self, client: TestClient, sample_tests, authenticated_headers):
        """Test that autocomplete returns properly formatted options."""
        response = client.get(
            "/api/v1/standardized-tests/autocomplete?query=Hemoglobin",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

        # Check structure of first option
        option = data[0]
        assert 'value' in option
        assert 'label' in option
        assert 'loinc_code' in option
        assert 'default_unit' in option
        assert 'category' in option

    def test_autocomplete_with_category_filter(self, client: TestClient, sample_tests, authenticated_headers):
        """Test autocomplete with category filter."""
        response = client.get(
            "/api/v1/standardized-tests/autocomplete?query=&category=lipids",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        assert all(opt['category'] == 'lipids' for opt in data)

    def test_autocomplete_limit(self, client: TestClient, sample_tests, authenticated_headers):
        """Test autocomplete respects limit parameter."""
        response = client.get(
            "/api/v1/standardized-tests/autocomplete?query=&limit=3",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 3

    # ========== Common Tests Endpoint ==========

    def test_get_common_tests(self, client: TestClient, sample_tests, authenticated_headers):
        """Test getting common/frequently used tests."""
        response = client.get(
            "/api/v1/standardized-tests/common",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 5  # We created 5 common tests
        assert all(t['is_common'] for t in data)

    def test_get_common_tests_by_category(self, client: TestClient, sample_tests, authenticated_headers):
        """Test filtering common tests by category."""
        response = client.get(
            "/api/v1/standardized-tests/common?category=hematology",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3
        assert all(t['category'] == 'hematology' for t in data)
        assert all(t['is_common'] for t in data)

    def test_get_common_tests_ordered(self, client: TestClient, sample_tests, authenticated_headers):
        """Test that common tests are returned in display order."""
        response = client.get(
            "/api/v1/standardized-tests/common?category=hematology",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()

        # Check display order is ascending
        orders = [t['display_order'] for t in data if t.get('display_order')]
        assert orders == sorted(orders)

    # ========== Category Endpoint ==========

    def test_get_tests_by_category(self, client: TestClient, sample_tests, authenticated_headers):
        """Test getting all tests in a category."""
        response = client.get(
            "/api/v1/standardized-tests/by-category/lipids",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3
        assert all(t['category'] == 'lipids' for t in data)

    def test_get_tests_by_nonexistent_category(self, client: TestClient, sample_tests, authenticated_headers):
        """Test getting tests for non-existent category."""
        response = client.get(
            "/api/v1/standardized-tests/by-category/nonexistent",
            headers=authenticated_headers
        )

        assert response.status_code == 404

    # ========== LOINC Lookup ==========

    def test_get_test_by_loinc(self, client: TestClient, sample_tests, authenticated_headers):
        """Test getting a test by LOINC code."""
        response = client.get(
            "/api/v1/standardized-tests/by-loinc/6690-2",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data['loinc_code'] == '6690-2'
        assert data['short_name'] == 'WBC'

    def test_get_test_by_invalid_loinc(self, client: TestClient, sample_tests, authenticated_headers):
        """Test getting test with non-existent LOINC code."""
        response = client.get(
            "/api/v1/standardized-tests/by-loinc/9999-9",
            headers=authenticated_headers
        )

        assert response.status_code == 404

    # ========== Name Lookup ==========

    def test_get_test_by_name(self, client: TestClient, sample_tests, authenticated_headers):
        """Test getting a test by exact name match."""
        response = client.get(
            "/api/v1/standardized-tests/by-name/Hemoglobin [Mass/volume] in Blood",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data['test_name'] == 'Hemoglobin [Mass/volume] in Blood'
        assert data['short_name'] == 'Hgb'

    def test_get_test_by_name_case_insensitive(self, client: TestClient, sample_tests, authenticated_headers):
        """Test that name lookup is case-insensitive."""
        response = client.get(
            "/api/v1/standardized-tests/by-name/hemoglobin [mass/volume] in blood",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data['test_name'] == 'Hemoglobin [Mass/volume] in Blood'

    def test_get_test_by_invalid_name(self, client: TestClient, sample_tests, authenticated_headers):
        """Test getting test with non-existent name."""
        response = client.get(
            "/api/v1/standardized-tests/by-name/Nonexistent Test Name",
            headers=authenticated_headers
        )

        assert response.status_code == 404

    # ========== Count Endpoint ==========

    def test_count_all_tests(self, client: TestClient, sample_tests, authenticated_headers):
        """Test counting all tests."""
        response = client.get(
            "/api/v1/standardized-tests/count",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert 'count' in data
        assert data['count'] >= 6

    def test_count_tests_by_category(self, client: TestClient, sample_tests, authenticated_headers):
        """Test counting tests in a specific category."""
        response = client.get(
            "/api/v1/standardized-tests/count?category=hematology",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data['category'] == 'hematology'
        assert data['count'] >= 3

    # ========== Authorization Tests ==========

    def test_search_requires_authentication(self, client: TestClient, sample_tests):
        """Test that search endpoint requires authentication."""
        response = client.get("/api/v1/standardized-tests/search")

        assert response.status_code == 401

    def test_autocomplete_requires_authentication(self, client: TestClient, sample_tests):
        """Test that autocomplete endpoint requires authentication."""
        response = client.get("/api/v1/standardized-tests/autocomplete")

        assert response.status_code == 401

    # ========== Edge Cases ==========

    def test_search_with_special_characters(self, client: TestClient, sample_tests, authenticated_headers):
        """Test search with special characters in query."""
        response = client.get(
            "/api/v1/standardized-tests/search?query=[#/volume]",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        # Should handle special regex characters safely

    def test_very_long_query(self, client: TestClient, sample_tests, authenticated_headers):
        """Test search with very long query string."""
        long_query = "test" * 100  # 400 characters

        response = client.get(
            f"/api/v1/standardized-tests/search?query={long_query}",
            headers=authenticated_headers
        )

        assert response.status_code == 200

    def test_limit_boundary_values(self, client: TestClient, sample_tests, authenticated_headers):
        """Test limit parameter with boundary values."""
        # Minimum allowed
        response = client.get(
            "/api/v1/standardized-tests/search?limit=1",
            headers=authenticated_headers
        )
        assert response.status_code == 200

        # Maximum allowed
        response = client.get(
            "/api/v1/standardized-tests/search?limit=1000",
            headers=authenticated_headers
        )
        assert response.status_code == 200

        # Below minimum (should fail validation)
        response = client.get(
            "/api/v1/standardized-tests/search?limit=0",
            headers=authenticated_headers
        )
        assert response.status_code == 422

        # Above maximum (should fail validation)
        response = client.get(
            "/api/v1/standardized-tests/search?limit=1001",
            headers=authenticated_headers
        )
        assert response.status_code == 422
