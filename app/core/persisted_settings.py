"""
Runtime-persisted admin settings.

Registry of `Settings` attributes that admins can modify via the admin API
and that must survive process restarts. Values are stored as strings in the
`system_settings` table, one row per setting.

Env vars in `app.core.config` still act as the first-boot default; once a
value is written to the DB, the DB wins on subsequent startups via
`load_persisted_settings`.
"""

import os
from dataclasses import dataclass
from typing import Any, Callable, Optional

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
KEY_RELEASE_CHECK_ENABLED = "release_check_enabled"
KEY_WHATS_NEW_POPUP_ENABLED = "whats_new_popup_enabled"
KEY_ACTIVITY_LOG_RETENTION_DAYS = "activity_log_retention_days"
KEY_NOTIFICATION_HISTORY_RETENTION_DAYS = "notification_history_retention_days"


def _parse_bool(raw: str) -> bool:
    normalized = raw.strip().lower()
    if normalized == "true":
        return True
    if normalized == "false":
        return False
    raise ValueError(f"Expected 'true' or 'false', got {raw!r}")


def _serialize_bool(value: bool) -> str:
    return "true" if value else "false"


def _require_positive_int(value: int) -> None:
    if value < 1:
        raise ValueError(f"must be >= 1, got {value}")


def _require_non_negative_int(value: int) -> None:
    if value < 0:
        raise ValueError(f"must be >= 0, got {value}")


class SettingValidationError(ValueError):
    """A submitted admin setting value was rejected."""


@dataclass(frozen=True)
class PersistedSetting:  # pylint: disable=too-many-instance-attributes
    key: str
    attr: str
    value_type: type
    parse: Callable[[str], Any]
    serialize: Callable[[Any], str]
    # Optional semantic check applied after `parse` succeeds. Raise ValueError
    # to reject the DB value (the in-memory default is kept instead). Used to
    # defend `load_persisted_settings` against invalid rows that somehow
    # bypassed API-level validation.
    validate: Optional[Callable[[Any], None]] = None
    # Write-only bounds: the boot loader skips them so older stored values still load.
    min_value: Optional[int] = None
    max_value: Optional[int] = None
    # 0 is accepted below min_value and means "keep forever".
    zero_means_forever: bool = False


def _bool_setting(key: str, attr: str) -> PersistedSetting:
    return PersistedSetting(
        key=key,
        attr=attr,
        value_type=bool,
        parse=_parse_bool,
        serialize=_serialize_bool,
    )


def _int_setting(
    key: str,
    attr: str,
    max_value: int,
    min_value: int = 1,
    zero_means_forever: bool = False,
) -> PersistedSetting:
    return PersistedSetting(
        key=key,
        attr=attr,
        value_type=int,
        parse=int,
        serialize=str,
        validate=(
            _require_non_negative_int if zero_means_forever else _require_positive_int
        ),
        min_value=min_value,
        max_value=max_value,
        zero_means_forever=zero_means_forever,
    )


