from typing import Any, Dict, List, Optional

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.models import LabTestComponent
from app.schemas.lab_test_component import (
    LabTestComponentCreate,
    LabTestComponentUpdate,
    LabTestComponentBulkCreate
)


class CRUDLabTestComponent(CRUDBase[LabTestComponent, LabTestComponentCreate, LabTestComponentUpdate]):
    """CRUD operations for LabTestComponent"""

    def __init__(self):
        super().__init__(LabTestComponent)

    def get_by_lab_result(
        self, db: Session, *, lab_result_id: int, skip: int = 0, limit: int = 100
    ) -> List[LabTestComponent]:
        """Get all test components for a specific lab result"""
        return (
            db.query(self.model)
            .filter(self.model.lab_result_id == lab_result_id)
            .order_by(self.model.display_order.asc(), self.model.test_name.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_test_name(
        self, db: Session, *, test_name: str, skip: int = 0, limit: int = 100
    ) -> List[LabTestComponent]:
        """Get all test components by test name (case-insensitive)"""
        return (
            db.query(self.model)
            .filter(self.model.test_name.ilike(f"%{test_name}%"))
            .order_by(self.model.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_abbreviation(
        self, db: Session, *, abbreviation: str, skip: int = 0, limit: int = 100
    ) -> List[LabTestComponent]:
        """Get all test components by abbreviation (exact match, case-insensitive)"""
        return (
            db.query(self.model)
            .filter(self.model.abbreviation.ilike(abbreviation))
            .order_by(self.model.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_category(
        self, db: Session, *, category: str, skip: int = 0, limit: int = 100
    ) -> List[LabTestComponent]:
        """Get all test components by category"""
        return (
            db.query(self.model)
            .filter(self.model.category == category.lower())
            .order_by(self.model.test_name.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_status(
        self, db: Session, *, status: str, skip: int = 0, limit: int = 100
    ) -> List[LabTestComponent]:
        """Get all test components by status"""
        return (
            db.query(self.model)
            .filter(self.model.status == status.lower())
            .order_by(self.model.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_abnormal_results(
        self, db: Session, *, lab_result_id: Optional[int] = None, patient_id: Optional[int] = None, skip: int = 0, limit: int = 100
    ) -> List[LabTestComponent]:
        """Get all abnormal test results (high, low, critical, abnormal)"""
        abnormal_statuses = ["high", "low", "critical", "abnormal"]
        query = db.query(self.model).filter(self.model.status.in_(abnormal_statuses))

        if lab_result_id:
            query = query.filter(self.model.lab_result_id == lab_result_id)

        if patient_id:
            # Join with lab_results table to filter by patient_id
            query = query.join(self.model.lab_result).filter(
                self.model.lab_result.has(patient_id=patient_id)
            )

        return (
            query
            .order_by(self.model.status.desc(), self.model.test_name.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_critical_results(
        self, db: Session, *, lab_result_id: Optional[int] = None, skip: int = 0, limit: int = 100
    ) -> List[LabTestComponent]:
        """Get all critical test results"""
        query = db.query(self.model).filter(self.model.status == "critical")

        if lab_result_id:
            query = query.filter(self.model.lab_result_id == lab_result_id)

        return (
            query
            .order_by(self.model.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def search_components(
        self, db: Session, *,
        query_text: str,
        lab_result_id: Optional[int] = None,
        patient_id: Optional[int] = None,
        category: Optional[str] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[LabTestComponent]:
        """Search test components by name, abbreviation, or test code"""
        search_filter = or_(
            self.model.test_name.ilike(f"%{query_text}%"),
            self.model.abbreviation.ilike(f"%{query_text}%"),
            self.model.test_code.ilike(f"%{query_text}%")
        )

        query_obj = db.query(self.model).filter(search_filter)

        if lab_result_id:
            query_obj = query_obj.filter(self.model.lab_result_id == lab_result_id)

        if patient_id:
            # Join with lab_results table to filter by patient_id
            query_obj = query_obj.join(self.model.lab_result).filter(
                self.model.lab_result.has(patient_id=patient_id)
            )

        if category:
            query_obj = query_obj.filter(self.model.category == category.lower())

        if status:
            query_obj = query_obj.filter(self.model.status == status.lower())

        return (
            query_obj
            .order_by(self.model.test_name.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_patient_and_test_name(
        self, db: Session, *, patient_id: int, test_name: str
    ) -> List[LabTestComponent]:
        """Get all test components for a patient by test name (across all lab results)"""
        return (
            db.query(self.model)
            .join(self.model.lab_result)
            .filter(
                and_(
                    self.model.lab_result.has(patient_id=patient_id),
                    self.model.test_name.ilike(f"%{test_name}%")
                )
            )
            .order_by(self.model.created_at.desc())
            .all()
        )

    def bulk_create(
        self, db: Session, *, obj_in: LabTestComponentBulkCreate
    ) -> List[LabTestComponent]:
        """Create multiple test components in bulk"""
        db_objects = []

        for component_data in obj_in.components:
            # Set the lab_result_id from the bulk operation
            component_data.lab_result_id = obj_in.lab_result_id
            db_obj = self.model(**component_data.model_dump())
            db_objects.append(db_obj)

        db.add_all(db_objects)
        db.commit()

        for db_obj in db_objects:
            db.refresh(db_obj)

        return db_objects

    def update_display_order(
        self, db: Session, *, lab_result_id: int, component_orders: List[Dict[str, int]]
    ) -> List[LabTestComponent]:
        """
        Update display order for multiple components
        component_orders should be list of {"id": component_id, "order": display_order}
        """
        updated_components = []

        for order_data in component_orders:
            component = self.get(db, order_data["id"])
            if component and component.lab_result_id == lab_result_id:
                component.display_order = order_data["order"]
                updated_components.append(component)

        db.commit()

        for component in updated_components:
            db.refresh(component)

        return updated_components

    def delete_by_lab_result(
        self, db: Session, *, lab_result_id: int
    ) -> int:
        """Delete all test components for a specific lab result"""
        deleted_count = (
            db.query(self.model)
            .filter(self.model.lab_result_id == lab_result_id)
            .delete()
        )
        db.commit()
        return deleted_count

    def get_unique_test_names(
        self, db: Session, *, limit: int = 100
    ) -> List[str]:
        """Get list of unique test names for autocomplete/suggestions"""
        results = (
            db.query(self.model.test_name)
            .distinct()
            .order_by(self.model.test_name.asc())
            .limit(limit)
            .all()
        )
        return [result[0] for result in results]

    def get_unique_abbreviations(
        self, db: Session, *, limit: int = 100
    ) -> List[str]:
        """Get list of unique abbreviations for autocomplete/suggestions"""
        results = (
            db.query(self.model.abbreviation)
            .filter(self.model.abbreviation.isnot(None))
            .distinct()
            .order_by(self.model.abbreviation.asc())
            .limit(limit)
            .all()
        )
        return [result[0] for result in results]

    def get_statistics_by_lab_result(
        self, db: Session, *, lab_result_id: int
    ) -> Dict[str, Any]:
        """Get statistics for test components in a lab result"""
        components = self.get_by_lab_result(db, lab_result_id=lab_result_id)

        total_count = len(components)
        status_counts = {}
        category_counts = {}

        for component in components:
            # Count by status
            status = component.status or "unknown"
            status_counts[status] = status_counts.get(status, 0) + 1

            # Count by category
            category = component.category or "other"
            category_counts[category] = category_counts.get(category, 0) + 1

        return {
            "total_components": total_count,
            "status_breakdown": status_counts,
            "category_breakdown": category_counts,
            "abnormal_count": sum(
                count for status, count in status_counts.items()
                if status in ["high", "low", "critical", "abnormal"]
            ),
            "critical_count": status_counts.get("critical", 0),
            "normal_count": status_counts.get("normal", 0)
        }


# Create instance of the CRUD class
lab_test_component = CRUDLabTestComponent()