"""
Test the health record import API endpoints with a hand-written FHIR bundle.
"""

import io
import json
from datetime import date
from pathlib import Path
from typing import Optional

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.models.activity_log import ActivityLog
from app.models.models import Allergy, Condition, ImportProvenance, PatientShare
from app.schemas.patient import PatientCreate
from app.services.importers import upload
from app.services.importers.mappers import (
    BaseResourceMapper,
    MappedRecord,
    resource_mapper_registry,
)
from app.services.importers.service import HealthRecordImportService
from tests.utils.user import create_random_user, create_user_token_headers

FIXTURE = (
    Path(__file__).resolve().parent.parent
    / "fixtures"
    / "health_record_import"
    / "fhir_bundle_minimal.json"
)
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


def _bundle_with_diagnosis(diagnosis: str) -> bytes:
    """The fixture with the first condition's text changed."""
    bundle = json.loads(FIXTURE.read_text())
    bundle["entry"][1]["resource"]["code"]["text"] = diagnosis
    return json.dumps(bundle).encode()


class ConditionStubMapper(BaseResourceMapper):
    """Minimal Condition mapper so the pipeline can be exercised without real mappers."""

    RESOURCE_TYPE = "Condition"
    RECORD_TYPE = "condition"
    MODEL = Condition

    def map(self, resource, bundle):
        status = resource["clinicalStatus"].get("coding")[0]["code"]
        diagnosis = resource["code"]["text"]
        onset = resource.get("onsetDateTime", "")[:10] or None
        return MappedRecord(
            record_type=self.RECORD_TYPE,
            external_id=resource.get("id"),
            data={
                "diagnosis": diagnosis,
                "status": status,
                "onset_date": date.fromisoformat(onset) if onset else None,
            },
            hash_parts=(diagnosis, status, onset),
            label=diagnosis,
        )

    def hash_parts_for_row(self, row):
        onset = row.onset_date.isoformat() if row.onset_date else None
        return (row.diagnosis, row.status, onset)


@pytest.fixture
def condition_mapper():
    """Register the stub mapper for one test."""
    resource_mapper_registry.register(ConditionStubMapper())
    yield
    resource_mapper_registry.unregister("Condition")


class AllergyStubMapper(BaseResourceMapper):
    """Minimal AllergyIntolerance mapper for tests that need two record types."""

    RESOURCE_TYPE = "AllergyIntolerance"
    RECORD_TYPE = "allergy"
    MODEL = Allergy

    def map(self, resource, bundle):
        allergen = resource["code"]["text"]
        return MappedRecord(
            record_type=self.RECORD_TYPE,
            external_id=resource.get("id"),
            data={
                "allergen": allergen,
                "reaction": "Not specified",
                "severity": "none",
                "status": "active",
            },
            hash_parts=(allergen,),
            label=allergen,
        )

    def hash_parts_for_row(self, row):
        return (row.allergen,)


@pytest.fixture
def allergy_mapper():
    """Register the allergy stub mapper for one test."""
    resource_mapper_registry.register(AllergyStubMapper())
    yield
    resource_mapper_registry.unregister("AllergyIntolerance")


def _conditions(db: Session, patient_id: int):
    return db.query(Condition).filter(Condition.patient_id == patient_id).all()


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
        """Test that the formats endpoint lists the FHIR bundle format and the size limit."""
        response = client.get(FORMATS_URL, headers=authenticated_headers)
        assert response.status_code == 200
        body = response.json()
        assert {f["key"] for f in body["formats"]} == {"fhir_bundle"}
        assert body["max_file_size_bytes"] == upload.MAX_IMPORT_FILE_SIZE

    def test_requires_auth(self, client: TestClient):
        """Test that the formats endpoint requires authentication."""
        assert client.get(FORMATS_URL).status_code == 401


