"""
Family history sharing service with invitation-based workflow
"""

from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.models.models import User, FamilyMember, FamilyCondition, FamilyHistoryShare, Patient, Invitation
from app.services.invitation_service import InvitationService
from app.core.datetime_utils import get_utc_now
from datetime import datetime, timedelta, timezone
from app.core.logging_config import get_logger

logger = get_logger(__name__, "app")


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
        """Get family history records shared with user (only accepted shares)
        
        Performance considerations:
        - Uses joinedload for eager loading of family_conditions to reduce N+1 queries
        - Recommended database indexes for optimal performance:
          - (shared_with_user_id, is_active) on family_history_shares
          - (invitation_id) on family_history_shares 
          - (status) on invitations
        """
        try:
            from sqlalchemy.orm import joinedload
            
            # Optimized query with selective field loading and proper indexing considerations
            shared_history_raw = self.db.query(FamilyMember, FamilyHistoryShare, User, Invitation).options(
                joinedload(FamilyMember.family_conditions)
            ).join(
                FamilyHistoryShare, FamilyMember.id == FamilyHistoryShare.family_member_id
            ).join(
                User, FamilyHistoryShare.shared_by_user_id == User.id
            ).join(
                Invitation, FamilyHistoryShare.invitation_id == Invitation.id
            ).filter(
                FamilyHistoryShare.shared_with_user_id == user.id,
                FamilyHistoryShare.is_active == True,
                Invitation.status == 'accepted'  # Only show accepted shares
            ).order_by(FamilyMember.name).all()  # Add consistent ordering for predictable results
            
            # Optimized formatting with reduced dictionary operations
            shared_history = []
            for family_member, share, shared_by_user, invitation in shared_history_raw:
                # Use dictionary comprehension for family_conditions to improve performance
                family_conditions = [
                    {
                        "id": condition.id,
                        "condition_name": condition.condition_name,
                        "condition_type": condition.condition_type,
                        "severity": condition.severity,
                        "diagnosis_age": condition.diagnosis_age,
                        "status": condition.status,
                        "notes": condition.notes,
                        "icd10_code": condition.icd10_code,
                        "created_at": condition.created_at,
                        "updated_at": condition.updated_at
                    } for condition in family_member.family_conditions
                ] if family_member.family_conditions else []
                
                # Build family member dictionary efficiently
                family_member_dict = {
                    "id": family_member.id,
                    "name": family_member.name,
                    "relationship": family_member.relationship,
                    "gender": family_member.gender,
                    "birth_year": family_member.birth_year,
                    "death_year": family_member.death_year,
                    "is_deceased": family_member.is_deceased,
                    "notes": family_member.notes,
                    "patient_id": family_member.patient_id,
                    "created_at": family_member.created_at,
                    "updated_at": family_member.updated_at,
                    "family_conditions": family_conditions
                }
                
                # Build result dictionary efficiently
                shared_history.append({
                    "family_member": family_member_dict,
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
                                           sharing_note: Optional[str] = None,
                                           expires_hours: Optional[int] = 168) -> Invitation:
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
            message = sharing_note
            
            invitation = self.invitation_service.create_invitation(
                sent_by_user=user,
                sent_to_identifier=shared_with_identifier,
                invitation_type='family_history_share',
                title=title,
                context_data=context_data,
                message=message,
                expires_hours=expires_hours
            )
            
            logger.info(f"Sent family history share invitation: {invitation.id}")
            return invitation
            
        except Exception as e:
            logger.error(f"Error sending family history share invitation: {e}")
            raise
    
    def accept_family_history_share_invitation(self, user: User, invitation_id: int,
                                             response_note: Optional[str] = None):
        """Accept a family history share invitation and create the share(s)"""
        try:
            # 1. Get the invitation first (don't accept it yet)
            invitation = self.db.query(Invitation).filter(
                Invitation.id == invitation_id,
                Invitation.sent_to_user_id == user.id,
                Invitation.status == 'pending'
            ).first()
            
            if not invitation:
                raise ValueError("Invitation not found or not pending")
            
            # Check if expired
            if invitation.expires_at:
                now = get_utc_now()
                # Ensure both datetimes are timezone-aware for comparison
                expires_at = invitation.expires_at
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at < now:
                    raise ValueError("Invitation has expired")
            
            # 2. Extract context data with error handling
            context_data = invitation.context_data
            logger.info(f"DEBUG: Processing invitation {invitation_id} with context_data: {context_data}")
            
            if not context_data:
                raise ValueError("Invitation context data is missing")
            
            permission_level = context_data.get('permission_level', 'view')
            sharing_note = context_data.get('sharing_note')
            
            # 3. Check if this is a bulk invitation
            if context_data.get('is_bulk_invite', False):
                # Handle bulk invitation - create multiple shares
                family_members_data = context_data.get('family_members', [])
                if not family_members_data:
                    raise ValueError("Bulk invitation missing family_members data")
                shares = []
                
                for family_member_data in family_members_data:
                    family_member_id = family_member_data.get('family_member_id')
                    if not family_member_id:
                        logger.warning(f"Skipping family member data without ID: {family_member_data}")
                        continue
                    
                    # Check if an active share already exists
                    existing_active_share = self.db.query(FamilyHistoryShare).filter(
                        FamilyHistoryShare.family_member_id == family_member_id,
                        FamilyHistoryShare.shared_with_user_id == user.id,
                        FamilyHistoryShare.is_active == True
                    ).first()
                    
                    if existing_active_share:
                        logger.info(f"Active share already exists for family_member_id={family_member_id}, user_id={user.id}, using existing share")
                        shares.append(existing_active_share)
                        continue
                    
                    # Check if there are any inactive shares (expired/revoked) - these are OK to have multiple of
                    inactive_shares = self.db.query(FamilyHistoryShare).filter(
                        FamilyHistoryShare.family_member_id == family_member_id,
                        FamilyHistoryShare.shared_with_user_id == user.id,
                        FamilyHistoryShare.is_active == False
                    ).count()
                    
                    if inactive_shares > 0:
                        logger.info(f"Found {inactive_shares} inactive shares for family_member_id={family_member_id}, user_id={user.id}, creating new active share")
                    
                        
                    share = FamilyHistoryShare(
                        invitation_id=invitation.id,
                        family_member_id=family_member_id,
                        shared_by_user_id=invitation.sent_by_user_id,
                        shared_with_user_id=user.id,
                        permission_level=permission_level,
                        sharing_note=sharing_note
                    )
                    self.db.add(share)
                    shares.append(share)
                
                # Update invitation status after shares are created
                invitation.status = 'accepted'
                invitation.responded_at = get_utc_now()
                invitation.response_note = response_note
                invitation.updated_at = get_utc_now()
                
                self.db.commit()
                logger.info(f"Created {len(shares)} family history shares from bulk invitation: {invitation.id}")
                return shares
            else:
                # Handle single invitation
                family_member_id = context_data.get('family_member_id')
                if not family_member_id:
                    raise ValueError("Single invitation missing family_member_id")
                
                # Check if an active share already exists
                existing_active_share = self.db.query(FamilyHistoryShare).filter(
                    FamilyHistoryShare.family_member_id == family_member_id,
                    FamilyHistoryShare.shared_with_user_id == user.id,
                    FamilyHistoryShare.is_active == True
                ).first()
                
                if existing_active_share:
                    logger.info(f"Active share already exists for family_member_id={family_member_id}, user_id={user.id}, using existing share")
                    # Update invitation status even if share already exists
                    invitation.status = 'accepted'
                    invitation.responded_at = get_utc_now()
                    invitation.response_note = response_note
                    invitation.updated_at = get_utc_now()
                    self.db.commit()
                    return existing_active_share
                
                share = FamilyHistoryShare(
                    invitation_id=invitation.id,
                    family_member_id=family_member_id,
                    shared_by_user_id=invitation.sent_by_user_id,
                    shared_with_user_id=user.id,
                    permission_level=permission_level,
                    sharing_note=sharing_note
                )
                
                self.db.add(share)
                
                # Update invitation status after share is created
                invitation.status = 'accepted'
                invitation.responded_at = get_utc_now()
                invitation.response_note = response_note
                invitation.updated_at = get_utc_now()
                
                self.db.commit()
                
                logger.info(f"Created family history share from invitation: {share.id}")
                return share
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error accepting family history share invitation {invitation_id}: {e}")
            logger.error(f"Exception type: {type(e).__name__}")
            logger.error(f"User ID: {user.id}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
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
    
    def revoke_family_history_share(self, user: User, family_member_id: int, shared_with_user_id: int, update_invitation_status: bool = True) -> FamilyHistoryShare:
        """Revoke family history sharing"""
        try:
            # First, try to find an active share
            share = self.db.query(FamilyHistoryShare).join(FamilyMember).join(Patient).filter(
                FamilyHistoryShare.family_member_id == family_member_id,
                FamilyHistoryShare.shared_with_user_id == shared_with_user_id,
                Patient.owner_user_id == user.id,  # Ensure user owns the family member
                FamilyHistoryShare.is_active == True
            ).first()
            
            if share:
                # Update the share
                share.is_active = False
                share.updated_at = get_utc_now()
                
                # Optionally update the related invitation status to 'revoked'
                if update_invitation_status:
                    invitation = self.db.query(Invitation).filter(
                        Invitation.id == share.invitation_id
                    ).first()
                    
                    if invitation:
                        # For bulk invitations, only mark as revoked if ALL shares are inactive
                        if invitation.context_data.get('is_bulk_invite', False):
                            # Check if all shares for this invitation are now inactive
                            active_shares_count = self.db.query(FamilyHistoryShare).filter(
                                FamilyHistoryShare.invitation_id == invitation.id,
                                FamilyHistoryShare.is_active == True
                            ).count()
                            
                            logger.info(f"DEBUG: Bulk invitation {invitation.id} has {active_shares_count} active shares remaining")
                            
                            if active_shares_count <= 1:  # This share will become inactive after commit
                                invitation.status = 'revoked'
                                invitation.updated_at = get_utc_now()
                                logger.info(f"DEBUG: Marking bulk invitation {invitation.id} as revoked")
                            else:
                                logger.info(f"DEBUG: Not revoking bulk invitation {invitation.id} - still has {active_shares_count} active shares")
                        else:
                            # Single invitation - always mark as revoked
                            invitation.status = 'revoked'
                            invitation.updated_at = get_utc_now()
                
                self.db.commit()
                logger.info(f"Revoked family history share: {share.id} and updated invitation status: {update_invitation_status}")
                return share
            
            # If no active share found, check if there's an inactive one (already revoked)
            existing_share = self.db.query(FamilyHistoryShare).join(FamilyMember).join(Patient).filter(
                FamilyHistoryShare.family_member_id == family_member_id,
                FamilyHistoryShare.shared_with_user_id == shared_with_user_id,
                Patient.owner_user_id == user.id
            ).first()
            
            if existing_share:
                # Share exists but is already inactive - update invitation status to revoked if needed
                invitation = self.db.query(Invitation).filter(
                    Invitation.id == existing_share.invitation_id
                ).first()
                
                if invitation and invitation.status != 'revoked':
                    invitation.status = 'revoked'
                    invitation.updated_at = get_utc_now()
                    self.db.commit()
                    logger.info(f"Updated invitation {invitation.id} status to revoked for already inactive share {existing_share.id}")
                
                logger.info(f"Family history share {existing_share.id} already revoked")
                return existing_share  # Return the existing share instead of raising error
            else:
                # No share found at all
                logger.warning(f"No family history share found for family_member_id={family_member_id}, shared_with_user_id={shared_with_user_id}, owner={user.id}")
                raise ValueError("Share not found or not authorized")
                
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error revoking family history share (family_member_id={family_member_id}, shared_with_user_id={shared_with_user_id}): {e}")
            raise
    
    def remove_my_access_to_family_history(self, user: User, family_member_id: int) -> FamilyHistoryShare:
        """Allow a recipient user to remove their own access to shared family history"""
        try:
            # Find an active share where the current user is the recipient
            share = self.db.query(FamilyHistoryShare).filter(
                FamilyHistoryShare.family_member_id == family_member_id,
                FamilyHistoryShare.shared_with_user_id == user.id,  # Current user is the recipient
                FamilyHistoryShare.is_active == True
            ).first()
            
            if not share:
                logger.warning(f"No active family history share found for family_member_id={family_member_id}, recipient_user_id={user.id}")
                raise ValueError("No active share found or not authorized to remove access")
            
            # Set the share to inactive (now allowed due to partial unique constraint)
            share.is_active = False
            share.updated_at = get_utc_now()
            
            # Update the related invitation status (but don't mark as revoked - the recipient removed access)
            invitation = self.db.query(Invitation).filter(
                Invitation.id == share.invitation_id
            ).first()
            
            if invitation:
                # For bulk invitations, only update status if ALL shares for this user are inactive
                if invitation.context_data.get('is_bulk_invite', False):
                    # Check if all shares for this invitation and this recipient are now inactive
                    active_shares_count = self.db.query(FamilyHistoryShare).filter(
                        FamilyHistoryShare.invitation_id == invitation.id,
                        FamilyHistoryShare.shared_with_user_id == user.id,
                        FamilyHistoryShare.is_active == True
                    ).count()
                    
                    logger.info(f"DEBUG: Bulk invitation {invitation.id} has {active_shares_count} active shares remaining for user {user.id}")
                    
                    # Note: We don't change the invitation status here because the recipient removed access,
                    # not the sender. The invitation remains 'accepted' but the shares are inactive.
                else:
                    # Single invitation - recipient removed access but invitation remains accepted
                    logger.info(f"DEBUG: Recipient {user.id} removed access to single invitation {invitation.id}")
            
            self.db.commit()
            logger.info(f"User {user.id} removed their own access to family history share: {share.id}")
            return share
                
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error removing user's own access to family history (family_member_id={family_member_id}, user_id={user.id}): {e}")
            raise
    
    def bulk_send_family_history_invitations(self, user: User, family_member_ids: List[int], 
                                           shared_with_identifier: str, permission_level: str = 'view',
                                           sharing_note: Optional[str] = None,
                                           expires_hours: Optional[int] = 168) -> Dict:
        """Send ONE invitation to share multiple family members' history with one user"""
        try:
            # 1. Verify user owns all family member records
            family_members = []
            for family_member_id in family_member_ids:
                family_member = self.db.query(FamilyMember).join(Patient).filter(
                    FamilyMember.id == family_member_id,
                    Patient.owner_user_id == user.id
                ).first()
                
                if not family_member:
                    raise ValueError(f"Family member {family_member_id} not found or not owned by user")
                
                family_members.append(family_member)
            
            # 2. Find the recipient user
            recipient_user = self.db.query(User).filter(
                or_(User.username == shared_with_identifier, 
                    User.email == shared_with_identifier)
            ).first()
            
            if not recipient_user:
                raise ValueError("Recipient user not found")
            
            # 3. Check if any family members are already shared
            already_shared = []
            for family_member in family_members:
                existing_share = self.db.query(FamilyHistoryShare).filter(
                    FamilyHistoryShare.family_member_id == family_member.id,
                    FamilyHistoryShare.shared_with_user_id == recipient_user.id,
                    FamilyHistoryShare.is_active == True
                ).first()
                
                if existing_share:
                    already_shared.append(family_member.name)
            
            if already_shared:
                raise ValueError(f"Family history already shared for: {', '.join(already_shared)}")
            
            # 4. Create bulk invitation context data
            family_members_data = []
            for family_member in family_members:
                family_members_data.append({
                    "family_member_id": family_member.id,
                    "family_member_name": family_member.name,
                    "family_member_relationship": family_member.relationship
                })
            
            context_data = {
                "family_members": family_members_data,
                "permission_level": permission_level,
                "sharing_note": sharing_note,
                "is_bulk_invite": True,
                "family_member_count": len(family_members)
            }
            
            # Create family member names list for title
            family_names = [f"{fm.name} ({fm.relationship})" for fm in family_members]
            if len(family_names) > 3:
                title = f"Family History Share: {family_names[0]}, {family_names[1]}, {family_names[2]} and {len(family_names) - 3} more"
            else:
                title = f"Family History Share: {', '.join(family_names)}"
            
            message = sharing_note
            
            # 5. Create single invitation
            invitation = self.invitation_service.create_invitation(
                sent_by_user=user,
                sent_to_identifier=shared_with_identifier,
                invitation_type='family_history_share',
                title=title,
                context_data=context_data,
                message=message,
                expires_hours=expires_hours
            )
            
            logger.info(f"Sent bulk family history share invitation: {invitation.id} for {len(family_members)} family members")
            return {
                "success": True,
                "invitation_id": invitation.id,
                "family_member_count": len(family_members),
                "family_member_ids": family_member_ids,
                "message": f"Bulk invitation sent for {len(family_members)} family members"
            }
            
        except Exception as e:
            logger.error(f"Error sending bulk family history share invitation: {e}")
            raise
    
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
    
    def get_family_history_shared_by_me(self, user: User) -> List[Dict]:
        """Get all family history that the current user has shared with others"""
        try:
            # Get all active shares where current user is the sharer
            shares = self.db.query(FamilyHistoryShare).join(
                FamilyMember, FamilyHistoryShare.family_member_id == FamilyMember.id
            ).join(
                Patient, FamilyMember.patient_id == Patient.id
            ).join(
                User, FamilyHistoryShare.shared_with_user_id == User.id
            ).filter(
                FamilyHistoryShare.shared_by_user_id == user.id,
                FamilyHistoryShare.is_active == True
            ).all()
            
            result = []
            for share in shares:
                # Get the family member details
                family_member = share.family_member
                # Get the user it's shared with
                shared_with_user = self.db.query(User).filter(User.id == share.shared_with_user_id).first()
                
                result.append({
                    "share_id": share.id,
                    "family_member": {
                        "id": family_member.id,
                        "name": family_member.name,
                        "relationship": family_member.relationship,
                        "birth_year": family_member.birth_year,
                        "death_year": family_member.death_year,
                        "is_deceased": family_member.is_deceased,
                        "condition_count": len(family_member.family_conditions) if family_member.family_conditions else 0
                    },
                    "shared_with": {
                        "id": shared_with_user.id,
                        "name": shared_with_user.name,
                        "email": shared_with_user.email
                    },
                    "permission_level": share.permission_level,
                    "sharing_note": share.sharing_note,
                    "shared_at": share.created_at,
                    "invitation_id": share.invitation_id
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error fetching family history shared by user: {e}")
            raise