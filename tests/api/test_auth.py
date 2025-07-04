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
        assert "user" in data
        assert data["user"]["username"] == username

    def test_login_invalid_credentials(self, client: TestClient):
        """Test login with invalid credentials."""
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "nonexistent", "password": "wrongpassword"}
        )

        assert response.status_code == 401
        assert "detail" in response.json()

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
            "full_name": "New User"
        }

        response = client.post("/api/v1/auth/register", json=user_data)

        assert response.status_code == 201
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
            "full_name": "Different User"
        }

        response = client.post("/api/v1/auth/register", json=new_user_data)

        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()

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
            "full_name": "Different User"
        }

        response = client.post("/api/v1/auth/register", json=new_user_data)

        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()

    def test_register_invalid_email(self, client: TestClient):
        """Test registration with invalid email format."""
        user_data = {
            "username": "testuser",
            "email": "invalid-email",
            "password": "password123",
            "full_name": "Test User"
        }

        response = client.post("/api/v1/auth/register", json=user_data)

        assert response.status_code == 422
        error_detail = response.json()["detail"]
        assert any("email" in str(error).lower() for error in error_detail)

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
            "full_name": "Patient User"
        }

        response = client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code == 201

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
            "full_name": "Redirect User"
        }

        # Register user
        response = client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code == 201

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