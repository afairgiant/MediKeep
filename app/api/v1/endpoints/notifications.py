"""
API endpoints for notification management.

This module provides endpoints for:
- Managing notification channels (CRUD)
- Testing channels
- Managing notification preferences
- Viewing notification history
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database.database import get_db
from app.core.events import get_event_registry
from app.core.logging.config import get_logger
from app.core.logging.helpers import (
    log_endpoint_access,
    log_endpoint_error,
)
from app.models.models import User
from app.schemas.notifications import (
    ChannelCreate,
    ChannelResponse,
    ChannelUpdate,
    ChannelWithConfigResponse,
    EventType,
    EventTypeInfo,
    EventTypesResponse,
    HistoryListResponse,
    HistoryResponse,
    PreferenceCreate,
    PreferenceMatrix,
    PreferenceResponse,
    TestNotificationRequest,
    TestNotificationResponse,
)
from app.services.notification_service import NotificationService

logger = get_logger(__name__, "app")
router = APIRouter()


def _build_channels_lookup(service: NotificationService, user_id: int) -> dict:
    """Build a channel ID to channel object lookup dictionary."""
    return {c.id: c for c in service.get_user_channels(user_id)}


# ============================================================================
# Event Types
# ============================================================================


@router.get("/event-types", response_model=EventTypesResponse)
def get_event_types(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Get list of available notification event types from the event registry."""
    log_endpoint_access(
        logger, request, current_user.id, "notification_event_types_accessed"
    )

    # Get all event metadata from the registry
    registry = get_event_registry()
    all_events = registry.all()

    # Convert EventMetadata to EventTypeInfo schema
    event_types = [
        EventTypeInfo(
            value=metadata.event_type,
            label=metadata.label,
            description=metadata.description,
            category=metadata.category,
            is_implemented=metadata.is_implemented,
        )
        for metadata in all_events
    ]

    return EventTypesResponse(event_types=event_types)


# ============================================================================
# Channel Management
# ============================================================================

