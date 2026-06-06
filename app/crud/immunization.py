from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.crud.base_tags import TagFilterMixin
from app.crud.standardized_vaccine import (
    get_vaccine_by_who_code,
    resolve_vaccine_by_any_name,
)
from app.models.models import Immunization
from app.schemas.immunization import ImmunizationCreate, ImmunizationUpdate


def _resolve_library_fk(
    db: Session,
    *,
    who_code: Optional[str],
    vaccine_name: Optional[str],
) -> Optional[int]:
    """Pick the right ``standardized_vaccine_id`` for a write.

    WHO code wins when present and resolvable (single-query, unambiguous).
    Otherwise we fall back to name resolution so curated entries without WHO
    codes still link automatically when the user picks them from autocomplete.
    Returns ``None`` if neither path finds a library row.
    """
    if who_code:
        vaccine = get_vaccine_by_who_code(db, who_code)
        if vaccine:
            return vaccine.id
    if vaccine_name:
        vaccine = resolve_vaccine_by_any_name(db, vaccine_name)
        if vaccine:
            return vaccine.id
    return None


class CRUDImmunization(
    CRUDBase[Immunization, ImmunizationCreate, ImmunizationUpdate], TagFilterMixin
):
    """
    Immunization-specific CRUD operations for vaccine records.

    Handles patient immunization records, vaccine tracking, and schedules.
    """

    def create(self, db: Session, *, obj_in: ImmunizationCreate) -> Immunization:
        """Create a new immunization record.

        Resolves the library FK with a two-step fallback so the user only ever
        has to pick a vaccine from the autocomplete — never deal with WHO
        codes. Order:
          1. ``standardized_vaccine_who_code`` if explicit and resolvable.
          2. ``vaccine_name`` matched against canonical name, short_name, or
             any common_names alias — handles curated entries (Tdap, MMRV,
             Twinrix, DTaP-Hib, …) that have no WHO code.
          3. None — record saves with NULL FK and shows as Unlinked.
        """
        obj_data = obj_in.model_dump()
        who_code = obj_data.pop("standardized_vaccine_who_code", None)
        obj_data["standardized_vaccine_id"] = _resolve_library_fk(
            db, who_code=who_code, vaccine_name=obj_data.get("vaccine_name")
        )

        db_obj = self.model(**obj_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self, db: Session, *, db_obj: Immunization, obj_in: ImmunizationUpdate
    ) -> Immunization:
        """Update an immunization record.

        FK linking mirrors create's resolution order. ``standardized_vaccine_who_code``
        is an optional hint, not a requirement: a save with ``vaccine_name``
        matching any library alias links the record even when the field is
        absent or null. To explicitly unlink, edit to a vaccine_name that
        doesn't match any library entry.
        """
        update_data = obj_in.model_dump(exclude_unset=True)

        # FK touched only when the user changed the vaccine identity (new
        # name, or explicit who_code in the payload). Touching only other
        # fields (e.g., lot number) leaves the existing FK untouched.
        touches_vaccine = (
            "standardized_vaccine_who_code" in update_data
            or "vaccine_name" in update_data
        )
        if touches_vaccine:
            who_code = update_data.pop("standardized_vaccine_who_code", None)
            # Prefer the new name if explicitly provided (even if empty —
            # honor what the caller sent), otherwise fall back to the stored
            # name so updating ONLY who_code can still link via the stored name.
            # Using ``get(..., default)`` instead of ``or`` so an explicit ""
            # isn't silently swapped for ``db_obj.vaccine_name``.
            effective_name = update_data.get("vaccine_name", db_obj.vaccine_name)
            update_data["standardized_vaccine_id"] = _resolve_library_fk(
                db, who_code=who_code, vaccine_name=effective_name
            )

        for field, value in update_data.items():
            setattr(db_obj, field, value)

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_by_vaccine(
        self, db: Session, *, vaccine_name: str, patient_id: Optional[int] = None
    ) -> List[Immunization]:
        """
        Retrieve immunizations by vaccine name, optionally filtered by patient.

        Args:
            db: SQLAlchemy database session
            vaccine_name: Name of the vaccine
            patient_id: Optional patient ID to filter by

        Returns:
            List of immunizations for the specified vaccine
        """
        filters: Dict[str, Any] = {}
        if patient_id:
            filters["patient_id"] = patient_id

        return self.query(
            db=db,
            filters=filters,
            search={"field": "vaccine_name", "term": vaccine_name},
            order_by="date_administered",
            order_desc=True,
        )

    def get_recent_immunizations(
        self, db: Session, *, patient_id: int, days: int = 365
    ) -> List[Immunization]:
        """
        Get recent immunizations for a patient within specified days.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient
            days: Number of days to look back

        Returns:
            List of recent immunizations
        """
        from app.crud.utils import get_recent_records

        return get_recent_records(
            db=db,
            model=self.model,
            date_field="date_administered",
            days=days,
            patient_id=patient_id,
            order_by="date_administered",
            order_desc=True,
        )

    def get_due_for_booster(
        self,
        db: Session,
        *,
        patient_id: int,
        vaccine_name: str,
        months_interval: int = 12,
    ) -> bool:
        """
        Check if a patient is due for a booster shot.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient
            vaccine_name: Name of the vaccine
            months_interval: Months between doses

        Returns:
            True if due for booster, False otherwise
        """
        from datetime import date, timedelta

        # Get latest dose using our generic search method
        last_doses = self.query(
            db=db,
            filters={"patient_id": patient_id},
            search={"field": "vaccine_name", "term": vaccine_name},
            order_by="date_administered",
            order_desc=True,
            limit=1,
        )

        if not last_doses:
            return True  # Never vaccinated

        last_dose = last_doses[0]

        # Convert to actual date value for comparison
        last_dose_date = last_dose.date_administered
        if hasattr(last_dose_date, "date"):
            last_dose_date = last_dose_date.date()

        due_date = last_dose_date + timedelta(days=months_interval * 30)
        return bool(date.today() >= due_date)


# Create the immunization CRUD instance
immunization = CRUDImmunization(Immunization)
