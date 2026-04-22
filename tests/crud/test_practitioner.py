"""
Tests for Practitioner CRUD operations.
"""

import pytest
from sqlalchemy.orm import Session

from app.crud.medical_specialty import medical_specialty as specialty_crud
from app.crud.practitioner import practitioner as practitioner_crud
from app.schemas.medical_specialty import MedicalSpecialtyCreate
from app.schemas.practitioner import PractitionerCreate, PractitionerUpdate


@pytest.fixture
def cardiology(db_session: Session):
    return specialty_crud.create(
        db_session, obj_in=MedicalSpecialtyCreate(name="Cardiology")
    )


@pytest.fixture
def dermatology(db_session: Session):
    return specialty_crud.create(
        db_session, obj_in=MedicalSpecialtyCreate(name="Dermatology")
    )


@pytest.fixture
def internal_medicine(db_session: Session):
    return specialty_crud.create(
        db_session, obj_in=MedicalSpecialtyCreate(name="Internal Medicine")
    )


@pytest.fixture
def neurology(db_session: Session):
    return specialty_crud.create(
        db_session, obj_in=MedicalSpecialtyCreate(name="Neurology")
    )


@pytest.fixture
def general_practice(db_session: Session):
    return specialty_crud.create(
        db_session, obj_in=MedicalSpecialtyCreate(name="General Practice")
    )


@pytest.fixture
def family_medicine(db_session: Session):
    return specialty_crud.create(
        db_session, obj_in=MedicalSpecialtyCreate(name="Family Medicine")
    )


