"""
Test session timeout and JWT token expiration functionality.

Tests verify that:
1. JWT tokens are created with user's session_timeout_minutes preference
2. Tokens are regenerated when user changes their timeout
3. Default timeout is used when no preference is set
4. All authentication flows (login, SSO) respect user preferences
"""
from datetime import datetime, timedelta, timezone
from jose import jwt
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.crud.user_preferences import user_preferences
from app.schemas.user_preferences import UserPreferencesUpdate
from tests.utils.user import create_random_user


class TestSessionTimeout:
    """Test session timeout functionality."""

    def test_login_returns_session_timeout(self, client: TestClient, db_session: Session):
        """Test that login response includes session_timeout_minutes."""
        # Create a user with default preferences
        user_data = create_random_user(db_session)
        username = user_data["username"]
        password = user_data["password"]

        # Login
        response = client.post(
            "/api/v1/auth/login",
            data={"username": username, "password": password}
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "session_timeout_minutes" in data
        # Should have default timeout (30 minutes or config default)
        assert data["session_timeout_minutes"] in [30, settings.ACCESS_TOKEN_EXPIRE_MINUTES]

    def test_login_jwt_token_uses_user_preference(self, client: TestClient, db_session: Session):
        """Test that JWT token expiration matches user's session timeout preference."""
        # Create a user
        user_data = create_random_user(db_session)
        username = user_data["username"]
        password = user_data["password"]
        user_id = user_data["user"].id

        # Set custom session timeout for this user (1440 minutes = 24 hours)
        custom_timeout = 1440
        user_preferences.update_by_user_id(
            db_session,
            user_id=user_id,
            obj_in=UserPreferencesUpdate(session_timeout_minutes=custom_timeout)
        )

        # Login
        response = client.post(
            "/api/v1/auth/login",
            data={"username": username, "password": password}
        )

        assert response.status_code == 200
        data = response.json()
        token = data["access_token"]

        # Decode the JWT token to check expiration
        decoded = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )

        # Calculate expected expiration time (current time + custom_timeout minutes)
        # Both times should be in UTC for comparison
        now_timestamp = datetime.now(timezone.utc).timestamp()
        expected_exp_timestamp = now_timestamp + (custom_timeout * 60)
        token_exp_timestamp = decoded["exp"]

        # Allow 5 second tolerance for test execution time
        time_diff = abs(token_exp_timestamp - expected_exp_timestamp)
        assert time_diff < 5, (
            f"Token expiration mismatch. "
            f"Expected ~{expected_exp_timestamp}, got {token_exp_timestamp} "
            f"(diff: {time_diff}s)"
        )

        # Verify response includes correct timeout
        assert data["session_timeout_minutes"] == custom_timeout

    def test_login_with_different_timeout_values(self, client: TestClient, db_session: Session):
        """Test JWT tokens with various timeout values."""
        test_timeouts = [5, 30, 60, 480, 1440]  # 5 min to 24 hours

        for timeout_minutes in test_timeouts:
            # Create a new user for each test
            user_data = create_random_user(db_session)
            username = user_data["username"]
            password = user_data["password"]
            user_id = user_data["user"].id

            # Set specific timeout
            user_preferences.update_by_user_id(
                db_session,
                user_id=user_id,
                obj_in=UserPreferencesUpdate(session_timeout_minutes=timeout_minutes)
            )

            # Login
            response = client.post(
                "/api/v1/auth/login",
                data={"username": username, "password": password}
            )

            assert response.status_code == 200
            data = response.json()

            # Verify response timeout
            assert data["session_timeout_minutes"] == timeout_minutes

            # Decode token and verify expiration using timestamps
            decoded = jwt.decode(
                data["access_token"],
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM]
            )

            now_timestamp = datetime.now(timezone.utc).timestamp()
            expected_exp_timestamp = now_timestamp + (timeout_minutes * 60)
            token_exp_timestamp = decoded["exp"]
            time_diff = abs(token_exp_timestamp - expected_exp_timestamp)

            assert time_diff < 5, (
                f"Timeout {timeout_minutes}min: Token exp mismatch"
            )

    def test_update_preferences_regenerates_token(
        self, authenticated_client: TestClient
    ):
        """Test that updating session timeout generates a new token."""
        # Update session timeout to a new value
        new_timeout = 720  # 12 hours

        response = authenticated_client.put(
            "/api/v1/users/me/preferences",
            json={"session_timeout_minutes": new_timeout}
        )

        assert response.status_code == 200
        data = response.json()

        # Should include new token
        assert "new_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        assert data["session_timeout_minutes"] == new_timeout

        # Decode the new token and verify expiration using timestamps
        new_token = data["new_token"]
        decoded = jwt.decode(
            new_token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )

        now_timestamp = datetime.now(timezone.utc).timestamp()
        expected_exp_timestamp = now_timestamp + (new_timeout * 60)
        token_exp_timestamp = decoded["exp"]
        time_diff = abs(token_exp_timestamp - expected_exp_timestamp)

        assert time_diff < 5, "New token expiration doesn't match updated timeout"

    def test_update_preferences_only_regenerates_on_timeout_change(
        self, authenticated_client: TestClient
    ):
        """Test that updating non-timeout preferences doesn't regenerate token."""
        # Update a different preference (not session_timeout_minutes)
        response = authenticated_client.put(
            "/api/v1/users/me/preferences",
            json={"unit_system": "metric"}
        )

        assert response.status_code == 200
        data = response.json()

        # Should NOT include new token
        assert "new_token" not in data
        assert data["unit_system"] == "metric"

    def test_update_timeout_to_same_value_no_regeneration(
        self, authenticated_client: TestClient
    ):
        """Test that setting timeout to current value doesn't regenerate token."""
        # Get current timeout
        prefs_response = authenticated_client.get("/api/v1/users/me/preferences")
        current_timeout = prefs_response.json()["session_timeout_minutes"]

        # Update to same value
        response = authenticated_client.put(
            "/api/v1/users/me/preferences",
            json={"session_timeout_minutes": current_timeout}
        )

        assert response.status_code == 200
        data = response.json()

        # Should NOT regenerate token (value unchanged)
        assert "new_token" not in data

    def test_default_timeout_when_no_preference(self, client: TestClient, db_session: Session):
        """Test that default timeout is used when user has no preference."""
        # Create user without setting custom timeout
        user_data = create_random_user(db_session)
        username = user_data["username"]
        password = user_data["password"]

        # Login
        response = client.post(
            "/api/v1/auth/login",
            data={"username": username, "password": password}
        )

        assert response.status_code == 200
        data = response.json()

        # Should use database default (30 minutes) for new users
        # Database default is defined in models.py: session_timeout_minutes = Column(Integer, default=30)
        expected_default = 30
        assert data["session_timeout_minutes"] == expected_default

        # Verify token expiration using timestamps
        decoded = jwt.decode(
            data["access_token"],
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )

        now_timestamp = datetime.now(timezone.utc).timestamp()
        expected_exp_timestamp = now_timestamp + (expected_default * 60)
        token_exp_timestamp = decoded["exp"]
        time_diff = abs(token_exp_timestamp - expected_exp_timestamp)

        assert time_diff < 5

    def test_jwt_token_contains_required_claims(self, client: TestClient, db_session: Session):
        """Test that JWT tokens contain all required claims."""
        # Create and login user
        user_data = create_random_user(db_session)
        response = client.post(
            "/api/v1/auth/login",
            data={"username": user_data["username"], "password": user_data["password"]}
        )

        token = response.json()["access_token"]
        decoded = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )

        # Verify required claims
        assert "sub" in decoded  # Subject (username)
        assert "exp" in decoded  # Expiration
        assert "user_id" in decoded
        assert "role" in decoded
        assert decoded["sub"] == user_data["username"]
        assert decoded["user_id"] == user_data["user"].id

    def test_extreme_timeout_values(self, client: TestClient, db_session: Session):
        """Test that system handles extreme timeout values correctly."""
        # Test very short timeout (5 minutes - minimum)
        user_data_short = create_random_user(db_session)
        user_preferences.update_by_user_id(
            db_session,
            user_id=user_data_short["user"].id,
            obj_in=UserPreferencesUpdate(session_timeout_minutes=5)
        )

        response_short = client.post(
            "/api/v1/auth/login",
            data={"username": user_data_short["username"], "password": user_data_short["password"]}
        )
        assert response_short.status_code == 200
        assert response_short.json()["session_timeout_minutes"] == 5

        # Test very long timeout (1440 minutes - 24 hours)
        user_data_long = create_random_user(db_session)
        user_preferences.update_by_user_id(
            db_session,
            user_id=user_data_long["user"].id,
            obj_in=UserPreferencesUpdate(session_timeout_minutes=1440)
        )

        response_long = client.post(
            "/api/v1/auth/login",
            data={"username": user_data_long["username"], "password": user_data_long["password"]}
        )
        assert response_long.status_code == 200
        assert response_long.json()["session_timeout_minutes"] == 1440
