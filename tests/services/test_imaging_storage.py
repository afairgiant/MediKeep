"""Imaging storage layout: UID validation and moving study directories to trash."""

from pathlib import Path

import pytest

from app.core.config import settings
from app.services import imaging_storage
from app.services.imaging_storage import (
    is_valid_uid,
    study_directory,
    trash_study_files,
)

STUDY_UID = "1.2.840.113619.2.55.3.604688119"


@pytest.mark.parametrize(
    "uid",
    ["1", "1.2.3", STUDY_UID, "1." + "2" * 62],
)
def test_valid_uids(uid):
    assert is_valid_uid(uid)


@pytest.mark.parametrize(
    "uid",
    [
        None,
        "",
        "1..2",
        ".1",
        "1.",
        "../etc",
        "1.2/3",
        "1.2\\3",
        "1 .2",
        "1.2a",
        "1." + "2" * 63,
    ],
)
def test_invalid_uids(uid):
    assert not is_valid_uid(uid)


def test_study_directory_is_under_upload_dir():
    directory = study_directory(7, STUDY_UID)
    assert directory == Path(settings.UPLOAD_DIR) / "imaging" / "7" / STUDY_UID


def test_study_directory_rejects_traversal():
    with pytest.raises(ValueError):
        study_directory(7, "../../secrets")


@pytest.fixture
def trash(monkeypatch):
    trash_dir = Path(settings.UPLOAD_DIR) / "trash"
    monkeypatch.setattr(settings, "TRASH_DIR", trash_dir)
    return trash_dir


def _make_study_files(patient_id: int, uid: str) -> Path:
    directory = study_directory(patient_id, uid)
    (directory / "1.2.3").mkdir(parents=True)
    (directory / "1.2.3" / "1.2.3.4.dcm").write_bytes(b"x" * 10)
    return directory


def _trashed(trash_dir: Path, name: str) -> list:
    return [p for p in trash_dir.glob(f"*/{name}*") if p.is_dir()]


def test_trash_moves_study_and_removes_empty_patient_dir(trash):
    directory = _make_study_files(901, STUDY_UID)

    assert trash_study_files(901, STUDY_UID, reason="test") is True
    assert not directory.exists()
    assert not directory.parent.exists()
    [trashed] = _trashed(trash, f"imaging_901_{STUDY_UID}")
    assert (trashed / "1.2.3" / "1.2.3.4.dcm").read_bytes() == b"x" * 10


def test_trash_keeps_patient_dir_with_other_studies(trash):
    directory = _make_study_files(902, STUDY_UID)
    other = _make_study_files(902, "1.2.9")

    assert trash_study_files(902, STUDY_UID, reason="test") is True
    assert not directory.exists()
    assert other.exists()


def test_trash_missing_or_invalid_returns_none(trash):
    assert trash_study_files(903, STUDY_UID, reason="test") is None
    assert trash_study_files(903, "../..", reason="test") is None


def test_trash_refuses_directory_outside_storage(trash, monkeypatch, tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    monkeypatch.setattr(imaging_storage, "study_directory", lambda *_: outside)

    assert trash_study_files(904, STUDY_UID, reason="test") is False
    assert outside.exists()


def test_trash_unreadable_directory_returns_false(trash, monkeypatch):
    def denied(self):
        raise PermissionError("denied")

    monkeypatch.setattr(Path, "is_dir", denied)

    assert trash_study_files(905, STUDY_UID, reason="test") is False
