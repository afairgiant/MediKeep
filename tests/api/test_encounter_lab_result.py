"""
Tests for Encounter-Lab Result relationship API endpoints.

Tests both encounter-side (/encounters/{id}/lab-results) and
lab-result-side (/lab-results/{id}/encounters) endpoints.
"""

import pytest
from datetime import date, timedelta

from app.crud.patient import patient as patient_crud
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers


class TestEncounterLabResultAPI:
    """Tests for encounter-lab result relationship endpoints."""

    @pytest.fixture
    def test_encounter(self, client, user_with_patient, authenticated_headers):
        """Create a test encounter."""
        response = client.post(
            "/api/v1/encounters/",
            json={
                "reason": "Annual checkup",
                "date": str(date.today() - timedelta(days=7)),
                "visit_type": "routine",
                "chief_complaint": "Routine visit",
                "patient_id": user_with_patient["patient"].id,
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        return response.json()

    @pytest.fixture
    def test_lab_result(self, client, user_with_patient, authenticated_headers):
        """Create a test lab result."""
        response = client.post(
            "/api/v1/lab-results/",
            json={
                "test_name": "Complete Blood Count",
                "test_code": "CBC",
                "test_category": "Hematology",
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
        """Create a second test lab result for bulk operations."""
        response = client.post(
            "/api/v1/lab-results/",
            json={
                "test_name": "Metabolic Panel",
                "test_code": "CMP",
                "test_category": "Chemistry",
                "ordered_date": str(date.today() - timedelta(days=5)),
                "status": "completed",
                "patient_id": user_with_patient["patient"].id,
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 201
        return response.json()

    @pytest.fixture
    def second_encounter(self, client, user_with_patient, authenticated_headers):
        """Create a second test encounter for bulk operations."""
        response = client.post(
            "/api/v1/encounters/",
            json={
                "reason": "Follow-up visit",
                "date": str(date.today() - timedelta(days=3)),
                "visit_type": "follow-up",
                "patient_id": user_with_patient["patient"].id,
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        return response.json()

    # ---- Encounter-side endpoint tests ----

    def test_link_lab_result_to_encounter(
        self, client, authenticated_headers, test_encounter, test_lab_result
    ):
        """Test linking a lab result to an encounter."""
        response = client.post(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            json={
                "lab_result_id": test_lab_result["id"],
                "purpose": "ordered_during",
                "relevance_note": "CBC ordered during routine checkup",
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["encounter_id"] == test_encounter["id"]
        assert data["lab_result_id"] == test_lab_result["id"]
        assert data["purpose"] == "ordered_during"
        assert data["relevance_note"] == "CBC ordered during routine checkup"
        assert "id" in data
        assert "created_at" in data

    def test_link_lab_result_without_purpose(
        self, client, authenticated_headers, test_encounter, test_lab_result
    ):
        """Test linking a lab result without purpose or note."""
        response = client.post(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            json={"lab_result_id": test_lab_result["id"]},
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["purpose"] is None
        assert data["relevance_note"] is None

    def test_get_encounter_lab_results(
        self, client, authenticated_headers, test_encounter, test_lab_result
    ):
        """Test retrieving lab results linked to an encounter."""
        # Link first
        client.post(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            json={
                "lab_result_id": test_lab_result["id"],
                "purpose": "ordered_during",
            },
            headers=authenticated_headers,
        )

        # Get
        response = client.get(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["lab_result_id"] == test_lab_result["id"]
        assert data[0]["lab_result_name"] == "Complete Blood Count"
        assert data[0]["encounter_reason"] == "Annual checkup"

    def test_get_encounter_lab_results_empty(
        self, client, authenticated_headers, test_encounter
    ):
        """Test getting lab results when none are linked."""
        response = client.get(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        assert response.json() == []

    def test_bulk_link_lab_results_to_encounter(
        self,
        client,
        authenticated_headers,
        test_encounter,
        test_lab_result,
        second_lab_result,
    ):
        """Test bulk linking lab results to an encounter."""
        response = client.post(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results/bulk",
            json={
                "lab_result_ids": [test_lab_result["id"], second_lab_result["id"]],
                "purpose": "ordered_during",
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        linked_ids = {d["lab_result_id"] for d in data}
        assert test_lab_result["id"] in linked_ids
        assert second_lab_result["id"] in linked_ids

    def test_bulk_link_skips_existing(
        self,
        client,
        authenticated_headers,
        test_encounter,
        test_lab_result,
        second_lab_result,
    ):
        """Test that bulk link skips already-linked lab results."""
        # Link first one individually
        client.post(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            json={"lab_result_id": test_lab_result["id"]},
            headers=authenticated_headers,
        )

        # Bulk link both
        response = client.post(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results/bulk",
            json={
                "lab_result_ids": [test_lab_result["id"], second_lab_result["id"]],
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        data = response.json()
        # Only the second should be created
        assert len(data) == 1
        assert data[0]["lab_result_id"] == second_lab_result["id"]

    def test_update_encounter_lab_result(
        self, client, authenticated_headers, test_encounter, test_lab_result
    ):
        """Test updating a relationship's purpose and note."""
        # Link
        link_resp = client.post(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            json={"lab_result_id": test_lab_result["id"], "purpose": "ordered_during"},
            headers=authenticated_headers,
        )
        rel_id = link_resp.json()["id"]

        # Update
        response = client.put(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results/{rel_id}",
            json={
                "purpose": "results_reviewed",
                "relevance_note": "Reviewed at follow-up",
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["purpose"] == "results_reviewed"
        assert data["relevance_note"] == "Reviewed at follow-up"

    def test_delete_encounter_lab_result(
        self, client, authenticated_headers, test_encounter, test_lab_result
    ):
        """Test unlinking a lab result from an encounter."""
        # Link
        link_resp = client.post(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            json={"lab_result_id": test_lab_result["id"]},
            headers=authenticated_headers,
        )
        rel_id = link_resp.json()["id"]

        # Delete
        response = client.delete(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results/{rel_id}",
            headers=authenticated_headers,
        )
        assert response.status_code == 200

        # Verify gone
        get_resp = client.get(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            headers=authenticated_headers,
        )
        assert get_resp.json() == []

    def test_duplicate_link_rejected(
        self, client, authenticated_headers, test_encounter, test_lab_result
    ):
        """Test that duplicate links are rejected."""
        # Link once
        client.post(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            json={"lab_result_id": test_lab_result["id"]},
            headers=authenticated_headers,
        )

        # Try to link again
        response = client.post(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            json={"lab_result_id": test_lab_result["id"]},
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    def test_link_nonexistent_encounter(
        self, client, authenticated_headers, test_lab_result
    ):
        """Test linking to nonexistent encounter returns 404."""
        response = client.post(
            "/api/v1/encounters/99999/lab-results",
            json={"lab_result_id": test_lab_result["id"]},
            headers=authenticated_headers,
        )
        assert response.status_code == 404

    def test_link_nonexistent_lab_result(
        self, client, authenticated_headers, test_encounter
    ):
        """Test linking nonexistent lab result returns 404."""
        response = client.post(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            json={"lab_result_id": 99999},
            headers=authenticated_headers,
        )
        assert response.status_code == 404

    def test_update_wrong_encounter(
        self,
        client,
        authenticated_headers,
        test_encounter,
        second_encounter,
        test_lab_result,
    ):
        """Test updating relationship from wrong encounter fails."""
        # Link to first encounter
        link_resp = client.post(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            json={"lab_result_id": test_lab_result["id"]},
            headers=authenticated_headers,
        )
        rel_id = link_resp.json()["id"]

        # Try to update via second encounter
        response = client.put(
            f"/api/v1/encounters/{second_encounter['id']}/lab-results/{rel_id}",
            json={"purpose": "reference"},
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    def test_delete_wrong_encounter(
        self,
        client,
        authenticated_headers,
        test_encounter,
        second_encounter,
        test_lab_result,
    ):
        """Test deleting relationship from wrong encounter fails."""
        link_resp = client.post(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            json={"lab_result_id": test_lab_result["id"]},
            headers=authenticated_headers,
        )
        rel_id = link_resp.json()["id"]

        response = client.delete(
            f"/api/v1/encounters/{second_encounter['id']}/lab-results/{rel_id}",
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    # ---- Lab-result-side endpoint tests ----

    def test_link_encounter_to_lab_result(
        self, client, authenticated_headers, test_encounter, test_lab_result
    ):
        """Test linking an encounter to a lab result (from lab result side)."""
        response = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/encounters",
            json={
                "encounter_id": test_encounter["id"],
                "purpose": "results_reviewed",
                "relevance_note": "Results reviewed at visit",
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["encounter_id"] == test_encounter["id"]
        assert data["lab_result_id"] == test_lab_result["id"]
        assert data["purpose"] == "results_reviewed"

    def test_get_lab_result_encounters(
        self, client, authenticated_headers, test_encounter, test_lab_result
    ):
        """Test retrieving encounters linked to a lab result."""
        # Link
        client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/encounters",
            json={
                "encounter_id": test_encounter["id"],
                "purpose": "ordered_during",
            },
            headers=authenticated_headers,
        )

        # Get
        response = client.get(
            f"/api/v1/lab-results/{test_lab_result['id']}/encounters",
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["encounter_id"] == test_encounter["id"]
        assert data[0]["encounter_reason"] == "Annual checkup"
        assert data[0]["lab_result_name"] == "Complete Blood Count"

    def test_bulk_link_encounters_to_lab_result(
        self,
        client,
        authenticated_headers,
        test_encounter,
        second_encounter,
        test_lab_result,
    ):
        """Test bulk linking encounters to a lab result."""
        response = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/encounters/bulk",
            json={
                "encounter_ids": [test_encounter["id"], second_encounter["id"]],
                "purpose": "reference",
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_update_lab_result_encounter(
        self, client, authenticated_headers, test_encounter, test_lab_result
    ):
        """Test updating relationship from lab result side."""
        link_resp = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/encounters",
            json={"encounter_id": test_encounter["id"]},
            headers=authenticated_headers,
        )
        rel_id = link_resp.json()["id"]

        response = client.put(
            f"/api/v1/lab-results/{test_lab_result['id']}/encounters/{rel_id}",
            json={"purpose": "follow_up_for", "relevance_note": "Follow-up labs"},
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        assert response.json()["purpose"] == "follow_up_for"

    def test_delete_lab_result_encounter(
        self, client, authenticated_headers, test_encounter, test_lab_result
    ):
        """Test unlinking encounter from lab result side."""
        link_resp = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/encounters",
            json={"encounter_id": test_encounter["id"]},
            headers=authenticated_headers,
        )
        rel_id = link_resp.json()["id"]

        response = client.delete(
            f"/api/v1/lab-results/{test_lab_result['id']}/encounters/{rel_id}",
            headers=authenticated_headers,
        )
        assert response.status_code == 200

        # Verify gone
        get_resp = client.get(
            f"/api/v1/lab-results/{test_lab_result['id']}/encounters",
            headers=authenticated_headers,
        )
        assert get_resp.json() == []

    def test_duplicate_link_rejected_lab_result_side(
        self, client, authenticated_headers, test_encounter, test_lab_result
    ):
        """Test duplicate link rejected from lab result side."""
        client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/encounters",
            json={"encounter_id": test_encounter["id"]},
            headers=authenticated_headers,
        )

        response = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/encounters",
            json={"encounter_id": test_encounter["id"]},
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    def test_update_wrong_lab_result(
        self,
        client,
        authenticated_headers,
        test_encounter,
        test_lab_result,
        second_lab_result,
    ):
        """Test updating relationship from wrong lab result fails."""
        link_resp = client.post(
            f"/api/v1/lab-results/{test_lab_result['id']}/encounters",
            json={"encounter_id": test_encounter["id"]},
            headers=authenticated_headers,
        )
        rel_id = link_resp.json()["id"]

        response = client.put(
            f"/api/v1/lab-results/{second_lab_result['id']}/encounters/{rel_id}",
            json={"purpose": "reference"},
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    # ---- Bidirectional consistency tests ----

    def test_link_visible_from_both_sides(
        self, client, authenticated_headers, test_encounter, test_lab_result
    ):
        """Test that a link created from one side is visible from both sides."""
        # Link from encounter side
        client.post(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            json={"lab_result_id": test_lab_result["id"], "purpose": "ordered_during"},
            headers=authenticated_headers,
        )

        # Verify from encounter side
        enc_resp = client.get(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            headers=authenticated_headers,
        )
        assert len(enc_resp.json()) == 1

        # Verify from lab result side
        lr_resp = client.get(
            f"/api/v1/lab-results/{test_lab_result['id']}/encounters",
            headers=authenticated_headers,
        )
        assert len(lr_resp.json()) == 1
        assert lr_resp.json()[0]["encounter_id"] == test_encounter["id"]
        assert lr_resp.json()[0]["purpose"] == "ordered_during"

    # ---- Cross-patient rejection tests ----

    def test_cross_patient_link_rejected(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        test_encounter,
    ):
        """Test that linking entities from different patients is rejected."""
        # Create a second user with patient
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

        # Create lab result for the other patient directly in DB
        from app.models.models import LabResult

        other_lab = LabResult(
            test_name="Other Patient Lab",
            ordered_date=date.today(),
            status="ordered",
            patient_id=other_patient.id,
        )
        db_session.add(other_lab)
        db_session.commit()
        db_session.refresh(other_lab)
        other_lab_id = other_lab.id

        # Try to link other patient's lab result to first patient's encounter
        response = client.post(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            json={"lab_result_id": other_lab_id},
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    # ---- Patient isolation test ----

    def test_patient_isolation(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        test_encounter,
        test_lab_result,
    ):
        """Test that a second user cannot access another user's encounter relationships."""
        # Link for first user
        client.post(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            json={"lab_result_id": test_lab_result["id"]},
            headers=authenticated_headers,
        )

        # Create second user
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

        # Second user should not be able to access first user's encounter
        response = client.get(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            headers=other_headers,
        )
        # Should be 403 or 404 (ownership check)
        assert response.status_code in (403, 404)

    # ---- Cascade delete tests ----

    def test_cascade_delete_encounter(
        self, client, db_session, authenticated_headers, test_encounter, test_lab_result
    ):
        """Test that deleting an encounter removes its lab result relationships."""
        # Link
        client.post(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            json={"lab_result_id": test_lab_result["id"]},
            headers=authenticated_headers,
        )

        # Delete the encounter
        delete_resp = client.delete(
            f"/api/v1/encounters/{test_encounter['id']}",
            headers=authenticated_headers,
        )
        assert delete_resp.status_code == 200

        # Lab result should still exist
        lr_resp = client.get(
            f"/api/v1/lab-results/{test_lab_result['id']}",
            headers=authenticated_headers,
        )
        assert lr_resp.status_code == 200

        # Relationships should be gone (encounter no longer exists)
        enc_resp = client.get(
            f"/api/v1/lab-results/{test_lab_result['id']}/encounters",
            headers=authenticated_headers,
        )
        assert enc_resp.status_code == 200
        assert enc_resp.json() == []

    def test_cascade_delete_lab_result(
        self, client, db_session, authenticated_headers, test_encounter, test_lab_result
    ):
        """Test that deleting a lab result removes its encounter relationships."""
        # Link
        client.post(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            json={"lab_result_id": test_lab_result["id"]},
            headers=authenticated_headers,
        )

        # Delete the lab result
        delete_resp = client.delete(
            f"/api/v1/lab-results/{test_lab_result['id']}",
            headers=authenticated_headers,
        )
        assert delete_resp.status_code == 200

        # Encounter should still exist
        enc_resp = client.get(
            f"/api/v1/encounters/{test_encounter['id']}",
            headers=authenticated_headers,
        )
        assert enc_resp.status_code == 200

        # Relationships should be gone
        resp = client.get(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            headers=authenticated_headers,
        )
        assert resp.status_code == 200
        assert resp.json() == []

    # ---- Purpose validation tests ----

    def test_valid_purposes(
        self, client, authenticated_headers, test_encounter, test_lab_result
    ):
        """Test that all valid purpose values are accepted."""
        valid_purposes = [
            "ordered_during",
            "results_reviewed",
            "follow_up_for",
            "reference",
            "other",
        ]
        for purpose in valid_purposes:
            # Clean up previous link
            get_resp = client.get(
                f"/api/v1/encounters/{test_encounter['id']}/lab-results",
                headers=authenticated_headers,
            )
            for rel in get_resp.json():
                client.delete(
                    f"/api/v1/encounters/{test_encounter['id']}/lab-results/{rel['id']}",
                    headers=authenticated_headers,
                )

            response = client.post(
                f"/api/v1/encounters/{test_encounter['id']}/lab-results",
                json={"lab_result_id": test_lab_result["id"], "purpose": purpose},
                headers=authenticated_headers,
            )
            assert response.status_code == 200, f"Purpose '{purpose}' was rejected"

    def test_invalid_purpose_rejected(
        self, client, authenticated_headers, test_encounter, test_lab_result
    ):
        """Test that an invalid purpose value is rejected by validation."""
        response = client.post(
            f"/api/v1/encounters/{test_encounter['id']}/lab-results",
            json={
                "lab_result_id": test_lab_result["id"],
                "purpose": "invalid_purpose",
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 422