PERSISTED_SETTINGS: dict[str, PersistedSetting] = {
    entry.key: entry
    for entry in (
        _bool_setting(KEY_ALLOW_USER_REGISTRATION, "ALLOW_USER_REGISTRATION"),
        _int_setting(KEY_BACKUP_RETENTION_DAYS, "BACKUP_RETENTION_DAYS", 365),
        _int_setting(KEY_TRASH_RETENTION_DAYS, "TRASH_RETENTION_DAYS", 365),
        _int_setting(KEY_BACKUP_MIN_COUNT, "BACKUP_MIN_COUNT", 100),
        _int_setting(KEY_BACKUP_MAX_COUNT, "BACKUP_MAX_COUNT", 500),
        _bool_setting(KEY_RELEASE_CHECK_ENABLED, "RELEASE_CHECK_ENABLED"),
        _bool_setting(KEY_WHATS_NEW_POPUP_ENABLED, "WHATS_NEW_POPUP_ENABLED"),
        _int_setting(
            KEY_ACTIVITY_LOG_RETENTION_DAYS,
            "ACTIVITY_LOG_RETENTION_DAYS",
            3650,
            zero_means_forever=True,
        ),
        # Reminder dedup reads today's history rows; two days keeps a margin over DST.
        _int_setting(
            KEY_NOTIFICATION_HISTORY_RETENTION_DAYS,
            "NOTIFICATION_HISTORY_RETENTION_DAYS",
            3650,
            min_value=2,
            zero_means_forever=True,
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
        if entry.validate is not None:
            try:
                entry.validate(parsed)
            except ValueError as exc:
                logger.warning(
                    "Skipping semantically invalid persisted setting",
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


def persist_setting(db: Session, key: str, value: Any, commit: bool = True) -> None:
    """Persist a runtime-configurable setting to `system_settings`.

    Caller is responsible for updating the in-memory `settings.X` attribute;
    this function only writes to the DB. Pass `commit=False` to stage the
    write as part of a larger transaction the caller commits itself.
    """
    try:
        entry = PERSISTED_SETTINGS[key]
    except KeyError as exc:
        raise KeyError(f"Unknown persisted setting key: {key}") from exc
    system_setting.set_setting(db, key, entry.serialize(value), commit=commit)


def fallback_value(entry: PersistedSetting) -> Any:
    """The env-or-built-in value a setting returns to when its saved row is removed."""
    # Class attributes hold the import-time env values; overrides live on the instance.
    return getattr(type(settings), entry.attr)


def describe_settings(db: Session) -> dict[str, dict[str, Any]]:
    """Current value, where it came from, its fallback and bounds, per registry key."""
    stored = system_setting.get_all_settings(db)
    described = {}
    for entry in PERSISTED_SETTINGS.values():
        fallback_source = "env" if entry.attr in os.environ else "default"
        described[entry.key] = {
            "value": getattr(settings, entry.attr),
            "source": "saved" if entry.key in stored else fallback_source,
            "fallback": fallback_value(entry),
            "fallback_source": fallback_source,
            "min": entry.min_value,
            "max": entry.max_value,
            "zero_means_forever": entry.zero_means_forever,
        }
    return described


def _check_value(entry: PersistedSetting, value: Any) -> None:
    # bool is an int subclass, so isinstance would let True through as 1.
    if type(value) is not entry.value_type:  # pylint: disable=unidiomatic-typecheck
        raise SettingValidationError(
            f"{entry.key} must be of type {entry.value_type.__name__}"
        )
    if entry.zero_means_forever and value == 0:
        return
    if entry.min_value is not None and value < entry.min_value:
        raise SettingValidationError(f"{entry.key} must be at least {entry.min_value}")
    if entry.max_value is not None and value > entry.max_value:
        raise SettingValidationError(f"{entry.key} must be at most {entry.max_value}")
    if entry.validate is not None:
        try:
            entry.validate(value)
        except ValueError as exc:
            raise SettingValidationError(f"{entry.key} {exc}") from exc


def apply_setting_changes(db: Session, changes: dict[str, Any]) -> list[str]:
    """Validate, persist and apply admin setting changes as one unit.

    A ``None`` value deletes the saved row so the fallback applies again.
    Nothing is written or applied unless every change is valid.

    Raises:
        SettingValidationError: on an unknown key, wrong type, out-of-bounds
            value or a broken cross-field rule.
    """
    pending: list[tuple[PersistedSetting, Any]] = []
    for key, value in changes.items():
        entry = PERSISTED_SETTINGS.get(key)
        if entry is None:
            raise SettingValidationError(f"Unknown setting: {key}")
        if value is not None:
            _check_value(entry, value)
        pending.append((entry, value))

    merged = {e.key: getattr(settings, e.attr) for e in PERSISTED_SETTINGS.values()}
    for entry, value in pending:
        merged[entry.key] = fallback_value(entry) if value is None else value
    # Checked only when submitted, so an env-set conflict cannot block other saves.
    counts = {KEY_BACKUP_MIN_COUNT, KEY_BACKUP_MAX_COUNT}
    if (
        counts & changes.keys()
        and merged[KEY_BACKUP_MIN_COUNT] > merged[KEY_BACKUP_MAX_COUNT]
    ):
        raise SettingValidationError(
            "Minimum backup count must be less than or equal to maximum backup count"
        )

    try:
        for entry, value in pending:
            if value is None:
                system_setting.delete_setting(db, entry.key, commit=False)
            else:
                persist_setting(db, entry.key, value, commit=False)
        db.commit()
    except Exception:
        db.rollback()
        raise

    for entry, _ in pending:
        setattr(settings, entry.attr, merged[entry.key])
    return [entry.key for entry, _ in pending]
