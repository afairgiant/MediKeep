"""
API endpoint tests for Medication<->Condition linkage added in commit 3e0dcd3.

Covers:
- POST /api/v1/conditions/{condition_id}/medications
- DELETE /api/v1/conditions/{condition_id}/medications/{relationship_id}
- PUT /api/v1/conditions/{condition_id}/medications/{relationship_id}
- POST /api/v1/conditions/{condition_id}/medications/bulk
- GET /api/v1/conditions/medication/{medication_id}/conditions
"""
import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.condition import condition as condition_crud, condition_medication
from app.crud.medication import medication as medication_crud
from app.crud.patient import patient as patient_crud
from app.schemas.condition import ConditionCreate, ConditionMedicationCreate
from app.schemas.medication import MedicationCreate
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers


class TestConditionMedicationLinkageAPI:
    """Tests for the Medication<->Condition linkage API endpoints."""

    @pytest.fixture
    def user_with_patient(self, db_session: Session):
        """Create a user with a patient record."""
        user_data = create_random_user(db_session)
        patient_data = PatientCreate(
            first_name="Alice",
            last_name="Brown",
            birth_date=date(1978, 3, 22),
            gender="F",
            address="789 Oak Ave",
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

    @pytest.fixture
    def condition_and_medication(self, client: TestClient, user_with_patient, auth_headers):
        """Create a condition and medication belonging to the same patient."""
        patient_id = user_with_patient["patient"].id

        cond_resp = client.post(
            "/api/v1/conditions/",
            json={
                "patient_id": patient_id,
                "diagnosis": "Hypertension",
                "status": "active",
                "severity": "moderate",
            },
            headers=auth_headers,
        )
        assert cond_resp.status_code == 200, cond_resp.text

        med_resp = client.post(
            "/api/v1/medications/",
            json={
                "patient_id": patient_id,
                "medication_name": "Lisinopril",
                "dosage": "10mg",
                "frequency": "once daily",
                "status": "active",
            },
            headers=auth_headers,
        )
        assert med_resp.status_code == 200, med_resp.text

        return {"condition": cond_resp.json(), "medication": med_resp.json()}

    # --- POST /{condition_id}/medications ---

    def test_create_link_success(self, client: TestClient, condition_and_medication, auth_headers):
        """Creating a condition-medication link succeeds with valid IDs."""
        condition_id = condition_and_medication["condition"]["id"]
        medication_id = condition_and_medication["medication"]["id"]

        response = client.post(
            f"/api/v1/conditions/{condition_id}/medications",
            json={"medication_id": medication_id, "relevance_note": "First-line therapy"},
            headers=auth_headers,
        )

        assert response.status_code == 200, response.text
        data = response.json()
        assert data["condition_id"] == condition_id
        assert data["medication_id"] == medication_id
        assert data["relevance_note"] == "First-line therapy"
        assert "id" in data

    def test_create_link_without_relevance_note(self, client: TestClient, condition_and_medication, auth_headers):
        """Creating a link without a relevance note is allowed."""
        condition_id = condition_and_medication["condition"]["id"]
        medication_id = condition_and_medication["medication"]["id"]

        response = client.post(
            f"/api/v1/conditions/{condition_id}/medications",
            json={"medication_id": medication_id},
            headers=auth_headers,
        )

        assert response.status_code == 200, response.text
        data = response.json()
        assert data["relevance_note"] is None

    def test_create_link_duplicate_rejected(self, client: TestClient, condition_and_medication, auth_headers):
        """Creating a duplicate link between the same condition and medication is rejected."""
        condition_id = condition_and_medication["condition"]["id"]
        medication_id = condition_and_medication["medication"]["id"]

        client.post(
            f"/api/v1/conditions/{condition_id}/medications",
            json={"medication_id": medication_id},
            headers=auth_headers,
        )

        # Second attempt should fail with a business logic error
        response = client.post(
            f"/api/v1/conditions/{condition_id}/medications",
            json={"medication_id": medication_id},
            headers=auth_headers,
        )

        assert response.status_code == 400, response.text

    def test_create_link_nonexistent_condition(self, client: TestClient, condition_and_medication, auth_headers):
        """Linking to a non-existent condition returns 404."""
        medication_id = condition_and_medication["medication"]["id"]

        response = client.post(
            "/api/v1/conditions/99999/medications",
            json={"medication_id": medication_id},
            headers=auth_headers,
        )

        assert response.status_code == 404, response.text

    def test_create_link_nonexistent_medication(self, client: TestClient, condition_and_medication, auth_headers):
        """Linking to a non-existent medication returns 404."""
        condition_id = condition_and_medication["condition"]["id"]

        response = client.post(
            f"/api/v1/conditions/{condition_id}/medications",
            json={"medication_id": 99999},
            headers=auth_headers,
        )

        assert response.status_code == 404, response.text

    def test_create_link_unauthorized(self, client: TestClient, condition_and_medication):
        """Creating a link without authentication is rejected."""
        condition_id = condition_and_medication["condition"]["id"]
        medication_id = condition_and_medication["medication"]["id"]

        response = client.post(
            f"/api/v1/conditions/{condition_id}/medications",
            json={"medication_id": medication_id},
        )

        assert response.status_code == 401, response.text

    def test_create_link_cross_patient_rejected(self, client: TestClient, db_session: Session, condition_and_medication, auth_headers):
        """Linking a medication belonging to a different patient is rejected."""
        condition_id = condition_and_medication["condition"]["id"]

        # Create a second user with their own patient and medication
        user2_data = create_random_user(db_session)
        patient2 = patient_crud.create_for_user(
            db_session,
            user_id=user2_data["user"].id,
            patient_data=PatientCreate(
                first_name="Bob",
                last_name="Jones",
                birth_date=date(1990, 1, 1),
                gender="M",
            ),
        )
        user2_data["user"].active_patient_id = patient2.id
        db_session.commit()
        db_session.refresh(user2_data["user"])
        headers2 = create_user_token_headers(user2_data["user"].username)

        # Create a medication for user2
        med2_resp = client.post(
            "/api/v1/medications/",
            json={
                "patient_id": patient2.id,
                "medication_name": "Metoprolol",
                "dosage": "25mg",
                "status": "active",
            },
            headers=headers2,
        )
        assert med2_resp.status_code == 200
        med2_id = med2_resp.json()["id"]

        # Attempt to link user2's medication to user1's condition
        response = client.post(
            f"/api/v1/conditions/{condition_id}/medications",
            json={"medication_id": med2_id},
            headers=auth_headers,
        )

        # The API returns 400 (business logic) when linking cross-patient
        assert response.status_code in (400, 404), response.text

    # --- DELETE /{condition_id}/medications/{relationship_id} ---

    def test_delete_link_success(self, client: TestClient, condition_and_medication, auth_headers):
        """Deleting an existing condition-medication link succeeds."""
        condition_id = condition_and_medication["condition"]["id"]
        medication_id = condition_and_medication["medication"]["id"]

        create_resp = client.post(
            f"/api/v1/conditions/{condition_id}/medications",
            json={"medication_id": medication_id},
            headers=auth_headers,
        )
        assert create_resp.status_code == 200
        relationship_id = create_resp.json()["id"]

        response = client.delete(
            f"/api/v1/conditions/{condition_id}/medications/{relationship_id}",
            headers=auth_headers,
        )

        assert response.status_code == 200, response.text

        # Verify it is gone via the medication-conditions endpoint
        rels = client.get(
            f"/api/v1/conditions/medication/{medication_id}/conditions",
            headers=auth_headers,
        )
        assert rels.status_code == 200
        assert len(rels.json()) == 0

    def test_delete_link_nonexistent(self, client: TestClient, condition_and_medication, auth_headers):
        """Deleting a non-existent relationship returns 404."""
        condition_id = condition_and_medication["condition"]["id"]

        response = client.delete(
            f"/api/v1/conditions/{condition_id}/medications/99999",
            headers=auth_headers,
        )

        assert response.status_code == 404, response.text

    def test_delete_link_unauthorized(self, client: TestClient, condition_and_medication, auth_headers):
        """Deleting without authentication is rejected."""
        condition_id = condition_and_medication["condition"]["id"]
        medication_id = condition_and_medication["medication"]["id"]

        create_resp = client.post(
            f"/api/v1/conditions/{condition_id}/medications",
            json={"medication_id": medication_id},
            headers=auth_headers,
        )
        relationship_id = create_resp.json()["id"]

        response = client.delete(
            f"/api/v1/conditions/{condition_id}/medications/{relationship_id}",
        )

        assert response.status_code == 401, response.text

    def test_delete_link_wrong_condition(self, client: TestClient, user_with_patient, auth_headers):
        """Deleting a relationship using a mismatched condition_id returns an error."""
        patient_id = user_with_patient["patient"].id

        # Create two conditions and one medication
        cond1_resp = client.post(
            "/api/v1/conditions/",
            json={"patient_id": patient_id, "diagnosis": "Cond 1", "status": "active"},
            headers=auth_headers,
        )
        cond2_resp = client.post(
            "/api/v1/conditions/",
            json={"patient_id": patient_id, "diagnosis": "Cond 2", "status": "active"},
            headers=auth_headers,
        )
        med_resp = client.post(
            "/api/v1/medications/",
            json={"patient_id": patient_id, "medication_name": "Drug X", "dosage": "5mg", "status": "active"},
            headers=auth_headers,
        )

        cond1_id = cond1_resp.json()["id"]
        cond2_id = cond2_resp.json()["id"]
        med_id = med_resp.json()["id"]

        # Link medication to condition 1
        link_resp = client.post(
            f"/api/v1/conditions/{cond1_id}/medications",
            json={"medication_id": med_id},
            headers=auth_headers,
        )
        rel_id = link_resp.json()["id"]

        # Attempt to delete using condition 2's ID – should fail (mismatch)
        response = client.delete(
            f"/api/v1/conditions/{cond2_id}/medications/{rel_id}",
            headers=auth_headers,
        )

        assert response.status_code in (400, 404), response.text

    # --- PUT /{condition_id}/medications/{relationship_id} ---

    def test_update_relevance_note(self, client: TestClient, condition_and_medication, auth_headers):
        """Updating the relevance note of a relationship succeeds."""
        condition_id = condition_and_medication["condition"]["id"]
        medication_id = condition_and_medication["medication"]["id"]

        create_resp = client.post(
            f"/api/v1/conditions/{condition_id}/medications",
            json={"medication_id": medication_id, "relevance_note": "Original"},
            headers=auth_headers,
        )
        relationship_id = create_resp.json()["id"]

        response = client.put(
            f"/api/v1/conditions/{condition_id}/medications/{relationship_id}",
            json={"relevance_note": "Updated note"},
            headers=auth_headers,
        )

        assert response.status_code == 200, response.text
        data = response.json()
        assert data["relevance_note"] == "Updated note"
        assert data["id"] == relationship_id

    # --- POST /{condition_id}/medications/bulk ---

    def test_bulk_create_links(self, client: TestClient, user_with_patient, auth_headers):
        """Bulk creating condition-medication links creates all requested relationships."""
        patient_id = user_with_patient["patient"].id

        cond_resp = client.post(
            "/api/v1/conditions/",
            json={"patient_id": patient_id, "diagnosis": "Diabetes", "status": "active"},
            headers=auth_headers,
        )
        condition_id = cond_resp.json()["id"]

        # Create two medications
        med1_resp = client.post(
            "/api/v1/medications/",
            json={"patient_id": patient_id, "medication_name": "Metformin", "dosage": "500mg", "status": "active"},
            headers=auth_headers,
        )
        med2_resp = client.post(
            "/api/v1/medications/",
            json={"patient_id": patient_id, "medication_name": "Glipizide", "dosage": "5mg", "status": "active"},
            headers=auth_headers,
        )
        med1_id = med1_resp.json()["id"]
        med2_id = med2_resp.json()["id"]

        response = client.post(
            f"/api/v1/conditions/{condition_id}/medications/bulk",
            json={"medication_ids": [med1_id, med2_id], "relevance_note": "Bulk linked"},
            headers=auth_headers,
        )

        assert response.status_code == 200, response.text
        data = response.json()
        assert len(data) == 2
        for rel in data:
            assert rel["condition_id"] == condition_id
            assert rel["relevance_note"] == "Bulk linked"

    def test_bulk_create_skips_existing(self, client: TestClient, condition_and_medication, auth_headers, user_with_patient):
        """Bulk create silently skips medications already linked to the condition."""
        patient_id = user_with_patient["patient"].id
        condition_id = condition_and_medication["condition"]["id"]
        medication_id = condition_and_medication["medication"]["id"]

        # Pre-link the first medication
        client.post(
            f"/api/v1/conditions/{condition_id}/medications",
            json={"medication_id": medication_id},
            headers=auth_headers,
        )

        # Create a second medication
        med2_resp = client.post(
            "/api/v1/medications/",
            json={"patient_id": patient_id, "medication_name": "Amlodipine", "dosage": "5mg", "status": "active"},
            headers=auth_headers,
        )
        med2_id = med2_resp.json()["id"]

        response = client.post(
            f"/api/v1/conditions/{condition_id}/medications/bulk",
            json={"medication_ids": [medication_id, med2_id]},
            headers=auth_headers,
        )

        assert response.status_code == 200, response.text
        data = response.json()
        # Only the new medication should be returned
        assert len(data) == 1
        assert data[0]["medication_id"] == med2_id

    def test_bulk_create_empty_ids_rejected(self, client: TestClient, condition_and_medication, auth_headers):
        """Bulk create with empty medication_ids is rejected."""
        condition_id = condition_and_medication["condition"]["id"]

        response = client.post(
            f"/api/v1/conditions/{condition_id}/medications/bulk",
            json={"medication_ids": []},
            headers=auth_headers,
        )

        assert response.status_code == 422, response.text

    # --- GET /medication/{medication_id}/conditions ---

    def test_get_medication_conditions_empty(self, client: TestClient, condition_and_medication, auth_headers):
        """Getting conditions for a medication with no links returns an empty list."""
        medication_id = condition_and_medication["medication"]["id"]

        response = client.get(
            f"/api/v1/conditions/medication/{medication_id}/conditions",
            headers=auth_headers,
        )

        assert response.status_code == 200, response.text
        assert response.json() == []

    def test_get_medication_conditions_with_links(self, client: TestClient, condition_and_medication, auth_headers):
        """Getting conditions for a linked medication returns the condition details."""
        condition_id = condition_and_medication["condition"]["id"]
        medication_id = condition_and_medication["medication"]["id"]

        client.post(
            f"/api/v1/conditions/{condition_id}/medications",
            json={"medication_id": medication_id, "relevance_note": "Test note"},
            headers=auth_headers,
        )

        response = client.get(
            f"/api/v1/conditions/medication/{medication_id}/conditions",
            headers=auth_headers,
        )

        assert response.status_code == 200, response.text
        data = response.json()
        assert len(data) == 1
        assert data[0]["condition_id"] == condition_id
        assert data[0]["medication_id"] == medication_id
        assert data[0]["relevance_note"] == "Test note"
        assert "id" in data[0]

    def test_get_medication_conditions_nonexistent_medication(self, client: TestClient, auth_headers):
        """Getting conditions for a non-existent medication returns 404."""
        response = client.get(
            "/api/v1/conditions/medication/99999/conditions",
            headers=auth_headers,
        )

        assert response.status_code == 404, response.text

    def test_get_medication_conditions_unauthorized(self, client: TestClient, condition_and_medication):
        """Getting medication conditions without auth returns 401."""
        medication_id = condition_and_medication["medication"]["id"]

        response = client.get(
            f"/api/v1/conditions/medication/{medication_id}/conditions",
        )

        assert response.status_code == 401, response.text

    def test_get_medication_conditions_other_user_rejected(self, client: TestClient, db_session: Session, condition_and_medication):
        """A different user cannot see another user's medication conditions."""
        medication_id = condition_and_medication["medication"]["id"]

        user2_data = create_random_user(db_session)
        patient2 = patient_crud.create_for_user(
            db_session,
            user_id=user2_data["user"].id,
            patient_data=PatientCreate(
                first_name="Carol",
                last_name="White",
                birth_date=date(1992, 7, 4),
                gender="F",
            ),
        )
        user2_data["user"].active_patient_id = patient2.id
        db_session.commit()
        db_session.refresh(user2_data["user"])
        headers2 = create_user_token_headers(user2_data["user"].username)

        response = client.get(
            f"/api/v1/conditions/medication/{medication_id}/conditions",
            headers=headers2,
        )

        assert response.status_code in (403, 404), response.text
