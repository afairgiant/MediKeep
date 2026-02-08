"""
Tests for Treatment Plan Enhancement features:
- Treatment mode field (simple/advanced)
- TreatmentMedication override fields (prescriber, pharmacy, dates)
- Enriched medication endpoint with effective values
- GET /medications/{id}/treatments endpoint
- Date cross-validation on TreatmentMedication
"""
import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers


def _create_user_with_patient(db_session, first_name, last_name, birth_date, gender, address):
    """Helper to create a user with a patient record for testing."""
    user_data = create_random_user(db_session)
    patient_data = PatientCreate(
        first_name=first_name,
        last_name=last_name,
        birth_date=birth_date,
        gender=gender,
        address=address,
    )
    patient = patient_crud.create_for_user(
        db_session, user_id=user_data["user"].id, patient_data=patient_data
    )
    user_data["user"].active_patient_id = patient.id
    db_session.commit()
    db_session.refresh(user_data["user"])
    return {**user_data, "patient": patient}


class TestTreatmentModeField:
    """Test treatment mode field (simple/advanced)."""

    @pytest.fixture
    def user_with_patient(self, db_session: Session):
        return _create_user_with_patient(db_session, "John", "Doe", date(1990, 1, 1), "M", "123 Main St")

    @pytest.fixture
    def authenticated_headers(self, user_with_patient):
        return create_user_token_headers(user_with_patient["user"].username)

    def test_create_treatment_defaults_to_simple_mode(self, client: TestClient, user_with_patient, authenticated_headers):
        """Treatment created without mode should default to 'simple'."""
        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Basic PT",
            "treatment_type": "Rehabilitation",
            "start_date": "2024-01-15",
            "status": "active",
        }

        response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "simple"

    def test_create_treatment_with_simple_mode(self, client: TestClient, user_with_patient, authenticated_headers):
        """Treatment created with explicit simple mode."""
        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Simple Therapy",
            "treatment_type": "Medical",
            "start_date": "2024-01-15",
            "status": "active",
            "mode": "simple",
        }

        response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        assert response.json()["mode"] == "simple"

    def test_create_treatment_with_advanced_mode(self, client: TestClient, user_with_patient, authenticated_headers):
        """Treatment created with advanced mode."""
        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Advanced Med Plan",
            "treatment_type": "Medication",
            "start_date": "2024-01-15",
            "status": "active",
            "mode": "advanced",
        }

        response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        assert response.json()["mode"] == "advanced"

    def test_create_treatment_invalid_mode_rejected(self, client: TestClient, user_with_patient, authenticated_headers):
        """Treatment with invalid mode should be rejected."""
        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Bad Mode",
            "treatment_type": "Medical",
            "start_date": "2024-01-15",
            "mode": "invalid_mode",
        }

        response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        assert response.status_code == 422

    def test_update_treatment_mode(self, client: TestClient, user_with_patient, authenticated_headers):
        """Treatment mode can be updated from simple to advanced."""
        # Create simple treatment
        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Upgradeable Plan",
            "treatment_type": "Medical",
            "start_date": "2024-01-15",
            "status": "active",
            "mode": "simple",
        }

        create_response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )
        treatment_id = create_response.json()["id"]

        # Update to advanced
        update_response = client.put(
            f"/api/v1/treatments/{treatment_id}",
            json={"mode": "advanced"},
            headers=authenticated_headers
        )

        assert update_response.status_code == 200
        assert update_response.json()["mode"] == "advanced"

    def test_update_treatment_invalid_mode_rejected(self, client: TestClient, user_with_patient, authenticated_headers):
        """Updating treatment to invalid mode should be rejected."""
        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "Update Test",
            "treatment_type": "Medical",
            "start_date": "2024-01-15",
            "status": "active",
        }

        create_response = client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )
        treatment_id = create_response.json()["id"]

        update_response = client.put(
            f"/api/v1/treatments/{treatment_id}",
            json={"mode": "bogus"},
            headers=authenticated_headers
        )

        assert update_response.status_code == 422

    def test_treatment_list_returns_mode(self, client: TestClient, user_with_patient, authenticated_headers):
        """Treatment list should include mode field."""
        treatment_data = {
            "patient_id": user_with_patient["patient"].id,
            "treatment_name": "List Mode Test",
            "treatment_type": "Medical",
            "start_date": "2024-01-15",
            "status": "active",
            "mode": "advanced",
        }

        client.post(
            "/api/v1/treatments/",
            json=treatment_data,
            headers=authenticated_headers
        )

        list_response = client.get(
            "/api/v1/treatments/",
            headers=authenticated_headers
        )

        assert list_response.status_code == 200
        treatments = list_response.json()
        assert len(treatments) >= 1
        matching = [t for t in treatments if t["treatment_name"] == "List Mode Test"]
        assert len(matching) == 1
        assert matching[0]["mode"] == "advanced"


