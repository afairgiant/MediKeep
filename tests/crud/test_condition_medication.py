"""
Tests for CRUDConditionMedication operations added in commit 3e0dcd3.
"""
import pytest
from datetime import date
from sqlalchemy.orm import Session

from app.crud.condition import condition as condition_crud, condition_medication
from app.crud.medication import medication as medication_crud
from app.crud.patient import patient as patient_crud
from app.schemas.condition import (
    ConditionCreate,
    ConditionMedicationCreate,
    ConditionMedicationBulkCreate,
    ConditionMedicationUpdate,
)
from app.schemas.medication import MedicationCreate
from app.schemas.patient import PatientCreate


class TestCRUDConditionMedication:
    """Tests for the CRUDConditionMedication class."""

    @pytest.fixture
    def test_patient(self, db_session: Session, test_user):
        """Create a test patient."""
        patient_data = PatientCreate(
            first_name="Jane",
            last_name="Smith",
            birth_date=date(1985, 6, 15),
            gender="F",
            address="456 Elm St",
        )
        patient = patient_crud.create_for_user(
            db_session, user_id=test_user.id, patient_data=patient_data
        )
        test_user.active_patient_id = patient.id
        db_session.commit()
        db_session.refresh(test_user)
        return patient

    @pytest.fixture
    def test_condition(self, db_session: Session, test_patient):
        """Create a test condition."""
        condition_data = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Hypertension",
            status="active",
            severity="moderate",
        )
        return condition_crud.create(db_session, obj_in=condition_data)

    @pytest.fixture
    def test_medication(self, db_session: Session, test_patient):
        """Create a test medication."""
        medication_data = MedicationCreate(
            patient_id=test_patient.id,
            medication_name="Lisinopril",
            dosage="10mg",
            frequency="once daily",
            status="active",
        )
        return medication_crud.create(db_session, obj_in=medication_data)

    @pytest.fixture
    def second_medication(self, db_session: Session, test_patient):
        """Create a second test medication."""
        medication_data = MedicationCreate(
            patient_id=test_patient.id,
            medication_name="Amlodipine",
            dosage="5mg",
            frequency="once daily",
            status="active",
        )
        return medication_crud.create(db_session, obj_in=medication_data)

    @pytest.fixture
    def second_condition(self, db_session: Session, test_patient):
        """Create a second test condition."""
        condition_data = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Type 2 Diabetes",
            status="active",
            severity="mild",
        )
        return condition_crud.create(db_session, obj_in=condition_data)

    # --- create ---

    def test_create_relationship(self, db_session: Session, test_condition, test_medication):
        """Test creating a condition-medication relationship."""
        create_data = ConditionMedicationCreate(
            medication_id=test_medication.id,
            condition_id=test_condition.id,
            relevance_note="Used to treat hypertension",
        )

        rel = condition_medication.create(db_session, obj_in=create_data)

        assert rel is not None
        assert rel.condition_id == test_condition.id
        assert rel.medication_id == test_medication.id
        assert rel.relevance_note == "Used to treat hypertension"
        assert rel.id is not None

    def test_create_relationship_without_note(self, db_session: Session, test_condition, test_medication):
        """Test creating a relationship with no relevance note."""
        create_data = ConditionMedicationCreate(
            medication_id=test_medication.id,
            condition_id=test_condition.id,
        )

        rel = condition_medication.create(db_session, obj_in=create_data)

        assert rel is not None
        assert rel.relevance_note is None

    # --- get_by_condition ---

    def test_get_by_condition_returns_relationships(self, db_session: Session, test_condition, test_medication, second_medication):
        """Test get_by_condition returns all relationships for a condition."""
        condition_medication.create(
            db_session,
            obj_in=ConditionMedicationCreate(
                medication_id=test_medication.id,
                condition_id=test_condition.id,
            ),
        )
        condition_medication.create(
            db_session,
            obj_in=ConditionMedicationCreate(
                medication_id=second_medication.id,
                condition_id=test_condition.id,
            ),
        )

        rels = condition_medication.get_by_condition(db_session, condition_id=test_condition.id)

        assert len(rels) == 2
        medication_ids = {r.medication_id for r in rels}
        assert test_medication.id in medication_ids
        assert second_medication.id in medication_ids

    def test_get_by_condition_returns_empty_when_none(self, db_session: Session, test_condition):
        """Test get_by_condition returns empty list when no relationships exist."""
        rels = condition_medication.get_by_condition(db_session, condition_id=test_condition.id)
        assert rels == []

    # --- get_by_medication ---

    def test_get_by_medication_returns_relationships(self, db_session: Session, test_condition, second_condition, test_medication):
        """Test get_by_medication returns all relationships for a medication."""
        condition_medication.create(
            db_session,
            obj_in=ConditionMedicationCreate(
                medication_id=test_medication.id,
                condition_id=test_condition.id,
            ),
        )
        condition_medication.create(
            db_session,
            obj_in=ConditionMedicationCreate(
                medication_id=test_medication.id,
                condition_id=second_condition.id,
            ),
        )

        rels = condition_medication.get_by_medication(db_session, medication_id=test_medication.id)

        assert len(rels) == 2
        condition_ids = {r.condition_id for r in rels}
        assert test_condition.id in condition_ids
        assert second_condition.id in condition_ids

    def test_get_by_medication_returns_empty_when_none(self, db_session: Session, test_medication):
        """Test get_by_medication returns empty list when no relationships exist."""
        rels = condition_medication.get_by_medication(db_session, medication_id=test_medication.id)
        assert rels == []

    # --- get_by_condition_and_medication ---

    def test_get_by_condition_and_medication_found(self, db_session: Session, test_condition, test_medication):
        """Test get_by_condition_and_medication returns the relationship when it exists."""
        condition_medication.create(
            db_session,
            obj_in=ConditionMedicationCreate(
                medication_id=test_medication.id,
                condition_id=test_condition.id,
                relevance_note="Primary treatment",
            ),
        )

        rel = condition_medication.get_by_condition_and_medication(
            db_session,
            condition_id=test_condition.id,
            medication_id=test_medication.id,
        )

        assert rel is not None
        assert rel.condition_id == test_condition.id
        assert rel.medication_id == test_medication.id
        assert rel.relevance_note == "Primary treatment"

    def test_get_by_condition_and_medication_not_found(self, db_session: Session, test_condition, test_medication):
        """Test get_by_condition_and_medication returns None when no relationship exists."""
        rel = condition_medication.get_by_condition_and_medication(
            db_session,
            condition_id=test_condition.id,
            medication_id=test_medication.id,
        )
        assert rel is None

    # --- delete ---

    def test_delete_relationship(self, db_session: Session, test_condition, test_medication):
        """Test deleting a condition-medication relationship."""
        rel = condition_medication.create(
            db_session,
            obj_in=ConditionMedicationCreate(
                medication_id=test_medication.id,
                condition_id=test_condition.id,
            ),
        )
        rel_id = rel.id

        condition_medication.delete(db_session, id=rel_id)

        # Verify it's gone
        fetched = condition_medication.get(db_session, id=rel_id)
        assert fetched is None

    # --- delete_by_condition_and_medication ---

    def test_delete_by_condition_and_medication_success(self, db_session: Session, test_condition, test_medication):
        """Test delete_by_condition_and_medication removes the relationship."""
        condition_medication.create(
            db_session,
            obj_in=ConditionMedicationCreate(
                medication_id=test_medication.id,
                condition_id=test_condition.id,
            ),
        )

        result = condition_medication.delete_by_condition_and_medication(
            db_session,
            condition_id=test_condition.id,
            medication_id=test_medication.id,
        )

        assert result is True
        rel = condition_medication.get_by_condition_and_medication(
            db_session,
            condition_id=test_condition.id,
            medication_id=test_medication.id,
        )
        assert rel is None

    def test_delete_by_condition_and_medication_not_found(self, db_session: Session, test_condition, test_medication):
        """Test delete_by_condition_and_medication returns False when no relationship exists."""
        result = condition_medication.delete_by_condition_and_medication(
            db_session,
            condition_id=test_condition.id,
            medication_id=test_medication.id,
        )
        assert result is False

    # --- update ---

    def test_update_relevance_note(self, db_session: Session, test_condition, test_medication):
        """Test updating the relevance note of a relationship."""
        rel = condition_medication.create(
            db_session,
            obj_in=ConditionMedicationCreate(
                medication_id=test_medication.id,
                condition_id=test_condition.id,
                relevance_note="Original note",
            ),
        )

        updated = condition_medication.update(
            db_session,
            db_obj=rel,
            obj_in=ConditionMedicationUpdate(relevance_note="Updated note"),
        )

        assert updated.relevance_note == "Updated note"
        assert updated.id == rel.id

    # --- create_bulk ---

    def test_create_bulk_creates_all_new(self, db_session: Session, test_condition, test_medication, second_medication):
        """Test create_bulk creates all relationships when none exist."""
        bulk_data = ConditionMedicationBulkCreate(
            medication_ids=[test_medication.id, second_medication.id],
            relevance_note="Bulk linked",
        )

        created, skipped = condition_medication.create_bulk(
            db_session,
            condition_id=test_condition.id,
            bulk_data=bulk_data,
        )

        assert len(created) == 2
        assert len(skipped) == 0
        medication_ids = {r.medication_id for r in created}
        assert test_medication.id in medication_ids
        assert second_medication.id in medication_ids
        for rel in created:
            assert rel.relevance_note == "Bulk linked"

    def test_create_bulk_skips_existing(self, db_session: Session, test_condition, test_medication, second_medication):
        """Test create_bulk skips already-linked medications."""
        # Pre-create one relationship
        condition_medication.create(
            db_session,
            obj_in=ConditionMedicationCreate(
                medication_id=test_medication.id,
                condition_id=test_condition.id,
            ),
        )

        bulk_data = ConditionMedicationBulkCreate(
            medication_ids=[test_medication.id, second_medication.id],
        )

        created, skipped = condition_medication.create_bulk(
            db_session,
            condition_id=test_condition.id,
            bulk_data=bulk_data,
        )

        assert len(created) == 1
        assert len(skipped) == 1
        assert skipped[0] == test_medication.id
        assert created[0].medication_id == second_medication.id

    def test_create_bulk_all_skipped(self, db_session: Session, test_condition, test_medication):
        """Test create_bulk when all medications are already linked."""
        condition_medication.create(
            db_session,
            obj_in=ConditionMedicationCreate(
                medication_id=test_medication.id,
                condition_id=test_condition.id,
            ),
        )

        bulk_data = ConditionMedicationBulkCreate(
            medication_ids=[test_medication.id],
        )

        created, skipped = condition_medication.create_bulk(
            db_session,
            condition_id=test_condition.id,
            bulk_data=bulk_data,
        )

        assert len(created) == 0
        assert len(skipped) == 1

    # --- isolation: relationships don't bleed across conditions ---

    def test_relationships_isolated_by_condition(self, db_session: Session, test_condition, second_condition, test_medication):
        """Test that relationships are isolated per condition."""
        condition_medication.create(
            db_session,
            obj_in=ConditionMedicationCreate(
                medication_id=test_medication.id,
                condition_id=test_condition.id,
            ),
        )

        rels_for_condition1 = condition_medication.get_by_condition(
            db_session, condition_id=test_condition.id
        )
        rels_for_condition2 = condition_medication.get_by_condition(
            db_session, condition_id=second_condition.id
        )

        assert len(rels_for_condition1) == 1
        assert len(rels_for_condition2) == 0
