from typing import List, Optional

from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
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

    def get_by_specialty_id(
        self, db: Session, *, specialty_id: int, skip: int = 0, limit: int = 20
    ) -> List[PractitionerModel]:
        """
        Retrieve practitioners belonging to a specific MedicalSpecialty.

        Args:
            db: SQLAlchemy database session
            specialty_id: Primary key of the MedicalSpecialty to filter by
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of Practitioner objects with matching specialty
        """
        return self.query(
            db=db,
            filters={"specialty_id": specialty_id},
            skip=skip,
            limit=limit,
        )

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
