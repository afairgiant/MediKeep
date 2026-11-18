"""Attachments of every record type in single and bulk exports.

Each scope's attachments are found through ATTACHMENT_SOURCES, which must name real
model columns and follow the same date range as the scope's own export.
"""

import csv
import io
import json
import re
import zipfile
from datetime import date, datetime

import pdfplumber
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect

from app.api.v1.endpoints.export import ExportScope
from app.core.config import settings
from app.crud.patient import patient as patient_crud
from app.models.models import (
    Allergy,
    Condition,
    Encounter,
    EntityFile,
    Immunization,
    Injury,
    Insurance,
    LabResult,
    LabResultFile,
    MedicalEquipment,
    Medication,
    Procedure,
    Symptom,
    Treatment,
)
from app.schemas.entity_file import EntityType
from app.schemas.patient import PatientCreate
from app.services import report_translations
from app.services.export_attachments import (
    ATTACHMENT_SOURCES,
    ATTACHMENTS_ROOT,
    INDEX_NAME,
    LEFT_OUT_MANIFEST_NAME,
)
from tests.utils.user import create_random_user

EXPORT_URL = "/api/v1/export/data"
BULK_URL = "/api/v1/export/bulk"

# scope -> (entity type files are stored under, record name, builder(patient_id, day))
RECORDS = {
    "medications": (
        "medication",
        "Lisinopril",
        lambda pid, day: Medication(
            patient_id=pid, medication_name="Lisinopril", effective_period_start=day
        ),
    ),
    "lab_results": (
        "lab-result",
        "Panel",
        lambda pid, day: LabResult(
            patient_id=pid,
            test_name="Panel",
            status="completed",
            ordered_date=day,
            completed_date=day,
        ),
    ),
    "allergies": (
        "allergy",
        "Peanut",
        lambda pid, day: Allergy(
            patient_id=pid, allergen="Peanut", reaction="Hives", onset_date=day
        ),
    ),
    "conditions": (
        "condition",
        "Asthma",
        lambda pid, day: Condition(
            patient_id=pid,
            condition_name="Asthma",
            diagnosis="Asthma",
            status="active",
            onset_date=day,
        ),
    ),
    "immunizations": (
        "immunization",
        "Flu",
        lambda pid, day: Immunization(
            patient_id=pid, vaccine_name="Flu", date_administered=day
        ),
    ),
    "procedures": (
        "procedure",
        "Biopsy",
        lambda pid, day: Procedure(patient_id=pid, procedure_name="Biopsy", date=day),
    ),
    "treatments": (
        "treatment",
        "Physio",
        lambda pid, day: Treatment(
            patient_id=pid, treatment_name="Physio", start_date=day
        ),
    ),
    "encounters": (
        "encounter",
        "Checkup",
        lambda pid, day: Encounter(patient_id=pid, reason="Checkup", date=day),
    ),
    "symptoms": (
        "symptom",
        "Cough",
        lambda pid, day: Symptom(
            patient_id=pid, symptom_name="Cough", first_occurrence_date=day
        ),
    ),
    "injuries": (
        "injury",
        "Sprain",
        lambda pid, day: Injury(
            patient_id=pid, injury_name="Sprain", body_part="Ankle", date_of_injury=day
        ),
    ),
    "insurance": (
        "insurance",
        "Aetna",
        lambda pid, day: Insurance(
            patient_id=pid,
            insurance_type="medical",
            company_name="Aetna",
            member_name="Test User",
            member_id="M1",
            effective_date=day,
            status="active",
        ),
    ),
    "medical_equipment": (
        "medical-equipment",
        "CPAP",
        lambda pid, day: MedicalEquipment(
            patient_id=pid,
            equipment_name="CPAP",
            equipment_type="cpap",
            status="active",
            prescribed_date=day,
        ),
    ),
}
SCOPES = list(RECORDS)


