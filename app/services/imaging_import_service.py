"""Import DICOM uploads (one .dcm file or a ZIP of a CD export) into imaging studies."""

import os
import re
from contextlib import contextmanager
import shutil
import threading
import unicodedata
import zipfile
import zlib
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import IO, Any, Callable, Dict, Iterator, List, Optional, Set, Union

import pydicom
from pydicom.errors import InvalidDicomError
from pydicom.filereader import _read_file_meta_info, read_preamble
from pydicom.multival import MultiValue
from pydicom.valuerep import PersonName
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.activity_logging import safe_log_activity
from app.models.activity_log import ActionType, EntityType
from app.models.imaging import ImagingInstance, ImagingSeries, ImagingStudy
from app.models.models import Patient
from app.services.imaging_storage import (
    instance_path,
    is_valid_uid,
    study_directory,
    trash_study_files,
)
from app.utils.archive_validator import (
    MAX_FILES_IN_ARCHIVE,
    MAX_UNCOMPRESSED_SIZE,
    PROHIBITED_EXTENSIONS,
)

# Held for a whole import and for a study move, so the two never touch the same files
IMAGING_WRITE_LOCK = threading.Lock()

DICOM_PREAMBLE_LENGTH = 128
DICOM_MAGIC = b"DICM"
# Imaging archives compress far better than the generic limit allows (mostly black frames)
MAX_COMPRESSION_RATIO = 100.0
MAX_REPORTED_SKIPS = 100

_IGNORED_FILE_NAMES = {"DICOMDIR", "AUTORUN.INF"}
_COPY_CHUNK_SIZE = 1024 * 1024
_ZIP_ENCRYPTED_FLAG = 0x1
_ZIP_READ_ERRORS = (zipfile.BadZipFile, zlib.error, NotImplementedError, EOFError)
# pydicom inflates a deflated dataset whole, with no size limit
_UNSUPPORTED_TRANSFER_SYNTAXES = {pydicom.uid.DeflatedExplicitVRLittleEndian}
_HEADER_TAGS = [
    "StudyInstanceUID",
    "SeriesInstanceUID",
    "SOPInstanceUID",
    "Rows",
    "Columns",
    "InstanceNumber",
    "NumberOfFrames",
    "Modality",
    "SeriesNumber",
    "SeriesDescription",
    "StudyDate",
    "BodyPartExamined",
    "StudyDescription",
    "AccessionNumber",
    "InstitutionName",
    "ReferringPhysicianName",
    "PatientName",
    "PatientBirthDate",
]


class SkipReason:
    """Why a file was not imported; stable codes the frontend translates."""

    IGNORED = "ignored"
    ENCRYPTED = "encrypted"
    UNREADABLE = "unreadable"
    NOT_DICOM = "not_dicom"
    NOT_AN_IMAGE = "not_an_image"
    INVALID_UID = "invalid_uid"
    UNSUPPORTED = "unsupported"


class ImagingImportError(Exception):
    """An upload that cannot be imported at all; the message is safe to show the user."""


class _UnsupportedEncodingError(Exception):
    """A DICOM file in a transfer syntax the import refuses to read."""


class StudyConflictError(Exception):
    """The target patient already has the study; the message is safe to show the user."""


@dataclass
class SkippedFile:
    name: str
    reason: str


@dataclass
class StudyResult:
    study_id: int
    created: bool
    series_added: int = 0
    instances_added: int = 0
    patient_mismatch: bool = False


@dataclass
class ImportSummary:
    studies: List[StudyResult] = field(default_factory=list)
    instances_added: int = 0
    duplicates_skipped: int = 0
    skipped: List[SkippedFile] = field(default_factory=list)
    skipped_count: int = 0

    def skip(self, name: str, reason: str) -> None:
        self.skipped_count += 1
        if len(self.skipped) < MAX_REPORTED_SKIPS:
            self.skipped.append(SkippedFile(name=name, reason=reason))


@dataclass
class _Header:
    """The header values an import uses, read once so later code never touches pydicom."""

    study_uid: Optional[str]
    series_uid: Optional[str]
    sop_uid: Optional[str]
    is_image: bool
    transfer_syntax_uid: Optional[str]
    instance_number: Optional[int]
    rows: Optional[int]
    cols: Optional[int]
    number_of_frames: Optional[int]
    modality: Optional[str]
    series_number: Optional[int]
    series_description: Optional[str]
    study_date: Optional[date]
    body_part: Optional[str]
    study_description: Optional[str]
    accession_number: Optional[str]
    institution_name: Optional[str]
    referring_physician: Optional[str]
    patient_name: str
    patient_birth_date: Optional[date]


