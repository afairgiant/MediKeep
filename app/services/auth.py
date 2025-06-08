from typing import Optional
from sqlalchemy.orm import Session
from app.models.models import User
from app.crud.user import user
from app.schemas.user import UserCreate


class AuthService:
    @staticmethod
    def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
        """Authenticate user with username and password"""
        return user.authenticate(db, username=username, password=password)

    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[User]:
        """Get user by username"""
        return user.get_by_username(db, username=username)

    @staticmethod
    def create_user(
        db: Session, username: str, password: str, is_superuser: bool = False
    ) -> User:
        """Create a new user"""
        user_create = UserCreate(
            username=username,
            email=f"{username}@example.com",  # Default email
            full_name=username.title(),  # Default full name
            role="admin" if is_superuser else "user",
            password=password,
        )
        return user.create(db, obj_in=user_create)
