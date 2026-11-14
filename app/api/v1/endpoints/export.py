"""
Medical Records Export API Endpoints

This module provides endpoints for exporting patient medical data in various formats.
Supports JSON, CSV, and PDF exports with different data scopes.
"""

import io
import json
import zipfile
from datetime import date, datetime
from enum import Enum
from functools import partial
from typing import Callable, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id, get_db
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.logging.helpers import log_endpoint_access, log_endpoint_error
from app.crud.user_preferences import user_preferences as user_preferences_crud
from app.services.export_attachments import (
    INDEX_NAME,
    LEFT_OUT_MANIFEST_NAME,
    LeftOutFile,
    build_attachments_index,
    build_left_out_manifest,
)
from app.services.export_service import ExportService
from app.services.paperless_auth_methods import (
    credential_kwargs,
    has_usable_credentials,
)
from app.services.paperless_client import create_paperless_client
from app.services.papra_client import create_papra_client

logger = get_logger(__name__, "app")

router = APIRouter()


def json_serializer(obj):
    """Custom JSON serializer for complex objects in export data."""
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    if isinstance(obj, BaseModel):
        # Recursively serialize Pydantic models to preserve their structure
        return {key: json_serializer(value) for key, value in obj.model_dump().items()}
    if isinstance(obj, (list, tuple)):
        return [json_serializer(item) for item in obj]
    if isinstance(obj, dict):
        return {key: json_serializer(value) for key, value in obj.items()}
    if hasattr(obj, "__dict__"):
        return str(obj)
    return str(obj)


# Remote storage backend -> name shown to the user
REMOTE_SERVICE_NAMES = {"paperless": "Paperless-ngx", "papra": "Papra"}


class _FileLeftOut(Exception):
    """A file cannot be added to the ZIP; ``reason`` is a LeftOutFile reason."""

    def __init__(self, reason: str, service: Optional[str] = None):
        super().__init__(reason)
        self.reason = reason
        self.service = service


def _remote_client_factory(
    backend: str, file_info: dict, user_prefs, user_id: int
) -> Optional[Callable]:
    """Callable building the client for a Paperless/Papra file.

    Uses the saved integration settings of the exporting user. Returns None when the
    integration is disabled or not fully set up.
    """
    if not user_prefs:
        return None

    if backend == "paperless":
        if not (
            user_prefs.paperless_enabled
            and user_prefs.paperless_url
            and has_usable_credentials(user_prefs)
        ):
            return None
        return partial(
            create_paperless_client,
            url=user_prefs.paperless_url,
            **credential_kwargs(user_prefs),
            user_id=user_id,
        )

    organization_id = (
        file_info.get("papra_organization_id") or user_prefs.papra_organization_id
    )
    if not (
        user_prefs.papra_enabled
        and user_prefs.papra_url
        and user_prefs.papra_api_token_encrypted
        and organization_id
    ):
        return None
    return partial(
        create_papra_client,
        url=user_prefs.papra_url,
        encrypted_token=user_prefs.papra_api_token_encrypted,
        organization_id=organization_id,
        user_id=user_id,
    )


async def _download_remote_file(file_info: dict, user_prefs, user_id: int) -> bytes:
    """Content of a file stored in Paperless-ngx or Papra, or raise _FileLeftOut."""
    backend = file_info["storage_backend"]
    service = REMOTE_SERVICE_NAMES.get(backend)
    if service is None:
        raise _FileLeftOut("failed")

    document_id = file_info.get(f"{backend}_document_id")
    if not document_id:
        raise _FileLeftOut("not_found")

    make_client = _remote_client_factory(backend, file_info, user_prefs, user_id)
    if make_client is None:
        raise _FileLeftOut("not_configured", service)

    try:
        async with make_client() as client:
            return await client.download_document(document_id)
    except Exception as download_error:
        logger.warning(
            f"Failed to download {service} document: {document_id}",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: f"export_{backend}_download_failed",
                LogFields.USER_ID: user_id,
                LogFields.ERROR: str(download_error),
                f"{backend}_document_id": document_id,
            },
        )
        raise _FileLeftOut("download_failed", service) from download_error


def _left_out_file(
    attachment: dict, reason: str, service: Optional[str] = None
) -> LeftOutFile:
    return LeftOutFile(
        file_name=attachment["file_name"],
        scope=attachment["scope"],
        record_label=attachment["record_label"],
        record_date=attachment["record_date"],
        reason=reason,
        service=service,
    )


