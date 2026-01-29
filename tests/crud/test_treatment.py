"""
Tests for Treatment CRUD operations.
"""
import pytest
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.crud.treatment import treatment as treatment_crud
from app.crud.patient import patient as patient_crud
from app.crud.condition import condition as condition_crud
from app.models.models import Treatment
from app.schemas.treatment import TreatmentCreate, TreatmentUpdate
from app.schemas.patient import PatientCreate
from app.schemas.condition import ConditionCreate


class TestTreatmentCRUD:
    """Test Treatment CRUD operations."""

    @pytest.fixture
    def test_patient(self, db_session: Session, test_user):
        """Create a test patient for treatment tests."""
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

    @pytest.fixture
    def test_condition(self, db_session: Session, test_patient):
        """Create a test condition for treatment tests."""
        condition_data = ConditionCreate(
            patient_id=test_patient.id,
            name="Hypertension",
            diagnosis="Essential hypertension",
            diagnosis_date=date(2023, 1, 1),
            status="active"
        )
        return condition_crud.create(db_session, obj_in=condition_data)

    def test_create_treatment(self, db_session: Session, test_patient, test_condition):
        """Test creating a treatment."""
        treatment_data = TreatmentCreate(
            patient_id=test_patient.id,
            condition_id=test_condition.id,
            treatment_name="Blood Pressure Medication",
            treatment_type="medication",
            start_date=date(2023, 1, 15),
            frequency="Daily",
            status="active",
            notes="Monitor blood pressure weekly"
        )

        treatment = treatment_crud.create(db_session, obj_in=treatment_data)

        assert treatment is not None
        assert treatment.treatment_name == "Blood Pressure Medication"
        assert treatment.treatment_type == "medication"
        assert treatment.status == "active"
        assert treatment.patient_id == test_patient.id
        assert treatment.condition_id == test_condition.id

    def test_get_by_condition(self, db_session: Session, test_patient, test_condition):
        """Test getting treatments by condition."""
        # Create treatments for the condition
        treatments_data = [
            TreatmentCreate(
                patient_id=test_patient.id,
                condition_id=test_condition.id,
                treatment_name="Treatment 1",
                treatment_type="medication",
                start_date=date(2023, 1, 1),
                status="active"
            ),
            TreatmentCreate(
                patient_id=test_patient.id,
                condition_id=test_condition.id,
                treatment_name="Treatment 2",
                treatment_type="therapy",
                start_date=date(2023, 2, 1),
                status="active"
            ),
            TreatmentCreate(
                patient_id=test_patient.id,
                treatment_name="Unrelated Treatment",
                treatment_type="other",
                start_date=date(2023, 3, 1),
                status="active"
            )  # No condition_id
        ]

        for treat_data in treatments_data:
            treatment_crud.create(db_session, obj_in=treat_data)

        treatments = treatment_crud.get_by_condition(
            db_session, condition_id=test_condition.id
        )

        assert len(treatments) == 2
        assert all(t.condition_id == test_condition.id for t in treatments)

    def test_get_active_treatments(self, db_session: Session, test_patient):
        """Test getting active treatments for a patient."""
        treatments_data = [
            TreatmentCreate(
                patient_id=test_patient.id,
                treatment_name="Active Treatment 1",
                treatment_type="medication",
                start_date=date(2023, 1, 1),
                status="active"
            ),
            TreatmentCreate(
                patient_id=test_patient.id,
                treatment_name="Active Treatment 2",
                treatment_type="therapy",
                start_date=date(2023, 2, 1),
                status="active"
            ),
            TreatmentCreate(
                patient_id=test_patient.id,
                treatment_name="Completed Treatment",
                treatment_type="procedure",
                start_date=date(2023, 1, 1),
                end_date=date(2023, 3, 1),
                status="completed"
            )
        ]

        for treat_data in treatments_data:
            treatment_crud.create(db_session, obj_in=treat_data)

        active_treatments = treatment_crud.get_active_treatments(
            db_session, patient_id=test_patient.id
        )

        assert len(active_treatments) == 2
        assert all(t.status == "active" for t in active_treatments)

    def test_get_ongoing_treatments(self, db_session: Session, test_patient):
        """Test getting ongoing treatments (active with no end date or future end date)."""
        today = date.today()

        treatments_data = [
            TreatmentCreate(
                patient_id=test_patient.id,
                treatment_name="Ongoing Treatment 1",
                treatment_type="medication",
                start_date=date(2023, 1, 1),
                end_date=None,  # No end date
                status="active"
            ),
            TreatmentCreate(
                patient_id=test_patient.id,
                treatment_name="Ongoing Treatment 2",
                treatment_type="therapy",
                start_date=date(2023, 2, 1),
                end_date=today + timedelta(days=30),  # Future end date
                status="active"
            ),
            TreatmentCreate(
                patient_id=test_patient.id,
                treatment_name="Ended Treatment",
                treatment_type="procedure",
                start_date=date(2023, 1, 1),
                end_date=today - timedelta(days=10),  # Past end date
                status="active"
            )
        ]

        for treat_data in treatments_data:
            treatment_crud.create(db_session, obj_in=treat_data)

        ongoing_treatments = treatment_crud.get_ongoing(
            db_session, patient_id=test_patient.id
        )

        assert len(ongoing_treatments) == 2
        treatment_names = [t.treatment_name for t in ongoing_treatments]
        assert "Ongoing Treatment 1" in treatment_names
        assert "Ongoing Treatment 2" in treatment_names
        assert "Ended Treatment" not in treatment_names

    def test_get_ongoing_excludes_inactive(self, db_session: Session, test_patient):
        """Test that get_ongoing excludes inactive treatments."""
        treatments_data = [
            TreatmentCreate(
                patient_id=test_patient.id,
                treatment_name="Active Ongoing",
                treatment_type="medication",
                start_date=date(2023, 1, 1),
                status="active"
            ),
            TreatmentCreate(
                patient_id=test_patient.id,
                treatment_name="Cancelled Treatment",
                treatment_type="medication",
                start_date=date(2023, 1, 1),
                status="cancelled"
            )
        ]

        for treat_data in treatments_data:
            treatment_crud.create(db_session, obj_in=treat_data)

        ongoing = treatment_crud.get_ongoing(db_session, patient_id=test_patient.id)

        assert len(ongoing) == 1
        assert ongoing[0].treatment_name == "Active Ongoing"

    def test_update_treatment(self, db_session: Session, test_patient):
        """Test updating a treatment."""
        treatment_data = TreatmentCreate(
            patient_id=test_patient.id,
            treatment_name="Original Treatment",
            treatment_type="medication",
            start_date=date(2023, 1, 1),
            status="active"
        )
        created = treatment_crud.create(db_session, obj_in=treatment_data)

        update_data = TreatmentUpdate(
            treatment_name="Updated Treatment",
            frequency="Twice daily",
            notes="Dosage adjusted"
        )

        updated = treatment_crud.update(
            db_session, db_obj=created, obj_in=update_data
        )

        assert updated.treatment_name == "Updated Treatment"
        assert updated.frequency == "Twice daily"
        assert updated.notes == "Dosage adjusted"
        assert updated.status == "active"  # Unchanged

    def test_delete_treatment(self, db_session: Session, test_patient):
        """Test deleting a treatment."""
        treatment_data = TreatmentCreate(
            patient_id=test_patient.id,
            treatment_name="To Delete",
            treatment_type="test",
            start_date=date(2023, 1, 1),
            status="active"
        )
        created = treatment_crud.create(db_session, obj_in=treatment_data)
        treatment_id = created.id

        deleted = treatment_crud.delete(db_session, id=treatment_id)

        assert deleted is not None
        assert deleted.id == treatment_id

        # Verify deleted
        retrieved = treatment_crud.get(db_session, id=treatment_id)
        assert retrieved is None

    def test_treatment_with_all_fields(self, db_session: Session, test_patient):
        """Test creating treatment with all optional fields."""
        treatment_data = TreatmentCreate(
            patient_id=test_patient.id,
            treatment_name="Comprehensive Treatment",
            treatment_type="Combination Therapy",
            description="Multi-modal treatment approach",
            start_date=date(2023, 1, 1),
            end_date=date(2023, 12, 31),
            frequency="Weekly",
            treatment_category="outpatient",
            outcome="Expected full recovery",
            location="Main Hospital",
            dosage="50mg",
            notes="Monitor side effects",
            status="active"
        )

        treatment = treatment_crud.create(db_session, obj_in=treatment_data)

        assert treatment.description == "Multi-modal treatment approach"
        assert treatment.treatment_category == "outpatient"
        assert treatment.outcome == "Expected full recovery"
        assert treatment.location == "Main Hospital"
        assert treatment.dosage == "50mg"

    def test_multiple_patients_isolation(self, db_session: Session, test_user, test_admin_user):
        """Test that treatments are properly isolated per patient."""
        # Create two patients (each under a different user)
        patient1_data = PatientCreate(
            first_name="Patient", last_name="One",
            birth_date=date(1990, 1, 1), gender="M", address="123 St"
        )
        patient2_data = PatientCreate(
            first_name="Patient", last_name="Two",
            birth_date=date(1985, 1, 1), gender="F", address="456 Ave"
        )

        patient1 = patient_crud.create_for_user(
            db_session, user_id=test_user.id, patient_data=patient1_data
        )
        patient2 = patient_crud.create_for_user(
            db_session, user_id=test_admin_user.id, patient_data=patient2_data
        )

        # Create treatments for each patient
        for i in range(3):
            treatment_data = TreatmentCreate(
                patient_id=patient1.id,
                treatment_name=f"Patient1 Treatment {i+1}",
                treatment_type="test",
                start_date=date(2023, 1, 1),
                status="active"
            )
            treatment_crud.create(db_session, obj_in=treatment_data)

        for i in range(2):
            treatment_data = TreatmentCreate(
                patient_id=patient2.id,
                treatment_name=f"Patient2 Treatment {i+1}",
                treatment_type="test",
                start_date=date(2023, 1, 1),
                status="active"
            )
            treatment_crud.create(db_session, obj_in=treatment_data)

        patient1_treatments = treatment_crud.get_active_treatments(
            db_session, patient_id=patient1.id
        )
        patient2_treatments = treatment_crud.get_active_treatments(
            db_session, patient_id=patient2.id
        )

        assert len(patient1_treatments) == 3
        assert len(patient2_treatments) == 2
        assert all(t.patient_id == patient1.id for t in patient1_treatments)
        assert all(t.patient_id == patient2.id for t in patient2_treatments)
