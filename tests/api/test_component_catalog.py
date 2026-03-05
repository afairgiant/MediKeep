"""
Tests for Component Catalog API endpoint.
"""
import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers


class TestComponentCatalogAPI:
    """Test the /lab-test-components/patient/{id}/component-catalog endpoint."""

    @pytest.fixture
    def user_with_patient(self, db_session: Session):
        """Create a user with patient record for testing."""
        user_data = create_random_user(db_session)
        patient_data = PatientCreate(
            first_name="Jane",
            last_name="Catalog",
            birth_date=date(1985, 6, 15),
            gender="F",
            address="456 Lab Ave",
        )
        patient = patient_crud.create_for_user(
            db_session, user_id=user_data["user"].id, patient_data=patient_data
        )
        user_data["user"].active_patient_id = patient.id
        db_session.commit()
        db_session.refresh(user_data["user"])
        return {**user_data, "patient": patient}

    @pytest.fixture
    def authenticated_headers(self, user_with_patient):
        return create_user_token_headers(user_with_patient["user"].username)

    @pytest.fixture
    def lab_result_with_components(self, client, user_with_patient, authenticated_headers):
        """Create a lab result with test components."""
        patient_id = user_with_patient["patient"].id

        # Create lab result
        lr_resp = client.post(
            "/api/v1/lab-results/",
            json={
                "patient_id": patient_id,
                "test_name": "Comprehensive Metabolic Panel",
                "status": "completed",
                "completed_date": "2024-06-01",
            },
            headers=authenticated_headers,
        )
        assert lr_resp.status_code == 201
        lab_result_id = lr_resp.json()["id"]

        # Create components in bulk
        components = [
            {
                "test_name": "Glucose",
                "abbreviation": "GLU",
                "value": 95.0,
                "unit": "mg/dL",
                "ref_range_min": 70.0,
                "ref_range_max": 100.0,
                "status": "normal",
                "category": "endocrinology",
                "lab_result_id": lab_result_id,
                "result_type": "quantitative",
            },
            {
                "test_name": "Sodium",
                "abbreviation": "Na",
                "value": 142.0,
                "unit": "mmol/L",
                "ref_range_min": 136.0,
                "ref_range_max": 145.0,
                "status": "normal",
                "category": "chemistry",
                "lab_result_id": lab_result_id,
                "result_type": "quantitative",
            },
            {
                "test_name": "ALT",
                "abbreviation": "ALT",
                "value": 55.0,
                "unit": "U/L",
                "ref_range_min": 7.0,
                "ref_range_max": 40.0,
                "status": "high",
                "category": "hepatology",
                "lab_result_id": lab_result_id,
                "result_type": "quantitative",
            },
        ]

        bulk_resp = client.post(
            f"/api/v1/lab-test-components/lab-result/{lab_result_id}/components/bulk",
            json={"lab_result_id": lab_result_id, "components": components},
            headers=authenticated_headers,
        )
        assert bulk_resp.status_code == 201

        return {"lab_result_id": lab_result_id, "patient_id": patient_id}

    def test_catalog_returns_aggregated_data(
        self, client, user_with_patient, authenticated_headers, lab_result_with_components
    ):
        """Test that catalog endpoint returns grouped test components."""
        patient_id = lab_result_with_components["patient_id"]

        response = client.get(
            f"/api/v1/lab-test-components/patient/{patient_id}/component-catalog",
            headers=authenticated_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] == 3

        test_names = [item["test_name"] for item in data["items"]]
        assert "Glucose" in test_names
        assert "Sodium" in test_names
        assert "ALT" in test_names

    def test_catalog_includes_trend_test_name(
        self, client, user_with_patient, authenticated_headers, lab_result_with_components
    ):
        """Test that each catalog entry includes trend_test_name for trend lookups."""
        patient_id = lab_result_with_components["patient_id"]

        response = client.get(
            f"/api/v1/lab-test-components/patient/{patient_id}/component-catalog",
            headers=authenticated_headers,
        )

        assert response.status_code == 200
        for item in response.json()["items"]:
            assert "trend_test_name" in item
            assert item["trend_test_name"]  # not empty

    def test_catalog_sorts_abnormal_first(
        self, client, user_with_patient, authenticated_headers, lab_result_with_components
    ):
        """Test that abnormal results appear before normal ones."""
        patient_id = lab_result_with_components["patient_id"]

        response = client.get(
            f"/api/v1/lab-test-components/patient/{patient_id}/component-catalog",
            headers=authenticated_headers,
        )

        assert response.status_code == 200
        items = response.json()["items"]
        # ALT (high) should come before Glucose (normal) and Sodium (normal)
        assert items[0]["test_name"] == "ALT"
        assert items[0]["status"] == "high"

    def test_catalog_search_filter(
        self, client, user_with_patient, authenticated_headers, lab_result_with_components
    ):
        """Test search filter on test names."""
        patient_id = lab_result_with_components["patient_id"]

        response = client.get(
            f"/api/v1/lab-test-components/patient/{patient_id}/component-catalog",
            params={"search": "Glu"},
            headers=authenticated_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["test_name"] == "Glucose"

    def test_catalog_category_filter(
        self, client, user_with_patient, authenticated_headers, lab_result_with_components
    ):
        """Test category filter."""
        patient_id = lab_result_with_components["patient_id"]

        response = client.get(
            f"/api/v1/lab-test-components/patient/{patient_id}/component-catalog",
            params={"category": "chemistry"},
            headers=authenticated_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["test_name"] == "Sodium"

    def test_catalog_status_filter(
        self, client, user_with_patient, authenticated_headers, lab_result_with_components
    ):
        """Test status filter returns only matching statuses."""
        patient_id = lab_result_with_components["patient_id"]

        response = client.get(
            f"/api/v1/lab-test-components/patient/{patient_id}/component-catalog",
            params={"status": "high"},
            headers=authenticated_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["status"] == "high"

    def test_catalog_empty_patient(
        self, client, user_with_patient, authenticated_headers
    ):
        """Test catalog for patient with no lab results."""
        patient_id = user_with_patient["patient"].id

        response = client.get(
            f"/api/v1/lab-test-components/patient/{patient_id}/component-catalog",
            headers=authenticated_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []

    def test_catalog_requires_authentication(self, client, user_with_patient):
        """Test that unauthenticated requests are rejected."""
        patient_id = user_with_patient["patient"].id

        response = client.get(
            f"/api/v1/lab-test-components/patient/{patient_id}/component-catalog",
        )

        assert response.status_code == 401

    def test_catalog_reading_count_with_multiple_lab_results(
        self, client, user_with_patient, authenticated_headers, lab_result_with_components
    ):
        """Test that reading_count aggregates across multiple lab results."""
        patient_id = lab_result_with_components["patient_id"]

        # Create a second lab result with another Glucose reading
        lr2 = client.post(
            "/api/v1/lab-results/",
            json={
                "patient_id": patient_id,
                "test_name": "Follow-up Panel",
                "status": "completed",
                "completed_date": "2024-07-01",
            },
            headers=authenticated_headers,
        )
        assert lr2.status_code == 201
        lr2_id = lr2.json()["id"]

        client.post(
            f"/api/v1/lab-test-components/lab-result/{lr2_id}/components",
            json={
                "test_name": "Glucose",
                "abbreviation": "GLU",
                "value": 102.0,
                "unit": "mg/dL",
                "ref_range_min": 70.0,
                "ref_range_max": 100.0,
                "status": "high",
                "category": "endocrinology",
                "lab_result_id": lr2_id,
                "result_type": "quantitative",
            },
            headers=authenticated_headers,
        )

        response = client.get(
            f"/api/v1/lab-test-components/patient/{patient_id}/component-catalog",
            headers=authenticated_headers,
        )

        assert response.status_code == 200
        items = response.json()["items"]
        glucose = next(i for i in items if i["test_name"] == "Glucose")
        assert glucose["reading_count"] == 2
        # Latest reading should be from the second lab result (higher date)
        assert glucose["latest_value"] == 102.0
        assert glucose["status"] == "high"
