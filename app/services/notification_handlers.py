"""
Notification event handlers for the MediKeep event system.

This module subscribes to domain events from the event bus and sends
notifications via the NotificationService. It acts as a bridge between
the event system and the notification framework.

The handler:
- Receives domain events from the event bus
- Gets the template from the event registry
- Sends notification via NotificationService
- Logs success/failure
- Never raises exceptions (notification failures shouldn't break business logic)
"""

from typing import Awaitable, Callable

from sqlalchemy.orm import Session, sessionmaker

from app.core.events.base import DomainEvent
from app.core.events.registry import get_event_registry
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.services.notification_service import NotificationService

logger = get_logger(__name__, "app")


async def handle_notification_event(
    event: DomainEvent,
    db_session_factory: sessionmaker,
) -> None:
    """
    Generic handler for domain events that triggers notifications.

    This handler is called by the event bus when a domain event is published.
    It performs the following steps:
    1. Gets the notification template from the event registry
    2. Creates a database session
    3. Sends notification via NotificationService:
       - If user_id is None: broadcasts to ALL users with this event enabled
       - If user_id is set: sends only to that specific user
    4. Logs success/failure

    Args:
        event: The domain event that was published
        db_session_factory: SQLAlchemy sessionmaker for creating db sessions

    Returns:
        None. Never raises exceptions - logs errors instead.
    """
    event_type = event.event_type()
    is_broadcast = event.user_id is None

    db: Session = None

    try:
        # Get template from registry
        registry = get_event_registry()
        event_data = event.to_notification_data()
        title, message = registry.get_template(event_type, event_data)

        # Create database session
        db = db_session_factory()

        # Send notification (broadcast or user-specific)
        service = NotificationService(db)

        if is_broadcast:
            # System-wide event - send to all users with this event enabled
            history_records = await service.send_broadcast_notification(
                event_type=event_type,
                title=title,
                message=message,
                event_data=event_data,
            )
        else:
            # User-specific event - send only to that user
            history_records = await service.send_notification(
                user_id=event.user_id,
                event_type=event_type,
                title=title,
                message=message,
                event_data=event_data,
            )

        # Log success
        logger.info(
            f"Notification sent for event: {event_type}",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "notification_handler_success",
                "event_type": event_type,
                "event_id": event.event_id,
                LogFields.USER_ID: event.user_id,
                "is_broadcast": is_broadcast,
                "notifications_sent": len(history_records),
            },
        )

    except Exception as e:
        # Log error but never raise - notification failures shouldn't break business logic
        logger.error(
            f"Failed to send notification for event: {event_type}",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "notification_handler_error",
                "event_type": event_type,
                "event_id": event.event_id,
                LogFields.USER_ID: event.user_id,
                "is_broadcast": is_broadcast,
                LogFields.ERROR: str(e),
            },
            exc_info=True,
        )

    finally:
        # Always close database session
        if db:
            db.close()


def create_notification_handler(
    db_session_factory: sessionmaker,
) -> Callable[[DomainEvent], Awaitable[None]]:
    """
    Factory function that creates a notification handler with database access.

    This factory pattern allows the handler to access the database without
    coupling the event bus to the database session management. The returned
    handler can be subscribed to the event bus.

    Args:
        db_session_factory: SQLAlchemy sessionmaker for creating db sessions

    Returns:
        An async handler function that can be subscribed to the event bus

    Example:
        >>> from app.core.database.database import SessionLocal
        >>> from app.core.events.bus import get_event_bus
        >>>
        >>> # Create handler with database access
        >>> handler = create_notification_handler(SessionLocal)
        >>>
        >>> # Subscribe to specific event types
        >>> event_bus = get_event_bus()
        >>> event_bus.subscribe("backup_completed", handler)
        >>> event_bus.subscribe("patient_created", handler)
    """

    async def handler(event: DomainEvent) -> None:
        """Wrapper that passes the db_session_factory to the handler."""
        await handle_notification_event(event, db_session_factory)

    return handler
