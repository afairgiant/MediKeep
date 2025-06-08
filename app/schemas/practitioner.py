from pydantic import BaseModel, validator
from typing import Optional

class PractitionerBase(BaseModel):
    """
    Base Practitioner schema with common fields.
    
    Contains the core fields shared across different Practitioner schemas.
    Practitioners are healthcare providers (doctors, nurses, specialists, etc.)
    """
    name: str
    specialty: str
    
    @validator('name')
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
            raise ValueError('Practitioner name must be at least 2 characters long')
        if len(v) > 100:
            raise ValueError('Practitioner name must be less than 100 characters')
        return v.strip()
    
    @validator('specialty')
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
            raise ValueError('Specialty must be at least 2 characters long')
        if len(v) > 100:
            raise ValueError('Specialty must be less than 100 characters')
        return v.strip()

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
        update_data = PractitionerUpdate(
            specialty="Internal Medicine"
        )
    """
    name: Optional[str] = None
    specialty: Optional[str] = None
    
    @validator('name')
    def validate_name(cls, v):
        """Validate name if provided."""
        if v is not None:
            if len(v.strip()) < 2:
                raise ValueError('Practitioner name must be at least 2 characters long')
            if len(v) > 100:
                raise ValueError('Practitioner name must be less than 100 characters')
            return v.strip()
        return v
    
    @validator('specialty')
    def validate_specialty(cls, v):
        """Validate specialty if provided."""
        if v is not None:
            if len(v.strip()) < 2:
                raise ValueError('Specialty must be at least 2 characters long')
            if len(v) > 100:
                raise ValueError('Specialty must be less than 100 characters')
            return v.strip()
        return v

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
    
    @validator('name')
    def validate_name_search(cls, v):
        """Validate search name parameter."""
        if v is not None and len(v.strip()) < 1:
            raise ValueError('Search name must not be empty')
        return v.strip() if v else v
    
    @validator('specialty')
    def validate_specialty_search(cls, v):
        """Validate search specialty parameter."""
        if v is not None and len(v.strip()) < 1:
            raise ValueError('Search specialty must not be empty')
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