import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.models import LabResultFile
from app.schemas.lab_result_file import LabResultFileCreate, LabResultFileUpdate
from app.services.file_management_service import file_management_service


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
        return self.query(
            db=db,
            filters={"lab_result_id": lab_result_id},
            order_by="uploaded_at",
            order_desc=True,
        )

    def get_by_file_type(
        self, db: Session, *, file_type: str, skip: int = 0, limit: int = 100
    ) -> List[LabResultFile]:
        """Get files by file type (e.g., 'pdf', 'image/png')"""
        return self.query(
            db=db,
            filters={"file_type": file_type},
            skip=skip,
            limit=limit,
        )

    def get_by_filename(self, db: Session, *, filename: str) -> Optional[LabResultFile]:
        """Get file by filename"""
        results = self.query(
            db=db,
            filters={"file_name": filename},
            limit=1,
        )
        return results[0] if results else None

    def get_by_file_path(
        self, db: Session, *, file_path: str
    ) -> Optional[LabResultFile]:
        """Get file by file path"""
        results = self.query(
            db=db,
            filters={"file_path": file_path},
            limit=1,
        )
        return results[0] if results else None

    def search_by_filename_pattern(
        self, db: Session, *, filename_pattern: str, skip: int = 0, limit: int = 100
    ) -> List[LabResultFile]:
        """Search files by filename pattern (partial match)"""
        return self.query(
            db=db,
            search={"field": "file_name", "term": filename_pattern},
            skip=skip,
            limit=limit,
        )

    def get_by_lab_result_and_type(
        self, db: Session, *, lab_result_id: int, file_type: str
    ) -> List[LabResultFile]:
        """Get files for a specific lab result filtered by file type"""
        return self.query(
            db=db,
            filters={"lab_result_id": lab_result_id, "file_type": file_type},
            order_by="uploaded_at",
            order_desc=True,
        )

    def delete_by_lab_result(self, db: Session, *, lab_result_id: int) -> int:
        """Delete all files associated with a lab result (moves to trash)"""
        # Get all files for this lab result
        files_to_delete = self.get_by_lab_result(db=db, lab_result_id=lab_result_id)

        deleted_count = 0
        for file_record in files_to_delete:
            try:
                # Move physical file to trash
                file_management_service.move_to_trash(
                    file_record.file_path, reason=f"Lab result {lab_result_id} deletion"
                )

                # Remove database record
                db.delete(file_record)
                deleted_count += 1

            except Exception as e:
                # Log error but continue with other files
                from app.core.logging_config import get_logger

                logger = get_logger(__name__, "app")
                logger.error(f"Failed to delete file {file_record.file_path}: {str(e)}")

        db.commit()
        return deleted_count

    def remove(self, db: Session, *, id: int) -> Optional[LabResultFile]:
        """Override base remove method to move file to trash before deleting record"""
        # Get the file record first
        file_record = self.get(db=db, id=id)
        if not file_record:
            return None

        try:
            # Move physical file to trash
            file_management_service.move_to_trash(
                file_record.file_path, reason="Individual file deletion"
            )

            # Remove database record
            db.delete(file_record)
            db.commit()

            return file_record

        except Exception as e:
            # Log error and rollback
            from app.core.logging_config import get_logger

            logger = get_logger(__name__, "app")
            logger.error(f"Failed to delete file {file_record.file_path}: {str(e)}")
            db.rollback()
            raise e

    def get_files_by_date_range(
        self, db: Session, *, start_date, end_date, skip: int = 0, limit: int = 100
    ) -> List[LabResultFile]:
        """Get files uploaded within a date range"""
        return self.query(
            db=db,
            date_range={"field": "uploaded_at", "start": start_date, "end": end_date},
            skip=skip,
            limit=limit,
        )

    def get_recent_files(
        self, db: Session, *, days: int = 7, skip: int = 0, limit: int = 100
    ) -> List[LabResultFile]:
        """Get files uploaded in the last N days"""
        start_date = datetime.utcnow() - timedelta(days=days)
        return self.query(
            db=db,
            date_range={
                "field": "uploaded_at",
                "start": start_date,
                "end": datetime.utcnow(),
            },
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

    def count_files_by_lab_results_batch(
        self, db: Session, *, lab_result_ids: List[int]
    ) -> Dict[int, int]:
        """
        Count files for multiple lab results in a single query.
        Much more efficient than making N separate count queries.

        Returns a dictionary mapping lab_result_id to file count.
        """
        from sqlalchemy import func

        if not lab_result_ids:
            return {}

        # Single query to get counts for all lab results
        # GROUP BY lab_result_id and COUNT(*)
        results = (
            db.query(
                LabResultFile.lab_result_id,
                func.count(LabResultFile.id).label('file_count')
            )
            .filter(LabResultFile.lab_result_id.in_(lab_result_ids))
            .group_by(LabResultFile.lab_result_id)
            .all()
        )

        # Convert to dictionary, defaulting to 0 for lab results with no files
        counts = {lab_result_id: 0 for lab_result_id in lab_result_ids}
        for lab_result_id, file_count in results:
            counts[lab_result_id] = file_count

        return counts

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
