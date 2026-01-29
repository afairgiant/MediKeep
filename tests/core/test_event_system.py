"""
Tests for the event-driven notification system.

Tests cover:
- Event class functionality
- Event bus publish/subscribe
- Event registry
- Template generation
"""

import pytest
from datetime import datetime

from app.core.events import (
    EventBus,
    get_event_bus,
    EventRegistry,
    get_event_registry,
    setup_event_system,
)
from app.events.backup_events import BackupCompletedEvent, BackupFailedEvent
from app.events.collaboration_events import (
    InvitationReceivedEvent,
    InvitationAcceptedEvent,
    ShareRevokedEvent,
)
from app.events.security_events import PasswordChangedEvent


class TestDomainEvent:
    """Tests for the base DomainEvent class."""

    def test_event_has_auto_generated_id(self):
        """Event should have auto-generated UUID."""
        event = PasswordChangedEvent(user_id=1, change_time="2026-01-29")
        assert event.event_id is not None
        assert len(event.event_id) == 36  # UUID format

    def test_event_has_timestamp(self):
        """Event should have auto-generated timestamp."""
        event = PasswordChangedEvent(user_id=1, change_time="2026-01-29")
        assert event.occurred_at is not None
        assert isinstance(event.occurred_at, datetime)

    def test_event_type_from_class_name(self):
        """Event type should be derived from class name."""
        # event_type() is an instance method, so we need to create instances
        assert PasswordChangedEvent(user_id=1, change_time="").event_type() == "password_changed"
        assert BackupCompletedEvent(user_id=1, filename="", size_mb=0).event_type() == "backup_completed"
        assert BackupFailedEvent(user_id=1, error="").event_type() == "backup_failed"
        assert InvitationReceivedEvent(user_id=1, from_user="", invitation_type="", title="").event_type() == "invitation_received"
        assert InvitationAcceptedEvent(user_id=1, by_user="", invitation_type="", title="").event_type() == "invitation_accepted"
        assert ShareRevokedEvent(user_id=1, by_user="").event_type() == "share_revoked"

    def test_to_notification_data(self):
        """Event should convert to notification data dict."""
        event = BackupCompletedEvent(
            user_id=1,
            filename="backup.zip",
            size_mb=50.5,
            backup_type="full",
            checksum="abc123"
        )
        data = event.to_notification_data()

        assert data["user_id"] == 1
        assert data["filename"] == "backup.zip"
        assert data["size_mb"] == 50.5
        assert data["backup_type"] == "full"
        assert data["checksum"] == "abc123"
        # event_id should be excluded
        assert "event_id" not in data or data.get("event_id") is None


class TestEventBus:
    """Tests for the EventBus publish/subscribe system."""

    @pytest.mark.asyncio
    async def test_subscribe_and_publish(self):
        """Handler should receive published events."""
        bus = EventBus()
        received = []

        async def handler(event):
            received.append(event)

        bus.subscribe("password_changed", handler)

        event = PasswordChangedEvent(user_id=1, change_time="2026-01-29")
        await bus.publish(event)

        assert len(received) == 1
        assert received[0] == event

    @pytest.mark.asyncio
    async def test_multiple_handlers(self):
        """Multiple handlers should all receive the event."""
        bus = EventBus()
        received1 = []
        received2 = []

        async def handler1(event):
            received1.append(event)

        async def handler2(event):
            received2.append(event)

        bus.subscribe("backup_completed", handler1)
        bus.subscribe("backup_completed", handler2)

        event = BackupCompletedEvent(
            user_id=1, filename="test.zip", size_mb=10
        )
        await bus.publish(event)

        assert len(received1) == 1
        assert len(received2) == 1

    @pytest.mark.asyncio
    async def test_handler_error_isolation(self):
        """Handler errors should not affect other handlers."""
        bus = EventBus()
        received = []

        async def failing_handler(event):
            raise ValueError("Handler failed!")

        async def working_handler(event):
            received.append(event)

        bus.subscribe("backup_completed", failing_handler)
        bus.subscribe("backup_completed", working_handler)

        event = BackupCompletedEvent(
            user_id=1, filename="test.zip", size_mb=10
        )
        # Should not raise
        await bus.publish(event)

        # Working handler should still receive event
        assert len(received) == 1

    @pytest.mark.asyncio
    async def test_no_handlers(self):
        """Publishing with no handlers should not raise."""
        bus = EventBus()
        event = PasswordChangedEvent(user_id=1, change_time="2026-01-29")

        # Should not raise
        await bus.publish(event)

    def test_get_event_bus_singleton(self):
        """get_event_bus should return the same instance."""
        bus1 = get_event_bus()
        bus2 = get_event_bus()
        assert bus1 is bus2


