from typing import List, Optional

from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.models import FamilyCondition
from app.schemas.family_condition import FamilyConditionCreate, FamilyConditionUpdate


class CRUDFamilyCondition(CRUDBase[FamilyCondition, FamilyConditionCreate, FamilyConditionUpdate]):
    """
    Family condition-specific CRUD operations for family medical history.

    Handles medical conditions for family members.
    """

    def get_by_family_member(
        self, db: Session, *, family_member_id: int
    ) -> List[FamilyCondition]:
        """
        Get all conditions for a specific family member.

        Args:
            db: SQLAlchemy database session
            family_member_id: ID of the family member

        Returns:
            List of conditions for the family member
        """
        return self.query(
            db=db,
            filters={"family_member_id": family_member_id},
            order_by="condition_name",
            order_desc=False,
        )

    def get_by_condition_type(
        self, db: Session, *, family_member_id: int, condition_type: str
    ) -> List[FamilyCondition]:
        """
        Get conditions by type for a family member.

        Args:
            db: SQLAlchemy database session
            family_member_id: ID of the family member
            condition_type: Type of condition (cardiovascular, diabetes, etc.)

        Returns:
            List of conditions of specified type
        """
        return self.query(
            db=db,
            filters={"family_member_id": family_member_id, "condition_type": condition_type},
            order_by="condition_name",
            order_desc=False,
        )

    def get_by_severity(
        self, db: Session, *, family_member_id: int, severity: str
    ) -> List[FamilyCondition]:
        """
        Get conditions by severity for a family member.

        Args:
            db: SQLAlchemy database session
            family_member_id: ID of the family member
            severity: Severity level (mild, moderate, severe, critical)

        Returns:
            List of conditions with specified severity
        """
        return self.query(
            db=db,
            filters={"family_member_id": family_member_id, "severity": severity},
            order_by="condition_name",
            order_desc=False,
        )

    def search_by_condition_name(
        self, db: Session, *, family_member_id: int, condition_term: str
    ) -> List[FamilyCondition]:
        """
        Search conditions by name for a family member.

        Args:
            db: SQLAlchemy database session
            family_member_id: ID of the family member
            condition_term: Search term for condition name

        Returns:
            List of conditions matching the search term
        """
        return self.query(
            db=db,
            filters={"family_member_id": family_member_id},
            search={"field": "condition_name", "term": condition_term},
            order_by="condition_name",
            order_desc=False,
        )

    def get_by_patient_and_condition_type(
        self, db: Session, *, patient_id: int, condition_type: str
    ) -> List[FamilyCondition]:
        """
        Get all family conditions of a specific type across all family members for a patient.
        Useful for family history analysis.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient
            condition_type: Type of condition to search for

        Returns:
            List of family conditions with family member info
        """
        from app.models.models import FamilyMember
        
        return (
            db.query(self.model)
            .join(FamilyMember, self.model.family_member_id == FamilyMember.id)
            .filter(
                FamilyMember.patient_id == patient_id,
                self.model.condition_type == condition_type
            )
            .order_by(FamilyMember.relationship, self.model.condition_name)
            .all()
        )


# Create the CRUD instance
family_condition = CRUDFamilyCondition(FamilyCondition)