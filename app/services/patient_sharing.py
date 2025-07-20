"""
Patient Sharing Service - Individual patient sharing functionality
"""

from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.models import User, Patient, PatientShare
from app.core.logging_config import get_logger

logger = get_logger(__name__, "app")


class PatientSharingService:
    """Service for managing individual patient sharing"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def share_patient(
        self, 
        owner: User, 
        patient_id: int, 
        shared_with_user_id: int,
        permission_level: str,
        expires_at: Optional[datetime] = None,
        custom_permissions: Optional[dict] = None
    ) -> PatientShare:
        """
        Share a patient with another user
        
        Args:
            owner: The user who owns the patient
            patient_id: ID of the patient to share
            shared_with_user_id: ID of the user to share with
            permission_level: Level of access ('view', 'edit', 'full')
            expires_at: Optional expiration date
            custom_permissions: Optional custom permissions dict
            
        Returns:
            The created PatientShare object
        """
        logger.info(f"User {owner.id} sharing patient {patient_id} with user {shared_with_user_id}")
        
        # Validate permission level
        valid_permissions = ['view', 'edit', 'full']
        if permission_level not in valid_permissions:
            raise ValueError(f"Invalid permission level. Must be one of: {valid_permissions}")
        
        # Verify patient ownership
        patient = self.db.query(Patient).filter(
            Patient.id == patient_id,
            Patient.owner_user_id == owner.id
        ).first()
        
        if not patient:
            raise ValueError("Patient not found or not owned by user")
        
        # Verify target user exists
        target_user = self.db.query(User).filter(User.id == shared_with_user_id).first()
        if not target_user:
            raise ValueError("Target user not found")
        
        # Check if user is trying to share with themselves
        if owner.id == shared_with_user_id:
            raise ValueError("Cannot share patient with yourself")
        
        # Check if already shared
        existing_share = self.db.query(PatientShare).filter(
            PatientShare.patient_id == patient_id,
            PatientShare.shared_with_user_id == shared_with_user_id
        ).first()
        
        if existing_share:
            if existing_share.is_active:
                raise ValueError("Patient is already shared with this user")
            else:
                # Reactivate existing share
                existing_share.is_active = True
                existing_share.permission_level = permission_level
                existing_share.expires_at = expires_at
                existing_share.custom_permissions = custom_permissions
                self.db.commit()
                logger.info(f"Reactivated existing share {existing_share.id}")
                return existing_share
        
        # Create new share
        try:
            share = PatientShare(
                patient_id=patient_id,
                shared_by_user_id=owner.id,
                shared_with_user_id=shared_with_user_id,
                permission_level=permission_level,
                expires_at=expires_at,
                custom_permissions=custom_permissions,
                is_active=True
            )
            
            self.db.add(share)
            self.db.commit()
            self.db.refresh(share)
            
            logger.info(f"Created patient share {share.id}")
            return share
            
        except IntegrityError as e:
            self.db.rollback()
            logger.error(f"Database integrity error: {e}")
            raise ValueError("Failed to create patient share due to database constraint")
    
    def revoke_patient_share(self, owner: User, patient_id: int, shared_with_user_id: int) -> bool:
        """
        Revoke patient sharing access
        
        Args:
            owner: The user who owns the patient
            patient_id: ID of the patient
            shared_with_user_id: ID of the user to revoke access from
            
        Returns:
            True if share was revoked, False if no share existed
        """
        logger.info(f"User {owner.id} revoking patient {patient_id} access from user {shared_with_user_id}")
        
        # Verify ownership
        patient = self.db.query(Patient).filter(
            Patient.id == patient_id,
            Patient.owner_user_id == owner.id
        ).first()
        
        if not patient:
            raise ValueError("Patient not found or not owned by user")
        
        # Find and deactivate share
        share = self.db.query(PatientShare).filter(
            PatientShare.patient_id == patient_id,
            PatientShare.shared_with_user_id == shared_with_user_id,
            PatientShare.is_active == True
        ).first()
        
        if not share:
            logger.info("No active share found to revoke")
            return False
        
        share.is_active = False
        self.db.commit()
        
        logger.info(f"Revoked patient share {share.id}")
        return True
    
    def update_patient_share(
        self, 
        owner: User, 
        patient_id: int, 
        shared_with_user_id: int,
        permission_level: Optional[str] = None,
        expires_at: Optional[datetime] = None,
        custom_permissions: Optional[dict] = None
    ) -> PatientShare:
        """
        Update an existing patient share
        
        Args:
            owner: The user who owns the patient
            patient_id: ID of the patient
            shared_with_user_id: ID of the user with access
            permission_level: New permission level (optional)
            expires_at: New expiration date (optional)
            custom_permissions: New custom permissions (optional)
            
        Returns:
            The updated PatientShare object
        """
        logger.info(f"User {owner.id} updating patient {patient_id} share for user {shared_with_user_id}")
        
        # Verify ownership
        patient = self.db.query(Patient).filter(
            Patient.id == patient_id,
            Patient.owner_user_id == owner.id
        ).first()
        
        if not patient:
            raise ValueError("Patient not found or not owned by user")
        
        # Find existing share
        share = self.db.query(PatientShare).filter(
            PatientShare.patient_id == patient_id,
            PatientShare.shared_with_user_id == shared_with_user_id,
            PatientShare.is_active == True
        ).first()
        
        if not share:
            raise ValueError("No active share found to update")
        
        # Update fields if provided
        if permission_level is not None:
            valid_permissions = ['view', 'edit', 'full']
            if permission_level not in valid_permissions:
                raise ValueError(f"Invalid permission level. Must be one of: {valid_permissions}")
            share.permission_level = permission_level
        
        if expires_at is not None:
            share.expires_at = expires_at
        
        if custom_permissions is not None:
            share.custom_permissions = custom_permissions
        
        self.db.commit()
        self.db.refresh(share)
        
        logger.info(f"Updated patient share {share.id}")
        return share
    
    def get_patient_shares(self, owner: User, patient_id: int) -> List[PatientShare]:
        """
        Get all active shares for a patient
        
        Args:
            owner: The user who owns the patient
            patient_id: ID of the patient
            
        Returns:
            List of active PatientShare objects
        """
        # Verify ownership
        patient = self.db.query(Patient).filter(
            Patient.id == patient_id,
            Patient.owner_user_id == owner.id
        ).first()
        
        if not patient:
            raise ValueError("Patient not found or not owned by user")
        
        shares = self.db.query(PatientShare).filter(
            PatientShare.patient_id == patient_id,
            PatientShare.is_active == True
        ).all()
        
        return shares
    
    def get_shares_by_user(self, user: User) -> dict:
        """
        Get sharing statistics for a user
        
        Args:
            user: The user to get stats for
            
        Returns:
            Dict with sharing statistics
        """
        # Shares I've created (patients I've shared with others)
        shared_by_me = self.db.query(PatientShare).filter(
            PatientShare.shared_by_user_id == user.id,
            PatientShare.is_active == True
        ).count()
        
        # Shares I've received (patients shared with me)
        shared_with_me = self.db.query(PatientShare).filter(
            PatientShare.shared_with_user_id == user.id,
            PatientShare.is_active == True
        ).count()
        
        return {
            'shared_by_me': shared_by_me,
            'shared_with_me': shared_with_me
        }
    
    def cleanup_expired_shares(self) -> int:
        """
        Clean up expired patient shares
        
        Returns:
            Number of shares that were deactivated
        """
        logger.info("Cleaning up expired patient shares")
        
        expired_shares = self.db.query(PatientShare).filter(
            PatientShare.expires_at < datetime.now(),
            PatientShare.is_active == True
        ).all()
        
        count = 0
        for share in expired_shares:
            share.is_active = False
            count += 1
        
        self.db.commit()
        logger.info(f"Deactivated {count} expired patient shares")
        return count
    
    def remove_user_access(self, user: User, patient_id: int) -> bool:
        """
        Remove a user's access to a shared patient
        
        This allows users to remove themselves from patient shares they have received.
        The user must have received access to this patient (not be the owner).
        
        Args:
            user: The user removing their own access
            patient_id: ID of the patient to remove access from
            
        Returns:
            True if access was removed, False if no active share found
        """
        logger.info(f"User {user.id} removing their own access to patient {patient_id}")
        
        # Check if user is the owner (they cannot remove their own ownership)
        patient = self.db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise ValueError("Patient not found")
        
        if patient.owner_user_id == user.id:
            raise ValueError("Cannot remove access to patients you own")
        
        # Find active share where user is the recipient
        share = self.db.query(PatientShare).filter(
            PatientShare.patient_id == patient_id,
            PatientShare.shared_with_user_id == user.id,
            PatientShare.is_active == True
        ).first()
        
        if not share:
            logger.warning(f"No active share found for user {user.id} to patient {patient_id}")
            return False
        
        # Deactivate the share
        share.is_active = False
        self.db.commit()
        
        logger.info(f"Removed user {user.id} access to patient {patient_id} (share {share.id})")
        return True