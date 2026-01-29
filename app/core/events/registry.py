"""
Event metadata registry for MediKeep event system.

This module provides a centralized registry of all event types, their metadata,
and notification templates. It allows the system to look up event information
and generate user-friendly notification messages.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Callable, Tuple

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields

logger = get_logger(__name__, "app")

# Type alias for template functions
TemplateFn = Callable[[Dict], Tuple[str, str]]


@dataclass
class EventMetadata:
    """
    Metadata about a domain event type.

    This class stores information about each event type including
    its display label, description, category, and notification template.

    Attributes:
        event_type: Snake case event identifier (e.g., 'backup_completed')
        label: Human-readable event name (e.g., 'Backup Completed')
        description: Detailed description of what the event represents
        category: Event category (e.g., 'system', 'medical', 'user')
        template_fn: Function that generates (title, message) from event data
        is_implemented: Whether the event is currently implemented
    """

    event_type: str
    label: str
    description: str
    category: str
    template_fn: Optional[TemplateFn] = None
    is_implemented: bool = False


class EventRegistry:
    """
    Centralized registry for event metadata and templates.

    The registry maintains information about all event types in the system,
    including their display names, descriptions, categories, and notification
    templates.
    """

    def __init__(self) -> None:
        """Initialize the registry with an empty event map."""
        self._registry: Dict[str, EventMetadata] = {}

    def register(
        self,
        event_type: str,
        label: str,
        description: str,
        category: str,
        template_fn: Optional[TemplateFn] = None,
        is_implemented: bool = False,
    ) -> None:
        """
        Register an event type with its metadata.

        Args:
            event_type: Snake case event identifier
            label: Human-readable event name
            description: Detailed description of the event
            category: Event category for grouping
            template_fn: Optional function to generate notification templates
            is_implemented: Whether the event is currently implemented

        Raises:
            ValueError: If event_type is already registered
        """
        if event_type in self._registry:
            logger.warning(
                f"Event type already registered: {event_type}",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "event_registration_duplicate",
                    "event_type": event_type,
                },
            )
            return

        metadata = EventMetadata(
            event_type=event_type,
            label=label,
            description=description,
            category=category,
            template_fn=template_fn,
            is_implemented=is_implemented,
        )

        self._registry[event_type] = metadata

        logger.debug(
            f"Event type registered: {event_type}",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "event_registration_success",
                "event_type": event_type,
                "label": label,
                "category_name": category,
            },
        )

    def get(self, event_type: str) -> Optional[EventMetadata]:
        """
        Get metadata for a specific event type.

        Args:
            event_type: The event type to look up

        Returns:
            EventMetadata if found, None otherwise
        """
        return self._registry.get(event_type)

    def all(self) -> List[EventMetadata]:
        """
        Get all registered event metadata.

        Returns:
            List of all EventMetadata objects in the registry
        """
        return list(self._registry.values())

    def get_all_events(self) -> Dict[str, EventMetadata]:
        """
        Get all registered events as a dictionary.

        Returns:
            Dictionary mapping event types to their metadata
        """
        return dict(self._registry)

    def get_template(self, event_type: str, data: Dict) -> Tuple[str, str]:
        """
        Get notification template for an event.

        Generates a user-friendly title and message for the event
        using its registered template function.

        Args:
            event_type: The event type to get template for
            data: Event data to use in template

        Returns:
            Tuple of (title, message). If no template is registered,
            returns a generic template with the event type.
        """
        metadata = self.get(event_type)

        if not metadata:
            logger.warning(
                f"No metadata found for event type: {event_type}",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "event_template_not_found",
                    "event_type": event_type,
                },
            )
            return (
                "System Event",
                f"An event occurred: {event_type}",
            )

        if not metadata.template_fn:
            logger.debug(
                f"No template function for event type: {event_type}",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "event_template_missing",
                    "event_type": event_type,
                },
            )
            return (
                metadata.label,
                metadata.description,
            )

        try:
            title, message = metadata.template_fn(data)
            return (title, message)

        except Exception as e:
            logger.error(
                f"Template function failed for event type: {event_type}",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "event_template_error",
                    "event_type": event_type,
                    LogFields.ERROR: str(e),
                },
                exc_info=True,
            )
            return (
                metadata.label,
                f"Error generating notification: {str(e)}",
            )


# Global event registry singleton
_event_registry: EventRegistry = EventRegistry()


def get_event_registry() -> EventRegistry:
    """
    Get the global event registry instance.

    Returns:
        The singleton EventRegistry instance
    """
    return _event_registry