@router.get("/channels", response_model=List[ChannelResponse])
def list_channels(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all notification channels for the current user."""
    try:
        log_endpoint_access(
            logger, request, current_user.id, "notification_channels_listed"
        )

        service = NotificationService(db)
        channels = service.get_user_channels(current_user.id)

        # Validate each channel's configuration
        response = []
        for channel in channels:
            channel_data = ChannelResponse.model_validate(channel)
            is_valid, error_msg = service.is_channel_config_valid(channel)
            channel_data.config_valid = is_valid
            channel_data.config_error = error_msg if not is_valid else None
            response.append(channel_data)

        return response

    except Exception as e:
        log_endpoint_error(
            logger, request, "Failed to list notification channels", e,
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list notification channels"
        )


@router.post("/channels", response_model=ChannelResponse, status_code=status.HTTP_201_CREATED)
def create_channel(
    request: Request,
    channel_data: ChannelCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new notification channel."""
    try:
        log_endpoint_access(
            logger, request, current_user.id, "notification_channel_created",
            channel_type=channel_data.channel_type.value
        )

        service = NotificationService(db)
        channel = service.create_channel(
            user_id=current_user.id,
            name=channel_data.name,
            channel_type=channel_data.channel_type.value,
            config=channel_data.config,
            is_enabled=channel_data.is_enabled,
        )

        return ChannelResponse.model_validate(channel)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        log_endpoint_error(
            logger, request, "Failed to create notification channel", e,
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create notification channel"
        )


@router.get("/channels/{channel_id}", response_model=ChannelWithConfigResponse)
def get_channel(
    request: Request,
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific notification channel with masked config."""
    try:
        log_endpoint_access(
            logger, request, current_user.id, "notification_channel_accessed",
            channel_id=channel_id
        )

        service = NotificationService(db)
        channel = service.get_channel(current_user.id, channel_id)

        if not channel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Channel not found"
            )

        response = ChannelWithConfigResponse(
            id=channel.id,
            name=channel.name,
            channel_type=channel.channel_type,
            is_enabled=channel.is_enabled,
            is_verified=channel.is_verified,
            last_test_at=channel.last_test_at,
            last_test_status=channel.last_test_status,
            last_used_at=channel.last_used_at,
            total_notifications_sent=channel.total_notifications_sent,
            created_at=channel.created_at,
            updated_at=channel.updated_at,
            config_masked=service.get_masked_config(channel),
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        log_endpoint_error(
            logger, request, "Failed to get notification channel", e,
            user_id=current_user.id, channel_id=channel_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get notification channel"
        )


@router.put("/channels/{channel_id}", response_model=ChannelResponse)
def update_channel(
    request: Request,
    channel_id: int,
    channel_data: ChannelUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a notification channel."""
    try:
        log_endpoint_access(
            logger, request, current_user.id, "notification_channel_updated",
            channel_id=channel_id
        )

        service = NotificationService(db)
        channel = service.update_channel(
            user_id=current_user.id,
            channel_id=channel_id,
            name=channel_data.name,
            config=channel_data.config,
            is_enabled=channel_data.is_enabled,
        )

        if not channel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Channel not found"
            )

        return ChannelResponse.model_validate(channel)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        log_endpoint_error(
            logger, request, "Failed to update notification channel", e,
            user_id=current_user.id, channel_id=channel_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update notification channel"
        )


@router.delete("/channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_channel(
    request: Request,
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a notification channel."""
    try:
        log_endpoint_access(
            logger, request, current_user.id, "notification_channel_deleted",
            channel_id=channel_id
        )

        service = NotificationService(db)
        deleted = service.delete_channel(current_user.id, channel_id)

        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Channel not found"
            )

        return None

    except HTTPException:
        raise
    except Exception as e:
        log_endpoint_error(
            logger, request, "Failed to delete notification channel", e,
            user_id=current_user.id, channel_id=channel_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete notification channel"
        )


@router.post("/channels/{channel_id}/test", response_model=TestNotificationResponse)
async def test_channel(
    request: Request,
    channel_id: int,
    test_data: TestNotificationRequest = TestNotificationRequest(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a test notification to a channel."""
    try:
        log_endpoint_access(
            logger, request, current_user.id, "notification_channel_tested",
            channel_id=channel_id
        )

        service = NotificationService(db)
        channel = service.get_channel(current_user.id, channel_id)

        if not channel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Channel not found"
            )

        # Check if channel config is valid before testing
        is_valid, error_msg = service.is_channel_config_valid(channel)
        if not is_valid:
            return TestNotificationResponse(
                success=False,
                message=error_msg,
                channel_name=channel.name,
                sent_at=None,
            )

        success, message = await service.test_channel(
            user_id=current_user.id,
            channel_id=channel_id,
            message=test_data.message,
        )

        return TestNotificationResponse(
            success=success,
            message=message,
            channel_name=channel.name,
            sent_at=channel.last_test_at if success else None,
        )

    except HTTPException:
        raise
    except Exception as e:
        log_endpoint_error(
            logger, request, "Failed to test notification channel", e,
            user_id=current_user.id, channel_id=channel_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to test notification channel"
        )


# ============================================================================
# Preference Management
# ============================================================================

@router.get("/preferences", response_model=List[PreferenceResponse])
def list_preferences(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all notification preferences for the current user."""
    try:
        log_endpoint_access(
            logger, request, current_user.id, "notification_preferences_listed"
        )

        service = NotificationService(db)
        preferences = service.get_user_preferences(current_user.id)
        channels = _build_channels_lookup(service, current_user.id)

        response = []
        for pref in preferences:
            channel = channels.get(pref.channel_id)
            response.append(PreferenceResponse(
                id=pref.id,
                channel_id=pref.channel_id,
                channel_name=channel.name if channel else "Unknown",
                event_type=pref.event_type,
                is_enabled=pref.is_enabled,
                remind_before_minutes=pref.remind_before_minutes,
                created_at=pref.created_at,
                updated_at=pref.updated_at,
            ))

        return response

    except Exception as e:
        log_endpoint_error(
            logger, request, "Failed to list notification preferences", e,
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list notification preferences"
        )


@router.get("/preferences/matrix", response_model=PreferenceMatrix)
def get_preference_matrix(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the full preference matrix (events x channels)."""
    try:
        log_endpoint_access(
            logger, request, current_user.id, "notification_preference_matrix_accessed"
        )

        service = NotificationService(db)
        channels = service.get_user_channels(current_user.id)
        preferences = service.get_user_preferences(current_user.id)

        # Build preference lookup: event_type -> channel_id -> is_enabled
        pref_lookup = {}
        for pref in preferences:
            pref_lookup.setdefault(pref.event_type, {})[pref.channel_id] = pref.is_enabled

        # Build matrix with defaults (False for unconfigured)
        events = [e.value for e in EventType]
        channel_ids = [c.id for c in channels]
        matrix = {
            event: {cid: pref_lookup.get(event, {}).get(cid, False) for cid in channel_ids}
            for event in events
        }

        return PreferenceMatrix(
            channels=[ChannelResponse.model_validate(c) for c in channels],
            events=events,
            preferences=matrix,
        )

    except Exception as e:
        log_endpoint_error(
            logger, request, "Failed to get preference matrix", e,
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get preference matrix"
        )


@router.post("/preferences", response_model=PreferenceResponse)
def set_preference(
    request: Request,
    pref_data: PreferenceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set or update a notification preference."""
    try:
        log_endpoint_access(
            logger, request, current_user.id, "notification_preference_updated",
            channel_id=pref_data.channel_id,
            event_type=pref_data.event_type.value
        )

        service = NotificationService(db)

        # Get channel for name in response
        channel = service.get_channel(current_user.id, pref_data.channel_id)
        if not channel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Channel not found"
            )

        pref = service.set_preference(
            user_id=current_user.id,
            channel_id=pref_data.channel_id,
            event_type=pref_data.event_type.value,
            is_enabled=pref_data.is_enabled,
            remind_before_minutes=pref_data.remind_before_minutes,
        )

        return PreferenceResponse(
            id=pref.id,
            channel_id=pref.channel_id,
            channel_name=channel.name,
            event_type=pref.event_type,
            is_enabled=pref.is_enabled,
            remind_before_minutes=pref.remind_before_minutes,
            created_at=pref.created_at,
            updated_at=pref.updated_at,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        log_endpoint_error(
            logger, request, "Failed to set notification preference", e,
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set notification preference"
        )


# ============================================================================
# History
# ============================================================================

@router.get("/history", response_model=HistoryListResponse)
def get_history(
    request: Request,
    page: int = 1,
    page_size: int = 20,
    status_filter: Optional[str] = None,
    event_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get notification history for the current user."""
    try:
        log_endpoint_access(
            logger, request, current_user.id, "notification_history_accessed",
            page=page, page_size=page_size
        )

        # Validate page_size
        if page_size < 1 or page_size > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="page_size must be between 1 and 100"
            )

        service = NotificationService(db)
        items, total = service.get_notification_history(
            user_id=current_user.id,
            page=page,
            page_size=page_size,
            status=status_filter,
            event_type=event_type,
        )

        channels = _build_channels_lookup(service, current_user.id)

        history_items = []
        for item in items:
            channel = channels.get(item.channel_id) if item.channel_id else None
            history_items.append(HistoryResponse(
                id=item.id,
                event_type=item.event_type,
                title=item.title,
                message_preview=item.message_preview,
                channel_name=channel.name if channel else None,
                channel_type=channel.channel_type if channel else None,
                status=item.status,
                attempt_count=item.attempt_count,
                error_message=item.error_message,
                created_at=item.created_at,
                sent_at=item.sent_at,
            ))

        return HistoryListResponse(
            items=history_items,
            total=total,
            page=page,
            page_size=page_size,
        )

    except HTTPException:
        raise
    except Exception as e:
        log_endpoint_error(
            logger, request, "Failed to get notification history", e,
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get notification history"
        )