@pytest.fixture(autouse=True)
def source_locales(monkeypatch):
    """Read the translations from frontend/public/locales, not a stale local build."""
    from pathlib import Path

    monkeypatch.setattr(
        report_translations, "_LOCALES_DIR", Path("frontend/public/locales").resolve()
    )
    monkeypatch.setattr(report_translations, "_cache", {})


@pytest.fixture
def storage(tmp_path, monkeypatch):
    uploads = tmp_path / "uploads"
    trash = uploads / "trash"
    trash.mkdir(parents=True)
    monkeypatch.setattr(settings, "UPLOAD_DIR", uploads)
    monkeypatch.setattr(settings, "TRASH_DIR", trash)
    monkeypatch.chdir(tmp_path)
    return uploads


def _add_record(db_session, scope, patient_id, day):
    entity_type, _, build = RECORDS[scope]
    record = build(patient_id, day)
    db_session.add(record)
    db_session.commit()
    return record


def _add_file(
    db_session, storage, scope, record, file_name="doc.txt", entity_type=None
):
    stored = storage / "files" / f"{scope}_{record.id}_{file_name}"
    stored.parent.mkdir(parents=True, exist_ok=True)
    stored.write_bytes(f"{scope}:{file_name}".encode())
    entity_file = EntityFile(
        entity_type=entity_type or RECORDS[scope][0],
        entity_id=record.id,
        file_name=file_name,
        file_path=str(stored),
        file_type="text/plain",
        file_size=stored.stat().st_size,
        uploaded_at=datetime.now(),
        storage_backend="local",
    )
    db_session.add(entity_file)
    db_session.commit()
    return entity_file


def _folder(scope, day, name=None):
    return f"{ATTACHMENTS_ROOT}/{scope}/{day.isoformat()}_{name or RECORDS[scope][1]}"


def _export(client: TestClient, headers, **params):
    response = client.get(EXPORT_URL, params=params, headers=headers)
    assert response.status_code == 200, response.text
    return response


def _zip(response):
    assert response.headers["content-type"] == "application/zip"
    return zipfile.ZipFile(io.BytesIO(response.content))


def _attachment_names(zip_file):
    return sorted(
        n
        for n in zip_file.namelist()
        if n.startswith(f"{ATTACHMENTS_ROOT}/") and n != INDEX_NAME
    )


class TestRegistry:
    @pytest.mark.parametrize("source", ATTACHMENT_SOURCES, ids=lambda s: s.scope)
    def test_names_real_columns(self, source):
        columns = {c.key for c in inspect(source.model).mapper.column_attrs}

        assert "patient_id" in columns
        assert set(source.label_attrs) <= columns
        assert set(source.date_attrs) <= columns
        assert source.filter_attr is None or source.filter_attr in columns

    @pytest.mark.parametrize("source", ATTACHMENT_SOURCES, ids=lambda s: s.scope)
    def test_scope_is_an_export_scope(self, source):
        assert source.scope in {s.value for s in ExportScope}

    def test_every_file_entity_type_is_exported_or_deliberately_not(self):
        covered = {t for source in ATTACHMENT_SOURCES for t in source.entity_types}
        not_exported = {"vitals"}  # no record type with files behind it

        assert {t.value for t in EntityType} - covered == not_exported

    def test_every_registered_scope_has_a_test_record(self):
        assert {s.scope for s in ATTACHMENT_SOURCES} == set(RECORDS)


