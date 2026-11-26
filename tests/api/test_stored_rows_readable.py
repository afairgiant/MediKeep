"""Stored rows that break today's input rules must still be readable."""

import json
from datetime import date

import pytest

from app.models.clinical import Encounter, Medication
from app.models.labs import LabResult
from app.models.patient import EmergencyContact
from app.models.procedures import Treatment
from app.models.reporting import ReportTemplate
from app.models.user import User


def _assert_readable(client, headers, path, record_id):
    single = client.get(f"{path}{record_id}", headers=headers)
    assert single.status_code == 200, single.text
    listing = client.get(path, headers=headers)
    assert listing.status_code == 200, listing.text
    assert record_id in [row["id"] for row in listing.json()]
    return single.json()


def _create(client, headers, path, body):
    response = client.post(path, json=body, headers=headers)
    assert response.status_code in (200, 201), response.text
    return response.json()["id"]


@pytest.fixture
def patient_id(user_with_patient):
    return user_with_patient["patient"].id


def test_treatment_with_end_before_start(
    client, db_session, authenticated_headers, patient_id
):
    path = "/api/v1/treatments/"
    record_id = _create(
        client,
        authenticated_headers,
        path,
        {
            "patient_id": patient_id,
            "treatment_name": "Physical Therapy",
            "treatment_type": "Rehabilitation",
            "start_date": "2024-06-01",
            "status": "active",
        },
    )
    db_session.get(Treatment, record_id).end_date = date(2024, 1, 1)
    db_session.commit()

    data = _assert_readable(client, authenticated_headers, path, record_id)
    assert data["end_date"] == "2024-01-01"


def test_encounter_with_overlong_notes(
    client, db_session, authenticated_headers, patient_id
):
    path = "/api/v1/encounters/"
    record_id = _create(
        client,
        authenticated_headers,
        path,
        {"patient_id": patient_id, "reason": "Checkup", "date": "2024-01-01"},
    )
    db_session.get(Encounter, record_id).notes = "x" * 6000
    db_session.commit()

    data = _assert_readable(client, authenticated_headers, path, record_id)
    assert len(data["notes"]) == 6000


def test_lab_result_with_completed_before_ordered(
    client, db_session, authenticated_headers, patient_id
):
    path = "/api/v1/lab-results/"
    record_id = _create(
        client,
        authenticated_headers,
        path,
        {
            "patient_id": patient_id,
            "test_name": "Complete Blood Count",
            "ordered_date": "2024-06-01",
        },
    )
    db_session.get(LabResult, record_id).completed_date = date(2024, 1, 1)
    db_session.commit()

    data = _assert_readable(client, authenticated_headers, path, record_id)
    assert data["completed_date"] == "2024-01-01"


def test_medication_with_status_outside_allowed_list(
    client, db_session, authenticated_headers, patient_id
):
    path = "/api/v1/medications/"
    record_id = _create(
        client,
        authenticated_headers,
        path,
        {"patient_id": patient_id, "medication_name": "Aspirin"},
    )
    db_session.get(Medication, record_id).status = "retired-status"
    db_session.commit()

    data = _assert_readable(client, authenticated_headers, path, record_id)
    assert data["status"] == "retired-status"


def test_medication_tags_are_sanitized_on_read(
    client, db_session, authenticated_headers, patient_id
):
    path = "/api/v1/medications/"
    record_id = _create(
        client,
        authenticated_headers,
        path,
        {"patient_id": patient_id, "medication_name": "Aspirin"},
    )
    db_session.get(Medication, record_id).tags = ["<b>pain</b>"]
    db_session.commit()

    data = _assert_readable(client, authenticated_headers, path, record_id)
    assert data["tags"] and not any("<" in tag for tag in data["tags"])
    listing = client.get(path, headers=authenticated_headers).json()
    row = next(row for row in listing if row["id"] == record_id)
    assert not any("<" in tag for tag in row["tags"])


def test_report_template_with_selections_that_break_rules(
    client, db_session, authenticated_headers, user_with_patient
):
    duplicate_charts = {
        "vital_charts": [{"vital_type": "weight"}, {"vital_type": "weight"}],
        "lab_test_charts": [],
    }
    template = ReportTemplate(
        user_id=user_with_patient["user"].id,
        name="Old template",
        selected_records=json.dumps([{"category": "allergies", "record_ids": []}]),
        report_settings=json.dumps({"trend_charts": duplicate_charts}),
        is_public=False,
        shared_with_family=False,
    )
    db_session.add(template)
    db_session.commit()

    path = "/api/v1/custom-reports/templates"
    single = client.get(f"{path}/{template.id}", headers=authenticated_headers)
    assert single.status_code == 200, single.text
    assert single.json()["selected_records"][0]["record_ids"] == []
    assert len(single.json()["trend_charts"]["vital_charts"]) == 2
    listing = client.get(path, headers=authenticated_headers)
    assert listing.status_code == 200, listing.text
    assert template.id in [row["id"] for row in listing.json()]


def test_user_with_email_that_fails_format_check(
    client, db_session, authenticated_headers, user_with_patient
):
    db_session.get(User, user_with_patient["user"].id).email = "admin@localhost"
    db_session.commit()

    response = client.get("/api/v1/users/me", headers=authenticated_headers)
    assert response.status_code == 200, response.text
    assert response.json()["email"] == "admin@localhost"


def test_emergency_contact_with_blank_phone_number(
    client, db_session, authenticated_headers, patient_id
):
    path = "/api/v1/emergency-contacts/"
    record_id = _create(
        client,
        authenticated_headers,
        path,
        {"name": "Alex Doe", "relationship": "friend", "phone_number": "555-0100"},
    )
    db_session.get(EmergencyContact, record_id).phone_number = ""
    db_session.commit()

    listing = client.get(path, headers=authenticated_headers)
    assert listing.status_code == 200, listing.text
    row = next(row for row in listing.json() if row["id"] == record_id)
    assert row["phone_number"] == ""
