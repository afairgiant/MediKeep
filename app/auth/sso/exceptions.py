class SSOError(Exception):
    """Base SSO exception.

    `error_code` selects the client's translated copy; see `AuthErrorCode`. Keep
    identity-provider text out of `message` - it cannot be translated and must not
    read as our own copy.
    """

    def __init__(self, message: str, error_code: str | None = None):
        super().__init__(message)
        self.message = message
        self.error_code = error_code


class SSOConfigurationError(SSOError):
    """SSO configuration is invalid"""


class SSOAuthenticationError(SSOError):
    """SSO authentication failed"""


class SSORegistrationBlockedError(SSOError):
    """New user registration blocked"""
