from typing import List, Optional, Tuple

from sqlalchemy import and_
from sqlalchemy.orm import Session, joinedload

from app.crud.base import CRUDBase
from app.crud.base_tags import TagFilterMixin
from app.models.models import (
    Treatment,
    TreatmentMedication,
    TreatmentEncounter,
    TreatmentLabResult,
    TreatmentEquipment,
)
from app.schemas.treatment import (
    TreatmentCreate,
    TreatmentUpdate,
    TreatmentMedicationCreate,
    TreatmentMedicationUpdate,
    TreatmentMedicationBulkCreate,
    TreatmentEncounterCreate,
    TreatmentEncounterUpdate,
    TreatmentEncounterBulkCreate,
    TreatmentLabResultCreate,
    TreatmentLabResultUpdate,
    TreatmentLabResultBulkCreate,
    TreatmentEquipmentCreate,
    TreatmentEquipmentUpdate,
    TreatmentEquipmentBulkCreate,
)


class CRUDTreatment(CRUDBase[Treatment, TreatmentCreate, TreatmentUpdate], TagFilterMixin):
    """
    Treatment-specific CRUD operations for medical treatments.

    Handles patient treatments, therapy plans, and treatment schedules.
    """

    def get_by_condition(
        self,
        db: Session,
        *,
        condition_id: int,
        patient_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
        load_relations: Optional[List[str]] = None
    ) -> List[Treatment]:
        """
        Retrieve all treatments for a specific condition.

        Args:
            db: SQLAlchemy database session
            condition_id: ID of the condition
            patient_id: Optional patient ID to filter by
            skip: Number of records to skip (for pagination)
            limit: Maximum number of records to return

        Returns:
            List of treatments for the condition
        """
        filters = {"condition_id": condition_id}
        if patient_id:
            filters["patient_id"] = patient_id

        return self.query(
            db=db,
            filters=filters,
            skip=skip,
            limit=limit,
            order_by="start_date",
            order_desc=True,
            load_relations=load_relations,
        )

    def get_active_treatments(self, db: Session, *, patient_id: int) -> List[Treatment]:
        """
        Get all active treatments for a patient.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient

        Returns:
            List of active treatments
        """
        return self.query(
            db=db,
            filters={"status": "active", "patient_id": patient_id},
            order_by="start_date",
            order_desc=True,
        )

    def get_ongoing(
        self, db: Session, *, patient_id: Optional[int] = None
    ) -> List[Treatment]:
        """
        Get treatments that are currently ongoing (active and no end date or future end date).

        Args:
            db: SQLAlchemy database session
            patient_id: Optional patient ID to filter by

        Returns:
            List of ongoing treatments
        """
        from datetime import date

        from sqlalchemy import or_

        query = (
            db.query(self.model)
            .filter(self.model.status == "active")
            .filter(
                or_(self.model.end_date.is_(None), self.model.end_date >= date.today())
            )
        )

        if patient_id:
            query = query.filter(self.model.patient_id == patient_id)

        return query.order_by(self.model.start_date.desc()).all()


# =============================================================================
# Treatment-Medication Relationship CRUD
# =============================================================================


class CRUDTreatmentMedication(CRUDBase[TreatmentMedication, TreatmentMedicationCreate, TreatmentMedicationUpdate]):
    """CRUD operations for TreatmentMedication junction table."""

    def __init__(self):
        super().__init__(TreatmentMedication)

    def get_by_treatment(
        self, db: Session, *, treatment_id: int
    ) -> List[TreatmentMedication]:
        """Get all medication relationships for a specific treatment."""
        return (
            db.query(self.model)
            .options(
                joinedload(TreatmentMedication.medication),
                joinedload(TreatmentMedication.specific_prescriber),
                joinedload(TreatmentMedication.specific_pharmacy),
            )
            .filter(self.model.treatment_id == treatment_id)
            .all()
        )

    def get_by_medication(
        self, db: Session, *, medication_id: int
    ) -> List[TreatmentMedication]:
        """Get all treatment relationships for a specific medication."""
        return (
            db.query(self.model)
            .options(
                joinedload(TreatmentMedication.medication),
                joinedload(TreatmentMedication.specific_prescriber),
                joinedload(TreatmentMedication.specific_pharmacy),
            )
            .filter(self.model.medication_id == medication_id)
            .all()
        )

    def get_by_treatment_and_medication(
        self, db: Session, *, treatment_id: int, medication_id: int
    ) -> Optional[TreatmentMedication]:
        """Get specific relationship between treatment and medication."""
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.treatment_id == treatment_id,
                    self.model.medication_id == medication_id
                )
            )
            .first()
        )

    def delete_by_treatment_and_medication(
        self, db: Session, *, treatment_id: int, medication_id: int
    ) -> bool:
        """Delete specific relationship between treatment and medication."""
        relationship = self.get_by_treatment_and_medication(
            db, treatment_id=treatment_id, medication_id=medication_id
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
        treatment_id: int,
        bulk_data: TreatmentMedicationBulkCreate,
    ) -> Tuple[List[TreatmentMedication], List[int]]:
        """Create multiple treatment-medication relationships at once."""
        created = []
        skipped = []

        for medication_id in bulk_data.medication_ids:
            existing = self.get_by_treatment_and_medication(
                db, treatment_id=treatment_id, medication_id=medication_id
            )
            if existing:
                skipped.append(medication_id)
                continue

            relationship = TreatmentMedication(
                treatment_id=treatment_id,
                medication_id=medication_id,
                relevance_note=bulk_data.relevance_note,
            )
            db.add(relationship)
            created.append(relationship)

        if created:
            db.commit()
            for rel in created:
                db.refresh(rel)

        return created, skipped


