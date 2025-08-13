from abc import ABC, abstractmethod
from typing import Dict, Optional
from pydantic import BaseModel
import httpx

class SSOUserInfo(BaseModel):
    """Standardized user info from SSO providers"""
    sub: str  # Subject ID
    email: Optional[str] = None  # Optional for providers like GitHub without public email
    username: Optional[str] = None  # Provider username (e.g., GitHub login)
    name: Optional[str] = None

class SSOProvider(ABC):
    """Simple base class to eliminate provider code duplication"""
    
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
    
    @abstractmethod
    def get_auth_url(self, state: str) -> str:
        """Get OAuth authorization URL"""
        pass
    
    @abstractmethod
    def get_token_url(self) -> str:
        """Get token exchange endpoint"""
        pass
    
    @abstractmethod
    def get_user_info_url(self) -> str:
        """Get user info endpoint"""
        pass
    
    @abstractmethod
    def format_user_info(self, raw_data: Dict) -> SSOUserInfo:
        """Convert provider-specific data to standard format"""
        pass
    
    # Shared methods (DRY benefit)
    async def exchange_code_for_token(self, code: str) -> Dict:
        """Common token exchange logic"""
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                self.get_token_url(),
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "redirect_uri": self.redirect_uri,
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def get_user_info(self, access_token: str) -> SSOUserInfo:
        """Common user info fetching logic"""
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                self.get_user_info_url(),
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            raw_data = response.json()
            return self.format_user_info(raw_data)