"""
Tests for FamilyCondition CRUD operations.
"""
import pytest
from datetime import date
from sqlalchemy.orm import Session

from app.crud.family_condition import family_condition as family_condition_crud
from app.crud.family_member import family_member as family_member_crud
from app.crud.patient import patient as patient_crud
from app.models.models import FamilyCondition
from app.schemas.family_condition import FamilyConditionCreate, FamilyConditionUpdate
from app.schemas.family_member import FamilyMemberCreate
from app.schemas.patient import PatientCreate


class TestFamilyConditionCRUD:
    """Test FamilyCondition CRUD operations."""

    @pytest.fixture
    def test_patient(self, db_session: Session, test_user):
        """Create a test patient."""
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

    @pytest.fixture
    def test_family_member(self, db_session: Session, test_patient):
        """Create a test family member."""
        member_data = FamilyMemberCreate(
            patient_id=test_patient.id,
            name="Father Doe",
            relationship="father",
            gender="male",
            birth_year=1955
        )
        return family_member_crud.create(db_session, obj_in=member_data)

    def test_create_family_condition(self, db_session: Session, test_family_member):
        """Test creating a family condition."""
        condition_data = FamilyConditionCreate(
            family_member_id=test_family_member.id,
            condition_name="Diabetes Type 2",
            condition_type="endocrine",
            severity="moderate",
            diagnosis_age=50,
            status="active",
            notes="Managed with diet and medication"
        )

        condition = family_condition_crud.create(db_session, obj_in=condition_data)

        assert condition is not None
        assert condition.condition_name == "Diabetes Type 2"
        assert condition.condition_type == "endocrine"
        assert condition.severity == "moderate"
        assert condition.diagnosis_age == 50
        assert condition.family_member_id == test_family_member.id

    def test_get_by_family_member(self, db_session: Session, test_family_member):
        """Test getting all conditions for a family member."""
        conditions_data = [
            FamilyConditionCreate(
                family_member_id=test_family_member.id,
                condition_name="Diabetes",
                condition_type="endocrine",
                severity="moderate"
            ),
            FamilyConditionCreate(
                family_member_id=test_family_member.id,
                condition_name="Heart Disease",
                condition_type="cardiovascular",
                severity="severe"
            ),
            FamilyConditionCreate(
                family_member_id=test_family_member.id,
                condition_name="Arthritis",
                condition_type="other",
                severity="mild"
            )
        ]

        for cond_data in conditions_data:
            family_condition_crud.create(db_session, obj_in=cond_data)

        conditions = family_condition_crud.get_by_family_member(
            db_session, family_member_id=test_family_member.id
        )

        assert len(conditions) == 3

    def test_get_by_condition_type(self, db_session: Session, test_family_member):
        """Test getting conditions by type."""
        # Create conditions of different types
        conditions_data = [
            FamilyConditionCreate(
                family_member_id=test_family_member.id,
                condition_name="Coronary Artery Disease",
                condition_type="cardiovascular"
            ),
            FamilyConditionCreate(
                family_member_id=test_family_member.id,
                condition_name="Diabetes",
                condition_type="endocrine"
            ),
            FamilyConditionCreate(
                family_member_id=test_family_member.id,
                condition_name="Hypertension",
                condition_type="cardiovascular"
            )
        ]

        for cond_data in conditions_data:
            family_condition_crud.create(db_session, obj_in=cond_data)

        cardiovascular = family_condition_crud.get_by_condition_type(
            db_session, family_member_id=test_family_member.id, condition_type="cardiovascular"
        )

        assert len(cardiovascular) == 2
        assert all(c.condition_type == "cardiovascular" for c in cardiovascular)

    def test_get_by_severity(self, db_session: Session, test_family_member):
        """Test getting conditions by severity."""
        conditions_data = [
            FamilyConditionCreate(
                family_member_id=test_family_member.id,
                condition_name="Condition 1",
                severity="mild"
            ),
            FamilyConditionCreate(
                family_member_id=test_family_member.id,
                condition_name="Condition 2",
                severity="severe"
            ),
            FamilyConditionCreate(
                family_member_id=test_family_member.id,
                condition_name="Condition 3",
                severity="mild"
            )
        ]

        for cond_data in conditions_data:
            family_condition_crud.create(db_session, obj_in=cond_data)

        mild_conditions = family_condition_crud.get_by_severity(
            db_session, family_member_id=test_family_member.id, severity="mild"
        )

        assert len(mild_conditions) == 2
        assert all(c.severity == "mild" for c in mild_conditions)

    def test_search_by_condition_name(self, db_session: Session, test_family_member):
        """Test searching conditions by name."""
        conditions_data = [
            FamilyConditionCreate(
                family_member_id=test_family_member.id,
                condition_name="Diabetes Type 1"
            ),
            FamilyConditionCreate(
                family_member_id=test_family_member.id,
                condition_name="Diabetes Type 2"
            ),
            FamilyConditionCreate(
                family_member_id=test_family_member.id,
                condition_name="Heart Disease"
            )
        ]

        for cond_data in conditions_data:
            family_condition_crud.create(db_session, obj_in=cond_data)

        results = family_condition_crud.search_by_condition_name(
            db_session, family_member_id=test_family_member.id, condition_term="Diabetes"
        )

        assert len(results) == 2
        assert all("Diabetes" in r.condition_name for r in results)

    def test_get_by_patient_and_condition_type(self, db_session: Session, test_patient):
        """Test getting conditions of a type across all family members."""
        # Create multiple family members
        father_data = FamilyMemberCreate(
            patient_id=test_patient.id,
            name="Father",
            relationship="father"
        )
        mother_data = FamilyMemberCreate(
            patient_id=test_patient.id,
            name="Mother",
            relationship="mother"
        )

        father = family_member_crud.create(db_session, obj_in=father_data)
        mother = family_member_crud.create(db_session, obj_in=mother_data)

        # Create cardiovascular conditions for both
        conditions_data = [
            FamilyConditionCreate(
                family_member_id=father.id,
                condition_name="Heart Attack",
                condition_type="cardiovascular",
                diagnosis_age=55
            ),
            FamilyConditionCreate(
                family_member_id=mother.id,
                condition_name="Hypertension",
                condition_type="cardiovascular",
                diagnosis_age=50
            ),
            FamilyConditionCreate(
                family_member_id=father.id,
                condition_name="Diabetes",
                condition_type="endocrine"
            )
        ]

        for cond_data in conditions_data:
            family_condition_crud.create(db_session, obj_in=cond_data)

        # Get all cardiovascular conditions across family
        cardiovascular = family_condition_crud.get_by_patient_and_condition_type(
            db_session, patient_id=test_patient.id, condition_type="cardiovascular"
        )

        assert len(cardiovascular) == 2
        condition_names = [c.condition_name for c in cardiovascular]
        assert "Heart Attack" in condition_names
        assert "Hypertension" in condition_names

    def test_update_family_condition(self, db_session: Session, test_family_member):
        """Test updating a family condition."""
        condition_data = FamilyConditionCreate(
            family_member_id=test_family_member.id,
            condition_name="Original Condition",
            severity="mild",
            status="active"
        )
        condition = family_condition_crud.create(db_session, obj_in=condition_data)

        update_data = FamilyConditionUpdate(
            severity="moderate",
            notes="Condition worsened"
        )

        updated = family_condition_crud.update(
            db_session, db_obj=condition, obj_in=update_data
        )

        assert updated.severity == "moderate"
        assert updated.notes == "Condition worsened"
        assert updated.condition_name == "Original Condition"  # Unchanged

    def test_delete_family_condition(self, db_session: Session, test_family_member):
        """Test deleting a family condition."""
        condition_data = FamilyConditionCreate(
            family_member_id=test_family_member.id,
            condition_name="To Delete"
        )
        condition = family_condition_crud.create(db_session, obj_in=condition_data)
        condition_id = condition.id

        deleted = family_condition_crud.delete(db_session, id=condition_id)

        assert deleted is not None
        assert deleted.id == condition_id

        # Verify deleted
        retrieved = family_condition_crud.get(db_session, id=condition_id)
        assert retrieved is None

    def test_condition_with_icd10_code(self, db_session: Session, test_family_member):
        """Test creating condition with ICD-10 code."""
        condition_data = FamilyConditionCreate(
            family_member_id=test_family_member.id,
            condition_name="Type 2 Diabetes Mellitus",
            condition_type="endocrine",
            icd10_code="E11.9"
        )

        condition = family_condition_crud.create(db_session, obj_in=condition_data)

        assert condition.icd10_code == "E11.9"

    def test_ordering_by_condition_name(self, db_session: Session, test_family_member):
        """Test that conditions are ordered by name."""
        conditions_data = [
            FamilyConditionCreate(
                family_member_id=test_family_member.id,
                condition_name="Zebra Syndrome"
            ),
            FamilyConditionCreate(
                family_member_id=test_family_member.id,
                condition_name="Alpha Disease"
            ),
            FamilyConditionCreate(
                family_member_id=test_family_member.id,
                condition_name="Beta Condition"
            )
        ]

        for cond_data in conditions_data:
            family_condition_crud.create(db_session, obj_in=cond_data)

        conditions = family_condition_crud.get_by_family_member(
            db_session, family_member_id=test_family_member.id
        )

        # Should be alphabetically ordered
        assert conditions[0].condition_name == "Alpha Disease"
        assert conditions[1].condition_name == "Beta Condition"
        assert conditions[2].condition_name == "Zebra Syndrome"

    def test_multiple_members_isolation(self, db_session: Session, test_patient):
        """Test that conditions are properly isolated per family member."""
        # Create two family members
        member1_data = FamilyMemberCreate(
            patient_id=test_patient.id,
            name="Member 1",
            relationship="father"
        )
        member2_data = FamilyMemberCreate(
            patient_id=test_patient.id,
            name="Member 2",
            relationship="mother"
        )

        member1 = family_member_crud.create(db_session, obj_in=member1_data)
        member2 = family_member_crud.create(db_session, obj_in=member2_data)

        # Create conditions for each member
        for i in range(3):
            cond_data = FamilyConditionCreate(
                family_member_id=member1.id,
                condition_name=f"Member1 Condition {i+1}"
            )
            family_condition_crud.create(db_session, obj_in=cond_data)

        for i in range(2):
            cond_data = FamilyConditionCreate(
                family_member_id=member2.id,
                condition_name=f"Member2 Condition {i+1}"
            )
            family_condition_crud.create(db_session, obj_in=cond_data)

        member1_conditions = family_condition_crud.get_by_family_member(
            db_session, family_member_id=member1.id
        )
        member2_conditions = family_condition_crud.get_by_family_member(
            db_session, family_member_id=member2.id
        )

        assert len(member1_conditions) == 3
        assert len(member2_conditions) == 2
        assert all(c.family_member_id == member1.id for c in member1_conditions)
        assert all(c.family_member_id == member2.id for c in member2_conditions)
