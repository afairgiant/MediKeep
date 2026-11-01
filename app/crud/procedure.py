from typing import List

from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.crud.base_tags import TagFilterMixin
from app.models.models import Procedure
from app.schemas.procedure import ProcedureCreate, ProcedureUpdate


class CRUDProcedure(
    CRUDBase[Procedure, ProcedureCreate, ProcedureUpdate], TagFilterMixin
):
    """
    Procedure-specific CRUD operations for medical procedures.

    Handles medical procedures, surgeries, and diagnostic procedures.
    """

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
