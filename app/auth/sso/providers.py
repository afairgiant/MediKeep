from urllib.parse import urlencode
from typing import Dict
from app.auth.sso.base_provider import SSOProvider, SSOUserInfo
from app.core.config import settings

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
        return "https://www.googleapis.com/oauth2/v1/userinfo"
    
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
            "scope": "user:email",
            "state": state,
        }
        return f"https://github.com/login/oauth/authorize?{urlencode(params)}"
    
    def get_token_url(self) -> str:
        return "https://github.com/login/oauth/access_token"
    
    def get_user_info_url(self) -> str:
        return "https://api.github.com/user"
    
    def format_user_info(self, raw_data: Dict) -> SSOUserInfo:
        return SSOUserInfo(
            sub=str(raw_data["id"]),
            email=raw_data["email"],
            name=raw_data.get("name")
        )

class OIDCProvider(SSOProvider):
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str, issuer_url: str):
        super().__init__(client_id, client_secret, redirect_uri)
        self.issuer_url = issuer_url.rstrip('/')
    
    def get_auth_url(self, state: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": "openid profile email",
            "state": state,
        }
        return f"{self.issuer_url}/auth?{urlencode(params)}"
    
    def get_token_url(self) -> str:
        return f"{self.issuer_url}/token"
    
    def get_user_info_url(self) -> str:
        return f"{self.issuer_url}/userinfo"
    
    def format_user_info(self, raw_data: Dict) -> SSOUserInfo:
        return SSOUserInfo(
            sub=raw_data["sub"],
            email=raw_data["email"],
            name=raw_data.get("name")
        )

# Simple provider creation (no complex factory)
def create_sso_provider() -> SSOProvider:
    """Create the configured SSO provider"""
    provider_type = settings.SSO_PROVIDER_TYPE
    
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
    elif provider_type in ["oidc", "authentik", "authelia", "keycloak"]:
        return OIDCProvider(
            settings.SSO_CLIENT_ID,
            settings.SSO_CLIENT_SECRET,
            settings.SSO_REDIRECT_URI,
            settings.SSO_ISSUER_URL
        )
    else:
        raise ValueError(f"Unsupported SSO provider: {provider_type}")