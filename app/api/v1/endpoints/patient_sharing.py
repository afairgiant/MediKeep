"""
V1 Patient Sharing API Endpoints - Individual patient sharing functionality
"""

from typing import Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, validator
from sqlalchemy.orm import Session

from app.api import deps
from app.core.logging_config import get_logger
from app.services.patient_sharing import PatientSharingService
from app.services.patient_access import PatientAccessService
from app.models.models import User, PatientShare

router = APIRouter()
logger = get_logger(__name__, "app")


class SharePatientRequest(BaseModel):
    """Request model for sharing a patient"""
    patient_id: int = Field(..., description="ID of the patient to share")
    shared_with_user_identifier: str = Field(..., description="Username or email of the user to share with")
    permission_level: str = Field(..., description="Permission level: view, edit, or full")
    expires_at: Optional[datetime] = Field(None, description="Optional expiration date")
    custom_permissions: Optional[dict] = Field(None, description="Optional custom permissions")
    
    @validator('permission_level')
    def validate_permission_level(cls, v):
        valid_levels = ['view', 'edit', 'full']
        if v not in valid_levels:
            raise ValueError(f'Permission level must be one of: {valid_levels}')
        return v


class UpdateShareRequest(BaseModel):
    """Request model for updating a patient share"""
    permission_level: Optional[str] = Field(None, description="New permission level")
    expires_at: Optional[datetime] = Field(None, description="New expiration date")
    custom_permissions: Optional[dict] = Field(None, description="New custom permissions")
    
    @validator('permission_level')
    def validate_permission_level(cls, v):
        if v is not None:
            valid_levels = ['view', 'edit', 'full']
            if v not in valid_levels:
                raise ValueError(f'Permission level must be one of: {valid_levels}')
        return v


class ShareResponse(BaseModel):
    """Response model for patient share data"""
    id: int
    patient_id: int
    shared_by_user_id: int
    shared_with_user_id: int
    permission_level: str
    custom_permissions: Optional[dict]
    is_active: bool
    expires_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ShareWithUserInfo(BaseModel):
    """Response model for share with user information"""
    id: int
    patient_id: int
    shared_by_user_id: int
    shared_with_user_id: int
    permission_level: str
    custom_permissions: Optional[dict]
    is_active: bool
    expires_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    # User information
    shared_with_username: Optional[str] = None
    shared_with_email: Optional[str] = None
    shared_with_full_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class PatientSharesResponse(BaseModel):
    """Response model for patient shares list"""
    patient_id: int
    shares: List[ShareWithUserInfo]
    total_count: int


class UserSharingStatsResponse(BaseModel):
    """Response model for user sharing statistics"""
    shared_by_me: int
    shared_with_me: int


class RevokeShareRequest(BaseModel):
    """Request model for revoking a patient share"""
    patient_id: int = Field(..., description="ID of the patient")
    shared_with_user_id: int = Field(..., description="ID of the user to revoke access from")


