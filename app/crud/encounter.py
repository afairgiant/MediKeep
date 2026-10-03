from typing import List, Optional, Type

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.crud.base_tags import TagFilterMixin
from app.models.base import Base
from app.models.models import (
    Condition,
    Encounter,
    EncounterCondition,
    EncounterInjury,
    EncounterLabResult,
    EncounterMedication,
    EncounterProcedure,
    EncounterSymptom,
    Injury,
    LabResult,
    Medication,
    Procedure,
    Symptom,
    Treatment,
    TreatmentEncounter,
)
from app.schemas.encounter import (
    EncounterCreate,
    EncounterLabResultCreate,
    EncounterLabResultUpdate,
    EncounterLinkUpdate,
    EncounterUpdate,
)


class CRUDEncounter(
    CRUDBase[Encounter, EncounterCreate, EncounterUpdate], TagFilterMixin
):
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


class CRUDEncounterLabResult(
    CRUDBase[EncounterLabResult, EncounterLabResultCreate, EncounterLabResultUpdate]
):
    """CRUD operations for EncounterLabResult junction table"""

    def __init__(self):
        super().__init__(EncounterLabResult)

    def get_by_encounter(
        self, db: Session, *, encounter_id: int
    ) -> List[EncounterLabResult]:
        """Get all lab result relationships for a specific encounter"""
        return (
            db.query(self.model).filter(self.model.encounter_id == encounter_id).all()
        )

    def get_by_encounter_with_details(self, db: Session, *, encounter_id: int) -> List:
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
            db.query(self.model).filter(self.model.lab_result_id == lab_result_id).all()
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
        self,
        db: Session,
        *,
        encounter_id: int,
        lab_result_ids: List[int],
        purpose: Optional[str] = None,
        relevance_note: Optional[str] = None,
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


class CRUDEncounterLink(CRUDBase[Base, EncounterLinkUpdate, EncounterLinkUpdate]):
    """CRUD for a note-only encounter link junction table.

    One instance per linked record type. ``entity_model``/``entity_fk`` name the
    linked record's model and the junction column pointing at it.
    """

    def __init__(
        self, link_model: Type[Base], entity_model: Type[Base], entity_fk: str
    ):
        super().__init__(link_model)
        self.entity_model = entity_model
        self.entity_fk = entity_fk

    def _entity_col(self):
        return getattr(self.model, self.entity_fk)

    def get_by_encounter_with_details(self, db: Session, *, encounter_id: int) -> List:
        """Return (link, record) tuples for an encounter in one query."""
        return (
            db.query(self.model, self.entity_model)
            .join(self.entity_model, self._entity_col() == self.entity_model.id)
            .filter(self.model.encounter_id == encounter_id)
            .order_by(self.model.id)
            .all()
        )

    def get_by_entity_with_details(self, db: Session, *, entity_id: int) -> List:
        """Return (link, encounter) tuples for a record in one query."""
        return (
            db.query(self.model, Encounter)
            .join(Encounter, self.model.encounter_id == Encounter.id)
            .filter(self._entity_col() == entity_id)
            .order_by(Encounter.date.desc(), self.model.id)
            .all()
        )

    def get_by_encounter_and_entity(
        self, db: Session, *, encounter_id: int, entity_id: int
    ) -> Optional[Base]:
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.encounter_id == encounter_id,
                    self._entity_col() == entity_id,
                )
            )
            .first()
        )

    def create_link(
        self,
        db: Session,
        *,
        encounter_id: int,
        entity_id: int,
        relevance_note: Optional[str] = None,
    ) -> Base:
        obj = self.model(
            encounter_id=encounter_id,
            relevance_note=relevance_note,
            **{self.entity_fk: entity_id},
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    def create_bulk(
        self,
        db: Session,
        *,
        encounter_id: int,
        entity_ids: List[int],
        relevance_note: Optional[str] = None,
    ) -> List[Base]:
        """Create links, skipping pairs that are already linked."""
        created = []
        for entity_id in entity_ids:
            if self.get_by_encounter_and_entity(
                db, encounter_id=encounter_id, entity_id=entity_id
            ):
                continue
            obj = self.model(
                encounter_id=encounter_id,
                relevance_note=relevance_note,
                **{self.entity_fk: entity_id},
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
encounter_procedure = CRUDEncounterLink(EncounterProcedure, Procedure, "procedure_id")
encounter_symptom = CRUDEncounterLink(EncounterSymptom, Symptom, "symptom_id")
encounter_injury = CRUDEncounterLink(EncounterInjury, Injury, "injury_id")
encounter_medication = CRUDEncounterLink(
    EncounterMedication, Medication, "medication_id"
)
encounter_condition = CRUDEncounterLink(EncounterCondition, Condition, "condition_id")
encounter_treatment = CRUDEncounterLink(TreatmentEncounter, Treatment, "treatment_id")
