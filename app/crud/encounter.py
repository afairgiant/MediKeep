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
