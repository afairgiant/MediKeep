"""
Shared validation functions for Pydantic V2 schemas.

This module provides reusable validation logic to reduce code duplication
across schema files. All validators preserve the original behavior while
providing a consistent, maintainable implementation.

Usage:
    from app.schemas.validators import (
        validate_text_field,
        validate_required_text,
        validate_positive_id,
        validate_date_not_future,
        validate_phone_number,
        validate_list_field,
        empty_strings_to_none,
    )
"""

import re
from datetime import date
from typing import Any, Optional, List, Set


def validate_text_field(
    value: Optional[str],
    max_length: int,
    min_length: int = 0,
    field_name: str = "Field",
) -> Optional[str]:
    """
    Validate an optional text field with length constraints.

    Args:
        value: The value to validate
        max_length: Maximum allowed length
        min_length: Minimum allowed length (default 0)
        field_name: Name of the field for error messages

    Returns:
        Stripped value or None if empty

    Raises:
        ValueError: If value doesn't meet length requirements
    """
    if value is None:
        return None

    stripped = value.strip()
    if not stripped:
        return None

    if min_length > 0 and len(stripped) < min_length:
        raise ValueError(f"{field_name} must be at least {min_length} characters")

    if len(stripped) > max_length:
        raise ValueError(f"{field_name} must be less than {max_length} characters")

    return stripped


def validate_required_text(
    value: str,
    max_length: int,
    min_length: int = 1,
    field_name: str = "Field",
    normalize_case: Optional[str] = None,
) -> str:
    """
    Validate a required text field with length constraints.

    Args:
        value: The value to validate (required)
        max_length: Maximum allowed length
        min_length: Minimum allowed length (default 1)
        field_name: Name of the field for error messages
        normalize_case: Optional case normalization ('title', 'upper', 'lower')

    Returns:
        Stripped and optionally normalized value

    Raises:
        ValueError: If value is empty or doesn't meet length requirements
    """
    if not value or not value.strip():
        raise ValueError(f"{field_name} is required")

    stripped = value.strip()

    if len(stripped) < min_length:
        raise ValueError(f"{field_name} must be at least {min_length} characters")

    if len(stripped) > max_length:
        raise ValueError(f"{field_name} must be less than {max_length} characters")

    if normalize_case == "title":
        return stripped.title()
    elif normalize_case == "upper":
        return stripped.upper()
    elif normalize_case == "lower":
        return stripped.lower()

    return stripped


def validate_positive_id(
    value: Optional[int],
    field_name: str = "ID",
    required: bool = False,
) -> Optional[int]:
    """
    Validate that an ID is a positive integer.

    Args:
        value: The ID value to validate
        field_name: Name of the field for error messages
        required: If True, value cannot be None

    Returns:
        The value if valid

    Raises:
        ValueError: If value is not a positive integer (or None when not required)
    """
    if value is None:
        if required:
            raise ValueError(f"{field_name} is required")
        return None

    if value <= 0:
        raise ValueError(f"{field_name} must be a positive integer")

    return value


def validate_date_not_future(
    value: Optional[date],
    field_name: str = "Date",
    max_years_past: Optional[int] = None,
) -> Optional[date]:
    """
    Validate that a date is not in the future.

    Args:
        value: The date to validate
        field_name: Name of the field for error messages
        max_years_past: Optional maximum years in the past allowed

    Returns:
        The date if valid

    Raises:
        ValueError: If date is in the future or too far in the past
    """
    if value is None:
        return None

    today = date.today()

    if value > today:
        raise ValueError(f"{field_name} cannot be in the future")

    if max_years_past is not None:
        if today.year - value.year > max_years_past:
            raise ValueError(
                f"{field_name} cannot be more than {max_years_past} years ago"
            )

    return value


def validate_phone_number(
    value: Optional[str],
    field_name: str = "Phone number",
    min_digits: int = 10,
    max_digits: int = 15,
) -> Optional[str]:
    """
    Validate and normalize a phone number to digits only.

    Handles various formats including:
    - (919) 555-1234
    - 919-555-1234
    - 919.555.1234
    - 9195551234
    - +1 919 555 1234

    Args:
        value: The phone number to validate
        field_name: Name of the field for error messages
        min_digits: Minimum digits required
        max_digits: Maximum digits allowed

    Returns:
        Digits-only phone number or None

    Raises:
        ValueError: If phone number format is invalid
    """
    if value is None or str(value).strip() == "":
        return None

    # Extract digits only
    digits_only = re.sub(r"[^\d]", "", value)

    # Handle US/Canada numbers with country code
    if digits_only.startswith("1") and len(digits_only) == 11:
        digits_only = digits_only[1:]

    if len(digits_only) < min_digits or len(digits_only) > max_digits:
        raise ValueError(f"{field_name} must be between {min_digits}-{max_digits} digits")

    return digits_only


