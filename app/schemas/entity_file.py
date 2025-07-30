from pydantic import BaseModel, validator
from typing import Optional
from datetime import datetime
from enum import Enum


class EntityType(str, Enum):
    """Supported entity types for file management"""
    LAB_RESULT = "lab-result"
    INSURANCE = "insurance"
    VISIT = "visit"
    ENCOUNTER = "encounter"  # Alternative name for visit
    PROCEDURE = "procedure"


class EntityFileBase(BaseModel):
    """Base schema for EntityFile"""

    file_name: str
    file_path: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    description: Optional[str] = None
    category: Optional[str] = None

    @validator("file_name")
    def validate_file_name(cls, v):
        """Validate file name"""
        if not v or len(v.strip()) < 1:
            raise ValueError("File name is required")
        if len(v) > 255:
            raise ValueError("File name must be less than 255 characters")
        # Check for invalid characters
        invalid_chars = ["<", ">", ":", '"', "/", "\\", "|", "?", "*"]
        if any(char in v for char in invalid_chars):
            raise ValueError("File name contains invalid characters")
        return v.strip()

    @validator("file_path")
    def validate_file_path(cls, v):
        """Validate file path"""
        if not v or len(v.strip()) < 1:
            raise ValueError("File path is required")
        if len(v) > 500:
            raise ValueError("File path must be less than 500 characters")
        return v.strip()

    @validator("file_type")
    def validate_file_type(cls, v):
        """Validate file type (MIME type)"""
        valid_types = [
            "application/pdf",
            "image/jpeg",
            "image/jpg", 
            "image/png",
            "image/tiff",
            "image/bmp",
            "image/gif",
            "application/dicom",
            "text/plain",
            "text/csv",
            "application/xml",
            "application/json",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ]
        if v and v.lower() not in valid_types:
            raise ValueError(f"File type must be one of: {', '.join(valid_types)}")
        return v.lower() if v else None

    @validator("file_size")
    def validate_file_size(cls, v):
        """Validate file size (max 100MB)"""
        if v is not None:
            if v < 0:
                raise ValueError("File size cannot be negative")
            if v > 100 * 1024 * 1024:  # 100MB
                raise ValueError("File size cannot exceed 100MB")
        return v

    @validator("description")
    def validate_description(cls, v):
        """Validate file description"""
        if v and len(v.strip()) > 1000:
            raise ValueError("Description must be less than 1000 characters")
        return v.strip() if v else None

    @validator("category")
    def validate_category(cls, v):
        """Validate file category"""
        if v and len(v.strip()) > 100:
            raise ValueError("Category must be less than 100 characters")
        return v.strip() if v else None


class EntityFileCreate(EntityFileBase):
    """Schema for creating a new entity file"""

    entity_type: EntityType
    entity_id: int
    uploaded_at: Optional[datetime] = None

    @validator("entity_id")
    def validate_entity_id(cls, v):
        """Validate entity ID"""
        if v <= 0:
            raise ValueError("Entity ID must be a positive integer")
        return v


class EntityFileUpdate(BaseModel):
    """Schema for updating an existing entity file"""

    file_name: Optional[str] = None
    file_path: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    description: Optional[str] = None
    category: Optional[str] = None

    @validator("file_name")
    def validate_file_name(cls, v):
        if v is not None:
            if not v or len(v.strip()) < 1:
                raise ValueError("File name is required")
            if len(v) > 255:
                raise ValueError("File name must be less than 255 characters")
            # Check for invalid characters
            invalid_chars = ["<", ">", ":", '"', "/", "\\", "|", "?", "*"]
            if any(char in v for char in invalid_chars):
                raise ValueError("File name contains invalid characters")
            return v.strip()
        return v

    @validator("file_path")
    def validate_file_path(cls, v):
        if v is not None:
            if not v or len(v.strip()) < 1:
                raise ValueError("File path is required")
            if len(v) > 500:
                raise ValueError("File path must be less than 500 characters")
            return v.strip()
        return v

    @validator("file_type")
    def validate_file_type(cls, v):
        if v is not None:
            valid_types = [
                "application/pdf",
                "image/jpeg",
                "image/jpg",
                "image/png", 
                "image/tiff",
                "image/bmp",
                "image/gif",
                "application/dicom",
                "text/plain",
                "text/csv",
                "application/xml",
                "application/json",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ]
            if v.lower() not in valid_types:
                raise ValueError(f"File type must be one of: {', '.join(valid_types)}")
            return v.lower()
        return v

    @validator("file_size")
    def validate_file_size(cls, v):
        if v is not None:
            if v < 0:
                raise ValueError("File size cannot be negative")
            if v > 100 * 1024 * 1024:  # 100MB
                raise ValueError("File size cannot exceed 100MB")
        return v

    @validator("description")
    def validate_description(cls, v):
        if v is not None and len(v.strip()) > 1000:
            raise ValueError("Description must be less than 1000 characters")
        return v.strip() if v else None

    @validator("category")
    def validate_category(cls, v):
        if v is not None and len(v.strip()) > 100:
            raise ValueError("Category must be less than 100 characters")
        return v.strip() if v else None


class EntityFileResponse(EntityFileBase):
    """Schema for entity file response"""

    id: int
    entity_type: str
    entity_id: int
    uploaded_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EntityFileWithDetails(EntityFileResponse):
    """Schema for entity file with additional details"""

    entity_display: Optional[str] = None
    file_extension: Optional[str] = None
    human_readable_size: Optional[str] = None

    class Config:
        from_attributes = True


# Additional utility schemas
class FileUploadRequest(BaseModel):
    """Schema for file upload request"""

    entity_type: EntityType
    entity_id: int
    description: Optional[str] = None
    category: Optional[str] = None

    @validator("entity_id")
    def validate_entity_id(cls, v):
        """Validate entity ID"""
        if v <= 0:
            raise ValueError("Entity ID must be a positive integer")
        return v


class FileDownloadResponse(BaseModel):
    """Schema for file download response"""

    file_name: str
    file_path: str
    content_type: str
    file_size: int

    class Config:
        from_attributes = True


class FileBatchCountRequest(BaseModel):
    """Schema for batch file count request"""

    entity_type: EntityType
    entity_ids: list[int]

    @validator("entity_ids")
    def validate_entity_ids(cls, v):
        """Validate entity IDs list"""
        if not v or len(v) == 0:
            raise ValueError("At least one entity ID is required")
        if len(v) > 100:
            raise ValueError("Cannot process more than 100 entities at once")
        for entity_id in v:
            if entity_id <= 0:
                raise ValueError("All entity IDs must be positive integers")
        return v


class FileBatchCountResponse(BaseModel):
    """Schema for batch file count response"""

    entity_id: int
    file_count: int

    class Config:
        from_attributes = True


class FileOperationResult(BaseModel):
    """Schema for file operation results"""

    success: bool
    message: str
    file_id: Optional[int] = None
    file_path: Optional[str] = None