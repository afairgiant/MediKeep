"""VisitReminderSchedulerService tick: discovery, firing and dedup (no APScheduler)."""

from datetime import date, datetime, time, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.models.clinical import Encounter
from app.models.notifications import NotificationHistory
from app.schemas.patient import PatientCreate
from app.services.visit_reminder_scheduler import VisitReminderSchedulerService

VISIT_DAY = date(2026, 12, 10)
DAY_BEFORE_AT_NINE = datetime(2026, 12, 9, 9, 0)


@pytest.fixture(autouse=True)
def reset_scheduler():
    VisitReminderSchedulerService.reset_instance()
    yield
    VisitReminderSchedulerService.reset_instance()


@pytest.fixture
def mock_bus():
    with patch("app.services.visit_reminder_scheduler.get_event_bus") as factory:
        factory.return_value.publish = AsyncMock()
        yield factory.return_value


@pytest.fixture
def patient(db_session: Session, test_user):
    return patient_crud.create_for_user(
        db_session,
        user_id=test_user.id,
        patient_data=PatientCreate(
            first_name="Visit",
            last_name="Reminder",
            birth_date=date(1990, 1, 1),
            gender="F",
            address="1 Test Way",
        ),
    )


def _make_visit(db, patient_id, **overrides):
    values = dict(
        patient_id=patient_id,
        reason="Dental cleaning",
        date=VISIT_DAY,
        visit_time=time(10, 30),
        location="Main St clinic",
        reminder_enabled=True,
        reminder_offsets=[1440],
    )
    values.update(overrides)
    visit = Encounter(**values)
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return visit


async def _tick(db, minute):
    service = VisitReminderSchedulerService.get_instance()
    return await service._process_tick(db, minute)


def _published(mock_bus):
    return [call.args[0] for call in mock_bus.publish.await_args_list]


class TestFiring:
    @pytest.mark.asyncio
    async def test_day_before_fires_that_morning(
        self, db_session, patient, test_user, mock_bus
    ):
        visit = _make_visit(db_session, patient.id)

        counts = await _tick(db_session, DAY_BEFORE_AT_NINE)

        assert counts["events_published"] == 1
        (event,) = _published(mock_bus)
        assert event.encounter_id == visit.id
        assert event.user_id == test_user.id
        assert event.visit_date == "2026-12-10"
        assert event.visit_time == "10:30"
        assert event.offset_minutes == 1440
        assert event.scheduled_fire_local == "2026-12-09T09:00"

    @pytest.mark.asyncio
    async def test_other_minutes_do_not_fire(self, db_session, patient, mock_bus):
        _make_visit(db_session, patient.id)

        counts = await _tick(db_session, datetime(2026, 12, 9, 9, 1))

        assert counts["due"] == 0
        mock_bus.publish.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_all_day_visit_fires_at_nine(self, db_session, patient, mock_bus):
        _make_visit(db_session, patient.id, visit_time=None, reminder_offsets=[0])

        counts = await _tick(db_session, datetime(2026, 12, 10, 9, 0))

        assert counts["events_published"] == 1
        assert _published(mock_bus)[0].visit_time == ""

    @pytest.mark.asyncio
    async def test_all_day_visit_ignores_stored_hour_offset(
        self, db_session, patient, mock_bus
    ):
        _make_visit(db_session, patient.id, visit_time=None, reminder_offsets=[60])

        counts = await _tick(db_session, datetime(2026, 12, 10, 8, 0))

        assert counts["due"] == 0

    @pytest.mark.asyncio
    async def test_reminders_off_is_not_a_candidate(
        self, db_session, patient, mock_bus
    ):
        _make_visit(db_session, patient.id, reminder_enabled=False)

        counts = await _tick(db_session, DAY_BEFORE_AT_NINE)

        assert counts["candidates_seen"] == 0

    @pytest.mark.asyncio
    async def test_past_visit_is_not_a_candidate(self, db_session, patient, mock_bus):
        _make_visit(db_session, patient.id, date=date(2026, 12, 1))

        counts = await _tick(db_session, DAY_BEFORE_AT_NINE)

        assert counts["candidates_seen"] == 0


