from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.models import LabResult
from app.schemas.lab_result import LabResultCreate, LabResultUpdate


class CRUDLabResult(CRUDBase[LabResult, LabResultCreate, LabResultUpdate]):
    """CRUD operations for LabResult"""

    def __init__(self):
        super().__init__(LabResult)

    def get_by_test_code(
        self, db: Session, *, test_code: str, skip: int = 0, limit: int = 100
    ) -> List[LabResult]:
        """Get all lab results by test code (e.g., LOINC code)"""
        # Use direct query to preserve case sensitivity for test codes
        # Test codes are normalized to uppercase in the schema validator
        return (
            db.query(self.model)
            .filter(self.model.test_code == test_code.upper())
            .order_by(self.model.ordered_date.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_patient_and_test_code(
        self, db: Session, *, patient_id: int, test_code: str
    ) -> List[LabResult]:
        """Get lab results for a specific patient and test code"""
        # Use direct query to preserve case sensitivity for test codes
        # Test codes are normalized to uppercase in the schema validator
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.patient_id == patient_id,
                    self.model.test_code == test_code.upper()
                )
            )
            .order_by(self.model.ordered_date.desc())
            .all()
        )

    def get_with_files(self, db: Session, *, lab_result_id: int) -> Optional[LabResult]:
        """Get lab result with associated files"""
        return self.get(db, lab_result_id)

    def search_by_test_code_pattern(
        self, db: Session, *, test_code_pattern: str, skip: int = 0, limit: int = 100
    ) -> List[LabResult]:
        """Search lab results by test code pattern (partial match)"""
        # Use direct query to preserve case sensitivity for test codes
        # Test codes are normalized to uppercase in the schema validator
        return (
            db.query(self.model)
            .filter(self.model.test_code.ilike(f"%{test_code_pattern.upper()}%"))
            .order_by(self.model.ordered_date.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )


# Create instance of the CRUD class
lab_result = CRUDLabResult()
