"""Blood donations through the generic /admin/models/ routes (issue #1266)."""

from datetime import date, timedelta

import pytest

from app.models.enums import get_all_donation_types
from app.models.models import BloodDonation

BASE = "/api/v1/admin/models/blood_donation"


@pytest.fixture
def donation(db_session, test_patient):
    record = BloodDonation(
        patient_id=test_patient.id,
        donation_date=date(2026, 1, 15),
        donation_type="whole_blood",
        location="Community Center",
        systolic_bp=120,
        diastolic_bp=80,
        hemoglobin=14.2,
    )
    db_session.add(record)
    db_session.commit()
    db_session.refresh(record)
    return record


class TestBloodDonationAdmin:
    def test_listed_in_available_models(self, admin_client):
        response = admin_client.get("/api/v1/admin/models/")
        assert response.status_code == 200
        assert "blood_donation" in response.json()

    def test_metadata_offers_donation_type_choices(self, admin_client):
        response = admin_client.get(f"{BASE}/metadata")
        assert response.status_code == 200
        fields = {f["name"]: f for f in response.json()["fields"]}
        assert fields["donation_type"]["choices"] == get_all_donation_types()

    def test_list_records(self, admin_client, donation):
        response = admin_client.get(f"{BASE}/")
        assert response.status_code == 200
        items = response.json()["items"]
        assert [item["id"] for item in items] == [donation.id]
        assert items[0]["donation_type"] == "whole_blood"

    def test_get_record_includes_screening_fields(self, admin_client, donation):
        response = admin_client.get(f"{BASE}/{donation.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["systolic_bp"] == 120
        assert data["hemoglobin"] == 14.2

    def test_update_donation_date(self, admin_client, db_session, donation):
        response = admin_client.put(
            f"{BASE}/{donation.id}", json={"donation_date": "2026-02-01"}
        )
        assert response.status_code == 200
        db_session.refresh(donation)
        assert donation.donation_date == date(2026, 2, 1)

    def test_create_record(self, admin_client, test_patient):
        response = admin_client.post(
            f"{BASE}/",
            json={
                "patient_id": test_patient.id,
                "donation_date": "2026-03-01",
                "donation_type": "Plasma",
            },
        )
        assert response.status_code == 200
        assert response.json()["donation_type"] == "plasma"

    def test_update_normalizes_donation_type(self, admin_client, db_session, donation):
        response = admin_client.put(
            f"{BASE}/{donation.id}", json={"donation_type": "Plasma"}
        )
        assert response.status_code == 200
        db_session.refresh(donation)
        assert donation.donation_type == "plasma"

    @pytest.mark.parametrize(
        "payload",
        [
            {"donation_type": "lemonade"},
            {"donation_date": None},
            {"donation_date": (date.today() + timedelta(days=30)).isoformat()},
            {"hemoglobin": 500},
            {"systolic_bp": ""},
        ],
    )
    def test_update_rejects_invalid_fields(self, admin_client, donation, payload):
        response = admin_client.put(f"{BASE}/{donation.id}", json=payload)
        assert response.status_code == 422

    def test_update_rejects_bp_pair_against_stored_value(self, admin_client, donation):
        response = admin_client.put(f"{BASE}/{donation.id}", json={"systolic_bp": 70})
        assert 400 <= response.status_code < 500

    def test_update_full_form_payload(self, admin_client, db_session, donation):
        record = admin_client.get(f"{BASE}/{donation.id}").json()
        payload = {
            k: v
            for k, v in record.items()
            if k not in ("id", "created_at", "updated_at")
        }
        payload["notes"] = "Edited by admin"
        response = admin_client.put(f"{BASE}/{donation.id}", json=payload)
        assert response.status_code == 200
        db_session.refresh(donation)
        assert donation.notes == "Edited by admin"
        assert donation.patient_id == record["patient_id"]

    def test_delete_record(self, admin_client, db_session, donation):
        donation_id = donation.id
        response = admin_client.delete(f"{BASE}/{donation_id}")
        assert response.status_code == 200
        db_session.expire_all()
        assert db_session.get(BloodDonation, donation_id) is None

    def test_requires_admin(self, authenticated_client):
        response = authenticated_client.get(f"{BASE}/")
        assert response.status_code == 403
