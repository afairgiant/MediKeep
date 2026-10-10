"""
API tests for GET /api/v1/conditions/{condition_id}/medications: the medications
linked to a condition, with the medication details (used by the link card, #1128).
"""

from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers


@pytest.fixture
def condition(client, user_with_patient, authenticated_headers):
    response = client.post(
        "/api/v1/conditions/",
        json={
            "diagnosis": "Hypertension",
            "status": "active",
            "patient_id": user_with_patient["patient"].id,
        },
        headers=authenticated_headers,
    )
    assert response.status_code == 200
    return response.json()


@pytest.fixture
def medication(client, user_with_patient, authenticated_headers):
    response = client.post(
        "/api/v1/medications/",
        json={
            "medication_name": "Lisinopril",
            "dosage": "10mg",
            "status": "active",
            "effective_period_start": "2026-01-15",
            "patient_id": user_with_patient["patient"].id,
        },
        headers=authenticated_headers,
    )
    assert response.status_code == 200
    return response.json()


def test_empty_list(client, authenticated_headers, condition):
    response = client.get(
        f"/api/v1/conditions/{condition['id']}/medications",
        headers=authenticated_headers,
    )
    assert response.status_code == 200
    assert response.json() == []


def test_lists_linked_medications_with_details(
    client, authenticated_headers, condition, medication
):
    link = client.post(
        f"/api/v1/conditions/{condition['id']}/medications",
        json={"medication_id": medication["id"], "relevance_note": "first line"},
        headers=authenticated_headers,
    )
    assert link.status_code == 200

    response = client.get(
        f"/api/v1/conditions/{condition['id']}/medications",
        headers=authenticated_headers,
    )
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 1
    assert rows[0]["id"] == link.json()["id"]
    assert rows[0]["condition_id"] == condition["id"]
    assert rows[0]["medication_id"] == medication["id"]
    assert rows[0]["relevance_note"] == "first line"
    assert rows[0]["medication"] == {
        "id": medication["id"],
        "medication_name": "Lisinopril",
        "dosage": "10mg",
        "status": "active",
        "effective_period_start": "2026-01-15",
    }


def test_bulk_links_all_show_up(client, authenticated_headers, condition, medication):
    second = client.post(
        "/api/v1/medications/",
        json={
            "medication_name": "Amlodipine",
            "status": "active",
            "patient_id": medication["patient_id"],
        },
        headers=authenticated_headers,
    ).json()
    bulk = client.post(
        f"/api/v1/conditions/{condition['id']}/medications/bulk",
        json={"medication_ids": [medication["id"], second["id"]]},
        headers=authenticated_headers,
    )
    assert bulk.status_code == 200
    rows = client.get(
        f"/api/v1/conditions/{condition['id']}/medications",
        headers=authenticated_headers,
    ).json()
    assert {row["medication"]["medication_name"] for row in rows} == {
        "Lisinopril",
        "Amlodipine",
    }


def test_nonexistent_condition(client, authenticated_headers):
    response = client.get(
        "/api/v1/conditions/999999/medications", headers=authenticated_headers
    )
    assert response.status_code == 404


def test_requires_auth(client, condition):
    assert (
        client.get(f"/api/v1/conditions/{condition['id']}/medications").status_code
        == 401
    )


def test_other_user_cannot_access(
    client, db_session: Session, authenticated_headers, condition, medication
):
    client.post(
        f"/api/v1/conditions/{condition['id']}/medications",
        json={"medication_id": medication["id"]},
        headers=authenticated_headers,
    )
    other_user_data = create_random_user(db_session)
    other_patient = patient_crud.create_for_user(
        db_session,
        user_id=other_user_data["user"].id,
        patient_data=PatientCreate(
            first_name="Other",
            last_name="Patient",
            birth_date=date(1985, 5, 15),
            gender="F",
            address="456 Other St",
        ),
    )
    other_user_data["user"].active_patient_id = other_patient.id
    db_session.commit()
    other_headers = create_user_token_headers(other_user_data["user"].username)

    response = client.get(
        f"/api/v1/conditions/{condition['id']}/medications", headers=other_headers
    )
    assert response.status_code in (403, 404)
