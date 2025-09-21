from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session, joinedload

from app.crud.base import CRUDBase
from app.crud.base_tags import TagFilterMixin
from app.models.models import Allergy
from app.schemas.allergy import AllergyCreate, AllergyUpdate


class CRUDAllergy(CRUDBase[Allergy, AllergyCreate, AllergyUpdate], TagFilterMixin):
    """
    Allergy-specific CRUD operations for patient allergies.

    Handles patient allergy records, allergen tracking, and severity management.
    """

    def get_by_severity(
        self, db: Session, *, severity: str, patient_id: Optional[int] = None, load_relations: Optional[List[str]] = None
    ) -> List[Allergy]:
        """
        Retrieve allergies by severity, optionally filtered by patient.

        Args:
            db: SQLAlchemy database session
            severity: Severity to filter by
            patient_id: Optional patient ID to filter by
            load_relations: Optional list of relationships to load

        Returns:
            List of allergies with the specified severity
        """
        filters: Dict[str, Any] = {"severity": severity.lower()}
        if patient_id:
            filters["patient_id"] = patient_id

        return self.query(
            db=db,
            filters=filters,
            order_by="onset_date",
            order_desc=True,
            load_relations=load_relations,
        )

    def get_active_allergies(self, db: Session, *, patient_id: int) -> List[Allergy]:
        """
        Get all active allergies for a patient.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient

        Returns:
            List of active allergies
        """
        return self.query(
            db=db,
            filters={"status": "active", "patient_id": patient_id},
            order_by="severity",
            order_desc=True,
        )

    def get_critical_allergies(self, db: Session, *, patient_id: int) -> List[Allergy]:
        """
        Get critical (severe and life-threatening) allergies for a patient.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient

        Returns:
            List of critical allergies ordered by severity (life-threatening first)
        """
        from sqlalchemy import or_, case

        # Create a case statement to order by severity priority
        severity_order = case(
            (Allergy.severity == "life-threatening", 1),
            (Allergy.severity == "severe", 2),
            else_=3
        )

        query = (
            db.query(Allergy)
            .filter(
                Allergy.patient_id == patient_id,
                Allergy.status == "active",
                or_(
                    Allergy.severity == "severe", Allergy.severity == "life-threatening"
                ),
            )
            .order_by(severity_order, Allergy.onset_date.desc().nullslast())
        )
        return query.all()

    def get_by_allergen(
        self, db: Session, *, allergen: str, patient_id: Optional[int] = None, load_relations: Optional[List[str]] = None
    ) -> List[Allergy]:
        """
        Retrieve allergies by allergen name, optionally filtered by patient.

        Args:
            db: SQLAlchemy database session
            allergen: Allergen name to search for
            patient_id: Optional patient ID to filter by
            load_relations: Optional list of relationships to load

        Returns:
            List of allergies matching the allergen
        """
        filters: Dict[str, Any] = {}
        if patient_id:
            filters["patient_id"] = patient_id

        return self.query(
            db=db,
            filters=filters,
            search={"field": "allergen", "term": allergen},
            order_by="severity",
            order_desc=True,
            load_relations=load_relations,
        )

    def check_allergen_conflict(
        self, db: Session, *, patient_id: int, allergen: str
    ) -> bool:
        """
        Check if a patient has any active allergies to a specific allergen.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient
            allergen: Allergen to check for

        Returns:
            True if patient has active allergy to the allergen, False otherwise
        """
        allergies = self.query(
            db=db,
            filters={"patient_id": patient_id, "status": "active"},
            search={"field": "allergen", "term": allergen},
            limit=1,
        )
        return len(allergies) > 0


# Create the allergy CRUD instance
allergy = CRUDAllergy(Allergy)
