"""
Trend Data Fetcher

Thin adapter that wraps existing CRUD functions to fetch vital sign
and lab test trend data for chart generation in custom reports.
"""

from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.core.logging.config import get_logger
from app.crud.lab_test_component import (
    apply_unit_filter,
    lab_test_component as crud_lab_test_component,
)
from app.models.models import LabResult, LabTestComponent, Vitals
from app.schemas.trend_charts import SUPPORTED_VITAL_TYPES
from app.utils.trend_statistics import compute_trend_direction

logger = get_logger(__name__, "app")

# Display names for vital types
VITAL_TYPE_DISPLAY = {
    "blood_pressure": "Blood Pressure",
    "heart_rate": "Heart Rate",
    "temperature": "Temperature",
    "weight": "Weight",
    "oxygen_saturation": "Oxygen Saturation",
    "respiratory_rate": "Respiratory Rate",
    "blood_glucose": "Blood Glucose",
    "a1c": "HbA1c",
    "bmi": "BMI",
    "pain_scale": "Pain Scale",
}

# Units for vital types
VITAL_TYPE_UNITS = {
    "blood_pressure": "mmHg",
    "heart_rate": "bpm",
    "temperature": "F",
    "weight": "lbs",
    "oxygen_saturation": "%",
    "respiratory_rate": "breaths/min",
    "blood_glucose": "mg/dL",
    "a1c": "%",
    "bmi": "",
    "pain_scale": "/10",
}

# Normal reference ranges for vital types (low, high)
VITAL_REFERENCE_RANGES: Dict[str, Tuple[float, float]] = {
    "heart_rate": (60, 100),
    "temperature": (97.0, 99.0),
    "oxygen_saturation": (95, 100),
    "respiratory_rate": (12, 20),
    "blood_glucose": (70, 100),
    "a1c": (4.0, 5.7),
    "bmi": (18.5, 24.9),
}


