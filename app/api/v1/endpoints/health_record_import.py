"""
Health record import endpoints (FHIR bundles, C-CDA documents and MyChart zips).
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy.orm import Session

from app.api import deps
from app.api.deps import BusinessLogicException
from app.core.http.error_handling import handle_database_errors
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_data_access
from app.models.models import Patient, User
from app.schemas.health_record_import import (
    HealthRecordImportFormatsResponse,
    HealthRecordImportPreviewResponse,
    HealthRecordImportResponse,
)
from app.services.importers import ImportFormatError, health_record_importer_registry
from app.services.importers.service import HealthRecordImportService
from app.services.importers.upload import MAX_IMPORT_FILE_SIZE, read_upload

router = APIRouter()

# Initialize logger
logger = get_logger(__name__, "app")


def verify_import_access(
    patient_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> int:
    """Importing writes records, so require edit access rather than view."""
    return deps.verify_patient_access(
        patient_id, db, current_user, required_permission="edit"
    )


def _load_bundle(file: UploadFile, format_key: Optional[str], request: Request):
    """Read the upload and convert it with the chosen or detected importer."""
    data = read_upload(
        file, request, health_record_importer_registry.allowed_extensions()
    )
    if format_key:
        importer = health_record_importer_registry.get_importer(format_key)
        if importer is None:
            raise BusinessLogicException(
                message=f"Unsupported format: {format_key}", request=request
            )
    else:
        importer = health_record_importer_registry.detect(data, file.filename)
        if importer is None:
            raise BusinessLogicException(
                message="Could not recognize the file format", request=request
            )
    try:
        bundle, notes = importer.to_bundle(data, file.filename)
    except ImportFormatError as exc:
        raise BusinessLogicException(message=str(exc), request=request) from exc
    return importer, bundle, notes


@router.get("/import/formats", response_model=HealthRecordImportFormatsResponse)
def get_import_formats(
    *,
    request: Request,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Return the supported formats and the upload size limit."""
    return HealthRecordImportFormatsResponse(
        formats=health_record_importer_registry.get_available_formats(),
        max_file_size_bytes=MAX_IMPORT_FILE_SIZE,
    )


@router.post(
    "/patient/{patient_id}/import/preview",
    response_model=HealthRecordImportPreviewResponse,
)
def preview_import(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(verify_import_access),
    format_key: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Parse an upload and report what an import would create, skip or change."""
    importer, bundle, notes = _load_bundle(file, format_key, request)

    with handle_database_errors(request=request):
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        try:
            result = HealthRecordImportService(db).preview(
                bundle, patient, importer.SOURCE, importer.FORMAT_KEY, notes=notes
            )
        except ImportFormatError as exc:
            raise BusinessLogicException(message=str(exc), request=request) from exc

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "HealthRecordImport",
            patient_id=patient_id,
            operation_type="import_preview",
            count=result.total_resources,
        )
        return result


@router.post(
    "/patient/{patient_id}/import/execute",
    response_model=HealthRecordImportResponse,
)
def execute_import(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(verify_import_access),
    format_key: Optional[str] = Form(None),
    sections: Optional[str] = Form(None),
    skip_edited: bool = Form(True),
    file: UploadFile = File(...),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Execute the import, creating records and provenance rows."""
    importer, bundle, notes = _load_bundle(file, format_key, request)
    selected = (
        {s.strip() for s in sections.split(",") if s.strip()} if sections else None
    )

    with handle_database_errors(request=request):
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        try:
            result = HealthRecordImportService(db).execute(
                bundle,
                patient,
                importer.SOURCE,
                importer.FORMAT_KEY,
                user_id=current_user_id,
                request=request,
                sections=selected,
                skip_edited=skip_edited,
                notes=notes,
            )
        except ImportFormatError as exc:
            # Raised by the patient check, before anything is written
            raise BusinessLogicException(message=str(exc), request=request) from exc

        created = sum(c.created for c in result.counts.values())
        log_data_access(
            logger,
            request,
            current_user_id,
            "create",
            "HealthRecordImport",
            patient_id=patient_id,
            operation_type="import_execute",
            count=created,
        )
        return result