class TestSingleExportPerScope:
    @pytest.mark.parametrize("scope", SCOPES)
    def test_file_is_in_the_zip_with_index_and_listing(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        storage,
        scope,
    ):
        day = date(2026, 3, 4)
        record = _add_record(db_session, scope, user_with_patient["patient"].id, day)
        _add_file(db_session, storage, scope, record)

        zip_file = _zip(
            _export(
                client,
                authenticated_headers,
                format="json",
                scope=scope,
                include_files="true",
            )
        )

        path = f"{_folder(scope, day)}/doc.txt"
        assert zip_file.read(path) == f"{scope}:doc.txt".encode()
        index = zip_file.read(INDEX_NAME).decode("utf-8-sig")
        assert path in index
        main = next(n for n in zip_file.namelist() if n.endswith(".json"))
        listed = json.loads(zip_file.read(main))[scope][0]["attached_files"]
        assert listed == [
            {
                "zip_path": path,
                "file_name": "doc.txt",
                "file_type": "text/plain",
                "file_size": len(f"{scope}:doc.txt"),
            }
        ]

    @pytest.mark.parametrize("scope", SCOPES)
    def test_only_files_of_records_in_the_date_range_are_included(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        storage,
        scope,
    ):
        patient_id = user_with_patient["patient"].id
        early = date(2026, 1, 10)
        late = date(2026, 6, 10)
        _add_file(
            db_session,
            storage,
            scope,
            _add_record(db_session, scope, patient_id, early),
            "early.txt",
        )
        late_record = _add_record(db_session, scope, patient_id, late)
        _add_file(db_session, storage, scope, late_record, "late.txt")

        zip_file = _zip(
            _export(
                client,
                authenticated_headers,
                format="json",
                scope=scope,
                include_files="true",
                start_date="2026-03-01",
            )
        )

        assert _attachment_names(zip_file) == [f"{_folder(scope, late)}/late.txt"]
        # the files follow exactly the records the export itself lists
        main = next(n for n in zip_file.namelist() if n.endswith(".json"))
        exported = json.loads(zip_file.read(main))[scope]
        assert [record["id"] for record in exported] == [late_record.id]

    def test_scope_all_includes_every_type(
        self, client, db_session, user_with_patient, authenticated_headers, storage
    ):
        day = date(2026, 3, 4)
        for scope in SCOPES:
            record = _add_record(
                db_session, scope, user_with_patient["patient"].id, day
            )
            _add_file(db_session, storage, scope, record)

        zip_file = _zip(
            _export(
                client,
                authenticated_headers,
                format="json",
                scope="all",
                include_files="true",
            )
        )

        assert _attachment_names(zip_file) == sorted(
            f"{_folder(scope, day)}/doc.txt" for scope in SCOPES
        )

    def test_another_scopes_files_are_not_included(
        self, client, db_session, user_with_patient, authenticated_headers, storage
    ):
        patient_id = user_with_patient["patient"].id
        day = date(2026, 3, 4)
        for scope in ("medications", "allergies"):
            _add_file(
                db_session,
                storage,
                scope,
                _add_record(db_session, scope, patient_id, day),
            )

        zip_file = _zip(
            _export(
                client,
                authenticated_headers,
                format="json",
                scope="medications",
                include_files="true",
            )
        )

        assert _attachment_names(zip_file) == [f"{_folder('medications', day)}/doc.txt"]

    def test_another_patients_files_are_not_included(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        storage,
    ):
        day = date(2026, 3, 4)
        other_user = create_random_user(db_session)["user"]
        other_patient = patient_crud.create_for_user(
            db_session,
            user_id=other_user.id,
            patient_data=PatientCreate(
                first_name="Other",
                last_name="Person",
                birth_date=date(1980, 1, 1),
                gender="F",
                address="1 Other St",
            ),
        )
        _add_file(
            db_session,
            storage,
            "medications",
            _add_record(db_session, "medications", other_patient.id, day),
            "theirs.txt",
        )
        _add_file(
            db_session,
            storage,
            "medications",
            _add_record(
                db_session, "medications", user_with_patient["patient"].id, day
            ),
            "mine.txt",
        )

        zip_file = _zip(
            _export(
                client,
                authenticated_headers,
                format="json",
                scope="medications",
                include_files="true",
            )
        )

        assert _attachment_names(zip_file) == [
            f"{_folder('medications', day)}/mine.txt"
        ]

    def test_visit_and_encounter_files_both_belong_to_the_encounter(
        self, client, db_session, user_with_patient, authenticated_headers, storage
    ):
        day = date(2026, 3, 4)
        record = _add_record(
            db_session, "encounters", user_with_patient["patient"].id, day
        )
        _add_file(db_session, storage, "encounters", record, "a.txt", "encounter")
        _add_file(db_session, storage, "encounters", record, "b.txt", "visit")

        zip_file = _zip(
            _export(
                client,
                authenticated_headers,
                format="json",
                scope="encounters",
                include_files="true",
            )
        )

        assert _attachment_names(zip_file) == [
            f"{_folder('encounters', day)}/a.txt",
            f"{_folder('encounters', day)}/b.txt",
        ]


