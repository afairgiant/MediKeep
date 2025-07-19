"""
Family history sharing service with invitation-based workflow
"""

from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.models.models import User, FamilyMember, FamilyCondition, FamilyHistoryShare, Patient, Invitation
from app.services.invitation_service import InvitationService
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


def get_utc_now():
    """Get the current UTC datetime with timezone awareness."""
    return datetime.now(datetime.timezone.utc)


class FamilyHistoryService:
    
    def __init__(self, db: Session):
        self.db = db
        self.invitation_service = InvitationService(db)
    
    def get_my_family_history(self, user: User) -> List[FamilyMember]:
        """Get family history records owned by user"""
        try:
            return self.db.query(FamilyMember).join(Patient).filter(
                Patient.owner_user_id == user.id
            ).all()
        except Exception as e:
            logger.error(f"Error fetching user's family history: {e}")
            raise
    
    def get_shared_family_history(self, user: User) -> List[Dict]:
        """Get family history records shared with user (only accepted shares)"""
        try:
            shared_history_raw = self.db.query(FamilyMember, FamilyHistoryShare, User, Invitation).join(
                FamilyHistoryShare, FamilyMember.id == FamilyHistoryShare.family_member_id
            ).join(
                User, FamilyHistoryShare.shared_by_user_id == User.id
            ).join(
                Invitation, FamilyHistoryShare.invitation_id == Invitation.id
            ).filter(
                FamilyHistoryShare.shared_with_user_id == user.id,
                FamilyHistoryShare.is_active == True,
                Invitation.status == 'accepted'  # Only show accepted shares
            ).all()
            
            # Format shared history with sharing context
            shared_history = []
            for family_member, share, shared_by_user, invitation in shared_history_raw:
                shared_history.append({
                    "family_member": family_member,
                    "share_details": {
                        "shared_by": {
                            "id": shared_by_user.id,
                            "name": shared_by_user.full_name,
                            "email": shared_by_user.email
                        },
                        "shared_at": share.created_at,
                        "sharing_note": share.sharing_note,
                        "permission_level": share.permission_level,
                        "invitation": {
                            "id": invitation.id,
                            "title": invitation.title,
                            "message": invitation.message,
                            "accepted_at": invitation.responded_at
                        }
                    }
                })
            
            return shared_history
        except Exception as e:
            logger.error(f"Error fetching shared family history: {e}")
            raise
    
    def get_all_accessible_family_history(self, user: User) -> Dict:
        """Get all family history accessible to user (owned + shared)"""
        owned = self.get_my_family_history(user)
        shared = self.get_shared_family_history(user)
        
        return {
            "owned_family_history": owned,
            "shared_family_history": shared,
            "summary": {
                "owned_count": len(owned),
                "shared_count": len(shared),
                "total_count": len(owned) + len(shared)
            }
        }
    
    def send_family_history_share_invitation(self, user: User, family_member_id: int, 
                                           shared_with_identifier: str, 
                                           permission_level: str = 'view',
                                           sharing_note: Optional[str] = None) -> Invitation:
        """Send invitation to share family member's history"""
        try:
            # 1. Verify user owns this family member record
            family_member = self.db.query(FamilyMember).join(Patient).filter(
                FamilyMember.id == family_member_id,
                Patient.owner_user_id == user.id
            ).first()
            
            if not family_member:
                raise ValueError("Family member not found or not owned by user")
            
            # 2. Find the recipient user
            recipient_user = self.db.query(User).filter(
                or_(User.username == shared_with_identifier, 
                    User.email == shared_with_identifier)
            ).first()
            
            if not recipient_user:
                raise ValueError("Recipient user not found")
            
            # 3. Check if already shared
            existing_share = self.db.query(FamilyHistoryShare).filter(
                FamilyHistoryShare.family_member_id == family_member_id,
                FamilyHistoryShare.shared_with_user_id == recipient_user.id,
                FamilyHistoryShare.is_active == True
            ).first()
            
            if existing_share:
                raise ValueError("Family history already shared with this user")
            
            # 4. Create invitation
            context_data = {
                "family_member_id": family_member_id,
                "family_member_name": family_member.name,
                "family_member_relationship": family_member.relationship,
                "permission_level": permission_level,
                "sharing_note": sharing_note
            }
            
            title = f"Family History Share: {family_member.name} ({family_member.relationship})"
            message = sharing_note or f"I'd like to share {family_member.name}'s family medical history with you."
            
            invitation = self.invitation_service.create_invitation(
                sent_by_user=user,
                sent_to_identifier=shared_with_identifier,
                invitation_type='family_history_share',
                title=title,
                context_data=context_data,
                message=message,
                expires_hours=168  # 7 days
            )
            
            logger.info(f"Sent family history share invitation: {invitation.id}")
            return invitation
            
        except Exception as e:
            logger.error(f"Error sending family history share invitation: {e}")
            raise
    
    def accept_family_history_share_invitation(self, user: User, invitation_id: int,
                                             response_note: Optional[str] = None) -> FamilyHistoryShare:
        """Accept a family history share invitation and create the share"""
        try:
            # 1. Accept the invitation
            invitation = self.invitation_service.respond_to_invitation(
                user, invitation_id, 'accepted', response_note
            )
            
            # 2. Extract context data
            context_data = invitation.context_data
            family_member_id = context_data['family_member_id']
            permission_level = context_data['permission_level']
            sharing_note = context_data['sharing_note']
            
            # 3. Create the family history share
            share = FamilyHistoryShare(
                invitation_id=invitation.id,
                family_member_id=family_member_id,
                shared_by_user_id=invitation.sent_by_user_id,
                shared_with_user_id=user.id,
                permission_level=permission_level,
                sharing_note=sharing_note
            )
            
            self.db.add(share)
            self.db.commit()
            
            logger.info(f"Created family history share from invitation: {share.id}")
            return share
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error accepting family history share invitation: {e}")
            raise
    
    def reject_family_history_share_invitation(self, user: User, invitation_id: int,
                                             response_note: Optional[str] = None) -> Invitation:
        """Reject a family history share invitation"""
        try:
            invitation = self.invitation_service.respond_to_invitation(
                user, invitation_id, 'rejected', response_note
            )
            
            logger.info(f"Rejected family history share invitation: {invitation.id}")
            return invitation
            
        except Exception as e:
            logger.error(f"Error rejecting family history share invitation: {e}")
            raise
    
    def get_family_member_shares(self, user: User, family_member_id: int) -> List[Dict]:
        """Get all shares for a family member (must be owner)"""
        try:
            # Verify ownership
            family_member = self.db.query(FamilyMember).join(Patient).filter(
                FamilyMember.id == family_member_id,
                Patient.owner_user_id == user.id
            ).first()
            
            if not family_member:
                raise ValueError("Family member not found or not owned by user")
            
            # Get active shares with invitation details
            shares_raw = self.db.query(FamilyHistoryShare, Invitation, User).join(
                Invitation, FamilyHistoryShare.invitation_id == Invitation.id
            ).join(
                User, FamilyHistoryShare.shared_with_user_id == User.id
            ).filter(
                FamilyHistoryShare.family_member_id == family_member_id,
                FamilyHistoryShare.is_active == True,
                Invitation.status == 'accepted'
            ).all()
            
            # Format response
            shares = []
            for share, invitation, shared_with_user in shares_raw:
                shares.append({
                    "share": share,
                    "invitation": invitation,
                    "shared_with": {
                        "id": shared_with_user.id,
                        "name": shared_with_user.full_name,
                        "email": shared_with_user.email
                    }
                })
            
            return shares
            
        except Exception as e:
            logger.error(f"Error fetching family member shares: {e}")
            raise
    
    def revoke_family_history_share(self, user: User, family_member_id: int, shared_with_user_id: int) -> FamilyHistoryShare:
        """Revoke family history sharing"""
        try:
            share = self.db.query(FamilyHistoryShare).join(FamilyMember).join(Patient).filter(
                FamilyHistoryShare.family_member_id == family_member_id,
                FamilyHistoryShare.shared_with_user_id == shared_with_user_id,
                Patient.owner_user_id == user.id,  # Ensure user owns the family member
                FamilyHistoryShare.is_active == True
            ).first()
            
            if not share:
                raise ValueError("Share not found or not authorized")
            
            share.is_active = False
            share.updated_at = get_utc_now()
            self.db.commit()
            logger.info(f"Revoked family history share: {share.id}")
            return share
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error revoking family history share: {e}")
            raise
    
    def bulk_send_family_history_invitations(self, user: User, family_member_ids: List[int], 
                                           shared_with_identifier: str, permission_level: str = 'view',
                                           sharing_note: Optional[str] = None) -> List[Dict]:
        """Send multiple family history share invitations to one user"""
        results = []
        
        for family_member_id in family_member_ids:
            try:
                invitation = self.send_family_history_share_invitation(
                    user, family_member_id, shared_with_identifier, 
                    permission_level, sharing_note
                )
                results.append({
                    "family_member_id": family_member_id, 
                    "success": True, 
                    "invitation_id": invitation.id
                })
            except Exception as e:
                results.append({
                    "family_member_id": family_member_id, 
                    "success": False, 
                    "error": str(e)
                })
        
        return results
    
    def get_family_member_with_conditions(self, family_member_id: int, user: User) -> Optional[FamilyMember]:
        """Get family member with conditions - check if user has access"""
        try:
            # Check if user owns this family member
            family_member = self.db.query(FamilyMember).join(Patient).filter(
                FamilyMember.id == family_member_id,
                Patient.owner_user_id == user.id
            ).first()
            
            if family_member:
                return family_member
            
            # Check if user has access via sharing
            shared_member = self.db.query(FamilyMember).join(FamilyHistoryShare).join(Invitation).filter(
                FamilyMember.id == family_member_id,
                FamilyHistoryShare.shared_with_user_id == user.id,
                FamilyHistoryShare.is_active == True,
                Invitation.status == 'accepted'
            ).first()
            
            return shared_member
            
        except Exception as e:
            logger.error(f"Error fetching family member with conditions: {e}")
            raise