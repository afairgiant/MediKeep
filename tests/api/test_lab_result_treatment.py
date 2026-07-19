"""
API endpoint tests for lab result <-> treatment relationship endpoints.

Covers:
- GET    /api/v1/lab-results/{lab_result_id}/treatments
- POST   /api/v1/lab-results/{lab_result_id}/treatments
- PUT    /api/v1/lab-results/{lab_result_id}/treatments/{relationship_id}
- DELETE /api/v1/lab-results/{lab_result_id}/treatments/{relationship_id}
"""

import pytest
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers


class TestLabResultTreatmentAPI:
    """Tests for lab-result-side treatment relationship endpoints."""

    @pytest.fixture
    def test_lab_result(self, client, user_with_patient, authenticated_headers):
        """Create a test lab result."""
        response = client.post(
            "/api/v1/lab-results/",
            json={
                "test_name": "HbA1c",
                "test_code": "HBA1C",
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
                "test_name": "Fasting Glucose",
                "test_code": "GLU",
                "test_category": "chemistry",
                "ordered_date": str(date.today() - timedelta(days=1)),
                "status": "completed",
                "patient_id": user_with_patient["patient"].id,
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 201
        return response.json()

    @pytest.fixture
    def test_treatment(self, client, user_with_patient, authenticated_headers):
        """Create a test treatment."""
        response = client.post(
            "/api/v1/treatments/",
            json={
                "treatment_name": "Metformin Therapy",
                "treatment_type": "Medication",
                "start_date": str(date.today() - timedelta(days=30)),
                "status": "active",
                "patient_id": user_with_patient["patient"].id,
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        return response.json()

    # ---- Create ----

    def test_create_lab_result_treatment(
        self, client, authenticated_headers, test_lab_result, test_treatment
    ):
        """Test creating a lab result treatment relationship."""
        response = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            json={
                "treatment_id": test_treatment["id"],
                "purpose": "monitoring",
                "expected_frequency": "Every 3 months",
                "relevance_note": "Monitors glycemic control on metformin",
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["lab_result_id"] == test_lab_result["id"]
        assert data["treatment_id"] == test_treatment["id"]
        assert data["purpose"] == "monitoring"
        assert data["expected_frequency"] == "Every 3 months"
        assert data["relevance_note"] == "Monitors glycemic control on metformin"
        assert "id" in data
        assert "created_at" in data

    def test_create_lab_result_treatment_without_optional_fields(
        self, client, authenticated_headers, test_lab_result, test_treatment
    ):
        """Test creating a relationship without purpose/frequency/note."""
        response = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            json={"treatment_id": test_treatment["id"]},
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["purpose"] is None
        assert data["expected_frequency"] is None
        assert data["relevance_note"] is None

    # ---- Get ----

    def test_get_lab_result_treatments(
        self, client, authenticated_headers, test_lab_result, test_treatment
    ):
        """Test retrieving treatment relationships for a lab result."""
        client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            json={"treatment_id": test_treatment["id"], "purpose": "baseline"},
            headers=authenticated_headers,
        )

        response = client.get(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["treatment_id"] == test_treatment["id"]
        assert data[0]["purpose"] == "baseline"
        assert data[0]["treatment"]["id"] == test_treatment["id"]
        assert data[0]["treatment"]["treatment_name"] == "Metformin Therapy"
        assert data[0]["treatment"]["treatment_type"] == "Medication"
        assert data[0]["treatment"]["status"] == "active"

    def test_get_lab_result_treatments_empty(
        self, client, authenticated_headers, test_lab_result
    ):
        """Test getting treatments when none are linked."""
        response = client.get(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        assert response.json() == []

    # ---- Update ----

    def test_update_lab_result_treatment(
        self, client, authenticated_headers, test_lab_result, test_treatment
    ):
        """Test updating a relationship's purpose and note."""
        link_resp = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            json={"treatment_id": test_treatment["id"], "purpose": "baseline"},
            headers=authenticated_headers,
        )
        rel_id = link_resp.json()["id"]

        response = client.put(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments/{rel_id}",
            json={
                "purpose": "outcome",
                "expected_frequency": "Annually",
                "relevance_note": "Updated note",
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["purpose"] == "outcome"
        assert data["expected_frequency"] == "Annually"
        assert data["relevance_note"] == "Updated note"

    def test_update_wrong_lab_result(
        self,
        client,
        authenticated_headers,
        test_lab_result,
        second_lab_result,
        test_treatment,
    ):
        """Test updating a relationship via the wrong lab result fails."""
        link_resp = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            json={"treatment_id": test_treatment["id"]},
            headers=authenticated_headers,
        )
        rel_id = link_resp.json()["id"]

        response = client.put(
            f"/api/v1/lab-results/{second_lab_result['id']}/treatments/{rel_id}",
            json={"purpose": "safety"},
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    # ---- Delete ----

    def test_delete_lab_result_treatment(
        self, client, authenticated_headers, test_lab_result, test_treatment
    ):
        """Test deleting a lab result treatment relationship."""
        link_resp = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            json={"treatment_id": test_treatment["id"]},
            headers=authenticated_headers,
        )
        rel_id = link_resp.json()["id"]

        response = client.delete(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments/{rel_id}",
            headers=authenticated_headers,
        )
        assert response.status_code == 200

        get_resp = client.get(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            headers=authenticated_headers,
        )
        assert get_resp.json() == []

    def test_delete_wrong_lab_result(
        self,
        client,
        authenticated_headers,
        test_lab_result,
        second_lab_result,
        test_treatment,
    ):
        """Test deleting a relationship via the wrong lab result fails."""
        link_resp = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            json={"treatment_id": test_treatment["id"]},
            headers=authenticated_headers,
        )
        rel_id = link_resp.json()["id"]

        response = client.delete(
            f"/api/v1/lab-results/{second_lab_result['id']}/treatments/{rel_id}",
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    def test_delete_nonexistent_relationship(
        self, client, authenticated_headers, test_lab_result
    ):
        """Test deleting a nonexistent relationship returns 404."""
        response = client.delete(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments/99999",
            headers=authenticated_headers,
        )
        assert response.status_code == 404

    # ---- Validation / rejection cases ----

    def test_duplicate_link_rejected(
        self, client, authenticated_headers, test_lab_result, test_treatment
    ):
        """Test that duplicate links are rejected."""
        client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            json={"treatment_id": test_treatment["id"]},
            headers=authenticated_headers,
        )

        response = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            json={"treatment_id": test_treatment["id"]},
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    def test_link_nonexistent_lab_result(
        self, client, authenticated_headers, test_treatment
    ):
        """Test linking to a nonexistent lab result returns 404."""
        response = client.post(
            "/api/v1/lab-results/99999/treatments",
            json={"treatment_id": test_treatment["id"]},
            headers=authenticated_headers,
        )
        assert response.status_code == 404

    def test_link_nonexistent_treatment(
        self, client, authenticated_headers, test_lab_result
    ):
        """Test linking a nonexistent treatment returns 404."""
        response = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            json={"treatment_id": 99999},
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
        """Test that linking a treatment from a different patient is rejected."""
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
        treat_resp = client.post(
            "/api/v1/treatments/",
            json={
                "treatment_name": "Other Patient Treatment",
                "start_date": str(date.today()),
                "status": "active",
                "patient_id": other_patient.id,
            },
            headers=other_headers,
        )
        assert treat_resp.status_code == 200
        other_treatment_id = treat_resp.json()["id"]

        response = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            json={"treatment_id": other_treatment_id},
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    # ---- Purpose validation ----

    def test_valid_purposes_accepted(
        self, client, authenticated_headers, test_lab_result, test_treatment
    ):
        """Test that all valid purpose values are accepted."""
        valid_purposes = ["baseline", "monitoring", "outcome", "safety", "other"]
        for purpose in valid_purposes:
            # Clean up any existing link first
            get_resp = client.get(
                f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
                headers=authenticated_headers,
            )
            for rel in get_resp.json():
                client.delete(
                    f"/api/v1/lab-results/{test_lab_result['id']}/treatments/{rel['id']}",
                    headers=authenticated_headers,
                )

            response = client.post(
                f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
                json={"treatment_id": test_treatment["id"], "purpose": purpose},
                headers=authenticated_headers,
            )
            assert response.status_code == 200, f"Purpose '{purpose}' was rejected"
            assert response.json()["purpose"] == purpose

    def test_purpose_case_insensitive_and_lowercased(
        self, client, authenticated_headers, test_lab_result, test_treatment
    ):
        """Test that purpose values are accepted case-insensitively and lowercased."""
        response = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            json={"treatment_id": test_treatment["id"], "purpose": "MONITORING"},
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text
        assert response.json()["purpose"] == "monitoring"

    def test_invalid_purpose_rejected(
        self, client, authenticated_headers, test_lab_result, test_treatment
    ):
        """Test that an invalid purpose value is rejected by validation."""
        response = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            json={
                "treatment_id": test_treatment["id"],
                "purpose": "invalid_purpose",
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 422

    # ---- Auth ----

    def test_create_requires_auth(self, client, test_lab_result, test_treatment):
        """Test that creating a relationship without auth returns 401."""
        response = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            json={"treatment_id": test_treatment["id"]},
        )
        assert response.status_code == 401

    def test_get_requires_auth(self, client, test_lab_result):
        """Test that getting relationships without auth returns 401."""
        response = client.get(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
        )
        assert response.status_code == 401

    def test_other_user_cannot_access(
        self,
        client,
        db_session: Session,
        test_lab_result,
        test_treatment,
    ):
        """Test that a different user cannot access another user's relationships."""
        client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            json={"treatment_id": test_treatment["id"]},
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
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            headers=other_headers,
        )
        assert response.status_code in (403, 404)

    # ---- Cascade delete ----

    def test_cascade_delete_lab_result(
        self, client, db_session, authenticated_headers, test_lab_result, test_treatment
    ):
        """Test that deleting the lab result removes the treatment relationship."""
        client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            json={"treatment_id": test_treatment["id"]},
            headers=authenticated_headers,
        )

        delete_resp = client.delete(
            f"/api/v1/lab-results/{test_lab_result['id']}",
            headers=authenticated_headers,
        )
        assert delete_resp.status_code == 200

        # Treatment should still exist
        treat_resp = client.get(
            f"/api/v1/treatments/{test_treatment['id']}",
            headers=authenticated_headers,
        )
        assert treat_resp.status_code == 200

        from app.crud.treatment import treatment_lab_result

        remaining = treatment_lab_result.get_by_lab_result(
            db_session, lab_result_id=test_lab_result["id"]
        )
        assert remaining == []

    def test_cascade_delete_treatment(
        self, client, db_session, authenticated_headers, test_lab_result, test_treatment
    ):
        """Test that deleting the treatment removes the lab result relationship."""
        client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            json={"treatment_id": test_treatment["id"]},
            headers=authenticated_headers,
        )

        delete_resp = client.delete(
            f"/api/v1/treatments/{test_treatment['id']}",
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
            f"/api/v1/lab-results/{test_lab_result['id']}/treatments",
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        assert response.json() == []
