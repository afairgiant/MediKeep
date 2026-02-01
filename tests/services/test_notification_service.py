"""
Tests for the notification service.
"""

import pytest
from unittest.mock import patch

from app.services.notification_service import (
    NotificationService,
    _build_discord_url,
    _build_email_url,
    _build_gotify_url,
    _build_webhook_url,
)
from app.services.notification_templates import (
    get_template,
    get_supported_events,
)


class TestNotificationTemplates:
    """Tests for notification message templates."""

    def test_get_supported_events(self):
        """Test that all expected events are supported."""
        events = get_supported_events()

        assert "backup_completed" in events
        assert "backup_failed" in events
        assert "invitation_received" in events
        assert "password_changed" in events

    def test_backup_completed_template(self):
        """Test backup completed template formatting."""
        title, message = get_template("backup_completed", {
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
        title, message = get_template("backup_failed", {
            "error": "Disk full",
            "backup_type": "database"
        })

        assert title == "Backup Failed"
        assert "Disk full" in message
        assert "database" in message

    def test_invitation_received_template(self):
        """Test invitation received template formatting."""
        title, message = get_template("invitation_received", {
            "from_user": "John Doe",
            "invitation_type": "patient share"
        })

        assert title == "New Sharing Invitation"
        assert "John Doe" in message
        assert "patient share" in message

    def test_password_changed_template(self):
        """Test password changed template formatting."""
        title, message = get_template("password_changed", {
            "change_time": "2026-01-27 10:30:00",
        })

        assert title == "Password Changed"
        assert "2026-01-27 10:30:00" in message
        assert "successfully changed" in message

    def test_unknown_event_fallback(self):
        """Test that unknown events get a fallback template."""
        title, message = get_template("unknown_event", {})

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
            password_hash="hashedpw",
            role="user",
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
            password_hash="hashedpw",
            role="user",
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
            password_hash="hashedpw",
            role="user",
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
            password_hash="hashedpw",
            role="user",
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

        # Sensitive fields should be masked (passwords are always fully masked)
        assert masked["smtp_password"] == "****"

    def test_update_channel(self, db_session):
        """Test updating a channel."""
        from app.models.models import User
        user = User(
            username="testuser5",
            email="test5@example.com",
            password_hash="hashedpw",
            role="user",
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
            password_hash="hashedpw",
            role="user",
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
            password_hash="hashedpw",
            role="user",
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
            password_hash="hashedpw",
            role="user",
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
            password_hash="hashedpw",
            role="user",
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

    async def test_send_notification_disabled(self, db_session):
        """Test that notifications are skipped when disabled."""
        from app.models.models import User
        user = User(
            username="testuser10",
            email="test10@example.com",
            password_hash="hashedpw",
            role="user",
            full_name="Test User 10"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        service = NotificationService(db_session)

        # Patch NOTIFICATIONS_ENABLED after service creation
        with patch("app.services.notification_service.settings.NOTIFICATIONS_ENABLED", False):
            results = await service.send_notification(
                user_id=user.id,
                event_type="backup_completed",
                title="Test",
                message="Test message"
            )

        assert results == []


@pytest.mark.asyncio
class TestBroadcastNotifications:
    """Tests for broadcast notification functionality."""

    async def test_broadcast_sends_to_all_subscribed_users(self, db_session):
        """Test that broadcast notifications are sent to all users with the event enabled."""
        from app.models.models import User

        # Create multiple users
        users = []
        for i in range(3):
            user = User(
                username=f"broadcast_user{i}",
                email=f"broadcast{i}@example.com",
                password_hash="hashedpw",
            role="user",
                full_name=f"Broadcast User {i}"
            )
            db_session.add(user)
            users.append(user)
        db_session.commit()
        for user in users:
            db_session.refresh(user)

        service = NotificationService(db_session)

        # Create channels and preferences for each user
        for user in users:
            channel = service.create_channel(
                user_id=user.id,
                name=f"Channel for {user.username}",
                channel_type="discord",
                config={"webhook_url": f"https://discord.com/api/webhooks/{user.id}/abc"}
            )
            service.set_preference(user.id, channel.id, "backup_completed", True)

        # Send broadcast notification
        with patch.object(service, '_send_to_channel') as mock_send:
            # Make the mock async
            async def async_noop(*args, **kwargs):
                pass
            mock_send.side_effect = async_noop

            results = await service.send_broadcast_notification(
                event_type="backup_completed",
                title="Backup Complete",
                message="Your backup completed successfully"
            )

        # Should have created history records for all 3 users
        assert len(results) == 3
        # Verify _send_to_channel was called for each user's channel
        assert mock_send.call_count == 3

    async def test_broadcast_only_enabled_preferences_receive(self, db_session):
        """Test that only users with enabled preferences receive broadcast notifications."""
        from app.models.models import User

        # Create two users
        user1 = User(
            username="enabled_user",
            email="enabled@example.com",
            password_hash="hashedpw",
            role="user",
            full_name="Enabled User"
        )
        user2 = User(
            username="disabled_user",
            email="disabled@example.com",
            password_hash="hashedpw",
            role="user",
            full_name="Disabled User"
        )
        db_session.add(user1)
        db_session.add(user2)
        db_session.commit()
        db_session.refresh(user1)
        db_session.refresh(user2)

        service = NotificationService(db_session)

        # Create channels for both users
        channel1 = service.create_channel(
            user_id=user1.id,
            name="Enabled Channel",
            channel_type="discord",
            config={"webhook_url": "https://discord.com/api/webhooks/1/abc"}
        )
        channel2 = service.create_channel(
            user_id=user2.id,
            name="Disabled Channel",
            channel_type="discord",
            config={"webhook_url": "https://discord.com/api/webhooks/2/abc"}
        )

        # Enable preference for user1, disable for user2
        service.set_preference(user1.id, channel1.id, "backup_completed", True)
        service.set_preference(user2.id, channel2.id, "backup_completed", False)

        # Send broadcast notification
        with patch.object(service, '_send_to_channel') as mock_send:
            async def async_noop(*args, **kwargs):
                pass
            mock_send.side_effect = async_noop

            results = await service.send_broadcast_notification(
                event_type="backup_completed",
                title="Backup Complete",
                message="Your backup completed successfully"
            )

        # Should only have created history record for user1
        assert len(results) == 1
        assert results[0].user_id == user1.id
        assert mock_send.call_count == 1

    async def test_broadcast_no_preferences_returns_empty(self, db_session):
        """Test that broadcast returns empty list when no users have the event enabled."""
        from app.models.models import User

        user = User(
            username="no_pref_user",
            email="nopref@example.com",
            password_hash="hashedpw",
            role="user",
            full_name="No Pref User"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        service = NotificationService(db_session)

        # Create channel but no preference for backup_completed
        channel = service.create_channel(
            user_id=user.id,
            name="No Pref Channel",
            channel_type="discord",
            config={"webhook_url": "https://discord.com/api/webhooks/123/abc"}
        )
        # Set preference for a different event type
        service.set_preference(user.id, channel.id, "password_changed", True)

        results = await service.send_broadcast_notification(
            event_type="backup_completed",
            title="Backup Complete",
            message="Your backup completed successfully"
        )

        assert results == []

    async def test_broadcast_disabled_when_notifications_off(self, db_session):
        """Test that no broadcast notifications are sent when NOTIFICATIONS_ENABLED is False."""
        from app.models.models import User

        user = User(
            username="disabled_notif_user",
            email="disabled_notif@example.com",
            password_hash="hashedpw",
            role="user",
            full_name="Disabled Notif User"
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        service = NotificationService(db_session)

        # Set up channel and preference first
        channel = service.create_channel(
            user_id=user.id,
            name="Disabled Notif Channel",
            channel_type="discord",
            config={"webhook_url": "https://discord.com/api/webhooks/123/abc"}
        )
        service.set_preference(user.id, channel.id, "backup_completed", True)

        # Now patch NOTIFICATIONS_ENABLED and test
        with patch("app.services.notification_service.settings.NOTIFICATIONS_ENABLED", False):
            results = await service.send_broadcast_notification(
                event_type="backup_completed",
                title="Backup Complete",
                message="Your backup completed successfully"
            )

        assert results == []

    async def test_broadcast_logs_recipient_count(self, db_session):
        """Test that broadcast sends to correct number of recipients."""
        from app.models.models import User

        # Create two users with preferences enabled
        users = []
        for i in range(2):
            user = User(
                username=f"log_test_user{i}",
                email=f"logtest{i}@example.com",
                password_hash="hashedpw",
            role="user",
                full_name=f"Log Test User {i}"
            )
            db_session.add(user)
            users.append(user)
        db_session.commit()
        for user in users:
            db_session.refresh(user)

        service = NotificationService(db_session)

        # Create channels and preferences
        for user in users:
            channel = service.create_channel(
                user_id=user.id,
                name=f"Log Channel {user.username}",
                channel_type="discord",
                config={"webhook_url": f"https://discord.com/api/webhooks/{user.id}/abc"}
            )
            service.set_preference(user.id, channel.id, "backup_completed", True)

        # Send broadcast notification
        with patch.object(service, '_send_to_channel') as mock_send:
            async def async_noop(*args, **kwargs):
                pass
            mock_send.side_effect = async_noop

            results = await service.send_broadcast_notification(
                event_type="backup_completed",
                title="Backup Complete",
                message="Your backup completed successfully"
            )

        # Verify correct number of recipients
        assert len(results) == 2
        assert mock_send.call_count == 2
