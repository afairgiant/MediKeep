"""
Datetime Utility Module

This module provides utilities for handling datetime conversions and validations
across the Medical Records Management System.
"""

import os
import re
from datetime import date, datetime, timezone
from typing import Any, Optional, Union
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.logging_config import get_logger

logger = get_logger(__name__, "app")

# Module-level configuration (simple and effective)
FACILITY_TIMEZONE = None


def get_facility_timezone() -> ZoneInfo:
    """Get facility timezone, initialized once on first call."""
    global FACILITY_TIMEZONE
    if FACILITY_TIMEZONE is None:
        tz_name = os.getenv("TZ", "UTC")
        try:
            FACILITY_TIMEZONE = ZoneInfo(tz_name)
            logger.info(f"Timezone configured: {tz_name}")
        except ZoneInfoNotFoundError:
            logger.warning(f"Unknown timezone '{tz_name}', using UTC")
            FACILITY_TIMEZONE = ZoneInfo("UTC")
    return FACILITY_TIMEZONE


def get_utc_now() -> datetime:
    """
    Get the current UTC datetime with timezone awareness.

    This replaces the deprecated datetime.utcnow() with a timezone-aware alternative.
    """
    return datetime.now(timezone.utc)


def to_utc(local_datetime: Union[str, datetime]) -> Optional[datetime]:
    """Convert local datetime to UTC for storage."""
    if local_datetime is None:
        return None

    try:
        if isinstance(local_datetime, str):
            from dateutil import parser

            naive_dt = parser.parse(local_datetime).replace(tzinfo=None)
        else:
            naive_dt = (
                local_datetime.replace(tzinfo=None)
                if local_datetime.tzinfo
                else local_datetime
            )

        # Simple localization - let zoneinfo handle DST
        localized_dt = naive_dt.replace(tzinfo=get_facility_timezone())
        return localized_dt.astimezone(timezone.utc)

    except Exception as e:
        logger.error(f"Failed to convert datetime to UTC: {local_datetime}, error: {e}")
        raise ValueError(f"Invalid datetime: {local_datetime}")


def to_local(utc_datetime: datetime) -> Optional[datetime]:
    """Convert UTC datetime to local timezone for display."""
    if utc_datetime is None:
        return None

    try:
        if utc_datetime.tzinfo is None:
            utc_datetime = utc_datetime.replace(tzinfo=timezone.utc)
        return utc_datetime.astimezone(get_facility_timezone())
    except Exception as e:
        logger.error(f"Failed to convert to local timezone: {e}")
        return None


def format_datetime(utc_datetime: datetime, include_timezone: bool = True) -> str:
    """Format datetime for display."""
    if utc_datetime is None:
        return "N/A"

    local_dt = to_local(utc_datetime)
    if local_dt is None:
        return "Invalid Date"

    if include_timezone:
        return local_dt.strftime("%Y-%m-%d %I:%M %p %Z")
    return local_dt.strftime("%Y-%m-%d %I:%M %p")


def get_timezone_info():
    """Get timezone info for API."""
    try:
        tz = get_facility_timezone()
        current_utc = get_utc_now()
        current_local = to_local(current_utc)

        return {
            "facility_timezone": str(tz),
            "current_utc_time": current_utc.isoformat(),
            "current_facility_time": (
                current_local.isoformat() if current_local else None
            ),
            "timezone_offset_hours": (
                current_local.utcoffset().total_seconds() / 3600 if current_local else 0
            ),
        }
    except Exception as e:
        logger.error(f"Failed to get timezone info: {e}")
        return {
            "facility_timezone": "UTC",
            "current_utc_time": get_utc_now().isoformat(),
            "current_facility_time": get_utc_now().isoformat(),
            "timezone_offset_hours": 0,
        }


def parse_datetime_string(datetime_str: str) -> datetime:
    """
    Parse a datetime string into a Python datetime object.

    Supports multiple common datetime formats:
    - ISO format: "2024-01-15T10:30:00"
    - ISO with microseconds: "2024-01-15T10:30:00.123456"
    - ISO with timezone: "2024-01-15T10:30:00Z"
    - Simple format: "2024-01-15 10:30:00"

    Args:
        datetime_str: String representation of datetime

    Returns:
        Python datetime object

    Raises:
        ValueError: If the datetime string format is not supported

    Examples:
        >>> parse_datetime_string("2024-01-15T10:30:00")
        datetime(2024, 1, 15, 10, 30)

        >>> parse_datetime_string("2024-01-15 10:30:00")
        datetime(2024, 1, 15, 10, 30)
    """
    if not isinstance(datetime_str, str):
        raise ValueError(f"Expected string, got {type(datetime_str)}")

    # Remove timezone info if present (Z or +00:00)
    clean_str = re.sub(
        r"[Z]$|[+-]\d{2}:\d{2}$", "", datetime_str.strip()
    )  # List of supported formats
    formats = [
        "%Y-%m-%dT%H:%M:%S.%f",  # ISO with microseconds
        "%Y-%m-%dT%H:%M:%S",  # ISO format
        "%Y-%m-%d %H:%M:%S.%f",  # Simple with microseconds
        "%Y-%m-%d %H:%M:%S",  # Simple format
        "%Y-%m-%dT%H:%M",  # ISO without seconds
        "%Y-%m-%d %H:%M",  # Simple without seconds
        "%Y-%m-%d",  # Date-only format (convert to datetime at midnight)
    ]

    for fmt in formats:
        try:
            return datetime.strptime(clean_str, fmt)
        except ValueError:
            continue

    raise ValueError(f"Unsupported datetime format: {datetime_str}")


