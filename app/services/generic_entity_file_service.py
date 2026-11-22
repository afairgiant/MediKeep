"""
Generic Entity File Service for handling file operations across all entity types.
Supports lab-results, insurance, visits, procedures, and future entity types.
"""

import logging
import uuid
from collections import defaultdict
from dataclasses import dataclass
from urllib.parse import urlencode
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from fastapi import HTTPException, UploadFile
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, object_session

from app.core.config import settings
from app.core.http.integration_errors import (
    IntegrationErrorCode,
    IntegrationFailure,
    REMOTE_SERVICE_NAMES,
    integration_http_exception,
    raise_if_integration_failure,
    stored_elsewhere_message,
)
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.utils.integration_verification import normalize_integration_url
from app.core.utils.stored_files import resolve_stored_file
from app.models.models import (
    EntityFile,
    Patient,
    User,
    UserPreferences,
    get_utc_now,
)
from app.schemas.entity_file import (
    EntityFileCreate,
    EntityFileResponse,
    EntityType,
    FileOperationResult,
)
from app.services.export_attachments import ATTACHMENT_SOURCES
from app.services.file_management_service import FileManagementService
from app.services.paperless_auth_methods import (
    credential_kwargs,
    has_usable_credentials,
)

# New simplified architecture
from app.services.paperless_client import (
    PaperlessClientError,
)
from app.services.paperless_client import (
    PaperlessConnectionError as NewPaperlessConnectionError,
)
from app.services.paperless_client import (
    create_paperless_client,
)
from app.services.paperless_service import (
    _build_title_fallback_query,
    log_task_permission_denied,
)
from app.services.paperless_service import (
    PaperlessAuthenticationError,
    PaperlessError,
    create_paperless_service,
)
from app.services.paperless_task_status import extract_task, parse_task
from app.services.patient_access import PatientAccessService

logger = get_logger(__name__, "app")

# Every (entity type, model) pair a file can be attached to, taken from the export's
# attachment sources so the two cannot drift apart. Must match the entity types
# get_entity_by_type_and_id in the entity file endpoints accepts. The Paperless and
# Papra checks find files through these models' patients, so a check only sees the
# current user's files.
FILE_ENTITY_SOURCES = tuple(
    (entity_type, source.model)
    for source in ATTACHMENT_SOURCES
    for entity_type in source.entity_types
)


def _log_file_event(
    level: int,
    event: str,
    message: str,
    file_record: EntityFile,
    *,
    task_uuid: Optional[str] = None,
    error: Optional[str] = None,
) -> None:
    """Log ``event`` for one file, identified by its ID and never by its name."""
    extra = {
        LogFields.CATEGORY: "app",
        LogFields.EVENT: event,
        LogFields.RECORD_ID: file_record.id,
    }
    if task_uuid:
        extra["task_uuid"] = task_uuid
    if error:
        extra[LogFields.ERROR] = error
    logger.log(level, message, extra=extra)


def _as_naive_utc(value: datetime) -> datetime:
    """``value`` as a naive UTC datetime, so naive and aware timestamps can be compared.

    Stored timestamps come back naive (UTC); Paperless timestamps may carry an offset.
    """
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _same_instance_ids(saved_urls: Dict[int, Optional[str]], user_id: int) -> set:
    """``user_id`` plus every user in ``saved_urls`` whose normalised URL matches theirs."""
    # Saved URLs count with the integration off: the files stay in that instance
    urls = {
        uid: normalize_integration_url(url) for uid, url in saved_urls.items() if url
    }
    own_url = urls.get(user_id)
    if not own_url:
        return {user_id}
    return {uid for uid, url in urls.items() if url == own_url} | {user_id}


def same_paperless_user_ids(db: Session, user_id: int) -> set:
    """``user_id`` plus every user whose saved Paperless URL matches theirs."""
    rows = db.query(UserPreferences.user_id, UserPreferences.paperless_url).filter(
        UserPreferences.paperless_url.isnot(None)
    )
    return _same_instance_ids(dict(rows), user_id)


def effective_papra_organization(
    file_organization_id: Optional[str], user_organization_id: Optional[str]
) -> Optional[str]:
    """The organisation Papra requests for a file go to: its own, else the user's saved one."""
    return file_organization_id or user_organization_id


def may_be_stored_elsewhere(
    storage_backend: Optional[str], uploaded_by_user_id: Optional[int], user_id: int
) -> bool:
    """False when a file cannot be stored elsewhere for ``user_id``, so no lookup is needed."""
    return storage_backend in ("paperless", "papra") and uploaded_by_user_id not in (
        None,
        user_id,
    )


@dataclass(frozen=True)
class RemoteStorageAccess:
    """Which users' Paperless and Papra uploads one user's own connections reach.

    The Paperless rule is the Python form of ``resolvable_uploads``.
    """

    user_id: int
    paperless_user_ids: frozenset
    papra_user_ids: frozenset
    papra_organization_id: Optional[str]

    @classmethod
    def for_user(cls, db: Session, user_id: int) -> "RemoteStorageAccess":
        rows = db.query(
            UserPreferences.user_id,
            UserPreferences.paperless_url,
            UserPreferences.papra_url,
            UserPreferences.papra_organization_id,
        ).all()
        own = next((row for row in rows if row.user_id == user_id), None)
        return cls(
            user_id=user_id,
            paperless_user_ids=frozenset(
                _same_instance_ids({r.user_id: r.paperless_url for r in rows}, user_id)
            ),
            papra_user_ids=frozenset(
                _same_instance_ids({r.user_id: r.papra_url for r in rows}, user_id)
            ),
            papra_organization_id=own.papra_organization_id if own else None,
        )

    def stored_elsewhere(
        self,
        storage_backend: Optional[str],
        uploaded_by_user_id: Optional[int],
        papra_organization_id: Optional[str] = None,
    ) -> bool:
        """Whether the file sits in a Paperless or Papra this user's connection cannot reach.

        A file with no recorded uploader is never elsewhere.
        """
        if not may_be_stored_elsewhere(
            storage_backend, uploaded_by_user_id, self.user_id
        ):
            return False
        if storage_backend == "paperless":
            return uploaded_by_user_id not in self.paperless_user_ids
        organization_id = effective_papra_organization(
            papra_organization_id, self.papra_organization_id
        )
        return (
            uploaded_by_user_id not in self.papra_user_ids
            or organization_id != self.papra_organization_id
        )

    def file_stored_elsewhere(self, file_record: EntityFile) -> bool:
        """``stored_elsewhere`` for a file row."""
        return self.stored_elsewhere(
            file_record.storage_backend,
            file_record.uploaded_by_user_id,
            file_record.papra_organization_id,
        )

    def reachable(self, files: List[EntityFile]) -> List[EntityFile]:
        """``files`` without the ones stored elsewhere."""
        return [f for f in files if not self.file_stored_elsewhere(f)]


def _may_be_file_stored_elsewhere(file_record: EntityFile, user_id: int) -> bool:
    return may_be_stored_elsewhere(
        file_record.storage_backend, file_record.uploaded_by_user_id, user_id
    )


def stored_elsewhere_for(db: Session, user_id: int, file_record: EntityFile) -> bool:
    """``RemoteStorageAccess.file_stored_elsewhere``, without a lookup when it cannot be."""
    return _may_be_file_stored_elsewhere(
        file_record, user_id
    ) and RemoteStorageAccess.for_user(db, user_id).file_stored_elsewhere(file_record)


def raise_if_stored_elsewhere(
    db: Session, file_record: EntityFile, user_id: Optional[int]
) -> None:
    """Raise the 409 ``integration_stored_elsewhere`` when ``user_id`` cannot reach the file."""
    if user_id and stored_elsewhere_for(db, user_id, file_record):
        raise integration_http_exception(
            IntegrationFailure(
                IntegrationErrorCode.STORED_ELSEWHERE,
                stored_elsewhere_message(
                    REMOTE_SERVICE_NAMES[file_record.storage_backend]
                ),
            ),
            status_code=409,
        )


def responses_for_viewer(
    db: Session, viewer_id: int, files: List[EntityFile]
) -> List[EntityFileResponse]:
    """``files`` as ``viewer_id`` sees them, with ``stored_elsewhere`` set."""
    access = (
        RemoteStorageAccess.for_user(db, viewer_id)
        if any(_may_be_file_stored_elsewhere(f, viewer_id) for f in files)
        else None
    )
    return [
        EntityFileResponse.model_validate(f).model_copy(
            update={
                "stored_elsewhere": bool(access and access.file_stored_elsewhere(f))
            }
        )
        for f in files
    ]


def resolvable_uploads(db: Session, user_id: int):
    """Filter for files whose Paperless upload ``user_id`` may resolve.

    That is files uploaded by a user in ``same_paperless_user_ids``, and files
    with no recorded uploader. Callers still check edit access to the patient.
    """
    return or_(
        EntityFile.uploaded_by_user_id.in_(same_paperless_user_ids(db, user_id)),
        EntityFile.uploaded_by_user_id.is_(None),
    )


def _mark_duplicate(file_record: EntityFile) -> None:
    file_record.paperless_task_uuid = None
    file_record.sync_status = "duplicate"
    file_record.last_sync_at = get_utc_now()


def _document_linked_elsewhere(file_record: EntityFile, document_id: str) -> bool:
    """Whether another file record already points at this Paperless document."""
    db = object_session(file_record)
    if db is None:
        return False
    return (
        db.query(EntityFile.id)
        .filter(
            EntityFile.id != file_record.id,
            EntityFile.storage_backend == "paperless",
            EntityFile.paperless_document_id == document_id,
        )
        .first()
        is not None
    )


_DOCUMENT_SEARCH_PAGE_SIZE = 100
# Bounds the requests one lookup can make
_DOCUMENT_SEARCH_MAX_PAGES = 5


def _added_within(document: Dict[str, Any], start: datetime, end: datetime) -> bool:
    """Whether a Paperless document was added between naive-UTC ``start`` and ``end``."""
    # "added" is when Paperless stored it; "created" is the date read from its content
    added = document.get("added")
    if not isinstance(added, str):
        return False
    try:
        added_at = _as_naive_utc(datetime.fromisoformat(added.replace("Z", "+00:00")))
    except ValueError:
        return False
    return start <= added_at <= end


def _normalized(name: Any) -> str:
    return str(name or "").strip().casefold()


def _file_name_matches(document: Dict[str, Any], filename: str) -> bool:
    """Whether the document's original file name is ``filename``, or its title is the name or its stem."""
    name = _normalized(filename)
    if not name:
        return False
    title = _normalized(document.get("title"))
    return _normalized(document.get("original_file_name")) == name or title in (
        name,
        _normalized(Path(filename).stem),
    )


def entity_files_of_records(
    db: Session, sources, record_condition: Callable[[type], Any], *conditions
) -> List[EntityFile]:
    """Files matching ``conditions`` on the ``sources`` records that ``record_condition`` selects.

    ``sources`` is a non-empty iterable of (entity type, model) pairs, and
    ``record_condition(model)`` returns the filter on that model's records.
    """
    attached_to_records = [
        and_(
            EntityFile.entity_type == entity_type,
            EntityFile.entity_id.in_(select(model.id).where(record_condition(model))),
        )
        for entity_type, model in sources
    ]
    return db.query(EntityFile).filter(or_(*attached_to_records), *conditions).all()


def _entity_files(db: Session, sources, patient_ids, *conditions) -> List[EntityFile]:
    """Files matching ``conditions`` on the ``sources`` records of the patients ``patient_ids`` selects."""
    return entity_files_of_records(
        db, sources, lambda model: model.patient_id.in_(patient_ids), *conditions
    )