@dataclass
class _StudyState:
    study: ImagingStudy
    result: StudyResult
    sop_uids: Set[str]
    series: Dict[str, ImagingSeries]


def has_dicom_marker(path: Path) -> bool:
    try:
        with open(path, "rb") as f:
            f.seek(DICOM_PREAMBLE_LENGTH)
            return f.read(len(DICOM_MAGIC)) == DICOM_MAGIC
    except OSError:
        return False


def validate_upload(path: Path) -> None:
    """Raise ImagingImportError unless path is a DICOM file or a ZIP passing the checks."""
    if not has_dicom_marker(path):
        with _open_zip(path) as zf:
            _checked_members(zf, path.stat().st_size)


def _open_zip(path: Path) -> zipfile.ZipFile:
    try:
        return zipfile.ZipFile(path)
    except zipfile.BadZipFile as exc:
        raise ImagingImportError(
            "The file is neither a DICOM file nor a ZIP archive"
        ) from exc


def _checked_members(zf: zipfile.ZipFile, archive_size: int) -> List[zipfile.ZipInfo]:
    members = [info for info in zf.infolist() if not info.is_dir()]
    if len(members) > MAX_FILES_IN_ARCHIVE:
        raise ImagingImportError(
            f"The archive holds more than {MAX_FILES_IN_ARCHIVE} files"
        )
    unpacked = sum(info.file_size for info in members)
    if unpacked > MAX_UNCOMPRESSED_SIZE or (
        archive_size and unpacked / archive_size > MAX_COMPRESSION_RATIO
    ):
        raise ImagingImportError("The archive unpacks to more data than is allowed")
    return members


def import_dicom_upload(
    db: Session,
    *,
    patient: Patient,
    user_id: int,
    upload_path: Path,
    original_name: str,
    work_dir: Path,
    on_progress: Optional[Callable[[int, int], None]] = None,
) -> ImportSummary:
    """Import an uploaded .dcm or ZIP into patient's imaging studies and commit.

    Caller holds IMAGING_WRITE_LOCK. work_dir must be on the same filesystem as
    UPLOAD_DIR: accepted files are moved out of it. On any failure the transaction
    is rolled back and every file this import stored is removed.

    Raises:
        ImagingImportError: the upload cannot be imported at all.
    """
    progress = on_progress or (lambda done, total: None)
    importer = _StudyImporter(db, patient)
    try:
        if has_dicom_marker(upload_path):
            progress(0, 1)
            header = importer.read_header(upload_path, original_name)
            if header is not None and importer.is_new(header):
                importer.add_file(header, upload_path)
            progress(1, 1)
        else:
            _import_zip(importer, upload_path, work_dir, progress)
        importer.update_counts()
        db.commit()
    except BaseException:
        db.rollback()
        importer.remove_stored_files()
        raise

    for state in importer.studies:
        safe_log_activity(
            db=db,
            action=ActionType.CREATED if state.result.created else ActionType.UPDATED,
            entity_type=EntityType.IMAGING_STUDY,
            entity_obj=state.study,
            user_id=user_id,
        )
    return importer.summary


def _import_zip(
    importer: "_StudyImporter",
    path: Path,
    work_dir: Path,
    progress: Callable[[int, int], None],
) -> None:
    # Entry names are never used as paths, so unsafe names cannot escape work_dir
    extracted = work_dir / "entry.dcm"
    with _open_zip(path) as zf:
        members = _checked_members(zf, path.stat().st_size)
        total = len(members)
        progress(0, total)
        for index, member in enumerate(members, start=1):
            name = member.filename
            if _is_ignored(name):
                importer.summary.skip(name, SkipReason.IGNORED)
            elif member.flag_bits & _ZIP_ENCRYPTED_FLAG:
                importer.summary.skip(name, SkipReason.ENCRYPTED)
            else:
                _import_member(importer, zf, member, extracted)
            progress(index, total)


def _import_member(
    importer: "_StudyImporter",
    zf: zipfile.ZipFile,
    member: zipfile.ZipInfo,
    extracted: Path,
) -> None:
    # The header is read inside the archive so a re-imported image is never unpacked
    try:
        with zf.open(member) as source:
            header = importer.read_header(source, member.filename)
    except _ZIP_READ_ERRORS:
        importer.summary.skip(member.filename, SkipReason.UNREADABLE)
        return
    if header is None or not importer.is_new(header):
        return
    if _extract(zf, member, extracted):
        importer.add_file(header, extracted)
    else:
        importer.summary.skip(member.filename, SkipReason.UNREADABLE)