class TestCatchUp:
    @pytest.mark.asyncio
    async def test_late_tick_sends_the_skipped_minute_once(
        self, db_session, patient, mock_bus
    ):
        _make_visit(db_session, patient.id)
        service = VisitReminderSchedulerService.get_instance()
        before = DAY_BEFORE_AT_NINE - timedelta(minutes=1)

        await service._run_tick(db_session, before)
        await service._run_tick(db_session, DAY_BEFORE_AT_NINE + timedelta(minutes=2))
        await service._run_tick(db_session, DAY_BEFORE_AT_NINE + timedelta(minutes=3))

        assert len(_published(mock_bus)) == 1

    @pytest.mark.asyncio
    async def test_repeated_wall_clock_minutes_are_skipped(
        self, db_session, patient, mock_bus
    ):
        _make_visit(db_session, patient.id)
        service = VisitReminderSchedulerService.get_instance()

        await service._run_tick(db_session, DAY_BEFORE_AT_NINE)
        counts = await service._run_tick(db_session, DAY_BEFORE_AT_NINE)

        assert counts["due"] == 0
        assert len(_published(mock_bus)) == 1

    @pytest.mark.asyncio
    async def test_long_gap_is_not_caught_up(self, db_session, patient, mock_bus):
        _make_visit(db_session, patient.id)
        service = VisitReminderSchedulerService.get_instance()

        await service._run_tick(db_session, DAY_BEFORE_AT_NINE - timedelta(hours=5))
        await service._run_tick(db_session, DAY_BEFORE_AT_NINE + timedelta(hours=1))

        mock_bus.publish.assert_not_awaited()


class TestContent:
    @pytest.mark.asyncio
    async def test_details_left_out_by_default(self, db_session, patient, mock_bus):
        _make_visit(db_session, patient.id)

        await _tick(db_session, DAY_BEFORE_AT_NINE)

        event = _published(mock_bus)[0]
        assert event.location is None
        assert event.practitioner_name is None

    @pytest.mark.asyncio
    async def test_details_included_when_opted_in(self, db_session, patient, mock_bus):
        _make_visit(db_session, patient.id, reminder_include_details=True)

        await _tick(db_session, DAY_BEFORE_AT_NINE)

        assert _published(mock_bus)[0].location == "Main St clinic"


class TestDedup:
    @pytest.fixture(autouse=True)
    def history_window_from_epoch(self):
        # History rows are stamped with the real clock; the tick is in a fixed month
        with patch(
            "app.services.visit_reminder_scheduler.facility_day_start_utc",
            return_value=datetime(2000, 1, 1),
        ):
            yield

    def _history(self, db, encounter_id, is_test=False):
        db.add(
            NotificationHistory(
                event_type="visit_reminder_due",
                title="prior",
                message_preview="prior",
                status="sent",
                attempt_count=1,
                event_data={
                    "encounter_id": encounter_id,
                    "scheduled_fire_local": "2026-12-09T09:00",
                    "is_test": is_test,
                },
            )
        )
        db.commit()

    @pytest.mark.asyncio
    async def test_already_sent_is_skipped(self, db_session, patient, mock_bus):
        visit = _make_visit(db_session, patient.id)
        self._history(db_session, visit.id)

        counts = await _tick(db_session, DAY_BEFORE_AT_NINE)

        assert counts["skipped_dedup"] == 1
        mock_bus.publish.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_test_reminder_does_not_suppress(self, db_session, patient, mock_bus):
        visit = _make_visit(db_session, patient.id)
        self._history(db_session, visit.id, is_test=True)

        counts = await _tick(db_session, DAY_BEFORE_AT_NINE)

        assert counts["events_published"] == 1
