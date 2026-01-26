"""
CRUD operations for Injury entity and its junction tables.

Injury represents a physical injury record for a patient.
"""
from typing import List, Optional

from sqlalchemy import and_
from sqlalchemy.orm import Session, joinedload

from app.crud.base import CRUDBase
from app.crud.base_tags import TagFilterMixin
from app.models.models import (
    Injury,
    InjuryMedication,
    InjuryCondition,
    InjuryTreatment,
    InjuryProcedure,
)
from app.schemas.injury import (
    InjuryCreate,
    InjuryUpdate,
    InjuryMedicationCreate,
    InjuryMedicationUpdate,
    InjuryConditionCreate,
    InjuryTreatmentCreate,
    InjuryProcedureCreate,
)


class CRUDInjury(CRUDBase[Injury, InjuryCreate, InjuryUpdate], TagFilterMixin):
    """
    CRUD operations for Injury model.

    Provides specialized methods for injury management.
    """

    def get_by_patient(
        self, db: Session, *, patient_id: int, skip: int = 0, limit: int = 100
    ) -> List[Injury]:
        """
        Get all injuries for a patient.

        Args:
            db: Database session
            patient_id: ID of the patient
            skip: Number of records to skip
            limit: Maximum records to return

        Returns:
            List of injuries for the patient
        """
        return self.query(
            db=db,
            filters={"patient_id": patient_id},
            skip=skip,
            limit=limit,
            order_by="date_of_injury",
            order_desc=True,
            load_relations=["injury_type", "practitioner"],
        )

    def get_active_injuries(
        self, db: Session, *, patient_id: int
    ) -> List[Injury]:
        """
        Get all active injuries for a patient.

        Args:
            db: Database session
            patient_id: ID of the patient

        Returns:
            List of active injuries
        """
        return self.query(
            db=db,
            filters={"patient_id": patient_id, "status": "active"},
            order_by="date_of_injury",
            order_desc=True,
            load_relations=["injury_type", "practitioner"],
        )

    def get_by_status(
        self, db: Session, *, patient_id: int, status: str
    ) -> List[Injury]:
        """
        Get injuries by status for a patient.

        Args:
            db: Database session
            patient_id: ID of the patient
            status: Status to filter by (active/healing/resolved/chronic)

        Returns:
            List of injuries matching the status
        """
        return self.query(
            db=db,
            filters={"patient_id": patient_id, "status": status},
            order_by="date_of_injury",
            order_desc=True,
            load_relations=["injury_type", "practitioner"],
        )

    def get_by_body_part(
        self, db: Session, *, patient_id: int, body_part: str
    ) -> List[Injury]:
        """
        Get injuries by body part for a patient.

        Args:
            db: Database session
            patient_id: ID of the patient
            body_part: Body part to filter by

        Returns:
            List of injuries for the specified body part
        """
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.patient_id == patient_id,
                    self.model.body_part.ilike(f"%{body_part}%")
                )
            )
            .order_by(self.model.date_of_injury.desc())
            .all()
        )

    def get_by_type(
        self, db: Session, *, patient_id: int, injury_type_id: int
    ) -> List[Injury]:
        """
        Get injuries by injury type for a patient.

        Args:
            db: Database session
            patient_id: ID of the patient
            injury_type_id: ID of the injury type

        Returns:
            List of injuries of the specified type
        """
        return self.query(
            db=db,
            filters={"patient_id": patient_id, "injury_type_id": injury_type_id},
            order_by="date_of_injury",
            order_desc=True,
            load_relations=["injury_type", "practitioner"],
        )

    def get_with_relations(
        self, db: Session, *, record_id: int
    ) -> Optional[Injury]:
        """
        Get an injury with all its relations loaded.

        Args:
            db: Database session
            record_id: ID of the injury

        Returns:
            Injury with relations or None
        """
        return (
            db.query(self.model)
            .options(
                joinedload(self.model.injury_type),
                joinedload(self.model.practitioner),
                joinedload(self.model.patient),
            )
            .filter(self.model.id == record_id)
            .first()
        )


class CRUDInjuryMedication(CRUDBase[InjuryMedication, InjuryMedicationCreate, InjuryMedicationUpdate]):
    """CRUD operations for InjuryMedication junction table"""

    def __init__(self):
        super().__init__(InjuryMedication)

    def get_by_injury(
        self, db: Session, *, injury_id: int
    ) -> List[InjuryMedication]:
        """Get all medication relationships for a specific injury"""
        return (
            db.query(self.model)
            .filter(self.model.injury_id == injury_id)
            .all()
        )

    def get_by_medication(
        self, db: Session, *, medication_id: int
    ) -> List[InjuryMedication]:
        """Get all injury relationships for a specific medication"""
        return (
            db.query(self.model)
            .filter(self.model.medication_id == medication_id)
            .all()
        )

    def get_by_injury_and_medication(
        self, db: Session, *, injury_id: int, medication_id: int
    ) -> Optional[InjuryMedication]:
        """Get specific relationship between injury and medication"""
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.injury_id == injury_id,
                    self.model.medication_id == medication_id
                )
            )
            .first()
        )

    def delete_by_injury_and_medication(
        self, db: Session, *, injury_id: int, medication_id: int
    ) -> bool:
        """Delete specific relationship between injury and medication"""
        relationship = self.get_by_injury_and_medication(
            db, injury_id=injury_id, medication_id=medication_id
        )
        if relationship:
            db.delete(relationship)
            db.commit()
            return True
        return False


