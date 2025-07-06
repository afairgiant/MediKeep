from typing import List, Optional

from sqlalchemy.orm import Session, joinedload

from app.crud.base import CRUDBase
from app.models.models import Condition
from app.schemas.condition import ConditionCreate, ConditionUpdate


class CRUDCondition(CRUDBase[Condition, ConditionCreate, ConditionUpdate]):
    """
    Condition-specific CRUD operations for medical conditions.

    Handles patient medical conditions, diagnoses, and their management.
    """

    def get_active_conditions(self, db: Session, *, patient_id: int) -> List[Condition]:
        """
        Get all active conditions for a patient.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient

        Returns:
            List of active conditions
        """
        return self.query(
            db=db,
            filters={"status": "active", "patient_id": patient_id},
            order_by="onset_date",
            order_desc=True,
        )


# Create the condition CRUD instance
condition = CRUDCondition(Condition)
