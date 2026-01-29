from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, Text
from app.api import deps
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_endpoint_access, log_data_access
from app.models.models import (
    Medication, Condition, LabResult, Procedure,
    Immunization, Treatment, Encounter, Allergy, Vitals
)
from pydantic import BaseModel

logger = get_logger(__name__, "app")

router = APIRouter()

# Constants
DEFAULT_SEARCH_SCORE = 0.9

# Response models
class SearchItemBase(BaseModel):
    id: int
    type: str
    highlight: str
    score: float
    tags: List[str] = []

class MedicationSearchItem(SearchItemBase):
    medication_name: str
    dosage: Optional[str]
    status: Optional[str]
    start_date: Optional[str]

class ConditionSearchItem(SearchItemBase):
    condition_name: str
    diagnosis: Optional[str]
    status: Optional[str]
    diagnosed_date: Optional[str]

class LabResultSearchItem(SearchItemBase):
    test_name: str
    result: Optional[str]
    status: Optional[str]
    test_date: Optional[str]

class ProcedureSearchItem(SearchItemBase):
    name: str
    description: Optional[str]
    status: Optional[str]
    procedure_date: Optional[str]

class ImmunizationSearchItem(SearchItemBase):
    vaccine_name: str
    dose_number: Optional[int]
    status: Optional[str]
    administered_date: Optional[str]

class TreatmentSearchItem(SearchItemBase):
    treatment_name: str
    treatment_type: str
    description: Optional[str]
    status: Optional[str]
    start_date: Optional[str]

class EncounterSearchItem(SearchItemBase):
    visit_type: Optional[str]
    chief_complaint: Optional[str]
    reason: Optional[str]
    encounter_date: Optional[str]

class AllergySearchItem(SearchItemBase):
    allergen: str
    reaction: Optional[str]
    severity: Optional[str]
    identified_date: Optional[str]

class VitalSearchItem(SearchItemBase):
    systolic_bp: Optional[int]
    diastolic_bp: Optional[int]
    heart_rate: Optional[int]
    temperature: Optional[float]
    weight: Optional[float]
    recorded_date: Optional[str]

class SearchResultGroup(BaseModel):
    count: int
    items: List[Any]

class PaginationInfo(BaseModel):
    skip: int
    limit: int
    has_more: bool

class SearchResponse(BaseModel):
    query: str
    total_count: int
    results: Dict[str, SearchResultGroup]
    pagination: PaginationInfo

