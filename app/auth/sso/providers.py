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
            email=raw_data.get("email"),
            username=raw_data.get("login"),  # GitHub username
            name=raw_data.get("name")
        )
    
    async def get_user_info(self, access_token: str) -> SSOUserInfo:
        """GitHub-specific user info fetching that handles private emails"""
        import httpx
        
        async with httpx.AsyncClient(timeout=10) as client:
            # Get basic user info
            user_response = await client.get(
                self.get_user_info_url(),
                headers={"Authorization": f"Bearer {access_token}"}
            )
            user_response.raise_for_status()
            user_data = user_response.json()
            
            # If email is not public, try to fetch it from the emails endpoint
            if not user_data.get("email"):
                try:
                    emails_response = await client.get(
                        "https://api.github.com/user/emails",
                        headers={"Authorization": f"Bearer {access_token}"}
                    )
                    emails_response.raise_for_status()
                    emails_data = emails_response.json()
                    
                    # Find the primary email
                    primary_email = None
                    for email_info in emails_data:
                        if email_info.get("primary", False):
                            primary_email = email_info["email"]
                            break
                    
                    # If no primary email found, use the first verified email
                    if not primary_email:
                        for email_info in emails_data:
                            if email_info.get("verified", False):
                                primary_email = email_info["email"]
                                break
                    
                    # If still no email, use the first one
                    if not primary_email and emails_data:
                        primary_email = emails_data[0]["email"]
                        
                    user_data["email"] = primary_email
                except Exception:
                    # Email fetch failed - this happens when user has completely private email
                    pass
            
            # If we still don't have an email, that's OK - we'll do manual linking
            return self.format_user_info(user_data)
    
    async def exchange_code_for_token(self, code: str) -> Dict:
        """GitHub-specific token exchange that handles form-encoded response"""
        import httpx
        from urllib.parse import parse_qs
        import logging
        
        logger = logging.getLogger(__name__)
        
        # Debug log the parameters we're sending
        logger.info(f"GitHub token exchange - redirect_uri: {self.redirect_uri}")
        logger.info(f"GitHub token exchange - client_id: {self.client_id}")
        logger.info(f"GitHub token exchange - code: {code[:10]}...")
        
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
                    logger.error(f"GitHub OAuth error response: {data}")
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
                    logger.error(f"GitHub OAuth error (form-encoded): {text}")
                    raise ValueError(f"GitHub OAuth error: {error_desc}")
                
                # Now check status after parsing
                response.raise_for_status()
                
                # Extract access token
                access_token = parsed.get("access_token", [None])[0]
                if not access_token:
                    logger.error(f"No access token in GitHub response: {text}")
                    raise ValueError(f"No access token in GitHub response: {text}")
                
                return {
                    "access_token": access_token,
                    "token_type": parsed.get("token_type", ["bearer"])[0],
                    "scope": parsed.get("scope", [None])[0],
                }

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