class TestSingleExportFormats:
    @pytest.mark.parametrize("format_", ["json", "csv", "pdf"])
    def test_every_format_becomes_a_zip_with_the_export_and_the_file(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        storage,
        format_,
    ):
        day = date(2026, 3, 4)
        _add_file(
            db_session,
            storage,
            "medications",
            _add_record(
                db_session, "medications", user_with_patient["patient"].id, day
            ),
        )

        zip_file = _zip(
            _export(
                client,
                authenticated_headers,
                format=format_,
                scope="medications",
                include_files="true",
            )
        )

        assert any(
            "/" not in n and n.endswith(f".{format_}") for n in zip_file.namelist()
        )
        assert f"{_folder('medications', day)}/doc.txt" in zip_file.namelist()

    def test_csv_lists_one_path_per_line_without_type_or_size(
        self, client, db_session, user_with_patient, authenticated_headers, storage
    ):
        day = date(2026, 3, 4)
        record = _add_record(
            db_session, "medications", user_with_patient["patient"].id, day
        )
        _add_file(db_session, storage, "medications", record, "a.txt")
        _add_file(db_session, storage, "medications", record, "b.txt")

        zip_file = _zip(
            _export(
                client,
                authenticated_headers,
                format="csv",
                scope="medications",
                include_files="true",
            )
        )

        name = next(
            n for n in zip_file.namelist() if "/" not in n and n.endswith(".csv")
        )
        rows = list(csv.reader(io.StringIO(zip_file.read(name).decode("utf-8-sig"))))
        header_index = next(i for i, row in enumerate(rows) if "Attached files" in row)
        cell = rows[header_index + 1][rows[header_index].index("Attached files")]
        assert cell.splitlines() == [
            f"{_folder('medications', day)}/a.txt",
            f"{_folder('medications', day)}/b.txt",
        ]

    def test_without_the_option_the_export_is_not_a_zip(
        self, client, db_session, user_with_patient, authenticated_headers, storage
    ):
        _add_file(
            db_session,
            storage,
            "medications",
            _add_record(
                db_session,
                "medications",
                user_with_patient["patient"].id,
                date(2026, 3, 4),
            ),
        )

        response = _export(
            client, authenticated_headers, format="json", scope="medications"
        )

        assert response.headers["content-type"] == "application/json"
        assert "attached_files" not in response.json()["medications"][0]

    def test_option_without_any_attachment_gives_the_plain_export(
        self, client, db_session, user_with_patient, authenticated_headers
    ):
        _add_record(
            db_session,
            "medications",
            user_with_patient["patient"].id,
            date(2026, 3, 4),
        )

        response = _export(
            client,
            authenticated_headers,
            format="json",
            scope="medications",
            include_files="true",
        )

        assert response.headers["content-type"] == "application/json"
        assert response.json()["medications"][0]["attached_files"] == []

    @pytest.mark.parametrize("scope", SCOPES)
    def test_pdf_shows_each_records_attachments(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        storage,
        scope,
    ):
        day = date(2026, 3, 4)
        _add_file(
            db_session,
            storage,
            scope,
            _add_record(db_session, scope, user_with_patient["patient"].id, day),
        )

        zip_file = _zip(
            _export(
                client,
                authenticated_headers,
                format="pdf",
                scope=scope,
                include_files="true",
            )
        )

        pdf_name = next(n for n in zip_file.namelist() if n.endswith(".pdf"))
        with pdfplumber.open(io.BytesIO(zip_file.read(pdf_name))) as pdf:
            text = "".join(page.extract_text() or "" for page in pdf.pages)
        squeezed = text.replace("\n", "").replace(" ", "")
        assert f"{_folder(scope, day)}/doc.txt".replace(" ", "") in squeezed
        # the type and size are on their own line, not appended to the path
        detail_lines = [line for line in text.splitlines() if "text/plain" in line]
        assert detail_lines
        assert not any("attachments/" in line for line in detail_lines)
        assert not any("(" in line for line in detail_lines)

    def test_pdf_still_renders_when_one_record_has_very_many_attachments(
        self, client, db_session, user_with_patient, authenticated_headers, storage
    ):
        day = date(2026, 3, 4)
        record = _add_record(
            db_session, "medications", user_with_patient["patient"].id, day
        )
        for number in range(60):
            _add_file(db_session, storage, "medications", record, f"f{number:02d}.txt")

        zip_file = _zip(
            _export(
                client,
                authenticated_headers,
                format="pdf",
                scope="medications",
                include_files="true",
            )
        )

        pdf_name = next(n for n in zip_file.namelist() if n.endswith(".pdf"))
        with pdfplumber.open(io.BytesIO(zip_file.read(pdf_name))) as pdf:
            text = "".join(page.extract_text() or "" for page in pdf.pages)
        assert "PDF Generation Error" not in text
        assert "f59.txt" in text.replace("\n", "").replace(" ", "")

    def test_pdf_footer_does_not_claim_files_when_there_are_none(
        self, client, db_session, user_with_patient, authenticated_headers
    ):
        _add_record(
            db_session,
            "medications",
            user_with_patient["patient"].id,
            date(2026, 3, 4),
        )

        response = _export(
            client,
            authenticated_headers,
            format="pdf",
            scope="medications",
            include_files="true",
        )

        assert response.headers["content-type"] == "application/pdf"
        with pdfplumber.open(io.BytesIO(response.content)) as pdf:
            text = " ".join(page.extract_text() or "" for page in pdf.pages)
        assert "No files attached" in text
        assert "in the ZIP" not in text

    def test_csv_shows_the_translated_empty_value(
        self, client, db_session, user_with_patient, authenticated_headers
    ):
        from app.crud.user_preferences import user_preferences

        prefs = user_preferences.get_or_create_by_user_id(
            db_session, user_id=user_with_patient["user"].id
        )
        prefs.language = "de"
        db_session.commit()
        _add_record(
            db_session,
            "medications",
            user_with_patient["patient"].id,
            date(2026, 3, 4),
        )

        response = _export(
            client,
            authenticated_headers,
            format="csv",
            scope="medications",
            include_files="true",
        )

        assert "Keine Dateien angehängt" in response.text
        assert "No files attached" not in response.text


