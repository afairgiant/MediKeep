from typing import List, Optional

from sqlalchemy.orm import Session, joinedload

from app.crud.base import CRUDBase
from app.models.models import Allergy
from app.schemas.allergy import AllergyCreate, AllergyUpdate


class CRUDAllergy(CRUDBase[Allergy, AllergyCreate, AllergyUpdate]):
    """
    Allergy-specific CRUD operations for patient allergies.

    Handles patient allergy records, allergen tracking, and severity management.
    """

    def get_by_severity(
        self, db: Session, *, severity: str, patient_id: Optional[int] = None
    ) -> List[Allergy]:
        """
        Retrieve allergies by severity, optionally filtered by patient.

        Args:
            db: SQLAlchemy database session
            severity: Severity to filter by
            patient_id: Optional patient ID to filter by

        Returns:
            List of allergies with the specified severity
        """
        additional_filters = {}
        if patient_id:
            additional_filters["patient_id"] = patient_id

        return super().get_by_field(
            db=db,
            field_name="severity",
            field_value=severity.lower(),
            order_by="onset_date",
            order_desc=True,
            additional_filters=additional_filters,
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
        return super().get_by_status(
            db=db,
            status="active",
            patient_id=patient_id,
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
            List of critical allergies
        """
        from sqlalchemy import or_

        query = (
            db.query(Allergy)
            .filter(
                Allergy.patient_id == patient_id,
                Allergy.status == "active",
                or_(
                    Allergy.severity == "severe", Allergy.severity == "life-threatening"
                ),
            )
            .order_by(Allergy.severity.desc(), Allergy.onset_date.desc().nullslast())
        )
        return query.all()

    def get_by_allergen(
        self, db: Session, *, allergen: str, patient_id: Optional[int] = None
    ) -> List[Allergy]:
        """
        Retrieve allergies by allergen name, optionally filtered by patient.

        Args:
            db: SQLAlchemy database session
            allergen: Allergen name to search for
            patient_id: Optional patient ID to filter by

        Returns:
            List of allergies matching the allergen
        """
        return super().search_by_text_field(
            db=db,
            field_name="allergen",
            search_term=allergen,
            patient_id=patient_id,
            order_by="severity",
            order_desc=True,
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
        allergies = super().search_by_text_field(
            db=db,
            field_name="allergen",
            search_term=allergen,
            patient_id=patient_id,
            additional_filters={"status": "active"},
            limit=1,
        )
        return len(allergies) > 0


# Create the allergy CRUD instance
allergy = CRUDAllergy(Allergy)
