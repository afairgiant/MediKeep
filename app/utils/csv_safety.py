"""Keeps text from being run as a formula when a CSV is opened in a spreadsheet app."""

from typing import Any

_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r", "\n")


def _is_number(value: str) -> bool:
    try:
        float(value)
    except ValueError:
        return False
    return True


def neutralize_formula(value: Any) -> Any:
    """Return value, with a leading ' on text a spreadsheet app would run as a formula.

    Values that are not strings, and strings that are plain numbers, are unchanged.
    """
    if (
        isinstance(value, str)
        and value.startswith(_FORMULA_PREFIXES)
        and not _is_number(value)
    ):
        return f"'{value}"
    return value
