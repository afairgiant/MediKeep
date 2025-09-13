"""
User Deletion Service
Handles safe deletion of users and all associated data with proper transaction management.
"""

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.logging_config import get_logger
from app.models.models import (
    User, Patient, UserPreferences, PatientShare,
    FamilyHistoryShare, Invitation
)
from app.models.activity_log import ActivityLog

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
        request_metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Delete user and all associated data in a single transaction.

        Args:
            db: Database session (transaction should be managed by caller)
            user_id: User ID to delete
            request_metadata: Optional request context (IP, user agent, etc.)

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
            "deleted_records": {}
        }

        logger.info(
            f"Starting user deletion process for {username}",
            extra={
                "user_id": user_id,
                "username": username,
                **(request_metadata or {})
            }
        )

        # Execute deletion in proper order to avoid FK violations
        # Order: least dependent -> most dependent

        # 1. Delete user preferences
        deleted_prefs = db.query(UserPreferences).filter(
            UserPreferences.user_id == user_id
        ).delete(synchronize_session=False)

        deletion_stats["deleted_records"]["user_preferences"] = deleted_prefs

        if deleted_prefs > 0:
            logger.info(
                f"Deleted {deleted_prefs} user preferences for {username}",
                extra={"user_id": user_id, "count": deleted_prefs}
            )

        # 2. Delete patient shares
        deleted_shares = db.query(PatientShare).filter(
            or_(
                PatientShare.shared_by_user_id == user_id,
                PatientShare.shared_with_user_id == user_id
            )
        ).delete(synchronize_session=False)

        deletion_stats["deleted_records"]["patient_shares"] = deleted_shares

        if deleted_shares > 0:
            logger.info(
                f"Deleted {deleted_shares} patient shares for {username}",
                extra={"user_id": user_id, "count": deleted_shares}
            )

        # 3. Delete family history shares
        deleted_family_shares = db.query(FamilyHistoryShare).filter(
            or_(
                FamilyHistoryShare.shared_by_user_id == user_id,
                FamilyHistoryShare.shared_with_user_id == user_id
            )
        ).delete(synchronize_session=False)

        deletion_stats["deleted_records"]["family_history_shares"] = deleted_family_shares

        if deleted_family_shares > 0:
            logger.info(
                f"Deleted {deleted_family_shares} family history shares for {username}",
                extra={"user_id": user_id, "count": deleted_family_shares}
            )

        # 4. Delete invitations
        deleted_sent = db.query(Invitation).filter(
            Invitation.sent_by_user_id == user_id
        ).delete(synchronize_session=False)

        deleted_received = db.query(Invitation).filter(
            Invitation.sent_to_user_id == user_id
        ).delete(synchronize_session=False)

        deletion_stats["deleted_records"]["invitations_sent"] = deleted_sent
        deletion_stats["deleted_records"]["invitations_received"] = deleted_received

        if deleted_sent > 0 or deleted_received > 0:
            logger.info(
                f"Deleted invitations for {username}",
                extra={
                    "user_id": user_id,
                    "sent": deleted_sent,
                    "received": deleted_received
                }
            )

        # 5. Handle patient record deletion
        patient_record = db.query(Patient).filter(
            Patient.user_id == user_id
        ).first()

        patient_id = None
        if patient_record:
            patient_id = patient_record.id

            # Nullify patient references in activity logs
            db.query(ActivityLog).filter(
                ActivityLog.patient_id == patient_id
            ).update({"patient_id": None}, synchronize_session=False)

            # Delete patient (cascades to medical data)
            db.delete(patient_record)

            deletion_stats["deleted_records"]["patient"] = 1
            deletion_stats["patient_id"] = patient_id

            logger.info(
                f"Deleted patient record {patient_id} for {username}",
                extra={"user_id": user_id, "patient_id": patient_id}
            )

        # 6. Nullify user references in activity logs
        updated_logs = db.query(ActivityLog).filter(
            ActivityLog.user_id == user_id
        ).update({"user_id": None}, synchronize_session=False)

        deletion_stats["deleted_records"]["activity_logs_updated"] = updated_logs

        # 7. Finally, delete the user
        user_obj = db.query(User).filter(User.id == user_id).first()
        if user_obj:
            db.delete(user_obj)
            deletion_stats["deleted_records"]["user"] = 1

        logger.info(
            f"User deletion completed for {username}",
            extra={
                "user_id": user_id,
                "username": username,
                "deletion_stats": deletion_stats,
                **(request_metadata or {})
            }
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
        user = db.query(User).filter(User.id == user_id).with_for_update().first()

        if not user:
            raise ValueError(f"User with ID {user_id} not found")

        # Check if this is the last user
        total_users = db.query(User).count()
        if total_users <= 1:
            logger.warning(
                f"Attempted deletion of last user: {user.username}",
                extra={"user_id": user_id, "username": user.username}
            )
            raise ValueError(
                "Cannot delete the last remaining user in the system. "
                "The system must have at least one user account."
            )

        # Check if this is the last admin
        if user.role and user.role.lower() in ["admin", "administrator"]:
            admin_count = db.query(User).filter(
                User.role.in_(["admin", "Admin", "administrator", "Administrator"])
            ).count()

            if admin_count <= 1:
                logger.warning(
                    f"Attempted deletion of last admin: {user.username}",
                    extra={"user_id": user_id, "username": user.username}
                )
                raise ValueError(
                    "Cannot delete the last remaining admin user in the system. "
                    "Please create another admin user first."
                )

        return user