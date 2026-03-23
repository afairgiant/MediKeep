"""Regression tests for privilege escalation vulnerabilities.

Covers GHSA-xx23-8fx5-ph4q findings 1 and 2.
"""
import pytest
from fastapi.testclient import TestClient


class TestRegistrationPrivilegeEscalation:
    """Finding 1: Registration must not accept role from request body."""

    def test_register_with_admin_role_gets_user_role(self, client: TestClient, db_session):
        """Sending role=admin in registration should be ignored; user gets role=user."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "attacker_reg",
                "email": "attacker_reg@example.com",
                "password": "Attacker12345",
                "full_name": "Attacker",
                "role": "admin",
            },
        )
        assert response.status_code in (200, 201)
        data = response.json()
        assert data["role"] == "user"

    def test_register_with_staff_role_gets_user_role(self, client: TestClient, db_session):
        """Any non-default role in registration should be ignored."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "attacker_staff",
                "email": "attacker_staff@example.com",
                "password": "Attacker12345",
                "full_name": "Attacker",
                "role": "staff",
            },
        )
        assert response.status_code in (200, 201)
        data = response.json()
        assert data["role"] == "user"

    def test_register_without_role_defaults_to_user(self, client: TestClient, db_session):
        """Registration without explicit role should default to user."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "normal_reg",
                "email": "normal_reg@example.com",
                "password": "NormalUser1234",
                "full_name": "Normal User",
            },
        )
        assert response.status_code in (200, 201), (
            f"Registration failed unexpectedly: {response.status_code} {response.text}"
        )
        assert response.json()["role"] == "user"


class TestProfileUpdatePrivilegeEscalation:
    """Finding 2: Profile update must not accept role or is_active."""

    def test_self_update_cannot_set_role(self, client: TestClient, db_session, user_token_headers):
        """A normal user cannot escalate to admin via profile update."""
        response = client.put(
            "/api/v1/users/me",
            json={"role": "admin"},
            headers=user_token_headers,
        )
        if response.status_code == 200:
            assert response.json()["role"] == "user"
        else:
            # 422 (validation) or 403 (forbidden) are also acceptable
            assert response.status_code in (422, 403)

    def test_self_update_cannot_set_is_active(self, client: TestClient, db_session, user_token_headers):
        """A user cannot re-enable themselves via profile update."""
        before = client.get("/api/v1/users/me", headers=user_token_headers)
        assert before.status_code == 200
        original_is_active = before.json()["is_active"]

        response = client.put(
            "/api/v1/users/me",
            json={"is_active": not original_is_active},
            headers=user_token_headers,
        )
        if response.status_code == 200:
            after = client.get("/api/v1/users/me", headers=user_token_headers)
            assert after.json()["is_active"] == original_is_active, (
                "is_active was modified through self-update -- privilege escalation!"
            )
        else:
            assert response.status_code in (422, 403)

    def test_self_update_allows_safe_fields(self, client: TestClient, db_session, user_token_headers):
        """Users should still be able to update their own name and email."""
        response = client.put(
            "/api/v1/users/me",
            json={"full_name": "Updated Name"},
            headers=user_token_headers,
        )
        assert response.status_code == 200
        assert response.json()["full_name"] == "Updated Name"
