from typing import Optional

from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.models import Patient
from app.schemas.patient import PatientCreate, PatientUpdate


class CRUDPatient(CRUDBase[Patient, PatientCreate, PatientUpdate]):
    """
    Patient-specific CRUD operations for individual medical records system.

    This system supports a single user managing their own patient record.
    Each user has exactly one patient record linked to their account.
    """

    def get_by_user_id(self, db: Session, *, user_id: int) -> Optional[Patient]:
        """
        Retrieve the patient record for a specific user.
        Since each user has only one patient record, this is the primary access method.

        Args:
            db: SQLAlchemy database session
            user_id: The user ID to search for

        Returns:
            Patient object if found, None otherwise

        Example:
            # User accessing their own patient record
            patient = patient_crud.get_by_user_id(db, user_id=current_user.id)
        """
        patients = self.query(
            db=db,
            filters={"user_id": user_id},
            limit=1,
        )
        return patients[0] if patients else None

    def get_with_user(self, db: Session, patient_id: int) -> Optional[Patient]:
        """
        Retrieve a patient with their associated user information loaded.
        Useful for displaying complete profile information.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient to retrieve

        Returns:
            Patient object with user relationship loaded, or None if not found

        Example:
            patient_with_user = patient_crud.get_with_user(db, patient_id=5)
            user_info = patient_with_user.user
        """
        return super().get_with_relations(
            db=db, record_id=patient_id, relations=["user"]
        )

    def get_with_medical_records(
        self, db: Session, patient_id: int
    ) -> Optional[Patient]:
        """
        Retrieve a patient with all their medical records loaded.
        Used for comprehensive medical history view.

        Args:
            db: SQLAlchemy database session
            patient_id: ID of the patient to retrieve

        Returns:
            Patient object with all medical relationships loaded, or None if not found

        Example:
            # Get complete medical history for the user
            patient = patient_crud.get_with_medical_records(db, patient_id=current_patient.id)
        """
        return super().get_with_relations(
            db=db,
            record_id=patient_id,
            relations=[
                "medications",
                "encounters",
                "lab_results",
                "immunizations",
                "conditions",
                "procedures",
                "treatments",
            ],
        )

    def is_user_already_patient(self, db: Session, *, user_id: int) -> bool:
        """
        Check if a user already has a patient record.
        Prevents duplicate patient records for the same user.

        Args:
            db: SQLAlchemy database session
            user_id: User ID to check

        Returns:
            True if user already has a patient record, False otherwise

        Example:
            if patient_crud.is_user_already_patient(db, user_id=new_user.id):
                raise HTTPException(400, "User already has a patient record")
        """
        patients = self.query(
            db=db,
            filters={"user_id": user_id},
            limit=1,
        )
        return len(patients) > 0

    def create_for_user(
        self, db: Session, *, user_id: int, patient_data: PatientCreate
    ) -> Patient:
        """
        Create a patient record for a specific user.
        Ensures the user_id is set correctly and prevents duplicate records.

        Args:
            db: SQLAlchemy database session
            user_id: ID of the user this patient record belongs to
            patient_data: Patient creation data

        Returns:
            The newly created Patient object

        Raises:
            ValueError: If user already has a patient record

        Example:
            patient_data = PatientCreate(
                first_name="John",
                last_name="Doe",
                birthDate="1990-01-01",
                gender="M",
                address="123 Main St"
            )
            new_patient = patient_crud.create_for_user(db, user_id=user.id, patient_data=patient_data)
        """
        # Check if user already has a patient record
        if self.is_user_already_patient(db, user_id=user_id):
            raise ValueError("User already has a patient record")

        # Create patient with the specified user_id
        patient_dict = patient_data.dict()
        patient_dict["user_id"] = user_id

        db_patient = Patient(**patient_dict)
        db.add(db_patient)
        db.commit()
        db.refresh(db_patient)
        return db_patient

    def update_for_user(
        self, db: Session, *, user_id: int, patient_data: PatientUpdate
    ) -> Optional[Patient]:
        """
        Update the patient record for a specific user.
        Only allows users to update their own patient record.

        Args:
            db: SQLAlchemy database session
            user_id: ID of the user updating their patient record
            patient_data: Patient update data

        Returns:
            Updated Patient object if successful, None if no patient record found

        Example:
            update_data = PatientUpdate(address="456 New St")
            updated_patient = patient_crud.update_for_user(db, user_id=current_user.id, patient_data=update_data)
        """
        # Get the user's patient record
        db_patient = self.get_by_user_id(db, user_id=user_id)

        if not db_patient:
            return None

        # Use the base update method
        return self.update(db, db_obj=db_patient, obj_in=patient_data)

    def delete_for_user(self, db: Session, *, user_id: int) -> Optional[Patient]:
        """
        Delete the patient record for a specific user.
        Only allows users to delete their own patient record.

        Args:
            db: SQLAlchemy database session
            user_id: ID of the user deleting their patient record

        Returns:
            Deleted Patient object if successful, None if no patient record found

        Example:
            deleted_patient = patient_crud.delete_for_user(db, user_id=current_user.id)
        """
        # Get the user's patient record
        db_patient = self.get_by_user_id(db, user_id=user_id)

        if not db_patient:
            return None

        # Use the base delete method
        return self.delete(db, id=int(db_patient.id))


# Create the patient CRUD instance
patient = CRUDPatient(Patient)
