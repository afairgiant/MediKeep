"""Access-token validation at the HTTP boundary."""

import base64
import hashlib
import hmac
import json
import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from tests.utils.user import create_random_user

PROTECTED_URL = "/api/v1/users/me/preferences"


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _token(claims: dict, key: str | None = None) -> str:
    """HS256 token built without the JWT library, so the wire format is pinned."""
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = _b64(json.dumps(claims).encode())
    digest = hmac.new(
        (key or settings.SECRET_KEY).encode(),
        f"{header}.{body}".encode(),
        hashlib.sha256,
    ).digest()
    return f"{header}.{body}.{_b64(digest)}"


def _get(client: TestClient, token: str):
    return client.get(PROTECTED_URL, headers={"Authorization": f"Bearer {token}"})


class TestTokenValidation:
    @pytest.fixture
    def username(self, db_session: Session) -> str:
        return create_random_user(db_session)["username"]

    def test_stdlib_signed_token_is_accepted(self, client: TestClient, username: str):
        now = int(time.time())
        token = _token({"sub": username, "iat": now, "exp": now + 300})
        assert _get(client, token).status_code == 200

    def test_future_iat_is_accepted(self, client: TestClient, username: str):
        now = int(time.time())
        token = _token({"sub": username, "iat": now + 120, "exp": now + 300})
        assert _get(client, token).status_code == 200

    def test_expired_token_is_rejected(self, client: TestClient, username: str):
        now = int(time.time())
        token = _token({"sub": username, "iat": now - 600, "exp": now - 60})
        assert _get(client, token).status_code == 401

    def test_wrong_key_is_rejected(self, client: TestClient, username: str):
        token = _token({"sub": username, "exp": int(time.time()) + 300}, key="x" * 64)
        assert _get(client, token).status_code == 401

    def test_unsigned_token_is_rejected(self, client: TestClient, username: str):
        header = _b64(json.dumps({"alg": "none", "typ": "JWT"}).encode())
        claims = {"sub": username, "exp": int(time.time()) + 300}
        token = f"{header}.{_b64(json.dumps(claims).encode())}."
        assert _get(client, token).status_code == 401

    def test_non_string_subject_is_rejected(self, client: TestClient):
        token = _token({"sub": 42, "exp": int(time.time()) + 300})
        assert _get(client, token).status_code == 401
