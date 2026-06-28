"""
Tests for the GET /patient/{patient_id}/component-defaults endpoint.
"""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers


class TestComponentDefaultsEndpoint:
    """Tests for the component defaults lookup endpoint."""

    @pytest.fixture
    def user_with_patient(self, db_session: Session):
        user_data = create_random_user(db_session)
        patient_data = PatientCreate(
            first_name="Jane",
            last_name="Test",
            birth_date=date(1985, 3, 15),
            gender="F",
            address="456 Oak Ave",
        )
        patient = patient_crud.create_for_user(
            db_session, user_id=user_data["user"].id, patient_data=patient_data
        )
        user_data["user"].active_patient_id = patient.id
        db_session.commit()
        db_session.refresh(user_data["user"])
        return {**user_data, "patient": patient}

    @pytest.fixture
    def auth_headers(self, user_with_patient):
        return create_user_token_headers(user_with_patient["user"].username)

    def _create_lab_result(self, client, patient_id, headers, completed_date="2024-06-01"):
        resp = client.post(
            "/api/v1/lab-results/",
            json={
                "patient_id": patient_id,
                "test_name": "Annual Panel",
                "status": "completed",
                "completed_date": completed_date,
            },
            headers=headers,
        )
        assert resp.status_code == 201
        return resp.json()["id"]

    def _create_component(self, client, lab_result_id, patient_id, headers, **kwargs):
        data = {
            "lab_result_id": lab_result_id,
            "test_name": "Hemoglobin",
            "result_type": "quantitative",
            "value": 14.2,
            "unit": "g/dL",
            "ref_range_min": 12.0,
            "ref_range_max": 16.0,
            "status": "normal",
            **kwargs,
        }
        resp = client.post(
            f"/api/v1/lab-test-components/lab-result/{lab_result_id}/components",
            json=data,
            headers=headers,
        )
        assert resp.status_code == 201
        return resp.json()

    def test_returns_404_when_no_prior_entries(
        self, client: TestClient, user_with_patient, auth_headers
    ):
        patient_id = user_with_patient["patient"].id
        resp = client.get(
            f"/api/v1/lab-test-components/patient/{patient_id}/component-defaults",
            params={"test_name": "Nonexistent Test"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_returns_400_when_no_params(
        self, client: TestClient, user_with_patient, auth_headers
    ):
        patient_id = user_with_patient["patient"].id
        resp = client.get(
            f"/api/v1/lab-test-components/patient/{patient_id}/component-defaults",
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_returns_defaults_by_test_name(
        self, client: TestClient, user_with_patient, auth_headers
    ):
        patient_id = user_with_patient["patient"].id
        lab_result_id = self._create_lab_result(client, patient_id, auth_headers)
        self._create_component(client, lab_result_id, patient_id, auth_headers)

        resp = client.get(
            f"/api/v1/lab-test-components/patient/{patient_id}/component-defaults",
            params={"test_name": "Hemoglobin"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["unit"] == "g/dL"
        assert data["ref_range_min"] == 12.0
        assert data["ref_range_max"] == 16.0

    def test_returns_defaults_by_test_code(
        self, client: TestClient, user_with_patient, auth_headers
    ):
        patient_id = user_with_patient["patient"].id
        lab_result_id = self._create_lab_result(client, patient_id, auth_headers)
        self._create_component(
            client,
            lab_result_id,
            patient_id,
            auth_headers,
            test_name="WBC",
            test_code="WBC001",
            value=7.5,
            unit="K/uL",
            ref_range_min=4.0,
            ref_range_max=11.0,
        )

        resp = client.get(
            f"/api/v1/lab-test-components/patient/{patient_id}/component-defaults",
            params={"test_code": "WBC001"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["unit"] == "K/uL"

    def test_falls_back_to_test_code_when_name_not_found(
        self, client: TestClient, user_with_patient, auth_headers
    ):
        """When test_name has no match but test_code does, returns code-based match."""
        patient_id = user_with_patient["patient"].id
        lab_result_id = self._create_lab_result(client, patient_id, auth_headers)
        self._create_component(
            client,
            lab_result_id,
            patient_id,
            auth_headers,
            test_name="Platelet Count",
            test_code="PLT",
            value=250,
            unit="K/uL",
        )

        resp = client.get(
            f"/api/v1/lab-test-components/patient/{patient_id}/component-defaults",
            params={"test_name": "NotAMatch", "test_code": "PLT"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["unit"] == "K/uL"

    def test_returns_most_recent_entry(
        self, client: TestClient, user_with_patient, auth_headers
    ):
        """When multiple entries exist, the most recent one's values are returned."""
        patient_id = user_with_patient["patient"].id

        old_id = self._create_lab_result(client, patient_id, auth_headers, completed_date="2023-01-01")
        self._create_component(
            client, old_id, patient_id, auth_headers,
            unit="g/dL", ref_range_min=11.0, ref_range_max=15.0
        )

        new_id = self._create_lab_result(client, patient_id, auth_headers, completed_date="2024-06-01")
        self._create_component(
            client, new_id, patient_id, auth_headers,
            unit="g/dL", ref_range_min=12.5, ref_range_max=17.5
        )

        resp = client.get(
            f"/api/v1/lab-test-components/patient/{patient_id}/component-defaults",
            params={"test_name": "Hemoglobin"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["ref_range_min"] == 12.5
        assert data["ref_range_max"] == 17.5
