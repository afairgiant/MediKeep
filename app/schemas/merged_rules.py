"""Cross-field rules, checked on create and against the stored row on partial updates."""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Callable, Collection

from pydantic import BaseModel

Check = Callable[[Any, Any], None]

# How far ahead a record that has not happened yet may be dated
FUTURE_DATE_LIMIT = timedelta(days=3650)


class MergedRuleError(ValueError):
    """An update whose sent fields over the stored row break a ``MergedRule``."""


@dataclass(frozen=True)
class MergedRule:
    """A rule over ``fields``; ``check`` takes their values in order and raises
    ``ValueError`` when the combination is not allowed."""

    fields: tuple[str, ...]
    check: Check


def ordered_check(message: str, *, strict: bool = False) -> Check:
    """Check raising ``ValueError(message)`` when the second value is before the
    first, or equal to it when ``strict``. A ``None`` on either side passes."""

    def check(first: Any, second: Any) -> None:
        if first is None or second is None:
            return
        if second < first or (strict and second == first):
            raise ValueError(message)

    return check


def status_date_check(label: str, noun: str, future_ok: Collection[str]) -> Check:
    """Check of ``(date, status)`` raising ``ValueError`` when the date is in the
    future for a status outside ``future_ok``, or too far ahead for one inside it.
    Values that are not a date and a string pass, for the field validators to reject.
    """

    def check(value: Any, status: Any) -> None:
        if not isinstance(value, date) or not isinstance(status, str):
            return
        status = status.lower()
        if status in future_ok:
            if value > date.today() + FUTURE_DATE_LIMIT:
                raise ValueError(f"{label} cannot be more than 10 years in the future")
        elif value > date.today():
            raise ValueError(f"{label} cannot be in the future for {status} {noun}")

    return check


def as_date(value: Any) -> Any:
    """``value`` parsed from an ISO date string, or unchanged if it is not one."""
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return value
    return value


def check_merged_rules(update: Any, stored: Any) -> None:
    """Run ``update``'s ``MERGED_RULES`` on its sent fields laid over ``stored``.

    A rule runs only when the update changes one of its fields, so a stored row
    that already breaks a rule can still take unrelated edits. Inputs that are not
    pydantic models carry no rules and pass.

    Raises:
        MergedRuleError: from the first rule the merged values break.
    """
    if not isinstance(update, BaseModel):
        return
    sent = update.model_fields_set
    for rule in getattr(update, "MERGED_RULES", ()):
        changed = any(
            name in sent and getattr(update, name) != getattr(stored, name)
            for name in rule.fields
        )
        if not changed:
            continue
        values = (
            getattr(update, name) if name in sent else getattr(stored, name)
            for name in rule.fields
        )
        try:
            rule.check(*values)
        except ValueError as e:
            raise MergedRuleError(str(e)) from e
