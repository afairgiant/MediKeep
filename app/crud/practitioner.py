from typing import Any, Dict, List, Optional, Union

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.models import MedicalSpecialty as MedicalSpecialtyModel
from app.models.models import Practitioner as PractitionerModel
from app.schemas.practitioner import PractitionerCreate, PractitionerUpdate


class CRUDPractitioner(
    CRUDBase[PractitionerModel, PractitionerCreate, PractitionerUpdate]
):
    """
    Practitioner-specific CRUD operations for medical records system.

    Practitioners are independent entities representing healthcare providers.
    They are not tied to specific users and can be referenced by any medical record.
    """

    def _normalize_input_dict(
        self, obj_in: Any, *, exclude_unset: bool = False
    ) -> Dict[str, Any]:
        """Convert Pydantic models or mappings to a mutable dict."""
        if hasattr(obj_in, "model_dump"):
            return obj_in.model_dump(exclude_unset=exclude_unset)
        if isinstance(obj_in, dict):
            return dict(obj_in)
        return dict(obj_in)

    def _apply_specialty_dual_write(
        self, db: Session, data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Keep the legacy ``specialty`` string column in sync with ``specialty_id``.

        - If only ``specialty_id`` is provided, resolve the canonical name and
          write it to ``specialty``.
        - If only ``specialty`` string is provided, find-or-create the matching
          MedicalSpecialty row and set ``specialty_id``; also normalize the
          string to the canonical casing so reads stay consistent.
        - If both are provided, ``specialty_id`` wins (the FK is authoritative)
          and the string is overwritten with the canonical name.
        - Explicit ``specialty_id: None`` with no replacement string is
          rejected: Practitioner.specialty is NOT NULL during PR1, so we can't
          clear both columns. (PR2 drops the string column and removes this.)

        Removed during PR2 when the legacy ``specialty`` column is dropped.
        """
        id_key_present = "specialty_id" in data
        spec_id = data.get("specialty_id")
        spec_str = data.get("specialty")

        if id_key_present and spec_id is None and not spec_str:
            raise HTTPException(
                status_code=400,
                detail=(
                    "specialty cannot be cleared: provide a specialty_id or "
                    "specialty name"
                ),
            )

        if spec_id:
            spec = (
                db.query(MedicalSpecialtyModel)
                .filter(MedicalSpecialtyModel.id == spec_id)
                .first()
            )
            if spec is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown specialty_id {spec_id}",
                )
            data["specialty"] = spec.name
        elif spec_str:
            # Avoid a circular import by doing this lookup inline.
            from app.crud.medical_specialty import medical_specialty

            spec = medical_specialty.get_or_create(db, name=spec_str)
            data["specialty_id"] = spec.id
            data["specialty"] = spec.name

        return data

    def create(
        self, db: Session, *, obj_in: Union[PractitionerCreate, Dict[str, Any]]
    ) -> PractitionerModel:
        data = self._normalize_input_dict(obj_in)
        data = self._apply_specialty_dual_write(db, data)
        return super().create(db, obj_in=data)

    def update(
        self,
        db: Session,
        *,
        db_obj: PractitionerModel,
        obj_in: Union[PractitionerUpdate, Dict[str, Any]],
    ) -> PractitionerModel:
        data = self._normalize_input_dict(obj_in, exclude_unset=True)
        if "specialty_id" in data or "specialty" in data:
            data = self._apply_specialty_dual_write(db, data)
        return super().update(db, db_obj=db_obj, obj_in=data)

    def get_by_name(self, db: Session, *, name: str) -> Optional[PractitionerModel]:
        """
        Retrieve a practitioner by exact name match.

        Args:
            db: SQLAlchemy database session
            name: Full name of the practitioner

        Returns:
            Practitioner object if found, None otherwise

        Example:
            doctor = practitioner_crud.get_by_name(db, name="Dr. John Smith")
        """
        practitioners = self.query(
            db=db,
            filters={"name": name},
            limit=1,
        )
        return practitioners[0] if practitioners else None

    def search_by_name(
        self, db: Session, *, name: str, skip: int = 0, limit: int = 20
    ) -> List[PractitionerModel]:
        """
        Search practitioners by partial name match.

        Args:
            db: SQLAlchemy database session
            name: Partial name to search for
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Practitioner objects matching the search

        Example:
            doctors = practitioner_crud.search_by_name(db, name="Smith")
        """
        return self.query(
            db=db,
            search={"field": "name", "term": name},
            skip=skip,
            limit=limit,
        )

    def get_by_specialty(
        self, db: Session, *, specialty: str, skip: int = 0, limit: int = 20
    ) -> List[PractitionerModel]:
        """
        Retrieve practitioners by specialty.

        Args:
            db: SQLAlchemy database session
            specialty: Medical specialty to filter by
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Practitioner objects with matching specialty

        Example:
            cardiologists = practitioner_crud.get_by_specialty(db, specialty="Cardiology")
        """
        return self.query(
            db=db,
            search={"field": "specialty", "term": specialty},
            skip=skip,
            limit=limit,
        )

    def get_all_specialties(self, db: Session) -> List[str]:
        """
        Get a list of all unique specialties in the system.

        Args:
            db: SQLAlchemy database session

        Returns:
            List of unique specialty strings

        Example:
            specialties = practitioner_crud.get_all_specialties(db)
            # Returns: ["Cardiology", "Dermatology", "Internal Medicine", ...]
        """
        from sqlalchemy import distinct

        result = (
            db.query(distinct(PractitionerModel.specialty))
            .filter(PractitionerModel.specialty.isnot(None))
            .all()
        )

        return sorted([row[0] for row in result if row[0]])

    def get_with_medical_records(
        self, db: Session, practitioner_id: int
    ) -> Optional[PractitionerModel]:
        """
        Retrieve a practitioner with all associated medical records loaded.
        Shows all treatments, encounters, etc. performed by this practitioner.

        Args:
            db: SQLAlchemy database session
            practitioner_id: ID of the practitioner to retrieve

        Returns:
            Practitioner object with all medical relationships loaded, or None if not found

        Example:
            practitioner = practitioner_crud.get_with_medical_records(db, practitioner_id=5)
        """
        return super().get_with_relations(
            db=db,
            record_id=practitioner_id,
            relations=[
                "encounters",
                "lab_results",
                "immunizations",
                "conditions",
                "procedures",
                "treatments",
            ],
        )

    def is_name_taken(
        self, db: Session, *, name: str, exclude_id: Optional[int] = None
    ) -> bool:
        """
        Check if a practitioner name is already taken.

        Args:
            db: SQLAlchemy database session
            name: Name to check
            exclude_id: Optional practitioner ID to exclude from check (for updates)

        Returns:
            True if name is taken, False if available

        Example:
            if practitioner_crud.is_name_taken(db, name="Dr. Smith"):
                raise HTTPException(400, "Practitioner already exists")
        """
        practitioners = self.query(
            db=db,
            filters={"name": name},
            limit=1,
        )

        if not practitioners:
            return False

        if exclude_id and practitioners[0].id == exclude_id:
            return False

        return True

    def create_if_not_exists(
        self, db: Session, *, practitioner_data: PractitionerCreate
    ) -> PractitionerModel:
        """
        Create a practitioner only if one with the same name doesn't already exist.
        If it exists, return the existing practitioner.

        Args:
            db: SQLAlchemy database session
            practitioner_data: Practitioner creation data

        Returns:
            New or existing Practitioner object

        Example:
            practitioner_data = PractitionerCreate(name="Dr. Smith", specialty="Cardiology")
            practitioner = practitioner_crud.create_if_not_exists(db, practitioner_data=practitioner_data)
        """
        # Check if practitioner already exists
        existing = self.get_by_name(db, name=practitioner_data.name)
        if existing:
            return existing

        # Create new practitioner
        return self.create(db, obj_in=practitioner_data)

    def get_by_practice(
        self, db: Session, *, practice_id: int, skip: int = 0, limit: int = 100
    ) -> List[PractitionerModel]:
        """
        Retrieve practitioners belonging to a specific practice.

        Args:
            db: SQLAlchemy database session
            practice_id: ID of the practice to filter by
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Practitioner objects belonging to the practice
        """
        return self.query(
            db=db,
            filters={"practice_id": practice_id},
            skip=skip,
            limit=limit,
        )

    def count_by_specialty(self, db: Session) -> dict:
        """
        Count practitioners by specialty.

        Args:
            db: SQLAlchemy database session

        Returns:
            Dictionary mapping specialty names to counts

        Example:
            counts = practitioner_crud.count_by_specialty(db)
            # Returns: {"Cardiology": 15, "Dermatology": 12, ...}
        """
        from sqlalchemy import func

        result = (
            db.query(PractitionerModel.specialty, func.count(PractitionerModel.id))
            .filter(PractitionerModel.specialty.isnot(None))
            .group_by(PractitionerModel.specialty)
            .all()
        )

        return {specialty: count for specialty, count in result}

    def get_most_referenced(
        self, db: Session, *, limit: int = 10
    ) -> List[PractitionerModel]:
        """
        Get the most referenced practitioners (by total medical record count).

        Args:
            db: SQLAlchemy database session
            limit: Maximum number of practitioners to return

        Returns:
            List of most referenced Practitioner objects

        Example:
            popular = practitioner_crud.get_most_referenced(db, limit=5)
        """
        from sqlalchemy import func

        from app.models.models import Encounter, Procedure, Treatment

        # Count total references across encounters, treatments, and procedures
        return (
            db.query(PractitionerModel)
            .outerjoin(Encounter, PractitionerModel.id == Encounter.practitioner_id)
            .outerjoin(Treatment, PractitionerModel.id == Treatment.practitioner_id)
            .outerjoin(Procedure, PractitionerModel.id == Procedure.practitioner_id)
            .group_by(PractitionerModel.id)
            .order_by(
                func.count(Encounter.id).desc()
                + func.count(Treatment.id).desc()
                + func.count(Procedure.id).desc()
            )
            .limit(limit)
            .all()
        )


# Create the practitioner CRUD instance
practitioner = CRUDPractitioner(PractitionerModel)
