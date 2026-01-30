"""
Pydantic schemas for family history sharing
"""

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class FamilyHistoryShareInvitationCreate(BaseModel):
    """Schema for creating a family history share invitation"""
    shared_with_identifier: str = Field(..., description="Username or email of user to share with")
    permission_level: str = Field(default='view', description="Permission level (view only for Phase 1.5)")
    sharing_note: Optional[str] = Field(None, description="Optional note about why sharing")
    expires_hours: Optional[int] = Field(default=168, description="Hours until invitation expires (default 7 days, None for no expiration)")


class FamilyHistoryBulkInvite(BaseModel):
    """Schema for bulk family history invitation"""
    family_member_ids: List[int] = Field(..., description="List of family member IDs to share")
    shared_with_identifier: str = Field(..., description="Username or email of user to share with")
    permission_level: str = Field(default='view', description="Permission level")
    sharing_note: Optional[str] = Field(None, description="Optional sharing note")
    expires_hours: Optional[int] = Field(default=168, description="Hours until invitation expires (default 7 days, None for no expiration)")


class FamilyHistoryShareResponse(BaseModel):
    """Schema for family history share response"""
    id: int
    invitation_id: int
    family_member_id: int
    shared_by_user_id: int
    shared_with_user_id: int
    permission_level: str
    is_active: bool
    sharing_note: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SharedByUser(BaseModel):
    """Schema for user who shared the family history"""
    id: int
    name: str
    email: str


class ShareDetails(BaseModel):
    """Schema for share details"""
    shared_by: SharedByUser
    shared_at: datetime
    sharing_note: Optional[str]
    permission_level: str
    invitation: Optional[dict] = None


class FamilyMemberBase(BaseModel):
    """Base schema for family member"""
    id: int
    name: str
    relationship: str
    gender: Optional[str]
    birth_year: Optional[int]
    death_year: Optional[int]
    is_deceased: bool
    notes: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class FamilyConditionBase(BaseModel):
    """Base schema for family condition"""
    id: int
    condition_name: str
    diagnosis_age: Optional[int]
    severity: Optional[str]
    status: Optional[str]
    condition_type: Optional[str]
    notes: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class FamilyMemberWithConditions(FamilyMemberBase):
    """Schema for family member with conditions"""
    family_conditions: List[FamilyConditionBase] = []


class FamilyMemberWithShare(BaseModel):
    """Schema for family member with sharing details"""
    family_member: FamilyMemberWithConditions
    share_details: ShareDetails


class OrganizedFamilyHistory(BaseModel):
    """Schema for organized family history (owned + shared)"""
    owned_family_history: List[FamilyMemberWithConditions]
    shared_family_history: List[FamilyMemberWithShare]
    summary: Dict[str, int]


class BulkInviteResult(BaseModel):
    """Schema for bulk invitation result"""
    family_member_id: int
    success: bool
    invitation_id: Optional[int] = None
    error: Optional[str] = None


class BulkInviteResponse(BaseModel):
    """Schema for bulk invitation response"""
    results: List[BulkInviteResult]
    total_sent: int
    total_failed: int
    
    def __init__(self, results: List[BulkInviteResult], **data):
        # Calculate totals
        total_sent = sum(1 for r in results if r.success)
        total_failed = sum(1 for r in results if not r.success)
        
        super().__init__(
            results=results,
            total_sent=total_sent,
            total_failed=total_failed,
            **data
        )