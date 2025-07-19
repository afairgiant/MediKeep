"""
Pydantic schemas for invitation system
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class InvitationCreate(BaseModel):
    """Schema for creating an invitation"""
    sent_to_identifier: str = Field(..., description="Username or email of recipient")
    invitation_type: str = Field(..., description="Type of invitation")
    title: str = Field(..., description="Human-readable title")
    message: Optional[str] = Field(None, description="Optional message from sender")
    context_data: Dict[str, Any] = Field(..., description="Type-specific context data")
    expires_hours: Optional[int] = Field(168, description="Hours until expiration (default: 7 days)")


class InvitationResponse(BaseModel):
    """Schema for invitation response"""
    id: int
    sent_by_user_id: int
    sent_to_user_id: int
    invitation_type: str
    status: str
    title: str
    message: Optional[str]
    context_data: Dict[str, Any]
    expires_at: Optional[datetime]
    responded_at: Optional[datetime]
    response_note: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    # Related data (populated by API)
    sent_by: Optional[dict] = None
    sent_to: Optional[dict] = None
    
    class Config:
        from_attributes = True


class InvitationResponseRequest(BaseModel):
    """Schema for responding to an invitation"""
    response: str = Field(..., description="Response: 'accepted' or 'rejected'")
    response_note: Optional[str] = Field(None, description="Optional response note")


class InvitationSummary(BaseModel):
    """Schema for invitation summary"""
    id: int
    invitation_type: str
    title: str
    status: str
    created_at: datetime
    expires_at: Optional[datetime]
    
    class Config:
        from_attributes = True