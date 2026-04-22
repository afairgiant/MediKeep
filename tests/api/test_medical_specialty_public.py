"""API tests for the non-admin /medical-specialties router.

Covers list and create, including case-insensitive name dedup.
"""
from fastapi.testclient import TestClient

from app.models.models import MedicalSpecialty


BASE = "/api/v1/medical-specialties/"


class TestListSpecialties:
    def test_returns_only_active(self, authenticated_client: TestClient, db_session):
        db_session.add_all(
            [
                MedicalSpecialty(name="Active A", is_active=True),
                MedicalSpecialty(name="Hidden", is_active=False),
                MedicalSpecialty(name="Active B", is_active=True),
            ]
        )
        db_session.commit()

        response = authenticated_client.get(BASE)
        assert response.status_code == 200
        names = {item["name"] for item in response.json()}
        assert "Active A" in names
        assert "Active B" in names
        assert "Hidden" not in names

    def test_requires_authentication(self, client: TestClient):
        response = client.get(BASE)
        assert response.status_code == 401


class TestCreateSpecialty:
    def test_create_new_specialty_returns_201(self, authenticated_client: TestClient):
        response = authenticated_client.post(
            BASE,
            json={"name": "User-Created", "description": "via form quick-add"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "User-Created"
        assert data["description"] == "via form quick-add"
        assert data["is_active"] is True

    def test_create_matching_existing_name_returns_200(
        self, authenticated_client: TestClient, db_session
    ):
        existing = MedicalSpecialty(name="Gastroenterology", is_active=True)
        db_session.add(existing)
        db_session.commit()
        db_session.refresh(existing)

        response = authenticated_client.post(
            BASE, json={"name": "gastroenterology"}
        )
        assert response.status_code == 200
        assert response.json()["id"] == existing.id

    def test_requires_authentication(self, client: TestClient):
        response = client.post(BASE, json={"name": "Unauthorized"})
        assert response.status_code == 401