async def _write_attachments_to_zip(
    zip_file: zipfile.ZipFile,
    attachments: List[dict],
    user_prefs,
    user_id: int,
    language: str,
    date_format: str,
) -> Tuple[int, int]:
    """Add attachments to a ZIP, with an index of what was added and a list of what
    could not be. Returns how many files were added and how many were left out."""
    included: List[dict] = []
    left_out: List[LeftOutFile] = []

    for attachment in attachments:
        try:
            if attachment["storage_backend"] == "local":
                if not attachment["file_path"]:
                    raise _FileLeftOut("not_found")
                zip_file.write(attachment["file_path"], attachment["zip_path"])
            else:
                zip_file.writestr(
                    attachment["zip_path"],
                    await _download_remote_file(attachment, user_prefs, user_id),
                )
            included.append(attachment)
        except _FileLeftOut as left_out_error:
            left_out.append(
                _left_out_file(
                    attachment, left_out_error.reason, left_out_error.service
                )
            )
        except Exception as file_error:
            logger.error(
                f"Failed to add attachment to export ZIP: {attachment['file_name']}",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "export_file_add_failed",
                    LogFields.USER_ID: user_id,
                    LogFields.ERROR: str(file_error),
                    "file_name": attachment["file_name"],
                },
            )
            left_out.append(_left_out_file(attachment, "failed"))

    if included:
        zip_file.writestr(
            INDEX_NAME, build_attachments_index(included, language, date_format)
        )
    if left_out:
        zip_file.writestr(
            LEFT_OUT_MANIFEST_NAME,
            build_left_out_manifest(left_out, language, date_format),
        )
    return len(included), len(left_out)


class ExportFormat(str, Enum):
    JSON = "json"
    CSV = "csv"
    PDF = "pdf"


class ExportScope(str, Enum):
    ALL = "all"
    ALLERGIES = "allergies"
    BLOOD_DONATIONS = "blood_donations"
    CONDITIONS = "conditions"
    EMERGENCY_CONTACTS = "emergency_contacts"
    ENCOUNTERS = "encounters"
    FAMILY_HISTORY = "family_history"
    IMMUNIZATIONS = "immunizations"
    INJURIES = "injuries"
    INSURANCE = "insurance"
    LAB_RESULTS = "lab_results"
    MEDICAL_EQUIPMENT = "medical_equipment"
    MEDICATIONS = "medications"
    PHARMACIES = "pharmacies"
    PRACTITIONERS = "practitioners"
    PROCEDURES = "procedures"
    SYMPTOMS = "symptoms"
    TREATMENTS = "treatments"
    VITALS = "vitals"


class BulkExportRequest(BaseModel):
    scopes: List[str]
    format: ExportFormat = ExportFormat.JSON
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    include_patient_info: bool = True
    unit_system: str = "imperial"

    @field_validator("unit_system")
    @classmethod
    def validate_unit_system(cls, v: str) -> str:
        """Validate unit_system is either 'imperial' or 'metric'."""
        if v not in ("imperial", "metric"):
            raise ValueError("unit_system must be 'imperial' or 'metric'")
        return v


