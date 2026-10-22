"""
Deletes activity log and notification history rows older than the admin-set retention.
"""

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.crud.activity_log import activity_log
from app.models.activity_log import ActionType, ActivityLog, EntityType
from app.models.base import get_utc_now
from app.models.notifications import NotificationHistory

logger = get_logger(__name__, "app")

BATCH_SIZE = 5000


def purge_older_than(
    db: Session, model: Any, column: Any, cutoff: datetime, batch_size: int = BATCH_SIZE
) -> int:
    """Delete rows whose ``column`` is before ``cutoff``, committing per batch.

    Returns the number of rows deleted.
    """
    # No ORDER BY, so the date index finds each batch without sorting the backlog.
    batch = select(model.id).where(column < cutoff).limit(batch_size)
    deleted = 0
    while True:
        result = db.execute(
            delete(model)
            .where(model.id.in_(batch.scalar_subquery()))
            .execution_options(synchronize_session=False)
        )
        db.commit()
        if not result.rowcount:
            return deleted
        deleted += result.rowcount


def run_data_retention(db: Session) -> dict[str, int]:
    """Apply both retention settings; a setting of 0 skips its table.

    Returns rows deleted per table. Writes one activity entry when activity rows were removed.
    """
    now = get_utc_now()
    activity_deleted = 0
    notification_deleted = 0

    activity_days = settings.ACTIVITY_LOG_RETENTION_DAYS
    if activity_days > 0:
        cutoff = now - timedelta(days=activity_days)
        activity_deleted = purge_older_than(
            db, ActivityLog, ActivityLog.timestamp, cutoff
        )
        if activity_deleted:
            activity_log.log_activity(
                db,
                action=ActionType.MAINTENANCE_COMPLETED,
                entity_type=EntityType.SYSTEM,
                description=(
                    f"Removed {activity_deleted} activity entries "
                    f"older than {activity_days} days"
                ),
                metadata={"deleted": activity_deleted, "cutoff": cutoff.isoformat()},
            )

    notification_days = settings.NOTIFICATION_HISTORY_RETENTION_DAYS
    if notification_days > 0:
        notification_deleted = purge_older_than(
            db,
            NotificationHistory,
            NotificationHistory.created_at,
            now - timedelta(days=notification_days),
        )

    logger.info(
        "Data retention run complete",
        extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "data_retention_completed",
            "activity_logs_deleted": activity_deleted,
            "notification_history_deleted": notification_deleted,
        },
    )
    return {
        "activity_logs": activity_deleted,
        "notification_history": notification_deleted,
    }
