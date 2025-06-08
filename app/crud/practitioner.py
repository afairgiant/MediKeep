from typing import Optional, List
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
        return (
            db.query(PractitionerModel).filter(PractitionerModel.name == name).first()
        )

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
        search_pattern = f"%{name}%"
        return (
            db.query(PractitionerModel)
            .filter(PractitionerModel.name.ilike(search_pattern))
            .offset(skip)
            .limit(limit)
            .all()
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
        return (
            db.query(PractitionerModel)
            .filter(PractitionerModel.specialty.ilike(f"%{specialty}%"))
            .offset(skip)
            .limit(limit)
            .all()
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
        from sqlalchemy.orm import joinedload

        return (
            db.query(PractitionerModel)
            .options(
                joinedload(PractitionerModel.encounters),
                joinedload(PractitionerModel.lab_results),
                joinedload(PractitionerModel.immunizations),
                joinedload(PractitionerModel.conditions),
                joinedload(PractitionerModel.procedures),
                joinedload(PractitionerModel.treatments),
            )
            .filter(PractitionerModel.id == practitioner_id)
            .first()
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
        query = db.query(PractitionerModel).filter(PractitionerModel.name == name)

        if exclude_id:
            query = query.filter(PractitionerModel.id != exclude_id)

        return query.first() is not None

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

    def count_by_specialty(self, db: Session) -> dict:
        """
        Count practitioners by specialty.

        Args:
            db: SQLAlchemy database session

        Returns:
            Dictionary with specialty as key and count as value

        Example:
            counts = practitioner_crud.count_by_specialty(db)
            # Returns: {"Cardiology": 5, "Dermatology": 3, ...}
        """
        from sqlalchemy import func

        result = (
            db.query(
                PractitionerModel.specialty,
                func.count(PractitionerModel.id).label("count"),
            )
            .group_by(PractitionerModel.specialty)
            .all()
        )

        return {row.specialty: row.count for row in result if row.specialty}

    def get_most_referenced(
        self, db: Session, *, limit: int = 10
    ) -> List[PractitionerModel]:
        """
        Get practitioners who are most frequently referenced in medical records.
        Useful for showing popular/commonly used practitioners.

        Args:
            db: SQLAlchemy database session
            limit: Maximum number of practitioners to return

        Returns:
            List of practitioners ordered by frequency of use

        Example:
            popular_doctors = practitioner_crud.get_most_referenced(db, limit=5)
        """
        from sqlalchemy import func

        # Count references across different medical record types
        subquery = (
            db.query(
                PractitionerModel.id,
                (
                    func.count(PractitionerModel.encounters.distinct())
                    + func.count(PractitionerModel.lab_results.distinct())
                    + func.count(PractitionerModel.conditions.distinct())
                    + func.count(PractitionerModel.procedures.distinct())
                    + func.count(PractitionerModel.treatments.distinct())
                ).label("reference_count"),
            )
            .outerjoin(PractitionerModel.encounters)
            .outerjoin(PractitionerModel.lab_results)
            .outerjoin(PractitionerModel.conditions)
            .outerjoin(PractitionerModel.procedures)
            .outerjoin(PractitionerModel.treatments)
            .group_by(PractitionerModel.id)
            .subquery()
        )

        return (
            db.query(PractitionerModel)
            .join(subquery, PractitionerModel.id == subquery.c.id)
            .order_by(subquery.c.reference_count.desc())
            .limit(limit)
            .all()
        )


# Create an instance of CRUDPractitioner to use throughout the application
practitioner = CRUDPractitioner(PractitionerModel)
