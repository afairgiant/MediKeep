"""
Tests for Medication CRUD operations.
"""
import pytest
from datetime import date
from sqlalchemy.orm import Session

from app.crud.medication import medication as medication_crud
from app.crud.patient import patient as patient_crud
from app.models.models import Medication
from app.schemas.medication import MedicationCreate, MedicationUpdate
from app.schemas.patient import PatientCreate


class TestMedicationCRUD:
    """Test Medication CRUD operations."""

    @pytest.fixture
    def test_patient(self, db_session: Session, test_user):
        """Create a test patient for medication tests."""
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

    def test_create_medication(self, db_session: Session, test_patient):
        """Test creating a medication record."""
        medication_data = MedicationCreate(
            patient_id=test_patient.id,
            medication_name="Aspirin",
            dosage="100mg",
            frequency="once daily",
            route="oral",
            effective_period_start=date(2024, 1, 1),
            status="active"
        )
        
        medication = medication_crud.create(db_session, obj_in=medication_data)
        
        assert medication is not None
        assert medication.medication_name == "Aspirin"
        assert medication.dosage == "100mg"
        assert medication.frequency == "once daily"
        assert medication.route == "oral"
        assert medication.patient_id == test_patient.id
        assert medication.status == "active"

    def test_get_active_by_patient(self, db_session: Session, test_patient):
        """Test getting active medications for a patient."""
        # Create active medication
        active_medication = MedicationCreate(
            patient_id=test_patient.id,
            medication_name="Aspirin",
            dosage="100mg",
            frequency="once daily",
            route="oral",
            effective_period_start=date(2024, 1, 1),
            status="active"
        )
        
        # Create stopped medication
        inactive_medication = MedicationCreate(
            patient_id=test_patient.id,
            medication_name="Ibuprofen",
            dosage="200mg",
            frequency="twice daily",
            route="oral",
            effective_period_start=date(2024, 1, 1),
            status="stopped"
        )
        
        created_active = medication_crud.create(db_session, obj_in=active_medication)
        created_inactive = medication_crud.create(db_session, obj_in=inactive_medication)
        
        # Get active medications
        active_medications = medication_crud.get_active_by_patient(
            db_session, patient_id=test_patient.id
        )
        
        assert len(active_medications) == 1
        assert active_medications[0].id == created_active.id
        assert active_medications[0].medication_name == "Aspirin"
        assert active_medications[0].status == "active"

    def test_get_by_name(self, db_session: Session, test_patient):
        """Test searching medications by name."""
        # Create test medications
        medications = [
            MedicationCreate(
                patient_id=test_patient.id,
                medication_name="Aspirin",
                dosage="100mg",
                frequency="once daily",
                route="oral",
                effective_period_start=date(2024, 1, 1)
            ),
            MedicationCreate(
                patient_id=test_patient.id,
                medication_name="Ibuprofen",
                dosage="200mg",
                frequency="twice daily",
                route="oral",
                effective_period_start=date(2024, 1, 1)
            ),
            MedicationCreate(
                patient_id=test_patient.id,
                medication_name="Acetaminophen",
                dosage="500mg",
                frequency="as needed",
                route="oral",
                effective_period_start=date(2024, 1, 1)
            )
        ]
        
        for med_data in medications:
            medication_crud.create(db_session, obj_in=med_data)
        
        # Search for medications containing "in"
        results = medication_crud.get_by_name(db_session, name="in")
        
        assert len(results) == 2  # Aspirin and Acetaminophen
        medication_names = [med.medication_name for med in results]
        assert "Aspirin" in medication_names
        assert "Acetaminophen" in medication_names

    def test_activate_medication(self, db_session: Session, test_patient):
        """Test activating a medication."""
        # Create stopped medication
        medication_data = MedicationCreate(
            patient_id=test_patient.id,
            medication_name="Aspirin",
            dosage="100mg",
            frequency="once daily",
            route="oral",
            effective_period_start=date(2024, 1, 1),
            status="stopped"
        )
        
        created_medication = medication_crud.create(db_session, obj_in=medication_data)
        assert created_medication.status == "stopped"
        
        # Activate the medication
        activated_medication = medication_crud.activate(
            db_session, db_obj=created_medication
        )
        
        assert activated_medication.status == "active"
        assert activated_medication.id == created_medication.id

    def test_deactivate_medication(self, db_session: Session, test_patient):
        """Test deactivating a medication."""
        # Create active medication
        medication_data = MedicationCreate(
            patient_id=test_patient.id,
            medication_name="Aspirin",
            dosage="100mg",
            frequency="once daily",
            route="oral",
            effective_period_start=date(2024, 1, 1),
            status="active"
        )
        
        created_medication = medication_crud.create(db_session, obj_in=medication_data)
        assert created_medication.status == "active"
        
        # Deactivate the medication
        deactivated_medication = medication_crud.deactivate(
            db_session, db_obj=created_medication
        )
        
        assert deactivated_medication.status == "stopped"
        assert deactivated_medication.id == created_medication.id

    def test_update_medication(self, db_session: Session, test_patient):
        """Test updating a medication."""
        # Create medication
        medication_data = MedicationCreate(
            patient_id=test_patient.id,
            medication_name="Aspirin",
            dosage="100mg",
            frequency="once daily",
            route="oral",
            effective_period_start=date(2024, 1, 1),
            status="active"
        )
        
        created_medication = medication_crud.create(db_session, obj_in=medication_data)
        
        # Update medication
        update_data = MedicationUpdate(
            dosage="200mg",
            frequency="twice daily",
            indication="Increased dosage as per doctor's recommendation"
        )
        
        updated_medication = medication_crud.update(
            db_session, db_obj=created_medication, obj_in=update_data
        )
        
        assert updated_medication.dosage == "200mg"
        assert updated_medication.frequency == "twice daily"
        assert updated_medication.indication == "Increased dosage as per doctor's recommendation"
        assert updated_medication.medication_name == "Aspirin"  # Unchanged

    def test_delete_medication(self, db_session: Session, test_patient):
        """Test deleting a medication."""
        # Create medication
        medication_data = MedicationCreate(
            patient_id=test_patient.id,
            medication_name="Aspirin",
            dosage="100mg",
            frequency="once daily",
            route="oral",
            start_date="2024-01-01"
        )
        
        created_medication = medication_crud.create(db_session, obj_in=medication_data)
        medication_id = created_medication.id
        
        # Delete medication
        deleted_medication = medication_crud.delete(db_session, id=medication_id)
        
        assert deleted_medication is not None
        assert deleted_medication.id == medication_id
        
        # Verify medication is deleted
        retrieved_medication = medication_crud.get(db_session, id=medication_id)
        assert retrieved_medication is None

    def test_get_medications_with_pagination(self, db_session: Session, test_patient):
        """Test getting medications with pagination."""
        # Create multiple medications
        for i in range(5):
            medication_data = MedicationCreate(
                patient_id=test_patient.id,
                medication_name=f"Medication_{i}",
                dosage="100mg",
                frequency="once daily",
                route="oral",
                start_date="2024-01-01"
            )
            medication_crud.create(db_session, obj_in=medication_data)
        
        # Test pagination
        first_page = medication_crud.get_by_name(
            db_session, name="Medication", skip=0, limit=3
        )
        second_page = medication_crud.get_by_name(
            db_session, name="Medication", skip=3, limit=3
        )
        
        assert len(first_page) == 3
        assert len(second_page) == 2
        
        # Verify no overlap
        first_page_ids = {med.id for med in first_page}
        second_page_ids = {med.id for med in second_page}
        assert first_page_ids.isdisjoint(second_page_ids)