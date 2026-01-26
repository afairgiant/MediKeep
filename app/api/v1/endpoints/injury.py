"""
API endpoints for Injury entity and its relationships.

Injury represents a physical injury record for a patient.
"""
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.api.deps import NotFoundException, ForbiddenException, BusinessLogicException
from app.core.http.error_handling import handle_database_errors
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_data_access, log_security_event
from app.models.models import User
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
from app.crud.injury import (
    injury,
    injury_medication,
    injury_condition,
    injury_treatment,
    injury_procedure,
)
from app.crud.medication import medication as medication_crud
from app.crud.condition import condition as condition_crud
from app.crud.treatment import treatment as treatment_crud
from app.crud.procedure import procedure as procedure_crud
from app.models.activity_log import EntityType
from app.schemas.injury import (
    InjuryCreate,
    InjuryResponse,
    InjuryUpdate,
    InjuryWithRelations,
    InjuryMedicationCreate,
    InjuryMedicationResponse,
    InjuryMedicationWithDetails,
    InjuryConditionCreate,
    InjuryConditionResponse,
    InjuryConditionWithDetails,
    InjuryTreatmentCreate,
    InjuryTreatmentResponse,
    InjuryTreatmentWithDetails,
    InjuryProcedureCreate,
    InjuryProcedureResponse,
    InjuryProcedureWithDetails,
)

router = APIRouter()

# Initialize logger
logger = get_logger(__name__, "app")


# =====================================================
# Main Injury CRUD endpoints
# =====================================================

@router.post("/", response_model=InjuryWithRelations)
def create_injury(
    *,
    injury_in: InjuryCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create a new injury record."""
    injury_obj = handle_create_with_logging(
        db=db,
        crud_obj=injury,
        obj_in=injury_in,
        entity_type=EntityType.INJURY,
        user_id=current_user_id,
        entity_name="Injury",
        request=request,
    )

    # Return with relationships loaded
    if injury_obj:
        return injury.get_with_relations(db=db, record_id=injury_obj.id)
    return injury_obj


@router.get("/", response_model=List[InjuryWithRelations])
def read_injuries(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    status: Optional[str] = Query(None, description="Filter by status (active/healing/resolved/chronic)"),
    injury_type_id: Optional[int] = Query(None, description="Filter by injury type"),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    tag_match_all: bool = Query(False, description="Match all tags (AND) vs any tag (OR)"),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Retrieve injuries for the specified patient."""
    with handle_database_errors(request=request):
        if tags:
            # Use tag filtering with patient constraint
            filters = {"patient_id": target_patient_id}
            if status:
                filters["status"] = status
            if injury_type_id:
                filters["injury_type_id"] = injury_type_id
            injuries = injury.get_multi_with_tag_filters(
                db,
                tags=tags,
                tag_match_all=tag_match_all,
                skip=skip,
                limit=limit,
                **filters
            )
        elif status:
            injuries = injury.get_by_status(
                db, status=status, patient_id=target_patient_id
            )
        elif injury_type_id:
            injuries = injury.get_by_type(
                db, patient_id=target_patient_id, injury_type_id=injury_type_id
            )
        else:
            injuries = injury.get_by_patient(
                db, patient_id=target_patient_id, skip=skip, limit=limit
            )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Injury",
            patient_id=target_patient_id,
            count=len(injuries)
        )

        return injuries


