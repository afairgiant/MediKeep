"""
Tests for note-only encounter links (procedures, symptoms, injuries,
medications, conditions, treatments).

Covers visit-side (/encounters/{id}/<type>) endpoints for all six types and the
record-side (/<type>/{id}/encounters) endpoints for the five new types.
"""

from datetime import date, timedelta

import pytest

from app.crud.patient import patient as patient_crud
from app.models.models import (
    Condition,
    Encounter,
    EncounterCondition,
    EncounterInjury,
    EncounterMedication,
    EncounterProcedure,
    EncounterSymptom,
    Injury,
    Medication,
    PatientShare,
    Procedure,
    Symptom,
    Treatment,
    TreatmentEncounter,
)
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers

TODAY = date.today()


def _make_procedure(patient_id):
    return Procedure(
        procedure_name="Knee arthroscopy",
        date=TODAY - timedelta(days=10),
        status="completed",
        patient_id=patient_id,
    )


def _make_symptom(patient_id):
    return Symptom(
        symptom_name="Headache",
        first_occurrence_date=TODAY - timedelta(days=20),
        status="active",
        patient_id=patient_id,
    )


def _make_injury(patient_id):
    return Injury(
        injury_name="Sprained ankle",
        body_part="ankle",
        date_of_injury=TODAY - timedelta(days=15),
        status="active",
        patient_id=patient_id,
    )


def _make_medication(patient_id):
    return Medication(
        medication_name="Ibuprofen",
        effective_period_start=TODAY - timedelta(days=5),
        status="active",
        patient_id=patient_id,
    )


def _make_condition(patient_id):
    return Condition(
        diagnosis="Hypertension",
        onset_date=TODAY - timedelta(days=90),
        status="active",
        patient_id=patient_id,
    )


def _make_treatment(patient_id):
    return Treatment(
        treatment_name="Physio plan",
        start_date=TODAY - timedelta(days=30),
        status="active",
        patient_id=patient_id,
    )


# path, factory, link model, link fk column, name, date attr name on the record
LINK_TYPES = {
    "procedures": (
        _make_procedure,
        EncounterProcedure,
        "procedure_id",
        "Knee arthroscopy",
    ),
    "symptoms": (_make_symptom, EncounterSymptom, "symptom_id", "Headache"),
    "injuries": (_make_injury, EncounterInjury, "injury_id", "Sprained ankle"),
    "medications": (
        _make_medication,
        EncounterMedication,
        "medication_id",
        "Ibuprofen",
    ),
    "conditions": (
        _make_condition,
        EncounterCondition,
        "condition_id",
        "Hypertension",
    ),
    "treatments": (_make_treatment, TreatmentEncounter, "treatment_id", "Physio plan"),
}
REVERSE_TYPES = ["procedures", "symptoms", "injuries", "medications", "conditions"]


@pytest.fixture
def patient_id(user_with_patient):
    return user_with_patient["patient"].id


@pytest.fixture
def encounter_id(db_session, patient_id):
    enc = Encounter(
        reason="Annual checkup",
        date=TODAY - timedelta(days=7),
        patient_id=patient_id,
    )
    db_session.add(enc)
    db_session.commit()
    return enc.id


@pytest.fixture
def make_record(db_session, patient_id):
    def _make(link_type, for_patient_id=None):
        record = LINK_TYPES[link_type][0](for_patient_id or patient_id)
        db_session.add(record)
        db_session.commit()
        db_session.refresh(record)
        return record.id

    return _make


def _url(encounter_id, link_type, suffix=""):
    return f"/api/v1/encounters/{encounter_id}/{link_type}{suffix}"


@pytest.fixture
def other_patient_id(db_session):
    other_user = create_random_user(db_session)
    other_patient = patient_crud.create_for_user(
        db_session,
        user_id=other_user["user"].id,
        patient_data=PatientCreate(
            first_name="Other",
            last_name="Patient",
            birth_date=date(1985, 5, 15),
            gender="F",
            address="456 Other St",
        ),
    )
    other_user["user"].active_patient_id = other_patient.id
    db_session.commit()
    return other_patient.id