def validate_list_field(
    value: Optional[List[str]],
    max_items: int = 20,
    max_item_length: int = 100,
    deduplicate: bool = True,
    default_empty: bool = True,
) -> Optional[List[str]]:
    """
    Validate a list of strings with cleaning and deduplication.

    Args:
        value: The list to validate
        max_items: Maximum number of items allowed
        max_item_length: Maximum length of each item
        deduplicate: Whether to remove duplicates
        default_empty: Whether to return [] instead of None for empty/None values

    Returns:
        Cleaned list of strings

    Raises:
        ValueError: If list exceeds limits
    """
    if value is None:
        return [] if default_empty else None

    # Clean and filter items
    cleaned = [item.strip() for item in value if item and item.strip()]

    # Deduplicate if requested
    if deduplicate:
        cleaned = list(dict.fromkeys(cleaned))  # Preserves order

    if len(cleaned) > max_items:
        raise ValueError(f"Maximum {max_items} items allowed")

    for item in cleaned:
        if len(item) > max_item_length:
            raise ValueError(f"Each item must be less than {max_item_length} characters")

    return cleaned


def validate_url(
    value: Optional[str],
    field_name: str = "URL",
    add_https: bool = True,
) -> Optional[str]:
    """
    Validate and optionally normalize a URL.

    Args:
        value: The URL to validate
        field_name: Name of the field for error messages
        add_https: Whether to add https:// if no protocol present

    Returns:
        Validated URL or None

    Raises:
        ValueError: If URL format is invalid
    """
    if value is None or str(value).strip() == "":
        return None

    url_pattern = re.compile(
        r"^https?://"  # http:// or https://
        r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|"  # domain
        r"localhost|"  # localhost
        r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"  # or IP
        r"(?::\d+)?"  # optional port
        r"(?:/?|[/?]\S+)$",
        re.IGNORECASE,
    )

    cleaned_url = value.strip()

    if add_https and not cleaned_url.startswith(("http://", "https://")):
        cleaned_url = "https://" + cleaned_url

    if not url_pattern.match(cleaned_url):
        raise ValueError(f"Please enter a valid {field_name.lower()}")

    return cleaned_url


def validate_zip_code(
    value: Optional[str],
    field_name: str = "ZIP code",
) -> Optional[str]:
    """
    Validate US ZIP code format (5 digits or ZIP+4).

    Args:
        value: The ZIP code to validate
        field_name: Name of the field for error messages

    Returns:
        Validated ZIP code or None

    Raises:
        ValueError: If ZIP code format is invalid
    """
    if value is None or str(value).strip() == "":
        return None

    zip_pattern = r"^\d{5}(-\d{4})?$"
    cleaned = value.strip()

    if not re.match(zip_pattern, cleaned):
        raise ValueError(f"{field_name} must be in format 12345 or 12345-6789")

    return cleaned


def empty_strings_to_none(values: dict, fields: List[str]) -> dict:
    """
    Convert empty strings to None for specified fields in a dict.

    Used in model_validator(mode='before') to normalize empty strings.

    Args:
        values: The values dict from model validation
        fields: List of field names to convert

    Returns:
        Modified values dict

    Example:
        @model_validator(mode="before")
        @classmethod
        def normalize_empty_strings(cls, values):
            return empty_strings_to_none(values, ["field1", "field2"])
    """
    if not isinstance(values, dict):
        return values

    for field in fields:
        if field in values and values[field] == "":
            values[field] = None

    return values


# Gender validation constants and function
ALLOWED_GENDERS = frozenset(["M", "F", "MALE", "FEMALE", "OTHER", "U", "UNKNOWN"])
GENDER_NORMALIZATION = {"MALE": "M", "FEMALE": "F", "UNKNOWN": "U"}


def validate_gender(
    value: Optional[str],
    allow_empty_string: bool = False,
) -> Optional[str]:
    """
    Validate and normalize gender values.

    Args:
        value: The gender value to validate
        allow_empty_string: Whether to treat empty string same as None

    Returns:
        Normalized gender code (M, F, U, OTHER) or None

    Raises:
        ValueError: If gender is not in allowed list
    """
    if value is None:
        return None

    if value == "":
        return None if allow_empty_string else value

    upper_value = value.upper()
    if upper_value not in ALLOWED_GENDERS:
        raise ValueError(f"Gender must be one of: {', '.join(sorted(ALLOWED_GENDERS))}")

    return GENDER_NORMALIZATION.get(upper_value, upper_value)


# Blood type validation constants
VALID_BLOOD_TYPES = frozenset(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])


def validate_blood_type(value: Optional[str]) -> Optional[str]:
    """
    Validate blood type format.

    Args:
        value: The blood type to validate

    Returns:
        Uppercase blood type or None

    Raises:
        ValueError: If blood type is not valid
    """
    if value is None or not value.strip():
        return None

    upper_value = value.upper().strip()

    if upper_value not in VALID_BLOOD_TYPES:
        raise ValueError(f"Blood type must be one of: {', '.join(sorted(VALID_BLOOD_TYPES))}")

    return upper_value
