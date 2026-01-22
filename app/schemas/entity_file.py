from pydantic import BaseModel, field_validator
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
    VITALS = "vitals"
    MEDICATION = "medication"
    IMMUNIZATION = "immunization"
    ALLERGY = "allergy"
    CONDITION = "condition"
    TREATMENT = "treatment"
    SYMPTOM = "symptom"


class EntityFileBase(BaseModel):
    """Base schema for EntityFile"""

    file_name: str
    file_path: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    description: Optional[str] = None
    category: Optional[str] = None

    @field_validator("file_name")
    @classmethod
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

    @field_validator("file_path")
    @classmethod
    def validate_file_path(cls, v):
        """Validate file path"""
        if not v or len(v.strip()) < 1:
            raise ValueError("File path is required")
        if len(v) > 500:
            raise ValueError("File path must be less than 500 characters")
        return v.strip()

    @field_validator("file_type")
    @classmethod
    def validate_file_type(cls, v):
        """Validate file type (MIME type)"""
        valid_types = [
            # Documents
            "application/pdf",
            "text/plain",
            "text/csv",
            "text/xml",
            "application/xml",
            "application/json",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            # Images
            "image/jpeg",
            "image/jpg",  # Non-standard but commonly sent by browsers
            "image/png",
            "image/tiff",
            "image/bmp",
            "image/gif",
            # Medical Imaging
            "application/dicom",
            # Archives (multiple MIME type variants for browser compatibility)
            "application/zip",
            "application/x-zip",
            "application/x-zip-compressed",
            "application/x-iso9660-image",
            "application/x-7z-compressed",
            "application/vnd.rar",
            "application/x-rar-compressed",
            "application/x-rar",
            # Video
            "video/x-msvideo",
            "video/avi",  # Non-standard but commonly sent by browsers
            "video/mp4",
            "video/quicktime",
            "video/webm",
            # 3D Models
            "model/stl",
            "application/vnd.ms-pki.stl",
            # Research Imaging
            "application/octet-stream",  # Used for .nii, .nrrd
            # Audio
            "audio/mpeg",
            "audio/mp3",  # Non-standard but commonly sent by browsers
            "audio/wav",
            "audio/x-wav",  # Legacy variant for browser compatibility
            "audio/mp4",
            "audio/x-m4a",  # Legacy variant for browser compatibility
        ]
        if v and v.lower() not in valid_types:
            raise ValueError(f"File type must be one of: {', '.join(valid_types)}")
        return v.lower() if v else None

    @field_validator("file_size")
    @classmethod
    def validate_file_size(cls, v):
        """Validate file size (max 1GB for archive support)"""
        if v is not None:
            if v < 0:
                raise ValueError("File size cannot be negative")
            if v > 1024 * 1024 * 1024:  # 1GB (increased for archive support)
                raise ValueError("File size cannot exceed 1GB")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v):
        """Validate file description"""
        if v and len(v.strip()) > 1000:
            raise ValueError("Description must be less than 1000 characters")
        return v.strip() if v else None

    @field_validator("category")
    @classmethod
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
    storage_backend: Optional[str] = "local"
    sync_status: Optional[str] = "synced"
    last_sync_at: Optional[datetime] = None
    paperless_document_id: Optional[str] = None
    paperless_task_uuid: Optional[str] = None  # Task UUID for Paperless processing

    @field_validator("entity_id")
    @classmethod
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

    @field_validator("file_name")
    @classmethod
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

    @field_validator("file_path")
    @classmethod
    def validate_file_path(cls, v):
        if v is not None:
            if not v or len(v.strip()) < 1:
                raise ValueError("File path is required")
            if len(v) > 500:
                raise ValueError("File path must be less than 500 characters")
            return v.strip()
        return v

    @field_validator("file_type")
    @classmethod
    def validate_file_type(cls, v):
        if v is not None:
            valid_types = [
                # Documents
                "application/pdf",
                "text/plain",
                "text/csv",
                "text/xml",
                "application/xml",
                "application/json",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                # Images
                "image/jpeg",
                "image/jpg",  # Non-standard but commonly sent by browsers
                "image/png",
                "image/tiff",
                "image/bmp",
                "image/gif",
                # Medical Imaging
                "application/dicom",
                # Archives (multiple MIME type variants for browser compatibility)
                "application/zip",
                "application/x-zip",
                "application/x-zip-compressed",
                "application/x-iso9660-image",
                "application/x-7z-compressed",
                "application/vnd.rar",
                "application/x-rar-compressed",
                "application/x-rar",
                # Video
                "video/x-msvideo",
                "video/avi",  # Non-standard but commonly sent by browsers
                "video/mp4",
                "video/quicktime",
                "video/webm",
                # 3D Models
                "model/stl",
                "application/vnd.ms-pki.stl",
                # Research Imaging
                "application/octet-stream",  # Used for .nii, .nrrd
                # Audio
                "audio/mpeg",
                "audio/mp3",  # Non-standard but commonly sent by browsers
                "audio/wav",
                "audio/x-wav",  # Legacy variant for browser compatibility
                "audio/mp4",
                "audio/x-m4a",  # Legacy variant for browser compatibility
            ]
            if v.lower() not in valid_types:
                raise ValueError(f"File type must be one of: {', '.join(valid_types)}")
            return v.lower()
        return v

    @field_validator("file_size")
    @classmethod
    def validate_file_size(cls, v):
        if v is not None:
            if v < 0:
                raise ValueError("File size cannot be negative")
            if v > 1024 * 1024 * 1024:  # 1GB (increased for archive support)
                raise ValueError("File size cannot exceed 1GB")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v):
        if v is not None and len(v.strip()) > 1000:
            raise ValueError("Description must be less than 1000 characters")
        return v.strip() if v else None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v):
        if v is not None and len(v.strip()) > 100:
            raise ValueError("Category must be less than 100 characters")
        return v.strip() if v else None


class EntityFileResponse(EntityFileBase):
    """Schema for entity file response"""

    id: int
    entity_type: str
    entity_id: int
    storage_backend: Optional[str] = "local"  # 'local' or 'paperless'
    paperless_document_id: Optional[str] = None
    paperless_task_uuid: Optional[str] = None  # Task UUID for Paperless processing
    sync_status: Optional[str] = "synced"  # 'synced', 'pending', 'failed', 'processing', 'duplicate', 'missing'
    uploaded_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_sync_at: Optional[datetime] = None

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

    @field_validator("entity_id")
    @classmethod
    def validate_entity_id(cls, v):
        """Validate entity ID"""
        if v <= 0:
            raise ValueError("Entity ID must be a positive integer")
        return v


class EntityFileLinkPaperlessRequest(BaseModel):
    """Schema for linking an existing Paperless document to an entity"""

    paperless_document_id: str
    description: Optional[str] = None
    category: Optional[str] = None

    @field_validator("paperless_document_id")
    @classmethod
    def validate_paperless_document_id(cls, v):
        """Validate Paperless document ID"""
        if not v or not v.strip():
            raise ValueError("Paperless document ID is required")
        # Paperless document IDs are numeric strings
        if not v.strip().isdigit():
            raise ValueError("Paperless document ID must be numeric")
        return v.strip()

    @field_validator("description")
    @classmethod
    def validate_description(cls, v):
        """Validate description"""
        if v and len(v.strip()) > 1000:
            raise ValueError("Description must be less than 1000 characters")
        return v.strip() if v else None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v):
        """Validate category"""
        if v and len(v.strip()) > 100:
            raise ValueError("Category must be less than 100 characters")
        return v.strip() if v else None


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

    @field_validator("entity_ids")
    @classmethod
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
