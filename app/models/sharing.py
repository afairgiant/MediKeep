from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    column,
)
from sqlalchemy.orm import relationship as orm_relationship

from .base import Base, get_utc_now


class PatientShare(Base):
    """Represents a shared patient record between users with permission controls."""

    __tablename__ = "patient_shares"
    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    shared_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shared_with_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Permission control
    permission_level = Column(String, nullable=False)  # view, edit, full
    custom_permissions = Column(JSON, nullable=True)

    # Status and lifecycle
    is_active = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime, nullable=True)

    # Link to invitation (nullable for backward compatibility with existing shares)
    invitation_id = Column(Integer, ForeignKey("invitations.id"), nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Relationships
    patient = orm_relationship("Patient", foreign_keys=[patient_id], overlaps="shares")
    shared_by = orm_relationship(
        "User", foreign_keys=[shared_by_user_id], overlaps="shared_patients_by_me"
    )
    shared_with = orm_relationship(
        "User", foreign_keys=[shared_with_user_id], overlaps="shared_patients_with_me"
    )
    invitation = orm_relationship("Invitation", foreign_keys=[invitation_id])

    # Constraints
    __table_args__ = (
        UniqueConstraint(
            "patient_id", "shared_with_user_id", name="unique_patient_share"
        ),
    )


class Invitation(Base):
    """Reusable invitation system for various sharing/collaboration features"""

    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True)

    # Who's sending and receiving
    sent_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sent_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # What type of invitation
    invitation_type = Column(
        String, nullable=False
    )  # 'family_history_share', 'patient_share', 'family_join', etc.

    # Status tracking
    status = Column(
        String, default="pending", nullable=False
    )  # pending, accepted, rejected, expired, cancelled

    # Invitation details
    title = Column(String, nullable=False)  # "Family History Share Request"
    message = Column(Text, nullable=True)  # Custom message from sender

    # Context data (JSON for flexibility)
    context_data = Column(JSON, nullable=False)  # Stores type-specific data

    # Expiration
    expires_at = Column(DateTime, nullable=True)

    # Response tracking
    responded_at = Column(DateTime, nullable=True)
    response_note = Column(Text, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Relationships
    sent_by = orm_relationship("User", foreign_keys=[sent_by_user_id])
    sent_to = orm_relationship("User", foreign_keys=[sent_to_user_id])

    # No unique constraints - let application logic handle business rules
    # Each invitation has a unique ID which is sufficient for database integrity


class FamilyHistoryShare(Base):
    """Share family history records independently from personal medical data"""

    __tablename__ = "family_history_shares"

    id = Column(Integer, primary_key=True)

    # Link to the invitation that created this share
    invitation_id = Column(Integer, ForeignKey("invitations.id"), nullable=False)

    # What's being shared - specific family member's history record
    family_member_id = Column(Integer, ForeignKey("family_members.id"), nullable=False)

    # Who's sharing and receiving
    shared_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shared_with_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Simple permissions
    permission_level = Column(
        String, default="view", nullable=False
    )  # view only for Phase 1.5
    is_active = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime, nullable=True)

    # Optional sharing note
    sharing_note = Column(Text, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Relationships
    invitation = orm_relationship("Invitation")
    family_member = orm_relationship("FamilyMember", back_populates="shares")
    shared_by = orm_relationship("User", foreign_keys=[shared_by_user_id])
    shared_with = orm_relationship("User", foreign_keys=[shared_with_user_id])

    # Constraints - allow multiple shares but only one active share per family member/user pair
    __table_args__ = (
        # Partial unique constraint: only one active share per (family_member_id, shared_with_user_id)
        # Multiple inactive shares are allowed to maintain history
        Index(
            "unique_active_family_history_share_partial",
            "family_member_id",
            "shared_with_user_id",
            unique=True,
            postgresql_where=(column("is_active") == True),
        ),
    )
