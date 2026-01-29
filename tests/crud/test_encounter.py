"""
Tests for Encounter CRUD operations.
"""
import pytest
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.crud.encounter import encounter as encounter_crud
from app.crud.patient import patient as patient_crud
from app.models.models import Encounter
from app.schemas.encounter import EncounterCreate, EncounterUpdate
from app.schemas.patient import PatientCreate


class TestEncounterCRUD:
    """Test Encounter CRUD operations."""

    @pytest.fixture
    def test_patient(self, db_session: Session, test_user):
        """Create a test patient for encounter tests."""
        patient_data = PatientCreate(
            first_name="John",
            last_name="Doe",
            birth_date=date(1990, 1, 1),
            gender="M",
            address="123 Main St"
        )
        return patient_crud.create_for_user(
            db_session, user_id=test_user.id, patient_data=patient_data
        )

    def test_create_encounter(self, db_session: Session, test_patient):
        """Test creating an encounter record."""
        encounter_data = EncounterCreate(
            patient_id=test_patient.id,
            reason="Annual checkup",
            date=date(2024, 1, 15),
            visit_type="routine",
            chief_complaint="General wellness check",
            notes="Patient in good health"
        )

        encounter = encounter_crud.create(db_session, obj_in=encounter_data)

        assert encounter is not None
        assert encounter.reason == "Annual checkup"
        assert encounter.date == date(2024, 1, 15)
        assert encounter.visit_type == "routine"
        assert encounter.chief_complaint == "General wellness check"
        assert encounter.patient_id == test_patient.id

    def test_get_encounter(self, db_session: Session, test_patient):
        """Test getting an encounter by ID."""
        encounter_data = EncounterCreate(
            patient_id=test_patient.id,
            reason="Follow-up visit",
            date=date(2024, 1, 20)
        )

        created_encounter = encounter_crud.create(db_session, obj_in=encounter_data)

        retrieved = encounter_crud.get(db_session, id=created_encounter.id)

        assert retrieved is not None
        assert retrieved.id == created_encounter.id
        assert retrieved.reason == "Follow-up visit"

    def test_get_recent_encounters(self, db_session: Session, test_patient):
        """Test getting recent encounters for a patient."""
        today = date.today()

        # Create encounters with different dates
        dates = [
            today - timedelta(days=5),   # Recent (within 30 days)
            today - timedelta(days=15),  # Recent (within 30 days)
            today - timedelta(days=45),  # Old (outside 30 days)
        ]

        for i, enc_date in enumerate(dates):
            encounter_data = EncounterCreate(
                patient_id=test_patient.id,
                reason=f"Visit {i+1}",
                date=enc_date
            )
            encounter_crud.create(db_session, obj_in=encounter_data)

        # Get encounters from last 30 days
        recent_encounters = encounter_crud.get_recent(
            db_session, patient_id=test_patient.id, days=30
        )

        assert len(recent_encounters) == 2
        # Should be ordered by date descending (most recent first)
        assert recent_encounters[0].date > recent_encounters[1].date

    def test_get_recent_encounters_custom_days(self, db_session: Session, test_patient):
        """Test getting recent encounters with custom days parameter."""
        today = date.today()

        # Create encounters
        dates = [
            today - timedelta(days=3),
            today - timedelta(days=10),
            today - timedelta(days=20),
        ]

        for i, enc_date in enumerate(dates):
            encounter_data = EncounterCreate(
                patient_id=test_patient.id,
                reason=f"Visit {i+1}",
                date=enc_date
            )
            encounter_crud.create(db_session, obj_in=encounter_data)

        # Get encounters from last 7 days
        recent_encounters = encounter_crud.get_recent(
            db_session, patient_id=test_patient.id, days=7
        )

        assert len(recent_encounters) == 1
        assert recent_encounters[0].reason == "Visit 1"

    def test_get_recent_encounters_empty(self, db_session: Session, test_patient):
        """Test getting recent encounters when none exist."""
        today = date.today()

        # Create only old encounters
        encounter_data = EncounterCreate(
            patient_id=test_patient.id,
            reason="Old visit",
            date=today - timedelta(days=60)
        )
        encounter_crud.create(db_session, obj_in=encounter_data)

        recent_encounters = encounter_crud.get_recent(
            db_session, patient_id=test_patient.id, days=30
        )

        assert len(recent_encounters) == 0

    def test_update_encounter(self, db_session: Session, test_patient):
        """Test updating an encounter."""
        encounter_data = EncounterCreate(
            patient_id=test_patient.id,
            reason="Initial reason",
            date=date(2024, 1, 15),
            notes="Initial notes"
        )

        created_encounter = encounter_crud.create(db_session, obj_in=encounter_data)

        update_data = EncounterUpdate(
            reason="Updated reason",
            diagnosis="Common cold",
            treatment_plan="Rest and fluids"
        )

        updated_encounter = encounter_crud.update(
            db_session, db_obj=created_encounter, obj_in=update_data
        )

        assert updated_encounter.reason == "Updated reason"
        assert updated_encounter.diagnosis == "Common cold"
        assert updated_encounter.treatment_plan == "Rest and fluids"
        assert updated_encounter.notes == "Initial notes"  # Unchanged

    def test_delete_encounter(self, db_session: Session, test_patient):
        """Test deleting an encounter."""
        encounter_data = EncounterCreate(
            patient_id=test_patient.id,
            reason="To be deleted",
            date=date(2024, 1, 15)
        )

        created_encounter = encounter_crud.create(db_session, obj_in=encounter_data)
        encounter_id = created_encounter.id

        deleted_encounter = encounter_crud.delete(db_session, id=encounter_id)

        assert deleted_encounter is not None
        assert deleted_encounter.id == encounter_id

        # Verify it's deleted
        retrieved = encounter_crud.get(db_session, id=encounter_id)
        assert retrieved is None

    def test_encounter_with_all_fields(self, db_session: Session, test_patient):
        """Test creating an encounter with all optional fields."""
        encounter_data = EncounterCreate(
            patient_id=test_patient.id,
            reason="Comprehensive checkup",
            date=date(2024, 2, 1),
            notes="Detailed notes here",
            visit_type="comprehensive",
            chief_complaint="Multiple concerns",
            diagnosis="Healthy with minor issues",
            treatment_plan="Follow-up in 3 months",
            follow_up_instructions="Schedule next appointment",
            duration_minutes=45,
            location="Main clinic",
            priority="normal"
        )

        encounter = encounter_crud.create(db_session, obj_in=encounter_data)

        assert encounter.visit_type == "comprehensive"
        assert encounter.diagnosis == "Healthy with minor issues"
        assert encounter.duration_minutes == 45
        assert encounter.location == "Main clinic"
        assert encounter.priority == "normal"

    def test_multiple_patients_recent_encounters(self, db_session: Session, test_user, test_admin_user):
        """Test that get_recent returns only encounters for specific patient."""
        # Create two patients (each under a different user due to one-patient-per-user constraint)
        patient1_data = PatientCreate(
            first_name="Patient",
            last_name="One",
            birth_date=date(1990, 1, 1),
            gender="M",
            address="123 Test St"
        )
        patient2_data = PatientCreate(
            first_name="Patient",
            last_name="Two",
            birth_date=date(1985, 5, 15),
            gender="F",
            address="456 Test Ave"
        )

        patient1 = patient_crud.create_for_user(
            db_session, user_id=test_user.id, patient_data=patient1_data
        )
        patient2 = patient_crud.create_for_user(
            db_session, user_id=test_admin_user.id, patient_data=patient2_data
        )

        today = date.today()

        # Create encounters for patient 1
        for i in range(3):
            encounter_data = EncounterCreate(
                patient_id=patient1.id,
                reason=f"Patient 1 Visit {i+1}",
                date=today - timedelta(days=i)
            )
            encounter_crud.create(db_session, obj_in=encounter_data)

        # Create encounters for patient 2
        for i in range(2):
            encounter_data = EncounterCreate(
                patient_id=patient2.id,
                reason=f"Patient 2 Visit {i+1}",
                date=today - timedelta(days=i)
            )
            encounter_crud.create(db_session, obj_in=encounter_data)

        # Get recent encounters for patient 1 only
        patient1_encounters = encounter_crud.get_recent(
            db_session, patient_id=patient1.id, days=30
        )

        assert len(patient1_encounters) == 3
        assert all(e.patient_id == patient1.id for e in patient1_encounters)

        # Get recent encounters for patient 2 only
        patient2_encounters = encounter_crud.get_recent(
            db_session, patient_id=patient2.id, days=30
        )

        assert len(patient2_encounters) == 2
        assert all(e.patient_id == patient2.id for e in patient2_encounters)