@router.get("/data")
async def export_patient_data(
    request: Request,
    format: ExportFormat = Query(ExportFormat.JSON, description="Export format"),
    scope: ExportScope = Query(ExportScope.ALL, description="Data scope to export"),
    start_date: Optional[date] = Query(
        None, description="Start date for filtering records"
    ),
    end_date: Optional[date] = Query(
        None, description="End date for filtering records"
    ),
    include_files: bool = Query(
        False, description="Include files attached to the exported records (ZIP)"
    ),
    include_patient_info: bool = Query(
        True, description="Include patient information in export (all formats)"
    ),
    unit_system: str = Query(
        "imperial",
        description="Unit system for measurements (imperial or metric)",
        pattern="^(imperial|metric)$",
    ),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Export patient medical data in the specified format.

    - **format**: Output format (json, csv, pdf)
    - **scope**: What data to include (all, medications, lab_results, etc.)
    - **start_date**: Filter records from this date onwards
    - **end_date**: Filter records up to this date
    - **include_files**: Whether to include the files attached to the exported records
      (any format; the download is then a ZIP with the export and the files)
    - **include_patient_info**: Whether to include patient information in export
    - **unit_system**: Unit system for measurements (imperial or metric)"""

    try:
        log_endpoint_access(
            logger,
            request,
            current_user_id,
            "export_data_requested",
            format_type=format.value,
            scope=scope.value,
            unit_system=unit_system,
        )

        # Read user preferences for language and date format
        user_prefs = user_preferences_crud.get_by_user_id(db, user_id=current_user_id)
        language = (user_prefs and user_prefs.language) or "en"
        date_format_pref = (user_prefs and user_prefs.date_format) or "mdy"
        hemoglobin_unit = user_prefs and user_prefs.hemoglobin_unit

        export_service = ExportService(db)

        attachments = (
            export_service.get_attachments(
                current_user_id, [scope.value], start_date, end_date
            )
            if include_files
            else None
        )

        # Generate the export
        export_data = await export_service.export_patient_data(
            user_id=current_user_id,
            format=format.value,
            scope=scope.value,
            start_date=start_date,
            end_date=end_date,
            attachments=attachments,
            include_patient_info=include_patient_info,
            unit_system=unit_system,
            language=language,
            date_format=date_format_pref,
            hemoglobin_unit=hemoglobin_unit,
        )

        # Determine content type and filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if format == ExportFormat.JSON:
            media_type = "application/json"
            filename = f"medical_records_{scope.value}_{timestamp}.json"

            try:
                content = json.dumps(
                    export_data, default=json_serializer, indent=2, ensure_ascii=False
                )
            except Exception as json_error:
                log_endpoint_error(
                    logger,
                    request,
                    "JSON serialization failed during export",
                    json_error,
                    user_id=current_user_id,
                    scope=scope.value,
                    format_type=format.value,
                )
                raise HTTPException(
                    status_code=500,
                    detail="JSON serialization failed",
                )

        elif format == ExportFormat.CSV:
            media_type = "text/csv; charset=utf-8"
            filename = f"medical_records_{scope.value}_{timestamp}.csv"
            csv_str = export_service.convert_to_csv(export_data, scope.value)
            # Prepend UTF-8 BOM so Excel opens the file with correct encoding
            content = "\ufeff" + csv_str

        elif format == ExportFormat.PDF:
            media_type = "application/pdf"
            filename = f"medical_records_{scope.value}_{timestamp}.pdf"
            content = await export_service.convert_to_pdf(export_data, include_files)

        else:
            raise HTTPException(status_code=400, detail="Unsupported export format")

        # Convert content to bytes for response
        if isinstance(content, str):
            content_bytes = content.encode("utf-8")
        else:
            content_bytes = content

        if not content_bytes:
            raise HTTPException(status_code=500, detail="Generated content is empty")

        if attachments:
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
                zip_file.writestr(filename, content_bytes)
                files_added, files_left_out = await _write_attachments_to_zip(
                    zip_file,
                    attachments,
                    user_prefs,
                    current_user_id,
                    language,
                    date_format_pref,
                )

            zip_filename = f"medical_records_{scope.value}_with_files_{timestamp}.zip"
            zip_content = zip_buffer.getvalue()
            log_endpoint_access(
                logger,
                request,
                current_user_id,
                "export_zip_generated",
                message=f"Generated ZIP export with {files_added} files",
                export_filename=zip_filename,
                size_bytes=len(zip_content),
                files_included=files_added,
                files_left_out=files_left_out,
            )
            return Response(
                content=zip_content,
                media_type="application/zip",
                headers={
                    "Content-Disposition": f'attachment; filename="{zip_filename}"',
                    "Content-Length": str(len(zip_content)),
                },
            )

        return Response(
            content=content_bytes,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(content_bytes)),
            },
        )

    except ValueError as e:
        # Handle specific validation errors (user not found, no active patient)
        error_message = str(e)
        log_endpoint_error(
            logger,
            request,
            f"Export validation error: {error_message}",
            e,
            user_id=current_user_id,
            format_type=format.value,
            scope=scope.value,
        )
        raise HTTPException(status_code=400, detail=error_message)
    except HTTPException:
        raise
    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Patient data export failed",
            e,
            user_id=current_user_id,
            format_type=format.value,
            scope=scope.value,
        )
        raise HTTPException(status_code=500, detail="Export failed")


@router.get("/summary")
async def get_export_summary(
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Get a summary of available data for export.
    Returns counts of records in each category.
    """
    try:
        export_service = ExportService(db)
        summary = await export_service.get_export_summary(current_user_id)

        log_endpoint_access(
            logger,
            request,
            current_user_id,
            "export_summary_retrieved",
            record_count=len(summary.get("counts", {})),
        )

        return {
            "status": "success",
            "data": summary,
            "generated_at": datetime.now().isoformat(),
        }

    except ValueError as e:
        # Handle specific validation errors (user not found, no active patient)
        error_message = str(e)
        log_endpoint_error(
            logger,
            request,
            f"Export summary validation error: {error_message}",
            e,
            user_id=current_user_id,
        )
        raise HTTPException(status_code=400, detail=error_message)
    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Failed to generate export summary",
            e,
            user_id=current_user_id,
        )
        raise HTTPException(status_code=500, detail="Failed to generate export summary")


