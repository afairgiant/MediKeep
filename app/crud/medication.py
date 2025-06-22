from typing import List, Optional

from sqlalchemy.orm import Session, joinedload

from app.crud.base import CRUDBase
from app.models.models import Medication
from app.schemas.medication import MedicationCreate, MedicationUpdate


class CRUDMedication(CRUDBase[Medication, MedicationCreate, MedicationUpdate]):
    """
    CRUD operations for Medication model.

    Provides specialized methods for medication management including
    patient-specific medication queries and dosage management.
    """

    def get_by_patient(
        self, db: Session, *, patient_id: int, skip: int = 0, limit: int = 100
    ) -> List[Medication]:
        """
        Get all medications for a specific patient.

        Args:
            db: Database session
            patient_id: Patient ID to filter by
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of medications for the patient
        """
        return super().get_by_patient(
            db=db,
            patient_id=patient_id,
            skip=skip,
            limit=limit,
            load_relations=["practitioner", "pharmacy"],
        )

    def get_active_by_patient(
        self, db: Session, *, patient_id: int
    ) -> List[Medication]:
        """
        Get all active medications for a specific patient.

        Args:
            db: Database session
            patient_id: Patient ID to filter by

        Returns:
            List of active medications for the patient
        """
        return super().get_by_patient(
            db=db,
            patient_id=patient_id,
            additional_filters={"is_active": True},
            load_relations=["practitioner", "pharmacy"],
        )

    def get_by_name(
        self, db: Session, *, name: str, skip: int = 0, limit: int = 100
    ) -> List[Medication]:
        """
        Get medications by name (partial match).

        Args:
            db: Database session
            name: Medication name to search for
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of medications matching the name
        """
        return self.search_by_text_field(
            db=db,
            field_name="medication_name",
            search_term=name,
            skip=skip,
            limit=limit,
        )

    def deactivate(self, db: Session, *, db_obj: Medication) -> Medication:
        """
        Deactivate a medication (mark as inactive).

        Args:
            db: Database session
            db_obj: Medication object to deactivate

        Returns:
            Updated medication object
        """
        db_obj.is_active = False
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def activate(self, db: Session, *, db_obj: Medication) -> Medication:
        """
        Activate a medication (mark as active).

        Args:
            db: Database session
            db_obj: Medication object to activate

        Returns:
            Updated medication object
        """
        db_obj.is_active = True
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_with_relationships(self, db: Session, *, id: int) -> Optional[Medication]:
        """
        Get a medication by ID with its relationships loaded.

        Args:
            db: Database session
            id: Medication ID

        Returns:
            Medication with relationships loaded
        """
        return self.get_with_relations(
            db=db, record_id=id, relations=["practitioner", "pharmacy"]
        )


medication = CRUDMedication(Medication)
