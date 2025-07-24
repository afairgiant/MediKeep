"""
API endpoints for family history sharing
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.models import User
from app.api.deps import get_current_user
from app.services.family_history_sharing import FamilyHistoryService
from app.schemas.family_history_sharing import (
    FamilyHistoryShareInvitationCreate,
    FamilyHistoryBulkInvite,
    FamilyHistoryShareResponse,
    OrganizedFamilyHistory,
    BulkInviteResponse,
    BulkInviteResult
)
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/mine", response_model=OrganizedFamilyHistory)
def get_organized_family_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all family history accessible to current user (owned + shared)"""
    try:
        service = FamilyHistoryService(db)
        return service.get_all_accessible_family_history(current_user)
    except Exception as e:
        logger.error(f"Error fetching organized family history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch family history"
        )


@router.get("/{family_member_id}/shares")
def get_family_member_shares(
    family_member_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """See who has access to this family member's history"""
    try:
        service = FamilyHistoryService(db)
        shares = service.get_family_member_shares(current_user, family_member_id)
        
        # Format the response to match the expected structure
        formatted_shares = []
        for share_data in shares:
            formatted_shares.append({
                "id": share_data["share"].id,
                "family_member_id": share_data["share"].family_member_id,
                "shared_by_user_id": share_data["share"].shared_by_user_id,
                "shared_with_user_id": share_data["share"].shared_with_user_id,
                "permission_level": share_data["share"].permission_level,
                "sharing_note": share_data["share"].sharing_note,
                "created_at": share_data["share"].created_at,
                "updated_at": share_data["share"].updated_at,
                "shared_with": share_data["shared_with"],
                "invitation": {
                    "id": share_data["invitation"].id,
                    "title": share_data["invitation"].title,
                    "message": share_data["invitation"].message,
                    "responded_at": share_data["invitation"].responded_at
                }
            })
        
        return formatted_shares
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error fetching family member shares: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch shares"
        )


@router.post("/{family_member_id}/shares")
def send_family_history_share_invitation(
    family_member_id: int,
    invite_data: FamilyHistoryShareInvitationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send invitation to share family member's history with another user"""
    try:
        service = FamilyHistoryService(db)
        invitation = service.send_family_history_share_invitation(
            current_user, 
            family_member_id, 
            invite_data.shared_with_identifier,
            invite_data.permission_level,
            invite_data.sharing_note,
            invite_data.expires_hours
        )
        return {
            "message": "Family history share invitation sent successfully",
            "invitation_id": invitation.id,
            "expires_at": invitation.expires_at,
            "title": invitation.title
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error sending family history share invitation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send invitation"
        )


@router.delete("/{family_member_id}/shares/{user_id}")
def revoke_family_member_share(
    family_member_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke family history sharing"""
    try:
        service = FamilyHistoryService(db)
        service.revoke_family_history_share(current_user, family_member_id, user_id)
        return {"message": "Family history sharing revoked successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error revoking family history share: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke sharing"
        )


@router.post("/bulk-invite")
def bulk_send_family_history_invitations(
    bulk_invite_data: FamilyHistoryBulkInvite,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send ONE invitation to share multiple family members with one user"""
    try:
        service = FamilyHistoryService(db)
        result = service.bulk_send_family_history_invitations(
            current_user,
            bulk_invite_data.family_member_ids,
            bulk_invite_data.shared_with_identifier,
            bulk_invite_data.permission_level,
            bulk_invite_data.sharing_note,
            bulk_invite_data.expires_hours
        )
        
        return result
    except ValueError as e:
        logger.warning(f"Validation error in bulk sending family history invitations: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error bulk sending family history invitations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to bulk send invitations"
        )


@router.get("/{family_member_id}/details")
def get_family_member_details(
    family_member_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get family member details with conditions (if user has access)"""
    try:
        service = FamilyHistoryService(db)
        family_member = service.get_family_member_with_conditions(family_member_id, current_user)
        
        if not family_member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Family member not found or access denied"
            )
        
        return {
            "id": family_member.id,
            "name": family_member.name,
            "relationship": family_member.relationship,
            "gender": family_member.gender,
            "birth_year": family_member.birth_year,
            "death_year": family_member.death_year,
            "is_deceased": family_member.is_deceased,
            "notes": family_member.notes,
            "family_conditions": [
                {
                    "id": condition.id,
                    "condition_name": condition.condition_name,
                    "diagnosis_age": condition.diagnosis_age,
                    "severity": condition.severity,
                    "status": condition.status,
                    "condition_type": condition.condition_type,
                    "notes": condition.notes,
                    "icd10_code": condition.icd10_code,
                    "created_at": condition.created_at,
                    "updated_at": condition.updated_at
                } for condition in family_member.family_conditions
            ]
        }
    except Exception as e:
        logger.error(f"Error fetching family member details: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch family member details"
        )


@router.get("/shared-with-me")
def get_shared_family_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get only family history shared with current user"""
    try:
        service = FamilyHistoryService(db)
        shared_history = service.get_shared_family_history(current_user)
        
        return {
            "shared_family_history": shared_history,
            "count": len(shared_history)
        }
    except Exception as e:
        logger.error(f"Error fetching shared family history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch shared family history"
        )


@router.get("/my-own")
def get_my_family_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get only family history owned by current user"""
    try:
        service = FamilyHistoryService(db)
        owned_history = service.get_my_family_history(current_user)
        
        return {
            "owned_family_history": owned_history,
            "count": len(owned_history)
        }
    except Exception as e:
        logger.error(f"Error fetching owned family history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch owned family history"
        )


@router.get("/shared-by-me")
def get_shared_by_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all family history that current user has shared with others"""
    try:
        service = FamilyHistoryService(db)
        shared_by_me = service.get_family_history_shared_by_me(current_user)
        
        return {
            "shared_by_me": shared_by_me,
            "count": len(shared_by_me)
        }
    except Exception as e:
        logger.error(f"Error fetching shared by me family history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch shared by me family history"
        )