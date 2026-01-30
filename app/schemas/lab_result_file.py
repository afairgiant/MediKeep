from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional
from datetime import datetime


class LabResultFileBase(BaseModel):
    """Base schema for LabResultFile"""

    file_name: str
    file_path: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    description: Optional[str] = None

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
            "text/xml",
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

    @field_validator("file_size")
    @classmethod
    def validate_file_size(cls, v):
        """Validate file size (max 100MB)"""
        if v is not None:
            if v < 0:
                raise ValueError("File size cannot be negative")
            if v > 100 * 1024 * 1024:  # 100MB
                raise ValueError("File size cannot exceed 100MB")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v):
        """Validate file description"""
        if v and len(v.strip()) > 1000:
            raise ValueError("Description must be less than 1000 characters")
        return v.strip() if v else None


class LabResultFileCreate(LabResultFileBase):
    """Schema for creating a new lab result file"""

    lab_result_id: int
    uploaded_at: Optional[datetime] = None

    @field_validator("lab_result_id")
    @classmethod
    def validate_lab_result_id(cls, v):
        """Validate lab result ID"""
        if v <= 0:
            raise ValueError("Lab result ID must be a positive integer")
        return v


class LabResultFileUpdate(BaseModel):
    """Schema for updating an existing lab result file"""

    file_name: Optional[str] = None
    file_path: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    description: Optional[str] = None

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
                "text/xml",
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

    @field_validator("file_size")
    @classmethod
    def validate_file_size(cls, v):
        if v is not None:
            if v < 0:
                raise ValueError("File size cannot be negative")
            if v > 100 * 1024 * 1024:  # 100MB
                raise ValueError("File size cannot exceed 100MB")
        return v


class LabResultFileResponse(LabResultFileBase):
    """Schema for lab result file response"""

    id: int
    lab_result_id: int
    uploaded_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LabResultFileWithDetails(LabResultFileResponse):
    """Schema for lab result file with additional details"""

    lab_result_code: Optional[str] = None
    lab_result_display: Optional[str] = None
    patient_name: Optional[str] = None
    file_extension: Optional[str] = None
    human_readable_size: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Additional utility schemas
class FileUploadInfo(BaseModel):
    """Schema for file upload information"""

    original_filename: str
    content_type: str
    file_size: int

    @field_validator("original_filename")
    @classmethod
    def validate_original_filename(cls, v):
        """Validate original filename"""
        if not v or len(v.strip()) < 1:
            raise ValueError("Original filename is required")
        return v.strip()

    @field_validator("file_size")
    @classmethod
    def validate_file_size(cls, v):
        """Validate file size"""
        if v <= 0:
            raise ValueError("File size must be greater than 0")
        if v > 100 * 1024 * 1024:  # 100MB
            raise ValueError("File size cannot exceed 100MB")
        return v


class FileDownloadInfo(BaseModel):
    """Schema for file download information"""

    file_name: str
    file_path: str
    content_type: str
    file_size: int

    model_config = ConfigDict(from_attributes=True)


class FileBatchOperation(BaseModel):
    """Schema for batch file operations"""

    file_ids: list[int]
    operation: str  # 'delete', 'move', 'copy'
    target_path: Optional[str] = None

    @field_validator("file_ids")
    @classmethod
    def validate_file_ids(cls, v):
        """Validate file IDs list"""
        if not v or len(v) == 0:
            raise ValueError("At least one file ID is required")
        if len(v) > 100:
            raise ValueError("Cannot process more than 100 files at once")
        for file_id in v:
            if file_id <= 0:
                raise ValueError("All file IDs must be positive integers")
        return v

    @field_validator("operation")
    @classmethod
    def validate_operation(cls, v):
        """Validate batch operation type"""
        valid_operations = ["delete", "move", "copy"]
        if v.lower() not in valid_operations:
            raise ValueError(f"Operation must be one of: {', '.join(valid_operations)}")
        return v.lower()
