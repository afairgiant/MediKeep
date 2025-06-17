from pydantic import BaseModel, validator
from typing import Optional
import re


class PractitionerBase(BaseModel):
    """
    Base Practitioner schema with common fields.

    Contains the core fields shared across different Practitioner schemas.
    Practitioners are healthcare providers (doctors, nurses, specialists, etc.)
    """

    name: str
    specialty: str
    practice: str
    phone_number: Optional[str] = None
    website: Optional[str] = None
    rating: Optional[float] = None

    @validator("name")
    def validate_name(cls, v):
        """
        Validate practitioner name requirements.

        Args:
            v: The name value to validate

        Returns:
            Cleaned name (stripped whitespace)

        Raises:
            ValueError: If name doesn't meet requirements
        """
        if not v or len(v.strip()) < 2:
            raise ValueError("Practitioner name must be at least 2 characters long")
        if len(v) > 100:
            raise ValueError("Practitioner name must be less than 100 characters")
        return v.strip()

    @validator("specialty")
    def validate_specialty(cls, v):
        """
        Validate specialty field.

        Args:
            v: The specialty value to validate

        Returns:
            Cleaned specialty (stripped whitespace)

        Raises:
            ValueError: If specialty is empty or too long
        """
        if not v or len(v.strip()) < 2:
            raise ValueError("Specialty must be at least 2 characters long")
        if len(v) > 100:
            raise ValueError("Specialty must be less than 100 characters")
        return v.strip()

    @validator("practice")
    def validate_practice(cls, v):
        """
        Validate practice field.

        Args:
            v: The practice value to validate

        Returns:
            Cleaned practice (stripped whitespace)

        Raises:
            ValueError: If practice is empty or too long
        """
        if not v or len(v.strip()) < 2:
            raise ValueError("Practice must be at least 2 characters long")
        if len(v) > 100:
            raise ValueError("Practice must be less than 100 characters")
        return v.strip()

    @validator("phone_number")
    def validate_phone_number(cls, v):
        """
        Validate phone number field.

        Args:
            v: The phone number value to validate

        Returns:
            Cleaned phone number

        Raises:
            ValueError: If phone number format is invalid
        """
        if v is None or v.strip() == "":
            return None
        
        # Remove all non-digit characters for validation
        digits_only = re.sub(r'[^\d]', '', v)
        
        # Check if it's a reasonable phone number length (10-15 digits)
        if len(digits_only) < 10 or len(digits_only) > 15:
            raise ValueError("Phone number must be between 10-15 digits")
        
        return v.strip()

    @validator("website")
    def validate_website(cls, v):
        """
        Validate website URL field.

        Args:
            v: The website URL value to validate

        Returns:
            Cleaned website URL

        Raises:
            ValueError: If website URL format is invalid
        """
        if v is None or v.strip() == "":
            return None
        
        # Basic URL validation
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
            r'localhost|'  # localhost...
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)
        
        cleaned_url = v.strip()
        
        # Add https:// if no protocol specified
        if not cleaned_url.startswith(('http://', 'https://')):
            cleaned_url = 'https://' + cleaned_url
        
        if not url_pattern.match(cleaned_url):
            raise ValueError("Please enter a valid website URL")
        
        return cleaned_url

    @validator("rating")
    def validate_rating(cls, v):
        """
        Validate rating field.

        Args:
            v: The rating value to validate

        Returns:
            Validated rating

        Raises:
            ValueError: If rating is not between 0 and 5
        """
        if v is None:
            return None
        
        if not isinstance(v, (int, float)):
            raise ValueError("Rating must be a number")
        
        if v < 0 or v > 5:
            raise ValueError("Rating must be between 0 and 5")
        
        return round(float(v), 1)  # Round to 1 decimal place


class PractitionerCreate(PractitionerBase):
    """
    Schema for creating a new practitioner.

    Includes all fields from PractitionerBase.
    Used when adding a new healthcare provider to the system.

    Example:
        practitioner_data = PractitionerCreate(
            name="Dr. John Smith",
            specialty="Cardiology"
        )
    """

    pass


