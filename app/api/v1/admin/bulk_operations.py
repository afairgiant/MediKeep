"""
Admin Bulk Operations API - Batch operations on multiple records

Provides bulk operations like delete, update status, and batch modifications
across multiple records of the same model type.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api import deps
from app.models.models import User
from app.api.v1.admin.models import MODEL_REGISTRY

router = APIRouter()


class BulkDeleteRequest(BaseModel):
    """Schema for bulk delete operations"""

    model_name: str
    record_ids: List[int]


class BulkUpdateRequest(BaseModel):
    """Schema for bulk update operations"""

    model_name: str
    record_ids: List[int]
    update_data: Dict[str, Any]


class BulkOperationResponse(BaseModel):
    """Schema for bulk operation responses"""

    success: bool
    affected_records: int
    failed_records: List[int]
    message: str


@router.post("/delete", response_model=BulkOperationResponse)
def bulk_delete_records(
    request: BulkDeleteRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Delete multiple records at once"""

    if request.model_name not in MODEL_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{request.model_name}' not found",
        )

    model_info = MODEL_REGISTRY[request.model_name]
    crud_instance = model_info["crud"]

    success_count = 0
    failed_records = []

    for record_id in request.record_ids:
        try:
            # Check if record exists
            record = crud_instance.get(db, id=record_id)
            if record:
                crud_instance.delete(db, id=record_id)
                success_count += 1
            else:
                failed_records.append(record_id)
        except Exception:
            failed_records.append(record_id)

    return BulkOperationResponse(
        success=len(failed_records) == 0,
        affected_records=success_count,
        failed_records=failed_records,
        message=f"Successfully deleted {success_count} {request.model_name} records",
    )


@router.post("/update", response_model=BulkOperationResponse)
def bulk_update_records(
    request: BulkUpdateRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Update multiple records with the same data"""

    if request.model_name not in MODEL_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{request.model_name}' not found",
        )

    model_info = MODEL_REGISTRY[request.model_name]
    crud_instance = model_info["crud"]

    success_count = 0
    failed_records = []

    for record_id in request.record_ids:
        try:
            # Get existing record
            record = crud_instance.get(db, id=record_id)
            if record:
                # Update with provided data
                crud_instance.update(db, db_obj=record, obj_in=request.update_data)
                success_count += 1
            else:
                failed_records.append(record_id)
        except Exception:
            failed_records.append(record_id)

    return BulkOperationResponse(
        success=len(failed_records) == 0,
        affected_records=success_count,
        failed_records=failed_records,
        message=f"Successfully updated {success_count} {request.model_name} records",
    )