@pytest.mark.parametrize("link_type", list(LINK_TYPES))
class TestEncounterLinks:
    def test_list_empty(self, client, authenticated_headers, encounter_id, link_type):
        response = client.get(
            _url(encounter_id, link_type), headers=authenticated_headers
        )
        assert response.status_code == 200
        assert response.json() == []

    def test_create_and_list_returns_display_fields(
        self, client, authenticated_headers, encounter_id, make_record, link_type
    ):
        record_id = make_record(link_type)
        response = client.post(
            _url(encounter_id, link_type),
            json={"entity_id": record_id, "relevance_note": "  seen at visit  "},
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        created = response.json()
        assert created["encounter_id"] == encounter_id
        assert created["entity_id"] == record_id
        assert created["relevance_note"] == "seen at visit"
        assert created["entity_name"] == LINK_TYPES[link_type][3]
        assert created["entity_date"] is not None
        assert created["entity_status"] is not None
        assert created["encounter_reason"] == "Annual checkup"

        listed = client.get(
            _url(encounter_id, link_type), headers=authenticated_headers
        ).json()
        assert [row["id"] for row in listed] == [created["id"]]
        assert listed[0]["entity_name"] == LINK_TYPES[link_type][3]
        assert listed[0]["entity_date"] is not None

    def test_duplicate_rejected(
        self, client, authenticated_headers, encounter_id, make_record, link_type
    ):
        record_id = make_record(link_type)
        body = {"entity_id": record_id}
        assert (
            client.post(
                _url(encounter_id, link_type), json=body, headers=authenticated_headers
            ).status_code
            == 200
        )
        response = client.post(
            _url(encounter_id, link_type), json=body, headers=authenticated_headers
        )
        assert response.status_code == 400

    def test_nonexistent_record_404(
        self, client, authenticated_headers, encounter_id, link_type
    ):
        response = client.post(
            _url(encounter_id, link_type),
            json={"entity_id": 999999},
            headers=authenticated_headers,
        )
        assert response.status_code == 404

    def test_nonexistent_encounter_404(
        self, client, authenticated_headers, make_record, link_type
    ):
        response = client.post(
            _url(999999, link_type),
            json={"entity_id": make_record(link_type)},
            headers=authenticated_headers,
        )
        assert response.status_code == 404

    def test_cross_patient_record_rejected(
        self,
        client,
        authenticated_headers,
        encounter_id,
        make_record,
        other_patient_id,
        link_type,
    ):
        foreign_id = make_record(link_type, for_patient_id=other_patient_id)
        response = client.post(
            _url(encounter_id, link_type),
            json={"entity_id": foreign_id},
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    def test_invalid_payloads_rejected(
        self, client, authenticated_headers, encounter_id, make_record, link_type
    ):
        record_id = make_record(link_type)
        for body in (
            {"entity_id": 0},
            {"entity_id": -3},
            {"entity_id": record_id, "relevance_note": "x" * 501},
        ):
            response = client.post(
                _url(encounter_id, link_type), json=body, headers=authenticated_headers
            )
            assert response.status_code == 422, body

    def test_bulk_create_skips_existing_and_duplicates(
        self, client, authenticated_headers, encounter_id, make_record, link_type
    ):
        first, second = make_record(link_type), make_record(link_type)
        client.post(
            _url(encounter_id, link_type),
            json={"entity_id": first},
            headers=authenticated_headers,
        )
        response = client.post(
            _url(encounter_id, link_type, "/bulk"),
            json={"entity_ids": [first, second, second], "relevance_note": "bulk"},
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        rows = response.json()
        assert [row["entity_id"] for row in rows] == [second]
        assert rows[0]["entity_name"] == LINK_TYPES[link_type][3]
        assert rows[0]["relevance_note"] == "bulk"

    def test_bulk_rejects_empty_and_cross_patient(
        self,
        client,
        authenticated_headers,
        encounter_id,
        make_record,
        other_patient_id,
        link_type,
    ):
        empty = client.post(
            _url(encounter_id, link_type, "/bulk"),
            json={"entity_ids": []},
            headers=authenticated_headers,
        )
        assert empty.status_code == 422

        mine = make_record(link_type)
        foreign = make_record(link_type, for_patient_id=other_patient_id)
        response = client.post(
            _url(encounter_id, link_type, "/bulk"),
            json={"entity_ids": [mine, foreign]},
            headers=authenticated_headers,
        )
        assert response.status_code == 400
        assert (
            client.get(
                _url(encounter_id, link_type), headers=authenticated_headers
            ).json()
            == []
        )

    def test_update_note(
        self, client, authenticated_headers, encounter_id, make_record, link_type
    ):
        record_id = make_record(link_type)
        link = client.post(
            _url(encounter_id, link_type),
            json={"entity_id": record_id, "relevance_note": "old"},
            headers=authenticated_headers,
        ).json()
        response = client.put(
            _url(encounter_id, link_type, f"/{link['id']}"),
            json={"relevance_note": "new"},
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        assert response.json()["relevance_note"] == "new"
        assert response.json()["entity_id"] == record_id

    def test_delete_link_keeps_record(
        self,
        client,
        db_session,
        authenticated_headers,
        encounter_id,
        make_record,
        link_type,
    ):
        record_id = make_record(link_type)
        link = client.post(
            _url(encounter_id, link_type),
            json={"entity_id": record_id},
            headers=authenticated_headers,
        ).json()
        response = client.delete(
            _url(encounter_id, link_type, f"/{link['id']}"),
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        assert (
            client.get(
                _url(encounter_id, link_type), headers=authenticated_headers
            ).json()
            == []
        )
        record_model = {
            "procedures": Procedure,
            "symptoms": Symptom,
            "injuries": Injury,
            "medications": Medication,
            "conditions": Condition,
            "treatments": Treatment,
        }[link_type]
        assert db_session.get(record_model, record_id) is not None

    def test_update_and_delete_wrong_encounter_rejected(
        self,
        client,
        db_session,
        authenticated_headers,
        patient_id,
        encounter_id,
        make_record,
        link_type,
    ):
        other_encounter = Encounter(
            reason="Other visit", date=TODAY, patient_id=patient_id
        )
        db_session.add(other_encounter)
        db_session.commit()
        link = client.post(
            _url(encounter_id, link_type),
            json={"entity_id": make_record(link_type)},
            headers=authenticated_headers,
        ).json()

        put = client.put(
            _url(other_encounter.id, link_type, f"/{link['id']}"),
            json={"relevance_note": "x"},
            headers=authenticated_headers,
        )
        delete = client.delete(
            _url(other_encounter.id, link_type, f"/{link['id']}"),
            headers=authenticated_headers,
        )
        assert put.status_code == 400
        assert delete.status_code == 400

    def test_other_user_cannot_access(
        self,
        client,
        db_session,
        authenticated_headers,
        encounter_id,
        make_record,
        other_patient_id,
        link_type,
    ):
        client.post(
            _url(encounter_id, link_type),
            json={"entity_id": make_record(link_type)},
            headers=authenticated_headers,
        )
        other_user = create_random_user(db_session)
        other_headers = create_user_token_headers(other_user["user"].username)
        assert client.get(
            _url(encounter_id, link_type), headers=other_headers
        ).status_code in (403, 404)
        assert client.post(
            _url(encounter_id, link_type),
            json={"entity_id": 1},
            headers=other_headers,
        ).status_code in (403, 404)

    def test_deleting_encounter_cascades_links(
        self,
        client,
        db_session,
        authenticated_headers,
        encounter_id,
        make_record,
        link_type,
    ):
        client.post(
            _url(encounter_id, link_type),
            json={"entity_id": make_record(link_type)},
            headers=authenticated_headers,
        )
        link_model = LINK_TYPES[link_type][1]
        assert db_session.query(link_model).count() == 1
        response = client.delete(
            f"/api/v1/encounters/{encounter_id}", headers=authenticated_headers
        )
        assert response.status_code == 200
        db_session.expire_all()
        assert db_session.query(link_model).count() == 0


@pytest.mark.parametrize("link_type", REVERSE_TYPES)
class TestRecordSideRead:
    def test_reverse_list_shows_encounter(
        self, client, authenticated_headers, encounter_id, make_record, link_type
    ):
        record_id = make_record(link_type)
        client.post(
            _url(encounter_id, link_type),
            json={"entity_id": record_id, "relevance_note": "n"},
            headers=authenticated_headers,
        )
        response = client.get(
            f"/api/v1/{link_type}/{record_id}/encounters",
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        rows = response.json()
        assert len(rows) == 1
        assert rows[0]["encounter_id"] == encounter_id
        assert rows[0]["encounter_reason"] == "Annual checkup"
        assert rows[0]["encounter_date"] is not None
        assert rows[0]["relevance_note"] == "n"

    def test_reverse_list_empty_and_missing(
        self, client, authenticated_headers, make_record, link_type
    ):
        record_id = make_record(link_type)
        empty = client.get(
            f"/api/v1/{link_type}/{record_id}/encounters",
            headers=authenticated_headers,
        )
        assert empty.status_code == 200
        assert empty.json() == []
        missing = client.get(
            f"/api/v1/{link_type}/999999/encounters", headers=authenticated_headers
        )
        assert missing.status_code == 404

    def test_reverse_list_other_user_denied(
        self, client, db_session, authenticated_headers, make_record, link_type
    ):
        record_id = make_record(link_type)
        other_user = create_random_user(db_session)
        other_headers = create_user_token_headers(other_user["user"].username)
        response = client.get(
            f"/api/v1/{link_type}/{record_id}/encounters", headers=other_headers
        )
        assert response.status_code in (403, 404)

    def test_reverse_list_only_returns_own_links(
        self,
        client,
        db_session,
        authenticated_headers,
        encounter_id,
        make_record,
        link_type,
    ):
        linked, unlinked = make_record(link_type), make_record(link_type)
        client.post(
            _url(encounter_id, link_type),
            json={"entity_id": linked},
            headers=authenticated_headers,
        )
        rows = client.get(
            f"/api/v1/{link_type}/{unlinked}/encounters", headers=authenticated_headers
        ).json()
        assert rows == []


def _record_url(link_type, record_id, suffix=""):
    return f"/api/v1/{link_type}/{record_id}/encounters{suffix}"


@pytest.fixture
def second_encounter_id(db_session, patient_id):
    enc = Encounter(
        reason="Follow-up", date=TODAY - timedelta(days=2), patient_id=patient_id
    )
    db_session.add(enc)
    db_session.commit()
    return enc.id


@pytest.mark.parametrize("link_type", REVERSE_TYPES)
class TestRecordSideWrite:
    def test_create_from_record_visible_from_visit(
        self, client, authenticated_headers, encounter_id, make_record, link_type
    ):
        record_id = make_record(link_type)
        response = client.post(
            _record_url(link_type, record_id),
            json={"encounter_id": encounter_id, "relevance_note": "from record"},
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        created = response.json()
        assert created["entity_id"] == record_id
        assert created["encounter_id"] == encounter_id
        assert created["entity_name"] == LINK_TYPES[link_type][3]
        assert created["encounter_reason"] == "Annual checkup"

        listed = client.get(
            _url(encounter_id, link_type), headers=authenticated_headers
        ).json()
        assert [row["id"] for row in listed] == [created["id"]]
        assert listed[0]["relevance_note"] == "from record"

    def test_duplicate_rejected_across_sides(
        self, client, authenticated_headers, encounter_id, make_record, link_type
    ):
        record_id = make_record(link_type)
        client.post(
            _url(encounter_id, link_type),
            json={"entity_id": record_id},
            headers=authenticated_headers,
        )
        response = client.post(
            _record_url(link_type, record_id),
            json={"encounter_id": encounter_id},
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    def test_cross_patient_encounter_rejected(
        self,
        client,
        db_session,
        authenticated_headers,
        make_record,
        other_patient_id,
        link_type,
    ):
        record_id = make_record(link_type)
        foreign = Encounter(reason="Other", date=TODAY, patient_id=other_patient_id)
        db_session.add(foreign)
        db_session.commit()
        response = client.post(
            _record_url(link_type, record_id),
            json={"encounter_id": foreign.id},
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    def test_missing_encounter_and_invalid_payloads(
        self, client, authenticated_headers, make_record, link_type
    ):
        record_id = make_record(link_type)
        missing = client.post(
            _record_url(link_type, record_id),
            json={"encounter_id": 999999},
            headers=authenticated_headers,
        )
        assert missing.status_code == 404
        for body in (
            {"encounter_id": 0},
            {"encounter_id": 1, "relevance_note": "x" * 501},
        ):
            assert (
                client.post(
                    _record_url(link_type, record_id),
                    json=body,
                    headers=authenticated_headers,
                ).status_code
                == 422
            )

    def test_bulk_skips_existing_and_dedupes(
        self,
        client,
        authenticated_headers,
        encounter_id,
        second_encounter_id,
        make_record,
        link_type,
    ):
        record_id = make_record(link_type)
        client.post(
            _record_url(link_type, record_id),
            json={"encounter_id": encounter_id},
            headers=authenticated_headers,
        )
        response = client.post(
            _record_url(link_type, record_id, "/bulk"),
            json={
                "encounter_ids": [
                    encounter_id,
                    second_encounter_id,
                    second_encounter_id,
                ],
                "relevance_note": "bulk",
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        rows = response.json()
        assert [row["encounter_id"] for row in rows] == [second_encounter_id]
        assert rows[0]["relevance_note"] == "bulk"
        empty = client.post(
            _record_url(link_type, record_id, "/bulk"),
            json={"encounter_ids": []},
            headers=authenticated_headers,
        )
        assert empty.status_code == 422

    def test_update_and_delete_from_record_reflect_on_visit(
        self, client, authenticated_headers, encounter_id, make_record, link_type
    ):
        record_id = make_record(link_type)
        link = client.post(
            _record_url(link_type, record_id),
            json={"encounter_id": encounter_id, "relevance_note": "old"},
            headers=authenticated_headers,
        ).json()
        put = client.put(
            _record_url(link_type, record_id, f"/{link['id']}"),
            json={"relevance_note": "new"},
            headers=authenticated_headers,
        )
        assert put.status_code == 200
        assert put.json()["relevance_note"] == "new"
        assert (
            client.get(
                _url(encounter_id, link_type), headers=authenticated_headers
            ).json()[0]["relevance_note"]
            == "new"
        )

        delete = client.delete(
            _record_url(link_type, record_id, f"/{link['id']}"),
            headers=authenticated_headers,
        )
        assert delete.status_code == 200
        assert (
            client.get(
                _url(encounter_id, link_type), headers=authenticated_headers
            ).json()
            == []
        )

    def test_link_of_another_record_rejected(
        self, client, authenticated_headers, encounter_id, make_record, link_type
    ):
        mine, other = make_record(link_type), make_record(link_type)
        link = client.post(
            _record_url(link_type, mine),
            json={"encounter_id": encounter_id},
            headers=authenticated_headers,
        ).json()
        put = client.put(
            _record_url(link_type, other, f"/{link['id']}"),
            json={"relevance_note": "x"},
            headers=authenticated_headers,
        )
        delete = client.delete(
            _record_url(link_type, other, f"/{link['id']}"),
            headers=authenticated_headers,
        )
        assert put.status_code == 400
        assert delete.status_code == 400

    def test_other_user_cannot_write(
        self,
        client,
        db_session,
        authenticated_headers,
        encounter_id,
        make_record,
        link_type,
    ):
        record_id = make_record(link_type)
        other_user = create_random_user(db_session)
        other_headers = create_user_token_headers(other_user["user"].username)
        response = client.post(
            _record_url(link_type, record_id),
            json={"encounter_id": encounter_id},
            headers=other_headers,
        )
        assert response.status_code in (403, 404)


@pytest.mark.parametrize("link_type", REVERSE_TYPES)
def test_deleting_record_removes_links_but_keeps_encounter(
    client, db_session, authenticated_headers, encounter_id, make_record, link_type
):
    record_id = make_record(link_type)
    client.post(
        _url(encounter_id, link_type),
        json={"entity_id": record_id},
        headers=authenticated_headers,
    )
    link_model = LINK_TYPES[link_type][1]
    assert db_session.query(link_model).count() == 1

    response = client.delete(
        f"/api/v1/{link_type}/{record_id}", headers=authenticated_headers
    )
    assert response.status_code == 200

    db_session.expire_all()
    assert db_session.query(link_model).count() == 0
    assert db_session.get(Encounter, encounter_id) is not None
    assert (
        client.get(_url(encounter_id, link_type), headers=authenticated_headers).json()
        == []
    )


@pytest.mark.parametrize("link_type", REVERSE_TYPES)
class TestViewOnlyShare:
    """A user with view-only access can read links from both sides but not write."""

    @pytest.fixture
    def viewer_headers(self, db_session, user_with_patient, patient_id):
        viewer = create_random_user(db_session)
        db_session.add(
            PatientShare(
                patient_id=patient_id,
                shared_by_user_id=user_with_patient["user"].id,
                shared_with_user_id=viewer["user"].id,
                permission_level="view",
                is_active=True,
            )
        )
        viewer["user"].active_patient_id = patient_id
        db_session.commit()
        return create_user_token_headers(viewer["user"].username)

    def test_view_share_reads_but_cannot_write(
        self,
        client,
        authenticated_headers,
        viewer_headers,
        encounter_id,
        make_record,
        link_type,
    ):
        record_id = make_record(link_type)
        link = client.post(
            _url(encounter_id, link_type),
            json={"entity_id": record_id},
            headers=authenticated_headers,
        ).json()

        assert (
            client.get(
                _url(encounter_id, link_type), headers=viewer_headers
            ).status_code
            == 200
        )
        assert (
            client.get(
                _record_url(link_type, record_id), headers=viewer_headers
            ).status_code
            == 200
        )

        writes = [
            client.post(
                _url(encounter_id, link_type),
                json={"entity_id": record_id},
                headers=viewer_headers,
            ),
            client.post(
                _record_url(link_type, record_id),
                json={"encounter_id": encounter_id},
                headers=viewer_headers,
            ),
            client.put(
                _record_url(link_type, record_id, f"/{link['id']}"),
                json={"relevance_note": "x"},
                headers=viewer_headers,
            ),
            client.delete(
                _record_url(link_type, record_id, f"/{link['id']}"),
                headers=viewer_headers,
            ),
            client.delete(
                _url(encounter_id, link_type, f"/{link['id']}"),
                headers=viewer_headers,
            ),
        ]
        assert all(w.status_code in (403, 404) for w in writes)
        remaining = client.get(
            _url(encounter_id, link_type), headers=authenticated_headers
        ).json()
        assert [row["id"] for row in remaining] == [link["id"]]
        assert remaining[0]["relevance_note"] is None


def test_treatment_link_preserves_visit_fields(
    client, db_session, authenticated_headers, encounter_id, make_record
):
    """Linking from the visit side must not clobber treatment-side visit metadata."""
    treatment_id = make_record("treatments")
    link = TreatmentEncounter(
        treatment_id=treatment_id,
        encounter_id=encounter_id,
        visit_label="initial",
        visit_sequence=1,
    )
    db_session.add(link)
    db_session.commit()

    response = client.put(
        _url(encounter_id, "treatments", f"/{link.id}"),
        json={"relevance_note": "reviewed"},
        headers=authenticated_headers,
    )
    assert response.status_code == 200
    db_session.expire_all()
    refreshed = db_session.get(TreatmentEncounter, link.id)
    assert refreshed.visit_label == "initial"
    assert refreshed.visit_sequence == 1
    assert refreshed.relevance_note == "reviewed"

    listed = client.get(
        _url(encounter_id, "treatments"), headers=authenticated_headers
    ).json()
    assert listed[0]["entity_name"] == "Physio plan"