class CRUDInjuryCondition(CRUDBase[InjuryCondition, InjuryConditionCreate, InjuryConditionCreate]):
    """CRUD operations for InjuryCondition junction table"""

    def __init__(self):
        super().__init__(InjuryCondition)

    def get_by_injury(
        self, db: Session, *, injury_id: int
    ) -> List[InjuryCondition]:
        """Get all condition relationships for a specific injury"""
        return (
            db.query(self.model)
            .filter(self.model.injury_id == injury_id)
            .all()
        )

    def get_by_condition(
        self, db: Session, *, condition_id: int
    ) -> List[InjuryCondition]:
        """Get all injury relationships for a specific condition"""
        return (
            db.query(self.model)
            .filter(self.model.condition_id == condition_id)
            .all()
        )

    def get_by_injury_and_condition(
        self, db: Session, *, injury_id: int, condition_id: int
    ) -> Optional[InjuryCondition]:
        """Get specific relationship between injury and condition"""
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.injury_id == injury_id,
                    self.model.condition_id == condition_id
                )
            )
            .first()
        )

    def delete_by_injury_and_condition(
        self, db: Session, *, injury_id: int, condition_id: int
    ) -> bool:
        """Delete specific relationship between injury and condition"""
        relationship = self.get_by_injury_and_condition(
            db, injury_id=injury_id, condition_id=condition_id
        )
        if relationship:
            db.delete(relationship)
            db.commit()
            return True
        return False


class CRUDInjuryTreatment(CRUDBase[InjuryTreatment, InjuryTreatmentCreate, InjuryTreatmentCreate]):
    """CRUD operations for InjuryTreatment junction table"""

    def __init__(self):
        super().__init__(InjuryTreatment)

    def get_by_injury(
        self, db: Session, *, injury_id: int
    ) -> List[InjuryTreatment]:
        """Get all treatment relationships for a specific injury"""
        return (
            db.query(self.model)
            .filter(self.model.injury_id == injury_id)
            .all()
        )

    def get_by_treatment(
        self, db: Session, *, treatment_id: int
    ) -> List[InjuryTreatment]:
        """Get all injury relationships for a specific treatment"""
        return (
            db.query(self.model)
            .filter(self.model.treatment_id == treatment_id)
            .all()
        )

    def get_by_injury_and_treatment(
        self, db: Session, *, injury_id: int, treatment_id: int
    ) -> Optional[InjuryTreatment]:
        """Get specific relationship between injury and treatment"""
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.injury_id == injury_id,
                    self.model.treatment_id == treatment_id
                )
            )
            .first()
        )

    def delete_by_injury_and_treatment(
        self, db: Session, *, injury_id: int, treatment_id: int
    ) -> bool:
        """Delete specific relationship between injury and treatment"""
        relationship = self.get_by_injury_and_treatment(
            db, injury_id=injury_id, treatment_id=treatment_id
        )
        if relationship:
            db.delete(relationship)
            db.commit()
            return True
        return False


class CRUDInjuryProcedure(CRUDBase[InjuryProcedure, InjuryProcedureCreate, InjuryProcedureCreate]):
    """CRUD operations for InjuryProcedure junction table"""

    def __init__(self):
        super().__init__(InjuryProcedure)

    def get_by_injury(
        self, db: Session, *, injury_id: int
    ) -> List[InjuryProcedure]:
        """Get all procedure relationships for a specific injury"""
        return (
            db.query(self.model)
            .filter(self.model.injury_id == injury_id)
            .all()
        )

    def get_by_procedure(
        self, db: Session, *, procedure_id: int
    ) -> List[InjuryProcedure]:
        """Get all injury relationships for a specific procedure"""
        return (
            db.query(self.model)
            .filter(self.model.procedure_id == procedure_id)
            .all()
        )

    def get_by_injury_and_procedure(
        self, db: Session, *, injury_id: int, procedure_id: int
    ) -> Optional[InjuryProcedure]:
        """Get specific relationship between injury and procedure"""
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.injury_id == injury_id,
                    self.model.procedure_id == procedure_id
                )
            )
            .first()
        )

    def delete_by_injury_and_procedure(
        self, db: Session, *, injury_id: int, procedure_id: int
    ) -> bool:
        """Delete specific relationship between injury and procedure"""
        relationship = self.get_by_injury_and_procedure(
            db, injury_id=injury_id, procedure_id=procedure_id
        )
        if relationship:
            db.delete(relationship)
            db.commit()
            return True
        return False


# Create the CRUD instances
injury = CRUDInjury(Injury)
injury_medication = CRUDInjuryMedication()
injury_condition = CRUDInjuryCondition()
injury_treatment = CRUDInjuryTreatment()
injury_procedure = CRUDInjuryProcedure()
