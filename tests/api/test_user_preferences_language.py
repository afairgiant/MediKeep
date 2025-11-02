"""
Test user preferences language functionality.

Tests language auto-detection, manual language changes, and persistence.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.user_preferences import user_preferences
from tests.utils.user import create_random_user, create_user_authentication_headers


class TestUserPreferencesLanguage:
    """Test language preference management."""

    def test_default_language_is_english(
        self, client: TestClient, db_session: Session
    ):
        """Test that new users get English as default language."""
        # Create a test user
        user_data = create_random_user(db_session)
        headers = create_user_authentication_headers(client=client, username=user_data["username"], password=user_data["password"])

        # Get user preferences
        response = client.get("/api/v1/users/me/preferences", headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert data["language"] == "en"

    def test_update_language_to_french(
        self, client: TestClient, db_session: Session
    ):
        """Test updating user language preference to French."""
        # Create a test user
        user_data = create_random_user(db_session)
        headers = create_user_authentication_headers(client=client, username=user_data["username"], password=user_data["password"])

        # Update language to French
        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"language": "fr"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["language"] == "fr"

        # Verify persistence
        response = client.get("/api/v1/users/me/preferences", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["language"] == "fr"

    def test_update_language_to_german(
        self, client: TestClient, db_session: Session
    ):
        """Test updating user language preference to German."""
        # Create a test user
        user_data = create_random_user(db_session)
        headers = create_user_authentication_headers(client=client, username=user_data["username"], password=user_data["password"])

        # Update language to German
        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"language": "de"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["language"] == "de"

    def test_reject_unsupported_language(
        self, client: TestClient, db_session: Session
    ):
        """Test that unsupported languages are rejected."""
        # Create a test user
        user_data = create_random_user(db_session)
        headers = create_user_authentication_headers(client=client, username=user_data["username"], password=user_data["password"])

        # Try to set an unsupported language
        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"language": "es"}  # Spanish not supported yet
        )

        assert response.status_code == 422
        data = response.json()
        # The API uses structured error response
        assert "errors" in data or "detail" in data or "message" in data

    def test_reject_invalid_language_code(
        self, client: TestClient, db_session: Session
    ):
        """Test that invalid language codes are rejected."""
        # Create a test user
        user_data = create_random_user(db_session)
        headers = create_user_authentication_headers(client=client, username=user_data["username"], password=user_data["password"])

        # Try to set an invalid language code
        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"language": "invalid"}
        )

        assert response.status_code == 422

    def test_language_case_insensitive(
        self, client: TestClient, db_session: Session
    ):
        """Test that language codes are case-insensitive."""
        # Create a test user
        user_data = create_random_user(db_session)
        headers = create_user_authentication_headers(client=client, username=user_data["username"], password=user_data["password"])

        # Try uppercase language code
        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"language": "FR"}
        )

        assert response.status_code == 200
        data = response.json()
        # Should be normalized to lowercase
        assert data["language"] == "fr"

    def test_language_persists_across_sessions(
        self, client: TestClient, db_session: Session
    ):
        """Test that language preference persists across login sessions."""
        # Create a test user
        user_data = create_random_user(db_session)
        headers = create_user_authentication_headers(client=client, username=user_data["username"], password=user_data["password"])

        # Set language to French
        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"language": "fr"}
        )
        assert response.status_code == 200

        # Simulate new login session (get new token)
        new_headers = create_user_authentication_headers(
            client=client, username=user_data["username"], password=user_data["password"]
        )

        # Verify language is still French
        response = client.get("/api/v1/users/me/preferences", headers=new_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["language"] == "fr"

    def test_update_multiple_preferences_including_language(
        self, client: TestClient, db_session: Session
    ):
        """Test updating multiple preferences including language."""
        # Create a test user
        user_data = create_random_user(db_session)
        headers = create_user_authentication_headers(client=client, username=user_data["username"], password=user_data["password"])

        # Update multiple preferences
        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={
                "language": "de",
                "unit_system": "metric",
                "session_timeout_minutes": 60
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["language"] == "de"
        assert data["unit_system"] == "metric"
        assert data["session_timeout_minutes"] == 60

    def test_language_not_required_on_update(
        self, client: TestClient, db_session: Session
    ):
        """Test that language field is optional when updating other preferences."""
        # Create a test user
        user_data = create_random_user(db_session)
        headers = create_user_authentication_headers(client=client, username=user_data["username"], password=user_data["password"])

        # Update only unit_system, not language
        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"unit_system": "metric"}
        )

        assert response.status_code == 200
        data = response.json()
        # Language should still be default (en)
        assert data["language"] == "en"
        assert data["unit_system"] == "metric"

    def test_supported_languages_list(
        self, client: TestClient, db_session: Session
    ):
        """Test that all supported languages can be set successfully."""
        supported_languages = ["en", "fr", "de"]

        for lang in supported_languages:
            # Create a new test user for each language
            user_data = create_random_user(db_session)
            headers = create_user_authentication_headers(
                client=client, username=user_data["username"], password=user_data["password"]
            )

            # Update language
            response = client.put(
                "/api/v1/users/me/preferences",
                headers=headers,
                json={"language": lang}
            )

            assert response.status_code == 200, \
                f"Failed to set language to {lang}"
            data = response.json()
            assert data["language"] == lang, \
                f"Language not set correctly to {lang}"


class TestLanguageValidation:
    """Test language validation in schemas."""

    def test_language_validation_in_base_schema(self, db_session: Session):
        """Test that UserPreferencesBase validates language correctly."""
        from app.schemas.user_preferences import UserPreferencesBase

        # Valid language
        valid_prefs = UserPreferencesBase(
            unit_system="imperial",
            language="fr"
        )
        assert valid_prefs.language == "fr"

        # Invalid language should raise validation error
        with pytest.raises(ValueError, match="Language must be one of"):
            UserPreferencesBase(
                unit_system="imperial",
                language="invalid"
            )

    def test_language_validation_in_update_schema(self):
        """Test that UserPreferencesUpdate validates language correctly."""
        from app.schemas.user_preferences import UserPreferencesUpdate

        # Valid language
        valid_update = UserPreferencesUpdate(language="de")
        assert valid_update.language == "de"

        # Invalid language should raise validation error
        with pytest.raises(ValueError, match="Language must be one of"):
            UserPreferencesUpdate(language="es")

    def test_language_defaults_to_en(self):
        """Test that language defaults to 'en' when not specified."""
        from app.schemas.user_preferences import UserPreferencesBase

        prefs = UserPreferencesBase(unit_system="imperial")
        assert prefs.language == "en"

    def test_language_normalization_to_lowercase(self):
        """Test that language codes are normalized to lowercase."""
        from app.schemas.user_preferences import UserPreferencesBase

        prefs = UserPreferencesBase(
            unit_system="imperial",
            language="FR"
        )
        assert prefs.language == "fr"


class TestLanguageCRUD:
    """Test CRUD operations for language preferences."""

    def test_create_preferences_with_custom_language(self, db_session: Session):
        """Test creating user preferences with custom language."""
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate

        # Create user
        user_in = UserCreate(
            username="testlanguser",
            email="testlang@example.com",
            password="testpassword123",
            full_name="Test Lang User",
            role="user"
        )
        user_obj = user_crud.create(db_session, obj_in=user_in)

        # Update language to French
        from app.schemas.user_preferences import UserPreferencesUpdate
        updated_prefs = user_preferences.update_by_user_id(
            db_session,
            user_id=user_obj.id,
            obj_in=UserPreferencesUpdate(language="fr")
        )

        assert updated_prefs.language == "fr"

        # Clean up
        db_session.delete(user_obj)
        db_session.commit()

    def test_language_persists_in_database(self, db_session: Session):
        """Test that language changes are persisted in the database."""
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate
        from app.schemas.user_preferences import UserPreferencesUpdate

        # Create user
        user_in = UserCreate(
            username="testpersistuser",
            email="testpersist@example.com",
            password="testpassword123",
            full_name="Test Persist User",
            role="user"
        )
        user_obj = user_crud.create(db_session, obj_in=user_in)

        # Get initial preferences
        prefs = user_preferences.get_or_create_by_user_id(
            db_session, user_id=user_obj.id
        )
        assert prefs.language == "en"

        # Update to German
        updated_prefs = user_preferences.update_by_user_id(
            db_session,
            user_id=user_obj.id,
            obj_in=UserPreferencesUpdate(language="de")
        )
        db_session.commit()

        # Refresh from database
        db_session.expire(updated_prefs)
        db_session.refresh(updated_prefs)

        assert updated_prefs.language == "de"

        # Clean up
        db_session.delete(user_obj)
        db_session.commit()
