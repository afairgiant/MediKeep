"""
API endpoint tests for lab result <-> procedure relationship endpoints.

Covers:
- GET    /api/v1/lab-results/{lab_result_id}/procedures
- POST   /api/v1/lab-results/{lab_result_id}/procedures
- PUT    /api/v1/lab-results/{lab_result_id}/procedures/{relationship_id}
- DELETE /api/v1/lab-results/{lab_result_id}/procedures/{relationship_id}
"""

import pytest
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers


class TestLabResultProcedureAPI:
    """Tests for lab-result-side procedure relationship endpoints."""

    @pytest.fixture
    def test_lab_result(self, client, user_with_patient, authenticated_headers):
        """Create a test lab result."""
        response = client.post(
            "/api/v1/lab-results/",
            json={
                "test_name": "Pre-op Labs",
                "test_code": "PREOP",
                "test_category": "chemistry",
                "ordered_date": str(date.today() - timedelta(days=7)),
                "status": "completed",
                "patient_id": user_with_patient["patient"].id,
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 201
        return response.json()

    @pytest.fixture
    def second_lab_result(self, client, user_with_patient, authenticated_headers):
        """Create a second lab result belonging to the same patient."""
        response = client.post(
            "/api/v1/lab-results/",
            json={
                "test_name": "Post-op CBC",
                "test_code": "CBC",
                "test_category": "hematology",
                "ordered_date": str(date.today() - timedelta(days=1)),
                "status": "completed",
                "patient_id": user_with_patient["patient"].id,
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 201
        return response.json()

    @pytest.fixture
    def test_procedure(self, client, user_with_patient, authenticated_headers):
        """Create a test procedure."""
        response = client.post(
            "/api/v1/procedures/",
            json={
                "procedure_name": "Appendectomy",
                "date": str(date.today() - timedelta(days=3)),
                "status": "completed",
                "patient_id": user_with_patient["patient"].id,
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        return response.json()

    # ---- Create ----

    def test_create_lab_result_procedure(
        self, client, authenticated_headers, test_lab_result, test_procedure
    ):
        """Test creating a lab result procedure relationship."""
        response = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            json={
                "procedure_id": test_procedure["id"],
                "relevance_note": "Pre-operative labs for this procedure",
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["lab_result_id"] == test_lab_result["id"]
        assert data["procedure_id"] == test_procedure["id"]
        assert data["relevance_note"] == "Pre-operative labs for this procedure"
        assert "id" in data
        assert "created_at" in data

    def test_create_lab_result_procedure_without_note(
        self, client, authenticated_headers, test_lab_result, test_procedure
    ):
        """Test creating a relationship without a relevance note."""
        response = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            json={"procedure_id": test_procedure["id"]},
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        assert response.json()["relevance_note"] is None

    # ---- Get ----

    def test_get_lab_result_procedures(
        self, client, authenticated_headers, test_lab_result, test_procedure
    ):
        """Test retrieving procedure relationships for a lab result."""
        client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            json={"procedure_id": test_procedure["id"]},
            headers=authenticated_headers,
        )

        response = client.get(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["procedure_id"] == test_procedure["id"]
        assert data[0]["procedure"]["id"] == test_procedure["id"]
        assert data[0]["procedure"]["procedure_name"] == "Appendectomy"
        assert data[0]["procedure"]["status"] == "completed"

    def test_get_lab_result_procedures_empty(
        self, client, authenticated_headers, test_lab_result
    ):
        """Test getting procedures when none are linked."""
        response = client.get(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        assert response.json() == []

    # ---- Update ----

    def test_update_lab_result_procedure(
        self, client, authenticated_headers, test_lab_result, test_procedure
    ):
        """Test updating a relationship's relevance note."""
        link_resp = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            json={"procedure_id": test_procedure["id"], "relevance_note": "Original"},
            headers=authenticated_headers,
        )
        rel_id = link_resp.json()["id"]

        response = client.put(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures/{rel_id}",
            json={"relevance_note": "Updated note"},
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["relevance_note"] == "Updated note"
        assert data["id"] == rel_id

    def test_update_wrong_lab_result(
        self,
        client,
        authenticated_headers,
        test_lab_result,
        second_lab_result,
        test_procedure,
    ):
        """Test updating a relationship via the wrong lab result fails."""
        link_resp = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            json={"procedure_id": test_procedure["id"]},
            headers=authenticated_headers,
        )
        rel_id = link_resp.json()["id"]

        response = client.put(
            f"/api/v1/lab-results/{second_lab_result['id']}/procedures/{rel_id}",
            json={"relevance_note": "Should fail"},
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    # ---- Delete ----

    def test_delete_lab_result_procedure(
        self, client, authenticated_headers, test_lab_result, test_procedure
    ):
        """Test deleting a lab result procedure relationship."""
        link_resp = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            json={"procedure_id": test_procedure["id"]},
            headers=authenticated_headers,
        )
        rel_id = link_resp.json()["id"]

        response = client.delete(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures/{rel_id}",
            headers=authenticated_headers,
        )
        assert response.status_code == 200

        get_resp = client.get(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            headers=authenticated_headers,
        )
        assert get_resp.json() == []

    def test_delete_wrong_lab_result(
        self,
        client,
        authenticated_headers,
        test_lab_result,
        second_lab_result,
        test_procedure,
    ):
        """Test deleting a relationship via the wrong lab result fails."""
        link_resp = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            json={"procedure_id": test_procedure["id"]},
            headers=authenticated_headers,
        )
        rel_id = link_resp.json()["id"]

        response = client.delete(
            f"/api/v1/lab-results/{second_lab_result['id']}/procedures/{rel_id}",
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    def test_delete_nonexistent_relationship(
        self, client, authenticated_headers, test_lab_result
    ):
        """Test deleting a nonexistent relationship returns 404."""
        response = client.delete(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures/99999",
            headers=authenticated_headers,
        )
        assert response.status_code == 404

    # ---- Validation / rejection cases ----

    def test_duplicate_link_rejected(
        self, client, authenticated_headers, test_lab_result, test_procedure
    ):
        """Test that duplicate links are rejected."""
        client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            json={"procedure_id": test_procedure["id"]},
            headers=authenticated_headers,
        )

        response = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            json={"procedure_id": test_procedure["id"]},
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    def test_link_nonexistent_lab_result(
        self, client, authenticated_headers, test_procedure
    ):
        """Test linking to a nonexistent lab result returns 404."""
        response = client.post(
            "/api/v1/lab-results/99999/procedures",
            json={"procedure_id": test_procedure["id"]},
            headers=authenticated_headers,
        )
        assert response.status_code == 404

    def test_link_nonexistent_procedure(
        self, client, authenticated_headers, test_lab_result
    ):
        """Test linking a nonexistent procedure returns 404."""
        response = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            json={"procedure_id": 99999},
            headers=authenticated_headers,
        )
        assert response.status_code == 404

    def test_cross_patient_link_rejected(
        self,
        client,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
        test_lab_result,
    ):
        """Test that linking a procedure from a different patient is rejected."""
        other_user_data = create_random_user(db_session)
        other_patient = patient_crud.create_for_user(
            db_session,
            user_id=other_user_data["user"].id,
            patient_data=PatientCreate(
                first_name="Other",
                last_name="Patient",
                birth_date=date(1985, 5, 15),
                gender="F",
                address="456 Other St",
            ),
        )
        other_user_data["user"].active_patient_id = other_patient.id
        db_session.commit()

        other_headers = create_user_token_headers(other_user_data["user"].username)
        proc_resp = client.post(
            "/api/v1/procedures/",
            json={
                "procedure_name": "Other Patient Procedure",
                "date": str(date.today()),
                "status": "completed",
                "patient_id": other_patient.id,
            },
            headers=other_headers,
        )
        assert proc_resp.status_code == 200
        other_procedure_id = proc_resp.json()["id"]

        response = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            json={"procedure_id": other_procedure_id},
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    # ---- Auth ----

    def test_create_requires_auth(self, client, test_lab_result, test_procedure):
        """Test that creating a relationship without auth returns 401."""
        response = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            json={"procedure_id": test_procedure["id"]},
        )
        assert response.status_code == 401

    def test_get_requires_auth(self, client, test_lab_result):
        """Test that getting relationships without auth returns 401."""
        response = client.get(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
        )
        assert response.status_code == 401

    def test_other_user_cannot_access(
        self,
        client,
        db_session: Session,
        test_lab_result,
        test_procedure,
    ):
        """Test that a different user cannot access another user's relationships."""
        client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            json={"procedure_id": test_procedure["id"]},
        )

        other_user_data = create_random_user(db_session)
        other_patient = patient_crud.create_for_user(
            db_session,
            user_id=other_user_data["user"].id,
            patient_data=PatientCreate(
                first_name="Other",
                last_name="User",
                birth_date=date(1992, 3, 20),
                gender="M",
                address="789 Other Ave",
            ),
        )
        other_user_data["user"].active_patient_id = other_patient.id
        db_session.commit()

        other_headers = create_user_token_headers(other_user_data["user"].username)

        response = client.get(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            headers=other_headers,
        )
        assert response.status_code in (403, 404)

    # ---- Cascade delete ----

    def test_cascade_delete_lab_result(
        self, client, db_session, authenticated_headers, test_lab_result, test_procedure
    ):
        """Test that deleting the lab result removes the procedure relationship."""
        client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            json={"procedure_id": test_procedure["id"]},
            headers=authenticated_headers,
        )

        delete_resp = client.delete(
            f"/api/v1/lab-results/{test_lab_result['id']}",
            headers=authenticated_headers,
        )
        assert delete_resp.status_code == 200

        # Procedure should still exist
        proc_resp = client.get(
            f"/api/v1/procedures/{test_procedure['id']}",
            headers=authenticated_headers,
        )
        assert proc_resp.status_code == 200

        from app.crud.lab_result import lab_result_procedure

        remaining = lab_result_procedure.get_by_lab_result(
            db_session, lab_result_id=test_lab_result["id"]
        )
        assert remaining == []

    def test_cascade_delete_procedure(
        self, client, db_session, authenticated_headers, test_lab_result, test_procedure
    ):
        """Test that deleting the procedure removes the lab result relationship."""
        client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            json={"procedure_id": test_procedure["id"]},
            headers=authenticated_headers,
        )

        delete_resp = client.delete(
            f"/api/v1/procedures/{test_procedure['id']}",
            headers=authenticated_headers,
        )
        assert delete_resp.status_code == 200

        # Lab result should still exist
        lr_resp = client.get(
            f"/api/v1/lab-results/{test_lab_result['id']}",
            headers=authenticated_headers,
        )
        assert lr_resp.status_code == 200

        response = client.get(
            f"/api/v1/lab-results/{test_lab_result['id']}/procedures",
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        assert response.json() == []