# =============================================================================
# Treatment-Encounter Relationship CRUD
# =============================================================================


class CRUDTreatmentEncounter(CRUDBase[TreatmentEncounter, TreatmentEncounterCreate, TreatmentEncounterUpdate]):
    """CRUD operations for TreatmentEncounter junction table."""

    def __init__(self):
        super().__init__(TreatmentEncounter)

    def get_by_treatment(
        self, db: Session, *, treatment_id: int
    ) -> List[TreatmentEncounter]:
        """Get all encounter relationships for a specific treatment."""
        return (
            db.query(self.model)
            .filter(self.model.treatment_id == treatment_id)
            .order_by(self.model.visit_sequence.asc().nulls_last())
            .all()
        )

    def get_by_encounter(
        self, db: Session, *, encounter_id: int
    ) -> List[TreatmentEncounter]:
        """Get all treatment relationships for a specific encounter."""
        return (
            db.query(self.model)
            .filter(self.model.encounter_id == encounter_id)
            .all()
        )

    def get_by_treatment_and_encounter(
        self, db: Session, *, treatment_id: int, encounter_id: int
    ) -> Optional[TreatmentEncounter]:
        """Get specific relationship between treatment and encounter."""
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.treatment_id == treatment_id,
                    self.model.encounter_id == encounter_id
                )
            )
            .first()
        )

    def delete_by_treatment_and_encounter(
        self, db: Session, *, treatment_id: int, encounter_id: int
    ) -> bool:
        """Delete specific relationship between treatment and encounter."""
        relationship = self.get_by_treatment_and_encounter(
            db, treatment_id=treatment_id, encounter_id=encounter_id
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
        treatment_id: int,
        bulk_data: TreatmentEncounterBulkCreate,
    ) -> Tuple[List[TreatmentEncounter], List[int]]:
        """Create multiple treatment-encounter relationships at once."""
        created = []
        skipped = []

        for encounter_id in bulk_data.encounter_ids:
            existing = self.get_by_treatment_and_encounter(
                db, treatment_id=treatment_id, encounter_id=encounter_id
            )
            if existing:
                skipped.append(encounter_id)
                continue

            relationship = TreatmentEncounter(
                treatment_id=treatment_id,
                encounter_id=encounter_id,
                relevance_note=bulk_data.relevance_note,
            )
            db.add(relationship)
            created.append(relationship)

        if created:
            db.commit()
            for rel in created:
                db.refresh(rel)

        return created, skipped


# =============================================================================
# Treatment-LabResult Relationship CRUD
# =============================================================================


