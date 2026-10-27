"""Helpers for tests that need a user with two-factor authentication turned on."""

import time
from typing import Optional

import pyotp
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.user import user as user_crud
from app.models.mfa import UserTotp
from app.models.models import User
from app.schemas.user import UserCreate
from app.services import two_factor_service
from app.services.two_factor_service import TOTP_STEP_SECONDS

PASSWORD = "Password123"
LOGIN_URL = "/api/v1/auth/login"
VERIFY_URL = "/api/v1/auth/two-factor/verify"


def make_user(db: Session, username: str) -> User:
    """A local user whose password is PASSWORD."""
    return user_crud.create(
        db,
        obj_in=UserCreate(
            username=username,
            email=f"{username}@example.com",
            password=PASSWORD,
            full_name=f"Test {username}",
            role="user",
        ),
    )


def enroll(db: Session, user: User) -> tuple[str, list[str]]:
    """Turn on TOTP for user through the service. Returns (secret, backup codes)."""
    secret, _ = two_factor_service.start_enrollment(db, user)
    # Confirm with the previous step, so the current one is still free for the test
    codes = two_factor_service.confirm_enrollment(db, user, code_at(secret, -1))
    return secret, codes


def code_at(secret: str, steps_from_now: int = 0, now: Optional[float] = None) -> str:
    """The authenticator code a phone would show the given number of steps from now."""
    current = int((time.time() if now is None else now) // TOTP_STEP_SECONDS)
    return pyotp.TOTP(secret).generate_otp(current + steps_from_now)


def totp_row(db: Session, user: User) -> Optional[UserTotp]:
    db.expire_all()
    return db.query(UserTotp).filter(UserTotp.user_id == user.id).first()


def login(client: TestClient, username: str, password: str = PASSWORD):
    """Password sign-in from a client holding no session cookie."""
    client.cookies.clear()
    return client.post(LOGIN_URL, data={"username": username, "password": password})


def request_ticket(client: TestClient, username: str) -> str:
    """Sign in with the password and return the mfa_ticket the login answers with."""
    response = login(client, username)
    assert response.status_code == 200
    return response.json()["mfa_ticket"]


def verify(client: TestClient, ticket: str, code: str, method: str = "totp"):
    return client.post(
        VERIFY_URL, json={"mfa_ticket": ticket, "code": code, "method": method}
    )
