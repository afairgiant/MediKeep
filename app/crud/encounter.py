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
            List of encounters for the patient        """
        return (
            db.query(Encounter)
            .filter(Encounter.patient_id == patient_id)
            .order_by(Encounter.date.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_practitioner(
        self, db: Session, *, practitioner_id: int, patient_id: Optional[int] = None, skip: int = 0, limit: int = 100
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
        query = db.query(Encounter).filter(Encounter.practitioner_id == practitioner_id)
        
        if patient_id:
            query = query.filter(Encounter.patient_id == patient_id)
            
        return (
            query
            .order_by(Encounter.date.desc())
            .offset(skip)
            .limit(limit)
            .all()
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
        return (
            db.query(Encounter)
            .options(joinedload(Encounter.patient), joinedload(Encounter.practitioner))
            .filter(Encounter.id == encounter_id)
            .first()
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
        from datetime import date, timedelta

        cutoff_date = date.today() - timedelta(days=days)
        return (
            db.query(Encounter)
            .filter(Encounter.patient_id == patient_id, Encounter.date >= cutoff_date)
            .order_by(Encounter.date.desc())
            .all()
        )


# Create the encounter CRUD instance
encounter = CRUDEncounter(Encounter)