def _user_entity_files(
    db: Session, user_id: int, sources, *conditions
) -> List[EntityFile]:
    """Files matching ``conditions`` on the ``sources`` records of the user's patients."""
    return _entity_files(
        db, sources, select(Patient.id).where(Patient.user_id == user_id), *conditions
    )


def _editable_entity_files(
    db: Session, user_id: int, sources, *conditions
) -> List[EntityFile]:
    """Files matching ``conditions`` on the ``sources`` records of patients the user can edit."""
    return _entity_files(
        db,
        sources,
        PatientAccessService.accessible_patient_ids(user_id, "edit"),
        *conditions,
    )


class GenericEntityFileService:
    """Service for managing files across all entity types."""

    def __init__(self):
        self.file_management_service = FileManagementService()

        # Entity type to directory mapping
        self.entity_dirs = {
            EntityType.LAB_RESULT: "lab-results",
            EntityType.INSURANCE: "insurance",
            EntityType.VISIT: "visits",
            EntityType.ENCOUNTER: "visits",  # encounters and visits use same directory
            EntityType.PROCEDURE: "procedures",
        }

    @property
    def uploads_dir(self) -> Path:
        # Read on use so this always matches what resolve_stored_file accepts
        return Path(settings.UPLOAD_DIR)

    def _get_entity_directory(self, entity_type: str) -> Path:
        """Get the directory path for a specific entity type."""
        entity_type_enum = EntityType(entity_type)
        dir_name = self.entity_dirs.get(entity_type_enum, entity_type)
        entity_dir = self.uploads_dir / "files" / dir_name
        entity_dir.mkdir(parents=True, exist_ok=True)
        return entity_dir

    def _generate_unique_filename(
        self, original_filename: str, entity_dir: Path
    ) -> str:
        """Generate a unique filename to prevent conflicts."""
        file_extension = Path(original_filename).suffix
        base_name = Path(original_filename).stem

        # Use UUID for uniqueness
        unique_id = str(uuid.uuid4())
        unique_filename = f"{base_name}_{unique_id}{file_extension}"

        # Ensure uniqueness (though UUID collision is extremely unlikely)
        counter = 1
        while (entity_dir / unique_filename).exists():
            unique_filename = f"{base_name}_{unique_id}_{counter}{file_extension}"
            counter += 1

        return unique_filename

    def _validate_entity_type(self, entity_type: str) -> None:
        """Validate that the entity type is supported."""
        try:
            EntityType(entity_type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported entity type: {entity_type}. "
                f"Supported types: {[t.value for t in EntityType]}",
            )

    async def _create_paperless_client(self, user_prefs, user_id: int):
        """
        Create a paperless client using the new simplified architecture.

        This is a transitional helper method that uses the new architecture
        while maintaining compatibility with existing code.
        """
        return create_paperless_client(
            url=user_prefs.paperless_url,
            **credential_kwargs(user_prefs),
            user_id=user_id,
        )

    async def upload_file(
        self,
        db: Session,
        entity_type: str,
        entity_id: int,
        file: UploadFile,
        description: Optional[str] = None,
        category: Optional[str] = None,
        storage_backend: Optional[str] = "local",
        current_user_id: Optional[int] = None,
    ) -> EntityFileResponse:
        """
        Upload a file for any entity type with dual storage backend support.

        Args:
            db: Database session
            entity_type: Type of entity (lab-result, insurance, visit, procedure)
            entity_id: ID of the entity
            file: File to upload
            description: Optional description
            category: Optional category
            storage_backend: Storage backend ('local' or 'paperless')
            current_user_id: ID of the user uploading the file

        Returns:
            EntityFileResponse with file details
        """
        # If no storage backend specified, use user's default preference
        if storage_backend is None:
            user_prefs = (
                db.query(UserPreferences)
                .filter(UserPreferences.user_id == current_user_id)
                .first()
            )
            storage_backend = (
                user_prefs.default_storage_backend if user_prefs else "local"
            )
            logger.info(
                f"No storage backend specified, using user default: {storage_backend}"
            )

        logger.info(
            f"Starting file upload: {file.filename} to {storage_backend} storage for {entity_type} {entity_id} (user: {current_user_id})"
        )
        try:
            # Validate entity type
            self._validate_entity_type(entity_type)

            # Validate storage backend
            valid_backends = ["local", "paperless", "papra"]
            if storage_backend not in valid_backends:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid storage backend: {storage_backend}. Must be one of: {', '.join(valid_backends)}",
                )

            # If paperless is selected, validate configuration before attempting upload
            if storage_backend == "paperless":
                user_prefs = (
                    db.query(UserPreferences)
                    .filter(UserPreferences.user_id == current_user_id)
                    .first()
                )

                if not user_prefs or not user_prefs.paperless_enabled:
                    raise HTTPException(
                        status_code=400,
                        detail="Paperless integration is not enabled. Please enable it in settings before uploading to Paperless.",
                    )

                # Check that the chosen authentication method has saved credentials
                if not user_prefs.paperless_url or not has_usable_credentials(
                    user_prefs
                ):
                    raise HTTPException(
                        status_code=400,
                        detail="Paperless configuration is incomplete. Please configure URL and authentication credentials (token or username/password) in settings.",
                    )

            # If Papra is selected, validate configuration before attempting upload
            if storage_backend == "papra":
                user_prefs = (
                    db.query(UserPreferences)
                    .filter(UserPreferences.user_id == current_user_id)
                    .first()
                )

                if not user_prefs or not user_prefs.papra_enabled:
                    raise HTTPException(
                        status_code=400,
                        detail="Papra integration is not enabled. Please enable it in settings before uploading to Papra.",
                    )

                if not user_prefs.papra_url or not user_prefs.papra_api_token_encrypted:
                    raise HTTPException(
                        status_code=400,
                        detail="Papra configuration is incomplete. Please configure URL and API token in settings.",
                    )

                if not user_prefs.papra_organization_id:
                    raise HTTPException(
                        status_code=400,
                        detail="Papra organization is not configured. Please select an organization in settings.",
                    )

            # Read file content once for both backends
            file_content = await file.read()
            file_size = len(file_content)

            # Validate file size (100MB limit)
            max_size = 100 * 1024 * 1024  # 100MB
            if file_size > max_size:
                raise HTTPException(
                    status_code=413,
                    detail=f"File size ({file_size} bytes) exceeds maximum allowed size ({max_size} bytes)",
                )

            # Route to appropriate storage backend
            logger.info(f"Routing upload to {storage_backend} backend")
            if storage_backend == "paperless":
                result = await self._upload_to_paperless(
                    db,
                    entity_type,
                    entity_id,
                    file,
                    file_content,
                    file_size,
                    description,
                    category,
                    current_user_id,
                )
                logger.info(f"Paperless upload completed: file_id={result.id}")
                return result
            if storage_backend == "papra":
                result = await self._upload_to_papra(
                    db,
                    entity_type,
                    entity_id,
                    file,
                    file_content,
                    file_size,
                    description,
                    category,
                    current_user_id,
                )
                logger.info(f"Papra upload completed: file_id={result.id}")
                return result
            if storage_backend == "local":
                result = await self._upload_to_local(
                    db,
                    entity_type,
                    entity_id,
                    file,
                    file_content,
                    file_size,
                    description,
                    category,
                    current_user_id,
                )
                logger.info(f"Local upload completed: file_id={result.id}")
                return result
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported storage backend: {storage_backend}",
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error uploading file: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to upload file")

    def get_entity_files(
        self, db: Session, entity_type: str, entity_id: int, viewer_id: int
    ) -> List[EntityFileResponse]:
        """
        Get all files for a specific entity.

        Args:
            db: Database session
            entity_type: Type of entity
            entity_id: ID of the entity
            viewer_id: User the ``stored_elsewhere`` flags are worked out for

        Returns:
            List of EntityFileResponse objects
        """
        try:
            # Validate entity type
            self._validate_entity_type(entity_type)

            # Query files from database
            files = (
                db.query(EntityFile)
                .filter(
                    EntityFile.entity_type == entity_type,
                    EntityFile.entity_id == entity_id,
                )
                .order_by(EntityFile.uploaded_at.desc())
                .all()
            )

            return responses_for_viewer(db, viewer_id, files)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                f"Error retrieving files for {entity_type} {entity_id}: {str(e)}"
            )
            raise HTTPException(status_code=500, detail="Failed to retrieve files")

    def get_file_by_id(self, db: Session, file_id: int) -> Optional[EntityFile]:
        """
        Get a file by its ID.

        Args:
            db: Database session
            file_id: ID of the file

        Returns:
            EntityFile object or None
        """
        try:
            return db.query(EntityFile).filter(EntityFile.id == file_id).first()
        except Exception as e:
            logger.error(f"Error retrieving file {file_id}: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to retrieve file")

    async def _handle_remote_backend_deletion(
        self,
        db: Session,
        file_record: EntityFile,
        backend_name: str,
        document_id_attr: str,
        link_prefix: str,
        delete_fn,
        current_user_id: Optional[int],
        check_paperless_identity: bool = False,
    ) -> bool:
        """
        Handle deletion logic for remote storage backends (Paperless, Papra).

        With ``check_paperless_identity``, a file whose Paperless ID names another
        document is only unlinked.

        Determines whether to unlink (linked docs), skip deletion (multiple
        references or missing docs), or actually delete from the remote backend.

        Args:
            db: Database session
            file_record: The EntityFile record being deleted
            backend_name: Display name of the backend ("Paperless" or "Papra")
            document_id_attr: Attribute name for the document ID on EntityFile
            link_prefix: URL prefix that identifies linked documents (e.g. "paperless://document/")
            delete_fn: Async callable to perform the actual remote deletion
            current_user_id: ID of the user performing the deletion

        Returns:
            True if this is a linked document (unlink only), False otherwise
        """
        document_id = getattr(file_record, document_id_attr)
        is_linked = file_record.file_path and file_record.file_path.startswith(
            link_prefix
        )

        if is_linked:
            logger.info(
                f"Document {document_id} is a linked document. "
                f"Unlinking from MediKeep only; it stays in {backend_name}."
            )
            return True

        # The actor's connection would delete whatever has this ID in their own instance
        if current_user_id and stored_elsewhere_for(db, current_user_id, file_record):
            _log_file_event(
                logging.INFO,
                "remote_file_unlinked_from_other_instance",
                f"File is in another member's {backend_name}; removing it from MediKeep only",
                file_record,
            )
            return True

        # No remote document ID means the upload never finished (still
        # processing, or its task failed), so there is nothing to remove from
        # the remote backend. This must be checked before the reference count
        # below, which would otherwise match every other record whose ID is
        # also NULL and skip the remote delete for the wrong reason.
        if not document_id:
            logger.info(
                f"{backend_name} record {file_record.id} has no document ID "
                f"(sync_status: {file_record.sync_status}). "
                f"Nothing to delete remotely; removing database record only."
            )
            return False

        # Uploaded document - check if other records reference it
        doc_id_column = getattr(EntityFile, document_id_attr)
        other_references = (
            db.query(EntityFile)
            .filter(
                doc_id_column == document_id,
                EntityFile.storage_backend == file_record.storage_backend,
                EntityFile.id != file_record.id,
            )
            .count()
        )

        if other_references > 0:
            logger.info(
                f"{backend_name} document {document_id} has {other_references} other references. "
                f"Skipping {backend_name} deletion, only removing database record."
            )
        elif file_record.sync_status == "missing":
            logger.info(
                f"Document {document_id} is marked as missing. "
                f"Skipping {backend_name} deletion since document is not accessible."
            )
        else:
            if (
                check_paperless_identity
                and await self._paperless_id_names_another_document(
                    db, file_record, current_user_id
                )
            ):
                _log_file_event(
                    logging.WARNING,
                    "remote_file_id_names_another_document",
                    f"{backend_name} document with this ID is not this file; "
                    f"removing it from MediKeep only",
                    file_record,
                )
                return True
            logger.info(
                f"Attempting to delete uploaded document {document_id} "
                f"from {backend_name} (sync_status: {file_record.sync_status})"
            )
            deleted = await delete_fn(db, file_record, current_user_id)
            if not deleted:
                logger.error(
                    f"{backend_name} deletion failed for document {document_id}"
                )
                raise HTTPException(
                    status_code=500,
                    detail=(
                        f"Failed to delete file from {backend_name}. "
                        f"The document may still exist on the {backend_name} server."
                    ),
                )

        return False

    async def delete_file(
        self, db: Session, file_id: int, current_user_id: Optional[int] = None
    ) -> FileOperationResult:
        """
        Delete a file by its ID from local, Paperless, or Papra storage.

        Args:
            db: Database session
            file_id: ID of the file to delete
            current_user_id: ID of the user performing the deletion

        Returns:
            FileOperationResult with operation details
        """
        try:
            file_record = self.get_file_by_id(db, file_id)
            if not file_record:
                raise HTTPException(
                    status_code=404, detail=f"File not found: {file_id}"
                )

            is_linked_document = False

            if file_record.storage_backend == "paperless":
                is_linked_document = await self._handle_remote_backend_deletion(
                    db,
                    file_record,
                    backend_name="Paperless",
                    document_id_attr="paperless_document_id",
                    link_prefix="paperless://document/",
                    delete_fn=self._delete_from_paperless,
                    current_user_id=current_user_id,
                    check_paperless_identity=True,
                )
            elif file_record.storage_backend == "papra":
                is_linked_document = await self._handle_remote_backend_deletion(
                    db,
                    file_record,
                    backend_name="Papra",
                    document_id_attr="papra_document_id",
                    link_prefix="papra://document/",
                    delete_fn=self._delete_from_papra,
                    current_user_id=current_user_id,
                )
            elif file_record.storage_backend == "local":
                # Handle local file deletion
                file_path = resolve_stored_file(file_record)
                if file_path:
                    trash_result = self.file_management_service.move_to_trash(
                        str(file_path),
                        reason=f"Deleted via API for {file_record.entity_type} {file_record.entity_id}",
                    )
                    logger.info(f"File moved to trash: {trash_result}")
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported storage backend: {file_record.storage_backend}",
                )

            # Remove from database only after successful deletion from storage backend
            db.delete(file_record)
            db.commit()

            # Create appropriate success message based on operation type
            operation_type = "unlinked" if is_linked_document else "deleted"
            success_message = f"Document {operation_type} successfully"

            logger.info(
                f"File {operation_type} successfully: {file_record.file_name} from {file_record.storage_backend} storage"
            )

            result_path = file_record.file_path
            if not result_path:
                if file_record.storage_backend == "paperless":
                    result_path = f"paperless:{file_record.paperless_document_id}"
                elif file_record.storage_backend == "papra":
                    result_path = f"papra:{file_record.papra_document_id}"

            return FileOperationResult(
                success=True,
                message=success_message,
                file_id=file_id,
                file_path=result_path,
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting file {file_id}: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to delete file")

    async def get_file_download_info(
        self, db: Session, file_id: int, current_user_id: Optional[int] = None
    ) -> Tuple[str, str, str]:
        """
        Get file information for download from both local and paperless storage.

        Args:
            db: Database session
            file_id: ID of the file
            current_user_id: ID of the current user for paperless access

        Returns:
            Tuple of (file_path_or_content, filename, content_type)
        """
        try:
            file_record = self.get_file_by_id(db, file_id)
            if not file_record:
                raise HTTPException(
                    status_code=404, detail=f"File not found: {file_id}"
                )

            raise_if_stored_elsewhere(db, file_record, current_user_id)

            # Route to appropriate storage backend for download
            logger.debug(
                "Routing file download request",
                extra={
                    "file_id": file_id,
                    "storage_backend": file_record.storage_backend,
                    "has_paperless_doc_id": bool(file_record.paperless_document_id),
                    "component": "generic_entity_file_service",
                },
            )
            if file_record.storage_backend == "paperless":
                return await self._get_paperless_download_info(
                    db, file_record, current_user_id
                )
            if file_record.storage_backend == "papra":
                return await self._get_papra_download_info(
                    db, file_record, current_user_id
                )
            if file_record.storage_backend == "local":
                file_path = resolve_stored_file(file_record)
                if not file_path:
                    raise HTTPException(
                        status_code=404,
                        detail=f"File not found on disk: {file_record.file_name}",
                    )

                return (
                    str(file_path),
                    file_record.file_name,
                    file_record.file_type or "application/octet-stream",
                )
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported storage backend: {file_record.storage_backend}",
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting download info for file {file_id}: {str(e)}")
            raise HTTPException(
                status_code=500, detail="Failed to get file download info"
            )

    async def get_file_view_info(
        self, db: Session, file_id: int, current_user_id: Optional[int] = None
    ) -> Tuple[str, str, str]:
        """
        Get file information for viewing (inline display).
        Similar to get_file_download_info but optimized for viewing.

        Args:
            db: Database session
            file_id: ID of the file

        Returns:
            Tuple of (file_path_or_content, filename, content_type)
        """
        try:
            # Get file record from database
            file_record = db.query(EntityFile).filter(EntityFile.id == file_id).first()
            if not file_record:
                raise HTTPException(status_code=404, detail="File not found")
            raise_if_stored_elsewhere(db, file_record, current_user_id)

            logger.debug(
                "Retrieving file for viewing",
                extra={
                    "file_id": file_id,
                    "storage_backend": file_record.storage_backend,
                    "component": "generic_entity_file_service",
                },
            )

            if file_record.storage_backend == "paperless":
                # Handle Paperless files
                if not file_record.paperless_document_id:
                    raise HTTPException(
                        status_code=404, detail="Paperless document ID not found"
                    )

                # Convert document ID to int once to avoid redundant casting
                document_id = int(file_record.paperless_document_id)

                # Use existing paperless service to get file content

                # Get user for paperless credentials
                if not current_user_id:
                    raise HTTPException(
                        status_code=401,
                        detail="User authentication required for file viewing",
                    )

                user = db.query(User).filter(User.id == current_user_id).first()
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")

                # Get user preferences for paperless configuration
                user_prefs = (
                    db.query(UserPreferences)
                    .filter(UserPreferences.user_id == user.id)
                    .first()
                )

                if not user_prefs or not user_prefs.paperless_enabled:
                    raise HTTPException(
                        status_code=400, detail="Paperless integration is not enabled"
                    )

                # Log authentication details for debugging
                logger.debug(
                    f"View debug - User: {user.id}, URL: {user_prefs.paperless_url}"
                )
                logger.debug(
                    f"View debug - Has token: {bool(user_prefs.paperless_api_token_encrypted)}"
                )
                logger.debug(
                    f"View debug - Has username: {bool(user_prefs.paperless_username_encrypted)}"
                )
                logger.debug(
                    f"View debug - Has password: {bool(user_prefs.paperless_password_encrypted)}"
                )
                logger.debug(f"View debug - Document ID: {document_id}")

                # Create paperless service using token auth (supports 2FA)
                from app.services.paperless_service import create_paperless_service

                paperless_service = create_paperless_service(
                    user_prefs.paperless_url,
                    **credential_kwargs(user_prefs),
                    user_id=user.id,
                )

                logger.debug("Paperless service created successfully")

                # First test if we can read document metadata (less restrictive than download)
                logger.debug(
                    f"Testing document access for ID: {file_record.paperless_document_id}"
                )
                async with paperless_service:
                    try:
                        # Try to get document info first to test permissions
                        async with paperless_service._make_request(
                            "GET", f"/api/documents/{document_id}/"
                        ) as doc_response:
                            if doc_response.status == 200:
                                doc_info = await doc_response.json()
                                logger.debug(
                                    f"Document info accessible: {doc_info.get('title', 'N/A')}"
                                )
                            else:
                                logger.debug(
                                    f"Document info failed: {doc_response.status}"
                                )
                    except Exception as info_error:
                        logger.debug(f"Document info error: {info_error}")

                    # Now try download
                    logger.debug(f"Starting download for document ID: {document_id}")
                    try:
                        file_content = await paperless_service.download_document(
                            document_id=document_id
                        )
                        logger.debug(
                            f"Download completed, content size: {len(file_content) if file_content else 0}"
                        )
                    except Exception as download_error:
                        logger.error(
                            f"Download failed for document {document_id}: {download_error}"
                        )
                        logger.error(
                            "Document owner in search results might be different from authenticated user"
                        )
                        raise

                return file_content, file_record.file_name, file_record.file_type
            if file_record.storage_backend == "papra":
                # Handle Papra files - same pattern as download
                return await self._get_papra_download_info(
                    db, file_record, current_user_id
                )
            if file_record.storage_backend == "local":
                file_path = resolve_stored_file(file_record)
                if not file_path:
                    raise HTTPException(
                        status_code=404, detail="File not found on disk"
                    )

                return str(file_path), file_record.file_name, file_record.file_type
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported storage backend: {file_record.storage_backend}",
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error retrieving file for viewing: {str(e)}")
            raise HTTPException(
                status_code=500, detail="Failed to retrieve file for viewing"
            )

    def get_files_count_batch(
        self, db: Session, entity_type: str, entity_ids: List[int]
    ) -> Dict[int, int]:
        """
        Get file counts for multiple entities in batch.

        Args:
            db: Database session
            entity_type: Type of entity
            entity_ids: List of entity IDs

        Returns:
            Dictionary mapping entity_id to file_count
        """
        try:
            # Validate entity type
            self._validate_entity_type(entity_type)

            # Query file counts
            from sqlalchemy import func

            results = (
                db.query(
                    EntityFile.entity_id, func.count(EntityFile.id).label("file_count")
                )
                .filter(
                    EntityFile.entity_type == entity_type,
                    EntityFile.entity_id.in_(entity_ids),
                )
                .group_by(EntityFile.entity_id)
                .all()
            )

            # Create result dictionary with 0 counts for entities with no files
            file_counts = {entity_id: 0 for entity_id in entity_ids}
            for entity_id, count in results:
                file_counts[entity_id] = count

            return file_counts

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting batch file counts: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to get file counts")

    async def _upload_to_local(
        self,
        db: Session,
        entity_type: str,
        entity_id: int,
        file: UploadFile,
        file_content: bytes,
        file_size: int,
        description: Optional[str] = None,
        category: Optional[str] = None,
        current_user_id: Optional[int] = None,
    ) -> EntityFileResponse:
        """
        Upload file to local storage.

        Args:
            db: Database session
            entity_type: Type of entity
            entity_id: ID of the entity
            file: File to upload
            file_content: File content bytes
            file_size: Size of file in bytes
            description: Optional description
            category: Optional category
            current_user_id: ID of the user uploading the file

        Returns:
            EntityFileResponse with file details
        """
        # Get entity directory
        entity_dir = self._get_entity_directory(entity_type)

        # Generate unique filename
        unique_filename = self._generate_unique_filename(file.filename, entity_dir)
        file_path = entity_dir / unique_filename

        try:
            # Save file to disk
            with open(file_path, "wb") as f:
                f.write(file_content)

            # ✅ FIX: Validate with Pydantic schema BEFORE creating database record
            # This ensures validation failures are caught BEFORE committing to database
            file_create = EntityFileCreate(
                entity_type=entity_type,
                entity_id=entity_id,
                file_name=file.filename,
                file_path=str(file_path),
                file_type=file.content_type,  # Pydantic validation happens HERE
                file_size=file_size,
                description=description,
                category=category,
                storage_backend="local",
                uploaded_at=get_utc_now(),
                uploaded_by_user_id=current_user_id,
            )

            # Create database record from validated schema
            entity_file = EntityFile(**file_create.model_dump())

            db.add(entity_file)
            db.commit()
            db.refresh(entity_file)

            logger.info(
                f"File uploaded to local storage: {file.filename} for {entity_type} {entity_id}"
            )

            return EntityFileResponse.model_validate(entity_file)

        except Exception as e:
            # Clean up file if database operation failed
            if file_path.exists():
                file_path.unlink()
            raise e

    async def _upload_to_paperless(
        self,
        db: Session,
        entity_type: str,
        entity_id: int,
        file: UploadFile,
        file_content: bytes,
        file_size: int,
        description: Optional[str] = None,
        category: Optional[str] = None,
        current_user_id: Optional[int] = None,
    ) -> EntityFileResponse:
        """
        Upload file to paperless-ngx.

        Args:
            db: Database session
            entity_type: Type of entity
            entity_id: ID of the entity
            file: File to upload
            file_content: File content bytes
            file_size: Size of file in bytes
            description: Optional description
            category: Optional category
            current_user_id: ID of the user uploading the file

        Returns:
            EntityFileResponse with file details
        """
        if not current_user_id:
            raise HTTPException(
                status_code=400, detail="User ID is required for paperless uploads"
            )

        # Get user's paperless configuration
        user_prefs = (
            db.query(UserPreferences)
            .filter(UserPreferences.user_id == current_user_id)
            .first()
        )

        if not user_prefs or not user_prefs.paperless_enabled:
            raise HTTPException(
                status_code=400,
                detail="Paperless integration is not enabled for this user",
            )

        # Check that the chosen authentication method has saved credentials
        if not user_prefs.paperless_url or not has_usable_credentials(user_prefs):
            raise HTTPException(
                status_code=400, detail="Paperless configuration is incomplete"
            )

        try:
            # REMOVED: Problematic duplicate checking that was preventing uploads
            # The previous logic created fake "success" responses without actually
            # uploading files to Paperless, causing documents to never reach Paperless.
            #
            # Let Paperless handle its own duplicate detection at the server level.
            # This ensures all files are actually uploaded and processed by Paperless.

            logger.info(
                f"Uploading '{file.filename}' to Paperless for {entity_type} {entity_id} (user: {current_user_id})"
            )

            # Always upload to Paperless - let Paperless handle duplicate detection
            logger.info(
                f"UPLOAD_DEBUG: Creating Paperless service for user {current_user_id}",
                extra={
                    "file_name": file.filename,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "paperless_url": user_prefs.paperless_url,
                    "user_id": current_user_id,
                },
            )

            # Create paperless service using token auth (supports 2FA)
            from app.services.paperless_service import create_paperless_service

            paperless_service = create_paperless_service(
                user_prefs.paperless_url,
                **credential_kwargs(user_prefs),
                user_id=current_user_id,
            )

            # Upload to paperless
            logger.info(
                f"UPLOAD_DEBUG: Starting actual Paperless upload for '{file.filename}'",
                extra={
                    "file_name": file.filename,
                    "file_size": file_size,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "user_id": current_user_id,
                },
            )

            async with paperless_service:
                upload_result = await paperless_service.upload_document(
                    file_data=file_content,
                    filename=file.filename,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    description=description,
                )

            logger.info(
                f"UPLOAD_DEBUG: Paperless upload completed for '{file.filename}'",
                extra={
                    "file_name": file.filename,
                    "upload_result": upload_result,
                    "user_id": current_user_id,
                },
            )

            # Check if we got a document_id immediately (already processed) or just task_id (processing)
            document_id = upload_result.get("document_id")
            task_id = upload_result.get("task_id")

            if document_id:
                # Document was processed immediately - use normal flow
                sync_status = "synced"
                paperless_id = document_id
                paperless_task_uuid = (
                    None  # No need to track task when already processed
                )
                last_sync = get_utc_now()
                logger.info(
                    f"Document processed immediately: {file.filename} -> document_id: {document_id}"
                )
            elif task_id:
                # Document is being processed - store task_id for polling
                sync_status = "processing"
                paperless_id = (
                    None  # No document ID yet - don't set until processing completes
                )
                paperless_task_uuid = task_id  # Store task UUID for polling
                last_sync = None
                logger.info(
                    f"Document queued for processing: {file.filename} -> task_id: {task_id}"
                )
            else:
                # No document ID or task ID - something went wrong
                raise Exception("No document ID or task ID returned from Paperless")

            # ✅ FIX: Validate with Pydantic schema BEFORE creating database record
            # This ensures validation failures are caught BEFORE committing to database
            file_create = EntityFileCreate(
                entity_type=entity_type,
                entity_id=entity_id,
                file_name=file.filename,
                file_path="paperless://",  # Paperless storage, no local path
                file_type=file.content_type,  # Pydantic validation happens HERE
                file_size=file_size,
                description=description,
                category=category,
                storage_backend="paperless",
                uploaded_at=get_utc_now(),
                sync_status=sync_status,
                last_sync_at=last_sync,
                paperless_document_id=paperless_id,  # Only set when document is processed
                paperless_task_uuid=paperless_task_uuid,  # Task UUID for Paperless processing
                uploaded_by_user_id=current_user_id,
            )

            # Create database record from validated schema
            entity_file = EntityFile(**file_create.model_dump())

            db.add(entity_file)
            db.commit()
            db.refresh(entity_file)

            logger.info(
                f"File uploaded to paperless: {file.filename} for {entity_type} {entity_id} "
                f"(status: {sync_status}, id: {paperless_id}, task_uuid: {paperless_task_uuid})"
            )

            # TODO: If sync_status is "processing", start background task to poll for completion
            # For now, you can manually call update_processing_files() to check status
            # Future: Implement with Celery, background threads, or cron job

            response = EntityFileResponse.model_validate(entity_file)
            logger.info(
                f"Returning response with task_uuid: {response.paperless_task_uuid}"
            )
            return response

        except Exception as e:
            logger.error(f"Error uploading to paperless: {str(e)}")
            raise_if_integration_failure(e, "Paperless")
            raise HTTPException(status_code=500, detail="Failed to upload to paperless")

    async def _upload_to_papra(
        self,
        db: Session,
        entity_type: str,
        entity_id: int,
        file: UploadFile,
        file_content: bytes,
        file_size: int,
        description: Optional[str],
        category: Optional[str],
        current_user_id: int,
    ) -> EntityFileResponse:
        """Upload file to Papra document management system."""
        try:
            from app.services.papra_client import create_papra_client

            user_prefs = (
                db.query(UserPreferences)
                .filter(UserPreferences.user_id == current_user_id)
                .first()
            )

            papra_client = create_papra_client(
                url=user_prefs.papra_url,
                encrypted_token=user_prefs.papra_api_token_encrypted,
                organization_id=user_prefs.papra_organization_id,
                user_id=current_user_id,
            )

            logger.info(
                f"Starting Papra upload for '{file.filename}'",
                extra={
                    "file_name": file.filename,
                    "file_size": file_size,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "user_id": current_user_id,
                },
            )

            async with papra_client:
                upload_result = await papra_client.upload_document(
                    file_data=file_content,
                    filename=file.filename,
                    title=description or file.filename,
                    content_type=file.content_type,
                )

            # Papra is synchronous - document_id is returned immediately
            document_id = upload_result.get("document_id")
            if not document_id:
                raise Exception("No document ID returned from Papra")

            file_create = EntityFileCreate(
                entity_type=entity_type,
                entity_id=entity_id,
                file_name=file.filename,
                file_path="papra://",
                file_type=file.content_type,
                file_size=file_size,
                description=description,
                category=category,
                storage_backend="papra",
                uploaded_at=get_utc_now(),
                sync_status="synced",
                last_sync_at=get_utc_now(),
                papra_document_id=document_id,
                papra_organization_id=user_prefs.papra_organization_id,
                uploaded_by_user_id=current_user_id,
            )

            entity_file = EntityFile(**file_create.model_dump())
            db.add(entity_file)
            db.commit()
            db.refresh(entity_file)

            logger.info(
                f"File uploaded to Papra: {file.filename} for {entity_type} {entity_id} "
                f"(document_id: {document_id})"
            )

            return EntityFileResponse.model_validate(entity_file)

        except Exception as e:
            logger.error(f"Error uploading to Papra: {str(e)}")
            raise_if_integration_failure(e, "Papra")
            raise HTTPException(status_code=500, detail="Failed to upload to Papra")

    async def _get_papra_download_info(
        self, db: Session, file_record, current_user_id: Optional[int] = None
    ):
        """Get download info for a Papra-stored file."""
        try:
            from app.services.papra_client import create_papra_client

            if not file_record.papra_document_id:
                raise HTTPException(
                    status_code=404, detail="Papra document ID not found"
                )

            if not current_user_id:
                raise HTTPException(
                    status_code=401,
                    detail="User authentication required for Papra file access",
                )

            user_prefs = (
                db.query(UserPreferences)
                .filter(UserPreferences.user_id == current_user_id)
                .first()
            )

            if not user_prefs or not user_prefs.papra_enabled:
                raise HTTPException(
                    status_code=400, detail="Papra integration is not enabled"
                )

            org_id = effective_papra_organization(
                file_record.papra_organization_id, user_prefs.papra_organization_id
            )

            papra_client = create_papra_client(
                url=user_prefs.papra_url,
                encrypted_token=user_prefs.papra_api_token_encrypted,
                organization_id=org_id,
                user_id=current_user_id,
            )

            async with papra_client:
                file_content = await papra_client.download_document(
                    file_record.papra_document_id
                )

            return (
                file_content,
                file_record.file_name,
                file_record.file_type or "application/octet-stream",
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error downloading from Papra: {str(e)}")
            raise HTTPException(
                status_code=500, detail="Failed to download file from Papra"
            )

    async def _delete_from_papra(
        self, db: Session, file_record, current_user_id: Optional[int] = None
    ) -> bool:
        """Delete a file from Papra."""
        try:
            from app.services.papra_client import create_papra_client

            if not file_record.papra_document_id:
                logger.warning("No Papra document ID found, skipping remote deletion")
                return True

            user_prefs = (
                db.query(UserPreferences)
                .filter(UserPreferences.user_id == current_user_id)
                .first()
            )

            if not user_prefs or not user_prefs.papra_enabled:
                logger.warning("Papra not enabled, skipping remote deletion")
                return True

            org_id = effective_papra_organization(
                file_record.papra_organization_id, user_prefs.papra_organization_id
            )

            papra_client = create_papra_client(
                url=user_prefs.papra_url,
                encrypted_token=user_prefs.papra_api_token_encrypted,
                organization_id=org_id,
                user_id=current_user_id,
            )

            async with papra_client:
                result = await papra_client.delete_document(
                    file_record.papra_document_id
                )

            logger.info(
                f"Papra document {file_record.papra_document_id} deleted: {result}"
            )
            return result

        except Exception as e:
            logger.error(f"Error deleting from Papra: {str(e)}")
            return False

    def update_file_metadata(
        self,
        db: Session,
        file_id: int,
        description: Optional[str] = None,
        category: Optional[str] = None,
    ) -> EntityFileResponse:
        """
        Update file metadata (description, category).

        Args:
            db: Database session
            file_id: ID of the file to update
            description: New description
            category: New category

        Returns:
            Updated EntityFileResponse
        """
        try:
            file_record = self.get_file_by_id(db, file_id)
            if not file_record:
                raise HTTPException(
                    status_code=404, detail=f"File not found: {file_id}"
                )

            # Update metadata
            if description is not None:
                file_record.description = description
            if category is not None:
                file_record.category = category

            file_record.updated_at = datetime.utcnow()

            db.commit()
            db.refresh(file_record)

            logger.info(f"File metadata updated: {file_id}")

            return EntityFileResponse.model_validate(file_record)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating file metadata {file_id}: {str(e)}")
            raise HTTPException(
                status_code=500, detail="Failed to update file metadata"
            )

    async def _paperless_id_names_another_document(
        self, db: Session, file_record: EntityFile, current_user_id: Optional[int]
    ) -> bool:
        """Whether the user's Paperless holds a document with this file's ID under another name.

        False when that cannot be told (no settings, not found, or the request fails).
        """
        # Integer IDs repeat across instances, and the uploader is unknown or their URL changed
        if not current_user_id:
            return False
        user_prefs = (
            db.query(UserPreferences)
            .filter(UserPreferences.user_id == current_user_id)
            .first()
        )
        if not user_prefs or not user_prefs.paperless_enabled:
            return False
        try:
            async with await self._create_paperless_client(
                user_prefs, current_user_id
            ) as paperless_client:
                document = await paperless_client.get_document_info(
                    file_record.paperless_document_id
                )
        except Exception as e:
            _log_file_event(
                logging.WARNING,
                "paperless_document_identity_check_failed",
                "Could not read the Paperless document before deleting it",
                file_record,
                error=type(e).__name__,
            )
            return False
        return document is not None and not _file_name_matches(
            document, file_record.file_name
        )

    async def _delete_from_paperless(
        self,
        db: Session,
        file_record: EntityFile,
        current_user_id: Optional[int] = None,
    ) -> bool:
        """
        Delete file from paperless-ngx storage and verify deletion.

        Args:
            db: Database session
            file_record: EntityFile record
            current_user_id: User ID for paperless service

        Returns:
            True if successfully deleted and verified, False otherwise
        """
        if not file_record.paperless_document_id:
            logger.warning(
                f"File {file_record.id} marked as paperless but has no document ID"
            )
            return False

        # Get user preferences to create paperless service
        if not current_user_id:
            logger.warning(
                "Cannot delete from paperless: no user ID provided for authentication"
            )
            return False

        user_prefs = (
            db.query(UserPreferences)
            .filter(UserPreferences.user_id == current_user_id)
            .first()
        )

        if not user_prefs or not user_prefs.paperless_enabled:
            logger.warning(
                f"Paperless deletion skipped: user preferences not found or disabled for user {current_user_id}"
            )
            return False

        try:
            logger.info(
                f"Starting deletion process for document {file_record.paperless_document_id} for user {current_user_id}"
            )

            # Create paperless client using new simplified architecture
            logger.debug("Creating paperless client...")
            async with await self._create_paperless_client(
                user_prefs, current_user_id
            ) as paperless_client:
                logger.info(
                    "Paperless client created successfully, attempting deletion"
                )

                # Delete from paperless - the new client handles errors internally
                logger.info(
                    f"Calling paperless_client.delete_document for document {file_record.paperless_document_id}"
                )
                success = await paperless_client.delete_document(
                    file_record.paperless_document_id
                )

                logger.info(f"Paperless client delete_document returned: {success}")

                if success:
                    logger.info(
                        f"File successfully deleted from paperless: document_id={file_record.paperless_document_id}"
                    )
                    return True
                logger.error(
                    f"Paperless client reported deletion failed for document {file_record.paperless_document_id}"
                )
                return False

        except (PaperlessClientError, NewPaperlessConnectionError) as e:
            logger.error(
                f"Paperless client error during deletion: {type(e).__name__}: {str(e)}"
            )
            import traceback

            logger.error(f"Exception traceback: {traceback.format_exc()}")
            return False
        except Exception as e:
            logger.error(
                f"Unexpected error during paperless deletion: {type(e).__name__}: {str(e)}"
            )
            import traceback

            logger.error(f"Exception traceback: {traceback.format_exc()}")
            return False

    async def _get_paperless_download_info(
        self,
        db: Session,
        file_record: EntityFile,
        current_user_id: Optional[int] = None,
    ) -> Tuple[bytes, str, str]:
        """
        Get file download info from paperless-ngx storage.

        Args:
            db: Database session
            file_record: EntityFile record
            current_user_id: ID of the current user for paperless access

        Returns:
            Tuple of (file_content_bytes, filename, content_type)
        """
        if not file_record.paperless_document_id:
            raise HTTPException(
                status_code=404,
                detail=f"Paperless document ID not found for file: {file_record.file_name}",
            )

        # Convert document ID to int once to avoid redundant casting
        document_id = int(file_record.paperless_document_id)

        # Get user preferences to create paperless service
        if not current_user_id:
            raise HTTPException(
                status_code=401,
                detail="User authentication required for paperless file download",
            )

        user_prefs = (
            db.query(UserPreferences)
            .filter(UserPreferences.user_id == current_user_id)
            .first()
        )

        if not user_prefs or not user_prefs.paperless_enabled:
            raise HTTPException(
                status_code=400,
                detail="Cannot download from paperless: user preferences not found or disabled",
            )

        try:
            # Log authentication details for debugging
            logger.debug(
                f"Download debug - User: {current_user_id}, URL: {user_prefs.paperless_url}"
            )
            logger.debug(
                f"Download debug - Has token: {bool(user_prefs.paperless_api_token_encrypted)}"
            )
            logger.debug(
                f"Download debug - Has username: {bool(user_prefs.paperless_username_encrypted)}"
            )
            logger.debug(
                f"Download debug - Has password: {bool(user_prefs.paperless_password_encrypted)}"
            )
            logger.debug(f"Download debug - Document ID: {document_id}")

            # Create paperless client using new simplified architecture
            async with await self._create_paperless_client(
                user_prefs, current_user_id
            ) as paperless_client:
                logger.debug("Paperless client created successfully")

                # Download from paperless
                logger.debug(f"Starting download for document ID: {document_id}")
                file_content = await paperless_client.download_document(document_id)
            logger.debug(
                f"Download completed, content size: {len(file_content) if file_content else 0}"
            )

            logger.info(
                f"File downloaded from paperless: document_id={document_id}, size={len(file_content)}"
            )

            return (
                file_content,
                file_record.file_name,
                file_record.file_type or "application/octet-stream",
            )

        except Exception as e:
            logger.error(f"Failed to download file from paperless: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="Failed to download file from paperless",
            )

    async def _handle_orphaned_paperless_records(
        self,
        db: Session,
        current_user_id: int,
        access: Optional[RemoteStorageAccess] = None,
    ) -> None:
        """
        Handle orphaned Paperless records - files marked as paperless storage
        with no document ID and no Paperless task still in progress (failed or
        incomplete uploads).

        These records need special handling because they can't be checked against
        Paperless since they don't have a valid document ID to query. A record
        whose task is still pending or processing is not an orphan: its task is
        resolved later in the sync check, or by update_processing_files.

        Args:
            db: Database session
            current_user_id: User ID to check orphaned records for
        """
        try:
            logger.info(
                f"🔍 ORPHAN CHECK - Checking orphaned paperless records for user {current_user_id}"
            )

            # Find paperless files WITHOUT document IDs whose task is not still in
            # progress (orphaned records). A failed task still counts as orphaned.
            access = access or RemoteStorageAccess.for_user(db, current_user_id)
            orphaned_files = access.reachable(
                _user_entity_files(
                    db,
                    current_user_id,
                    FILE_ENTITY_SOURCES,
                    EntityFile.storage_backend == "paperless",
                    EntityFile.paperless_document_id.is_(None),  # NO document ID
                    EntityFile.sync_status
                    != "duplicate",  # A final state, not an orphan
                    or_(
                        EntityFile.paperless_task_uuid.is_(None),
                        EntityFile.sync_status.not_in(("pending", "processing")),
                    ),
                )
            )

            if orphaned_files:
                logger.warning(
                    f"🔍 ORPHAN CHECK - Found {len(orphaned_files)} orphaned paperless records for user {current_user_id}"
                )

                for file_record in orphaned_files:
                    old_status = file_record.sync_status

                    # Mark as 'missing' since these files aren't accessible in Paperless
                    file_record.sync_status = "missing"
                    file_record.last_sync_at = get_utc_now()

                    logger.warning(
                        f"ORPHANED RECORD: {file_record.file_name} "
                        f"(id: {file_record.id}, entity_type: {file_record.entity_type}, "
                        f"status: {old_status} -> missing) - no document ID and no task in progress"
                    )

                # Commit the changes
                db.commit()
                logger.info(
                    f"🔍 ORPHAN CHECK - Updated {len(orphaned_files)} orphaned records to 'missing' status"
                )
            else:
                logger.info(
                    f"🔍 ORPHAN CHECK - No orphaned paperless records found for user {current_user_id}"
                )

        except Exception as e:
            logger.error(
                f"Error handling orphaned paperless records for user {current_user_id}: {str(e)}"
            )
            db.rollback()
            # Don't raise - this shouldn't stop the main sync check

    async def check_paperless_sync_status(
        self, db: Session, current_user_id: int
    ) -> Dict[int, bool]:
        """
        Check sync status for all Paperless documents for a user.
        This is the core function that verifies if documents deleted from Paperless
        are properly detected and marked as missing.

        Args:
            db: Database session
            current_user_id: User ID to check documents for

        Returns:
            Dictionary mapping file_id to existence status (True = exists, False = missing)
        """
        logger.error(
            f"🔍 SYNC SERVICE - check_paperless_sync_status called for user {current_user_id}"
        )

        # First, check for orphaned records (no document ID)
        # Another user's upload is only in their Paperless, unless they use this one
        access = RemoteStorageAccess.for_user(db, current_user_id)
        await self._handle_orphaned_paperless_records(db, current_user_id, access)

        try:
            # First, let's see what entity types actually exist for paperless files
            all_paperless_files = (
                db.query(EntityFile)
                .filter(
                    EntityFile.storage_backend == "paperless",
                    EntityFile.paperless_document_id.isnot(None),
                )
                .all()
            )

            logger.debug(f"Total paperless files in system: {len(all_paperless_files)}")
            for f in all_paperless_files:
                logger.debug(
                    f"File {f.id}: entity_type='{f.entity_type}', entity_id={f.entity_id}, document_id={f.paperless_document_id}"
                )

            paperless_files = access.reachable(
                _user_entity_files(
                    db,
                    current_user_id,
                    FILE_ENTITY_SOURCES,
                    EntityFile.storage_backend == "paperless",
                )
            )
            logger.info(
                f"Found {len(paperless_files)} paperless files for user {current_user_id}"
            )

            if not paperless_files:
                logger.info(
                    f"No Paperless files found for sync check (user: {current_user_id})"
                )
                return {}

            # Get user's paperless configuration
            user_prefs = (
                db.query(UserPreferences)
                .filter(UserPreferences.user_id == current_user_id)
                .first()
            )

            if not user_prefs or not user_prefs.paperless_enabled:
                logger.warning(
                    f"Cannot check paperless sync: user preferences not found or disabled (user: {current_user_id})"
                )
                return {}

            # Check if credentials exist (either token or username/password)
            has_auth = has_usable_credentials(user_prefs)
            if not user_prefs.paperless_url or not has_auth:
                logger.warning(
                    f"Cannot check paperless sync: incomplete paperless configuration (user: {current_user_id})"
                )
                return {}

            # Create paperless service using SAME auth method as upload for consistency
            # This ensures sync check uses the exact same authentication as file uploads,
            # preventing false missing document detection due to auth differences
            from app.services.paperless_service import create_paperless_service

            logger.info(
                f"Creating paperless service for sync check using consistent auth method for user {current_user_id}"
            )

            paperless_service = create_paperless_service(
                user_prefs.paperless_url,
                **credential_kwargs(user_prefs),
                user_id=current_user_id,
            )

            sync_status = {}
            missing_count = 0
            error_count = 0
            processing_count = 0

            logger.info(
                f"Starting sync check for {len(paperless_files)} Paperless documents (user: {current_user_id})"
            )
            logger.info(
                f"Sync check using auth method: {paperless_service.get_auth_type()}"
            )

            # First pass: resolve any task UUIDs to document IDs if possible
            await self._resolve_task_uuids_to_document_ids(
                db, paperless_service, paperless_files
            )

            # Check each document
            async with paperless_service:
                for file_record in paperless_files:
                    try:
                        document_id = file_record.paperless_document_id

                        # Skip files that don't have a valid document ID
                        if not document_id:
                            # If file has task UUID and is marked as missing, try fallback search
                            if (
                                file_record.sync_status == "missing"
                                and file_record.paperless_task_uuid
                            ):
                                logger.info(
                                    f"🔍 SYNC CHECK - File {file_record.file_name} (id: {file_record.id}) marked as missing but has task UUID - attempting fallback search"
                                )

                                # Try fallback search for document by filename and upload timestamp
                                fallback_doc_id = await self._link_document_found_by_filename_and_time(
                                    file_record, paperless_service
                                )

                                if fallback_doc_id:
                                    sync_status[file_record.id] = True  # Mark as found
                                    logger.info(
                                        f"🔍 SYNC CHECK - Fallback search found document ID {fallback_doc_id} for file {file_record.file_name}"
                                    )
                                    # Continue with document existence check now that we have an ID
                                    document_id = fallback_doc_id
                                else:
                                    # Fallback failed - keep as missing
                                    logger.error(
                                        f"🔍 SYNC CHECK - Fallback search failed for file {file_record.file_name}"
                                    )
                                    sync_status[file_record.id] = (
                                        False  # Mark as missing in sync status
                                    )
                                    missing_count += 1
                                    continue
                            elif file_record.sync_status == "missing":
                                # If orphan detection already marked this as missing and no task UUID, don't change it
                                logger.info(
                                    f"🔍 SYNC CHECK - File {file_record.file_name} (id: {file_record.id}) already marked as missing (orphaned record)"
                                )
                                sync_status[file_record.id] = (
                                    False  # Mark as missing in sync status
                                )
                                missing_count += 1
                                continue
                            elif file_record.sync_status == "duplicate":
                                # Paperless kept the earlier upload; nothing more to find
                                sync_status[file_record.id] = True
                                continue
                            else:
                                # Mark as processing if not already marked as missing
                                logger.info(
                                    f"🔍 SYNC CHECK - Skipping file {file_record.file_name} (id: {file_record.id}) - no document ID yet (likely still processing)"
                                )
                                if file_record.sync_status != "processing":
                                    file_record.sync_status = "processing"
                                    file_record.last_sync_at = get_utc_now()
                                    processing_count += 1
                                sync_status[file_record.id] = (
                                    True  # Don't mark as missing if still processing
                                )
                                continue

                        # Only skip if we have an active task UUID (indicating still processing)
                        # Don't skip based on document ID format alone - document IDs can be UUIDs too
                        if file_record.paperless_task_uuid:
                            logger.info(
                                f"🔍 SYNC CHECK - Skipping file {file_record.file_name} (id: {file_record.id}) - has active task UUID {file_record.paperless_task_uuid}, still processing"
                            )
                            if file_record.sync_status != "processing":
                                file_record.sync_status = "processing"
                                file_record.last_sync_at = get_utc_now()
                                processing_count += 1
                            sync_status[file_record.id] = (
                                True  # Don't mark as missing if still processing
                            )
                            continue

                        # Log what we're checking
                        logger.info(
                            f"🔍 SYNC CHECK - Checking document {document_id} for file {file_record.file_name} (id: {file_record.id})"
                        )

                        # Check if document exists in Paperless
                        exists = await paperless_service.check_document_exists(
                            document_id
                        )
                        logger.info(
                            f"🔍 SYNC CHECK - Document {document_id} exists: {exists}"
                        )

                        # Add detailed logging when marking documents as missing
                        if not exists:
                            logger.warning(
                                f"🚨 SYNC CHECK - Document {document_id} (file: {file_record.file_name}, ID: {file_record.id}) will be marked as MISSING. "
                                f"This could be due to: 1) Document deleted from Paperless, 2) Authentication/permission issues, 3) Invalid document ID. "
                                f"Current sync_status: {file_record.sync_status}"
                            )

                        sync_status[file_record.id] = exists

                        # Debug: Log what we're about to do
                        logger.info(
                            f"🔍 SYNC CHECK DEBUG - About to update status for document {document_id}: exists={exists}, current_status={file_record.sync_status}"
                        )

                        # Update sync status in database based on result
                        if not exists:
                            old_status = file_record.sync_status
                            logger.info(
                                f"🔍 SYNC CHECK DEBUG - Before update: file_record.sync_status = {file_record.sync_status}"
                            )

                            file_record.sync_status = "missing"
                            file_record.last_sync_at = get_utc_now()
                            missing_count += 1

                            logger.info(
                                f"🔍 SYNC CHECK DEBUG - After update: file_record.sync_status = {file_record.sync_status}"
                            )
                            logger.info(
                                f"Document marked as MISSING: {file_record.file_name} "
                                f"(id: {file_record.id}, document_id: {document_id}, "
                                f"old_status: {old_status} -> missing)"
                            )
                        else:
                            # Document exists - update status appropriately
                            old_status = file_record.sync_status

                            # If it was previously missing or in error, mark as synced
                            if old_status in ["missing", "error", "processing"]:
                                file_record.sync_status = "synced"
                                file_record.last_sync_at = get_utc_now()
                                logger.info(
                                    f"Document status recovered: {file_record.file_name} "
                                    f"(id: {file_record.id}, {old_status} -> synced)"
                                )
                            elif old_status == "synced":
                                # Already synced, just update timestamp
                                file_record.last_sync_at = get_utc_now()
                            else:
                                # Processing status - keep as is but update timestamp
                                file_record.last_sync_at = get_utc_now()
                                if old_status == "processing":
                                    processing_count += 1

                    except PaperlessAuthenticationError as auth_error:
                        # Authentication errors should stop the entire sync check
                        logger.error(
                            f"Authentication error during sync check: {str(auth_error)}"
                        )
                        raise auth_error

                    except PaperlessError as paperless_error:
                        # Handle specific paperless errors (e.g., connection issues)
                        error_count += 1
                        old_status = file_record.sync_status

                        logger.warning(
                            f"Paperless error checking document {file_record.paperless_document_id} "
                            f"for file {file_record.file_name}: {str(paperless_error)}"
                        )

                        # For connection/network errors, don't mark as missing - mark as error
                        sync_status[file_record.id] = (
                            None  # Indicates error, not missing
                        )
                        file_record.sync_status = "error"
                        file_record.last_sync_at = get_utc_now()

                        logger.warning(
                            f"Document marked as ERROR: {file_record.file_name} "
                            f"(id: {file_record.id}, {old_status} -> error)"
                        )

                    except Exception as e:
                        # Unexpected errors
                        error_count += 1
                        old_status = file_record.sync_status

                        logger.error(
                            f"🚨 SYNC CHECK EXCEPTION - Unexpected error checking document {file_record.paperless_document_id} "
                            f"for file {file_record.file_name}: {str(e)}"
                        )
                        logger.error(
                            f"🚨 SYNC CHECK EXCEPTION - Exception type: {type(e)}"
                        )
                        import traceback

                        logger.error(
                            f"🚨 SYNC CHECK EXCEPTION - Traceback: {traceback.format_exc()}"
                        )

                        sync_status[file_record.id] = (
                            None  # Indicates error, not missing
                        )
                        file_record.sync_status = "error"
                        file_record.last_sync_at = get_utc_now()

                        logger.warning(
                            f"Document marked as ERROR: {file_record.file_name} "
                            f"(id: {file_record.id}, {old_status} -> error)"
                        )

            # Commit all database updates
            try:
                logger.info(
                    f"🔍 SYNC CHECK DEBUG - About to commit database changes. Missing count: {missing_count}"
                )
                db.commit()
                logger.info(
                    f"🔍 SYNC CHECK - Successfully committed database changes. Missing count: {missing_count}"
                )
            except Exception as commit_error:
                logger.error(
                    f"🚨 SYNC CHECK COMMIT ERROR - Failed to commit sync status updates: {str(commit_error)}"
                )
                import traceback

                logger.error(
                    f"🚨 SYNC CHECK COMMIT ERROR - Traceback: {traceback.format_exc()}"
                )
                db.rollback()
                # Return empty dict to indicate failure
                return {}

            # Log summary of sync check results
            synced_count = (
                len(paperless_files) - missing_count - error_count - processing_count
            )
            logger.info(
                f"Paperless sync check completed (user: {current_user_id}): "
                f"{len(paperless_files)} total, {synced_count} synced, "
                f"{missing_count} missing, {processing_count} processing, {error_count} errors"
            )

            # Log missing files for debugging
            if missing_count > 0:
                missing_files = [
                    f for f in paperless_files if sync_status.get(f.id) is False
                ]
                logger.warning(
                    f"Missing documents detected: {[f.file_name for f in missing_files]}"
                )

            # Log error files for debugging
            if error_count > 0:
                error_files = [
                    f for f in paperless_files if sync_status.get(f.id) is None
                ]
                logger.warning(
                    f"Documents with errors during sync check: {[f.file_name for f in error_files]}"
                )

            return sync_status

        except Exception as e:
            logger.error(f"Error checking paperless sync status: {str(e)}")
            # Return empty dict to indicate complete failure
            return {}

    async def check_papra_sync_status(
        self, db: Session, current_user_id: int
    ) -> Dict[int, Optional[bool]]:
        """
        Check sync status for all Papra documents belonging to the current user.
        Verifies if documents still exist on the Papra server.

        Args:
            db: Database session
            current_user_id: User ID to check documents for

        Returns:
            Dictionary mapping file_id to existence status
            (True = exists, False = missing, None = error)
        """
        try:
            from app.services.papra_client import create_papra_client

            papra_files = RemoteStorageAccess.for_user(db, current_user_id).reachable(
                _user_entity_files(
                    db,
                    current_user_id,
                    FILE_ENTITY_SOURCES,
                    EntityFile.storage_backend == "papra",
                    EntityFile.papra_document_id.isnot(None),
                )
            )

            if not papra_files:
                logger.info(
                    f"No Papra files found for sync check (user: {current_user_id})"
                )
                return {}

            # Get user's Papra configuration
            user_prefs = (
                db.query(UserPreferences)
                .filter(UserPreferences.user_id == current_user_id)
                .first()
            )

            if not user_prefs or not user_prefs.papra_enabled:
                logger.warning(
                    f"Cannot check Papra sync: not enabled (user: {current_user_id})"
                )
                return {}

            if not user_prefs.papra_url or not user_prefs.papra_api_token_encrypted:
                logger.warning(
                    f"Cannot check Papra sync: incomplete config (user: {current_user_id})"
                )
                return {}

            sync_status = {}
            missing_count = 0

            logger.info(
                f"Starting Papra sync check for {len(papra_files)} documents (user: {current_user_id})"
            )

            # Each file is read in its own organisation, as download and delete do
            files_by_organization: Dict[Optional[str], List[EntityFile]] = defaultdict(
                list
            )
            for file_record in papra_files:
                files_by_organization[
                    effective_papra_organization(
                        file_record.papra_organization_id,
                        user_prefs.papra_organization_id,
                    )
                ].append(file_record)

            for organization_id, org_files in files_by_organization.items():
                papra_client = create_papra_client(
                    url=user_prefs.papra_url,
                    encrypted_token=user_prefs.papra_api_token_encrypted,
                    organization_id=organization_id,
                    user_id=current_user_id,
                )
                async with papra_client:
                    for file_record in org_files:
                        try:
                            doc_id = file_record.papra_document_id

                            doc_info = await papra_client.get_document_info(doc_id)
                            exists = doc_info is not None

                            sync_status[file_record.id] = exists

                            if not exists:
                                old_status = file_record.sync_status
                                file_record.sync_status = "missing"
                                file_record.last_sync_at = get_utc_now()
                                missing_count += 1
                                logger.warning(
                                    f"Papra document missing: {file_record.file_name} "
                                    f"(id: {file_record.id}, doc_id: {doc_id}, {old_status} -> missing)"
                                )
                            else:
                                if file_record.sync_status in ["missing", "error"]:
                                    file_record.sync_status = "synced"
                                file_record.last_sync_at = get_utc_now()

                        except Exception as e:
                            logger.error(
                                f"Error checking Papra document {file_record.papra_document_id}: {str(e)}"
                            )
                            sync_status[file_record.id] = None
                            file_record.sync_status = "error"
                            file_record.last_sync_at = get_utc_now()

            db.commit()

            synced_count = len(papra_files) - missing_count
            logger.info(
                f"Papra sync check completed (user: {current_user_id}): "
                f"{len(papra_files)} total, {synced_count} synced, {missing_count} missing"
            )

            return sync_status

        except Exception as e:
            logger.error(f"Error checking Papra sync status: {str(e)}")
            return {}

    async def _resolve_task_uuids_to_document_ids(
        self, db: Session, paperless_service, paperless_files: List
    ) -> None:
        """
        Helper method to resolve task UUIDs to document IDs for files that have completed processing.

        Args:
            db: Database session
            paperless_service: Paperless service instance
            paperless_files: List of EntityFile records with paperless storage
        """
        try:
            # Find files that have active task UUIDs (in the paperless_task_uuid field)
            files_with_tasks = [f for f in paperless_files if f.paperless_task_uuid]

            if not files_with_tasks:
                logger.info("No task UUIDs found to resolve during sync check")
                return

            logger.info(
                f"Found {len(files_with_tasks)} files with task UUIDs to resolve during sync check"
            )

            # Records whose task Paperless no longer knows (for example, after its
            # task history was cleared). The task can't say which document it
            # made, so these are looked up by file name and upload time below.
            unknown_task_files = []
            tasks_forbidden = False

            def defer_to_lookup(record):
                # A record already marked missing gets the same search later in the sync check
                if record.sync_status != "missing":
                    unknown_task_files.append(record)

            for file_record in files_with_tasks:
                try:
                    task_uuid = file_record.paperless_task_uuid
                    if tasks_forbidden:
                        defer_to_lookup(file_record)
                        continue
                    _log_file_event(
                        logging.INFO,
                        "paperless_task_resolution_started",
                        "Resolving Paperless task",
                        file_record,
                        task_uuid=task_uuid,
                    )

                    # Check task status to get document ID
                    async with paperless_service._make_request(
                        "GET", f"/api/tasks/?task_id={task_uuid}"
                    ) as response:
                        if response.status == 200:
                            task_data = extract_task(await response.json(), task_uuid)

                            if task_data is None:
                                logger.info(
                                    f"Task {task_uuid} not found in API response"
                                )
                                defer_to_lookup(file_record)
                                continue

                            parsed = parse_task(task_data)

                            if parsed.is_success:
                                document_id = parsed.document_id

                                # Use centralized validation and fallback logic
                                validated_doc_id = (
                                    await self._validate_and_process_document_id(
                                        document_id, file_record, paperless_service
                                    )
                                )

                                if validated_doc_id:
                                    # Successfully validated or found via fallback
                                    file_record.paperless_document_id = validated_doc_id
                                    file_record.paperless_task_uuid = (
                                        None  # Clear task UUID
                                    )
                                    file_record.sync_status = "synced"
                                    file_record.last_sync_at = get_utc_now()
                                    _log_file_event(
                                        logging.INFO,
                                        "paperless_task_resolved",
                                        f"Paperless task resolved to document {validated_doc_id}",
                                        file_record,
                                        task_uuid=task_uuid,
                                    )
                                else:
                                    # Validation and fallback both failed
                                    file_record.sync_status = "failed"
                                    file_record.last_sync_at = get_utc_now()
                                    _log_file_event(
                                        logging.ERROR,
                                        "paperless_task_document_not_found",
                                        "Paperless task succeeded but no document could be linked",
                                        file_record,
                                        task_uuid=task_uuid,
                                    )

                            elif parsed.is_failure:
                                # Task failed - mark as failed
                                error_info = parsed.error_message or "Unknown error"
                                file_record.sync_status = "failed"
                                file_record.last_sync_at = get_utc_now()
                                _log_file_event(
                                    logging.WARNING,
                                    "paperless_task_failed",
                                    "Paperless task failed",
                                    file_record,
                                    task_uuid=task_uuid,
                                    error=error_info,
                                )

                            # If task is still pending/processing, leave as-is

                        elif response.status == 403:
                            # The account cannot read tasks; same lookup as an unknown task
                            tasks_forbidden = True
                            log_task_permission_denied(paperless_service.user_id)
                            defer_to_lookup(file_record)

                except Exception as task_error:
                    _log_file_event(
                        logging.ERROR,
                        "paperless_task_resolution_error",
                        "Error resolving Paperless task",
                        file_record,
                        task_uuid=file_record.paperless_task_uuid,
                        error=str(task_error),
                    )
                    continue

            for file_record in unknown_task_files:
                linked_id = await self._link_document_found_by_filename_and_time(
                    file_record, paperless_service
                )
                if linked_id:
                    logger.info(
                        f"Linked file {file_record.id} to Paperless document {linked_id} "
                        "found by file name and upload time (task not found or not readable)"
                    )
                else:
                    logger.info(
                        f"No Paperless document found by file name and upload time "
                        f"for file {file_record.id} (task not found or not readable)"
                    )

            # Commit any document ID updates
            try:
                db.commit()
                logger.info("Committed task UUID to document ID resolutions")
            except Exception as commit_error:
                logger.error(
                    f"Failed to commit task UUID resolutions: {str(commit_error)}"
                )
                db.rollback()

        except Exception as e:
            logger.error(f"Error in _resolve_task_uuids_to_document_ids: {str(e)}")
            # Don't re-raise - this is a best-effort operation

    async def update_processing_files(
        self, db: Session, current_user_id: int
    ) -> Dict[str, str]:
        """
        Resolve the Paperless tasks of the user's processing uploads.

        Only the user's own uploads, plus uploads with no recorded uploader, on
        patients the user can edit are checked, through the user's own Paperless.

        Returns:
            Dictionary mapping file_id to new status
        """
        try:
            user_prefs = (
                db.query(UserPreferences)
                .filter(UserPreferences.user_id == current_user_id)
                .first()
            )

            if not user_prefs or not user_prefs.paperless_enabled:
                logger.debug(
                    "Skipping processing files: Paperless is not enabled",
                    extra={
                        LogFields.CATEGORY: "app",
                        LogFields.EVENT: "paperless_processing_poll_skipped",
                        LogFields.USER_ID: current_user_id,
                    },
                )
                return {}

            processing_files = _editable_entity_files(
                db,
                current_user_id,
                FILE_ENTITY_SOURCES,
                EntityFile.storage_backend == "paperless",
                EntityFile.sync_status == "processing",
                EntityFile.paperless_task_uuid.isnot(None),
                resolvable_uploads(db, current_user_id),
            )

            if not processing_files:
                logger.info(f"No processing files found for user {current_user_id}")
                return {}

            # Create paperless service
            paperless_service = create_paperless_service(
                user_prefs.paperless_url,
                **credential_kwargs(user_prefs),
                user_id=current_user_id,
            )

            status_updates = {}

            logger.info(
                f"Checking {len(processing_files)} processing files for task completion"
            )

            # Set on the first 403: the same account will be refused for every task
            tasks_forbidden = False

            # Check each processing file
            async with paperless_service:
                for file_record in processing_files:
                    try:
                        task_uuid = file_record.paperless_task_uuid

                        if not task_uuid:
                            logger.warning(
                                f"File {file_record.id} has processing status but no task UUID"
                            )
                            continue

                        if tasks_forbidden:
                            status_updates[str(file_record.id)] = (
                                await self._resolve_without_task(
                                    file_record, paperless_service
                                )
                            )
                            continue

                        # Check task status directly using the endpoint logic
                        try:
                            # Use the session to make direct API call to check task status
                            async with paperless_service._make_request(
                                "GET", f"/api/tasks/?task_id={task_uuid}"
                            ) as response:
                                if response.status == 200:
                                    task_data = extract_task(
                                        await response.json(), task_uuid
                                    )

                                    if task_data is None:
                                        logger.warning(
                                            f"No task found with UUID {task_uuid}"
                                        )
                                        continue

                                    parsed = parse_task(task_data)

                                    logger.debug(
                                        f"Task {task_uuid} status: {parsed.status}"
                                    )

                                    if parsed.is_success:
                                        document_id = parsed.document_id

                                        # Use centralized validation and fallback logic
                                        validated_doc_id = await self._validate_and_process_document_id(
                                            document_id, file_record, paperless_service
                                        )

                                        if validated_doc_id:
                                            # Successfully validated or found via fallback
                                            file_record.paperless_document_id = (
                                                validated_doc_id
                                            )
                                            file_record.paperless_task_uuid = None  # Clear task UUID since it's complete
                                            file_record.sync_status = "synced"
                                            file_record.last_sync_at = get_utc_now()
                                            status_updates[str(file_record.id)] = (
                                                "synced"
                                            )

                                            _log_file_event(
                                                logging.INFO,
                                                "paperless_task_resolved",
                                                f"Paperless task resolved to document {validated_doc_id}",
                                                file_record,
                                                task_uuid=task_uuid,
                                            )
                                        else:
                                            # Validation and fallback both failed - might be a duplicate or invalid
                                            _mark_duplicate(file_record)
                                            status_updates[str(file_record.id)] = (
                                                "duplicate"
                                            )

                                            _log_file_event(
                                                logging.INFO,
                                                "paperless_task_document_not_found",
                                                "Paperless task succeeded but no document could be linked; likely a duplicate",
                                                file_record,
                                                task_uuid=task_uuid,
                                            )

                                    elif parsed.is_failure:
                                        error_info = (
                                            parsed.error_message or "Unknown error"
                                        )
                                        is_duplicate = parsed.is_duplicate

                                        # Update record accordingly
                                        file_record.paperless_task_uuid = (
                                            None  # Clear task UUID
                                        )
                                        if is_duplicate:
                                            file_record.sync_status = "duplicate"
                                            status_updates[str(file_record.id)] = (
                                                "duplicate"
                                            )
                                            _log_file_event(
                                                logging.INFO,
                                                "paperless_task_duplicate",
                                                "Paperless rejected the upload as a duplicate",
                                                file_record,
                                                task_uuid=task_uuid,
                                                error=error_info,
                                            )
                                        else:
                                            file_record.sync_status = "failed"
                                            status_updates[str(file_record.id)] = (
                                                "failed"
                                            )
                                            _log_file_event(
                                                logging.ERROR,
                                                "paperless_task_failed",
                                                "Paperless task failed",
                                                file_record,
                                                task_uuid=task_uuid,
                                                error=error_info,
                                            )

                                        file_record.last_sync_at = get_utc_now()

                                    elif parsed.is_in_progress:
                                        # Task still in progress - keep as processing
                                        status_updates[str(file_record.id)] = (
                                            "processing"
                                        )
                                        _log_file_event(
                                            logging.DEBUG,
                                            "paperless_task_in_progress",
                                            "Paperless task still processing",
                                            file_record,
                                            task_uuid=task_uuid,
                                        )

                                    else:
                                        logger.warning(
                                            f"Unknown task status: {parsed.status} for task {task_uuid}"
                                        )
                                        status_updates[str(file_record.id)] = (
                                            "processing"  # Keep checking
                                        )
                                elif response.status == 403:
                                    tasks_forbidden = True
                                    log_task_permission_denied(current_user_id)
                                    status_updates[str(file_record.id)] = (
                                        await self._resolve_without_task(
                                            file_record, paperless_service
                                        )
                                    )
                                else:
                                    logger.warning(
                                        f"Failed to check task status: HTTP {response.status}"
                                    )
                                    status_updates[str(file_record.id)] = (
                                        "processing"  # Keep trying
                                    )

                        except Exception as task_check_error:
                            logger.error(
                                f"Error checking task {task_uuid} status: {str(task_check_error)}"
                            )
                            # Don't immediately mark as failed - might be a temporary network issue
                            status_updates[str(file_record.id)] = "processing"

                    except Exception as e:
                        logger.error(
                            f"Error processing file {file_record.id} with task {file_record.paperless_task_uuid}: {str(e)}"
                        )
                        # Only mark as failed if we can't process the file record itself
                        file_record.sync_status = "failed"
                        file_record.last_sync_at = get_utc_now()
                        status_updates[str(file_record.id)] = "failed"

            # Commit all database updates
            db.commit()

            # Log summary
            status_counts = {}
            for status in status_updates.values():
                status_counts[status] = status_counts.get(status, 0) + 1

            logger.info(
                f"Updated {len(status_updates)} processing files for user {current_user_id}: {status_counts}"
            )
            return status_updates

        except Exception as e:
            logger.error(f"Error updating processing files: {str(e)}")
            return {}

    async def _validate_and_process_document_id(
        self, document_id, file_record, paperless_service
    ) -> Optional[str]:
        """
        Validate document ID and handle fallback logic for invalid IDs.

        Args:
            document_id: Document ID to validate (can be string, int, or None)
            file_record: Database record for the file
            paperless_service: Paperless service instance for fallback search

        Returns:
            Valid document ID as string, or None if invalid and fallback failed
        """
        if document_id and str(document_id).lower() not in [
            "unknown",
            "none",
            "null",
            "",
        ]:
            try:
                doc_id_int = int(document_id)
                if doc_id_int > 0:
                    return str(doc_id_int)
            except (ValueError, TypeError):
                pass
            _log_file_event(
                logging.WARNING,
                "paperless_task_document_id_invalid",
                "Paperless task returned an invalid document ID",
                file_record,
            )

        _log_file_event(
            logging.INFO,
            "paperless_document_fallback_search_started",
            "Looking up Paperless document by file name and upload time",
            file_record,
        )

        try:
            fallback_doc_id = await self._search_document_by_filename_and_time(
                file_record.file_name, file_record.uploaded_at, paperless_service
            )
            if fallback_doc_id:
                _log_file_event(
                    logging.INFO,
                    "paperless_document_fallback_search_found",
                    f"Fallback search found Paperless document {fallback_doc_id}",
                    file_record,
                )
                return str(fallback_doc_id)
            _log_file_event(
                logging.WARNING,
                "paperless_document_fallback_search_empty",
                "Fallback search found no Paperless document",
                file_record,
            )
            return None

        except Exception as e:
            _log_file_event(
                logging.ERROR,
                "paperless_document_fallback_search_failed",
                "Fallback search for Paperless document failed",
                file_record,
                error=str(e),
            )
            return None

    async def _resolve_without_task(self, file_record, paperless_service) -> str:
        """Link a processing upload whose task cannot be read; returns its new status. The caller commits."""
        _log_file_event(
            logging.DEBUG,
            "paperless_document_lookup_without_task",
            "Looking the document up by file name and upload time",
            file_record,
            task_uuid=file_record.paperless_task_uuid,
        )
        await self._link_document_found_by_filename_and_time(
            file_record, paperless_service
        )
        return file_record.sync_status

    async def _link_document_found_by_filename_and_time(
        self, file_record: EntityFile, paperless_service
    ) -> Optional[str]:
        """
        Find a record's Paperless document by file name and upload time and, if
        found, link the record to it: store the document ID, clear the task UUID
        and mark the record synced. The caller commits.

        Returns:
            The linked document ID, or None if nothing was linked. When the match is
            already another record's document, the record is marked duplicate instead.
        """
        document_id = await self._search_document_by_filename_and_time(
            file_record.file_name, file_record.uploaded_at, paperless_service
        )
        if not document_id:
            return None

        # Paperless rejects a re-upload of the same file; the match is the earlier upload's document
        if _document_linked_elsewhere(file_record, str(document_id)):
            _mark_duplicate(file_record)
            return None

        file_record.paperless_document_id = str(document_id)
        file_record.paperless_task_uuid = None
        file_record.sync_status = "synced"
        file_record.last_sync_at = get_utc_now()
        return file_record.paperless_document_id

    async def _search_document_by_filename_and_time(
        self, filename: str, upload_time, paperless_service
    ) -> Optional[int]:
        """
        Fallback method to search for a document by filename and upload timestamp.
        Used when the task gives no usable document ID or cannot be read.

        Args:
            filename: Original filename to search for
            upload_time: When file was uploaded (datetime)
            paperless_service: Paperless service instance for API calls

        Returns:
            Document ID if found, None otherwise
        """
        try:
            # Convert upload_time to datetime if needed
            if isinstance(upload_time, str):
                upload_time = datetime.fromisoformat(upload_time.replace("Z", "+00:00"))
            upload_time = _as_naive_utc(upload_time)

            # Search window: 30 minutes before and after upload time
            search_start = upload_time - timedelta(minutes=30)
            search_end = upload_time + timedelta(minutes=30)

            logger.info(
                f"Searching for document by file name uploaded between {search_start} and {search_end}",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "paperless_document_search_started",
                },
            )

            # Call the async search method directly
            result = await self._async_search_document(
                filename, search_start, search_end, paperless_service
            )
            return result

        except Exception as e:
            logger.error(
                "Error in fallback document search",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "paperless_document_search_failed",
                    LogFields.ERROR: str(e),
                },
            )
            return None

    async def _async_search_document(
        self, filename: str, search_start, search_end, paperless_service
    ) -> Optional[int]:
        """
        Async helper to search for document by filename and time range.
        """
        try:
            title_search = {
                "query": _build_title_fallback_query(Path(filename).stem),
                "page_size": _DOCUMENT_SEARCH_PAGE_SIZE,
            }
            # Paperless compares __date in its own time zone; _added_within does the exact check
            recent_documents = {
                "added__date__gte": (search_start - timedelta(days=1)).strftime(
                    "%Y-%m-%d"
                ),
                "added__date__lte": (search_end + timedelta(days=1)).strftime(
                    "%Y-%m-%d"
                ),
                "ordering": "-added",
                "page_size": _DOCUMENT_SEARCH_PAGE_SIZE,
            }

            for params in (title_search, recent_documents):
                for page in range(1, _DOCUMENT_SEARCH_MAX_PAGES + 1):
                    async with paperless_service._make_request(
                        "GET", f"/api/documents/?{urlencode({**params, 'page': page})}"
                    ) as response:
                        if response.status != 200:
                            break
                        data = await response.json()
                    for doc in data.get("results", []):
                        if _file_name_matches(doc, filename) and _added_within(
                            doc, search_start, search_end
                        ):
                            logger.info(
                                f"Found matching document ID {doc.get('id')} by file name, added at {doc.get('added')}",
                                extra={
                                    LogFields.CATEGORY: "app",
                                    LogFields.EVENT: "paperless_document_search_matched",
                                },
                            )
                            return doc.get("id")
                    if not data.get("next"):
                        break

            logger.warning(
                f"No document found by file name in time range {search_start} to {search_end}",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "paperless_document_search_empty",
                },
            )
            return None

        except Exception as e:
            logger.error(
                "Error in async document search",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "paperless_document_search_failed",
                    LogFields.ERROR: str(e),
                },
            )
            return None

    def cleanup_entity_files_on_deletion(
        self,
        db: Session,
        entity_type: str,
        entity_id: int,
        preserve_paperless: bool = True,
    ) -> Dict[str, int]:
        """
        Clean up EntityFiles when an entity is deleted.

        Args:
            db: Database session
            entity_type: Type of entity being deleted
            entity_id: ID of the entity being deleted
            preserve_paperless: If True, preserve Paperless documents (default: True)

        Returns:
            Dictionary with cleanup statistics
        """
        try:
            # Get all entity files for this entity
            entity_files = (
                db.query(EntityFile)
                .filter(
                    EntityFile.entity_type == entity_type,
                    EntityFile.entity_id == entity_id,
                )
                .all()
            )

            if not entity_files:
                logger.info(f"No EntityFiles found for {entity_type} {entity_id}")
                return {"files_deleted": 0, "files_preserved": 0, "errors": 0}

            stats = self.remove_entity_files(
                db,
                entity_files,
                reason=f"{entity_type} {entity_id} deletion",
                preserve_paperless=preserve_paperless,
            )

            logger.info(
                f"EntityFile cleanup completed for {entity_type} {entity_id}: "
                f"{stats['files_deleted']} local files deleted, "
                f"{stats['files_preserved']} Paperless/Papra files preserved, "
                f"{stats['errors']} errors"
            )

            return stats

        except Exception as e:
            logger.error(
                f"Error during entity file cleanup for {entity_type} {entity_id}: {str(e)}"
            )
            return {"files_deleted": 0, "files_preserved": 0, "errors": 1}

    def remove_entity_files(
        self,
        db: Session,
        entity_files: List[EntityFile],
        reason: str,
        preserve_paperless: bool = True,
    ) -> Dict[str, int]:
        """
        Remove EntityFile rows whose records were deleted, and commit.

        Local files move to trash. Paperless and Papra documents stay in those
        services; only the link is removed. A file that fails keeps its row and is
        counted in "errors"; the others are still removed.

        Args:
            db: Database session
            entity_files: EntityFile rows to remove
            reason: Trash reason recorded for the local files
            preserve_paperless: If True, preserve Paperless documents (default: True)

        Returns:
            Dictionary with cleanup statistics
        """
        deleted_local_files = 0
        preserved_remote_files = 0
        errors = 0

        for file_record in entity_files:
            try:
                if file_record.storage_backend == "local":
                    # Delete local files (move to trash)
                    file_path = resolve_stored_file(file_record)
                    if file_path:
                        self.file_management_service.move_to_trash(
                            str(file_path), reason=reason
                        )
                        logger.info(f"Moved local file to trash: file {file_record.id}")
                        deleted_local_files += 1
                    else:
                        logger.warning(
                            f"Local file not found for deletion: file {file_record.id}"
                        )

                elif file_record.storage_backend == "paperless":
                    if preserve_paperless:
                        # Preserve Paperless files - just log for audit
                        logger.info(
                            f"Preserving Paperless document: file {file_record.id} (ID: {file_record.paperless_document_id})"
                        )
                        preserved_remote_files += 1
                    else:
                        # This path could be used if we ever want to delete from Paperless
                        logger.info(
                            f"Would delete Paperless document: file {file_record.id} (preserve_paperless=False)"
                        )
                        # TODO: Implement Paperless deletion if needed

                elif file_record.storage_backend == "papra":
                    # Papra documents always stay in Papra
                    preserved_remote_files += 1

                # Always remove database record
                db.delete(file_record)

            except Exception as file_error:
                logger.error(
                    f"Error processing file {file_record.id}: {str(file_error)}"
                )
                errors += 1
                # Continue with other files

        # Commit all file record deletions
        db.commit()

        return {
            "files_deleted": deleted_local_files,
            "files_preserved": preserved_remote_files,
            "errors": errors,
        }
