from typing import List, Optional
from sqlalchemy.orm import Session, joinedload

from app.crud.base import CRUDBase
from app.models.models import Immunization
from app.schemas.immunization import ImmunizationCreate, ImmunizationUpdate


class CRUDImmunization(CRUDBase[Immunization, ImmunizationCreate, ImmunizationUpdate]):
    """
    Immunization-specific CRUD operations for vaccine records.

    Handles patient immunization records, vaccine tracking, and schedules.
    """

    def create(self, db: Session, *, obj_in: ImmunizationCreate) -> Immunization:
        """
        Create a new immunization record.

        Override base create method to properly handle date fields without jsonable_encoder.
        """
        # Convert Pydantic model to dict while preserving date objects
        # Handle both Pydantic v1 and v2 compatibility
        if hasattr(obj_in, "model_dump"):
            obj_data = obj_in.model_dump()
        else:
            obj_data = obj_in.dict()

        # Create the database object directly from the dict
        db_obj = self.model(**obj_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self, db: Session, *, db_obj: Immunization, obj_in: ImmunizationUpdate
    ) -> Immunization:
        """
        Update an immunization record.

        Override base update method to properly handle date fields without jsonable_encoder.
        """
        # Get the data as dict, excluding None values
        # Handle both Pydantic v1 and v2 compatibility
        if hasattr(obj_in, "model_dump"):
            update_data = obj_in.model_dump(exclude_unset=True)
        else:
            update_data = obj_in.dict(exclude_unset=True)

        # Update the database object
        for field, value in update_data.items():
            setattr(db_obj, field, value)

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_by_patient(
        self, db: Session, *, patient_id: int, skip: int = 0, limit: int = 100
    ) -> List[Immunization]:
        """
        Retrieve all immunizations for a specific patient.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient
            skip: Number of records to skip (for pagination)
            limit: Maximum number of records to return        Returns:
            List of immunizations for the patient
        """
        return (
            db.query(Immunization)
            .filter(Immunization.patient_id == patient_id)
            .order_by(Immunization.date_administered.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_vaccine(
        self, db: Session, *, vaccine_name: str, patient_id: Optional[int] = None
    ) -> List[Immunization]:
        """
        Retrieve immunizations by vaccine name, optionally filtered by patient.        Args:
            db: SQLAlchemy database session
            vaccine_name: Name of the vaccine
            patient_id: Optional patient ID to filter by

        Returns:
            List of immunizations for the specified vaccine
        """
        query = db.query(Immunization).filter(
            Immunization.vaccine_name.ilike(f"%{vaccine_name}%")
        )

        if patient_id:
            query = query.filter(Immunization.patient_id == patient_id)

        return query.order_by(Immunization.date_administered.desc()).all()

    def get_recent_immunizations(
        self, db: Session, *, patient_id: int, days: int = 365
    ) -> List[Immunization]:
        """
        Get recent immunizations for a patient within specified days.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient
            days: Number of days to look back

        Returns:
            List of recent immunizations"""
        from datetime import date, timedelta

        cutoff_date = date.today() - timedelta(days=days)
        return (
            db.query(Immunization)
            .filter(
                Immunization.patient_id == patient_id,
                Immunization.date_administered >= cutoff_date,
            )
            .order_by(Immunization.date_administered.desc())
            .all()
        )

    def get_with_relations(
        self, db: Session, immunization_id: int
    ) -> Optional[Immunization]:
        """
        Retrieve an immunization with all related information loaded.

        Args:
            db: SQLAlchemy database session
            immunization_id: ID of the immunization

        Returns:
            Immunization with patient and practitioner relationships loaded
        """
        return (
            db.query(Immunization)
            .options(
                joinedload(Immunization.patient), joinedload(Immunization.practitioner)
            )
            .filter(Immunization.id == immunization_id)
            .first()
        )

    def get_due_for_booster(
        self,
        db: Session,
        *,
        patient_id: int,
        vaccine_name: str,
        months_interval: int = 12,
    ) -> bool:
        """
        Check if a patient is due for a booster shot.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient
            vaccine_name: Name of the vaccine
            months_interval: Months between doses

        Returns:
            True if due for booster, False otherwise
        """
        from datetime import date, timedelta

        last_dose = (
            db.query(Immunization)
            .filter(
                Immunization.patient_id == patient_id,
                Immunization.vaccine_name.ilike(f"%{vaccine_name}%"),
            )
            .order_by(Immunization.date_administered.desc())
            .first()
        )

        if not last_dose:
            return True  # Never vaccinated        # Convert to actual date value for comparison
        last_dose_date = last_dose.date_administered
        if hasattr(last_dose_date, "date"):
            last_dose_date = last_dose_date.date()

        due_date = last_dose_date + timedelta(days=months_interval * 30)
        return bool(date.today() >= due_date)


# Create the immunization CRUD instance
immunization = CRUDImmunization(Immunization)
