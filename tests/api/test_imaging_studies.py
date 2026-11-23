"""Tests for Imaging Study API endpoints."""

from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.v1.endpoints import imaging_study as imaging_endpoints
from app.core.config import settings
from app.crud.activity_log import activity_log as activity_log_crud
from app.crud.patient import patient as patient_crud
from app.models.activity_log import EntityType
from app.models.clinical import Encounter
from app.models.imaging import ImagingInstance, ImagingSeries, ImagingStudy
from app.models.procedures import Procedure
from app.models.sharing import PatientShare
from app.services.imaging_storage import study_directory
from tests.utils.user import (
    create_random_user,
    create_test_user_with_patient,
    create_user_token_headers,
)

URL = "/api/v1/imaging-studies/"
DICOM_BYTES = b"\x00" * 128 + b"DICM" + b"\x01\x02\x03"


def _make_study(
    db: Session,
    patient_id: int,
    study_uid: str = "1.2.3",
    study_date: date = date(2026, 5, 1),
    series_specs=((2, 2), (1, 3)),
) -> ImagingStudy:
    """Study with files on disk; series_specs is (series_number, image_count) pairs."""
    study = ImagingStudy(
        patient_id=patient_id,
        study_instance_uid=study_uid,
        study_date=study_date,
        modalities=["CT"],
        study_description="CT CHEST",
        series_count=len(series_specs),
        instance_count=sum(count for _, count in series_specs),
        total_size=0,
    )
    db.add(study)
    db.flush()
    directory = study_directory(patient_id, study_uid)
    for series_number, image_count in series_specs:
        series_uid = f"{study_uid}.{series_number}"
        series = ImagingSeries(
            study_id=study.id,
            series_instance_uid=series_uid,
            modality="CT",
            series_number=series_number,
            instance_count=image_count,
        )
        db.add(series)
        db.flush()
        (directory / series_uid).mkdir(parents=True, exist_ok=True)
        for number in range(image_count, 0, -1):
            sop_uid = f"{series_uid}.{number}"
            path = directory / series_uid / f"{sop_uid}.dcm"
            path.write_bytes(DICOM_BYTES)
            db.add(
                ImagingInstance(
                    series_id=series.id,
                    sop_instance_uid=sop_uid,
                    instance_number=number,
                    file_path=str(path),
                    file_size=len(DICOM_BYTES),
                    rows=512,
                    cols=512,
                )
            )
    db.commit()
    db.refresh(study)
    return study


def _user_with_patient(db: Session):
    """(user, patient, token headers) for a second, unrelated user."""
    data = create_test_user_with_patient(db)
    return (
        data["user"],
        data["patient"],
        create_user_token_headers(data["user"].username),
    )


def _shared_user_headers(db: Session, owner, patient_id: int, permission: str):
    viewer = create_random_user(db)
    db.add(
        PatientShare(
            patient_id=patient_id,
            shared_by_user_id=owner.id,
            shared_with_user_id=viewer["user"].id,
            permission_level=permission,
            is_active=True,
        )
    )
    viewer["user"].active_patient_id = patient_id
    db.commit()
    return create_user_token_headers(viewer["user"].username)


@pytest.fixture(autouse=True)
def trash_dir(monkeypatch):
    """Keep trashed studies inside the test upload directory."""
    trash = Path(settings.UPLOAD_DIR) / "trash"
    monkeypatch.setattr(settings, "TRASH_DIR", trash)
    return trash


@pytest.fixture(autouse=True)
def reset_file_access_log(monkeypatch):
    monkeypatch.setattr(imaging_endpoints, "_file_access_logged_at", {})


@pytest.fixture
def patient_id(user_with_patient):
    return user_with_patient["patient"].id


@pytest.fixture
def study(db_session, patient_id):
    return _make_study(db_session, patient_id)


