"""
Trend Data Fetcher

Thin adapter that wraps existing CRUD functions to fetch vital sign
and lab test trend data for chart generation in custom reports.
"""

from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.logging.config import get_logger
from app.crud.lab_test_component import lab_test_component as crud_lab_test_component
from app.models.models import LabResult, LabTestComponent, Vitals
from app.schemas.trend_charts import SUPPORTED_VITAL_TYPES, TrendChartTimeRange

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


def _time_range_to_date(time_range: TrendChartTimeRange) -> Optional[date]:
    """Convert a time range enum to a start date."""
    if time_range == TrendChartTimeRange.ALL:
        return None
    days_map = {
        TrendChartTimeRange.THREE_MONTHS: 90,
        TrendChartTimeRange.SIX_MONTHS: 180,
        TrendChartTimeRange.ONE_YEAR: 365,
        TrendChartTimeRange.TWO_YEARS: 730,
        TrendChartTimeRange.FIVE_YEARS: 1825,
    }
    days = days_map[time_range]
    return date.today() - timedelta(days=days)


class TrendDataFetcher:
    """Fetches trend data for vital signs and lab tests."""

    def __init__(self, db: Session):
        self.db = db

    def fetch_vital_trend(
        self,
        patient_id: int,
        vital_type: str,
        time_range: TrendChartTimeRange,
    ) -> Dict[str, Any]:
        """
        Fetch vital sign trend data for a specific vital type.

        Returns dict with keys: dates, values, display_name, unit, reference_range, statistics
        """
        if vital_type not in SUPPORTED_VITAL_TYPES:
            raise ValueError(f"Unsupported vital type: {vital_type}")

        # Blood pressure is a combined chart with systolic + diastolic
        if vital_type == "blood_pressure":
            return self.fetch_blood_pressure_trend(patient_id, time_range)

        column = getattr(Vitals, vital_type)
        start_date = _time_range_to_date(time_range)

        query = (
            self.db.query(Vitals.recorded_date, column)
            .filter(
                Vitals.patient_id == patient_id,
                column.isnot(None),
            )
            .order_by(Vitals.recorded_date.asc())
        )

        if start_date:
            query = query.filter(
                func.date(Vitals.recorded_date) >= start_date
            )

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
        }

    def fetch_blood_pressure_trend(
        self,
        patient_id: int,
        time_range: TrendChartTimeRange,
    ) -> Dict[str, Any]:
        """
        Fetch blood pressure data with both systolic and diastolic values.

        Returns dict with systolic_values, diastolic_values, dates, and statistics.
        """
        start_date = _time_range_to_date(time_range)

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

        if start_date:
            query = query.filter(
                func.date(Vitals.recorded_date) >= start_date
            )

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
        }

    def fetch_lab_test_trend(
        self,
        patient_id: int,
        test_name: str,
        time_range: TrendChartTimeRange,
    ) -> Dict[str, Any]:
        """
        Fetch lab test trend data for a specific test name.
        Delegates to existing CRUD function and reuses statistics calculation.

        Returns dict with keys: dates, values, statuses, display_name, unit,
                                ref_range_min, ref_range_max, statistics
        """
        start_date = _time_range_to_date(time_range)

        components = crud_lab_test_component.get_by_patient_and_test_name(
            self.db,
            patient_id=patient_id,
            test_name=test_name,
            date_from=start_date,
        )

        if not components:
            return {
                "dates": [],
                "values": [],
                "statuses": [],
                "display_name": test_name,
                "unit": "",
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

        unit = components[0].unit or ""
        ref_min = components[0].ref_range_min
        ref_max = components[0].ref_range_max

        return {
            "dates": dates,
            "values": values,
            "statuses": statuses,
            "display_name": test_name,
            "unit": unit,
            "ref_range_min": ref_min,
            "ref_range_max": ref_max,
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
                available.append({
                    "vital_type": vital_type,
                    "display_name": VITAL_TYPE_DISPLAY.get(vital_type, vital_type),
                    "unit": VITAL_TYPE_UNITS.get(vital_type, ""),
                    "count": count,
                })
        return available

    def get_available_lab_test_names(self, patient_id: int) -> List[Dict[str, Any]]:
        """Return lab test names that have quantitative data for the patient."""
        name_expr = func.coalesce(
            LabTestComponent.canonical_test_name,
            LabTestComponent.test_name,
        )

        # Group by test name only (not unit) to avoid duplicates
        results = (
            self.db.query(
                name_expr.label("name"),
                func.count(LabTestComponent.id).label("count"),
                func.max(LabTestComponent.unit).label("unit"),
            )
            .join(LabTestComponent.lab_result)
            .filter(
                LabResult.patient_id == patient_id,
                LabTestComponent.value.isnot(None),
                name_expr.isnot(None),
                func.length(func.trim(name_expr)) >= 2,
            )
            .group_by(name_expr)
            .having(func.count(LabTestComponent.id) >= 2)
            .order_by(name_expr)
            .all()
        )

        return [
            {
                "test_name": row.name.strip(),
                "unit": row.unit or "",
                "count": row.count,
            }
            for row in results
        ]

    def count_vital_records(
        self, patient_id: int, vital_type: str, time_range: TrendChartTimeRange,
    ) -> int:
        """Count vital records for a type within a time range."""
        if vital_type not in SUPPORTED_VITAL_TYPES:
            return 0
        start_date = _time_range_to_date(time_range)
        query = self._vital_count_query(patient_id, vital_type)
        if start_date:
            query = query.filter(func.date(Vitals.recorded_date) >= start_date)
        return query.scalar() or 0

    def count_lab_test_records(
        self, patient_id: int, test_name: str, time_range: TrendChartTimeRange,
    ) -> int:
        """Count lab test component records for a test name within a time range."""
        start_date = _time_range_to_date(time_range)
        components = crud_lab_test_component.get_by_patient_and_test_name(
            self.db,
            patient_id=patient_id,
            test_name=test_name,
            date_from=start_date,
        )
        return len(components)


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


def _compute_trend_direction(values: List[float]) -> str:
    """
    Determine trend direction using linear regression slope.

    Fits a least-squares line y = mx + b to the values (using index as x)
    and checks whether the total predicted change over the dataset is
    meaningful relative to the data's range.
    """
    n = len(values)
    if n < 3:
        return "stable"

    # Least-squares linear regression: y = mx + b
    # x values are 0, 1, 2, ..., n-1
    sum_x = n * (n - 1) / 2
    sum_x2 = n * (n - 1) * (2 * n - 1) / 6
    sum_y = sum(values)
    sum_xy = sum(i * v for i, v in enumerate(values))

    denominator = n * sum_x2 - sum_x * sum_x
    if abs(denominator) < 1e-10:
        return "stable"

    slope = (n * sum_xy - sum_x * sum_y) / denominator

    # Total predicted change over the dataset
    total_change = slope * (n - 1)

    # Compare against the data range to determine significance
    data_range = max(values) - min(values)
    avg = sum_y / n

    # Use whichever is larger as the baseline for comparison
    baseline = max(data_range, abs(avg) * 0.01)
    if baseline < 1e-10:
        return "stable"

    # Trend is meaningful if the regression line's total rise/fall
    # is at least 10% of the data range (or avg for flat data)
    threshold = baseline * 0.10
    if total_change > threshold:
        return "increasing"
    elif total_change < -threshold:
        return "decreasing"

    return "stable"
