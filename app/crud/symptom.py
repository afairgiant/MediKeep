from datetime import datetime, date
from typing import List, Optional

from sqlalchemy import and_, desc, func
from sqlalchemy.orm import Session, joinedload

from app.crud.base import CRUDBase
from app.models.models import (
    Symptom,
    SymptomOccurrence,
    SymptomCondition,
    SymptomMedication,
    SymptomTreatment,
    get_utc_now
)
from app.schemas.symptom import (
    SymptomCreate,
    SymptomUpdate,
    SymptomOccurrenceCreate,
    SymptomOccurrenceUpdate,
    SymptomConditionCreate,
    SymptomConditionUpdate,
    SymptomMedicationCreate,
    SymptomMedicationUpdate,
    SymptomTreatmentCreate,
    SymptomTreatmentUpdate
)


# ============================================================================
# NEW TWO-LEVEL HIERARCHY CRUD OPERATIONS
# ============================================================================


class CRUDSymptomParent(CRUDBase[Symptom, SymptomCreate, SymptomUpdate]):
    """
    CRUD operations for Symptom (parent definition) model.

    Manages symptom definitions/types (e.g., "Migraine", "Back Pain").
    Individual episodes are managed by CRUDSymptomOccurrence.
    """

    def __init__(self):
        super().__init__(Symptom, timezone_fields=["first_occurrence_date", "last_occurrence_date"])

    def get_with_occurrences(
        self,
        db: Session,
        *,
        symptom_id: int
    ) -> Optional[Symptom]:
        """
        Get symptom with all its occurrences eagerly loaded.
        Useful for displaying full symptom history.
        """
        return (
            db.query(self.model)
            .options(joinedload(Symptom.occurrences))
            .filter(self.model.id == symptom_id)
            .first()
        )

    def get_occurrence_count(
        self,
        db: Session,
        *,
        symptom_id: int
    ) -> int:
        """Get the count of occurrences for a specific symptom"""
        return (
            db.query(func.count(SymptomOccurrence.id))
            .filter(SymptomOccurrence.symptom_id == symptom_id)
            .scalar() or 0
        )

    def update_last_occurrence_date(
        self,
        db: Session,
        *,
        symptom_id: int,
        occurrence_date: date
    ) -> Optional[Symptom]:
        """
        Update the last_occurrence_date for a symptom.
        Called automatically when adding new occurrences.
        """
        symptom = db.query(self.model).filter(self.model.id == symptom_id).first()
        if not symptom:
            return None

        symptom.last_occurrence_date = occurrence_date
        symptom.updated_at = get_utc_now()
        db.commit()
        db.refresh(symptom)
        return symptom

    def recalculate_occurrence_dates(
        self,
        db: Session,
        *,
        symptom_id: int
    ) -> Optional[Symptom]:
        """
        Recalculate first_occurrence_date and last_occurrence_date from actual occurrences.
        Useful after editing or deleting occurrences.
        Returns None if symptom doesn't exist.
        """
        symptom = db.query(self.model).filter(self.model.id == symptom_id).first()
        if not symptom:
            return None

        # Get min and max occurrence dates
        date_stats = (
            db.query(
                func.min(SymptomOccurrence.occurrence_date).label("first"),
                func.max(SymptomOccurrence.occurrence_date).label("last")
            )
            .filter(SymptomOccurrence.symptom_id == symptom_id)
            .first()
        )

        if date_stats and date_stats.first:
            # Update both dates from actual occurrences
            symptom.first_occurrence_date = date_stats.first
            symptom.last_occurrence_date = date_stats.last
            symptom.updated_at = get_utc_now()
            db.commit()
            db.refresh(symptom)

        return symptom

    def get_by_patient(
        self,
        db: Session,
        *,
        patient_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[Symptom]:
        """
        Get all symptom definitions for a patient.
        Optionally filter by status (active, resolved, monitoring).
        Eagerly loads occurrences for accurate occurrence_count calculation.
        """
        query = db.query(self.model).filter(self.model.patient_id == patient_id)

        if status:
            query = query.filter(self.model.status == status)

        return (
            query
            .options(joinedload(Symptom.occurrences))
            .order_by(desc(self.model.last_occurrence_date))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_active_symptoms(
        self,
        db: Session,
        *,
        patient_id: int
    ) -> List[Symptom]:
        """Get all active symptom definitions for a patient"""
        return self.get_by_patient(db=db, patient_id=patient_id, status="active")

    def get_chronic_symptoms(
        self,
        db: Session,
        *,
        patient_id: int
    ) -> List[Symptom]:
        """Get all chronic symptom definitions for a patient"""
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.patient_id == patient_id,
                    self.model.is_chronic == True
                )
            )
            .order_by(desc(self.model.last_occurrence_date))
            .all()
        )

    def search_by_name(
        self,
        db: Session,
        *,
        patient_id: int,
        search_term: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[Symptom]:
        """Search symptom definitions by name (case-insensitive with LIKE injection protection)"""
        # Escape LIKE wildcards to prevent injection
        escaped_term = (
            search_term
            .replace('\\', '\\\\')
            .replace('%', '\\%')
            .replace('_', '\\_')
        )
        return (
            db.query(self.model)
            .filter(self.model.patient_id == patient_id)
            .filter(self.model.symptom_name.ilike(f"%{escaped_term}%", escape='\\'))
            .options(joinedload(Symptom.occurrences))
            .order_by(desc(self.model.last_occurrence_date))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_symptom_stats(self, db: Session, *, patient_id: int) -> dict:
        """
        Get statistics for a patient's symptom definitions.
        Optimized to use only 2 queries instead of 7 (fixes N+1 problem).

        Returns:
            dict: Statistics including total count, active count, chronic count, etc.
        """
        # Query 1: Get all symptom counts grouped by status and chronic flag
        # This replaces 4 separate count queries
        symptom_stats = (
            db.query(
                func.count(self.model.id).label("total"),
                func.sum(func.cast(self.model.status == "active", func.Integer())).label("active"),
                func.sum(func.cast(self.model.status == "resolved", func.Integer())).label("resolved"),
                func.sum(func.cast(self.model.is_chronic, func.Integer())).label("chronic")
            )
            .filter(self.model.patient_id == patient_id)
            .first()
        )

        total_symptoms = symptom_stats.total or 0

        if total_symptoms == 0:
            return {
                "total_symptoms": 0,
                "active_symptoms": 0,
                "chronic_symptoms": 0,
                "resolved_symptoms": 0,
                "total_occurrences": 0,
                "most_frequent_symptom": None,
                "most_frequent_count": None,
            }

        # Query 2: Get total occurrence count for this patient
        total_occurrences = (
            db.query(func.count(SymptomOccurrence.id))
            .join(Symptom)
            .filter(Symptom.patient_id == patient_id)
            .scalar() or 0
        )

        # Query 3: Get most frequent symptom (only if there are occurrences)
        most_frequent_symptom = None
        most_frequent_count = None
        if total_occurrences > 0:
            most_frequent = (
                db.query(
                    Symptom.symptom_name,
                    func.count(SymptomOccurrence.id).label("occurrence_count")
                )
                .join(SymptomOccurrence)
                .filter(Symptom.patient_id == patient_id)
                .group_by(Symptom.symptom_name)
                .order_by(desc("occurrence_count"))
                .first()
            )
            if most_frequent:
                most_frequent_symptom = most_frequent[0]
                most_frequent_count = most_frequent[1]

        return {
            "total_symptoms": total_symptoms,
            "active_symptoms": symptom_stats.active or 0,
            "chronic_symptoms": symptom_stats.chronic or 0,
            "resolved_symptoms": symptom_stats.resolved or 0,
            "total_occurrences": total_occurrences,
            "most_frequent_symptom": most_frequent_symptom,
            "most_frequent_count": most_frequent_count,
        }


class CRUDSymptomOccurrence(CRUDBase[SymptomOccurrence, SymptomOccurrenceCreate, SymptomOccurrenceUpdate]):
    """
    CRUD operations for SymptomOccurrence (individual episode) model.

    Manages individual episodes of symptoms.
    Each occurrence is linked to a parent Symptom definition.
    """

    def __init__(self):
        super().__init__(SymptomOccurrence, timezone_fields=["occurrence_date", "resolved_date"])

    def create(
        self,
        db: Session,
        *,
        obj_in: SymptomOccurrenceCreate
    ) -> SymptomOccurrence:
        """
        Create a new symptom occurrence.
        Automatically updates the parent symptom's last_occurrence_date.
        Uses single transaction to avoid race conditions.
        """
        # Check if parent symptom exists
        symptom = db.query(Symptom).filter(Symptom.id == obj_in.symptom_id).first()
        if not symptom:
            raise ValueError(f"Parent Symptom with id {obj_in.symptom_id} not found.")

        # Create occurrence object without committing yet
        occurrence_dict = obj_in.model_dump()
        occurrence = self.model(**occurrence_dict)
        db.add(occurrence)

        # Update parent symptom in same transaction
        symptom.last_occurrence_date = obj_in.occurrence_date
        symptom.updated_at = get_utc_now()

        # Single commit for both operations (fixes race condition)
        db.commit()
        db.refresh(occurrence)
        return occurrence

    def update(
        self,
        db: Session,
        *,
        db_obj: SymptomOccurrence,
        obj_in: SymptomOccurrenceUpdate
    ) -> SymptomOccurrence:
        """
        Update a symptom occurrence.
        Recalculates parent symptom dates if occurrence_date changed.
        """
        # Use base class update
        updated_occurrence = super().update(db=db, db_obj=db_obj, obj_in=obj_in)

        # If occurrence_date changed, recalculate parent symptom dates
        if obj_in.occurrence_date is not None:
            symptom_parent.recalculate_occurrence_dates(
                db=db, symptom_id=updated_occurrence.symptom_id
            )

        return updated_occurrence

    def delete(
        self,
        db: Session,
        *,
        id: int
    ) -> SymptomOccurrence:
        """
        Delete a symptom occurrence.
        Recalculates parent symptom dates after deletion.
        """
        # Get occurrence first to know symptom_id
        occurrence = self.get(db=db, id=id)
        if not occurrence:
            raise ValueError(f"Occurrence with id {id} not found.")

        symptom_id = occurrence.symptom_id

        # Use base class delete
        deleted_occurrence = super().delete(db=db, id=id)

        # Recalculate parent symptom dates
        symptom_parent.recalculate_occurrence_dates(db=db, symptom_id=symptom_id)

        return deleted_occurrence

    def get_by_symptom(
        self,
        db: Session,
        *,
        symptom_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> List[SymptomOccurrence]:
        """Get all occurrences for a specific symptom definition"""
        return (
            db.query(self.model)
            .filter(self.model.symptom_id == symptom_id)
            .order_by(desc(self.model.occurrence_date))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_date_range(
        self,
        db: Session,
        *,
        symptom_id: int,
        start_date: date,
        end_date: date
    ) -> List[SymptomOccurrence]:
        """Get occurrences for a symptom within a date range"""
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.symptom_id == symptom_id,
                    self.model.occurrence_date >= start_date,
                    self.model.occurrence_date <= end_date
                )
            )
            .order_by(desc(self.model.occurrence_date))
            .all()
        )

    def get_by_patient_date_range(
        self,
        db: Session,
        *,
        patient_id: int,
        start_date: date,
        end_date: date,
        skip: int = 0,
        limit: int = 100
    ) -> List[SymptomOccurrence]:
        """Get all symptom occurrences for a patient within a date range"""
        return (
            db.query(self.model)
            .join(Symptom)
            .filter(
                and_(
                    Symptom.patient_id == patient_id,
                    self.model.occurrence_date >= start_date,
                    self.model.occurrence_date <= end_date
                )
            )
            .order_by(desc(self.model.occurrence_date))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_severity(
        self,
        db: Session,
        *,
        symptom_id: int,
        severity: str
    ) -> List[SymptomOccurrence]:
        """Get occurrences for a symptom filtered by severity"""
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.symptom_id == symptom_id,
                    self.model.severity == severity
                )
            )
            .order_by(desc(self.model.occurrence_date))
            .all()
        )

    def get_latest_by_symptom(
        self,
        db: Session,
        *,
        symptom_id: int
    ) -> Optional[SymptomOccurrence]:
        """Get the most recent occurrence for a symptom"""
        return (
            db.query(self.model)
            .filter(self.model.symptom_id == symptom_id)
            .order_by(desc(self.model.occurrence_date))
            .first()
        )

    def get_timeline_data(
        self,
        db: Session,
        *,
        patient_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[dict]:
        """
        Get individual symptom occurrence data formatted for timeline visualization.
        Returns all occurrences (not aggregated) so frontend can group/display as needed.
        """
        query = (
            db.query(
                self.model.id,
                self.model.occurrence_date,
                self.model.severity,
                self.model.pain_scale,
                self.model.duration,
                self.model.location,
                self.model.time_of_day,
                self.model.impact_level,
                self.model.notes,
                Symptom.symptom_name,
                Symptom.id.label("symptom_id")
            )
            .join(Symptom)
            .filter(Symptom.patient_id == patient_id)
        )

        if start_date:
            query = query.filter(self.model.occurrence_date >= start_date)
        if end_date:
            query = query.filter(self.model.occurrence_date <= end_date)

        results = (
            query
            .order_by(desc(self.model.occurrence_date))
            .all()
        )

        timeline_data = []
        for row in results:
            timeline_data.append({
                "occurrence_id": row.id,
                "date": row.occurrence_date.isoformat() if row.occurrence_date else None,
                "symptom_name": row.symptom_name,
                "symptom_id": row.symptom_id,
                "severity": row.severity,
                "pain_scale": row.pain_scale,
                "duration": row.duration,
                "location": row.location,
                "time_of_day": row.time_of_day,
                "impact_level": row.impact_level,
                "notes": row.notes,
            })

        return timeline_data

    def get_occurrence_stats(
        self,
        db: Session,
        *,
        symptom_id: int
    ) -> dict:
        """
        Get statistics for a symptom's occurrences.

        Returns:
            dict: Stats including total count, severity distribution, avg pain scale, etc.
        """
        total_occurrences = (
            db.query(self.model)
            .filter(self.model.symptom_id == symptom_id)
            .count() or 0
        )

        if total_occurrences == 0:
            return {
                "total_occurrences": 0,
                "severity_distribution": {},
                "average_pain_scale": None,
                "most_recent_date": None,
            }

        severity_dist = (
            db.query(
                self.model.severity,
                func.count(self.model.id).label("count")
            )
            .filter(self.model.symptom_id == symptom_id)
            .group_by(self.model.severity)
            .all()
        )

        severity_distribution = {
            severity: count for severity, count in severity_dist
        }

        avg_pain = (
            db.query(func.avg(self.model.pain_scale))
            .filter(
                and_(
                    self.model.symptom_id == symptom_id,
                    self.model.pain_scale.isnot(None)
                )
            )
            .scalar()
        )

        most_recent = (
            db.query(func.max(self.model.occurrence_date))
            .filter(self.model.symptom_id == symptom_id)
            .scalar()
        )

        return {
            "total_occurrences": total_occurrences,
            "severity_distribution": severity_distribution,
            "average_pain_scale": round(float(avg_pain), 1) if avg_pain else None,
            "most_recent_date": most_recent,
        }


# ============================================================================
# Junction Table CRUD Operations
# ============================================================================


class CRUDSymptomCondition(CRUDBase[SymptomCondition, SymptomConditionCreate, SymptomConditionUpdate]):
    """CRUD operations for SymptomCondition junction table"""

    def __init__(self):
        super().__init__(SymptomCondition)

    def get_by_symptom(
        self, db: Session, *, symptom_id: int
    ) -> List[SymptomCondition]:
        """Get all condition relationships for a specific symptom"""
        return (
            db.query(self.model)
            .filter(self.model.symptom_id == symptom_id)
            .all()
        )

    def get_by_condition(
        self, db: Session, *, condition_id: int
    ) -> List[SymptomCondition]:
        """Get all symptom relationships for a specific condition"""
        return (
            db.query(self.model)
            .filter(self.model.condition_id == condition_id)
            .all()
        )

    def get_by_symptom_and_condition(
        self, db: Session, *, symptom_id: int, condition_id: int
    ) -> Optional[SymptomCondition]:
        """Get specific relationship between symptom and condition"""
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.symptom_id == symptom_id,
                    self.model.condition_id == condition_id
                )
            )
            .first()
        )

    def delete_by_symptom_and_condition(
        self, db: Session, *, symptom_id: int, condition_id: int
    ) -> bool:
        """Delete specific relationship between symptom and condition"""
        relationship = self.get_by_symptom_and_condition(
            db, symptom_id=symptom_id, condition_id=condition_id
        )
        if relationship:
            db.delete(relationship)
            db.commit()
            return True
        return False