def ensure_datetime(value: Union[str, datetime, None]) -> Optional[datetime]:
    """
    Ensure a value is converted to a datetime object if possible.

    Args:
        value: String, datetime object, or None

    Returns:
        datetime object or None

    Examples:
        >>> ensure_datetime("2024-01-15T10:30:00")
        datetime(2024, 1, 15, 10, 30)

        >>> ensure_datetime(None)
        None

        >>> ensure_datetime(datetime(2024, 1, 15))
        datetime(2024, 1, 15)
    """
    if value is None:
        return None

    if isinstance(value, datetime):
        return value

    if isinstance(value, str):
        if not value.strip():
            return None
        return parse_datetime_string(value)

    raise ValueError(f"Cannot convert {type(value)} to datetime")


def parse_date_string(date_str: str) -> date:
    """
    Parse a date string into a Python date object.

    Args:
        date_str: String representing a date

    Returns:
        date object

    Raises:
        ValueError: If the string cannot be parsed as a date

    Examples:
        >>> parse_date_string("2024-01-15")
        date(2024, 1, 15)
    """
    if not isinstance(date_str, str):
        raise ValueError(f"Expected string, got {type(date_str)}")

    clean_str = date_str.strip()

    # List of supported date formats
    formats = [
        "%Y-%m-%d",  # ISO date format
        "%m/%d/%Y",  # US format
        "%d/%m/%Y",  # European format
        "%Y-%m-%dT%H:%M:%S.%f",  # ISO datetime (extract date part)
        "%Y-%m-%dT%H:%M:%S",  # ISO datetime without microseconds
    ]

    for fmt in formats:
        try:
            if "T" in fmt:
                # For datetime formats, parse as datetime then extract date
                dt = datetime.strptime(clean_str.split("T")[0], "%Y-%m-%d")
                return dt.date()
            else:
                dt = datetime.strptime(clean_str, fmt)
                return dt.date()
        except ValueError:
            continue

    raise ValueError(f"Unsupported date format: {date_str}")


def ensure_date(value: Union[str, date, datetime, None]) -> Optional[date]:
    """
    Ensure a value is converted to a date object if possible.

    Args:
        value: String, date object, datetime object, or None

    Returns:
        date object or None

    Examples:
        >>> ensure_date("2024-01-15")
        date(2024, 1, 15)

        >>> ensure_date(None)
        None

        >>> ensure_date(datetime(2024, 1, 15, 10, 30))
        date(2024, 1, 15)
    """
    if value is None:
        return None

    if isinstance(value, date):
        return value

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, str):
        if not value.strip():
            return None
        return parse_date_string(value)

    raise ValueError(f"Cannot convert {type(value)} to date")


def convert_date_fields(data: dict, date_fields: list) -> dict:
    """
    Convert specified date fields in a dictionary from strings to date objects.

    Args:
        data: Dictionary containing the data
        date_fields: List of field names that should be converted to date

    Returns:
        Dictionary with converted date fields

    Examples:
        >>> data = {"name": "Test", "birth_date": "2024-01-15"}
        >>> convert_date_fields(data, ["birth_date"])
        {"name": "Test", "birth_date": date(2024, 1, 15)}
    """
    converted_data = data.copy()

    for field in date_fields:
        if field in converted_data:
            try:
                converted_data[field] = ensure_date(converted_data[field])
            except ValueError as e:
                raise ValueError(f"Error converting field '{field}': {e}")

    return converted_data


def convert_datetime_fields(data: dict, datetime_fields: list) -> dict:
    """
    Convert specified datetime fields in a dictionary from strings to datetime objects.

    Args:
        data: Dictionary containing the data
        datetime_fields: List of field names that should be converted to datetime

    Returns:
        Dictionary with converted datetime fields

    Examples:
        >>> data = {"name": "Test", "created_at": "2024-01-15T10:30:00"}
        >>> convert_datetime_fields(data, ["created_at"])
        {"name": "Test", "created_at": datetime(2024, 1, 15, 10, 30)}
    """
    converted_data = data.copy()

    for field in datetime_fields:
        if field in converted_data:
            try:
                converted_data[field] = ensure_datetime(converted_data[field])
            except ValueError as e:
                raise ValueError(f"Error converting field '{field}': {e}")

    return converted_data