@router.get("/{injury_id}", response_model=InjuryWithRelations)
def read_injury(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    injury_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get an injury by ID with related information."""
    with handle_database_errors(request=request):
        injury_obj = injury.get_with_relations(db=db, record_id=injury_id)
        handle_not_found(injury_obj, "Injury")
        verify_patient_ownership(injury_obj, current_user_patient_id, "injury")

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Injury",
            record_id=injury_id,
            patient_id=current_user_patient_id
        )

        return injury_obj


@router.put("/{injury_id}", response_model=InjuryWithRelations)
def update_injury(
    *,
    injury_id: int,
    injury_in: InjuryUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Update an injury."""
    updated = handle_update_with_logging(
        db=db,
        crud_obj=injury,
        entity_id=injury_id,
        obj_in=injury_in,
        entity_type=EntityType.INJURY,
        user_id=current_user_id,
        entity_name="Injury",
        request=request,
        current_user=current_user,
        current_user_patient_id=current_user_patient_id,
    )
    # Return with relations
    return injury.get_with_relations(db=db, record_id=injury_id)


@router.delete("/{injury_id}")
def delete_injury(
    *,
    injury_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Delete an injury."""
    return handle_delete_with_logging(
        db=db,
        crud_obj=injury,
        entity_id=injury_id,
        entity_type=EntityType.INJURY,
        user_id=current_user_id,
        entity_name="Injury",
        request=request,
        current_user=current_user,
        current_user_patient_id=current_user_patient_id,
    )


# =====================================================
# Injury-Medication relationship endpoints
# =====================================================

@router.get("/{injury_id}/medications", response_model=List[InjuryMedicationWithDetails])
def get_injury_medications(
    *,
    injury_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all medications linked to an injury."""
    with handle_database_errors(request=request):
        # Verify injury exists and belongs to user
        db_injury = injury.get(db, id=injury_id)
        handle_not_found(db_injury, "Injury")
        verify_patient_ownership(db_injury, current_user_patient_id, "injury")

        relationships = injury_medication.get_by_injury(db, injury_id=injury_id)

        # Enhance with medication details
        enhanced = []
        for rel in relationships:
            med = medication_crud.get(db, id=rel.medication_id)
            enhanced.append({
                "id": rel.id,
                "injury_id": rel.injury_id,
                "medication_id": rel.medication_id,
                "relevance_note": rel.relevance_note,
                "created_at": rel.created_at,
                "updated_at": rel.updated_at,
                "medication": {
                    "id": med.id,
                    "medication_name": med.medication_name,
                    "dosage": med.dosage,
                    "status": med.status,
                } if med else None
            })

        log_data_access(
            logger, request, current_user_id, "read", "InjuryMedication",
            record_id=injury_id, patient_id=current_user_patient_id, count=len(relationships)
        )

        return enhanced


@router.post("/{injury_id}/medications", response_model=InjuryMedicationResponse)
def create_injury_medication(
    *,
    injury_id: int,
    medication_in: InjuryMedicationCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Link a medication to an injury."""
    with handle_database_errors(request=request):
        # Verify injury exists and belongs to user
        db_injury = injury.get(db, id=injury_id)
        handle_not_found(db_injury, "Injury")
        verify_patient_ownership(db_injury, current_user_patient_id, "injury")

        # Verify medication exists and belongs to same patient
        db_medication = medication_crud.get(db, id=medication_in.medication_id)
        handle_not_found(db_medication, "Medication")
        if db_medication.patient_id != current_user_patient_id:
            raise BusinessLogicException(
                message="Cannot link medication that belongs to a different patient",
                request=request
            )

        # Check if relationship already exists
        existing = injury_medication.get_by_injury_and_medication(
            db, injury_id=injury_id, medication_id=medication_in.medication_id
        )
        if existing:
            raise BusinessLogicException(
                message="This medication is already linked to this injury",
                request=request
            )

        medication_in.injury_id = injury_id
        relationship = injury_medication.create(db, obj_in=medication_in)

        log_data_access(
            logger, request, current_user_id, "create", "InjuryMedication",
            record_id=relationship.id, patient_id=current_user_patient_id,
            injury_id=injury_id, medication_id=medication_in.medication_id
        )

        return relationship


@router.delete("/{injury_id}/medications/{medication_id}")
def delete_injury_medication(
    *,
    injury_id: int,
    medication_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Unlink a medication from an injury."""
    with handle_database_errors(request=request):
        # Verify injury exists and belongs to user
        db_injury = injury.get(db, id=injury_id)
        handle_not_found(db_injury, "Injury")
        verify_patient_ownership(db_injury, current_user_patient_id, "injury")

        success = injury_medication.delete_by_injury_and_medication(
            db, injury_id=injury_id, medication_id=medication_id
        )
        if not success:
            raise NotFoundException(
                resource="InjuryMedication",
                message="Medication relationship not found",
                request=request
            )

        log_data_access(
            logger, request, current_user_id, "delete", "InjuryMedication",
            patient_id=current_user_patient_id, injury_id=injury_id, medication_id=medication_id
        )

        return {"message": "Medication unlinked from injury"}


# =====================================================
# Injury-Condition relationship endpoints
# =====================================================

@router.get("/{injury_id}/conditions", response_model=List[InjuryConditionWithDetails])
def get_injury_conditions(
    *,
    injury_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all conditions linked to an injury."""
    with handle_database_errors(request=request):
        db_injury = injury.get(db, id=injury_id)
        handle_not_found(db_injury, "Injury")
        verify_patient_ownership(db_injury, current_user_patient_id, "injury")

        relationships = injury_condition.get_by_injury(db, injury_id=injury_id)

        enhanced = []
        for rel in relationships:
            cond = condition_crud.get(db, id=rel.condition_id)
            enhanced.append({
                "id": rel.id,
                "injury_id": rel.injury_id,
                "condition_id": rel.condition_id,
                "relevance_note": rel.relevance_note,
                "created_at": rel.created_at,
                "updated_at": rel.updated_at,
                "condition": {
                    "id": cond.id,
                    "diagnosis": cond.diagnosis,
                    "status": cond.status,
                    "severity": cond.severity,
                } if cond else None
            })

        log_data_access(
            logger, request, current_user_id, "read", "InjuryCondition",
            record_id=injury_id, patient_id=current_user_patient_id, count=len(relationships)
        )

        return enhanced


@router.post("/{injury_id}/conditions", response_model=InjuryConditionResponse)
def create_injury_condition(
    *,
    injury_id: int,
    condition_in: InjuryConditionCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Link a condition to an injury."""
    with handle_database_errors(request=request):
        db_injury = injury.get(db, id=injury_id)
        handle_not_found(db_injury, "Injury")
        verify_patient_ownership(db_injury, current_user_patient_id, "injury")

        db_condition = condition_crud.get(db, id=condition_in.condition_id)
        handle_not_found(db_condition, "Condition")
        if db_condition.patient_id != current_user_patient_id:
            raise BusinessLogicException(
                message="Cannot link condition that belongs to a different patient",
                request=request
            )

        existing = injury_condition.get_by_injury_and_condition(
            db, injury_id=injury_id, condition_id=condition_in.condition_id
        )
        if existing:
            raise BusinessLogicException(
                message="This condition is already linked to this injury",
                request=request
            )

        condition_in.injury_id = injury_id
        relationship = injury_condition.create(db, obj_in=condition_in)

        log_data_access(
            logger, request, current_user_id, "create", "InjuryCondition",
            record_id=relationship.id, patient_id=current_user_patient_id,
            injury_id=injury_id, condition_id=condition_in.condition_id
        )

        return relationship


@router.delete("/{injury_id}/conditions/{condition_id}")
def delete_injury_condition(
    *,
    injury_id: int,
    condition_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Unlink a condition from an injury."""
    with handle_database_errors(request=request):
        db_injury = injury.get(db, id=injury_id)
        handle_not_found(db_injury, "Injury")
        verify_patient_ownership(db_injury, current_user_patient_id, "injury")

        success = injury_condition.delete_by_injury_and_condition(
            db, injury_id=injury_id, condition_id=condition_id
        )
        if not success:
            raise NotFoundException(
                resource="InjuryCondition",
                message="Condition relationship not found",
                request=request
            )

        log_data_access(
            logger, request, current_user_id, "delete", "InjuryCondition",
            patient_id=current_user_patient_id, injury_id=injury_id, condition_id=condition_id
        )

        return {"message": "Condition unlinked from injury"}


# =====================================================
# Injury-Treatment relationship endpoints
# =====================================================

@router.get("/{injury_id}/treatments", response_model=List[InjuryTreatmentWithDetails])
def get_injury_treatments(
    *,
    injury_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all treatments linked to an injury."""
    with handle_database_errors(request=request):
        db_injury = injury.get(db, id=injury_id)
        handle_not_found(db_injury, "Injury")
        verify_patient_ownership(db_injury, current_user_patient_id, "injury")

        relationships = injury_treatment.get_by_injury(db, injury_id=injury_id)

        enhanced = []
        for rel in relationships:
            treat = treatment_crud.get(db, id=rel.treatment_id)
            enhanced.append({
                "id": rel.id,
                "injury_id": rel.injury_id,
                "treatment_id": rel.treatment_id,
                "relevance_note": rel.relevance_note,
                "created_at": rel.created_at,
                "updated_at": rel.updated_at,
                "treatment": {
                    "id": treat.id,
                    "treatment_name": treat.treatment_name,
                    "status": treat.status,
                } if treat else None
            })

        log_data_access(
            logger, request, current_user_id, "read", "InjuryTreatment",
            record_id=injury_id, patient_id=current_user_patient_id, count=len(relationships)
        )

        return enhanced


@router.post("/{injury_id}/treatments", response_model=InjuryTreatmentResponse)
def create_injury_treatment(
    *,
    injury_id: int,
    treatment_in: InjuryTreatmentCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Link a treatment to an injury."""
    with handle_database_errors(request=request):
        db_injury = injury.get(db, id=injury_id)
        handle_not_found(db_injury, "Injury")
        verify_patient_ownership(db_injury, current_user_patient_id, "injury")

        db_treatment = treatment_crud.get(db, id=treatment_in.treatment_id)
        handle_not_found(db_treatment, "Treatment")
        if db_treatment.patient_id != current_user_patient_id:
            raise BusinessLogicException(
                message="Cannot link treatment that belongs to a different patient",
                request=request
            )

        existing = injury_treatment.get_by_injury_and_treatment(
            db, injury_id=injury_id, treatment_id=treatment_in.treatment_id
        )
        if existing:
            raise BusinessLogicException(
                message="This treatment is already linked to this injury",
                request=request
            )

        treatment_in.injury_id = injury_id
        relationship = injury_treatment.create(db, obj_in=treatment_in)

        log_data_access(
            logger, request, current_user_id, "create", "InjuryTreatment",
            record_id=relationship.id, patient_id=current_user_patient_id,
            injury_id=injury_id, treatment_id=treatment_in.treatment_id
        )

        return relationship


@router.delete("/{injury_id}/treatments/{treatment_id}")
def delete_injury_treatment(
    *,
    injury_id: int,
    treatment_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Unlink a treatment from an injury."""
    with handle_database_errors(request=request):
        db_injury = injury.get(db, id=injury_id)
        handle_not_found(db_injury, "Injury")
        verify_patient_ownership(db_injury, current_user_patient_id, "injury")

        success = injury_treatment.delete_by_injury_and_treatment(
            db, injury_id=injury_id, treatment_id=treatment_id
        )
        if not success:
            raise NotFoundException(
                resource="InjuryTreatment",
                message="Treatment relationship not found",
                request=request
            )

        log_data_access(
            logger, request, current_user_id, "delete", "InjuryTreatment",
            patient_id=current_user_patient_id, injury_id=injury_id, treatment_id=treatment_id
        )

        return {"message": "Treatment unlinked from injury"}


# =====================================================
# Injury-Procedure relationship endpoints
# =====================================================

@router.get("/{injury_id}/procedures", response_model=List[InjuryProcedureWithDetails])
def get_injury_procedures(
    *,
    injury_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all procedures linked to an injury."""
    with handle_database_errors(request=request):
        db_injury = injury.get(db, id=injury_id)
        handle_not_found(db_injury, "Injury")
        verify_patient_ownership(db_injury, current_user_patient_id, "injury")

        relationships = injury_procedure.get_by_injury(db, injury_id=injury_id)

        enhanced = []
        for rel in relationships:
            proc = procedure_crud.get(db, id=rel.procedure_id)
            enhanced.append({
                "id": rel.id,
                "injury_id": rel.injury_id,
                "procedure_id": rel.procedure_id,
                "relevance_note": rel.relevance_note,
                "created_at": rel.created_at,
                "updated_at": rel.updated_at,
                "procedure": {
                    "id": proc.id,
                    "procedure_name": proc.procedure_name,
                    "status": proc.status,
                } if proc else None
            })

        log_data_access(
            logger, request, current_user_id, "read", "InjuryProcedure",
            record_id=injury_id, patient_id=current_user_patient_id, count=len(relationships)
        )

        return enhanced


@router.post("/{injury_id}/procedures", response_model=InjuryProcedureResponse)
def create_injury_procedure(
    *,
    injury_id: int,
    procedure_in: InjuryProcedureCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Link a procedure to an injury."""
    with handle_database_errors(request=request):
        db_injury = injury.get(db, id=injury_id)
        handle_not_found(db_injury, "Injury")
        verify_patient_ownership(db_injury, current_user_patient_id, "injury")

        db_procedure = procedure_crud.get(db, id=procedure_in.procedure_id)
        handle_not_found(db_procedure, "Procedure")
        if db_procedure.patient_id != current_user_patient_id:
            raise BusinessLogicException(
                message="Cannot link procedure that belongs to a different patient",
                request=request
            )

        existing = injury_procedure.get_by_injury_and_procedure(
            db, injury_id=injury_id, procedure_id=procedure_in.procedure_id
        )
        if existing:
            raise BusinessLogicException(
                message="This procedure is already linked to this injury",
                request=request
            )

        procedure_in.injury_id = injury_id
        relationship = injury_procedure.create(db, obj_in=procedure_in)

        log_data_access(
            logger, request, current_user_id, "create", "InjuryProcedure",
            record_id=relationship.id, patient_id=current_user_patient_id,
            injury_id=injury_id, procedure_id=procedure_in.procedure_id
        )

        return relationship


@router.delete("/{injury_id}/procedures/{procedure_id}")
def delete_injury_procedure(
    *,
    injury_id: int,
    procedure_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Unlink a procedure from an injury."""
    with handle_database_errors(request=request):
        db_injury = injury.get(db, id=injury_id)
        handle_not_found(db_injury, "Injury")
        verify_patient_ownership(db_injury, current_user_patient_id, "injury")

        success = injury_procedure.delete_by_injury_and_procedure(
            db, injury_id=injury_id, procedure_id=procedure_id
        )
        if not success:
            raise NotFoundException(
                resource="InjuryProcedure",
                message="Procedure relationship not found",
                request=request
            )

        log_data_access(
            logger, request, current_user_id, "delete", "InjuryProcedure",
            patient_id=current_user_patient_id, injury_id=injury_id, procedure_id=procedure_id
        )

        return {"message": "Procedure unlinked from injury"}


# =====================================================
# Convenience endpoints
# =====================================================

@router.get("/patient/{patient_id}/active", response_model=List[InjuryWithRelations])
def get_active_injuries(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all active injuries for a patient."""
    with handle_database_errors(request=request):
        injuries = injury.get_active_injuries(db, patient_id=patient_id)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Injury",
            patient_id=patient_id,
            count=len(injuries)
        )

        return injuries
