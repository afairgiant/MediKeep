"""
User utilities for testing.
"""
import random
import string
from typing import Dict

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.user import user as user_crud
from app.schemas.user import UserCreate
from app.core.utils.security import create_access_token


def random_lower_string() -> str:
    """Generate a random lowercase string."""
    return "".join(random.choices(string.ascii_lowercase, k=32))


def random_email() -> str:
    """Generate a random email address."""
    return f"{random_lower_string()}@{random_lower_string()}.com"


def create_random_user(db: Session) -> dict:
    """Create a random user for testing."""
    username = random_lower_string()
    # Generate password that meets validation requirements (letter + number)
    password = random_lower_string() + "123"
    email = random_email()
    full_name = f"Test {username.title()}"

    user_in = UserCreate(
        username=username,
        email=email,
        password=password,
        full_name=full_name,
        role="user"
    )

    user = user_crud.create(db=db, obj_in=user_in)
    db.commit()  # Commit to make user visible across all queries
    db.refresh(user)  # Refresh to get updated values
    return {
        "user": user,
        "password": password,
        "username": username,
        "email": email,
        "full_name": full_name
    }


def create_user_authentication_headers(*, client: TestClient, username: str, password: str) -> Dict[str, str]:
    """Create authentication headers by logging in with username and password."""
    data = {"username": username, "password": password}
    r = client.post("/api/v1/auth/login", data=data)
    response = r.json()
    auth_token = response["access_token"]
    headers = {"Authorization": f"Bearer {auth_token}"}
    return headers


def create_user_token_headers(username: str) -> Dict[str, str]:
    """Create authentication headers with a token for a specific username."""
    # Production API expects data dict with 'sub' key containing username
    access_token = create_access_token(data={"sub": username})
    headers = {"Authorization": f"Bearer {access_token}"}
    return headers


def create_admin_user(db: Session) -> dict:
    """Create an admin user for testing."""
    username = f"admin_{random_lower_string()}"
    # Generate password that meets validation requirements (letter + number)
    password = random_lower_string() + "123"
    email = random_email()
    full_name = f"Admin {username.title()}"

    user_in = UserCreate(
        username=username,
        email=email,
        password=password,
        full_name=full_name,
        role="admin"
    )

    user = user_crud.create(db=db, obj_in=user_in)
    db.commit()  # Commit to make user visible across all queries
    db.refresh(user)  # Refresh to get updated values
    return {
        "user": user,
        "password": password,
        "username": username,
        "email": email,
        "full_name": full_name
    }


def authenticate_user(client: TestClient, username: str, password: str) -> dict:
    """Authenticate a user and return the response."""
    data = {"username": username, "password": password}
    response = client.post("/api/v1/auth/login", data=data)
    return response.json()


def create_test_user_with_patient(db: Session) -> dict:
    """Create a test user with associated patient record and set as active patient."""
    from app.crud.patient import patient as patient_crud
    from app.schemas.patient import PatientCreate
    from datetime import date

    user_data = create_random_user(db)
    user = user_data["user"]

    # Create patient record
    patient_data = PatientCreate(
        first_name="Test",
        last_name="Patient",
        birth_date=date(1990, 1, 1),
        gender="M",
        address="123 Test Street"
    )
    patient = patient_crud.create_for_user(
        db=db,
        user_id=user.id,
        patient_data=patient_data
    )

    # CRITICAL: Set as active patient for multi-patient system
    user.active_patient_id = patient.id
    db.commit()
    db.refresh(user)

    user_data["patient"] = patient
    return user_data