@router.get("/formats")
async def get_supported_formats():
    """
    Get list of supported export formats and scopes.
    """
    return {
        "formats": [
            {
                "value": "json",
                "label": "JSON",
                "description": "Machine-readable structured data format",
            },
            {
                "value": "csv",
                "label": "CSV",
                "description": "Comma-separated values for spreadsheet applications",
            },
            {
                "value": "pdf",
                "label": "PDF",
                "description": "Human-readable document format",
            },
        ],
        "scopes": [
            {
                "value": "all",
                "label": "All Records",
                "description": "Complete medical history",
            },
            {
                "value": "allergies",
                "label": "Allergies",
                "description": "Known allergies and reactions",
            },
            {
                "value": "blood_donations",
                "label": "Blood Donations",
                "description": "Blood, plasma and platelet donation records",
            },
            {
                "value": "emergency_contacts",
                "label": "Emergency Contacts",
                "description": "Emergency contact information",
            },
            {
                "value": "encounters",
                "label": "Encounters",
                "description": "Medical visits and consultations",
            },
            {
                "value": "family_history",
                "label": "Family History",
                "description": "Family medical history records",
            },
            {
                "value": "practitioners",
                "label": "Healthcare Practitioners",
                "description": "Healthcare providers and specialists",
            },
            {
                "value": "immunizations",
                "label": "Immunizations",
                "description": "Vaccination records",
            },
            {
                "value": "injuries",
                "label": "Injuries",
                "description": "Injury records and recovery tracking",
            },
            {
                "value": "insurance",
                "label": "Insurance",
                "description": "Insurance information and coverage",
            },
            {
                "value": "lab_results",
                "label": "Lab Results",
                "description": "Laboratory test results",
            },
            {
                "value": "conditions",
                "label": "Medical Conditions",
                "description": "Diagnosed conditions",
            },
            {
                "value": "medical_equipment",
                "label": "Medical Equipment",
                "description": "Prescribed and used medical equipment",
            },
            {
                "value": "medications",
                "label": "Medications",
                "description": "Current and past medications",
            },
            {
                "value": "pharmacies",
                "label": "Pharmacies",
                "description": "Pharmacy locations and information",
            },
            {
                "value": "procedures",
                "label": "Procedures",
                "description": "Medical procedures performed",
            },
            {
                "value": "symptoms",
                "label": "Symptoms",
                "description": "Symptom tracking and occurrences",
            },
            {
                "value": "treatments",
                "label": "Treatments",
                "description": "Treatment plans and history",
            },
            {
                "value": "vitals",
                "label": "Vital Signs",
                "description": "Blood pressure, weight, etc.",
            },
        ],
    }