class TestEventRegistry:
    """Tests for the EventRegistry."""

    def test_register_and_get(self):
        """Should register and retrieve event metadata."""
        registry = EventRegistry()

        def template_fn(data):
            return ("Title", "Message")

        registry.register(
            event_type="test_event",
            label="Test Event",
            description="A test event",
            category="test",
            template_fn=template_fn,
            is_implemented=True,
        )

        metadata = registry.get("test_event")
        assert metadata is not None
        assert metadata.label == "Test Event"
        assert metadata.description == "A test event"
        assert metadata.category == "test"
        assert metadata.is_implemented is True

    def test_get_nonexistent(self):
        """Should return None for unregistered event."""
        registry = EventRegistry()
        assert registry.get("nonexistent") is None

    def test_all_events(self):
        """Should return all registered events."""
        registry = EventRegistry()

        registry.register("event1", "Event 1", "Desc 1", "cat1")
        registry.register("event2", "Event 2", "Desc 2", "cat2")

        all_events = registry.all()
        assert len(all_events) == 2

    def test_get_template(self):
        """Should generate template from registered function."""
        registry = EventRegistry()

        def my_template(data):
            return (f"Hello {data['name']}", f"Message for {data['name']}")

        registry.register(
            event_type="greeting",
            label="Greeting",
            description="A greeting",
            category="test",
            template_fn=my_template,
        )

        title, message = registry.get_template("greeting", {"name": "World"})
        assert title == "Hello World"
        assert message == "Message for World"

    def test_get_template_fallback(self):
        """Should return fallback for unregistered event."""
        registry = EventRegistry()
        title, message = registry.get_template("unknown", {})

        assert "System Event" in title or "unknown" in title.lower()

    def test_get_event_registry_singleton(self):
        """get_event_registry should return the same instance."""
        reg1 = get_event_registry()
        reg2 = get_event_registry()
        assert reg1 is reg2


class TestSetupEventSystem:
    """Tests for event system initialization."""

    def test_setup_registers_all_events(self):
        """setup_event_system should register all notification events."""
        setup_event_system()
        registry = get_event_registry()

        # Check all expected events are registered
        expected_events = [
            "backup_completed",
            "backup_failed",
            "invitation_received",
            "invitation_accepted",
            "share_revoked",
            "password_changed",
        ]

        for event_type in expected_events:
            metadata = registry.get(event_type)
            assert metadata is not None, f"Event {event_type} not registered"
            assert metadata.is_implemented is True

    def test_setup_returns_event_bus(self):
        """setup_event_system should return the event bus."""
        bus = setup_event_system()
        assert bus is get_event_bus()


class TestIntegration:
    """Integration tests for the complete event flow."""

    @pytest.mark.asyncio
    async def test_full_event_flow(self):
        """Test complete flow: create event -> publish -> handler receives."""
        setup_event_system()
        bus = get_event_bus()
        registry = get_event_registry()

        received_events = []
        received_templates = []

        async def capture_handler(event):
            received_events.append(event)
            # Also test template generation
            data = event.to_notification_data()
            title, message = registry.get_template(event.event_type(), data)
            received_templates.append((title, message))

        # Subscribe to all event types
        for metadata in registry.all():
            bus.subscribe(metadata.event_type, capture_handler)

        # Publish different events
        events = [
            BackupCompletedEvent(
                user_id=1, filename="backup.zip", size_mb=100, backup_type="full"
            ),
            PasswordChangedEvent(user_id=2, change_time="2026-01-29 10:00:00"),
            InvitationReceivedEvent(
                user_id=3, from_user="Alice", invitation_type="patient_share", title="Share"
            ),
        ]

        for event in events:
            await bus.publish(event)

        # Verify all events received
        assert len(received_events) == 3
        assert len(received_templates) == 3

        # Verify templates generated correctly
        titles = [t[0] for t in received_templates]
        assert "Backup Completed" in titles[0]
        assert "Password Changed" in titles[1]
        assert "Invitation" in titles[2]
