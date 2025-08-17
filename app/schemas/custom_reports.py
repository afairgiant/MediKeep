"""
Custom Report Generation Schemas

This module defines the Pydantic models for custom report generation,
including request/response models for selective record exports and report templates.
"""

from datetime import date, datetime
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, validator


class DateRange(BaseModel):
    """Date range filter for report generation"""
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @validator('end_date')
    def validate_date_range(cls, v, values):
        if v and 'start_date' in values and values['start_date']:
            if v < values['start_date']:
                raise ValueError('End date must be after start date')
        return v


class SelectiveRecordRequest(BaseModel):
    """Request model for selecting specific records from a category"""
    category: str = Field(..., description="Medical record category (medications, treatments, etc.)")
    record_ids: List[int] = Field(..., description="List of record IDs to include")

    @validator('record_ids')
    def validate_record_ids(cls, v):
        if not v:
            raise ValueError('At least one record ID must be provided')
        if len(v) > 1000:
            raise ValueError('Cannot select more than 1000 records per category')
        return v


class CustomReportRequest(BaseModel):
    """Request model for generating custom medical reports"""
    selected_records: List[SelectiveRecordRequest] = Field(
        ..., 
        description="List of categories with selected record IDs"
    )
    report_title: Optional[str] = Field(
        default="Custom Medical Report",
        max_length=255,
        description="Title for the generated report"
    )
    include_patient_info: bool = Field(
        default=True,
        description="Include patient demographic information"
    )
    include_summary: bool = Field(
        default=True,
        description="Include summary statistics"
    )
    date_range: Optional[DateRange] = Field(
        default=None,
        description="Optional date range filter"
    )

    @validator('selected_records')
    def validate_selected_records(cls, v):
        if not v:
            raise ValueError('At least one category with records must be selected')
        
        # Check for duplicate categories
        categories = [req.category for req in v]
        if len(categories) != len(set(categories)):
            raise ValueError('Duplicate categories are not allowed')
        
        # Validate total record count
        total_records = sum(len(req.record_ids) for req in v)
        if total_records > 5000:
            raise ValueError('Total selected records cannot exceed 5000')
        
        return v


class ReportTemplate(BaseModel):
    """Model for saving and managing report templates"""
    name: str = Field(..., max_length=255, description="Template name")
    description: Optional[str] = Field(None, max_length=1000, description="Template description")
    selected_records: List[SelectiveRecordRequest] = Field(
        ..., 
        description="Saved record selections"
    )
    is_public: bool = Field(default=False, description="Whether template is public")
    shared_with_family: bool = Field(
        default=False, 
        description="Share template with family members"
    )
    report_settings: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Additional report settings (sorting, grouping, etc.)"
    )


class ReportTemplateResponse(ReportTemplate):
    """Response model for report templates with metadata"""
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    created_by_name: Optional[str] = None  # For family shared templates


class RecordSummary(BaseModel):
    """Summary of a medical record for selection UI"""
    id: int
    title: str
    date: Optional[Union[date, datetime]] = None
    practitioner: Optional[str] = None
    key_info: str = Field(..., description="Brief description for selection")
    status: Optional[str] = None  # active, inactive, resolved, etc.


class CategorySummary(BaseModel):
    """Summary of records in a category"""
    count: int = Field(..., description="Total number of records")
    records: List[RecordSummary] = Field(
        default_factory=list,
        description="List of record summaries"
    )
    has_more: bool = Field(
        default=False,
        description="Indicates if there are more records than returned"
    )


class DataSummaryResponse(BaseModel):
    """Response model for data summary endpoint"""
    categories: Dict[str, CategorySummary] = Field(
        ..., 
        description="Summary of each category"
    )
    total_records: int = Field(..., description="Total number of all records")
    last_updated: Optional[datetime] = Field(
        None,
        description="Last data modification timestamp"
    )


class CustomReportError(Exception):
    """Custom exception for report generation errors"""
    def __init__(self, message: str, category: str = None, details: dict = None):
        self.message = message
        self.category = category
        self.details = details or {}
        super().__init__(message)


class ReportGenerationResponse(BaseModel):
    """Response model for report generation status"""
    success: bool
    message: str
    filename: Optional[str] = None
    file_size: Optional[int] = None
    generation_time_ms: Optional[int] = None
    partial_failure: bool = Field(
        default=False,
        description="Indicates if some categories failed"
    )
    failed_categories: List[str] = Field(
        default_factory=list,
        description="List of categories that failed to export"
    )


class TemplateActionResponse(BaseModel):
    """Generic response for template CRUD operations"""
    success: bool
    message: str
    template_id: Optional[int] = None