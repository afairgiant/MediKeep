from typing import List, Optional

from sqlalchemy import and_
from sqlalchemy.orm import Session, joinedload

from app.crud.base import CRUDBase
from app.crud.base_tags import TagFilterMixin
from app.models.models import Condition, ConditionMedication
from app.schemas.condition import (
    ConditionCreate, 
    ConditionUpdate,
    ConditionMedicationCreate,
    ConditionMedicationUpdate
)


class CRUDCondition(CRUDBase[Condition, ConditionCreate, ConditionUpdate], TagFilterMixin):
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


class CRUDConditionMedication(CRUDBase[ConditionMedication, ConditionMedicationCreate, ConditionMedicationUpdate]):
    """CRUD operations for ConditionMedication junction table"""

    def __init__(self):
        super().__init__(ConditionMedication)

    def get_by_condition(
        self, db: Session, *, condition_id: int
    ) -> List[ConditionMedication]:
        """Get all medication relationships for a specific condition"""
        return (
            db.query(self.model)
            .filter(self.model.condition_id == condition_id)
            .all()
        )

    def get_by_medication(
        self, db: Session, *, medication_id: int
    ) -> List[ConditionMedication]:
        """Get all condition relationships for a specific medication"""
        return (
            db.query(self.model)
            .filter(self.model.medication_id == medication_id)
            .all()
        )

    def get_by_condition_and_medication(
        self, db: Session, *, condition_id: int, medication_id: int
    ) -> Optional[ConditionMedication]:
        """Get specific relationship between condition and medication"""
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.condition_id == condition_id,
                    self.model.medication_id == medication_id
                )
            )
            .first()
        )

    def delete_by_condition_and_medication(
        self, db: Session, *, condition_id: int, medication_id: int
    ) -> bool:
        """Delete specific relationship between condition and medication"""
        relationship = self.get_by_condition_and_medication(
            db, condition_id=condition_id, medication_id=medication_id
        )
        if relationship:
            db.delete(relationship)
            db.commit()
            return True
        return False


# Create the CRUD instances
condition = CRUDCondition(Condition)
condition_medication = CRUDConditionMedication()
