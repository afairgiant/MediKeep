from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from app.api import deps
from app.services.sso_service import SSOService
from app.auth.sso.exceptions import *
from app.core.config import settings
from app.core.security import create_access_token
from app.core.logging_config import get_logger

logger = get_logger(__name__, "sso")
router = APIRouter(prefix="/auth/sso", tags=["sso"])
sso_service = SSOService()

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
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to initiate SSO: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to start SSO authentication")

@router.post("/callback")
async def sso_callback(
    code: str = Query(..., description="Authorization code from SSO provider"),
    state: str = Query(..., description="State parameter for CSRF protection"),
    db: Session = Depends(deps.get_db)
):
    """Handle SSO callback and complete authentication"""
    try:
        # Complete SSO authentication
        result = await sso_service.complete_authentication(code, state, db)
        
        # Create JWT token for the user
        access_token = create_access_token(
            subject=str(result["user"].id)
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
                "message": str(e),
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
        return {"success": False, "message": f"Connection test failed: {str(e)}"}