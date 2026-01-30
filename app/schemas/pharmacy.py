from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from app.schemas.validators import (
    validate_phone_number,
    validate_required_text,
    validate_text_field,
    validate_url,
    validate_zip_code,
)


class PharmacyBase(BaseModel):
    """
    Base Pharmacy schema with common fields.

    Contains the core fields shared across different Pharmacy schemas.
    Pharmacies are medication providers that dispense prescriptions and
    provide pharmaceutical services to patients.
    """

    name: str
    brand: Optional[str] = None
    street_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    store_number: Optional[str] = None
    phone_number: Optional[str] = None
    fax_number: Optional[str] = None
    email: Optional[EmailStr] = None
    website: Optional[str] = None
    hours: Optional[str] = None
    drive_through: Optional[bool] = False
    twenty_four_hour: Optional[bool] = False
    specialty_services: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        """Validate pharmacy name requirements."""
        return validate_required_text(v, max_length=150, min_length=3, field_name="Pharmacy name")

    @field_validator("brand", mode="before")
    @classmethod
    def validate_brand(cls, v):
        """Validate pharmacy brand field."""
        return validate_text_field(v, max_length=50, min_length=2, field_name="Brand")

    @field_validator("street_address", mode="before")
    @classmethod
    def validate_street_address(cls, v):
        """Validate street address field."""
        return validate_text_field(v, max_length=200, min_length=5, field_name="Street address")

    @field_validator("city", mode="before")
    @classmethod
    def validate_city(cls, v):
        """Validate city field."""
        return validate_text_field(v, max_length=100, min_length=2, field_name="City")

    @field_validator("state", mode="before")
    @classmethod
    def validate_state(cls, v):
        """Validate state field."""
        return validate_text_field(v, max_length=50, min_length=2, field_name="State")

    @field_validator("zip_code", mode="before")
    @classmethod
    def validate_zip_code(cls, v):
        """Validate ZIP code field."""
        return validate_zip_code(v)

    @field_validator("country", mode="before")
    @classmethod
    def validate_country(cls, v):
        """Validate country field."""
        return validate_text_field(v, max_length=50, min_length=2, field_name="Country")

    @field_validator("phone_number", mode="before")
    @classmethod
    def validate_phone_number(cls, v):
        """Validate and clean phone number field."""
        return validate_phone_number(v, field_name="Phone number")

    @field_validator("fax_number", mode="before")
    @classmethod
    def validate_fax_number(cls, v):
        """Validate and clean fax number field."""
        return validate_phone_number(v, field_name="Fax number")

    @field_validator("website", mode="before")
    @classmethod
    def validate_website(cls, v):
        """Validate website URL field."""
        return validate_url(v, field_name="Website URL")

    @field_validator("store_number")
    @classmethod
    def validate_store_number(cls, v):
        """Validate store number field."""
        return validate_text_field(v, max_length=20, field_name="Store number")

    @field_validator("hours")
    @classmethod
    def validate_hours(cls, v):
        """Validate operating hours field."""
        return validate_text_field(v, max_length=200, field_name="Hours description")

    @field_validator("specialty_services")
    @classmethod
    def validate_specialty_services(cls, v):
        """Validate specialty services field."""
        return validate_text_field(v, max_length=500, field_name="Specialty services description")


class PharmacyCreate(PharmacyBase):
    """
    Schema for creating a new pharmacy.

    Includes all fields from PharmacyBase.
    Used when adding a new pharmacy to the system.

    Example:
        pharmacy_data = PharmacyCreate(
            name="CVS Pharmacy - Main Street",
            brand="CVS",
            street_address="123 Main St",
            city="Anytown",
            state="NC",
            zip_code="27514"
        )
    """

    pass


