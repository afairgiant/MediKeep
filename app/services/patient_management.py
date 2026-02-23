"""
Patient Management Service - Enhanced patient CRUD operations with V1 ownership
"""

from typing import List, Optional
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.models import User, Patient, PatientShare
from app.core.logging.config import get_logger, log_security_event
from app.services.patient_access import PatientAccessService
from app.core.utils.activity_tracker import activity_tracking_disabled_var

security_logger = get_logger(__name__, "security")

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
        missing_fields = [field for field in required_fields 
                         if field not in patient_data or not patient_data[field]]
        if missing_fields:
            raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")
        
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
            error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
            logger.error(f"Database integrity error: {error_msg}")
            
            if "unique" in error_msg.lower() or "duplicate" in error_msg.lower():
                raise ValueError("A patient with this information already exists")
            elif "foreign key" in error_msg.lower():
                raise ValueError("Invalid physician ID specified")
            else:
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
            error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
            logger.error(f"Database integrity error updating patient: {error_msg}")
            
            if "foreign key" in error_msg.lower():
                if "physician" in error_msg.lower():
                    raise ValueError("The specified physician does not exist")
                else:
                    raise ValueError("Invalid reference in patient update")
            elif "unique" in error_msg.lower() or "duplicate" in error_msg.lower():
                raise ValueError("This update would create a duplicate patient record")
            else:
                raise ValueError("Failed to update patient due to database constraint")
    
    def delete_patient(self, user: User, patient_id: int) -> bool:
        """
        Delete a patient record (only owner can delete)
        
        This method handles all foreign key constraints by:
        1. Clearing active_patient_id references in users table
        2. Removing patient sharing relationships  
        3. Deleting activity logs that reference this patient
        4. Deleting all associated medical records (cascaded via database)
        5. Finally deleting the patient record
        
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
            # Temporarily disable activity tracking to prevent new logs during deletion
            activity_tracking_disabled_var.set(True)
            # Step 1: Clear active_patient_id for any users who have this patient as active
            from app.models.models import User
            users_with_active_patient = self.db.query(User).filter(
                User.active_patient_id == patient_id
            ).all()
            
            for active_user in users_with_active_patient:
                logger.info(f"Clearing active_patient_id for user {active_user.id}")
                active_user.active_patient_id = None
                
            # Step 2: Remove patient sharing relationships
            from app.models.models import PatientShare
            sharing_records = self.db.query(PatientShare).filter(
                PatientShare.patient_id == patient_id
            ).all()
            
            for share in sharing_records:
                logger.info(f"Removing patient share: patient {patient_id} shared by {share.shared_by_user_id} with {share.shared_with_user_id}")
                self.db.delete(share)
            
            # Step 3: Delete activity logs that reference this patient
            from app.models import ActivityLog
            activity_logs = self.db.query(ActivityLog).filter(
                ActivityLog.patient_id == patient_id
            ).all()
            
            for log in activity_logs:
                logger.info(f"Removing activity log {log.id} for patient {patient_id}")
                self.db.delete(log)
            
            # Step 4: Delete the patient (medical records will be cascaded by database constraints)
            logger.info(f"Deleting patient {patient_id} and all associated medical records")
            self.db.delete(patient)
            
            # Commit all changes
            self.db.commit()
            
            # Ensure transaction is fully flushed and visible to other connections
            self.db.flush()
            
            logger.info(f"Successfully deleted patient {patient.id} and cleared all references")
            return True
            
        except IntegrityError as e:
            self.db.rollback()
            error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
            logger.error(f"Database integrity error during patient deletion: {error_msg}")
            
            if "foreign key" in error_msg.lower():
                raise ValueError("Cannot delete patient: there are still medical records associated with this patient")
            else:
                raise ValueError(f"Failed to delete patient due to database constraint")
        except Exception as e:
            self.db.rollback()
            logger.error(f"Unexpected error during patient deletion: {str(e)}")
            raise ValueError(f"Failed to delete patient: {str(e)}")
        finally:
            # Re-enable activity tracking
            activity_tracking_disabled_var.set(False)
    
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
        except ValueError:
            # Clear invalid active patient
            user.active_patient_id = None
            self.db.commit()
            return None
    
    def transfer_patient_ownership(
        self,
        patient_id: int,
        new_owner: User,
        admin_user: User,
    ) -> dict:
        """
        Transfer ownership of a patient record to a new user.

        If the patient is the original owner's self-record, a replacement
        self-record is created for the original owner with copied demographics.
        The original owner receives edit access via PatientShare.

        Args:
            patient_id: ID of the patient to transfer
            new_owner: The user receiving ownership
            admin_user: The admin performing the transfer

        Returns:
            Dict with transfer details

        Raises:
            ValueError: If patient not found or transfer not possible
        """
        logger.info(
            f"Admin {admin_user.id} transferring patient {patient_id} "
            f"to user {new_owner.id}"
        )

        patient = self.db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise ValueError("Patient not found")

        original_owner_id = patient.owner_user_id
        original_owner = self.db.query(User).filter(
            User.id == original_owner_id
        ).first()

        if not original_owner:
            raise ValueError("Original patient owner not found")

        was_self_record = patient.is_self_record or False
        replacement_patient_id = None

        try:
            # If the patient is the original owner's self-record, create a replacement
            if patient.is_self_record:
                demographic_fields = (
                    "first_name", "last_name", "birth_date", "gender",
                    "blood_type", "height", "weight", "address", "physician_id",
                )
                replacement_data = {
                    field: getattr(patient, field)
                    for field in demographic_fields
                    if getattr(patient, field) is not None
                }

                replacement = Patient(
                    owner_user_id=original_owner.id,
                    user_id=original_owner.id,
                    is_self_record=True,
                    **replacement_data,
                )
                self.db.add(replacement)
                self.db.flush()
                replacement_patient_id = replacement.id

                logger.info(
                    f"Created replacement self-record {replacement.id} "
                    f"for original owner {original_owner.id}"
                )

            # Transfer ownership to new user
            patient.owner_user_id = new_owner.id
            patient.user_id = new_owner.id
            patient.is_self_record = True

            # Set as new owner's active patient
            new_owner.active_patient_id = patient.id

            # Update original owner's active_patient_id if it pointed to transferred patient
            if original_owner.active_patient_id == patient_id:
                if replacement_patient_id:
                    original_owner.active_patient_id = replacement_patient_id
                else:
                    # Find another owned patient to set as active
                    other_patient = self.db.query(Patient).filter(
                        Patient.owner_user_id == original_owner.id,
                        Patient.id != patient_id,
                    ).first()
                    original_owner.active_patient_id = (
                        other_patient.id if other_patient else None
                    )

            # Create PatientShare giving original owner edit access
            # Handle the unique constraint: check for existing share first
            existing_share = self.db.query(PatientShare).filter(
                PatientShare.patient_id == patient_id,
                PatientShare.shared_with_user_id == original_owner.id,
            ).first()

            if existing_share:
                # Reactivate and update existing share
                existing_share.is_active = True
                existing_share.permission_level = "edit"
                existing_share.shared_by_user_id = new_owner.id
            else:
                new_share = PatientShare(
                    patient_id=patient_id,
                    shared_by_user_id=new_owner.id,
                    shared_with_user_id=original_owner.id,
                    permission_level="edit",
                    is_active=True,
                )
                self.db.add(new_share)

            self.db.commit()

            log_security_event(
                security_logger,
                event="patient_ownership_transferred",
                user_id=admin_user.id,
                message=(
                    f"Admin {admin_user.id} transferred patient {patient_id} "
                    f"from user {original_owner.id} to user {new_owner.id}"
                ),
            )

            return {
                "patient_id": patient_id,
                "new_owner_id": new_owner.id,
                "original_owner_id": original_owner.id,
                "was_self_record": was_self_record,
                "replacement_patient_id": replacement_patient_id,
                "original_owner_has_edit_access": True,
            }

        except IntegrityError as e:
            self.db.rollback()
            error_msg = str(e.orig) if hasattr(e, "orig") else str(e)
            logger.error(f"Database integrity error during transfer: {error_msg}")
            raise ValueError("Failed to transfer patient due to database constraint")
        except Exception as e:
            self.db.rollback()
            if isinstance(e, ValueError):
                raise
            logger.error(f"Unexpected error during patient transfer: {str(e)}")
            raise ValueError(f"Failed to transfer patient: {str(e)}")

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
        
        active_patient_id = None
        if user.active_patient_id is not None:
            try:
                active_patient_id = int(user.active_patient_id)
            except (ValueError, TypeError):
                logger.warning(f"Invalid active_patient_id for user {user.id}: {user.active_patient_id}")
                active_patient_id = None
        
        return {
            'owned_count': len(owned_patients),
            'accessible_count': len(accessible_patients),
            'has_self_record': any(p.is_self_record for p in owned_patients),
            'active_patient_id': active_patient_id,
            'sharing_stats': self.access_service.get_user_patient_count(user)
        }