from datetime import datetime, timedelta
from typing import List, Optional, Set, Tuple

from sqlalchemy import asc, desc, func
from sqlalchemy.orm import Query, Session, joinedload

from app.crud.base import CRUDBase
from app.models.models import Vitals
from app.schemas.vitals import VitalsCreate, VitalsUpdate


# Valid vital types for filtering
VALID_VITAL_TYPES = {
    "blood_pressure",
    "heart_rate",
    "temperature",
    "weight",
    "oxygen_saturation",
    "blood_glucose",
    "a1c",
}

# Mapping of vital type to the column(s) that must be non-null
VITAL_TYPE_COLUMNS = {
    "blood_pressure": [Vitals.systolic_bp, Vitals.diastolic_bp],
    "heart_rate": [Vitals.heart_rate],
    "temperature": [Vitals.temperature],
    "weight": [Vitals.weight],
    "oxygen_saturation": [Vitals.oxygen_saturation],
    "blood_glucose": [Vitals.blood_glucose],
    "a1c": [Vitals.a1c],
}


def _validate_vital_type(vital_type: str) -> None:
    """Validate that vital_type is a known type."""
    if vital_type not in VALID_VITAL_TYPES:
        raise ValueError(
            f"Invalid vital_type '{vital_type}'. "
            f"Must be one of: {', '.join(sorted(VALID_VITAL_TYPES))}"
        )


def _apply_vital_type_filter(query: Query, vital_type: str) -> Query:
    """
    Apply column filters for a specific vital type.

    Assumes vital_type has already been validated by _validate_vital_type().
    """
    columns = VITAL_TYPE_COLUMNS.get(vital_type)
    if columns is None:
        raise ValueError(f"Unknown vital_type '{vital_type}' - call _validate_vital_type first")
    for column in columns:
        query = query.filter(column.isnot(None))
    return query


