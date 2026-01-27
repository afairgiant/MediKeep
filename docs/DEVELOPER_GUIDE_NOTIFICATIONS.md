# Notification System - Developer Guide

This guide explains how to use and extend the MediKeep notification system.

## Architecture Overview

```
+------------------------------------------+
|           Your Service Code              |
|   await notify(db, user_id, event, data) |
+---------------------+--------------------+
                      |
                      v
+------------------------------------------+
|         NotificationService              |
|  - Looks up user's preferences           |
|  - Gets enabled channels for event       |
|  - Renders message template              |
|  - Sends to each channel via Apprise     |
+---------------------+--------------------+
                      |
                      v
+------------------------------------------+
|           Apprise Library                |
|  - Converts channel config to URL        |
|  - Handles Discord, Email, Gotify, etc.  |
|  - Supports 80+ notification services    |
+------------------------------------------+
```

## Quick Start: Sending Notifications

The simplest way to send a notification is using the `notify()` helper:

```python
from app.services.notification_service import notify

# Send a notification
await notify(
    db=self.db,
    user_id=user.id,
    event_type="backup_completed",
    data={
        "filename": backup.filename,
        "size_mb": 15.2
    }
)
```

This will:
1. Find all channels the user has enabled for `backup_completed`
2. Render the message using the template for that event
3. Send notifications to each enabled channel
4. Record the results in notification history

## Adding a New Event Type

### Step 1: Add to EventType enum

```python
# app/schemas/notifications.py
class EventType(str, Enum):
    # Existing events...
    BACKUP_COMPLETED = "backup_completed"
    BACKUP_FAILED = "backup_failed"

    # Add your new event:
    PRESCRIPTION_EXPIRING = "prescription_expiring"
```

### Step 2: Add message template

```python
# app/services/notification_templates.py
class NotificationTemplates:
    def __init__(self):
        self._templates = {
            # Existing templates...
            "backup_completed": self._backup_completed,

            # Add your new template:
            "prescription_expiring": self._prescription_expiring,
        }

    def _prescription_expiring(self, data: dict) -> tuple[str, str]:
        """Return (title, message) for prescription expiring event."""
        return (
            "Prescription Expiring Soon",
            f"Your {data.get('medication_name', 'medication')} prescription "
            f"expires on {data.get('expiry_date', 'soon')}. "
            f"Consider scheduling a refill appointment."
        )
```

### Step 3: Trigger from your service

```python
# In your service file
from app.services.notification_service import notify

class PrescriptionService:
    async def check_expiring_prescriptions(self):
        expiring = self._get_expiring_prescriptions()

        for prescription in expiring:
            await notify(
                db=self.db,
                user_id=prescription.patient.user_id,
                event_type="prescription_expiring",
                data={
                    "medication_name": prescription.medication_name,
                    "expiry_date": prescription.expiry_date.strftime("%Y-%m-%d"),
                    "prescription_id": prescription.id
                }
            )
```

### Step 4: Add frontend translation

```json
// frontend/public/locales/en/notifications.json
{
  "events": {
    "prescription_expiring": {
      "name": "Prescription Expiring",
      "description": "When a prescription is about to expire"
    }
  }
}
```

**That's it!** Users can now enable/disable this event for their notification channels.

## Adding a New Notification Channel

Apprise supports 80+ notification services. To add one to MediKeep:

### Step 1: Add to ChannelType enum

```python
# app/schemas/notifications.py
class ChannelType(str, Enum):
    DISCORD = "discord"
    EMAIL = "email"
    GOTIFY = "gotify"
    WEBHOOK = "webhook"
    # Add new:
    TELEGRAM = "telegram"
```

### Step 2: Add config schema

```python
# app/schemas/notifications.py
class TelegramChannelConfig(BaseModel):
    """Configuration for Telegram notifications."""
    bot_token: str = Field(
        ...,
        description="Telegram bot token from @BotFather"
    )
    chat_id: str = Field(
        ...,
        description="Chat ID (user, group, or channel)"
    )

    @field_validator("bot_token")
    @classmethod
    def validate_token(cls, v):
        if ":" not in v:
            raise ValueError("Invalid bot token format")
        return v
```

### Step 3: Add URL builder

