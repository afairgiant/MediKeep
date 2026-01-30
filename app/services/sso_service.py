from typing import Dict, Optional
import secrets
import asyncio
from datetime import datetime, timedelta
from app.auth.sso.providers import create_sso_provider
from app.auth.sso.exceptions import *
from app.core.config import settings
from app.core.logging.config import get_logger
from app.crud.user import user as user_crud
from sqlalchemy.orm import Session

logger = get_logger(__name__, "sso")

# In-memory state storage for temporary SSO tokens
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
            raise SSOAuthenticationError("Failed to start SSO authentication")
    
    async def complete_authentication(self, code: str, state: str, db: Session) -> Dict:
        """Complete SSO authentication - no retry for OAuth codes (they're single-use)"""
        # Validate state
        self._validate_state(state)
        
        try:
            provider = create_sso_provider()
            
            # Exchange code for token (OAuth codes are single-use, no retry!)
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
            
            # Log success (handle both regular and conflict responses)
            if result.get("conflict"):
                logger.info(
                    f"SSO authentication detected conflict for {user_info.email}",
                    extra={"category": "sso", "event": "auth_conflict"}
                )
            else:
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
            logger.error(f"SSO authentication failed: {str(e)}")
            raise SSOAuthenticationError("Authentication failed")
    
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
    
    def _validate_sso_linking(self, existing_user, sso_user_info) -> bool:
        """Detect corrupted SSO linking data"""
        
        # Check for partial corruption - has external_id but missing sso_provider
        if existing_user.external_id and not existing_user.sso_provider:
            logger.warning(
                f"Corrupted SSO data for user {existing_user.id}: has external_id but no sso_provider",
                extra={"category": "sso_corruption", "user_id": existing_user.id, "corruption_type": "missing_provider"}
            )
            return False
        
        # Check for provider mismatch
        if existing_user.sso_provider and existing_user.sso_provider != settings.SSO_PROVIDER_TYPE:
            logger.warning(
                f"Provider mismatch for user {existing_user.id}: expected {settings.SSO_PROVIDER_TYPE}, got {existing_user.sso_provider}",
                extra={"category": "sso_corruption", "user_id": existing_user.id, "corruption_type": "provider_mismatch"}
            )
            return False
        
        # Check for auth_method inconsistency
        has_sso_data = bool(existing_user.external_id and existing_user.sso_provider)
        is_hybrid_or_sso = existing_user.auth_method in ['hybrid', 'sso']
        
        if has_sso_data and not is_hybrid_or_sso:
            logger.warning(
                f"Auth method inconsistency for user {existing_user.id}: has SSO data but auth_method is {existing_user.auth_method}",
                extra={"category": "sso_corruption", "user_id": existing_user.id, "corruption_type": "auth_method_mismatch"}
            )
            return False
        
        return True
    
    def _reset_corrupted_sso_data(self, existing_user, db: Session):
        """Reset corrupted SSO data to clean state"""
        logger.info(
            f"Resetting corrupted SSO data for user {existing_user.id}",
            extra={"category": "sso_recovery", "user_id": existing_user.id}
        )
        
        existing_user.external_id = None
        existing_user.sso_provider = None
        existing_user.sso_metadata = None
        existing_user.last_sso_login = None
        existing_user.account_linked_at = None
        existing_user.auth_method = 'local'  # Reset to local auth only
        db.commit()

    def _find_or_create_user(self, user_info, db: Session) -> Dict:
        """Find existing user or create new one with corruption detection and clean preferences logic"""
        # Special handling for GitHub users without accessible email
        is_github_no_email = (settings.SSO_PROVIDER_TYPE == "github" and 
                              not user_info.email)
        
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
                    extra={"category": "sso", "event": "linked_account_login"}
                )
                return self._link_existing_user(existing_user, user_info, db)
            
            # STEP 3: Account not linked - check user preference
            preference = existing_user.sso_linking_preference or 'always_ask'
            
            if preference == 'auto_link':
                return self._link_existing_user(existing_user, user_info, db)
            elif preference == 'create_separate':
                # User preference is to always create separate accounts
                return self._create_new_separate_user(user_info, db)
            else:  # always_ask or any other value
                return self._return_account_conflict(existing_user, user_info)
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
            extra={"category": "sso", "event": "separate_user_created", "user_id": new_user.id}
        )
        
        return {
            "user": new_user,
            "is_new_user": True,
            "auth_method": "sso"
        }

    def _link_existing_user(self, existing_user, user_info, db: Session) -> Dict:
        """Link SSO to existing user account"""
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
    
    def _return_account_conflict(self, existing_user, user_info) -> Dict:
        """Return account conflict data for frontend to handle"""
        # Create a temporary token for the conflict resolution process
        temp_token = secrets.token_urlsafe(32)
        
        # Store conflict data temporarily
        conflict_key = f"sso_conflict_{temp_token}"
        _state_storage[conflict_key] = {
            "created_at": datetime.utcnow(),
            "existing_user_id": existing_user.id,
            "sso_user_info": user_info.model_dump() if hasattr(user_info, 'model_dump') else user_info.__dict__ if hasattr(user_info, '__dict__') else user_info,
            "expires_at": datetime.utcnow() + timedelta(minutes=10)
        }
        
        return {
            "conflict": True,
            "existing_user_info": {
                "email": existing_user.email,
                "username": existing_user.username,
                "full_name": existing_user.full_name,
                "created_at": existing_user.created_at.isoformat() if existing_user.created_at else None,
                "auth_method": existing_user.auth_method
            },
            "sso_user_info": {
                "email": user_info.email,
                "name": user_info.name or "",
                "provider": settings.SSO_PROVIDER_TYPE
            },
            "temp_token": temp_token
        }
    
    def _return_github_manual_linking(self, user_info) -> Dict:
        """Return GitHub manual linking data for users without accessible email"""
        # Create a temporary token for the manual linking process
        temp_token = secrets.token_urlsafe(32)
        
        # Store GitHub user info temporarily
        github_key = f"github_manual_link_{temp_token}"
        _state_storage[github_key] = {
            "created_at": datetime.utcnow(),
            "sso_user_info": user_info.model_dump() if hasattr(user_info, 'model_dump') else user_info.__dict__ if hasattr(user_info, '__dict__') else user_info,
            "expires_at": datetime.utcnow() + timedelta(minutes=10)
        }
        
        return {
            "github_manual_link": True,
            "github_user_info": {
                "github_id": user_info.sub,
                "github_username": user_info.username or "GitHub User",
                "name": user_info.name or "",
                "provider": settings.SSO_PROVIDER_TYPE
            },
            "temp_token": temp_token
        }
    
    def resolve_account_conflict(self, temp_token: str, action: str, preference: str, db: Session) -> Dict:
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
            
        elif action == "create_separate":
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
        
        else:
            raise SSOAuthenticationError("Invalid action. Must be 'link' or 'create_separate'")
    
    def resolve_github_manual_link(self, temp_token: str, username: str, password: str, db: Session) -> Dict:
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
        
        # Verify password
        if not verify_password(password, existing_user.password):
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
            extra={"category": "sso", "event": "github_manual_link", "user_id": existing_user.id}
        )
        
        return result

    def test_connection(self) -> Dict[str, bool]:
        """Test SSO provider connection (for admin dashboard)"""
        try:
            provider = create_sso_provider()
            # Simple connectivity test - just check if we can create auth URL
            test_state = "test_" + secrets.token_urlsafe(16)
            auth_url = provider.get_auth_url(test_state)
            return {"success": True, "message": "SSO provider configuration is valid"}
        except Exception as e:
            return {"success": False, "message": "SSO test failed"}