from urllib.parse import urlencode
from typing import Dict, Optional
import re
from app.auth.sso.base_provider import SSOProvider, SSOUserInfo
from app.core.config import settings
from app.core.logging_config import get_logger

logger = get_logger(__name__, "sso")

# Email validation regex
EMAIL_REGEX = re.compile(r'^[^@]+@[^@]+\.[^@]+$')

class GoogleProvider(SSOProvider):
    def get_auth_url(self, state: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": "openid profile email",
            "state": state,
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    
    def get_token_url(self) -> str:
        return "https://oauth2.googleapis.com/token"
    
    def get_user_info_url(self) -> str:
        return "https://www.googleapis.com/oauth2/v2/userinfo"
    
    def format_user_info(self, raw_data: Dict) -> SSOUserInfo:
        return SSOUserInfo(
            sub=raw_data["id"],
            email=raw_data["email"],
            name=raw_data.get("name")
        )

class GitHubProvider(SSOProvider):
    def get_auth_url(self, state: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": "read:user user:email",
            "state": state,
        }
        return f"https://github.com/login/oauth/authorize?{urlencode(params)}"
    
    def get_token_url(self) -> str:
        return "https://github.com/login/oauth/access_token"
    
    def get_user_info_url(self) -> str:
        return "https://api.github.com/user"
    
    def format_user_info(self, raw_data: Dict) -> SSOUserInfo:
        # Try multiple fields for name: name, login (username)
        name = raw_data.get("name") or raw_data.get("login")
        return SSOUserInfo(
            sub=str(raw_data["id"]),  # GitHub uses numeric IDs
            email=raw_data.get("email"),
            name=name
        )
    
    async def get_user_info(self, access_token: str) -> SSOUserInfo:
        """GitHub may not return email in primary endpoint, need to fetch from /user/emails"""
        import httpx
        
        # Get basic user info first
        async with httpx.AsyncClient(timeout=10) as client:
            # Get user info
            response = await client.get(
                self.get_user_info_url(),
                headers={
                    "Authorization": f"token {access_token}",  # GitHub uses 'token' not 'Bearer'
                    "Accept": "application/json"
                }
            )
            response.raise_for_status()
            user_data = response.json()
            
            # If no email in primary response, fetch from emails endpoint
            if not user_data.get("email"):
                emails_response = await client.get(
                    "https://api.github.com/user/emails",
                    headers={
                        "Authorization": f"token {access_token}",
                        "Accept": "application/json"
                    }
                )
                if emails_response.status_code == 200:
                    emails = emails_response.json()
                    # Find primary email or first verified email
                    for email_obj in emails:
                        if email_obj.get("primary"):
                            user_data["email"] = email_obj["email"]
                            break
                        elif email_obj.get("verified") and not user_data.get("email"):
                            user_data["email"] = email_obj["email"]
            
            # If we still don't have an email, that's OK - we'll do manual linking
            return self.format_user_info(user_data)
    
    async def exchange_code_for_token(self, code: str) -> Dict:
        """GitHub-specific token exchange that handles form-encoded response"""
        import httpx
        from urllib.parse import parse_qs
        import logging
        
        # Log token exchange attempt without sensitive data
        logger.info("GitHub token exchange initiated", extra={
            "provider": "github",
            "action": "token_exchange"
        })
        
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                self.get_token_url(),
                data={
                    "code": code,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "redirect_uri": self.redirect_uri,
                },
                headers={
                    "Accept": "application/json"  # Request JSON response from GitHub
                }
            )
            
            # Don't raise_for_status immediately - we want to parse error messages first
            # GitHub can return either JSON or form-encoded based on Accept header
            content_type = response.headers.get("content-type", "")
            
            if "application/json" in content_type:
                data = response.json()
                # Check for GitHub error response
                if "error" in data:
                    error_msg = data.get('error_description', data.get('error', 'Unknown error'))
                    logger.error("GitHub OAuth error", extra={
                        "provider": "github",
                        "error_type": data.get('error', 'unknown'),
                        "action": "token_exchange"
                    })
                    raise ValueError(f"GitHub OAuth error: {error_msg}")
                # Now check status after parsing
                response.raise_for_status()
                return data
            else:
                # Parse form-encoded response
                text = response.text
                parsed = parse_qs(text)
                
                # Check for error in form-encoded response
                if "error" in parsed:
                    error_desc = parsed.get("error_description", [None])[0] or parsed.get("error", [None])[0]
                    logger.error("GitHub OAuth error", extra={
                        "provider": "github",
                        "error_description": error_desc,
                        "action": "token_exchange",
                        "response_type": "form-encoded"
                    })
                    raise ValueError(f"GitHub OAuth error: {error_desc}")
                
                # Now check status after parsing
                response.raise_for_status()
                
                # Extract access token
                access_token = parsed.get("access_token", [None])[0]
                if not access_token:
                    logger.error("GitHub OAuth missing access token", extra={
                    "provider": "github",
                    "action": "token_exchange"
                })
                    raise ValueError("No access token in GitHub OAuth response")
                
                return {
                    "access_token": access_token,
                    "token_type": parsed.get("token_type", ["bearer"])[0],
                    "scope": parsed.get("scope", [None])[0],
                }

