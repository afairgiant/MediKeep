"""
Async event bus for MediKeep event system.

This module provides a simple publish-subscribe event bus that allows
decoupling of event producers and consumers. Handlers run asynchronously
in parallel with error isolation.
"""

import asyncio
from typing import Dict, List, Callable, Awaitable

from app.core.events.base import DomainEvent
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields

logger = get_logger(__name__, "app")

# Type alias for async event handlers
EventHandler = Callable[[DomainEvent], Awaitable[None]]


class EventBus:
    """
    Simple async event bus for publishing and subscribing to domain events.

    The bus maintains a registry of event handlers and publishes events
    to all registered handlers in parallel. Handler failures are isolated
    and logged but don't affect other handlers.
    """

    def __init__(self) -> None:
        """Initialize the event bus with an empty handler registry."""
        self._handlers: Dict[str, List[EventHandler]] = {}

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        """
        Subscribe a handler to a specific event type.

        Args:
            event_type: The event type to listen for (e.g., 'backup_completed')
            handler: Async function that will be called when event is published
        """
        if event_type not in self._handlers:
            self._handlers[event_type] = []

        self._handlers[event_type].append(handler)

        logger.info(
            f"Handler subscribed to event type: {event_type}",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "event_handler_subscribed",
                "event_type": event_type,
                "handler": handler.__name__,
            },
        )

    async def publish(self, event: DomainEvent) -> None:
        """
        Publish an event to all registered handlers.

        Handlers are executed in parallel using asyncio.gather.
        If a handler fails, the error is logged but other handlers continue.

        Args:
            event: The domain event to publish
        """
        event_type = event.event_type()
        handlers = self._handlers.get(event_type, [])

        if not handlers:
            logger.debug(
                f"No handlers registered for event type: {event_type}",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "event_no_handlers",
                    "event_type": event_type,
                    "event_id": event.event_id,
                },
            )
            return

        logger.info(
            f"Publishing event: {event_type}",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "event_published",
                "event_type": event_type,
                "event_id": event.event_id,
                "handler_count": len(handlers),
                LogFields.USER_ID: event.user_id,
            },
        )

        # Run all handlers in parallel with error isolation
        tasks = [self._safe_handle(handler, event) for handler in handlers]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _safe_handle(self, handler: EventHandler, event: DomainEvent) -> None:
        """
        Execute a handler with error isolation.

        This ensures that if one handler fails, it doesn't prevent other
        handlers from executing. Errors are logged for debugging.

        Args:
            handler: The event handler to execute
            event: The event to pass to the handler
        """
        event_type = event.event_type()

        try:
            await handler(event)

            logger.debug(
                f"Handler executed successfully: {handler.__name__}",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "event_handler_success",
                    "event_type": event_type,
                    "handler": handler.__name__,
                    "event_id": event.event_id,
                },
            )

        except Exception as e:
            logger.error(
                f"Handler failed: {handler.__name__}",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "event_handler_failed",
                    "event_type": event_type,
                    "handler": handler.__name__,
                    "event_id": event.event_id,
                    LogFields.ERROR: str(e),
                },
                exc_info=True,
            )


# Global event bus singleton
_event_bus: EventBus = EventBus()


def get_event_bus() -> EventBus:
    """
    Get the global event bus instance.

    Returns:
        The singleton EventBus instance
    """
    return _event_bus
