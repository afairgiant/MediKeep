"""
Medication-related domain events.

Events triggered by the medication reminder scheduler when a configured
reminder time arrives for an active medication.
"""

from dataclasses import dataclass
from typing import Optional

from app.core.events.base import DomainEvent


@dataclass(frozen=True)
class MedicationReminderDueEvent(DomainEvent):
    """
    Fired when a medication's scheduled reminder time arrives.

    ``user_id`` (inherited from DomainEvent) is the patient owner — the
    notification is sent to whoever owns the patient record, not to whoever
    edited the medication. This matters when patient sharing is in play.

    ``scheduled_local_date`` + ``scheduled_time_local`` together form the
    idempotency key used by the scheduler to suppress duplicate sends.
    Test reminders set ``is_test=True`` and leave the scheduled fields
    empty (they have no schedule), so they are excluded from dedup.

    Attributes:
        patient_id: ID of the patient the medication belongs to
        medication_id: ID of the medication that is due
        medication_name: Display name for the notification body
        dosage: Optional dosage string for the notification body
        scheduled_time_local: HH:MM string in facility local time (empty for tests)
        scheduled_local_date: YYYY-MM-DD string in facility local time (empty for tests)
        is_test: True for one-shot test reminders fired from the UI
    """

    patient_id: int = 0
    medication_id: int = 0
    medication_name: str = ""
    dosage: Optional[str] = None
    reminder_message: Optional[str] = None
    scheduled_time_local: str = ""
    scheduled_local_date: str = ""
    is_test: bool = False