class OIDCProvider(SSOProvider):
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str, issuer_url: str):
        super().__init__(client_id, client_secret, redirect_uri)
        
        # Validate issuer URL
        if not issuer_url or not issuer_url.startswith(('https://', 'http://')):
            raise ValueError(f"Invalid issuer URL: {issuer_url}")
        
        self.issuer_url = issuer_url.rstrip('/')
        self.provider_type = settings.SSO_PROVIDER_TYPE.lower() if settings.SSO_PROVIDER_TYPE else "oidc"
        
        # Initialize endpoint URLs
        self.authorization_endpoint = None
        self.token_endpoint = None
        self.userinfo_endpoint = None
        
        # Try to discover endpoints, fall back to defaults if discovery fails
        self._discover_endpoints()
    
    def _discover_endpoints(self):
        """Attempt OIDC discovery, fall back to provider-specific defaults"""
        import httpx
        import time
        
        # First, try OIDC discovery
        discovery_urls = [
            f"{self.issuer_url}/.well-known/openid-configuration",
            # Some providers need the full path
            f"{self.issuer_url}/.well-known/openid-configuration/",
        ]
        
        for discovery_url in discovery_urls:
            try:
                # Use synchronous client for initialization
                with httpx.Client(timeout=5) as client:
                    response = client.get(discovery_url)
                    if response.status_code == 200:
                        config = response.json()
                        self.authorization_endpoint = config.get("authorization_endpoint")
                        self.token_endpoint = config.get("token_endpoint")
                        self.userinfo_endpoint = config.get("userinfo_endpoint")
                        
                        # Only consider discovery successful if we got all required endpoints
                        if self.authorization_endpoint and self.token_endpoint and self.userinfo_endpoint:
                            logger.info("OIDC discovery successful", extra={
                                "provider_type": self.provider_type,
                                "discovery_url": discovery_url,
                                "action": "endpoint_discovery"
                            })
                            return
                        else:
                            logger.warning("Incomplete OIDC discovery response", extra={
                                "provider_type": self.provider_type,
                                "discovery_url": discovery_url,
                                "has_auth": bool(self.authorization_endpoint),
                                "has_token": bool(self.token_endpoint),
                                "has_userinfo": bool(self.userinfo_endpoint),
                                "action": "endpoint_discovery"
                            })
            except Exception as e:
                logger.warning("OIDC discovery failed", extra={
                    "provider_type": self.provider_type,
                    "discovery_url": discovery_url,
                    "error": str(e),
                    "action": "endpoint_discovery"
                })
                continue
        
        # If discovery failed, use provider-specific defaults
        logger.info("Using provider-specific defaults", extra={
            "provider_type": self.provider_type,
            "action": "endpoint_configuration"
        })
        self._set_provider_defaults()
    
    def _set_provider_defaults(self):
        """Set provider-specific default endpoints"""
        if self.provider_type == "authentik" or '/application/o/' in self.issuer_url:
            # Authentik endpoints
            self.authorization_endpoint = f"{self.issuer_url}/authorize/"
            self.token_endpoint = f"{self.issuer_url}/token/"
            self.userinfo_endpoint = f"{self.issuer_url}/userinfo/"
        
        elif self.provider_type == "keycloak" or '/realms/' in self.issuer_url:
            # Keycloak endpoints
            self.authorization_endpoint = f"{self.issuer_url}/protocol/openid-connect/auth"
            self.token_endpoint = f"{self.issuer_url}/protocol/openid-connect/token"
            self.userinfo_endpoint = f"{self.issuer_url}/protocol/openid-connect/userinfo"
        
        elif self.provider_type == "authelia":
            # Authelia endpoints
            self.authorization_endpoint = f"{self.issuer_url}/api/oidc/authorization"
            self.token_endpoint = f"{self.issuer_url}/api/oidc/token"
            self.userinfo_endpoint = f"{self.issuer_url}/api/oidc/userinfo"
        
        elif self.provider_type == "auth0" or 'auth0.com' in self.issuer_url:
            # Auth0 endpoints
            self.authorization_endpoint = f"{self.issuer_url}/authorize"
            self.token_endpoint = f"{self.issuer_url}/oauth/token"
            self.userinfo_endpoint = f"{self.issuer_url}/userinfo"
        
        elif self.provider_type == "okta" or 'okta.com' in self.issuer_url or 'oktapreview.com' in self.issuer_url:
            # Okta endpoints - check if it has /oauth2/ in the URL already
            if '/oauth2/' in self.issuer_url:
                # Already includes oauth2 path
                self.authorization_endpoint = f"{self.issuer_url}/v1/authorize"
                self.token_endpoint = f"{self.issuer_url}/v1/token"
                self.userinfo_endpoint = f"{self.issuer_url}/v1/userinfo"
            else:
                # Add oauth2/default path
                self.authorization_endpoint = f"{self.issuer_url}/oauth2/default/v1/authorize"
                self.token_endpoint = f"{self.issuer_url}/oauth2/default/v1/token"
                self.userinfo_endpoint = f"{self.issuer_url}/oauth2/default/v1/userinfo"
        
        elif self.provider_type == "azure" or 'microsoftonline.com' in self.issuer_url:
            # Azure AD / Microsoft Identity Platform
            if '/v2.0' in self.issuer_url:
                # v2.0 endpoints
                self.authorization_endpoint = f"{self.issuer_url}/authorize"
                self.token_endpoint = f"{self.issuer_url}/token"
                self.userinfo_endpoint = "https://graph.microsoft.com/oidc/userinfo"
            else:
                # v1.0 endpoints (legacy)
                self.authorization_endpoint = f"{self.issuer_url}/oauth2/authorize"
                self.token_endpoint = f"{self.issuer_url}/oauth2/token"
                self.userinfo_endpoint = f"{self.issuer_url}/openid/userinfo"
        
        else:
            # Generic OIDC defaults (most common pattern)
            self.authorization_endpoint = f"{self.issuer_url}/authorize"
            self.token_endpoint = f"{self.issuer_url}/token"
            self.userinfo_endpoint = f"{self.issuer_url}/userinfo"
            logger.warning("Using generic OIDC endpoints", extra={
                "provider_type": self.provider_type,
                "action": "endpoint_configuration"
            })
    
    def get_auth_url(self, state: str) -> str:
        if not self.authorization_endpoint:
            raise ValueError(f"Authorization endpoint not configured for provider {self.provider_type}")
            
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": "openid profile email",
            "state": state,
        }
        
        # Add provider-specific parameters
        if self.provider_type == "azure" or 'microsoftonline.com' in self.issuer_url:
            params["response_mode"] = "query"
        
        return f"{self.authorization_endpoint}?{urlencode(params)}"
    
    def get_token_url(self) -> str:
        if not self.token_endpoint:
            raise ValueError(f"Token endpoint not configured for provider {self.provider_type}")
        return self.token_endpoint
    
    def get_user_info_url(self) -> str:
        if not self.userinfo_endpoint:
            raise ValueError(f"UserInfo endpoint not configured for provider {self.provider_type}")
        return self.userinfo_endpoint
    
    def format_user_info(self, raw_data: Dict) -> SSOUserInfo:
        # Handle different claim names used by various providers
        sub = (
            raw_data.get("sub") or 
            raw_data.get("id") or 
            raw_data.get("user_id") or
            raw_data.get("oid") or  # Azure AD object ID
            raw_data.get("preferred_username")
        )
        
        # Try to get email from various fields and validate
        potential_emails = [
            raw_data.get("email"),
            raw_data.get("mail"),  # Some providers use 'mail'
            raw_data.get("upn"),  # Azure AD User Principal Name
            raw_data.get("preferred_username")  # Only if it's an email format
        ]
        
        email = None
        for potential_email in potential_emails:
            if potential_email and EMAIL_REGEX.match(potential_email):
                email = potential_email.lower()  # Normalize to lowercase
                break
        
        # Build name from various possible fields
        name = None
        if raw_data:
            name = (
                raw_data.get("name") or 
                raw_data.get("display_name") or 
                raw_data.get("displayName") or
                raw_data.get("full_name")
            )
            
            # If no direct name field, try to build from given/family names
            if not name and (raw_data.get("given_name") or raw_data.get("family_name")):
                given = raw_data.get("given_name", "")
                family = raw_data.get("family_name", "")
                name = f"{given} {family}".strip()
        
        return SSOUserInfo(
            sub=sub,
            email=email,
            name=name
        )

