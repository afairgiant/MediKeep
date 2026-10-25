"""CRUD operations for Blood Donations."""

from datetime import date
from typing import Any, Dict, List, Optional, Tuple, Union

from sqlalchemy.orm import Session

from app.core.http.error_handling import ValidationException
from app.crud.base import CRUDBase
from app.crud.base_tags import TagFilterMixin
from app.models.models import BloodDonation
from app.schemas.blood_donation import (
    BloodDonationCreate,
    BloodDonationUpdate,
    validate_bp_order,
)


class CRUDBloodDonation(
    CRUDBase[BloodDonation, BloodDonationCreate, BloodDonationUpdate],
    TagFilterMixin,
):
    """Blood donation CRUD operations, always ordered newest first."""

    def _newest_first(self):
        return (
            self.model.donation_date.desc(),
            self.model.id.desc(),
        )

    def get_by_patient(
        self,
        db: Session,
        *,
        patient_id: int,
        skip: int = 0,
        limit: int = 100,
        donation_type: Optional[str] = None,
        tags: Optional[List[str]] = None,
        tag_match_all: bool = False,
    ) -> List[BloodDonation]:
        """Retrieve donations for a patient, newest first, optionally tag-filtered."""
        query = db.query(self.model).filter(self.model.patient_id == patient_id)
        if donation_type:
            query = query.filter(self.model.donation_type == donation_type.lower())
        query = self._apply_tag_filter(query, tags=tags, tag_match_all=tag_match_all)
        return query.order_by(*self._newest_first()).offset(skip).limit(limit).all()

    def get_dates_and_types(
        self, db: Session, *, patient_id: int
    ) -> List[Tuple[date, str]]:
        """Return (donation_date, donation_type) of every donation of a patient."""
        rows = (
            db.query(self.model.donation_date, self.model.donation_type)
            .filter(self.model.patient_id == patient_id)
            .all()
        )
        return [(row.donation_date, row.donation_type) for row in rows]

    def update(
        self,
        db: Session,
        *,
        db_obj: BloodDonation,
        obj_in: Union[BloodDonationUpdate, Dict[str, Any]],
    ) -> BloodDonation:
        """Update a blood donation, re-validating the BP pair against the stored values."""
        # A partial update may carry only one of the pair; the schema can't check that.
        update_data = self._normalize_input(obj_in, exclude_unset=True)

        if "systolic_bp" in update_data or "diastolic_bp" in update_data:
            merged_systolic = update_data.get("systolic_bp", db_obj.systolic_bp)
            merged_diastolic = update_data.get("diastolic_bp", db_obj.diastolic_bp)
            try:
                validate_bp_order(merged_systolic, merged_diastolic)
            except ValueError as exc:
                raise ValidationException(
                    message="Validation failed for field 'blood_pressure'",
                    description=str(exc),
                    validation_errors=[f"blood_pressure: {exc}"],
                ) from exc

        return super().update(db, db_obj=db_obj, obj_in=obj_in)


blood_donation = CRUDBloodDonation(BloodDonation)
