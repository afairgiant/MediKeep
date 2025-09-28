from pydantic import BaseModel, validator
from typing import Optional
from datetime import datetime


class PatientPhotoBase(BaseModel):
    """Base schema for patient photos"""
    patient_id: int
    file_name: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    original_name: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None

    @validator("patient_id")
    def validate_patient_id(cls, v):
        if v <= 0:
            raise ValueError("Patient ID must be a positive integer")
        return v

    @validator("file_name")
    def validate_file_name(cls, v):
        if not v or len(v.strip()) < 1:
            raise ValueError("File name is required")
        if len(v) > 255:
            raise ValueError("File name must be less than 255 characters")
        return v.strip()

    @validator("file_size")
    def validate_file_size(cls, v):
        if v is not None:
            if v < 0:
                raise ValueError("File size cannot be negative")
            if v > 15 * 1024 * 1024:  # 15MB
                raise ValueError("Photo must be less than 15MB")
        return v

    @validator("mime_type")
    def validate_mime_type(cls, v):
        if v:
            allowed_types = [
                "image/jpeg",
                "image/jpg",
                "image/png",
                "image/gif",
                "image/bmp",
                "image/heic",
                "image/heif"
            ]
            if v.lower() not in allowed_types:
                raise ValueError(f"Invalid image type. Allowed types: {', '.join(allowed_types)}")
        return v.lower() if v else None


class PatientPhotoCreate(PatientPhotoBase):
    """Schema for creating a patient photo"""
    file_path: str
    uploaded_by: Optional[int] = None

    @validator("file_path")
    def validate_file_path(cls, v):
        if not v or len(v.strip()) < 1:
            raise ValueError("File path is required")
        if len(v) > 500:
            raise ValueError("File path must be less than 500 characters")
        return v.strip()


class PatientPhotoUpdate(BaseModel):
    """Schema for updating a patient photo (rarely used)"""
    file_size: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None


class PatientPhotoResponse(PatientPhotoBase):
    """Schema for patient photo response"""
    id: int
    file_path: str
    uploaded_by: Optional[int] = None
    uploaded_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PatientPhotoWithUrl(PatientPhotoResponse):
    """Schema for patient photo with generated URL"""
    url: str
    thumbnail_url: str

    class Config:
        from_attributes = True