class TrendDataFetcher:
    """Fetches trend data for vital signs and lab tests."""

    def __init__(self, db: Session):
        self.db = db

    def fetch_vital_trend(
        self,
        patient_id: int,
        vital_type: str,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> Dict[str, Any]:
        """
        Fetch vital sign trend data for a specific vital type.

        Returns dict with keys: dates, values, display_name, unit, reference_range, statistics
        """
        if vital_type not in SUPPORTED_VITAL_TYPES:
            raise ValueError(f"Unsupported vital type: {vital_type}")

        # Blood pressure is a combined chart with systolic + diastolic
        if vital_type == "blood_pressure":
            return self.fetch_blood_pressure_trend(patient_id, date_from, date_to)

        column = getattr(Vitals, vital_type)

        query = (
            self.db.query(Vitals.recorded_date, column)
            .filter(
                Vitals.patient_id == patient_id,
                column.isnot(None),
            )
            .order_by(Vitals.recorded_date.asc())
        )

        if date_from:
            query = query.filter(func.date(Vitals.recorded_date) >= date_from)
        if date_to:
            query = query.filter(func.date(Vitals.recorded_date) <= date_to)

        rows = query.all()

        dates = [row[0] for row in rows]
        values = [float(row[1]) for row in rows]

        statistics = _compute_vital_statistics(values) if values else {}

        return {
            "dates": dates,
            "values": values,
            "display_name": VITAL_TYPE_DISPLAY.get(vital_type, vital_type),
            "unit": VITAL_TYPE_UNITS.get(vital_type, ""),
            "reference_range": VITAL_REFERENCE_RANGES.get(vital_type),
            "statistics": statistics,
            "date_from": date_from,
            "date_to": date_to,
        }

    def fetch_blood_pressure_trend(
        self,
        patient_id: int,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> Dict[str, Any]:
        """
        Fetch blood pressure data with both systolic and diastolic values.

        Returns dict with systolic_values, diastolic_values, dates, and statistics.
        """
        query = (
            self.db.query(
                Vitals.recorded_date,
                Vitals.systolic_bp,
                Vitals.diastolic_bp,
            )
            .filter(
                Vitals.patient_id == patient_id,
                Vitals.systolic_bp.isnot(None),
                Vitals.diastolic_bp.isnot(None),
            )
            .order_by(Vitals.recorded_date.asc())
        )

        if date_from:
            query = query.filter(func.date(Vitals.recorded_date) >= date_from)
        if date_to:
            query = query.filter(func.date(Vitals.recorded_date) <= date_to)

        rows = query.all()

        dates = [row[0] for row in rows]
        systolic = [float(row[1]) for row in rows]
        diastolic = [float(row[2]) for row in rows]

        return {
            "dates": dates,
            "systolic_values": systolic,
            "diastolic_values": diastolic,
            "display_name": "Blood Pressure",
            "unit": "mmHg",
            "reference_range": {"systolic": (90, 120), "diastolic": (60, 80)},
            "statistics": {
                "systolic": _compute_vital_statistics(systolic) if systolic else {},
                "diastolic": _compute_vital_statistics(diastolic) if diastolic else {},
            },
            "date_from": date_from,
            "date_to": date_to,
        }

    def fetch_lab_test_trend(
        self,
        patient_id: int,
        test_name: str,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        unit: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Fetch lab test trend data for a specific test name.
        Delegates to existing CRUD function and reuses statistics calculation.

        When `unit` is provided, the returned series is scoped to that unit so
        values recorded in different units (e.g. mg/L vs mmol/L) do not merge.
        Legacy callers omitting `unit` get the historical merged-across-units
        behavior.

        Returns dict with keys: dates, values, statuses, display_name, unit,
                                ref_range_min, ref_range_max, statistics
        """
        components = crud_lab_test_component.get_by_patient_and_test_name(
            self.db,
            patient_id=patient_id,
            test_name=test_name,
            date_from=date_from,
            date_to=date_to,
            unit=unit,
        )

        display_name = f"{test_name} ({unit})" if unit else test_name

        if not components:
            return {
                "dates": [],
                "values": [],
                "statuses": [],
                "display_name": display_name,
                "unit": unit or "",
                "ref_range_min": None,
                "ref_range_max": None,
                "statistics": {},
            }

        # Inline import to avoid circular dependency with lab_test_component endpoint
        from app.api.v1.endpoints.lab_test_component import calculate_trend_statistics

        statistics = calculate_trend_statistics(components)

        # Components are returned newest-first; reverse for chronological order
        components_chronological = list(reversed(components))

        dates = []
        values = []
        statuses = []
        for comp in components_chronological:
            recorded = (
                comp.lab_result.completed_date
                if comp.lab_result and comp.lab_result.completed_date
                else comp.created_at
            )
            dates.append(recorded)
            values.append(comp.value)
            statuses.append(comp.status or "unknown")

        resolved_unit = unit if unit is not None else (components[0].unit or "")
        ref_min = components[0].ref_range_min
        ref_max = components[0].ref_range_max

        return {
            "dates": dates,
            "values": values,
            "statuses": statuses,
            "display_name": display_name,
            "unit": resolved_unit,
            "ref_range_min": ref_min,
            "ref_range_max": ref_max,
            "date_from": date_from,
            "date_to": date_to,
            "statistics": {
                "count": statistics.count,
                "latest": statistics.latest,
                "average": statistics.average,
                "min": statistics.min,
                "max": statistics.max,
                "trend_direction": statistics.trend_direction,
                "time_in_range_percent": statistics.time_in_range_percent,
                "normal_count": statistics.normal_count,
                "abnormal_count": statistics.abnormal_count,
            },
        }

    def _vital_count_query(self, patient_id: int, vital_type: str):
        """Build a count query for a vital type, handling BP's dual-column requirement."""
        if vital_type == "blood_pressure":
            return self.db.query(func.count(Vitals.id)).filter(
                Vitals.patient_id == patient_id,
                Vitals.systolic_bp.isnot(None),
                Vitals.diastolic_bp.isnot(None),
            )
        column = getattr(Vitals, vital_type)
        return self.db.query(func.count(Vitals.id)).filter(
            Vitals.patient_id == patient_id,
            column.isnot(None),
        )

    def get_available_vital_types(self, patient_id: int) -> List[Dict[str, str]]:
        """Return vital types that have at least one data point for the patient."""
        available = []
        for vital_type in SUPPORTED_VITAL_TYPES:
            count = self._vital_count_query(patient_id, vital_type).scalar()
            if count:
                available.append(
                    {
                        "vital_type": vital_type,
                        "display_name": VITAL_TYPE_DISPLAY.get(vital_type, vital_type),
                        "unit": VITAL_TYPE_UNITS.get(vital_type, ""),
                        "count": count,
                    }
                )
        return available

    def get_available_lab_test_names(self, patient_id: int) -> List[Dict[str, Any]]:
        """Return (test_name, unit) pairs with quantitative data for the patient.

        Grouping is done on the normalized unit (trimmed, lowercased) so that
        casing/whitespace variants like 'mg/dL' and ' mg/dl ' merge — matching
        apply_unit_filter's comparison rules. The display unit returned is a
        representative raw value (MAX) from the group so conventional casing
        (e.g. the capital L in 'mg/L') is preserved.
        """
        # Treat empty canonical_test_name as NULL (sync service uses "" for "no library match").
        name_expr = func.coalesce(
            func.nullif(LabTestComponent.canonical_test_name, ""),
            LabTestComponent.test_name,
        )
        unit_group_expr = func.lower(
            func.trim(func.coalesce(LabTestComponent.unit, ""))
        )

        results = (
            self.db.query(
                name_expr.label("name"),
                func.max(LabTestComponent.unit).label("unit"),
                func.count(LabTestComponent.id).label("count"),
            )
            .join(LabTestComponent.lab_result)
            .filter(
                LabResult.patient_id == patient_id,
                LabTestComponent.value.isnot(None),
                name_expr.isnot(None),
                func.length(func.trim(name_expr)) >= 2,
            )
            .group_by(name_expr, unit_group_expr)
            .having(func.count(LabTestComponent.id) >= 2)
            .order_by(name_expr, unit_group_expr)
            .all()
        )

        return [
            {
                "test_name": row.name.strip(),
                "unit": (row.unit or "").strip(),
                "count": row.count,
            }
            for row in results
        ]

    def count_vital_records(
        self,
        patient_id: int,
        vital_type: str,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> int:
        """Count vital records for a type within a date range."""
        if vital_type not in SUPPORTED_VITAL_TYPES:
            return 0
        query = self._vital_count_query(patient_id, vital_type)
        if date_from:
            query = query.filter(func.date(Vitals.recorded_date) >= date_from)
        if date_to:
            query = query.filter(func.date(Vitals.recorded_date) <= date_to)
        return query.scalar() or 0

    def count_lab_test_records(
        self,
        patient_id: int,
        test_name: str,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        unit: Optional[str] = None,
    ) -> int:
        """Count lab test component records for a (test_name, unit) within a date range.

        Unit semantics match `get_by_patient_and_test_name`:
          - None: no unit filter (legacy).
          - Non-empty string: case-insensitive, whitespace-trimmed match.
          - Empty string: rows with NULL or empty unit.
        """
        query = (
            self.db.query(func.count(LabTestComponent.id))
            .join(LabTestComponent.lab_result)
            .filter(
                and_(
                    LabTestComponent.lab_result.has(patient_id=patient_id),
                    or_(
                        and_(
                            LabTestComponent.canonical_test_name.isnot(None),
                            LabTestComponent.canonical_test_name != "",
                            func.lower(LabTestComponent.canonical_test_name)
                            == func.lower(test_name),
                        ),
                        and_(
                            or_(
                                LabTestComponent.canonical_test_name.is_(None),
                                LabTestComponent.canonical_test_name == "",
                            ),
                            func.lower(func.rtrim(LabTestComponent.test_name, ",;: "))
                            == func.lower(test_name),
                        ),
                    ),
                )
            )
        )

        query = apply_unit_filter(query, LabTestComponent.unit, unit)

        if date_from or date_to:
            recorded_date_expr = func.coalesce(
                LabResult.completed_date,
                func.date(LabTestComponent.created_at),
            )
            if date_from:
                query = query.filter(recorded_date_expr >= date_from)
            if date_to:
                query = query.filter(recorded_date_expr <= date_to)

        return query.scalar() or 0


def _compute_vital_statistics(values: List[float]) -> Dict[str, Any]:
    """Compute basic statistics for a list of vital sign values."""
    if not values:
        return {}

    count = len(values)
    latest = values[-1]
    avg = sum(values) / count
    minimum = min(values)
    maximum = max(values)

    trend = _compute_trend_direction(values)

    return {
        "count": count,
        "latest": round(latest, 2),
        "average": round(avg, 2),
        "min": round(minimum, 2),
        "max": round(maximum, 2),
        "trend_direction": trend,
    }


# Kept as private alias for internal callers
_compute_trend_direction = compute_trend_direction