class PractitionerUpdate(BaseModel):
    """
    Schema for updating an existing practitioner.

    All fields are optional, so practitioners can be updated partially.

    Example:
        update_data = PractitionerUpdate(        update_data = PractitionerUpdate(
            specialty="Internal Medicine"
        )
    """

    name: Optional[str] = None
    specialty: Optional[str] = None
    practice: Optional[str] = None
    phone_number: Optional[str] = None
    website: Optional[str] = None
    rating: Optional[float] = None

    @validator("name")
    def validate_name(cls, v):
        """Validate name if provided."""
        if v is not None:
            if len(v.strip()) < 2:
                raise ValueError("Practitioner name must be at least 2 characters long")
            if len(v) > 100:
                raise ValueError("Practitioner name must be less than 100 characters")
            return v.strip()
        return v

    @validator("specialty")
    def validate_specialty(cls, v):
        """Validate specialty if provided."""
        if v is not None:
            if len(v.strip()) < 2:
                raise ValueError("Specialty must be at least 2 characters long")
            if len(v) > 100:
                raise ValueError("Specialty must be less than 100 characters")
            return v.strip()
        return v

    @validator("practice")
    def validate_practice(cls, v):
        """Validate practice if provided."""
        if v is not None:
            if len(v.strip()) < 2:
                raise ValueError("Practice must be at least 2 characters long")
            if len(v) > 100:
                raise ValueError("Practice must be less than 100 characters")
            return v.strip()
        return v

    @validator("phone_number")
    def validate_phone_number_update(cls, v):
        """Validate phone number if provided."""
        if v is None or v.strip() == "":
            return None
        
        # Remove all non-digit characters for validation
        digits_only = re.sub(r'[^\d]', '', v)
        
        # Check if it's a reasonable phone number length (10-15 digits)
        if len(digits_only) < 10 or len(digits_only) > 15:
            raise ValueError("Phone number must be between 10-15 digits")
        
        return v.strip()

    @validator("website")
    def validate_website_update(cls, v):
        """Validate website URL if provided."""
        if v is None or v.strip() == "":
            return None
        
        # Basic URL validation
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
            r'localhost|'  # localhost...
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE)
        
        cleaned_url = v.strip()
        
        # Add https:// if no protocol specified
        if not cleaned_url.startswith(('http://', 'https://')):
            cleaned_url = 'https://' + cleaned_url
        
        if not url_pattern.match(cleaned_url):
            raise ValueError("Please enter a valid website URL")
        
        return cleaned_url

    @validator("rating")
    def validate_rating_update(cls, v):
        """Validate rating if provided."""
        if v is None:
            return None
        
        if not isinstance(v, (int, float)):
            raise ValueError("Rating must be a number")
        
        if v < 0 or v > 5:
            raise ValueError("Rating must be between 0 and 5")
        
        return round(float(v), 1)  # Round to 1 decimal place


class Practitioner(PractitionerBase):
    """
    Schema for reading/returning practitioner data.

    This includes all the base fields plus the database-generated id field.
    This is what gets returned when fetching practitioner data from the API.

    Example response:
        {
            "id": 1,
            "name": "Dr. John Smith",
            "specialty": "Cardiology"
        }
    """

    id: int

    class Config:
        """
        Pydantic configuration.

        from_attributes = True allows Pydantic to work with SQLAlchemy models
        by reading data from attributes instead of expecting a dictionary.
        """

        from_attributes = True


class PractitionerSummary(BaseModel):
    """
    Schema for practitioner summary information.

    Lightweight version used in lists or when full details aren't needed.

    Example:
        {
            "id": 1,
            "name": "Dr. John Smith",
            "specialty": "Cardiology"
        }
    """

    id: int
    name: str
    specialty: str

    class Config:
        from_attributes = True


class PractitionerResponse(Practitioner):
    """
    Schema for practitioner response (alias for Practitioner).

    This provides consistency with other model Response schemas.
    """

    pass


class PractitionerSearch(BaseModel):
    """
    Schema for practitioner search parameters.

    Used for search endpoints to validate search criteria.

    Example:
        search_params = PractitionerSearch(
            name="Smith",
            specialty="Cardiology"
        )
    """

    name: Optional[str] = None
    specialty: Optional[str] = None

    @validator("name")
    def validate_name_search(cls, v):
        """Validate search name parameter."""
        if v is not None and len(v.strip()) < 1:
            raise ValueError("Search name must not be empty")
        return v.strip() if v else v

    @validator("specialty")
    def validate_specialty_search(cls, v):
        """Validate search specialty parameter."""
        if v is not None and len(v.strip()) < 1:
            raise ValueError("Search specialty must not be empty")
        return v.strip() if v else v


class PractitionerWithStats(Practitioner):
    """
    Schema for practitioner with usage statistics.

    Extends the base Practitioner schema with additional computed fields
    showing how often this practitioner is referenced.

    Example:
        {
            "id": 1,
            "name": "Dr. John Smith",
            "specialty": "Cardiology",
            "total_encounters": 25,
            "total_procedures": 15,
            "total_treatments": 30
        }
    """

    total_encounters: Optional[int] = 0
    total_procedures: Optional[int] = 0
    total_treatments: Optional[int] = 0
    total_lab_results: Optional[int] = 0
    total_conditions: Optional[int] = 0
    total_immunizations: Optional[int] = 0

    class Config:
        from_attributes = True
