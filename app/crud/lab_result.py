from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime

from app.crud.base import CRUDBase
from app.models.models import LabResult, LabResultFile
from app.schemas.lab_result import LabResultCreate, LabResultUpdate
from app.core.datetime_utils import LAB_RESULT_CONVERTER


class CRUDLabResult(CRUDBase[LabResult, LabResultCreate, LabResultUpdate]):
    """CRUD operations for LabResult"""

    def create(self, db: Session, *, obj_in: LabResultCreate) -> LabResult:
        """
        Create a new lab result with proper datetime conversion.

        Args:
            db: Database session
            obj_in: Lab result data to create

        Returns:
            Created lab result object
        """
        # Convert the Pydantic model to dict and handle datetime conversion
        obj_data = LAB_RESULT_CONVERTER.convert_model_data(obj_in)

        # Set created_at and updated_at timestamps
        now = datetime.utcnow()
        obj_data["created_at"] = now
        obj_data["updated_at"] = now

        # Create the database object
        db_obj = self.model(**obj_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self, db: Session, *, db_obj: LabResult, obj_in: LabResultUpdate
    ) -> LabResult:
        """
        Update a lab result with proper datetime conversion.

        Args:
            db: Database session
            db_obj: Existing lab result object
            obj_in: Updated lab result data

        Returns:
            Updated lab result object
        """  # Convert the update data and handle datetime conversion
        if hasattr(obj_in, "dict"):
            update_data = obj_in.dict(exclude_unset=True)
        else:
            update_data = dict(obj_in) if obj_in else {}

        if update_data:
            # Convert datetime fields
            update_data = LAB_RESULT_CONVERTER.convert(update_data)

            # Set updated_at timestamp
            update_data["updated_at"] = datetime.utcnow()

            # Apply updates to the database object
            for field, value in update_data.items():
                if hasattr(db_obj, field):
                    setattr(db_obj, field, value)

            db.add(db_obj)
            db.commit()
            db.refresh(db_obj)

        return db_obj

    def get_by_patient(
        self, db: Session, *, patient_id: int, skip: int = 0, limit: int = 100
    ) -> List[LabResult]:
        """Get all lab results for a specific patient"""
        return (
            db.query(self.model)
            .filter(LabResult.patient_id == patient_id)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_practitioner(
        self, db: Session, *, practitioner_id: int, skip: int = 0, limit: int = 100
    ) -> List[LabResult]:
        """Get all lab results ordered by a specific practitioner"""
        return (
            db.query(self.model)
            .filter(LabResult.practitioner_id == practitioner_id)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_test_code(
        self, db: Session, *, test_code: str, skip: int = 0, limit: int = 100
    ) -> List[LabResult]:
        """Get all lab results by test code (e.g., LOINC code)"""
        return (
            db.query(self.model)
            .filter(LabResult.test_code == test_code)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_patient_and_test_code(
        self, db: Session, *, patient_id: int, test_code: str
    ) -> List[LabResult]:
        """Get lab results for a specific patient and test code"""
        return (
            db.query(self.model)
            .filter(
                and_(
                    LabResult.patient_id == patient_id, LabResult.test_code == test_code
                )
            )
            .all()
        )

    def get_with_files(self, db: Session, *, lab_result_id: int) -> Optional[LabResult]:
        """Get lab result with associated files"""
        return db.query(self.model).filter(LabResult.id == lab_result_id).first()

    def search_by_test_code_pattern(
        self, db: Session, *, test_code_pattern: str, skip: int = 0, limit: int = 100
    ) -> List[LabResult]:
        """Search lab results by test code pattern (partial match)"""
        return (
            db.query(self.model)
            .filter(LabResult.test_code.ilike(f"%{test_code_pattern}%"))
            .offset(skip)
            .limit(limit)
            .all()
        )


class CRUDLabResultFile(CRUDBase[LabResultFile, dict, dict]):
    """CRUD operations for LabResultFile"""

    def get_by_lab_result(
        self, db: Session, *, lab_result_id: int
    ) -> List[LabResultFile]:
        """Get all files for a specific lab result"""
        return (
            db.query(self.model)
            .filter(LabResultFile.lab_result_id == lab_result_id)
            .all()
        )

    def get_by_file_type(
        self, db: Session, *, file_type: str, skip: int = 0, limit: int = 100
    ) -> List[LabResultFile]:
        """Get files by file type (e.g., 'pdf', 'image/png')"""
        return (
            db.query(self.model)
            .filter(LabResultFile.file_type == file_type)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def delete_by_lab_result(self, db: Session, *, lab_result_id: int) -> int:
        """Delete all files associated with a lab result"""
        deleted_count = (
            db.query(self.model)
            .filter(LabResultFile.lab_result_id == lab_result_id)
            .delete()
        )
        db.commit()
        return deleted_count

    def get_by_filename(self, db: Session, *, filename: str) -> Optional[LabResultFile]:
        """Get file by filename"""
        return db.query(self.model).filter(LabResultFile.file_name == filename).first()


# Create instances of the CRUD classes
lab_result = CRUDLabResult(LabResult)
lab_result_file = CRUDLabResultFile(LabResultFile)
