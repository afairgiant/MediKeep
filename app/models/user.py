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
)
from sqlalchemy.orm import relationship as orm_relationship

from .base import Base, get_utc_now


class User(Base):
    """Represents an application user with authentication and patient access controls."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)  # Role-based access control
    role = Column(String, nullable=False)  # e.g., 'admin', 'user', 'guest'

    # SSO fields
    auth_method = Column(
        String(20), nullable=False, default="local"
    )  # 'local', 'sso', 'hybrid'
    external_id = Column(
        String(255), nullable=True, unique=True
    )  # SSO provider user ID
    sso_provider = Column(String(50), nullable=True)  # 'google', 'github', 'oidc', etc.
    sso_metadata = Column(JSON, nullable=True)  # Additional SSO data
    last_sso_login = Column(DateTime, nullable=True)  # Last SSO login timestamp
    account_linked_at = Column(
        DateTime, nullable=True
    )  # When account was linked to SSO
    sso_linking_preference = Column(
        String(20), nullable=True
    )  # 'auto_link', 'create_separate', 'always_ask'

    # Timestamps
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # V1: Current patient context - which patient they're managing
    active_patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)

    # Original relationship (specify foreign key to avoid ambiguity)
    patient = orm_relationship(
        "Patient", foreign_keys="Patient.user_id", back_populates="user", uselist=False
    )

    # V1: New relationships
    owned_patients = orm_relationship(
        "Patient", foreign_keys="Patient.owner_user_id", overlaps="owner"
    )
    current_patient_context = orm_relationship(
        "Patient", foreign_keys=[active_patient_id]
    )

    # V1: Patient sharing relationships
    shared_patients_by_me = orm_relationship(
        "PatientShare",
        foreign_keys="PatientShare.shared_by_user_id",
        overlaps="shared_by",
    )
    shared_patients_with_me = orm_relationship(
        "PatientShare",
        foreign_keys="PatientShare.shared_with_user_id",
        overlaps="shared_with",
    )

    # User preferences relationship with cascade delete
    preferences = orm_relationship(
        "UserPreferences",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )

    # Notification channels relationship with cascade delete
    notification_channels = orm_relationship(
        "NotificationChannel",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    # Indexes for performance
    __table_args__ = (Index("idx_users_email", "email"),)


class UserPreferences(Base):
    """Stores per-user settings including units, language, session timeout, and integrations."""
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)

    # Unit system preference: 'imperial' or 'metric'
    unit_system = Column(String, default="imperial", nullable=False)

    # Session timeout in minutes (default 30 minutes)
    session_timeout_minutes = Column(Integer, default=30, nullable=False)

    # Language preference (ISO 639-1 code, e.g., 'en', 'es', 'fr')
    language = Column(String(10), default="en", nullable=False)

    # Date format preference: 'mdy' (US), 'dmy' (European), 'ymd' (ISO)
    date_format = Column(String(10), default="mdy", nullable=False)

    # Paperless-ngx integration fields
    paperless_enabled = Column(Boolean, default=False, nullable=False)
    paperless_url = Column(String(500), nullable=True)
    paperless_api_token_encrypted = Column(Text, nullable=True)  # Encrypted API token
    paperless_username_encrypted = Column(Text, nullable=True)  # Encrypted username
    paperless_password_encrypted = Column(Text, nullable=True)  # Encrypted password
    default_storage_backend = Column(
        String(20), default="local", nullable=False
    )  # 'local' or 'paperless'
    paperless_auto_sync = Column(Boolean, default=False, nullable=False)
    paperless_sync_tags = Column(Boolean, default=True, nullable=False)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(
        DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False
    )

    # Relationships
    user = orm_relationship("User", back_populates="preferences")


class UserTag(Base):
    """Model for user-created tags"""

    __tablename__ = "user_tags"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    tag = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=get_utc_now, nullable=False)

    # Relationships
    user = orm_relationship("User")

    # Indexes and constraints
    __table_args__ = (
        UniqueConstraint("user_id", "tag", name="uq_user_tag"),
        Index("idx_user_tags_user_id", "user_id"),
        Index("idx_user_tags_tag", "tag"),
    )


class SystemSetting(Base):
    """
    System-wide settings stored as key-value pairs.

    Used for storing configuration values, feature flags, migration status,
    library versions, and other system-level metadata.

    Examples:
    - test_library_version: "1.2.3"
    - canonical_name_migration_complete: "true"
    - last_sync_timestamp: "2026-01-31T12:00:00Z"
    """
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)
