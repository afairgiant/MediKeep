"""
Tests for the notification service.
"""

import pytest
from unittest.mock import patch

from app.services.notification_service import (
    NotificationService,
    notify,
    _build_discord_url,
    _build_email_url,
    _build_gotify_url,
    _build_webhook_url,
)
from app.services.notification_templates import NotificationTemplates


class TestNotificationTemplates:
    """Tests for notification message templates."""

    def test_get_supported_events(self):
        """Test that all expected events are supported."""
        templates = NotificationTemplates()
        events = templates.get_supported_events()

        assert "backup_completed" in events
        assert "backup_failed" in events
        assert "invitation_received" in events
        assert "password_changed" in events

    def test_backup_completed_template(self):
        """Test backup completed template formatting."""
        templates = NotificationTemplates()
        title, message = templates.get_template("backup_completed", {
            "filename": "backup_20260127.zip",
            "size_mb": 15.5,
            "backup_type": "full"
        })

        assert title == "Backup Completed Successfully"
        assert "backup_20260127.zip" in message
        assert "15.5 MB" in message
        assert "full" in message

    def test_backup_failed_template(self):
        """Test backup failed template formatting."""
        templates = NotificationTemplates()
        title, message = templates.get_template("backup_failed", {
            "error": "Disk full",
            "backup_type": "database"
        })

        assert title == "Backup Failed"
        assert "Disk full" in message
        assert "database" in message

    def test_invitation_received_template(self):
        """Test invitation received template formatting."""
        templates = NotificationTemplates()
        title, message = templates.get_template("invitation_received", {
            "from_user": "John Doe",
            "invitation_type": "patient share"
        })

        assert title == "New Sharing Invitation"
        assert "John Doe" in message
        assert "patient share" in message

    def test_password_changed_template(self):
        """Test password changed template formatting."""
        templates = NotificationTemplates()
        title, message = templates.get_template("password_changed", {
            "change_time": "2026-01-27 10:30:00",
            "ip_address": "192.168.1.100"
        })

        assert title == "Password Changed"
        assert "2026-01-27 10:30:00" in message
        assert "192.168.1.100" in message

    def test_unknown_event_fallback(self):
        """Test that unknown events get a fallback template."""
        templates = NotificationTemplates()
        title, message = templates.get_template("unknown_event", {})

        assert "unknown_event" in title
        assert "unknown_event" in message


class TestChannelURLBuilders:
    """Tests for channel URL builder functions."""

    def test_build_discord_url(self):
        """Test Discord webhook URL building."""
        config = {
            "webhook_url": "https://discord.com/api/webhooks/123456789/abcdef12345"
        }
        url = _build_discord_url(config)

        assert url == "discord://123456789/abcdef12345"

    def test_build_discord_url_discordapp(self):
        """Test Discord webhook URL with discordapp domain."""
        config = {
            "webhook_url": "https://discordapp.com/api/webhooks/123/abc"
        }
        url = _build_discord_url(config)

        assert url == "discord://123/abc"

    def test_build_email_url_tls(self):
        """Test email URL building with TLS."""
        config = {
            "smtp_host": "smtp.gmail.com",
            "smtp_port": 587,
            "smtp_user": "user@gmail.com",
            "smtp_password": "app_password",
            "from_email": "sender@gmail.com",
            "to_email": "recipient@example.com",
            "use_tls": True
        }
        url = _build_email_url(config)

        assert url.startswith("mailtos://")
        assert "smtp.gmail.com:587" in url
        assert "from=sender@gmail.com" in url
        assert "to=recipient@example.com" in url

    def test_build_email_url_no_tls(self):
        """Test email URL building without TLS."""
        config = {
            "smtp_host": "localhost",
            "smtp_port": 25,
            "smtp_user": "user",
            "smtp_password": "pass",
            "from_email": "from@example.com",
            "to_email": "to@example.com",
            "use_tls": False
        }
        url = _build_email_url(config)

        assert url.startswith("mailto://")
        assert "localhost:25" in url

    def test_build_gotify_url_https(self):
        """Test Gotify URL building with HTTPS."""
        config = {
            "server_url": "https://gotify.example.com",
            "app_token": "mytoken123",
            "priority": 7
        }
        url = _build_gotify_url(config)

        assert url.startswith("gotifys://")
        assert "gotify.example.com" in url
        assert "mytoken123" in url
        assert "priority=7" in url

    def test_build_gotify_url_http(self):
        """Test Gotify URL building with HTTP."""
        config = {
            "server_url": "http://localhost:8080",
            "app_token": "token",
            "priority": 5
        }
        url = _build_gotify_url(config)

        assert url.startswith("gotify://")
        assert "localhost:8080" in url

    def test_build_webhook_url_https(self):
        """Test webhook URL building with HTTPS."""
        config = {
            "url": "https://api.example.com/webhook",
            "method": "POST",
        }
        url = _build_webhook_url(config)

        assert url.startswith("jsons://")
        assert "api.example.com/webhook" in url

    def test_build_webhook_url_with_auth(self):
        """Test webhook URL building with auth token."""
        config = {
            "url": "https://api.example.com/webhook",
            "method": "POST",
            "auth_token": "secret123"
        }
        url = _build_webhook_url(config)

        assert "Authorization=Bearer secret123" in url


