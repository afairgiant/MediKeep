import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, text
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

# Sort normalization: frontend values -> internal handling
SORT_ALIASES = {
    "relevance": "date_desc",
    "date": "date_desc",
}


def _tag_text_filter(db: Session, table_name: str, query_lower: str):
    """Build an EXISTS filter for precise tag text matching.

    Uses json_array_elements_text on PostgreSQL and json_each on SQLite.
    Returns a SQLAlchemy text clause that checks if any element in the
    JSON tags array contains the search term (case-insensitive LIKE).
    Uses parameterized binding to prevent SQL injection.
    """
    dialect = db.get_bind().dialect.name
    if dialect == "sqlite":
        return text(
            f'EXISTS (SELECT 1 FROM json_each("{table_name}"."tags") '
            "WHERE lower(json_each.value) LIKE '%' || :_tag_q || '%')"
        ).bindparams(_tag_q=query_lower)
    return text(
        f'EXISTS (SELECT 1 FROM json_array_elements_text("{table_name}"."tags") AS t '
        "WHERE lower(t) LIKE '%' || :_tag_q || '%')"
    ).bindparams(_tag_q=query_lower)


def _apply_date_filter(query_obj, date_col, date_from, date_to):
    """Apply optional date range filters to a query."""
    if date_from:
        query_obj = query_obj.filter(date_col >= date_from)
    if date_to:
        # Include the entire end date (up to end of day)
        query_obj = query_obj.filter(date_col <= date_to)
    return query_obj


def _apply_sort(query_obj, sort: str, date_col, title_col=None):
    """Apply sorting to a query. Falls back to date desc for unknown sort values."""
    if sort == "date_asc":
        return query_obj.order_by(date_col.asc())
    elif sort == "title" and title_col is not None:
        return query_obj.order_by(title_col.asc())
    elif sort == "title_desc" and title_col is not None:
        return query_obj.order_by(title_col.desc())
    else:
        # date_desc is the default (including for "relevance")
        return query_obj.order_by(date_col.desc())


def _windowed_query(query_obj, model_id_col, skip: int, limit: int):
    """Execute a query with window count to avoid separate COUNT query.

    Returns (items, count) where items are the model instances and count
    is the total matching rows.
    """
    windowed = query_obj.add_columns(
        func.count(model_id_col).over().label("_total_count")
    )
    rows = windowed.offset(skip).limit(limit).all()
    if not rows:
        return [], 0
    items = [row[0] for row in rows]
    count = rows[0][1]
    return items, count


