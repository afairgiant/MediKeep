from typing import List, Optional

from sqlalchemy.orm import Session, joinedload

from app.crud.base import CRUDBase
from app.models.models import FamilyMember
from app.schemas.family_member import FamilyMemberCreate, FamilyMemberUpdate


class CRUDFamilyMember(CRUDBase[FamilyMember, FamilyMemberCreate, FamilyMemberUpdate]):
    """
    Family member-specific CRUD operations for family medical history.

    Handles family members and their basic information for medical history tracking.
    """

    def get_by_patient_with_conditions(
        self, db: Session, *, patient_id: int
    ) -> List[FamilyMember]:
        """
        Get all family members for a patient with their conditions loaded.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient

        Returns:
            List of family members with conditions eagerly loaded
        """
        return (
            db.query(self.model)
            .options(joinedload(FamilyMember.family_conditions))
            .filter(self.model.patient_id == patient_id)
            .order_by(self.model.relationship, self.model.name)
            .all()
        )

    def get_by_relationship(
        self, db: Session, *, patient_id: int, relationship: str
    ) -> List[FamilyMember]:
        """
        Get family members by relationship type for a patient.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient
            relationship: Type of relationship (father, mother, etc.)

        Returns:
            List of family members with specified relationship
        """
        return self.query(
            db=db,
            filters={"patient_id": patient_id, "relationship": relationship},
            order_by="name",
            order_desc=False,
        )

    def search_by_name(
        self, db: Session, *, patient_id: int, name_term: str
    ) -> List[FamilyMember]:
        """
        Search family members by name for a patient.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient
            name_term: Search term for family member name

        Returns:
            List of family members matching the search term
        """
        return self.query(
            db=db,
            filters={"patient_id": patient_id},
            search={"field": "name", "term": name_term},
            order_by="name",
            order_desc=False,
        )


# Create the CRUD instance
family_member = CRUDFamilyMember(FamilyMember)