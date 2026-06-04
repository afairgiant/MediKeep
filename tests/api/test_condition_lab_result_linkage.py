"""
API endpoint tests for the GET /conditions/{condition_id}/lab-results endpoint.

Covers:
- GET /api/v1/conditions/{condition_id}/lab-results
  - Empty list when no lab results linked
  - Returns linked lab results with details
  - Results sorted by completed_date descending (most recent first)
  - Null completed_date entries sorted last
  - Returns 404 for non-existent condition
  - Returns 401 without authentication
  - Returns 403 when another user tries to access
"""

import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.condition import condition as condition_crud
from app.crud.lab_result import lab_result as lab_result_crud, lab_result_condition
from app.crud.patient import patient as patient_crud
from app.schemas.condition import ConditionCreate
from app.schemas.lab_result import LabResultConditionCreate, LabResultCreate
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers


class TestConditionLabResultsAPI:
    """Tests for GET /conditions/{condition_id}/lab-results."""

    @pytest.fixture
    def user_with_patient(self, db_session: Session):
        """Create a user with a patient record."""
        user_data = create_random_user(db_session)
        patient = patient_crud.create_for_user(
            db_session,
            user_id=user_data["user"].id,
            patient_data=PatientCreate(
                first_name="Alice",
                last_name="Smith",
                birth_date=date(1985, 6, 15),
                gender="F",
            ),
        )
        user_data["user"].active_patient_id = patient.id
        db_session.commit()
        db_session.refresh(user_data["user"])
        return {**user_data, "patient": patient}

    @pytest.fixture
    def auth_headers(self, user_with_patient):
        return create_user_token_headers(user_with_patient["user"].username)

    @pytest.fixture
    def condition_and_lab_results(self, db_session: Session, user_with_patient):
        """Create a condition and two lab results linked to it."""
        patient_id = user_with_patient["patient"].id

        cond = condition_crud.create(
            db_session,
            obj_in=ConditionCreate(
                patient_id=patient_id,
                diagnosis="Diabetes Type 2",
                status="active",
                severity="moderate",
            ),
        )

        older_lab = lab_result_crud.create(
            db_session,
            obj_in=LabResultCreate(
                patient_id=patient_id,
                test_name="HbA1c",
                status="completed",
                labs_result="abnormal",
                completed_date=date(2024, 1, 10),
            ),
        )
        newer_lab = lab_result_crud.create(
            db_session,
            obj_in=LabResultCreate(
                patient_id=patient_id,
                test_name="Fasting Glucose",
                status="completed",
                labs_result="abnormal",
                completed_date=date(2024, 6, 1),
            ),
        )

        lab_result_condition.create(
            db_session,
            obj_in=LabResultConditionCreate(
                lab_result_id=older_lab.id,
                condition_id=cond.id,
                relevance_note="Baseline reading",
            ),
        )
        lab_result_condition.create(
            db_session,
            obj_in=LabResultConditionCreate(
                lab_result_id=newer_lab.id,
                condition_id=cond.id,
                relevance_note="Follow-up reading",
            ),
        )
        db_session.commit()

        return {
            "condition": cond,
            "older_lab": older_lab,
            "newer_lab": newer_lab,
        }

    # --- Empty state ---

    def test_returns_empty_list_when_no_lab_results_linked(
        self, client: TestClient, db_session: Session, user_with_patient, auth_headers
    ):
        """Returns an empty list when the condition has no linked lab results."""
        patient_id = user_with_patient["patient"].id
        cond = condition_crud.create(
            db_session,
            obj_in=ConditionCreate(
                patient_id=patient_id,
                diagnosis="Hypertension",
                status="active",
            ),
        )
        db_session.commit()

        response = client.get(
            f"/api/v1/conditions/{cond.id}/lab-results",
            headers=auth_headers,
        )

        assert response.status_code == 200, response.text
        assert response.json() == []

    # --- Returns linked lab results with details ---

    def test_returns_linked_lab_results(
        self, client: TestClient, condition_and_lab_results, auth_headers
    ):
        """Returns lab results linked to the condition with their details."""
        cond = condition_and_lab_results["condition"]

        response = client.get(
            f"/api/v1/conditions/{cond.id}/lab-results",
            headers=auth_headers,
        )

        assert response.status_code == 200, response.text
        data = response.json()
        assert len(data) == 2

        test_names = {r["lab_result"]["test_name"] for r in data}
        assert test_names == {"HbA1c", "Fasting Glucose"}

    def test_response_includes_lab_result_details(
        self, client: TestClient, condition_and_lab_results, auth_headers
    ):
        """Each entry includes the expected lab result fields."""
        cond = condition_and_lab_results["condition"]
        newer_lab = condition_and_lab_results["newer_lab"]

        response = client.get(
            f"/api/v1/conditions/{cond.id}/lab-results",
            headers=auth_headers,
        )

        assert response.status_code == 200, response.text
        data = response.json()
        # Most recent first — first item should be the newer lab
        first = data[0]
        assert first["lab_result"]["id"] == newer_lab.id
        assert first["lab_result"]["test_name"] == "Fasting Glucose"
        assert first["lab_result"]["labs_result"] == "abnormal"
        assert first["lab_result"]["status"] == "completed"
        assert first["lab_result"]["completed_date"] == "2024-06-01"
        assert first["relevance_note"] == "Follow-up reading"
        assert first["condition_id"] == cond.id

    # --- Sort order ---

    def test_results_sorted_most_recent_first(
        self, client: TestClient, condition_and_lab_results, auth_headers
    ):
        """Lab results are returned with the most recent completed_date first."""
        cond = condition_and_lab_results["condition"]
        older_lab = condition_and_lab_results["older_lab"]
        newer_lab = condition_and_lab_results["newer_lab"]

        response = client.get(
            f"/api/v1/conditions/{cond.id}/lab-results",
            headers=auth_headers,
        )

        assert response.status_code == 200, response.text
        data = response.json()
        assert len(data) == 2
        assert data[0]["lab_result"]["id"] == newer_lab.id
        assert data[1]["lab_result"]["id"] == older_lab.id

    def test_null_completed_date_sorted_last(
        self, client: TestClient, db_session: Session, user_with_patient, auth_headers
    ):
        """Lab results with no completed_date appear after dated results."""
        patient_id = user_with_patient["patient"].id

        cond = condition_crud.create(
            db_session,
            obj_in=ConditionCreate(
                patient_id=patient_id,
                diagnosis="Chronic Kidney Disease",
                status="active",
            ),
        )
        dated_lab = lab_result_crud.create(
            db_session,
            obj_in=LabResultCreate(
                patient_id=patient_id,
                test_name="eGFR",
                status="completed",
                completed_date=date(2024, 3, 1),
            ),
        )
        undated_lab = lab_result_crud.create(
            db_session,
            obj_in=LabResultCreate(
                patient_id=patient_id,
                test_name="Creatinine (pending)",
                status="ordered",
            ),
        )
        lab_result_condition.create(
            db_session,
            obj_in=LabResultConditionCreate(
                lab_result_id=dated_lab.id, condition_id=cond.id
            ),
        )
        lab_result_condition.create(
            db_session,
            obj_in=LabResultConditionCreate(
                lab_result_id=undated_lab.id, condition_id=cond.id
            ),
        )
        db_session.commit()

        response = client.get(
            f"/api/v1/conditions/{cond.id}/lab-results",
            headers=auth_headers,
        )

        assert response.status_code == 200, response.text
        data = response.json()
        assert len(data) == 2
        assert data[0]["lab_result"]["id"] == dated_lab.id
        assert data[1]["lab_result"]["id"] == undated_lab.id

    # --- Error cases ---

    def test_returns_404_for_nonexistent_condition(
        self, client: TestClient, auth_headers
    ):
        """Returns 404 when the condition does not exist."""
        response = client.get(
            "/api/v1/conditions/99999/lab-results",
            headers=auth_headers,
        )

        assert response.status_code == 404, response.text

    def test_returns_401_without_authentication(
        self, client: TestClient, condition_and_lab_results
    ):
        """Returns 401 when the request is not authenticated."""
        cond = condition_and_lab_results["condition"]

        response = client.get(f"/api/v1/conditions/{cond.id}/lab-results")

        assert response.status_code == 401, response.text

    def test_other_user_cannot_access_condition_lab_results(
        self,
        client: TestClient,
        db_session: Session,
        condition_and_lab_results,
    ):
        """A different user cannot read another user's condition lab results."""
        cond = condition_and_lab_results["condition"]

        other_user_data = create_random_user(db_session)
        patient2 = patient_crud.create_for_user(
            db_session,
            user_id=other_user_data["user"].id,
            patient_data=PatientCreate(
                first_name="Bob",
                last_name="Jones",
                birth_date=date(1990, 1, 1),
                gender="M",
            ),
        )
        other_user_data["user"].active_patient_id = patient2.id
        db_session.commit()
        db_session.refresh(other_user_data["user"])
        other_headers = create_user_token_headers(other_user_data["user"].username)

        response = client.get(
            f"/api/v1/conditions/{cond.id}/lab-results",
            headers=other_headers,
        )

        assert response.status_code == 403, response.text
