"""Stable codes for auth failures whose text a client renders.

Each value is the `auth.errors.*` key suffix the client looks up
(`frontend/public/locales/*/auth.json`), so renaming one silently falls the UI back to
server English. Add rather than rename. Travels in the `error_code` response field.
"""


class AuthErrorCode:
    """Codes for error responses."""

    # Credentials and account state
    INVALID_CREDENTIALS = "invalid_credentials"
    ACCOUNT_DEACTIVATED = "account_deactivated"
    ACCOUNT_INCOMPLETE = "account_incomplete"
    LOGIN_RATE_LIMITED = "login_rate_limited"

    # Registration
    REGISTRATION_DISABLED = "registration_disabled"
    SSO_ONLY_REGISTRATION_BLOCKED = "sso_only_registration_blocked"
    USERNAME_TAKEN = "username_taken"
    EMAIL_TAKEN = "email_taken"

    # Password change
    CURRENT_PASSWORD_INCORRECT = "current_password_incorrect"
    PASSWORD_TOO_SHORT = "password_too_short"
    PASSWORD_COMPLEXITY = "password_complexity"

    # Two-factor sign-in step
    MFA_TICKET_INVALID = "mfa_ticket_invalid"
    MFA_CODE_INVALID = "mfa_code_invalid"
    MFA_SECRET_UNAVAILABLE = "mfa_secret_unavailable"
    MFA_RATE_LIMITED = "mfa_rate_limited"

    # Two-factor settings
    TWO_FACTOR_ENROLLMENT_BLOCKED = "two_factor_enrollment_blocked"
    TWO_FACTOR_ALREADY_ENABLED = "two_factor_already_enabled"
    TWO_FACTOR_NOT_ENABLED = "two_factor_not_enabled"
    TWO_FACTOR_SETUP_NOT_STARTED = "two_factor_setup_not_started"
    TWO_FACTOR_RATE_LIMITED = "two_factor_rate_limited"

    # SSO-only mode
    SSO_ONLY_PASSWORD_LOGIN_DISABLED = "sso_only_password_login_disabled"

    # SSO flow
    SSO_NOT_ENABLED = "sso_not_enabled"
    SSO_CONFIGURATION_ERROR = "sso_configuration_error"
    SSO_INITIATE_FAILED = "sso_initiate_failed"
    SSO_RATE_LIMITED = "sso_rate_limited"
    SSO_INVALID_RETURN_URL = "sso_invalid_return_url"
    SSO_AUTHENTICATION_FAILED = "sso_authentication_failed"
    SSO_TOKEN_EXCHANGE_FAILED = "sso_token_exchange_failed"
    SSO_USERINFO_FAILED = "sso_userinfo_failed"
    SSO_ACCOUNT_LINK_FAILED = "sso_account_link_failed"
    SSO_STATE_INVALID = "sso_state_invalid"
    SSO_STATE_EXPIRED = "sso_state_expired"

    # Email domain restrictions
    EMAIL_DOMAIN_NOT_ALLOWED = "email_domain_not_allowed"
    SSO_NO_EMAIL_DOMAIN_RESTRICTED = "sso_no_email_domain_restricted"

    # Account conflict resolution
    SSO_CONFLICT_TOKEN_INVALID = "sso_conflict_token_invalid"
    SSO_CONFLICT_TOKEN_EXPIRED = "sso_conflict_token_expired"
    SSO_CONFLICT_USER_NOT_FOUND = "sso_conflict_user_not_found"
    SSO_CONFLICT_INVALID_ACTION = "sso_conflict_invalid_action"
    SSO_CONFLICT_RESOLUTION_FAILED = "sso_conflict_resolution_failed"

    # GitHub manual account linking
    SSO_GITHUB_TOKEN_INVALID = "sso_github_token_invalid"
    SSO_GITHUB_TOKEN_EXPIRED = "sso_github_token_expired"
    SSO_GITHUB_LINK_FAILED = "sso_github_link_failed"
    SSO_GITHUB_LINK_TWO_FACTOR = "sso_github_link_two_factor"


class AuthMessageCode:
    """Codes for success bodies, which carry no `error_code`.

    Only `GET /auth/registration-status` needs these: it explains in prose why registration
    is unavailable, and that prose is rendered.
    """

    SSO_ONLY_REGISTRATION_UNAVAILABLE = "sso_only_registration_unavailable"
    REGISTRATION_DISABLED = "registration_disabled"