```python
# app/services/notification_service.py

def _build_telegram_url(config: dict) -> str:
    """
    Build Apprise URL for Telegram.
    See: https://github.com/caronc/apprise/wiki/Notify_telegram
    """
    return f"tgram://{config['bot_token']}/{config['chat_id']}"

# Register in the builders dictionary
CHANNEL_BUILDERS = {
    ChannelType.DISCORD.value: _build_discord_url,
    ChannelType.EMAIL.value: _build_email_url,
    ChannelType.GOTIFY.value: _build_gotify_url,
    ChannelType.WEBHOOK.value: _build_webhook_url,
    # Add new:
    ChannelType.TELEGRAM.value: _build_telegram_url,
}
```

### Step 4: Add frontend form fields

```jsx
// frontend/src/components/settings/ChannelFormModal.jsx

// In the form JSX:
{channelType === 'telegram' && (
    <>
        <TextInput
            label={t('channels.telegram.botToken.label')}
            placeholder={t('channels.telegram.botToken.placeholder')}
            value={formData.config?.bot_token || ''}
            onChange={(e) => handleConfigChange('bot_token', e.target.value)}
            required
        />
        <TextInput
            label={t('channels.telegram.chatId.label')}
            placeholder={t('channels.telegram.chatId.placeholder')}
            value={formData.config?.chat_id || ''}
            onChange={(e) => handleConfigChange('chat_id', e.target.value)}
            required
        />
    </>
)}
```

### Step 5: Add translations

```json
// frontend/public/locales/en/notifications.json
{
  "channels": {
    "types": {
      "telegram": "Telegram"
    },
    "telegram": {
      "botToken": {
        "label": "Bot Token",
        "placeholder": "123456:ABC-DEF1234...",
        "description": "Token from @BotFather"
      },
      "chatId": {
        "label": "Chat ID",
        "placeholder": "@channelname or 123456789",
        "description": "Target chat, group, or channel"
      }
    }
  }
}
```

## Database Schema

### NotificationChannel

Stores user's notification channels with encrypted configuration.

```python
class NotificationChannel(Base):
    __tablename__ = "notification_channels"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String(100))           # User-friendly name
    channel_type = Column(String(20))    # discord/email/gotify/webhook
    config_encrypted = Column(Text)      # Encrypted JSON config
    is_enabled = Column(Boolean)
    is_verified = Column(Boolean)        # Set after successful test
    last_test_at = Column(DateTime)
    total_notifications_sent = Column(Integer)
```

### NotificationPreference

Links event types to channels (many-to-many).

```python
class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    channel_id = Column(Integer, ForeignKey("notification_channels.id"))
    event_type = Column(String(50))      # String, not FK - no migrations needed
    is_enabled = Column(Boolean)
```

### NotificationHistory

Audit trail of sent notifications.

```python
class NotificationHistory(Base):
    __tablename__ = "notification_history"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    channel_id = Column(Integer, ForeignKey("notification_channels.id"))
    event_type = Column(String(50))
    title = Column(String(255))
    message_preview = Column(String(500))
    status = Column(String(20))          # pending/sent/failed
    error_message = Column(Text)
    sent_at = Column(DateTime)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/notifications/channels` | List user's channels |
| POST | `/api/v1/notifications/channels` | Create channel |
| GET | `/api/v1/notifications/channels/{id}` | Get channel details |
| PUT | `/api/v1/notifications/channels/{id}` | Update channel |
| DELETE | `/api/v1/notifications/channels/{id}` | Delete channel |
| POST | `/api/v1/notifications/channels/{id}/test` | Send test notification |
| GET | `/api/v1/notifications/preferences` | Get preference matrix |
| POST | `/api/v1/notifications/preferences` | Set a preference |
| GET | `/api/v1/notifications/history` | Get notification history |
| GET | `/api/v1/notifications/event-types` | List available events |

## Apprise URL Reference

Common services and their URL formats:

