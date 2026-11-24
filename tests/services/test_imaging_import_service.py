"""Imaging import service: header reading, grouping, merging, skips and rollback."""

from datetime import date
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.models.imaging import ImagingInstance, ImagingSeries, ImagingStudy
from app.services import imaging_import_service as service
from app.services.backup_service import is_excluded_from_backup
from app.services.backup_service import backup_excluded_paths
from app.services.imaging_import_service import (
    ImagingImportError,
    SkipReason,
    import_dicom_upload,
    validate_upload,
)
from app.services.imaging_storage import (
    create_import_staging_dir,
    import_staging_root,
    instance_path,
    remove_stale_import_staging,
    study_directory,
)
from pydicom.uid import DeflatedExplicitVRLittleEndian

from tests.utils.dicom import (
    SERIES_UID,
    STUDY_UID,
    compression_bomb,
    dicom_bytes,
    write,
    zip_bytes,
)

SECOND_SERIES = f"{STUDY_UID}.2"


pytestmark = pytest.mark.usefixtures("isolated_uploads")


def _fail_commit():
    raise RuntimeError("database went away")


@pytest.fixture
def patient(test_patient):
    return test_patient


@pytest.fixture
def user_id(test_user):
    return test_user.id


def _run(db, patient, user_id, data: bytes, name="upload.zip"):
    work_dir = create_import_staging_dir()
    upload = write(work_dir / "upload", data)
    return import_dicom_upload(
        db,
        patient=patient,
        user_id=user_id,
        upload_path=upload,
        original_name=name,
        work_dir=work_dir,
    )


def _cd_export() -> bytes:
    return zip_bytes(
        {
            "DICOMDIR": dicom_bytes(sop_uid="1.9.9", image=False),
            "VIEWER/viewer.exe": b"MZ",
            "AUTORUN.INF": "[autorun]",
            "README.txt": "not an image",
            "DICOM/S1/I1": dicom_bytes(instance_number=1),
            "DICOM/S1/I2": dicom_bytes(instance_number=2),
            "DICOM/S2/I1.dcm": dicom_bytes(
                series_uid=SECOND_SERIES, series_number=2, modality="SR", image=False
            ),
            "DICOM/S2/I2.dcm": dicom_bytes(
                series_uid=SECOND_SERIES, series_number=2, modality="MR"
            ),
            "DICOM/BAD/I1": dicom_bytes(study_uid="1.2.abc"),
        }
    )


class TestSingleFile:
    def test_imports_one_dicom_file(self, db_session, patient, user_id):
        summary = _run(db_session, patient, user_id, dicom_bytes(), "scan.dcm")

        study = db_session.query(ImagingStudy).one()
        instance = db_session.query(ImagingInstance).one()
        stored = instance_path(patient.id, STUDY_UID, SERIES_UID, f"{SERIES_UID}.1")
        assert summary.instances_added == 1
        assert summary.studies[0].created and not summary.studies[0].patient_mismatch
        assert study.study_date == date(2026, 1, 15)
        assert study.study_description == "CT CHEST"
        assert study.body_part == "CHEST"
        assert study.modalities == ["CT"]
        assert (study.series_count, study.instance_count) == (1, 1)
        assert study.total_size == instance.file_size == stored.stat().st_size
        assert instance.file_path == str(stored)
        assert (instance.rows, instance.cols, instance.number_of_frames) == (2, 2, 1)
        assert instance.transfer_syntax_uid == "1.2.840.10008.1.2.1"


