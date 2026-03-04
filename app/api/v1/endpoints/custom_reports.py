"""
Custom Reports API Endpoints

This module provides endpoints for generating custom medical reports
with selective record inclusion and template management.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id, get_db
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_endpoint_access, log_endpoint_error, log_security_event, log_validation_error
from app.models.models import User
from app.schemas.custom_reports import (
    CustomReportRequest, DataSummaryResponse, ReportTemplate,
    ReportTemplateResponse, TemplateActionResponse
)
from app.schemas.trend_charts import TrendChartSelection
from app.services.custom_report_service import CustomReportService
from app.services.trend_data_fetcher import TrendDataFetcher

logger = get_logger(__name__, "app")

router = APIRouter()


def _get_active_patient_id(db: Session, user_id: int) -> Optional[int]:
    """Look up the active patient ID for a user. Returns None if not set."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.active_patient_id:
        return None
    return user.active_patient_id


@router.get("/data-summary", response_model=DataSummaryResponse)
async def get_custom_report_data_summary(
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get summary of all medical data available for custom report generation.
    Returns counts and basic info for each category to support UI selection.
    """
    try:
        service = CustomReportService(db)
        summary = await service.get_data_summary_for_selection(current_user_id)
        log_endpoint_access(
            logger,
            request,
            current_user_id,
            "custom_report_data_summary_retrieved",
            total_records=summary.total_records,
            category_count=len(summary.categories)
        )
        return summary
    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Failed to retrieve custom report data summary",
            e,
            user_id=current_user_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve data summary"
        )


@router.post("/generate")
async def generate_custom_report(
    http_request: Request,
    request: CustomReportRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Generate a custom PDF report with selected records from various categories.
    """
    try:
        service = CustomReportService(db)

        # Validate user owns all selected records (skip if no records selected)
        if request.selected_records:
            await service.validate_record_ownership(current_user_id, request.selected_records)

        # Generate the report
        pdf_data = await service.generate_selective_report(current_user_id, request)
        
        # Return PDF response
        filename = f"custom-medical-report-{current_user_id}.pdf"
        return Response(
            content=pdf_data,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
        
    except PermissionError as e:
        log_security_event(
            logger,
            "custom_report_permission_denied",
            http_request,
            "User attempted to generate report with unauthorized records",
            user_id=current_user_id
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ValueError as e:
        log_validation_error(
            logger,
            http_request,
            str(e),
            user_id=current_user_id
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        log_endpoint_error(
            logger,
            http_request,
            "Custom report generation failed",
            e,
            user_id=current_user_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Report generation failed"
        )


@router.get("/available-trend-data")
async def get_available_trend_data(
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get available vital types and lab test names that have data for trend charts.
    Returns lists the frontend can use to populate chart selection UI.
    """
    try:
        patient_id = _get_active_patient_id(db, current_user_id)
        if not patient_id:
            return {"vital_types": [], "lab_test_names": []}

        fetcher = TrendDataFetcher(db)
        vital_types = fetcher.get_available_vital_types(patient_id)
        lab_test_names = fetcher.get_available_lab_test_names(patient_id)

        log_endpoint_access(
            logger,
            request,
            current_user_id,
            "available_trend_data_retrieved",
            vital_type_count=len(vital_types),
            lab_test_count=len(lab_test_names)
        )

        return {
            "vital_types": vital_types,
            "lab_test_names": lab_test_names,
        }
    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Failed to retrieve available trend data",
            e,
            user_id=current_user_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve available trend data"
        )


@router.post("/trend-chart-counts")
async def get_trend_chart_counts(
    chart_selection: TrendChartSelection,
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get record counts for selected trend charts filtered by their time ranges.
    Used by the UI to show how many data points each chart will include.
    """
    try:
        patient_id = _get_active_patient_id(db, current_user_id)
        if not patient_id:
            return {"vital_counts": {}, "lab_test_counts": {}}

        fetcher = TrendDataFetcher(db)

        vital_counts = {
            chart.vital_type: fetcher.count_vital_records(
                patient_id, chart.vital_type, chart.date_from, chart.date_to,
            )
            for chart in chart_selection.vital_charts
        }

        lab_test_counts = {
            chart.test_name: fetcher.count_lab_test_records(
                patient_id, chart.test_name, chart.date_from, chart.date_to,
            )
            for chart in chart_selection.lab_test_charts
        }

        log_endpoint_access(
            logger,
            request,
            current_user_id,
            "trend_chart_counts_retrieved",
            vital_chart_count=len(vital_counts),
            lab_test_chart_count=len(lab_test_counts),
        )

        return {
            "vital_counts": vital_counts,
            "lab_test_counts": lab_test_counts,
        }
    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Failed to retrieve trend chart counts",
            e,
            user_id=current_user_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve trend chart counts"
        )


@router.post("/templates", response_model=TemplateActionResponse)
async def save_report_template(
    request: Request,
    template: ReportTemplate,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Save a custom report template for future use.
    """
    try:
        service = CustomReportService(db)
        template_id = await service.save_report_template(current_user_id, template)

        log_endpoint_access(
            logger,
            request,
            current_user_id,
            "report_template_saved",
            template_id=template_id,
            template_name=template.name
        )
        return TemplateActionResponse(
            success=True,
            message="Template saved successfully",
            template_id=template_id
        )

    except ValueError as e:
        log_validation_error(
            logger,
            request,
            str(e),
            user_id=current_user_id
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Failed to save report template",
            e,
            user_id=current_user_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save template"
        )


@router.get("/templates", response_model=List[ReportTemplate])
async def get_saved_templates(
    request: Request,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get all saved report templates for the current user.
    """
    try:
        service = CustomReportService(db)
        templates = await service.get_saved_templates(current_user_id)
        return templates
    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Failed to retrieve report templates",
            e,
            user_id=current_user_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve templates"
        )


@router.get("/templates/{template_id}", response_model=ReportTemplate)
async def get_template(
    request: Request,
    template_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get a specific report template by ID.
    """
    try:
        service = CustomReportService(db)
        template = await service.get_template(current_user_id, template_id)

        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )

        return template
    except HTTPException:
        raise
    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Failed to retrieve report template by ID",
            e,
            user_id=current_user_id,
            template_id=template_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve template"
        )


@router.put("/templates/{template_id}", response_model=TemplateActionResponse)
async def update_template(
    request: Request,
    template_id: int,
    template: ReportTemplate,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Update an existing report template.
    """
    try:
        service = CustomReportService(db)
        updated = await service.update_template(current_user_id, template_id, template)

        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )

        log_endpoint_access(
            logger,
            request,
            current_user_id,
            "report_template_updated",
            template_id=template_id,
            template_name=template.name
        )
        return TemplateActionResponse(
            success=True,
            message="Template updated successfully",
            template_id=template_id
        )

    except HTTPException:
        raise
    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Failed to update report template",
            e,
            user_id=current_user_id,
            template_id=template_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update template"
        )


@router.delete("/templates/{template_id}", response_model=TemplateActionResponse)
async def delete_template(
    request: Request,
    template_id: int,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Delete (soft delete) a report template.
    """
    try:
        service = CustomReportService(db)
        deleted = await service.delete_template(current_user_id, template_id)

        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )

        log_endpoint_access(
            logger,
            request,
            current_user_id,
            "report_template_deleted",
            template_id=template_id
        )
        return TemplateActionResponse(
            success=True,
            message="Template deleted successfully",
            template_id=template_id
        )

    except HTTPException:
        raise
    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Failed to delete report template",
            e,
            user_id=current_user_id,
            template_id=template_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete template"
        )