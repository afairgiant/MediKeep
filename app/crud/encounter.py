from typing import List, Optional

from sqlalchemy.orm import Session, joinedload

from app.crud.base import CRUDBase
from app.models.models import Encounter
from app.schemas.encounter import EncounterCreate, EncounterUpdate


class CRUDEncounter(CRUDBase[Encounter, EncounterCreate, EncounterUpdate]):
    """
    Encounter-specific CRUD operations for medical encounters.

    Handles medical encounters between patients and practitioners,
    including visits, consultations, and treatments.
    """

    def get_by_patient(
        self, db: Session, *, patient_id: int, skip: int = 0, limit: int = 100
    ) -> List[Encounter]:
        """
        Retrieve all encounters for a specific patient.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient
            skip: Number of records to skip (for pagination)
            limit: Maximum number of records to return

        Returns:
            List of encounters for the patient"""
        return super().get_by_patient(
            db=db,
            patient_id=patient_id,
            skip=skip,
            limit=limit,
            order_by="date",
            order_desc=True,
        )

    def get_by_practitioner(
        self,
        db: Session,
        *,
        practitioner_id: int,
        patient_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Encounter]:
        """
        Retrieve all encounters for a specific practitioner.

        Args:
            db: SQLAlchemy database session
            practitioner_id: ID of the practitioner
            patient_id: Optional patient ID to filter by
            skip: Number of records to skip (for pagination)
            limit: Maximum number of records to return

        Returns:
            List of encounters for the practitioner
        """
        return super().get_by_practitioner(
            db=db,
            practitioner_id=practitioner_id,
            patient_id=patient_id,
            skip=skip,
            limit=limit,
            order_by="date",
            order_desc=True,
        )

    def get_with_relations(self, db: Session, encounter_id: int) -> Optional[Encounter]:
        """
        Retrieve an encounter with all related information loaded.

        Args:
            db: SQLAlchemy database session
            encounter_id: ID of the encounter

        Returns:
            Encounter with patient and practitioner relationships loaded
        """
        return super().get_with_relations(
            db=db, record_id=encounter_id, relations=["patient", "practitioner"]
        )

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


# Create the encounter CRUD instance
encounter = CRUDEncounter(Encounter)
