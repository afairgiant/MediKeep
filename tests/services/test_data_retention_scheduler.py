"""Scheduling of the data retention cleanup."""

from unittest.mock import patch

import pytest

from app.services import data_retention_scheduler
from app.services.data_retention_scheduler import (
    DAILY_JOB_ID,
    STARTUP_JOB_ID,
    DataRetentionSchedulerService,
)


@pytest.fixture(autouse=True)
def fresh_scheduler():
    DataRetentionSchedulerService.reset_instance()
    yield
    DataRetentionSchedulerService.reset_instance()


@pytest.mark.asyncio
async def test_start_registers_daily_and_startup_jobs():
    service = DataRetentionSchedulerService.get_instance()

    await service.start()
    try:
        daily = service._scheduler.get_job(DAILY_JOB_ID)
        assert daily is not None
        assert str(daily.trigger.fields[5]) == "3"  # hour
        assert str(daily.trigger.fields[6]) == "30"  # minute
        assert service._scheduler.get_job(STARTUP_JOB_ID) is not None
    finally:
        await service.shutdown()


@pytest.mark.asyncio
async def test_start_twice_does_not_duplicate_jobs():
    service = DataRetentionSchedulerService.get_instance()

    await service.start()
    await service.start()
    try:
        assert len(service._scheduler.get_jobs()) == 2
    finally:
        await service.shutdown()


@pytest.mark.asyncio
async def test_run_calls_the_service():
    with patch.object(data_retention_scheduler, "run_data_retention") as run:
        await DataRetentionSchedulerService.get_instance().run()

    run.assert_called_once()


@pytest.mark.asyncio
async def test_run_survives_a_failure():
    with patch.object(
        data_retention_scheduler, "run_data_retention", side_effect=RuntimeError
    ):
        await DataRetentionSchedulerService.get_instance().run()
