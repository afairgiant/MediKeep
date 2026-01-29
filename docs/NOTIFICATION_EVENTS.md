# Notification Event System

This guide explains how to work with MediKeep's event-driven notification system.

## Overview

The notification system uses a **publish-subscribe** pattern:

```
Business Logic  -->  Event Bus  -->  Notification Handler  -->  User Channels
     |                   |                    |
  emit event      routes to handlers     sends to Discord/Email/etc
```

**Key benefits:**
- Business code doesn't know about notifications (decoupled)
- Adding new triggers is simple (3 steps)
- Notification failures don't break business operations

---

## Quick Start: Adding a New Notification Trigger

### Step 1: Create the Event Class

Create or add to a file in `app/events/`:

```python
# app/events/medical_events.py
from dataclasses import dataclass
from typing import Optional
from app.core.events.base import DomainEvent


@dataclass
class AppointmentReminderEvent(DomainEvent):
    """Emitted when an appointment reminder should be sent."""
    patient_name: str
    appointment_time: str
    doctor_name: Optional[str] = None
```

**Rules:**
- Inherit from `DomainEvent`
- Use `@dataclass` decorator
- Add fields for data needed in the notification message
- The class name determines the event type: `AppointmentReminderEvent` → `appointment_reminder`

### Step 2: Create the Template

Add a template function in `app/services/notification_templates.py`:

```python
def appointment_reminder_template(data: Dict) -> Tuple[str, str]:
    """Template for appointment reminder notification."""
    patient = data.get("patient_name", "Patient")
    time = data.get("appointment_time", "")
    doctor = data.get("doctor_name", "your doctor")

    return (
        "Appointment Reminder",  # Title
        f"Reminder: {patient} has an appointment with {doctor} at {time}."  # Message
    )
```

**Rules:**
- Function takes `data: Dict` parameter
- Returns `Tuple[str, str]` (title, message)
- Use `.get()` with defaults for safety

### Step 3: Register the Event

Add registration in `app/core/events/__init__.py`:

```python
from app.services.notification_templates import appointment_reminder_template

def register_all_events():
    registry = get_event_registry()

    # ... existing registrations ...

    # Medical events
    registry.register(
        event_type="appointment_reminder",
        label="Appointment Reminder",
        description="Reminder for upcoming appointments",
        category="medical",
        template_fn=appointment_reminder_template,
        is_implemented=True,
    )
```

**That's it!** The notification handler automatically subscribes to all registered events.

### Step 4: Emit the Event

In your business logic:

```python
from app.core.events import get_event_bus
from app.events.medical_events import AppointmentReminderEvent

async def schedule_appointment(user_id: int, patient_name: str, time: str):
    # ... business logic ...

    # Emit event (notification handler will pick it up)
    event = AppointmentReminderEvent(
        user_id=user_id,  # Required: who receives the notification
        patient_name=patient_name,
        appointment_time=time,
    )
    await get_event_bus().publish(event)
```

---

## Architecture

### File Structure

```
app/
├── core/
│   └── events/
│       ├── __init__.py      # Exports + register_all_events()
│       ├── base.py          # DomainEvent base class
│       ├── bus.py           # EventBus (publish/subscribe)
│       └── registry.py      # EventRegistry (metadata + templates)
│
├── events/                   # Domain event definitions
│   ├── __init__.py          # Exports all events
│   ├── backup_events.py     # BackupCompletedEvent, BackupFailedEvent
│   ├── collaboration_events.py  # Invitation/sharing events
│   └── security_events.py   # PasswordChangedEvent
│
└── services/
    ├── notification_handlers.py   # Subscribes to events
    └── notification_templates.py  # Message templates
```

### Components

#### DomainEvent (base class)
Every event inherits these fields:
- `event_id` - Unique UUID (auto-generated)
- `occurred_at` - Timestamp (auto-generated)
- `user_id` - Who should receive the notification (required for notifications)

```python
@dataclass
class DomainEvent:
    event_id: str          # Auto-generated UUID
    occurred_at: datetime  # Auto-generated timestamp
    user_id: Optional[int] = None  # Set this for notifications
```

#### EventBus
Manages event routing:
```python
bus = get_event_bus()
bus.subscribe("event_type", handler_function)
await bus.publish(event)
```

#### EventRegistry
Single source of truth for event metadata:
```python
registry = get_event_registry()
registry.register(event_type="...", label="...", ...)
metadata = registry.get("event_type")
title, message = registry.get_template("event_type", data)
```

---

## Current Event Types

| Event Type | Category | Description |
|------------|----------|-------------|
| `backup_completed` | system | Backup finished successfully |
| `backup_failed` | system | Backup failed |
| `invitation_received` | collaboration | User received a sharing invitation |
| `invitation_accepted` | collaboration | Someone accepted your invitation |
| `share_revoked` | collaboration | Access to shared records revoked |
| `password_changed` | security | Password was changed |

---

## Event Categories

Events are grouped by category for the UI:

- **system** - Backups, maintenance, system health
- **collaboration** - Sharing, invitations, access changes
- **security** - Password changes, login alerts
- **medical** - Appointments, lab results, reminders

---

## Testing Events

### Unit Test for Event Class
```python
def test_appointment_reminder_event():
    event = AppointmentReminderEvent(
        user_id=1,
        patient_name="John Doe",
        appointment_time="2026-01-30 10:00"
    )

    assert event.event_type() == "appointment_reminder"
    assert event.user_id == 1

    data = event.to_notification_data()
    assert data["patient_name"] == "John Doe"
```

### Unit Test for Template
```python
def test_appointment_reminder_template():
    data = {
        "patient_name": "John Doe",
        "appointment_time": "2026-01-30 10:00",
        "doctor_name": "Dr. Smith"
    }

    title, message = appointment_reminder_template(data)

    assert title == "Appointment Reminder"
    assert "John Doe" in message
    assert "Dr. Smith" in message
```

### Integration Test
```python
import asyncio

async def test_event_flow():
    from app.core.events import setup_event_system, get_event_bus
    from app.events.medical_events import AppointmentReminderEvent

    setup_event_system()
    bus = get_event_bus()

    received = []
    async def test_handler(event):
        received.append(event)

    bus.subscribe("appointment_reminder", test_handler)

    event = AppointmentReminderEvent(user_id=1, patient_name="Test", appointment_time="Now")
    await bus.publish(event)

    assert len(received) == 1
    assert received[0].patient_name == "Test"
```

---

## Troubleshooting

### Event not triggering notifications

1. **Check `user_id` is set** - Events without `user_id` are skipped
2. **Check event is registered** - Run: `registry.get("your_event_type")`
3. **Check `is_implemented=True`** - In registration
4. **Check user has channels configured** - User needs at least one notification channel

### Template not working

1. **Check function signature** - Must be `(data: Dict) -> Tuple[str, str]`
2. **Check data keys** - Use `.get()` with defaults
3. **Test template directly** - `template_fn({"key": "value"})`

### Handler errors

Handler errors are logged but don't break business logic. Check logs for:
```
event_handler_error - notification_handlers.py
```

---

## Best Practices

1. **Keep events immutable** - Use `@dataclass` with only data fields
2. **Use descriptive names** - `PatientRecordUpdatedEvent` not `UpdateEvent`
3. **Include context** - Add fields needed for a meaningful notification
4. **Test templates** - Ensure they handle missing data gracefully
5. **Don't await notifications** - Fire and forget (errors are isolated)

