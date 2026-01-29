"""
Base domain event class for MediKeep event system.

This module provides the foundational DomainEvent class that all events inherit from.
Events are immutable records of something that happened in the system.
"""

import re
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional, Dict, Any


@dataclass(frozen=True)
class DomainEvent:
    """
    Base class for all domain events in the system.

    Events are immutable records of things that have happened.
    They contain the data needed for event handlers and notifications.

    Attributes:
        event_id: Unique identifier for this event instance
        occurred_at: When the event occurred
        user_id: ID of the user who triggered the event (if applicable)
    """

    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: Optional[int] = None

    def event_type(self) -> str:
        """
        Convert class name to snake_case event type.

        Examples:
            BackupCompletedEvent -> backup_completed
            PatientCreatedEvent -> patient_created
            MedicationUpdatedEvent -> medication_updated

        Returns:
            Snake case event type string
        """
        class_name = self.__class__.__name__

        # Remove 'Event' suffix if present
        if class_name.endswith('Event'):
            class_name = class_name[:-5]

        # Convert PascalCase to snake_case
        # Insert underscore before uppercase letters (except first)
        snake_case = re.sub(r'(?<!^)(?=[A-Z])', '_', class_name).lower()

        return snake_case

    def to_notification_data(self) -> Dict[str, Any]:
        """
        Convert event to dictionary for notification templates.

        This method provides a clean dictionary representation of the event
        for use in notification templates. It includes all fields except
        internal ones (event_id, occurred_at).

        Returns:
            Dictionary of event data suitable for templates
        """
        data = asdict(self)

        # Remove internal fields that aren't useful in notifications
        data.pop('event_id', None)

        # Format datetime for readability if present
        if 'occurred_at' in data and isinstance(self.occurred_at, datetime):
            data['occurred_at'] = self.occurred_at.isoformat()

        # Remove None values to keep templates clean
        return {k: v for k, v in data.items() if v is not None}
