from typing import Any, Dict, List, Optional

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from app.crud.base import CRUDBase
from app.models.models import LabTestComponent
from app.schemas.lab_test_component import (
    LabTestComponentBulkCreate,
    LabTestComponentCreate,
    LabTestComponentUpdate,
)


def apply_unit_filter(query, unit_column, unit: Optional[str]):
    """Scope a query to a lab-test unit.

    None = no filter (legacy merged-across-units). Non-empty = case-insensitive,
    trimmed match. Empty string = rows with NULL or empty unit.
    """
    if unit is None:
        return query
    normalized = unit.strip().lower()
    if normalized:
        return query.filter(func.lower(func.trim(unit_column)) == normalized)
    return query.filter(or_(unit_column.is_(None), func.trim(unit_column) == ""))


class CRUDLabTestComponent(
    CRUDBase[LabTestComponent, LabTestComponentCreate, LabTestComponentUpdate]
):
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
        self,
        db: Session,
        *,
        lab_result_id: Optional[int] = None,
        patient_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[LabTestComponent]:
        """Get all abnormal test results (high, low, critical, abnormal)"""
        abnormal_statuses = ["high", "low", "critical", "abnormal"]
        query = db.query(self.model).filter(self.model.status.in_(abnormal_statuses))

        if lab_result_id:
            query = query.filter(self.model.lab_result_id == lab_result_id)

        if patient_id:
            # Join with lab_results table to filter by patient_id and eager load to prevent N+1
            query = (
                query.join(self.model.lab_result)
                .filter(self.model.lab_result.has(patient_id=patient_id))
                .options(joinedload(self.model.lab_result))
            )

        return (
            query.order_by(self.model.status.desc(), self.model.test_name.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_critical_results(
        self,
        db: Session,
        *,
        lab_result_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[LabTestComponent]:
        """Get all critical test results"""
        query = db.query(self.model).filter(self.model.status == "critical")

        if lab_result_id:
            query = query.filter(self.model.lab_result_id == lab_result_id)

        return (
            query.order_by(self.model.created_at.desc()).offset(skip).limit(limit).all()
        )

    def search_components(
        self,
        db: Session,
        *,
        query_text: str,
        lab_result_id: Optional[int] = None,
        patient_id: Optional[int] = None,
        category: Optional[str] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[LabTestComponent]:
        """Search test components by name, abbreviation, or test code"""
        # Escape SQL wildcards to prevent DoS via slow queries
        escaped_query = query_text.replace("%", r"\%").replace("_", r"\_")

        search_filter = or_(
            self.model.test_name.ilike(f"%{escaped_query}%", escape="\\"),
            self.model.abbreviation.ilike(f"%{escaped_query}%", escape="\\"),
            self.model.test_code.ilike(f"%{escaped_query}%", escape="\\"),
        )

        query_obj = db.query(self.model).filter(search_filter)

        if lab_result_id:
            query_obj = query_obj.filter(self.model.lab_result_id == lab_result_id)

        if patient_id:
            # Join with lab_results table to filter by patient_id and eager load to prevent N+1
            query_obj = (
                query_obj.join(self.model.lab_result)
                .filter(self.model.lab_result.has(patient_id=patient_id))
                .options(joinedload(self.model.lab_result))
            )

        if category:
            query_obj = query_obj.filter(self.model.category == category.lower())

        if status:
            query_obj = query_obj.filter(self.model.status == status.lower())

        return (
            query_obj.order_by(self.model.test_name.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_patient_and_test_name(
        self,
        db: Session,
        *,
        patient_id: int,
        test_name: str,
        date_from: Optional[Any] = None,
        date_to: Optional[Any] = None,
        limit: Optional[int] = None,
        unit: Optional[str] = None,
    ) -> List[LabTestComponent]:
        """
        Get all test components for a patient by test name (case-insensitive).

        Exclusive matching ensures each component appears in only one trend:
        - Components with a non-empty canonical_test_name: match only on canonical_test_name
        - Components with NULL, empty, or whitespace-only canonical_test_name: match only on exact test_name (normalized)

        Empty / whitespace-only canonical_test_name is treated as equivalent to
        NULL here. The sync service (test_library_sync) writes "" to mark
        components it processed without finding a library match; those
        components should still group by test_name.

        Unit filter semantics:
        - None: no unit filter (legacy behavior, all units merged).
        - Non-empty string: case-insensitive, whitespace-trimmed match on unit.
        - Empty string: match rows where unit is NULL or empty after trimming.

        Date filtering prefers lab_result.completed_date, falls back to created_at.
        """
        from app.models.models import LabResult

        query = (
            db.query(self.model)
            .join(self.model.lab_result)
            .filter(
                and_(
                    self.model.lab_result.has(patient_id=patient_id),
                    or_(
                        and_(
                            self.model.canonical_test_name.isnot(None),
                            func.trim(self.model.canonical_test_name) != "",
                            func.lower(func.trim(self.model.canonical_test_name))
                            == func.lower(func.trim(test_name)),
                        ),
                        and_(
                            or_(
                                self.model.canonical_test_name.is_(None),
                                func.trim(self.model.canonical_test_name) == "",
                            ),
                            func.lower(func.rtrim(self.model.test_name, ",;: "))
                            == func.lower(test_name),
                        ),
                    ),
                )
            )
        )

        query = apply_unit_filter(query, self.model.unit, unit)

        if date_from or date_to:
            recorded_date_expr = func.coalesce(
                LabResult.completed_date, func.date(self.model.created_at)
            )
            if date_from:
                query = query.filter(recorded_date_expr >= date_from)
            if date_to:
                query = query.filter(recorded_date_expr <= date_to)

        query = query.order_by(
            func.coalesce(
                LabResult.completed_date, func.date(self.model.created_at)
            ).desc()
        )

        if limit:
            query = query.limit(limit)

        return query.options(joinedload(self.model.lab_result)).all()

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

    def delete_by_lab_result(self, db: Session, *, lab_result_id: int) -> int:
        """Delete all test components for a specific lab result"""
        deleted_count = (
            db.query(self.model)
            .filter(self.model.lab_result_id == lab_result_id)
            .delete()
        )
        db.commit()
        return deleted_count

    def get_unique_test_names(self, db: Session, *, limit: int = 100) -> List[str]:
        """Get list of unique test names for autocomplete/suggestions"""
        results = (
            db.query(self.model.test_name)
            .distinct()
            .order_by(self.model.test_name.asc())
            .limit(limit)
            .all()
        )
        return [result[0] for result in results]

    def get_unique_abbreviations(self, db: Session, *, limit: int = 100) -> List[str]:
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

    def get_component_catalog(
        self,
        db: Session,
        *,
        patient_id: int,
        search: Optional[str] = None,
        category: Optional[str] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 200,
    ) -> Dict[str, Any]:
        """
        Build an aggregated catalog of unique test components across all lab results
        for a patient. Groups by normalized test name and returns the latest reading
        plus trend direction for each unique test.
        """
        from app.models.labs import LabResult
        from app.utils.trend_statistics import compute_trend_direction

        query = (
            db.query(self.model)
            .join(self.model.lab_result)
            .filter(LabResult.patient_id == patient_id)
            .options(joinedload(self.model.lab_result))
        )

        if search:
            escaped_search = search.replace("%", r"\%").replace("_", r"\_")
            query = query.filter(
                or_(
                    self.model.test_name.ilike(f"%{escaped_search}%", escape="\\"),
                    self.model.abbreviation.ilike(f"%{escaped_search}%", escape="\\"),
                )
            )

        if category:
            query = query.filter(self.model.category == category.lower())

        # Order by completed_date desc so first item per group is the latest
        query = query.order_by(
            func.coalesce(
                LabResult.completed_date,
                func.date(self.model.created_at),
            ).desc()
        )

        components = query.all()

        groups: Dict[tuple, list] = {}
        for comp in components:
            name_key = (
                comp.canonical_test_name.lower()
                if comp.canonical_test_name
                else comp.test_name.strip().rstrip(",;: ").lower()
            )
            unit_key = (comp.unit or "").strip().lower()
            groups.setdefault((name_key, unit_key), []).append(comp)

        # Build catalog entries
        from app.schemas.lab_test_component import ComponentCatalogEntry

        STATUS_SORT_ORDER = {
            "critical": 0,
            "abnormal": 1,
            "high": 2,
            "low": 3,
            "borderline": 4,
            "normal": 5,
        }

        entries: List[ComponentCatalogEntry] = []
        for _key, group in groups.items():
            latest = group[0]
            latest_date = None
            if latest.lab_result and latest.lab_result.completed_date:
                latest_date = str(latest.lab_result.completed_date)
            elif latest.created_at:
                latest_date = str(latest.created_at.date())

            # Compute trend from values (most-recent first -> reverse for chronological)
            result_type = latest.result_type or "quantitative"
            trend = "stable"
            if result_type == "quantitative":
                values = [c.value for c in group if c.value is not None]
                if len(values) >= 3:
                    trend = compute_trend_direction(list(reversed(values)))
            else:
                # Qualitative trend based on abnormal rate shift
                if len(group) >= 4:
                    mid = len(group) // 2
                    recent_abnormal = sum(
                        1 for c in group[:mid] if c.status != "normal"
                    )
                    older_abnormal = sum(1 for c in group[mid:] if c.status != "normal")
                    recent_rate = recent_abnormal / mid
                    older_rate = older_abnormal / (len(group) - mid)
                    if recent_rate > older_rate + 0.15:
                        trend = "worsening"
                    elif recent_rate < older_rate - 0.15:
                        trend = "improving"

            # Use canonical_test_name for trend matching when available,
            # mirroring the exclusive matching logic in get_by_patient_and_test_name
            trend_name = (
                latest.canonical_test_name
                if latest.canonical_test_name
                else latest.test_name.strip().rstrip(",;: ")
            )

            entry = ComponentCatalogEntry(
                test_name=latest.test_name.strip(),
                trend_test_name=trend_name,
                abbreviation=latest.abbreviation,
                latest_value=latest.value,
                latest_qualitative_value=latest.qualitative_value,
                unit=latest.unit,
                status=latest.status,
                category=latest.category,
                result_type=result_type,
                reading_count=len(group),
                trend_direction=trend,
                latest_date=latest_date,
                ref_range_min=latest.ref_range_min,
                ref_range_max=latest.ref_range_max,
                ref_range_text=latest.ref_range_text,
            )
            entries.append(entry)

        # Post-aggregation status filter
        if status:
            status_lower = status.lower()
            entries = [e for e in entries if e.status == status_lower]

        # Sort: critical/abnormal first, then alphabetical
        def sort_key(e: ComponentCatalogEntry):
            return (
                STATUS_SORT_ORDER.get(e.status or "", 6),
                (e.test_name or "").lower(),
            )

        entries.sort(key=sort_key)

        total = len(entries)
        paginated = entries[skip : skip + limit]

        return {"items": paginated, "total": total}

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
                count
                for status, count in status_counts.items()
                if status in ["high", "low", "critical", "abnormal"]
            ),
            "critical_count": status_counts.get("critical", 0),
            "normal_count": status_counts.get("normal", 0),
        }


# Create instance of the CRUD class
lab_test_component = CRUDLabTestComponent()
