"""
API endpoint tests for the record-side lab result links on medications, procedures
and conditions.

Covers, for /medications, /procedures and /conditions:
- GET    /api/v1/{type}/{id}/lab-results
- POST   /api/v1/{type}/{id}/lab-results
- PUT    /api/v1/{type}/{id}/lab-results/{relationship_id}
- DELETE /api/v1/{type}/{id}/lab-results/{relationship_id}

and that a link made from the lab result side shows up on the record (#1128).
"""

from datetime import date, timedelta

import pytest
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers

RECORD_BODIES = {
    "medications": {
        "medication_name": "Atorvastatin",
        "dosage": "20mg",
        "status": "active",
    },
    "procedures": {
        "procedure_name": "Appendectomy",
        "date": str(date.today() - timedelta(days=3)),
        "status": "completed",
    },
    "conditions": {"diagnosis": "Hypertension", "status": "active"},
}
FK = {
    "medications": "medication_id",
    "procedures": "procedure_id",
    "conditions": "condition_id",
}


pytestmark = pytest.mark.parametrize(
    "record_type", ["medications", "procedures", "conditions"]
)


def _create_record(client, headers, record_type, patient_id):
    response = client.post(
        f"/api/v1/{record_type}/",
        json={
            **RECORD_BODIES[record_type],
            "patient_id": patient_id,
        },
        headers=headers,
    )
    assert response.status_code == 200
    return response.json()


