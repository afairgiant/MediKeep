"""Render captured log records the way app.log stores them.

Asserting on ``LogRecord`` attributes passes even when the persisted JSON drops
the field (the file formatter only serialises a whitelist of extra fields). Tests
that say "the cause is logged" should assert on this instead.
"""

import json
from typing import List

from app.core.logging.config import MedicalRecordsJSONFormatter

_formatter = MedicalRecordsJSONFormatter()


def persisted_entries(caplog) -> List[dict]:
    """Each captured record as the JSON object written to app.log."""
    return [json.loads(_formatter.format(record)) for record in caplog.records]


def persisted_causes(caplog) -> List[str]:
    """The `error` field of every persisted entry that has one."""
    return [entry["error"] for entry in persisted_entries(caplog) if "error" in entry]


def persisted_text(caplog) -> str:
    """Everything persisted for the captured records, for "this must not appear" checks."""
    return "\n".join(json.dumps(entry) for entry in persisted_entries(caplog))
