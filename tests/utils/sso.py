"""Shared helpers for SSO tests."""

from datetime import datetime, timedelta

from app.services.sso_service import _STATE_TTL, _state_storage


def store_github_link_token(
    token: str,
    *,
    sub: str,
    name: str = "GitHub Linker",
    age: timedelta = timedelta(0),
) -> str:
    """Seed the state store with a pending GitHub manual-link token.

    Writes the entry ``_return_github_manual_linking`` would have written, so a
    test can drive ``resolve_github_manual_link`` without standing up the whole
    callback. Pass ``age`` to backdate it past ``_STATE_TTL`` and exercise expiry.

    Returns the state-store key, for tests asserting on consumption.
    """
    created_at = datetime.utcnow() - age
    key = f"github_manual_link_{token}"
    _state_storage[key] = {
        "created_at": created_at,
        "sso_user_info": {"sub": sub, "email": None, "name": name},
        "expires_at": created_at + _STATE_TTL,
    }
    return key
