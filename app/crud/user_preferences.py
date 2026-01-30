from typing import Optional

from sqlalchemy.orm import Session

from app.core.logging.config import get_logger
from app.crud.base import CRUDBase
from app.models.models import UserPreferences
from app.schemas.user_preferences import UserPreferencesCreate, UserPreferencesUpdate

logger = get_logger(__name__, "app")


class CRUDUserPreferences(
    CRUDBase[UserPreferences, UserPreferencesCreate, UserPreferencesUpdate]
):
    """CRUD operations for UserPreferences."""

    def get_by_user_id(self, db: Session, *, user_id: int) -> Optional[UserPreferences]:
        """
        Get user preferences by user ID.

        Args:
            db: Database session
            user_id: User ID to get preferences for

        Returns:
            UserPreferences object if found, None otherwise
        """
        try:
            return (
                db.query(self.model).filter(UserPreferences.user_id == user_id).first()
            )
        except Exception as e:
            logger.error(f"Error getting user preferences for user {user_id}: {str(e)}")
            return None

    def get_or_create_by_user_id(
        self, db: Session, *, user_id: int, unit_system: str = "imperial"
    ) -> UserPreferences:
        """
        Get existing preferences or create default preferences for a user.

        Args:
            db: Database session
            user_id: User ID to get/create preferences for
            unit_system: Default unit system if creating new preferences

        Returns:
            UserPreferences object
        """
        try:
            # Try to get existing preferences
            preferences = self.get_by_user_id(db, user_id=user_id)

            if preferences:
                return preferences

            # Create new preferences with default values
            preferences_data = UserPreferencesCreate(unit_system=unit_system)
            new_preferences = UserPreferences(
                user_id=user_id, unit_system=preferences_data.unit_system
            )

            db.add(new_preferences)
            db.commit()
            db.refresh(new_preferences)

            logger.info(f"Created default preferences for user {user_id}")
            return new_preferences

        except Exception as e:
            logger.error(
                f"Error getting/creating preferences for user {user_id}: {str(e)}"
            )
            db.rollback()
            raise

    def update_by_user_id(
        self, db: Session, *, user_id: int, obj_in: UserPreferencesUpdate
    ) -> Optional[UserPreferences]:
        """
        Update user preferences by user ID.

        Args:
            db: Database session
            user_id: User ID to update preferences for
            obj_in: Update data

        Returns:
            Updated UserPreferences object if successful, None otherwise
        """
        try:
            # Get or create preferences
            preferences = self.get_or_create_by_user_id(db, user_id=user_id)

            # Update preferences
            update_data = obj_in.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(preferences, field, value)

            db.add(preferences)
            db.commit()
            db.refresh(preferences)

            logger.info(f"Updated preferences for user {user_id}: {update_data}")
            return preferences

        except Exception as e:
            logger.error(f"Error updating preferences for user {user_id}: {str(e)}")
            db.rollback()
            return None


# Create instance to use throughout the app
user_preferences = CRUDUserPreferences(UserPreferences)
