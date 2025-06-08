from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.crud.base import CRUDBase
from app.models.models import LabResult, LabResultFile
from app.schemas.lab_result import LabResultCreate, LabResultUpdate


class CRUDLabResult(CRUDBase[LabResult, LabResultCreate, LabResultUpdate]):
    """CRUD operations for LabResult"""

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

    def get_by_code(
        self, db: Session, *, code: str, skip: int = 0, limit: int = 100
    ) -> List[LabResult]:
        """Get all lab results by test code (e.g., LOINC code)"""
        return (
            db.query(self.model)
            .filter(LabResult.code == code)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_patient_and_code(
        self, db: Session, *, patient_id: int, code: str
    ) -> List[LabResult]:
        """Get lab results for a specific patient and test code"""
        return (
            db.query(self.model)
            .filter(and_(LabResult.patient_id == patient_id, LabResult.code == code))
            .all()
        )

    def get_with_files(self, db: Session, *, lab_result_id: int) -> Optional[LabResult]:
        """Get lab result with associated files"""
        return db.query(self.model).filter(LabResult.id == lab_result_id).first()

    def search_by_code_pattern(
        self, db: Session, *, code_pattern: str, skip: int = 0, limit: int = 100
    ) -> List[LabResult]:
        """Search lab results by code pattern (partial match)"""
        return (
            db.query(self.model)
            .filter(LabResult.code.ilike(f"%{code_pattern}%"))
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