def _is_ignored(name: str) -> bool:
    """CD-export clutter: the DICOMDIR index, bundled viewers, autorun and macOS forks."""
    entry = Path(name)
    return (
        entry.name.upper() in _IGNORED_FILE_NAMES
        or entry.suffix.lower() in PROHIBITED_EXTENSIONS
        or name.startswith("__MACOSX/")
    )


def _extract(zf: zipfile.ZipFile, member: zipfile.ZipInfo, target: Path) -> bool:
    """Copy one entry to target; False when the entry itself is corrupt or unsupported."""
    try:
        with zf.open(member) as source, open(target, "wb") as out:
            shutil.copyfileobj(source, out, _COPY_CHUNK_SIZE)
    except _ZIP_READ_ERRORS:
        return False
    return True


class _StudyImporter:
    """Accumulates one upload's files into study, series and instance rows."""

    def __init__(self, db: Session, patient: Patient):
        self.db = db
        self.patient = patient
        self.summary = ImportSummary()
        self._studies: Dict[str, _StudyState] = {}
        self._not_stored: Set[str] = set()
        self._stored: List[Path] = []

    @property
    def studies(self) -> List[_StudyState]:
        return list(self._studies.values())

    def read_header(
        self, source: Union[Path, IO[bytes]], name: str
    ) -> Optional[_Header]:
        """The header of an importable image, or None after recording why it was skipped."""
        try:
            header = _read_header(source)
        except InvalidDicomError:
            self.summary.skip(name, SkipReason.NOT_DICOM)
            return None
        except _UnsupportedEncodingError:
            self.summary.skip(name, SkipReason.UNSUPPORTED)
            return None
        except Exception:  # pydicom and zip reads raise many error types for bad files
            self.summary.skip(name, SkipReason.UNREADABLE)
            return None
        if not all(
            is_valid_uid(uid)
            for uid in (header.study_uid, header.series_uid, header.sop_uid)
        ):
            self.summary.skip(name, SkipReason.INVALID_UID)
            return None
        if not header.is_image:
            self.summary.skip(name, SkipReason.NOT_AN_IMAGE)
            return None
        return header

    def is_new(self, header: _Header) -> bool:
        """False, counting a duplicate, when the study already holds this image."""
        state = self._find_state(header)
        if state is not None and header.sop_uid in state.sop_uids:
            self.summary.duplicates_skipped += 1
            return False
        return True

    def add_file(self, header: _Header, path: Path) -> None:
        """Store path, whose header came from read_header and passed is_new.

        A stored file is moved, not copied.
        """
        state = self._study_state(header)
        series = self._series(state, header)

        target = instance_path(
            self.patient.id, header.study_uid, header.series_uid, header.sop_uid
        )
        size = path.stat().st_size
        os.replace(path, target)
        self._stored.append(target)

        self.db.add(
            ImagingInstance(
                series_id=series.id,
                sop_instance_uid=header.sop_uid,
                instance_number=header.instance_number,
                file_path=str(target),
                file_size=size,
                transfer_syntax_uid=header.transfer_syntax_uid,
                rows=header.rows,
                cols=header.cols,
                number_of_frames=header.number_of_frames or 1,
            )
        )
        state.sop_uids.add(header.sop_uid)
        state.result.instances_added += 1
        self.summary.instances_added += 1

    def _find_state(self, header: _Header) -> Optional[_StudyState]:
        """The study's state, or None while the patient has no such study."""
        uid = header.study_uid
        if uid not in self._studies and uid not in self._not_stored:
            study = (
                self.db.query(ImagingStudy)
                .filter(
                    ImagingStudy.patient_id == self.patient.id,
                    ImagingStudy.study_instance_uid == uid,
                )
                .first()
            )
            if study is None:
                self._not_stored.add(uid)
            else:
                self._track(study, header, created=False)
        return self._studies.get(uid)

    def _study_state(self, header: _Header) -> _StudyState:
        state = self._find_state(header)
        if state is not None:
            return state
        study = ImagingStudy(
            patient_id=self.patient.id,
            study_instance_uid=header.study_uid,
            modalities=[],
            tags=[],
        )
        self.db.add(study)
        self._not_stored.discard(header.study_uid)
        return self._track(study, header, created=True)

    def _track(
        self, study: ImagingStudy, header: _Header, created: bool
    ) -> _StudyState:
        _fill_missing_study_fields(study, header)
        self.db.flush()

        series: Dict[str, ImagingSeries] = {}
        sop_uids: Set[str] = set()
        if not created:
            series = {s.series_instance_uid: s for s in study.series}
            sop_uids = {
                uid
                for (uid,) in self.db.query(ImagingInstance.sop_instance_uid)
                .join(ImagingSeries, ImagingInstance.series_id == ImagingSeries.id)
                .filter(ImagingSeries.study_id == study.id)
            }
        result = StudyResult(
            study_id=study.id,
            created=created,
            patient_mismatch=patient_mismatch(header, self.patient),
        )
        state = _StudyState(
            study=study, result=result, sop_uids=sop_uids, series=series
        )
        self._studies[header.study_uid] = state
        self.summary.studies.append(result)
        return state

    def _series(self, state: _StudyState, header: _Header) -> ImagingSeries:
        series = state.series.get(header.series_uid)
        if series is None:
            series = ImagingSeries(
                study_id=state.study.id,
                series_instance_uid=header.series_uid,
                modality=header.modality,
                series_number=header.series_number,
                series_description=header.series_description,
                instance_count=0,
            )
            self.db.add(series)
            self.db.flush()
            instance_path(
                self.patient.id, header.study_uid, header.series_uid, header.sop_uid
            ).parent.mkdir(parents=True, exist_ok=True)
            state.series[header.series_uid] = series
            state.result.series_added += 1
        return series

    def update_counts(self) -> None:
        """Recompute the stored counts, sizes and modalities of every touched study."""
        self.db.flush()
        for state in self._studies.values():
            totals = {
                series_id: (count, size)
                for series_id, count, size in self.db.query(
                    ImagingInstance.series_id,
                    func.count(ImagingInstance.id),
                    func.coalesce(func.sum(ImagingInstance.file_size), 0),
                )
                .join(ImagingSeries, ImagingInstance.series_id == ImagingSeries.id)
                .filter(ImagingSeries.study_id == state.study.id)
                .group_by(ImagingInstance.series_id)
            }
            for series in state.series.values():
                series.instance_count = totals.get(series.id, (0, 0))[0]
            study = state.study
            study.series_count = len(state.series)
            study.instance_count = sum(count for count, _ in totals.values())
            study.total_size = sum(size for _, size in totals.values())
            study.modalities = sorted(
                {s.modality for s in state.series.values() if s.modality}
            )

    def remove_stored_files(self) -> None:
        for path in self._stored:
            path.unlink(missing_ok=True)
        for state in self._studies.values():
            _remove_empty_dirs(
                study_directory(self.patient.id, state.study.study_instance_uid)
            )


