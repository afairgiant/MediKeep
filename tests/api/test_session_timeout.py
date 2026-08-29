"""
Test session timeout and JWT token expiration functionality.

`session_timeout_minutes` drives the *frontend inactivity timer*. It is not the JWT
lifetime, and these tests previously asserted that it was -- the contract changed in
4c4bb995 (cookie auth, #722) and they were left behind, failing for every timeout
below ACCESS_TOKEN_EXPIRE_MINUTES while passing for every value above it.

The contract they assert now, from `auth.py:401-403` and `users.py:213-216`:

1. The JWT must *outlive* the inactivity timer, so its lifetime is
   `max(ACCESS_TOKEN_EXPIRE_MINUTES, session_timeout_minutes)`. If the cookie expired
   first the user would get a hard 401 before the timer ever fired.
2. Login returns the preference so the frontend can arm its timer.
3. Changing the preference does **not** reissue the token -- JWT expiry is fixed at
   server config. See the DEFERRED note below for the one case where that shows.
4. A user with no explicit preference gets the column default.

**Deferred, filed in TECHNICAL_DEBT.md:** raising the preference above
ACCESS_TOKEN_EXPIRE_MINUTES mid-session leaves the old, shorter JWT in place until the
next login, which is the exact "cookie expires before the timer fires" case point 1
exists to prevent. Not exercised here; the tests below assert the behavior as built.
"""

from datetime import datetime, timedelta, timezone
from jose import jwt
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.crud.user_preferences import user_preferences
from app.models.user import UserPreferences
from app.schemas.user_preferences import UserPreferencesUpdate
from tests.utils.user import create_random_user

# The column default, so a change to it fails one assertion here rather than being
# restated as a literal in four places.
DEFAULT_SESSION_TIMEOUT_MINUTES = (
    UserPreferences.__table__.c.session_timeout_minutes.default.arg
)


