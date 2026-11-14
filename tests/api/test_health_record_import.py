"""
Test the health record import API endpoints with a hand-written FHIR bundle, a
MyChart-style C-CDA and a synthetic export in Epic's real layout.
"""

import io
import json
import time
import zipfile
from datetime import date
from pathlib import Path
from typing import Optional
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.logging.constants import LogFields
from app.crud.patient import patient as patient_crud
from app.models.activity_log import ActivityLog
from app.models.models import (
    Allergy,
    Condition,
    ImportProvenance,
    Medication,
    PatientShare,
)
from app.schemas.patient import PatientCreate
from app.services.importers import ccda_available, upload
from app.services.importers.mappers import _fhir as f
from app.services.importers.mappers import resource_mapper_registry
from app.services.importers.service import HealthRecordImportService
from tests.utils.user import create_random_user, create_user_token_headers

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures" / "health_record_import"
FIXTURE = FIXTURES / "fhir_bundle_minimal.json"
MAPPER_FIXTURE = FIXTURES / "fhir_bundle_mapper.json"
MYCHART_CCD = FIXTURES / "mychart_like_ccd.xml"
EPIC_CCD = FIXTURES / "mychart_epic_synthetic.xml"
FORMATS_URL = "/api/v1/health-records/import/formats"


def _preview_url(patient_id: int) -> str:
    return f"/api/v1/health-records/patient/{patient_id}/import/preview"


def _execute_url(patient_id: int) -> str:
    return f"/api/v1/health-records/patient/{patient_id}/import/execute"


def _upload(data: Optional[bytes] = None, name: str = "bundle.json"):
    """Build the files= argument for a multipart upload."""
    return {
        "file": (name, io.BytesIO(data or FIXTURE.read_bytes()), "application/json")
    }


def _xdm_zip(xml: bytes, members: int = 1) -> bytes:
    """Wrap a C-CDA in the folder layout MyChart's download produces."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i in range(members):
            zf.writestr(
                f"MachineReadable_XDMFormat/IHE_XDM/SUBSET{i:02d}/DOC0001.XML", xml
            )
        zf.writestr("MachineReadable_XDMFormat/IHE_XDM/SUBSET00/METADATA.XML", "<x/>")
        zf.writestr("MachineReadable_XDMFormat/INDEX.HTM", "<html></html>")
    return buf.getvalue()


def _bundle_with_diagnosis(diagnosis: str) -> bytes:
    """The fixture with the first condition's text changed."""
    bundle = json.loads(FIXTURE.read_text())
    bundle["entry"][1]["resource"]["code"]["text"] = diagnosis
    return json.dumps(bundle).encode()


def _unsupported_only() -> bytes:
    """The fixture reduced to its Patient and Observation entries."""
    bundle = json.loads(FIXTURE.read_text())
    bundle["entry"] = [
        e
        for e in bundle["entry"]
        if e["resource"]["resourceType"] in ("Patient", "Observation")
    ]
    return json.dumps(bundle).encode()


def _conditions(db: Session, patient_id: int):
    return db.query(Condition).filter(Condition.patient_id == patient_id).all()


def _allergies(db: Session, patient_id: int):
    return db.query(Allergy).filter(Allergy.patient_id == patient_id).all()


def _medications(db: Session, patient_id: int):
    return db.query(Medication).filter(Medication.patient_id == patient_id).all()


def _provenance(db: Session, patient_id: int):
    return (
        db.query(ImportProvenance)
        .filter(ImportProvenance.patient_id == patient_id)
        .all()
    )


