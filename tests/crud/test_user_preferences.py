"""
Tests for UserPreferences CRUD operations.
"""
import pytest
from datetime import date
from sqlalchemy.orm import Session

from app.crud.user_preferences import user_preferences as user_prefs_crud
from app.crud.user import user as user_crud
from app.models.models import UserPreferences
from app.schemas.user_preferences import UserPreferencesCreate, UserPreferencesUpdate
from app.schemas.user import UserCreate


class TestUserPreferencesCRUD:
    """Test UserPreferences CRUD operations."""

    def test_get_by_user_id_not_exists(self, db_session: Session, test_user):
        """Test getting preferences for user without preferences."""
        prefs = user_prefs_crud.get_by_user_id(db_session, user_id=test_user.id)

        # New user should not have preferences yet
        assert prefs is None

    def test_get_or_create_creates_new(self, db_session: Session, test_user):
        """Test get_or_create creates preferences when none exist."""
        prefs = user_prefs_crud.get_or_create_by_user_id(
            db_session, user_id=test_user.id
        )

        assert prefs is not None
        assert prefs.user_id == test_user.id
        assert prefs.unit_system == "imperial"  # Default

    def test_get_or_create_returns_existing(self, db_session: Session, test_user):
        """Test get_or_create returns existing preferences."""
        # Create preferences first
        prefs1 = user_prefs_crud.get_or_create_by_user_id(
            db_session, user_id=test_user.id
        )

        # Call again - should return same preferences
        prefs2 = user_prefs_crud.get_or_create_by_user_id(
            db_session, user_id=test_user.id
        )

        assert prefs1.id == prefs2.id

    def test_get_or_create_custom_unit_system(self, db_session: Session, test_user):
        """Test get_or_create with custom unit system."""
        prefs = user_prefs_crud.get_or_create_by_user_id(
            db_session, user_id=test_user.id, unit_system="metric"
        )

        assert prefs.unit_system == "metric"

    def test_update_by_user_id(self, db_session: Session, test_user):
        """Test updating preferences by user ID."""
        # Create preferences first
        user_prefs_crud.get_or_create_by_user_id(db_session, user_id=test_user.id)

        # Update preferences
        update_data = UserPreferencesUpdate(unit_system="metric")
        updated = user_prefs_crud.update_by_user_id(
            db_session, user_id=test_user.id, obj_in=update_data
        )

        assert updated is not None
        assert updated.unit_system == "metric"

    def test_update_creates_if_not_exists(self, db_session: Session, test_user):
        """Test update creates preferences if they don't exist."""
        # Don't create preferences first
        update_data = UserPreferencesUpdate(unit_system="metric")
        updated = user_prefs_crud.update_by_user_id(
            db_session, user_id=test_user.id, obj_in=update_data
        )

        assert updated is not None
        assert updated.unit_system == "metric"
        assert updated.user_id == test_user.id

    def test_update_preserves_unchanged_fields(self, db_session: Session, test_user):
        """Test that update only changes specified fields."""
        # Create preferences with default values
        prefs = user_prefs_crud.get_or_create_by_user_id(
            db_session, user_id=test_user.id, unit_system="imperial"
        )
        original_id = prefs.id

        # Update only one field
        update_data = UserPreferencesUpdate(unit_system="metric")
        updated = user_prefs_crud.update_by_user_id(
            db_session, user_id=test_user.id, obj_in=update_data
        )

        assert updated.id == original_id  # Same record
        assert updated.unit_system == "metric"

    def test_get_by_user_id_returns_correct_user(self, db_session: Session):
        """Test that get_by_user_id returns preferences for correct user."""
        # Create two users
        user1_data = UserCreate(
            username="user1", email="user1@example.com",
            password="password123", full_name="User One", role="user"
        )
        user2_data = UserCreate(
            username="user2", email="user2@example.com",
            password="password123", full_name="User Two", role="user"
        )

        user1 = user_crud.create(db_session, obj_in=user1_data)
        user2 = user_crud.create(db_session, obj_in=user2_data)

        # Create preferences for each user
        user_prefs_crud.get_or_create_by_user_id(
            db_session, user_id=user1.id, unit_system="imperial"
        )
        user_prefs_crud.get_or_create_by_user_id(
            db_session, user_id=user2.id, unit_system="metric"
        )

        # Verify each user gets their own preferences
        prefs1 = user_prefs_crud.get_by_user_id(db_session, user_id=user1.id)
        prefs2 = user_prefs_crud.get_by_user_id(db_session, user_id=user2.id)

        assert prefs1.unit_system == "imperial"
        assert prefs2.unit_system == "metric"
        assert prefs1.user_id != prefs2.user_id

    def test_update_nonexistent_user(self, db_session: Session):
        """Test updating preferences for nonexistent user creates them.

        Note: The CRUD method creates preferences if they don't exist,
        rather than raising an error.
        """
        update_data = UserPreferencesUpdate(unit_system="metric")

        # This creates preferences for the user_id even if user doesn't exist in users table
        result = user_prefs_crud.update_by_user_id(
            db_session, user_id=99999, obj_in=update_data
        )

        # Should create new preferences with the update data
        assert result is not None
        assert result.user_id == 99999
        assert result.unit_system == "metric"

    def test_multiple_updates(self, db_session: Session, test_user):
        """Test multiple sequential updates work correctly."""
        # Create initial preferences
        prefs = user_prefs_crud.get_or_create_by_user_id(
            db_session, user_id=test_user.id, unit_system="imperial"
        )
        original_id = prefs.id

        # First update
        update1 = UserPreferencesUpdate(unit_system="metric")
        updated1 = user_prefs_crud.update_by_user_id(
            db_session, user_id=test_user.id, obj_in=update1
        )
        assert updated1.unit_system == "metric"

        # Second update
        update2 = UserPreferencesUpdate(unit_system="imperial")
        updated2 = user_prefs_crud.update_by_user_id(
            db_session, user_id=test_user.id, obj_in=update2
        )
        assert updated2.unit_system == "imperial"

        # Should still be same record
        assert updated2.id == original_id