class TestPractitionerCRUD:
    """Test Practitioner CRUD operations."""

    def test_create_practitioner(self, db_session: Session, cardiology):
        practitioner_data = PractitionerCreate(
            name="Dr. John Smith",
            specialty_id=cardiology.id,
            practice="Heart Health Center",
            phone_number="919-555-1234",
            email="drsmith@example.com",
            rating=4.5,
        )

        practitioner = practitioner_crud.create(db_session, obj_in=practitioner_data)

        assert practitioner is not None
        assert practitioner.name == "Dr. John Smith"
        assert practitioner.specialty_id == cardiology.id
        assert practitioner.specialty == "Cardiology"
        assert practitioner.practice == "Heart Health Center"
        assert practitioner.rating == 4.5

    def test_get_by_name(self, db_session: Session, internal_medicine):
        """Test getting a practitioner by exact name.

        Note: The query method lowercases filter values for case-insensitive
        matching. Names are stored as-is but searched in lowercase.
        """
        practitioner_data = PractitionerCreate(
            name="dr. jane doe", specialty_id=internal_medicine.id
        )
        practitioner_crud.create(db_session, obj_in=practitioner_data)

        found = practitioner_crud.get_by_name(db_session, name="Dr. Jane Doe")

        assert found is not None
        assert found.name == "dr. jane doe"

    def test_get_by_name_not_found(self, db_session: Session):
        found = practitioner_crud.get_by_name(db_session, name="Non-existent Doctor")
        assert found is None

    def test_search_by_name(self, db_session: Session, general_practice):
        names = ["Dr. John Smith", "Dr. Jane Smith", "Dr. Bob Johnson"]
        for name in names:
            practitioner_data = PractitionerCreate(
                name=name, specialty_id=general_practice.id
            )
            practitioner_crud.create(db_session, obj_in=practitioner_data)

        results = practitioner_crud.search_by_name(db_session, name="Smith")

        assert len(results) == 2
        names_found = [r.name for r in results]
        assert "Dr. John Smith" in names_found
        assert "Dr. Jane Smith" in names_found

    def test_get_by_specialty_id(
        self, db_session: Session, cardiology, dermatology
    ):
        practitioners_data = [
            PractitionerCreate(name="Dr. Heart 1", specialty_id=cardiology.id),
            PractitionerCreate(name="Dr. Heart 2", specialty_id=cardiology.id),
            PractitionerCreate(name="Dr. Skin", specialty_id=dermatology.id),
        ]
        for prac_data in practitioners_data:
            practitioner_crud.create(db_session, obj_in=prac_data)

        cardiologists = practitioner_crud.get_by_specialty_id(
            db_session, specialty_id=cardiology.id
        )

        assert len(cardiologists) == 2
        assert all(c.specialty_id == cardiology.id for c in cardiologists)

    def test_is_name_taken(self, db_session: Session, family_medicine):
        practitioner_data = PractitionerCreate(
            name="dr. unique name", specialty_id=family_medicine.id
        )
        practitioner_crud.create(db_session, obj_in=practitioner_data)

        assert (
            practitioner_crud.is_name_taken(db_session, name="Dr. Unique Name") is True
        )
        assert (
            practitioner_crud.is_name_taken(db_session, name="Dr. Another Name")
            is False
        )

    def test_is_name_taken_with_exclude(self, db_session: Session, family_medicine):
        practitioner_data = PractitionerCreate(
            name="dr. test doctor", specialty_id=family_medicine.id
        )
        created = practitioner_crud.create(db_session, obj_in=practitioner_data)

        assert (
            practitioner_crud.is_name_taken(
                db_session, name="Dr. Test Doctor", exclude_id=created.id
            )
            is False
        )

        assert (
            practitioner_crud.is_name_taken(db_session, name="Dr. Test Doctor") is True
        )

    def test_create_if_not_exists_creates(self, db_session: Session, neurology):
        practitioner_data = PractitionerCreate(
            name="Dr. New Doctor", specialty_id=neurology.id
        )
        practitioner = practitioner_crud.create_if_not_exists(
            db_session, practitioner_data=practitioner_data
        )

        assert practitioner is not None
        assert practitioner.name == "Dr. New Doctor"

    def test_create_if_not_exists_returns_existing(self, db_session: Session):
        orthopedics = specialty_crud.create(
            db_session, obj_in=MedicalSpecialtyCreate(name="Orthopedics")
        )
        cardiology = specialty_crud.create(
            db_session, obj_in=MedicalSpecialtyCreate(name="Cardiology 2")
        )

        initial_data = PractitionerCreate(
            name="dr. existing", specialty_id=orthopedics.id
        )
        initial = practitioner_crud.create(db_session, obj_in=initial_data)

        second_data = PractitionerCreate(
            name="dr. existing", specialty_id=cardiology.id
        )
        second = practitioner_crud.create_if_not_exists(
            db_session, practitioner_data=second_data
        )

        assert second.id == initial.id
        assert second.specialty_id == orthopedics.id

    def test_update_practitioner(
        self, db_session: Session, family_medicine, internal_medicine
    ):
        practitioner_data = PractitionerCreate(
            name="Dr. Original", specialty_id=family_medicine.id, rating=4.0
        )
        created = practitioner_crud.create(db_session, obj_in=practitioner_data)

        update_data = PractitionerUpdate(
            specialty_id=internal_medicine.id, rating=4.5
        )
        updated = practitioner_crud.update(
            db_session, db_obj=created, obj_in=update_data
        )

        assert updated.name == "Dr. Original"
        assert updated.specialty_id == internal_medicine.id
        assert updated.specialty == "Internal Medicine"
        assert updated.rating == 4.5

    def test_delete_practitioner(self, db_session: Session, general_practice):
        practitioner_data = PractitionerCreate(
            name="Dr. To Delete", specialty_id=general_practice.id
        )
        created = practitioner_crud.create(db_session, obj_in=practitioner_data)
        practitioner_id = created.id

        deleted = practitioner_crud.delete(db_session, id=practitioner_id)

        assert deleted is not None
        assert deleted.id == practitioner_id

        retrieved = practitioner_crud.get(db_session, id=practitioner_id)
        assert retrieved is None

    def test_search_pagination(self, db_session: Session, general_practice):
        for i in range(10):
            practitioner_data = PractitionerCreate(
                name=f"Dr. Test {i + 1}", specialty_id=general_practice.id
            )
            practitioner_crud.create(db_session, obj_in=practitioner_data)

        first_page = practitioner_crud.search_by_name(
            db_session, name="Test", skip=0, limit=5
        )
        assert len(first_page) == 5

        second_page = practitioner_crud.search_by_name(
            db_session, name="Test", skip=5, limit=5
        )
        assert len(second_page) == 5

        first_ids = {p.id for p in first_page}
        second_ids = {p.id for p in second_page}
        assert first_ids.isdisjoint(second_ids)

    def test_practitioner_with_contact_info(self, db_session: Session):
        psychiatry = specialty_crud.create(
            db_session, obj_in=MedicalSpecialtyCreate(name="Psychiatry")
        )
        practitioner_data = PractitionerCreate(
            name="Dr. Full Info",
            specialty_id=psychiatry.id,
            practice="Mental Health Center",
            phone_number="919-555-5555",
            email="fullinfo@example.com",
            website="drfullinfo.com",
            rating=4.8,
        )

        practitioner = practitioner_crud.create(db_session, obj_in=practitioner_data)

        assert practitioner.practice == "Mental Health Center"
        assert practitioner.phone_number == "919-555-5555"
        assert practitioner.email == "fullinfo@example.com"
        assert "drfullinfo.com" in practitioner.website
        assert practitioner.rating == 4.8