class TestTreatmentMedicationOverrides:
    """Test treatment medication relationship with override fields."""

    @pytest.fixture
    def user_with_patient(self, db_session: Session):
        return _create_user_with_patient(db_session, "Jane", "Smith", date(1985, 6, 15), "F", "456 Oak Ave")

    @pytest.fixture
    def authenticated_headers(self, user_with_patient):
        return create_user_token_headers(user_with_patient["user"].username)

    @pytest.fixture
    def treatment_and_medication(self, client: TestClient, user_with_patient, authenticated_headers):
        """Create a treatment and medication for linking tests."""
        patient_id = user_with_patient["patient"].id

        # Create treatment
        treatment_response = client.post(
            "/api/v1/treatments/",
            json={
                "patient_id": patient_id,
                "treatment_name": "Pain Management Plan",
                "treatment_type": "Medication",
                "start_date": "2024-01-15",
                "status": "active",
                "mode": "advanced",
            },
            headers=authenticated_headers
        )
        treatment = treatment_response.json()

        # Create medication
        medication_response = client.post(
            "/api/v1/medications/",
            json={
                "patient_id": patient_id,
                "medication_name": "Ibuprofen",
                "dosage": "200mg",
                "frequency": "twice daily",
                "status": "active",
                "effective_period_start": "2024-01-01",
                "effective_period_end": "2024-12-31",
            },
            headers=authenticated_headers
        )
        medication = medication_response.json()

        return {"treatment": treatment, "medication": medication}

    def test_link_medication_with_override_fields(self, client: TestClient, treatment_and_medication, authenticated_headers):
        """Linking medication with specific override fields should work."""
        treatment_id = treatment_and_medication["treatment"]["id"]
        medication_id = treatment_and_medication["medication"]["id"]

        response = client.post(
            f"/api/v1/treatments/{treatment_id}/medications",
            json={
                "treatment_id": treatment_id,
                "medication_id": medication_id,
                "specific_dosage": "400mg",
                "specific_frequency": "three times daily",
                "specific_start_date": "2024-02-01",
                "specific_end_date": "2024-06-30",
                "relevance_note": "Higher dose for this treatment",
            },
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["specific_dosage"] == "400mg"
        assert data["specific_frequency"] == "three times daily"
        assert data["specific_start_date"] == "2024-02-01"
        assert data["specific_end_date"] == "2024-06-30"
        assert data["relevance_note"] == "Higher dose for this treatment"

    def test_link_medication_without_overrides(self, client: TestClient, treatment_and_medication, authenticated_headers):
        """Linking medication without overrides should default to nulls."""
        treatment_id = treatment_and_medication["treatment"]["id"]
        medication_id = treatment_and_medication["medication"]["id"]

        response = client.post(
            f"/api/v1/treatments/{treatment_id}/medications",
            json={
                "treatment_id": treatment_id,
                "medication_id": medication_id,
            },
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["specific_dosage"] is None
        assert data["specific_frequency"] is None
        assert data["specific_start_date"] is None
        assert data["specific_end_date"] is None
        assert data["specific_prescriber_id"] is None
        assert data["specific_pharmacy_id"] is None

    def test_update_medication_relationship_overrides(self, client: TestClient, treatment_and_medication, authenticated_headers):
        """Updating medication relationship should allow changing overrides."""
        treatment_id = treatment_and_medication["treatment"]["id"]
        medication_id = treatment_and_medication["medication"]["id"]

        # Create link
        create_response = client.post(
            f"/api/v1/treatments/{treatment_id}/medications",
            json={
                "treatment_id": treatment_id,
                "medication_id": medication_id,
            },
            headers=authenticated_headers
        )
        relationship_id = create_response.json()["id"]

        # Update with overrides
        update_response = client.put(
            f"/api/v1/treatments/{treatment_id}/medications/{relationship_id}",
            json={
                "specific_dosage": "600mg",
                "specific_start_date": "2024-03-01",
                "specific_end_date": "2024-09-30",
            },
            headers=authenticated_headers
        )

        assert update_response.status_code == 200
        data = update_response.json()
        assert data["specific_dosage"] == "600mg"
        assert data["specific_start_date"] == "2024-03-01"
        assert data["specific_end_date"] == "2024-09-30"

    def test_medication_relationship_date_validation(self, client: TestClient, treatment_and_medication, authenticated_headers):
        """End date before start date should be rejected."""
        treatment_id = treatment_and_medication["treatment"]["id"]
        medication_id = treatment_and_medication["medication"]["id"]

        response = client.post(
            f"/api/v1/treatments/{treatment_id}/medications",
            json={
                "treatment_id": treatment_id,
                "medication_id": medication_id,
                "specific_start_date": "2024-06-01",
                "specific_end_date": "2024-01-01",  # before start
            },
            headers=authenticated_headers
        )

        assert response.status_code == 422


class TestTreatmentMedicationEffectiveValues:
    """Test enriched medication endpoint with effective values."""

    @pytest.fixture
    def user_with_patient(self, db_session: Session):
        return _create_user_with_patient(db_session, "Bob", "Jones", date(1975, 3, 20), "M", "789 Pine Rd")

    @pytest.fixture
    def authenticated_headers(self, user_with_patient):
        return create_user_token_headers(user_with_patient["user"].username)

    @pytest.fixture
    def treatment_with_linked_medication(self, client: TestClient, user_with_patient, authenticated_headers):
        """Create a treatment with a linked medication for effective value tests."""
        patient_id = user_with_patient["patient"].id

        # Create treatment
        treatment_response = client.post(
            "/api/v1/treatments/",
            json={
                "patient_id": patient_id,
                "treatment_name": "Effective Values Test Plan",
                "treatment_type": "Medication",
                "start_date": "2024-01-15",
                "status": "active",
                "mode": "advanced",
            },
            headers=authenticated_headers
        )
        treatment = treatment_response.json()

        # Create medication with base values
        medication_response = client.post(
            "/api/v1/medications/",
            json={
                "patient_id": patient_id,
                "medication_name": "Aspirin",
                "dosage": "100mg",
                "frequency": "once daily",
                "status": "active",
                "effective_period_start": "2024-01-01",
                "effective_period_end": "2024-12-31",
            },
            headers=authenticated_headers
        )
        medication = medication_response.json()

        return {
            "treatment": treatment,
            "medication": medication,
            "patient_id": patient_id,
        }

    def test_effective_values_fallback_to_medication(self, client: TestClient, treatment_with_linked_medication, authenticated_headers):
        """When no overrides set, effective values should fall back to medication defaults."""
        treatment_id = treatment_with_linked_medication["treatment"]["id"]
        medication_id = treatment_with_linked_medication["medication"]["id"]

        # Link without overrides
        client.post(
            f"/api/v1/treatments/{treatment_id}/medications",
            json={
                "treatment_id": treatment_id,
                "medication_id": medication_id,
            },
            headers=authenticated_headers
        )

        # Fetch enriched medications
        response = client.get(
            f"/api/v1/treatments/{treatment_id}/medications",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

        rel = data[0]
        # Specific fields should be null
        assert rel["specific_dosage"] is None
        assert rel["specific_frequency"] is None
        assert rel["specific_start_date"] is None
        assert rel["specific_end_date"] is None

        # Effective values should fall back to medication defaults
        assert rel["effective_dosage"] == "100mg"
        assert rel["effective_frequency"] == "once daily"
        assert rel["effective_start_date"] == "2024-01-01"
        assert rel["effective_end_date"] == "2024-12-31"

        # Medication details should be included
        assert rel["medication"]["medication_name"] == "Aspirin"
        assert rel["medication"]["dosage"] == "100mg"
        assert rel["medication"]["frequency"] == "once daily"

    def test_effective_values_use_overrides(self, client: TestClient, treatment_with_linked_medication, authenticated_headers):
        """When overrides are set, effective values should use them."""
        treatment_id = treatment_with_linked_medication["treatment"]["id"]
        medication_id = treatment_with_linked_medication["medication"]["id"]

        # Link with overrides
        client.post(
            f"/api/v1/treatments/{treatment_id}/medications",
            json={
                "treatment_id": treatment_id,
                "medication_id": medication_id,
                "specific_dosage": "500mg",
                "specific_frequency": "twice daily",
                "specific_start_date": "2024-03-01",
                "specific_end_date": "2024-06-30",
            },
            headers=authenticated_headers
        )

        # Fetch enriched medications
        response = client.get(
            f"/api/v1/treatments/{treatment_id}/medications",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

        rel = data[0]
        # Effective values should use overrides
        assert rel["effective_dosage"] == "500mg"
        assert rel["effective_frequency"] == "twice daily"
        assert rel["effective_start_date"] == "2024-03-01"
        assert rel["effective_end_date"] == "2024-06-30"

        # Medication defaults still available in nested object
        assert rel["medication"]["dosage"] == "100mg"
        assert rel["medication"]["frequency"] == "once daily"

    def test_enriched_endpoint_returns_nested_objects(self, client: TestClient, treatment_with_linked_medication, authenticated_headers):
        """Enriched endpoint should include nested medication object."""
        treatment_id = treatment_with_linked_medication["treatment"]["id"]
        medication_id = treatment_with_linked_medication["medication"]["id"]

        client.post(
            f"/api/v1/treatments/{treatment_id}/medications",
            json={
                "treatment_id": treatment_id,
                "medication_id": medication_id,
                "specific_dosage": "250mg",
            },
            headers=authenticated_headers
        )

        response = client.get(
            f"/api/v1/treatments/{treatment_id}/medications",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

        rel = data[0]
        # Check standard fields
        assert "id" in rel
        assert "treatment_id" in rel
        assert "medication_id" in rel
        assert "specific_dosage" in rel
        assert "specific_frequency" in rel
        assert "specific_prescriber_id" in rel
        assert "specific_pharmacy_id" in rel
        assert "specific_start_date" in rel
        assert "specific_end_date" in rel

        # Check effective value fields
        assert "effective_dosage" in rel
        assert "effective_frequency" in rel
        assert "effective_start_date" in rel
        assert "effective_end_date" in rel
        assert "effective_prescriber" in rel
        assert "effective_pharmacy" in rel

        # Check nested medication object
        assert rel["medication"] is not None
        assert "id" in rel["medication"]
        assert "medication_name" in rel["medication"]
        assert "dosage" in rel["medication"]
        assert "frequency" in rel["medication"]
        assert "status" in rel["medication"]

    def test_effective_end_date_discarded_when_before_overridden_start(self, client: TestClient, treatment_with_linked_medication, authenticated_headers):
        """When start date is overridden to after the medication's end date, effective_end_date should be null."""
        treatment_id = treatment_with_linked_medication["treatment"]["id"]
        medication_id = treatment_with_linked_medication["medication"]["id"]

        # Medication has effective_period_end = 2024-12-31
        # Override start date to 2026-01-09 (after the medication's end date)
        client.post(
            f"/api/v1/treatments/{treatment_id}/medications",
            json={
                "treatment_id": treatment_id,
                "medication_id": medication_id,
                "specific_start_date": "2026-01-09",
                # no specific_end_date - would fall back to medication's 2024-12-31
            },
            headers=authenticated_headers
        )

        response = client.get(
            f"/api/v1/treatments/{treatment_id}/medications",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

        rel = data[0]
        assert rel["effective_start_date"] == "2026-01-09"
        # Fallback end date (2024-12-31) is before overridden start (2026-01-09), so it should be discarded
        assert rel["effective_end_date"] is None

    def test_enriched_endpoint_empty_when_no_medications(self, client: TestClient, treatment_with_linked_medication, authenticated_headers):
        """Enriched endpoint should return empty list for treatment with no medications."""
        treatment_id = treatment_with_linked_medication["treatment"]["id"]

        response = client.get(
            f"/api/v1/treatments/{treatment_id}/medications",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        assert response.json() == []


class TestMedicationTreatmentsEndpoint:
    """Test GET /medications/{id}/treatments endpoint."""

    @pytest.fixture
    def user_with_patient(self, db_session: Session):
        return _create_user_with_patient(db_session, "Alice", "Brown", date(1988, 11, 5), "F", "321 Elm St")

    @pytest.fixture
    def authenticated_headers(self, user_with_patient):
        return create_user_token_headers(user_with_patient["user"].username)

    @pytest.fixture
    def medication_with_treatments(self, client: TestClient, user_with_patient, authenticated_headers):
        """Create a medication linked to multiple treatments."""
        patient_id = user_with_patient["patient"].id

        # Create medication
        med_response = client.post(
            "/api/v1/medications/",
            json={
                "patient_id": patient_id,
                "medication_name": "Metformin",
                "dosage": "500mg",
                "frequency": "twice daily",
                "status": "active",
                "effective_period_start": "2024-01-01",
            },
            headers=authenticated_headers
        )
        medication = med_response.json()

        # Create treatment 1
        trt1_response = client.post(
            "/api/v1/treatments/",
            json={
                "patient_id": patient_id,
                "treatment_name": "Diabetes Management",
                "treatment_type": "Medication",
                "start_date": "2024-01-15",
                "status": "active",
                "mode": "advanced",
            },
            headers=authenticated_headers
        )
        treatment1 = trt1_response.json()

        # Create treatment 2
        trt2_response = client.post(
            "/api/v1/treatments/",
            json={
                "patient_id": patient_id,
                "treatment_name": "Weight Management",
                "treatment_type": "Medical",
                "start_date": "2024-02-01",
                "status": "active",
                "mode": "advanced",
            },
            headers=authenticated_headers
        )
        treatment2 = trt2_response.json()

        # Link medication to treatment 1 with overrides
        client.post(
            f"/api/v1/treatments/{treatment1['id']}/medications",
            json={
                "treatment_id": treatment1["id"],
                "medication_id": medication["id"],
                "specific_dosage": "1000mg",
                "relevance_note": "Higher dose for diabetes plan",
            },
            headers=authenticated_headers
        )

        # Link medication to treatment 2 without overrides
        client.post(
            f"/api/v1/treatments/{treatment2['id']}/medications",
            json={
                "treatment_id": treatment2["id"],
                "medication_id": medication["id"],
            },
            headers=authenticated_headers
        )

        return {
            "medication": medication,
            "treatment1": treatment1,
            "treatment2": treatment2,
        }

    def test_get_medication_treatments_returns_all(self, client: TestClient, medication_with_treatments, authenticated_headers):
        """Should return all treatments using this medication."""
        medication_id = medication_with_treatments["medication"]["id"]

        response = client.get(
            f"/api/v1/medications/{medication_id}/treatments",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

        treatment_names = [d["treatment"]["treatment_name"] for d in data]
        assert "Diabetes Management" in treatment_names
        assert "Weight Management" in treatment_names

    def test_get_medication_treatments_includes_overrides(self, client: TestClient, medication_with_treatments, authenticated_headers):
        """Should include junction override fields."""
        medication_id = medication_with_treatments["medication"]["id"]

        response = client.get(
            f"/api/v1/medications/{medication_id}/treatments",
            headers=authenticated_headers
        )

        data = response.json()

        # Find the one with overrides
        diabetes_rel = next(d for d in data if d["treatment"]["treatment_name"] == "Diabetes Management")
        assert diabetes_rel["specific_dosage"] == "1000mg"
        assert diabetes_rel["relevance_note"] == "Higher dose for diabetes plan"

        # The one without overrides
        weight_rel = next(d for d in data if d["treatment"]["treatment_name"] == "Weight Management")
        assert weight_rel["specific_dosage"] is None

    def test_get_medication_treatments_includes_treatment_details(self, client: TestClient, medication_with_treatments, authenticated_headers):
        """Should include nested treatment details."""
        medication_id = medication_with_treatments["medication"]["id"]

        response = client.get(
            f"/api/v1/medications/{medication_id}/treatments",
            headers=authenticated_headers
        )

        data = response.json()
        treatment_entry = data[0]["treatment"]
        assert "id" in treatment_entry
        assert "treatment_name" in treatment_entry
        assert "treatment_type" in treatment_entry
        assert "status" in treatment_entry
        assert "mode" in treatment_entry
        assert "start_date" in treatment_entry

    def test_get_medication_treatments_empty(self, client: TestClient, user_with_patient, authenticated_headers):
        """Medication with no linked treatments should return empty list."""
        patient_id = user_with_patient["patient"].id

        # Create medication not linked to any treatment
        med_response = client.post(
            "/api/v1/medications/",
            json={
                "patient_id": patient_id,
                "medication_name": "Standalone Drug",
                "dosage": "10mg",
                "status": "active",
            },
            headers=authenticated_headers
        )
        medication_id = med_response.json()["id"]

        response = client.get(
            f"/api/v1/medications/{medication_id}/treatments",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        assert response.json() == []

    def test_get_medication_treatments_not_found(self, client: TestClient, authenticated_headers):
        """Non-existent medication should return 404."""
        response = client.get(
            "/api/v1/medications/99999/treatments",
            headers=authenticated_headers
        )

        assert response.status_code == 404

    def test_get_medication_treatments_unauthenticated(self, client: TestClient):
        """Unauthenticated request should return 401."""
        response = client.get("/api/v1/medications/1/treatments")

        assert response.status_code == 401

    def test_get_medication_treatments_patient_isolation(self, client: TestClient, db_session: Session, medication_with_treatments):
        """User should not access another user's medication treatments."""
        medication_id = medication_with_treatments["medication"]["id"]

        # Create second user
        user_data2 = create_random_user(db_session)
        patient_data2 = PatientCreate(
            first_name="Other",
            last_name="User",
            birth_date=date(1992, 7, 20),
            gender="M",
            address="999 Other St"
        )
        patient2 = patient_crud.create_for_user(
            db_session, user_id=user_data2["user"].id, patient_data=patient_data2
        )
        user_data2["user"].active_patient_id = patient2.id
        db_session.commit()

        headers2 = create_user_token_headers(user_data2["user"].username)

        # Second user tries to access first user's medication treatments
        response = client.get(
            f"/api/v1/medications/{medication_id}/treatments",
            headers=headers2
        )

        # Should be 403 or 404 depending on implementation
        assert response.status_code in [403, 404]
