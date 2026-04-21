from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.models import MedicalSpecialty as MedicalSpecialtyModel
from app.models.models import Practitioner as PractitionerModel
from app.schemas.medical_specialty import (
    MedicalSpecialtyCreate,
    MedicalSpecialtyUpdate,
)


class CRUDMedicalSpecialty(
    CRUDBase[MedicalSpecialtyModel, MedicalSpecialtyCreate, MedicalSpecialtyUpdate]
):
    """CRUD operations for the MedicalSpecialty lookup table."""

    def get_by_name(
        self, db: Session, *, name: str
    ) -> Optional[MedicalSpecialtyModel]:
        """Retrieve a specialty by case-insensitive name match."""
        return (
            db.query(MedicalSpecialtyModel)
            .filter(
                func.lower(MedicalSpecialtyModel.name) == name.strip().lower()
            )
            .first()
        )

    def is_name_taken(
        self,
        db: Session,
        *,
        name: str,
        exclude_id: Optional[int] = None,
    ) -> bool:
        """Check whether a specialty name is already taken (case-insensitive)."""
        existing = self.get_by_name(db, name=name)
        if not existing:
            return False
        if exclude_id and existing.id == exclude_id:
            return False
        return True

    def get_practitioner_count(
        self, db: Session, specialty_id: int
    ) -> int:
        """Count practitioners referencing this specialty."""
        return (
            db.query(func.count(PractitionerModel.id))
            .filter(PractitionerModel.specialty_id == specialty_id)
            .scalar()
            or 0
        )

    def get_active(
        self, db: Session, *, skip: int = 0, limit: int = 100
    ) -> List[MedicalSpecialtyModel]:
        """Return only active specialties (used to populate dropdowns)."""
        return (
            db.query(MedicalSpecialtyModel)
            .filter(MedicalSpecialtyModel.is_active.is_(True))
            .order_by(MedicalSpecialtyModel.name.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_or_create(
        self, db: Session, *, name: str
    ) -> MedicalSpecialtyModel:
        """
        Return an existing specialty by case-insensitive name, or create one.

        Race-safe: a concurrent create between our get_by_name and create will
        trigger the unique constraint; we rollback and re-query so the winner
        gets the row.

        Used by the Practitioner dual-write path when legacy callers submit
        only the free-text ``specialty`` string.
        """
        existing = self.get_by_name(db, name=name)
        if existing:
            return existing
        try:
            return self.create(
                db,
                obj_in=MedicalSpecialtyCreate(name=name.strip()),
            )
        except IntegrityError:
            db.rollback()
            existing = self.get_by_name(db, name=name)
            if existing:
                return existing
            raise

    def delete(self, db: Session, *, id: int) -> MedicalSpecialtyModel:
        """
        Delete a specialty, but only when no practitioners reference it.

        Mirrors the 409 enforcement used by the Practice delete endpoint so
        admins must reassign practitioners before removing a specialty.
        """
        count = self.get_practitioner_count(db, specialty_id=id)
        if count > 0:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Cannot delete specialty with {count} active "
                    "practitioner(s). Reassign them first."
                ),
            )
        return super().delete(db, id=id)


medical_specialty = CRUDMedicalSpecialty(MedicalSpecialtyModel)
