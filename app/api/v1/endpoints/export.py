"""
Medical Records Export API Endpoints

This module provides endpoints for exporting patient medical data in various formats.
Supports JSON, CSV, and PDF exports with different data scopes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, date
from enum import Enum
from pydantic import BaseModel
import json
import io
import zipfile

from app.api.deps import get_db, get_current_user_id

from app.services.export_service import ExportService
from app.core.logging_config import get_logger

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


class BulkExportRequest(BaseModel):
    scopes: List[ExportScope]
    format: ExportFormat = ExportFormat.JSON
    start_date: Optional[date] = None
    end_date: Optional[date] = None


@router.get("/data")
async def export_patient_data(
    format: ExportFormat = Query(ExportFormat.JSON, description="Export format"),
    scope: ExportScope = Query(ExportScope.ALL, description="Data scope to export"),
    start_date: Optional[date] = Query(None, description="Start date for filtering records"),
    end_date: Optional[date] = Query(None, description="End date for filtering records"),
    include_files: bool = Query(False, description="Include associated files (PDF only)"),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Export patient medical data in the specified format.
    
    - **format**: Output format (json, csv, pdf)
    - **scope**: What data to include (all, medications, lab_results, etc.)
    - **start_date**: Filter records from this date onwards
    - **end_date**: Filter records up to this date
    - **include_files**: Whether to include file attachments (PDF exports only)    """
    
    try:
        logger.info(f"Export request by user {current_user_id}: format={format}, scope={scope}")
        logger.info(f"Format type: {type(format)}, value: {format.value if hasattr(format, 'value') else format}")
        logger.info(f"Scope type: {type(scope)}, value: {scope.value if hasattr(scope, 'value') else scope}")
        
        export_service = ExportService(db)
        
        # Generate the export
        export_data = await export_service.export_patient_data(
            user_id=current_user_id,
            format=format.value,
            scope=scope.value,
            start_date=start_date,
            end_date=end_date,
            include_files=include_files
        )
        
        logger.info(f"Export data generated, type: {type(export_data)}, keys: {list(export_data.keys()) if isinstance(export_data, dict) else 'N/A'}")
        
        # Determine content type and filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        if format == ExportFormat.JSON:
            media_type = "application/json"
            filename = f"medical_records_{scope.value}_{timestamp}.json"
            
            def json_serializer(obj):
                """Custom JSON serializer for complex objects."""
                if hasattr(obj, 'isoformat'):  # datetime objects
                    return obj.isoformat()
                elif hasattr(obj, '__dict__'):  # SQLAlchemy models or other objects
                    return str(obj)
                elif isinstance(obj, (list, tuple)):
                    return [json_serializer(item) for item in obj]
                elif isinstance(obj, dict):
                    return {key: json_serializer(value) for key, value in obj.items()}
                else:
                    return str(obj)
            
            try:
                content = json.dumps(export_data, default=json_serializer, indent=2, ensure_ascii=False)
                logger.info(f"JSON content length: {len(content)}")
            except Exception as json_error:
                logger.error(f"JSON serialization error: {json_error}")
                raise HTTPException(status_code=500, detail=f"JSON serialization failed: {str(json_error)}")
            
        elif format == ExportFormat.CSV:
            media_type = "text/csv"
            filename = f"medical_records_{scope.value}_{timestamp}.csv"
            content = export_service.convert_to_csv(export_data, scope.value)
            
        elif format == ExportFormat.PDF:
            media_type = "application/pdf"
            filename = f"medical_records_{scope.value}_{timestamp}.pdf"
            content = await export_service.convert_to_pdf(export_data, include_files)
            
        else:
            raise HTTPException(status_code=400, detail="Unsupported export format")
        
        # Create appropriate response based on format
        if format == ExportFormat.PDF:
            # For PDF, use Response for binary data
            if not content:
                raise HTTPException(status_code=500, detail="Generated PDF content is empty")
            
            logger.info(f"PDF content type: {type(content)}, size: {len(content)} bytes")
            
            return Response(
                content=content,
                media_type=media_type,
                headers={"Content-Disposition": f"attachment; filename=\"{filename}\""}
            )
        else:
            # For text-based formats (JSON, CSV), use StreamingResponse
            if isinstance(content, str):
                content_bytes = content.encode('utf-8')
            else:
                content_bytes = content
                
            # Validate content exists
            if not content_bytes:
                raise HTTPException(status_code=500, detail="Generated content is empty")
                
            logger.info(f"Content type: {type(content)}, Content bytes length: {len(content_bytes)}")
                
            # Create a generator function for the StreamingResponse
            def generate():
                yield content_bytes
            
            return StreamingResponse(
                generate(),
                media_type=media_type,
                headers={"Content-Disposition": f"attachment; filename=\"{filename}\""}
            )
        
    except Exception as e:
        logger.error(f"Export failed for user {current_user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.get("/summary")
async def get_export_summary(
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
        
        return {
            "status": "success",
            "data": summary,
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to generate export summary for user {current_user_id}: {str(e)}")
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
                "description": "Machine-readable structured data format"
            },
            {
                "value": "csv", 
                "label": "CSV",
                "description": "Comma-separated values for spreadsheet applications"
            },
            {
                "value": "pdf",
                "label": "PDF", 
                "description": "Human-readable document format"
            }
        ],
        "scopes": [
            {"value": "all", "label": "All Records", "description": "Complete medical history"},
            {"value": "medications", "label": "Medications", "description": "Current and past medications"},
            {"value": "lab_results", "label": "Lab Results", "description": "Laboratory test results"},
            {"value": "allergies", "label": "Allergies", "description": "Known allergies and reactions"},
            {"value": "conditions", "label": "Medical Conditions", "description": "Diagnosed conditions"},
            {"value": "immunizations", "label": "Immunizations", "description": "Vaccination records"},
            {"value": "procedures", "label": "Procedures", "description": "Medical procedures performed"},
            {"value": "treatments", "label": "Treatments", "description": "Treatment plans and history"},
            {"value": "encounters", "label": "Encounters", "description": "Medical visits and consultations"},
            {"value": "vitals", "label": "Vital Signs", "description": "Blood pressure, weight, etc."}
        ]
    }