class CRUDTreatmentLabResult(CRUDBase[TreatmentLabResult, TreatmentLabResultCreate, TreatmentLabResultUpdate]):
    """CRUD operations for TreatmentLabResult junction table."""

    def __init__(self):
        super().__init__(TreatmentLabResult)

    def get_by_treatment(
        self, db: Session, *, treatment_id: int
    ) -> List[TreatmentLabResult]:
        """Get all lab result relationships for a specific treatment."""
        return (
            db.query(self.model)
            .filter(self.model.treatment_id == treatment_id)
            .all()
        )

    def get_by_lab_result(
        self, db: Session, *, lab_result_id: int
    ) -> List[TreatmentLabResult]:
        """Get all treatment relationships for a specific lab result."""
        return (
            db.query(self.model)
            .filter(self.model.lab_result_id == lab_result_id)
            .all()
        )

    def get_by_treatment_and_lab_result(
        self, db: Session, *, treatment_id: int, lab_result_id: int
    ) -> Optional[TreatmentLabResult]:
        """Get specific relationship between treatment and lab result."""
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.treatment_id == treatment_id,
                    self.model.lab_result_id == lab_result_id
                )
            )
            .first()
        )

    def delete_by_treatment_and_lab_result(
        self, db: Session, *, treatment_id: int, lab_result_id: int
    ) -> bool:
        """Delete specific relationship between treatment and lab result."""
        relationship = self.get_by_treatment_and_lab_result(
            db, treatment_id=treatment_id, lab_result_id=lab_result_id
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
        treatment_id: int,
        bulk_data: TreatmentLabResultBulkCreate,
    ) -> Tuple[List[TreatmentLabResult], List[int]]:
        """Create multiple treatment-lab result relationships at once."""
        created = []
        skipped = []

        for lab_result_id in bulk_data.lab_result_ids:
            existing = self.get_by_treatment_and_lab_result(
                db, treatment_id=treatment_id, lab_result_id=lab_result_id
            )
            if existing:
                skipped.append(lab_result_id)
                continue

            relationship = TreatmentLabResult(
                treatment_id=treatment_id,
                lab_result_id=lab_result_id,
                purpose=bulk_data.purpose,
                relevance_note=bulk_data.relevance_note,
            )
            db.add(relationship)
            created.append(relationship)

        if created:
            db.commit()
            for rel in created:
                db.refresh(rel)

        return created, skipped


# =============================================================================
# Treatment-Equipment Relationship CRUD
# =============================================================================


class CRUDTreatmentEquipment(CRUDBase[TreatmentEquipment, TreatmentEquipmentCreate, TreatmentEquipmentUpdate]):
    """CRUD operations for TreatmentEquipment junction table."""

    def __init__(self):
        super().__init__(TreatmentEquipment)

    def get_by_treatment(
        self, db: Session, *, treatment_id: int
    ) -> List[TreatmentEquipment]:
        """Get all equipment relationships for a specific treatment."""
        return (
            db.query(self.model)
            .filter(self.model.treatment_id == treatment_id)
            .all()
        )

    def get_by_equipment(
        self, db: Session, *, equipment_id: int
    ) -> List[TreatmentEquipment]:
        """Get all treatment relationships for a specific equipment."""
        return (
            db.query(self.model)
            .filter(self.model.equipment_id == equipment_id)
            .all()
        )

    def get_by_treatment_and_equipment(
        self, db: Session, *, treatment_id: int, equipment_id: int
    ) -> Optional[TreatmentEquipment]:
        """Get specific relationship between treatment and equipment."""
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.treatment_id == treatment_id,
                    self.model.equipment_id == equipment_id
                )
            )
            .first()
        )

    def delete_by_treatment_and_equipment(
        self, db: Session, *, treatment_id: int, equipment_id: int
    ) -> bool:
        """Delete specific relationship between treatment and equipment."""
        relationship = self.get_by_treatment_and_equipment(
            db, treatment_id=treatment_id, equipment_id=equipment_id
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
        treatment_id: int,
        bulk_data: TreatmentEquipmentBulkCreate,
    ) -> Tuple[List[TreatmentEquipment], List[int]]:
        """Create multiple treatment-equipment relationships at once."""
        created = []
        skipped = []

        for equipment_id in bulk_data.equipment_ids:
            existing = self.get_by_treatment_and_equipment(
                db, treatment_id=treatment_id, equipment_id=equipment_id
            )
            if existing:
                skipped.append(equipment_id)
                continue

            relationship = TreatmentEquipment(
                treatment_id=treatment_id,
                equipment_id=equipment_id,
                relevance_note=bulk_data.relevance_note,
            )
            db.add(relationship)
            created.append(relationship)

        if created:
            db.commit()
            for rel in created:
                db.refresh(rel)

        return created, skipped


# Create the CRUD instances
treatment = CRUDTreatment(Treatment)
treatment_medication = CRUDTreatmentMedication()
treatment_encounter = CRUDTreatmentEncounter()
treatment_lab_result = CRUDTreatmentLabResult()
treatment_equipment = CRUDTreatmentEquipment()
