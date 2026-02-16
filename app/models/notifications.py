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


class NotificationChannel(Base):
    """
    Represents a notification channel for a user (Discord, Email, Gotify, Webhook).
    Stores encrypted configuration for each channel type.
    """
    __tablename__ = "notification_channels"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(100), nullable=False)
    channel_type = Column(String(20), nullable=False)  # discord, email, gotify, webhook
    config_encrypted = Column(Text, nullable=False)  # Encrypted JSON config

    is_enabled = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    last_test_at = Column(DateTime, nullable=True)
    last_test_status = Column(String(20), nullable=True)
    last_used_at = Column(DateTime, nullable=True)
    total_notifications_sent = Column(Integer, default=0, nullable=False)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Table Relationships
    user = orm_relationship("User", back_populates="notification_channels")
    preferences = orm_relationship(
        "NotificationPreference",
        back_populates="channel",
        cascade="all, delete-orphan"
    )
    history = orm_relationship(
        "NotificationHistory",
        back_populates="channel"
    )

    # Indexes and constraints
    __table_args__ = (
        Index("idx_notification_channels_user_id", "user_id"),
        UniqueConstraint("user_id", "name", name="uq_user_channel_name"),
    )


class NotificationPreference(Base):
    """
    Links event types to channels. Users can configure which events
    trigger notifications on which channels.
    Many-to-Many: Each event can go to multiple channels.
    """
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    channel_id = Column(Integer, ForeignKey("notification_channels.id", ondelete="CASCADE"), nullable=False)

    event_type = Column(String(50), nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    remind_before_minutes = Column(Integer, nullable=True)

    # Audit fields
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Table Relationships
    user = orm_relationship("User")
    channel = orm_relationship("NotificationChannel", back_populates="preferences")

    # Indexes and constraints
    __table_args__ = (
        Index("idx_notification_prefs_user_id", "user_id"),
        Index("idx_notification_prefs_channel_id", "channel_id"),
        Index("idx_notification_prefs_event_type", "event_type"),
        UniqueConstraint("user_id", "channel_id", "event_type", name="uq_user_channel_event"),
    )


class NotificationHistory(Base):
    """
    Records sent notifications for audit and troubleshooting.
    Tracks delivery status, errors, and retry attempts.
    """
    __tablename__ = "notification_history"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    channel_id = Column(Integer, ForeignKey("notification_channels.id", ondelete="SET NULL"), nullable=True)

    event_type = Column(String(50), nullable=False)
    event_data = Column(JSON, nullable=True)
    title = Column(String(255), nullable=False)
    message_preview = Column(String(500), nullable=True)

    status = Column(String(20), nullable=False)  # pending, sent, failed
    attempt_count = Column(Integer, default=1, nullable=False)
    error_message = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    sent_at = Column(DateTime, nullable=True)

    # Table Relationships
    user = orm_relationship("User")
    channel = orm_relationship("NotificationChannel", back_populates="history")

    # Indexes for performance
    __table_args__ = (
        Index("idx_notification_history_user_id", "user_id"),
        Index("idx_notification_history_status", "status"),
        Index("idx_notification_history_created_at", "created_at"),
        Index("idx_notification_history_event_type", "event_type"),
    )
