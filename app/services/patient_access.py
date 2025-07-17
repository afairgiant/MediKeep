"""
Patient Access Service - Unified access control logic for all phases
"""

from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models.models import User, Patient, PatientShare
from app.core.logging_config import get_logger

logger = get_logger(__name__, "app")


class PatientAccessService:
    """Unified service for patient access across all phases"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_accessible_patients(self, user: User, permission: str = 'view') -> List[Patient]:
        """
        Get all patients accessible to a user across all contexts
        
        Args:
            user: The user requesting access
            permission: Required permission level ('view', 'edit', 'full')
            
        Returns:
            List of patients the user can access
        """
        logger.info(f"Getting accessible patients for user {user.id} with permission '{permission}'")
        
        accessible_patients = []
        
        # 1. Own patients (always accessible)
        own_patients = self.db.query(Patient).filter(
            Patient.owner_user_id == user.id
        ).all()
        accessible_patients.extend(own_patients)
        logger.info(f"Found {len(own_patients)} owned patients")
        
        # 2. Individually shared patients (Phase 1)
        shared_patients = self._get_individually_shared_patients(user, permission)
        accessible_patients.extend(shared_patients)
        logger.info(f"Found {len(shared_patients)} individually shared patients")
        
        # 3. Family patients (Phase 2+ - will be implemented later)
        # family_patients = self._get_family_patients(user, permission)
        # accessible_patients.extend(family_patients)
        
        # Remove duplicates and return
        unique_patients = list({p.id: p for p in accessible_patients}.values())
        logger.info(f"Total accessible patients: {len(unique_patients)}")
        return unique_patients
    
    def can_access_patient(self, user: User, patient: Patient, permission: str = 'view') -> bool:
        """
        Check if user can access a specific patient
        
        Args:
            user: The user requesting access
            patient: The patient to check access for
            permission: Required permission level ('view', 'edit', 'full')
            
        Returns:
            True if user can access patient, False otherwise
        """
        logger.debug(f"Checking access for user {user.id} to patient {patient.id} with permission '{permission}'")
        
        # 1. Owner always has access
        if patient.owner_user_id == user.id:
            logger.debug("Access granted: User is owner")
            return True
        
        # 2. Check privacy level (Phase 3+ feature, but basic check)
        if patient.privacy_level == 'private':
            logger.debug("Access denied: Patient is private")
            return False
        
        # 3. Check individual sharing (Phase 1)
        if self._check_individual_sharing(user, patient, permission):
            logger.debug("Access granted: Individual sharing")
            return True
        
        # 4. Check family context (Phase 2+ - will be implemented later)
        # if patient.family_id and self._check_family_access(user, patient, permission):
        #     logger.debug("Access granted: Family access")
        #     return True
        
        logger.debug("Access denied: No valid access path found")
        return False
    
    def get_patient_context(self, user: User, patient: Patient) -> dict:
        """
        Get context information about how user can access this patient
        
        Args:
            user: The user requesting access
            patient: The patient to get context for
            
        Returns:
            Dict with context information
        """
        context = {
            'patient_id': patient.id,
            'user_id': user.id,
            'is_owner': patient.owner_user_id == user.id,
            'access_type': None,
            'permission_level': None,
            'is_self_record': patient.is_self_record and patient.owner_user_id == user.id,
            'privacy_level': patient.privacy_level
        }
        
        if context['is_owner']:
            context['access_type'] = 'owner'
            context['permission_level'] = 'full'
        else:
            # Check individual sharing
            share = self.db.query(PatientShare).filter(
                PatientShare.patient_id == patient.id,
                PatientShare.shared_with_user_id == user.id,
                PatientShare.is_active == True
            ).first()
            
            if share:
                context['access_type'] = 'individual_share'
                context['permission_level'] = share.permission_level
                context['expires_at'] = share.expires_at
            # Future: Add family context check here
        
        return context
    
    def _get_individually_shared_patients(self, user: User, permission: str) -> List[Patient]:
        """Get patients shared individually with the user"""
        logger.debug(f"Getting individually shared patients for user {user.id}")
        
        # Get active shares with the user
        shares = self.db.query(PatientShare).filter(
            PatientShare.shared_with_user_id == user.id,
            PatientShare.is_active == True
        ).all()
        
        accessible_patients = []
        for share in shares:
            if self._check_individual_sharing(user, share.patient, permission):
                accessible_patients.append(share.patient)
        
        return accessible_patients
    
    def _check_individual_sharing(self, user: User, patient: Patient, permission: str) -> bool:
        """Check if user has individual sharing access to patient"""
        share = self.db.query(PatientShare).filter(
            PatientShare.patient_id == patient.id,
            PatientShare.shared_with_user_id == user.id,
            PatientShare.is_active == True
        ).first()
        
        if not share:
            return False
        
        # Check expiration
        if share.expires_at and share.expires_at < datetime.now():
            logger.debug(f"Share expired for patient {patient.id}")
            return False
        
        # Check permission level
        permission_hierarchy = {'view': 1, 'edit': 2, 'full': 3}
        user_level = permission_hierarchy.get(share.permission_level, 0)
        required_level = permission_hierarchy.get(permission, 0)
        
        return user_level >= required_level
    
    def get_user_patient_count(self, user: User) -> dict:
        """
        Get counts of different types of patients for a user
        
        Returns:
            Dict with patient counts
        """
        owned_count = self.db.query(Patient).filter(
            Patient.owner_user_id == user.id
        ).count()
        
        shared_count = self.db.query(PatientShare).filter(
            PatientShare.shared_with_user_id == user.id,
            PatientShare.is_active == True
        ).count()
        
        return {
            'owned': owned_count,
            'shared_with_me': shared_count,
            'total_accessible': owned_count + shared_count
        }