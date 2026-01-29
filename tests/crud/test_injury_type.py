"""
Tests for InjuryType CRUD operations.

Note: The InjuryTypeCreate schema doesn't allow setting is_system=True by design.
For tests that need to verify system type behavior, we create system types
directly using the model.
"""
import pytest
from sqlalchemy.orm import Session

from app.crud.injury_type import injury_type as injury_type_crud
from app.models.models import InjuryType
from app.schemas.injury_type import InjuryTypeCreate, InjuryTypeUpdate


def create_system_injury_type(db: Session, name: str, description: str = None) -> InjuryType:
    """Helper to create system injury types directly in the database."""
    injury_type = InjuryType(name=name, description=description, is_system=True)
    db.add(injury_type)
    db.commit()
    db.refresh(injury_type)
    return injury_type


class TestInjuryTypeCRUD:
    """Test InjuryType CRUD operations."""

    def test_create_injury_type(self, db_session: Session):
        """Test creating an injury type."""
        injury_type_data = InjuryTypeCreate(
            name="Sprain",
            description="Ligament injury from stretching"
        )

        injury_type = injury_type_crud.create(db_session, obj_in=injury_type_data)

        assert injury_type is not None
        assert injury_type.name == "Sprain"
        assert injury_type.description == "Ligament injury from stretching"
        assert injury_type.is_system is False  # Default for user-created types

    def test_get_all(self, db_session: Session):
        """Test getting all injury types."""
        # Create system types directly (schema doesn't allow is_system=True)
        create_system_injury_type(db_session, "Fracture")
        create_system_injury_type(db_session, "Laceration")

        # Create user type via schema
        user_type = InjuryTypeCreate(name="Custom Injury")
        injury_type_crud.create(db_session, obj_in=user_type)

        all_types = injury_type_crud.get_all(db_session)

        assert len(all_types) >= 3  # May have existing types
        # Should be ordered by name
        names = [t.name for t in all_types]
        assert names == sorted(names)

    def test_get_by_name(self, db_session: Session):
        """Test getting an injury type by name."""
        # Create system type directly
        create_system_injury_type(db_session, "Burn")

        found = injury_type_crud.get_by_name(db_session, name="Burn")

        assert found is not None
        assert found.name == "Burn"

    def test_get_by_name_case_insensitive(self, db_session: Session):
        """Test that get_by_name is case insensitive."""
        # Create system type directly
        create_system_injury_type(db_session, "Contusion")

        # Search with different cases
        found_lower = injury_type_crud.get_by_name(db_session, name="contusion")
        found_upper = injury_type_crud.get_by_name(db_session, name="CONTUSION")

        assert found_lower is not None
        assert found_upper is not None
        assert found_lower.id == found_upper.id

    def test_get_by_name_not_found(self, db_session: Session):
        """Test getting non-existent injury type by name."""
        found = injury_type_crud.get_by_name(db_session, name="Non-existent Type")

        assert found is None

    def test_get_system_types(self, db_session: Session):
        """Test getting only system-defined injury types."""
        # Create system types directly (schema doesn't allow is_system=True)
        create_system_injury_type(db_session, "System Type 1")
        create_system_injury_type(db_session, "System Type 2")

        # Create user type via schema
        user_type = InjuryTypeCreate(name="User Type")
        injury_type_crud.create(db_session, obj_in=user_type)

        system_types = injury_type_crud.get_system_types(db_session)

        assert len(system_types) >= 2
        assert all(t.is_system is True for t in system_types)

    def test_get_user_types(self, db_session: Session):
        """Test getting only user-created injury types."""
        # Create system type directly
        create_system_injury_type(db_session, "System Test Type")

        # Create user types via schema
        user_types_data = [
            InjuryTypeCreate(name="User Test Type 1"),
            InjuryTypeCreate(name="User Test Type 2")
        ]
        for it_data in user_types_data:
            injury_type_crud.create(db_session, obj_in=it_data)

        user_types = injury_type_crud.get_user_types(db_session)

        assert len(user_types) >= 2
        assert all(t.is_system is False for t in user_types)

    def test_is_deletable_user_type(self, db_session: Session):
        """Test that user-created types are deletable."""
        injury_type_data = InjuryTypeCreate(name="Deletable Type")
        created = injury_type_crud.create(db_session, obj_in=injury_type_data)

        assert injury_type_crud.is_deletable(
            db_session, injury_type_id=created.id
        ) is True

    def test_is_deletable_system_type(self, db_session: Session):
        """Test that system types are not deletable."""
        # Create system type directly (schema doesn't allow is_system=True)
        created = create_system_injury_type(db_session, "Non-Deletable System Type")

        assert injury_type_crud.is_deletable(
            db_session, injury_type_id=created.id
        ) is False

    def test_is_deletable_nonexistent(self, db_session: Session):
        """Test is_deletable for non-existent ID."""
        assert injury_type_crud.is_deletable(
            db_session, injury_type_id=99999
        ) is False

    def test_update_injury_type(self, db_session: Session):
        """Test updating an injury type."""
        injury_type_data = InjuryTypeCreate(
            name="Original Name",
            description="Original description"
        )
        created = injury_type_crud.create(db_session, obj_in=injury_type_data)

        update_data = InjuryTypeUpdate(
            description="Updated description"
        )

        updated = injury_type_crud.update(
            db_session, db_obj=created, obj_in=update_data
        )

        assert updated.name == "Original Name"  # Unchanged
        assert updated.description == "Updated description"

    def test_delete_user_injury_type(self, db_session: Session):
        """Test deleting a user-created injury type."""
        injury_type_data = InjuryTypeCreate(name="To Delete User Type")
        created = injury_type_crud.create(db_session, obj_in=injury_type_data)
        type_id = created.id

        # Verify it's deletable
        assert injury_type_crud.is_deletable(db_session, injury_type_id=type_id) is True

        deleted = injury_type_crud.delete(db_session, id=type_id)

        assert deleted is not None
        assert deleted.id == type_id

        # Verify deleted
        retrieved = injury_type_crud.get(db_session, id=type_id)
        assert retrieved is None

    def test_ordering_by_name(self, db_session: Session):
        """Test that injury types are ordered alphabetically by name."""
        # Create types in non-alphabetical order
        injury_types_data = [
            InjuryTypeCreate(name="Zebra Injury"),
            InjuryTypeCreate(name="Alpha Injury"),
            InjuryTypeCreate(name="Beta Injury")
        ]

        for it_data in injury_types_data:
            injury_type_crud.create(db_session, obj_in=it_data)

        all_types = injury_type_crud.get_all(db_session)
        names = [t.name for t in all_types]

        # Should be alphabetically ordered
        assert names == sorted(names)

    def test_create_duplicate_name(self, db_session: Session):
        """Test behavior when creating duplicate name."""
        injury_type_data = InjuryTypeCreate(name="Unique Injury Type Name")
        injury_type_crud.create(db_session, obj_in=injury_type_data)

        # Check if it exists
        existing = injury_type_crud.get_by_name(
            db_session, name="Unique Injury Type Name"
        )
        assert existing is not None

    def test_injury_type_with_description(self, db_session: Session):
        """Test creating injury type with full description."""
        # Create system type with description directly
        injury_type = create_system_injury_type(
            db_session,
            "Detailed Injury",
            "A detailed description of this injury type including causes and symptoms"
        )

        assert injury_type.description is not None
        assert "detailed description" in injury_type.description.lower()
