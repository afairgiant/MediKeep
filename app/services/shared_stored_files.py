"""
Stored files that more than one file row points to (#1296).

Two file rows can share a stored file: a legacy lab result file copied to an
EntityFile, or a row an admin pointed at another row's file. Deleting some of
them must leave the file in place for the others.

Each check takes ``deleted_ids``: per file model, the rows removed by the same
delete. Those rows do not count as still using a file, so a delete that removes
every row of a shared file still trashes it.
"""

from pathlib import Path
from typing import Any, Collection, Iterable, List, Mapping, Optional, Set

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.utils.stored_files import resolve_storage_path, resolve_stored_file
from app.models.models import EntityFile, LabResultFile
from app.services.file_management_service import file_management_service

logger = get_logger(__name__, "app")

DeletedIds = Mapping[type, Collection[int]]

# File names matched per query. Each name adds a level to the query's OR, and
# SQLite rejects expressions deeper than 1000 by default.
_NAME_BATCH_SIZE = 500


def paths_in_use(
    db: Session, paths: Iterable[Optional[Path]], deleted_ids: DeletedIds
) -> Set[Path]:
    """The ``paths`` that a file row outside ``deleted_ids`` still points to.

    ``paths`` are resolved storage paths; None entries are ignored. Row paths are
    compared once resolved, so a relative and an absolute path to the same file
    match.
    """
    wanted = {path for path in paths if path}
    if not wanted:
        return set()
    names = sorted({path.name for path in wanted})
    in_use = set()
    for file_model in (EntityFile, LabResultFile):
        excluded = deleted_ids.get(file_model)
        for start in range(0, len(names), _NAME_BATCH_SIZE):
            batch = names[start : start + _NAME_BATCH_SIZE]
            query = db.query(file_model.file_path).filter(
                or_(
                    *(
                        file_model.file_path.endswith(name, autoescape=True)
                        for name in batch
                    )
                )
            )
            if excluded:
                query = query.filter(file_model.id.notin_(excluded))
            in_use.update(resolve_storage_path(path) for (path,) in query)
    return wanted & in_use


def unshared_local_paths(
    db: Session, file_records: Iterable[Any], deleted_ids: DeletedIds
) -> List[Path]:
    """Stored files of ``file_records`` that no file row outside ``deleted_ids`` uses.

    Remote placeholders and missing files are skipped.
    """
    paths = [path for path in map(resolve_stored_file, file_records) if path]
    in_use = paths_in_use(db, paths, deleted_ids)
    return [path for path in paths if path not in in_use]


def unshared_stored_file(
    db: Session, file_record: Any, deleted_ids: DeletedIds
) -> Optional[Path]:
    """The record's stored file, if it may be removed along with the record.

    None when the file is missing, outside storage, or still used by a file row
    outside ``deleted_ids``.
    """
    file_path = resolve_stored_file(file_record)
    if file_path and paths_in_use(db, [file_path], deleted_ids):
        log_shared_file_kept(file_record)
        return None
    return file_path


def trash_unshared_file(
    db: Session, file_record: Any, deleted_ids: DeletedIds, reason: str
) -> bool:
    """Move the record's stored file to trash, unless ``unshared_stored_file`` skips it.

    Returns True when the file moved. Raises when the move fails, so the caller
    can keep the record rather than leave its file behind.
    """
    file_path = unshared_stored_file(db, file_record, deleted_ids)
    if not file_path:
        return False
    file_management_service.move_to_trash(str(file_path), reason=reason)
    return True


def log_shared_file_kept(file_record: Any) -> None:
    logger.info(
        "Kept a stored file that another file record still uses",
        extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "shared_stored_file_kept",
            LogFields.MODEL: type(file_record).__name__,
            LogFields.RECORD_ID: file_record.id,
        },
    )
