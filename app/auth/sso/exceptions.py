class SSOError(Exception):
    """Base SSO exception"""
    pass

class SSOConfigurationError(SSOError):
    """SSO configuration is invalid"""
    pass

class SSOAuthenticationError(SSOError):
    """SSO authentication failed"""
    pass

class SSORegistrationBlockedError(SSOError):
    """New user registration blocked"""
    pass