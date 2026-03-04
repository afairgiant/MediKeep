from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from sqlalchemy.orm import Session

from app.api import deps
from app.api.deps import BusinessLogicException, NotFoundException, ValidationException
from app.core.http.error_handling import handle_database_errors
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.logging.helpers import log_data_access, log_endpoint_error
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
from app.crud.vitals import vitals
from app.models.activity_log import EntityType
from app.models.models import User
from app.schemas.vitals import (
    VitalsCreate,
    VitalsPaginatedResponse,
    VitalsResponse,
    VitalsStats,
    VitalsUpdate,
)
from app.schemas.vitals_import import (
    VitalsImportDevicesResponse,
    VitalsImportPreviewResponse,
    VitalsImportResponse,
    VitalsPreviewRow,
)
from app.services.vitals_parsers import vitals_parser_registry

router = APIRouter()

# Initialize logger
logger = get_logger(__name__, "app")


@router.post("/", response_model=VitalsResponse)
def create_vitals(
    *,
    vitals_in: VitalsCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create new vitals reading."""
    return handle_create_with_logging(
        db=db,
        crud_obj=vitals,
        obj_in=vitals_in,
        entity_type=EntityType.VITALS,
        user_id=current_user_id,
        entity_name="Vitals",
        request=request,
    )


@router.get("/", response_model=List[VitalsResponse])
def read_vitals(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=10000, le=10000),
    vital_type: Optional[str] = Query(None, description="Filter by vital type (blood_pressure, heart_rate, temperature, weight, oxygen_saturation, blood_glucose)"),
    start_date: Optional[str] = Query(None, description="Start date for date range filter (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date for date range filter (ISO format)"),
    days: Optional[int] = Query(None, description="Get readings from last N days"),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Retrieve vitals readings for the current user or specified patient (Phase 1 support).

    Supports filtering by:
    - vital_type: Specific vital type (e.g., blood_pressure, heart_rate)
    - start_date/end_date: Date range filtering
    - days: Recent readings (e.g., last 30 days)
    """

    with handle_database_errors(request=request):
        # Apply filters based on query parameters
        if days is not None:
            # Get recent readings
            vitals_list = vitals.get_recent_readings(
                db=db, patient_id=target_patient_id, days=days
            )
        elif start_date and end_date:
            # Date range filtering
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            vitals_list = vitals.get_by_patient_date_range(
                db=db,
                patient_id=target_patient_id,
                start_date=start_dt,
                end_date=end_dt,
                skip=skip,
                limit=limit
            )
        elif vital_type:
            # Filter by vital type
            vitals_list = vitals.get_by_vital_type(
                db=db,
                patient_id=target_patient_id,
                vital_type=vital_type,
                skip=skip,
                limit=limit
            )
        else:
            # Get all vitals
            vitals_list = vitals.get_by_patient(
                db=db, patient_id=target_patient_id, skip=skip, limit=limit
            )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Vitals",
            patient_id=target_patient_id,
            count=len(vitals_list)
        )

        return vitals_list


