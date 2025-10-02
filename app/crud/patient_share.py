"""
CRUD operations for patient sharing

This module provides backward compatibility for legacy code that uses
crud.patient_share. New code should use PatientAccessService directly.
"""

from typing import Optional
from sqlalchemy.orm import Session
from app.models.models import Patient, User, PatientShare


class CRUDPatientShare:
    """
    CRUD operations for patient sharing.

    NOTE: This is a compatibility shim. New code should use
    app.services.patient_access.PatientAccessService for comprehensive
    access control logic.
    """

    def user_has_access(self, db: Session, patient_id: int, user_id: int) -> bool:
        """
        Check if a user has access to a patient through sharing.

        Uses the unified PatientAccessService for consistent access control.

        Args:
            db: Database session
            patient_id: ID of the patient to check
            user_id: ID of the user to check access for

        Returns:
            True if user has access to the patient, False otherwise
        """
        from app.services.patient_access import PatientAccessService

        # Get the patient and user objects
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        user = db.query(User).filter(User.id == user_id).first()

        if not patient or not user:
            return False

        # Use the comprehensive access service
        access_service = PatientAccessService(db)
        return access_service.can_access_patient(user, patient, permission='view')

    def get_share(
        self, db: Session, patient_id: int, user_id: int
    ) -> Optional[PatientShare]:
        """
        Get an active patient share for a specific user.

        Args:
            db: Database session
            patient_id: ID of the patient
            user_id: ID of the user who has been shared with

        Returns:
            PatientShare object if found, None otherwise
        """
        return db.query(PatientShare).filter(
            PatientShare.patient_id == patient_id,
            PatientShare.shared_with_user_id == user_id,
            PatientShare.is_active == True
        ).first()


# Create singleton instance
patient_share = CRUDPatientShare()
