"""API endpoints for Medical Equipment."""
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.core.http.error_handling import handle_database_errors
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_data_access
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
from app.crud.medical_equipment import medical_equipment
from app.models.activity_log import EntityType
from app.models.models import User
from app.schemas.medical_equipment import (
    MedicalEquipmentCreate,
    MedicalEquipmentResponse,
    MedicalEquipmentUpdate,
    MedicalEquipmentWithRelations,
    MedicalEquipmentSummary,
)

router = APIRouter()

# Initialize logger
logger = get_logger(__name__, "app")


@router.post("/", response_model=MedicalEquipmentResponse)
def create_medical_equipment(
    *,
    equipment_in: MedicalEquipmentCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create new medical equipment record."""
    return handle_create_with_logging(
        db=db,
        crud_obj=medical_equipment,
        obj_in=equipment_in,
        entity_type=EntityType.MEDICAL_EQUIPMENT,
        user_id=current_user_id,
        entity_name="MedicalEquipment",
        request=request,
    )


@router.get("/", response_model=List[MedicalEquipmentResponse])
def read_medical_equipment(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    status: Optional[str] = Query(None),
    equipment_type: Optional[str] = Query(None),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    tag_match_all: bool = Query(False, description="Match all tags (AND) vs any tag (OR)"),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Retrieve medical equipment for the current user or accessible patient."""
    with handle_database_errors(request=request):
        if tags:
            filters = {"patient_id": target_patient_id}
            if status:
                filters["status"] = status
            if equipment_type:
                filters["equipment_type"] = equipment_type.lower()
            equipment_list = medical_equipment.get_multi_with_tag_filters(
                db,
                tags=tags,
                tag_match_all=tag_match_all,
                skip=skip,
                limit=limit,
                **filters
            )
        elif equipment_type:
            equipment_list = medical_equipment.get_by_type(
                db,
                patient_id=target_patient_id,
                equipment_type=equipment_type,
                skip=skip,
                limit=limit,
            )
        else:
            equipment_list = medical_equipment.get_by_patient(
                db,
                patient_id=target_patient_id,
                skip=skip,
                limit=limit,
                status=status,
            )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "MedicalEquipment",
            patient_id=target_patient_id,
            count=len(equipment_list)
        )

        return equipment_list


@router.get("/active", response_model=List[MedicalEquipmentResponse])
def get_active_equipment(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all active equipment for a patient."""
    with handle_database_errors(request=request):
        equipment_list = medical_equipment.get_active_equipment(
            db, patient_id=target_patient_id
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "MedicalEquipment",
            patient_id=target_patient_id,
            count=len(equipment_list),
            status="active"
        )

        return equipment_list


@router.get("/needing-service", response_model=List[MedicalEquipmentResponse])
def get_equipment_needing_service(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get equipment that needs service soon (within 30 days or overdue)."""
    with handle_database_errors(request=request):
        equipment_list = medical_equipment.get_needing_service(
            db, patient_id=target_patient_id
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "MedicalEquipment",
            patient_id=target_patient_id,
            count=len(equipment_list),
            filter="needing_service"
        )

        return equipment_list


@router.get("/{equipment_id}", response_model=MedicalEquipmentWithRelations)
def read_single_equipment(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    equipment_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get medical equipment by ID with related information."""
    with handle_database_errors(request=request):
        equipment_obj = medical_equipment.get_with_relations(
            db=db,
            record_id=equipment_id,
            relations=["patient", "practitioner"],
        )
        handle_not_found(equipment_obj, "MedicalEquipment", request)
        verify_patient_ownership(equipment_obj, current_user_patient_id, "medical equipment")

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "MedicalEquipment",
            record_id=equipment_id,
            patient_id=current_user_patient_id
        )

        return equipment_obj


@router.put("/{equipment_id}", response_model=MedicalEquipmentResponse)
def update_medical_equipment(
    *,
    equipment_id: int,
    equipment_in: MedicalEquipmentUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Update medical equipment."""
    return handle_update_with_logging(
        db=db,
        crud_obj=medical_equipment,
        entity_id=equipment_id,
        obj_in=equipment_in,
        entity_type=EntityType.MEDICAL_EQUIPMENT,
        user_id=current_user_id,
        entity_name="MedicalEquipment",
        request=request,
        current_user=current_user,
        current_user_patient_id=current_user_patient_id,
    )


@router.delete("/{equipment_id}")
def delete_medical_equipment(
    *,
    equipment_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Delete medical equipment."""
    return handle_delete_with_logging(
        db=db,
        crud_obj=medical_equipment,
        entity_id=equipment_id,
        entity_type=EntityType.MEDICAL_EQUIPMENT,
        user_id=current_user_id,
        entity_name="MedicalEquipment",
        request=request,
        current_user=current_user,
        current_user_patient_id=current_user_patient_id,
    )