@router.get("/stats", response_model=VitalsStats)
def read_current_user_vitals_stats(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: Optional[int] = Query(None, description="Patient ID for Phase 1 patient switching"),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get vitals statistics for the current user or specified patient (Phase 1 support)."""

    with handle_database_errors(request=request):
        # Phase 1 support: Use patient_id if provided, otherwise fall back to user's own patient
        if patient_id is not None:
            target_patient_id = patient_id
        else:
            target_patient_id = deps.get_current_user_patient_id(db, current_user_id)

        stats = vitals.get_vitals_stats(db=db, patient_id=target_patient_id)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Vitals",
            patient_id=target_patient_id,
            operation_type="stats"
        )

        return stats


# --- Vitals Import Endpoints ---

MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _read_csv_upload(file: UploadFile, request: Request) -> str:
    """Read and validate a CSV upload, returning its text content."""
    if not file or not file.filename:
        raise ValidationException(
            message="No file provided",
            request=request,
        )

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext != "csv":
        raise ValidationException(
            message="Only CSV files are supported",
            request=request,
        )

    raw = file.file.read()
    if len(raw) > MAX_IMPORT_FILE_SIZE:
        raise ValidationException(
            message="File exceeds 10 MB limit",
            request=request,
        )

    # Decode with BOM handling
    try:
        csv_content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            csv_content = raw.decode("latin-1")
        except UnicodeDecodeError:
            raise ValidationException(
                message="Unable to decode file. Please ensure it is UTF-8 encoded.",
                request=request,
            )

    return csv_content


@router.get("/import/devices", response_model=VitalsImportDevicesResponse)
def get_import_devices(
    *,
    request: Request,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Return list of supported import devices."""
    devices = vitals_parser_registry.get_available_devices()
    return VitalsImportDevicesResponse(devices=devices)


@router.post(
    "/patient/{patient_id}/import/preview",
    response_model=VitalsImportPreviewResponse,
)
def preview_import(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    device_key: str = Form(...),
    file: UploadFile = File(...),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Parse an uploaded CSV and return a preview with duplicate detection."""
    parser = vitals_parser_registry.get_parser(device_key)
    if parser is None:
        raise BusinessLogicException(
            message=f"Unsupported device: {device_key}",
            request=request,
        )

    csv_content = _read_csv_upload(file, request)

    with handle_database_errors(request=request):
        result = parser.parse(csv_content)

        if result.errors:
            log_endpoint_error(
                logger, request, current_user_id,
                "vitals_import_parse_failed",
                errors=result.errors,
            )
            raise BusinessLogicException(
                message=f"CSV parsing failed: {'; '.join(result.errors)}",
                request=request,
            )

        duplicate_indices = vitals.find_duplicates(
            db, patient_id=patient_id, readings=result.readings
        )

        preview_rows = []
        for idx, reading in enumerate(result.readings[:10]):
            preview_rows.append(
                VitalsPreviewRow(
                    recorded_date=reading.recorded_date,
                    blood_glucose=reading.blood_glucose,
                    device_used=reading.device_used,
                    is_duplicate=idx in duplicate_indices,
                )
            )

        log_data_access(
            logger, request, current_user_id, "read", "Vitals",
            patient_id=patient_id,
            operation_type="import_preview",
            count=len(result.readings),
        )

        return VitalsImportPreviewResponse(
            device_name=result.device_name,
            total_readings=len(result.readings),
            preview_rows=preview_rows,
            duplicate_count=len(duplicate_indices),
            new_count=len(result.readings) - len(duplicate_indices),
            skipped_rows=result.skipped_rows,
            errors=result.errors,
            warnings=result.warnings[:20],
            date_range_start=result.date_range_start,
            date_range_end=result.date_range_end,
        )


@router.post(
    "/patient/{patient_id}/import/execute",
    response_model=VitalsImportResponse,
)
def execute_import(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    device_key: str = Form(...),
    skip_duplicates: bool = Form(True),
    file: UploadFile = File(...),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Execute the vitals import, creating records in the database."""
    parser = vitals_parser_registry.get_parser(device_key)
    if parser is None:
        raise BusinessLogicException(
            message=f"Unsupported device: {device_key}",
            request=request,
        )

    csv_content = _read_csv_upload(file, request)

    with handle_database_errors(request=request):
        result = parser.parse(csv_content)

        if result.errors:
            raise BusinessLogicException(
                message=f"CSV parsing failed: {'; '.join(result.errors)}",
                request=request,
            )

        skip_indices = set()
        if skip_duplicates:
            skip_indices = vitals.find_duplicates(
                db, patient_id=patient_id, readings=result.readings
            )

        imported_count = vitals.bulk_create(
            db,
            readings=result.readings,
            patient_id=patient_id,
            skip_indices=skip_indices,
        )

        log_data_access(
            logger, request, current_user_id, "create", "Vitals",
            patient_id=patient_id,
            operation_type="import_execute",
            count=imported_count,
        )

        return VitalsImportResponse(
            imported_count=imported_count,
            skipped_duplicates=len(skip_indices),
            errors=result.errors,
            total_processed=len(result.readings),
        )


@router.delete(
    "/patient/{patient_id}/import/{import_source}/date/{date}",
)
def delete_imported_day(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    import_source: str,
    date: str,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Delete all imported vitals for a patient on a specific date."""
    # Validate date format
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError as exc:
        raise ValidationException(
            message="Invalid date format. Use YYYY-MM-DD.",
            request=request,
        ) from exc

    with handle_database_errors(request=request):
        deleted_count = vitals.bulk_delete_by_import(
            db,
            patient_id=patient_id,
            import_source=import_source,
            date_str=date,
        )

        log_data_access(
            logger, request, current_user_id, "delete", "Vitals",
            patient_id=patient_id,
            operation_type="import_bulk_delete",
            count=deleted_count,
        )

        return {"deleted_count": deleted_count}


@router.get("/{vitals_id}", response_model=VitalsResponse)
def read_vitals_by_id(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    vitals_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get vitals reading by ID with related information - only allows access to user's own vitals."""
    with handle_database_errors(request=request):
        vitals_obj = vitals.get_with_relations(
            db=db, record_id=vitals_id, relations=["patient", "practitioner"]
        )
        handle_not_found(vitals_obj, "Vitals reading", request)
        verify_patient_ownership(vitals_obj, current_user_patient_id, "vitals")

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Vitals",
            record_id=vitals_id,
            patient_id=current_user_patient_id
        )

        return vitals_obj


@router.put("/{vitals_id}", response_model=VitalsResponse)
def update_vitals(
    *,
    vitals_id: int,
    vitals_in: VitalsUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Update vitals reading."""
    return handle_update_with_logging(
        db=db,
        crud_obj=vitals,
        entity_id=vitals_id,
        obj_in=vitals_in,
        entity_type=EntityType.VITALS,
        user_id=current_user_id,
        entity_name="Vitals",
        request=request,
        current_user=current_user,
        current_user_patient_id=current_user_patient_id,
    )


@router.delete("/{vitals_id}")
def delete_vitals(
    *,
    vitals_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Delete a vitals reading."""
    return handle_delete_with_logging(
        db=db,
        crud_obj=vitals,
        entity_id=vitals_id,
        entity_type=EntityType.VITALS,
        user_id=current_user_id,
        entity_name="Vitals",
        request=request,
        current_user=current_user,
        current_user_patient_id=current_user_patient_id,
    )


@router.get("/patient/{patient_id}/paginated", response_model=VitalsPaginatedResponse)
def read_patient_vitals_paginated(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=100),
    vital_type: Optional[str] = Query(
        None,
        description="Filter by vital type: blood_pressure, heart_rate, temperature, weight, oxygen_saturation, blood_glucose, a1c",
    ),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get paginated vitals readings for a specific patient with total count.

    Returns a paginated response with:
    - items: List of vitals records for the current page
    - total: Total number of records matching the filters
    - skip: Current offset
    - limit: Page size
    """
    with handle_database_errors(request=request):
        try:
            total_count = vitals.count_by_patient(
                db=db, patient_id=patient_id, vital_type=vital_type
            )

            # Order by recorded_date descending for consistent pagination
            if vital_type:
                vitals_list = vitals.get_by_vital_type(
                    db=db,
                    patient_id=patient_id,
                    vital_type=vital_type,
                    skip=skip,
                    limit=limit,
                )
            else:
                vitals_list = vitals.get_by_patient(
                    db=db,
                    patient_id=patient_id,
                    skip=skip,
                    limit=limit,
                    order_by="recorded_date",
                    order_desc=True,
                )
        except ValueError as e:
            raise BusinessLogicException(message=str(e), request=request)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Vitals",
            patient_id=patient_id,
            count=len(vitals_list),
            total=total_count,
            vital_type=vital_type,
        )

        return VitalsPaginatedResponse(
            items=vitals_list,
            total=total_count,
            skip=skip,
            limit=limit,
        )


@router.get("/patient/{patient_id}", response_model=List[VitalsResponse])
def read_patient_vitals(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    skip: int = 0,
    limit: int = Query(default=10000, le=10000),
    vital_type: Optional[str] = Query(
        None,
        description="Filter by vital type: blood_pressure, heart_rate, temperature, weight, oxygen_saturation, blood_glucose, a1c",
    ),
    days: Optional[int] = Query(None, description="Get readings from last N days"),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all vitals readings for a specific patient."""
    with handle_database_errors(request=request):
        try:
            if days:
                # Get recent readings
                vitals_list = vitals.get_recent_readings(
                    db=db, patient_id=patient_id, days=days
                )
            elif vital_type:
                # Get by specific vital type
                vitals_list = vitals.get_by_vital_type(
                    db=db, patient_id=patient_id, vital_type=vital_type, skip=skip, limit=limit
                )
            else:
                # Get all readings for patient
                vitals_list = vitals.get_by_patient(
                    db=db, patient_id=patient_id, skip=skip, limit=limit
                )
        except ValueError as e:
            raise BusinessLogicException(message=str(e), request=request)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Vitals",
            patient_id=patient_id,
            count=len(vitals_list),
            vital_type=vital_type,
            days=days
        )

        return vitals_list


@router.get("/patient/{patient_id}/latest", response_model=VitalsResponse)
def read_patient_latest_vitals(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get the most recent vitals reading for a patient."""
    with handle_database_errors(request=request):
        latest_vitals = vitals.get_latest_by_patient(db=db, patient_id=patient_id)
        if not latest_vitals:
            raise NotFoundException(
                resource="Vitals",
                message="No vitals readings found for this patient",
                request=request
            )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Vitals",
            patient_id=patient_id,
            record_id=latest_vitals.id,
            operation_type="latest"
        )

        return latest_vitals


@router.get("/patient/{patient_id}/stats", response_model=VitalsStats)
def read_patient_vitals_stats(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get vitals statistics for a patient."""
    with handle_database_errors(request=request):
        stats = vitals.get_vitals_stats(db=db, patient_id=patient_id)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Vitals",
            patient_id=patient_id,
            operation_type="stats"
        )

        return stats


@router.get("/patient/{patient_id}/date-range", response_model=List[VitalsResponse])
def read_patient_vitals_date_range(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    start_date: datetime = Query(..., description="Start date for the range"),
    end_date: datetime = Query(..., description="End date for the range"),
    skip: int = 0,
    limit: int = Query(default=10000, le=10000),
    vital_type: Optional[str] = Query(
        None,
        description="Filter by vital type: blood_pressure, heart_rate, temperature, weight, oxygen_saturation, blood_glucose, a1c",
    ),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get vitals readings for a patient within a specific date range, optionally filtered by vital type."""
    with handle_database_errors(request=request):
        try:
            vitals_list = vitals.get_by_patient_date_range(
                db=db,
                patient_id=patient_id,
                start_date=start_date,
                end_date=end_date,
                skip=skip,
                limit=limit,
                vital_type=vital_type,
            )
        except ValueError as e:
            raise BusinessLogicException(message=str(e), request=request)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Vitals",
            patient_id=patient_id,
            count=len(vitals_list),
            start_date=str(start_date),
            end_date=str(end_date),
            vital_type=vital_type
        )

        return vitals_list


@router.post("/patient/{patient_id}/vitals/", response_model=VitalsResponse)
def create_patient_vitals(
    *,
    vitals_in: VitalsCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create a new vitals reading for a specific patient."""
    # Ensure the patient_id in the URL matches the one in the request body
    if vitals_in.patient_id != patient_id:
        raise BusinessLogicException(
            message="Patient ID in URL does not match patient ID in request body",
            request=request
        )

    return create_vitals(
        vitals_in=vitals_in, request=request, db=db, current_user_id=current_user_id
    )