def validate_datetime_order(start_field: str, end_field: str, data: dict) -> None:
    """
    Validate that start datetime is before end datetime.

    Args:
        start_field: Name of the start datetime field
        end_field: Name of the end datetime field
        data: Dictionary containing the datetime fields

    Raises:
        ValueError: If end datetime is before start datetime

    Examples:
        >>> data = {"start": datetime(2024, 1, 15), "end": datetime(2024, 1, 16)}
        >>> validate_datetime_order("start", "end", data)  # No error

        >>> data = {"start": datetime(2024, 1, 16), "end": datetime(2024, 1, 15)}
        >>> validate_datetime_order("start", "end", data)  # Raises ValueError
    """
    start_dt = data.get(start_field)
    end_dt = data.get(end_field)

    if start_dt and end_dt:
        if isinstance(start_dt, str):
            start_dt = ensure_datetime(start_dt)
        if isinstance(end_dt, str):
            end_dt = ensure_datetime(end_dt)

        if start_dt and end_dt and end_dt < start_dt:
            raise ValueError(f"{end_field} cannot be before {start_field}")


class DateTimeConverter:
    """
    A reusable datetime converter class for specific use cases.
    """

    def __init__(self, datetime_fields: list):
        """
        Initialize with list of datetime fields to convert.

        Args:
            datetime_fields: List of field names that contain datetime values
        """
        self.datetime_fields = datetime_fields

    def convert(self, data: dict) -> dict:
        """
        Convert datetime fields in the provided data.

        Args:
            data: Dictionary containing data to convert

        Returns:
            Dictionary with converted datetime fields
        """
        return convert_datetime_fields(data, self.datetime_fields)

    def convert_model_data(self, obj_in: Any) -> dict:
        """
        Convert datetime fields from a Pydantic model or dict.

        Args:
            obj_in: Pydantic model instance or dictionary

        Returns:
            Dictionary with converted datetime fields
        """
        if hasattr(obj_in, "dict"):
            # Pydantic model
            data = obj_in.dict()
        elif isinstance(obj_in, dict):
            data = obj_in
        else:
            raise ValueError(f"Unsupported data type: {type(obj_in)}")

        return self.convert(data)


class DateConverter:
    """
    A reusable date converter class for specific use cases.
    """

    def __init__(self, date_fields: list):
        """
        Initialize with list of date fields to convert.

        Args:
            date_fields: List of field names that contain date values
        """
        self.date_fields = date_fields

    def convert(self, data: dict) -> dict:
        """
        Convert date fields in the provided data.

        Args:
            data: Dictionary containing data to convert

        Returns:
            Dictionary with converted date fields
        """
        return convert_date_fields(data, self.date_fields)

    def convert_model_data(self, obj_in: Any) -> dict:
        """
        Convert date fields from a Pydantic model or dict.

        Args:
            obj_in: Pydantic model instance or dictionary

        Returns:
            Dictionary with converted date fields
        """
        if hasattr(obj_in, "dict"):
            # Pydantic model
            data = obj_in.dict()
        elif isinstance(obj_in, dict):
            data = obj_in
        else:
            raise ValueError(f"Unsupported data type: {type(obj_in)}")

        return self.convert(data)


# Pre-configured converters for common models
LAB_RESULT_CONVERTER = DateTimeConverter(["created_at", "updated_at"])

LAB_RESULT_DATE_CONVERTER = DateConverter(["ordered_date", "completed_date"])

USER_CONVERTER = DateTimeConverter(["created_at", "updated_at", "last_login"])

PATIENT_CONVERTER = DateTimeConverter(["created_at", "updated_at"])

PATIENT_DATE_CONVERTER = DateConverter(["birth_date"])

FILE_CONVERTER = DateTimeConverter(["uploaded_at", "created_at", "updated_at"])


# ========================================
# Application Startup Time Tracking
# ========================================

# Global variable to store the actual application startup time
_APPLICATION_START_TIME: Optional[datetime] = None


def set_application_startup_time(startup_time: Optional[datetime] = None) -> None:
    """
    Set the application startup time.

    Args:
        startup_time: The startup time to set. If None, uses current UTC time.
    """
    global _APPLICATION_START_TIME
    _APPLICATION_START_TIME = startup_time or get_utc_now()


def get_application_startup_time() -> Optional[datetime]:
    """
    Get the actual application startup time.

    Returns:
        The datetime when the application started, or None if not set yet.
    """
    return _APPLICATION_START_TIME


def get_application_uptime_seconds() -> Optional[int]:
    """
    Get the application uptime in seconds.

    Returns:
        The number of seconds since startup, or None if startup time not set.
    """
    if _APPLICATION_START_TIME is None:
        return None

    uptime_delta = get_utc_now() - _APPLICATION_START_TIME
    return int(uptime_delta.total_seconds())


def get_application_uptime_string() -> str:
    """
    Get a formatted uptime string.

    Returns:
        A human-readable uptime string, or "Starting up..." if not available.
    """
    uptime_seconds = get_application_uptime_seconds()

    if uptime_seconds is None:
        return "Starting up..."

    uptime_days = uptime_seconds // 86400
    uptime_hours = (uptime_seconds % 86400) // 3600
    uptime_minutes = (uptime_seconds % 3600) // 60

    if uptime_days > 0:
        return f"{uptime_days} days, {uptime_hours} hours"
    elif uptime_hours > 0:
        return f"{uptime_hours} hours, {uptime_minutes} minutes"
    else:
        return f"{uptime_minutes} minutes"
