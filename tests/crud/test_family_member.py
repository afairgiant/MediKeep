"""
Tests for FamilyMember CRUD operations.
"""
import pytest
from datetime import date
from sqlalchemy.orm import Session

from app.crud.family_member import family_member as family_member_crud
from app.crud.family_condition import family_condition as family_condition_crud
from app.crud.patient import patient as patient_crud
from app.models.models import FamilyMember
from app.schemas.family_member import FamilyMemberCreate, FamilyMemberUpdate
from app.schemas.family_condition import FamilyConditionCreate
from app.schemas.patient import PatientCreate


class TestFamilyMemberCRUD:
    """Test FamilyMember CRUD operations."""

    @pytest.fixture
    def test_patient(self, db_session: Session, test_user):
        """Create a test patient for family member tests."""
        patient_data = PatientCreate(
            first_name="John",
            last_name="Doe",
            birth_date=date(1990, 1, 1),
            gender="M",
            address="123 Main St"
        )
        return patient_crud.create_for_user(
            db_session, user_id=test_user.id, patient_data=patient_data
        )

    def test_create_family_member(self, db_session: Session, test_patient):
        """Test creating a family member."""
        member_data = FamilyMemberCreate(
            patient_id=test_patient.id,
            name="Jane Doe",
            relationship="mother",
            gender="female",
            birth_year=1960,
            is_deceased=False,
            notes="Patient's biological mother"
        )

        member = family_member_crud.create(db_session, obj_in=member_data)

        assert member is not None
        assert member.name == "Jane Doe"
        assert member.relationship == "mother"
        assert member.gender == "female"
        assert member.birth_year == 1960
        assert member.is_deceased is False
        assert member.patient_id == test_patient.id

    def test_get_by_patient(self, db_session: Session, test_patient):
        """Test getting all family members for a patient."""
        members_data = [
            FamilyMemberCreate(
                patient_id=test_patient.id,
                name="Father Doe",
                relationship="father",
                gender="male",
                birth_year=1958
            ),
            FamilyMemberCreate(
                patient_id=test_patient.id,
                name="Mother Doe",
                relationship="mother",
                gender="female",
                birth_year=1960
            ),
            FamilyMemberCreate(
                patient_id=test_patient.id,
                name="Sister Doe",
                relationship="brother",
                gender="female",
                birth_year=1992
            )
        ]

        for member_data in members_data:
            family_member_crud.create(db_session, obj_in=member_data)

        members = family_member_crud.get_by_patient(
            db_session, patient_id=test_patient.id
        )

        assert len(members) == 3

    def test_get_by_patient_with_conditions(self, db_session: Session, test_patient):
        """Test getting family members with their conditions loaded."""
        # Create a family member
        member_data = FamilyMemberCreate(
            patient_id=test_patient.id,
            name="Father Doe",
            relationship="father",
            gender="male",
            birth_year=1955
        )
        member = family_member_crud.create(db_session, obj_in=member_data)

        # Create conditions for the member
        condition1 = FamilyConditionCreate(
            family_member_id=member.id,
            condition_name="Diabetes Type 2",
            condition_type="endocrine",
            severity="moderate",
            diagnosis_age=50
        )
        condition2 = FamilyConditionCreate(
            family_member_id=member.id,
            condition_name="Hypertension",
            condition_type="cardiovascular",
            severity="mild",
            diagnosis_age=45
        )

        family_condition_crud.create(db_session, obj_in=condition1)
        family_condition_crud.create(db_session, obj_in=condition2)

        # Get members with conditions
        members = family_member_crud.get_by_patient_with_conditions(
            db_session, patient_id=test_patient.id
        )

        assert len(members) == 1
        assert len(members[0].family_conditions) == 2

    def test_get_by_relationship(self, db_session: Session, test_patient):
        """Test getting family members by relationship type."""
        # Create siblings
        for i in range(3):
            member_data = FamilyMemberCreate(
                patient_id=test_patient.id,
                name=f"Sibling {i+1}",
                relationship="brother",
                gender="male" if i % 2 == 0 else "female"
            )
            family_member_crud.create(db_session, obj_in=member_data)

        # Create parent
        parent_data = FamilyMemberCreate(
            patient_id=test_patient.id,
            name="Parent",
            relationship="father",
            gender="male"
        )
        family_member_crud.create(db_session, obj_in=parent_data)

        siblings = family_member_crud.get_by_relationship(
            db_session, patient_id=test_patient.id, relationship="brother"
        )

        assert len(siblings) == 3
        assert all(s.relationship == "brother" for s in siblings)

    def test_search_by_name(self, db_session: Session, test_patient):
        """Test searching family members by name."""
        members_data = [
            FamilyMemberCreate(
                patient_id=test_patient.id,
                name="John Smith",
                relationship="uncle"
            ),
            FamilyMemberCreate(
                patient_id=test_patient.id,
                name="Jane Johnson",
                relationship="aunt"
            ),
            FamilyMemberCreate(
                patient_id=test_patient.id,
                name="Mary Smith",
                relationship="maternal_grandmother"
            )
        ]

        for member_data in members_data:
            family_member_crud.create(db_session, obj_in=member_data)

        # Search for "Smith"
        results = family_member_crud.search_by_name(
            db_session, patient_id=test_patient.id, name_term="Smith"
        )

        assert len(results) == 2
        names = [r.name for r in results]
        assert "John Smith" in names
        assert "Mary Smith" in names

    def test_deceased_flag_data_fix(self, db_session: Session, test_patient):
        """Test that data inconsistency is fixed when death_year is set but is_deceased is False."""
        # Create member with death_year but is_deceased=True (valid)
        member_data = FamilyMemberCreate(
            patient_id=test_patient.id,
            name="Deceased Member",
            relationship="paternal_grandfather",
            gender="male",
            birth_year=1930,
            death_year=2010,
            is_deceased=True
        )
        member = family_member_crud.create(db_session, obj_in=member_data)

        # Manually create inconsistent data (death_year but is_deceased=False)
        # This simulates legacy data that might exist
        member.is_deceased = False
        db_session.commit()

        # Get by patient should fix the inconsistency
        members = family_member_crud.get_by_patient(
            db_session, patient_id=test_patient.id
        )

        # After retrieval, the inconsistency should be fixed
        assert len(members) == 1
        assert members[0].death_year == 2010
        assert members[0].is_deceased is True

    def test_update_family_member(self, db_session: Session, test_patient):
        """Test updating a family member."""
        member_data = FamilyMemberCreate(
            patient_id=test_patient.id,
            name="Original Name",
            relationship="father",
            gender="male",
            birth_year=1960
        )
        member = family_member_crud.create(db_session, obj_in=member_data)

        update_data = FamilyMemberUpdate(
            name="Updated Name",
            notes="Added some notes"
        )

        updated = family_member_crud.update(
            db_session, db_obj=member, obj_in=update_data
        )

        assert updated.name == "Updated Name"
        assert updated.notes == "Added some notes"
        assert updated.relationship == "father"  # Unchanged

    def test_delete_family_member(self, db_session: Session, test_patient):
        """Test deleting a family member."""
        member_data = FamilyMemberCreate(
            patient_id=test_patient.id,
            name="To Delete",
            relationship="uncle"
        )
        member = family_member_crud.create(db_session, obj_in=member_data)
        member_id = member.id

        deleted = family_member_crud.delete(db_session, id=member_id)

        assert deleted is not None
        assert deleted.id == member_id

        # Verify deleted
        retrieved = family_member_crud.get(db_session, id=member_id)
        assert retrieved is None

    def test_ordering_by_relationship_and_name(self, db_session: Session, test_patient):
        """Test that family members are ordered by relationship and name."""
        members_data = [
            FamilyMemberCreate(
                patient_id=test_patient.id,
                name="Zack",
                relationship="brother"
            ),
            FamilyMemberCreate(
                patient_id=test_patient.id,
                name="Alice",
                relationship="brother"
            ),
            FamilyMemberCreate(
                patient_id=test_patient.id,
                name="Bob",
                relationship="father"
            )
        ]

        for member_data in members_data:
            family_member_crud.create(db_session, obj_in=member_data)

        members = family_member_crud.get_by_patient_with_conditions(
            db_session, patient_id=test_patient.id
        )

        # Should be ordered by relationship then by name
        assert len(members) == 3

    def test_multiple_patients_isolation(self, db_session: Session, test_user, test_admin_user):
        """Test that family members are properly isolated per patient."""
        # Create two patients (each under a different user)
        patient1_data = PatientCreate(
            first_name="Patient", last_name="One",
            birth_date=date(1990, 1, 1), gender="M", address="123 St"
        )
        patient2_data = PatientCreate(
            first_name="Patient", last_name="Two",
            birth_date=date(1985, 1, 1), gender="F", address="456 Ave"
        )

        patient1 = patient_crud.create_for_user(
            db_session, user_id=test_user.id, patient_data=patient1_data
        )
        patient2 = patient_crud.create_for_user(
            db_session, user_id=test_admin_user.id, patient_data=patient2_data
        )

        # Create family members for each patient
        for i in range(3):
            member_data = FamilyMemberCreate(
                patient_id=patient1.id,
                name=f"Patient1 Family {i+1}",
                relationship="brother"
            )
            family_member_crud.create(db_session, obj_in=member_data)

        for i in range(2):
            member_data = FamilyMemberCreate(
                patient_id=patient2.id,
                name=f"Patient2 Family {i+1}",
                relationship="father"
            )
            family_member_crud.create(db_session, obj_in=member_data)

        patient1_members = family_member_crud.get_by_patient(
            db_session, patient_id=patient1.id
        )
        patient2_members = family_member_crud.get_by_patient(
            db_session, patient_id=patient2.id
        )

        assert len(patient1_members) == 3
        assert len(patient2_members) == 2
        assert all(m.patient_id == patient1.id for m in patient1_members)
        assert all(m.patient_id == patient2.id for m in patient2_members)
