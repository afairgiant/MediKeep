"""
Notification Service for the notification framework.

This service handles:
- Channel management (CRUD operations)
- Notification sending via Apprise
- Preference management
- History tracking

The service uses a registry pattern for channel URL builders, making it
easy to add new channel types without modifying core logic.
"""

import asyncio
import base64
import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from cryptography.fernet import Fernet
from sqlalchemy import and_, desc
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging.config import get_logger
from app.models.models import (
    NotificationChannel,
    NotificationHistory,
    NotificationPreference,
    User,
)
from app.schemas.notifications import (
    ChannelType,
    EventType,
    NotificationStatus,
)
from app.services.notification_templates import NotificationTemplates

logger = get_logger(__name__, "app")


def _derive_encryption_key() -> bytes:
    """Derive encryption key from settings."""
    salt = settings.NOTIFICATION_ENCRYPTION_SALT.encode()
    secret = settings.SECRET_KEY.encode()
    key = hashlib.pbkdf2_hmac("sha256", secret, salt, 100000)
    return base64.urlsafe_b64encode(key)


# ============================================================================
# Channel URL Builders - Registry Pattern
# ============================================================================

def _build_discord_url(config: Dict) -> str:
    """Build Apprise URL for Discord webhook."""
    webhook_url = config.get("webhook_url", "")
    # Discord webhook URL format: https://discord.com/api/webhooks/{id}/{token}
    # Apprise format: discord://{id}/{token}
    if "/webhooks/" in webhook_url:
        parts = webhook_url.split("/webhooks/")[-1].rstrip("/")
        return f"discord://{parts}"
    return ""


def _build_email_url(config: Dict) -> str:
    """Build Apprise URL for SMTP email."""
    smtp_host = config.get("smtp_host", "")
    smtp_port = config.get("smtp_port", 587)
    smtp_user = config.get("smtp_user", "")
    smtp_password = config.get("smtp_password", "")
    from_email = config.get("from_email", "")
    to_email = config.get("to_email", "")
    use_tls = config.get("use_tls", True)

    # Apprise format: mailtos://user:password@host:port?from=sender&to=recipient
    protocol = "mailtos" if use_tls else "mailto"
    return f"{protocol}://{smtp_user}:{smtp_password}@{smtp_host}:{smtp_port}?from={from_email}&to={to_email}"


def _build_gotify_url(config: Dict) -> str:
    """Build Apprise URL for Gotify."""
    server_url = config.get("server_url", "").rstrip("/")
    app_token = config.get("app_token", "")
    priority = config.get("priority", 5)

    # Strip protocol from server URL for Apprise format
    host = server_url.replace("https://", "").replace("http://", "")
    protocol = "gotifys" if "https://" in config.get("server_url", "") else "gotify"

    # Add extended timeout for services behind CDNs (rto=read timeout, cto=connect timeout)
    return f"{protocol}://{host}/{app_token}?priority={priority}&rto=15&cto=15"


def _build_webhook_url(config: Dict) -> str:
    """Build Apprise URL for generic webhook."""
    url = config.get("url", "")
    method = config.get("method", "POST").upper()
    auth_token = config.get("auth_token")

    # Strip protocol for Apprise format
    host_path = url.replace("https://", "").replace("http://", "")
    protocol = "jsons" if "https://" in url else "json"

    apprise_url = f"{protocol}://{host_path}"

    # Add auth header if provided
    if auth_token:
        apprise_url += f"?+Authorization=Bearer {auth_token}"

    return apprise_url


# Registry of channel URL builders
CHANNEL_BUILDERS = {
    ChannelType.DISCORD.value: _build_discord_url,
    ChannelType.EMAIL.value: _build_email_url,
    ChannelType.GOTIFY.value: _build_gotify_url,
    ChannelType.WEBHOOK.value: _build_webhook_url,
}


# ============================================================================
# Notification Service
# ============================================================================