def _create_lab_result(client, headers, patient_id, name="Liver Function Panel"):
    response = client.post(
        "/api/v1/lab-results/",
        json={
            "test_name": name,
            "test_category": "chemistry",
            "status": "completed",
            "patient_id": patient_id,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def patient_id(user_with_patient):
    return user_with_patient["patient"].id


@pytest.fixture
def lab_result(client, authenticated_headers, patient_id):
    return _create_lab_result(client, authenticated_headers, patient_id)


@pytest.fixture
def other_patient_headers(db_session: Session):
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
    return other_patient, create_user_token_headers(other_user_data["user"].username)


class TestRecordLabResultLinks:
    @pytest.fixture
    def record(self, record_type, client, authenticated_headers, patient_id):
        return _create_record(client, authenticated_headers, record_type, patient_id)

    def test_empty_list(self, record_type, client, authenticated_headers, record):
        response = client.get(
            f"/api/v1/{record_type}/{record['id']}/lab-results",
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        assert response.json() == []

    def test_link_from_lab_result_side_shows_on_the_record(
        self, record_type, client, authenticated_headers, record, lab_result
    ):
        """The reported bug: a link made on the lab result must be visible here."""
        created = client.post(
            f"/api/v1/lab-results/{lab_result['id']}/{record_type}",
            json={
                "lab_result_id": lab_result["id"],
                FK[record_type]: record["id"],
                "relevance_note": "monitoring",
            },
            headers=authenticated_headers,
        )
        assert created.status_code == 200

        response = client.get(
            f"/api/v1/{record_type}/{record['id']}/lab-results",
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        assert rows[0]["id"] == created.json()["id"]
        assert rows[0]["lab_result_id"] == lab_result["id"]
        assert rows[0][FK[record_type]] == record["id"]
        assert rows[0]["relevance_note"] == "monitoring"
        assert rows[0]["lab_result"]["test_name"] == "Liver Function Panel"
        assert rows[0]["lab_result"]["status"] == "completed"

    def test_create_link_shows_on_the_lab_result(
        self, record_type, client, authenticated_headers, record, lab_result
    ):
        response = client.post(
            f"/api/v1/{record_type}/{record['id']}/lab-results",
            json={"lab_result_id": lab_result["id"], "relevance_note": "  baseline  "},
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["lab_result_id"] == lab_result["id"]
        assert body[FK[record_type]] == record["id"]
        assert body["relevance_note"] == "baseline"
        assert body["lab_result"]["test_name"] == "Liver Function Panel"

        from_lab = client.get(
            f"/api/v1/lab-results/{lab_result['id']}/{record_type}",
            headers=authenticated_headers,
        )
        assert from_lab.status_code == 200
        assert [row["id"] for row in from_lab.json()] == [body["id"]]

    def test_create_without_note(
        self, record_type, client, authenticated_headers, record, lab_result
    ):
        response = client.post(
            f"/api/v1/{record_type}/{record['id']}/lab-results",
            json={"lab_result_id": lab_result["id"]},
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        assert response.json()["relevance_note"] is None

    def test_duplicate_link_rejected(
        self, record_type, client, authenticated_headers, record, lab_result
    ):
        url = f"/api/v1/{record_type}/{record['id']}/lab-results"
        body = {"lab_result_id": lab_result["id"]}
        assert (
            client.post(url, json=body, headers=authenticated_headers).status_code
            == 200
        )
        response = client.post(url, json=body, headers=authenticated_headers)
        assert response.status_code == 400
        assert len(client.get(url, headers=authenticated_headers).json()) == 1

    def test_link_nonexistent_lab_result(
        self, record_type, client, authenticated_headers, record
    ):
        response = client.post(
            f"/api/v1/{record_type}/{record['id']}/lab-results",
            json={"lab_result_id": 999999},
            headers=authenticated_headers,
        )
        assert response.status_code == 404

    def test_nonexistent_record(self, record_type, client, authenticated_headers):
        assert (
            client.get(
                f"/api/v1/{record_type}/999999/lab-results",
                headers=authenticated_headers,
            ).status_code
            == 404
        )
        assert (
            client.post(
                f"/api/v1/{record_type}/999999/lab-results",
                json={"lab_result_id": 1},
                headers=authenticated_headers,
            ).status_code
            == 404
        )

    def test_note_too_long_rejected(
        self, record_type, client, authenticated_headers, record, lab_result
    ):
        response = client.post(
            f"/api/v1/{record_type}/{record['id']}/lab-results",
            json={"lab_result_id": lab_result["id"], "relevance_note": "x" * 501},
            headers=authenticated_headers,
        )
        assert response.status_code == 422

    def test_update_note(
        self, record_type, client, authenticated_headers, record, lab_result
    ):
        url = f"/api/v1/{record_type}/{record['id']}/lab-results"
        link = client.post(
            url,
            json={"lab_result_id": lab_result["id"], "relevance_note": "old"},
            headers=authenticated_headers,
        ).json()
        response = client.put(
            f"{url}/{link['id']}",
            json={"relevance_note": "new"},
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        assert response.json()["relevance_note"] == "new"
        assert response.json()["lab_result"]["id"] == lab_result["id"]

        cleared = client.put(
            f"{url}/{link['id']}",
            json={"relevance_note": None},
            headers=authenticated_headers,
        )
        assert cleared.status_code == 200
        assert cleared.json()["relevance_note"] is None

    def test_update_link_of_another_record_rejected(
        self,
        record_type,
        client,
        authenticated_headers,
        patient_id,
        record,
        lab_result,
    ):
        second = _create_record(client, authenticated_headers, record_type, patient_id)
        link = client.post(
            f"/api/v1/{record_type}/{record['id']}/lab-results",
            json={"lab_result_id": lab_result["id"]},
            headers=authenticated_headers,
        ).json()
        response = client.put(
            f"/api/v1/{record_type}/{second['id']}/lab-results/{link['id']}",
            json={"relevance_note": "hijack"},
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    def test_delete_link_keeps_both_records(
        self, record_type, client, authenticated_headers, record, lab_result
    ):
        url = f"/api/v1/{record_type}/{record['id']}/lab-results"
        link = client.post(
            url, json={"lab_result_id": lab_result["id"]}, headers=authenticated_headers
        ).json()
        assert (
            client.delete(
                f"{url}/{link['id']}", headers=authenticated_headers
            ).status_code
            == 200
        )
        assert client.get(url, headers=authenticated_headers).json() == []
        assert (
            client.get(
                f"/api/v1/lab-results/{lab_result['id']}", headers=authenticated_headers
            ).status_code
            == 200
        )
        assert (
            client.get(
                f"/api/v1/{record_type}/{record['id']}", headers=authenticated_headers
            ).status_code
            == 200
        )

    def test_delete_link_of_another_record_rejected(
        self,
        record_type,
        client,
        authenticated_headers,
        patient_id,
        record,
        lab_result,
    ):
        second = _create_record(client, authenticated_headers, record_type, patient_id)
        link = client.post(
            f"/api/v1/{record_type}/{record['id']}/lab-results",
            json={"lab_result_id": lab_result["id"]},
            headers=authenticated_headers,
        ).json()
        response = client.delete(
            f"/api/v1/{record_type}/{second['id']}/lab-results/{link['id']}",
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    def test_delete_nonexistent_link(
        self, record_type, client, authenticated_headers, record
    ):
        response = client.delete(
            f"/api/v1/{record_type}/{record['id']}/lab-results/999999",
            headers=authenticated_headers,
        )
        assert response.status_code == 404

    def test_cross_patient_lab_result_rejected(
        self,
        record_type,
        client,
        authenticated_headers,
        record,
        other_patient_headers,
    ):
        other_patient, other_headers = other_patient_headers
        other_lab = _create_lab_result(
            client, other_headers, other_patient.id, "Other Patient Lab"
        )
        response = client.post(
            f"/api/v1/{record_type}/{record['id']}/lab-results",
            json={"lab_result_id": other_lab["id"]},
            headers=authenticated_headers,
        )
        assert response.status_code in (400, 403, 404)
        assert (
            client.get(
                f"/api/v1/{record_type}/{record['id']}/lab-results",
                headers=authenticated_headers,
            ).json()
            == []
        )

    def test_other_user_cannot_access(
        self,
        record_type,
        client,
        authenticated_headers,
        record,
        lab_result,
        other_patient_headers,
    ):
        url = f"/api/v1/{record_type}/{record['id']}/lab-results"
        link = client.post(
            url, json={"lab_result_id": lab_result["id"]}, headers=authenticated_headers
        ).json()
        _, other_headers = other_patient_headers

        assert client.get(url, headers=other_headers).status_code in (403, 404)
        assert client.post(
            url, json={"lab_result_id": lab_result["id"]}, headers=other_headers
        ).status_code in (403, 404)
        assert client.put(
            f"{url}/{link['id']}",
            json={"relevance_note": "x"},
            headers=other_headers,
        ).status_code in (403, 404)
        assert client.delete(
            f"{url}/{link['id']}", headers=other_headers
        ).status_code in (
            403,
            404,
        )
        # Untouched by the failed attempts
        assert len(client.get(url, headers=authenticated_headers).json()) == 1

    def test_requires_auth(self, record_type, client, record, lab_result):
        url = f"/api/v1/{record_type}/{record['id']}/lab-results"
        assert client.get(url).status_code == 401
        assert (
            client.post(url, json={"lab_result_id": lab_result["id"]}).status_code
            == 401
        )
        assert client.put(f"{url}/1", json={"relevance_note": "x"}).status_code == 401
        assert client.delete(f"{url}/1").status_code == 401

    def test_deleting_the_lab_result_removes_the_link(
        self, record_type, client, authenticated_headers, record, lab_result
    ):
        url = f"/api/v1/{record_type}/{record['id']}/lab-results"
        client.post(
            url, json={"lab_result_id": lab_result["id"]}, headers=authenticated_headers
        )
        client.delete(
            f"/api/v1/lab-results/{lab_result['id']}", headers=authenticated_headers
        )
        response = client.get(url, headers=authenticated_headers)
        assert response.status_code == 200
        assert response.json() == []