def _remove_empty_dirs(study_dir: Path) -> None:
    """Remove the study directory's empty series folders, then it and its patient folder."""
    if not study_dir.is_dir():
        return
    for child in study_dir.iterdir():
        if child.is_dir() and not any(child.iterdir()):
            child.rmdir()
    for directory in (study_dir, study_dir.parent):
        try:
            directory.rmdir()
        except OSError:
            return  # not empty


def _fill_missing_study_fields(study: ImagingStudy, header: _Header) -> None:
    """Header-derived study fields, set only where still empty so merges never overwrite."""
    for attr in (
        "study_date",
        "body_part",
        "study_description",
        "accession_number",
        "institution_name",
        "referring_physician",
    ):
        if getattr(study, attr) is None:
            setattr(study, attr, getattr(header, attr))


@contextmanager
def _binary(source: Union[Path, IO[bytes]]) -> Iterator[IO[bytes]]:
    if isinstance(source, Path):
        with open(source, "rb") as fp:
            yield fp
    else:
        yield source


def _read_header(source: Union[Path, IO[bytes]]) -> _Header:
    """Raises InvalidDicomError for a non-DICOM file, _UnsupportedEncodingError for a
    refused transfer syntax, other errors for a malformed one.
    """
    with _binary(source) as fp:
        read_preamble(fp, False)
        meta = _read_file_meta_info(fp)
        if meta.get("TransferSyntaxUID") in _UNSUPPORTED_TRANSFER_SYNTAXES:
            raise _UnsupportedEncodingError()
        fp.seek(0)
        ds = pydicom.dcmread(fp, stop_before_pixels=True, specific_tags=_HEADER_TAGS)
    file_meta = getattr(ds, "file_meta", None)
    transfer_syntax = (
        str(file_meta.get("TransferSyntaxUID", "")) if file_meta is not None else ""
    )
    patient_name = ds.get("PatientName")
    return _Header(
        study_uid=_uid(ds.get("StudyInstanceUID")),
        series_uid=_uid(ds.get("SeriesInstanceUID")),
        sop_uid=_uid(ds.get("SOPInstanceUID")),
        is_image="Rows" in ds and "Columns" in ds,
        transfer_syntax_uid=transfer_syntax if is_valid_uid(transfer_syntax) else None,
        instance_number=_int(ds.get("InstanceNumber")),
        rows=_int(ds.get("Rows")),
        cols=_int(ds.get("Columns")),
        number_of_frames=_int(ds.get("NumberOfFrames")),
        modality=_text(ds.get("Modality"), 16),
        series_number=_int(ds.get("SeriesNumber")),
        series_description=_text(ds.get("SeriesDescription"), 255),
        study_date=_dicom_date(ds.get("StudyDate")),
        body_part=_text(ds.get("BodyPartExamined"), 64),
        study_description=_text(ds.get("StudyDescription"), 255),
        accession_number=_text(ds.get("AccessionNumber"), 64),
        institution_name=_text(ds.get("InstitutionName"), 255),
        referring_physician=_text(ds.get("ReferringPhysicianName"), 255),
        patient_name=str(patient_name) if patient_name is not None else "",
        patient_birth_date=_dicom_date(ds.get("PatientBirthDate")),
    )


