"""
Tests for MedicalSpecialty CRUD operations and Practitioner dual-write behavior.
"""

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.crud.medical_specialty import medical_specialty as specialty_crud
from app.crud.practitioner import practitioner as practitioner_crud
from app.schemas.medical_specialty import (
    MedicalSpecialtyCreate,
    MedicalSpecialtyUpdate,
)
from app.schemas.practitioner import PractitionerCreate, PractitionerUpdate


class TestMedicalSpecialtyCRUD:
    """Basic CRUD for the MedicalSpecialty lookup table."""

    def test_create_specialty(self, db_session: Session):
        spec = specialty_crud.create(
            db_session,
            obj_in=MedicalSpecialtyCreate(
                name="Cardiology",
                description="Heart and cardiovascular system",
            ),
        )
        assert spec.id is not None
        assert spec.name == "Cardiology"
        assert spec.description == "Heart and cardiovascular system"
        assert spec.is_active is True

    def test_create_specialty_minimal(self, db_session: Session):
        spec = specialty_crud.create(
            db_session, obj_in=MedicalSpecialtyCreate(name="Dermatology")
        )
        assert spec.name == "Dermatology"
        assert spec.description is None
        assert spec.is_active is True

    def test_get_by_name_case_insensitive(self, db_session: Session):
        specialty_crud.create(
            db_session, obj_in=MedicalSpecialtyCreate(name="Neurology")
        )
        found = specialty_crud.get_by_name(db_session, name="neurology")
        assert found is not None
        assert found.name == "Neurology"

    def test_is_name_taken(self, db_session: Session):
        created = specialty_crud.create(
            db_session, obj_in=MedicalSpecialtyCreate(name="Oncology")
        )
        assert specialty_crud.is_name_taken(db_session, name="oncology") is True
        assert (
            specialty_crud.is_name_taken(
                db_session, name="oncology", exclude_id=created.id
            )
            is False
        )
        assert specialty_crud.is_name_taken(db_session, name="Something Else") is False

    def test_get_or_create_returns_existing(self, db_session: Session):
        first = specialty_crud.create(
            db_session, obj_in=MedicalSpecialtyCreate(name="Pediatrics")
        )
        second = specialty_crud.get_or_create(db_session, name="pediatrics")
        assert second.id == first.id

    def test_get_or_create_creates_new(self, db_session: Session):
        created = specialty_crud.get_or_create(db_session, name="Radiology")
        assert created.id is not None
        assert created.name == "Radiology"

    def test_update_specialty(self, db_session: Session):
        spec = specialty_crud.create(
            db_session, obj_in=MedicalSpecialtyCreate(name="Urology")
        )
        updated = specialty_crud.update(
            db_session,
            db_obj=spec,
            obj_in=MedicalSpecialtyUpdate(description="Urinary system", is_active=False),
        )
        assert updated.description == "Urinary system"
        assert updated.is_active is False
        assert updated.name == "Urology"

    def test_delete_without_practitioners_succeeds(self, db_session: Session):
        spec = specialty_crud.create(
            db_session, obj_in=MedicalSpecialtyCreate(name="Hematology")
        )
        specialty_crud.delete(db_session, id=spec.id)
        assert specialty_crud.get(db_session, id=spec.id) is None

    def test_delete_with_practitioners_raises_409(self, db_session: Session):
        """409 when the specialty is still referenced by a practitioner."""
        spec = specialty_crud.create(
            db_session, obj_in=MedicalSpecialtyCreate(name="Psychiatry")
        )
        practitioner_crud.create(
            db_session,
            obj_in=PractitionerCreate(
                name="Dr. Reference",
                specialty="Psychiatry",
                specialty_id=spec.id,
            ),
        )

        with pytest.raises(HTTPException) as excinfo:
            specialty_crud.delete(db_session, id=spec.id)

        assert excinfo.value.status_code == 409
        # The specialty should still exist in the database
        assert specialty_crud.get(db_session, id=spec.id) is not None

    def test_get_active_returns_only_active(self, db_session: Session):
        active = specialty_crud.create(
            db_session, obj_in=MedicalSpecialtyCreate(name="Active One")
        )
        inactive = specialty_crud.create(
            db_session,
            obj_in=MedicalSpecialtyCreate(name="Inactive One", is_active=False),
        )

        result = specialty_crud.get_active(db_session)
        ids = [s.id for s in result]
        assert active.id in ids
        assert inactive.id not in ids


class TestPractitionerSpecialtyDualWrite:
    """Practitioner.specialty <-> specialty_id dual-write behavior."""

    def test_create_with_specialty_id_populates_string(self, db_session: Session):
        spec = specialty_crud.create(
            db_session,
            obj_in=MedicalSpecialtyCreate(name="Cardiology"),
        )
        practitioner = practitioner_crud.create(
            db_session,
            obj_in=PractitionerCreate(
                name="Dr. FK",
                specialty="placeholder",
                specialty_id=spec.id,
            ),
        )
        assert practitioner.specialty_id == spec.id
        # Specialty string is normalized to the canonical name from MedicalSpecialty
        assert practitioner.specialty == "Cardiology"

    def test_create_with_legacy_specialty_string_backfills_fk(
        self, db_session: Session
    ):
        practitioner = practitioner_crud.create(
            db_session,
            obj_in=PractitionerCreate(
                name="Dr. Legacy",
                specialty="Gastroenterology",
            ),
        )
        assert practitioner.specialty == "Gastroenterology"
        assert practitioner.specialty_id is not None
        # The get_or_create path should have created the MedicalSpecialty row
        linked = specialty_crud.get(db_session, id=practitioner.specialty_id)
        assert linked is not None
        assert linked.name == "Gastroenterology"

    def test_update_changes_both_columns_in_sync(self, db_session: Session):
        practitioner = practitioner_crud.create(
            db_session,
            obj_in=PractitionerCreate(
                name="Dr. Reassign",
                specialty="Neurology",
            ),
        )
        new_spec = specialty_crud.create(
            db_session, obj_in=MedicalSpecialtyCreate(name="Oncology")
        )

        updated = practitioner_crud.update(
            db_session,
            db_obj=practitioner,
            obj_in=PractitionerUpdate(specialty_id=new_spec.id),
        )
        assert updated.specialty_id == new_spec.id
        assert updated.specialty == "Oncology"

    def test_invalid_specialty_id_raises_400(self, db_session: Session):
        with pytest.raises(HTTPException) as excinfo:
            practitioner_crud.create(
                db_session,
                obj_in=PractitionerCreate(
                    name="Dr. Bad",
                    specialty="Irrelevant",
                    specialty_id=99999,
                ),
            )
        assert excinfo.value.status_code == 400
