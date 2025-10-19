from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.api.deps import NotFoundException, ForbiddenException, BusinessLogicException
from app.core.http.error_handling import handle_database_errors
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.logging.helpers import (
    log_endpoint_access,
    log_endpoint_error,
    log_data_access,
    log_security_event,
)
from app.models.models import User
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

# Initialize logger
logger = get_logger(__name__, "app")


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
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    status: Optional[str] = Query(None),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    tag_match_all: bool = Query(False, description="Match all tags (AND) vs any tag (OR)"),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Retrieve conditions for the current user or specified patient (Phase 1 support)."""
    with handle_database_errors(request=request):
        # Filter conditions by the verified accessible patient_id
        if tags:
            # Use tag filtering with patient constraint
            filters = {"patient_id": target_patient_id}
            if status:
                filters["status"] = status
            conditions = condition.get_multi_with_tag_filters(
                db,
                tags=tags,
                tag_match_all=tag_match_all,
                skip=skip,
                limit=limit,
                **filters
            )
        elif status:
            conditions = condition.get_by_status(
                db, status=status, patient_id=target_patient_id
            )
        else:
            conditions = condition.get_by_patient(
                db, patient_id=target_patient_id, skip=skip, limit=limit
            )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Condition",
            patient_id=target_patient_id,
            count=len(conditions)
        )

        return conditions


@router.get("/dropdown", response_model=List[ConditionDropdownOption])
def get_conditions_for_dropdown(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
    active_only: bool = Query(False, description="Only return active conditions"),
) -> Any:
    """Get conditions formatted for dropdown selection in forms."""
    with handle_database_errors(request=request):
        if active_only:
            conditions = condition.get_active_conditions(
                db, patient_id=current_user_patient_id
            )
        else:
            conditions = condition.get_by_patient(db, patient_id=current_user_patient_id)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Condition",
            patient_id=current_user_patient_id,
            count=len(conditions)
        )

        return conditions


# Simple condition medications endpoint
@router.get("/condition-medications/{condition_id}")
def get_condition_medications(
    condition_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """Simple endpoint to get medications for a condition."""
    with handle_database_errors(request=request):
        # Verify condition exists and belongs to the current user
        db_condition = condition.get(db, id=condition_id)
        if not db_condition:
            log_security_event(
                logger,
                "condition_not_found",
                request,
                f"Condition with ID {condition_id} not found",
                user_id=current_user_id
            )
            raise NotFoundException(
                resource="Condition",
                message=f"Condition with ID {condition_id} not found",
                request=request
            )

        # Verify condition belongs to current user
        if db_condition.patient_id != current_user_patient_id:
            log_security_event(
                logger,
                "unauthorized_condition_access",
                request,
                f"User attempted to access condition {condition_id} without permission",
                user_id=current_user_id,
                condition_id=condition_id
            )
            raise NotFoundException(
                resource="Condition",
                message="Condition not found",
                request=request
            )

        relationships = condition_medication.get_by_condition(db, condition_id=condition_id)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "ConditionMedication",
            record_id=condition_id,
            patient_id=current_user_patient_id,
            count=len(relationships)
        )

        return [{
            "id": rel.id,
            "medication_id": rel.medication_id,
            "condition_id": rel.condition_id,
            "relevance_note": rel.relevance_note,
            "created_at": rel.created_at,
            "updated_at": rel.updated_at
        } for rel in relationships]


@router.post("/{condition_id}/medications", response_model=ConditionMedicationResponse)
def create_condition_medication(
    *,
    condition_id: int,
    medication_in: ConditionMedicationCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create a new condition medication relationship."""
    with handle_database_errors(request=request):
        # Verify condition exists and belongs to the current user
        db_condition = condition.get(db, id=condition_id)
        if not db_condition:
            log_security_event(
                logger,
                "condition_not_found",
                request,
                f"Condition with ID {condition_id} not found",
                user_id=current_user_id
            )
            raise NotFoundException(
                resource="Condition",
                message=f"Condition with ID {condition_id} not found",
                request=request
            )

        # Verify condition belongs to current user
        if db_condition.patient_id != current_user_patient_id:
            log_security_event(
                logger,
                "unauthorized_condition_access",
                request,
                f"User attempted to access condition {condition_id} without permission",
                user_id=current_user_id,
                condition_id=condition_id
            )
            raise NotFoundException(
                resource="Condition",
                message="Condition not found",
                request=request
            )

        # Verify medication exists and belongs to the same patient
        db_medication = medication_crud.get(db, id=medication_in.medication_id)
        if not db_medication:
            log_security_event(
                logger,
                "medication_not_found",
                request,
                f"Medication with ID {medication_in.medication_id} not found",
                user_id=current_user_id
            )
            raise NotFoundException(
                resource="Medication",
                message=f"Medication with ID {medication_in.medication_id} not found",
                request=request
            )

        # Ensure medication belongs to the same patient as the condition
        if db_medication.patient_id != current_user_patient_id:
            log_security_event(
                logger,
                "cross_patient_medication_link",
                request,
                f"User attempted to link medication {medication_in.medication_id} from different patient",
                user_id=current_user_id,
                medication_id=medication_in.medication_id,
                condition_id=condition_id
            )
            raise BusinessLogicException(
                message="Cannot link medication that doesn't belong to the same patient",
                request=request
            )

        # Check if relationship already exists
        existing = condition_medication.get_by_condition_and_medication(
            db, condition_id=condition_id, medication_id=medication_in.medication_id
        )
        if existing:
            raise BusinessLogicException(
                message="Relationship between this condition and medication already exists",
                request=request
            )

        # Set condition_id and create relationship
        medication_in.condition_id = condition_id

        # Create the relationship
        relationship = condition_medication.create(db, obj_in=medication_in)

        log_data_access(
            logger,
            request,
            current_user_id,
            "create",
            "ConditionMedication",
            record_id=relationship.id,
            patient_id=current_user_patient_id,
            condition_id=condition_id,
            medication_id=medication_in.medication_id
        )

        return relationship


