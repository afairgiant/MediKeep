from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any

from app.api import deps
from app.crud.user import user
from app.schemas.user import User, UserUpdate
from app.models.models import User as UserModel

router = APIRouter()


@router.get("/me", response_model=User)
def get_current_user(current_user: UserModel = Depends(deps.get_current_user)) -> Any:
    """Get current user profile."""
    return current_user


@router.put("/me", response_model=User)
def update_current_user(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserUpdate,
    current_user: UserModel = Depends(deps.get_current_user),
) -> Any:
    """Update current user profile."""
    updated_user = user.update(db, db_obj=current_user, obj_in=user_in)
    return updated_user
