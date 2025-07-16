from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
from app.crud.condition import condition, condition_medication
from app.crud.medication import medication as medication_crud
from app.models.activity_log import EntityType
from app.schemas.condition import (
    ConditionCreate,
    ConditionDropdownOption,
    ConditionResponse,
    ConditionUpdate,
    ConditionWithRelations,
    ConditionMedicationCreate,
    ConditionMedicationResponse,
    ConditionMedicationUpdate,
    ConditionMedicationWithDetails,
)

router = APIRouter()


@router.post("/", response_model=ConditionResponse)
def create_condition(
    *,
    condition_in: ConditionCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create new condition."""
    return handle_create_with_logging(
        db=db,
        crud_obj=condition,
        obj_in=condition_in,
        entity_type=EntityType.CONDITION,
        user_id=current_user_id,
        entity_name="Condition",
        request=request,
    )


@router.get("/", response_model=List[ConditionResponse])
def read_conditions(
    *,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    patient_id: Optional[int] = Query(None, description="Patient ID for Phase 1 patient switching"),
    status: Optional[str] = Query(None),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Retrieve conditions for the current user or specified patient (Phase 1 support)."""
    
    # Phase 1 support: Use patient_id if provided, otherwise fall back to user's own patient
    if patient_id is not None:
        target_patient_id = patient_id
    else:
        target_patient_id = deps.get_current_user_patient_id(db, current_user_id)
    
    # Filter conditions by the target patient_id
    if status:
        conditions = condition.get_by_status(
            db, status=status, patient_id=target_patient_id
        )
    else:
        conditions = condition.get_by_patient(
            db, patient_id=target_patient_id, skip=skip, limit=limit
        )
    return conditions


@router.get("/dropdown", response_model=List[ConditionDropdownOption])
def get_conditions_for_dropdown(
    *,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    active_only: bool = Query(False, description="Only return active conditions"),
) -> Any:
    """Get conditions formatted for dropdown selection in forms."""
    if active_only:
        conditions = condition.get_active_conditions(
            db, patient_id=current_user_patient_id
        )
    else:
        conditions = condition.get_by_patient(db, patient_id=current_user_patient_id)

    return conditions


@router.get("/{condition_id}", response_model=ConditionWithRelations)
def read_condition(
    *,
    db: Session = Depends(deps.get_db),
    condition_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Get condition by ID with related information - only allows access to user's own conditions."""
    # Get condition and verify it belongs to the user
    condition_obj = condition.get_with_relations(
        db=db,
        record_id=condition_id,
        relations=["patient", "practitioner", "treatments"],
    )
    handle_not_found(condition_obj, "Condition")
    verify_patient_ownership(condition_obj, current_user_patient_id, "condition")
    return condition_obj


@router.put("/{condition_id}", response_model=ConditionResponse)
def update_condition(
    *,
    condition_id: int,
    condition_in: ConditionUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Update a condition."""
    return handle_update_with_logging(
        db=db,
        crud_obj=condition,
        entity_id=condition_id,
        obj_in=condition_in,
        entity_type=EntityType.CONDITION,
        user_id=current_user_id,
        entity_name="Condition",
        request=request,
    )


@router.delete("/{condition_id}")
def delete_condition(
    *,
    condition_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Delete a condition."""
    return handle_delete_with_logging(
        db=db,
        crud_obj=condition,
        entity_id=condition_id,
        entity_type=EntityType.CONDITION,
        user_id=current_user_id,
        entity_name="Condition",
        request=request,
    )


@router.get("/patient/{patient_id}/active", response_model=List[ConditionResponse])
def get_active_conditions(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
) -> Any:
    """Get all active conditions for a patient."""
    conditions = condition.get_active_conditions(db, patient_id=patient_id)
    return conditions


@router.get(
    "/patients/{patient_id}/conditions/", response_model=List[ConditionResponse]
)
def get_patient_conditions(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
) -> Any:
    """Get all conditions for a specific patient."""
    conditions = condition.get_by_patient(
        db, patient_id=patient_id, skip=skip, limit=limit
    )
    return conditions


# Condition-Medication Relationship Endpoints

@router.get("/{condition_id}/medications", response_model=List[ConditionMedicationWithDetails])
def get_condition_medications(
    *,
    condition_id: int,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Get all medication relationships for a specific condition."""
    # Verify condition exists and belongs to the current user
    db_condition = condition.get(db, id=condition_id)
    handle_not_found(db_condition, "Condition")
    verify_patient_ownership(db_condition, current_user_patient_id, "condition")
    
    # Get medication relationships
    relationships = condition_medication.get_by_condition(db, condition_id=condition_id)
    
    # Enhance with medication details
    enhanced_relationships = []
    for rel in relationships:
        medication_obj = medication_crud.get(db, id=rel.medication_id)
        enhanced_relationships.append({
            "id": rel.id,
            "condition_id": rel.condition_id,
            "medication_id": rel.medication_id,
            "relevance_note": rel.relevance_note,
            "created_at": rel.created_at,
            "updated_at": rel.updated_at,
            "medication": {
                "id": medication_obj.id,
                "medication_name": medication_obj.medication_name,
                "dosage": medication_obj.dosage,
                "frequency": medication_obj.frequency,
                "status": medication_obj.status,
            } if medication_obj else None
        })
    
    return enhanced_relationships


@router.post("/{condition_id}/medications", response_model=ConditionMedicationResponse)
def create_condition_medication(
    *,
    condition_id: int,
    medication_in: ConditionMedicationCreate,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Create a new condition medication relationship."""
    # Verify condition exists and belongs to the current user
    db_condition = condition.get(db, id=condition_id)
    handle_not_found(db_condition, "Condition")
    verify_patient_ownership(db_condition, current_user_patient_id, "condition")
    
    # Verify medication exists and belongs to the same patient
    db_medication = medication_crud.get(db, id=medication_in.medication_id)
    handle_not_found(db_medication, "Medication")
    
    # Ensure medication belongs to the same patient as the condition
    if db_medication.patient_id != current_user_patient_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot link medication that doesn't belong to the same patient"
        )
    
    # Check if relationship already exists
    existing = condition_medication.get_by_condition_and_medication(
        db, condition_id=condition_id, medication_id=medication_in.medication_id
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Relationship between this condition and medication already exists"
        )
    
    # Set condition_id and create relationship
    medication_in.condition_id = condition_id
    
    # Create the relationship
    relationship = condition_medication.create(db, obj_in=medication_in)
    return relationship


@router.put("/{condition_id}/medications/{relationship_id}", response_model=ConditionMedicationResponse)
def update_condition_medication(
    *,
    condition_id: int,
    relationship_id: int,
    medication_in: ConditionMedicationUpdate,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Update a condition medication relationship."""
    # Verify condition exists and belongs to the current user
    db_condition = condition.get(db, id=condition_id)
    handle_not_found(db_condition, "Condition")
    verify_patient_ownership(db_condition, current_user_patient_id, "condition")
    
    # Get the relationship
    relationship = condition_medication.get(db, id=relationship_id)
    handle_not_found(relationship, "Condition medication relationship")
    
    # Verify the relationship belongs to the specified condition
    if relationship.condition_id != condition_id:
        raise HTTPException(
            status_code=400,
            detail="Relationship does not belong to the specified condition"
        )
    
    # Update the relationship
    updated_relationship = condition_medication.update(db, db_obj=relationship, obj_in=medication_in)
    return updated_relationship


@router.delete("/{condition_id}/medications/{relationship_id}")
def delete_condition_medication(
    *,
    condition_id: int,
    relationship_id: int,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Delete a condition medication relationship."""
    # Verify condition exists and belongs to the current user
    db_condition = condition.get(db, id=condition_id)
    handle_not_found(db_condition, "Condition")
    verify_patient_ownership(db_condition, current_user_patient_id, "condition")
    
    # Get the relationship
    relationship = condition_medication.get(db, id=relationship_id)
    handle_not_found(relationship, "Condition medication relationship")
    
    # Verify the relationship belongs to the specified condition
    if relationship.condition_id != condition_id:
        raise HTTPException(
            status_code=400,
            detail="Relationship does not belong to the specified condition"
        )
    
    # Delete the relationship
    condition_medication.delete(db, id=relationship_id)
    return {"message": "Condition medication relationship deleted successfully"}


# Medication-focused endpoints (for showing conditions on medication view)

@router.get("/medication/{medication_id}/conditions", response_model=List[ConditionMedicationWithDetails])
def get_medication_conditions(
    *,
    medication_id: int,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Get all condition relationships for a specific medication."""
    # Verify medication exists and belongs to the current user
    db_medication = medication_crud.get(db, id=medication_id)
    handle_not_found(db_medication, "Medication")
    
    # Ensure medication belongs to the current user
    if db_medication.patient_id != current_user_patient_id:
        raise HTTPException(
            status_code=403,
            detail="Cannot access medication that doesn't belong to you"
        )
    
    # Get condition relationships
    relationships = condition_medication.get_by_medication(db, medication_id=medication_id)
    
    # Enhance with condition details
    enhanced_relationships = []
    for rel in relationships:
        condition_obj = condition.get(db, id=rel.condition_id)
        # Verify the condition belongs to the same patient as the medication
        if condition_obj and condition_obj.patient_id != current_user_patient_id:
            condition_obj = None  # Don't include conditions from other patients
            
        enhanced_relationships.append({
            "id": rel.id,
            "condition_id": rel.condition_id,
            "medication_id": rel.medication_id,
            "relevance_note": rel.relevance_note,
            "created_at": rel.created_at,
            "updated_at": rel.updated_at,
            "condition": {
                "id": condition_obj.id,
                "diagnosis": condition_obj.diagnosis,
                "status": condition_obj.status,
                "severity": condition_obj.severity,
            } if condition_obj else None
        })
    
    return enhanced_relationships
