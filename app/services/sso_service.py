import heapq
import secrets
from datetime import datetime, timedelta
from typing import Dict, Optional

import httpx
from sqlalchemy.orm import Session

from app.auth.sso.exceptions import *
from app.auth.sso.providers import create_sso_provider
from app.core.config import settings
from app.core.logging.config import get_logger
from app.crud.user import user as user_crud

logger = get_logger(__name__, "sso")

# Lifetime of every entry in _state_storage. Shared by the CSRF state tokens, the
# account-conflict tokens, and the GitHub manual-link tokens so the sweep and the
# three expiry checks cannot drift apart.
_STATE_TTL = timedelta(minutes=10)

# Defensive ceiling on the state store. Sweep-on-write bounds the store to what is
# minted inside one TTL window, which the per-IP rate limit on /auth/sso/initiate
# caps per source - but a distributed source can still grow it linearly. Roughly
# 1 MB of entries: far above any legitimate self-hosted load, far below anything
# that threatens the process.
_STATE_STORE_MAX_ENTRIES = 10000

# In-memory state storage for temporary SSO tokens.
#
# This dict is per-process, so it requires the server to run with a single worker:
# a callback handled by a different worker than the one that minted the state would
# fail validation. docker/entrypoint.sh pins --workers 1 on every startup path
# (lines 180, 187, 191). Anyone raising the worker count must move this store to
# shared storage (database or Redis) first, or SSO will fail intermittently.
#
# Three unrelated flows share this dict, keyed as:
#   <state>                        - CSRF state for the authorization redirect
#   sso_conflict_<token>           - pending account-conflict resolution
#   github_manual_link_<token>     - pending GitHub manual account link
# Write through _store_state_entry, which stamps the timestamps every entry must
# carry and keeps the store swept and bounded on every write path.
_state_storage = {}


def _sweep_expired_states() -> int:
    """Drop expired entries of every kind. Returns the number reclaimed."""
    now = datetime.utcnow()
    # Build the key list before deleting - mutating a dict during iteration raises.
    expired = [
        key for key, value in _state_storage.items() if value["expires_at"] <= now
    ]
    for key in expired:
        del _state_storage[key]

    if expired:
        # debug, not info: under SSO_AUTO_REDIRECT this runs on every unauthenticated
        # page load.
        logger.debug(
            f"Swept {len(expired)} expired SSO state entries",
            extra={
                "category": "sso",
                "event": "sso_state_store_swept",
                "reclaimed": len(expired),
                "remaining": len(_state_storage),
            },
        )
    return len(expired)


def _enforce_state_store_cap() -> int:
    """Evict oldest entries until the store fits under the cap. Returns evictions.

    Only reached if a sweep left the store above the ceiling, which means either an
    attack or a wildly misconfigured deployment. Eviction is safe: an evicted entry
    fails its callback with the same "invalid or expired" error as a natural expiry,
    so a legitimate caught-in-the-crossfire user just retries.
    """
    overflow = len(_state_storage) - _STATE_STORE_MAX_ENTRIES
    if overflow <= 0:
        return 0

    # nsmallest, not a full sort: the cap runs on every write, so overflow is 1 in
    # practice and sorting all 10,000 entries to find one minimum would make the
    # defense cost more than the memory it protects.
    oldest = heapq.nsmallest(
        overflow, _state_storage.items(), key=lambda item: item[1]["created_at"]
    )
    for key, _ in oldest:
        del _state_storage[key]

    logger.warning(
        "SSO state store exceeded capacity - evicted oldest entries",
        extra={
            "category": "security",
            "event": "sso_state_store_capacity_exceeded",
            "evicted": overflow,
            "capacity": _STATE_STORE_MAX_ENTRIES,
        },
    )
    return overflow


def _serialize_user_info(user_info) -> Dict:
    """Reduce a provider user-info object to a plain dict for storage."""
    if hasattr(user_info, "model_dump"):
        return user_info.model_dump()
    if hasattr(user_info, "__dict__"):
        return user_info.__dict__
    return user_info


