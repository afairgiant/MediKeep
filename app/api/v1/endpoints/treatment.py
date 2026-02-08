from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.core.http.error_handling import (
    handle_database_errors,
    NotFoundException,
    BusinessLogicException,
)
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.logging.helpers import log_data_access, log_security_event
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
from app.crud.treatment import (
    treatment,
    treatment_medication,
    treatment_encounter,
    treatment_lab_result,
    treatment_equipment,
)
from app.crud.medication import medication as medication_crud
from app.crud.encounter import encounter as encounter_crud
from app.crud.lab_result import lab_result as lab_result_crud
from app.crud.medical_equipment import medical_equipment as equipment_crud
from app.models.activity_log import EntityType
from app.models.models import User
from app.schemas.treatment import (
    TreatmentCreate,
    TreatmentResponse,
    TreatmentUpdate,
    TreatmentWithRelations,
    # Treatment-Medication schemas
    TreatmentMedicationCreate,
    TreatmentMedicationUpdate,
    TreatmentMedicationResponse,
    TreatmentMedicationWithDetails,
    TreatmentMedicationBulkCreate,
    # Treatment-Encounter schemas
    TreatmentEncounterCreate,
    TreatmentEncounterUpdate,
    TreatmentEncounterResponse,
    TreatmentEncounterWithDetails,
    TreatmentEncounterBulkCreate,
    # Treatment-LabResult schemas
    TreatmentLabResultCreate,
    TreatmentLabResultUpdate,
    TreatmentLabResultResponse,
    TreatmentLabResultWithDetails,
    TreatmentLabResultBulkCreate,
    # Treatment-Equipment schemas
    TreatmentEquipmentCreate,
    TreatmentEquipmentUpdate,
    TreatmentEquipmentResponse,
    TreatmentEquipmentWithDetails,
    TreatmentEquipmentBulkCreate,
)

router = APIRouter()

# Initialize logger
logger = get_logger(__name__, "app")


def _serialize_practitioner(practitioner) -> dict | None:
    """Serialize a practitioner relationship to a dict summary."""
    if not practitioner:
        return None
    return {
        "id": practitioner.id,
        "name": practitioner.name,
        "specialty": getattr(practitioner, "specialty", None),
    }


def _serialize_pharmacy(pharmacy) -> dict | None:
    """Serialize a pharmacy relationship to a dict summary."""
    if not pharmacy:
        return None
    return {
        "id": pharmacy.id,
        "name": pharmacy.name,
        "brand": getattr(pharmacy, "brand", None),
    }


@router.post("/", response_model=TreatmentResponse)
def create_treatment(
    *,
    treatment_in: TreatmentCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create new treatment."""
    return handle_create_with_logging(
        db=db,
        crud_obj=treatment,
        obj_in=treatment_in,
        entity_type=EntityType.TREATMENT,
        user_id=current_user_id,
        entity_name="Treatment",
        request=request,
    )


# @router.get("/", response_model=List[TreatmentWithRelations])
@router.get("/", response_model=List[TreatmentResponse])
def read_treatments(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    condition_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    tag_match_all: bool = Query(False, description="Match all tags (AND) vs any tag (OR)"),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Retrieve treatments for the current user or accessible patient."""

    with handle_database_errors(request=request):
        # Filter treatments by the target patient_id
        if tags:
            # Use tag filtering with patient constraint
            filters = {"patient_id": target_patient_id}
            if status:
                filters["status"] = status
            if condition_id:
                filters["condition_id"] = condition_id
            treatments = treatment.get_multi_with_tag_filters(
                db,
                tags=tags,
                tag_match_all=tag_match_all,
                skip=skip,
                limit=limit,
                **filters
            )
        elif status:
            treatments = treatment.get_by_status(
                db,
                status=status,
                patient_id=target_patient_id,
            )
        elif condition_id:
            treatments = treatment.get_by_condition(
                db,
                condition_id=condition_id,
                patient_id=target_patient_id,
                skip=skip,
                limit=limit,
            )
        else:
            treatments = treatment.get_by_patient(
                db,
                patient_id=target_patient_id,
                skip=skip,
                limit=limit,
            )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Treatment",
            patient_id=target_patient_id,
            count=len(treatments)
        )

        return treatments