class TestMigratedLabFiles:
    def test_legacy_row_already_copied_to_entity_files_is_exported_once(
        self, client, db_session, user_with_patient, authenticated_headers, storage
    ):
        day = date(2026, 3, 4)
        result = _add_record(
            db_session, "lab_results", user_with_patient["patient"].id, day
        )
        copied = _add_file(db_session, storage, "lab_results", result, "scan.txt")
        db_session.add(
            LabResultFile(
                lab_result_id=result.id,
                file_name=copied.file_name,
                file_path=copied.file_path,
                file_type="text/plain",
                file_size=copied.file_size,
                uploaded_at=datetime.now(),
            )
        )
        db_session.commit()

        zip_file = _zip(
            _export(
                client,
                authenticated_headers,
                format="json",
                scope="lab_results",
                include_files="true",
            )
        )

        assert _attachment_names(zip_file) == [
            f"{_folder('lab_results', day)}/scan.txt"
        ]


class TestBulkExport:
    def _bulk(self, client, headers, **body):
        body.setdefault("format", "json")
        response = client.post(BULK_URL, json=body, headers=headers)
        assert response.status_code == 200, response.text
        return _zip(response)

    @pytest.mark.parametrize("format_", ["json", "csv", "pdf"])
    def test_attachments_are_always_included(
        self,
        client,
        db_session,
        user_with_patient,
        authenticated_headers,
        storage,
        format_,
    ):
        day = date(2026, 3, 4)
        patient_id = user_with_patient["patient"].id
        for scope in ("medications", "lab_results"):
            _add_file(
                db_session,
                storage,
                scope,
                _add_record(db_session, scope, patient_id, day),
            )
        _add_file(
            db_session,
            storage,
            "allergies",
            _add_record(db_session, "allergies", patient_id, day),
        )

        zip_file = self._bulk(
            client,
            authenticated_headers,
            format=format_,
            scopes=["medications", "lab_results"],
        )

        assert _attachment_names(zip_file) == [
            f"{_folder('lab_results', day)}/doc.txt",
            f"{_folder('medications', day)}/doc.txt",
        ]
        assert INDEX_NAME in zip_file.namelist()
        exports = [
            n for n in zip_file.namelist() if "/" not in n and n.endswith(f".{format_}")
        ]
        assert len(exports) == 2

    def test_date_range_applies_to_attachments(
        self, client, db_session, user_with_patient, authenticated_headers, storage
    ):
        patient_id = user_with_patient["patient"].id
        late = date(2026, 6, 10)
        _add_file(
            db_session,
            storage,
            "medications",
            _add_record(db_session, "medications", patient_id, date(2026, 1, 10)),
            "early.txt",
        )
        _add_file(
            db_session,
            storage,
            "medications",
            _add_record(db_session, "medications", patient_id, late),
            "late.txt",
        )

        zip_file = self._bulk(
            client,
            authenticated_headers,
            scopes=["medications"],
            start_date="2026-03-01",
        )

        assert _attachment_names(zip_file) == [
            f"{_folder('medications', late)}/late.txt"
        ]

    def test_files_that_could_not_be_added_are_listed(
        self, client, db_session, user_with_patient, authenticated_headers, storage
    ):
        day = date(2026, 3, 4)
        record = _add_record(
            db_session, "medications", user_with_patient["patient"].id, day
        )
        gone = _add_file(db_session, storage, "medications", record, "gone.txt")
        _add_file(db_session, storage, "medications", record, "here.txt")
        (storage / "files").joinpath(f"medications_{record.id}_gone.txt").unlink()
        assert gone.file_name == "gone.txt"

        zip_file = self._bulk(client, authenticated_headers, scopes=["medications"])

        manifest = zip_file.read(LEFT_OUT_MANIFEST_NAME).decode("utf-8")
        assert "- gone.txt (Medications: Lisinopril, 03/04/2026): file not found" in (
            manifest
        )
        assert "here.txt" not in manifest
        assert f"{_folder('medications', day)}/here.txt" in zip_file.namelist()

    def test_filename_has_a_timestamp(
        self, client, db_session, user_with_patient, authenticated_headers
    ):
        _add_record(
            db_session,
            "medications",
            user_with_patient["patient"].id,
            date(2026, 3, 4),
        )

        response = client.post(
            BULK_URL,
            json={"scopes": ["medications"], "format": "json"},
            headers=authenticated_headers,
        )

        assert re.search(
            r'filename="medical_records_bulk_\d{8}_\d{6}\.zip"',
            response.headers["content-disposition"],
        )

    def test_scope_without_attachments_exports_as_before(
        self, client, db_session, user_with_patient, authenticated_headers
    ):
        _add_record(
            db_session,
            "medications",
            user_with_patient["patient"].id,
            date(2026, 3, 4),
        )

        zip_file = self._bulk(client, authenticated_headers, scopes=["medications"])

        assert _attachment_names(zip_file) == []
        assert INDEX_NAME not in zip_file.namelist()
        assert LEFT_OUT_MANIFEST_NAME not in zip_file.namelist()
        assert len(zip_file.namelist()) == 1