class TestNotificationService:
    """Tests for the notification service."""

    def test_create_channel(self, db_session):
        """Test creating a notification channel."""
        # Create a test user first
        from app.models.models import User
        user = User(
            username="testuser",
            email="test@example.com",
            hashed_password="hashedpw",
            full_name="Test User"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        service = NotificationService(db_session)
        channel = service.create_channel(
            user_id=user.id,
            name="My Discord",
            channel_type="discord",
            config={"webhook_url": "https://discord.com/api/webhooks/123/abc"},
            is_enabled=True
        )

        assert channel.id is not None
        assert channel.name == "My Discord"
        assert channel.channel_type == "discord"
        assert channel.is_enabled is True
        assert channel.is_verified is False

    def test_create_channel_duplicate_name(self, db_session):
        """Test that duplicate channel names are rejected."""
        from app.models.models import User
        user = User(
            username="testuser2",
            email="test2@example.com",
            hashed_password="hashedpw",
            full_name="Test User 2"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        service = NotificationService(db_session)

        # Create first channel
        service.create_channel(
            user_id=user.id,
            name="My Channel",
            channel_type="discord",
            config={"webhook_url": "https://discord.com/api/webhooks/123/abc"}
        )

        # Try to create duplicate
        with pytest.raises(ValueError, match="already exists"):
            service.create_channel(
                user_id=user.id,
                name="My Channel",
                channel_type="gotify",
                config={"server_url": "https://gotify.example.com", "app_token": "token", "priority": 5}
            )

    def test_encrypt_decrypt_config(self, db_session):
        """Test that channel config is properly encrypted and decrypted."""
        from app.models.models import User
        user = User(
            username="testuser3",
            email="test3@example.com",
            hashed_password="hashedpw",
            full_name="Test User 3"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        service = NotificationService(db_session)
        original_config = {
            "smtp_host": "smtp.example.com",
            "smtp_password": "supersecret"
        }

        channel = service.create_channel(
            user_id=user.id,
            name="Email Channel",
            channel_type="email",
            config=original_config
        )

        # Verify config is encrypted (not plain text)
        assert "supersecret" not in channel.config_encrypted

        # Verify config can be decrypted
        decrypted = service.get_channel_config(channel)
        assert decrypted["smtp_host"] == "smtp.example.com"
        assert decrypted["smtp_password"] == "supersecret"

    def test_get_masked_config(self, db_session):
        """Test that sensitive fields are masked."""
        from app.models.models import User
        user = User(
            username="testuser4",
            email="test4@example.com",
            hashed_password="hashedpw",
            full_name="Test User 4"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        service = NotificationService(db_session)
        channel = service.create_channel(
            user_id=user.id,
            name="Test Channel",
            channel_type="email",
            config={
                "smtp_host": "smtp.example.com",
                "smtp_password": "verysecretpassword123",
                "smtp_user": "user@example.com"
            }
        )

        masked = service.get_masked_config(channel)

        # Non-sensitive fields should be visible
        assert masked["smtp_host"] == "smtp.example.com"
        assert masked["smtp_user"] == "user@example.com"

        # Sensitive fields should be masked
        assert masked["smtp_password"] == "ve...23"

    def test_update_channel(self, db_session):
        """Test updating a channel."""
        from app.models.models import User
        user = User(
            username="testuser5",
            email="test5@example.com",
            hashed_password="hashedpw",
            full_name="Test User 5"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        service = NotificationService(db_session)
        channel = service.create_channel(
            user_id=user.id,
            name="Original Name",
            channel_type="discord",
            config={"webhook_url": "https://discord.com/api/webhooks/123/abc"}
        )

        # Update name
        updated = service.update_channel(
            user_id=user.id,
            channel_id=channel.id,
            name="New Name"
        )

        assert updated.name == "New Name"

    def test_delete_channel(self, db_session):
        """Test deleting a channel."""
        from app.models.models import User
        user = User(
            username="testuser6",
            email="test6@example.com",
            hashed_password="hashedpw",
            full_name="Test User 6"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        service = NotificationService(db_session)
        channel = service.create_channel(
            user_id=user.id,
            name="To Delete",
            channel_type="discord",
            config={"webhook_url": "https://discord.com/api/webhooks/123/abc"}
        )

        channel_id = channel.id
        result = service.delete_channel(user.id, channel_id)

        assert result is True
        assert service.get_channel(user.id, channel_id) is None

    def test_set_preference(self, db_session):
        """Test setting a notification preference."""
        from app.models.models import User
        user = User(
            username="testuser7",
            email="test7@example.com",
            hashed_password="hashedpw",
            full_name="Test User 7"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        service = NotificationService(db_session)
        channel = service.create_channel(
            user_id=user.id,
            name="Pref Test",
            channel_type="discord",
            config={"webhook_url": "https://discord.com/api/webhooks/123/abc"}
        )

        pref = service.set_preference(
            user_id=user.id,
            channel_id=channel.id,
            event_type="backup_completed",
            is_enabled=True
        )

        assert pref.event_type == "backup_completed"
        assert pref.is_enabled is True

    def test_get_user_preferences(self, db_session):
        """Test getting user preferences."""
        from app.models.models import User
        user = User(
            username="testuser8",
            email="test8@example.com",
            hashed_password="hashedpw",
            full_name="Test User 8"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        service = NotificationService(db_session)
        channel = service.create_channel(
            user_id=user.id,
            name="Prefs Test 2",
            channel_type="discord",
            config={"webhook_url": "https://discord.com/api/webhooks/123/abc"}
        )

        service.set_preference(user.id, channel.id, "backup_completed", True)
        service.set_preference(user.id, channel.id, "backup_failed", True)

        prefs = service.get_user_preferences(user.id)
        assert len(prefs) == 2


@pytest.mark.asyncio
class TestNotificationSending:
    """Tests for notification sending functionality."""

    async def test_send_notification_no_channels(self, db_session):
        """Test sending notification when no channels configured."""
        from app.models.models import User
        user = User(
            username="testuser9",
            email="test9@example.com",
            hashed_password="hashedpw",
            full_name="Test User 9"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        service = NotificationService(db_session)
        results = await service.send_notification(
            user_id=user.id,
            event_type="backup_completed",
            title="Test",
            message="Test message"
        )

        assert results == []

    @patch("app.services.notification_service.settings")
    async def test_send_notification_disabled(self, mock_settings, db_session):
        """Test that notifications are skipped when disabled."""
        mock_settings.NOTIFICATIONS_ENABLED = False

        from app.models.models import User
        user = User(
            username="testuser10",
            email="test10@example.com",
            hashed_password="hashedpw",
            full_name="Test User 10"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        service = NotificationService(db_session)
        results = await service.send_notification(
            user_id=user.id,
            event_type="backup_completed",
            title="Test",
            message="Test message"
        )

        assert results == []

    @patch("app.services.notification_service.settings")
    async def test_notify_helper(self, mock_settings, db_session):
        """Test the notify helper function."""
        mock_settings.NOTIFICATIONS_ENABLED = False

        from app.models.models import User
        user = User(
            username="testuser11",
            email="test11@example.com",
            hashed_password="hashedpw",
            full_name="Test User 11"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        results = await notify(
            db=db_session,
            user_id=user.id,
            event_type="backup_completed",
            data={"filename": "test.zip", "size_mb": 10}
        )

        # Should return empty list when disabled
        assert results == []