@router.post("/bulk")
async def create_bulk_export(
    request: BulkExportRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Create a bulk export containing multiple data scopes in a ZIP file.
    Each scope is exported as a separate file within the ZIP.
    """
    try:
        logger.info(f"Bulk export request by user {current_user_id}: {len(request.scopes)} scopes, format: {request.format}")
        
        export_service = ExportService(db)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Create ZIP file in memory
        zip_buffer = io.BytesIO()
        
        # Custom JSON serializer (same as single export)
        def json_serializer(obj):
            """Custom JSON serializer for complex objects."""
            if hasattr(obj, 'isoformat'):  # datetime objects
                return obj.isoformat()
            elif hasattr(obj, '__dict__'):  # SQLAlchemy models or other objects
                return str(obj)
            elif isinstance(obj, (list, tuple)):
                return [json_serializer(item) for item in obj]
            elif isinstance(obj, dict):
                return {key: json_serializer(value) for key, value in obj.items()}
            else:
                return str(obj)
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            exported_count = 0
            
            for scope in request.scopes:
                try:
                    # Export each scope
                    export_data = await export_service.export_patient_data(
                        user_id=current_user_id,
                        format=request.format.value,
                        scope=scope.value,
                        start_date=request.start_date,
                        end_date=request.end_date,
                        include_files=False  # Files not supported in bulk export
                    )
                    
                    # Convert to appropriate format
                    if request.format == ExportFormat.JSON:
                        content = json.dumps(export_data, default=json_serializer, indent=2, ensure_ascii=False)
                        filename = f"medical_records_{scope.value}_{timestamp}.json"
                    elif request.format == ExportFormat.CSV:
                        content = export_service.convert_to_csv(export_data, scope.value)
                        filename = f"medical_records_{scope.value}_{timestamp}.csv"
                    else:
                        # PDF not supported in bulk for complexity reasons
                        logger.warning(f"PDF format not supported in bulk export for scope {scope.value}")
                        continue
                    
                    # Add to ZIP
                    zip_file.writestr(filename, content.encode('utf-8') if isinstance(content, str) else content)
                    exported_count += 1
                    logger.info(f"Successfully added {scope.value} to bulk export")
                    
                except Exception as e:
                    logger.warning(f"Failed to export {scope.value} for user {current_user_id}: {str(e)}")
                    continue
        
        if exported_count == 0:
            raise HTTPException(status_code=400, detail="No data could be exported for the selected scopes")
        
        zip_buffer.seek(0)
        zip_filename = f"medical_records_bulk_{timestamp}.zip"
        
        # Create a generator function for the StreamingResponse
        def generate():
            yield zip_buffer.getvalue()
        
        logger.info(f"Bulk export completed: {exported_count} files in ZIP for user {current_user_id}")
        
        return StreamingResponse(
            generate(),
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=\"{zip_filename}\""}
        )
        
    except Exception as e:
        logger.error(f"Bulk export failed for user {current_user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Bulk export failed: {str(e)}")


@router.get("/debug")
async def debug_export_params(
    format: Optional[str] = Query(None),
    scope: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    include_files: Optional[str] = Query(None),
    current_user_id: int = Depends(get_current_user_id),
):
    """Debug endpoint to see what parameters are being sent by the frontend."""
    return {
        "received_params": {
            "format": format,
            "scope": scope,
            "start_date": start_date,
            "end_date": end_date,
            "include_files": include_files,
            "user_id": current_user_id
        },
        "param_types": {
            "format": type(format).__name__,
            "scope": type(scope).__name__,
            "start_date": type(start_date).__name__,
            "end_date": type(end_date).__name__,
            "include_files": type(include_files).__name__
        }
    }
