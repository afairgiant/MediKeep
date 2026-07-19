from typing import List, Optional

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.crud.base_tags import TagFilterMixin
from app.models.models import (
    LabResult,
    LabResultCondition,
    LabResultMedication,
    LabResultProcedure,
    Medication,
    Procedure,
)
from app.schemas.lab_result import (
    LabResultConditionCreate,
    LabResultConditionUpdate,
    LabResultCreate,
    LabResultMedicationCreate,
    LabResultMedicationUpdate,
    LabResultProcedureCreate,
    LabResultProcedureUpdate,
    LabResultUpdate,
)


class CRUDLabResult(
    CRUDBase[LabResult, LabResultCreate, LabResultUpdate], TagFilterMixin
):
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
                    self.model.test_code == test_code.upper(),
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


class CRUDLabResultCondition(
    CRUDBase[LabResultCondition, LabResultConditionCreate, LabResultConditionUpdate]
):
    """CRUD operations for LabResultCondition junction table"""

    def __init__(self):
        super().__init__(LabResultCondition)

    def get_by_lab_result(
        self, db: Session, *, lab_result_id: int
    ) -> List[LabResultCondition]:
        """Get all condition relationships for a specific lab result"""
        return (
            db.query(self.model).filter(self.model.lab_result_id == lab_result_id).all()
        )

    def get_by_condition(
        self, db: Session, *, condition_id: int
    ) -> List[LabResultCondition]:
        """Get all lab result relationships for a specific condition, with lab result eagerly loaded."""
        from app.models.labs import LabResult
        from sqlalchemy.orm import contains_eager

        return (
            db.query(self.model)
            .join(LabResult, self.model.lab_result_id == LabResult.id)
            .options(contains_eager(self.model.lab_result))
            .filter(self.model.condition_id == condition_id)
            .order_by(LabResult.completed_date.desc().nulls_last())
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
                    self.model.condition_id == condition_id,
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


class CRUDLabResultMedication(
    CRUDBase[LabResultMedication, LabResultMedicationCreate, LabResultMedicationUpdate]
):
    """CRUD operations for LabResultMedication junction table"""

    def __init__(self):
        super().__init__(LabResultMedication)

    def get_by_lab_result(
        self, db: Session, *, lab_result_id: int
    ) -> List[LabResultMedication]:
        """Get all medication relationships for a specific lab result"""
        return (
            db.query(self.model).filter(self.model.lab_result_id == lab_result_id).all()
        )

    def get_by_lab_result_with_details(self, db: Session, *, lab_result_id: int) -> List:
        """Get all medication relationships for a lab result with joined medication data.

        Returns a list of (LabResultMedication, Medication) tuples, eliminating
        the N+1 query pattern of fetching each medication individually.
        """
        return (
            db.query(self.model, Medication)
            .join(Medication, self.model.medication_id == Medication.id)
            .filter(self.model.lab_result_id == lab_result_id)
            .all()
        )

    def get_by_lab_result_and_medication(
        self, db: Session, *, lab_result_id: int, medication_id: int
    ) -> Optional[LabResultMedication]:
        """Get specific relationship between lab result and medication"""
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.lab_result_id == lab_result_id,
                    self.model.medication_id == medication_id,
                )
            )
            .first()
        )

    def delete_by_lab_result_and_medication(
        self, db: Session, *, lab_result_id: int, medication_id: int
    ) -> bool:
        """Delete specific relationship between lab result and medication"""
        relationship = self.get_by_lab_result_and_medication(
            db, lab_result_id=lab_result_id, medication_id=medication_id
        )
        if relationship:
            db.delete(relationship)
            db.commit()
            return True
        return False


class CRUDLabResultProcedure(
    CRUDBase[LabResultProcedure, LabResultProcedureCreate, LabResultProcedureUpdate]
):
    """CRUD operations for LabResultProcedure junction table"""

    def __init__(self):
        super().__init__(LabResultProcedure)

    def get_by_lab_result(
        self, db: Session, *, lab_result_id: int
    ) -> List[LabResultProcedure]:
        """Get all procedure relationships for a specific lab result"""
        return (
            db.query(self.model).filter(self.model.lab_result_id == lab_result_id).all()
        )

    def get_by_lab_result_with_details(self, db: Session, *, lab_result_id: int) -> List:
        """Get all procedure relationships for a lab result with joined procedure data.

        Returns a list of (LabResultProcedure, Procedure) tuples, eliminating
        the N+1 query pattern of fetching each procedure individually.
        """
        return (
            db.query(self.model, Procedure)
            .join(Procedure, self.model.procedure_id == Procedure.id)
            .filter(self.model.lab_result_id == lab_result_id)
            .all()
        )

    def get_by_lab_result_and_procedure(
        self, db: Session, *, lab_result_id: int, procedure_id: int
    ) -> Optional[LabResultProcedure]:
        """Get specific relationship between lab result and procedure"""
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.lab_result_id == lab_result_id,
                    self.model.procedure_id == procedure_id,
                )
            )
            .first()
        )

    def delete_by_lab_result_and_procedure(
        self, db: Session, *, lab_result_id: int, procedure_id: int
    ) -> bool:
        """Delete specific relationship between lab result and procedure"""
        relationship = self.get_by_lab_result_and_procedure(
            db, lab_result_id=lab_result_id, procedure_id=procedure_id
        )
        if relationship:
            db.delete(relationship)
            db.commit()
            return True
        return False


# Create instances of the CRUD classes
lab_result = CRUDLabResult()
lab_result_condition = CRUDLabResultCondition()
lab_result_medication = CRUDLabResultMedication()
lab_result_procedure = CRUDLabResultProcedure()