# Allowed SSO provider types for security
ALLOWED_PROVIDERS = {
    "google", "github", "oidc", "authentik", 
    "authelia", "keycloak", "auth0", "okta", "azure"
}

# Simple provider creation (no complex factory)
def create_sso_provider() -> SSOProvider:
    """Create the configured SSO provider"""
    provider_type = settings.SSO_PROVIDER_TYPE
    
    # Validate provider type against whitelist
    if provider_type not in ALLOWED_PROVIDERS:
        logger.error("Invalid SSO provider type", extra={
            "provider_type": provider_type,
            "allowed_providers": list(ALLOWED_PROVIDERS)
        })
        raise ValueError(f"SSO provider '{provider_type}' not in allowed list")
    
    if provider_type == "google":
        return GoogleProvider(
            settings.SSO_CLIENT_ID,
            settings.SSO_CLIENT_SECRET,
            settings.SSO_REDIRECT_URI
        )
    elif provider_type == "github":
        return GitHubProvider(
            settings.SSO_CLIENT_ID,
            settings.SSO_CLIENT_SECRET,
            settings.SSO_REDIRECT_URI
        )
    elif provider_type in ["oidc", "authentik", "authelia", "keycloak", "auth0", "okta", "azure"]:
        return OIDCProvider(
            settings.SSO_CLIENT_ID,
            settings.SSO_CLIENT_SECRET,
            settings.SSO_REDIRECT_URI,
            settings.SSO_ISSUER_URL
        )
    else:
        raise ValueError(f"Unsupported SSO provider: {provider_type}")