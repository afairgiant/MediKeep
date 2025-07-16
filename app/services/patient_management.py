"""
Patient Management Service - Enhanced patient CRUD operations with V1 ownership
"""

from typing import List, Optional
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.models import User, Patient
from app.core.logging_config import get_logger
from app.services.patient_access import PatientAccessService

logger = get_logger(__name__, "app")


class PatientManagementService:
    """Service for managing patient records with ownership validation"""
    
    def __init__(self, db: Session):
        self.db = db
        self.access_service = PatientAccessService(db)
    
    def create_patient(
        self, 
        user: User, 
        patient_data: dict, 
        is_self_record: bool = False
    ) -> Patient:
        """
        Create a new patient record
        
        Args:
            user: The user creating the patient
            patient_data: Patient information dict
            is_self_record: Whether this is the user's own medical record
            
        Returns:
            The created Patient object
        """
        logger.info(f"User {user.id} creating patient record (self: {is_self_record})")
        
        # Validate required fields
        required_fields = ['first_name', 'last_name', 'birth_date']
        for field in required_fields:
            if field not in patient_data or not patient_data[field]:
                raise ValueError(f"Missing required field: {field}")
        
        # Validate birth_date
        if isinstance(patient_data['birth_date'], str):
            try:
                patient_data['birth_date'] = datetime.strptime(patient_data['birth_date'], '%Y-%m-%d').date()
            except ValueError:
                raise ValueError("Invalid birth_date format. Use YYYY-MM-DD")
        
        # Validate birth_date is not in the future
        if patient_data['birth_date'] > date.today():
            raise ValueError("Birth date cannot be in the future")
        
        # If user is creating their own record, check if they already have one
        if is_self_record:
            existing_self_record = self.db.query(Patient).filter(
                Patient.owner_user_id == user.id,
                Patient.is_self_record == True
            ).first()
            
            if existing_self_record:
                raise ValueError("User already has a self-record. Only one self-record per user is allowed.")
        
        try:
            # Remove is_self_record from patient_data to avoid duplicate parameter
            clean_patient_data = {k: v for k, v in patient_data.items() if k != 'is_self_record'}
            
            # Create patient with ownership
            patient = Patient(
                owner_user_id=user.id,
                user_id=user.id,  # For backward compatibility
                is_self_record=is_self_record,
                **clean_patient_data
            )
            
            self.db.add(patient)
            self.db.commit()
            self.db.refresh(patient)
            
            logger.info(f"Created patient {patient.id} for user {user.id}")
            return patient
            
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Database integrity error: {e}")
            raise ValueError("Failed to create patient due to database constraint")
    
    def get_patient(self, user: User, patient_id: int) -> Patient:
        """
        Get a patient by ID with access control
        
        Args:
            user: The user requesting the patient
            patient_id: ID of the patient
            
        Returns:
            The Patient object
        """
        patient = self.db.query(Patient).filter(Patient.id == patient_id).first()
        
        if not patient:
            raise ValueError("Patient not found")
        
        # Check access
        if not self.access_service.can_access_patient(user, patient, 'view'):
            raise ValueError("You don't have permission to view this patient")
        
        return patient
    
    def update_patient(
        self, 
        user: User, 
        patient_id: int, 
        patient_data: dict
    ) -> Patient:
        """
        Update a patient record
        
        Args:
            user: The user updating the patient
            patient_id: ID of the patient to update
            patient_data: Updated patient information
            
        Returns:
            The updated Patient object
        """
        logger.info(f"User {user.id} updating patient {patient_id}")
        
        patient = self.db.query(Patient).filter(Patient.id == patient_id).first()
        
        if not patient:
            raise ValueError("Patient not found")
        
        # Check edit permission
        if not self.access_service.can_access_patient(user, patient, 'edit'):
            raise ValueError("You don't have permission to edit this patient")
        
        # Validate birth_date if provided
        if 'birth_date' in patient_data:
            if isinstance(patient_data['birth_date'], str):
                try:
                    patient_data['birth_date'] = datetime.strptime(patient_data['birth_date'], '%Y-%m-%d').date()
                except ValueError:
                    raise ValueError("Invalid birth_date format. Use YYYY-MM-DD")
            
            if patient_data['birth_date'] > date.today():
                raise ValueError("Birth date cannot be in the future")
        
        # Update allowed fields
        updatable_fields = [
            'first_name', 'last_name', 'birth_date', 'gender', 'blood_type',
            'height', 'weight', 'address', 'physician_id'
        ]
        
        for field, value in patient_data.items():
            if field in updatable_fields:
                setattr(patient, field, value)
        
        try:
            self.db.commit()
            self.db.refresh(patient)
            
            logger.info(f"Updated patient {patient.id}")
            return patient
            
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Database integrity error: {e}")
            raise ValueError("Failed to update patient due to database constraint")
    
    def delete_patient(self, user: User, patient_id: int) -> bool:
        """
        Delete a patient record (only owner can delete)
        
        Args:
            user: The user deleting the patient
            patient_id: ID of the patient to delete
            
        Returns:
            True if deleted successfully
        """
        logger.info(f"User {user.id} deleting patient {patient_id}")
        
        patient = self.db.query(Patient).filter(Patient.id == patient_id).first()
        
        if not patient:
            raise ValueError("Patient not found")
        
        # Only owner can delete
        if patient.owner_user_id != user.id:
            raise ValueError("Only the patient owner can delete this record")
        
        try:
            self.db.delete(patient)
            self.db.commit()
            
            logger.info(f"Deleted patient {patient.id}")
            return True
            
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Database integrity error: {e}")
            raise ValueError("Failed to delete patient due to database constraint")
    
    def get_user_patients(self, user: User) -> List[Patient]:
        """
        Get all patients accessible to a user
        
        Args:
            user: The user requesting patients
            
        Returns:
            List of accessible Patient objects
        """
        return self.access_service.get_accessible_patients(user)
    
    def get_owned_patients(self, user: User) -> List[Patient]:
        """
        Get all patients owned by a user
        
        Args:
            user: The user
            
        Returns:
            List of owned Patient objects
        """
        patients = self.db.query(Patient).filter(
            Patient.owner_user_id == user.id
        ).all()
        
        return patients
    
    def get_self_record(self, user: User) -> Optional[Patient]:
        """
        Get the user's self-record patient
        
        Args:
            user: The user
            
        Returns:
            The user's self-record Patient object or None
        """
        return self.db.query(Patient).filter(
            Patient.owner_user_id == user.id,
            Patient.is_self_record == True
        ).first()
    
    def switch_active_patient(self, user: User, patient_id: int) -> Patient:
        """
        Switch the user's active patient context (Netflix-style switching)
        
        Args:
            user: The user switching context
            patient_id: ID of the patient to switch to
            
        Returns:
            The Patient object that was switched to
        """
        logger.info(f"User {user.id} switching to patient {patient_id}")
        
        # Verify access to the patient
        patient = self.get_patient(user, patient_id)
        
        # Update user's active patient
        user.active_patient_id = patient_id
        self.db.commit()
        
        logger.info(f"User {user.id} switched to patient {patient_id}")
        return patient
    
    def get_active_patient(self, user: User) -> Optional[Patient]:
        """
        Get the user's currently active patient
        
        Args:
            user: The user
            
        Returns:
            The active Patient object or None
        """
        if not user.active_patient_id:
            return None
        
        try:
            return self.get_patient(user, user.active_patient_id)
        except (ValueError, ValueError):
            # Clear invalid active patient
            user.active_patient_id = None
            self.db.commit()
            return None
    
    def get_patient_statistics(self, user: User) -> dict:
        """
        Get statistics about the user's patients
        
        Args:
            user: The user to get statistics for
            
        Returns:
            Dict with patient statistics
        """
        owned_patients = self.get_owned_patients(user)
        accessible_patients = self.get_user_patients(user)
        
        return {
            'owned_count': len(owned_patients),
            'accessible_count': len(accessible_patients),
            'has_self_record': any(p.is_self_record for p in owned_patients),
            'active_patient_id': int(user.active_patient_id) if user.active_patient_id else None,
            'sharing_stats': self.access_service.get_user_patient_count(user)
        }