from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from app.core.logging.config import get_logger
from app.crud.patient import patient
from app.crud.user import user
from app.models.models import User
from app.schemas.patient import PatientCreate
from app.schemas.user import UserCreate

logger = get_logger(__name__, "auth_service")


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
        db: Session, username: str, password: str, is_superuser: bool = False,
        must_change_password: bool = False,
    ) -> User:
        """Create a new user with an associated patient record"""
        # Create the user first
        user_create = UserCreate(
            username=username,
            email=f"{username}@example.com",  # Default email
            full_name=username.title(),  # Default full name
            role="admin" if is_superuser else "user",
            password=password,
        )
        new_user = user.create(db, obj_in=user_create, must_change_password=must_change_password)

        # Create a patient record for the user
        try:
            patient_data = PatientCreate(
                first_name=username.title(),  # Use username as first name
                last_name="User",  # Default last name
                birth_date=date(1990, 1, 1),  # Default birth date
                gender="OTHER",  # Neutral default
                address="Please update your address",  # Placeholder
            )

            # Get the user ID
            user_id = getattr(new_user, "id", None)
            if user_id:
                patient.create_for_user(db, user_id=user_id, patient_data=patient_data)
                logger.info(
                    "Patient record created for new user",
                    extra={
                        "category": "app",
                        "event": "patient_record_created_for_new_user",
                        "user_id": user_id,
                    }
                )
            else:
                logger.warning(
                    "Could not create patient record for new user - no user ID",
                    extra={
                        "category": "app", 
                        "event": "patient_record_creation_no_user_id",
                    }
                )

        except Exception as e:
            logger.warning(
                "Failed to create patient record for new user",
                extra={
                    "category": "app",
                    "event": "patient_record_creation_failed",
                    "user_id": getattr(new_user, "id", None),
                    "error": str(e),
                }
            )
            # Don't fail user creation if patient creation fails

        return new_user
