"""What administrators see and change about users' sign-in security."""

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.mfa import UserBackupCode, UserTotp
from app.models.models import User
from app.services.login_throttle import login_throttle
from app.services import two_factor_service


def security_summary(db: Session) -> dict[int, dict]:
    """Two-factor state and lockout per user id, for users with either; others are omitted."""
    enabled = {
        user_id
        for (user_id,) in db.query(UserTotp.user_id).filter(
            UserTotp.enabled_at.isnot(None)
        )
    }
    codes_left = dict(
        db.query(UserBackupCode.user_id, func.count(UserBackupCode.id))
        .filter(
            UserBackupCode.user_id.in_(enabled),
            UserBackupCode.used_at.is_(None),
        )
        .group_by(UserBackupCode.user_id)
        .all()
    )

    locked = two_factor_service.locked_user_ids()
    usernames = login_throttle.locked_usernames()
    if usernames:
        locked |= {
            user_id
            for (user_id,) in db.query(User.id).filter(
                func.lower(User.username).in_(usernames)
            )
        }

    return {
        user_id: {
            "totp_enabled": user_id in enabled,
            "backup_codes_remaining": codes_left.get(user_id, 0),
            "sign_in_locked": user_id in locked,
        }
        for user_id in enabled | locked
    }


def clear_sign_in_lockouts(user: User) -> None:
    """Forget the user's failed password and code checks.

    Password failures are cleared for every address the user's name was tried from.
    """
    login_throttle.clear_username(user.username)
    two_factor_service.clear_user_limits(user.id)
