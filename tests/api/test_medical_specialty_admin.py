"""
API tests for medical_specialty admin CRUD via the generic /admin/models/ routes
and verification that the practitioner admin surface exposes specialty_id/name.
"""

import pytest

from app.models.models import MedicalSpecialty, Practitioner


BASE = "/api/v1/admin/models/medical_specialty"


class TestMedicalSpecialtyAdminCRUD:
    """CRUD via the generic admin Model registry."""

    def test_list_empty(self, admin_client):
        response = admin_client.get(f"{BASE}/")
        assert response.status_code == 200
        assert response.json()["items"] == []

    def test_create_specialty(self, admin_client):
        response = admin_client.post(
            f"{BASE}/",
            json={"name": "Cardiology", "description": "Heart", "is_active": True},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Cardiology"
        assert data["description"] == "Heart"
        assert data["is_active"] is True

    def test_create_duplicate_name_rejected(self, admin_client, db_session):
        db_session.add(MedicalSpecialty(name="Dermatology", is_active=True))
        db_session.commit()

        response = admin_client.post(
            f"{BASE}/", json={"name": "Dermatology"}
        )
        # Either 400 (unique integrity) or 500 depending on error translation.
        # Accept any non-2xx — the exact code is less important than the rejection.
        assert response.status_code >= 400

    def test_update_specialty(self, admin_client, db_session):
        spec = MedicalSpecialty(name="Neurology", is_active=True)
        db_session.add(spec)
        db_session.commit()
        db_session.refresh(spec)

        response = admin_client.put(
            f"{BASE}/{spec.id}",
            json={"description": "Brain & nerves", "is_active": False},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "Brain & nerves"
        assert data["is_active"] is False

    def test_delete_unreferenced_specialty(self, admin_client, db_session):
        spec = MedicalSpecialty(name="Hematology", is_active=True)
        db_session.add(spec)
        db_session.commit()
        db_session.refresh(spec)

        response = admin_client.delete(f"{BASE}/{spec.id}")
        assert response.status_code == 200

    def test_delete_referenced_specialty_returns_409(self, admin_client, db_session):
        spec = MedicalSpecialty(name="Oncology", is_active=True)
        db_session.add(spec)
        db_session.flush()
        practitioner = Practitioner(
            name="Dr. Ref",
            specialty="Oncology",
            specialty_id=spec.id,
        )
        db_session.add(practitioner)
        db_session.commit()

        response = admin_client.delete(f"{BASE}/{spec.id}")
        assert response.status_code == 409


class TestPractitionerAdminExposesSpecialtyId:
    """The practitioner admin list/detail should include specialty_id + specialty_name."""

    def test_list_includes_specialty_fields(self, admin_client, db_session):
        spec = MedicalSpecialty(name="Pulmonology", is_active=True)
        db_session.add(spec)
        db_session.flush()
        practitioner = Practitioner(
            name="Dr. Lung",
            specialty="Pulmonology",
            specialty_id=spec.id,
        )
        db_session.add(practitioner)
        db_session.commit()

        response = admin_client.get("/api/v1/admin/models/practitioner/")
        assert response.status_code == 200
        items = response.json()["items"]
        assert len(items) >= 1
        row = next(i for i in items if i["name"] == "Dr. Lung")
        assert row["specialty_id"] == spec.id
        assert row["specialty_name"] == "Pulmonology"


class TestPracticeAdminRegistered:
    """Practice should be reachable via the generic admin model registry too."""

    def test_practice_is_listed(self, admin_client):
        response = admin_client.get("/api/v1/admin/models/")
        assert response.status_code == 200
        assert "practice" in response.json()
        assert "medical_specialty" in response.json()

    def test_practice_metadata(self, admin_client):
        response = admin_client.get("/api/v1/admin/models/practice/metadata")
        assert response.status_code == 200
        data = response.json()
        field_names = [f["name"] for f in data["fields"]]
        assert "name" in field_names
        assert "locations" in field_names
