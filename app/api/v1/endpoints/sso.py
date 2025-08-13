from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.api import deps
from app.services.sso_service import SSOService
from app.auth.sso.exceptions import *
from app.core.config import settings
from app.core.security import create_access_token
from app.core.logging_config import get_logger

logger = get_logger(__name__, "sso")
router = APIRouter(prefix="/auth/sso", tags=["sso"])
sso_service = SSOService()

class SSOConflictRequest(BaseModel):
    temp_token: str
    action: str  # "link" or "create_separate"
    preference: str  # "auto_link", "create_separate", "always_ask"

class GitHubLinkRequest(BaseModel):
    temp_token: str
    username: str
    password: str

@router.get("/config")
async def get_sso_config():
    """Check if SSO is enabled and get configuration info for frontend"""
    try:
        return {
            "enabled": settings.SSO_ENABLED,
            "provider_type": settings.SSO_PROVIDER_TYPE if settings.SSO_ENABLED else None,
            "registration_enabled": settings.ALLOW_USER_REGISTRATION,
        }
    except Exception as e:
        logger.error(f"Error getting SSO config: {str(e)}")
        return {
            "enabled": False,
            "provider_type": None,
            "registration_enabled": settings.ALLOW_USER_REGISTRATION,
        }

@router.post("/initiate")
async def initiate_sso_login(
    return_url: str = Query(None, description="URL to return to after SSO"),
    db: Session = Depends(deps.get_db)
):
    """Start SSO authentication flow"""
    try:
        result = await sso_service.get_authorization_url(return_url)
        return result
    except SSOConfigurationError as e:
        logger.warning(f"SSO configuration error: {str(e)}")
        raise HTTPException(status_code=400, detail="SSO configuration error")
    except Exception as e:
        logger.error(f"Failed to initiate SSO: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to start SSO authentication")

@router.post("/callback")
async def sso_callback(
    code: str = Query(..., description="Authorization code from SSO provider"),
    state: str = Query(..., description="State parameter for CSRF protection"),
    db: Session = Depends(deps.get_db)
):
    """Handle SSO callback and complete authentication
    
    Security Note: OAuth authorization codes are single-use and time-limited,
    but should not be logged in web server access logs.
    """
    try:
        # Complete SSO authentication
        result = await sso_service.complete_authentication(code, state, db)
        
        # Check if this is a conflict response
        if result.get("conflict"):
            # Return conflict data directly for frontend to handle
            return result
        
        # Check if this is a GitHub manual linking response
        if result.get("github_manual_link"):
            # Return GitHub manual linking data for frontend to handle
            return result
        
        # Create JWT token for the user (matching regular auth format)
        access_token = create_access_token(
            data={
                "sub": result["user"].username,
                "role": (
                    result["user"].role if result["user"].role in ["admin", "user", "guest"] else "user"
                ),
                "user_id": result["user"].id,
            }
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": result["user"].id,
                "username": result["user"].username,
                "email": result["user"].email,
                "full_name": result["user"].full_name,
                "role": result["user"].role,
                "auth_method": result["user"].auth_method,
            },
            "is_new_user": result["is_new_user"]
        }
        
    except SSORegistrationBlockedError as e:
        logger.warning(f"SSO registration blocked: {str(e)}")
        raise HTTPException(
            status_code=403,
            detail={
                "message": "Registration is currently disabled",
                "error_code": "REGISTRATION_DISABLED"
            }
        )
    except SSOAuthenticationError as e:
        logger.error(f"SSO authentication failed: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail={
                "message": "SSO authentication failed",
                "error_code": "AUTH_FAILED"
            }
        )
    except Exception as e:
        logger.error(f"Unexpected error in SSO callback: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="SSO authentication failed"
        )

@router.post("/resolve-conflict")
async def resolve_account_conflict(
    request: SSOConflictRequest,
    db: Session = Depends(deps.get_db)
):
    """Resolve SSO account conflict based on user's choice"""
    try:
        result = sso_service.resolve_account_conflict(request.temp_token, request.action, request.preference, db)
        
        # Create JWT token for the user
        access_token = create_access_token(
            data={
                "sub": result["user"].username,
                "role": (
                    result["user"].role if result["user"].role in ["admin", "user", "guest"] else "user"
                ),
                "user_id": result["user"].id,
            }
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": result["user"].id,
                "username": result["user"].username,
                "email": result["user"].email,
                "full_name": result["user"].full_name,
                "role": result["user"].role,
                "auth_method": result["user"].auth_method,
            },
            "is_new_user": result["is_new_user"]
        }
        
    except SSOAuthenticationError as e:
        logger.error(f"SSO conflict resolution failed: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Account conflict resolution failed",
                "error_code": "CONFLICT_RESOLUTION_FAILED"
            }
        )
    except Exception as e:
        logger.error(f"Unexpected error in SSO conflict resolution: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="SSO conflict resolution failed"
        )

@router.post("/resolve-github-link")
async def resolve_github_manual_link(
    request: GitHubLinkRequest,
    db: Session = Depends(deps.get_db)
):
    """Resolve GitHub manual linking by verifying user credentials"""
    try:
        result = sso_service.resolve_github_manual_link(request.temp_token, request.username, request.password, db)
        
        # Create JWT token for the user
        access_token = create_access_token(
            data={
                "sub": result["user"].username,
                "role": (
                    result["user"].role if result["user"].role in ["admin", "user", "guest"] else "user"
                ),
                "user_id": result["user"].id,
            }
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": result["user"].id,
                "username": result["user"].username,
                "email": result["user"].email,
                "full_name": result["user"].full_name,
                "role": result["user"].role,
                "auth_method": result["user"].auth_method,
            },
            "is_new_user": result["is_new_user"]
        }
        
    except SSOAuthenticationError as e:
        logger.error(f"GitHub manual linking failed: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail={
                "message": "GitHub account linking failed",
                "error_code": "GITHUB_LINK_FAILED"
            }
        )
    except Exception as e:
        logger.error(f"Unexpected error in GitHub manual linking: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="GitHub manual linking failed"
        )

@router.post("/test-connection")
async def test_sso_connection():
    """Test SSO provider connection (for admin use)"""
    try:
        result = sso_service.test_connection()
        if result["success"]:
            return {"success": True, "message": result["message"]}
        else:
            return {"success": False, "message": result["message"]}
    except Exception as e:
        logger.error(f"SSO connection test failed: {str(e)}")
        return {"success": False, "message": "Connection test failed"}