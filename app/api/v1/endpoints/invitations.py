"""
API endpoints for invitation management
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.models.models import User
from app.api.deps import get_current_user
from app.services.invitation_service import InvitationService
from app.services.family_history_sharing import FamilyHistoryService
from app.schemas.invitations import (
    InvitationCreate,
    InvitationResponse,
    InvitationResponseRequest,
    InvitationSummary
)
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/pending", response_model=List[InvitationResponse])
def get_pending_invitations(
    invitation_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get pending invitations for current user"""
    try:
        service = InvitationService(db)
        invitations = service.get_pending_invitations(current_user, invitation_type)
        
        # Convert to response format
        response_invitations = []
        for invitation in invitations:
            invitation_dict = {
                "id": invitation.id,
                "sent_by_user_id": invitation.sent_by_user_id,
                "sent_to_user_id": invitation.sent_to_user_id,
                "invitation_type": invitation.invitation_type,
                "status": invitation.status,
                "title": invitation.title,
                "message": invitation.message,
                "context_data": invitation.context_data,
                "expires_at": invitation.expires_at,
                "responded_at": invitation.responded_at,
                "response_note": invitation.response_note,
                "created_at": invitation.created_at,
                "updated_at": invitation.updated_at,
                "sent_by": {
                    "id": invitation.sent_by.id,
                    "name": invitation.sent_by.full_name,
                    "email": invitation.sent_by.email
                } if invitation.sent_by else None
            }
            response_invitations.append(invitation_dict)
        
        return response_invitations
    except Exception as e:
        logger.error(f"Error fetching pending invitations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch pending invitations"
        )


@router.get("/sent", response_model=List[InvitationResponse])
def get_sent_invitations(
    invitation_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get invitations sent by current user"""
    try:
        service = InvitationService(db)
        invitations = service.get_sent_invitations(current_user, invitation_type)
        
        # Convert to response format
        response_invitations = []
        for invitation in invitations:
            invitation_dict = {
                "id": invitation.id,
                "sent_by_user_id": invitation.sent_by_user_id,
                "sent_to_user_id": invitation.sent_to_user_id,
                "invitation_type": invitation.invitation_type,
                "status": invitation.status,
                "title": invitation.title,
                "message": invitation.message,
                "context_data": invitation.context_data,
                "expires_at": invitation.expires_at,
                "responded_at": invitation.responded_at,
                "response_note": invitation.response_note,
                "created_at": invitation.created_at,
                "updated_at": invitation.updated_at,
                "sent_to": {
                    "id": invitation.sent_to.id,
                    "name": invitation.sent_to.full_name,
                    "email": invitation.sent_to.email
                } if invitation.sent_to else None
            }
            response_invitations.append(invitation_dict)
        
        return response_invitations
    except Exception as e:
        logger.error(f"Error fetching sent invitations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch sent invitations"
        )


@router.post("/{invitation_id}/respond")
def respond_to_invitation(
    invitation_id: int,
    response_data: InvitationResponseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Respond to an invitation (accept/reject)"""
    try:
        # If it's a family history share being accepted, use the specialized method
        if response_data.response == 'accepted':
            # Get the invitation first to check its type
            invitation_service = InvitationService(db)
            invitation = invitation_service.get_invitation_by_id(invitation_id)
            
            if invitation and invitation.invitation_type == 'family_history_share':
                try:
                    family_service = FamilyHistoryService(db)
                    share_result = family_service.accept_family_history_share_invitation(
                        current_user, 
                        invitation_id, 
                        response_data.response_note
                    )
                    
                    # Handle both single share and bulk share responses
                    if isinstance(share_result, list):
                        # Bulk invitation - multiple shares created
                        share_ids = [share.id for share in share_result]
                        context_data = invitation.context_data or {}
                        family_count = context_data.get('family_member_count', len(share_result))
                        return {
                            "message": f"Successfully accepted family history sharing for {family_count} family members",
                            "invitation_id": invitation.id,
                            "share_ids": share_ids,
                            "share_count": len(share_result),
                            "status": "accepted"
                        }
                    else:
                        # Single invitation - one share created
                        context_data = invitation.context_data or {}
                        member_name = context_data.get('family_member_name', 'family member')
                        return {
                            "message": f"Successfully accepted family history sharing for {member_name}",
                            "invitation_id": invitation.id,
                            "share_id": share_result.id,
                            "status": "accepted"
                        }
                except ValueError as ve:
                    # Handle specific family sharing errors with user-friendly messages
                    error_msg = str(ve)
                    if "not found" in error_msg.lower():
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="The invitation or family history record could not be found"
                        )
                    elif "expired" in error_msg.lower():
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="This invitation has expired and can no longer be accepted"
                        )
                    elif "already shared" in error_msg.lower():
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail="This family history is already shared with you"
                        )
                    else:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Unable to accept family history sharing: {error_msg}"
                        )
                except Exception as e:
                    logger.error(f"Unexpected error accepting family history invitation {invitation_id}: {e}")
                    logger.error(f"Exception type: {type(e).__name__}")
                    import traceback
                    logger.error(f"Full traceback: {traceback.format_exc()}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="An unexpected error occurred while accepting the family history sharing invitation. Please try again or contact support."
                    )
        
        # For all other cases (reject, or non-family-history accepts)
        invitation_service = InvitationService(db)
        invitation = invitation_service.respond_to_invitation(
            current_user, 
            invitation_id, 
            response_data.response,
            response_data.response_note
        )
        
        return {
            "message": f"Invitation {response_data.response}",
            "invitation_id": invitation.id,
            "status": invitation.status
        }
            
    except ValueError as e:
        error_msg = str(e)
        # Provide more user-friendly error messages for common issues
        if "not found" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="The invitation could not be found or may have already been responded to"
            )
        elif "expired" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This invitation has expired and can no longer be responded to"
            )
        elif "already responded" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You have already responded to this invitation"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg
            )
    except HTTPException:
        # Re-raise HTTP exceptions (these are already properly formatted)
        raise
    except Exception as e:
        logger.error(f"Error responding to invitation {invitation_id}: {e}")
        logger.error(f"Exception type: {type(e).__name__}")
        logger.error(f"Response data: {response_data}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while responding to the invitation. Please try again or contact support."
        )


