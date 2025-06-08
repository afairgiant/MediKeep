from pydantic import BaseModel, validator
from typing import Optional, TYPE_CHECKING
from datetime import date

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
    birthDate: date
    gender: str
    address: str
    
    @validator('first_name')
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
            raise ValueError('First name is required')
        if len(v) > 50:
            raise ValueError('First name must be less than 50 characters')
        return v.strip().title()  # Capitalize first letter
    
    @validator('last_name')
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
            raise ValueError('Last name is required')
        if len(v) > 50:
            raise ValueError('Last name must be less than 50 characters')
        return v.strip().title()  # Capitalize first letter
    
    @validator('gender')
    def validate_gender(cls, v):
        """
        Validate that the gender is one of the allowed values.
        
        Args:
            v: The gender value to validate
            
        Returns:
            Cleaned gender (uppercase)
            
        Raises:
            ValueError: If gender is not in allowed list
        """
        allowed_genders = ['M', 'F', 'MALE', 'FEMALE', 'OTHER', 'U', 'UNKNOWN']
        if v.upper() not in allowed_genders:
            raise ValueError(f'Gender must be one of: {", ".join(allowed_genders)}')
        
        # Normalize common values
        gender_map = {
            'MALE': 'M',
            'FEMALE': 'F',
            'UNKNOWN': 'U'
        }
        return gender_map.get(v.upper(), v.upper())
    
    @validator('birthDate')
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
            raise ValueError('Birth date cannot be in the future')
        
        # Check if birth date is more than 150 years ago
        if today.year - v.year > 150:
            raise ValueError('Birth date cannot be more than 150 years ago')
        
        return v
    
    @validator('address')
    def validate_address(cls, v):
        """
        Validate address requirements.
        
        Args:
            v: The address value to validate
            
        Returns:
            Cleaned address (stripped whitespace)
            
        Raises:
            ValueError: If address is empty or too long
        """
        if not v or len(v.strip()) < 5:
            raise ValueError('Address must be at least 5 characters long')
        if len(v) > 200:
            raise ValueError('Address must be less than 200 characters')
        return v.strip()

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
            birthDate=date(1990, 1, 15),
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
            gender="M"
        )
    """
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    birthDate: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    
    @validator('first_name')
    def validate_first_name(cls, v):
        """Validate first name if provided."""
        if v is not None:
            if len(v.strip()) < 1:
                raise ValueError('First name cannot be empty')
            if len(v) > 50:
                raise ValueError('First name must be less than 50 characters')
            return v.strip().title()
        return v
    
    @validator('last_name')
    def validate_last_name(cls, v):
        """Validate last name if provided."""
        if v is not None:
            if len(v.strip()) < 1:
                raise ValueError('Last name cannot be empty')
            if len(v) > 50:
                raise ValueError('Last name must be less than 50 characters')
            return v.strip().title()
        return v
    
    @validator('gender')
    def validate_gender(cls, v):
        """Validate gender if provided."""
        if v is not None:
            allowed_genders = ['M', 'F', 'MALE', 'FEMALE', 'OTHER', 'U', 'UNKNOWN']
            if v.upper() not in allowed_genders:
                raise ValueError(f'Gender must be one of: {", ".join(allowed_genders)}')
            
            gender_map = {
                'MALE': 'M',
                'FEMALE': 'F',
                'UNKNOWN': 'U'
            }
            return gender_map.get(v.upper(), v.upper())
        return v
    
    @validator('birthDate')
    def validate_birth_date(cls, v):
        """Validate birth date if provided."""
        if v is not None:
            from datetime import date
            
            today = date.today()
            if v > today:
                raise ValueError('Birth date cannot be in the future')
            
            if today.year - v.year > 150:
                raise ValueError('Birth date cannot be more than 150 years ago')
        return v
    
    @validator('address')
    def validate_address(cls, v):
        """Validate address if provided."""
        if v is not None:
            if len(v.strip()) < 5:
                raise ValueError('Address must be at least 5 characters long')
            if len(v) > 200:
                raise ValueError('Address must be less than 200 characters')
            return v.strip()
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
            "birthDate": "1990-01-15",
            "gender": "M",
            "address": "123 Main St, City, State 12345"
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

class PatientWithUser(Patient):
    """
    Schema for returning patient data with associated user information.
    
    This extends the base Patient schema to include user details.
    Useful when you need both patient and user information in API responses.
    """
    user: "User"
    
    class Config:
        from_attributes = True

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
    
    @validator('min_birth_year', 'max_birth_year')
    def validate_birth_years(cls, v):
        """Validate birth year is reasonable."""
        if v is not None:
            from datetime import date
            current_year = date.today().year
            
            if v < current_year - 150 or v > current_year:
                raise ValueError(f'Birth year must be between {current_year - 150} and {current_year}')
        return v