def _uid(value: Any) -> Optional[str]:
    if value is None:
        return None
    return str(value).replace("\x00", "").strip() or None


def _int(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _text(value: Any, max_length: int) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, PersonName):
        text = " ".join(p for p in (value.given_name, value.family_name) if p)
        text = text or str(value).replace("^", " ")
    elif isinstance(value, MultiValue):
        text = ", ".join(str(v) for v in value)
    else:
        text = str(value)
    text = text.replace("\x00", "").strip()
    return text[:max_length] or None


def _dicom_date(value: Any) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.strptime(str(value).strip()[:8], "%Y%m%d").date()
    except ValueError:
        return None


def _name_tokens(text: Optional[str]) -> Set[str]:
    """Casefolded letter runs with accents removed: "Doe^Jöhn" gives {"doe", "john"}."""
    plain = unicodedata.normalize("NFKD", text or "")
    plain = "".join(c for c in plain if not unicodedata.combining(c))
    return {token.casefold() for token in re.findall(r"[^\W\d_]+", plain)}


def patient_mismatch(header: _Header, patient: Patient) -> bool:
    """True when the header's patient visibly differs from the MediKeep patient.

    Missing header values never count as a mismatch: anonymized exports have none.
    """
    if (
        header.patient_birth_date
        and patient.birth_date
        and header.patient_birth_date != patient.birth_date
    ):
        return True
    dicom_tokens = _name_tokens(header.patient_name)
    if not dicom_tokens:
        return False
    last = _name_tokens(patient.last_name)
    first = _name_tokens(patient.first_name)
    return not last <= dicom_tokens or (bool(first) and not first & dicom_tokens)


def move_study(db: Session, study: ImagingStudy, target_patient_id: int) -> None:
    """Move a study and its files to another patient and commit.

    Caller holds IMAGING_WRITE_LOCK and has checked access. Procedure and encounter
    links are cleared: they belong to the old patient. Orphaned files already at the
    target location are trashed.

    Raises:
        StudyConflictError: the target patient already has this study.
        OSError: the files could not be moved; nothing changed.
    """
    uid = study.study_instance_uid
    duplicate = (
        db.query(ImagingStudy.id)
        .filter(
            ImagingStudy.patient_id == target_patient_id,
            ImagingStudy.study_instance_uid == uid,
        )
        .first()
    )
    if duplicate is not None:
        raise StudyConflictError("The other patient already has this study")
    source_dir = study_directory(study.patient_id, uid)
    target_dir = study_directory(target_patient_id, uid)
    if (
        target_dir.exists()
        and trash_study_files(
            target_patient_id, uid, reason="replaced by a moved imaging study"
        )
        is False
    ):
        raise OSError("Could not clear the target study directory")

    has_files = source_dir.is_dir()
    if has_files:
        target_dir.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source_dir), str(target_dir))
    try:
        for series in study.series:
            for instance in series.instances:
                instance.file_path = str(
                    instance_path(
                        target_patient_id,
                        uid,
                        series.series_instance_uid,
                        instance.sop_instance_uid,
                    )
                )
        study.patient_id = target_patient_id
        study.procedure_id = None
        study.encounter_id = None
        db.commit()
    except BaseException:
        db.rollback()
        if has_files:
            shutil.move(str(target_dir), str(source_dir))
        raise

    try:
        source_dir.parent.rmdir()
    except OSError:
        pass  # the old patient still has other studies
