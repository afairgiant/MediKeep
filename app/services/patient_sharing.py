"""
Patient Sharing Service - Individual patient sharing functionality
"""

from typing import List, Optional, Dict
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_, cast
import sqlalchemy as sa

from app.models.models import User, Patient, PatientShare, Invitation
from app.core.datetime_utils import get_utc_now
from app.core.logging_config import get_logger
from app.services.invitation_service import InvitationService
from app.exceptions.patient_sharing import (
    PatientNotFoundError,
    AlreadySharedError,
    PendingInvitationError,
    RecipientNotFoundError,
    InvalidPermissionLevelError,
    ShareNotFoundError,
    SelfShareError,
)

logger = get_logger(__name__, "app")

# Configuration constants for bulk operations
MAX_BULK_PATIENTS = 50  # Maximum patients in single bulk operation
BULK_OPERATION_TIMEOUT_SECONDS = 30  # Query timeout for bulk operations


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
        logger.info("Creating patient share", extra={
            "user_id": owner.id,
            "patient_id": patient_id,
            "shared_with_user_id": shared_with_user_id,
            "component": "patient_sharing"
        })
        
        # Validate permission level
        valid_permissions = ['view', 'edit', 'full']
        if permission_level not in valid_permissions:
            raise InvalidPermissionLevelError(f"Invalid permission level. Must be one of: {valid_permissions}")

        # Verify patient ownership
        patient = self.db.query(Patient).filter(
            Patient.id == patient_id,
            Patient.owner_user_id == owner.id
        ).first()

        if not patient:
            raise PatientNotFoundError("Patient not found or not owned by user")

        # Verify target user exists
        target_user = self.db.query(User).filter(User.id == shared_with_user_id).first()
        if not target_user:
            raise RecipientNotFoundError("Target user not found")

        # Check if user is trying to share with themselves
        if owner.id == shared_with_user_id:
            raise SelfShareError("Cannot share patient with yourself")
        
        # Check if already shared
        existing_share = self.db.query(PatientShare).filter(
            PatientShare.patient_id == patient_id,
            PatientShare.shared_with_user_id == shared_with_user_id
        ).first()
        
        if existing_share:
            if existing_share.is_active:
                raise AlreadySharedError("Patient is already shared with this user")
            else:
                # Reactivate existing share
                existing_share.is_active = True
                existing_share.permission_level = permission_level
                existing_share.expires_at = expires_at
                existing_share.custom_permissions = custom_permissions
                self.db.commit()
                logger.info("Reactivated existing share", extra={
                    "share_id": existing_share.id,
                    "component": "patient_sharing"
                })
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
            
            logger.info("Patient share created", extra={
                "share_id": share.id,
                "component": "patient_sharing"
            })
            return share
            
        except IntegrityError as e:
            self.db.rollback()
            logger.error("Database integrity error", extra={
                "error": str(e),
                "component": "patient_sharing"
            })
            raise ValueError("Failed to create patient share due to database constraint")
    
    def revoke_patient_share(self, owner: User, patient_id: int, shared_with_user_id: int) -> bool:
        """
        Revoke patient sharing access
        NOW: Also updates invitation status to 'revoked' if invitation exists

        Args:
            owner: The user who owns the patient
            patient_id: ID of the patient
            shared_with_user_id: ID of the user to revoke access from

        Returns:
            True if share was revoked, False if no share existed
        """
        logger.info("Revoking patient access", extra={
            "user_id": owner.id,
            "patient_id": patient_id,
            "revoked_from_user_id": shared_with_user_id,
            "component": "patient_sharing"
        })

        # Verify ownership
        patient = self.db.query(Patient).filter(
            Patient.id == patient_id,
            Patient.owner_user_id == owner.id
        ).first()

        if not patient:
            raise PatientNotFoundError("Patient not found or not owned by user")

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

        # NEW: Update invitation status if it exists
        if share.invitation_id:
            invitation = self.db.query(Invitation).filter(
                Invitation.id == share.invitation_id
            ).first()

            if invitation and invitation.status == 'accepted':
                invitation.status = 'revoked'
                invitation.updated_at = get_utc_now()
                logger.info("Updated invitation status to revoked", extra={
                    "invitation_id": invitation.id,
                    "component": "patient_sharing"
                })

        self.db.commit()

        logger.info("Revoked patient share", extra={
            "share_id": share.id,
            "component": "patient_sharing"
        })
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
        logger.info("Updating patient share", extra={
            "user_id": owner.id,
            "patient_id": patient_id,
            "shared_with_user_id": shared_with_user_id,
            "component": "patient_sharing"
        })
        
        # Verify ownership
        patient = self.db.query(Patient).filter(
            Patient.id == patient_id,
            Patient.owner_user_id == owner.id
        ).first()
        
        if not patient:
            raise PatientNotFoundError("Patient not found or not owned by user")
        
        # Find existing share
        share = self.db.query(PatientShare).filter(
            PatientShare.patient_id == patient_id,
            PatientShare.shared_with_user_id == shared_with_user_id,
            PatientShare.is_active == True
        ).first()
        
        if not share:
            raise ShareNotFoundError("No active share found to update")
        
        # Update fields if provided
        if permission_level is not None:
            valid_permissions = ['view', 'edit', 'full']
            if permission_level not in valid_permissions:
                raise InvalidPermissionLevelError(f"Invalid permission level. Must be one of: {valid_permissions}")
            share.permission_level = permission_level
        
        if expires_at is not None:
            share.expires_at = expires_at
        
        if custom_permissions is not None:
            share.custom_permissions = custom_permissions
        
        self.db.commit()
        self.db.refresh(share)

        logger.info("Updated patient share", extra={
            "share_id": share.id,
            "component": "patient_sharing"
        })
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
            raise PatientNotFoundError("Patient not found or not owned by user")
        
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
            PatientShare.expires_at < get_utc_now(),
            PatientShare.is_active == True
        ).all()
        
        count = 0
        for share in expired_shares:
            share.is_active = False
            count += 1
        
        self.db.commit()
        logger.info("Deactivated expired patient shares", extra={
            "count": count,
            "component": "patient_sharing"
        })
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
        logger.info("User removing own access to patient", extra={
            "user_id": user.id,
            "patient_id": patient_id,
            "component": "patient_sharing"
        })
        
        # Check if user is the owner (they cannot remove their own ownership)
        patient = self.db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise PatientNotFoundError("Patient not found")
        
        if patient.owner_user_id == user.id:
            raise ValueError("Cannot remove access to patients you own")
        
        # Find active share where user is the recipient
        share = self.db.query(PatientShare).filter(
            PatientShare.patient_id == patient_id,
            PatientShare.shared_with_user_id == user.id,
            PatientShare.is_active == True
        ).first()
        
        if not share:
            logger.warning("No active share found for user", extra={
                "user_id": user.id,
                "patient_id": patient_id,
                "component": "patient_sharing"
            })
            return False

        # Deactivate the share
        share.is_active = False
        self.db.commit()

        logger.info("Removed user access to patient", extra={
            "user_id": user.id,
            "patient_id": patient_id,
            "share_id": share.id,
            "component": "patient_sharing"
        })
        return True

    def send_patient_share_invitation(
        self,
        owner: User,
        patient_id: int,
        shared_with_identifier: str,
        permission_level: str,
        expires_at: Optional[datetime] = None,
        custom_permissions: Optional[dict] = None,
        message: Optional[str] = None,
        expires_hours: Optional[int] = 168
    ) -> Invitation:
        """
        Send invitation to share patient record

        Args:
            owner: User who owns the patient
            patient_id: ID of patient to share
            shared_with_identifier: Username or email of recipient
            permission_level: 'view', 'edit', or 'full'
            expires_at: Optional share expiration date
            custom_permissions: Optional custom permissions dict
            message: Optional message to recipient
            expires_hours: Hours until invitation expires (default: 7 days)

        Returns:
            Created Invitation object

        Raises:
            ValueError: If validation fails
        """
        logger.info("Sending patient share invitation", extra={
            "user_id": owner.id,
            "patient_id": patient_id,
            "component": "patient_sharing"
        })

        # Validate permission level
        valid_permissions = ['view', 'edit', 'full']
        if permission_level not in valid_permissions:
            raise InvalidPermissionLevelError(f"Invalid permission level. Must be one of: {valid_permissions}")

        # Verify patient ownership
        patient = self.db.query(Patient).filter(
            Patient.id == patient_id,
            Patient.owner_user_id == owner.id
        ).first()

        if not patient:
            raise PatientNotFoundError("Patient not found or not owned by user")

        # Find recipient user
        recipient = self.db.query(User).filter(
            or_(User.username == shared_with_identifier,
                User.email == shared_with_identifier)
        ).first()

        if not recipient:
            raise RecipientNotFoundError("Recipient user not found")

        if recipient.id == owner.id:
            raise SelfShareError("Cannot share patient with yourself")

        # Check for existing active shares
        existing_share = self.db.query(PatientShare).filter(
            PatientShare.patient_id == patient_id,
            PatientShare.shared_with_user_id == recipient.id,
            PatientShare.is_active == True
        ).first()

        if existing_share:
            raise AlreadySharedError("Patient already shared with this user")

        # Check for existing pending invitations using database-level JSON filtering
        existing_invitation = self.db.query(Invitation).filter(
            Invitation.invitation_type == 'patient_share',
            Invitation.sent_by_user_id == owner.id,
            Invitation.sent_to_user_id == recipient.id,
            Invitation.status == 'pending',
            sa.func.json_extract(Invitation.context_data, '$.patient_id').cast(sa.Integer) == patient_id
        ).first()

        if existing_invitation:
            raise PendingInvitationError("Pending invitation already exists for this patient and user")

        # Build context data
        context_data = {
            "patient_id": patient_id,
            "patient_name": f"{patient.first_name} {patient.last_name}",
            "patient_birth_date": patient.birth_date.isoformat() if patient.birth_date else None,
            "permission_level": permission_level,
            "custom_permissions": custom_permissions,
            "expires_at": expires_at.isoformat() if expires_at else None
        }

        # Create invitation title
        title = f"Patient Record Share: {patient.first_name} {patient.last_name}"

        # Create invitation using InvitationService
        invitation_service = InvitationService(self.db)
        invitation = invitation_service.create_invitation(
            sent_by_user=owner,
            sent_to_identifier=shared_with_identifier,
            invitation_type='patient_share',
            title=title,
            context_data=context_data,
            message=message,
            expires_hours=expires_hours
        )

        logger.info("Created patient share invitation", extra={
            "invitation_id": invitation.id,
            "component": "patient_sharing"
        })
        return invitation

    def accept_patient_share_invitation(
        self,
        user: User,
        invitation_id: int,
        response_note: Optional[str] = None
    ) -> PatientShare:
        """
        Accept patient share invitation and create PatientShare

        Args:
            user: User accepting the invitation
            invitation_id: ID of invitation to accept
            response_note: Optional response note

        Returns:
            Created PatientShare object

        Raises:
            ValueError: If invitation invalid or expired
        """
        logger.info("Accepting patient share invitation", extra={
            "user_id": user.id,
            "invitation_id": invitation_id,
            "component": "patient_sharing"
        })

        # Get invitation
        invitation = self.db.query(Invitation).filter(
            Invitation.id == invitation_id,
            Invitation.sent_to_user_id == user.id,
            Invitation.status == 'pending',
            Invitation.invitation_type == 'patient_share'
        ).first()

        if not invitation:
            raise ValueError("Invitation not found or not pending")

        # Check expiration
        if invitation.expires_at:
            now = get_utc_now()
            expires_at = invitation.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < now:
                invitation.status = 'expired'
                self.db.commit()
                raise ValueError("Invitation has expired")

        # Extract context data
        context = invitation.context_data
        patient_id = context.get('patient_id')
        permission_level = context.get('permission_level', 'view')
        custom_permissions = context.get('custom_permissions')
        expires_at_str = context.get('expires_at')

        if not patient_id:
            raise ValueError("Invalid invitation: missing patient_id")

        # Parse expires_at from context
        expires_at = None
        if expires_at_str:
            try:
                expires_at = datetime.fromisoformat(expires_at_str)
            except ValueError:
                logger.warning("Invalid expires_at format in invitation", extra={
                    "invitation_id": invitation_id,
                    "expires_at_str": expires_at_str,
                    "component": "patient_sharing"
                })

        # Attempt to create share - use try/except to handle race conditions
        # This prevents duplicate shares even if two requests arrive simultaneously
        try:
            share = PatientShare(
                patient_id=patient_id,
                shared_by_user_id=invitation.sent_by_user_id,
                shared_with_user_id=user.id,
                permission_level=permission_level,
                custom_permissions=custom_permissions,
                expires_at=expires_at,
                is_active=True,
                invitation_id=invitation.id
            )

            self.db.add(share)

            # Update invitation status
            invitation.status = 'accepted'
            invitation.responded_at = get_utc_now()
            invitation.response_note = response_note
            invitation.updated_at = get_utc_now()

            # Flush to validate constraints before commit
            self.db.flush()

            # Commit both share and invitation update
            self.db.commit()
            self.db.refresh(share)

            logger.info("Patient share created from invitation", extra={
                "share_id": share.id,
                "invitation_id": invitation.id,
                "component": "patient_sharing"
            })
            return share

        except IntegrityError as e:
            # Race condition: share was created by another request
            self.db.rollback()
            logger.info("Share already exists (race condition detected)", extra={
                "patient_id": patient_id,
                "user_id": user.id,
                "component": "patient_sharing"
            })

            # Get the existing share
            existing_share = self.db.query(PatientShare).filter(
                PatientShare.patient_id == patient_id,
                PatientShare.shared_with_user_id == user.id,
                PatientShare.is_active == True
            ).first()

            if existing_share:
                # Update invitation status separately
                invitation.status = 'accepted'
                invitation.responded_at = get_utc_now()
                invitation.response_note = response_note
                invitation.updated_at = get_utc_now()
                self.db.commit()
                return existing_share
            else:
                # Unexpected: constraint violation but no existing share found
                logger.error("IntegrityError but no existing share found", extra={
                    "error": str(e),
                    "patient_id": patient_id,
                    "user_id": user.id,
                    "component": "patient_sharing"
                })
                raise

    def accept_bulk_patient_share_invitation(
        self,
        user: User,
        invitation: Invitation,
        response_note: Optional[str] = None
    ) -> List[PatientShare]:
        """
        Accept bulk patient share invitation and create multiple PatientShares

        Args:
            user: User accepting the invitation
            invitation: Bulk invitation object
            response_note: Optional response note

        Returns:
            List of created/existing PatientShare objects

        Raises:
            ValueError: If invitation invalid or bulk data missing
        """
        logger.info("Accepting bulk patient share invitation", extra={
            "user_id": user.id,
            "invitation_id": invitation.id,
            "component": "patient_sharing"
        })

        # Extract bulk invitation data
        patients_data = invitation.context_data.get('patients', [])
        if not patients_data:
            raise ValueError("Invalid bulk invitation: missing patients data")

        # Use explicit transaction boundary for atomic bulk operation
        try:
            shares = []
            for patient_data in patients_data:
                patient_id = patient_data.get('patient_id')
                if not patient_id:
                    logger.warning("Skipping patient data without ID", extra={
                        "patient_data": patient_data,
                        "component": "patient_sharing"
                    })
                    continue

                # Verify patient still exists and sender still owns it
                patient = self.db.query(Patient).filter(
                    Patient.id == patient_id,
                    Patient.owner_user_id == invitation.sent_by_user_id
                ).first()

                if not patient:
                    logger.warning("Patient no longer exists or ownership changed", extra={
                        "patient_id": patient_id,
                        "sender_id": invitation.sent_by_user_id,
                        "component": "patient_sharing"
                    })
                    continue  # Skip this patient in bulk operation

                # Check if share already exists
                existing = self.db.query(PatientShare).filter(
                    PatientShare.patient_id == patient_id,
                    PatientShare.shared_with_user_id == user.id,
                    PatientShare.is_active == True
                ).first()

                if existing:
                    logger.info("Share already exists, using existing", extra={
                        "patient_id": patient_id,
                        "share_id": existing.id,
                        "component": "patient_sharing"
                    })
                    shares.append(existing)
                    continue

                # Extract context data for this patient
                permission_level = invitation.context_data.get('permission_level', 'view')
                custom_permissions = invitation.context_data.get('custom_permissions')
                expires_at_str = invitation.context_data.get('expires_at')

                expires_at = None
                if expires_at_str:
                    try:
                        expires_at = datetime.fromisoformat(expires_at_str)
                    except ValueError:
                        logger.warning("Invalid expires_at format", extra={
                            "expires_at_str": expires_at_str,
                            "component": "patient_sharing"
                        })

                # Create share
                share = PatientShare(
                    patient_id=patient_id,
                    shared_by_user_id=invitation.sent_by_user_id,
                    shared_with_user_id=user.id,
                    permission_level=permission_level,
                    custom_permissions=custom_permissions,
                    expires_at=expires_at,
                    is_active=True,
                    invitation_id=invitation.id
                )
                self.db.add(share)
                shares.append(share)

            # Update invitation status within same transaction
            invitation.status = 'accepted'
            invitation.responded_at = get_utc_now()
            invitation.response_note = response_note
            invitation.updated_at = get_utc_now()

            # Flush to validate constraints before commit
            self.db.flush()

            # Commit all changes atomically
            self.db.commit()

            logger.info("Bulk patient share invitation accepted", extra={
                "invitation_id": invitation.id,
                "shares_created": len(shares),
                "component": "patient_sharing"
            })

            return shares

        except IntegrityError as e:
            self.db.rollback()
            logger.error("Database constraint violation during bulk acceptance", extra={
                "invitation_id": invitation.id,
                "user_id": user.id,
                "error": str(e),
                "component": "patient_sharing"
            })
            raise

    def bulk_send_patient_share_invitations(
        self,
        owner: User,
        patient_ids: List[int],
        shared_with_identifier: str,
        permission_level: str = 'view',
        expires_at: Optional[datetime] = None,
        custom_permissions: Optional[dict] = None,
        message: Optional[str] = None,
        expires_hours: Optional[int] = 168
    ) -> Dict:
        """
        Send ONE invitation to share multiple patients

        Args:
            owner: User who owns the patients
            patient_ids: List of patient IDs to share
            shared_with_identifier: Username or email of recipient
            permission_level: Permission level for all patients
            expires_at: Optional share expiration
            custom_permissions: Optional custom permissions
            message: Optional message to recipient
            expires_hours: Hours until invitation expires

        Returns:
            Dict with invitation details and counts

        Raises:
            ValueError: If validation fails
        """
        logger.info("Sending bulk patient share invitation", extra={
            "user_id": owner.id,
            "patient_count": len(patient_ids),
            "component": "patient_sharing"
        })

        # Enforce MAX_BULK_PATIENTS limit
        if len(patient_ids) > MAX_BULK_PATIENTS:
            raise ValueError(f"Cannot share more than {MAX_BULK_PATIENTS} patients at once. Received {len(patient_ids)} patient IDs.")

        # Validate permission level
        valid_permissions = ['view', 'edit', 'full']
        if permission_level not in valid_permissions:
            raise InvalidPermissionLevelError(f"Invalid permission level. Must be one of: {valid_permissions}")

        # Set statement timeout for bulk operation to prevent long-running queries
        # Note: This uses PostgreSQL-specific syntax. For other databases, adjust accordingly.
        try:
            self.db.execute(sa.text(f"SET LOCAL statement_timeout = '{BULK_OPERATION_TIMEOUT_SECONDS}s'"))
            logger.debug("Set query timeout for bulk operation", extra={
                "timeout_seconds": BULK_OPERATION_TIMEOUT_SECONDS,
                "component": "patient_sharing"
            })
        except Exception as e:
            # Log as error since this is a safety mechanism - should investigate if it fails
            logger.error("Failed to set query timeout for bulk operation", extra={
                "error": str(e),
                "timeout_seconds": BULK_OPERATION_TIMEOUT_SECONDS,
                "component": "patient_sharing",
                "action": "continuing_without_timeout"
            })
            # Continue anyway - timeout is a safety measure, not a hard requirement

        # Batch fetch all patients owned by the user
        patients = self.db.query(Patient).filter(
            Patient.id.in_(patient_ids),
            Patient.owner_user_id == owner.id
        ).all()

        # Verify all patient IDs were found
        found_patient_ids = {patient.id for patient in patients}
        missing_ids = set(patient_ids) - found_patient_ids
        if missing_ids:
            raise PatientNotFoundError(f"Patients not found or not owned by user: {', '.join(map(str, missing_ids))}")

        if not patients:
            raise ValueError("No patients provided")

        # Find recipient user
        recipient = self.db.query(User).filter(
            or_(User.username == shared_with_identifier,
                User.email == shared_with_identifier)
        ).first()

        if not recipient:
            raise RecipientNotFoundError("Recipient user not found")

        if recipient.id == owner.id:
            raise SelfShareError("Cannot share patients with yourself")

        # Batch check for existing shares
        existing_shares = self.db.query(PatientShare).filter(
            PatientShare.patient_id.in_(patient_ids),
            PatientShare.shared_with_user_id == recipient.id,
            PatientShare.is_active == True
        ).all()

        # Create a map of patient_id to patient for quick lookup
        patient_map = {patient.id: patient for patient in patients}

        # Check if any shares already exist
        if existing_shares:
            already_shared = [
                f"{patient_map[share.patient_id].first_name} {patient_map[share.patient_id].last_name}"
                for share in existing_shares
            ]
            raise AlreadySharedError(f"Already shared with this user: {', '.join(already_shared)}")

        # Build context data
        patients_data = []
        for patient in patients:
            patients_data.append({
                "patient_id": patient.id,
                "patient_name": f"{patient.first_name} {patient.last_name}",
                "patient_birth_date": patient.birth_date.isoformat() if patient.birth_date else None
            })

        context_data = {
            "patients": patients_data,
            "permission_level": permission_level,
            "custom_permissions": custom_permissions,
            "expires_at": expires_at.isoformat() if expires_at else None,
            "is_bulk_invite": True,
            "patient_count": len(patients)
        }

        # Create invitation title
        patient_names = [f"{p.first_name} {p.last_name}" for p in patients]
        if len(patient_names) > 3:
            title = f"Patient Records Share: {patient_names[0]}, {patient_names[1]}, {patient_names[2]} and {len(patient_names) - 3} more"
        else:
            title = f"Patient Records Share: {', '.join(patient_names)}"

        # Create invitation
        invitation_service = InvitationService(self.db)
        invitation = invitation_service.create_invitation(
            sent_by_user=owner,
            sent_to_identifier=shared_with_identifier,
            invitation_type='patient_share',
            title=title,
            context_data=context_data,
            message=message,
            expires_hours=expires_hours
        )

        logger.info("Created bulk patient share invitation", extra={
            "invitation_id": invitation.id,
            "patient_count": len(patients),
            "component": "patient_sharing"
        })

        return {
            "message": f"Bulk invitation sent for {len(patients)} patients",
            "invitation_id": invitation.id,
            "patient_count": len(patients),
            "expires_at": invitation.expires_at,
            "title": title
        }