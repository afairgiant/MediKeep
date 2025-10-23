"""
Tests for Immunizations API endpoints.
"""
import pytest
from datetime import date, datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers


class TestImmunizationsAPI:
    """Test Immunizations API endpoints."""

    @pytest.fixture
    def user_with_patient(self, db_session: Session):
        """Create a user with patient record for testing."""
        user_data = create_random_user(db_session)
        patient_data = PatientCreate(
            first_name="John",
            last_name="Doe",
            birth_date=date(1990, 1, 1),
            gender="M",
            address="123 Main St"
        )
        patient = patient_crud.create_for_user(
            db_session, user_id=user_data["user"].id, patient_data=patient_data
        )
        # Set as active patient for multi-patient system
        user_data["user"].active_patient_id = patient.id
        db_session.commit()
        db_session.refresh(user_data["user"])
        return {**user_data, "patient": patient}

    @pytest.fixture
    def authenticated_headers(self, user_with_patient):
        """Create authentication headers."""
        return create_user_token_headers(user_with_patient["user"].username)

    def test_create_immunization_success(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test successful immunization creation."""
        immunization_data = {
            "patient_id": user_with_patient["patient"].id,
            "vaccine_name": "COVID-19 mRNA Vaccine",
            "manufacturer": "Pfizer-BioNTech",
            "lot_number": "ABC123",
            "dose_number": 1,
            "date_administered": "2024-01-15",
            "site": "left deltoid",
            "route": "intramuscular",
            "location": "Primary Care Clinic",
            "notes": "Patient tolerated well, no immediate adverse reactions"
        }

        response = client.post(
            "/api/v1/immunizations/",
            json=immunization_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["vaccine_name"] == "COVID-19 mRNA Vaccine"
        assert data["manufacturer"] == "Pfizer-BioNTech"
        assert data["dose_number"] == 1
        assert data["patient_id"] == user_with_patient["patient"].id

    def test_create_booster_shot(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test creating a booster shot immunization."""
        immunization_data = {
            "patient_id": user_with_patient["patient"].id,
            "vaccine_name": "COVID-19 mRNA Vaccine",
            "manufacturer": "Moderna",
            "lot_number": "MOD456",
            "dose_number": 3,
            "date_administered": "2024-03-15",
            "site": "right deltoid",
            "route": "intramuscular",
            "location": "Pharmacy",
            "notes": "Third dose - booster shot"
        }

        response = client.post(
            "/api/v1/immunizations/",
            json=immunization_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["vaccine_name"] == "COVID-19 mRNA Vaccine"
        assert data["dose_number"] == 3
        assert data["notes"] == "Third dose - booster shot"

    def test_create_pediatric_immunization(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test creating a pediatric immunization."""
        immunization_data = {
            "patient_id": user_with_patient["patient"].id,
            "vaccine_name": "DTaP",
            "manufacturer": "Sanofi Pasteur",
            "lot_number": "DTaP789",
            "dose_number": 1,
            "date_administered": "2024-01-15",
            "site": "left thigh",
            "route": "intramuscular",
            "location": "Pediatric Clinic",
            "notes": "First dose of DTaP series"
        }

        response = client.post(
            "/api/v1/immunizations/",
            json=immunization_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["vaccine_name"] == "DTaP"
        assert data["site"] == "left thigh"

    def test_get_immunizations_list(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test getting list of immunizations."""
        # Create multiple immunizations
        immunizations = [
            {
                "patient_id": user_with_patient["patient"].id,
                "vaccine_name": "COVID-19 mRNA Vaccine",
                "manufacturer": "Pfizer-BioNTech",
                "dose_number": 1,
                "date_administered": "2024-01-15",
            },
            {
                "patient_id": user_with_patient["patient"].id,
                "vaccine_name": "Influenza Vaccine",
                "manufacturer": "Sanofi",
                "dose_number": 1,
                "date_administered": "2024-02-01",
            },
            {
                "patient_id": user_with_patient["patient"].id,
                "vaccine_name": "Tdap",
                "manufacturer": "GlaxoSmithKline",
                "dose_number": 1,
                "date_administered": "2024-02-15",
            }
        ]

        for immunization_data in immunizations:
            client.post(
                "/api/v1/immunizations/",
                json=immunization_data,
                headers=authenticated_headers
            )

        # Get immunizations list
        response = client.get("/api/v1/immunizations/", headers=authenticated_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3

        # Should include all created immunizations
        vaccine_names = [imm["vaccine_name"] for imm in data]
        assert "COVID-19 mRNA Vaccine" in vaccine_names
        assert "Influenza Vaccine" in vaccine_names
        assert "Tdap" in vaccine_names

    def test_get_immunization_by_id(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test getting a specific immunization by ID."""
        immunization_data = {
            "patient_id": user_with_patient["patient"].id,
            "vaccine_name": "Hepatitis B Vaccine",
            "manufacturer": "Merck",
            "lot_number": "HepB123",
            "dose_number": 1,
            "date_administered": "2024-01-15",
            "site": "left deltoid",
            "route": "intramuscular",
            "location": "Travel Clinic"
        }

        create_response = client.post(
            "/api/v1/immunizations/",
            json=immunization_data,
            headers=authenticated_headers
        )

        immunization_id = create_response.json()["id"]

        # Get immunization by ID
        response = client.get(
            f"/api/v1/immunizations/{immunization_id}",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == immunization_id
        assert data["vaccine_name"] == "Hepatitis B Vaccine"
        assert data["lot_number"] == "HepB123"

    def test_update_immunization(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test updating an immunization."""
        # Create immunization
        immunization_data = {
            "patient_id": user_with_patient["patient"].id,
            "vaccine_name": "COVID-19 mRNA Vaccine",
            "manufacturer": "Pfizer-BioNTech",
            "dose_number": 1,
            "date_administered": "2024-01-15",
        }

        create_response = client.post(
            "/api/v1/immunizations/",
            json=immunization_data,
            headers=authenticated_headers
        )

        immunization_id = create_response.json()["id"]

        # Update immunization with additional details
        update_data = {
            "lot_number": "PF123456",
            "site": "left deltoid",
            "notes": "Updated with complete information after verification"
        }

        response = client.put(
            f"/api/v1/immunizations/{immunization_id}",
            json=update_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["lot_number"] == "PF123456"
        assert data["site"] == "left deltoid"
        assert data["vaccine_name"] == "COVID-19 mRNA Vaccine"  # Unchanged

    def test_complete_immunization_series(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test completing an immunization series."""
        # Create initial immunization
        immunization_data = {
            "patient_id": user_with_patient["patient"].id,
            "vaccine_name": "Hepatitis B Vaccine",
            "manufacturer": "Merck",
            "dose_number": 2,
            "date_administered": "2024-01-15",
        }

        create_response = client.post(
            "/api/v1/immunizations/",
            json=immunization_data,
            headers=authenticated_headers
        )

        immunization_id = create_response.json()["id"]

        # Complete the series
        update_data = {
            "dose_number": 3,
            "notes": "Series completed - patient is now fully immunized"
        }

        response = client.put(
            f"/api/v1/immunizations/{immunization_id}",
            json=update_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["dose_number"] == 3
        assert data["notes"] == "Series completed - patient is now fully immunized"

    def test_delete_immunization(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test deleting an immunization."""
        immunization_data = {
            "patient_id": user_with_patient["patient"].id,
            "vaccine_name": "Test Vaccine to Delete",
            "manufacturer": "Test Manufacturer",
            "dose_number": 1,
            "date_administered": "2024-01-15"
        }

        create_response = client.post(
            "/api/v1/immunizations/",
            json=immunization_data,
            headers=authenticated_headers
        )

        immunization_id = create_response.json()["id"]

        # Delete immunization
        response = client.delete(
            f"/api/v1/immunizations/{immunization_id}",
            headers=authenticated_headers
        )

        assert response.status_code == 200

        # Verify deletion
        get_response = client.get(
            f"/api/v1/immunizations/{immunization_id}",
            headers=authenticated_headers
        )
        assert get_response.status_code == 404

    def test_search_immunizations_by_vaccine(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test searching immunizations by vaccine name."""
        # Create immunizations with different vaccines
        immunizations = [
            {
                "patient_id": user_with_patient["patient"].id,
                "vaccine_name": "COVID-19 mRNA Vaccine",
                "manufacturer": "Pfizer-BioNTech",
                "dose_number": 1,
                "date_administered": "2024-01-15"
            },
            {
                "patient_id": user_with_patient["patient"].id,
                "vaccine_name": "COVID-19 mRNA Vaccine",
                "manufacturer": "Moderna",
                "dose_number": 2,
                "date_administered": "2024-02-15"
            },
            {
                "patient_id": user_with_patient["patient"].id,
                "vaccine_name": "Influenza Vaccine",
                "manufacturer": "Sanofi",
                "dose_number": 1,
                "date_administered": "2024-03-15"
            }
        ]

        for immunization_data in immunizations:
            client.post(
                "/api/v1/immunizations/",
                json=immunization_data,
                headers=authenticated_headers
            )

        # Search for COVID-19 vaccines
        response = client.get(
            "/api/v1/immunizations/?vaccine_name=COVID-19 mRNA Vaccine",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert all(imm["vaccine_name"] == "COVID-19 mRNA Vaccine" for imm in data)

    def test_get_recent_immunizations(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test getting recent immunizations."""
        # Create immunizations with different dates
        recent_date = date.today() - timedelta(days=30)
        old_date = date.today() - timedelta(days=400)

        immunizations = [
            {
                "patient_id": user_with_patient["patient"].id,
                "vaccine_name": "Recent Vaccine",
                "manufacturer": "Recent Manufacturer",
                "dose_number": 1,
                "date_administered": recent_date.strftime("%Y-%m-%d")
            },
            {
                "patient_id": user_with_patient["patient"].id,
                "vaccine_name": "Old Vaccine",
                "manufacturer": "Old Manufacturer",
                "dose_number": 1,
                "date_administered": old_date.strftime("%Y-%m-%d")
            }
        ]

        for immunization_data in immunizations:
            client.post(
                "/api/v1/immunizations/",
                json=immunization_data,
                headers=authenticated_headers
            )

        # Get recent immunizations (within 365 days)
        response = client.get(
            f"/api/v1/immunizations/patient/{user_with_patient['patient'].id}/recent",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        
        # Should include recent but not old immunization
        vaccine_names = [imm["vaccine_name"] for imm in data]
        assert "Recent Vaccine" in vaccine_names
        # Old vaccine should not be in recent list (>365 days ago)

    def test_check_booster_due(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test checking if booster is due."""
        # Create an immunization from 13 months ago
        old_date = date.today() - timedelta(days=13*30)  # 13 months ago
        
        immunization_data = {
            "patient_id": user_with_patient["patient"].id,
            "vaccine_name": "COVID-19 mRNA Vaccine",
            "manufacturer": "Pfizer-BioNTech",
            "dose_number": 2,
            "date_administered": old_date.strftime("%Y-%m-%d"),
        }

        client.post(
            "/api/v1/immunizations/",
            json=immunization_data,
            headers=authenticated_headers
        )

        # Check if booster is due (12 month interval)
        response = client.get(
            f"/api/v1/immunizations/patient/{user_with_patient['patient'].id}/booster-check/COVID-19 mRNA Vaccine?months_interval=12",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["patient_id"] == user_with_patient["patient"].id
        assert data["vaccine_name"] == "COVID-19 mRNA Vaccine"

    def test_immunization_patient_isolation(self, client: TestClient, db_session: Session):
        """Test that users can only access their own immunizations."""
        # Create two users with patients
        user1_data = create_random_user(db_session)
        patient1_data = PatientCreate(
            first_name="User",
            last_name="One",
            birth_date=date(1990, 1, 1),
            gender="M"
        )
        patient1 = patient_crud.create_for_user(
            db_session, user_id=user1_data["user"].id, patient_data=patient1_data
        )
        # Set active patient for multi-patient system
        user1_data["user"].active_patient_id = patient1.id
        db_session.commit()
        db_session.refresh(user1_data["user"])
        headers1 = create_user_token_headers(user1_data["user"].username)

        user2_data = create_random_user(db_session)
        patient2_data = PatientCreate(
            first_name="User",
            last_name="Two",
            birth_date=date(1990, 1, 1),
            gender="F"
        )
        patient2 = patient_crud.create_for_user(
            db_session, user_id=user2_data["user"].id, patient_data=patient2_data
        )
        # Set active patient for multi-patient system
        user2_data["user"].active_patient_id = patient2.id
        db_session.commit()
        db_session.refresh(user2_data["user"])
        headers2 = create_user_token_headers(user2_data["user"].username)

        # User1 creates an immunization
        immunization_data = {
            "patient_id": patient1.id,
            "vaccine_name": "Private Vaccine",
            "manufacturer": "Private Manufacturer",
            "dose_number": 1,
            "date_administered": "2024-01-15"
        }

        create_response = client.post(
            "/api/v1/immunizations/",
            json=immunization_data,
            headers=headers1
        )

        immunization_id = create_response.json()["id"]

        # User2 tries to access User1's immunization - should fail
        response = client.get(
            f"/api/v1/immunizations/{immunization_id}",
            headers=headers2
        )
        assert response.status_code == 404

        # User2 tries to update User1's immunization - should fail
        update_response = client.put(
            f"/api/v1/immunizations/{immunization_id}",
            json={"dose_number": 2},
            headers=headers2
        )
        assert update_response.status_code == 404

    def test_immunization_validation_errors(self, client: TestClient, authenticated_headers):
        """Test various validation error scenarios."""
        # Test missing required fields
        invalid_data = {
            "manufacturer": "Test Manufacturer",
            "dose_number": 1
            # Missing vaccine_name and administration_date
        }

        response = client.post(
            "/api/v1/immunizations/",
            json=invalid_data,
            headers=authenticated_headers
        )

        assert response.status_code == 422

        # Test invalid date format
        invalid_date_data = {
            "vaccine_name": "Test Vaccine",
            "manufacturer": "Test Manufacturer",
            "dose_number": 1,
            "date_administered": "invalid-date-format"
        }

        response = client.post(
            "/api/v1/immunizations/",
            json=invalid_date_data,
            headers=authenticated_headers
        )

        assert response.status_code == 422

        # Test invalid dose number
        invalid_dose_data = {
            "vaccine_name": "Test Vaccine",
            "manufacturer": "Test Manufacturer",
            "dose_number": 0,  # Invalid dose number
            "date_administered": "2024-01-15"
        }

        response = client.post(
            "/api/v1/immunizations/",
            json=invalid_dose_data,
            headers=authenticated_headers
        )

        assert response.status_code == 422

        # Test invalid route
        invalid_route_data = {
            "vaccine_name": "Test Vaccine",
            "manufacturer": "Test Manufacturer",
            "dose_number": 1,
            "date_administered": "2024-01-15",
            "route": "invalid_route"
        }

        response = client.post(
            "/api/v1/immunizations/",
            json=invalid_route_data,
            headers=authenticated_headers
        )

        assert response.status_code == 422

    def test_immunization_tracking_workflow(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test complete immunization tracking workflow."""
        # Create initial dose
        first_dose_data = {
            "vaccine_name": "COVID-19 mRNA Vaccine",
            "manufacturer": "Pfizer-BioNTech",
            "lot_number": "ABC123",
            "dose_number": 1,
            "date_administered": "2024-01-15",
            "site": "left deltoid",
            "route": "intramuscular",
            "notes": "First dose of COVID-19 vaccine series"
        }

        first_response = client.post(
            "/api/v1/immunizations/",
            json=first_dose_data,
            headers=authenticated_headers
        )

        assert first_response.status_code == 201
        first_dose_id = first_response.json()["id"]

        # Create second dose
        second_dose_data = {
            "vaccine_name": "COVID-19 mRNA Vaccine",
            "manufacturer": "Pfizer-BioNTech",
            "lot_number": "ABC456",
            "dose_number": 2,
            "date_administered": "2024-02-15",
            "site": "right deltoid",
            "route": "intramuscular",
            "notes": "Second dose - series complete"
        }

        second_response = client.post(
            "/api/v1/immunizations/",
            json=second_dose_data,
            headers=authenticated_headers
        )

        assert second_response.status_code == 201
        second_dose_id = second_response.json()["id"]

        # Verify both doses exist
        response = client.get(
            "/api/v1/immunizations/?vaccine_name=COVID-19 mRNA Vaccine",
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        
        # Verify series completion status
        doses = sorted(data, key=lambda x: x["dose_number"])
        assert doses[0]["series_complete"] is False
        assert doses[1]["series_complete"] is True

    def test_immunization_adverse_reaction_tracking(self, client: TestClient, user_with_patient, authenticated_headers):
        """Test tracking adverse reactions to immunizations."""
        immunization_data = {
            "patient_id": user_with_patient["patient"].id,
            "vaccine_name": "COVID-19 mRNA Vaccine",
            "manufacturer": "Pfizer-BioNTech",
            "dose_number": 1,
            "date_administered": "2024-01-15",
            "adverse_reactions": "Mild soreness at injection site, resolved within 24 hours",
            "notes": "Patient reported minor side effects, no serious adverse events"
        }

        response = client.post(
            "/api/v1/immunizations/",
            json=immunization_data,
            headers=authenticated_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["adverse_reactions"] == "Mild soreness at injection site, resolved within 24 hours"
        assert "no serious adverse events" in data["notes"]