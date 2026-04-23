"""
Runtime-persisted admin settings.

Registry of `Settings` attributes that admins can modify via the admin API
and that must survive process restarts. Values are stored as strings in the
`system_settings` table, one row per setting.

Env vars in `app.core.config` still act as the first-boot default; once a
value is written to the DB, the DB wins on subsequent startups via
`load_persisted_settings`.
"""

from dataclasses import dataclass
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.crud.system_setting import system_setting

logger = get_logger(__name__, "app")


KEY_ALLOW_USER_REGISTRATION = "allow_user_registration"
KEY_BACKUP_RETENTION_DAYS = "backup_retention_days"
KEY_TRASH_RETENTION_DAYS = "trash_retention_days"
KEY_BACKUP_MIN_COUNT = "backup_min_count"
KEY_BACKUP_MAX_COUNT = "backup_max_count"


def _parse_bool(raw: str) -> bool:
    normalized = raw.strip().lower()
    if normalized == "true":
        return True
    if normalized == "false":
        return False
    raise ValueError(f"Expected 'true' or 'false', got {raw!r}")


def _serialize_bool(value: bool) -> str:
    return "true" if value else "false"


@dataclass(frozen=True)
class PersistedSetting:
    key: str
    attr: str
    parse: Callable[[str], Any]
    serialize: Callable[[Any], str]


PERSISTED_SETTINGS: dict[str, PersistedSetting] = {
    entry.key: entry
    for entry in (
        PersistedSetting(
            key=KEY_ALLOW_USER_REGISTRATION,
            attr="ALLOW_USER_REGISTRATION",
            parse=_parse_bool,
            serialize=_serialize_bool,
        ),
        PersistedSetting(
            key=KEY_BACKUP_RETENTION_DAYS,
            attr="BACKUP_RETENTION_DAYS",
            parse=int,
            serialize=str,
        ),
        PersistedSetting(
            key=KEY_TRASH_RETENTION_DAYS,
            attr="TRASH_RETENTION_DAYS",
            parse=int,
            serialize=str,
        ),
        PersistedSetting(
            key=KEY_BACKUP_MIN_COUNT,
            attr="BACKUP_MIN_COUNT",
            parse=int,
            serialize=str,
        ),
        PersistedSetting(
            key=KEY_BACKUP_MAX_COUNT,
            attr="BACKUP_MAX_COUNT",
            parse=int,
            serialize=str,
        ),
    )
}


def load_persisted_settings(db: Session) -> None:
    """Override runtime config attributes with values from `system_settings`.

    Malformed stored values are logged and skipped; the in-memory default
    (populated from the env var when `Settings` was instantiated) is kept.
    """
    for entry in PERSISTED_SETTINGS.values():
        raw = system_setting.get_setting(db, entry.key)
        if raw is None:
            continue
        try:
            parsed = entry.parse(raw)
        except (ValueError, TypeError) as exc:
            logger.warning(
                "Skipping malformed persisted setting",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "persisted_setting_invalid",
                    "setting_key": entry.key,
                    LogFields.ERROR: str(exc),
                },
            )
            continue
        setattr(settings, entry.attr, parsed)
        logger.info(
            "Loaded persisted admin setting",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "persisted_setting_loaded",
                "setting_key": entry.key,
            },
        )


def persist_setting(db: Session, key: str, value: Any) -> None:
    """Persist a runtime-configurable setting to `system_settings`.

    Caller is responsible for updating the in-memory `settings.X` attribute;
    this function only writes to the DB.
    """
    try:
        entry = PERSISTED_SETTINGS[key]
    except KeyError as exc:
        raise KeyError(f"Unknown persisted setting key: {key}") from exc
    system_setting.set_setting(db, key, entry.serialize(value))
