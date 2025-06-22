from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy import asc, desc, func
from sqlalchemy.orm import Session, joinedload

from app.crud.base import CRUDBase
from app.models.models import Vitals
from app.schemas.vitals import VitalsCreate, VitalsUpdate


class CRUDVitals(CRUDBase[Vitals, VitalsCreate, VitalsUpdate]):
    """
    CRUD operations for Vitals model.

    Provides specialized methods for vitals management including
    patient-specific queries, date range filtering, and statistics.
    """

    def get_by_patient(
        self, db: Session, *, patient_id: int, skip: int = 0, limit: int = 100
    ) -> List[Vitals]:
        """Get all vitals readings for a specific patient"""
        return super().get_by_patient(
            db=db,
            patient_id=patient_id,
            skip=skip,
            limit=limit,
            order_by="recorded_date",
            order_desc=True,
        )

    def get_by_patient_date_range(
        self,
        db: Session,
        *,
        patient_id: int,
        start_date: datetime,
        end_date: datetime,
        skip: int = 0,
        limit: int = 100
    ) -> List[Vitals]:
        """Get vitals readings for a patient within a date range"""
        return (
            db.query(self.model)
            .filter(
                Vitals.patient_id == patient_id,
                Vitals.recorded_date >= start_date,
                Vitals.recorded_date <= end_date,
            )
            .order_by(desc(Vitals.recorded_date))
            .offset(skip)
            .limit(limit)
            .all()
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
        limit: int = 100
    ) -> List[Vitals]:
        """Get vitals readings for a specific vital type (e.g., only blood pressure)"""
        query = db.query(self.model).filter(Vitals.patient_id == patient_id)

        # Filter based on vital type
        if vital_type == "blood_pressure":
            query = query.filter(
                Vitals.systolic_bp.isnot(None), Vitals.diastolic_bp.isnot(None)
            )
        elif vital_type == "heart_rate":
            query = query.filter(Vitals.heart_rate.isnot(None))
        elif vital_type == "temperature":
            query = query.filter(Vitals.temperature.isnot(None))
        elif vital_type == "weight":
            query = query.filter(Vitals.weight.isnot(None))
        elif vital_type == "oxygen_saturation":
            query = query.filter(Vitals.oxygen_saturation.isnot(None))
        elif vital_type == "blood_glucose":
            query = query.filter(Vitals.blood_glucose.isnot(None))

        return (
            query.order_by(desc(Vitals.recorded_date)).offset(skip).limit(limit).all()
        )

    def get_vitals_stats(self, db: Session, *, patient_id: int) -> dict:
        """Get statistics for a patient's vitals"""
        # Get basic count and date info
        total_readings = (
            db.query(func.count(Vitals.id))
            .filter(Vitals.patient_id == patient_id)
            .scalar()
            or 0
        )

        if total_readings == 0:
            return {
                "total_readings": 0,
                "latest_reading_date": None,
                "avg_systolic_bp": None,
                "avg_diastolic_bp": None,
                "avg_heart_rate": None,
                "avg_temperature": None,
                "current_weight": None,
                "current_bmi": None,
                "weight_change": None,
            }

        # Get latest reading date
        latest_date = (
            db.query(func.max(Vitals.recorded_date))
            .filter(Vitals.patient_id == patient_id)
            .scalar()
        )

        # Get current weight and BMI (from latest reading)
        latest_reading = self.get_latest_by_patient(db, patient_id=patient_id)
        current_weight = latest_reading.weight if latest_reading else None
        current_bmi = latest_reading.bmi if latest_reading else None

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

        # Calculate weight change
        weight_change = None
        if current_weight is not None:
            first_reading = (
                db.query(self.model)
                .filter(Vitals.patient_id == patient_id, Vitals.weight.isnot(None))
                .order_by(asc(Vitals.recorded_date))
                .first()
            )
            if first_reading and first_reading.weight is not None:
                weight_change = current_weight - first_reading.weight

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
            "current_weight": current_weight,
            "current_bmi": current_bmi,
            "weight_change": safe_round(weight_change),
        }

    def get_recent_readings(
        self, db: Session, *, patient_id: int, days: int = 30
    ) -> List[Vitals]:
        """Get vitals readings from the last N days"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        return (
            db.query(self.model)
            .filter(
                Vitals.patient_id == patient_id, Vitals.recorded_date >= cutoff_date
            )
            .order_by(desc(Vitals.recorded_date))
            .all()
        )

    def get_with_relationships(
        self, db: Session, *, skip: int = 0, limit: int = 100
    ) -> List[Vitals]:
        """Get vitals with patient relationships loaded"""
        return (
            db.query(self.model)
            .options(joinedload(Vitals.patient))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def calculate_bmi(self, weight_lbs: float, height_inches: float) -> float:
        """Calculate BMI from weight in pounds and height in inches"""
        if not weight_lbs or not height_inches or height_inches <= 0:
            return 0.0

        # Convert to metric: weight in kg, height in meters
        weight_kg = weight_lbs * 0.453592
        height_m = height_inches * 0.0254

        # BMI = weight(kg) / height(m)²
        bmi = weight_kg / (height_m**2)
        return round(bmi, 1)

    def create_with_bmi(self, db: Session, *, obj_in: VitalsCreate) -> Vitals:
        """Create vitals record with automatic BMI calculation"""
        obj_data = obj_in.dict()

        # Calculate BMI if we have weight and height
        if obj_data.get("weight") and obj_data.get("height"):
            obj_data["bmi"] = self.calculate_bmi(obj_data["weight"], obj_data["height"])

        db_obj = self.model(**obj_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


# Create the vitals CRUD instance
vitals = CRUDVitals(Vitals)
