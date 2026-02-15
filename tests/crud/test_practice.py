"""
Tests for Practice CRUD operations.
"""
import pytest
from sqlalchemy.orm import Session

from app.crud.practice import practice as practice_crud
from app.crud.practitioner import practitioner as practitioner_crud
from app.models.models import Practice
from app.schemas.practice import PracticeCreate, PracticeUpdate
from app.schemas.practitioner import PractitionerCreate


class TestPracticeCRUD:
    """Test Practice CRUD operations."""

    def test_create_practice(self, db_session: Session):
        """Test creating a practice."""
        practice_data = PracticeCreate(
            name="Durham Family Medicine",
            phone_number="919-555-1000",
            fax_number="919-555-1001",
            website="https://durhamfamily.com",
            patient_portal_url="https://portal.durhamfamily.com",
            notes="Accepting new patients",
        )

        result = practice_crud.create(db_session, obj_in=practice_data)

        assert result is not None
        assert result.name == "Durham Family Medicine"
        assert result.phone_number == "919-555-1000"
        assert result.fax_number == "919-555-1001"
        assert result.website == "https://durhamfamily.com"
        assert result.patient_portal_url == "https://portal.durhamfamily.com"
        assert result.notes == "Accepting new patients"
        assert result.id is not None
        assert result.created_at is not None
        assert result.updated_at is not None

    def test_create_practice_minimal(self, db_session: Session):
        """Test creating a practice with only required fields."""
        practice_data = PracticeCreate(name="Minimal Practice")

        result = practice_crud.create(db_session, obj_in=practice_data)

        assert result is not None
        assert result.name == "Minimal Practice"
        assert result.phone_number is None
        assert result.website is None

    def test_create_practice_with_locations(self, db_session: Session):
        """Test creating a practice with JSON locations."""
        practice_data = PracticeCreate(
            name="Multi-Location Clinic",
            locations=[
                {
                    "label": "Main Office",
                    "address": "123 Medical Dr",
                    "city": "Durham",
                    "state": "NC",
                    "zip": "27701",
                    "phone": "919-555-0100",
                },
                {
                    "label": "Branch Office",
                    "address": "456 Health Ave",
                    "city": "Raleigh",
                    "state": "NC",
                    "zip": "27601",
                },
            ],
        )

        result = practice_crud.create(db_session, obj_in=practice_data)

        assert result is not None
        assert result.locations is not None
        assert len(result.locations) == 2
        assert result.locations[0]["label"] == "Main Office"
        assert result.locations[1]["city"] == "Raleigh"

    def test_get_practice(self, db_session: Session):
        """Test getting a practice by ID."""
        practice_data = PracticeCreate(name="Get Test Practice")
        created = practice_crud.create(db_session, obj_in=practice_data)

        result = practice_crud.get(db_session, id=created.id)

        assert result is not None
        assert result.id == created.id
        assert result.name == "Get Test Practice"

    def test_get_practice_not_found(self, db_session: Session):
        """Test getting a non-existent practice."""
        result = practice_crud.get(db_session, id=99999)

        assert result is None

    def test_get_by_name(self, db_session: Session):
        """Test getting a practice by exact name match.

        Note: The query method lowercases filter values for case-insensitive matching.
        """
        practice_data = PracticeCreate(name="unique practice name")
        practice_crud.create(db_session, obj_in=practice_data)

        found = practice_crud.get_by_name(db_session, name="Unique Practice Name")

        assert found is not None
        assert found.name == "unique practice name"

    def test_get_by_name_not_found(self, db_session: Session):
        """Test getting non-existent practice by name."""
        found = practice_crud.get_by_name(db_session, name="Non-Existent Practice")

        assert found is None

    def test_search_by_name(self, db_session: Session):
        """Test searching practices by partial name match."""
        names = ["Heart Health Center", "Heart Clinic", "Brain Institute"]
        for name in names:
            practice_crud.create(
                db_session, obj_in=PracticeCreate(name=name)
            )

        results = practice_crud.search_by_name(db_session, name="Heart")

        assert len(results) == 2
        found_names = [r.name for r in results]
        assert "Heart Health Center" in found_names
        assert "Heart Clinic" in found_names

    def test_search_by_name_no_results(self, db_session: Session):
        """Test search with no matching results."""
        practice_crud.create(
            db_session, obj_in=PracticeCreate(name="Some Practice")
        )

        results = practice_crud.search_by_name(db_session, name="NonExistent")

        assert len(results) == 0

    def test_search_by_name_pagination(self, db_session: Session):
        """Test search with pagination."""
        for i in range(10):
            practice_crud.create(
                db_session,
                obj_in=PracticeCreate(name=f"Test Practice {i+1}"),
            )

        first_page = practice_crud.search_by_name(
            db_session, name="Test Practice", skip=0, limit=5
        )
        assert len(first_page) == 5

        second_page = practice_crud.search_by_name(
            db_session, name="Test Practice", skip=5, limit=5
        )
        assert len(second_page) == 5

        first_ids = {p.id for p in first_page}
        second_ids = {p.id for p in second_page}
        assert first_ids.isdisjoint(second_ids)

    def test_is_name_taken(self, db_session: Session):
        """Test checking if practice name is taken.

        Note: The query method lowercases filter values for matching.
        """
        practice_crud.create(
            db_session, obj_in=PracticeCreate(name="taken practice name")
        )

        assert practice_crud.is_name_taken(db_session, name="Taken Practice Name") is True
        assert practice_crud.is_name_taken(db_session, name="Available Name") is False

    def test_is_name_taken_with_exclude(self, db_session: Session):
        """Test is_name_taken excludes specific practice ID.

        Note: The query method lowercases filter values for matching.
        """
        created = practice_crud.create(
            db_session, obj_in=PracticeCreate(name="exclude test name")
        )

        # Should not be taken when excluding the same practice
        assert (
            practice_crud.is_name_taken(
                db_session, name="Exclude Test Name", exclude_id=created.id
            )
            is False
        )

        # Should be taken without exclusion
        assert practice_crud.is_name_taken(db_session, name="Exclude Test Name") is True

    def test_create_if_not_exists_creates(self, db_session: Session):
        """Test create_if_not_exists creates new practice."""
        practice_data = PracticeCreate(
            name="Brand New Practice",
            phone_number="919-555-9999",
        )

        result = practice_crud.create_if_not_exists(
            db_session, practice_data=practice_data
        )

        assert result is not None
        assert result.name == "Brand New Practice"
        assert result.phone_number == "919-555-9999"

    def test_create_if_not_exists_returns_existing(self, db_session: Session):
        """Test create_if_not_exists returns existing practice.

        Note: The query method lowercases filter values for matching.
        """
        initial_data = PracticeCreate(
            name="existing practice",
            phone_number="919-555-0001",
        )
        initial = practice_crud.create(db_session, obj_in=initial_data)

        second_data = PracticeCreate(
            name="existing practice",
            phone_number="919-555-9999",
        )
        second = practice_crud.create_if_not_exists(
            db_session, practice_data=second_data
        )

        assert second.id == initial.id
        assert second.phone_number == "919-555-0001"  # Original phone

    def test_update_practice(self, db_session: Session):
        """Test updating a practice."""
        practice_data = PracticeCreate(
            name="Original Name",
            phone_number="919-555-0000",
        )
        created = practice_crud.create(db_session, obj_in=practice_data)

        update_data = PracticeUpdate(
            name="Updated Name",
            phone_number="919-555-1111",
            website="https://updated.com",
        )
        updated = practice_crud.update(
            db_session, db_obj=created, obj_in=update_data
        )

        assert updated.name == "Updated Name"
        assert updated.phone_number == "919-555-1111"
        assert updated.website == "https://updated.com"

    def test_update_practice_partial(self, db_session: Session):
        """Test partial update preserves unchanged fields."""
        practice_data = PracticeCreate(
            name="Keep This Name",
            phone_number="919-555-0000",
            notes="Keep these notes",
        )
        created = practice_crud.create(db_session, obj_in=practice_data)

        update_data = PracticeUpdate(phone_number="919-555-1111")
        updated = practice_crud.update(
            db_session, db_obj=created, obj_in=update_data
        )

        assert updated.name == "Keep This Name"
        assert updated.phone_number == "919-555-1111"
        assert updated.notes == "Keep these notes"

    def test_delete_practice(self, db_session: Session):
        """Test deleting a practice."""
        practice_data = PracticeCreate(name="To Delete")
        created = practice_crud.create(db_session, obj_in=practice_data)
        practice_id = created.id

        deleted = practice_crud.delete(db_session, id=practice_id)

        assert deleted is not None
        assert deleted.id == practice_id

        retrieved = practice_crud.get(db_session, id=practice_id)
        assert retrieved is None

    def test_get_all_practices_summary(self, db_session: Session):
        """Test getting all practices for summary/dropdown."""
        for i in range(5):
            practice_crud.create(
                db_session,
                obj_in=PracticeCreate(name=f"Summary Practice {i+1}"),
            )

        results = practice_crud.get_all_practices_summary(db_session)

        assert len(results) == 5

    def test_get_all_practices_summary_pagination(self, db_session: Session):
        """Test summary with pagination."""
        for i in range(10):
            practice_crud.create(
                db_session,
                obj_in=PracticeCreate(name=f"Paginated Practice {i+1}"),
            )

        page1 = practice_crud.get_all_practices_summary(
            db_session, skip=0, limit=5
        )
        assert len(page1) == 5

        page2 = practice_crud.get_all_practices_summary(
            db_session, skip=5, limit=5
        )
        assert len(page2) == 5

    def test_get_practitioner_count(self, db_session: Session):
        """Test counting practitioners belonging to a practice."""
        practice_data = PracticeCreate(name="Counting Practice")
        practice_obj = practice_crud.create(db_session, obj_in=practice_data)

        # Create practitioners linked to this practice
        for i in range(3):
            practitioner_crud.create(
                db_session,
                obj_in=PractitionerCreate(
                    name=f"Dr. Count {i+1}",
                    specialty="General",
                    practice_id=practice_obj.id,
                ),
            )

        count = practice_crud.get_practitioner_count(db_session, practice_obj.id)
        assert count == 3

    def test_get_practitioner_count_zero(self, db_session: Session):
        """Test practitioner count for practice with no practitioners."""
        practice_data = PracticeCreate(name="Empty Practice")
        practice_obj = practice_crud.create(db_session, obj_in=practice_data)

        count = practice_crud.get_practitioner_count(db_session, practice_obj.id)
        assert count == 0

    def test_get_practitioner_count_nonexistent_practice(self, db_session: Session):
        """Test practitioner count for non-existent practice."""
        count = practice_crud.get_practitioner_count(db_session, 99999)
        assert count == 0

    def test_get_with_practitioners(self, db_session: Session):
        """Test getting practice with practitioners loaded."""
        practice_data = PracticeCreate(name="Full Practice")
        practice_obj = practice_crud.create(db_session, obj_in=practice_data)

        for i in range(2):
            practitioner_crud.create(
                db_session,
                obj_in=PractitionerCreate(
                    name=f"Dr. Full {i+1}",
                    specialty="General",
                    practice_id=practice_obj.id,
                ),
            )

        result = practice_crud.get_with_practitioners(db_session, practice_obj.id)

        assert result is not None
        assert result.name == "Full Practice"
        assert len(result.practitioners) == 2

    def test_get_with_practitioners_not_found(self, db_session: Session):
        """Test getting non-existent practice with practitioners."""
        result = practice_crud.get_with_practitioners(db_session, 99999)
        assert result is None
