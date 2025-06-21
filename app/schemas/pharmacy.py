from pydantic import BaseModel, validator, EmailStr
from typing import Optional
from datetime import datetime
import re


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

    @validator('name')
    def validate_name(cls, v):
        """
        Validate pharmacy name requirements.

        Args:
            v: The name value to validate

        Returns:
            Cleaned name (stripped whitespace)

        Raises:
            ValueError: If name doesn't meet requirements
        """
        if not v or len(v.strip()) < 3:
            raise ValueError('Pharmacy name must be at least 3 characters long')
        if len(v) > 150:
            raise ValueError('Pharmacy name must be less than 150 characters')
        return v.strip()   
     
    @validator('brand', pre=True)
    def validate_brand(cls, v):
        """
        Validate pharmacy brand field.

        Args:
            v: The brand value to validate

        Returns:
            Cleaned brand (stripped whitespace) or None

        Raises:
            ValueError: If brand is too short or too long
        """
        if v is None or v.strip() == "":
            return None
        if len(v.strip()) < 2:
            raise ValueError('Brand must be at least 2 characters long')
        if len(v) > 50:
            raise ValueError('Brand must be less than 50 characters')
        return v.strip()    
    
    @validator('street_address', pre=True)
    def validate_street_address(cls, v):
        """
        Validate street address field.

        Args:
            v: The street address value to validate

        Returns:
            Cleaned street address (stripped whitespace) or None

        Raises:
            ValueError: If street address is too short or too long
        """
        if v is None or v.strip() == "":
            return None
        if len(v.strip()) < 5:
            raise ValueError('Street address must be at least 5 characters long')
        if len(v) > 200:
            raise ValueError('Street address must be less than 200 characters')
        return v.strip()    
    
    @validator('city', pre=True)
    def validate_city(cls, v):
        """
        Validate city field.

        Args:
            v: The city value to validate

        Returns:
            Cleaned city (stripped whitespace) or None

        Raises:
            ValueError: If city is too short or too long
        """
        if v is None or v.strip() == "":
            return None
        if len(v.strip()) < 2:
            raise ValueError('City must be at least 2 characters long')
        if len(v) > 100:
            raise ValueError('City must be less than 100 characters')
        return v.strip()    
    
    @validator('state', pre=True)
    def validate_state(cls, v):
        """
        Validate state field.

        Args:
            v: The state value to validate

        Returns:
            Cleaned state (stripped whitespace) or None        Raises:
            ValueError: If state is too short or too long
        """
        if v is None or v.strip() == "":
            return None
        if len(v.strip()) < 2:
            raise ValueError('State must be at least 2 characters long')
        if len(v) > 50:
            raise ValueError('State must be less than 50 characters')
        # Could add specific US state validation here if needed        return v.strip()    
    
    @validator('zip_code', pre=True)
    def validate_zip_code(cls, v):
        """
        Validate ZIP code field.

        Supports US ZIP code formats:
        - 12345 (5-digit)
        - 12345-6789 (ZIP+4)

        Args:
            v: The ZIP code value to validate

        Returns:
            Cleaned ZIP code (stripped whitespace) or None

        Raises:        ValueError: If ZIP code format is invalid
        """
        if v is None or v.strip() == "":
            return None
        # Basic US ZIP code validation (5 digits or 5+4 format)
        zip_pattern = r'^\d{5}(-\d{4})?$'
        if not re.match(zip_pattern, v.strip()):
            raise ValueError('ZIP code must be in format 12345 or 12345-6789')
        return v.strip()    
    
    @validator('country', pre=True)
    def validate_country(cls, v):
        """
        Validate country field.

        Args:
            v: The country value to validate

        Returns:
            Cleaned country (stripped whitespace) or None

        Raises:
            ValueError: If country is too short or too long        """
        if v is None or v.strip() == "":
            return None
        if len(v.strip()) < 2:
            raise ValueError('Country must be at least 2 characters long')
        if len(v) > 50:
            raise ValueError('Country must be less than 50 characters')
        return v.strip()    
    
    @validator('phone_number', pre=True)
    def validate_phone_number(cls, v):
        """
        Validate and clean phone number field.
        
        Accepts various formats like:
        - (919) 555-1234
        - 919-555-1234  
        - 919.555.1234
        - 9195551234
        - +1 919 555 1234
        
        Stores as digits only for consistency.

        Args:
            v: The phone number value to validate

        Returns:
            Cleaned phone number (digits only) or None

        Raises:
            ValueError: If phone number format is invalid
        """
        if v is None or v.strip() == "":
            return None
        
        # Remove all non-digit characters for validation and storage
        digits_only = re.sub(r'[^\d]', '', v)
        
        # Handle international numbers with country code
        if digits_only.startswith('1') and len(digits_only) == 11:
            # US/Canada number with country code - remove the leading 1
            digits_only = digits_only[1:]
        
        # Check if it's a reasonable phone number length (10-15 digits)
        if len(digits_only) < 10 or len(digits_only) > 15:
            raise ValueError("Phone number must be between 10-15 digits")
          # Return digits only for consistent storage
        return digits_only

    @validator('fax_number', pre=True)
    def validate_fax_number(cls, v):
        """
        Validate and clean fax number field.
        
        Uses same validation logic as phone numbers.

        Args:
            v: The fax number value to validate

        Returns:
            Cleaned fax number (digits only) or None

        Raises:
            ValueError: If fax number format is invalid
        """
        if v is None or v.strip() == "":
            return None
          # Apply same validation as phone number
        digits_only = re.sub(r'[^\d]', '', v)
        
        if digits_only.startswith('1') and len(digits_only) == 11:
            digits_only = digits_only[1:]
        
        if len(digits_only) < 10 or len(digits_only) > 15:
            raise ValueError("Fax number must be between 10-15 digits")
        
        return digits_only

    @validator('website', pre=True)
    def validate_website(cls, v):
        """
        Validate website URL field.

        Args:
            v: The website URL value to validate

        Returns:
            Cleaned website URL with https:// prefix if needed

        Raises:
            ValueError: If website URL format is invalid
        """
        if v is None or v.strip() == "":
            return None
        
        # Enhanced URL validation similar to practitioner schema
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
            raise ValueError('Please enter a valid website URL')
        
        return cleaned_url

    @validator('store_number')
    def validate_store_number(cls, v):
        """
        Validate store number field.

        Args:
            v: The store number value to validate

        Returns:
            Cleaned store number (stripped whitespace) or None

        Raises:
            ValueError: If store number is too long
        """
        if v is None or v.strip() == "":
            return None
        if len(v) > 20:
            raise ValueError('Store number must be less than 20 characters')
        return v.strip()

    @validator('hours')
    def validate_hours(cls, v):
        """
        Validate operating hours field.

        Args:
            v: The hours value to validate

        Returns:
            Cleaned hours (stripped whitespace) or None

        Raises:
            ValueError: If hours text is too long
        """
        if v is None or v.strip() == "":
            return None
        if len(v) > 200:
            raise ValueError('Hours description must be less than 200 characters')
        return v.strip()

    @validator('specialty_services')
    def validate_specialty_services(cls, v):
        """
        Validate specialty services field.

        Args:
            v: The specialty services value to validate

        Returns:
            Cleaned specialty services (stripped whitespace) or None

        Raises:
            ValueError: If specialty services text is too long
        """
        if v is None or v.strip() == "":
            return None
        if len(v) > 500:
            raise ValueError('Specialty services description must be less than 500 characters')
        return v.strip()

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

    @validator('name')
    def validate_name(cls, v):
        """Validate name if provided."""
        if v is not None:
            if len(v.strip()) < 3:
                raise ValueError('Pharmacy name must be at least 3 characters long')
            if len(v) > 150:
                raise ValueError('Pharmacy name must be less than 150 characters')
            return v.strip()
        return v    @validator('brand')
    def validate_brand(cls, v):
        """Validate brand if provided."""
        if v is None or str(v).strip() == "":
            return None
        if len(v.strip()) < 2:
            raise ValueError('Brand must be at least 2 characters long')
        if len(v) > 50:
            raise ValueError('Brand must be less than 50 characters')
        return v.strip()    
    
    @validator('street_address')
    def validate_street_address(cls, v):
        """Validate street address if provided."""
        if v is None or str(v).strip() == "":
            return None
        if len(v.strip()) < 5:
            raise ValueError('Street address must be at least 5 characters long')
        if len(v) > 200:
            raise ValueError('Street address must be less than 200 characters')
        return v.strip()    
    
    @validator('city')
    def validate_city(cls, v):
        """Validate city if provided."""
        if v is None or str(v).strip() == "":
            return None
        if len(v.strip()) < 2:
            raise ValueError('City must be at least 2 characters long')
        if len(v) > 100:
            raise ValueError('City must be less than 100 characters')
        return v.strip()

    @validator('state')
    def validate_state(cls, v):
        """Validate state if provided."""
        if v is not None:
            if len(v.strip()) < 2:
                raise ValueError('State must be at least 2 characters long')
            if len(v) > 50:
                raise ValueError('State must be less than 50 characters')
            return v.strip()
        return v

    @validator('zip_code')
    def validate_zip_code(cls, v):
        """Validate ZIP code if provided."""
        if v is not None:
            if not v.strip():
                raise ValueError('ZIP code cannot be empty if provided')
            zip_pattern = r'^\d{5}(-\d{4})?$'
            if not re.match(zip_pattern, v.strip()):
                raise ValueError('ZIP code must be in format 12345 or 12345-6789')
            return v.strip()
        return v

    @validator('country')
    def validate_country(cls, v):
        """Validate country if provided."""
        if v is not None:
            if len(v.strip()) < 2:
                raise ValueError('Country must be at least 2 characters long')
            if len(v) > 50:
                raise ValueError('Country must be less than 50 characters')
            return v.strip()
        return v

    @validator('phone_number')
    def validate_phone_number(cls, v):
        """Validate phone number if provided."""
        if v is None or v.strip() == "":
            return None
        
        digits_only = re.sub(r'[^\d]', '', v)
        
        if digits_only.startswith('1') and len(digits_only) == 11:
            digits_only = digits_only[1:]
        
        if len(digits_only) < 10 or len(digits_only) > 15:
            raise ValueError("Phone number must be between 10-15 digits")
        
        return digits_only

    @validator('fax_number')
    def validate_fax_number(cls, v):
        """Validate fax number if provided."""
        if v is None or v.strip() == "":
            return None
        
        digits_only = re.sub(r'[^\d]', '', v)
        
        if digits_only.startswith('1') and len(digits_only) == 11:
            digits_only = digits_only[1:]
        
        if len(digits_only) < 10 or len(digits_only) > 15:
            raise ValueError("Fax number must be between 10-15 digits")
        
        return digits_only

    @validator('website')
    def validate_website(cls, v):
        """Validate website URL if provided."""
        if v is None or v.strip() == "":
            return None
        
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
            raise ValueError('Please enter a valid website URL')
        
        return cleaned_url

    @validator('store_number')
    def validate_store_number(cls, v):
        """Validate store number if provided."""
        if v is not None and len(v) > 20:
            raise ValueError('Store number must be less than 20 characters')
        return v.strip() if v else None

    @validator('hours')
    def validate_hours(cls, v):
        """Validate hours if provided."""
        if v is not None and len(v) > 200:
            raise ValueError('Hours description must be less than 200 characters')
        return v.strip() if v else None

    @validator('specialty_services')
    def validate_specialty_services(cls, v):
        """Validate specialty services if provided."""
        if v is not None and len(v) > 500:
            raise ValueError('Specialty services description must be less than 500 characters')
        return v.strip() if v else None


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

    class Config:
        """
        Pydantic configuration.

        from_attributes = True allows Pydantic to work with SQLAlchemy models
        by reading data from attributes instead of expecting a dictionary.
        """
        from_attributes = True


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

    class Config:
        from_attributes = True


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

    @validator("name")
    def validate_name_search(cls, v):
        """Validate search name parameter."""
        if v is not None and len(v.strip()) < 1:
            raise ValueError("Search name must not be empty")
        return v.strip() if v else v

    @validator("brand")
    def validate_brand_search(cls, v):
        """Validate search brand parameter."""
        if v is not None and len(v.strip()) < 1:
            raise ValueError("Search brand must not be empty")
        return v.strip() if v else v

    @validator("city")
    def validate_city_search(cls, v):
        """Validate search city parameter."""
        if v is not None and len(v.strip()) < 1:
            raise ValueError("Search city must not be empty")
        return v.strip() if v else v

    @validator("state")
    def validate_state_search(cls, v):
        """Validate search state parameter."""
        if v is not None and len(v.strip()) < 1:
            raise ValueError("Search state must not be empty")
        return v.strip() if v else v

    @validator("zip_code")
    def validate_zip_code_search(cls, v):
        """Validate search ZIP code parameter."""
        if v is not None:
            zip_pattern = r'^\d{5}(-\d{4})?$'
            if not re.match(zip_pattern, v.strip()):
                raise ValueError('ZIP code must be in format 12345 or 12345-6789')
        return v.strip() if v else v


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

    class Config:
        from_attributes = True