| Service | URL Format | Documentation |
|---------|------------|---------------|
| Discord | `discord://webhook_id/webhook_token` | [Wiki](https://github.com/caronc/apprise/wiki/Notify_discord) |
| Email | `mailtos://user:pass@smtp:port` | [Wiki](https://github.com/caronc/apprise/wiki/Notify_email) |
| Gotify | `gotify://host/token` | [Wiki](https://github.com/caronc/apprise/wiki/Notify_gotify) |
| Telegram | `tgram://bot_token/chat_id` | [Wiki](https://github.com/caronc/apprise/wiki/Notify_telegram) |
| Slack | `slack://token/#channel` | [Wiki](https://github.com/caronc/apprise/wiki/Notify_slack) |
| Pushover | `pover://user@token` | [Wiki](https://github.com/caronc/apprise/wiki/Notify_pushover) |
| ntfy | `ntfy://topic` | [Wiki](https://github.com/caronc/apprise/wiki/Notify_ntfy) |
| Matrix | `matrix://user:pass@host/#room` | [Wiki](https://github.com/caronc/apprise/wiki/Notify_matrix) |
| Signal | `signal://host/phone` | [Wiki](https://github.com/caronc/apprise/wiki/Notify_signal) |

Full list: https://github.com/caronc/apprise/wiki

## Testing

### Unit test for new event

```python
# tests/services/test_notification_service.py
import pytest
from app.services.notification_templates import NotificationTemplates

def test_prescription_expiring_template():
    templates = NotificationTemplates()

    title, message = templates.get_template("prescription_expiring", {
        "medication_name": "Lisinopril",
        "expiry_date": "2026-02-15"
    })

    assert title == "Prescription Expiring Soon"
    assert "Lisinopril" in message
    assert "2026-02-15" in message
```

### Integration test for API

```python
# tests/api/test_notifications.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_channel(client: AsyncClient, auth_headers):
    response = await client.post(
        "/api/v1/notifications/channels",
        headers=auth_headers,
        json={
            "name": "Test Discord",
            "channel_type": "discord",
            "config": {
                "webhook_url": "https://discord.com/api/webhooks/123/abc"
            }
        }
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Discord"
    assert data["channel_type"] == "discord"
```

### Manual testing

```python
# In Python REPL or test script
from app.services.notification_service import notify
from app.core.database.database import SessionLocal

db = SessionLocal()
await notify(
    db=db,
    user_id=1,
    event_type="backup_completed",
    data={"filename": "test.zip", "size_mb": 10.5}
)
```

## Best Practices

### 1. Fail Silently

Notification errors should never break core operations:

```python
async def create_backup(self):
    try:
        backup = await self._perform_backup()

        # Notification is optional - don't let it break backup
        try:
            await notify(self.db, user_id, "backup_completed", {...})
        except Exception as e:
            logger.warning(f"Notification failed: {e}")

        return backup
    except Exception as e:
        # Even if notification fails, handle backup error properly
        try:
            await notify(self.db, user_id, "backup_failed", {"error": str(e)})
        except:
            pass
        raise
```

### 2. Include Context in Data

Pass relevant IDs for debugging:

```python
await notify(db, user_id, "lab_result_abnormal", {
    "lab_result_id": result.id,       # For debugging
    "test_name": result.test_name,
    "value": result.value,
    "reference_range": result.reference_range,
    "patient_id": patient.id          # For context
})
```

### 3. Sanitize Message Previews

Don't include PHI in the `message_preview` stored in history:

```python
def _lab_result_abnormal(self, data: dict) -> tuple[str, str]:
    title = "Abnormal Lab Result"

    # Full message includes details
    message = f"Test: {data['test_name']}\nValue: {data['value']}"

    # Preview in history is sanitized
    # The service automatically truncates message_preview

    return title, message
```

### 4. Respect Rate Limits

The system has built-in rate limiting per user:

```python
# In app/core/config.py
NOTIFICATION_RATE_LIMIT_PER_HOUR = 100  # Per user
```

### 5. Use Appropriate Events

Choose the right granularity for events:
- Too broad: "data_changed" (what changed?)
- Too narrow: "medication_dose_updated" (noise)
- Just right: "medication_created", "lab_result_abnormal"

## Configuration

Environment variables for notification settings:

```bash
# Enable/disable notifications globally
NOTIFICATIONS_ENABLED=True

# Rate limit per user per hour
NOTIFICATION_RATE_LIMIT_PER_HOUR=100

# How long to keep notification history
NOTIFICATION_HISTORY_RETENTION_DAYS=90

# Salt for encrypting channel configs (change in production!)
NOTIFICATION_ENCRYPTION_SALT=your_secure_salt_here
```

## Security Considerations

1. **Channel configs are encrypted** using Fernet symmetric encryption
2. **Configs are masked** when returned via API (passwords show as `***`)
3. **Rate limiting** prevents notification spam
4. **User ownership** is verified for all channel operations
5. **Test notifications** reveal if credentials are valid, so they're logged

## Troubleshooting

### Notifications not sending

1. Check channel is enabled
2. Check preference for event+channel is enabled
3. Check notification history for error messages
4. Verify channel credentials with test

### Apprise errors

1. Check URL format matches Apprise documentation
2. Verify credentials are correct
3. Test connectivity to external service

### Performance issues

1. Notifications are sent asynchronously
2. Multiple channels are sent in parallel
3. Check if external services are slow/unavailable
