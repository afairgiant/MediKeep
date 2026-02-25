"""
Test authentication endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.user import user as user_crud
from app.schemas.user import UserCreate
from tests.utils.user import create_random_user


class TestAuthEndpoints:
    """Test authentication-related endpoints."""

    def test_login_success(self, client: TestClient, db_session: Session):
        """Test successful login."""
        # Create a test user
        user_data = create_random_user(db_session)
        username = user_data["username"]
        password = user_data["password"]

        # Attempt login
        response = client.post(
            "/api/v1/auth/login",
            data={"username": username, "password": password}
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        # Token response doesn't include user data, just the token

    def test_login_invalid_credentials(self, client: TestClient):
        """Test login with invalid credentials."""
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "nonexistent", "password": "wrongpassword"}
        )

        assert response.status_code == 401
        data = response.json()
        # Production API uses structured error format
        assert "message" in data or "detail" in data

    def test_login_missing_fields(self, client: TestClient):
        """Test login with missing fields."""
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "testuser"}  # Missing password
        )

        assert response.status_code == 422

    def test_register_success(self, client: TestClient, db_session: Session):
        """Test successful user registration."""
        user_data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "newpassword123",
            "full_name": "New User",
            "role": "user"  # Required field
        }

        response = client.post("/api/v1/auth/register", json=user_data)

        assert response.status_code == 200  # Changed from 201
        data = response.json()
        assert data["username"] == user_data["username"]
        assert data["email"] == user_data["email"]
        assert data["full_name"] == user_data["full_name"]
        assert "password" not in data  # Password should not be returned
        assert "id" in data

        # Verify user was created in database
        db_user = user_crud.get_by_username(db_session, username=user_data["username"])
        assert db_user is not None
        assert db_user.username == user_data["username"]

    def test_register_duplicate_username(self, client: TestClient, db_session: Session):
        """Test registration with duplicate username."""
        # Create a user first
        user_data = create_random_user(db_session)
        existing_username = user_data["username"]

        # Try to register with same username
        new_user_data = {
            "username": existing_username,
            "email": "different@example.com",
            "password": "password123",
            "full_name": "Different User",
            "role": "user"
        }

        response = client.post("/api/v1/auth/register", json=new_user_data)

        assert response.status_code == 409
        data = response.json()
        # Check message in either detail or message field
        error_msg = (data.get("detail") or data.get("message", "")).lower()
        assert "already registered" in error_msg or "already exists" in error_msg

    def test_register_duplicate_email(self, client: TestClient, db_session: Session):
        """Test registration with duplicate email."""
        # Create a user first
        user_data = create_random_user(db_session)
        existing_email = user_data["email"]

        # Try to register with same email
        new_user_data = {
            "username": "differentuser",
            "email": existing_email,
            "password": "password123",
            "full_name": "Different User",
            "role": "user"
        }

        response = client.post("/api/v1/auth/register", json=new_user_data)

        assert response.status_code == 409
        data = response.json()
        # Check message in either detail or message field
        error_msg = (data.get("detail") or data.get("message", "")).lower()
        assert "already registered" in error_msg or "already exists" in error_msg

    def test_register_invalid_email(self, client: TestClient):
        """Test registration with invalid email format."""
        user_data = {
            "username": "testuser",
            "email": "invalid-email",
            "password": "password123",
            "full_name": "Test User",
            "role": "user"
        }

        response = client.post("/api/v1/auth/register", json=user_data)

        assert response.status_code == 422
        data = response.json()
        # Validation errors can be in detail (list) or message (string)
        if "detail" in data:
            error_detail = data["detail"]
            assert any("email" in str(error).lower() for error in error_detail)
        else:
            error_msg = data.get("message", "").lower()
            assert "email" in error_msg

    def test_register_weak_password(self, client: TestClient):
        """Test registration with weak password."""
        user_data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "123",  # Too short
            "full_name": "Test User"
        }

        response = client.post("/api/v1/auth/register", json=user_data)

        assert response.status_code == 422

    def test_register_missing_fields(self, client: TestClient):
        """Test registration with missing required fields."""
        incomplete_data = {
            "username": "testuser",
            # Missing email, password, full_name
        }

        response = client.post("/api/v1/auth/register", json=incomplete_data)

        assert response.status_code == 422

    def test_register_creates_patient_record(self, client: TestClient, db_session: Session):
        """Test that registration automatically creates a patient record."""
        from app.crud.patient import patient as patient_crud

        user_data = {
            "username": "patientuser",
            "email": "patient@example.com",
            "password": "password123",
            "full_name": "Patient User",
            "role": "user"
        }

        response = client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code == 200

        # Get the created user
        user = user_crud.get_by_username(db_session, username=user_data["username"])
        assert user is not None

        # Check that patient record was created
        patient = patient_crud.get_by_user_id(db_session, user_id=user.id)
        assert patient is not None
        assert patient.user_id == user.id

    def test_logout_success(self, authenticated_client: TestClient):
        """Test successful logout."""
        response = authenticated_client.post("/api/v1/auth/logout")

        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    def test_logout_without_auth(self, client: TestClient):
        """Test logout without authentication."""
        response = client.post("/api/v1/auth/logout")

        assert response.status_code == 401

    @pytest.mark.parametrize("invalid_token", [
        "invalid_token",
        "Bearer invalid_token",
        "",
        "NotBearer valid_looking_token"
    ])
    def test_invalid_auth_tokens(self, client: TestClient, invalid_token: str):
        """Test various invalid authentication tokens."""
        headers = {"Authorization": invalid_token} if invalid_token else {}
        
        response = client.get("/api/v1/patients/me", headers=headers)

        assert response.status_code == 401

    def test_token_expiry_handling(self, client: TestClient, db_session: Session):
        """Test handling of expired tokens."""
        # This would require mocking time or creating an expired token
        # For now, we'll test with an invalid token format
        headers = {"Authorization": "Bearer expired.token.here"}
        
        response = client.get("/api/v1/patients/me", headers=headers)

        assert response.status_code == 401

    def test_concurrent_logins(self, client: TestClient, db_session: Session):
        """Test multiple concurrent login attempts."""
        import concurrent.futures
        
        # Create a test user
        user_data = create_random_user(db_session)
        username = user_data["username"]
        password = user_data["password"]

        def attempt_login():
            return client.post(
                "/api/v1/auth/login",
                data={"username": username, "password": password}
            )

        # Attempt multiple concurrent logins
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(attempt_login) for _ in range(5)]
            responses = [future.result() for future in concurrent.futures.as_completed(futures)]

        # All should succeed
        for response in responses:
            assert response.status_code == 200
            assert "access_token" in response.json()

    def test_register_auto_redirect_integration(self, client: TestClient, db_session: Session):
        """Test that registration sets up user for patient info redirect."""
        user_data = {
            "username": "redirectuser",
            "email": "redirect@example.com",
            "password": "password123",
            "full_name": "Redirect User",
            "role": "user"
        }

        # Register user
        response = client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code == 200

        # Login and verify patient record exists with placeholder data
        login_response = client.post(
            "/api/v1/auth/login",
            data={"username": user_data["username"], "password": user_data["password"]}
        )
        assert login_response.status_code == 200
        
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Check patient record
        patient_response = client.get("/api/v1/patients/me", headers=headers)
        assert patient_response.status_code == 200
        
        patient_data = patient_response.json()
        # Should have placeholder data indicating need for completion
        assert patient_data["first_name"] == "First Name"
        assert patient_data["last_name"] == "Last Name"
        assert patient_data["address"] == "Please update your address"

    # ------------------------------------------------------------------
    # must_change_password flag tests
    # ------------------------------------------------------------------

    def test_login_response_includes_must_change_password_false(
        self, client: TestClient, db_session: Session
    ):
        """Login for a normal user should return must_change_password: false."""
        user_data = create_random_user(db_session)

        response = client.post(
            "/api/v1/auth/login",
            data={"username": user_data["username"], "password": user_data["password"]},
        )

        assert response.status_code == 200
        data = response.json()
        assert "must_change_password" in data
        assert data["must_change_password"] is False

    def test_login_response_must_change_password_true_for_flagged_user(
        self, client: TestClient, db_session: Session
    ):
        """Login should return must_change_password: true when the flag is set on the user."""
        user_data = create_random_user(db_session)
        db_user = user_data["user"]

        # Set the forced-change flag directly (simulates emergency admin creation)
        db_user.must_change_password = True
        db_session.commit()

        response = client.post(
            "/api/v1/auth/login",
            data={"username": user_data["username"], "password": user_data["password"]},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["must_change_password"] is True

    def test_change_password_clears_must_change_password_flag(
        self, client: TestClient, db_session: Session
    ):
        """Changing password via /change-password should clear the must_change_password flag."""
        user_data = create_random_user(db_session)
        db_user = user_data["user"]
        original_password = user_data["password"]
        new_password = original_password + "_new"

        # Set the forced-change flag
        db_user.must_change_password = True
        db_session.commit()

        # Confirm the flag is set in the login response
        login_response = client.post(
            "/api/v1/auth/login",
            data={"username": user_data["username"], "password": original_password},
        )
        assert login_response.status_code == 200
        assert login_response.json()["must_change_password"] is True

        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Change the password
        change_response = client.post(
            "/api/v1/auth/change-password",
            json={"currentPassword": original_password, "newPassword": new_password},
            headers=headers,
        )
        assert change_response.status_code == 200

        # Login again with the new password and confirm flag is cleared
        re_login_response = client.post(
            "/api/v1/auth/login",
            data={"username": user_data["username"], "password": new_password},
        )
        assert re_login_response.status_code == 200
        assert re_login_response.json()["must_change_password"] is False