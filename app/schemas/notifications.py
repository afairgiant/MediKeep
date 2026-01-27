"""
Pydantic schemas for notification framework
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


def _validate_url_protocol(url: str, allowed_protocols: tuple = ("http://", "https://")) -> str:
    """Validate that URL starts with an allowed protocol."""
    url = url.strip().rstrip("/")
    if not any(url.startswith(p) for p in allowed_protocols):
        protocols = " or ".join(allowed_protocols)
        raise ValueError(f"URL must start with {protocols}")
    return url


class ChannelType(str, Enum):
    """Supported notification channel types"""
    DISCORD = "discord"
    EMAIL = "email"
    GOTIFY = "gotify"
    WEBHOOK = "webhook"


class EventType(str, Enum):
    """Supported notification event types"""
    # Backup events
    BACKUP_COMPLETED = "backup_completed"
    BACKUP_FAILED = "backup_failed"

    # Lab result events
    LAB_RESULT_AVAILABLE = "lab_result_available"
    LAB_RESULT_ABNORMAL = "lab_result_abnormal"

    # Immunization events
    IMMUNIZATION_DUE = "immunization_due"
    IMMUNIZATION_OVERDUE = "immunization_overdue"

    # Sharing/collaboration events
    INVITATION_RECEIVED = "invitation_received"
    INVITATION_ACCEPTED = "invitation_accepted"
    SHARE_REVOKED = "share_revoked"

    # Security events
    LOGIN_FROM_NEW_DEVICE = "login_from_new_device"
    PASSWORD_CHANGED = "password_changed"


class NotificationStatus(str, Enum):
    """Notification delivery status"""
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"


# ============================================================================
# Channel Configuration Schemas
# ============================================================================

class DiscordChannelConfig(BaseModel):
    """Configuration for Discord webhook notifications"""
    webhook_url: str = Field(..., description="Discord webhook URL")

    @field_validator("webhook_url")
    @classmethod
    def validate_webhook_url(cls, v):
        v = v.strip()
        if not v.startswith("https://discord.com/api/webhooks/") and not v.startswith("https://discordapp.com/api/webhooks/"):
            raise ValueError("Invalid Discord webhook URL format")
        return v


class EmailChannelConfig(BaseModel):
    """Configuration for SMTP email notifications"""
    smtp_host: str = Field(..., description="SMTP server hostname")
    smtp_port: int = Field(587, ge=1, le=65535, description="SMTP port")
    smtp_user: str = Field(..., description="SMTP username")
    smtp_password: str = Field(..., description="SMTP password")
    from_email: str = Field(..., description="Sender email address")
    to_email: str = Field(..., description="Recipient email address")
    use_tls: bool = Field(True, description="Use TLS encryption")

    @field_validator("smtp_host")
    @classmethod
    def validate_smtp_host(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("SMTP host cannot be empty")
        return v

    @field_validator("from_email", "to_email")
    @classmethod
    def validate_email(cls, v):
        v = v.strip()
        if "@" not in v or "." not in v:
            raise ValueError("Invalid email format")
        return v


class GotifyChannelConfig(BaseModel):
    """Configuration for Gotify push notifications"""
    server_url: str = Field(..., description="Gotify server URL")
    app_token: str = Field(..., description="Gotify application token")
    priority: int = Field(5, ge=0, le=10, description="Notification priority (0-10)")

    @field_validator("server_url")
    @classmethod
    def validate_server_url(cls, v):
        return _validate_url_protocol(v)

    @field_validator("app_token")
    @classmethod
    def validate_app_token(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("App token cannot be empty")
        return v


class WebhookChannelConfig(BaseModel):
    """Configuration for generic webhook notifications"""
    url: str = Field(..., description="Webhook URL")
    method: str = Field("POST", description="HTTP method (GET or POST)")
    headers: Optional[Dict[str, str]] = Field(None, description="Custom headers")
    auth_token: Optional[str] = Field(None, description="Authorization token")

    @field_validator("url")
    @classmethod
    def validate_url(cls, v):
        return _validate_url_protocol(v)

    @field_validator("method")
    @classmethod
    def validate_method(cls, v):
        v = v.upper()
        if v not in ("GET", "POST"):
            raise ValueError("Method must be GET or POST")
        return v


# ============================================================================
# Channel CRUD Schemas
# ============================================================================

class ChannelCreate(BaseModel):
    """Schema for creating a notification channel"""
    name: str = Field(..., min_length=1, max_length=100, description="Channel name")
    channel_type: ChannelType = Field(..., description="Channel type")
    config: Dict[str, Any] = Field(..., description="Channel-specific configuration")
    is_enabled: bool = Field(True, description="Whether the channel is enabled")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Channel name cannot be empty")
        return v

    @model_validator(mode="after")
    def validate_config_for_type(self):
        """Validate that config matches channel type"""
        config_validators = {
            ChannelType.DISCORD: DiscordChannelConfig,
            ChannelType.EMAIL: EmailChannelConfig,
            ChannelType.GOTIFY: GotifyChannelConfig,
            ChannelType.WEBHOOK: WebhookChannelConfig,
        }

        validator = config_validators.get(self.channel_type)
        if validator:
            # This will raise validation errors if config is invalid
            validator(**self.config)

        return self


class ChannelUpdate(BaseModel):
    """Schema for updating a notification channel"""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Channel name")
    config: Optional[Dict[str, Any]] = Field(None, description="Channel-specific configuration")
    is_enabled: Optional[bool] = Field(None, description="Whether the channel is enabled")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Channel name cannot be empty")
        return v


class ChannelResponse(BaseModel):
    """Schema for channel response (without sensitive config)"""
    id: int
    name: str
    channel_type: str
    is_enabled: bool
    is_verified: bool
    last_test_at: Optional[datetime]
    last_test_status: Optional[str]
    last_used_at: Optional[datetime]
    total_notifications_sent: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChannelWithConfigResponse(ChannelResponse):
    """Schema for channel response with masked config (for edit forms)"""
    config_masked: Dict[str, Any] = Field(..., description="Config with sensitive fields masked")


# ============================================================================
# Preference Schemas
# ============================================================================

class PreferenceCreate(BaseModel):
    """Schema for creating/updating a notification preference"""
    channel_id: int = Field(..., gt=0, description="Channel ID")
    event_type: EventType = Field(..., description="Event type")
    is_enabled: bool = Field(True, description="Whether notification is enabled for this event/channel")
    remind_before_minutes: Optional[int] = Field(None, ge=0, description="Reminder time in minutes")


class PreferenceResponse(BaseModel):
    """Schema for preference response"""
    id: int
    channel_id: int
    channel_name: str
    event_type: str
    is_enabled: bool
    remind_before_minutes: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PreferenceMatrix(BaseModel):
    """Schema for the full preference matrix (events x channels)"""
    channels: List[ChannelResponse]
    events: List[str]
    preferences: Dict[str, Dict[int, bool]]  # event_type -> channel_id -> is_enabled


# ============================================================================
# History Schemas
# ============================================================================

class HistoryResponse(BaseModel):
    """Schema for notification history entry"""
    id: int
    event_type: str
    title: str
    message_preview: Optional[str]
    channel_name: Optional[str]
    channel_type: Optional[str]
    status: str
    attempt_count: int
    error_message: Optional[str]
    created_at: datetime
    sent_at: Optional[datetime]

    class Config:
        from_attributes = True


class HistoryListResponse(BaseModel):
    """Schema for paginated history response"""
    items: List[HistoryResponse]
    total: int
    page: int
    page_size: int


# ============================================================================
# Notification Test Schemas
# ============================================================================

class TestNotificationRequest(BaseModel):
    """Schema for sending a test notification"""
    message: Optional[str] = Field(
        "This is a test notification from MediKeep",
        max_length=500,
        description="Custom test message"
    )


class TestNotificationResponse(BaseModel):
    """Schema for test notification result"""
    success: bool
    message: str
    channel_name: str
    sent_at: Optional[datetime]


# ============================================================================
# Event Types Response
# ============================================================================

class EventTypeInfo(BaseModel):
    """Schema for event type information"""
    value: str
    label: str
    description: str
    category: str
    is_implemented: bool = Field(
        True,
        description="Whether this event has triggers implemented in the application"
    )


class EventTypesResponse(BaseModel):
    """Schema for list of available event types"""
    event_types: List[EventTypeInfo]
