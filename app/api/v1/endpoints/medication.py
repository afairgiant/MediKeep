from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
from app.core.http.error_handling import (
    NotFoundException,
    ForbiddenException,
    BusinessLogicException,
    handle_database_errors
)
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.logging.helpers import log_data_access
from app.crud.medication import medication
from app.models.activity_log import EntityType
from app.models.models import User
from app.schemas.medication import (
    MedicationCreate,
    MedicationResponse,
    MedicationResponseWithNested,
    MedicationUpdate,
)

router = APIRouter()

# Initialize logger
logger = get_logger(__name__, "app")


@router.post("/", response_model=MedicationResponseWithNested)
def create_medication(
    *,
    medication_in: MedicationCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create new medication."""
    medication_obj = handle_create_with_logging(
        db=db,
        crud_obj=medication,
        obj_in=medication_in,
        entity_type=EntityType.MEDICATION,
        user_id=current_user_id,
        entity_name="Medication",
        request=request,
    )

    # Return with relationships loaded
    medication_id = getattr(medication_obj, "id", None)
    if medication_id:
        return medication.get_with_relations(
            db=db, record_id=medication_id, relations=["practitioner", "pharmacy", "condition"]
        )
    return medication_obj


@router.get("/", response_model=List[MedicationResponseWithNested])
def read_medications(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    name: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    tag_match_all: bool = Query(False, description="Match all tags (AND) vs any tag (OR)"),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Retrieve medications for the current user or specified patient (Phase 1 support)."""

    with handle_database_errors(request=request):
        if tags:
            # Use tag filtering with patient constraint
            filters = {"patient_id": target_patient_id}
            if status:
                filters["status"] = status
            medications = medication.get_multi_with_tag_filters(
                db,
                tags=tags,
                tag_match_all=tag_match_all,
                skip=skip,
                limit=limit,
                **filters
            )
            # Load relationships manually for tag-filtered results
            for med in medications:
                if hasattr(med, 'practitioner_id') and med.practitioner_id:
                    db.refresh(med, ["practitioner"])
                if hasattr(med, 'pharmacy_id') and med.pharmacy_id:
                    db.refresh(med, ["pharmacy"])
                if hasattr(med, 'condition_id') and med.condition_id:
                    db.refresh(med, ["condition"])
            # Apply name filter manually if both tags and name are specified
            if name:
                medications = [
                    med
                    for med in medications
                    if name.lower() in getattr(med, "medication_name", "").lower()
                ]
        elif status and status == "active":
            # Use optimized method for active medications
            medications = medication.get_active_by_patient(
                db=db, patient_id=target_patient_id
            )
        elif name:
            # Filter by medication name
            medications = medication.get_by_name(
                db=db, name=name, patient_id=target_patient_id, skip=skip, limit=limit
            )
        elif status:
            # Filter by status (other than active)
            medications = medication.query(
                db=db,
                filters={"patient_id": target_patient_id, "status": status},
                skip=skip,
                limit=limit,
                load_relations=["practitioner", "pharmacy", "condition"],
            )
        else:
            # Use regular patient filtering
            medications = medication.get_by_patient(
                db=db,
                patient_id=target_patient_id,
                skip=skip,
                limit=limit,
                load_relations=["practitioner", "pharmacy", "condition"],
            )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Medication",
            patient_id=target_patient_id,
            count=len(medications)
        )

        return medications


@router.get("/{medication_id}", response_model=MedicationResponseWithNested)
def read_medication(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    medication_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get medication by ID - only allows access to user's own medications."""
    with handle_database_errors(request=request):
        medication_obj = medication.get_with_relations(
            db=db, record_id=medication_id, relations=["practitioner", "pharmacy", "condition"]
        )
        handle_not_found(medication_obj, "Medication", request)
        verify_patient_ownership(medication_obj, current_user_patient_id, "medication")

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Medication",
            record_id=medication_id,
            patient_id=current_user_patient_id
        )

        return medication_obj


@router.put("/{medication_id}", response_model=MedicationResponseWithNested)
def update_medication(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    medication_id: int,
    medication_in: MedicationUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Update a medication."""
    updated_medication = handle_update_with_logging(
        db=db,
        crud_obj=medication,
        entity_id=medication_id,
        obj_in=medication_in,
        entity_type=EntityType.MEDICATION,
        user_id=current_user_id,
        entity_name="Medication",
        request=request,
        current_user=current_user,
        current_user_patient_id=current_user_patient_id,
    )

    # Return with relationships loaded
    return medication.get_with_relations(
        db=db, record_id=medication_id, relations=["practitioner", "pharmacy", "condition"]
    )


@router.delete("/{medication_id}")
def delete_medication(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    medication_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Delete a medication."""
    return handle_delete_with_logging(
        db=db,
        crud_obj=medication,
        entity_id=medication_id,
        entity_type=EntityType.MEDICATION,
        user_id=current_user_id,
        entity_name="Medication",
        request=request,
        current_user=current_user,
        current_user_patient_id=current_user_patient_id,
    )


@router.get("/patient/{patient_id}", response_model=List[MedicationResponseWithNested])
def read_patient_medications(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    active_only: bool = Query(False),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all medications for a specific patient."""
    with handle_database_errors(request=request):
        if active_only:
            medications = medication.get_active_by_patient(db=db, patient_id=patient_id)
        else:
            medications = medication.get_by_patient(
                db=db,
                patient_id=patient_id,
                skip=skip,
                limit=limit,
                load_relations=["practitioner", "pharmacy", "condition"],
            )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Medication",
            patient_id=patient_id,
            count=len(medications)
        )

        return medications
