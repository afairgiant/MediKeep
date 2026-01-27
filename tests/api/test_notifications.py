"""
API tests for notification endpoints.
"""

from fastapi import status


class TestEventTypes:
    """Tests for event types endpoint."""

    def test_list_event_types(self, client, auth_headers):
        """Test listing available event types."""
        response = client.get(
            "/api/v1/notifications/event-types",
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert "event_types" in data
        assert len(data["event_types"]) > 0

        # Check structure
        event = data["event_types"][0]
        assert "value" in event
        assert "label" in event
        assert "description" in event
        assert "category" in event

    def test_list_event_types_unauthorized(self, client):
        """Test that event types requires authentication."""
        response = client.get("/api/v1/notifications/event-types")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestChannelManagement:
    """Tests for channel management endpoints."""

    def test_list_channels_empty(self, client, auth_headers):
        """Test listing channels when none exist."""
        response = client.get(
            "/api/v1/notifications/channels",
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    def test_create_discord_channel(self, client, auth_headers):
        """Test creating a Discord channel."""
        response = client.post(
            "/api/v1/notifications/channels",
            headers=auth_headers,
            json={
                "name": "My Discord Server",
                "channel_type": "discord",
                "config": {
                    "webhook_url": "https://discord.com/api/webhooks/123456/abcdef"
                },
                "is_enabled": True
            }
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()

        assert data["name"] == "My Discord Server"
        assert data["channel_type"] == "discord"
        assert data["is_enabled"] is True
        assert data["is_verified"] is False
        assert data["total_notifications_sent"] == 0

    def test_create_email_channel(self, client, auth_headers):
        """Test creating an email channel."""
        response = client.post(
            "/api/v1/notifications/channels",
            headers=auth_headers,
            json={
                "name": "My Email",
                "channel_type": "email",
                "config": {
                    "smtp_host": "smtp.gmail.com",
                    "smtp_port": 587,
                    "smtp_user": "user@gmail.com",
                    "smtp_password": "apppassword",
                    "from_email": "user@gmail.com",
                    "to_email": "recipient@example.com",
                    "use_tls": True
                }
            }
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["channel_type"] == "email"

    def test_create_gotify_channel(self, client, auth_headers):
        """Test creating a Gotify channel."""
        response = client.post(
            "/api/v1/notifications/channels",
            headers=auth_headers,
            json={
                "name": "My Gotify",
                "channel_type": "gotify",
                "config": {
                    "server_url": "https://gotify.example.com",
                    "app_token": "mytoken123",
                    "priority": 5
                }
            }
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["channel_type"] == "gotify"

    def test_create_webhook_channel(self, client, auth_headers):
        """Test creating a webhook channel."""
        response = client.post(
            "/api/v1/notifications/channels",
            headers=auth_headers,
            json={
                "name": "My Webhook",
                "channel_type": "webhook",
                "config": {
                    "url": "https://api.example.com/webhook",
                    "method": "POST"
                }
            }
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["channel_type"] == "webhook"

    def test_create_channel_invalid_type(self, client, auth_headers):
        """Test creating a channel with invalid type."""
        response = client.post(
            "/api/v1/notifications/channels",
            headers=auth_headers,
            json={
                "name": "Invalid Channel",
                "channel_type": "invalid_type",
                "config": {}
            }
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_channel_invalid_discord_url(self, client, auth_headers):
        """Test creating a Discord channel with invalid URL."""
        response = client.post(
            "/api/v1/notifications/channels",
            headers=auth_headers,
            json={
                "name": "Bad Discord",
                "channel_type": "discord",
                "config": {
                    "webhook_url": "https://example.com/not-a-discord-webhook"
                }
            }
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_channel_duplicate_name(self, client, auth_headers):
        """Test that duplicate channel names are rejected."""
        # Create first channel
        client.post(
            "/api/v1/notifications/channels",
            headers=auth_headers,
            json={
                "name": "Duplicate Name",
                "channel_type": "discord",
                "config": {
                    "webhook_url": "https://discord.com/api/webhooks/123/abc"
                }
            }
        )

        # Try to create duplicate
        response = client.post(
            "/api/v1/notifications/channels",
            headers=auth_headers,
            json={
                "name": "Duplicate Name",
                "channel_type": "gotify",
                "config": {
                    "server_url": "https://gotify.example.com",
                    "app_token": "token",
                    "priority": 5
                }
            }
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already exists" in response.json()["detail"]

    def test_get_channel(self, client, auth_headers):
        """Test getting a specific channel."""
        # Create channel first
        create_response = client.post(
            "/api/v1/notifications/channels",
            headers=auth_headers,
            json={
                "name": "Get Test Channel",
                "channel_type": "discord",
                "config": {
                    "webhook_url": "https://discord.com/api/webhooks/123/abc"
                }
            }
        )
        channel_id = create_response.json()["id"]

        # Get channel
        response = client.get(
            f"/api/v1/notifications/channels/{channel_id}",
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Get Test Channel"
        assert "config_masked" in data

    def test_get_channel_not_found(self, client, auth_headers):
        """Test getting a non-existent channel."""
        response = client.get(
            "/api/v1/notifications/channels/99999",
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_channel(self, client, auth_headers):
        """Test updating a channel."""
        # Create channel
        create_response = client.post(
            "/api/v1/notifications/channels",
            headers=auth_headers,
            json={
                "name": "Update Test",
                "channel_type": "discord",
                "config": {
                    "webhook_url": "https://discord.com/api/webhooks/123/abc"
                }
            }
        )
        channel_id = create_response.json()["id"]

        # Update channel
        response = client.put(
            f"/api/v1/notifications/channels/{channel_id}",
            headers=auth_headers,
            json={
                "name": "Updated Name",
                "is_enabled": False
            }
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["is_enabled"] is False

    def test_delete_channel(self, client, auth_headers):
        """Test deleting a channel."""
        # Create channel
        create_response = client.post(
            "/api/v1/notifications/channels",
            headers=auth_headers,
            json={
                "name": "Delete Test",
                "channel_type": "discord",
                "config": {
                    "webhook_url": "https://discord.com/api/webhooks/123/abc"
                }
            }
        )
        channel_id = create_response.json()["id"]

        # Delete channel
        response = client.delete(
            f"/api/v1/notifications/channels/{channel_id}",
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify deletion
        get_response = client.get(
            f"/api/v1/notifications/channels/{channel_id}",
            headers=auth_headers
        )
        assert get_response.status_code == status.HTTP_404_NOT_FOUND


class TestPreferences:
    """Tests for preference management endpoints."""

    def test_list_preferences_empty(self, client, auth_headers):
        """Test listing preferences when none exist."""
        response = client.get(
            "/api/v1/notifications/preferences",
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    def test_set_preference(self, client, auth_headers):
        """Test setting a notification preference."""
        # Create channel first
        channel_response = client.post(
            "/api/v1/notifications/channels",
            headers=auth_headers,
            json={
                "name": "Pref Test Channel",
                "channel_type": "discord",
                "config": {
                    "webhook_url": "https://discord.com/api/webhooks/123/abc"
                }
            }
        )
        channel_id = channel_response.json()["id"]

        # Set preference
        response = client.post(
            "/api/v1/notifications/preferences",
            headers=auth_headers,
            json={
                "channel_id": channel_id,
                "event_type": "backup_completed",
                "is_enabled": True
            }
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["event_type"] == "backup_completed"
        assert data["is_enabled"] is True
        assert data["channel_id"] == channel_id

    def test_set_preference_invalid_channel(self, client, auth_headers):
        """Test setting preference with invalid channel."""
        response = client.post(
            "/api/v1/notifications/preferences",
            headers=auth_headers,
            json={
                "channel_id": 99999,
                "event_type": "backup_completed",
                "is_enabled": True
            }
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_preference_matrix(self, client, auth_headers):
        """Test getting the preference matrix."""
        response = client.get(
            "/api/v1/notifications/preferences/matrix",
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert "channels" in data
        assert "events" in data
        assert "preferences" in data
        assert len(data["events"]) > 0


class TestHistory:
    """Tests for notification history endpoints."""

    def test_get_history_empty(self, client, auth_headers):
        """Test getting history when empty."""
        response = client.get(
            "/api/v1/notifications/history",
            headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["items"] == []
        assert data["total"] == 0
        assert data["page"] == 1

    def test_get_history_pagination(self, client, auth_headers):
        """Test history pagination parameters."""
        response = client.get(
            "/api/v1/notifications/history",
            headers=auth_headers,
            params={"page": 2, "page_size": 10}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["page"] == 2
        assert data["page_size"] == 10

    def test_get_history_invalid_page_size(self, client, auth_headers):
        """Test history with invalid page size."""
        response = client.get(
            "/api/v1/notifications/history",
            headers=auth_headers,
            params={"page_size": 1000}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
