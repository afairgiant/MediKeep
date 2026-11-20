"""
Attachment cleanup for deletes that bypass a record's own DELETE endpoint (#1277).

Admin deletes and patient or account deletes remove records, often through the
ORM cascade from the patient, without touching their files. EntityFile.entity_id
has no foreign key, so its rows are left behind, and files on disk are never
removed by a cascade.

Usage: find the attachments before the delete, because once a patient's records
are gone nothing links their files to the patient any more. Clean up only after
the delete has committed, so a failed delete leaves the attachments in place.

    pending = find_patient_attachments(db, [patient_id])
    ... delete and commit ...
    cleanup_attachments(db, pending, reason=f"patient {patient_id} deletion")

Local files move to trash. Paperless and Papra documents stay in those services;
only the link is removed.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Sequence, Tuple

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.utils.stored_files import resolve_storage_path, resolve_stored_file
from app.models.models import EntityFile, LabResult, LabResultFile, Patient
from app.services.file_management_service import file_management_service
from app.services.generic_entity_file_service import (
    FILE_ENTITY_SOURCES,
    GenericEntityFileService,
    entity_files_of_records,
)

logger = get_logger(__name__, "app")


@dataclass
class PendingAttachments:
    """Attachments of records that are about to be deleted.

    entity_file_ids: EntityFile rows the delete leaves behind, to remove afterwards.
    local_paths: stored files whose rows the delete itself removes (legacy lab
        result files cascade with their lab result, and file records deleted
        directly), so only the file on disk is left to trash. Files that a
        surviving file row still uses are left out.
    """

    entity_file_ids: List[int] = field(default_factory=list)
    local_paths: List[Path] = field(default_factory=list)

    def extend(self, other: "PendingAttachments") -> None:
        self.entity_file_ids.extend(other.entity_file_ids)
        self.local_paths.extend(other.local_paths)


def _local_paths(file_records: Iterable[Any]) -> List[Path]:
    """Stored files of the records; remote placeholders and missing files are skipped."""
    return [path for path in map(resolve_stored_file, file_records) if path]


def _unshared_local_paths(
    db: Session, file_records: List[Any], deleted_ids: Dict[type, Sequence[int]]
) -> List[Path]:
    """Stored files of ``file_records`` that no file row outside ``deleted_ids`` uses.

    Two file rows can share a stored file: a legacy lab result file copied to an
    EntityFile, or a row an admin pointed at another row's file. Deleting some of
    them must leave the file in place for the others. Paths are compared once
    resolved, so a relative and an absolute path to the same file match.
    """
    paths = _local_paths(file_records)
    if not paths:
        return []
    names = {path.name for path in paths}
    still_used = set()
    for file_model in (EntityFile, LabResultFile):
        query = db.query(file_model.file_path).filter(
            or_(
                *(
                    file_model.file_path.endswith(name, autoescape=True)
                    for name in names
                )
            )
        )
        excluded = deleted_ids.get(file_model)
        if excluded:
            query = query.filter(file_model.id.notin_(excluded))
        still_used.update(resolve_storage_path(path) for (path,) in query)
    return [path for path in paths if path not in still_used]


def _source_attachments(
    db: Session,
    sources: Sequence[Tuple[str, type]],
    record_condition: Callable[[type], Any],
) -> PendingAttachments:
    """Attachments of the ``sources`` records that ``record_condition`` selects."""
    pending = PendingAttachments()
    if not sources:
        return pending
    pending.entity_file_ids = [
        file_record.id
        for file_record in entity_files_of_records(db, sources, record_condition)
    ]
    if any(model is LabResult for _, model in sources):
        legacy_files = (
            db.query(LabResultFile)
            .filter(
                LabResultFile.lab_result_id.in_(
                    select(LabResult.id).where(record_condition(LabResult))
                )
            )
            .all()
        )
        pending.local_paths = _unshared_local_paths(
            db,
            legacy_files,
            {
                LabResultFile: [legacy_file.id for legacy_file in legacy_files],
                EntityFile: pending.entity_file_ids,
            },
        )
    return pending


def find_patient_attachments(
    db: Session, patient_ids: Sequence[int]
) -> PendingAttachments:
    """Attachments of every record of the patients, for a patient delete."""
    if not patient_ids:
        return PendingAttachments()
    return _source_attachments(
        db, FILE_ENTITY_SOURCES, lambda model: model.patient_id.in_(patient_ids)
    )


def find_record_attachments(
    db: Session, model: type, record_ids: Sequence[int]
) -> PendingAttachments:
    """Attachments that deleting these ``model`` records would leave behind.

    Covers file-capable records, patients (all their records' files) and file
    records themselves. Other models have no attachments.
    """
    if not record_ids:
        return PendingAttachments()
    if model is Patient:
        return find_patient_attachments(db, record_ids)
    # File records themselves: deleting one leaves only its stored file
    if model in (EntityFile, LabResultFile):
        query = db.query(model).filter(model.id.in_(record_ids))
        if model is EntityFile:
            query = query.filter(EntityFile.storage_backend == "local")
        file_records = query.all()
        return PendingAttachments(
            local_paths=_unshared_local_paths(
                db, file_records, {model: [record.id for record in file_records]}
            )
        )
    sources = [
        (entity_type, source_model)
        for entity_type, source_model in FILE_ENTITY_SOURCES
        if source_model is model
    ]
    return _source_attachments(
        db, sources, lambda source_model: source_model.id.in_(record_ids)
    )


def cleanup_attachments(
    db: Session, pending: PendingAttachments, reason: str
) -> Dict[str, int]:
    """Clean up attachments once their records' delete has committed.

    Never raises: the records are already gone, so a cleanup failure is logged and
    counted in "errors" rather than failing the delete.
    """
    stats = {"files_deleted": 0, "files_preserved": 0, "errors": 0}
    if not pending.entity_file_ids and not pending.local_paths:
        return stats

    try:
        if pending.entity_file_ids:
            entity_files = (
                db.query(EntityFile)
                .filter(EntityFile.id.in_(pending.entity_file_ids))
                .all()
            )
            stats = GenericEntityFileService().remove_entity_files(
                db, entity_files, reason=reason
            )
    except Exception as e:
        db.rollback()
        stats["errors"] += 1
        logger.error(
            "Removing attachment records after a delete failed",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "attachment_cleanup_failed",
                LogFields.ERROR: str(e),
            },
        )

    for path in pending.local_paths:
        if not path.is_file():
            # Already trashed: a legacy lab result file copied to an EntityFile
            # shares its stored file with that row
            continue
        try:
            file_management_service.move_to_trash(str(path), reason=reason)
            stats["files_deleted"] += 1
        except Exception:
            # move_to_trash has already logged the details
            stats["errors"] += 1
            logger.error(
                "Moving an attachment to trash after a delete failed",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "attachment_trash_failed",
                },
            )

    logger.info(
        "Cleaned up attachments of deleted records",
        extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "attachments_cleaned_up",
            "files_deleted": stats["files_deleted"],
            "files_preserved": stats["files_preserved"],
            "errors": stats["errors"],
        },
    )
    return stats
