"""CRUD operations for Medical Equipment."""
from typing import List, Optional

from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.crud.base_tags import TagFilterMixin
from app.models.models import MedicalEquipment
from app.schemas.medical_equipment import MedicalEquipmentCreate, MedicalEquipmentUpdate


class CRUDMedicalEquipment(
    CRUDBase[MedicalEquipment, MedicalEquipmentCreate, MedicalEquipmentUpdate],
    TagFilterMixin
):
    """
    Medical Equipment-specific CRUD operations.

    Handles medical equipment records like CPAP machines, nebulizers, etc.
    """

    def get_by_patient(
        self,
        db: Session,
        *,
        patient_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
    ) -> List[MedicalEquipment]:
        """
        Retrieve all equipment for a specific patient.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient
            skip: Number of records to skip (for pagination)
            limit: Maximum number of records to return
            status: Optional status filter

        Returns:
            List of medical equipment records
        """
        filters = {"patient_id": patient_id}
        if status:
            filters["status"] = status

        return self.query(
            db=db,
            filters=filters,
            skip=skip,
            limit=limit,
            order_by="prescribed_date",
            order_desc=True,
        )

    def get_active_equipment(
        self, db: Session, *, patient_id: int
    ) -> List[MedicalEquipment]:
        """
        Get all active equipment for a patient.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient

        Returns:
            List of active equipment
        """
        return self.query(
            db=db,
            filters={"status": "active", "patient_id": patient_id},
            order_by="equipment_name",
            order_desc=False,
        )

    def get_by_type(
        self,
        db: Session,
        *,
        patient_id: int,
        equipment_type: str,
        skip: int = 0,
        limit: int = 100,
    ) -> List[MedicalEquipment]:
        """
        Get equipment by type for a patient.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient
            equipment_type: Type of equipment to filter by
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of equipment of the specified type
        """
        return self.query(
            db=db,
            filters={"patient_id": patient_id, "equipment_type": equipment_type.lower()},
            skip=skip,
            limit=limit,
            order_by="prescribed_date",
            order_desc=True,
        )

    def get_needing_service(
        self, db: Session, *, patient_id: Optional[int] = None
    ) -> List[MedicalEquipment]:
        """
        Get equipment that needs service (next_service_date is past or upcoming).

        Args:
            db: SQLAlchemy database session
            patient_id: Optional patient ID to filter by

        Returns:
            List of equipment needing service
        """
        from datetime import date, timedelta

        # Get equipment where next_service_date is within 30 days or past
        upcoming_date = date.today() + timedelta(days=30)

        query = (
            db.query(self.model)
            .filter(self.model.status == "active")
            .filter(self.model.next_service_date.isnot(None))
            .filter(self.model.next_service_date <= upcoming_date)
        )

        if patient_id:
            query = query.filter(self.model.patient_id == patient_id)

        return query.order_by(self.model.next_service_date.asc()).all()


# Create the medical equipment CRUD instance
medical_equipment = CRUDMedicalEquipment(MedicalEquipment)
