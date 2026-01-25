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
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id, get_db
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_endpoint_access, log_endpoint_error
from app.core.logging.constants import LogFields
from app.services.export_service import ExportService

logger = get_logger(__name__, "app")

router = APIRouter()


class ExportFormat(str, Enum):
    JSON = "json"
    CSV = "csv"
    PDF = "pdf"


class ExportScope(str, Enum):
    ALL = "all"
    MEDICATIONS = "medications"
    LAB_RESULTS = "lab_results"
    ALLERGIES = "allergies"
    CONDITIONS = "conditions"
    IMMUNIZATIONS = "immunizations"
    PROCEDURES = "procedures"
    TREATMENTS = "treatments"
    ENCOUNTERS = "encounters"
    VITALS = "vitals"
    EMERGENCY_CONTACTS = "emergency_contacts"
    PRACTITIONERS = "practitioners"
    PHARMACIES = "pharmacies"


class BulkExportRequest(BaseModel):
    scopes: List[str]
    format: ExportFormat = ExportFormat.JSON
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    include_patient_info: bool = True
    unit_system: str = "imperial"


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
        False, description="Include associated files (PDF only)"
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
    - **include_files**: Whether to include file attachments (PDF exports only)
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

        export_service = ExportService(db)

        # Generate the export
        export_data = await export_service.export_patient_data(
            user_id=current_user_id,
            format=format.value,
            scope=scope.value,
            start_date=start_date,
            end_date=end_date,
            include_files=include_files,
            include_patient_info=include_patient_info,
            unit_system=unit_system,
        )

        # Determine content type and filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if format == ExportFormat.JSON:
            media_type = "application/json"
            filename = f"medical_records_{scope.value}_{timestamp}.json"

            def json_serializer(obj):
                """Custom JSON serializer for complex objects."""
                if hasattr(obj, "isoformat"):  # datetime objects
                    return obj.isoformat()
                elif hasattr(obj, "__dict__"):  # SQLAlchemy models or other objects
                    return str(obj)
                elif isinstance(obj, (list, tuple)):
                    return [json_serializer(item) for item in obj]
                elif isinstance(obj, dict):
                    return {key: json_serializer(value) for key, value in obj.items()}
                else:
                    return str(obj)

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
                    detail=f"JSON serialization failed: {str(json_error)}",
                )

        elif format == ExportFormat.CSV:
            media_type = "text/csv"
            filename = f"medical_records_{scope.value}_{timestamp}.csv"
            content = export_service.convert_to_csv(export_data, scope.value)

        elif format == ExportFormat.PDF:
            if include_files:
                # Create ZIP file with PDF and attached files
                import os

                pdf_content = await export_service.convert_to_pdf(
                    export_data, include_files
                )
                files_info = export_service.get_lab_result_files(
                    current_user_id, start_date, end_date
                )

                if files_info:
                    # Create ZIP file in memory
                    zip_buffer = io.BytesIO()

                    with zipfile.ZipFile(
                        zip_buffer, "w", zipfile.ZIP_DEFLATED
                    ) as zip_file:
                        # Add the PDF to the ZIP
                        pdf_filename = f"medical_records_{scope.value}_{timestamp}.pdf"
                        zip_file.writestr(pdf_filename, pdf_content)

                        # Add each lab result file to the ZIP
                        for file_info in files_info:
                            try:
                                file_path = file_info["file_path"]
                                if os.path.exists(file_path):
                                    # Create a safe filename for the ZIP
                                    safe_filename = f"{file_info['test_name']}_{file_info['file_name']}".replace(
                                        " ", "_"
                                    )
                                    # Remove any potentially problematic characters
                                    safe_filename = "".join(
                                        c
                                        for c in safe_filename
                                        if c.isalnum() or c in "._-"
                                    )

                                    zip_file.write(
                                        file_path, f"lab_files/{safe_filename}"
                                    )
                                else:
                                    logger.warning(
                                        "Lab result file not found during export",
                                        extra={
                                            LogFields.CATEGORY: "app",
                                            LogFields.EVENT: "export_file_not_found",
                                            LogFields.USER_ID: current_user_id,
                                            "file_path": file_path,
                                        },
                                    )
                            except Exception as file_error:
                                logger.error(
                                    f"Failed to add lab file to export ZIP: {file_info['file_name']}",
                                    extra={
                                        LogFields.CATEGORY: "app",
                                        LogFields.EVENT: "export_file_add_failed",
                                        LogFields.USER_ID: current_user_id,
                                        LogFields.ERROR: str(file_error),
                                        "file_name": file_info["file_name"],
                                    },
                                )
                                continue

                    zip_buffer.seek(0)
                    zip_filename = (
                        f"medical_records_{scope.value}_with_files_{timestamp}.zip"
                    )

                    zip_content = zip_buffer.getvalue()
                    log_endpoint_access(
                        logger,
                        request,
                        current_user_id,
                        "export_zip_generated",
                        message=f"Generated ZIP export with files",
                        filename=zip_filename,
                        size_bytes=len(zip_content),
                    )

                    return Response(
                        content=zip_content,
                        media_type="application/zip",
                        headers={
                            "Content-Disposition": f'attachment; filename="{zip_filename}"'
                        },
                    )

            # Generate standard PDF export
            media_type = "application/pdf"
            filename = f"medical_records_{scope.value}_{timestamp}.pdf"
            content = await export_service.convert_to_pdf(export_data, include_files)

        else:
            raise HTTPException(status_code=400, detail="Unsupported export format")

        # Create appropriate response based on format
        if format == ExportFormat.PDF:
            # For PDF, use Response for binary data
            if not content:
                raise HTTPException(
                    status_code=500, detail="Generated PDF content is empty"
                )

            return Response(
                content=content,
                media_type=media_type,
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )
        else:
            # For text-based formats (JSON, CSV), use StreamingResponse
            if isinstance(content, str):
                content_bytes = content.encode("utf-8")
            else:
                content_bytes = content

            # Validate content exists
            if not content_bytes:
                raise HTTPException(
                    status_code=500, detail="Generated content is empty"
                )

            # Create a generator function for the StreamingResponse
            def generate():
                yield content_bytes

            return StreamingResponse(
                generate(),
                media_type=media_type,
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
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
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


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
        raise HTTPException(
            status_code=500, detail=f"Failed to generate export summary: {str(e)}"
        )


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
                "value": "medications",
                "label": "Medications",
                "description": "Current and past medications",
            },
            {
                "value": "lab_results",
                "label": "Lab Results",
                "description": "Laboratory test results",
            },
            {
                "value": "allergies",
                "label": "Allergies",
                "description": "Known allergies and reactions",
            },
            {
                "value": "conditions",
                "label": "Medical Conditions",
                "description": "Diagnosed conditions",
            },
            {
                "value": "immunizations",
                "label": "Immunizations",
                "description": "Vaccination records",
            },
            {
                "value": "procedures",
                "label": "Procedures",
                "description": "Medical procedures performed",
            },
            {
                "value": "treatments",
                "label": "Treatments",
                "description": "Treatment plans and history",
            },
            {
                "value": "encounters",
                "label": "Encounters",
                "description": "Medical visits and consultations",
            },
            {
                "value": "vitals",
                "label": "Vital Signs",
                "description": "Blood pressure, weight, etc.",
            },
            {
                "value": "emergency_contacts",
                "label": "Emergency Contacts",
                "description": "Emergency contact information",
            },
            {
                "value": "practitioners",
                "label": "Healthcare Practitioners",
                "description": "Healthcare providers and specialists",
            },
            {
                "value": "pharmacies",
                "label": "Pharmacies",
                "description": "Pharmacy locations and information",
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
    Each scope is exported as a separate file within the ZIP.
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

        export_service = ExportService(db)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Create ZIP file in memory
        zip_buffer = io.BytesIO()

        # Custom JSON serializer (same as single export)
        def json_serializer(obj):
            """Custom JSON serializer for complex objects."""
            if hasattr(obj, "isoformat"):  # datetime objects
                return obj.isoformat()
            elif hasattr(obj, "__dict__"):  # SQLAlchemy models or other objects
                return str(obj)
            elif isinstance(obj, (list, tuple)):
                return [json_serializer(item) for item in obj]
            elif isinstance(obj, dict):
                return {key: json_serializer(value) for key, value in obj.items()}
            else:
                return str(obj)

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
                        include_files=False,  # Files not supported in bulk export
                        include_patient_info=request.include_patient_info,
                        unit_system=request.unit_system,
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
                        content = export_service.convert_to_csv(export_data, scope)
                        filename = f"medical_records_{scope}_{timestamp}.csv"
                    else:
                        # PDF not supported in bulk for complexity reasons
                        logger.warning(
                            "PDF format not supported in bulk export",
                            extra={
                                LogFields.CATEGORY: "app",
                                LogFields.EVENT: "bulk_export_unsupported_format",
                                LogFields.USER_ID: current_user_id,
                                "scope": scope,
                                "format": request.format.value,
                            },
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

                except Exception as e:
                    logger.warning(
                        f"Failed to export scope in bulk export: {scope}",
                        extra={
                            LogFields.CATEGORY: "app",
                            LogFields.EVENT: "bulk_export_scope_failed",
                            LogFields.USER_ID: current_user_id,
                            LogFields.ERROR: str(e),
                            "scope": scope,
                        },
                    )
                    continue

        if exported_count == 0:
            raise HTTPException(
                status_code=400,
                detail="No data could be exported for the selected scopes",
            )

        zip_buffer.seek(0)
        date_str = datetime.now().strftime("%Y-%m-%d")
        zip_filename = f"medical_records_bulk_{date_str}.zip"

        # Create a generator function for the StreamingResponse
        def generate():
            yield zip_buffer.getvalue()

        log_endpoint_access(
            logger,
            http_request,
            current_user_id,
            "bulk_export_completed",
            message=f"Bulk export completed successfully",
            exported_count=exported_count,
            filename=zip_filename,
        )

        return StreamingResponse(
            generate(),
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'},
        )

    except Exception as e:
        log_endpoint_error(
            logger,
            http_request,
            "Bulk export failed",
            e,
            user_id=current_user_id,
            scope_count=len(request.scopes),
        )
        raise HTTPException(status_code=500, detail=f"Bulk export failed: {str(e)}")