class TestPreview:
    """Test the preview endpoint."""

    def test_reports_unsupported_without_mappers(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        """Test that with no mappers every resource is reported as unsupported."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _preview_url(patient_id), files=_upload(), headers=authenticated_headers
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["source"] == "fhir"
        assert body["format_key"] == "fhir_bundle"
        assert body["total_resources"] == 4
        assert body["counts"] == {}
        assert body["unsupported"] == {
            "Condition": 2,
            "AllergyIntolerance": 1,
            "Observation": 1,
        }

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

    def test_counts_new_with_mapper(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
        condition_mapper,
    ):
        """Test that mapped resources are counted as new and nothing is written."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _preview_url(patient_id), files=_upload(), headers=authenticated_headers
        )
        body = response.json()
        assert body["counts"] == {
            "condition": {"new": 2, "duplicate": 0, "changed": 0, "edited": 0}
        }
        assert body["unsupported"] == {"AllergyIntolerance": 1, "Observation": 1}
        assert _conditions(db_session, patient_id) == []
        assert _provenance(db_session, patient_id) == []

    def test_rejects_wrong_extension(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        """Test that a file with an unsupported extension is rejected."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _preview_url(patient_id),
            files=_upload(b"<x/>", "export.xml"),
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

    def test_without_mappers_writes_nothing_but_logs(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        """Test that execute with no mappers creates no rows and still logs the import."""
        patient_id = user_with_patient["patient"].id
        response = client.post(
            _execute_url(patient_id), files=_upload(), headers=authenticated_headers
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["counts"] == {}
        assert body["unsupported"]["Condition"] == 2
        assert len(body["import_batch_id"]) == 32
        assert _conditions(db_session, patient_id) == []
        logs = _import_logs(db_session, patient_id)
        assert len(logs) == 1
        assert logs[0].action == "imported"
        assert logs[0].event_metadata["import_batch_id"] == body["import_batch_id"]

    def test_creates_rows_and_provenance(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
        condition_mapper,
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

        rows = _conditions(db_session, patient_id)
        assert {r.diagnosis for r in rows} == {"Essential hypertension", "Asthma"}
        provenance = _provenance(db_session, patient_id)
        assert {p.record_id for p in provenance} == {r.id for r in rows}
        assert {p.external_id for p in provenance} == {"cond-1", "cond-2"}
        assert {p.source for p in provenance} == {"fhir"}
        assert {p.import_batch_id for p in provenance} == {body["import_batch_id"]}

    def test_second_import_is_all_duplicates(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
        condition_mapper,
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
        assert len(_conditions(db_session, patient_id)) == 2

    def test_locally_edited_row_is_skipped_by_default(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
        condition_mapper,
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
        condition_mapper,
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
        condition_mapper,
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
        condition_mapper,
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
        assert len(_provenance(db_session, patient_id)) == 2

        response = client.post(
            _execute_url(patient_id), files=_upload(), headers=authenticated_headers
        )
        assert response.json()["counts"]["condition"]["created"] == 2
        rows = _conditions(db_session, patient_id)
        provenance = _provenance(db_session, patient_id)
        assert len(rows) == 2
        assert {p.record_id for p in provenance} == {r.id for r in rows}

    def test_repeated_resource_in_one_file_is_a_duplicate(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
        condition_mapper,
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
        condition_mapper,
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
        }

    def test_same_external_id_across_record_types(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
        condition_mapper,
        allergy_mapper,
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
        allergy_entry["resource"]["code"] = {"text": "Peanut"}
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
        condition_mapper,
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
        assert response.json()["counts"] == {}
        assert _conditions(db_session, patient_id) == []

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
        condition_mapper,
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
        condition_mapper,
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
        self,
        client: TestClient,
        user_with_patient,
        authenticated_headers,
        condition_mapper,
    ):
        """Test that a resource the mapper cannot handle gives a fixed warning line."""
        patient_id = user_with_patient["patient"].id
        bundle = json.loads(FIXTURE.read_text())
        del bundle["entry"][1]["resource"]["clinicalStatus"]
        data = json.dumps(bundle).encode()

        response = client.post(
            _preview_url(patient_id), files=_upload(data), headers=authenticated_headers
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["counts"]["condition"]["new"] == 1
        assert [w for w in body["warnings"] if w.startswith("Skipped")] == [
            "Skipped Condition/cond-1: could not be mapped"
        ]
        assert "clinicalStatus" not in response.text

    def test_mapper_attribute_error_is_skipped(
        self,
        client: TestClient,
        user_with_patient,
        authenticated_headers,
        condition_mapper,
    ):
        """Test that a field of the wrong shape skips the resource instead of failing."""
        patient_id = user_with_patient["patient"].id
        bundle = json.loads(FIXTURE.read_text())
        bundle["entry"][1]["resource"]["clinicalStatus"] = "active"
        data = json.dumps(bundle).encode()

        response = client.post(
            _preview_url(patient_id), files=_upload(data), headers=authenticated_headers
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
        condition_mapper,
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
        provenance = _provenance(db_session, patient.id)
        assert {(p.source, p.external_id) for p in provenance} == {
            ("ccda", "cond-1"),
            ("ccda", "cond-2"),
        }
        assert len(_conditions(db_session, patient.id)) == 2

    def test_provenance_row_is_claimed_once_per_import(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
        condition_mapper,
    ):
        """Test that only the first of two resources matching one row may update it."""
        patient_id = user_with_patient["patient"].id
        client.post(
            _execute_url(patient_id), files=_upload(), headers=authenticated_headers
        )
        bundle = json.loads(FIXTURE.read_text())
        by_id = bundle["entry"][1]
        by_hash = json.loads(json.dumps(by_id))
        by_id["resource"]["code"]["text"] = "Hypertension, essential"
        by_hash["resource"]["id"] = "late-copy"
        bundle["entry"] = [bundle["entry"][0], by_id, by_hash]
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
        updated = next(
            p for p in _provenance(db_session, patient_id) if p.external_id == "cond-1"
        )
        assert db_session.get(Condition, updated.record_id).diagnosis == (
            "Hypertension, essential"
        )
        assert len(_conditions(db_session, patient_id)) == 2

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
        condition_mapper,
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