class TestZipImport:
    def test_cd_export_groups_series_and_skips_clutter(
        self, db_session, patient, user_id
    ):
        summary = _run(db_session, patient, user_id, _cd_export())

        study = db_session.query(ImagingStudy).one()
        series = {
            s.series_instance_uid: s for s in db_session.query(ImagingSeries).all()
        }
        reasons = {s.name: s.reason for s in summary.skipped}
        assert summary.instances_added == 3
        assert study.instance_count == 3 and study.series_count == 2
        assert study.modalities == ["CT", "MR"]
        assert series[SERIES_UID].instance_count == 2
        assert series[SECOND_SERIES].instance_count == 1
        assert reasons == {
            "DICOMDIR": SkipReason.IGNORED,
            "VIEWER/viewer.exe": SkipReason.IGNORED,
            "AUTORUN.INF": SkipReason.IGNORED,
            "README.txt": SkipReason.NOT_DICOM,
            "DICOM/S2/I1.dcm": SkipReason.NOT_AN_IMAGE,
            "DICOM/BAD/I1": SkipReason.INVALID_UID,
        }
        assert summary.skipped_count == 6

    def test_reimport_skips_duplicates_and_merges_new_images(
        self, db_session, patient, user_id
    ):
        _run(db_session, patient, user_id, _cd_export())
        study = db_session.query(ImagingStudy).one()
        study.study_description = "Edited elsewhere"
        study.notes = "keep me"
        db_session.commit()

        again = _run(db_session, patient, user_id, _cd_export())
        more = _run(
            db_session,
            patient,
            user_id,
            zip_bytes({"I3": dicom_bytes(instance_number=3)}),
        )

        db_session.refresh(study)
        assert again.instances_added == 0 and again.duplicates_skipped == 3
        assert not again.studies[0].created
        assert more.instances_added == 1
        assert db_session.query(ImagingStudy).count() == 1
        assert study.instance_count == 4
        assert study.study_description == "Edited elsewhere"
        assert study.notes == "keep me"

    def test_same_image_twice_in_one_upload_is_stored_once(
        self, db_session, patient, user_id
    ):
        data = zip_bytes({"a": dicom_bytes(), "b": dicom_bytes()})

        summary = _run(db_session, patient, user_id, data)

        assert summary.instances_added == 1 and summary.duplicates_skipped == 1

    def test_encrypted_entry_is_skipped(self, db_session, patient, user_id):
        data = bytearray(
            zip_bytes(
                {
                    "secret.dcm": dicom_bytes(),
                    "plain.dcm": dicom_bytes(instance_number=2),
                }
            )
        )
        # zipfile cannot write encrypted entries; set the flag on the first central record
        flags_at = data.index(b"PK\x01\x02") + 8
        data[flags_at] |= 0x1

        summary = _run(db_session, patient, user_id, bytes(data))

        assert summary.instances_added == 1
        assert [(s.name, s.reason) for s in summary.skipped] == [
            ("secret.dcm", SkipReason.ENCRYPTED)
        ]

    def test_unopenable_entry_is_skipped(self, db_session, patient, user_id):
        data = bytearray(
            zip_bytes(
                {
                    "broken.dcm": dicom_bytes(),
                    "plain.dcm": dicom_bytes(instance_number=2),
                }
            )
        )
        # An unknown compression method makes zipfile refuse to open the first entry
        method_at = data.index(b"PK") + 10
        data[method_at : method_at + 2] = (99).to_bytes(2, "little")

        summary = _run(db_session, patient, user_id, bytes(data))

        assert summary.instances_added == 1
        assert [(s.name, s.reason) for s in summary.skipped] == [
            ("broken.dcm", SkipReason.UNREADABLE)
        ]

    def test_deflated_file_is_skipped_unread(self, db_session, patient, user_id):
        deflated = dicom_bytes(transfer_syntax=DeflatedExplicitVRLittleEndian)
        data = zip_bytes({"deflated.dcm": deflated, "plain.dcm": dicom_bytes()})

        summary = _run(db_session, patient, user_id, data)

        assert summary.instances_added == 1
        assert [(s.name, s.reason) for s in summary.skipped] == [
            ("deflated.dcm", SkipReason.UNSUPPORTED)
        ]

    def test_study_is_not_created_when_no_image_could_be_stored(
        self, db_session, patient, user_id, monkeypatch
    ):
        monkeypatch.setattr(service, "_extract", lambda *_: False)

        summary = _run(db_session, patient, user_id, zip_bytes({"a": dicom_bytes()}))

        assert summary.studies == [] and summary.instances_added == 0
        assert db_session.query(ImagingStudy).count() == 0
        assert [(s.name, s.reason) for s in summary.skipped] == [
            ("a", SkipReason.UNREADABLE)
        ]

    def test_skip_list_is_capped(self, db_session, patient, user_id, monkeypatch):
        monkeypatch.setattr(service, "MAX_REPORTED_SKIPS", 2)
        data = zip_bytes({f"junk{i}.txt": "x" for i in range(5)})

        summary = _run(db_session, patient, user_id, data)

        assert len(summary.skipped) == 2 and summary.skipped_count == 5


