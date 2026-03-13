"""
Tests for EncounterLabResult CRUD operations.
"""
import pytest
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.crud.encounter import encounter_lab_result
from app.crud.patient import patient as patient_crud
from app.models.models import Encounter, LabResult, EncounterLabResult
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user


class TestCRUDEncounterLabResult:
    """Tests for CRUDEncounterLabResult class."""

    @pytest.fixture
    def patient_with_data(self, db_session: Session):
        """Create a user, patient, encounter, and lab result."""
        user_data = create_random_user(db_session)
        patient = patient_crud.create_for_user(
            db_session,
            user_id=user_data["user"].id,
            patient_data=PatientCreate(
                first_name="Test",
                last_name="Patient",
                birth_date=date(1990, 1, 1),
                gender="M",
                address="123 Test St",
            ),
        )

        enc = Encounter(
            reason="Test visit",
            date=date.today() - timedelta(days=7),
            visit_type="routine",
            patient_id=patient.id,
        )
        db_session.add(enc)
        db_session.flush()

        lr = LabResult(
            test_name="CBC",
            test_code="CBC",
            ordered_date=date.today() - timedelta(days=7),
            status="completed",
            patient_id=patient.id,
        )
        db_session.add(lr)
        db_session.flush()

        lr2 = LabResult(
            test_name="CMP",
            test_code="CMP",
            ordered_date=date.today() - timedelta(days=5),
            status="pending",
            patient_id=patient.id,
        )
        db_session.add(lr2)
        db_session.commit()

        return {
            "patient": patient,
            "encounter": enc,
            "lab_result": lr,
            "lab_result2": lr2,
        }

    def test_create_relationship(self, db_session, patient_with_data):
        """Test creating a single relationship."""
        enc = patient_with_data["encounter"]
        lr = patient_with_data["lab_result"]

        obj = EncounterLabResult(
            encounter_id=enc.id,
            lab_result_id=lr.id,
            purpose="ordered_during",
            relevance_note="Ordered during routine visit",
        )
        db_session.add(obj)
        db_session.commit()
        db_session.refresh(obj)

        assert obj.id is not None
        assert obj.encounter_id == enc.id
        assert obj.lab_result_id == lr.id
        assert obj.purpose == "ordered_during"
        assert obj.relevance_note == "Ordered during routine visit"
        assert obj.created_at is not None

    def test_get_by_encounter(self, db_session, patient_with_data):
        """Test querying relationships by encounter."""
        enc = patient_with_data["encounter"]
        lr = patient_with_data["lab_result"]
        lr2 = patient_with_data["lab_result2"]

        # Create two relationships
        db_session.add(EncounterLabResult(encounter_id=enc.id, lab_result_id=lr.id))
        db_session.add(EncounterLabResult(encounter_id=enc.id, lab_result_id=lr2.id))
        db_session.commit()

        results = encounter_lab_result.get_by_encounter(db_session, encounter_id=enc.id)
        assert len(results) == 2
        lr_ids = {r.lab_result_id for r in results}
        assert lr.id in lr_ids
        assert lr2.id in lr_ids

    def test_get_by_lab_result(self, db_session, patient_with_data):
        """Test querying relationships by lab result."""
        enc = patient_with_data["encounter"]
        lr = patient_with_data["lab_result"]

        db_session.add(EncounterLabResult(encounter_id=enc.id, lab_result_id=lr.id))
        db_session.commit()

        results = encounter_lab_result.get_by_lab_result(db_session, lab_result_id=lr.id)
        assert len(results) == 1
        assert results[0].encounter_id == enc.id

    def test_get_by_encounter_and_lab_result(self, db_session, patient_with_data):
        """Test querying a specific encounter-lab result pair."""
        enc = patient_with_data["encounter"]
        lr = patient_with_data["lab_result"]

        db_session.add(EncounterLabResult(encounter_id=enc.id, lab_result_id=lr.id))
        db_session.commit()

        result = encounter_lab_result.get_by_encounter_and_lab_result(
            db_session, encounter_id=enc.id, lab_result_id=lr.id
        )
        assert result is not None
        assert result.encounter_id == enc.id

    def test_get_by_encounter_and_lab_result_not_found(self, db_session, patient_with_data):
        """Test querying nonexistent pair returns None."""
        result = encounter_lab_result.get_by_encounter_and_lab_result(
            db_session, encounter_id=99999, lab_result_id=99999
        )
        assert result is None

    def test_delete_by_encounter_and_lab_result(self, db_session, patient_with_data):
        """Test deleting a specific relationship by its pair."""
        enc = patient_with_data["encounter"]
        lr = patient_with_data["lab_result"]

        db_session.add(EncounterLabResult(encounter_id=enc.id, lab_result_id=lr.id))
        db_session.commit()

        deleted = encounter_lab_result.delete_by_encounter_and_lab_result(
            db_session, encounter_id=enc.id, lab_result_id=lr.id
        )
        assert deleted is True

        # Verify gone
        result = encounter_lab_result.get_by_encounter_and_lab_result(
            db_session, encounter_id=enc.id, lab_result_id=lr.id
        )
        assert result is None

    def test_delete_nonexistent_returns_false(self, db_session):
        """Test deleting nonexistent relationship returns False."""
        deleted = encounter_lab_result.delete_by_encounter_and_lab_result(
            db_session, encounter_id=99999, lab_result_id=99999
        )
        assert deleted is False

    def test_create_bulk(self, db_session, patient_with_data):
        """Test bulk creating relationships."""
        enc = patient_with_data["encounter"]
        lr = patient_with_data["lab_result"]
        lr2 = patient_with_data["lab_result2"]

        created = encounter_lab_result.create_bulk(
            db_session,
            encounter_id=enc.id,
            lab_result_ids=[lr.id, lr2.id],
            purpose="ordered_during",
            relevance_note="Bulk linked",
        )
        assert len(created) == 2
        assert all(c.purpose == "ordered_during" for c in created)
        assert all(c.relevance_note == "Bulk linked" for c in created)

    def test_create_bulk_skips_existing(self, db_session, patient_with_data):
        """Test bulk create skips already-existing relationships."""
        enc = patient_with_data["encounter"]
        lr = patient_with_data["lab_result"]
        lr2 = patient_with_data["lab_result2"]

        # Create one first
        db_session.add(EncounterLabResult(encounter_id=enc.id, lab_result_id=lr.id))
        db_session.commit()

        # Bulk create both - should only create the new one
        created = encounter_lab_result.create_bulk(
            db_session,
            encounter_id=enc.id,
            lab_result_ids=[lr.id, lr2.id],
        )
        assert len(created) == 1
        assert created[0].lab_result_id == lr2.id

    def test_create_bulk_empty_list(self, db_session, patient_with_data):
        """Test bulk create with empty list."""
        enc = patient_with_data["encounter"]
        created = encounter_lab_result.create_bulk(
            db_session,
            encounter_id=enc.id,
            lab_result_ids=[],
        )
        assert created == []

    def test_cascade_delete_encounter(self, db_session, patient_with_data):
        """Test that deleting encounter cascades to relationships."""
        enc = patient_with_data["encounter"]
        lr = patient_with_data["lab_result"]

        db_session.add(EncounterLabResult(encounter_id=enc.id, lab_result_id=lr.id))
        db_session.commit()

        # Delete encounter
        db_session.delete(enc)
        db_session.commit()

        # Relationship should be gone
        results = encounter_lab_result.get_by_lab_result(db_session, lab_result_id=lr.id)
        assert len(results) == 0

    def test_cascade_delete_lab_result(self, db_session, patient_with_data):
        """Test that deleting lab result cascades to relationships."""
        enc = patient_with_data["encounter"]
        lr = patient_with_data["lab_result"]

        db_session.add(EncounterLabResult(encounter_id=enc.id, lab_result_id=lr.id))
        db_session.commit()

        # Delete lab result
        db_session.delete(lr)
        db_session.commit()

        # Relationship should be gone
        results = encounter_lab_result.get_by_encounter(db_session, encounter_id=enc.id)
        assert len(results) == 0