@router.get("/{treatment_id}", response_model=TreatmentWithRelations)
def read_treatment(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    treatment_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get treatment by ID with related information - only allows access to user's own treatments."""
    with handle_database_errors(request=request):
        treatment_obj = treatment.get_with_relations(
            db=db,
            record_id=treatment_id,
            relations=["patient", "practitioner", "condition"],
        )
        handle_not_found(treatment_obj, "Treatment", request)
        verify_patient_ownership(treatment_obj, current_user_patient_id, "treatment")

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Treatment",
            record_id=treatment_id,
            patient_id=current_user_patient_id
        )

        return treatment_obj


@router.put("/{treatment_id}", response_model=TreatmentResponse)
def update_treatment(
    *,
    treatment_id: int,
    treatment_in: TreatmentUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Update a treatment."""
    return handle_update_with_logging(
        db=db,
        crud_obj=treatment,
        entity_id=treatment_id,
        obj_in=treatment_in,
        entity_type=EntityType.TREATMENT,
        user_id=current_user_id,
        entity_name="Treatment",
        request=request,
        current_user=current_user,
        current_user_patient_id=current_user_patient_id,
    )


@router.delete("/{treatment_id}")
def delete_treatment(
    *,
    treatment_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Delete a treatment."""
    return handle_delete_with_logging(
        db=db,
        crud_obj=treatment,
        entity_id=treatment_id,
        entity_type=EntityType.TREATMENT,
        user_id=current_user_id,
        entity_name="Treatment",
        request=request,
        current_user=current_user,
        current_user_patient_id=current_user_patient_id,
    )


@router.get("/patient/{patient_id}/active", response_model=List[TreatmentResponse])
def get_active_treatments(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all active treatments for a patient."""
    with handle_database_errors(request=request):
        treatments = treatment.get_active_treatments(db, patient_id=patient_id)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Treatment",
            patient_id=patient_id,
            count=len(treatments),
            status="active"
        )

        return treatments


@router.get("/ongoing", response_model=List[TreatmentResponse])
def get_ongoing_treatments(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: Optional[int] = Query(None),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get treatments that are currently ongoing."""
    with handle_database_errors(request=request):
        treatments = treatment.get_ongoing(db, patient_id=patient_id)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Treatment",
            patient_id=patient_id,
            count=len(treatments),
            status="ongoing"
        )

        return treatments


@router.get(
    "/patients/{patient_id}/treatments/", response_model=List[TreatmentResponse]
)
def get_patient_treatments(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all treatments for a specific patient."""
    with handle_database_errors(request=request):
        treatments = treatment.get_by_patient(
            db, patient_id=patient_id, skip=skip, limit=limit
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Treatment",
            patient_id=patient_id,
            count=len(treatments)
        )

        return treatments


# =============================================================================
# Treatment-Medication Relationship Endpoints
# =============================================================================


def _verify_treatment_access(
    db: Session,
    treatment_id: int,
    current_user_patient_id: int,
    current_user_id: int,
    request: Request,
):
    """Helper to verify treatment exists and user has access."""
    db_treatment = treatment.get(db, id=treatment_id)
    if not db_treatment:
        log_security_event(
            logger,
            "treatment_not_found",
            request,
            f"Treatment with ID {treatment_id} not found",
            user_id=current_user_id
        )
        raise NotFoundException(
            resource="Treatment",
            message=f"Treatment with ID {treatment_id} not found",
            request=request
        )
    if db_treatment.patient_id != current_user_patient_id:
        log_security_event(
            logger,
            "unauthorized_treatment_access",
            request,
            f"User attempted to access treatment {treatment_id} without permission",
            user_id=current_user_id,
            treatment_id=treatment_id
        )
        raise NotFoundException(
            resource="Treatment",
            message="Treatment not found",
            request=request
        )
    return db_treatment


@router.get("/{treatment_id}/medications", response_model=List[TreatmentMedicationWithDetails])
def get_treatment_medications(
    *,
    treatment_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all medications linked to a treatment."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        relationships = treatment_medication.get_by_treatment(db, treatment_id=treatment_id)

        # Enrich with medication details and compute effective values
        result = []
        for rel in relationships:
            med = rel.medication
            specific_prescriber = _serialize_practitioner(rel.specific_prescriber)
            specific_pharmacy = _serialize_pharmacy(rel.specific_pharmacy)

            rel_dict = {
                "id": rel.id,
                "treatment_id": rel.treatment_id,
                "medication_id": rel.medication_id,
                "specific_dosage": rel.specific_dosage,
                "specific_frequency": rel.specific_frequency,
                "specific_duration": rel.specific_duration,
                "timing_instructions": rel.timing_instructions,
                "relevance_note": rel.relevance_note,
                "specific_prescriber_id": rel.specific_prescriber_id,
                "specific_pharmacy_id": rel.specific_pharmacy_id,
                "specific_start_date": rel.specific_start_date,
                "specific_end_date": rel.specific_end_date,
                "created_at": rel.created_at,
                "updated_at": rel.updated_at,
                "specific_prescriber": specific_prescriber,
                "specific_pharmacy": specific_pharmacy,
                "medication": None,
            }

            if med:
                med_practitioner = _serialize_practitioner(med.practitioner)
                med_pharmacy = _serialize_pharmacy(med.pharmacy)

                rel_dict["medication"] = {
                    "id": med.id,
                    "medication_name": med.medication_name,
                    "dosage": med.dosage,
                    "frequency": med.frequency,
                    "route": med.route,
                    "status": med.status,
                    "effective_period_start": med.effective_period_start,
                    "effective_period_end": med.effective_period_end,
                    "practitioner": med_practitioner,
                    "pharmacy": med_pharmacy,
                }

                # Compute effective values (specific overrides fall back to medication defaults)
                rel_dict["effective_dosage"] = rel.specific_dosage or med.dosage
                rel_dict["effective_frequency"] = rel.specific_frequency or med.frequency
                effective_start = rel.specific_start_date or med.effective_period_start
                rel_dict["effective_start_date"] = effective_start
                # Discard fallback end date that falls before the overridden start
                if rel.specific_end_date:
                    rel_dict["effective_end_date"] = rel.specific_end_date
                elif med.effective_period_end and effective_start and med.effective_period_end < effective_start:
                    rel_dict["effective_end_date"] = None
                else:
                    rel_dict["effective_end_date"] = med.effective_period_end
                rel_dict["effective_prescriber"] = specific_prescriber or med_practitioner
                rel_dict["effective_pharmacy"] = specific_pharmacy or med_pharmacy
            else:
                rel_dict["effective_dosage"] = rel.specific_dosage
                rel_dict["effective_frequency"] = rel.specific_frequency
                rel_dict["effective_start_date"] = rel.specific_start_date
                rel_dict["effective_end_date"] = rel.specific_end_date
                rel_dict["effective_prescriber"] = specific_prescriber
                rel_dict["effective_pharmacy"] = specific_pharmacy

            result.append(rel_dict)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "TreatmentMedication",
            treatment_id=treatment_id,
            count=len(result)
        )

        return result


@router.post("/{treatment_id}/medications", response_model=TreatmentMedicationResponse)
def create_treatment_medication(
    *,
    treatment_id: int,
    medication_in: TreatmentMedicationCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Link a medication to a treatment."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        # Verify medication exists and belongs to same patient
        db_medication = medication_crud.get(db, id=medication_in.medication_id)
        if not db_medication:
            raise NotFoundException(
                resource="Medication",
                message=f"Medication with ID {medication_in.medication_id} not found",
                request=request
            )
        if db_medication.patient_id != current_user_patient_id:
            raise BusinessLogicException(
                message="Cannot link medication from a different patient",
                request=request
            )

        medication_in.treatment_id = treatment_id
        relationship = treatment_medication.create(db, obj_in=medication_in)

        log_data_access(
            logger,
            request,
            current_user_id,
            "create",
            "TreatmentMedication",
            record_id=relationship.id,
            treatment_id=treatment_id,
            medication_id=medication_in.medication_id
        )

        return relationship


@router.post("/{treatment_id}/medications/bulk", response_model=List[TreatmentMedicationResponse])
def create_treatment_medications_bulk(
    *,
    treatment_id: int,
    bulk_data: TreatmentMedicationBulkCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Link multiple medications to a treatment at once."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        # Verify all medications exist and belong to same patient
        for med_id in bulk_data.medication_ids:
            db_medication = medication_crud.get(db, id=med_id)
            if not db_medication:
                raise NotFoundException(
                    resource="Medication",
                    message=f"Medication with ID {med_id} not found",
                    request=request
                )
            if db_medication.patient_id != current_user_patient_id:
                raise BusinessLogicException(
                    message="Cannot link medication from a different patient",
                    request=request
                )

        created, skipped = treatment_medication.create_bulk(
            db, treatment_id=treatment_id, bulk_data=bulk_data
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "create",
            "TreatmentMedication",
            treatment_id=treatment_id,
            created_count=len(created),
            skipped_count=len(skipped)
        )

        return created


@router.put("/{treatment_id}/medications/{relationship_id}", response_model=TreatmentMedicationResponse)
def update_treatment_medication(
    *,
    treatment_id: int,
    relationship_id: int,
    medication_in: TreatmentMedicationUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Update a treatment medication relationship."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        relationship = treatment_medication.get(db, id=relationship_id)
        if not relationship or relationship.treatment_id != treatment_id:
            raise NotFoundException(
                resource="TreatmentMedication",
                message="Relationship not found",
                request=request
            )

        updated = treatment_medication.update(db, db_obj=relationship, obj_in=medication_in)

        log_data_access(
            logger,
            request,
            current_user_id,
            "update",
            "TreatmentMedication",
            record_id=relationship_id,
            treatment_id=treatment_id
        )

        return updated


@router.delete("/{treatment_id}/medications/{relationship_id}")
def delete_treatment_medication(
    *,
    treatment_id: int,
    relationship_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Remove a medication link from a treatment."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        relationship = treatment_medication.get(db, id=relationship_id)
        if not relationship or relationship.treatment_id != treatment_id:
            raise NotFoundException(
                resource="TreatmentMedication",
                message="Relationship not found",
                request=request
            )

        treatment_medication.delete(db, id=relationship_id)

        log_data_access(
            logger,
            request,
            current_user_id,
            "delete",
            "TreatmentMedication",
            record_id=relationship_id,
            treatment_id=treatment_id
        )

        return {"status": "success", "message": "Medication link removed"}


# =============================================================================
# Treatment-Encounter Relationship Endpoints
# =============================================================================


@router.get("/{treatment_id}/encounters", response_model=List[TreatmentEncounterWithDetails])
def get_treatment_encounters(
    *,
    treatment_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all encounters linked to a treatment."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        relationships = treatment_encounter.get_by_treatment(db, treatment_id=treatment_id)

        # Enrich with encounter details
        result = []
        for rel in relationships:
            rel_dict = {
                "id": rel.id,
                "treatment_id": rel.treatment_id,
                "encounter_id": rel.encounter_id,
                "visit_label": rel.visit_label,
                "visit_sequence": rel.visit_sequence,
                "relevance_note": rel.relevance_note,
                "created_at": rel.created_at,
                "updated_at": rel.updated_at,
                "encounter": None,
            }
            if rel.encounter:
                rel_dict["encounter"] = {
                    "id": rel.encounter.id,
                    "reason": rel.encounter.reason,
                    "date": rel.encounter.date.isoformat() if rel.encounter.date else None,
                    "visit_type": rel.encounter.visit_type,
                }
            result.append(rel_dict)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "TreatmentEncounter",
            treatment_id=treatment_id,
            count=len(result)
        )

        return result


@router.post("/{treatment_id}/encounters", response_model=TreatmentEncounterResponse)
def create_treatment_encounter(
    *,
    treatment_id: int,
    encounter_in: TreatmentEncounterCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Link an encounter to a treatment."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        # Verify encounter exists and belongs to same patient
        db_encounter = encounter_crud.get(db, id=encounter_in.encounter_id)
        if not db_encounter:
            raise NotFoundException(
                resource="Encounter",
                message=f"Encounter with ID {encounter_in.encounter_id} not found",
                request=request
            )
        if db_encounter.patient_id != current_user_patient_id:
            raise BusinessLogicException(
                message="Cannot link encounter from a different patient",
                request=request
            )

        encounter_in.treatment_id = treatment_id
        relationship = treatment_encounter.create(db, obj_in=encounter_in)

        log_data_access(
            logger,
            request,
            current_user_id,
            "create",
            "TreatmentEncounter",
            record_id=relationship.id,
            treatment_id=treatment_id,
            encounter_id=encounter_in.encounter_id
        )

        return relationship


@router.post("/{treatment_id}/encounters/bulk", response_model=List[TreatmentEncounterResponse])
def create_treatment_encounters_bulk(
    *,
    treatment_id: int,
    bulk_data: TreatmentEncounterBulkCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Link multiple encounters to a treatment at once."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        # Verify all encounters exist and belong to same patient
        for enc_id in bulk_data.encounter_ids:
            db_encounter = encounter_crud.get(db, id=enc_id)
            if not db_encounter:
                raise NotFoundException(
                    resource="Encounter",
                    message=f"Encounter with ID {enc_id} not found",
                    request=request
                )
            if db_encounter.patient_id != current_user_patient_id:
                raise BusinessLogicException(
                    message="Cannot link encounter from a different patient",
                    request=request
                )

        created, skipped = treatment_encounter.create_bulk(
            db, treatment_id=treatment_id, bulk_data=bulk_data
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "create",
            "TreatmentEncounter",
            treatment_id=treatment_id,
            created_count=len(created),
            skipped_count=len(skipped)
        )

        return created


@router.put("/{treatment_id}/encounters/{relationship_id}", response_model=TreatmentEncounterResponse)
def update_treatment_encounter(
    *,
    treatment_id: int,
    relationship_id: int,
    encounter_in: TreatmentEncounterUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Update a treatment encounter relationship."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        relationship = treatment_encounter.get(db, id=relationship_id)
        if not relationship or relationship.treatment_id != treatment_id:
            raise NotFoundException(
                resource="TreatmentEncounter",
                message="Relationship not found",
                request=request
            )

        updated = treatment_encounter.update(db, db_obj=relationship, obj_in=encounter_in)

        log_data_access(
            logger,
            request,
            current_user_id,
            "update",
            "TreatmentEncounter",
            record_id=relationship_id,
            treatment_id=treatment_id
        )

        return updated


@router.delete("/{treatment_id}/encounters/{relationship_id}")
def delete_treatment_encounter(
    *,
    treatment_id: int,
    relationship_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Remove an encounter link from a treatment."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        relationship = treatment_encounter.get(db, id=relationship_id)
        if not relationship or relationship.treatment_id != treatment_id:
            raise NotFoundException(
                resource="TreatmentEncounter",
                message="Relationship not found",
                request=request
            )

        treatment_encounter.delete(db, id=relationship_id)

        log_data_access(
            logger,
            request,
            current_user_id,
            "delete",
            "TreatmentEncounter",
            record_id=relationship_id,
            treatment_id=treatment_id
        )

        return {"status": "success", "message": "Encounter link removed"}


# =============================================================================
# Treatment-LabResult Relationship Endpoints
# =============================================================================


@router.get("/{treatment_id}/lab-results", response_model=List[TreatmentLabResultWithDetails])
def get_treatment_lab_results(
    *,
    treatment_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all lab results linked to a treatment."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        relationships = treatment_lab_result.get_by_treatment(db, treatment_id=treatment_id)

        # Enrich with lab result details
        result = []
        for rel in relationships:
            rel_dict = {
                "id": rel.id,
                "treatment_id": rel.treatment_id,
                "lab_result_id": rel.lab_result_id,
                "purpose": rel.purpose,
                "expected_frequency": rel.expected_frequency,
                "relevance_note": rel.relevance_note,
                "created_at": rel.created_at,
                "updated_at": rel.updated_at,
                "lab_result": None,
            }
            if rel.lab_result:
                rel_dict["lab_result"] = {
                    "id": rel.lab_result.id,
                    "test_name": rel.lab_result.test_name,
                    "status": rel.lab_result.status,
                    "completed_date": rel.lab_result.completed_date.isoformat() if rel.lab_result.completed_date else None,
                    "labs_result": rel.lab_result.labs_result,
                }
            result.append(rel_dict)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "TreatmentLabResult",
            treatment_id=treatment_id,
            count=len(result)
        )

        return result


@router.post("/{treatment_id}/lab-results", response_model=TreatmentLabResultResponse)
def create_treatment_lab_result(
    *,
    treatment_id: int,
    lab_result_in: TreatmentLabResultCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Link a lab result to a treatment."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        # Verify lab result exists and belongs to same patient
        db_lab_result = lab_result_crud.get(db, id=lab_result_in.lab_result_id)
        if not db_lab_result:
            raise NotFoundException(
                resource="LabResult",
                message=f"Lab result with ID {lab_result_in.lab_result_id} not found",
                request=request
            )
        if db_lab_result.patient_id != current_user_patient_id:
            raise BusinessLogicException(
                message="Cannot link lab result from a different patient",
                request=request
            )

        lab_result_in.treatment_id = treatment_id
        relationship = treatment_lab_result.create(db, obj_in=lab_result_in)

        log_data_access(
            logger,
            request,
            current_user_id,
            "create",
            "TreatmentLabResult",
            record_id=relationship.id,
            treatment_id=treatment_id,
            lab_result_id=lab_result_in.lab_result_id
        )

        return relationship


@router.post("/{treatment_id}/lab-results/bulk", response_model=List[TreatmentLabResultResponse])
def create_treatment_lab_results_bulk(
    *,
    treatment_id: int,
    bulk_data: TreatmentLabResultBulkCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Link multiple lab results to a treatment at once."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        # Verify all lab results exist and belong to same patient
        for lab_id in bulk_data.lab_result_ids:
            db_lab_result = lab_result_crud.get(db, id=lab_id)
            if not db_lab_result:
                raise NotFoundException(
                    resource="LabResult",
                    message=f"Lab result with ID {lab_id} not found",
                    request=request
                )
            if db_lab_result.patient_id != current_user_patient_id:
                raise BusinessLogicException(
                    message="Cannot link lab result from a different patient",
                    request=request
                )

        created, skipped = treatment_lab_result.create_bulk(
            db, treatment_id=treatment_id, bulk_data=bulk_data
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "create",
            "TreatmentLabResult",
            treatment_id=treatment_id,
            created_count=len(created),
            skipped_count=len(skipped)
        )

        return created


@router.put("/{treatment_id}/lab-results/{relationship_id}", response_model=TreatmentLabResultResponse)
def update_treatment_lab_result(
    *,
    treatment_id: int,
    relationship_id: int,
    lab_result_in: TreatmentLabResultUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Update a treatment lab result relationship."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        relationship = treatment_lab_result.get(db, id=relationship_id)
        if not relationship or relationship.treatment_id != treatment_id:
            raise NotFoundException(
                resource="TreatmentLabResult",
                message="Relationship not found",
                request=request
            )

        updated = treatment_lab_result.update(db, db_obj=relationship, obj_in=lab_result_in)

        log_data_access(
            logger,
            request,
            current_user_id,
            "update",
            "TreatmentLabResult",
            record_id=relationship_id,
            treatment_id=treatment_id
        )

        return updated


@router.delete("/{treatment_id}/lab-results/{relationship_id}")
def delete_treatment_lab_result(
    *,
    treatment_id: int,
    relationship_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Remove a lab result link from a treatment."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        relationship = treatment_lab_result.get(db, id=relationship_id)
        if not relationship or relationship.treatment_id != treatment_id:
            raise NotFoundException(
                resource="TreatmentLabResult",
                message="Relationship not found",
                request=request
            )

        treatment_lab_result.delete(db, id=relationship_id)

        log_data_access(
            logger,
            request,
            current_user_id,
            "delete",
            "TreatmentLabResult",
            record_id=relationship_id,
            treatment_id=treatment_id
        )

        return {"status": "success", "message": "Lab result link removed"}


# =============================================================================
# Treatment-Equipment Relationship Endpoints
# =============================================================================


@router.get("/{treatment_id}/equipment", response_model=List[TreatmentEquipmentWithDetails])
def get_treatment_equipment(
    *,
    treatment_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all equipment linked to a treatment."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        relationships = treatment_equipment.get_by_treatment(db, treatment_id=treatment_id)

        # Enrich with equipment details
        result = []
        for rel in relationships:
            rel_dict = {
                "id": rel.id,
                "treatment_id": rel.treatment_id,
                "equipment_id": rel.equipment_id,
                "usage_frequency": rel.usage_frequency,
                "specific_settings": rel.specific_settings,
                "relevance_note": rel.relevance_note,
                "created_at": rel.created_at,
                "updated_at": rel.updated_at,
                "equipment": None,
            }
            if rel.equipment:
                rel_dict["equipment"] = {
                    "id": rel.equipment.id,
                    "equipment_name": rel.equipment.equipment_name,
                    "equipment_type": rel.equipment.equipment_type,
                    "status": rel.equipment.status,
                    "manufacturer": rel.equipment.manufacturer,
                }
            result.append(rel_dict)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "TreatmentEquipment",
            treatment_id=treatment_id,
            count=len(result)
        )

        return result


@router.post("/{treatment_id}/equipment", response_model=TreatmentEquipmentResponse)
def create_treatment_equipment_link(
    *,
    treatment_id: int,
    equipment_in: TreatmentEquipmentCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Link equipment to a treatment."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        # Verify equipment exists and belongs to same patient
        db_equipment = equipment_crud.get(db, id=equipment_in.equipment_id)
        if not db_equipment:
            raise NotFoundException(
                resource="MedicalEquipment",
                message=f"Equipment with ID {equipment_in.equipment_id} not found",
                request=request
            )
        if db_equipment.patient_id != current_user_patient_id:
            raise BusinessLogicException(
                message="Cannot link equipment from a different patient",
                request=request
            )

        equipment_in.treatment_id = treatment_id
        relationship = treatment_equipment.create(db, obj_in=equipment_in)

        log_data_access(
            logger,
            request,
            current_user_id,
            "create",
            "TreatmentEquipment",
            record_id=relationship.id,
            treatment_id=treatment_id,
            equipment_id=equipment_in.equipment_id
        )

        return relationship


@router.post("/{treatment_id}/equipment/bulk", response_model=List[TreatmentEquipmentResponse])
def create_treatment_equipment_bulk(
    *,
    treatment_id: int,
    bulk_data: TreatmentEquipmentBulkCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Link multiple equipment to a treatment at once."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        # Verify all equipment exists and belongs to same patient
        for eq_id in bulk_data.equipment_ids:
            db_equipment = equipment_crud.get(db, id=eq_id)
            if not db_equipment:
                raise NotFoundException(
                    resource="MedicalEquipment",
                    message=f"Equipment with ID {eq_id} not found",
                    request=request
                )
            if db_equipment.patient_id != current_user_patient_id:
                raise BusinessLogicException(
                    message="Cannot link equipment from a different patient",
                    request=request
                )

        created, skipped = treatment_equipment.create_bulk(
            db, treatment_id=treatment_id, bulk_data=bulk_data
        )

        log_data_access(
            logger,
            request,
            current_user_id,
            "create",
            "TreatmentEquipment",
            treatment_id=treatment_id,
            created_count=len(created),
            skipped_count=len(skipped)
        )

        return created


@router.put("/{treatment_id}/equipment/{relationship_id}", response_model=TreatmentEquipmentResponse)
def update_treatment_equipment_link(
    *,
    treatment_id: int,
    relationship_id: int,
    equipment_in: TreatmentEquipmentUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Update a treatment equipment relationship."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        relationship = treatment_equipment.get(db, id=relationship_id)
        if not relationship or relationship.treatment_id != treatment_id:
            raise NotFoundException(
                resource="TreatmentEquipment",
                message="Relationship not found",
                request=request
            )

        updated = treatment_equipment.update(db, db_obj=relationship, obj_in=equipment_in)

        log_data_access(
            logger,
            request,
            current_user_id,
            "update",
            "TreatmentEquipment",
            record_id=relationship_id,
            treatment_id=treatment_id
        )

        return updated


@router.delete("/{treatment_id}/equipment/{relationship_id}")
def delete_treatment_equipment_link(
    *,
    treatment_id: int,
    relationship_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Remove an equipment link from a treatment."""
    with handle_database_errors(request=request):
        _verify_treatment_access(db, treatment_id, current_user_patient_id, current_user_id, request)

        relationship = treatment_equipment.get(db, id=relationship_id)
        if not relationship or relationship.treatment_id != treatment_id:
            raise NotFoundException(
                resource="TreatmentEquipment",
                message="Relationship not found",
                request=request
            )

        treatment_equipment.delete(db, id=relationship_id)

        log_data_access(
            logger,
            request,
            current_user_id,
            "delete",
            "TreatmentEquipment",
            record_id=relationship_id,
            treatment_id=treatment_id
        )

        return {"status": "success", "message": "Equipment link removed"}
