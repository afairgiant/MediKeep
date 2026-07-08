"""
Tests for the lab test component trends endpoint.

Regression coverage for GitHub issue #916: trend lookups for test names
containing non-ASCII characters (e.g. Chinese, Thai, Cyrillic) were rejected
by an overly strict search-query validator.
"""

import pytest
from datetime import date
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers


class TestLabTestComponentTrendsAPI:
    """Test the /lab-test-components/patient/{id}/trends endpoint."""

    @pytest.fixture
    def user_with_patient(self, db_session: Session):
        user_data = create_random_user(db_session)
        patient_data = PatientCreate(
            first_name="Jane",
            last_name="Trends",
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

    def _create_component(self, client, headers, patient_id, test_name):
        lr_resp = client.post(
            "/api/v1/lab-results/",
            json={
                "patient_id": patient_id,
                "test_name": "Panel",
                "status": "completed",
                "completed_date": "2024-06-01",
            },
            headers=headers,
        )
        assert lr_resp.status_code == 201
        lab_result_id = lr_resp.json()["id"]

        bulk_resp = client.post(
            f"/api/v1/lab-test-components/lab-result/{lab_result_id}/components/bulk",
            json={
                "lab_result_id": lab_result_id,
                "components": [
                    {
                        "test_name": test_name,
                        "value": 170.0,
                        "unit": "cm",
                        "status": "normal",
                        "lab_result_id": lab_result_id,
                        "result_type": "quantitative",
                    }
                ],
            },
            headers=headers,
        )
        assert bulk_resp.status_code == 201
        return lab_result_id

    def test_trends_accepts_chinese_test_name(
        self, client, user_with_patient, authenticated_headers
    ):
        """Trend lookup for a test name in Chinese should succeed (issue #916)."""
        patient_id = user_with_patient["patient"].id
        test_name = "身高"  # "height" in Chinese

        self._create_component(client, authenticated_headers, patient_id, test_name)

        response = client.get(
            f"/api/v1/lab-test-components/patient/{patient_id}/trends",
            params={"test_name": test_name},
            headers=authenticated_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["test_name"] == test_name
        assert len(data["data_points"]) == 1

    @pytest.mark.parametrize(
        "malicious_query",
        [
            "'; DROP TABLE lab_test_components; --",
            "<script>alert(1)</script>",
            "test\x00name",
        ],
    )
    def test_trends_rejects_injection_style_characters(
        self, client, user_with_patient, authenticated_headers, malicious_query
    ):
        """Search-input validation still blocks control/quote/angle-bracket characters."""
        patient_id = user_with_patient["patient"].id

        response = client.get(
            f"/api/v1/lab-test-components/patient/{patient_id}/trends",
            params={"test_name": malicious_query},
            headers=authenticated_headers,
        )

        assert response.status_code == 400
