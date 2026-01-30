from datetime import date
from typing import TYPE_CHECKING, Optional

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.schemas.validators import (
    empty_strings_to_none,
    validate_blood_type,
    validate_date_not_future,
    validate_gender,
    validate_positive_id,
    validate_required_text,
    validate_text_field,
)

if TYPE_CHECKING:
    from schemas.user import User


# Field lists for empty string conversion
_OPTIONAL_FIELDS = [
    "gender",
    "address",
    "blood_type",
    "height",
    "weight",
    "physician_id",
    "relationship_to_self",
]

_ALL_OPTIONAL_FIELDS = [
    "first_name",
    "last_name",
    "birth_date",
    *_OPTIONAL_FIELDS,
]


class PatientBase(BaseModel):
    """
    Base Patient schema with common fields.

    This contains the fields that are shared across different Patient schemas
    (create, update, read). It doesn't include auto-generated fields like id
    or user_id (which comes from authentication).
    """

    first_name: str
    last_name: str
    birth_date: date
    gender: Optional[str] = None
    address: Optional[str] = None
    blood_type: Optional[str] = None
    height: Optional[float] = (
        None  # in inches (allows decimals for metric conversion precision)
    )
    weight: Optional[float] = (
        None  # in pounds (allows decimals for metric conversion precision)
    )
    physician_id: Optional[int] = None
    relationship_to_self: Optional[str] = None  # Use RelationshipToSelf enum values

    @model_validator(mode="before")
    @classmethod
    def convert_empty_strings_to_none(cls, values):
        """Convert empty strings to None for optional fields"""
        return empty_strings_to_none(values, _OPTIONAL_FIELDS)

    @field_validator("first_name")
    @classmethod
    def validate_first_name(cls, v):
        """Validate first name requirements."""
        return validate_required_text(v, max_length=50, field_name="First name", normalize_case="title")

    @field_validator("last_name")
    @classmethod
    def validate_last_name(cls, v):
        """Validate last name requirements."""
        return validate_required_text(v, max_length=50, field_name="Last name", normalize_case="title")

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v):
        """Validate that the gender is one of the allowed values."""
        return validate_gender(v, allow_empty_string=True)

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, v):
        """Validate birth date is reasonable."""
        return validate_date_not_future(v, field_name="Birth date", max_years_past=150)

    @field_validator("address")
    @classmethod
    def validate_address(cls, v):
        """Validate address requirements."""
        return validate_text_field(v, max_length=200, min_length=5, field_name="Address")

    @field_validator("blood_type")
    @classmethod
    def validate_blood_type(cls, v):
        """Validate blood type format."""
        return validate_blood_type(v)

    @field_validator("height")
    @classmethod
    def validate_height(cls, v):
        """Validate height in inches (stored as imperial, converted from user's preferred units)."""
        if v is not None:
            if v < 12.0 or v > 108.0:  # 1 foot to 9 feet, consistent with frontend
                raise ValueError("Height must be between 12 and 108 inches")
        return v

    @field_validator("weight")
    @classmethod
    def validate_weight(cls, v):
        """Validate weight in pounds (stored as imperial, converted from user's preferred units)."""
        if v is not None:
            if v < 1.0 or v > 992.0:  # Consistent with frontend validation ranges
                raise ValueError("Weight must be between 1 and 992 pounds")
        return v

    @field_validator("physician_id")
    @classmethod
    def validate_physician_id(cls, v):
        """Validate physician ID."""
        return validate_positive_id(v, field_name="Physician ID")


class PatientCreate(PatientBase):
    """
    Schema for creating a new patient.

    Includes all fields from PatientBase. This is used when a new patient
    is created and linked to an existing user.

    Example:
        patient_data = PatientCreate(
            user_id=5,
            first_name="John",
            last_name="Doe",
            birth_date=date(1990, 1, 15),
            gender="M",
            address="123 Main St, City, State 12345"
        )
    """

    pass


