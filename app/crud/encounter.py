from typing import List, Optional

from sqlalchemy import and_
from sqlalchemy.orm import Session, joinedload

from app.crud.base import CRUDBase
from app.crud.base_tags import TagFilterMixin
from app.models.models import Encounter, EncounterLabResult, LabResult
from app.schemas.encounter import (
    EncounterCreate,
    EncounterUpdate,
    EncounterLabResultCreate,
    EncounterLabResultUpdate,
)


class CRUDEncounter(CRUDBase[Encounter, EncounterCreate, EncounterUpdate], TagFilterMixin):
    """
    Encounter-specific CRUD operations for medical encounters.

    Handles medical encounters between patients and practitioners,
    including visits, consultations, and treatments.
    """

    def get_recent(
        self, db: Session, *, patient_id: int, days: int = 30
    ) -> List[Encounter]:
        """
        Get recent encounters for a patient within specified days.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient
            days: Number of days to look back

        Returns:
            List of recent encounters
        """
        from app.crud.utils import get_recent_records

        return get_recent_records(
            db=db,
            model=self.model,
            date_field="date",
            days=days,
            patient_id=patient_id,
            order_by="date",
            order_desc=True,
        )


class CRUDEncounterLabResult(CRUDBase[EncounterLabResult, EncounterLabResultCreate, EncounterLabResultUpdate]):
    """CRUD operations for EncounterLabResult junction table"""

    def __init__(self):
        super().__init__(EncounterLabResult)

    def get_by_encounter(
        self, db: Session, *, encounter_id: int
    ) -> List[EncounterLabResult]:
        """Get all lab result relationships for a specific encounter"""
        return (
            db.query(self.model)
            .filter(self.model.encounter_id == encounter_id)
            .all()
        )

    def get_by_encounter_with_details(
        self, db: Session, *, encounter_id: int
    ) -> List:
        """Get all lab result relationships for an encounter with joined lab result data.

        Returns a list of (EncounterLabResult, LabResult) tuples, eliminating
        the N+1 query pattern of fetching each lab result individually.
        """
        return (
            db.query(self.model, LabResult)
            .join(LabResult, self.model.lab_result_id == LabResult.id)
            .filter(self.model.encounter_id == encounter_id)
            .all()
        )

    def get_by_lab_result(
        self, db: Session, *, lab_result_id: int
    ) -> List[EncounterLabResult]:
        """Get all encounter relationships for a specific lab result"""
        return (
            db.query(self.model)
            .filter(self.model.lab_result_id == lab_result_id)
            .all()
        )

    def get_by_lab_result_with_details(
        self, db: Session, *, lab_result_id: int
    ) -> List:
        """Get all encounter relationships for a lab result with joined encounter data.

        Returns a list of (EncounterLabResult, Encounter) tuples, eliminating
        the N+1 query pattern of fetching each encounter individually.
        """
        return (
            db.query(self.model, Encounter)
            .join(Encounter, self.model.encounter_id == Encounter.id)
            .filter(self.model.lab_result_id == lab_result_id)
            .all()
        )

    def get_by_encounter_and_lab_result(
        self, db: Session, *, encounter_id: int, lab_result_id: int
    ) -> Optional[EncounterLabResult]:
        """Get specific relationship between encounter and lab result"""
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.encounter_id == encounter_id,
                    self.model.lab_result_id == lab_result_id,
                )
            )
            .first()
        )

    def delete_by_encounter_and_lab_result(
        self, db: Session, *, encounter_id: int, lab_result_id: int
    ) -> bool:
        """Delete specific relationship between encounter and lab result"""
        relationship = self.get_by_encounter_and_lab_result(
            db, encounter_id=encounter_id, lab_result_id=lab_result_id
        )
        if relationship:
            db.delete(relationship)
            db.commit()
            return True
        return False

    def create_bulk(
        self, db: Session, *, encounter_id: int, lab_result_ids: List[int],
        purpose: Optional[str] = None, relevance_note: Optional[str] = None
    ) -> List[EncounterLabResult]:
        """Bulk create relationships, skipping existing ones"""
        created = []
        for lab_result_id in lab_result_ids:
            existing = self.get_by_encounter_and_lab_result(
                db, encounter_id=encounter_id, lab_result_id=lab_result_id
            )
            if not existing:
                obj = EncounterLabResult(
                    encounter_id=encounter_id,
                    lab_result_id=lab_result_id,
                    purpose=purpose,
                    relevance_note=relevance_note,
                )
                db.add(obj)
                created.append(obj)
        if created:
            db.commit()
            for obj in created:
                db.refresh(obj)
        return created


# Create the encounter CRUD instances
encounter = CRUDEncounter(Encounter)
encounter_lab_result = CRUDEncounterLabResult()
