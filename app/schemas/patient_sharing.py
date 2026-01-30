"""
Pydantic schemas for patient sharing invitations
"""

from typing import Optional, List, Dict
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator


class PatientShareInvitationRequest(BaseModel):
    """Request schema for sending patient share invitation"""

    patient_id: int = Field(..., gt=0, le=2147483647, description="ID of patient to share")
    shared_with_user_identifier: str = Field(..., min_length=1, max_length=255, description="Username or email of recipient")
    permission_level: str = Field(default='view', description="Permission level: view, edit, or full")
    expires_at: Optional[datetime] = Field(None, description="Optional share expiration date")
    custom_permissions: Optional[Dict] = Field(None, description="Optional custom permissions")
    message: Optional[str] = Field(None, max_length=1000, description="Optional message to recipient")
    expires_hours: Optional[int] = Field(168, ge=1, le=8760, description="Hours until invitation expires (1 hour to 1 year)")

    @field_validator('patient_id')
    @classmethod
    def validate_patient_id(cls, v):
        # Additional bounds check for reasonable IDs
        if v > 100000000:
            raise ValueError('Patient ID exceeds reasonable bounds')
        return v

    @field_validator('shared_with_user_identifier')
    @classmethod
    def validate_identifier(cls, v):
        v = v.strip()
        if len(v) == 0:
            raise ValueError('Recipient identifier cannot be empty')
        return v

    @field_validator('permission_level')
    @classmethod
    def validate_permission_level(cls, v):
        valid_levels = ['view', 'edit', 'full']
        if v not in valid_levels:
            raise ValueError(f'Permission level must be one of: {valid_levels}')
        return v


class PatientShareBulkInvitationRequest(BaseModel):
    """Request schema for sending bulk patient share invitation"""

    patient_ids: List[int] = Field(..., description="List of patient IDs to share")
    shared_with_user_identifier: str = Field(..., min_length=1, max_length=255, description="Username or email of recipient")
    permission_level: str = Field(default='view', description="Permission level: view, edit, or full")
    expires_at: Optional[datetime] = Field(None, description="Optional share expiration date")
    custom_permissions: Optional[Dict] = Field(None, description="Optional custom permissions")
    message: Optional[str] = Field(None, max_length=1000, description="Optional message to recipient")
    expires_hours: Optional[int] = Field(168, ge=1, le=8760, description="Hours until invitation expires (1 hour to 1 year)")

    @field_validator('patient_ids')
    @classmethod
    def validate_patient_ids(cls, v):
        if not v or len(v) == 0:
            raise ValueError('At least one patient_id required')
        if len(v) > 50:  # Limit based on reasonable batch size
            raise ValueError('Cannot share more than 50 patients at once')
        # Validate all IDs are positive integers within bounds
        if not all(isinstance(pid, int) and pid > 0 and pid <= 2147483647 for pid in v):
            raise ValueError('All patient IDs must be positive integers within valid range')
        # Additional check for reasonable ID values
        if any(pid > 100000000 for pid in v):
            raise ValueError('One or more patient IDs exceed reasonable bounds')
        return v

    @field_validator('shared_with_user_identifier')
    @classmethod
    def validate_identifier(cls, v):
        v = v.strip()
        if len(v) == 0:
            raise ValueError('Recipient identifier cannot be empty')
        return v

    @field_validator('permission_level')
    @classmethod
    def validate_permission_level(cls, v):
        valid_levels = ['view', 'edit', 'full']
        if v not in valid_levels:
            raise ValueError(f'Permission level must be one of: {valid_levels}')
        return v


class PatientShareInvitationResponse(BaseModel):
    """Response schema for patient share invitation"""

    message: str = Field(..., description="Success message")
    invitation_id: int = Field(..., description="ID of created invitation")
    expires_at: Optional[datetime] = Field(None, description="When the invitation expires")
    title: str = Field(..., description="Invitation title")

    model_config = ConfigDict(from_attributes=True)


class BulkPatientShareInvitationResponse(BaseModel):
    """Response schema for bulk patient share invitation"""

    message: str = Field(..., description="Success message")
    invitation_id: int = Field(..., description="ID of created bulk invitation")
    patient_count: int = Field(..., description="Number of patients in the invitation")
    expires_at: Optional[datetime] = Field(None, description="When the invitation expires")
    title: str = Field(..., description="Invitation title")

    model_config = ConfigDict(from_attributes=True)
