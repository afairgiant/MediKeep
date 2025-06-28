from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.core.datetime_utils import LAB_RESULT_CONVERTER
from app.crud.base import CRUDBase
from app.models.models import LabResult
from app.schemas.lab_result import LabResultCreate, LabResultUpdate


class CRUDLabResult(CRUDBase[LabResult, LabResultCreate, LabResultUpdate]):
    """CRUD operations for LabResult"""

    def __init__(self):
        super().__init__(LabResult, timezone_fields=["ordered_date", "completed_date"])

    def get_by_test_code(
        self, db: Session, *, test_code: str, skip: int = 0, limit: int = 100
    ) -> List[LabResult]:
        """Get all lab results by test code (e.g., LOINC code)"""
        return self.query(
            db=db,
            filters={"test_code": test_code},
            skip=skip,
            limit=limit,
            order_by="ordered_date",
            order_desc=True,
        )

    def get_by_patient_and_test_code(
        self, db: Session, *, patient_id: int, test_code: str
    ) -> List[LabResult]:
        """Get lab results for a specific patient and test code"""
        return self.query(
            db=db,
            filters={"patient_id": patient_id, "test_code": test_code},
            order_by="ordered_date",
            order_desc=True,
        )

    def get_with_files(self, db: Session, *, lab_result_id: int) -> Optional[LabResult]:
        """Get lab result with associated files"""
        return self.get(db, lab_result_id)

    def search_by_test_code_pattern(
        self, db: Session, *, test_code_pattern: str, skip: int = 0, limit: int = 100
    ) -> List[LabResult]:
        """Search lab results by test code pattern (partial match)"""
        return self.query(
            db=db,
            search={"field": "test_code", "term": test_code_pattern},
            skip=skip,
            limit=limit,
            order_by="ordered_date",
            order_desc=True,
        )


# Create instance of the CRUD class
lab_result = CRUDLabResult()