def _parse_date(date_str: Optional[str]) -> Optional[datetime.date]:
    """Parse an ISO date string, returning None on invalid input."""
    if not date_str:
        return None
    try:
        return datetime.date.fromisoformat(date_str)
    except (ValueError, TypeError):
        return None


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
    condition_name: Optional[str]
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
    treatment_type: Optional[str]
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
    q: Optional[str] = Query(None, min_length=1, description="Search query (omit to list all records)"),
    types: Optional[List[str]] = Query(None, description="Filter by record types"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(default=20, le=100, description="Results per type"),
    sort: str = Query("relevance", description="Sort by: relevance, date_desc, date_asc, title"),
    date_from: Optional[str] = Query(None, description="Filter records from this date (ISO format)"),
    date_to: Optional[str] = Query(None, description="Filter records up to this date (ISO format)"),
    request: Request,
    db: Session = Depends(deps.get_db),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """
    Search across all medical record types for a specific patient.
    When q is omitted, returns all records (list mode).
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

    query_lower = q.lower() if q else None

    # Normalize sort aliases from frontend
    sort = SORT_ALIASES.get(sort, sort)

    # Parse date filters
    parsed_date_from = _parse_date(date_from)
    parsed_date_to = _parse_date(date_to)

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
            Medication.patient_id == target_patient_id
        )
        if query_lower:
            medications_query = medications_query.filter(
                or_(
                    func.lower(Medication.medication_name).contains(query_lower),
                    func.lower(Medication.dosage).contains(query_lower),
                    func.lower(Medication.indication).contains(query_lower),
                    _tag_text_filter(db, "medications", query_lower)
                )
            )

        medications_query = _apply_date_filter(
            medications_query, Medication.effective_period_start,
            parsed_date_from, parsed_date_to
        )
        medications_query = _apply_sort(
            medications_query, sort, Medication.effective_period_start,
            title_col=Medication.medication_name
        )

        medications, med_count = _windowed_query(
            medications_query, Medication.id, skip, limit
        )

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
                ).model_dump()
                for med in medications
            ]
        )
        total_count += med_count

    # Search conditions
    if "conditions" in search_types:
        conditions_query = db.query(Condition).filter(
            Condition.patient_id == target_patient_id
        )
        if query_lower:
            conditions_query = conditions_query.filter(
                or_(
                    func.lower(Condition.condition_name).contains(query_lower),
                    func.lower(Condition.diagnosis).contains(query_lower),
                    func.lower(Condition.notes).contains(query_lower),
                    _tag_text_filter(db, "conditions", query_lower)
                )
            )

        conditions_query = _apply_date_filter(
            conditions_query, Condition.onset_date,
            parsed_date_from, parsed_date_to
        )
        conditions_query = _apply_sort(
            conditions_query, sort, Condition.onset_date,
            title_col=Condition.condition_name
        )

        conditions, cond_count = _windowed_query(
            conditions_query, Condition.id, skip, limit
        )

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
                    highlight=cond.condition_name or cond.diagnosis or "Condition",
                    score=DEFAULT_SEARCH_SCORE
                ).model_dump()
                for cond in conditions
            ]
        )
        total_count += cond_count

    # Search lab results
    if "lab_results" in search_types:
        lab_results_query = db.query(LabResult).filter(
            LabResult.patient_id == target_patient_id
        )
        if query_lower:
            lab_results_query = lab_results_query.filter(
                or_(
                    func.lower(LabResult.test_name).contains(query_lower),
                    func.lower(LabResult.labs_result).contains(query_lower),
                    func.lower(LabResult.notes).contains(query_lower),
                    _tag_text_filter(db, "lab_results", query_lower)
                )
            )

        lab_results_query = _apply_date_filter(
            lab_results_query, LabResult.completed_date,
            parsed_date_from, parsed_date_to
        )
        lab_results_query = _apply_sort(
            lab_results_query, sort, LabResult.completed_date,
            title_col=LabResult.test_name
        )

        lab_results, lab_count = _windowed_query(
            lab_results_query, LabResult.id, skip, limit
        )

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
                ).model_dump()
                for lab in lab_results
            ]
        )
        total_count += lab_count

    # Search procedures
    if "procedures" in search_types:
        procedures_query = db.query(Procedure).filter(
            Procedure.patient_id == target_patient_id
        )
        if query_lower:
            procedures_query = procedures_query.filter(
                or_(
                    func.lower(Procedure.procedure_name).contains(query_lower),
                    func.lower(Procedure.description).contains(query_lower),
                    func.lower(Procedure.notes).contains(query_lower),
                    _tag_text_filter(db, "procedures", query_lower)
                )
            )

        procedures_query = _apply_date_filter(
            procedures_query, Procedure.date,
            parsed_date_from, parsed_date_to
        )
        procedures_query = _apply_sort(
            procedures_query, sort, Procedure.date,
            title_col=Procedure.procedure_name
        )

        procedures, proc_count = _windowed_query(
            procedures_query, Procedure.id, skip, limit
        )

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
                ).model_dump()
                for proc in procedures
            ]
        )
        total_count += proc_count

    # Search immunizations
    if "immunizations" in search_types:
        immunizations_query = db.query(Immunization).filter(
            Immunization.patient_id == target_patient_id
        )
        if query_lower:
            immunizations_query = immunizations_query.filter(
                or_(
                    func.lower(Immunization.vaccine_name).contains(query_lower),
                    func.lower(Immunization.notes).contains(query_lower),
                    _tag_text_filter(db, "immunizations", query_lower)
                )
            )

        immunizations_query = _apply_date_filter(
            immunizations_query, Immunization.date_administered,
            parsed_date_from, parsed_date_to
        )
        immunizations_query = _apply_sort(
            immunizations_query, sort, Immunization.date_administered,
            title_col=Immunization.vaccine_name
        )

        immunizations, imm_count = _windowed_query(
            immunizations_query, Immunization.id, skip, limit
        )

        results["immunizations"] = SearchResultGroup(
            count=imm_count,
            items=[
                ImmunizationSearchItem(
                    id=imm.id,
                    type="immunization",
                    vaccine_name=imm.vaccine_name,
                    dose_number=imm.dose_number,
                    status=None,
                    administered_date=imm.date_administered.isoformat() if imm.date_administered else None,
                    tags=imm.tags or [],
                    highlight=imm.vaccine_name,
                    score=DEFAULT_SEARCH_SCORE
                ).model_dump()
                for imm in immunizations
            ]
        )
        total_count += imm_count

    # Search treatments
    if "treatments" in search_types:
        treatments_query = db.query(Treatment).filter(
            Treatment.patient_id == target_patient_id
        )
        if query_lower:
            treatments_query = treatments_query.filter(
                or_(
                    func.lower(Treatment.treatment_name).contains(query_lower),
                    func.lower(Treatment.treatment_type).contains(query_lower),
                    func.lower(Treatment.description).contains(query_lower),
                    func.lower(Treatment.notes).contains(query_lower),
                    _tag_text_filter(db, "treatments", query_lower)
                )
            )

        treatments_query = _apply_date_filter(
            treatments_query, Treatment.start_date,
            parsed_date_from, parsed_date_to
        )
        treatments_query = _apply_sort(
            treatments_query, sort, Treatment.start_date,
            title_col=Treatment.treatment_name
        )

        treatments, treat_count = _windowed_query(
            treatments_query, Treatment.id, skip, limit
        )

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
                ).model_dump()
                for treat in treatments
            ]
        )
        total_count += treat_count

    # Search encounters
    if "encounters" in search_types:
        encounters_query = db.query(Encounter).filter(
            Encounter.patient_id == target_patient_id
        )
        if query_lower:
            encounters_query = encounters_query.filter(
                or_(
                    func.lower(Encounter.visit_type).contains(query_lower),
                    func.lower(Encounter.chief_complaint).contains(query_lower),
                    func.lower(Encounter.notes).contains(query_lower),
                    _tag_text_filter(db, "encounters", query_lower)
                )
            )

        encounters_query = _apply_date_filter(
            encounters_query, Encounter.date,
            parsed_date_from, parsed_date_to
        )
        encounters_query = _apply_sort(
            encounters_query, sort, Encounter.date,
            title_col=Encounter.visit_type
        )

        encounters, enc_count = _windowed_query(
            encounters_query, Encounter.id, skip, limit
        )

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
                ).model_dump()
                for enc in encounters
            ]
        )
        total_count += enc_count

    # Search allergies
    if "allergies" in search_types:
        allergies_query = db.query(Allergy).filter(
            Allergy.patient_id == target_patient_id
        )
        if query_lower:
            allergies_query = allergies_query.filter(
                or_(
                    func.lower(Allergy.allergen).contains(query_lower),
                    func.lower(Allergy.reaction).contains(query_lower),
                    func.lower(Allergy.notes).contains(query_lower),
                    _tag_text_filter(db, "allergies", query_lower)
                )
            )

        allergies_query = _apply_date_filter(
            allergies_query, Allergy.onset_date,
            parsed_date_from, parsed_date_to
        )
        allergies_query = _apply_sort(
            allergies_query, sort, Allergy.onset_date,
            title_col=Allergy.allergen
        )

        allergies, allergy_count = _windowed_query(
            allergies_query, Allergy.id, skip, limit
        )

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
                ).model_dump()
                for allergy in allergies
            ]
        )
        total_count += allergy_count

    # Search vitals (no tags column, no title sort)
    if "vitals" in search_types:
        vitals_query = db.query(Vitals).filter(
            Vitals.patient_id == target_patient_id
        )
        if query_lower:
            vitals_query = vitals_query.filter(
                func.lower(Vitals.notes).contains(query_lower)
            )

        vitals_query = _apply_date_filter(
            vitals_query, Vitals.recorded_date,
            parsed_date_from, parsed_date_to
        )
        vitals_query = _apply_sort(vitals_query, sort, Vitals.recorded_date)

        vitals, vital_count = _windowed_query(
            vitals_query, Vitals.id, skip, limit
        )

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
                ).model_dump()
                for vital in vitals
            ]
        )
        total_count += vital_count

    # Step 1A fix: has_more must account for skip offset
    has_more = any(
        result.count > skip + limit
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
        query=q or "",
        total_count=total_count,
        results=results,
        pagination=PaginationInfo(
            skip=skip,
            limit=limit,
            has_more=has_more
        )
    )
