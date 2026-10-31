"""Tests for the JSON formatter used by the persistent log files."""

import json
import logging
import sys

from app.core.logging.config import MedicalRecordsJSONFormatter
from app.core.logging.constants import LogFields


def _record(exc_info=None):
    return logging.LogRecord(
        name="app.test",
        level=logging.ERROR,
        pathname=__file__,
        lineno=1,
        msg="Failed to update auto-backup schedule",
        args=(),
        exc_info=exc_info,
    )


class TestTraceback:
    def test_includes_traceback_and_message_when_exc_info_is_set(self):
        try:
            raise RuntimeError("schedule row is corrupt")
        except RuntimeError:
            record = _record(sys.exc_info())

        output = json.loads(MedicalRecordsJSONFormatter().format(record))

        assert "Traceback" in output[LogFields.TRACEBACK]
        assert "RuntimeError: schedule row is corrupt" in output[LogFields.TRACEBACK]

    def test_no_traceback_without_exc_info(self):
        output = json.loads(MedicalRecordsJSONFormatter().format(_record()))

        assert LogFields.TRACEBACK not in output


class TestClientUserId:
    def test_written_separately_from_the_trusted_user_id(self):
        record = _record()
        record.client_user_id = 42

        output = json.loads(MedicalRecordsJSONFormatter().format(record))

        assert output["client_user_id"] == "42"
        assert LogFields.USER_ID not in output
