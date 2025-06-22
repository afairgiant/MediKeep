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
        self,
        db: Session,
        *,
        patient_id: int,
        skip: int = 0,
        limit: int = 100,
        order_by: Optional[str] = None,
        order_desc: bool = True,
        additional_filters: Optional[Dict[str, Any]] = None,
        load_relations: Optional[List[str]] = None
    ) -> List[LabResult]:
        """Get all lab results for a specific patient"""
        return super().get_by_patient(
            db=db,
            patient_id=patient_id,
            skip=skip,
            limit=limit,
            order_by=order_by or "ordered_date",
            order_desc=order_desc,
            additional_filters=additional_filters,
            load_relations=load_relations,
        )

    def get_by_practitioner(
        self, db: Session, *, practitioner_id: int, skip: int = 0, limit: int = 100
    ) -> List[LabResult]:
        """Get all lab results ordered by a specific practitioner"""
        return super().get_by_practitioner(
            db=db,
            practitioner_id=practitioner_id,
            skip=skip,
            limit=limit,
            order_by="ordered_date",
            order_desc=True,
        )

    def get_by_test_code(
        self, db: Session, *, test_code: str, skip: int = 0, limit: int = 100
    ) -> List[LabResult]:
        """Get all lab results by test code (e.g., LOINC code)"""
        return self.get_by_field(
            db=db,
            field_name="test_code",
            field_value=test_code,
            skip=skip,
            limit=limit,
            order_by="ordered_date",
            order_desc=True,
        )

    def get_by_patient_and_test_code(
        self, db: Session, *, patient_id: int, test_code: str
    ) -> List[LabResult]:
        """Get lab results for a specific patient and test code"""
        return self.get_by_field(
            db=db,
            field_name="patient_id",
            field_value=patient_id,
            additional_filters={"test_code": test_code},
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
        return self.search_by_text_field(
            db=db,
            field_name="test_code",
            search_term=test_code_pattern,
            skip=skip,
            limit=limit,
            order_by="ordered_date",
            order_desc=True,
        )


# Create instance of the CRUD class
lab_result = CRUDLabResult(LabResult)