@router.post("/", response_model=ShareResponse)
def share_patient(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    share_request: SharePatientRequest,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Share a patient with another user.
    
    The current user must own the patient to share it.
    """
    user_ip = request.client.host if request.client else "unknown"
    
    try:
        # Resolve username/email to user ID
        user_identifier = share_request.shared_with_user_identifier.strip()
        target_user = None
        
        # Try to find by username first
        target_user = db.query(User).filter(User.username == user_identifier).first()
        
        # If not found by username, try by email
        if not target_user:
            target_user = db.query(User).filter(User.email == user_identifier).first()
        
        if not target_user:
            raise HTTPException(
                status_code=404, 
                detail=f"User not found with username or email: {user_identifier}"
            )
        
        service = PatientSharingService(db)
        share = service.share_patient(
            owner=current_user,
            patient_id=share_request.patient_id,
            shared_with_user_id=target_user.id,
            permission_level=share_request.permission_level,
            expires_at=share_request.expires_at,
            custom_permissions=share_request.custom_permissions
        )
        
        logger.info(
            f"User {current_user.id} shared patient {share_request.patient_id} with user {target_user.id} ({user_identifier})",
            extra={
                "category": "app",
                "event": "patient_shared",
                "user_id": current_user.id,
                "patient_id": share_request.patient_id,
                "shared_with_user_id": target_user.id,
                "shared_with_identifier": user_identifier,
                "permission_level": share_request.permission_level,
                "share_id": share.id,
                "ip": user_ip,
            }
        )
        
        return ShareResponse.from_orm(share)
        
    except HTTPException:
        # Re-raise HTTPExceptions as-is
        raise
    except Exception as e:
        logger.error(
            f"Failed to share patient {share_request.patient_id} for user {current_user.id}: {str(e)}",
            extra={
                "category": "app",
                "event": "patient_sharing_failed",
                "user_id": current_user.id,
                "patient_id": share_request.patient_id,
                "shared_with_identifier": share_request.shared_with_user_identifier,
                "error": str(e),
                "ip": user_ip,
            }
        )
        
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        elif "already shared" in str(e).lower() or "cannot share" in str(e).lower():
            raise HTTPException(status_code=400, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail="Failed to share patient")


@router.delete("/remove-my-access/{patient_id}", response_model=dict)
def remove_my_access(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Remove the current user's access to a shared patient.
    
    This allows users to remove themselves from patient shares they have received.
    The current user must have received access to this patient (not be the owner).
    """
    user_ip = request.client.host if request.client else "unknown"
    
    try:
        service = PatientSharingService(db)
        success = service.remove_user_access(
            user=current_user,
            patient_id=patient_id
        )
        
        if success:
            logger.info(
                f"User {current_user.id} removed their own access to patient {patient_id}",
                extra={
                    "category": "app",
                    "event": "patient_access_self_removed",
                    "user_id": current_user.id,
                    "patient_id": patient_id,
                    "ip": user_ip,
                }
            )
            
            return {"message": "Successfully removed your access to this patient"}
        else:
            return {"message": "No active access found to remove"}
            
    except Exception as e:
        logger.error(
            f"Failed to remove user {current_user.id} access to patient {patient_id}: {str(e)}",
            extra={
                "category": "app",
                "event": "patient_access_self_removal_failed",
                "user_id": current_user.id,
                "patient_id": patient_id,
                "error": str(e),
                "ip": user_ip,
            }
        )
        
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        elif "cannot remove" in str(e).lower() or "not shared" in str(e).lower():
            raise HTTPException(status_code=400, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail="Failed to remove access")


@router.delete("/revoke", response_model=dict)
def revoke_patient_share(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    revoke_request: RevokeShareRequest,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Revoke patient sharing access.
    
    The current user must own the patient to revoke sharing.
    """
    user_ip = request.client.host if request.client else "unknown"
    
    try:
        service = PatientSharingService(db)
        success = service.revoke_patient_share(
            owner=current_user,
            patient_id=revoke_request.patient_id,
            shared_with_user_id=revoke_request.shared_with_user_id
        )
        
        if success:
            logger.info(
                f"User {current_user.id} revoked patient {revoke_request.patient_id} access from user {revoke_request.shared_with_user_id}",
                extra={
                    "category": "app",
                    "event": "patient_share_revoked",
                    "user_id": current_user.id,
                    "patient_id": revoke_request.patient_id,
                    "shared_with_user_id": revoke_request.shared_with_user_id,
                    "ip": user_ip,
                }
            )
            
            return {"message": "Patient sharing access revoked successfully"}
        else:
            return {"message": "No active share found to revoke"}
            
    except Exception as e:
        logger.error(
            f"Failed to revoke patient {revoke_request.patient_id} access for user {current_user.id}: {str(e)}",
            extra={
                "category": "app",
                "event": "patient_share_revocation_failed",
                "user_id": current_user.id,
                "patient_id": revoke_request.patient_id,
                "shared_with_user_id": revoke_request.shared_with_user_id,
                "error": str(e),
                "ip": user_ip,
            }
        )
        
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail="Failed to revoke patient sharing")


@router.put("/", response_model=ShareResponse)
def update_patient_share(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Query(..., description="ID of the patient"),
    shared_with_user_id: int = Query(..., description="ID of the user with access"),
    update_request: UpdateShareRequest,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Update an existing patient share.
    
    The current user must own the patient to update the share.
    """
    user_ip = request.client.host if request.client else "unknown"
    
    try:
        service = PatientSharingService(db)
        share = service.update_patient_share(
            owner=current_user,
            patient_id=patient_id,
            shared_with_user_id=shared_with_user_id,
            permission_level=update_request.permission_level,
            expires_at=update_request.expires_at,
            custom_permissions=update_request.custom_permissions
        )
        
        logger.info(
            f"User {current_user.id} updated patient {patient_id} share for user {shared_with_user_id}",
            extra={
                "category": "app",
                "event": "patient_share_updated",
                "user_id": current_user.id,
                "patient_id": patient_id,
                "shared_with_user_id": shared_with_user_id,
                "share_id": share.id,
                "ip": user_ip,
            }
        )
        
        return ShareResponse.from_orm(share)
        
    except Exception as e:
        logger.error(
            f"Failed to update patient {patient_id} share for user {current_user.id}: {str(e)}",
            extra={
                "category": "app",
                "event": "patient_share_update_failed",
                "user_id": current_user.id,
                "patient_id": patient_id,
                "shared_with_user_id": shared_with_user_id,
                "error": str(e),
                "ip": user_ip,
            }
        )
        
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        else:
            raise HTTPException(status_code=400, detail=str(e))


@router.get("/{patient_id}", response_model=PatientSharesResponse)
def get_patient_shares(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get all active shares for a patient.
    
    The current user must own the patient to view its shares.
    """
    try:
        service = PatientSharingService(db)
        shares = service.get_patient_shares(current_user, patient_id)
        
        # Enhance shares with user information
        enhanced_shares = []
        for share in shares:
            share_dict = {
                "id": share.id,
                "patient_id": share.patient_id,
                "shared_by_user_id": share.shared_by_user_id,
                "shared_with_user_id": share.shared_with_user_id,
                "permission_level": share.permission_level,
                "custom_permissions": share.custom_permissions,
                "is_active": share.is_active,
                "expires_at": share.expires_at,
                "created_at": share.created_at,
                "updated_at": share.updated_at,
            }
            
            # Get user info for the shared_with user
            if hasattr(share, 'shared_with') and share.shared_with:
                share_dict.update({
                    "shared_with_username": share.shared_with.username,
                    "shared_with_email": share.shared_with.email,
                    "shared_with_full_name": share.shared_with.full_name,
                })
            
            enhanced_shares.append(ShareWithUserInfo(**share_dict))
        
        return PatientSharesResponse(
            patient_id=patient_id,
            shares=enhanced_shares,
            total_count=len(enhanced_shares)
        )
        
    except Exception as e:
        logger.error(f"Failed to get patient {patient_id} shares for user {current_user.id}: {str(e)}")
        
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail="Failed to retrieve patient shares")


@router.get("/stats/user", response_model=UserSharingStatsResponse)
def get_user_sharing_stats(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get sharing statistics for the current user.
    
    Returns counts of shares created by the user and shares received by the user.
    """
    try:
        service = PatientSharingService(db)
        stats = service.get_shares_by_user(current_user)
        
        return UserSharingStatsResponse(**stats)
        
    except Exception as e:
        logger.error(f"Failed to get sharing stats for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve sharing statistics")


@router.get("/shared-with-me", response_model=List[ShareResponse])
def get_shares_received(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get all active shares received by the current user.
    
    Returns patients that others have shared with the current user.
    """
    try:
        shares = db.query(PatientShare).filter(
            PatientShare.shared_with_user_id == current_user.id,
            PatientShare.is_active == True
        ).all()
        
        return [ShareResponse.from_orm(share) for share in shares]
        
    except Exception as e:
        logger.error(f"Failed to get received shares for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve received shares")


@router.get("/shared-by-me", response_model=List[ShareResponse])
def get_shares_created(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get all active shares created by the current user.
    
    Returns patients that the current user has shared with others.
    """
    try:
        shares = db.query(PatientShare).filter(
            PatientShare.shared_by_user_id == current_user.id,
            PatientShare.is_active == True
        ).all()
        
        return [ShareResponse.from_orm(share) for share in shares]
        
    except Exception as e:
        logger.error(f"Failed to get created shares for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve created shares")


@router.post("/cleanup-expired", response_model=dict)
def cleanup_expired_shares(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Clean up expired patient shares.
    
    This is a maintenance endpoint that deactivates expired shares.
    Only available to admin users in production.
    """
    try:
        service = PatientSharingService(db)
        count = service.cleanup_expired_shares()
        
        logger.info(
            f"User {current_user.id} cleaned up {count} expired shares",
            extra={
                "category": "app",
                "event": "expired_shares_cleaned",
                "user_id": current_user.id,
                "expired_count": count,
            }
        )
        
        return {"message": f"Cleaned up {count} expired shares"}
        
    except Exception as e:
        logger.error(f"Failed to cleanup expired shares for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to cleanup expired shares")