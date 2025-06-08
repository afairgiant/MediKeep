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

    def get_by_patient(
        self, db: Session, *, patient_id: int, skip: int = 0, limit: int = 100
    ) -> List[Condition]:
        """
        Retrieve all conditions for a specific patient.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient
            skip: Number of records to skip (for pagination)
            limit: Maximum number of records to return

        Returns:
            List of conditions for the patient
        """
        return (
            db.query(Condition)
            .filter(Condition.patient_id == patient_id)
            .order_by(Condition.onsetDate.desc().nullslast())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_status(
        self, db: Session, *, status: str, patient_id: Optional[int] = None
    ) -> List[Condition]:
        """
        Retrieve conditions by status, optionally filtered by patient.

        Args:
            db: SQLAlchemy database session
            status: Status to filter by
            patient_id: Optional patient ID to filter by

        Returns:
            List of conditions with the specified status
        """
        query = db.query(Condition).filter(Condition.status == status.lower())

        if patient_id:
            query = query.filter(Condition.patient_id == patient_id)

        return query.order_by(Condition.onsetDate.desc().nullslast()).all()

    def get_active_conditions(self, db: Session, *, patient_id: int) -> List[Condition]:
        """
        Get all active conditions for a patient.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient

        Returns:
            List of active conditions
        """
        return (
            db.query(Condition)
            .filter(Condition.patient_id == patient_id, Condition.status == "active")
            .order_by(Condition.onsetDate.desc().nullslast())
            .all()
        )

    def get_with_relations(self, db: Session, condition_id: int) -> Optional[Condition]:
        """
        Retrieve a condition with all related information loaded.

        Args:
            db: SQLAlchemy database session
            condition_id: ID of the condition

        Returns:
            Condition with patient, practitioner, and treatments relationships loaded
        """
        return (
            db.query(Condition)
            .options(
                joinedload(Condition.patient),
                joinedload(Condition.practitioner),
                joinedload(Condition.treatments),
            )
            .filter(Condition.id == condition_id)
            .first()
        )


# Create the condition CRUD instance
condition = CRUDCondition(Condition)
