"""
User Deletion Service
Handles safe deletion of users and all associated data with proper transaction management.
"""

from typing import Any, Dict, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.constants import get_admin_roles_filter, is_admin_role
from app.core.logging.config import get_logger
from app.crud.activity_log import activity_log
from app.models.activity_log import ActivityLog
from app.models.models import (
    FamilyHistoryShare,
    Invitation,
    Patient,
    PatientPhoto,
    PatientShare,
    TrustedDevice,
    User,
    UserBackupCode,
    UserPreferences,
    UserTag,
    UserTotp,
)
from app.services.attachment_cleanup import (
    PendingAttachments,
    find_patient_attachments,
)

logger = get_logger(__name__, "app")


class UserDeletionService:
    """
    Service responsible for safely deleting users and all associated data.
    Ensures transactional integrity and proper cleanup order.
    """

    def delete_user_account(
        self,
        db: Session,
        user_id: int,
        request_metadata: Optional[Dict[str, Any]] = None,
        *,
        attachments: Optional[PendingAttachments] = None,
    ) -> Dict[str, Any]:
        """
        Delete user and all associated data in a single transaction.

        Args:
            db: Database session (transaction should be managed by caller)
            user_id: User ID to delete
            request_metadata: Optional request context (IP, user agent, etc.)
            attachments: If given, filled with the attachments of the patients this
                deletes, for cleanup_attachments once the caller has committed.
                Nothing cascades to the files.

        Returns:
            Dictionary with deletion results

        Raises:
            ValueError: If user cannot be deleted (last user/admin)
            Exception: If deletion fails
        """
        # Validate deletion is allowed
        user = self._validate_deletion_allowed(db, user_id)
        username = user.username

        # Initialize deletion statistics
        deletion_stats = {
            "user_id": user_id,
            "username": username,
            "deleted_records": {},
        }

        logger.info(
            f"Starting user deletion process for {username}",
            extra={
                "user_id": user_id,
                "username": username,
                **(request_metadata or {}),
            },
        )

        # Execute deletion in proper order to avoid FK violations
        # Order: least dependent -> most dependent

        # 1. Delete user preferences
        deleted_prefs = (
            db.query(UserPreferences)
            .filter(UserPreferences.user_id == user_id)
            .delete(synchronize_session=False)
        )

        deletion_stats["deleted_records"]["user_preferences"] = deleted_prefs

        # The foreign keys cascade too; deleting here keeps the counts in the stats
        deletion_stats["deleted_records"]["backup_codes"] = (
            db.query(UserBackupCode)
            .filter(UserBackupCode.user_id == user_id)
            .delete(synchronize_session=False)
        )
        deletion_stats["deleted_records"]["trusted_devices"] = (
            db.query(TrustedDevice)
            .filter(TrustedDevice.user_id == user_id)
            .delete(synchronize_session=False)
        )
        deletion_stats["deleted_records"]["totp"] = (
            db.query(UserTotp)
            .filter(UserTotp.user_id == user_id)
            .delete(synchronize_session=False)
        )

        if deleted_prefs > 0:
            logger.info(
                f"Deleted {deleted_prefs} user preferences for {username}",
                extra={"user_id": user_id, "count": deleted_prefs},
            )

        # 2. Delete patient shares
        deleted_shares = (
            db.query(PatientShare)
            .filter(
                or_(
                    PatientShare.shared_by_user_id == user_id,
                    PatientShare.shared_with_user_id == user_id,
                )
            )
            .delete(synchronize_session=False)
        )

        deletion_stats["deleted_records"]["patient_shares"] = deleted_shares

        if deleted_shares > 0:
            logger.info(
                f"Deleted {deleted_shares} patient shares for {username}",
                extra={"user_id": user_id, "count": deleted_shares},
            )

        # 3. Delete family history shares
        deleted_family_shares = (
            db.query(FamilyHistoryShare)
            .filter(
                or_(
                    FamilyHistoryShare.shared_by_user_id == user_id,
                    FamilyHistoryShare.shared_with_user_id == user_id,
                )
            )
            .delete(synchronize_session=False)
        )

        deletion_stats["deleted_records"][
            "family_history_shares"
        ] = deleted_family_shares

        if deleted_family_shares > 0:
            logger.info(
                f"Deleted {deleted_family_shares} family history shares for {username}",
                extra={"user_id": user_id, "count": deleted_family_shares},
            )

        # 4. Delete invitations
        deleted_sent = (
            db.query(Invitation)
            .filter(Invitation.sent_by_user_id == user_id)
            .delete(synchronize_session=False)
        )

        deleted_received = (
            db.query(Invitation)
            .filter(Invitation.sent_to_user_id == user_id)
            .delete(synchronize_session=False)
        )

        deletion_stats["deleted_records"]["invitations_sent"] = deleted_sent
        deletion_stats["deleted_records"]["invitations_received"] = deleted_received

        if deleted_sent > 0 or deleted_received > 0:
            logger.info(
                f"Deleted invitations for {username}",
                extra={
                    "user_id": user_id,
                    "sent": deleted_sent,
                    "received": deleted_received,
                },
            )

        # 5. Delete every patient the user owns
        patients = db.query(Patient).filter(Patient.user_id == user_id).all()
        patient_ids = [patient.id for patient in patients]
        if attachments is not None:
            # Taken from the patients deleted here, after the account lock, so the
            # cleanup matches this delete even if a patient was transferred meanwhile
            attachments.extend(find_patient_attachments(db, patient_ids))

        activity_log.detach_patient_activity(db, patient_ids=patient_ids)

        for patient_record in patients:
            patient_id = patient_record.id
            db.delete(patient_record)
            db.flush()

            logger.info(
                f"Deleted patient record {patient_id} for {username}",
                extra={"user_id": user_id, "patient_id": patient_id},
            )

        deletion_stats["deleted_records"]["patient"] = len(patient_ids)
        if patient_ids:
            deletion_stats["patient_id"] = patient_ids[0]

        # 6. Delete the user's tags
        deletion_stats["deleted_records"]["user_tags"] = (
            db.query(UserTag)
            .filter(UserTag.user_id == user_id)
            .delete(synchronize_session=False)
        )

        # 7. Nullify user references in activity logs
        updated_logs = (
            db.query(ActivityLog)
            .filter(ActivityLog.user_id == user_id)
            .update({"user_id": None}, synchronize_session=False)
        )

        deletion_stats["deleted_records"]["activity_logs_updated"] = updated_logs

        # 8. Clear the uploader on photos the user added to patients they don't own
        # (shared edit access). The photo stays with its patient.
        deletion_stats["deleted_records"]["patient_photos_updated"] = (
            db.query(PatientPhoto)
            .filter(PatientPhoto.uploaded_by == user_id)
            .update({"uploaded_by": None}, synchronize_session=False)
        )

        # 9. Delete the user
        user_obj = db.query(User).filter(User.id == user_id).first()
        if user_obj:
            # Bulk deletes must not leave stale relationship collections for ORM cleanup.
            db.expire(user_obj)
            db.delete(user_obj)
            deletion_stats["deleted_records"]["user"] = 1

        logger.info(
            f"User deletion completed for {username}",
            extra={
                "user_id": user_id,
                "username": username,
                "deletion_stats": deletion_stats,
                **(request_metadata or {}),
            },
        )

        return deletion_stats

    def _validate_deletion_allowed(self, db: Session, user_id: int) -> User:
        """
        Validate that the user can be safely deleted.

        Args:
            db: Database session
            user_id: User ID to validate

        Returns:
            User object if validation passes

        Raises:
            ValueError: If user cannot be deleted
        """
        # Get user with lock to prevent concurrent modifications
        # Use nowait to prevent indefinite blocking
        try:
            user = (
                db.query(User)
                .filter(User.id == user_id)
                .with_for_update(nowait=True)
                .first()
            )
        except Exception as e:
            if "could not obtain lock" in str(e).lower():
                raise ValueError(
                    "User account is currently being modified by another process. Please try again."
                )
            raise

        if not user:
            raise ValueError(f"User with ID {user_id} not found")

        # Check if this is the last user
        total_users = db.query(User).count()
        if total_users <= 1:
            logger.warning(
                f"Attempted deletion of last user: {user.username}",
                extra={"user_id": user_id, "username": user.username},
            )
            raise ValueError(
                "Cannot delete the last remaining user in the system. "
                "The system must have at least one user account."
            )

        # Check if this is the last admin
        if is_admin_role(user.role):
            admin_count = (
                db.query(User).filter(User.role.in_(get_admin_roles_filter())).count()
            )

            if admin_count <= 1:
                logger.warning(
                    f"Attempted deletion of last admin: {user.username}",
                    extra={"user_id": user_id, "username": user.username},
                )
                raise ValueError(
                    "Cannot delete the last remaining admin user in the system. "
                    "Please create another admin user first."
                )

        return user