@router.delete("/{invitation_id}")
def cancel_invitation(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a sent invitation"""
    try:
        service = InvitationService(db)
        invitation = service.cancel_invitation(current_user, invitation_id)
        
        return {
            "message": "Invitation cancelled successfully",
            "invitation_id": invitation.id,
            "status": invitation.status
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error cancelling invitation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel invitation"
        )


@router.post("/{invitation_id}/revoke")
def revoke_invitation(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke an accepted invitation (specifically for family history shares)"""
    try:
        logger.info(f"DEBUG: Revoke request for invitation {invitation_id} by user {current_user.id}")
        
        # Get the invitation first
        invitation_service = InvitationService(db)
        invitation = invitation_service.get_invitation_by_id(invitation_id)
        
        if not invitation:
            logger.info(f"DEBUG: Invitation {invitation_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found"
            )
        
        logger.info(f"DEBUG: Found invitation {invitation_id} - sent_by={invitation.sent_by_user_id}, current_user={current_user.id}")
        
        # Verify the user owns this invitation
        if invitation.sent_by_user_id != current_user.id:
            logger.info(f"DEBUG: Authorization failed - invitation sent by {invitation.sent_by_user_id}, current user is {current_user.id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to revoke this invitation"
            )
        
        # Handle family history share revocation  
        logger.info(f"DEBUG: Checking invitation {invitation_id} - type={invitation.invitation_type}, status={invitation.status}")
        if invitation.invitation_type == 'family_history_share' and invitation.status == 'accepted':
            family_service = FamilyHistoryService(db)
            shared_with_user_id = invitation.sent_to_user_id
            
            logger.info(f"DEBUG: Revoking invitation {invitation_id} - shared_with_user_id={shared_with_user_id}, context_data={invitation.context_data}")
            
            # Check if this is a bulk invitation
            if invitation.context_data.get('is_bulk_invite', False):
                # Handle bulk invitation - revoke all shares
                family_members_data = invitation.context_data.get('family_members', [])
                if not family_members_data:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid bulk invitation context data"
                    )
                
                revoked_shares = []
                for family_member_data in family_members_data:
                    family_member_id = family_member_data.get('family_member_id')
                    if family_member_id:
                        try:
                            # Don't update invitation status in individual revocations
                            share = family_service.revoke_family_history_share(
                                current_user, 
                                family_member_id, 
                                shared_with_user_id,
                                update_invitation_status=False
                            )
                            revoked_shares.append(share)
                        except Exception as e:
                            logger.warning(f"Failed to revoke share for family member {family_member_id}: {e}")
                
                # After all shares are revoked, update the invitation status
                if revoked_shares:
                    invitation_service = InvitationService(db)
                    invitation_service.update_invitation_status(invitation_id, 'revoked')
                
                return {
                    "message": f"Bulk family history sharing revoked successfully for {len(revoked_shares)} family members",
                    "invitation_id": invitation.id,
                    "revoked_share_count": len(revoked_shares),
                    "status": "revoked"
                }
            else:
                # Handle single invitation
                family_member_id = invitation.context_data.get('family_member_id')
                
                if not family_member_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid invitation context data - missing family_member_id"
                    )
                
                # Revoke the share (this will also update the invitation status)
                share = family_service.revoke_family_history_share(
                    current_user, 
                    family_member_id, 
                    shared_with_user_id
                )
                
                return {
                    "message": "Family history sharing revoked successfully",
                    "invitation_id": invitation.id,
                    "share_id": share.id,
                    "status": "revoked"
                }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Can only revoke accepted family history share invitations"
            )
            
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error revoking invitation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke invitation"
        )


@router.post("/cleanup")
def cleanup_expired_invitations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cleanup expired invitations (admin/maintenance endpoint)"""
    try:
        # Could be restricted to admin users only in the future
        service = InvitationService(db)
        expired_count = service.expire_old_invitations()
        
        return {
            "message": f"Expired {expired_count} old invitations",
            "expired_count": expired_count
        }
    except Exception as e:
        logger.error(f"Error cleaning up expired invitations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cleanup expired invitations"
        )


@router.get("/summary")
def get_invitation_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get invitation summary for current user"""
    try:
        service = InvitationService(db)
        
        pending_invitations = service.get_pending_invitations(current_user)
        sent_invitations = service.get_sent_invitations(current_user)
        
        # Count by status
        pending_count = len(pending_invitations)
        sent_pending = len([inv for inv in sent_invitations if inv.status == 'pending'])
        sent_accepted = len([inv for inv in sent_invitations if inv.status == 'accepted'])
        sent_rejected = len([inv for inv in sent_invitations if inv.status == 'rejected'])
        
        return {
            "pending_received": pending_count,
            "sent_pending": sent_pending,
            "sent_accepted": sent_accepted,
            "sent_rejected": sent_rejected,
            "total_received": pending_count,
            "total_sent": len(sent_invitations)
        }
    except Exception as e:
        logger.error(f"Error fetching invitation summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch invitation summary"
        )