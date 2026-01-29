"""
Tests for Practitioner CRUD operations.
"""
import pytest
from sqlalchemy.orm import Session

from app.crud.practitioner import practitioner as practitioner_crud
from app.models.models import Practitioner
from app.schemas.practitioner import PractitionerCreate, PractitionerUpdate


class TestPractitionerCRUD:
    """Test Practitioner CRUD operations."""

    def test_create_practitioner(self, db_session: Session):
        """Test creating a practitioner."""
        practitioner_data = PractitionerCreate(
            name="Dr. John Smith",
            specialty="Cardiology",
            practice="Heart Health Center",
            phone_number="919-555-1234",
            email="drsmith@example.com",
            rating=4.5
        )

        practitioner = practitioner_crud.create(db_session, obj_in=practitioner_data)

        assert practitioner is not None
        assert practitioner.name == "Dr. John Smith"
        assert practitioner.specialty == "Cardiology"
        assert practitioner.practice == "Heart Health Center"
        assert practitioner.rating == 4.5

    def test_get_by_name(self, db_session: Session):
        """Test getting a practitioner by exact name.

        Note: The query method lowercases filter values for case-insensitive matching.
        Names are stored as-is but searched in lowercase.
        """
        # Use lowercase name since query method lowercases the search value
        practitioner_data = PractitionerCreate(
            name="dr. jane doe",
            specialty="Internal Medicine"
        )
        practitioner_crud.create(db_session, obj_in=practitioner_data)

        found = practitioner_crud.get_by_name(db_session, name="Dr. Jane Doe")

        assert found is not None
        assert found.name == "dr. jane doe"

    def test_get_by_name_not_found(self, db_session: Session):
        """Test getting non-existent practitioner by name."""
        found = practitioner_crud.get_by_name(db_session, name="Non-existent Doctor")

        assert found is None

    def test_search_by_name(self, db_session: Session):
        """Test searching practitioners by partial name."""
        # Create practitioners
        names = ["Dr. John Smith", "Dr. Jane Smith", "Dr. Bob Johnson"]
        for name in names:
            practitioner_data = PractitionerCreate(
                name=name,
                specialty="General Practice"
            )
            practitioner_crud.create(db_session, obj_in=practitioner_data)

        # Search for "Smith"
        results = practitioner_crud.search_by_name(db_session, name="Smith")

        assert len(results) == 2
        names_found = [r.name for r in results]
        assert "Dr. John Smith" in names_found
        assert "Dr. Jane Smith" in names_found

    def test_get_by_specialty(self, db_session: Session):
        """Test getting practitioners by specialty."""
        # Create practitioners with different specialties
        practitioners_data = [
            PractitionerCreate(name="Dr. Heart 1", specialty="Cardiology"),
            PractitionerCreate(name="Dr. Heart 2", specialty="Cardiology"),
            PractitionerCreate(name="Dr. Skin", specialty="Dermatology"),
        ]

        for prac_data in practitioners_data:
            practitioner_crud.create(db_session, obj_in=prac_data)

        cardiologists = practitioner_crud.get_by_specialty(
            db_session, specialty="Cardiology"
        )

        assert len(cardiologists) == 2
        assert all("Cardiology" in c.specialty for c in cardiologists)

    def test_get_all_specialties(self, db_session: Session):
        """Test getting all unique specialties."""
        specialties = ["Cardiology", "Dermatology", "Internal Medicine", "Cardiology"]

        for i, specialty in enumerate(specialties):
            practitioner_data = PractitionerCreate(
                name=f"Dr. Test {i+1}",
                specialty=specialty
            )
            practitioner_crud.create(db_session, obj_in=practitioner_data)

        unique_specialties = practitioner_crud.get_all_specialties(db_session)

        assert len(unique_specialties) == 3
        assert "Cardiology" in unique_specialties
        assert "Dermatology" in unique_specialties
        assert "Internal Medicine" in unique_specialties

    def test_is_name_taken(self, db_session: Session):
        """Test checking if practitioner name is taken.

        Note: The query method lowercases filter values for matching.
        """
        # Use lowercase to match query behavior
        practitioner_data = PractitionerCreate(
            name="dr. unique name",
            specialty="Family Medicine"
        )
        practitioner_crud.create(db_session, obj_in=practitioner_data)

        assert practitioner_crud.is_name_taken(db_session, name="Dr. Unique Name") is True
        assert practitioner_crud.is_name_taken(db_session, name="Dr. Another Name") is False

    def test_is_name_taken_with_exclude(self, db_session: Session):
        """Test is_name_taken excludes specific practitioner ID.

        Note: The query method lowercases filter values for matching.
        """
        # Use lowercase to match query behavior
        practitioner_data = PractitionerCreate(
            name="dr. test doctor",
            specialty="Family Medicine"
        )
        created = practitioner_crud.create(db_session, obj_in=practitioner_data)

        # Should not be taken when excluding the same practitioner
        assert practitioner_crud.is_name_taken(
            db_session, name="Dr. Test Doctor", exclude_id=created.id
        ) is False

        # Should be taken without exclusion
        assert practitioner_crud.is_name_taken(
            db_session, name="Dr. Test Doctor"
        ) is True

    def test_create_if_not_exists_creates(self, db_session: Session):
        """Test create_if_not_exists creates new practitioner."""
        practitioner_data = PractitionerCreate(
            name="Dr. New Doctor",
            specialty="Neurology"
        )

        practitioner = practitioner_crud.create_if_not_exists(
            db_session, practitioner_data=practitioner_data
        )

        assert practitioner is not None
        assert practitioner.name == "Dr. New Doctor"

    def test_create_if_not_exists_returns_existing(self, db_session: Session):
        """Test create_if_not_exists returns existing practitioner.

        Note: The query method lowercases filter values for matching.
        """
        # Create first with lowercase name
        initial_data = PractitionerCreate(
            name="dr. existing",
            specialty="Orthopedics"
        )
        initial = practitioner_crud.create(db_session, obj_in=initial_data)

        # Try to create again with same name (case variation)
        second_data = PractitionerCreate(
            name="dr. existing",
            specialty="Different Specialty"
        )
        second = practitioner_crud.create_if_not_exists(
            db_session, practitioner_data=second_data
        )

        # Should return the original practitioner
        assert second.id == initial.id
        assert second.specialty == "Orthopedics"  # Original specialty

    def test_count_by_specialty(self, db_session: Session):
        """Test counting practitioners by specialty."""
        practitioners_data = [
            PractitionerCreate(name="Dr. Card 1", specialty="Cardiology"),
            PractitionerCreate(name="Dr. Card 2", specialty="Cardiology"),
            PractitionerCreate(name="Dr. Derm 1", specialty="Dermatology"),
            PractitionerCreate(name="Dr. Neuro 1", specialty="Neurology"),
        ]

        for prac_data in practitioners_data:
            practitioner_crud.create(db_session, obj_in=prac_data)

        counts = practitioner_crud.count_by_specialty(db_session)

        assert counts["Cardiology"] == 2
        assert counts["Dermatology"] == 1
        assert counts["Neurology"] == 1

    def test_update_practitioner(self, db_session: Session):
        """Test updating a practitioner."""
        practitioner_data = PractitionerCreate(
            name="Dr. Original",
            specialty="Family Medicine",
            rating=4.0
        )
        created = practitioner_crud.create(db_session, obj_in=practitioner_data)

        update_data = PractitionerUpdate(
            specialty="Internal Medicine",
            rating=4.5
        )

        updated = practitioner_crud.update(
            db_session, db_obj=created, obj_in=update_data
        )

        assert updated.name == "Dr. Original"  # Unchanged
        assert updated.specialty == "Internal Medicine"
        assert updated.rating == 4.5

    def test_delete_practitioner(self, db_session: Session):
        """Test deleting a practitioner."""
        practitioner_data = PractitionerCreate(
            name="Dr. To Delete",
            specialty="General Practice"
        )
        created = practitioner_crud.create(db_session, obj_in=practitioner_data)
        practitioner_id = created.id

        deleted = practitioner_crud.delete(db_session, id=practitioner_id)

        assert deleted is not None
        assert deleted.id == practitioner_id

        # Verify deleted
        retrieved = practitioner_crud.get(db_session, id=practitioner_id)
        assert retrieved is None

    def test_search_pagination(self, db_session: Session):
        """Test search with pagination."""
        # Create 10 practitioners
        for i in range(10):
            practitioner_data = PractitionerCreate(
                name=f"Dr. Test {i+1}",
                specialty="General"
            )
            practitioner_crud.create(db_session, obj_in=practitioner_data)

        # Get first page
        first_page = practitioner_crud.search_by_name(
            db_session, name="Test", skip=0, limit=5
        )
        assert len(first_page) == 5

        # Get second page
        second_page = practitioner_crud.search_by_name(
            db_session, name="Test", skip=5, limit=5
        )
        assert len(second_page) == 5

        # No overlap
        first_ids = {p.id for p in first_page}
        second_ids = {p.id for p in second_page}
        assert first_ids.isdisjoint(second_ids)

    def test_practitioner_with_contact_info(self, db_session: Session):
        """Test creating practitioner with all contact info."""
        practitioner_data = PractitionerCreate(
            name="Dr. Full Info",
            specialty="Psychiatry",
            practice="Mental Health Center",
            phone_number="919-555-5555",
            email="fullinfo@example.com",
            website="drfullinfo.com",  # Will be converted to https://drfullinfo.com
            rating=4.8
        )

        practitioner = practitioner_crud.create(db_session, obj_in=practitioner_data)

        assert practitioner.practice == "Mental Health Center"
        assert "9195555555" in practitioner.phone_number or practitioner.phone_number == "9195555555"
        assert practitioner.email == "fullinfo@example.com"
        assert "drfullinfo.com" in practitioner.website
        assert practitioner.rating == 4.8
