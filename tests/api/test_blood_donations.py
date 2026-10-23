"""Tests for Blood Donation API endpoints."""

from datetime import date, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.utils.datetime_utils import get_facility_timezone
from app.crud.activity_log import activity_log as activity_log_crud
from app.crud.patient import patient as patient_crud
from app.models.activity_log import EntityType
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers

URL = "/api/v1/blood-donations/"


def _facility_today() -> date:
    return datetime.now(get_facility_timezone()).date()


def _payload(patient_id: int, **overrides):
    data = {
        "donation_date": "2026-09-01",
        "donation_type": "whole_blood",
        "patient_id": patient_id,
    }
    data.update(overrides)
    return data


def _user_with_patient(db_session: Session, first_name: str):
    user_data = create_random_user(db_session)
    patient = patient_crud.create_for_user(
        db_session,
        user_id=user_data["user"].id,
        patient_data=PatientCreate(
            first_name=first_name, last_name="Donor", birth_date=date(1990, 1, 1), gender="M"
        ),
    )
    user_data["user"].active_patient_id = patient.id
    db_session.commit()
    return patient, create_user_token_headers(user_data["user"].username)


class TestBloodDonationsAPI:
    def test_create_with_screening_values(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        patient_id = user_with_patient["patient"].id
        response = client.post(
            URL,
            json=_payload(
                patient_id,
                location="DRK",
                systolic_bp=125,
                diastolic_bp=80,
                temperature=98.4,
                hemoglobin=14.5,
                tags=["drk"],
            ),
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["donation_type"] == "whole_blood"
        assert data["hemoglobin"] == 14.5
        assert data["tags"] == ["drk"]

    def test_create_logs_activity_with_donation_date(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        patient_id = user_with_patient["patient"].id
        response = client.post(
            URL,
            json=_payload(patient_id, donation_date="2026-09-01"),
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text

        activities = activity_log_crud.get_by_entity(
            db_session,
            entity_type=EntityType.BLOOD_DONATION,
            entity_id=response.json()["id"],
        )
        assert len(activities) == 1
        assert "2026-09-01" in activities[0].description

    def test_list_newest_first(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        patient_id = user_with_patient["patient"].id
        client.post(URL, json=_payload(patient_id, donation_date="2026-01-01"), headers=authenticated_headers)
        client.post(URL, json=_payload(patient_id, donation_date="2026-06-01"), headers=authenticated_headers)

        response = client.get(URL, headers=authenticated_headers)
        assert response.status_code == 200
        assert [d["donation_date"] for d in response.json()] == ["2026-06-01", "2026-01-01"]

    def test_get_update_delete(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        patient_id = user_with_patient["patient"].id
        donation_id = client.post(
            URL, json=_payload(patient_id), headers=authenticated_headers
        ).json()["id"]

        assert client.get(f"{URL}{donation_id}", headers=authenticated_headers).status_code == 200

        response = client.put(
            f"{URL}{donation_id}", json={"donation_type": "plasma"}, headers=authenticated_headers
        )
        assert response.status_code == 200
        assert response.json()["donation_type"] == "plasma"

        assert client.delete(f"{URL}{donation_id}", headers=authenticated_headers).status_code == 200
        assert client.get(f"{URL}{donation_id}", headers=authenticated_headers).status_code == 404

    def test_update_rejects_invalid_merged_blood_pressure(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        """A partial update that only supplies one BP field still gets validated
        against the *merged* state (see app/crud/blood_donation.py update()).
        """
        patient_id = user_with_patient["patient"].id
        donation_id = client.post(
            URL,
            json=_payload(patient_id, systolic_bp=120, diastolic_bp=80),
            headers=authenticated_headers,
        ).json()["id"]

        response = client.put(
            f"{URL}{donation_id}",
            json={"systolic_bp": 70},
            headers=authenticated_headers,
        )
        assert response.status_code == 422, response.text

        get_response = client.get(f"{URL}{donation_id}", headers=authenticated_headers)
        assert get_response.status_code == 200
        assert get_response.json()["systolic_bp"] == 120
        assert get_response.json()["diastolic_bp"] == 80

    def test_validation_errors(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        patient_id = user_with_patient["patient"].id
        bad_payloads = [
            _payload(patient_id, donation_type="bone_marrow"),
            _payload(patient_id, hemoglobin=40),
            _payload(patient_id, systolic_bp=70, diastolic_bp=90),
            {"donation_type": "plasma", "patient_id": patient_id},
        ]
        for payload in bad_payloads:
            response = client.post(URL, json=payload, headers=authenticated_headers)
            assert response.status_code == 422, payload

    def test_tag_filtered_list_is_newest_first(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        patient_id = user_with_patient["patient"].id
        client.post(
            URL,
            json=_payload(patient_id, donation_date="2026-01-01", tags=["drk"]),
            headers=authenticated_headers,
        )
        client.post(
            URL,
            json=_payload(patient_id, donation_date="2026-06-01", tags=["drk"]),
            headers=authenticated_headers,
        )
        client.post(
            URL,
            json=_payload(patient_id, donation_date="2026-03-01", tags=["other"]),
            headers=authenticated_headers,
        )

        response = client.get(URL, params={"tags": ["drk"]}, headers=authenticated_headers)
        assert response.status_code == 200
        assert [d["donation_date"] for d in response.json()] == ["2026-06-01", "2026-01-01"]

    def test_tag_match_all_vs_any(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        patient_id = user_with_patient["patient"].id
        both_id = client.post(
            URL, json=_payload(patient_id, tags=["a", "b"]), headers=authenticated_headers
        ).json()["id"]
        client.post(URL, json=_payload(patient_id, tags=["a"]), headers=authenticated_headers)

        any_response = client.get(
            URL, params={"tags": ["a", "b"], "tag_match_all": False}, headers=authenticated_headers
        )
        assert any_response.status_code == 200
        assert len(any_response.json()) == 2

        all_response = client.get(
            URL, params={"tags": ["a", "b"], "tag_match_all": True}, headers=authenticated_headers
        )
        assert all_response.status_code == 200
        assert [d["id"] for d in all_response.json()] == [both_id]

    def test_donation_type_filter_combined_with_tags(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        patient_id = user_with_patient["patient"].id
        match_id = client.post(
            URL,
            json=_payload(patient_id, donation_type="plasma", tags=["drk"]),
            headers=authenticated_headers,
        ).json()["id"]
        client.post(
            URL,
            json=_payload(patient_id, donation_type="whole_blood", tags=["drk"]),
            headers=authenticated_headers,
        )
        client.post(
            URL,
            json=_payload(patient_id, donation_type="plasma", tags=["other"]),
            headers=authenticated_headers,
        )

        response = client.get(
            URL,
            params={"donation_type": "plasma", "tags": ["drk"]},
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        assert [d["id"] for d in response.json()] == [match_id]

    def test_patient_isolation(self, client: TestClient, db_session: Session):
        patient1, headers1 = _user_with_patient(db_session, "One")
        _, headers2 = _user_with_patient(db_session, "Two")

        donation_id = client.post(URL, json=_payload(patient1.id), headers=headers1).json()["id"]

        assert client.get(f"{URL}{donation_id}", headers=headers2).status_code == 404
        assert (
            client.put(f"{URL}{donation_id}", json={"location": "x"}, headers=headers2).status_code
            == 404
        )
        assert client.delete(f"{URL}{donation_id}", headers=headers2).status_code == 404
        assert client.get(URL, headers=headers2).json() == []

    def test_eligibility_without_donations(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        response = client.get(f"{URL}eligibility", headers=authenticated_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["is_eligible"] is True
        assert data["next_eligible_date"] is None

    def test_eligibility_uses_latest_donation_and_defaults(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        patient_id = user_with_patient["patient"].id
        last = _facility_today() - timedelta(days=10)
        client.post(
            URL,
            json=_payload(patient_id, donation_date=(last - timedelta(days=30)).isoformat(), donation_type="plasma"),
            headers=authenticated_headers,
        )
        client.post(
            URL, json=_payload(patient_id, donation_date=last.isoformat()), headers=authenticated_headers
        )

        data = client.get(f"{URL}eligibility", headers=authenticated_headers).json()
        assert data["last_donation_type"] == "whole_blood"
        assert data["interval_days"] == 56
        assert data["next_eligible_date"] == (last + timedelta(days=56)).isoformat()
        assert data["days_remaining"] == 46
        assert data["is_eligible"] is False

    def test_eligibility_uses_user_intervals(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        patient_id = user_with_patient["patient"].id
        last = _facility_today() - timedelta(days=10)
        client.post(
            URL, json=_payload(patient_id, donation_date=last.isoformat()), headers=authenticated_headers
        )
        client.put(
            "/api/v1/users/me/preferences",
            json={"blood_donation_intervals": {"whole_blood": 7}},
            headers=authenticated_headers,
        )

        data = client.get(f"{URL}eligibility", headers=authenticated_headers).json()
        assert data["interval_days"] == 7
        assert data["is_eligible"] is True


class TestBloodDonationsSecurity:
    """Quality-review regression coverage: an unrelated patient_id must never
    be usable to create, list, or check eligibility for someone else's data,
    whether it comes from the request body (create) or the ``patient_id``
    query parameter (list/eligibility, used for Phase 1 patient switching).
    """

    def test_create_rejects_other_users_patient_id(
        self, client: TestClient, db_session: Session, user_with_patient, authenticated_headers
    ):
        other_patient, _ = _user_with_patient(db_session, "Other")

        response = client.post(
            URL, json=_payload(other_patient.id), headers=authenticated_headers
        )

        # handle_create_with_logging -> verify_patient_ownership ->
        # deps.verify_patient_record_access: an entirely unrelated patient
        # (no sharing grant) is reported as 404, not 403, to avoid leaking
        # whether the patient_id exists at all.
        assert response.status_code == 404, response.text

    def test_list_rejects_other_users_patient_id_query_param(
        self, client: TestClient, db_session: Session, user_with_patient, authenticated_headers
    ):
        other_patient, _ = _user_with_patient(db_session, "Other")

        response = client.get(
            URL, params={"patient_id": other_patient.id}, headers=authenticated_headers
        )

        # deps.get_accessible_patient_id: the patient exists but isn't
        # accessible to this user -> ForbiddenException (403).
        assert response.status_code == 403, response.text

    def test_eligibility_rejects_other_users_patient_id_query_param(
        self, client: TestClient, db_session: Session, user_with_patient, authenticated_headers
    ):
        other_patient, _ = _user_with_patient(db_session, "Other")

        response = client.get(
            f"{URL}eligibility",
            params={"patient_id": other_patient.id},
            headers=authenticated_headers,
        )

        assert response.status_code == 403, response.text
