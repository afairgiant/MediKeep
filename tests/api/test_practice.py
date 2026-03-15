"""
Test practice API endpoints.

Tests cover:
- Listing practices with practitioner counts
- Delete guard: cannot delete practice with active practitioners (409)
- Delete practice with 0 practitioners (200)
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.models import Practice as PracticeModel
from app.models.models import Practitioner as PractitionerModel


@pytest.fixture
def practice_with_practitioners(db_session: Session):
    """Create a practice with two practitioners."""
    practice = PracticeModel(name="Busy Clinic")
    db_session.add(practice)
    db_session.flush()

    p1 = PractitionerModel(
        name="Dr. Alpha", specialty="Cardiology", practice_id=practice.id
    )
    p2 = PractitionerModel(
        name="Dr. Beta", specialty="Neurology", practice_id=practice.id
    )
    db_session.add_all([p1, p2])
    db_session.commit()
    db_session.refresh(practice)
    return practice


@pytest.fixture
def empty_practice(db_session: Session):
    """Create a practice with no practitioners."""
    practice = PracticeModel(name="Empty Clinic")
    db_session.add(practice)
    db_session.commit()
    db_session.refresh(practice)
    return practice


class TestListPractices:
    """Test GET /api/v1/practices/ returns practitioner counts."""

    def test_list_includes_practitioner_count(
        self,
        authenticated_client: TestClient,
        practice_with_practitioners: PracticeModel,
        empty_practice: PracticeModel,
    ):
        response = authenticated_client.get("/api/v1/practices/")
        assert response.status_code == 200

        data = response.json()
        by_name = {p["name"]: p for p in data}

        assert by_name["Busy Clinic"]["practitioner_count"] == 2
        assert by_name["Empty Clinic"]["practitioner_count"] == 0


class TestDeletePractice:
    """Test DELETE /api/v1/practices/{id} guard logic."""

    def test_delete_practice_with_practitioners_returns_409(
        self,
        authenticated_client: TestClient,
        practice_with_practitioners: PracticeModel,
    ):
        response = authenticated_client.delete(
            f"/api/v1/practices/{practice_with_practitioners.id}"
        )
        assert response.status_code == 409
        assert "active practitioners" in response.json()["message"]

    def test_delete_empty_practice_succeeds(
        self,
        authenticated_client: TestClient,
        empty_practice: PracticeModel,
    ):
        response = authenticated_client.delete(
            f"/api/v1/practices/{empty_practice.id}"
        )
        assert response.status_code == 200
        assert "deleted successfully" in response.json()["message"]
