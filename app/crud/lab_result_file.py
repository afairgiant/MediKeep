from datetime import datetime
from typing import List, Optional

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.models import LabResultFile
from app.schemas.lab_result_file import LabResultFileCreate, LabResultFileUpdate


class CRUDLabResultFile(
    CRUDBase[LabResultFile, LabResultFileCreate, LabResultFileUpdate]
):
    """CRUD operations for LabResultFile"""

    def create(self, db: Session, *, obj_in: LabResultFileCreate) -> LabResultFile:
        """Create a new lab result file with proper datetime handling"""
        # Convert to dict and handle datetime fields manually
        obj_data = obj_in.dict()

        # Ensure uploaded_at is set to current time if not provided
        if not obj_data.get("uploaded_at"):
            obj_data["uploaded_at"] = datetime.utcnow()

        # Create the database object directly with datetime objects (no string conversion)
        db_obj = LabResultFile(**obj_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_by_lab_result(
        self, db: Session, *, lab_result_id: int
    ) -> List[LabResultFile]:
        """Get all files for a specific lab result"""
        return self.get_by_field(
            db=db,
            field_name="lab_result_id",
            field_value=lab_result_id,
            order_by="uploaded_at",
            order_desc=True,
        )

    def get_by_file_type(
        self, db: Session, *, file_type: str, skip: int = 0, limit: int = 100
    ) -> List[LabResultFile]:
        """Get files by file type (e.g., 'pdf', 'image/png')"""
        return self.get_by_field(
            db=db,
            field_name="file_type",
            field_value=file_type,
            skip=skip,
            limit=limit,
        )

    def get_by_filename(self, db: Session, *, filename: str) -> Optional[LabResultFile]:
        """Get file by filename"""
        results = self.get_by_field(
            db=db,
            field_name="file_name",
            field_value=filename,
            limit=1,
        )
        return results[0] if results else None

    def get_by_file_path(
        self, db: Session, *, file_path: str
    ) -> Optional[LabResultFile]:
        """Get file by file path"""
        results = self.get_by_field(
            db=db,
            field_name="file_path",
            field_value=file_path,
            limit=1,
        )
        return results[0] if results else None

    def search_by_filename_pattern(
        self, db: Session, *, filename_pattern: str, skip: int = 0, limit: int = 100
    ) -> List[LabResultFile]:
        """Search files by filename pattern (partial match)"""
        return self.search_by_text_field(
            db=db,
            field_name="file_name",
            search_term=filename_pattern,
            skip=skip,
            limit=limit,
        )

    def get_by_lab_result_and_type(
        self, db: Session, *, lab_result_id: int, file_type: str
    ) -> List[LabResultFile]:
        """Get files for a specific lab result filtered by file type"""
        return self.get_by_field(
            db=db,
            field_name="lab_result_id",
            field_value=lab_result_id,
            additional_filters={"file_type": file_type},
            order_by="uploaded_at",
            order_desc=True,
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

    def get_files_by_date_range(
        self, db: Session, *, start_date, end_date, skip: int = 0, limit: int = 100
    ) -> List[LabResultFile]:
        """Get files uploaded within a date range"""
        return self.get_by_date_range(
            db=db,
            date_field="uploaded_at",
            start_date=start_date,
            end_date=end_date,
            skip=skip,
            limit=limit,
        )

    def get_recent_files(
        self, db: Session, *, days: int = 7, skip: int = 0, limit: int = 100
    ) -> List[LabResultFile]:
        """Get files uploaded in the last N days"""
        return self.get_recent_records(
            db=db,
            date_field="uploaded_at",
            days=days,
            skip=skip,
            limit=limit,
        )

    def count_files_by_lab_result(self, db: Session, *, lab_result_id: int) -> int:
        """Count number of files for a specific lab result"""
        return (
            db.query(self.model)
            .filter(LabResultFile.lab_result_id == lab_result_id)
            .count()
        )

    def get_files_by_patient(
        self, db: Session, *, patient_id: int, skip: int = 0, limit: int = 100
    ) -> List[LabResultFile]:
        """Get all files for a specific patient through lab results"""
        from app.models.models import LabResult

        return (
            db.query(self.model)
            .join(LabResult, LabResultFile.lab_result_id == LabResult.id)
            .filter(LabResult.patient_id == patient_id)
            .order_by(LabResultFile.uploaded_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )


# Create instance of the CRUD class
lab_result_file = CRUDLabResultFile(LabResultFile)
