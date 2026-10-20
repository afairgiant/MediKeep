"""
Admin settings API: read and change the runtime-persisted admin settings.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user, get_db
from app.core.auth_mode import sealed_instance_warning
from app.core.config import settings
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.logging.helpers import log_endpoint_error, log_security_event
from app.core.persisted_settings import (
    KEY_ALLOW_USER_REGISTRATION,
    SettingValidationError,
    apply_setting_changes,
    describe_settings,
)
from app.models.models import User
from app.schemas.admin_settings import (
    AdminSettingsResponse,
    AdminSettingsUpdate,
    AdminSettingsUpdateResponse,
    DeploymentValue,
    SettingWarning,
)

logger = get_logger(__name__, "app")

router = APIRouter()

# A fixed list, so enumerating the environment can never expose a secret.
DEPLOYMENT_SETTINGS = (
    "SSO_ONLY_MODE",
    "SSO_AUTO_REDIRECT",
    "ALLOW_PRIVATE_INTEGRATION_URLS",
    "LOG_LEVEL",
)


def _deployment_values() -> list[DeploymentValue]:
    return [
        DeploymentValue(name=name, value=getattr(settings, name))
        for name in DEPLOYMENT_SETTINGS
    ]


@router.get(
    "",
    response_model=AdminSettingsResponse,
    dependencies=[Depends(get_current_admin_user)],
)
async def get_admin_settings(db: Session = Depends(get_db)) -> AdminSettingsResponse:
    """Every admin-editable setting with its source, plus read-only deployment values."""
    return AdminSettingsResponse(
        settings=describe_settings(db), deployment=_deployment_values()
    )


@router.patch("", response_model=AdminSettingsUpdateResponse)
async def update_admin_settings(
    update: AdminSettingsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
) -> AdminSettingsUpdateResponse:
    """Apply changed settings atomically; a null value resets that setting."""
    try:
        updated = apply_setting_changes(db, update.changes)
    except SettingValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    except Exception as exc:
        log_endpoint_error(
            logger, request, "Failed to update settings", exc, user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update settings",
        ) from exc

    warnings: list[SettingWarning] = []
    if KEY_ALLOW_USER_REGISTRATION in updated:
        log_security_event(
            logger,
            "user_registration_toggled",
            request,
            f"User registration {'enabled' if settings.ALLOW_USER_REGISTRATION else 'disabled'}",
            user_id=current_user.id,
            username=current_user.username,
            registration_enabled=settings.ALLOW_USER_REGISTRATION,
        )
        # Warn, never refuse: the boot-time check cannot see a runtime toggle.
        sealed = sealed_instance_warning(
            settings.SSO_ONLY_MODE, settings.ALLOW_USER_REGISTRATION
        )
        if sealed:
            event, message = sealed
            logger.warning(
                message, extra={LogFields.CATEGORY: "app", LogFields.EVENT: event}
            )
            warnings.append(SettingWarning(code=event, message=message))

    log_security_event(
        logger,
        "settings_updated",
        request,
        "Admin settings updated",
        user_id=current_user.id,
        username=current_user.username,
        updated_settings=",".join(updated),
    )

    return AdminSettingsUpdateResponse(
        settings=describe_settings(db), updated=updated, warnings=warnings
    )