def _count_selects(session: Session, call):
    """Run call() and return how many SELECT statements it issued."""
    statements = []

    def record(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    engine = session.get_bind()
    event.listen(engine, "before_cursor_execute", record)
    try:
        call()
    finally:
        event.remove(engine, "before_cursor_execute", record)
    return len(statements)


def _bundle_with_conditions(count: int) -> bytes:
    """The fixture's first condition repeated count times with distinct ids and text."""
    bundle = json.loads(FIXTURE.read_text())
    template = bundle["entry"][1]
    entries = [bundle["entry"][0]]
    for i in range(count):
        entry = json.loads(json.dumps(template))
        entry["resource"]["id"] = f"cond-{i}"
        entry["resource"]["code"]["text"] = f"Condition {i}"
        entries.append(entry)
    bundle["entry"] = entries
    return json.dumps(bundle).encode()


def _import_logs(db: Session, patient_id: int):
    return (
        db.query(ActivityLog)
        .filter(
            ActivityLog.patient_id == patient_id,
            ActivityLog.entity_type == "health_record_import",
        )
        .all()
    )


def _shared_user_headers(db: Session, user_with_patient, permission_level: str):
    """Create a second user, share the patient with them, return their headers."""
    owner = user_with_patient["user"]
    patient_id = user_with_patient["patient"].id
    other = create_random_user(db)["user"]
    patient_crud.create_for_user(
        db,
        user_id=other.id,
        patient_data=PatientCreate(
            first_name="Other", last_name="User", birth_date=date(1985, 5, 5)
        ),
    )
    db.add(
        PatientShare(
            patient_id=patient_id,
            shared_by_user_id=owner.id,
            shared_with_user_id=other.id,
            permission_level=permission_level,
            is_active=True,
        )
    )
    db.commit()
    return create_user_token_headers(other.username)


class TestFormats:
    """Test the formats endpoint."""

    def test_lists_formats_and_limit(self, client: TestClient, authenticated_headers):
        """Test that the formats endpoint lists the available formats and the size limit."""
        response = client.get(FORMATS_URL, headers=authenticated_headers)
        assert response.status_code == 200
        body = response.json()
        expected = {"fhir_bundle", "ccda"} if ccda_available() else {"fhir_bundle"}
        assert {f["key"] for f in body["formats"]} == expected
        assert body["max_file_size_bytes"] == upload.MAX_IMPORT_FILE_SIZE

    def test_requires_auth(self, client: TestClient):
        """Test that the formats endpoint requires authentication."""
        assert client.get(FORMATS_URL).status_code == 401


class TestPreview:
    """Test the preview endpoint."""

    def test_counts_supported_and_unsupported(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        """Test that mapped resources are counted and the rest reported as unsupported."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _preview_url(patient_id), files=_upload(), headers=authenticated_headers
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["source"] == "fhir"
        assert body["format_key"] == "fhir_bundle"
        assert body["total_resources"] == 4
        assert body["counts"] == {
            "condition": {"new": 2, "duplicate": 0, "changed": 0, "edited": 0},
            "allergy": {"new": 1, "duplicate": 0, "changed": 0, "edited": 0},
        }
        assert body["unsupported"] == {"Observation": 1}

    def test_patient_summary_and_mismatch_warnings(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        """Test that the file's patient is summarized and differences are warned about."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _preview_url(patient_id), files=_upload(), headers=authenticated_headers
        )
        body = response.json()
        assert body["patient"] == {
            "full_name": "Jane Quinn Sampleton",
            "birth_date": "1980-04-12",
            "gender": "female",
        }
        # The fixture patient is Test User, born 1990-01-01
        assert len(body["warnings"]) == 2
        assert "Jane Quinn Sampleton" in body["warnings"][0]
        assert "1980-04-12" in body["warnings"][1]

    def test_writes_nothing(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that a preview creates no rows and no provenance."""
        patient_id = user_with_patient["patient"].id
        client.post(
            _preview_url(patient_id), files=_upload(), headers=authenticated_headers
        )
        assert _conditions(db_session, patient_id) == []
        assert _allergies(db_session, patient_id) == []
        assert _provenance(db_session, patient_id) == []

    def test_rejects_wrong_extension(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        """Test that a file with an unsupported extension is rejected."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _preview_url(patient_id),
            files=_upload(b"<x/>", "export.csv"),
            headers=authenticated_headers,
        )
        assert response.status_code == 422
        assert "Unsupported file type" in response.text

    def test_rejects_oversized_file(
        self, client: TestClient, user_with_patient, authenticated_headers, monkeypatch
    ):
        """Test that a file over the size limit is rejected."""
        monkeypatch.setattr(upload, "MAX_IMPORT_FILE_SIZE", 100)
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _preview_url(patient_id),
            files=_upload(b"{" + b" " * 200 + b"}"),
            headers=authenticated_headers,
        )
        assert response.status_code == 422
        assert "exceeds" in response.text

    def test_rejects_non_bundle(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        """Test that JSON that is not a Bundle fails detection and explicit parsing."""
        patient_id = user_with_patient["patient"].id
        data = json.dumps({"resourceType": "Patient"}).encode()
        response = client.post(
            _preview_url(patient_id), files=_upload(data), headers=authenticated_headers
        )
        assert response.status_code == 400
        assert "Could not recognize" in response.text

        response = client.post(
            _preview_url(patient_id),
            data={"format_key": "fhir_bundle"},
            files=_upload(data),
            headers=authenticated_headers,
        )
        assert response.status_code == 400
        assert "not a FHIR Bundle" in response.text

    def test_rejects_deeply_nested_json(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        """Test that JSON nested past the parser's limit is a 400, not a crash."""
        patient_id = user_with_patient["patient"].id
        data = b"[" * 100000 + b"]" * 100000
        response = client.post(
            _preview_url(patient_id), files=_upload(data), headers=authenticated_headers
        )
        assert response.status_code == 400
        response = client.post(
            _preview_url(patient_id),
            data={"format_key": "fhir_bundle"},
            files=_upload(data),
            headers=authenticated_headers,
        )
        assert response.status_code == 400

    def test_rejects_malformed_entry(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        """Test that an entry or resource that is not an object is a 400, not a crash."""
        patient_id = user_with_patient["patient"].id
        for entries, message in [
            (["not an entry"], "entry 0 is not an object"),
            ([{"resource": "Condition"}], "entry 0 resource is not an object"),
        ]:
            data = json.dumps({"resourceType": "Bundle", "entry": entries}).encode()
            response = client.post(
                _preview_url(patient_id),
                data={"format_key": "fhir_bundle"},
                files=_upload(data),
                headers=authenticated_headers,
            )
            assert response.status_code == 400, response.text
            assert message in response.text

    def test_patient_name_in_wrong_shape_is_ignored(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        """Test that a Patient whose name is a string gives no summary name."""
        patient_id = user_with_patient["patient"].id
        bundle = json.loads(FIXTURE.read_text())
        bundle["entry"][0]["resource"]["name"] = "Alex"
        response = client.post(
            _preview_url(patient_id),
            files=_upload(json.dumps(bundle).encode()),
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text
        assert response.json()["patient"]["full_name"] is None

    def test_unknown_format_key(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        """Test that an unknown format key is rejected."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _preview_url(patient_id),
            data={"format_key": "nope"},
            files=_upload(),
            headers=authenticated_headers,
        )
        assert response.status_code == 400
        assert "Unsupported format" in response.text


class TestExecute:
    """Test the execute endpoint."""

    def test_unsupported_only_writes_nothing_but_logs(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that a file with only unsupported resources creates no rows but is logged."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _execute_url(patient_id),
            files=_upload(_unsupported_only()),
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["counts"] == {}
        assert body["unsupported"] == {"Observation": 1}
        assert len(body["import_batch_id"]) == 32
        assert _conditions(db_session, patient_id) == []
        logs = _import_logs(db_session, patient_id)
        assert len(logs) == 1
        assert logs[0].action == "imported"
        assert logs[0].event_metadata["import_batch_id"] == body["import_batch_id"]

    def test_activity_log_sanitizes_user_agent(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that the logged user agent goes through the log-input sanitizer."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _execute_url(patient_id),
            files=_upload(),
            headers={**authenticated_headers, "User-Agent": 'evil"agent'},
        )
        assert response.status_code == 200, response.text
        assert _import_logs(db_session, patient_id)[0].user_agent == "evil'agent"

    def test_creates_rows_and_provenance(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that mapped resources become rows with one provenance row each."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _execute_url(patient_id), files=_upload(), headers=authenticated_headers
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["counts"]["condition"] == {
            "created": 2,
            "updated": 0,
            "skipped_duplicate": 0,
            "skipped_edited": 0,
        }

        assert body["counts"]["allergy"]["created"] == 1

        rows = _conditions(db_session, patient_id)
        assert {r.diagnosis for r in rows} == {"Essential hypertension", "Asthma"}
        allergy = _allergies(db_session, patient_id)[0]
        assert (allergy.allergen, allergy.reaction) == ("Penicillin", "Hives")
        provenance = _provenance(db_session, patient_id)
        assert {(p.record_type, p.record_id) for p in provenance} == {
            *(("condition", r.id) for r in rows),
            ("allergy", allergy.id),
        }
        assert {p.external_id for p in provenance} == {"cond-1", "cond-2", "allergy-1"}
        assert {p.source for p in provenance} == {"fhir"}
        assert {p.import_batch_id for p in provenance} == {body["import_batch_id"]}

    def test_second_import_is_all_duplicates(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that importing the same file twice creates nothing the second time."""
        patient_id = user_with_patient["patient"].id
        client.post(
            _execute_url(patient_id), files=_upload(), headers=authenticated_headers
        )

        preview = client.post(
            _preview_url(patient_id), files=_upload(), headers=authenticated_headers
        ).json()
        assert preview["counts"]["condition"] == {
            "new": 0,
            "duplicate": 2,
            "changed": 0,
            "edited": 0,
        }

        response = client.post(
            _execute_url(patient_id), files=_upload(), headers=authenticated_headers
        )
        assert response.json()["counts"]["condition"]["skipped_duplicate"] == 2
        assert response.json()["counts"]["condition"]["created"] == 0
        assert response.json()["counts"]["allergy"]["skipped_duplicate"] == 1
        assert len(_conditions(db_session, patient_id)) == 2
        assert len(_allergies(db_session, patient_id)) == 1

    def test_locally_edited_row_is_skipped_by_default(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that a row edited in MediKeep shows as changed and is not overwritten."""
        patient_id = user_with_patient["patient"].id
        client.post(
            _execute_url(patient_id), files=_upload(), headers=authenticated_headers
        )

        edited = next(
            r for r in _conditions(db_session, patient_id) if r.diagnosis == "Asthma"
        )
        edited.diagnosis = "Childhood asthma"
        db_session.commit()

        preview = client.post(
            _preview_url(patient_id), files=_upload(), headers=authenticated_headers
        ).json()
        assert preview["counts"]["condition"] == {
            "new": 0,
            "duplicate": 1,
            "changed": 1,
            "edited": 1,
        }

        response = client.post(
            _execute_url(patient_id), files=_upload(), headers=authenticated_headers
        )
        assert response.json()["counts"]["condition"]["skipped_edited"] == 1
        db_session.refresh(edited)
        assert edited.diagnosis == "Childhood asthma"

    def test_locally_edited_row_is_overwritten_when_asked(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that skip_edited=false updates the edited row and keeps its notes."""
        patient_id = user_with_patient["patient"].id
        client.post(
            _execute_url(patient_id), files=_upload(), headers=authenticated_headers
        )

        edited = next(
            r for r in _conditions(db_session, patient_id) if r.diagnosis == "Asthma"
        )
        edited.diagnosis = "Childhood asthma"
        edited.notes = "my note"
        db_session.commit()

        response = client.post(
            _execute_url(patient_id),
            data={"skip_edited": "false"},
            files=_upload(),
            headers=authenticated_headers,
        )
        assert response.json()["counts"]["condition"]["updated"] == 1
        db_session.refresh(edited)
        assert edited.diagnosis == "Asthma"
        assert edited.notes == "my note"

    def test_source_change_updates_row(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that a changed value in the source file updates the untouched row."""
        patient_id = user_with_patient["patient"].id
        client.post(
            _execute_url(patient_id), files=_upload(), headers=authenticated_headers
        )

        response = client.post(
            _execute_url(patient_id),
            files=_upload(_bundle_with_diagnosis("Hypertension, essential")),
            headers=authenticated_headers,
        )
        assert response.json()["counts"]["condition"] == {
            "created": 0,
            "updated": 1,
            "skipped_duplicate": 1,
            "skipped_edited": 0,
        }
        assert {r.diagnosis for r in _conditions(db_session, patient_id)} == {
            "Hypertension, essential",
            "Asthma",
        }

    def test_preview_after_user_deleted_rows_writes_nothing(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that preview leaves stale provenance alone and execute replaces it."""
        patient_id = user_with_patient["patient"].id
        client.post(
            _execute_url(patient_id), files=_upload(), headers=authenticated_headers
        )
        for row in _conditions(db_session, patient_id):
            db_session.delete(row)
        db_session.commit()

        preview = client.post(
            _preview_url(patient_id), files=_upload(), headers=authenticated_headers
        ).json()
        assert preview["counts"]["condition"]["new"] == 2
        assert not db_session.deleted
        assert not db_session.dirty
        assert len(_provenance(db_session, patient_id)) == 3

        response = client.post(
            _execute_url(patient_id), files=_upload(), headers=authenticated_headers
        )
        assert response.json()["counts"]["condition"]["created"] == 2
        rows = _conditions(db_session, patient_id)
        provenance = _provenance(db_session, patient_id)
        assert len(rows) == 2
        assert len(provenance) == 3
        assert {r.id for r in rows} <= {p.record_id for p in provenance}

    def test_repeated_resource_in_one_file_is_a_duplicate(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that two identical id-less resources in one upload create one row."""
        patient_id = user_with_patient["patient"].id
        bundle = json.loads(FIXTURE.read_text())
        condition = next(
            e for e in bundle["entry"] if e["resource"]["resourceType"] == "Condition"
        )
        condition["resource"].pop("id")
        bundle["entry"] = [condition, json.loads(json.dumps(condition))]
        data = json.dumps(bundle).encode()

        preview = client.post(
            _preview_url(patient_id), files=_upload(data), headers=authenticated_headers
        ).json()
        assert preview["counts"]["condition"] == {
            "new": 1,
            "duplicate": 1,
            "changed": 0,
            "edited": 0,
        }
        response = client.post(
            _execute_url(patient_id), files=_upload(data), headers=authenticated_headers
        )
        assert response.json()["counts"]["condition"]["created"] == 1
        assert response.json()["counts"]["condition"]["skipped_duplicate"] == 1
        assert len(_conditions(db_session, patient_id)) == 1
        assert len(_provenance(db_session, patient_id)) == 1

    def test_hash_match_refreshes_external_id(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that a record matched by content under a new source id keeps the new id."""
        patient_id = user_with_patient["patient"].id
        client.post(
            _execute_url(patient_id), files=_upload(), headers=authenticated_headers
        )
        bundle = json.loads(FIXTURE.read_text())
        for entry in bundle["entry"]:
            if entry["resource"]["resourceType"] == "Condition":
                entry["resource"]["id"] = "new-" + entry["resource"]["id"]
        data = json.dumps(bundle).encode()

        response = client.post(
            _execute_url(patient_id), files=_upload(data), headers=authenticated_headers
        )
        assert response.json()["counts"]["condition"]["skipped_duplicate"] == 2
        db_session.expire_all()
        assert {p.external_id for p in _provenance(db_session, patient_id)} == {
            "new-cond-1",
            "new-cond-2",
            "allergy-1",
        }

    def test_same_external_id_across_record_types(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that a Condition and an AllergyIntolerance sharing an id stay separate."""
        patient_id = user_with_patient["patient"].id
        bundle = json.loads(FIXTURE.read_text())
        bundle["entry"][1]["resource"]["id"] = "shared-1"
        allergy_entry = next(
            e
            for e in bundle["entry"]
            if e["resource"]["resourceType"] == "AllergyIntolerance"
        )
        allergy_entry["resource"]["id"] = "shared-1"
        allergy_entry["resource"]["code"]["text"] = "Peanut"
        allergy_entry["resource"]["code"].pop("coding")
        data = json.dumps(bundle).encode()

        response = client.post(
            _execute_url(patient_id), files=_upload(data), headers=authenticated_headers
        )
        assert response.status_code == 200, response.text
        counts = response.json()["counts"]
        assert counts["condition"]["created"] == 2
        assert counts["allergy"]["created"] == 1

        shared = [
            p
            for p in _provenance(db_session, patient_id)
            if p.external_id == "shared-1"
        ]
        assert {p.record_type for p in shared} == {"condition", "allergy"}
        allergy = (
            db_session.query(Allergy).filter(Allergy.patient_id == patient_id).one()
        )
        assert allergy.allergen == "Peanut"

        response = client.post(
            _execute_url(patient_id), files=_upload(data), headers=authenticated_headers
        )
        counts = response.json()["counts"]
        assert counts["condition"]["skipped_duplicate"] == 2
        assert counts["allergy"]["skipped_duplicate"] == 1
        assert len(_conditions(db_session, patient_id)) == 2

    def test_sections_filter(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that a sections list excludes record types not in it."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _execute_url(patient_id),
            data={"sections": "allergy"},
            files=_upload(),
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        assert list(response.json()["counts"]) == ["allergy"]
        assert _conditions(db_session, patient_id) == []
        assert len(_allergies(db_session, patient_id)) == 1

        response = client.post(
            _execute_url(patient_id),
            data={"sections": "condition"},
            files=_upload(),
            headers=authenticated_headers,
        )
        assert response.json()["counts"]["condition"]["created"] == 2
        assert len(_conditions(db_session, patient_id)) == 2

    def test_view_only_share_is_forbidden(
        self, client: TestClient, db_session: Session, user_with_patient
    ):
        """Test that a user with a view-only share cannot import."""
        patient_id = user_with_patient["patient"].id
        headers = _shared_user_headers(db_session, user_with_patient, "view")
        assert (
            client.post(_preview_url(patient_id), files=_upload(), headers=headers)
        ).status_code == 403
        assert (
            client.post(_execute_url(patient_id), files=_upload(), headers=headers)
        ).status_code == 403
        assert _import_logs(db_session, patient_id) == []

    def test_edit_share_is_allowed(
        self, client: TestClient, db_session: Session, user_with_patient
    ):
        """Test that a user with an edit share can preview and import."""
        patient_id = user_with_patient["patient"].id
        headers = _shared_user_headers(db_session, user_with_patient, "edit")
        assert (
            client.post(_preview_url(patient_id), files=_upload(), headers=headers)
        ).status_code == 200
        assert (
            client.post(_execute_url(patient_id), files=_upload(), headers=headers)
        ).status_code == 200
        assert len(_import_logs(db_session, patient_id)) == 1

    def test_malformed_patient_fields_do_not_crash(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that non-string Patient fields give no summary and still import with a log entry."""
        patient_id = user_with_patient["patient"].id
        bundle = json.loads(FIXTURE.read_text())
        bundle["entry"][0]["resource"].update(
            {"name": [{"given": [1], "family": ["x"]}], "birthDate": 123, "gender": {}}
        )
        data = json.dumps(bundle).encode()

        preview = client.post(
            _preview_url(patient_id), files=_upload(data), headers=authenticated_headers
        )
        assert preview.status_code == 200, preview.text
        assert preview.json()["patient"] is None
        assert preview.json()["warnings"] == []

        response = client.post(
            _execute_url(patient_id), files=_upload(data), headers=authenticated_headers
        )
        assert response.status_code == 200, response.text
        assert response.json()["counts"]["condition"]["created"] == 2
        assert len(_conditions(db_session, patient_id)) == 2
        assert len(_import_logs(db_session, patient_id)) == 1

    def test_invalid_resource_type_is_skipped_with_warning(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that a resource without a string resourceType is skipped, not fatal."""
        patient_id = user_with_patient["patient"].id
        bundle = json.loads(FIXTURE.read_text())
        bundle["entry"].append({"resource": {"resourceType": 7}})
        bundle["entry"].append({"resource": {"id": "no-type"}})
        data = json.dumps(bundle).encode()

        response = client.post(
            _execute_url(patient_id), files=_upload(data), headers=authenticated_headers
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["counts"]["condition"]["created"] == 2
        assert body["unsupported"]["invalid"] == 2
        assert [w for w in body["warnings"] if w.startswith("Skipped")] == [
            "Skipped entry 5: resourceType missing or not a string",
            "Skipped entry 6: resourceType missing or not a string",
        ]

    def test_mapper_error_is_reported_without_detail(
        self, client: TestClient, user_with_patient, authenticated_headers, monkeypatch
    ):
        """Test that a mapper failure gives a fixed warning line and logs only its type."""
        patient_id = user_with_patient["patient"].id

        def broken(resource, bundle):
            raise KeyError("clinicalStatus")

        monkeypatch.setattr(
            resource_mapper_registry.get_mapper("Condition"), "map", broken
        )
        with patch("app.services.importers.service.logger") as logger:
            response = client.post(
                _preview_url(patient_id), files=_upload(), headers=authenticated_headers
            )
        extra = logger.warning.call_args.kwargs["extra"]
        assert extra[LogFields.EVENT] == "health_import_resource_unmapped"
        assert extra[LogFields.ERROR] == "KeyError"
        assert response.status_code == 200, response.text
        body = response.json()
        assert "condition" not in body["counts"]
        assert [w for w in body["warnings"] if w.startswith("Skipped")] == [
            "Skipped Condition/cond-1: could not be mapped",
            "Skipped Condition/cond-2: could not be mapped",
        ]
        assert "clinicalStatus" not in response.text

    def test_mapper_attribute_error_is_skipped(
        self, client: TestClient, user_with_patient, authenticated_headers, monkeypatch
    ):
        """Test that a field of the wrong shape skips the resource instead of failing."""
        patient_id = user_with_patient["patient"].id
        real_map = resource_mapper_registry.get_mapper("Condition").map

        def wrong_shape(resource, bundle):
            if resource.get("id") == "cond-1":
                return "active".get("coding")  # str has no get, like a malformed field
            return real_map(resource, bundle)

        monkeypatch.setattr(
            resource_mapper_registry.get_mapper("Condition"), "map", wrong_shape
        )
        response = client.post(
            _preview_url(patient_id), files=_upload(), headers=authenticated_headers
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["counts"]["condition"]["new"] == 1
        assert "Skipped Condition/cond-1: could not be mapped" in body["warnings"]

    def test_hash_match_from_another_source_keeps_its_source_id(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that a row imported from one source is not relabelled by another source."""
        patient = user_with_patient["patient"]
        bundle = json.loads(FIXTURE.read_text())
        HealthRecordImportService(db_session).execute(
            bundle, patient, "ccda", "ccda", user_id=user_with_patient["user"].id
        )
        for entry in bundle["entry"]:
            if entry["resource"]["resourceType"] == "Condition":
                entry["resource"]["id"] = "fhir-" + entry["resource"]["id"]

        response = client.post(
            _execute_url(patient.id),
            files=_upload(json.dumps(bundle).encode()),
            headers=authenticated_headers,
        )
        assert response.json()["counts"]["condition"]["skipped_duplicate"] == 2
        db_session.expire_all()
        conditions = [
            p
            for p in _provenance(db_session, patient.id)
            if p.record_type == "condition"
        ]
        assert {(p.source, p.external_id) for p in conditions} == {
            ("ccda", "cond-1"),
            ("ccda", "cond-2"),
        }
        assert len(_conditions(db_session, patient.id)) == 2

    @pytest.mark.parametrize(
        "copy_first,copy_has_new_content",
        [(False, False), (True, False), (True, True)],
        ids=["id-match-first", "old-content-copy-first", "new-content-copy-first"],
    )
    def test_provenance_row_is_claimed_once_per_import(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
        copy_first,
        copy_has_new_content,
    ):
        """Test that the resource matching a row by id updates it, whatever the file order."""
        patient_id = user_with_patient["patient"].id
        client.post(
            _execute_url(patient_id), files=_upload(), headers=authenticated_headers
        )
        bundle = json.loads(FIXTURE.read_text())
        by_id = bundle["entry"][1]
        by_hash = json.loads(json.dumps(by_id))
        by_id["resource"]["code"]["text"] = "Hypertension, essential"
        if copy_has_new_content:
            by_hash["resource"]["code"]["text"] = "Hypertension, essential"
        by_hash["resource"]["id"] = "late-copy"
        matches = [by_hash, by_id] if copy_first else [by_id, by_hash]
        bundle["entry"] = [bundle["entry"][0], *matches]
        data = json.dumps(bundle).encode()

        preview = client.post(
            _preview_url(patient_id), files=_upload(data), headers=authenticated_headers
        ).json()
        assert preview["counts"]["condition"] == {
            "new": 0,
            "duplicate": 1,
            "changed": 1,
            "edited": 0,
        }
        response = client.post(
            _execute_url(patient_id), files=_upload(data), headers=authenticated_headers
        )
        assert response.json()["counts"]["condition"] == {
            "created": 0,
            "updated": 1,
            "skipped_duplicate": 1,
            "skipped_edited": 0,
        }
        db_session.expire_all()
        provenance = [
            p
            for p in _provenance(db_session, patient_id)
            if p.record_type == "condition"
        ]
        assert {p.external_id for p in provenance} == {"cond-1", "cond-2"}
        updated = next(p for p in provenance if p.external_id == "cond-1")
        assert db_session.get(Condition, updated.record_id).diagnosis == (
            "Hypertension, essential"
        )
        assert len(_conditions(db_session, patient_id)) == 2

    @pytest.mark.parametrize(
        "entries,expected",
        [
            # A deferred copy still marks its id seen, so its repeat is a duplicate
            (
                [
                    ("late-copy", "Hypertension, essential"),
                    ("cond-1", "Hypertension, essential"),
                    ("late-copy", "Something else"),
                ],
                {"new": 0, "duplicate": 2, "changed": 1, "edited": 0},
            ),
            # A repeated id reserves no hash, so a distinct resource with its content is new
            (
                [
                    ("cond-1", "Hypertension, essential"),
                    ("cond-1", "Something else"),
                    ("other", "Something else"),
                ],
                {"new": 1, "duplicate": 1, "changed": 1, "edited": 0},
            ),
        ],
        ids=["deferred-copy-id-repeats", "repeated-id-reserves-nothing"],
    )
    def test_repeated_ids_around_an_id_match(
        self,
        client: TestClient,
        user_with_patient,
        authenticated_headers,
        entries,
        expected,
    ):
        """Test in-file id repeats next to a resource that matches a row by id."""
        patient_id = user_with_patient["patient"].id
        client.post(
            _execute_url(patient_id), files=_upload(), headers=authenticated_headers
        )
        bundle = json.loads(FIXTURE.read_text())
        template = bundle["entry"][1]
        resources = []
        for resource_id, text in entries:
            entry = json.loads(json.dumps(template))
            entry["resource"]["id"] = resource_id
            entry["resource"]["code"]["text"] = text
            resources.append(entry)
        bundle["entry"] = [bundle["entry"][0], *resources]

        preview = client.post(
            _preview_url(patient_id),
            files=_upload(json.dumps(bundle).encode()),
            headers=authenticated_headers,
        ).json()
        assert preview["counts"]["condition"] == expected

    def test_external_id_is_unique_per_patient_type_and_source(
        self, db_session: Session, user_with_patient
    ):
        """Test that two provenance rows with the same source id are refused."""
        patient_id = user_with_patient["patient"].id

        def row(record_id, external_id):
            return ImportProvenance(
                patient_id=patient_id,
                record_type="condition",
                record_id=record_id,
                source="fhir",
                external_id=external_id,
                content_hash="x" * 64,
                import_batch_id="b" * 32,
            )

        db_session.add_all([row(1, None), row(2, None), row(3, "dup")])
        db_session.flush()
        db_session.add(row(4, "dup"))
        with pytest.raises(IntegrityError):
            db_session.flush()
        db_session.rollback()


class TestQueries:
    """Test that classification does not query per resource."""

    def test_preview_query_count_does_not_grow_with_resources(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that a preview of 2 and of 20 conditions issues the same SELECTs, before and after import."""
        patient_id = user_with_patient["patient"].id
        small, large = _bundle_with_conditions(2), _bundle_with_conditions(20)

        def preview(data):
            response = client.post(
                _preview_url(patient_id),
                files=_upload(data),
                headers=authenticated_headers,
            )
            assert response.status_code == 200, response.text

        assert _count_selects(db_session, lambda: preview(small)) == _count_selects(
            db_session, lambda: preview(large)
        )

        client.post(
            _execute_url(patient_id),
            files=_upload(large),
            headers=authenticated_headers,
        )
        assert _count_selects(db_session, lambda: preview(small)) == _count_selects(
            db_session, lambda: preview(large)
        )


class TestMapperFixture:
    """Test the three mappers end to end on the mapper fixture."""

    def test_preview_counts(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        """Test per-section counts, skipped resources and the unsupported list."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _preview_url(patient_id),
            files=_upload(MAPPER_FIXTURE.read_bytes()),
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text
        body = response.json()
        # 11 resources besides the Patient; the error, cancelled and duplicate ones map to nothing
        assert body["total_resources"] == 11
        assert body["counts"] == {
            "condition": {"new": 2, "duplicate": 0, "changed": 0, "edited": 0},
            "allergy": {"new": 3, "duplicate": 0, "changed": 0, "edited": 0},
            "medication": {"new": 2, "duplicate": 0, "changed": 0, "edited": 0},
        }
        assert body["unsupported"] == {"Observation": 1}

    def test_execute_writes_expected_rows(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test the values written for each record type."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _execute_url(patient_id),
            files=_upload(MAPPER_FIXTURE.read_bytes()),
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text
        counts = response.json()["counts"]
        assert counts["condition"]["created"] == 2
        assert counts["allergy"]["created"] == 3
        assert counts["medication"]["created"] == 2

        htn = next(
            r for r in _conditions(db_session, patient_id) if r.icd10_code == "I10"
        )
        assert htn.snomed_code == "59621000"
        assert htn.severity == "moderate"
        assert htn.notes == "Diagnosed at annual physical."
        asthma = next(
            r for r in _conditions(db_session, patient_id) if r.diagnosis == "Asthma"
        )
        assert (asthma.status, asthma.onset_date, asthma.end_date) == (
            "resolved",
            date(1992, 6, 1),
            date(2004, 8, 15),
        )

        allergies = {a.allergen: a for a in _allergies(db_session, patient_id)}
        assert allergies["Penicillin"].reaction == "Hives, Shortness of breath"
        assert allergies["Penicillin"].severity == "severe"
        assert allergies["Peanut"].reaction == "Not specified"
        assert allergies["Peanut"].severity == "none"
        assert (allergies["Latex"].severity, allergies["Latex"].status) == (
            "severe",
            "inactive",
        )

        meds = {m.medication_name: m for m in _medications(db_session, patient_id)}
        lisinopril = meds["Lisinopril 10 MG Oral Tablet"]
        assert lisinopril.dosage == "Take 1 tablet by mouth once daily"
        assert lisinopril.route == "oral"
        assert lisinopril.indication == "Hypertension"
        albuterol = meds["Albuterol 0.09 MG/ACTUAT Metered Dose Inhaler"]
        assert (albuterol.dosage, albuterol.frequency) == ("2 puff", "2 times per day")
        assert albuterol.status == "completed"
        assert albuterol.effective_period_end == date(2004, 8, 15)

        provenance = _provenance(db_session, patient_id)
        assert len(provenance) == 7
        # The statement, not the request, is the lisinopril row's source
        assert "med-lisinopril" in {p.external_id for p in provenance}
        assert "rx-lisinopril" not in {p.external_id for p in provenance}

    def test_second_import_is_all_duplicates(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        """Test that importing the fixture twice creates nothing the second time."""
        patient_id = user_with_patient["patient"].id
        for _ in range(2):
            response = client.post(
                _execute_url(patient_id),
                files=_upload(MAPPER_FIXTURE.read_bytes()),
                headers=authenticated_headers,
            )
        counts = response.json()["counts"]
        assert {k: v["created"] for k, v in counts.items()} == {
            "condition": 0,
            "allergy": 0,
            "medication": 0,
        }
        assert {k: v["skipped_duplicate"] for k, v in counts.items()} == {
            "condition": 2,
            "allergy": 3,
            "medication": 2,
        }

    def test_edited_allergen_is_skipped(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that an allergy renamed in MediKeep is reported as changed and left alone."""
        patient_id = user_with_patient["patient"].id
        client.post(
            _execute_url(patient_id),
            files=_upload(MAPPER_FIXTURE.read_bytes()),
            headers=authenticated_headers,
        )
        peanut = next(
            a for a in _allergies(db_session, patient_id) if a.allergen == "Peanut"
        )
        peanut.allergen = "Peanuts (all forms)"
        db_session.commit()

        preview = client.post(
            _preview_url(patient_id),
            files=_upload(MAPPER_FIXTURE.read_bytes()),
            headers=authenticated_headers,
        ).json()
        assert preview["counts"]["allergy"] == {
            "new": 0,
            "duplicate": 2,
            "changed": 1,
            "edited": 1,
        }

        response = client.post(
            _execute_url(patient_id),
            files=_upload(MAPPER_FIXTURE.read_bytes()),
            headers=authenticated_headers,
        )
        assert response.json()["counts"]["allergy"]["skipped_edited"] == 1
        db_session.refresh(peanut)
        assert peanut.allergen == "Peanuts (all forms)"

    def test_update_keeps_user_owned_fields(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that a source update leaves the user's condition name and medication type alone."""
        patient_id = user_with_patient["patient"].id
        bundle = json.loads(MAPPER_FIXTURE.read_text())
        client.post(
            _execute_url(patient_id),
            files=_upload(json.dumps(bundle).encode()),
            headers=authenticated_headers,
        )
        condition = next(
            e["resource"]
            for e in bundle["entry"]
            if e["resource"]["resourceType"] == "Condition"
        )
        lisinopril = next(
            m
            for m in _medications(db_session, patient_id)
            if m.medication_name.startswith("Lisinopril")
        )
        row = next(
            c
            for c in _conditions(db_session, patient_id)
            if c.diagnosis == f.display_for(condition["code"])
        )
        row.condition_name = "My own label"
        lisinopril.medication_type = "otc"
        db_session.commit()

        condition["code"]["text"] = "Renamed in the source"
        statement = next(
            e["resource"]
            for e in bundle["entry"]
            if e["resource"]
            .get("medicationCodeableConcept", {})
            .get("text", "")
            .startswith("Lisinopril")
        )
        statement["dosage"][0]["text"] = "Take 2 tablets by mouth once daily"
        response = client.post(
            _execute_url(patient_id),
            files=_upload(json.dumps(bundle).encode()),
            headers=authenticated_headers,
        )
        counts = response.json()["counts"]
        assert counts["condition"]["updated"] == 1
        assert counts["medication"]["updated"] == 1
        db_session.refresh(row)
        db_session.refresh(lisinopril)
        assert row.diagnosis == "Renamed in the source"
        assert row.condition_name == "My own label"
        assert lisinopril.dosage == "Take 2 tablets by mouth once daily"
        assert lisinopril.medication_type == "otc"

    def test_edited_route_is_skipped(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that a medication whose route was changed in MediKeep counts as edited."""
        patient_id = user_with_patient["patient"].id
        client.post(
            _execute_url(patient_id),
            files=_upload(MAPPER_FIXTURE.read_bytes()),
            headers=authenticated_headers,
        )
        lisinopril = next(
            m
            for m in _medications(db_session, patient_id)
            if m.medication_name.startswith("Lisinopril")
        )
        lisinopril.route = "sublingual"
        db_session.commit()

        preview = client.post(
            _preview_url(patient_id),
            files=_upload(MAPPER_FIXTURE.read_bytes()),
            headers=authenticated_headers,
        ).json()
        assert preview["counts"]["medication"] == {
            "new": 0,
            "duplicate": 1,
            "changed": 1,
            "edited": 1,
        }
        response = client.post(
            _execute_url(patient_id),
            files=_upload(MAPPER_FIXTURE.read_bytes()),
            headers=authenticated_headers,
        )
        assert response.json()["counts"]["medication"]["skipped_edited"] == 1
        db_session.refresh(lisinopril)
        assert lisinopril.route == "sublingual"

    def test_future_date_is_dropped_and_the_row_kept(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that a condition with an onset in the future keeps its row without the date."""
        patient_id = user_with_patient["patient"].id
        bundle = json.loads(MAPPER_FIXTURE.read_text())
        condition = next(
            e["resource"]
            for e in bundle["entry"]
            if e["resource"]["resourceType"] == "Condition"
        )
        condition["onsetDateTime"] = "2999-01-01"
        condition.pop("abatementDateTime", None)
        response = client.post(
            _execute_url(patient_id),
            files=_upload(json.dumps(bundle).encode()),
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["counts"]["condition"]["created"] == 2
        assert any(
            "onset date 2999-01-01 is in the future, dropped" in w
            for w in body["warnings"]
        )
        rows = _conditions(db_session, patient_id)
        assert len(rows) == 2
        assert all(row.onset_date != date(2999, 1, 1) for row in rows)

    def test_row_failing_the_create_schema_is_skipped(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
        monkeypatch,
        caplog,
    ):
        """Test that a row the create schema rejects is skipped and its value never logged."""
        patient_id = user_with_patient["patient"].id
        condition_mapper = resource_mapper_registry.get_mapper("Condition")
        monkeypatch.setattr(
            condition_mapper, "_severity", staticmethod(lambda resource: "catastrophic")
        )
        bundle = json.loads(MAPPER_FIXTURE.read_text())
        condition = next(
            e["resource"]
            for e in bundle["entry"]
            if e["resource"]["resourceType"] == "Condition"
        )
        with caplog.at_level("WARNING"):
            response = client.post(
                _execute_url(patient_id),
                files=_upload(json.dumps(bundle).encode()),
                headers=authenticated_headers,
            )
        assert response.status_code == 200, response.text
        body = response.json()
        assert (
            f"Skipped Condition/{condition['id']}: failed validation"
            in body["warnings"]
        )
        rejected = [
            record
            for record in caplog.records
            if record.getMessage() == "Health record import rejected a mapped resource"
        ]
        assert rejected
        assert "catastrophic" not in caplog.text
        assert all("catastrophic" not in str(vars(record)) for record in rejected)

    def test_sections_limits_writes(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that sections=condition writes conditions only."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _execute_url(patient_id),
            data={"sections": "condition"},
            files=_upload(MAPPER_FIXTURE.read_bytes()),
            headers=authenticated_headers,
        )
        assert list(response.json()["counts"]) == ["condition"]
        assert len(_conditions(db_session, patient_id)) == 2
        assert _allergies(db_session, patient_id) == []
        assert _medications(db_session, patient_id) == []

    def test_warning_overflow_is_counted(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        """Test that warnings past the cap are counted rather than silently dropped."""
        patient_id = user_with_patient["patient"].id
        bundle = json.loads(MAPPER_FIXTURE.read_text())
        bundle["entry"].extend({"resource": {"id": f"bad{i}"}} for i in range(60))
        response = client.post(
            _preview_url(patient_id),
            files=_upload(json.dumps(bundle).encode()),
            headers=authenticated_headers,
        )
        warnings = response.json()["warnings"]
        skipped = [w for w in warnings if w.startswith("Skipped entry")]
        assert 0 < len(skipped) < 60
        hidden = int(warnings[-1].split()[0])
        assert warnings[-1] == f"{hidden} more warnings not shown"
        assert len(skipped) + hidden >= 60

    def test_truncation_warning_is_surfaced(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        """Test that a value cut to fit a column shows up in the preview warnings."""
        patient_id = user_with_patient["patient"].id
        bundle = json.loads(MAPPER_FIXTURE.read_text())
        bundle["entry"][1]["resource"]["code"]["text"] = "z" * 600
        response = client.post(
            _preview_url(patient_id),
            files=_upload(json.dumps(bundle).encode()),
            headers=authenticated_headers,
        )
        assert "Condition/cond-htn: diagnosis truncated to 500 characters" in (
            response.json()["warnings"]
        )


def _lisinopril_concept() -> dict:
    return {
        "coding": [
            {
                "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                "code": "314076",
                "display": "Lisinopril 10 MG Oral Tablet",
            }
        ]
    }


def _medication_bundle(*resources: dict) -> bytes:
    """A bundle holding only the given resources."""
    return json.dumps(
        {
            "resourceType": "Bundle",
            "type": "collection",
            "entry": [{"resource": r} for r in resources],
        }
    ).encode()


class TestMedicationPrecedence:
    """Requests are dropped only for statements that are themselves imported."""

    def _import(self, client, patient_id, headers, *resources):
        response = client.post(
            _execute_url(patient_id),
            files=_upload(_medication_bundle(*resources)),
            headers=headers,
        )
        assert response.status_code == 200, response.text
        return response.json()

    def test_malformed_statement_does_not_affect_requests(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that a statement with a string medicationReference skips only itself."""
        patient_id = user_with_patient["patient"].id
        statement = {
            "resourceType": "MedicationStatement",
            "id": "ms-bad",
            "status": "active",
            "medicationReference": "Medication/1",
        }
        requests = [
            {
                "resourceType": "MedicationRequest",
                "id": f"mr-{i}",
                "status": "active",
                "intent": "order",
                "medicationCodeableConcept": {"text": name},
            }
            for i, name in enumerate(("Lisinopril", "Albuterol"))
        ]
        body = self._import(
            client, patient_id, authenticated_headers, statement, *requests
        )
        assert body["counts"]["medication"]["created"] == 2
        assert not any("MedicationRequest" in w for w in body["warnings"])
        assert {m.medication_name for m in _medications(db_session, patient_id)} == {
            "Lisinopril",
            "Albuterol",
        }

    def test_request_with_string_dosage_is_still_mapped(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that a string in dosageInstruction gives an empty dosage, not a skip."""
        patient_id = user_with_patient["patient"].id
        statement = {
            "resourceType": "MedicationStatement",
            "id": "ms-1",
            "status": "active",
            "medicationCodeableConcept": {"text": "Albuterol"},
            "effectivePeriod": {"start": "2020-01-01"},
        }
        request = {
            "resourceType": "MedicationRequest",
            "id": "mr-1",
            "status": "active",
            "intent": "order",
            "medicationCodeableConcept": {"text": "Lisinopril"},
            "dosageInstruction": ["take one daily"],
        }
        body = self._import(
            client, patient_id, authenticated_headers, statement, request
        )
        assert body["counts"]["medication"]["created"] == 2
        assert not any("could not be mapped" in w for w in body["warnings"])

    def test_text_statement_covers_coded_request_for_the_same_drug(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that one side having RxNorm and the other only a name still dedupes."""
        patient_id = user_with_patient["patient"].id
        medication = {
            "resourceType": "Medication",
            "id": "lisinopril",
            "code": _lisinopril_concept(),
        }
        statement = {
            "resourceType": "MedicationStatement",
            "id": "ms-1",
            "status": "active",
            "medicationCodeableConcept": {"text": "Lisinopril 10 MG Oral Tablet"},
        }
        request = {
            "resourceType": "MedicationRequest",
            "id": "mr-1",
            "status": "active",
            "intent": "order",
            "medicationReference": {"reference": "Medication/lisinopril"},
            "dosageInstruction": [{"text": "Take 1 tablet daily"}],
        }
        body = self._import(
            client, patient_id, authenticated_headers, medication, statement, request
        )
        assert body["counts"]["medication"]["created"] == 1
        assert len(_medications(db_session, patient_id)) == 1

    def test_statement_failing_validation_does_not_cover_a_request(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that a statement the import rejects leaves the request in."""
        patient_id = user_with_patient["patient"].id
        statement = {
            "resourceType": "MedicationStatement",
            "id": "ms-1",
            "status": "active",
            "medicationCodeableConcept": {
                "coding": [
                    {
                        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                        "code": "314076",
                        "display": "L",
                    }
                ]
            },
        }
        request = {
            "resourceType": "MedicationRequest",
            "id": "mr-1",
            "status": "active",
            "intent": "order",
            "medicationCodeableConcept": _lisinopril_concept(),
        }
        body = self._import(
            client, patient_id, authenticated_headers, statement, request
        )
        assert body["counts"]["medication"]["created"] == 1
        assert [m.medication_name for m in _medications(db_session, patient_id)] == [
            "Lisinopril 10 MG Oral Tablet"
        ]


class TestHashOfValidatedData:
    """The incoming hash is taken from the values that are written."""

    def test_value_changed_by_the_schema_is_not_a_local_edit(
        self,
        client: TestClient,
        user_with_patient,
        authenticated_headers,
        monkeypatch,
    ):
        """Test that a re-import after a schema rewrote a hashed value is a duplicate."""
        from pydantic import field_validator

        from app.schemas.medication import MedicationCreate

        class ExpandingCreate(MedicationCreate):
            @field_validator("dosage")
            @classmethod
            def expand(cls, v):
                return v.replace(" tab", " tablet") if v else v

        mapper = resource_mapper_registry.get_mapper("MedicationStatement")
        monkeypatch.setattr(mapper, "CREATE_SCHEMA", ExpandingCreate)
        patient_id = user_with_patient["patient"].id
        data = _medication_bundle(
            {
                "resourceType": "MedicationStatement",
                "id": "ms-1",
                "status": "active",
                "medicationCodeableConcept": {"text": "Lisinopril"},
                "dosage": [{"text": "1 tab"}],
            }
        )
        client.post(
            _execute_url(patient_id), files=_upload(data), headers=authenticated_headers
        )
        preview = client.post(
            _preview_url(patient_id), files=_upload(data), headers=authenticated_headers
        ).json()
        assert preview["counts"]["medication"] == {
            "new": 0,
            "duplicate": 1,
            "changed": 0,
            "edited": 0,
        }


class TestMalformedResources:
    """One badly formed resource never takes the rest of the file with it."""

    def test_many_skip_reasons_plan_in_linear_time(
        self, db_session: Session, user_with_patient
    ):
        """Test that skip warnings are deduplicated without rescanning the list."""
        count = 40000
        bundle = {
            "resourceType": "Bundle",
            "entry": [
                {
                    "resource": {
                        "resourceType": "MedicationRequest",
                        "id": f"r{i}",
                        "doNotPerform": True,
                    }
                }
                for i in range(count)
            ],
        }
        started = time.monotonic()
        result = HealthRecordImportService(db_session).preview(
            bundle, user_with_patient["patient"], "fhir_bundle", "fhir_bundle"
        )
        # Linear takes a fraction of a second; a scan per reason took about 7 s
        assert time.monotonic() - started < 10
        assert result.warnings[-1] == f"{count - 50} more warnings not shown"

    def test_unhashable_id_does_not_fail_the_import(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that list and object ids are imported without an external id."""
        patient_id = user_with_patient["patient"].id
        data = _medication_bundle(
            {
                "resourceType": "MedicationStatement",
                "id": ["x"],
                "status": "active",
                "medicationCodeableConcept": {"text": "Lisinopril"},
            },
            {
                "resourceType": "MedicationStatement",
                "id": {"a": 1},
                "status": "active",
                "medicationCodeableConcept": {"text": "Albuterol"},
            },
        )
        response = client.post(
            _execute_url(patient_id), files=_upload(data), headers=authenticated_headers
        )
        assert response.status_code == 200, response.text
        assert response.json()["counts"]["medication"]["created"] == 2

    def test_dropped_request_reports_no_warnings(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        """Test that a request covered by a statement adds nothing to the warnings."""
        patient_id = user_with_patient["patient"].id
        data = _medication_bundle(
            {
                "resourceType": "MedicationStatement",
                "id": "ms-1",
                "status": "active",
                "medicationCodeableConcept": _lisinopril_concept(),
            },
            {
                "resourceType": "MedicationRequest",
                "id": "mr-1",
                "status": "active",
                "intent": "order",
                "medicationCodeableConcept": _lisinopril_concept(),
                "dosageInstruction": [{"route": {"text": "Ophthalmic"}}],
            },
        )
        body = client.post(
            _preview_url(patient_id), files=_upload(data), headers=authenticated_headers
        ).json()
        assert body["counts"]["medication"]["new"] == 1
        assert not any("MedicationRequest" in w for w in body["warnings"])


# The C-CDA fixtures need the optional library; without it these tests are skipped
needs_library = pytest.mark.skipif(
    not ccda_available(), reason="healthrecord-bridge is not installed"
)


@needs_library
class TestCcdaFixture:
    """Test preview and execute on the MyChart-style C-CDA, as XML and as a zip."""

    # Resources the converter produces besides the Patient; the three mapped
    # types give 2 conditions, 1 allergy (the "no known food allergy" entry
    # maps to nothing) and 2 medications
    TOTAL_RESOURCES = 25
    EXPECTED_NEW = {"condition": 2, "allergy": 1, "medication": 2}

    def test_preview_xml(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        """Test counts, the file's patient and the converter's notes for the XML."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _preview_url(patient_id),
            files=_upload(MYCHART_CCD.read_bytes(), "DOC0001.XML"),
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert (body["source"], body["format_key"]) == ("ccda", "ccda")
        assert body["total_resources"] == self.TOTAL_RESOURCES
        assert {k: v["new"] for k, v in body["counts"].items()} == self.EXPECTED_NEW
        assert body["unsupported"]["Observation"] == 9
        assert body["patient"] == {
            "full_name": "Ms. Jane Quinn Sampleton",
            "birth_date": "1984-07-22",
            "gender": "female",
        }
        assert any("Plan of Treatment" in w for w in body["warnings"])
        assert any("selected patient" in w for w in body["warnings"])
        assert "Allergies: file states no known food allergies" in body["warnings"]
        assert "Allergies: file states no known allergies" not in body["warnings"]

    def test_preview_zip_matches_xml(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        """Test that the MyChart zip previews the same as its XML."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _preview_url(patient_id),
            files=_upload(_xdm_zip(MYCHART_CCD.read_bytes()), "MyChart.zip"),
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["format_key"] == "ccda"
        assert body["total_resources"] == self.TOTAL_RESOURCES
        assert {k: v["new"] for k, v in body["counts"].items()} == self.EXPECTED_NEW

    def test_execute_then_reimport(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test rows and provenance from the zip, then duplicates from the XML."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _execute_url(patient_id),
            files=_upload(_xdm_zip(MYCHART_CCD.read_bytes()), "MyChart.zip"),
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text
        counts = response.json()["counts"]
        assert {k: v["created"] for k, v in counts.items()} == self.EXPECTED_NEW

        diagnoses = {c.diagnosis for c in _conditions(db_session, patient_id)}
        assert "Essential hypertension" in diagnoses
        assert {a.allergen for a in _allergies(db_session, patient_id)} == {
            "Penicillin G"
        }
        assert len(_medications(db_session, patient_id)) == 2
        provenance = _provenance(db_session, patient_id)
        assert len(provenance) == 5
        assert {p.source for p in provenance} == {"ccda"}
        assert len(_import_logs(db_session, patient_id)) == 1

        # The same document as bare XML carries the same ids, so nothing is created twice
        response = client.post(
            _execute_url(patient_id),
            files=_upload(MYCHART_CCD.read_bytes(), "DOC0001.XML"),
            headers=authenticated_headers,
        )
        counts = response.json()["counts"]
        assert {k: v["created"] for k, v in counts.items()} == {
            "condition": 0,
            "allergy": 0,
            "medication": 0,
        }
        assert {
            k: v["skipped_duplicate"] for k, v in counts.items()
        } == self.EXPECTED_NEW

    def test_zip_over_member_cap(
        self, client: TestClient, user_with_patient, authenticated_headers, monkeypatch
    ):
        """Test that a zip with too many entries is rejected."""
        monkeypatch.setattr(upload, "MAX_ZIP_MEMBERS", 2)
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _preview_url(patient_id),
            data={"format_key": "ccda"},
            files=_upload(_xdm_zip(MYCHART_CCD.read_bytes(), members=3), "MyChart.zip"),
            headers=authenticated_headers,
        )
        assert response.status_code == 400
        assert "entries" in response.text

    def test_zip_over_member_cap_without_format_key(
        self, client: TestClient, user_with_patient, authenticated_headers, monkeypatch
    ):
        """Test that auto-detection reports the cap, not an unrecognized format."""
        monkeypatch.setattr(upload, "MAX_ZIP_MEMBERS", 2)
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _preview_url(patient_id),
            files=_upload(_xdm_zip(MYCHART_CCD.read_bytes(), members=3), "MyChart.zip"),
            headers=authenticated_headers,
        )
        assert response.status_code == 400
        assert "over the 2 limit" in response.text
        assert "Could not recognize" not in response.text


@needs_library
class TestEpicFixture:
    """Test preview and execute on the synthetic export in Epic's real layout."""

    # Resources the converter produces besides the Patient. The allergies
    # section holds one "no known allergies" entry, which the converter marks
    # refuted and the mapper drops with a warning, so there is no allergy section
    TOTAL_RESOURCES = 180
    EXPECTED_NEW = {"condition": 4, "medication": 5}

    def test_preview_xml(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        """Test counts, the file's patient, unsupported types and converter notes."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _preview_url(patient_id),
            files=_upload(EPIC_CCD.read_bytes(), "DOC0001.XML"),
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert (body["source"], body["format_key"]) == ("ccda", "ccda")
        assert body["total_resources"] == self.TOTAL_RESOURCES
        assert {k: v["new"] for k, v in body["counts"].items()} == self.EXPECTED_NEW
        assert "allergy" not in body["counts"]
        # Labs, vitals and social history are Observations; lab panels are DiagnosticReports
        assert body["unsupported"]["Observation"] == 151
        assert body["unsupported"]["DiagnosticReport"] == 11
        assert body["patient"] == {
            "full_name": "Alex Testperson",
            "birth_date": "1964-01-01",
            "gender": "other",
        }
        warnings = body["warnings"]
        assert (
            "The file's birth date 1964-01-01 differs from the selected "
            "patient's 1990-01-01."
        ) in warnings
        assert "Allergies: file states no known allergies" in warnings
        assert "Section 'Care Teams' is not converted yet (1 entry)" in warnings
        assert not [w for w in warnings if "(0 entries)" in w]
        assert "Results: 2 skipped (organizer has no codable observations)" in warnings

    def test_execute_then_reimport_as_zip(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test rows and provenance from the XML, then duplicates from the zip."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _execute_url(patient_id),
            files=_upload(EPIC_CCD.read_bytes(), "DOC0001.XML"),
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text
        counts = response.json()["counts"]
        assert {k: v["created"] for k, v in counts.items()} == self.EXPECTED_NEW
        assert (
            "Allergies: file states no known allergies" in response.json()["warnings"]
        )

        conditions = {c.icd10_code: c for c in _conditions(db_session, patient_id)}
        assert set(conditions) == {"N18.1", "J32.9", "J18.9", "J11.1"}
        assert conditions["N18.1"].diagnosis == "Chronic kidney disease stage 1"
        assert conditions["N18.1"].snomed_code == "431855005"
        assert conditions["N18.1"].onset_date == date(2024, 1, 17)
        assert _allergies(db_session, patient_id) == []
        medications = {
            m.medication_name: m for m in _medications(db_session, patient_id)
        }
        assert len(medications) == 5
        losartan = medications["losartan potassium 50 MG Oral Tablet"]
        assert (losartan.dosage, losartan.frequency, losartan.route) == (
            "50 mg",
            "daily",
            "oral",
        )
        assert losartan.effective_period_start == date(2025, 3, 7)
        # Epic writes twice daily as period 0.5 d
        sertraline = medications["sertraline 50 MG Oral Tablet"]
        assert sertraline.frequency == "2 times per day"
        assert sertraline.notes == "Sig: Take 1 tablet by mouth twice daily."
        # No timing bounds; authoredOn is the order date, not the start of therapy
        levothyroxine = medications["levothyroxine sodium 0.1 MG Oral Tablet"]
        assert levothyroxine.effective_period_start is None
        assert (
            medications["atorvastatin 80 MG Oral Tablet"].effective_period_start is None
        )
        provenance = _provenance(db_session, patient_id)
        assert len(provenance) == 9
        assert {p.source for p in provenance} == {"ccda"}
        assert len(_import_logs(db_session, patient_id)) == 1

        # The same document inside a MyChart zip carries the same ids
        response = client.post(
            _execute_url(patient_id),
            files=_upload(_xdm_zip(EPIC_CCD.read_bytes()), "MyChart.zip"),
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text
        counts = response.json()["counts"]
        assert {k: v["created"] for k, v in counts.items()} == {
            "condition": 0,
            "medication": 0,
        }
        assert {
            k: v["skipped_duplicate"] for k, v in counts.items()
        } == self.EXPECTED_NEW
        assert len(_provenance(db_session, patient_id)) == 9
