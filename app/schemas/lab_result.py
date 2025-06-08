from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import date, datetime

class LabResultBase(BaseModel):
    """Base schema for LabResult"""
    code: str
    display: Optional[str] = None
    value_quantity: Optional[float] = None
    value_unit: Optional[str] = None
    value_string: Optional[str] = None
    reference_range: Optional[str] = None
    interpretation: Optional[str] = None
    status: Optional[str] = None
    effective_date: Optional[date] = None
    issued_date: Optional[datetime] = None
    category: Optional[str] = None
    
    @validator('code')
    def validate_code(cls, v):
        """Validate lab test code (LOINC, CPT, etc.)"""
        if not v or len(v.strip()) < 2:
            raise ValueError('Lab test code must be at least 2 characters long')
        if len(v) > 50:
            raise ValueError('Lab test code must be less than 50 characters')
        return v.strip().upper()
    
    @validator('display')
    def validate_display(cls, v):
        """Validate display name"""
        if v and len(v.strip()) > 200:
            raise ValueError('Display name must be less than 200 characters')
        return v.strip() if v else None
    
    @validator('value_quantity')
    def validate_value_quantity(cls, v):
        """Validate numeric value"""
        if v is not None and v < 0:
            raise ValueError('Value quantity cannot be negative')
        return v
    
    @validator('value_unit')
    def validate_value_unit(cls, v):
        """Validate unit of measurement"""
        if v and len(v.strip()) > 20:
            raise ValueError('Value unit must be less than 20 characters')
        return v.strip() if v else None
    
    @validator('value_string')
    def validate_value_string(cls, v):
        """Validate string value for non-numeric results"""
        if v and len(v.strip()) > 500:
            raise ValueError('Value string must be less than 500 characters')
        return v.strip() if v else None
    
    @validator('reference_range')
    def validate_reference_range(cls, v):
        """Validate reference range format"""
        if v and len(v.strip()) > 100:
            raise ValueError('Reference range must be less than 100 characters')
        return v.strip() if v else None
    
    @validator('interpretation')
    def validate_interpretation(cls, v):
        """Validate interpretation (Normal, High, Low, etc.)"""
        valid_interpretations = [
            'normal', 'high', 'low', 'critical high', 'critical low',
            'abnormal', 'positive', 'negative', 'inconclusive'
        ]
        if v and v.lower() not in valid_interpretations:
            raise ValueError(f'Interpretation must be one of: {", ".join(valid_interpretations)}')
        return v.lower() if v else None
    
    @validator('status')
    def validate_status(cls, v):
        """Validate lab result status"""
        valid_statuses = [
            'registered', 'partial', 'preliminary', 'final', 
            'amended', 'corrected', 'cancelled', 'entered-in-error'
        ]
        if v and v.lower() not in valid_statuses:
            raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
        return v.lower() if v else None
    
    @validator('category')
    def validate_category(cls, v):
        """Validate lab result category"""
        valid_categories = [
            'laboratory', 'imaging', 'pathology', 'microbiology',
            'chemistry', 'hematology', 'immunology', 'genetics'
        ]
        if v and v.lower() not in valid_categories:
            raise ValueError(f'Category must be one of: {", ".join(valid_categories)}')
        return v.lower() if v else None
    
    @validator('issued_date')
    def validate_issued_date(cls, v, values):
        """Validate that issued date is not before effective date"""
        if v and 'effective_date' in values and values['effective_date']:
            if v.date() < values['effective_date']:
                raise ValueError('Issued date cannot be before effective date')
        return v

class LabResultCreate(LabResultBase):
    """Schema for creating a new lab result"""
    patient_id: int
    practitioner_id: Optional[int] = None
    
    @validator('patient_id')
    def validate_patient_id(cls, v):
        """Validate patient ID"""
        if v <= 0:
            raise ValueError('Patient ID must be a positive integer')
        return v

