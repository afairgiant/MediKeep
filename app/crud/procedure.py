from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session, joinedload

from app.crud.base import CRUDBase
from app.models.models import Procedure
from app.schemas.procedure import ProcedureCreate, ProcedureUpdate


class CRUDProcedure(CRUDBase[Procedure, ProcedureCreate, ProcedureUpdate]):
    """
    Procedure-specific CRUD operations for medical procedures.

    Handles medical procedures, surgeries, and diagnostic procedures.
    """

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
        filters: Dict[str, Any] = {"status": "scheduled"}
        if patient_id:
            filters["patient_id"] = patient_id

        return self.query(
            db=db,
            filters=filters,
            order_by="date",
            order_desc=False,  # Ascending order for scheduled procedures
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