@router.put("/{condition_id}/medications/{relationship_id}", response_model=ConditionMedicationResponse)
def update_condition_medication(
    *,
    condition_id: int,
    relationship_id: int,
    medication_in: ConditionMedicationUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Update a condition medication relationship."""
    with handle_database_errors(request=request):
        # Verify condition exists and user has access to it
        db_condition = condition.get(db, id=condition_id)
        if not db_condition:
            log_security_event(
                logger,
                "condition_not_found",
                request,
                f"Condition with ID {condition_id} not found",
                user_id=current_user.id
            )
            raise NotFoundException(
                resource="Condition",
                message=f"Condition with ID {condition_id} not found",
                request=request
            )

        # Verify access using multi-patient system
        from app.services.patient_access import PatientAccessService
        from app.models.models import Patient

        patient_record = db.query(Patient).filter(Patient.id == db_condition.patient_id).first()
        if not patient_record:
            log_security_event(
                logger,
                "patient_not_found",
                request,
                f"Patient {db_condition.patient_id} not found for condition {condition_id}",
                user_id=current_user.id
            )
            raise NotFoundException(
                resource="Patient",
                message="Patient not found",
                request=request
            )

        access_service = PatientAccessService(db)
        if not access_service.can_access_patient(current_user, patient_record, "edit"):
            log_security_event(
                logger,
                "unauthorized_condition_edit",
                request,
                f"User denied edit access to condition {condition_id}",
                user_id=current_user.id,
                patient_id=patient_record.id,
                condition_id=condition_id
            )
            raise ForbiddenException(
                message="Access denied to this condition",
                request=request
            )

        # Get the relationship
        relationship = condition_medication.get(db, id=relationship_id)
        if not relationship:
            log_security_event(
                logger,
                "condition_medication_not_found",
                request,
                f"Condition medication relationship {relationship_id} not found",
                user_id=current_user.id
            )
            raise NotFoundException(
                resource="Condition medication relationship",
                message=f"Relationship with ID {relationship_id} not found",
                request=request
            )

        # Verify the relationship belongs to the specified condition
        if relationship.condition_id != condition_id:
            log_security_event(
                logger,
                "condition_medication_mismatch",
                request,
                f"Relationship {relationship_id} does not belong to condition {condition_id}",
                user_id=current_user.id,
                relationship_id=relationship_id,
                condition_id=condition_id
            )
            raise BusinessLogicException(
                message="Relationship does not belong to the specified condition",
                request=request
            )

        # Update the relationship
        updated_relationship = condition_medication.update(db, db_obj=relationship, obj_in=medication_in)

        log_data_access(
            logger,
            request,
            current_user.id,
            "update",
            "ConditionMedication",
            record_id=relationship_id,
            patient_id=patient_record.id,
            condition_id=condition_id
        )

        return updated_relationship


@router.delete("/{condition_id}/medications/{relationship_id}")
def delete_condition_medication(
    *,
    condition_id: int,
    relationship_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Delete a condition medication relationship."""
    with handle_database_errors(request=request):
        # Verify condition exists and user has access to it
        db_condition = condition.get(db, id=condition_id)
        if not db_condition:
            log_security_event(
                logger,
                "condition_not_found",
                request,
                f"Condition with ID {condition_id} not found",
                user_id=current_user.id
            )
            raise NotFoundException(
                resource="Condition",
                message=f"Condition with ID {condition_id} not found",
                request=request
            )

        # Verify access using multi-patient system
        from app.services.patient_access import PatientAccessService
        from app.models.models import Patient

        patient_record = db.query(Patient).filter(Patient.id == db_condition.patient_id).first()
        if not patient_record:
            log_security_event(
                logger,
                "patient_not_found",
                request,
                f"Patient {db_condition.patient_id} not found for condition {condition_id}",
                user_id=current_user.id
            )
            raise NotFoundException(
                resource="Patient",
                message="Patient not found",
                request=request
            )

        access_service = PatientAccessService(db)
        if not access_service.can_access_patient(current_user, patient_record, "edit"):
            log_security_event(
                logger,
                "unauthorized_condition_delete",
                request,
                f"User denied delete access to condition {condition_id}",
                user_id=current_user.id,
                patient_id=patient_record.id,
                condition_id=condition_id
            )
            raise ForbiddenException(
                message="Access denied to this condition",
                request=request
            )

        # Get the relationship
        relationship = condition_medication.get(db, id=relationship_id)
        if not relationship:
            log_security_event(
                logger,
                "condition_medication_not_found",
                request,
                f"Condition medication relationship {relationship_id} not found",
                user_id=current_user.id
            )
            raise NotFoundException(
                resource="Condition medication relationship",
                message=f"Relationship with ID {relationship_id} not found",
                request=request
            )

        # Verify the relationship belongs to the specified condition
        if relationship.condition_id != condition_id:
            log_security_event(
                logger,
                "condition_medication_mismatch",
                request,
                f"Relationship {relationship_id} does not belong to condition {condition_id}",
                user_id=current_user.id,
                relationship_id=relationship_id,
                condition_id=condition_id
            )
            raise BusinessLogicException(
                message="Relationship does not belong to the specified condition",
                request=request
            )

        # Delete the relationship
        condition_medication.delete(db, id=relationship_id)

        log_data_access(
            logger,
            request,
            current_user.id,
            "delete",
            "ConditionMedication",
            record_id=relationship_id,
            patient_id=patient_record.id,
            condition_id=condition_id
        )

        return {"message": "Condition medication relationship deleted successfully"}


# Generic condition routes (must come after specific medication routes)

@router.get("/{condition_id}", response_model=ConditionWithRelations)
def read_condition(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    condition_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get condition by ID with related information - only allows access to user's own conditions."""
    with handle_database_errors(request=request):
        # Get condition and verify it belongs to the user
        condition_obj = condition.get_with_relations(
            db=db,
            record_id=condition_id,
            relations=["patient", "practitioner", "treatments"],
        )
        handle_not_found(condition_obj, "Condition")
        verify_patient_ownership(condition_obj, current_user_patient_id, "condition")

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Condition",
            record_id=condition_id,
            patient_id=current_user_patient_id
        )

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
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all active conditions for a patient."""
    with handle_database_errors(request=request):
        conditions = condition.get_active_conditions(db, patient_id=patient_id)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Condition",
            patient_id=patient_id,
            count=len(conditions)
        )

        return conditions


@router.get(
    "/patients/{patient_id}/conditions/", response_model=List[ConditionResponse]
)
def get_patient_conditions(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    current_user_id: int = Depends(deps.get_current_user_id),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
) -> Any:
    """Get all conditions for a specific patient."""
    with handle_database_errors(request=request):
        conditions = condition.get_by_patient(
            db, patient_id=patient_id, skip=skip, limit=limit
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Condition",
            patient_id=patient_id,
            count=len(conditions)
        )

        return conditions


# Medication-focused endpoints (for showing conditions on medication view)

@router.get("/medication/{medication_id}/conditions", response_model=List[ConditionMedicationWithDetails])
def get_medication_conditions(
    *,
    medication_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """Get all condition relationships for a specific medication."""
    with handle_database_errors(request=request):
        # Verify medication exists and user has access to it
        db_medication = medication_crud.get(db, id=medication_id)
        if not db_medication:
            log_security_event(
                logger,
                "medication_not_found",
                request,
                f"Medication with ID {medication_id} not found",
                user_id=current_user.id
            )
            raise NotFoundException(
                resource="Medication",
                message=f"Medication with ID {medication_id} not found",
                request=request
            )

        # Verify access using multi-patient system
        from app.services.patient_access import PatientAccessService
        from app.models.models import Patient

        patient_record = db.query(Patient).filter(Patient.id == db_medication.patient_id).first()
        if not patient_record:
            log_security_event(
                logger,
                "patient_not_found",
                request,
                f"Patient {db_medication.patient_id} not found for medication {medication_id}",
                user_id=current_user.id
            )
            raise NotFoundException(
                resource="Patient",
                message="Patient not found",
                request=request
            )

        access_service = PatientAccessService(db)
        if not access_service.can_access_patient(current_user, patient_record, "view"):
            log_security_event(
                logger,
                "unauthorized_medication_access",
                request,
                f"User denied view access to medication {medication_id}",
                user_id=current_user.id,
                patient_id=patient_record.id,
                medication_id=medication_id
            )
            raise ForbiddenException(
                message="Access denied to this medication",
                request=request
            )

        # Get condition relationships
        relationships = condition_medication.get_by_medication(db, medication_id=medication_id)

        # Enhance with condition details
        enhanced_relationships = []
        for rel in relationships:
            condition_obj = condition.get(db, id=rel.condition_id)
            # Verify the condition belongs to the same patient as the medication
            if condition_obj and condition_obj.patient_id != db_medication.patient_id:
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

        log_data_access(
            logger,
            request,
            current_user.id,
            "read",
            "ConditionMedication",
            patient_id=patient_record.id,
            medication_id=medication_id,
            count=len(relationships)
        )

        return enhanced_relationships