class PatientUpdate(BaseModel):
    """
    Schema for updating an existing patient.

    All fields are optional, so users can update only the fields they want to change.
    Note: user_id should generally not be changed after creation.

    Example:
        update_data = PatientUpdate(
            address="456 New St, City, State 12345",
            gender="M",
            blood_type="A+",
            height=70,
            weight=180
        )
    """

    first_name: Optional[str] = None
    last_name: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    blood_type: Optional[str] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    physician_id: Optional[int] = None
    relationship_to_self: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def convert_empty_strings_to_none(cls, values):
        """Convert empty strings to None for optional fields"""
        return empty_strings_to_none(values, _ALL_OPTIONAL_FIELDS)

    @field_validator("first_name")
    @classmethod
    def validate_first_name(cls, v):
        """Validate first name if provided."""
        if v is None:
            return v
        if len(v.strip()) < 1:
            raise ValueError("First name cannot be empty")
        if len(v) > 50:
            raise ValueError("First name must be less than 50 characters")
        return v.strip().title()

    @field_validator("last_name")
    @classmethod
    def validate_last_name(cls, v):
        """Validate last name if provided."""
        if v is None:
            return v
        if len(v.strip()) < 1:
            raise ValueError("Last name cannot be empty")
        if len(v) > 50:
            raise ValueError("Last name must be less than 50 characters")
        return v.strip().title()

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v):
        """Validate gender if provided."""
        if v is None:
            return v
        return validate_gender(v)

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, v):
        """Validate birth date if provided."""
        return validate_date_not_future(v, field_name="Birth date", max_years_past=150)

    @field_validator("address")
    @classmethod
    def validate_address(cls, v):
        """Validate address if provided."""
        return validate_text_field(v, max_length=200, min_length=5, field_name="Address")

    @field_validator("blood_type")
    @classmethod
    def validate_blood_type(cls, v):
        """Validate blood type if provided."""
        return validate_blood_type(v)

    @field_validator("height")
    @classmethod
    def validate_height(cls, v):
        """Validate height if provided (stored as inches, converted from user's preferred units)."""
        if v is not None:
            if v < 12.0 or v > 108.0:  # 1 foot to 9 feet, consistent with frontend
                raise ValueError("Height must be between 12 and 108 inches")
        return v

    @field_validator("weight")
    @classmethod
    def validate_weight(cls, v):
        """Validate weight if provided (stored as pounds, converted from user's preferred units)."""
        if v is not None:
            if v < 1.0 or v > 992.0:  # Consistent with frontend validation ranges
                raise ValueError("Weight must be between 1 and 992 pounds")
        return v

    @field_validator("physician_id")
    @classmethod
    def validate_physician_id(cls, v):
        """Validate physician ID if provided."""
        return validate_positive_id(v, field_name="Physician ID")


class Patient(PatientBase):
    """
    Schema for reading/returning patient data.

    This includes all the base fields plus the database-generated id field.
    This is what gets returned when fetching patient data from the API.

    Example response:
        {
            "id": 1,
            "user_id": 5,
            "first_name": "John",
            "last_name": "Doe",
            "birth_date": "1990-01-15",
            "gender": "M",
            "address": "123 Main St, City, State 12345"
        }
    """

    id: int

    @model_validator(mode="before")
    @classmethod
    def convert_empty_strings_to_none_for_response(cls, values):
        """Convert empty strings to None for response validation"""
        return empty_strings_to_none(values, _OPTIONAL_FIELDS)

    @field_validator("gender")
    @classmethod
    def validate_gender_response(cls, v):
        """Validate gender for response, allowing None for empty values"""
        if v is None or v == "":
            return None
        # For response validation, return None for invalid values instead of raising
        try:
            return validate_gender(v)
        except ValueError:
            return None

    @field_validator("address")
    @classmethod
    def validate_address_response(cls, v):
        """Validate address for response, consistent with other validation methods"""
        if v is None or not v.strip():
            return None
        stripped = v.strip()
        # For response, silently handle invalid data rather than failing
        if len(stripped) < 5:
            return None
        if len(stripped) > 200:
            return stripped[:200]
        return stripped

    model_config = ConfigDict(from_attributes=True)


class PatientWithUser(Patient):
    """
    Schema for returning patient data with associated user information.

    This extends the base Patient schema to include user details.
    Useful when you need both patient and user information in API responses.
    """

    user: "User"

    model_config = ConfigDict(from_attributes=True)


class PatientResponse(Patient):
    """
    Schema for patient response (alias for Patient).

    This provides consistency with other model Response schemas.
    """

    pass


class PatientSearch(BaseModel):
    """
    Schema for patient search parameters.

    Used for advanced patient search functionality.

    Example:
        search_params = PatientSearch(
            name="John",
            gender="M",
            min_birth_year=1980,
            max_birth_year=1990
        )
    """

    name: Optional[str] = None
    gender: Optional[str] = None
    min_birth_year: Optional[int] = None
    max_birth_year: Optional[int] = None

    @field_validator("min_birth_year", "max_birth_year")
    @classmethod
    def validate_birth_years(cls, v):
        """Validate birth year is reasonable."""
        if v is None:
            return v
        current_year = date.today().year
        if v < current_year - 150 or v > current_year:
            raise ValueError(
                f"Birth year must be between {current_year - 150} and {current_year}"
            )
        return v
