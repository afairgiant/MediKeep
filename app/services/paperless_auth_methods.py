"""Registry of the ways a user can authenticate to Paperless-ngx.

The method a user chose is stored in ``user_preferences.paperless_auth_method``
and decides which saved credentials are handed to the service factory. Adding a
method (for example SSO) means adding one entry to ``AUTH_METHODS`` and teaching
the service factory to build it; callers do not branch on method names.

A NULL or unrecognised stored value means the user never chose: the first
method in registry order that has saved credentials is used, which is the
behaviour from before the choice could be stored.
"""

from dataclasses import dataclass
from typing import Any, Dict, Mapping, Optional


@dataclass(frozen=True)
class PaperlessAuthMethod:
    """One authentication method and the saved credentials it needs.

    ``credential_columns`` maps each ``create_paperless_service`` keyword to the
    ``user_preferences`` column holding that encrypted value. A method has
    credentials only when every one of its columns is set.
    """

    id: str
    credential_columns: Mapping[str, str]


# Registry order is the fallback priority when the user has not chosen a method.
# The strings below are column names, not secrets (bandit B105 false positives).
AUTH_METHODS: Dict[str, PaperlessAuthMethod] = {
    method.id: method
    for method in (
        PaperlessAuthMethod(
            id="token",
            credential_columns={
                "encrypted_token": "paperless_api_token_encrypted"  # nosec B105
            },
        ),
        PaperlessAuthMethod(
            id="basic_auth",
            credential_columns={
                "encrypted_username": "paperless_username_encrypted",
                "encrypted_password": "paperless_password_encrypted",  # nosec B105
            },
        ),
    )
}

DEFAULT_AUTH_METHOD = "token"


def is_valid_auth_method(method: Any) -> bool:
    """True when ``method`` is the id of a registered authentication method."""
    return isinstance(method, str) and method in AUTH_METHODS


def has_credentials(user_prefs, method: str) -> bool:
    """True when every saved credential ``method`` needs is present."""
    spec = AUTH_METHODS.get(method)
    if spec is None:
        return False
    return all(
        getattr(user_prefs, column, None) for column in spec.credential_columns.values()
    )


def resolve_auth_method(user_prefs) -> str:
    """The method in effect for these preferences.

    The stored choice wins, even if it has no saved credentials yet, so a
    deselected method is never used silently. Without a valid stored choice,
    the first registered method with saved credentials is used, else the default.
    """
    stored = getattr(user_prefs, "paperless_auth_method", None)
    if is_valid_auth_method(stored):
        return stored
    for method_id in AUTH_METHODS:
        if has_credentials(user_prefs, method_id):
            return method_id
    return DEFAULT_AUTH_METHOD


def credential_kwargs(
    user_prefs, method: Optional[str] = None
) -> Dict[str, Optional[str]]:
    """Encrypted credentials for ``create_paperless_service``, for one method only.

    Credentials belonging to other methods are left out so a saved but
    deselected credential cannot take priority in the service factory.
    """
    method_id = (
        method if is_valid_auth_method(method) else resolve_auth_method(user_prefs)
    )
    spec = AUTH_METHODS[method_id]
    return {
        keyword: getattr(user_prefs, column, None)
        for keyword, column in spec.credential_columns.items()
    }


def has_usable_credentials(user_prefs, method: Optional[str] = None) -> bool:
    """True when the method in effect (or ``method``) has saved credentials."""
    method_id = (
        method if is_valid_auth_method(method) else resolve_auth_method(user_prefs)
    )
    return has_credentials(user_prefs, method_id)


def will_have_credentials(
    user_prefs, method: str, pending_columns: Mapping[str, Any]
) -> bool:
    """Whether ``method`` has every credential after applying ``pending_columns``.

    ``pending_columns`` holds new encrypted values keyed by column; an empty
    value does not replace a saved one, matching how settings are saved.
    """
    spec = AUTH_METHODS.get(method)
    if spec is None:
        return False
    return all(
        pending_columns.get(column) or getattr(user_prefs, column, None)
        for column in spec.credential_columns.values()
    )