class PharmacyUpdate(BaseModel):
    """
    Schema for updating an existing pharmacy.

    All fields are optional, so pharmacies can be updated partially.

    Example:
        update_data = PharmacyUpdate(
            phone_number="9195551234",
            hours="Mon-Fri: 8AM-10PM, Sat-Sun: 9AM-9PM"
        )
    """

    name: Optional[str] = None
    brand: Optional[str] = None
    street_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    store_number: Optional[str] = None
    phone_number: Optional[str] = None
    fax_number: Optional[str] = None
    email: Optional[EmailStr] = None
    website: Optional[str] = None
    hours: Optional[str] = None
    drive_through: Optional[bool] = None
    twenty_four_hour: Optional[bool] = None
    specialty_services: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        """Validate name if provided."""
        if v is None:
            return v
        if len(v.strip()) < 3:
            raise ValueError("Pharmacy name must be at least 3 characters long")
        if len(v) > 150:
            raise ValueError("Pharmacy name must be less than 150 characters")
        return v.strip()

    @field_validator("brand")
    @classmethod
    def validate_brand(cls, v):
        """Validate brand if provided."""
        return validate_text_field(v, max_length=50, min_length=2, field_name="Brand")

    @field_validator("street_address")
    @classmethod
    def validate_street_address(cls, v):
        """Validate street address if provided."""
        return validate_text_field(v, max_length=200, min_length=5, field_name="Street address")

    @field_validator("city")
    @classmethod
    def validate_city(cls, v):
        """Validate city if provided."""
        return validate_text_field(v, max_length=100, min_length=2, field_name="City")

    @field_validator("state")
    @classmethod
    def validate_state(cls, v):
        """Validate state if provided."""
        if v is None:
            return v
        return validate_text_field(v, max_length=50, min_length=2, field_name="State")

    @field_validator("zip_code")
    @classmethod
    def validate_zip_code(cls, v):
        """Validate ZIP code if provided."""
        if v is None:
            return v
        return validate_zip_code(v)

    @field_validator("country")
    @classmethod
    def validate_country(cls, v):
        """Validate country if provided."""
        if v is None:
            return v
        return validate_text_field(v, max_length=50, min_length=2, field_name="Country")

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, v):
        """Validate phone number if provided."""
        return validate_phone_number(v, field_name="Phone number")

    @field_validator("fax_number")
    @classmethod
    def validate_fax_number(cls, v):
        """Validate fax number if provided."""
        return validate_phone_number(v, field_name="Fax number")

    @field_validator("website")
    @classmethod
    def validate_website(cls, v):
        """Validate website URL if provided."""
        return validate_url(v, field_name="Website URL")

    @field_validator("store_number")
    @classmethod
    def validate_store_number(cls, v):
        """Validate store number if provided."""
        return validate_text_field(v, max_length=20, field_name="Store number")

    @field_validator("hours")
    @classmethod
    def validate_hours(cls, v):
        """Validate hours if provided."""
        return validate_text_field(v, max_length=200, field_name="Hours description")

    @field_validator("specialty_services")
    @classmethod
    def validate_specialty_services(cls, v):
        """Validate specialty services if provided."""
        return validate_text_field(v, max_length=500, field_name="Specialty services description")


class Pharmacy(PharmacyBase):
    """
    Schema for reading/returning pharmacy data.

    This includes all the base fields plus the database-generated fields.
    This is what gets returned when fetching pharmacy data from the API.

    Example response:
        {
            "id": 1,
            "name": "CVS Pharmacy - Main Street",
            "brand": "CVS",
            "street_address": "123 Main St",
            "city": "Anytown",
            "state": "NC",
            "zip_code": "27514",
            "created_at": "2025-06-21T10:00:00",
            "updated_at": "2025-06-21T10:00:00"
        }
    """

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PharmacySummary(BaseModel):
    """
    Schema for pharmacy summary information.

    Lightweight version used in lists or when full details aren't needed.

    Example:
        {
            "id": 1,
            "name": "CVS Pharmacy - Main Street",
            "brand": "CVS",
            "city": "Anytown",
            "state": "NC"
        }
    """

    id: int
    name: str
    brand: Optional[str] = None
    city: str
    state: str

    model_config = ConfigDict(from_attributes=True)


class PharmacyResponse(Pharmacy):
    """
    Schema for pharmacy response (alias for Pharmacy).

    This provides consistency with other model Response schemas.
    """

    pass


class PharmacySearch(BaseModel):
    """
    Schema for pharmacy search parameters.

    Used for search endpoints to validate search criteria.

    Example:
        search_params = PharmacySearch(
            name="CVS",
            city="Anytown",
            state="NC"
        )
    """

    name: Optional[str] = None
    brand: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    drive_through: Optional[bool] = None
    twenty_four_hour: Optional[bool] = None

    @field_validator("name", "brand", "city", "state")
    @classmethod
    def validate_search_text(cls, v):
        """Validate search text parameters are not empty if provided."""
        if v is not None and len(v.strip()) < 1:
            raise ValueError("Search value must not be empty")
        return v.strip() if v else v

    @field_validator("zip_code")
    @classmethod
    def validate_zip_code_search(cls, v):
        """Validate search ZIP code parameter."""
        if v is None:
            return v
        return validate_zip_code(v)


class PharmacyWithStats(Pharmacy):
    """
    Schema for pharmacy with usage statistics.

    Extends the base Pharmacy schema with additional computed fields
    showing how often this pharmacy is referenced.

    Example:
        {
            "id": 1,
            "name": "CVS Pharmacy - Main Street",
            "brand": "CVS",
            "total_medications": 150,
            "active_medications": 45,
            "total_patients_served": 120
        }
    """

    total_medications: Optional[int] = 0
    active_medications: Optional[int] = 0
    total_patients_served: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)
