from typing import List, Optional

from sqlalchemy.orm import Session, joinedload

from app.crud.base import CRUDBase
from app.models.models import Treatment
from app.schemas.treatment import TreatmentCreate, TreatmentUpdate


class CRUDTreatment(CRUDBase[Treatment, TreatmentCreate, TreatmentUpdate]):
    """
    Treatment-specific CRUD operations for medical treatments.

    Handles patient treatments, therapy plans, and treatment schedules.
    """

    def get_by_patient(
        self, db: Session, *, patient_id: int, skip: int = 0, limit: int = 100
    ) -> List[Treatment]:
        """
        Retrieve all treatments for a specific patient.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient
            skip: Number of records to skip (for pagination)
            limit: Maximum number of records to return

        Returns:
            List of treatments for the patient
        """
        return super().get_by_patient(
            db=db,
            patient_id=patient_id,
            skip=skip,
            limit=limit,
            order_by="start_date",
            order_desc=True,
        )

    def get_by_condition(
        self,
        db: Session,
        *,
        condition_id: int,
        patient_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100
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
        additional_filters = {}
        if patient_id:
            additional_filters["patient_id"] = patient_id

        return super().get_by_field(
            db=db,
            field_name="condition_id",
            field_value=condition_id,
            skip=skip,
            limit=limit,
            order_by="start_date",
            order_desc=True,
            additional_filters=additional_filters,
        )

    def get_by_status(
        self, db: Session, *, status: str, patient_id: Optional[int] = None
    ) -> List[Treatment]:
        """
        Retrieve treatments by status, optionally filtered by patient.

        Args:
            db: SQLAlchemy database session
            status: Status to filter by
            patient_id: Optional patient ID to filter by

        Returns:
            List of treatments with the specified status
        """
        return super().get_by_status(
            db=db,
            status=status,
            patient_id=patient_id,
            order_by="start_date",
            order_desc=True,
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
        return super().get_by_status(
            db=db,
            status="active",
            patient_id=patient_id,
            order_by="start_date",
            order_desc=True,
        )

    def get_with_relations(self, db: Session, treatment_id: int) -> Optional[Treatment]:
        """
        Retrieve a treatment with all related information loaded.

        Args:
            db: SQLAlchemy database session
            treatment_id: ID of the treatment

        Returns:
            Treatment with patient, practitioner, and condition relationships loaded
        """
        return super().get_with_relations(
            db=db,
            record_id=treatment_id,
            relations=["patient", "practitioner", "condition"],
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


# Create the treatment CRUD instance
treatment = CRUDTreatment(Treatment)
