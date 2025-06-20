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

    def get_by_patient(self, db: Session, *, patient_id: int, skip: int = 0, limit: int = 100) -> List[Treatment]:
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
        return (            db.query(Treatment)
            .filter(Treatment.patient_id == patient_id)
            .order_by(Treatment.start_date.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_condition(self, db: Session, *, condition_id: int, patient_id: Optional[int] = None, skip: int = 0, limit: int = 100) -> List[Treatment]:
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
        query = db.query(Treatment).filter(Treatment.condition_id == condition_id)
        
        if patient_id:
            query = query.filter(Treatment.patient_id == patient_id)
            
        return (
            query
            .order_by(Treatment.start_date.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_status(self, db: Session, *, status: str, patient_id: Optional[int] = None) -> List[Treatment]:
        """
        Retrieve treatments by status, optionally filtered by patient.

        Args:
            db: SQLAlchemy database session
            status: Status to filter by
            patient_id: Optional patient ID to filter by

        Returns:
            List of treatments with the specified status
        """
        query = db.query(Treatment).filter(Treatment.status == status.lower())
        
        if patient_id:
            query = query.filter(Treatment.patient_id == patient_id)
            
        return query.order_by(Treatment.start_date.desc()).all()

    def get_active_treatments(self, db: Session, *, patient_id: int) -> List[Treatment]:
        """
        Get all active treatments for a patient.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient

        Returns:
            List of active treatments
        """
        return (
            db.query(Treatment)
            .filter(
                Treatment.patient_id == patient_id,
                Treatment.status == 'active'
            )
            .order_by(Treatment.start_date.desc())
            .all()
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
        return (
            db.query(Treatment)
            .options(
                joinedload(Treatment.patient),
                joinedload(Treatment.practitioner),
                joinedload(Treatment.condition)
            )
            .filter(Treatment.id == treatment_id)
            .first()
        )

    def get_ongoing(self, db: Session, *, patient_id: Optional[int] = None) -> List[Treatment]:
        """
        Get treatments that are currently ongoing (active and no end date or future end date).

        Args:
            db: SQLAlchemy database session
            patient_id: Optional patient ID to filter by

        Returns:
            List of ongoing treatments
        """
        from datetime import date
        
        query = db.query(Treatment).filter(
            Treatment.status == 'active'
        ).filter(
            (Treatment.end_date.is_(None)) | (Treatment.end_date >= date.today())
        )
        
        if patient_id:
            query = query.filter(Treatment.patient_id == patient_id)
            
        return query.order_by(Treatment.start_date.desc()).all()


# Create the treatment CRUD instance
treatment = CRUDTreatment(Treatment)