class LabResultUpdate(BaseModel):
    """Schema for updating an existing lab result"""
    code: Optional[str] = None
    display: Optional[str] = None
    value_quantity: Optional[float] = None
    value_unit: Optional[str] = None
    value_string: Optional[str] = None
    reference_range: Optional[str] = None
    interpretation: Optional[str] = None
    status: Optional[str] = None
    effective_date: Optional[date] = None
    issued_date: Optional[datetime] = None
    category: Optional[str] = None
    practitioner_id: Optional[int] = None
    
    @validator('code')
    def validate_code(cls, v):
        if v is not None:
            if not v or len(v.strip()) < 2:
                raise ValueError('Lab test code must be at least 2 characters long')
            if len(v) > 50:
                raise ValueError('Lab test code must be less than 50 characters')
            return v.strip().upper()
        return v
    
    @validator('interpretation')
    def validate_interpretation(cls, v):
        if v is not None:
            valid_interpretations = [
                'normal', 'high', 'low', 'critical high', 'critical low',
                'abnormal', 'positive', 'negative', 'inconclusive'
            ]
            if v.lower() not in valid_interpretations:
                raise ValueError(f'Interpretation must be one of: {", ".join(valid_interpretations)}')
            return v.lower()
        return v
    
    @validator('status')
    def validate_status(cls, v):
        if v is not None:
            valid_statuses = [
                'registered', 'partial', 'preliminary', 'final', 
                'amended', 'corrected', 'cancelled', 'entered-in-error'
            ]
            if v.lower() not in valid_statuses:
                raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
            return v.lower()
        return v

class LabResultResponse(LabResultBase):
    """Schema for lab result response"""
    id: int
    patient_id: int
    practitioner_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class LabResultWithRelations(LabResultResponse):
    """Schema for lab result with related data"""
    patient_name: Optional[str] = None
    practitioner_name: Optional[str] = None
    files: Optional[List['LabResultFileResponse']] = []
    
    class Config:
        from_attributes = True

# Lab Result File Schemas
class LabResultFileBase(BaseModel):
    """Base schema for LabResultFile"""
    file_name: str
    file_path: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    description: Optional[str] = None
    
    @validator('file_name')
    def validate_file_name(cls, v):
        """Validate file name"""
        if not v or len(v.strip()) < 1:
            raise ValueError('File name is required')
        if len(v) > 255:
            raise ValueError('File name must be less than 255 characters')
        return v.strip()
    
    @validator('file_path')
    def validate_file_path(cls, v):
        """Validate file path"""
        if not v or len(v.strip()) < 1:
            raise ValueError('File path is required')
        if len(v) > 500:
            raise ValueError('File path must be less than 500 characters')
        return v.strip()
    
    @validator('file_type')
    def validate_file_type(cls, v):
        """Validate file type (MIME type)"""
        valid_types = [
            'application/pdf', 'image/jpeg', 'image/png', 'image/tiff',
            'application/dicom', 'text/plain', 'application/xml'
        ]
        if v and v.lower() not in valid_types:
            raise ValueError(f'File type must be one of: {", ".join(valid_types)}')
        return v.lower() if v else None
    
    @validator('file_size')
    def validate_file_size(cls, v):
        """Validate file size (max 50MB)"""
        if v is not None:
            if v < 0:
                raise ValueError('File size cannot be negative')
            if v > 50 * 1024 * 1024:  # 50MB
                raise ValueError('File size cannot exceed 50MB')
        return v

class LabResultFileCreate(LabResultFileBase):
    """Schema for creating a new lab result file"""
    lab_result_id: int

class LabResultFileUpdate(BaseModel):
    """Schema for updating an existing lab result file"""
    file_name: Optional[str] = None
    file_path: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    description: Optional[str] = None

class LabResultFileResponse(LabResultFileBase):
    """Schema for lab result file response"""
    id: int
    lab_result_id: int
    uploaded_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Update forward reference
LabResultWithRelations.model_rebuild()