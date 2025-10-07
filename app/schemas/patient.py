from datetime import date
from typing import TYPE_CHECKING, Optional

from pydantic import BaseModel, root_validator, validator

if TYPE_CHECKING:
    from schemas.user import User


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

    @root_validator(pre=True)
    def convert_empty_strings_to_none(cls, values):
        """Convert empty strings to None for optional fields"""
        if isinstance(values, dict):
            for field in [
                "gender",
                "address",
                "blood_type",
                "height",
                "weight",
                "physician_id",
                "relationship_to_self",
            ]:
                if field in values and values[field] == "":
                    values[field] = None
        return values

    @validator("first_name")
    def validate_first_name(cls, v):
        """
        Validate first name requirements.

        Args:
            v: The first name value to validate

        Returns:
            Cleaned first name (stripped whitespace)

        Raises:
            ValueError: If first name is empty or too long
        """
        if not v or len(v.strip()) < 1:
            raise ValueError("First name is required")
        if len(v) > 50:
            raise ValueError("First name must be less than 50 characters")
        return v.strip().title()  # Capitalize first letter

    @validator("last_name")
    def validate_last_name(cls, v):
        """
        Validate last name requirements.

        Args:
            v: The last name value to validate

        Returns:
            Cleaned last name (stripped whitespace)

        Raises:
            ValueError: If last name is empty or too long
        """
        if not v or len(v.strip()) < 1:
            raise ValueError("Last name is required")
        if len(v) > 50:
            raise ValueError("Last name must be less than 50 characters")
        return v.strip().title()  # Capitalize first letter

    @validator("gender")
    def validate_gender(cls, v):
        """
        Validate that the gender is one of the allowed values.

        Args:
            v: The gender value to validate

        Returns:
            Cleaned gender (uppercase) or None

        Raises:
            ValueError: If gender is not in allowed list
        """
        if v is not None and v != "":
            allowed_genders = ["M", "F", "MALE", "FEMALE", "OTHER", "U", "UNKNOWN"]
            if v.upper() not in allowed_genders:
                raise ValueError(f"Gender must be one of: {', '.join(allowed_genders)}")

            # Normalize common values
            gender_map = {"MALE": "M", "FEMALE": "F", "UNKNOWN": "U"}
            return gender_map.get(v.upper(), v.upper())
        return None if v == "" else v

    @validator("birth_date")
    def validate_birth_date(cls, v):
        """
        Validate birth date is reasonable.

        Args:
            v: The birth date value to validate

        Returns:
            The birth date (unchanged)

        Raises:
            ValueError: If birth date is in the future or too far in the past
        """
        from datetime import date

        today = date.today()
        if v > today:
            raise ValueError("Birth date cannot be in the future")

        # Check if birth date is more than 150 years ago
        if today.year - v.year > 150:
            raise ValueError("Birth date cannot be more than 150 years ago")

        return v

    @validator("address")
    def validate_address(cls, v):
        """
        Validate address requirements.

        Args:
            v: The address value to validate

        Returns:
            Cleaned address (stripped whitespace) or None

        Raises:
            ValueError: If address is too long
        """
        if v is not None and v.strip():
            if len(v.strip()) < 5:
                raise ValueError("Address must be at least 5 characters long")
            if len(v) > 200:
                raise ValueError("Address must be less than 200 characters")
            return v.strip()
        return None

    @validator("blood_type")
    def validate_blood_type(cls, v):
        """
        Validate blood type format.

        Args:
            v: The blood type value to validate

        Returns:
            Cleaned blood type (uppercase) or None

        Raises:
            ValueError: If blood type is not in valid format
        """
        if v is not None and v.strip():
            # Common blood types
            valid_blood_types = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
            blood_type_upper = v.upper().strip()

            if blood_type_upper not in valid_blood_types:
                raise ValueError(
                    f"Blood type must be one of: {', '.join(valid_blood_types)}"
                )

            return blood_type_upper
        return None

    @validator("height")
    def validate_height(cls, v):
        """
        Validate height in inches (stored as imperial, converted from user's preferred units).

        Args:
            v: The height value to validate

        Returns:
            Height value or None

        Raises:
            ValueError: If height is not reasonable
        """
        if v is not None:
            if v < 12.0 or v > 108.0:  # 1 foot to 9 feet, consistent with frontend
                raise ValueError("Height must be between 12 and 108 inches")
        return v

    @validator("weight")
    def validate_weight(cls, v):
        """
        Validate weight in pounds (stored as imperial, converted from user's preferred units).

        Args:
            v: The weight value to validate

        Returns:
            Weight value or None

        Raises:
            ValueError: If weight is not reasonable
        """
        if v is not None:
            if v < 1.0 or v > 992.0:  # Consistent with frontend validation ranges
                raise ValueError("Weight must be between 1 and 992 pounds")
        return v

    @validator("physician_id")
    def validate_physician_id(cls, v):
        """
        Validate physician ID.

        Args:
            v: The physician ID value to validate

        Returns:
            Physician ID or None

        Raises:
            ValueError: If physician ID is not positive
        """
        if v is not None:
            if v <= 0:
                raise ValueError("Physician ID must be a positive integer")
        return v


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

    @root_validator(pre=True)
    def convert_empty_strings_to_none(cls, values):
        """Convert empty strings to None for optional fields"""
        if isinstance(values, dict):
            for field in [
                "first_name",
                "last_name",
                "birth_date",
                "gender",
                "address",
                "blood_type",
                "height",
                "weight",
                "physician_id",
                "relationship_to_self",
            ]:
                if field in values and values[field] == "":
                    values[field] = None
        return values

    @validator("first_name")
    def validate_first_name(cls, v):
        """Validate first name if provided."""
        if v is not None:
            if len(v.strip()) < 1:
                raise ValueError("First name cannot be empty")
            if len(v) > 50:
                raise ValueError("First name must be less than 50 characters")
            return v.strip().title()
        return v

    @validator("last_name")
    def validate_last_name(cls, v):
        """Validate last name if provided."""
        if v is not None:
            if len(v.strip()) < 1:
                raise ValueError("Last name cannot be empty")
            if len(v) > 50:
                raise ValueError("Last name must be less than 50 characters")
            return v.strip().title()
        return v

    @validator("gender")
    def validate_gender(cls, v):
        """Validate gender if provided."""
        if v is not None:
            allowed_genders = ["M", "F", "MALE", "FEMALE", "OTHER", "U", "UNKNOWN"]
            if v.upper() not in allowed_genders:
                raise ValueError(f"Gender must be one of: {', '.join(allowed_genders)}")

            gender_map = {"MALE": "M", "FEMALE": "F", "UNKNOWN": "U"}
            return gender_map.get(v.upper(), v.upper())
        return v

    @validator("birth_date")
    def validate_birth_date(cls, v):
        """Validate birth date if provided."""
        if v is not None:
            from datetime import date

            today = date.today()
            if v > today:
                raise ValueError("Birth date cannot be in the future")

            if today.year - v.year > 150:
                raise ValueError("Birth date cannot be more than 150 years ago")
        return v

    @validator("address")
    def validate_address(cls, v):
        """Validate address if provided."""
        if v is not None and v.strip():
            if len(v.strip()) < 5:
                raise ValueError("Address must be at least 5 characters long")
            if len(v) > 200:
                raise ValueError("Address must be less than 200 characters")
            return v.strip()
        return None

    @validator("blood_type")
    def validate_blood_type(cls, v):
        """Validate blood type if provided."""
        if v is not None and v.strip():
            valid_blood_types = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
            blood_type_upper = v.upper().strip()

            if blood_type_upper not in valid_blood_types:
                raise ValueError(
                    f"Blood type must be one of: {', '.join(valid_blood_types)}"
                )

            return blood_type_upper
        return None

    @validator("height")
    def validate_height(cls, v):
        """Validate height if provided (stored as inches, converted from user's preferred units)."""
        if v is not None:
            if v < 12.0 or v > 108.0:  # 1 foot to 9 feet, consistent with frontend
                raise ValueError("Height must be between 12 and 108 inches")
        return v

    @validator("weight")
    def validate_weight(cls, v):
        """Validate weight if provided (stored as pounds, converted from user's preferred units)."""
        if v is not None:
            if v < 1.0 or v > 992.0:  # Consistent with frontend validation ranges
                raise ValueError("Weight must be between 1 and 992 pounds")
        return v

    @validator("physician_id")
    def validate_physician_id(cls, v):
        """Validate physician ID if provided."""
        if v is not None:
            if v <= 0:
                raise ValueError("Physician ID must be a positive integer")
        return v


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

    @root_validator(pre=True)
    def convert_empty_strings_to_none_for_response(cls, values):
        """Convert empty strings to None for response validation"""
        if isinstance(values, dict):
            for field in [
                "gender",
                "address",
                "blood_type",
                "height",
                "weight",
                "physician_id",
                "relationship_to_self",
            ]:
                if field in values and values[field] == "":
                    values[field] = None
        return values

    @validator("gender")
    def validate_gender_response(cls, v):
        """Validate gender for response, allowing None for empty values"""
        if v is not None and v != "":
            allowed_genders = ["M", "F", "MALE", "FEMALE", "OTHER", "U", "UNKNOWN"]
            if v.upper() not in allowed_genders:
                # For response validation, return None instead of raising error
                return None
            gender_map = {"MALE": "M", "FEMALE": "F", "UNKNOWN": "U"}
            return gender_map.get(v.upper(), v.upper())
        return None

    @validator("address")
    def validate_address_response(cls, v):
        """Validate address for response, consistent with other validation methods"""
        if v is not None and v.strip():
            # Use same validation logic as other classes for consistency
            if len(v.strip()) < 5:
                # For response, silently return None for invalid data rather than failing
                return None
            if len(v) > 200:
                # Truncate if too long rather than failing in response validation
                return v.strip()[:200]
            return v.strip()
        return None

    class Config:
        """
        Pydantic configuration.

        from_attributes = True allows Pydantic to work with SQLAlchemy models
        by reading data from attributes instead of expecting a dictionary.
        """

        from_attributes = True


class PatientWithUser(Patient):
    """
    Schema for returning patient data with associated user information.

    This extends the base Patient schema to include user details.
    Useful when you need both patient and user information in API responses.
    """

    user: "User"

    class Config:
        from_attributes = True


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

    @validator("min_birth_year", "max_birth_year")
    def validate_birth_years(cls, v):
        """Validate birth year is reasonable."""
        if v is not None:
            from datetime import date

            current_year = date.today().year

            if v < current_year - 150 or v > current_year:
                raise ValueError(
                    f"Birth year must be between {current_year - 150} and {current_year}"
                )
        return v
