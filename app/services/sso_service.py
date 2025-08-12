from typing import Dict, Optional
import secrets
import asyncio
from datetime import datetime, timedelta
from app.auth.sso.providers import create_sso_provider
from app.auth.sso.exceptions import *
from app.core.config import settings
from app.core.logging_config import get_logger
from app.crud.user import user as user_crud
from sqlalchemy.orm import Session

logger = get_logger(__name__, "sso")

# Simple in-memory state storage (replace with Redis in production)
_state_storage = {}

class SSOService:
    """Simple SSO service - clean and maintainable"""
    
    def __init__(self):
        if settings.SSO_ENABLED:
            settings.validate_sso_config()
    
    async def get_authorization_url(self, return_url: Optional[str] = None) -> Dict[str, str]:
        """Generate OAuth authorization URL"""
        if not settings.SSO_ENABLED:
            raise SSOConfigurationError("SSO is not enabled")
        
        # Generate CSRF state token
        state = secrets.token_urlsafe(32)
        
        # Store state with expiration (10 minutes)
        _state_storage[state] = {
            "created_at": datetime.utcnow(),
            "return_url": return_url
        }
        
        try:
            provider = create_sso_provider()
            auth_url = provider.get_auth_url(state)
            
            logger.info(
                f"SSO authorization initiated for provider: {settings.SSO_PROVIDER_TYPE}",
                extra={"category": "sso", "event": "auth_initiated"}
            )
            
            return {
                "auth_url": auth_url,
                "state": state,
                "provider": settings.SSO_PROVIDER_TYPE
            }
        except Exception as e:
            logger.error(f"Failed to generate SSO auth URL: {str(e)}")
            raise SSOAuthenticationError(f"Failed to start SSO authentication: {str(e)}")
    
    async def complete_authentication(self, code: str, state: str, db: Session) -> Dict:
        """Complete SSO authentication with simple retry"""
        # Validate state
        self._validate_state(state)
        
        # Simple retry logic (3 attempts)
        last_error = None
        for attempt in range(3):
            try:
                provider = create_sso_provider()
                
                # Exchange code for token
                token_data = await provider.exchange_code_for_token(code)
                
                # Get user information
                user_info = await provider.get_user_info(token_data["access_token"])
                
                # Validate email domain if configured
                if not self._validate_email_domain(user_info.email):
                    raise SSOAuthenticationError(
                        f"Email domain not allowed: {user_info.email.split('@')[1]}"
                    )
                
                # Find or create user
                result = self._find_or_create_user(user_info, db)
                
                logger.info(
                    f"SSO authentication successful for {user_info.email}",
                    extra={
                        "category": "sso", 
                        "event": "auth_success",
                        "is_new_user": result["is_new_user"]
                    }
                )
                
                return result
                
            except Exception as e:
                last_error = e
                if attempt < 2:  # Don't sleep on last attempt
                    await asyncio.sleep(1)  # Simple 1 second delay
                continue
        
        logger.error(f"SSO authentication failed after 3 attempts: {str(last_error)}")
        raise SSOAuthenticationError(f"Authentication failed: {str(last_error)}")
    
    def _validate_state(self, state: str):
        """Validate CSRF state token"""
        if state not in _state_storage:
            raise SSOAuthenticationError("Invalid or expired state parameter")
        
        # Check if state is expired (10 minutes)
        state_data = _state_storage[state]
        if datetime.utcnow() - state_data["created_at"] > timedelta(minutes=10):
            del _state_storage[state]
            raise SSOAuthenticationError("State parameter expired")
    
    def _validate_email_domain(self, email: str) -> bool:
        """Check if email domain is allowed"""
        if not settings.SSO_ALLOWED_DOMAINS:
            return True  # No restrictions
        
        domain = email.split('@')[1].lower()
        allowed_domains = [d.lower() for d in settings.SSO_ALLOWED_DOMAINS]
        return domain in allowed_domains
    
    def _find_or_create_user(self, user_info, db: Session) -> Dict:
        """Find existing user or create new one (respects registration control)"""
        # Check for existing user by email
        existing_user = user_crud.get_by_email(db, email=user_info.email)
        
        if existing_user:
            # Update SSO info for existing user
            existing_user.external_id = user_info.sub
            existing_user.sso_provider = settings.SSO_PROVIDER_TYPE
            existing_user.last_sso_login = datetime.utcnow()
            
            # Link account if it was previously local-only
            if existing_user.auth_method == 'local':
                existing_user.auth_method = 'hybrid'
                existing_user.account_linked_at = datetime.utcnow()
            
            db.commit()
            
            return {
                "user": existing_user,
                "is_new_user": False,
                "auth_method": "sso"
            }
        else:
            # Check if registration is allowed (integration with existing system)
            if not settings.ALLOW_USER_REGISTRATION:
                logger.warning(
                    f"SSO registration blocked for {user_info.email} - registration disabled",
                    extra={
                        "category": "security",
                        "event": "sso_registration_blocked",
                        "email": user_info.email
                    }
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
                extra={"category": "sso", "event": "user_created"}
            )
            
            return {
                "user": new_user,
                "is_new_user": True,
                "auth_method": "sso"
            }
    
    def test_connection(self) -> Dict[str, bool]:
        """Test SSO provider connection (for admin dashboard)"""
        try:
            provider = create_sso_provider()
            # Simple connectivity test - just check if we can create auth URL
            test_state = "test_" + secrets.token_urlsafe(16)
            auth_url = provider.get_auth_url(test_state)
            return {"success": True, "message": "SSO provider configuration is valid"}
        except Exception as e:
            return {"success": False, "message": f"SSO test failed: {str(e)}"}