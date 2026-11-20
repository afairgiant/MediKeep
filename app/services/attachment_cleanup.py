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
from typing import Any, Dict, Iterable, List, Sequence

from sqlalchemy.orm import Session

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.utils.stored_files import resolve_stored_file
from app.models.models import EntityFile, LabResultFile, Patient
from app.services.export_attachments import ATTACHMENT_SOURCES, AttachmentSource
from app.services.file_management_service import file_management_service
from app.services.generic_entity_file_service import GenericEntityFileService

logger = get_logger(__name__, "app")

_SOURCES_BY_MODEL = {source.model: source for source in ATTACHMENT_SOURCES}


@dataclass
class PendingAttachments:
    """Attachments of records that are about to be deleted.

    entity_file_ids: EntityFile rows the delete leaves behind, to remove afterwards.
    local_paths: stored files whose rows the delete itself removes (legacy lab
        result files cascade with their lab result, and file records deleted
        directly), so only the file on disk is left to trash.
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
    db: Session, model: type, file_records: List[Any]
) -> List[Path]:
    """Stored files of the ``model`` file records that no other file row points to.

    A legacy lab result file copied to an EntityFile shares its stored file with
    that row, so deleting only one of the two must leave the file in place.
    """
    file_paths = [record.file_path for record in file_records]
    record_ids = [record.id for record in file_records]
    still_used = set()
    for file_model in (EntityFile, LabResultFile):
        query = db.query(file_model.file_path).filter(
            file_model.file_path.in_(file_paths)
        )
        if file_model is model:
            query = query.filter(file_model.id.notin_(record_ids))
        still_used.update(path for (path,) in query)
    return _local_paths(r for r in file_records if r.file_path not in still_used)


def _source_attachments(
    db: Session, source: AttachmentSource, record_condition: Any
) -> PendingAttachments:
    """Attachments of the ``source`` records matching ``record_condition``."""
    model = source.model
    file_ids = (
        db.query(EntityFile.id)
        .join(
            model,
            (EntityFile.entity_id == model.id)
            & EntityFile.entity_type.in_(source.entity_types),
        )
        .filter(record_condition)
        .all()
    )
    pending = PendingAttachments(entity_file_ids=[file_id for (file_id,) in file_ids])
    if source.has_legacy_files:
        legacy_files = (
            db.query(LabResultFile)
            .join(model, LabResultFile.lab_result_id == model.id)
            .filter(record_condition)
            .all()
        )
        pending.local_paths = _local_paths(legacy_files)
    return pending


def find_patient_attachments(
    db: Session, patient_ids: Sequence[int]
) -> PendingAttachments:
    """Attachments of every record of the patients, for a patient delete."""
    pending = PendingAttachments()
    if not patient_ids:
        return pending
    for source in ATTACHMENT_SOURCES:
        pending.extend(
            _source_attachments(db, source, source.model.patient_id.in_(patient_ids))
        )
    return pending


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
        return PendingAttachments(
            local_paths=_unshared_local_paths(db, model, query.all())
        )
    source = _SOURCES_BY_MODEL.get(model)
    if source is None:
        return PendingAttachments()
    return _source_attachments(db, source, model.id.in_(record_ids))


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
