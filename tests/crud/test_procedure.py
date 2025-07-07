"""
Tests for Procedure CRUD operations.
"""
import pytest
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.crud.procedure import procedure as procedure_crud
from app.crud.patient import patient as patient_crud
from app.crud.practitioner import practitioner as practitioner_crud
from app.models.models import Procedure
from app.schemas.procedure import ProcedureCreate, ProcedureUpdate
from app.schemas.patient import PatientCreate
from app.schemas.practitioner import PractitionerCreate


class TestProcedureCRUD:
    """Test Procedure CRUD operations."""

    @pytest.fixture
    def test_patient(self, db_session: Session, test_user):
        """Create a test patient for procedure tests."""
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
    def test_practitioner(self, db_session: Session):
        """Create a test practitioner for procedure tests."""
        practitioner_data = PractitionerCreate(
            name="Dr. Sarah Smith",
            specialty="Surgery",
            practice="City Medical Center",
            phone_number="555-555-0123"
        )
        return practitioner_crud.create(db_session, obj_in=practitioner_data)

    def test_create_procedure(self, db_session: Session, test_patient, test_practitioner):
        """Test creating a procedure record."""
        procedure_data = ProcedureCreate(
            patient_id=test_patient.id,
            procedure_name="Appendectomy",
            procedure_type="surgical",
            procedure_code="44970",
            description="Laparoscopic appendectomy",
            date=date(2024, 1, 15),
            status="completed",
            facility="City Medical Center",
            procedure_setting="inpatient",
            procedure_duration=120,
            practitioner_id=test_practitioner.id,
            anesthesia_type="general"
        )
        
        procedure = procedure_crud.create(db_session, obj_in=procedure_data)
        
        assert procedure is not None
        assert procedure.procedure_name == "Appendectomy"
        assert procedure.procedure_type == "surgical"
        assert procedure.procedure_code == "44970"
        assert procedure.description == "Laparoscopic appendectomy"
        assert procedure.date == date(2024, 1, 15)
        assert procedure.status == "completed"
        assert procedure.facility == "City Medical Center"
        assert procedure.procedure_setting == "inpatient"
        assert procedure.procedure_duration == 120
        assert procedure.patient_id == test_patient.id
        assert procedure.practitioner_id == test_practitioner.id
        assert procedure.anesthesia_type == "general"

    def test_get_scheduled_procedures(self, db_session: Session, test_patient, test_practitioner):
        """Test getting scheduled procedures."""
        # Create scheduled procedure (using past date due to schema validation)
        scheduled_procedure = ProcedureCreate(
            patient_id=test_patient.id,
            procedure_name="Colonoscopy",
            procedure_type="diagnostic",
            date=date.today() - timedelta(days=1),
            status="scheduled",
            practitioner_id=test_practitioner.id
        )
        
        # Create completed procedure
        completed_procedure = ProcedureCreate(
            patient_id=test_patient.id,
            procedure_name="Blood Test",
            procedure_type="diagnostic",
            date=date(2024, 1, 1),
            status="completed",
            practitioner_id=test_practitioner.id
        )
        
        created_scheduled = procedure_crud.create(db_session, obj_in=scheduled_procedure)
        created_completed = procedure_crud.create(db_session, obj_in=completed_procedure)
        
        # Get scheduled procedures
        scheduled_procedures = procedure_crud.get_scheduled(db_session)
        
        assert len(scheduled_procedures) == 1
        assert scheduled_procedures[0].id == created_scheduled.id
        assert scheduled_procedures[0].procedure_name == "Colonoscopy"
        assert scheduled_procedures[0].status == "scheduled"

    def test_get_scheduled_procedures_by_patient(self, db_session: Session, test_patient, test_practitioner, test_user):
        """Test getting scheduled procedures filtered by patient."""
        # Create another user and patient
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate
        
        user_data = UserCreate(
            username="testuser2",
            email="test2@example.com", 
            password="testpass123",
            full_name="Test User 2",
            role="user"
        )
        other_user = user_crud.create(db_session, obj_in=user_data)
        
        patient_data = PatientCreate(
            first_name="Jane",
            last_name="Smith",
            birth_date=date(1985, 5, 15),
            gender="F",
            address="456 Oak Ave"
        )
        other_patient = patient_crud.create_for_user(
            db_session, user_id=other_user.id, patient_data=patient_data
        )
        
        # Create scheduled procedures for different patients (using past dates)
        procedure1_data = ProcedureCreate(
            patient_id=test_patient.id,
            procedure_name="MRI Scan",
            procedure_type="diagnostic",
            date=date.today() - timedelta(days=5),
            status="scheduled",
            practitioner_id=test_practitioner.id
        )
        
        procedure2_data = ProcedureCreate(
            patient_id=other_patient.id,
            procedure_name="X-Ray",
            procedure_type="diagnostic",
            date=date.today() - timedelta(days=3),
            status="scheduled",
            practitioner_id=test_practitioner.id
        )
        
        created_procedure1 = procedure_crud.create(db_session, obj_in=procedure1_data)
        procedure_crud.create(db_session, obj_in=procedure2_data)
        
        # Get scheduled procedures for specific patient
        patient_procedures = procedure_crud.get_scheduled(
            db_session, patient_id=test_patient.id
        )
        
        assert len(patient_procedures) == 1
        assert patient_procedures[0].id == created_procedure1.id
        assert patient_procedures[0].patient_id == test_patient.id

    def test_get_recent_procedures(self, db_session: Session, test_patient, test_practitioner):
        """Test getting recent procedures for a patient."""
        # Create procedures at different dates
        recent_procedure = ProcedureCreate(
            patient_id=test_patient.id,
            procedure_name="Blood Test",
            procedure_type="diagnostic",
            date=date.today() - timedelta(days=30),
            status="completed",
            practitioner_id=test_practitioner.id
        )
        
        old_procedure = ProcedureCreate(
            patient_id=test_patient.id,
            procedure_name="Old Checkup",
            procedure_type="diagnostic",
            date=date.today() - timedelta(days=120),
            status="completed",
            practitioner_id=test_practitioner.id
        )
        
        created_recent = procedure_crud.create(db_session, obj_in=recent_procedure)
        procedure_crud.create(db_session, obj_in=old_procedure)
        
        # Get recent procedures (within 90 days)
        recent_procedures = procedure_crud.get_recent(
            db_session, patient_id=test_patient.id, days=90
        )
        
        assert len(recent_procedures) == 1
        assert recent_procedures[0].id == created_recent.id
        assert recent_procedures[0].procedure_name == "Blood Test"

    def test_update_procedure(self, db_session: Session, test_patient, test_practitioner):
        """Test updating a procedure."""
        # Create procedure
        procedure_data = ProcedureCreate(
            patient_id=test_patient.id,
            procedure_name="Endoscopy",
            procedure_type="diagnostic",
            date=date(2024, 1, 10),
            status="scheduled",
            practitioner_id=test_practitioner.id
        )
        
        created_procedure = procedure_crud.create(db_session, obj_in=procedure_data)
        
        # Update procedure
        update_data = ProcedureUpdate(
            status="completed",
            notes="Procedure completed successfully",
            procedure_duration=45,
            procedure_complications="None"
        )
        
        updated_procedure = procedure_crud.update(
            db_session, db_obj=created_procedure, obj_in=update_data
        )
        
        assert updated_procedure.status == "completed"
        assert updated_procedure.notes == "Procedure completed successfully"
        assert updated_procedure.procedure_duration == 45
        assert updated_procedure.procedure_complications == "None"
        assert updated_procedure.procedure_name == "Endoscopy"  # Unchanged

    def test_delete_procedure(self, db_session: Session, test_patient, test_practitioner):
        """Test deleting a procedure."""
        # Create procedure
        procedure_data = ProcedureCreate(
            patient_id=test_patient.id,
            procedure_name="Skin Biopsy",
            procedure_type="diagnostic",
            date=date(2024, 1, 5),
            status="completed",
            practitioner_id=test_practitioner.id
        )
        
        created_procedure = procedure_crud.create(db_session, obj_in=procedure_data)
        procedure_id = created_procedure.id
        
        # Delete procedure
        deleted_procedure = procedure_crud.delete(db_session, id=procedure_id)
        
        assert deleted_procedure is not None
        assert deleted_procedure.id == procedure_id
        
        # Verify procedure is deleted
        retrieved_procedure = procedure_crud.get(db_session, id=procedure_id)
        assert retrieved_procedure is None

    def test_procedure_status_validation(self, db_session: Session, test_patient, test_practitioner):
        """Test procedure status validation."""
        # Test valid status
        valid_procedure = ProcedureCreate(
            patient_id=test_patient.id,
            procedure_name="CT Scan",
            procedure_type="diagnostic",
            date=date(2024, 1, 1),
            status="completed",
            practitioner_id=test_practitioner.id
        )
        
        procedure = procedure_crud.create(db_session, obj_in=valid_procedure)
        assert procedure.status == "completed"
        
        # Test status normalization (should convert to lowercase)
        procedure_data = ProcedureCreate(
            patient_id=test_patient.id,
            procedure_name="Ultrasound",
            procedure_type="diagnostic",
            date=date(2024, 1, 2),
            status="SCHEDULED",
            practitioner_id=test_practitioner.id
        )
        
        procedure = procedure_crud.create(db_session, obj_in=procedure_data)
        assert procedure.status == "scheduled"

    def test_procedure_date_ordering(self, db_session: Session, test_patient, test_practitioner):
        """Test that scheduled procedures are ordered by date ascending."""
        # Create procedures with different dates (using past dates)
        procedure1_data = ProcedureCreate(
            patient_id=test_patient.id,
            procedure_name="Procedure 1",
            procedure_type="diagnostic",
            date=date.today() - timedelta(days=10),
            status="scheduled",
            practitioner_id=test_practitioner.id
        )
        
        procedure2_data = ProcedureCreate(
            patient_id=test_patient.id,
            procedure_name="Procedure 2",
            procedure_type="diagnostic",
            date=date.today() - timedelta(days=15),
            status="scheduled",
            practitioner_id=test_practitioner.id
        )
        
        procedure3_data = ProcedureCreate(
            patient_id=test_patient.id,
            procedure_name="Procedure 3",
            procedure_type="diagnostic",
            date=date.today() - timedelta(days=5),
            status="scheduled",
            practitioner_id=test_practitioner.id
        )
        
        procedure_crud.create(db_session, obj_in=procedure1_data)
        procedure_crud.create(db_session, obj_in=procedure2_data)
        procedure_crud.create(db_session, obj_in=procedure3_data)
        
        # Get scheduled procedures - should be ordered by date ascending
        scheduled_procedures = procedure_crud.get_scheduled(db_session)
        
        assert len(scheduled_procedures) == 3
        assert scheduled_procedures[0].procedure_name == "Procedure 2"  # Earliest date (-15 days)
        assert scheduled_procedures[1].procedure_name == "Procedure 1"  # Middle date (-10 days)
        assert scheduled_procedures[2].procedure_name == "Procedure 3"  # Latest date (-5 days)

    def test_procedure_with_anesthesia_details(self, db_session: Session, test_patient, test_practitioner):
        """Test creating procedure with anesthesia details."""
        procedure_data = ProcedureCreate(
            patient_id=test_patient.id,
            procedure_name="Knee Surgery",
            procedure_type="surgical",
            procedure_code="27447",
            date=date(2024, 1, 20),
            status="completed",
            facility="Surgery Center",
            procedure_setting="outpatient",
            procedure_duration=180,
            practitioner_id=test_practitioner.id,
            anesthesia_type="spinal",
            anesthesia_notes="Patient tolerated spinal anesthesia well"
        )
        
        procedure = procedure_crud.create(db_session, obj_in=procedure_data)
        
        assert procedure.anesthesia_type == "spinal"
        assert procedure.anesthesia_notes == "Patient tolerated spinal anesthesia well"
        assert procedure.procedure_name == "Knee Surgery"
        assert procedure.procedure_duration == 180

    def test_procedure_with_complications(self, db_session: Session, test_patient, test_practitioner):
        """Test creating and updating procedure with complications."""
        # Create procedure
        procedure_data = ProcedureCreate(
            patient_id=test_patient.id,
            procedure_name="Gallbladder Surgery",
            procedure_type="surgical",
            date=date(2024, 1, 25),
            status="completed",
            practitioner_id=test_practitioner.id
        )
        
        created_procedure = procedure_crud.create(db_session, obj_in=procedure_data)
        
        # Update with complications
        update_data = ProcedureUpdate(
            procedure_complications="Minor bleeding during procedure, resolved",
            notes="Patient recovered well despite minor complication"
        )
        
        updated_procedure = procedure_crud.update(
            db_session, db_obj=created_procedure, obj_in=update_data
        )
        
        assert updated_procedure.procedure_complications == "Minor bleeding during procedure, resolved"
        assert updated_procedure.notes == "Patient recovered well despite minor complication"

    def test_get_procedures_with_pagination(self, db_session: Session, test_patient, test_practitioner):
        """Test getting procedures with pagination using base query method."""
        # Create multiple procedures
        for i in range(5):
            procedure_data = ProcedureCreate(
                patient_id=test_patient.id,
                procedure_name=f"Procedure {i}",
                procedure_type="diagnostic",
                date=date(2024, 1, i + 1),
                status="completed",
                practitioner_id=test_practitioner.id
            )
            procedure_crud.create(db_session, obj_in=procedure_data)
        
        # Test pagination using base query method
        first_page = procedure_crud.query(
            db_session, 
            filters={"patient_id": test_patient.id},
            skip=0, 
            limit=3
        )
        second_page = procedure_crud.query(
            db_session, 
            filters={"patient_id": test_patient.id},
            skip=3, 
            limit=3
        )
        
        assert len(first_page) == 3
        assert len(second_page) == 2
        
        # Verify no overlap
        first_page_ids = {proc.id for proc in first_page}
        second_page_ids = {proc.id for proc in second_page}
        assert first_page_ids.isdisjoint(second_page_ids)