class NotificationService:
    """
    Service for managing notification channels and sending notifications.
    """

    def __init__(self, db: Session):
        self.db = db
        self.templates = NotificationTemplates()
        self._fernet = Fernet(_derive_encryption_key())

    # =========================================================================
    # Channel Management
    # =========================================================================

    def create_channel(
        self,
        user_id: int,
        name: str,
        channel_type: str,
        config: Dict[str, Any],
        is_enabled: bool = True,
    ) -> NotificationChannel:
        """
        Create a new notification channel for a user.

        Args:
            user_id: User ID
            name: Channel name (must be unique per user)
            channel_type: Channel type (discord, email, gotify, webhook)
            config: Channel-specific configuration
            is_enabled: Whether the channel is enabled

        Returns:
            Created NotificationChannel

        Raises:
            ValueError: If channel name already exists for user
        """
        # Check for duplicate name
        existing = self.db.query(NotificationChannel).filter(
            and_(
                NotificationChannel.user_id == user_id,
                NotificationChannel.name == name
            )
        ).first()

        if existing:
            raise ValueError(f"A channel named '{name}' already exists")

        # Encrypt config
        config_encrypted = self._encrypt_config(config)

        channel = NotificationChannel(
            user_id=user_id,
            name=name,
            channel_type=channel_type,
            config_encrypted=config_encrypted,
            is_enabled=is_enabled,
            is_verified=False,
        )

        self.db.add(channel)
        self.db.commit()
        self.db.refresh(channel)

        logger.info(
            "notification_channel_created",
            extra={
                "user_id": user_id,
                "channel_id": channel.id,
                "channel_type": channel_type,
                "channel_name": name,
            }
        )

        return channel

    def get_user_channels(self, user_id: int) -> List[NotificationChannel]:
        """Get all notification channels for a user."""
        return self.db.query(NotificationChannel).filter(
            NotificationChannel.user_id == user_id
        ).order_by(NotificationChannel.created_at.desc()).all()

    def get_channel(self, user_id: int, channel_id: int) -> Optional[NotificationChannel]:
        """Get a specific channel for a user."""
        return self.db.query(NotificationChannel).filter(
            and_(
                NotificationChannel.id == channel_id,
                NotificationChannel.user_id == user_id
            )
        ).first()

    def update_channel(
        self,
        user_id: int,
        channel_id: int,
        name: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None,
        is_enabled: Optional[bool] = None,
    ) -> Optional[NotificationChannel]:
        """
        Update a notification channel.

        Returns:
            Updated channel or None if not found
        """
        channel = self.get_channel(user_id, channel_id)
        if not channel:
            return None

        if name is not None and name != channel.name:
            # Check for duplicate name
            existing = self.db.query(NotificationChannel).filter(
                and_(
                    NotificationChannel.user_id == user_id,
                    NotificationChannel.name == name,
                    NotificationChannel.id != channel_id
                )
            ).first()
            if existing:
                raise ValueError(f"A channel named '{name}' already exists")
            channel.name = name

        if config is not None:
            channel.config_encrypted = self._encrypt_config(config)
            # Reset verification when config changes
            channel.is_verified = False

        if is_enabled is not None:
            channel.is_enabled = is_enabled

        self.db.commit()
        self.db.refresh(channel)

        logger.info(
            "notification_channel_updated",
            extra={
                "user_id": user_id,
                "channel_id": channel_id,
            }
        )

        return channel

    def delete_channel(self, user_id: int, channel_id: int) -> bool:
        """
        Delete a notification channel.

        Returns:
            True if deleted, False if not found
        """
        channel = self.get_channel(user_id, channel_id)
        if not channel:
            return False

        self.db.delete(channel)
        self.db.commit()

        logger.info(
            "notification_channel_deleted",
            extra={
                "user_id": user_id,
                "channel_id": channel_id,
            }
        )

        return True

    def get_channel_config(self, channel: NotificationChannel) -> Dict[str, Any]:
        """Decrypt and return channel configuration."""
        return self._decrypt_config(channel.config_encrypted)

    def get_masked_config(self, channel: NotificationChannel) -> Dict[str, Any]:
        """Get channel config with sensitive fields masked."""
        config = self._decrypt_config(channel.config_encrypted)
        sensitive_fields = {"smtp_password", "app_token", "auth_token", "webhook_url"}

        return {
            key: self._mask_value(value) if key in sensitive_fields and value else value
            for key, value in config.items()
        }

    @staticmethod
    def _mask_value(value: Any) -> str:
        """Mask a sensitive value, showing first and last 2 characters if long enough."""
        str_value = str(value)
        if len(str_value) > 6:
            return f"{str_value[:2]}...{str_value[-2:]}"
        return "****"

    # =========================================================================
    # Notification Sending
    # =========================================================================

    async def send_notification(
        self,
        user_id: int,
        event_type: str,
        title: str,
        message: str,
        event_data: Optional[Dict] = None,
    ) -> List[NotificationHistory]:
        """
        Send notification to all enabled channels for the given event type.

        This method:
        1. Finds all enabled preferences for (user_id, event_type)
        2. Gets the associated enabled channels
        3. Sends notification to each channel in parallel
        4. Records history for each attempt

        Args:
            user_id: User ID
            event_type: Event type identifier
            title: Notification title
            message: Notification message
            event_data: Optional event-specific data for history

        Returns:
            List of NotificationHistory records
        """
        if not settings.NOTIFICATIONS_ENABLED:
            logger.debug("Notifications disabled, skipping send")
            return []

        # Find enabled preferences for this event type
        preferences = self.db.query(NotificationPreference).filter(
            and_(
                NotificationPreference.user_id == user_id,
                NotificationPreference.event_type == event_type,
                NotificationPreference.is_enabled == True
            )
        ).all()

        if not preferences:
            logger.debug(f"No enabled preferences for event {event_type}")
            return []

        # Get unique enabled channels
        channel_ids = list(set(p.channel_id for p in preferences))
        channels = self.db.query(NotificationChannel).filter(
            and_(
                NotificationChannel.id.in_(channel_ids),
                NotificationChannel.is_enabled == True
            )
        ).all()

        if not channels:
            logger.debug(f"No enabled channels for event {event_type}")
            return []

        # Send to each channel in parallel
        history_records = []
        tasks = []

        for channel in channels:
            history = NotificationHistory(
                user_id=user_id,
                channel_id=channel.id,
                event_type=event_type,
                event_data=event_data,
                title=title,
                message_preview=message[:500] if message else None,
                status=NotificationStatus.PENDING.value,
            )
            self.db.add(history)
            history_records.append(history)
            tasks.append(self._send_to_channel(channel, title, message, history))

        self.db.commit()

        # Execute sends in parallel
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        return history_records

    async def _send_to_channel(
        self,
        channel: NotificationChannel,
        title: str,
        message: str,
        history: NotificationHistory,
    ) -> None:
        """Send notification to a single channel and update history."""
        try:
            import apprise

            # Build Apprise URL
            config = self._decrypt_config(channel.config_encrypted)
            builder = CHANNEL_BUILDERS.get(channel.channel_type)

            if not builder:
                raise ValueError(f"Unknown channel type: {channel.channel_type}")

            apprise_url = builder(config)
            if not apprise_url:
                raise ValueError(f"Failed to build URL for channel type: {channel.channel_type}")

            # Create Apprise instance and add URL
            apobj = apprise.Apprise()
            apobj.add(apprise_url)

            # Send notification
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: apobj.notify(title=title, body=message)
            )

            if result:
                history.status = NotificationStatus.SENT.value
                history.sent_at = datetime.now(timezone.utc)
                channel.last_used_at = datetime.now(timezone.utc)
                channel.total_notifications_sent += 1

                logger.info(
                    "notification_sent",
                    extra={
                        "channel_id": channel.id,
                        "channel_type": channel.channel_type,
                        "event_type": history.event_type,
                    }
                )
            else:
                history.status = NotificationStatus.FAILED.value
                history.error_message = "Apprise returned failure"

                logger.warning(
                    "notification_failed",
                    extra={
                        "channel_id": channel.id,
                        "channel_type": channel.channel_type,
                        "event_type": history.event_type,
                        "error": "Apprise returned failure",
                    }
                )

        except Exception as e:
            history.status = NotificationStatus.FAILED.value
            history.error_message = str(e)[:500]

            logger.error(
                "notification_error",
                extra={
                    "channel_id": channel.id,
                    "channel_type": channel.channel_type,
                    "event_type": history.event_type,
                    "error": str(e),
                }
            )

        finally:
            self.db.commit()

    async def test_channel(
        self,
        user_id: int,
        channel_id: int,
        message: Optional[str] = None,
    ) -> Tuple[bool, str]:
        """
        Send a test notification to a channel.

        Returns:
            Tuple of (success, message)
        """
        channel = self.get_channel(user_id, channel_id)
        if not channel:
            return False, "Channel not found"

        test_message = message or "This is a test notification from MediKeep"
        test_title = "MediKeep Test Notification"

        # Create history record for test notification
        history = NotificationHistory(
            user_id=user_id,
            channel_id=channel_id,
            event_type="test_notification",
            event_data={"message": test_message},
            title=test_title,
            message_preview=test_message[:500] if test_message else None,
            status=NotificationStatus.PENDING.value,
        )
        self.db.add(history)
        self.db.commit()

        try:
            import apprise

            config = self._decrypt_config(channel.config_encrypted)
            builder = CHANNEL_BUILDERS.get(channel.channel_type)

            if not builder:
                history.status = NotificationStatus.FAILED.value
                history.error_message = f"Unknown channel type: {channel.channel_type}"
                self.db.commit()
                return False, f"Unknown channel type: {channel.channel_type}"

            apprise_url = builder(config)
            if not apprise_url:
                history.status = NotificationStatus.FAILED.value
                history.error_message = "Failed to build notification URL"
                self.db.commit()
                return False, "Failed to build notification URL"

            apobj = apprise.Apprise()
            apobj.add(apprise_url)

            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: apobj.notify(title=test_title, body=test_message)
            )

            # Update channel test status
            channel.last_test_at = datetime.now(timezone.utc)

            if result:
                channel.last_test_status = "success"
                channel.is_verified = True
                history.status = NotificationStatus.SENT.value
                history.sent_at = datetime.now(timezone.utc)
                channel.total_notifications_sent += 1
                self.db.commit()

                logger.info(
                    "notification_test_success",
                    extra={"channel_id": channel_id, "user_id": user_id}
                )
                return True, "Test notification sent successfully"
            else:
                channel.last_test_status = "failed"
                history.status = NotificationStatus.FAILED.value
                history.error_message = "Apprise returned failure"
                self.db.commit()
                return False, "Failed to send test notification"

        except Exception as e:
            channel.last_test_at = datetime.now(timezone.utc)
            channel.last_test_status = "error"
            history.status = NotificationStatus.FAILED.value
            history.error_message = str(e)[:500]
            self.db.commit()

            logger.error(
                "notification_test_error",
                extra={"channel_id": channel_id, "user_id": user_id, "error": str(e)}
            )
            return False, f"Error: {str(e)}"

    # =========================================================================
    # Preference Management
    # =========================================================================

    def get_user_preferences(self, user_id: int) -> List[NotificationPreference]:
        """Get all notification preferences for a user."""
        return self.db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id
        ).all()

    def set_preference(
        self,
        user_id: int,
        channel_id: int,
        event_type: str,
        is_enabled: bool,
        remind_before_minutes: Optional[int] = None,
    ) -> NotificationPreference:
        """
        Set or update a notification preference.

        Creates the preference if it doesn't exist, updates if it does.
        """
        # Verify channel belongs to user
        channel = self.get_channel(user_id, channel_id)
        if not channel:
            raise ValueError("Channel not found")

        # Find or create preference
        preference = self.db.query(NotificationPreference).filter(
            and_(
                NotificationPreference.user_id == user_id,
                NotificationPreference.channel_id == channel_id,
                NotificationPreference.event_type == event_type
            )
        ).first()

        if preference:
            preference.is_enabled = is_enabled
            if remind_before_minutes is not None:
                preference.remind_before_minutes = remind_before_minutes
        else:
            preference = NotificationPreference(
                user_id=user_id,
                channel_id=channel_id,
                event_type=event_type,
                is_enabled=is_enabled,
                remind_before_minutes=remind_before_minutes,
            )
            self.db.add(preference)

        self.db.commit()
        self.db.refresh(preference)

        logger.info(
            "notification_preference_updated",
            extra={
                "user_id": user_id,
                "channel_id": channel_id,
                "event_type": event_type,
                "is_enabled": is_enabled,
            }
        )

        return preference

    def delete_preference(
        self,
        user_id: int,
        channel_id: int,
        event_type: str,
    ) -> bool:
        """Delete a notification preference."""
        preference = self.db.query(NotificationPreference).filter(
            and_(
                NotificationPreference.user_id == user_id,
                NotificationPreference.channel_id == channel_id,
                NotificationPreference.event_type == event_type
            )
        ).first()

        if preference:
            self.db.delete(preference)
            self.db.commit()
            return True

        return False

    # =========================================================================
    # History Management
    # =========================================================================

    def get_notification_history(
        self,
        user_id: int,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        event_type: Optional[str] = None,
    ) -> Tuple[List[NotificationHistory], int]:
        """
        Get notification history for a user with pagination.

        Returns:
            Tuple of (history_items, total_count)
        """
        query = self.db.query(NotificationHistory).filter(
            NotificationHistory.user_id == user_id
        )

        if status:
            query = query.filter(NotificationHistory.status == status)

        if event_type:
            query = query.filter(NotificationHistory.event_type == event_type)

        total = query.count()

        items = query.order_by(desc(NotificationHistory.created_at)).offset(
            (page - 1) * page_size
        ).limit(page_size).all()

        return items, total

    # =========================================================================
    # Encryption Helpers
    # =========================================================================

    def _encrypt_config(self, config: Dict[str, Any]) -> str:
        """Encrypt channel configuration."""
        config_json = json.dumps(config)
        encrypted = self._fernet.encrypt(config_json.encode())
        return encrypted.decode()

    def _decrypt_config(self, encrypted_config: str) -> Dict[str, Any]:
        """Decrypt channel configuration."""
        decrypted = self._fernet.decrypt(encrypted_config.encode())
        return json.loads(decrypted.decode())


# ============================================================================
# Helper Function for Easy Integration
# ============================================================================

async def notify(
    db: Session,
    user_id: int,
    event_type: str,
    data: Optional[Dict] = None,
) -> List[NotificationHistory]:
    """
    Simple helper to send notifications from anywhere in the app.

    Usage:
        await notify(db, user.id, "backup_completed", {"filename": "backup.zip"})

    Args:
        db: Database session
        user_id: User ID to notify
        event_type: Event type identifier
        data: Event-specific data for template formatting

    Returns:
        List of NotificationHistory records
    """
    try:
        service = NotificationService(db)
        title, message = service.templates.get_template(event_type, data or {})

        return await service.send_notification(
            user_id=user_id,
            event_type=event_type,
            title=title,
            message=message,
            event_data=data,
        )
    except Exception as e:
        # Notification errors should never break core operations
        logger.error(
            "notify_helper_error",
            extra={
                "user_id": user_id,
                "event_type": event_type,
                "error": str(e),
            }
        )
        return []
