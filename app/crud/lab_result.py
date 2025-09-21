from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.crud.base_tags import TagFilterMixin
from app.models.models import LabResult, LabResultCondition
from app.schemas.lab_result import (
    LabResultCreate, 
    LabResultUpdate,
    LabResultConditionCreate,
    LabResultConditionUpdate
)


class CRUDLabResult(CRUDBase[LabResult, LabResultCreate, LabResultUpdate], TagFilterMixin):
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


class CRUDLabResultCondition(CRUDBase[LabResultCondition, LabResultConditionCreate, LabResultConditionUpdate]):
    """CRUD operations for LabResultCondition junction table"""

    def __init__(self):
        super().__init__(LabResultCondition)

    def get_by_lab_result(
        self, db: Session, *, lab_result_id: int
    ) -> List[LabResultCondition]:
        """Get all condition relationships for a specific lab result"""
        return (
            db.query(self.model)
            .filter(self.model.lab_result_id == lab_result_id)
            .all()
        )

    def get_by_condition(
        self, db: Session, *, condition_id: int
    ) -> List[LabResultCondition]:
        """Get all lab result relationships for a specific condition"""
        return (
            db.query(self.model)
            .filter(self.model.condition_id == condition_id)
            .all()
        )

    def get_by_lab_result_and_condition(
        self, db: Session, *, lab_result_id: int, condition_id: int
    ) -> Optional[LabResultCondition]:
        """Get specific relationship between lab result and condition"""
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.lab_result_id == lab_result_id,
                    self.model.condition_id == condition_id
                )
            )
            .first()
        )

    def delete_by_lab_result_and_condition(
        self, db: Session, *, lab_result_id: int, condition_id: int
    ) -> bool:
        """Delete specific relationship between lab result and condition"""
        relationship = self.get_by_lab_result_and_condition(
            db, lab_result_id=lab_result_id, condition_id=condition_id
        )
        if relationship:
            db.delete(relationship)
            db.commit()
            return True
        return False


# Create instances of the CRUD classes
lab_result = CRUDLabResult()
lab_result_condition = CRUDLabResultCondition()