@router.post("/bulk")
async def create_bulk_export(
    http_request: Request,
    request: BulkExportRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Create a bulk export containing multiple data scopes in a ZIP file.
    Each scope is exported as a separate file within the ZIP, together with the
    files attached to the exported records.
    """
    try:
        log_endpoint_access(
            logger,
            http_request,
            current_user_id,
            "bulk_export_requested",
            scope_count=len(request.scopes),
            format_type=request.format.value,
        )

        # Read user preferences for language and date format
        user_prefs = user_preferences_crud.get_by_user_id(db, user_id=current_user_id)
        language = (user_prefs and user_prefs.language) or "en"
        date_format_pref = (user_prefs and user_prefs.date_format) or "mdy"
        hemoglobin_unit = user_prefs and user_prefs.hemoglobin_unit

        export_service = ExportService(db)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        attachments = export_service.get_attachments(
            current_user_id, request.scopes, request.start_date, request.end_date
        )

        zip_buffer = io.BytesIO()
        failed_scopes = []
        exported_scopes = set()

        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            exported_count = 0

            for scope in request.scopes:
                try:
                    # Export each scope
                    export_data = await export_service.export_patient_data(
                        user_id=current_user_id,
                        format=request.format.value,
                        scope=scope,
                        start_date=request.start_date,
                        end_date=request.end_date,
                        attachments=attachments,
                        include_patient_info=request.include_patient_info,
                        unit_system=request.unit_system,
                        language=language,
                        date_format=date_format_pref,
                        hemoglobin_unit=hemoglobin_unit,
                    )

                    # Convert to appropriate format
                    if request.format == ExportFormat.JSON:
                        content = json.dumps(
                            export_data,
                            default=json_serializer,
                            indent=2,
                            ensure_ascii=False,
                        )
                        filename = f"medical_records_{scope}_{timestamp}.json"
                    elif request.format == ExportFormat.CSV:
                        content = "\ufeff" + export_service.convert_to_csv(
                            export_data, scope
                        )
                        filename = f"medical_records_{scope}_{timestamp}.csv"
                    elif request.format == ExportFormat.PDF:
                        content = await export_service.convert_to_pdf(
                            export_data, include_files=True
                        )
                        filename = f"medical_records_{scope}_{timestamp}.pdf"
                    else:
                        logger.warning(
                            f"Unsupported format in bulk export: {request.format.value}",
                            extra={
                                LogFields.CATEGORY: "app",
                                LogFields.EVENT: "bulk_export_unsupported_format",
                                LogFields.USER_ID: current_user_id,
                                "scope": scope,
                                "format": request.format.value,
                            },
                        )
                        failed_scopes.append(
                            (scope, f"Unsupported format: {request.format.value}")
                        )
                        continue

                    # Add to ZIP
                    zip_file.writestr(
                        filename,
                        (
                            content.encode("utf-8")
                            if isinstance(content, str)
                            else content
                        ),
                    )
                    exported_count += 1
                    exported_scopes.add(scope)

                except Exception as e:
                    error_msg = str(e)
                    logger.warning(
                        f"Failed to export scope in bulk export: {scope}: {error_msg}",
                        extra={
                            LogFields.CATEGORY: "app",
                            LogFields.EVENT: "bulk_export_scope_failed",
                            LogFields.USER_ID: current_user_id,
                            LogFields.ERROR: error_msg,
                            "scope": scope,
                        },
                    )
                    # error_msg is logged above; the client gets a fixed reason.
                    failed_scopes.append((scope, "an unexpected error occurred"))
                    continue

            files_added = files_left_out = 0
            if exported_count:
                # Files go with the scopes that made it into the ZIP
                files_added, files_left_out = await _write_attachments_to_zip(
                    zip_file,
                    [
                        a
                        for a in attachments
                        if "all" in exported_scopes or a["scope"] in exported_scopes
                    ],
                    user_prefs,
                    current_user_id,
                    language,
                    date_format_pref,
                )

        if exported_count == 0:
            # Include the actual failure reasons in the error message
            if failed_scopes:
                first_error = failed_scopes[0][1]
                raise HTTPException(
                    status_code=400,
                    detail=f"Export failed: {first_error}",
                )
            raise HTTPException(
                status_code=400,
                detail="No data could be exported for the selected scopes",
            )

        zip_buffer.seek(0)
        zip_filename = f"medical_records_bulk_{timestamp}.zip"
        zip_content = zip_buffer.getvalue()

        if not zip_content:
            raise HTTPException(
                status_code=500,
                detail="ZIP file generation produced empty content",
            )

        log_endpoint_access(
            logger,
            http_request,
            current_user_id,
            "bulk_export_completed",
            message="Bulk export completed successfully",
            exported_count=exported_count,
            files_included=files_added,
            files_left_out=files_left_out,
            export_filename=zip_filename,
            size_bytes=len(zip_content),
        )

        return Response(
            content=zip_content,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{zip_filename}"',
                "Content-Length": str(len(zip_content)),
            },
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is (don't wrap them)
        raise
    except Exception as e:
        log_endpoint_error(
            logger,
            http_request,
            "Bulk export failed",
            e,
            user_id=current_user_id,
            scope_count=len(request.scopes),
        )
        raise HTTPException(status_code=500, detail="Bulk export failed")
