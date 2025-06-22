from typing import List, Optional

from sqlalchemy.orm import Session, joinedload

from app.crud.base import CRUDBase
from app.models.models import Procedure
from app.schemas.procedure import ProcedureCreate, ProcedureUpdate


class CRUDProcedure(CRUDBase[Procedure, ProcedureCreate, ProcedureUpdate]):
    """
    Procedure-specific CRUD operations for medical procedures.

    Handles medical procedures, surgeries, and diagnostic procedures.
    """

    def get_by_patient(
        self, db: Session, *, patient_id: int, skip: int = 0, limit: int = 100
    ) -> List[Procedure]:
        """
        Retrieve all procedures for a specific patient.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient
            skip: Number of records to skip (for pagination)
            limit: Maximum number of records to return

        Returns:
            List of procedures for the patient
        """
        return super().get_by_patient(
            db=db,
            patient_id=patient_id,
            skip=skip,
            limit=limit,
            order_by="date",
            order_desc=True,
        )

    def get_by_status(
        self, db: Session, *, status: str, patient_id: Optional[int] = None
    ) -> List[Procedure]:
        """
        Retrieve procedures by status, optionally filtered by patient.

        Args:
            db: SQLAlchemy database session
            status: Status to filter by
            patient_id: Optional patient ID to filter by

        Returns:
            List of procedures with the specified status
        """
        return super().get_by_status(
            db=db,
            status=status,
            patient_id=patient_id,
            order_by="date",
            order_desc=True,
        )

    def get_by_practitioner(
        self,
        db: Session,
        *,
        practitioner_id: int,
        patient_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Procedure]:
        """
        Retrieve all procedures for a specific practitioner.

        Args:
            db: SQLAlchemy database session
            practitioner_id: ID of the practitioner
            patient_id: Optional patient ID to filter by
            skip: Number of records to skip (for pagination)
            limit: Maximum number of records to return

        Returns:
            List of procedures for the practitioner
        """
        return super().get_by_practitioner(
            db=db,
            practitioner_id=practitioner_id,
            patient_id=patient_id,
            skip=skip,
            limit=limit,
            order_by="date",
            order_desc=True,
        )

    def get_scheduled(
        self, db: Session, *, patient_id: Optional[int] = None
    ) -> List[Procedure]:
        """
        Get all scheduled procedures, optionally filtered by patient.

        Args:
            db: SQLAlchemy database session
            patient_id: Optional patient ID to filter by

        Returns:
            List of scheduled procedures
        """
        return super().get_by_status(
            db=db,
            status="scheduled",
            patient_id=patient_id,
            order_by="date",
            order_desc=False,  # Ascending order for scheduled procedures
        )

    def get_with_relations(self, db: Session, procedure_id: int) -> Optional[Procedure]:
        """
        Retrieve a procedure with all related information loaded.

        Args:
            db: SQLAlchemy database session
            procedure_id: ID of the procedure

        Returns:
            Procedure with patient and practitioner relationships loaded
        """
        return super().get_with_relations(
            db=db, record_id=procedure_id, relations=["patient", "practitioner"]
        )

    def get_recent(
        self, db: Session, *, patient_id: int, days: int = 90
    ) -> List[Procedure]:
        """
        Get recent procedures for a patient within specified days.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient
            days: Number of days to look back

        Returns:
            List of recent procedures
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


# Create the procedure CRUD instance
procedure = CRUDProcedure(Procedure)