@router.get("/", response_model=SearchResponse)
def search_patient_records(
    *,
    q: str = Query(..., min_length=1, description="Search query"),
    types: Optional[List[str]] = Query(None, description="Filter by record types"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(default=20, le=100, description="Results per type"),
    sort: str = Query("relevance", description="Sort by: relevance, date_desc, date_asc"),
    request: Request,
    db: Session = Depends(deps.get_db),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """
    Search across all medical record types for a specific patient.
    Consolidates multiple API calls into a single efficient search.
    """
    log_endpoint_access(
        logger, request, target_patient_id, "search_request_received",
        patient_id=target_patient_id,
        query=q,
        types=types,
        types_count=len(types) if types else 0,
        skip=skip,
        limit=limit
    )

    query_lower = q.lower()
    results = {}
    total_count = 0

    # Define record types to search
    all_types = [
        "medications", "conditions", "lab_results", "procedures",
        "immunizations", "treatments", "encounters", "allergies", "vitals"
    ]

    search_types = types if types else all_types

    # Search medications
    if "medications" in search_types:
        medications_query = db.query(Medication).filter(
            and_(
                Medication.patient_id == target_patient_id,
                or_(
                    func.lower(Medication.medication_name).contains(query_lower),
                    func.lower(Medication.dosage).contains(query_lower),
                    func.lower(Medication.indication).contains(query_lower),
                    func.cast(Medication.tags, Text).ilike(f'%{query_lower}%')
                )
            )
        )

        # Apply sorting
        if sort == "date_desc":
            medications_query = medications_query.order_by(Medication.effective_period_start.desc())
        elif sort == "date_asc":
            medications_query = medications_query.order_by(Medication.effective_period_start.asc())

        med_count = medications_query.count()
        medications = medications_query.offset(skip).limit(limit).all()

        results["medications"] = SearchResultGroup(
            count=med_count,
            items=[
                MedicationSearchItem(
                    id=med.id,
                    type="medication",
                    medication_name=med.medication_name,
                    dosage=med.dosage,
                    status=med.status,
                    start_date=med.effective_period_start.isoformat() if med.effective_period_start else None,
                    tags=med.tags or [],
                    highlight=med.medication_name,
                    score=DEFAULT_SEARCH_SCORE
                ).dict()
                for med in medications
            ]
        )
        total_count += med_count

    # Search conditions
    if "conditions" in search_types:
        conditions_query = db.query(Condition).filter(
            and_(
                Condition.patient_id == target_patient_id,
                or_(
                    func.lower(Condition.condition_name).contains(query_lower),
                    func.lower(Condition.diagnosis).contains(query_lower),
                    func.lower(Condition.notes).contains(query_lower),
                    func.cast(Condition.tags, Text).ilike(f'%{query_lower}%')
                )
            )
        )

        if sort == "date_desc":
            conditions_query = conditions_query.order_by(Condition.onset_date.desc())
        elif sort == "date_asc":
            conditions_query = conditions_query.order_by(Condition.onset_date.asc())

        cond_count = conditions_query.count()
        conditions = conditions_query.offset(skip).limit(limit).all()

        results["conditions"] = SearchResultGroup(
            count=cond_count,
            items=[
                ConditionSearchItem(
                    id=cond.id,
                    type="condition",
                    condition_name=cond.condition_name,
                    diagnosis=cond.diagnosis,
                    status=cond.status,
                    diagnosed_date=cond.onset_date.isoformat() if cond.onset_date else None,
                    tags=cond.tags or [],
                    highlight=cond.condition_name,
                    score=DEFAULT_SEARCH_SCORE
                ).dict()
                for cond in conditions
            ]
        )
        total_count += cond_count

    # Search lab results
    if "lab_results" in search_types:
        lab_results_query = db.query(LabResult).filter(
            and_(
                LabResult.patient_id == target_patient_id,
                or_(
                    func.lower(LabResult.test_name).contains(query_lower),
                    func.lower(LabResult.labs_result).contains(query_lower),
                    func.lower(LabResult.notes).contains(query_lower),
                    func.cast(LabResult.tags, Text).ilike(f'%{query_lower}%')
                )
            )
        )

        if sort == "date_desc":
            lab_results_query = lab_results_query.order_by(LabResult.completed_date.desc())
        elif sort == "date_asc":
            lab_results_query = lab_results_query.order_by(LabResult.completed_date.asc())

        lab_count = lab_results_query.count()
        lab_results = lab_results_query.offset(skip).limit(limit).all()

        results["lab_results"] = SearchResultGroup(
            count=lab_count,
            items=[
                LabResultSearchItem(
                    id=lab.id,
                    type="lab_result",
                    test_name=lab.test_name,
                    result=lab.labs_result,
                    status=lab.status,
                    test_date=lab.completed_date.isoformat() if lab.completed_date else None,
                    tags=lab.tags or [],
                    highlight=lab.test_name,
                    score=DEFAULT_SEARCH_SCORE
                ).dict()
                for lab in lab_results
            ]
        )
        total_count += lab_count

    # Search procedures
    if "procedures" in search_types:
        procedures_query = db.query(Procedure).filter(
            and_(
                Procedure.patient_id == target_patient_id,
                or_(
                    func.lower(Procedure.procedure_name).contains(query_lower),
                    func.lower(Procedure.description).contains(query_lower),
                    func.lower(Procedure.notes).contains(query_lower),
                    func.cast(Procedure.tags, Text).ilike(f'%{query_lower}%')
                )
            )
        )

        if sort == "date_desc":
            procedures_query = procedures_query.order_by(Procedure.date.desc())
        elif sort == "date_asc":
            procedures_query = procedures_query.order_by(Procedure.date.asc())

        proc_count = procedures_query.count()
        procedures = procedures_query.offset(skip).limit(limit).all()

        results["procedures"] = SearchResultGroup(
            count=proc_count,
            items=[
                ProcedureSearchItem(
                    id=proc.id,
                    type="procedure",
                    name=proc.procedure_name,
                    description=proc.description,
                    status=proc.status,
                    procedure_date=proc.date.isoformat() if proc.date else None,
                    tags=proc.tags or [],
                    highlight=proc.procedure_name,
                    score=DEFAULT_SEARCH_SCORE
                ).dict()
                for proc in procedures
            ]
        )
        total_count += proc_count

    # Search immunizations
    if "immunizations" in search_types:
        immunizations_query = db.query(Immunization).filter(
            and_(
                Immunization.patient_id == target_patient_id,
                or_(
                    func.lower(Immunization.vaccine_name).contains(query_lower),
                    func.lower(Immunization.notes).contains(query_lower),
                    func.cast(Immunization.tags, Text).ilike(f'%{query_lower}%')
                )
            )
        )

        if sort == "date_desc":
            immunizations_query = immunizations_query.order_by(Immunization.date_administered.desc())
        elif sort == "date_asc":
            immunizations_query = immunizations_query.order_by(Immunization.date_administered.asc())

        imm_count = immunizations_query.count()
        immunizations = immunizations_query.offset(skip).limit(limit).all()

        results["immunizations"] = SearchResultGroup(
            count=imm_count,
            items=[
                ImmunizationSearchItem(
                    id=imm.id,
                    type="immunization",
                    vaccine_name=imm.vaccine_name,
                    dose_number=imm.dose_number,
                    status=None,  # Immunization model has no status field
                    administered_date=imm.date_administered.isoformat() if imm.date_administered else None,
                    tags=imm.tags or [],
                    highlight=imm.vaccine_name,
                    score=DEFAULT_SEARCH_SCORE
                ).dict()
                for imm in immunizations
            ]
        )
        total_count += imm_count

    # Search treatments
    if "treatments" in search_types:
        treatments_query = db.query(Treatment).filter(
            and_(
                Treatment.patient_id == target_patient_id,
                or_(
                    func.lower(Treatment.treatment_name).contains(query_lower),
                    func.lower(Treatment.treatment_type).contains(query_lower),
                    func.lower(Treatment.description).contains(query_lower),
                    func.lower(Treatment.notes).contains(query_lower),
                    func.cast(Treatment.tags, Text).ilike(f'%{query_lower}%')
                )
            )
        )

        if sort == "date_desc":
            treatments_query = treatments_query.order_by(Treatment.start_date.desc())
        elif sort == "date_asc":
            treatments_query = treatments_query.order_by(Treatment.start_date.asc())

        treat_count = treatments_query.count()
        treatments = treatments_query.offset(skip).limit(limit).all()

        results["treatments"] = SearchResultGroup(
            count=treat_count,
            items=[
                TreatmentSearchItem(
                    id=treat.id,
                    type="treatment",
                    treatment_name=treat.treatment_name,
                    treatment_type=treat.treatment_type,
                    description=treat.description,
                    status=treat.status,
                    start_date=treat.start_date.isoformat() if treat.start_date else None,
                    tags=treat.tags or [],
                    highlight=treat.treatment_name,
                    score=DEFAULT_SEARCH_SCORE
                ).dict()
                for treat in treatments
            ]
        )
        total_count += treat_count

    # Search encounters
    if "encounters" in search_types:
        encounters_query = db.query(Encounter).filter(
            and_(
                Encounter.patient_id == target_patient_id,
                or_(
                    func.lower(Encounter.visit_type).contains(query_lower),
                    func.lower(Encounter.chief_complaint).contains(query_lower),
                    func.lower(Encounter.notes).contains(query_lower),
                    func.cast(Encounter.tags, Text).ilike(f'%{query_lower}%')
                )
            )
        )

        if sort == "date_desc":
            encounters_query = encounters_query.order_by(Encounter.date.desc())
        elif sort == "date_asc":
            encounters_query = encounters_query.order_by(Encounter.date.asc())

        enc_count = encounters_query.count()
        encounters = encounters_query.offset(skip).limit(limit).all()

        results["encounters"] = SearchResultGroup(
            count=enc_count,
            items=[
                EncounterSearchItem(
                    id=enc.id,
                    type="encounter",
                    visit_type=enc.visit_type,
                    chief_complaint=enc.chief_complaint,
                    reason=enc.reason,
                    encounter_date=enc.date.isoformat() if enc.date else None,
                    tags=enc.tags or [],
                    highlight=enc.visit_type or enc.reason or "Encounter",
                    score=DEFAULT_SEARCH_SCORE
                ).dict()
                for enc in encounters
            ]
        )
        total_count += enc_count

    # Search allergies
    if "allergies" in search_types:
        allergies_query = db.query(Allergy).filter(
            and_(
                Allergy.patient_id == target_patient_id,
                or_(
                    func.lower(Allergy.allergen).contains(query_lower),
                    func.lower(Allergy.reaction).contains(query_lower),
                    func.lower(Allergy.notes).contains(query_lower),
                    func.cast(Allergy.tags, Text).ilike(f'%{query_lower}%')
                )
            )
        )

        if sort == "date_desc":
            allergies_query = allergies_query.order_by(Allergy.onset_date.desc())
        elif sort == "date_asc":
            allergies_query = allergies_query.order_by(Allergy.onset_date.asc())

        allergy_count = allergies_query.count()
        allergies = allergies_query.offset(skip).limit(limit).all()

        results["allergies"] = SearchResultGroup(
            count=allergy_count,
            items=[
                AllergySearchItem(
                    id=allergy.id,
                    type="allergy",
                    allergen=allergy.allergen,
                    reaction=allergy.reaction,
                    severity=allergy.severity,
                    identified_date=allergy.onset_date.isoformat() if allergy.onset_date else None,
                    tags=allergy.tags or [],
                    highlight=allergy.allergen,
                    score=DEFAULT_SEARCH_SCORE
                ).dict()
                for allergy in allergies
            ]
        )
        total_count += allergy_count

    # Search vitals
    if "vitals" in search_types:
        # Vitals only has 'notes' field, not 'tags'
        vitals_query = db.query(Vitals).filter(
            and_(
                Vitals.patient_id == target_patient_id,
                func.lower(Vitals.notes).contains(query_lower)
            )
        )

        if sort == "date_desc":
            vitals_query = vitals_query.order_by(Vitals.recorded_date.desc())
        elif sort == "date_asc":
            vitals_query = vitals_query.order_by(Vitals.recorded_date.asc())

        vital_count = vitals_query.count()
        vitals = vitals_query.offset(skip).limit(limit).all()

        results["vitals"] = SearchResultGroup(
            count=vital_count,
            items=[
                VitalSearchItem(
                    id=vital.id,
                    type="vital",
                    systolic_bp=vital.systolic_bp,
                    diastolic_bp=vital.diastolic_bp,
                    heart_rate=vital.heart_rate,
                    temperature=vital.temperature,
                    weight=vital.weight,
                    recorded_date=vital.recorded_date.isoformat() if vital.recorded_date else None,
                    tags=getattr(vital, 'tags', []),
                    highlight=f"BP: {vital.systolic_bp}/{vital.diastolic_bp}" if vital.systolic_bp else "Vitals",
                    score=DEFAULT_SEARCH_SCORE
                ).dict()
                for vital in vitals
            ]
        )
        total_count += vital_count

    # Determine if there are more results for any search type
    has_more = any(
        result.count > limit
        for result in results.values()
    )

    log_data_access(
        logger, request, target_patient_id, "read", "SearchResults",
        patient_id=target_patient_id,
        count=total_count,
        query=q,
        types_searched=list(results.keys()),
        results_by_type={k: v.count for k, v in results.items()}
    )

    return SearchResponse(
        query=q,
        total_count=total_count,
        results=results,
        pagination=PaginationInfo(
            skip=skip,
            limit=limit,
            has_more=has_more
        )
    )