class CRUDVitals(CRUDBase[Vitals, VitalsCreate, VitalsUpdate]):
    """
    CRUD operations for Vitals model.

    Provides specialized methods for vitals management including
    patient-specific queries, date range filtering, and statistics.
    """

    def __init__(self):
        # Store recorded_date in UTC for consistency.
        # Frontend sends UTC via toISOString(), backend stores as UTC,
        # frontend converts back to local for display.
        super().__init__(Vitals, timezone_fields=["recorded_date"])

    def count_by_patient(
        self,
        db: Session,
        *,
        patient_id: int,
        vital_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> int:
        """Get total count of vitals records for a patient with optional filters.

        Args:
            patient_id: The patient ID to count records for.
            vital_type: Optional filter by vital type.
            start_date: Optional start date filter.
            end_date: Optional end date filter.

        Returns:
            Total count of matching records.
        """
        query = db.query(func.count(self.model.id)).filter(
            Vitals.patient_id == patient_id
        )

        if vital_type:
            _validate_vital_type(vital_type)
            query = _apply_vital_type_filter(query, vital_type)

        if start_date:
            query = query.filter(Vitals.recorded_date >= start_date)
        if end_date:
            query = query.filter(Vitals.recorded_date <= end_date)

        return query.scalar() or 0

    def get_by_patient_date_range(
        self,
        db: Session,
        *,
        patient_id: int,
        start_date: datetime,
        end_date: datetime,
        skip: int = 0,
        limit: int = 10000,
        vital_type: Optional[str] = None
    ) -> List[Vitals]:
        """Get vitals readings for a patient within a date range, optionally filtered by vital type.

        Args:
            vital_type: One of: blood_pressure, heart_rate, temperature, weight,
                       oxygen_saturation, blood_glucose, a1c. Invalid values raise ValueError.
        """
        query = db.query(self.model).filter(
            Vitals.patient_id == patient_id,
            Vitals.recorded_date >= start_date,
            Vitals.recorded_date <= end_date
        )

        if vital_type:
            _validate_vital_type(vital_type)
            query = _apply_vital_type_filter(query, vital_type)

        return (
            query.order_by(desc(Vitals.recorded_date)).offset(skip).limit(limit).all()
        )

    def get_latest_by_patient(
        self, db: Session, *, patient_id: int
    ) -> Optional[Vitals]:
        """Get the most recent vitals reading for a patient"""
        readings = super().get_by_patient(
            db=db,
            patient_id=patient_id,
            limit=1,
            order_by="recorded_date",
            order_desc=True,
        )
        return readings[0] if readings else None

    def get_by_vital_type(
        self,
        db: Session,
        *,
        patient_id: int,
        vital_type: str,
        skip: int = 0,
        limit: int = 10000
    ) -> List[Vitals]:
        """Get vitals readings for a specific vital type (e.g., only blood pressure).

        Args:
            vital_type: One of: blood_pressure, heart_rate, temperature, weight,
                       oxygen_saturation, blood_glucose, a1c. Invalid values raise ValueError.
        """
        _validate_vital_type(vital_type)

        query = db.query(self.model).filter(Vitals.patient_id == patient_id)
        query = _apply_vital_type_filter(query, vital_type)

        return (
            query.order_by(desc(Vitals.recorded_date)).offset(skip).limit(limit).all()
        )

    def get_vitals_stats(self, db: Session, *, patient_id: int) -> dict:
        """Get statistics for a patient's vitals"""
        # Get basic count and date info
        total_readings = (
            db.query(Vitals).filter(Vitals.patient_id == patient_id).count() or 0
        )

        if total_readings == 0:
            return {
                "total_readings": 0,
                "latest_reading_date": None,
                "avg_systolic_bp": None,
                "avg_diastolic_bp": None,
                "avg_heart_rate": None,
                "avg_temperature": None,
                "current_temperature": None,
                "current_weight": None,
                "current_bmi": None,
                "weight_change": None,
                "current_blood_glucose": None,
                "current_a1c": None,
            }

        # Get latest reading date
        latest_date = (
            db.query(func.max(Vitals.recorded_date))
            .filter(Vitals.patient_id == patient_id)
            .scalar()
        )

        # Get current weight and BMI (from latest reading with weight data)
        latest_weight_reading = (
            db.query(self.model)
            .filter(Vitals.patient_id == patient_id, Vitals.weight.isnot(None))
            .order_by(desc(Vitals.recorded_date))
            .first()
        )
        current_weight = latest_weight_reading.weight if latest_weight_reading else None

        # Get latest BMI (from latest reading with BMI data, or calculate from weight/height)
        latest_bmi_reading = (
            db.query(self.model)
            .filter(Vitals.patient_id == patient_id, Vitals.bmi.isnot(None))
            .order_by(desc(Vitals.recorded_date))
            .first()
        )
        current_bmi = latest_bmi_reading.bmi if latest_bmi_reading else None

        # If no stored BMI, try to calculate from latest weight and height
        if current_bmi is None and latest_weight_reading and latest_weight_reading.weight:
            latest_height_reading = (
                db.query(self.model)
                .filter(Vitals.patient_id == patient_id, Vitals.height.isnot(None))
                .order_by(desc(Vitals.recorded_date))
                .first()
            )
            if latest_height_reading and latest_height_reading.height:
                try:
                    # Validate reasonable medical ranges before calculation
                    weight = latest_weight_reading.weight
                    height = latest_height_reading.height

                    # Reasonable medical ranges: weight 50-1000 lbs, height 24-96 inches
                    if 50 <= weight <= 1000 and 24 <= height <= 96:
                        current_bmi = self.calculate_bmi(weight, height)
                    else:
                        current_bmi = None
                except (ValueError, TypeError, ZeroDivisionError):
                    current_bmi = None

        # Get latest temperature (from latest reading with temperature data)
        latest_temperature_reading = (
            db.query(self.model)
            .filter(Vitals.patient_id == patient_id, Vitals.temperature.isnot(None))
            .order_by(desc(Vitals.recorded_date))
            .first()
        )
        current_temperature = (
            latest_temperature_reading.temperature
            if latest_temperature_reading
            else None
        )

        # Calculate averages
        systolic_avg = (
            db.query(func.avg(Vitals.systolic_bp))
            .filter(Vitals.patient_id == patient_id, Vitals.systolic_bp.isnot(None))
            .scalar()
        )

        diastolic_avg = (
            db.query(func.avg(Vitals.diastolic_bp))
            .filter(Vitals.patient_id == patient_id, Vitals.diastolic_bp.isnot(None))
            .scalar()
        )

        heart_rate_avg = (
            db.query(func.avg(Vitals.heart_rate))
            .filter(Vitals.patient_id == patient_id, Vitals.heart_rate.isnot(None))
            .scalar()
        )
        temperature_avg = (
            db.query(func.avg(Vitals.temperature))
            .filter(Vitals.patient_id == patient_id, Vitals.temperature.isnot(None))
            .scalar()
        )

        weight_avg = (
            db.query(func.avg(Vitals.weight))
            .filter(Vitals.patient_id == patient_id, Vitals.weight.isnot(None))
            .scalar()
        )

        # Calculate weight change (latest weight vs first weight)
        weight_change = None
        if current_weight is not None:
            first_weight_reading = (
                db.query(self.model)
                .filter(Vitals.patient_id == patient_id, Vitals.weight.isnot(None))
                .order_by(asc(Vitals.recorded_date))
                .first()
            )
            if first_weight_reading and first_weight_reading.weight is not None:
                weight_change = current_weight - first_weight_reading.weight

        # Get latest blood glucose (from latest reading with blood_glucose data)
        latest_blood_glucose_reading = (
            db.query(self.model)
            .filter(Vitals.patient_id == patient_id, Vitals.blood_glucose.isnot(None))
            .order_by(desc(Vitals.recorded_date))
            .first()
        )
        current_blood_glucose = (
            latest_blood_glucose_reading.blood_glucose
            if latest_blood_glucose_reading
            else None
        )

        # Get latest A1C (from latest reading with a1c data)
        latest_a1c_reading = (
            db.query(self.model)
            .filter(Vitals.patient_id == patient_id, Vitals.a1c.isnot(None))
            .order_by(desc(Vitals.recorded_date))
            .first()
        )
        current_a1c = (
            latest_a1c_reading.a1c
            if latest_a1c_reading
            else None
        )

        # Helper function to safely round values
        def safe_round(value, digits=1):
            try:
                return round(float(value), digits) if value is not None else None
            except (TypeError, ValueError):
                return None

        return {
            "total_readings": total_readings,
            "latest_reading_date": latest_date,
            "avg_systolic_bp": safe_round(systolic_avg),
            "avg_diastolic_bp": safe_round(diastolic_avg),
            "avg_heart_rate": safe_round(heart_rate_avg),
            "avg_temperature": safe_round(temperature_avg),
            "current_temperature": safe_round(current_temperature),
            "current_weight": current_weight,
            "current_bmi": current_bmi,
            "weight_change": safe_round(weight_change),
            "current_blood_glucose": safe_round(current_blood_glucose),
            "current_a1c": safe_round(current_a1c),
        }

    def get_recent_readings(
        self, db: Session, *, patient_id: int, days: int = 30
    ) -> List[Vitals]:
        """Get recent vitals readings for a patient"""
        start_date = datetime.now() - timedelta(days=days)
        return self.query(
            db=db,
            filters={"patient_id": patient_id},
            date_range={
                "field": "recorded_date",
                "start": start_date,
                "end": datetime.now(),
            },
        )

    def get_with_relationships(
        self, db: Session, *, skip: int = 0, limit: int = 10000
    ) -> List[Vitals]:
        """Get vitals with relationships loaded"""
        return (
            db.query(self.model)
            .options(joinedload(Vitals.patient), joinedload(Vitals.practitioner))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def calculate_bmi(self, weight_lbs: float, height_inches: float) -> float:
        """
        Calculate BMI from weight in pounds and height in inches
        Formula: BMI = (weight_lbs / height_inches^2) * 703
        """
        if weight_lbs <= 0 or height_inches <= 0:
            raise ValueError("Weight and height must be positive values")

        bmi = (weight_lbs / (height_inches**2)) * 703
        return round(bmi, 1)

    def find_duplicates(
        self,
        db: Session,
        *,
        patient_id: int,
        readings: list,
    ) -> Set[int]:
        """Find indices of readings that already exist for this patient.

        Duplicates are matched on (recorded_date, blood_glucose) within the
        date range of the provided readings. Returns a set of indices into
        the readings list.
        """
        if not readings:
            return set()

        dates = [r.recorded_date for r in readings]
        min_date = min(dates)
        max_date = max(dates)

        existing = (
            db.query(Vitals.recorded_date, Vitals.blood_glucose)
            .filter(
                Vitals.patient_id == patient_id,
                Vitals.recorded_date >= min_date,
                Vitals.recorded_date <= max_date,
            )
            .all()
        )

        existing_set: Set[Tuple] = {
            (row.recorded_date, row.blood_glucose) for row in existing
        }

        duplicates: Set[int] = set()
        for idx, reading in enumerate(readings):
            key = (reading.recorded_date, reading.blood_glucose)
            if key in existing_set:
                duplicates.add(idx)

        return duplicates

    def bulk_create(
        self,
        db: Session,
        *,
        readings: list,
        patient_id: int,
        skip_indices: Optional[Set[int]] = None,
        batch_size: int = 100,
    ) -> int:
        """Bulk insert vitals readings for a patient.

        Args:
            readings: List of VitalsReading dataclass instances.
            patient_id: The patient to create records for.
            skip_indices: Set of reading indices to skip (e.g., duplicates).
            batch_size: Number of records per commit batch.

        Returns:
            Number of records actually inserted.
        """
        skip = skip_indices or set()
        objects = []

        for idx, reading in enumerate(readings):
            if idx in skip:
                continue
            obj = Vitals(
                patient_id=patient_id,
                recorded_date=reading.recorded_date,
                blood_glucose=reading.blood_glucose,
                heart_rate=reading.heart_rate,
                systolic_bp=reading.systolic_bp,
                diastolic_bp=reading.diastolic_bp,
                oxygen_saturation=reading.oxygen_saturation,
                temperature=reading.temperature,
                device_used=reading.device_used,
                import_source=reading.import_source,
                notes=reading.notes,
            )
            objects.append(obj)

        inserted = 0
        for i in range(0, len(objects), batch_size):
            batch = objects[i : i + batch_size]
            db.bulk_save_objects(batch)
            db.flush()
            inserted += len(batch)

        db.commit()
        return inserted

    def bulk_delete_by_import(
        self,
        db: Session,
        *,
        patient_id: int,
        import_source: str,
        date_str: str,
    ) -> int:
        """Delete all imported vitals for a patient on a specific date.

        Args:
            patient_id: Patient ID.
            import_source: The import source key (e.g., "dexcom_clarity").
            date_str: Date string in YYYY-MM-DD format.

        Returns:
            Number of records deleted.
        """
        date_start = datetime.strptime(date_str, "%Y-%m-%d")
        date_end = date_start + timedelta(days=1)

        count = (
            db.query(Vitals)
            .filter(
                Vitals.patient_id == patient_id,
                Vitals.import_source == import_source,
                Vitals.recorded_date >= date_start,
                Vitals.recorded_date < date_end,
            )
            .delete(synchronize_session="fetch")
        )
        db.commit()
        return count

    def create_with_bmi(self, db: Session, *, obj_in: VitalsCreate) -> Vitals:
        """Create vitals record with automatic BMI calculation"""
        obj_data = obj_in.model_dump()

        # Calculate BMI if weight and height are provided
        if obj_data.get("weight") and obj_data.get("height"):
            obj_data["bmi"] = self.calculate_bmi(obj_data["weight"], obj_data["height"])

        db_obj = Vitals(**obj_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


# Create instance of the CRUD class
vitals = CRUDVitals()
