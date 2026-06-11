"""
Tests for MedicationReminderSchedulerService.

The scheduler ticks every minute and publishes MedicationReminderDueEvent for
any active medication whose reminder_times include the current facility-local
HH:MM, subject to effective_period bounds and idempotency.

We avoid spinning up APScheduler in these tests — we call ``_process_tick``
directly with a controlled local date and HH:MM.
"""

from datetime import date
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.models.clinical import Medication
from app.models.notifications import NotificationHistory
from app.schemas.patient import PatientCreate
from app.services.medication_reminder_scheduler import (
    MedicationReminderSchedulerService,
)


@pytest.fixture(autouse=True)
def reset_scheduler():
    """Reset the scheduler singleton between tests."""
    MedicationReminderSchedulerService.reset_instance()
    yield
    MedicationReminderSchedulerService.reset_instance()


@pytest.fixture
def mock_bus():
    """Patch the event bus and yield the mock bus instance."""
    with patch("app.services.medication_reminder_scheduler.get_event_bus") as factory:
        factory.return_value.publish = AsyncMock()
        yield factory.return_value


@pytest.fixture
def patient_with_owner(db_session: Session, test_user):
    """Create a patient owned by test_user."""
    patient_data = PatientCreate(
        first_name="Schedule",
        last_name="Test",
        birth_date=date(1990, 1, 1),
        gender="M",
        address="1 Test Way",
    )
    return patient_crud.create_for_user(
        db_session, user_id=test_user.id, patient_data=patient_data
    )


async def _run_tick(db, hhmm, tick_date=date(2026, 6, 9)):
    """Run one _process_tick and return (seen, due, skipped, published)."""
    service = MedicationReminderSchedulerService.get_instance()
    return await service._process_tick(db, tick_date, hhmm)


def _make_med(db, patient_id, **overrides):
    """Helper: insert a Medication row and return it."""
    defaults = dict(
        medication_name="Aspirin",
        dosage="100mg",
        status="active",
        reminder_enabled=True,
        reminder_times=["08:00", "20:00"],
        patient_id=patient_id,
    )
    defaults.update(overrides)
    med = Medication(**defaults)
    db.add(med)
    db.commit()
    db.refresh(med)
    return med


def _make_history(db, *, medication_id, scheduled_local_date, scheduled_time_local):
    """Insert a NotificationHistory row that should suppress a duplicate."""
    row = NotificationHistory(
        event_type="medication_reminder_due",
        title="prior",
        message_preview="prior",
        status="sent",
        attempt_count=1,
        event_data={
            "medication_id": medication_id,
            "scheduled_local_date": scheduled_local_date,
            "scheduled_time_local": scheduled_time_local,
        },
    )
    db.add(row)
    db.commit()
    return row


class TestDiscovery:
    """The discovery query selects only eligible medications."""

    @pytest.mark.asyncio
    async def test_active_med_at_matching_time_publishes_event(
        self, db_session, patient_with_owner, test_user, mock_bus
    ):
        med = _make_med(db_session, patient_with_owner.id)

        seen, due, skipped, published = await _run_tick(db_session, "08:00")

        assert seen == 1
        assert due == 1
        assert skipped == 0
        assert published == 1
        mock_bus.publish.assert_awaited_once()
        event = mock_bus.publish.await_args.args[0]
        assert event.user_id == test_user.id
        assert event.medication_id == med.id
        assert event.scheduled_time_local == "08:00"
        assert event.scheduled_local_date == "2026-06-09"

    @pytest.mark.asyncio
    async def test_non_matching_time_publishes_nothing(
        self, db_session, patient_with_owner, mock_bus
    ):
        _make_med(db_session, patient_with_owner.id, reminder_times=["08:00"])

        _, due, _, published = await _run_tick(db_session, "09:00")

        assert due == 0
        assert published == 0
        mock_bus.publish.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_stopped_status_excluded(
        self, db_session, patient_with_owner, mock_bus
    ):
        _make_med(db_session, patient_with_owner.id, status="stopped")

        _, due, _, published = await _run_tick(db_session, "08:00")

        assert due == 0
        assert published == 0

    @pytest.mark.asyncio
    async def test_reminder_disabled_excluded(
        self, db_session, patient_with_owner, mock_bus
    ):
        _make_med(db_session, patient_with_owner.id, reminder_enabled=False)

        _, due, _, published = await _run_tick(db_session, "08:00")

        assert due == 0
        assert published == 0


class TestEffectivePeriod:
    """Discovery respects effective_period_start and effective_period_end."""

    @pytest.mark.asyncio
    async def test_end_date_today_still_fires(
        self, db_session, patient_with_owner, mock_bus
    ):
        _make_med(
            db_session,
            patient_with_owner.id,
            effective_period_end=date(2026, 6, 9),
        )

        _, _, _, published = await _run_tick(db_session, "08:00")

        assert published == 1

    @pytest.mark.asyncio
    async def test_end_date_yesterday_excluded(
        self, db_session, patient_with_owner, mock_bus
    ):
        _make_med(
            db_session,
            patient_with_owner.id,
            effective_period_end=date(2026, 6, 8),
        )

        _, _, _, published = await _run_tick(db_session, "08:00")

        assert published == 0

    @pytest.mark.asyncio
    async def test_start_date_in_future_excluded(
        self, db_session, patient_with_owner, mock_bus
    ):
        _make_med(
            db_session,
            patient_with_owner.id,
            effective_period_start=date(2026, 6, 10),
        )

        _, _, _, published = await _run_tick(db_session, "08:00")

        assert published == 0


class TestIdempotency:
    """A NotificationHistory entry for the same minute suppresses duplicate sends."""

    @pytest.mark.asyncio
    async def test_dedup_suppresses_duplicate(
        self, db_session, patient_with_owner, mock_bus
    ):
        med = _make_med(db_session, patient_with_owner.id)
        _make_history(
            db_session,
            medication_id=med.id,
            scheduled_local_date="2026-06-09",
            scheduled_time_local="08:00",
        )

        _, due, skipped, published = await _run_tick(db_session, "08:00")

        assert due == 1
        assert skipped == 1
        assert published == 0
        mock_bus.publish.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_dedup_does_not_affect_different_minute(
        self, db_session, patient_with_owner, mock_bus
    ):
        med = _make_med(db_session, patient_with_owner.id)
        # Prior history is for 08:00 — should NOT suppress the 20:00 send
        _make_history(
            db_session,
            medication_id=med.id,
            scheduled_local_date="2026-06-09",
            scheduled_time_local="08:00",
        )

        _, _, skipped, published = await _run_tick(db_session, "20:00")

        assert published == 1
        assert skipped == 0


class TestMultipleMedications:
    """Multiple due medications at the same minute publish multiple events."""

    @pytest.mark.asyncio
    async def test_two_meds_same_minute(self, db_session, patient_with_owner, mock_bus):
        _make_med(db_session, patient_with_owner.id, medication_name="A")
        _make_med(db_session, patient_with_owner.id, medication_name="B")

        _, due, _, published = await _run_tick(db_session, "08:00")

        assert due == 2
        assert published == 2
        assert mock_bus.publish.await_count == 2
