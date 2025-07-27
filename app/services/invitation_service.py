"""
Reusable invitation service for various sharing/collaboration features
"""

from typing import List, Dict, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.models.models import User, Invitation
from app.core.datetime_utils import get_utc_now
from datetime import datetime, timedelta, timezone
from app.core.logging_config import get_logger
import json
import hashlib

logger = get_logger(__name__, "app")


class InvitationService:
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_invitation(self, sent_by_user: User, sent_to_identifier: str, 
                         invitation_type: str, title: str, context_data: Dict[str, Any],
                         message: Optional[str] = None, expires_hours: Optional[int] = 168) -> Invitation:
        """
        Create a reusable invitation
        
        Args:
            sent_by_user: User sending the invitation
            sent_to_identifier: Username or email of recipient
            invitation_type: Type of invitation ('family_history_share', 'patient_share', etc.)
            title: Human-readable title
            context_data: Type-specific data (JSON)
            message: Optional message from sender
            expires_hours: Hours until expiration (default: 7 days)
        """
        try:
            # Find recipient user
            sent_to_user = self.db.query(User).filter(
                or_(User.username == sent_to_identifier, 
                    User.email == sent_to_identifier)
            ).first()
            
            if not sent_to_user:
                raise ValueError("Recipient user not found")
            
            if sent_to_user.id == sent_by_user.id:
                raise ValueError("Cannot send invitation to yourself")
            
            # Skip duplicate check - let users send multiple invitations
            # The database constraint may prevent exact duplicates, but that's acceptable
            
            # Set expiration
            expires_at = None
            if expires_hours:
                expires_at = get_utc_now() + timedelta(hours=expires_hours)
            
            # Create invitation
            invitation = Invitation(
                sent_by_user_id=sent_by_user.id,
                sent_to_user_id=sent_to_user.id,
                invitation_type=invitation_type,
                title=title,
                message=message,
                context_data=context_data,
                expires_at=expires_at
            )
            
            logger.info(f"DEBUG: About to create invitation: {invitation_type} from {sent_by_user.id} to {sent_to_user.id}")
            self.db.add(invitation)
            self.db.commit()
            self.db.refresh(invitation)  # Refresh to get the ID
            
            logger.info(f"Created invitation {invitation.id} of type {invitation_type}")
            return invitation
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating invitation: {e}")
            raise
    
    def get_pending_invitations(self, user: User, invitation_type: Optional[str] = None) -> List[Invitation]:
        """Get pending invitations for a user"""
        try:
            query = self.db.query(Invitation).filter(
                Invitation.sent_to_user_id == user.id,
                Invitation.status == 'pending'
            )
            
            if invitation_type:
                query = query.filter(Invitation.invitation_type == invitation_type)
            
            # Filter out expired invitations
            now = get_utc_now()
            query = query.filter(
                or_(Invitation.expires_at.is_(None), 
                    Invitation.expires_at > now)
            )
            
            return query.order_by(Invitation.created_at.desc()).all()
            
        except Exception as e:
            logger.error(f"Error fetching pending invitations: {e}")
            raise
    
    def get_sent_invitations(self, user: User, invitation_type: Optional[str] = None) -> List[Invitation]:
        """Get invitations sent by a user"""
        try:
            query = self.db.query(Invitation).filter(
                Invitation.sent_by_user_id == user.id
            )
            
            if invitation_type:
                query = query.filter(Invitation.invitation_type == invitation_type)
            
            return query.order_by(Invitation.created_at.desc()).all()
            
        except Exception as e:
            logger.error(f"Error fetching sent invitations: {e}")
            raise
    
    def respond_to_invitation(self, user: User, invitation_id: int, 
                            response: str, response_note: Optional[str] = None) -> Invitation:
        """
        Respond to an invitation
        
        Args:
            user: User responding to invitation
            invitation_id: ID of invitation
            response: 'accepted' or 'rejected'
            response_note: Optional note from recipient
        """
        try:
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
                if invitation.expires_at < now:
                    invitation.status = 'expired'
                    self.db.commit()
                    raise ValueError("Invitation has expired")
            
            if response not in ['accepted', 'rejected']:
                raise ValueError("Response must be 'accepted' or 'rejected'")
            
            # Update invitation
            invitation.status = response
            invitation.responded_at = get_utc_now()
            invitation.response_note = response_note
            
            self.db.commit()
            
            logger.info(f"Invitation {invitation_id} {response} by user {user.id}")
            return invitation
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error responding to invitation: {e}")
            raise
    
    def expire_old_invitations(self) -> int:
        """Mark expired invitations as expired (cleanup task)"""
        try:
            now = get_utc_now()
            expired_count = self.db.query(Invitation).filter(
                Invitation.status == 'pending',
                Invitation.expires_at < now
            ).update({
                'status': 'expired',
                'updated_at': now
            })
            
            self.db.commit()
            
            if expired_count > 0:
                logger.info(f"Expired {expired_count} old invitations")
            
            return expired_count
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error expiring old invitations: {e}")
            raise
    
    def cancel_invitation(self, user: User, invitation_id: int) -> Invitation:
        """Cancel a sent invitation"""
        try:
            invitation = self.db.query(Invitation).filter(
                Invitation.id == invitation_id,
                Invitation.sent_by_user_id == user.id,
                Invitation.status == 'pending'
            ).first()
            
            if not invitation:
                raise ValueError("Invitation not found or not pending")
            
            invitation.status = 'cancelled'
            invitation.updated_at = get_utc_now()
            
            self.db.commit()
            
            logger.info(f"Invitation {invitation_id} cancelled by user {user.id}")
            return invitation
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error cancelling invitation: {e}")
            raise
    
    def get_invitation_by_id(self, invitation_id: int) -> Optional[Invitation]:
        """Get invitation by ID"""
        try:
            return self.db.query(Invitation).filter(Invitation.id == invitation_id).first()
        except Exception as e:
            logger.error(f"Error fetching invitation by ID: {e}")
            raise
    
    def update_invitation_status(self, invitation_id: int, status: str) -> Optional[Invitation]:
        """Update invitation status by ID"""
        try:
            invitation = self.db.query(Invitation).filter(Invitation.id == invitation_id).first()
            if invitation:
                invitation.status = status
                invitation.updated_at = get_utc_now()
                self.db.commit()
                logger.info(f"Updated invitation {invitation_id} status to {status}")
            return invitation
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating invitation status: {e}")
            raise