def _store_state_entry(key: str, payload: Dict) -> None:
    """Stamp and store a state entry, keeping the store swept and under its cap.

    The single write path for all three token kinds. Sweeping here means conflict and
    github-link entries are reclaimed by any subsequent SSO activity rather than by
    an action of their own - so a wholly idle instance retains them until the next
    sign-in attempt. The cap is enforced after the insert, so the store never exceeds
    the ceiling; the entry just written is the newest, so oldest-first eviction never
    discards it.
    """
    _sweep_expired_states()

    now = datetime.utcnow()
    _state_storage[key] = {
        **payload,
        "created_at": now,
        "expires_at": now + _STATE_TTL,
    }

    _enforce_state_store_cap()


class SSOService:
    """Simple SSO service - clean and maintainable.

    Construction has no side effects, deliberately. This class is instantiated at
    module import (endpoints/sso.py), and the config validation that used to live in
    __init__ therefore surfaced an invalid SSO config as an import traceback, before
    the lifespan hook existed to report it properly. startup_event() ->
    settings.validate_auth_mode_config() is the single authority now, and it still
    fails the boot whenever SSO_ENABLED is true and the provider config is
    incomplete.
    """

    async def get_authorization_url(
        self, return_url: Optional[str] = None
    ) -> Dict[str, str]:
        """Generate OAuth authorization URL"""
        if not settings.SSO_ENABLED:
            raise SSOConfigurationError("SSO is not enabled")

        # Generate CSRF state token
        state = secrets.token_urlsafe(32)

        # Build the authorization URL before storing anything. A state entry has no
        # value until the user is actually sent to the IdP, and storing it first would
        # orphan an entry on every misconfigured-provider attempt - nothing would ever
        # consume or delete it.
        try:
            provider = create_sso_provider()
            auth_url = provider.get_auth_url(state)
        except Exception as e:
            logger.error(f"Failed to generate SSO auth URL: {str(e)}")
            raise SSOAuthenticationError("Failed to start SSO authentication")

        _store_state_entry(state, {"return_url": return_url})

        logger.info(
            f"SSO authorization initiated for provider: {settings.SSO_PROVIDER_TYPE}",
            extra={"category": "sso", "event": "auth_initiated"},
        )

        return {
            "auth_url": auth_url,
            "state": state,
            "provider": settings.SSO_PROVIDER_TYPE,
        }

    async def complete_authentication(self, code: str, state: str, db: Session) -> Dict:
        """Complete SSO authentication - no retry for OAuth codes (they're single-use)"""
        # Validate state and consume it (single-use)
        state_data = self._validate_and_consume_state(state)

        try:
            provider = create_sso_provider()
        except Exception as e:
            logger.error(
                "Failed to create SSO provider",
                extra={
                    "category": "sso",
                    "event": "provider_creation_failed",
                    "error": str(e),
                },
            )
            raise SSOAuthenticationError("SSO provider configuration error")

        # Exchange code for token (OAuth codes are single-use, no retry!)
        try:
            token_data = await provider.exchange_code_for_token(code)
        except Exception as e:
            error_detail = self._extract_oauth_error(e)
            logger.error(
                f"SSO token exchange failed: {error_detail}",
                extra={
                    "category": "sso",
                    "event": "token_exchange_failed",
                    "error": error_detail,
                },
            )
            raise SSOAuthenticationError(f"Token exchange failed: {error_detail}")

        # Get user information from provider
        try:
            user_info = await provider.get_user_info(token_data["access_token"])
        except Exception as e:
            logger.error(
                f"Failed to retrieve user info from SSO provider: {str(e)}",
                extra={"category": "sso", "event": "user_info_failed", "error": str(e)},
            )
            raise SSOAuthenticationError(
                "Failed to retrieve user info from SSO provider"
            )

        # Validate email domain if configured
        if not self._validate_email_domain(user_info.email):
            raise SSOAuthenticationError(
                f"Email domain not allowed: {user_info.email.split('@')[1]}"
            )

        # Find or create user
        try:
            result = self._find_or_create_user(user_info, db)
        except (SSOAuthenticationError, SSORegistrationBlockedError):
            raise
        except Exception as e:
            logger.error(
                f"Failed to find or create SSO user: {str(e)}",
                extra={
                    "category": "sso",
                    "event": "user_creation_failed",
                    "error": str(e),
                },
            )
            raise SSOAuthenticationError("Failed to create or link user account")

        # Log success (handle both regular and conflict responses)
        if result.get("conflict"):
            logger.info(
                f"SSO authentication detected conflict for {user_info.email}",
                extra={"category": "sso", "event": "auth_conflict"},
            )
        else:
            logger.info(
                f"SSO authentication successful for {user_info.email}",
                extra={
                    "category": "sso",
                    "event": "auth_success",
                    "is_new_user": result["is_new_user"],
                },
            )

        # Carry the deep link the flow started from back to the caller. Ships inert -
        # no frontend reads it yet (deep links currently survive via sessionStorage,
        # which fails in private browsing).
        result["return_url"] = state_data.get("return_url")

        return result

    def _validate_and_consume_state(self, state: str) -> Dict:
        """Validate and consume CSRF state token (single-use).

        Returns the consumed entry so callers can read the ``return_url`` that
        ``/auth/sso/initiate`` was given.
        """
        if state not in _state_storage:
            raise SSOAuthenticationError("Invalid or expired state parameter")

        state_data = _state_storage[state]
        if datetime.utcnow() > state_data["expires_at"]:
            del _state_storage[state]
            raise SSOAuthenticationError("State parameter expired")

        del _state_storage[state]
        return state_data

    @staticmethod
    def _extract_oauth_error(exc: Exception) -> str:
        """Extract a meaningful error message from an OAuth-related exception."""
        if isinstance(exc, httpx.HTTPStatusError):
            try:
                body = exc.response.json()
                error = body.get("error", "")
                description = body.get("error_description", "")
                if error and description:
                    return f"{error} - {description}"
                if error:
                    return error
            except (ValueError, KeyError):
                pass
            return f"HTTP {exc.response.status_code} from provider"

        if isinstance(exc, httpx.TimeoutException):
            return "SSO provider request timed out"

        if isinstance(exc, httpx.ConnectError):
            return "Could not connect to SSO provider"

        # For ValueError (raised by GitHub provider with parsed error)
        if isinstance(exc, ValueError):
            return str(exc)

        return str(exc)

    def _validate_email_domain(self, email: str) -> bool:
        """Check if email domain is allowed"""
        if not settings.SSO_ALLOWED_DOMAINS:
            return True  # No restrictions

        domain = email.split("@")[1].lower()
        allowed_domains = [d.lower() for d in settings.SSO_ALLOWED_DOMAINS]
        return domain in allowed_domains

    def _validate_sso_linking(self, existing_user, _sso_user_info) -> bool:
        """Detect corrupted SSO linking data"""

        # Check for partial corruption - has external_id but missing sso_provider
        if existing_user.external_id and not existing_user.sso_provider:
            logger.warning(
                f"Corrupted SSO data for user {existing_user.id}: has external_id but no sso_provider",
                extra={
                    "category": "sso_corruption",
                    "user_id": existing_user.id,
                    "corruption_type": "missing_provider",
                },
            )
            return False

        # Check for provider mismatch
        if (
            existing_user.sso_provider
            and existing_user.sso_provider != settings.SSO_PROVIDER_TYPE
        ):
            logger.warning(
                f"Provider mismatch for user {existing_user.id}: expected {settings.SSO_PROVIDER_TYPE}, got {existing_user.sso_provider}",
                extra={
                    "category": "sso_corruption",
                    "user_id": existing_user.id,
                    "corruption_type": "provider_mismatch",
                },
            )
            return False

        # Check for auth_method inconsistency
        has_sso_data = bool(existing_user.external_id and existing_user.sso_provider)
        is_hybrid_or_sso = existing_user.auth_method in ["hybrid", "sso"]

        if has_sso_data and not is_hybrid_or_sso:
            logger.warning(
                f"Auth method inconsistency for user {existing_user.id}: has SSO data but auth_method is {existing_user.auth_method}",
                extra={
                    "category": "sso_corruption",
                    "user_id": existing_user.id,
                    "corruption_type": "auth_method_mismatch",
                },
            )
            return False

        return True

    def _reset_corrupted_sso_data(self, existing_user, db: Session):
        """Reset corrupted SSO data to clean state"""
        logger.info(
            f"Resetting corrupted SSO data for user {existing_user.id}",
            extra={"category": "sso_recovery", "user_id": existing_user.id},
        )

        existing_user.external_id = None
        existing_user.sso_provider = None
        existing_user.sso_metadata = None
        existing_user.last_sso_login = None
        existing_user.account_linked_at = None
        existing_user.auth_method = "local"  # Reset to local auth only
        db.commit()

    def _find_or_create_user(self, user_info, db: Session) -> Dict:
        """Find existing user or create new one with corruption detection and clean preferences logic"""
        # Special handling for GitHub users without accessible email
        is_github_no_email = (
            settings.SSO_PROVIDER_TYPE == "github" and not user_info.email
        )

        if is_github_no_email:
            # For GitHub users without accessible email, show manual linking modal
            return self._return_github_manual_linking(user_info)

        # Check for existing user by email
        existing_user = user_crud.get_by_email(db, email=user_info.email)

        if existing_user:
            # STEP 1: Check for SSO data corruption
            if not self._validate_sso_linking(existing_user, user_info):
                # Reset corrupted data and proceed as unlinked account
                self._reset_corrupted_sso_data(existing_user, db)
                # Continue to preference logic below

            # STEP 2: Check if account is already cleanly linked
            elif existing_user.external_id and existing_user.sso_provider:
                # Already linked - proceed with login regardless of preference
                logger.info(
                    f"SSO login for already linked account: {user_info.email}",
                    extra={"category": "sso", "event": "linked_account_login"},
                )
                return self._link_existing_user(existing_user, user_info, db)

            # STEP 3: Account not linked - check user preference
            preference = existing_user.sso_linking_preference or "always_ask"

            if preference == "auto_link":
                return self._link_existing_user(existing_user, user_info, db)
            if preference == "create_separate":
                # User preference is to always create separate accounts
                return self._create_new_separate_user(user_info, db)
            # always_ask or any other value
            return self._return_account_conflict(existing_user, user_info)
        # Check if registration is allowed (integration with existing system)
        if not settings.ALLOW_USER_REGISTRATION:
            logger.warning(
                f"SSO registration blocked for {user_info.email} - registration disabled",
                extra={
                    "category": "security",
                    "event": "sso_registration_blocked",
                    "email": user_info.email,
                },
            )
            raise SSORegistrationBlockedError(
                "New user registration is currently disabled. "
                "Please contact an administrator to create an account."
            )

        # Create new user from SSO
        new_user = user_crud.create_from_sso(
            db,
            email=user_info.email,
            username=user_info.email.split("@")[0],
            full_name=user_info.name or "",
            external_id=user_info.sub,
            sso_provider=settings.SSO_PROVIDER_TYPE,
        )

        logger.info(
            f"New user created via SSO: {user_info.email}",
            extra={"category": "sso", "event": "user_created"},
        )

        return {"user": new_user, "is_new_user": True, "auth_method": "sso"}

    def _create_new_separate_user(self, user_info, db: Session) -> Dict:
        """Create a new separate user account even when email matches existing user"""
        # Create new user from SSO (allowing duplicate email)
        new_user = user_crud.create_from_sso(
            db,
            email=user_info.email,
            username=f"{user_info.email.split('@')[0]}_{user_info.sub.replace('-', '')[:8]}",  # Make username unique
            full_name=user_info.name or "",
            external_id=user_info.sub,
            sso_provider=settings.SSO_PROVIDER_TYPE,
        )

        logger.info(
            f"New separate SSO user created: {user_info.email} (username: {new_user.username})",
            extra={
                "category": "sso",
                "event": "separate_user_created",
                "user_id": new_user.id,
            },
        )

        return {"user": new_user, "is_new_user": True, "auth_method": "sso"}

    def _link_existing_user(self, existing_user, user_info, db: Session) -> Dict:
        """Link SSO to existing user account"""
        # Update SSO info for existing user
        existing_user.external_id = user_info.sub
        existing_user.sso_provider = settings.SSO_PROVIDER_TYPE
        existing_user.last_sso_login = datetime.utcnow()

        # Link account if it was previously local-only
        if existing_user.auth_method == "local":
            existing_user.auth_method = "hybrid"
            existing_user.account_linked_at = datetime.utcnow()

        db.commit()

        return {"user": existing_user, "is_new_user": False, "auth_method": "sso"}

    def _return_account_conflict(self, existing_user, user_info) -> Dict:
        """Return account conflict data for frontend to handle"""
        # Create a temporary token for the conflict resolution process
        temp_token = secrets.token_urlsafe(32)

        # Store conflict data temporarily
        conflict_key = f"sso_conflict_{temp_token}"
        _store_state_entry(
            conflict_key,
            {
                "existing_user_id": existing_user.id,
                "sso_user_info": _serialize_user_info(user_info),
            },
        )

        return {
            "conflict": True,
            "existing_user_info": {
                "email": existing_user.email,
                "username": existing_user.username,
                "full_name": existing_user.full_name,
                "created_at": (
                    existing_user.created_at.isoformat()
                    if existing_user.created_at
                    else None
                ),
                "auth_method": existing_user.auth_method,
            },
            "sso_user_info": {
                "email": user_info.email,
                "name": user_info.name or "",
                "provider": settings.SSO_PROVIDER_TYPE,
            },
            "temp_token": temp_token,
        }

    def _return_github_manual_linking(self, user_info) -> Dict:
        """Return GitHub manual linking data for users without accessible email"""
        # Create a temporary token for the manual linking process
        temp_token = secrets.token_urlsafe(32)

        # Store GitHub user info temporarily
        github_key = f"github_manual_link_{temp_token}"
        _store_state_entry(
            github_key, {"sso_user_info": _serialize_user_info(user_info)}
        )

        return {
            "github_manual_link": True,
            "github_user_info": {
                "github_id": user_info.sub,
                "github_username": user_info.username or "GitHub User",
                "name": user_info.name or "",
                "provider": settings.SSO_PROVIDER_TYPE,
            },
            "temp_token": temp_token,
        }

    def resolve_account_conflict(
        self, temp_token: str, action: str, preference: str, db: Session
    ) -> Dict:
        """Resolve account conflict based on user's choice"""
        # Retrieve conflict data
        conflict_key = f"sso_conflict_{temp_token}"
        if conflict_key not in _state_storage:
            raise SSOAuthenticationError("Invalid or expired conflict resolution token")

        conflict_data = _state_storage[conflict_key]

        # Check if token is expired
        if datetime.utcnow() > conflict_data["expires_at"]:
            del _state_storage[conflict_key]
            raise SSOAuthenticationError("Conflict resolution token expired")

        # Get existing user
        existing_user = user_crud.get(db, id=conflict_data["existing_user_id"])
        if not existing_user:
            raise SSOAuthenticationError("Existing user not found")

        # Save user's preference for future logins
        existing_user.sso_linking_preference = preference
        db.commit()

        # Execute user's choice
        if action == "link":
            # Link accounts
            sso_info = conflict_data["sso_user_info"]

            # Reconstruct user_info object for linking
            class UserInfo:
                def __init__(self, data):
                    self.sub = data.get("sub")
                    self.email = data.get("email")
                    self.name = data.get("name")

            user_info = UserInfo(sso_info)
            result = self._link_existing_user(existing_user, user_info, db)

            # Clean up temporary data
            del _state_storage[conflict_key]
            return result

        if action == "create_separate":
            # Create new separate user account
            sso_info = conflict_data["sso_user_info"]

            # Reconstruct user_info object for the helper method
            class UserInfo:
                def __init__(self, data):
                    self.sub = data.get("sub")
                    self.email = data.get("email")
                    self.name = data.get("name")

            user_info = UserInfo(sso_info)
            result = self._create_new_separate_user(user_info, db)

            # Clean up temporary data
            del _state_storage[conflict_key]
            return result

        raise SSOAuthenticationError(
            "Invalid action. Must be 'link' or 'create_separate'"
        )

    def resolve_github_manual_link(
        self, temp_token: str, username: str, password: str, db: Session
    ) -> Dict:
        """Resolve GitHub manual linking by verifying user credentials"""
        from app.core.utils.security import verify_password

        # Retrieve GitHub linking data
        github_key = f"github_manual_link_{temp_token}"
        if github_key not in _state_storage:
            raise SSOAuthenticationError("Invalid or expired GitHub linking token")

        github_data = _state_storage[github_key]

        # Check if token is expired
        if datetime.utcnow() > github_data["expires_at"]:
            del _state_storage[github_key]
            raise SSOAuthenticationError("GitHub linking token expired")

        # Find user by username
        existing_user = user_crud.get_by_username(db, username=username)
        if not existing_user:
            raise SSOAuthenticationError("Invalid username or password")

        # Verify password. The column is password_hash - User has no `password`
        # attribute, and reading one raised AttributeError on every manual link.
        if not verify_password(password, str(existing_user.password_hash)):
            raise SSOAuthenticationError("Invalid username or password")

        # Link the GitHub account to the existing user
        sso_info = github_data["sso_user_info"]

        # Reconstruct user_info object for linking
        class UserInfo:
            def __init__(self, data):
                self.sub = data.get("sub")
                self.email = data.get("email")
                self.name = data.get("name")

        user_info = UserInfo(sso_info)
        result = self._link_existing_user(existing_user, user_info, db)

        # Clean up temporary data
        del _state_storage[github_key]

        logger.info(
            f"GitHub account manually linked to user {existing_user.username}",
            extra={
                "category": "sso",
                "event": "github_manual_link",
                "user_id": existing_user.id,
            },
        )

        return result

    async def test_connection(self) -> Dict:
        """Test SSO provider connection by validating credentials with the provider.

        Sends a dummy token exchange to detect misconfigurations:
        - invalid_client -> wrong client ID or secret
        - redirect_uri_mismatch -> redirect URI not registered with provider
        - invalid_grant -> credentials and redirect URI are valid (dummy code rejected as expected)
        """
        if not settings.SSO_ENABLED:
            return {"success": False, "message": "SSO is not enabled"}

        try:
            provider = create_sso_provider()
        except Exception as e:
            return {
                "success": False,
                "message": f"Provider configuration error: {str(e)}",
            }

        # Verify we can build an auth URL (basic config check)
        try:
            provider.get_auth_url("test_" + secrets.token_urlsafe(16))
        except Exception as e:
            return {"success": False, "message": f"Failed to build auth URL: {str(e)}"}

        # Send a dummy token exchange to validate client credentials and redirect URI
        log_extra = {
            "category": "sso",
            "event": "sso_test_connection",
            "provider": settings.SSO_PROVIDER_TYPE,
            "redirect_uri": provider.redirect_uri,
            "token_url": provider.get_token_url(),
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    provider.get_token_url(),
                    data={
                        "grant_type": "authorization_code",
                        "code": "dummy_validation_code",
                        "client_id": provider.client_id,
                        "client_secret": provider.client_secret,
                        "redirect_uri": provider.redirect_uri,
                    },
                )

            # Parse the provider's error response
            try:
                body = response.json()
            except (ValueError, KeyError):
                body = {}

            error = body.get("error", "")
            error_description = body.get("error_description", "")

            logger.info(
                f"SSO test connection response: HTTP {response.status_code}, "
                f"error={error}, description={error_description}",
                extra={
                    **log_extra,
                    "status_code": response.status_code,
                    "oauth_error": error,
                    "oauth_error_description": error_description,
                },
            )

            if error == "invalid_grant":
                return {
                    "success": True,
                    "message": "SSO configuration is valid. Client credentials and redirect URI verified.",
                }
            if error == "invalid_client":
                return {
                    "success": False,
                    "message": "Invalid client credentials. Check SSO_CLIENT_ID and SSO_CLIENT_SECRET.",
                }
            if error == "redirect_uri_mismatch":
                return {
                    "success": False,
                    "message": f"Redirect URI mismatch. The URI '{provider.redirect_uri}' is not registered with your OAuth provider.",
                }
            if error:
                detail = f"{error}: {error_description}" if error_description else error
                return {"success": False, "message": f"Provider error: {detail}"}
            return {
                "success": False,
                "message": f"Unexpected response (HTTP {response.status_code})",
            }

        except httpx.TimeoutException:
            logger.error("SSO test connection timed out", extra=log_extra)
            return {
                "success": False,
                "message": "Connection timed out reaching SSO provider",
            }
        except httpx.ConnectError as e:
            logger.error(f"SSO test connection failed: {str(e)}", extra=log_extra)
            return {
                "success": False,
                "message": "Could not connect to SSO provider. Check network access.",
            }
        except Exception as e:
            logger.error(f"SSO test connection error: {str(e)}", extra=log_extra)
            return {"success": False, "message": f"Connection test failed: {str(e)}"}
