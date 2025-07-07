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
        return self.query(
            db=db,
            filters={"patient_id": patient_id, "status": "active"},
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
        return self.query(
            db=db,
            search={"field": "medication_name", "term": name},
            skip=skip,
            limit=limit,
        )

    def deactivate(self, db: Session, *, db_obj: Medication) -> Medication:
        """
        Deactivate a medication (mark as stopped).

        Args:
            db: Database session
            db_obj: Medication object to deactivate

        Returns:
            Updated medication object
        """
        db_obj.status = "stopped"
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
        db_obj.status = "active"
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


medication = CRUDMedication(Medication)