class TestFailureRollsBack:
    def test_failed_commit_removes_stored_files_and_rows(
        self, db_session, patient, user_id, monkeypatch
    ):
        monkeypatch.setattr(db_session, "commit", _fail_commit)

        with pytest.raises(RuntimeError):
            _run(db_session, patient, user_id, _cd_export())

        # Not monkeypatch.undo(), which would also restore the shared UPLOAD_DIR
        monkeypatch.delattr(db_session, "commit")
        assert db_session.query(ImagingStudy).count() == 0
        assert not study_directory(patient.id, STUDY_UID).exists()
        assert not study_directory(patient.id, STUDY_UID).parent.exists()

    def test_failure_keeps_files_of_an_existing_study(
        self, db_session, patient, user_id, monkeypatch
    ):
        _run(db_session, patient, user_id, dicom_bytes(), "first.dcm")
        kept = instance_path(patient.id, STUDY_UID, SERIES_UID, f"{SERIES_UID}.1")
        monkeypatch.setattr(db_session, "commit", _fail_commit)

        with pytest.raises(RuntimeError):
            _run(db_session, patient, user_id, dicom_bytes(instance_number=2), "b.dcm")

        assert kept.exists()
        assert not instance_path(
            patient.id, STUDY_UID, SERIES_UID, f"{SERIES_UID}.2"
        ).exists()


class TestValidateUpload:
    def test_accepts_dicom_and_zip(self, tmp_path):
        validate_upload(write(tmp_path / "a", dicom_bytes()))
        validate_upload(write(tmp_path / "b", zip_bytes({"x": "y"})))

    def test_rejects_other_files(self, tmp_path):
        with pytest.raises(ImagingImportError):
            validate_upload(write(tmp_path / "a", b"%PDF-1.7 not imaging"))

    def test_traversal_names_are_imported_without_being_followed(
        self, db_session, patient, user_id, isolated_uploads
    ):
        data = zip_bytes({"../escape.dcm": dicom_bytes(), "SERIES..1/I2": "x"})

        summary = _run(db_session, patient, user_id, data)

        assert summary.instances_added == 1
        assert not (isolated_uploads.parent / "escape.dcm").exists()
        assert [(s.name, s.reason) for s in summary.skipped] == [
            ("SERIES..1/I2", SkipReason.NOT_DICOM)
        ]

    def test_rejects_too_many_files(self, tmp_path, monkeypatch):
        monkeypatch.setattr(service, "MAX_FILES_IN_ARCHIVE", 2)
        data = zip_bytes({f"{i}": "x" for i in range(3)})
        with pytest.raises(ImagingImportError, match="more than 2 files"):
            validate_upload(write(tmp_path / "a", data))

    def test_rejects_compression_bombs(self, tmp_path):
        data = compression_bomb()
        with pytest.raises(ImagingImportError, match="unpacks"):
            validate_upload(write(tmp_path / "a", data))

    def test_allows_ratios_typical_of_imaging(self, tmp_path):
        data = zip_bytes({"black": b"\x00" * 10_000 + bytes(range(256)) * 40})
        validate_upload(write(tmp_path / "a", data))


class TestPatientMismatch:
    @pytest.mark.parametrize(
        "name, birth, expected",
        [
            ("User^Test", "19900101", False),
            ("USER^TEST^M", "19900101", False),
            ("Usér^Tést", "", False),
            ("", "", False),
            ("Other^Test", "19900101", True),
            ("User^Somebody", "19900101", True),
            ("User^Test", "20010203", True),
        ],
    )
    def test_comparison(self, name, birth, expected):
        header = SimpleNamespace(
            patient_name=name, patient_birth_date=service._dicom_date(birth)
        )
        patient = SimpleNamespace(
            first_name="Test", last_name="User", birth_date=date(1990, 1, 1)
        )
        assert service.patient_mismatch(header, patient) is expected

    def test_flagged_in_summary(self, db_session, patient, user_id):
        data = dicom_bytes(patient_name="Sibling^Other", birth_date="20100505")
        summary = _run(db_session, patient, user_id, data, "x.dcm")
        assert summary.studies[0].patient_mismatch


class TestStaging:
    def test_staging_is_excluded_from_backups(self, isolated_uploads):
        staged = create_import_staging_dir() / "upload"

        assert is_excluded_from_backup(
            staged.relative_to(isolated_uploads),
            backup_excluded_paths(isolated_uploads),
        )

    def test_startup_removes_only_staging_dirs(self, isolated_uploads):
        (create_import_staging_dir() / "upload").write_bytes(b"x")
        keep = isolated_uploads / "imaging"
        keep.mkdir()

        assert remove_stale_import_staging() == 1
        assert not import_staging_root().exists() and keep.exists()
