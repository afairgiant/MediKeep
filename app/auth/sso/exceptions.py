class SSOError(Exception):
    """Base SSO exception"""


class SSOConfigurationError(SSOError):
    """SSO configuration is invalid"""


class SSOAuthenticationError(SSOError):
    """SSO authentication failed"""


class SSORegistrationBlockedError(SSOError):
    """New user registration blocked"""