class CRUDSymptomMedication(CRUDBase[SymptomMedication, SymptomMedicationCreate, SymptomMedicationUpdate]):
    """CRUD operations for SymptomMedication junction table"""

    def __init__(self):
        super().__init__(SymptomMedication)

    def get_by_symptom(
        self, db: Session, *, symptom_id: int
    ) -> List[SymptomMedication]:
        """Get all medication relationships for a specific symptom"""
        return (
            db.query(self.model)
            .filter(self.model.symptom_id == symptom_id)
            .all()
        )

    def get_by_medication(
        self, db: Session, *, medication_id: int
    ) -> List[SymptomMedication]:
        """Get all symptom relationships for a specific medication"""
        return (
            db.query(self.model)
            .filter(self.model.medication_id == medication_id)
            .all()
        )

    def get_by_symptom_and_medication(
        self, db: Session, *, symptom_id: int, medication_id: int
    ) -> Optional[SymptomMedication]:
        """Get specific relationship between symptom and medication"""
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.symptom_id == symptom_id,
                    self.model.medication_id == medication_id
                )
            )
            .first()
        )

    def delete_by_symptom_and_medication(
        self, db: Session, *, symptom_id: int, medication_id: int
    ) -> bool:
        """Delete specific relationship between symptom and medication"""
        relationship = self.get_by_symptom_and_medication(
            db, symptom_id=symptom_id, medication_id=medication_id
        )
        if relationship:
            db.delete(relationship)
            db.commit()
            return True
        return False


