"""
Custom Reports API Endpoints

This module provides endpoints for generating custom medical reports
with selective record inclusion and template management.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id, get_db
from app.core.logging_config import get_logger
from app.schemas.custom_reports import (
    CustomReportRequest, DataSummaryResponse, ReportTemplate,
    ReportTemplateResponse, TemplateActionResponse
)
from app.services.custom_report_service import CustomReportService

logger = get_logger(__name__, "app")

router = APIRouter()


@router.get("/data-summary", response_model=DataSummaryResponse)
async def get_custom_report_data_summary(
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
        return summary
    except Exception as e:
        logger.error(f"Failed to get data summary for user {current_user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve data summary"
        )


@router.post("/generate")
async def generate_custom_report(
    request: CustomReportRequest,
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Generate a custom PDF report with selected records from various categories.
    """
    try:
        service = CustomReportService(db)
        
        # Validate user owns all selected records
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
        logger.warning(f"Permission denied for user {current_user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except ValueError as e:
        logger.warning(f"Validation error for user {current_user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Report generation failed for user {current_user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Report generation failed"
        )


@router.post("/templates", response_model=TemplateActionResponse)
async def save_report_template(
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
        
        logger.info(f"Template saved successfully for user {current_user_id}")
        return TemplateActionResponse(
            success=True,
            message="Template saved successfully",
            template_id=template_id
        )
        
    except ValueError as e:
        logger.warning(f"Template save validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to save template for user {current_user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save template"
        )


@router.get("/templates", response_model=List[ReportTemplate])
async def get_saved_templates(
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
        logger.error(f"Failed to get templates for user {current_user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve templates"
        )


@router.get("/templates/{template_id}", response_model=ReportTemplate)
async def get_template(
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
        logger.error(f"Failed to get template {template_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve template"
        )


@router.put("/templates/{template_id}", response_model=TemplateActionResponse)
async def update_template(
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
        
        logger.info(f"Template {template_id} updated by user {current_user_id}")
        return TemplateActionResponse(
            success=True,
            message="Template updated successfully",
            template_id=template_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update template {template_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update template"
        )


@router.delete("/templates/{template_id}", response_model=TemplateActionResponse)
async def delete_template(
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
        
        logger.info(f"Template {template_id} deleted by user {current_user_id}")
        return TemplateActionResponse(
            success=True,
            message="Template deleted successfully",
            template_id=template_id
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete template {template_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete template"
        )