class TestSessionTimeout:
    """Test session timeout functionality."""

    def test_login_returns_session_timeout(
        self, client: TestClient, db_session: Session
    ):
        """Test that login response includes session_timeout_minutes."""
        # Create a user with default preferences
        user_data = create_random_user(db_session)
        username = user_data["username"]
        password = user_data["password"]

        # Login
        response = client.post(
            "/api/v1/auth/login", data={"username": username, "password": password}
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "session_timeout_minutes" in data
        # The column default, read from the model so this test does not have to be
        # edited again when the default moves.
        assert data["session_timeout_minutes"] == DEFAULT_SESSION_TIMEOUT_MINUTES

    def test_login_jwt_token_uses_user_preference(
        self, client: TestClient, db_session: Session
    ):
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
            obj_in=UserPreferencesUpdate(session_timeout_minutes=custom_timeout),
        )

        # Login
        response = client.post(
            "/api/v1/auth/login", data={"username": username, "password": password}
        )

        assert response.status_code == 200
        data = response.json()
        token = data["access_token"]

        # Decode the JWT token to check expiration
        decoded = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )

        # The JWT outlives the inactivity timer: max(config, preference). 1440 is
        # above ACCESS_TOKEN_EXPIRE_MINUTES, so the preference wins here -- which is
        # why this one test kept passing while its siblings failed.
        now_timestamp = datetime.now(timezone.utc).timestamp()
        expected_lifetime = max(settings.ACCESS_TOKEN_EXPIRE_MINUTES, custom_timeout)
        expected_exp_timestamp = now_timestamp + (expected_lifetime * 60)
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

    def test_login_with_different_timeout_values(
        self, client: TestClient, db_session: Session
    ):
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
                obj_in=UserPreferencesUpdate(session_timeout_minutes=timeout_minutes),
            )

            # Login
            response = client.post(
                "/api/v1/auth/login", data={"username": username, "password": password}
            )

            assert response.status_code == 200
            data = response.json()

            # Verify response timeout
            assert data["session_timeout_minutes"] == timeout_minutes

            # Decode token and verify expiration using timestamps
            decoded = jwt.decode(
                data["access_token"],
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
            )

            # Below ACCESS_TOKEN_EXPIRE_MINUTES the config floor applies; above it the
            # preference does. test_timeouts deliberately straddles the boundary.
            now_timestamp = datetime.now(timezone.utc).timestamp()
            expected_lifetime = max(
                settings.ACCESS_TOKEN_EXPIRE_MINUTES, timeout_minutes
            )
            expected_exp_timestamp = now_timestamp + (expected_lifetime * 60)
            token_exp_timestamp = decoded["exp"]
            time_diff = abs(token_exp_timestamp - expected_exp_timestamp)

            assert time_diff < 5, (
                f"Timeout {timeout_minutes}min: expected a "
                f"{expected_lifetime}min JWT, got exp {token_exp_timestamp}"
            )

    def test_update_timeout_does_not_reissue_token(
        self, authenticated_client: TestClient
    ):
        """Changing the timeout persists it and leaves the token alone.

        Was `test_update_preferences_regenerates_token`, asserting the reverse. The
        endpoint stopped reissuing when JWT lifetime stopped tracking this preference
        (`users.py:213-216`); the test kept asserting a `new_token` key that no
        response carries any more.
        """
        # 720 is above ACCESS_TOKEN_EXPIRE_MINUTES deliberately: this is the case
        # where a reissue would change the JWT if one happened.
        new_timeout = 720  # 12 hours

        response = authenticated_client.put(
            "/api/v1/users/me/preferences",
            json={"session_timeout_minutes": new_timeout},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["session_timeout_minutes"] == new_timeout
        assert "new_token" not in data
        assert "token_type" not in data

    def test_update_non_timeout_preference_does_not_reissue_token(
        self, authenticated_client: TestClient
    ):
        """A non-timeout preference update carries no token either.

        Renamed: "only_regenerates_on_timeout_change" described a rule that no longer
        holds in either direction -- nothing reissues now.
        """
        # Update a different preference (not session_timeout_minutes)
        response = authenticated_client.put(
            "/api/v1/users/me/preferences", json={"unit_system": "metric"}
        )

        assert response.status_code == 200
        data = response.json()

        assert "new_token" not in data
        assert data["unit_system"] == "metric"

    def test_update_timeout_to_same_value_carries_no_token(
        self, authenticated_client: TestClient
    ):
        """Setting the timeout to its current value is still a plain update."""
        # Get current timeout
        prefs_response = authenticated_client.get("/api/v1/users/me/preferences")
        current_timeout = prefs_response.json()["session_timeout_minutes"]

        # Update to same value
        response = authenticated_client.put(
            "/api/v1/users/me/preferences",
            json={"session_timeout_minutes": current_timeout},
        )

        assert response.status_code == 200
        data = response.json()

        assert "new_token" not in data

    def test_default_timeout_when_no_preference(
        self, client: TestClient, db_session: Session
    ):
        """Test that default timeout is used when user has no preference."""
        # Create user without setting custom timeout
        user_data = create_random_user(db_session)
        username = user_data["username"]
        password = user_data["password"]

        # Login
        response = client.post(
            "/api/v1/auth/login", data={"username": username, "password": password}
        )

        assert response.status_code == 200
        data = response.json()

        # Should use the column default for new users
        assert data["session_timeout_minutes"] == DEFAULT_SESSION_TIMEOUT_MINUTES

        # Verify token expiration using timestamps
        decoded = jwt.decode(
            data["access_token"], settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )

        # The default is below ACCESS_TOKEN_EXPIRE_MINUTES, so the config floor sets
        # the JWT lifetime here, not the preference.
        now_timestamp = datetime.now(timezone.utc).timestamp()
        expected_lifetime = max(
            settings.ACCESS_TOKEN_EXPIRE_MINUTES, DEFAULT_SESSION_TIMEOUT_MINUTES
        )
        expected_exp_timestamp = now_timestamp + (expected_lifetime * 60)
        token_exp_timestamp = decoded["exp"]
        time_diff = abs(token_exp_timestamp - expected_exp_timestamp)

        assert time_diff < 5

    def test_jwt_token_contains_required_claims(
        self, client: TestClient, db_session: Session
    ):
        """Test that JWT tokens contain all required claims."""
        # Create and login user
        user_data = create_random_user(db_session)
        response = client.post(
            "/api/v1/auth/login",
            data={"username": user_data["username"], "password": user_data["password"]},
        )

        token = response.json()["access_token"]
        decoded = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
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
            obj_in=UserPreferencesUpdate(session_timeout_minutes=5),
        )

        response_short = client.post(
            "/api/v1/auth/login",
            data={
                "username": user_data_short["username"],
                "password": user_data_short["password"],
            },
        )
        assert response_short.status_code == 200
        assert response_short.json()["session_timeout_minutes"] == 5

        # Test very long timeout (1440 minutes - 24 hours)
        user_data_long = create_random_user(db_session)
        user_preferences.update_by_user_id(
            db_session,
            user_id=user_data_long["user"].id,
            obj_in=UserPreferencesUpdate(session_timeout_minutes=1440),
        )

        response_long = client.post(
            "/api/v1/auth/login",
            data={
                "username": user_data_long["username"],
                "password": user_data_long["password"],
            },
        )
        assert response_long.status_code == 200
        assert response_long.json()["session_timeout_minutes"] == 1440