class TestReadImagingStudies:
    def test_list_empty(self, client: TestClient, authenticated_headers):
        response = client.get(URL, headers=authenticated_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_list_newest_first_with_undated_last(
        self, client, db_session, patient_id, authenticated_headers
    ):
        _make_study(db_session, patient_id, "1.1", date(2025, 1, 1), ((1, 1),))
        _make_study(db_session, patient_id, "1.2", None, ((1, 1),))
        _make_study(db_session, patient_id, "1.3", date(2026, 1, 1), ((1, 1),))

        response = client.get(URL, headers=authenticated_headers)

        assert response.status_code == 200
        assert [s["study_instance_uid"] for s in response.json()] == [
            "1.3",
            "1.1",
            "1.2",
        ]

    def test_list_paginates(
        self, client, db_session, patient_id, authenticated_headers
    ):
        for n in range(3):
            _make_study(
                db_session, patient_id, f"2.{n}", date(2026, 1, n + 1), ((1, 1),)
            )

        response = client.get(
            URL, params={"skip": 1, "limit": 1}, headers=authenticated_headers
        )

        assert [s["study_instance_uid"] for s in response.json()] == ["2.1"]

    def test_list_other_patient_is_forbidden(
        self, client, db_session, authenticated_headers
    ):
        _, other_patient, _ = _user_with_patient(db_session)

        response = client.get(
            URL, params={"patient_id": other_patient.id}, headers=authenticated_headers
        )

        assert response.status_code == 403

    def test_get_returns_header_fields(self, client, study, authenticated_headers):
        response = client.get(f"{URL}{study.id}", headers=authenticated_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["study_instance_uid"] == "1.2.3"
        assert data["modalities"] == ["CT"]
        assert data["series_count"] == 2
        assert data["instance_count"] == 5

    def test_get_missing_returns_404(self, client, authenticated_headers):
        assert (
            client.get(f"{URL}999999", headers=authenticated_headers).status_code == 404
        )

    def test_get_other_users_study_returns_404(self, client, db_session, study):
        _, _, other_headers = _user_with_patient(db_session)

        assert client.get(f"{URL}{study.id}", headers=other_headers).status_code == 404


class TestSeriesAndFiles:
    def test_series_ordered_with_instances_and_no_paths(
        self, client, study, authenticated_headers
    ):
        response = client.get(f"{URL}{study.id}/series", headers=authenticated_headers)

        assert response.status_code == 200
        series = response.json()
        assert [s["series_number"] for s in series] == [1, 2]
        assert [i["instance_number"] for i in series[0]["instances"]] == [1, 2, 3]
        assert all("file_path" not in i for s in series for i in s["instances"])

    def test_file_returns_dicom_bytes(self, client, study, authenticated_headers):
        instance_id = study.series[0].instances[0].id

        response = client.get(
            f"{URL}{study.id}/instances/{instance_id}/file",
            headers=authenticated_headers,
        )

        assert response.status_code == 200
        assert response.content == DICOM_BYTES
        assert response.headers["content-type"] == "application/dicom"
        assert response.headers["cache-control"] == "private, no-store"

    def test_file_of_another_study_returns_404(
        self, client, db_session, patient_id, study, authenticated_headers
    ):
        other = _make_study(db_session, patient_id, "9.9", series_specs=((1, 1),))
        foreign_instance_id = other.series[0].instances[0].id

        response = client.get(
            f"{URL}{study.id}/instances/{foreign_instance_id}/file",
            headers=authenticated_headers,
        )

        assert response.status_code == 404

    def test_file_missing_on_disk_returns_404(
        self, client, study, authenticated_headers
    ):
        instance = study.series[0].instances[0]
        Path(instance.file_path).unlink()

        response = client.get(
            f"{URL}{study.id}/instances/{instance.id}/file",
            headers=authenticated_headers,
        )

        assert response.status_code == 404

    def test_file_path_outside_storage_returns_404(
        self, client, db_session, study, authenticated_headers, tmp_path
    ):
        outside = tmp_path / "secret.dcm"
        outside.write_bytes(b"secret")
        instance = study.series[0].instances[0]
        instance.file_path = str(outside)
        db_session.commit()

        response = client.get(
            f"{URL}{study.id}/instances/{instance.id}/file",
            headers=authenticated_headers,
        )

        assert response.status_code == 404

    def test_file_reads_are_logged_once_per_window(
        self, client, study, authenticated_headers, monkeypatch
    ):
        logged = []
        monkeypatch.setattr(
            imaging_endpoints,
            "log_data_access",
            lambda *args, **kwargs: logged.append((args[4], kwargs)),
        )
        instances = [i for s in study.series for i in s.instances]

        for instance in instances:
            client.get(
                f"{URL}{study.id}/instances/{instance.id}/file",
                headers=authenticated_headers,
            )
        file_logs = [entry for entry in logged if entry[0] == "ImagingInstanceFile"]
        assert len(file_logs) == 1
        assert file_logs[0][1]["record_id"] == study.id

        monkeypatch.setattr(imaging_endpoints, "FILE_ACCESS_LOG_WINDOW_SECONDS", 0)
        client.get(
            f"{URL}{study.id}/instances/{instances[0].id}/file",
            headers=authenticated_headers,
        )
        assert len([e for e in logged if e[0] == "ImagingInstanceFile"]) == 2

    def test_file_requires_access(self, client, db_session, study):
        _, _, other_headers = _user_with_patient(db_session)
        instance_id = study.series[0].instances[0].id

        response = client.get(
            f"{URL}{study.id}/instances/{instance_id}/file", headers=other_headers
        )

        assert response.status_code == 404


class TestUpdateImagingStudy:
    def test_update_editable_fields_only(self, client, study, authenticated_headers):
        response = client.put(
            f"{URL}{study.id}",
            json={
                "notes": "Follow-up in 6 months",
                "report_text": "No acute findings.",
                "tags": ["chest"],
                "study_description": "changed",
                "study_instance_uid": "6.6.6",
            },
            headers=authenticated_headers,
        )

        assert response.status_code == 200, response.text
        data = response.json()
        assert data["notes"] == "Follow-up in 6 months"
        assert data["report_text"] == "No acute findings."
        assert data["tags"] == ["chest"]
        assert data["study_description"] == "CT CHEST"
        assert data["study_instance_uid"] == "1.2.3"

    def test_update_logs_activity(
        self, client, db_session, study, user_with_patient, authenticated_headers
    ):
        client.put(
            f"{URL}{study.id}", json={"notes": "x"}, headers=authenticated_headers
        )

        logs = activity_log_crud.get_by_entity(
            db_session, entity_type=EntityType.IMAGING_STUDY, entity_id=study.id
        )
        assert any(log.action == "updated" for log in logs)

    def test_link_own_procedure_and_encounter(
        self, client, db_session, patient_id, study, authenticated_headers
    ):
        procedure = Procedure(
            procedure_name="CT scan", date=date(2026, 5, 1), patient_id=patient_id
        )
        encounter = Encounter(
            reason="Cough", date=date(2026, 4, 30), patient_id=patient_id
        )
        db_session.add_all([procedure, encounter])
        db_session.commit()

        response = client.put(
            f"{URL}{study.id}",
            json={"procedure_id": procedure.id, "encounter_id": encounter.id},
            headers=authenticated_headers,
        )

        assert response.status_code == 200, response.text
        assert response.json()["procedure_id"] == procedure.id
        assert response.json()["encounter_id"] == encounter.id

    @pytest.mark.parametrize("field", ["procedure_id", "encounter_id"])
    def test_link_to_other_patients_record_is_rejected(
        self, client, db_session, study, authenticated_headers, field
    ):
        _, other_patient, _ = _user_with_patient(db_session)
        record = (
            Procedure(
                procedure_name="X", date=date(2026, 1, 1), patient_id=other_patient.id
            )
            if field == "procedure_id"
            else Encounter(
                reason="X", date=date(2026, 1, 1), patient_id=other_patient.id
            )
        )
        db_session.add(record)
        db_session.commit()

        response = client.put(
            f"{URL}{study.id}", json={field: record.id}, headers=authenticated_headers
        )

        assert response.status_code == 400

    def test_notes_too_long_is_rejected(self, client, study, authenticated_headers):
        response = client.put(
            f"{URL}{study.id}",
            json={"notes": "x" * 5001},
            headers=authenticated_headers,
        )
        assert response.status_code == 422


class TestDeleteImagingStudy:
    def test_delete_removes_rows_and_trashes_files(
        self, client, db_session, patient_id, study, authenticated_headers, trash_dir
    ):
        directory = study_directory(patient_id, study.study_instance_uid)
        study_id = study.id
        assert directory.is_dir()

        response = client.delete(f"{URL}{study_id}", headers=authenticated_headers)

        assert response.status_code == 200
        db_session.expire_all()
        assert db_session.get(ImagingStudy, study_id) is None
        assert db_session.query(ImagingSeries).filter_by(study_id=study_id).count() == 0
        assert db_session.query(ImagingInstance).count() == 0
        assert not directory.exists()
        [trashed] = [p for p in trash_dir.glob("*/imaging_*") if p.is_dir()]
        assert len(list(trashed.rglob("*.dcm"))) == 5
        logs = activity_log_crud.get_by_entity(
            db_session, entity_type=EntityType.IMAGING_STUDY, entity_id=study_id
        )
        assert any(log.action == "deleted" for log in logs)

    def test_delete_without_access_keeps_files(
        self, client, db_session, patient_id, study
    ):
        _, _, other_headers = _user_with_patient(db_session)
        directory = study_directory(patient_id, study.study_instance_uid)

        response = client.delete(f"{URL}{study.id}", headers=other_headers)

        assert response.status_code == 404
        assert directory.is_dir()
        assert db_session.get(ImagingStudy, study.id) is not None


class TestSharedAccess:
    def test_view_share_can_read_but_not_change(
        self, client, db_session, user_with_patient, patient_id, study
    ):
        headers = _shared_user_headers(
            db_session, user_with_patient["user"], patient_id, "view"
        )
        instance_id = study.series[0].instances[0].id

        assert client.get(f"{URL}{study.id}", headers=headers).status_code == 200
        assert (
            client.get(
                f"{URL}{study.id}/instances/{instance_id}/file", headers=headers
            ).status_code
            == 200
        )
        assert (
            client.put(
                f"{URL}{study.id}", json={"notes": "x"}, headers=headers
            ).status_code
            == 404
        )
        assert client.delete(f"{URL}{study.id}", headers=headers).status_code == 404
        assert study_directory(patient_id, study.study_instance_uid).is_dir()

    def test_edit_share_can_update(
        self, client, db_session, user_with_patient, patient_id, study
    ):
        headers = _shared_user_headers(
            db_session, user_with_patient["user"], patient_id, "edit"
        )

        response = client.put(
            f"{URL}{study.id}", json={"notes": "shared"}, headers=headers
        )

        assert response.status_code == 200
        assert response.json()["notes"] == "shared"


class TestPatientDeletionCascade:
    def test_deleting_patient_removes_study_rows(self, db_session, patient_id, study):
        study_id = study.id
        patient = patient_crud.get(db_session, id=patient_id)
        db_session.delete(patient)
        db_session.commit()

        assert db_session.get(ImagingStudy, study_id) is None
        assert db_session.query(ImagingInstance).count() == 0