class CRUDSymptomTreatment(CRUDBase[SymptomTreatment, SymptomTreatmentCreate, SymptomTreatmentUpdate]):
    """CRUD operations for SymptomTreatment junction table"""

    def __init__(self):
        super().__init__(SymptomTreatment)

    def get_by_symptom(
        self, db: Session, *, symptom_id: int
    ) -> List[SymptomTreatment]:
        """Get all treatment relationships for a specific symptom"""
        return (
            db.query(self.model)
            .filter(self.model.symptom_id == symptom_id)
            .all()
        )

    def get_by_treatment(
        self, db: Session, *, treatment_id: int
    ) -> List[SymptomTreatment]:
        """Get all symptom relationships for a specific treatment"""
        return (
            db.query(self.model)
            .filter(self.model.treatment_id == treatment_id)
            .all()
        )

    def get_by_symptom_and_treatment(
        self, db: Session, *, symptom_id: int, treatment_id: int
    ) -> Optional[SymptomTreatment]:
        """Get specific relationship between symptom and treatment"""
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.symptom_id == symptom_id,
                    self.model.treatment_id == treatment_id
                )
            )
            .first()
        )

    def delete_by_symptom_and_treatment(
        self, db: Session, *, symptom_id: int, treatment_id: int
    ) -> bool:
        """Delete specific relationship between symptom and treatment"""
        relationship = self.get_by_symptom_and_treatment(
            db, symptom_id=symptom_id, treatment_id=treatment_id
        )
        if relationship:
            db.delete(relationship)
            db.commit()
            return True
        return False


# Create singleton instances
symptom_parent = CRUDSymptomParent()
symptom_occurrence = CRUDSymptomOccurrence()
symptom_condition = CRUDSymptomCondition()
symptom_medication = CRUDSymptomMedication()
symptom_treatment = CRUDSymptomTreatment()
