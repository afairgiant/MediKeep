from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.core.error_handling import handle_database_errors
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
from app.crud.symptom import symptom_parent, symptom_occurrence, symptom_condition, symptom_medication, symptom_treatment
from app.models.activity_log import EntityType
from app.models.models import User
from app.schemas.symptom import (
    SymptomCreate,
    SymptomResponse,
    SymptomUpdate,
    SymptomOccurrenceCreate,
    SymptomOccurrenceResponse,
    SymptomOccurrenceUpdate,
    SymptomConditionCreate,
    SymptomConditionResponse,
    SymptomMedicationCreate,
    SymptomMedicationResponse,
    SymptomTreatmentCreate,
    SymptomTreatmentResponse,
)

router = APIRouter()


@router.post("/", response_model=SymptomResponse)
def create_symptom(
    *,
    symptom_in: SymptomCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create new symptom definition (parent)."""
    return handle_create_with_logging(
        db=db,
        crud_obj=symptom_parent,
        obj_in=symptom_in,
        entity_type=EntityType.SYMPTOM,
        user_id=current_user_id,
        entity_name="Symptom",
        request=request,
    )


@router.get("/", response_model=List[SymptomResponse])
def read_symptoms(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """
    Retrieve symptom definitions for the current user or specified patient.
    Supports filtering by status and search term.
    Note: Severity filtering removed as severity is per-occurrence, not per-symptom.
    """
    with handle_database_errors(request=request):
        # Apply filters based on query parameters
        if search:
            # Search by symptom name
            symptoms_list = symptom_parent.search_by_name(
                db=db,
                patient_id=target_patient_id,
                search_term=search,
                skip=skip,
                limit=limit
            )
        elif status:
            # Filter by status - uses get_by_patient with status filter
            symptoms_list = symptom_parent.get_by_patient(
                db=db,
                patient_id=target_patient_id,
                status=status,
                skip=skip,
                limit=limit
            )
        else:
            # Get all symptoms
            symptoms_list = symptom_parent.get_by_patient(
                db=db,
                patient_id=target_patient_id,
                skip=skip,
                limit=limit
            )

        return symptoms_list


@router.get("/stats", response_model=dict)
def read_symptom_stats(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: Optional[int] = Query(None, description="Patient ID for patient switching"),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get symptom statistics for the current user or specified patient."""
    with handle_database_errors(request=request):
        # Use patient_id if provided, otherwise fall back to user's own patient
        if patient_id is not None:
            target_patient_id = patient_id
        else:
            target_patient_id = deps.get_current_user_patient_id(db, current_user_id)

        stats = symptom_parent.get_symptom_stats(db=db, patient_id=target_patient_id)
        return stats


@router.get("/timeline", response_model=List[dict])
def read_symptom_timeline(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: Optional[int] = Query(None, description="Patient ID for patient switching"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get symptom timeline data formatted for visualization."""
    with handle_database_errors(request=request):
        # Use patient_id if provided, otherwise fall back to user's own patient
        if patient_id is not None:
            target_patient_id = patient_id
        else:
            target_patient_id = deps.get_current_user_patient_id(db, current_user_id)

        # Parse dates if provided
        from datetime import datetime
        start_dt = datetime.fromisoformat(start_date) if start_date else None
        end_dt = datetime.fromisoformat(end_date) if end_date else None

        timeline_data = symptom_occurrence.get_timeline_data(
            db=db,
            patient_id=target_patient_id,
            start_date=start_dt,
            end_date=end_dt
        )
        return timeline_data


@router.get("/{symptom_id}", response_model=SymptomResponse)
def read_symptom_by_id(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    symptom_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get symptom entry by ID - allows access to symptoms from any of user's patients."""
    with handle_database_errors(request=request):
        symptom_obj = symptom_parent.get_with_relations(
            db=db, record_id=symptom_id, relations=["patient"]
        )
        handle_not_found(symptom_obj, "Symptom", request)
        verify_patient_ownership(symptom_obj, current_user_patient_id, "symptom", db=db, current_user=current_user)
        return symptom_obj


@router.put("/{symptom_id}", response_model=SymptomResponse)
def update_symptom(
    *,
    symptom_id: int,
    symptom_in: SymptomUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Update symptom definition."""
    return handle_update_with_logging(
        db=db,
        crud_obj=symptom_parent,
        entity_id=symptom_id,
        obj_in=symptom_in,
        entity_type=EntityType.SYMPTOM,
        user_id=current_user_id,
        entity_name="Symptom",
        request=request,
    )


@router.delete("/{symptom_id}")
def delete_symptom(
    *,
    symptom_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Delete a symptom definition (and all its occurrences via cascade)."""
    return handle_delete_with_logging(
        db=db,
        crud_obj=symptom_parent,
        entity_id=symptom_id,
        entity_type=EntityType.SYMPTOM,
        user_id=current_user_id,
        entity_name="Symptom",
        request=request,
    )


# ============================================================================
# Symptom Occurrence Endpoints (Individual Episodes)
# ============================================================================


@router.post("/{symptom_id}/occurrences", response_model=SymptomOccurrenceResponse)
def log_symptom_occurrence(
    *,
    symptom_id: int,
    occurrence_in: SymptomOccurrenceCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Log a new occurrence/episode of a symptom."""
    with handle_database_errors(request=request):
        # Verify symptom exists and belongs to user
        symptom_obj = symptom_parent.get(db=db, id=symptom_id)
        handle_not_found(symptom_obj, "Symptom", request)
        verify_patient_ownership(symptom_obj, current_user_patient_id, "symptom", db=db, current_user=current_user)

        # Create occurrence with symptom_id from path (prevent override from body)
        occurrence = symptom_occurrence.create(
            db=db,
            obj_in=SymptomOccurrenceCreate(
                symptom_id=symptom_id,  # Force path param, ignore any symptom_id in body
                **{k: v for k, v in occurrence_in.model_dump().items() if k != 'symptom_id'}
            )
        )

        return occurrence


@router.get("/{symptom_id}/occurrences", response_model=List[SymptomOccurrenceResponse])
def read_symptom_occurrences(
    *,
    symptom_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get all occurrences for a specific symptom."""
    with handle_database_errors(request=request):
        # Verify symptom exists and belongs to user
        symptom_obj = symptom_parent.get(db=db, id=symptom_id)
        handle_not_found(symptom_obj, "Symptom", request)
        verify_patient_ownership(symptom_obj, current_user_patient_id, "symptom", db=db, current_user=current_user)

        # Get occurrences
        occurrences = symptom_occurrence.get_by_symptom(
            db=db,
            symptom_id=symptom_id,
            skip=skip,
            limit=limit
        )
        return occurrences


@router.get("/{symptom_id}/occurrences/{occurrence_id}", response_model=SymptomOccurrenceResponse)
def read_symptom_occurrence_by_id(
    *,
    symptom_id: int,
    occurrence_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get a specific symptom occurrence by ID."""
    with handle_database_errors(request=request):
        # Verify symptom exists and belongs to user
        symptom_obj = symptom_parent.get(db=db, id=symptom_id)
        handle_not_found(symptom_obj, "Symptom", request)
        verify_patient_ownership(symptom_obj, current_user_patient_id, "symptom", db=db, current_user=current_user)

        # Get occurrence
        occurrence = symptom_occurrence.get(db=db, id=occurrence_id)
        handle_not_found(occurrence, "Symptom Occurrence", request)

        # Verify occurrence belongs to this symptom
        if occurrence.symptom_id != symptom_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Occurrence not found for this symptom")

        return occurrence


@router.put("/{symptom_id}/occurrences/{occurrence_id}", response_model=SymptomOccurrenceResponse)
def update_symptom_occurrence(
    *,
    symptom_id: int,
    occurrence_id: int,
    occurrence_in: SymptomOccurrenceUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Update a symptom occurrence."""
    with handle_database_errors(request=request):
        # Verify symptom exists and belongs to user
        symptom_obj = symptom_parent.get(db=db, id=symptom_id)
        handle_not_found(symptom_obj, "Symptom", request)
        verify_patient_ownership(symptom_obj, current_user_patient_id, "symptom", db=db, current_user=current_user)

        # Get and update occurrence
        occurrence = symptom_occurrence.get(db=db, id=occurrence_id)
        handle_not_found(occurrence, "Symptom Occurrence", request)

        # Verify occurrence belongs to this symptom
        if occurrence.symptom_id != symptom_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Occurrence not found for this symptom")

        updated_occurrence = symptom_occurrence.update(db=db, db_obj=occurrence, obj_in=occurrence_in)
        return updated_occurrence


@router.delete("/{symptom_id}/occurrences/{occurrence_id}")
def delete_symptom_occurrence(
    *,
    symptom_id: int,
    occurrence_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Delete a symptom occurrence."""
    with handle_database_errors(request=request):
        # Verify symptom exists and belongs to user
        symptom_obj = symptom_parent.get(db=db, id=symptom_id)
        handle_not_found(symptom_obj, "Symptom", request)
        verify_patient_ownership(symptom_obj, current_user_patient_id, "symptom", db=db, current_user=current_user)

        # Get and delete occurrence
        occurrence = symptom_occurrence.get(db=db, id=occurrence_id)
        handle_not_found(occurrence, "Symptom Occurrence", request)

        # Verify occurrence belongs to this symptom
        if occurrence.symptom_id != symptom_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Occurrence not found for this symptom")

        symptom_occurrence.delete(db=db, id=occurrence_id)
        return {"message": "Symptom occurrence deleted successfully"}


# ============================================================================
# Relationship Endpoints (Phase 2)
# ============================================================================


@router.post("/{symptom_id}/link-condition", response_model=SymptomConditionResponse)
def link_symptom_to_condition(
    *,
    symptom_id: int,
    link_data: SymptomConditionCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Link a symptom to a condition."""
    with handle_database_errors(request=request):
        # Verify symptom ownership
        symptom_obj = symptom_parent.get(db=db, id=symptom_id)
        handle_not_found(symptom_obj, "Symptom", request)
        verify_patient_ownership(symptom_obj, current_user_patient_id, "symptom", db=db, current_user=current_user)

        # Check if relationship already exists
        existing = symptom_condition.get_by_symptom_and_condition(
            db=db, symptom_id=symptom_id, condition_id=link_data.condition_id
        )
        if existing:
            return existing

        # Create new relationship
        return symptom_condition.create(db=db, obj_in=link_data)


@router.get("/{symptom_id}/conditions", response_model=List[SymptomConditionResponse])
def get_symptom_conditions(
    *,
    symptom_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get all conditions linked to a symptom."""
    with handle_database_errors(request=request):
        symptom_obj = symptom_parent.get(db=db, id=symptom_id)
        handle_not_found(symptom_obj, "Symptom", request)
        verify_patient_ownership(symptom_obj, current_user_patient_id, "symptom", db=db, current_user=current_user)

        return symptom_condition.get_by_symptom(db=db, symptom_id=symptom_id)


@router.delete("/{symptom_id}/unlink-condition/{condition_id}")
def unlink_symptom_from_condition(
    *,
    symptom_id: int,
    condition_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Unlink a symptom from a condition."""
    with handle_database_errors(request=request):
        symptom_obj = symptom_parent.get(db=db, id=symptom_id)
        handle_not_found(symptom_obj, "Symptom", request)
        verify_patient_ownership(symptom_obj, current_user_patient_id, "symptom", db=db, current_user=current_user)

        success = symptom_condition.delete_by_symptom_and_condition(
            db=db, symptom_id=symptom_id, condition_id=condition_id
        )

        if not success:
            return {"status": "error", "message": "Relationship not found"}

        return {"status": "success", "message": "Relationship deleted"}


@router.post("/{symptom_id}/link-medication", response_model=SymptomMedicationResponse)
def link_symptom_to_medication(
    *,
    symptom_id: int,
    link_data: SymptomMedicationCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Link a symptom to a medication."""
    with handle_database_errors(request=request):
        symptom_obj = symptom_parent.get(db=db, id=symptom_id)
        handle_not_found(symptom_obj, "Symptom", request)
        verify_patient_ownership(symptom_obj, current_user_patient_id, "symptom", db=db, current_user=current_user)

        # Check if relationship already exists
        existing = symptom_medication.get_by_symptom_and_medication(
            db=db, symptom_id=symptom_id, medication_id=link_data.medication_id
        )
        if existing:
            return existing

        return symptom_medication.create(db=db, obj_in=link_data)


@router.get("/{symptom_id}/medications", response_model=List[SymptomMedicationResponse])
def get_symptom_medications(
    *,
    symptom_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get all medications linked to a symptom."""
    with handle_database_errors(request=request):
        symptom_obj = symptom_parent.get(db=db, id=symptom_id)
        handle_not_found(symptom_obj, "Symptom", request)
        verify_patient_ownership(symptom_obj, current_user_patient_id, "symptom", db=db, current_user=current_user)

        return symptom_medication.get_by_symptom(db=db, symptom_id=symptom_id)


@router.delete("/{symptom_id}/unlink-medication/{medication_id}")
def unlink_symptom_from_medication(
    *,
    symptom_id: int,
    medication_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Unlink a symptom from a medication."""
    with handle_database_errors(request=request):
        symptom_obj = symptom_parent.get(db=db, id=symptom_id)
        handle_not_found(symptom_obj, "Symptom", request)
        verify_patient_ownership(symptom_obj, current_user_patient_id, "symptom", db=db, current_user=current_user)

        success = symptom_medication.delete_by_symptom_and_medication(
            db=db, symptom_id=symptom_id, medication_id=medication_id
        )

        if not success:
            return {"status": "error", "message": "Relationship not found"}

        return {"status": "success", "message": "Relationship deleted"}


@router.post("/{symptom_id}/link-treatment", response_model=SymptomTreatmentResponse)
def link_symptom_to_treatment(
    *,
    symptom_id: int,
    link_data: SymptomTreatmentCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Link a symptom to a treatment."""
    with handle_database_errors(request=request):
        symptom_obj = symptom_parent.get(db=db, id=symptom_id)
        handle_not_found(symptom_obj, "Symptom", request)
        verify_patient_ownership(symptom_obj, current_user_patient_id, "symptom", db=db, current_user=current_user)

        # Check if relationship already exists
        existing = symptom_treatment.get_by_symptom_and_treatment(
            db=db, symptom_id=symptom_id, treatment_id=link_data.treatment_id
        )
        if existing:
            return existing

        return symptom_treatment.create(db=db, obj_in=link_data)


@router.get("/{symptom_id}/treatments", response_model=List[SymptomTreatmentResponse])
def get_symptom_treatments(
    *,
    symptom_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get all treatments linked to a symptom."""
    with handle_database_errors(request=request):
        symptom_obj = symptom_parent.get(db=db, id=symptom_id)
        handle_not_found(symptom_obj, "Symptom", request)
        verify_patient_ownership(symptom_obj, current_user_patient_id, "symptom", db=db, current_user=current_user)

        return symptom_treatment.get_by_symptom(db=db, symptom_id=symptom_id)


@router.delete("/{symptom_id}/unlink-treatment/{treatment_id}")
def unlink_symptom_from_treatment(
    *,
    symptom_id: int,
    treatment_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Unlink a symptom from a treatment."""
    with handle_database_errors(request=request):
        symptom_obj = symptom_parent.get(db=db, id=symptom_id)
        handle_not_found(symptom_obj, "Symptom", request)
        verify_patient_ownership(symptom_obj, current_user_patient_id, "symptom", db=db, current_user=current_user)

        success = symptom_treatment.delete_by_symptom_and_treatment(
            db=db, symptom_id=symptom_id, treatment_id=treatment_id
        )

        if not success:
            return {"status": "error", "message": "Relationship not found"}

        return {"status": "success", "message": "Relationship deleted"}
