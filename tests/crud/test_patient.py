"""
Tests for Patient CRUD operations.
"""
import pytest
from datetime import date
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.models.models import Patient
from app.schemas.patient import PatientCreate, PatientUpdate


class TestPatientCRUD:
    """Test Patient CRUD operations."""

    def test_create_patient_for_user(self, db_session: Session, test_user):
        """Test creating a patient record for a user."""
        patient_data = PatientCreate(
            first_name="John",
            last_name="Doe",
            birth_date=date(1990, 1, 1),
            gender="M",
            address="123 Main St"
        )
        
        patient = patient_crud.create_for_user(
            db_session, user_id=test_user.id, patient_data=patient_data
        )
        
        assert patient is not None
        assert patient.first_name == "John"
        assert patient.last_name == "Doe"
        assert patient.user_id == test_user.id
        assert str(patient.birth_date) == "1990-01-01"
        assert patient.gender == "M"

    def test_create_duplicate_patient_for_user_fails(self, db_session: Session, test_user):
        """Test that creating a second patient for the same user fails."""
        patient_data = PatientCreate(
            first_name="John",
            last_name="Doe",
            birth_date=date(1990, 1, 1),
            gender="M",
            address="123 Main St",
        )
        
        # Create first patient
        patient_crud.create_for_user(
            db_session, user_id=test_user.id, patient_data=patient_data
        )
        
        # Try to create second patient - should fail
        with pytest.raises(ValueError, match="User already has a patient record"):
            patient_crud.create_for_user(
                db_session, user_id=test_user.id, patient_data=patient_data
            )

    def test_get_by_user_id(self, db_session: Session, test_user):
        """Test retrieving patient by user ID."""
        patient_data = PatientCreate(
            first_name="John",
            last_name="Doe",
            birth_date=date(1990, 1, 1),
            gender="M",
            address="123 Main St",
        )
        
        created_patient = patient_crud.create_for_user(
            db_session, user_id=test_user.id, patient_data=patient_data
        )
        
        retrieved_patient = patient_crud.get_by_user_id(
            db_session, user_id=test_user.id
        )
        
        assert retrieved_patient is not None
        assert retrieved_patient.id == created_patient.id
        assert retrieved_patient.first_name == "John"

    def test_get_by_user_id_nonexistent(self, db_session: Session):
        """Test retrieving patient by nonexistent user ID."""
        result = patient_crud.get_by_user_id(db_session, user_id=999)
        assert result is None

    def test_is_user_already_patient(self, db_session: Session, test_user):
        """Test checking if user already has a patient record."""
        # Initially should be False
        assert patient_crud.is_user_already_patient(db_session, user_id=test_user.id) is False
        
        # Create patient
        patient_data = PatientCreate(
            first_name="John",
            last_name="Doe",
            birth_date=date(1990, 1, 1),
            gender="M",
            address="123 Main St",
        )
        
        patient_crud.create_for_user(
            db_session, user_id=test_user.id, patient_data=patient_data
        )
        
        # Now should be True
        assert patient_crud.is_user_already_patient(db_session, user_id=test_user.id) is True

    def test_update_for_user(self, db_session: Session, test_user):
        """Test updating patient record for a user."""
        # Create patient
        patient_data = PatientCreate(
            first_name="John",
            last_name="Doe",
            birth_date=date(1990, 1, 1),
            gender="M",
            address="123 Main St",
        )
        
        patient_crud.create_for_user(
            db_session, user_id=test_user.id, patient_data=patient_data
        )
        
        # Update patient
        update_data = PatientUpdate(
            address="456 New St"
        )
        
        updated_patient = patient_crud.update_for_user(
            db_session, user_id=test_user.id, patient_data=update_data
        )
        
        assert updated_patient is not None
        assert updated_patient.address == "456 New St"
        assert updated_patient.first_name == "John"  # Unchanged

    def test_update_for_user_nonexistent(self, db_session: Session, test_user):
        """Test updating patient for user with no patient record."""
        update_data = PatientUpdate(address="456 New St")
        
        result = patient_crud.update_for_user(
            db_session, user_id=test_user.id, patient_data=update_data
        )
        
        assert result is None

    def test_delete_for_user(self, db_session: Session, test_user):
        """Test deleting patient record for a user."""
        # Create patient
        patient_data = PatientCreate(
            first_name="John",
            last_name="Doe",
            birth_date=date(1990, 1, 1),
            gender="M",
            address="123 Main St",
        )
        
        created_patient = patient_crud.create_for_user(
            db_session, user_id=test_user.id, patient_data=patient_data
        )
        
        # Delete patient
        deleted_patient = patient_crud.delete_for_user(
            db_session, user_id=test_user.id
        )
        
        assert deleted_patient is not None
        assert deleted_patient.id == created_patient.id
        
        # Verify patient is deleted
        retrieved_patient = patient_crud.get_by_user_id(
            db_session, user_id=test_user.id
        )
        assert retrieved_patient is None

    def test_delete_for_user_nonexistent(self, db_session: Session, test_user):
        """Test deleting patient for user with no patient record."""
        result = patient_crud.delete_for_user(db_session, user_id=test_user.id)
        assert result is None

    def test_get_with_user(self, db_session: Session, test_user):
        """Test retrieving patient with user relationship loaded."""
        # Create patient
        patient_data = PatientCreate(
            first_name="John",
            last_name="Doe",
            birth_date=date(1990, 1, 1),
            gender="M",
            address="123 Main St",
        )
        
        created_patient = patient_crud.create_for_user(
            db_session, user_id=test_user.id, patient_data=patient_data
        )
        
        # Get patient with user relationship
        patient_with_user = patient_crud.get_with_user(
            db_session, patient_id=created_patient.id
        )
        
        assert patient_with_user is not None
        assert patient_with_user.user is not None
        assert patient_with_user.user.id == test_user.id
        assert patient_with_user.user.username == test_user.username

    def test_get_with_medical_records(self, db_session: Session, test_user):
        """Test retrieving patient with medical records loaded."""
        # Create patient
        patient_data = PatientCreate(
            first_name="John",
            last_name="Doe",
            birth_date=date(1990, 1, 1),
            gender="M",
            address="123 Main St",
        )
        
        created_patient = patient_crud.create_for_user(
            db_session, user_id=test_user.id, patient_data=patient_data
        )
        
        # Get patient with medical records
        patient_with_records = patient_crud.get_with_medical_records(
            db_session, patient_id=created_patient.id
        )
        
        assert patient_with_records is not None
        assert patient_with_records.id == created_patient.id
        # These should be empty lists initially but accessible without additional queries
        assert hasattr(patient_with_records, 'medications')
        assert hasattr(patient_with_records, 'encounters')
        assert hasattr(patient_with_records, 'lab_results')
        assert hasattr(patient_with_records, 'immunizations')
        assert hasattr(patient_with_records, 'conditions')
        assert hasattr(patient_with_records, 'procedures')
        assert hasattr(patient_with_records, 'treatments')