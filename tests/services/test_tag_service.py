"""
Tests for TagService - verifying exact tag matching behavior.
"""
import pytest
from datetime import date
from sqlalchemy.orm import Session

from app.services.tag_service import tag_service
from app.crud.medication import medication as medication_crud
from app.crud.patient import patient as patient_crud
from app.models.models import Medication
from app.schemas.medication import MedicationCreate
from app.schemas.patient import PatientCreate


class TestTagServiceExactMatching:
    """Test TagService operations with focus on exact tag matching."""

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
    def medications_with_similar_tags(self, db_session: Session, test_patient):
        """Create medications with similar but distinct tags."""
        # Create medication with tag 'diabetes'
        med1 = medication_crud.create(
            db_session,
            obj_in=MedicationCreate(
                patient_id=test_patient.id,
                medication_name="Insulin",
                dosage="10 units",
                frequency="daily",
                route="injection",
                effective_period_start=date(2024, 1, 1),
                status="active",
                tags=["diabetes"]
            )
        )

        # Create medication with tag 'pre-diabetes'
        med2 = medication_crud.create(
            db_session,
            obj_in=MedicationCreate(
                patient_id=test_patient.id,
                medication_name="Metformin",
                dosage="500mg",
                frequency="twice daily",
                route="oral",
                effective_period_start=date(2024, 1, 1),
                status="active",
                tags=["pre-diabetes"]
            )
        )

        # Create medication with tag 'diabetes-type2'
        med3 = medication_crud.create(
            db_session,
            obj_in=MedicationCreate(
                patient_id=test_patient.id,
                medication_name="Glipizide",
                dosage="5mg",
                frequency="daily",
                route="oral",
                effective_period_start=date(2024, 1, 1),
                status="active",
                tags=["diabetes-type2"]
            )
        )

        db_session.commit()
        return {"diabetes": med1, "pre-diabetes": med2, "diabetes-type2": med3}

    def test_rename_tag_exact_match_only(
        self, db_session: Session, medications_with_similar_tags
    ):
        """Test that renaming 'diabetes' doesn't affect 'pre-diabetes' or 'diabetes-type2'."""
        # Rename only 'diabetes' tag
        updated_count = tag_service.rename_tag_across_entities(
            db_session, old_tag="diabetes", new_tag="type1-diabetes"
        )

        # Should update only 1 record
        assert updated_count == 1

        # Verify the medications
        db_session.refresh(medications_with_similar_tags["diabetes"])
        db_session.refresh(medications_with_similar_tags["pre-diabetes"])
        db_session.refresh(medications_with_similar_tags["diabetes-type2"])

        # Only 'diabetes' should be renamed to 'type1-diabetes'
        assert "type1-diabetes" in medications_with_similar_tags["diabetes"].tags
        assert "diabetes" not in medications_with_similar_tags["diabetes"].tags

        # Others should remain unchanged
        assert medications_with_similar_tags["pre-diabetes"].tags == ["pre-diabetes"]
        assert medications_with_similar_tags["diabetes-type2"].tags == ["diabetes-type2"]

    def test_delete_tag_exact_match_only(
        self, db_session: Session, medications_with_similar_tags
    ):
        """Test that deleting 'diabetes' doesn't affect 'pre-diabetes' or 'diabetes-type2'."""
        # Delete only 'diabetes' tag
        updated_count = tag_service.delete_tag_across_entities(
            db_session, tag="diabetes"
        )

        # Should update only 1 record
        assert updated_count == 1

        # Verify the medications
        db_session.refresh(medications_with_similar_tags["diabetes"])
        db_session.refresh(medications_with_similar_tags["pre-diabetes"])
        db_session.refresh(medications_with_similar_tags["diabetes-type2"])

        # 'diabetes' should be removed
        assert medications_with_similar_tags["diabetes"].tags == []

        # Others should remain unchanged
        assert medications_with_similar_tags["pre-diabetes"].tags == ["pre-diabetes"]
        assert medications_with_similar_tags["diabetes-type2"].tags == ["diabetes-type2"]

    def test_replace_tag_exact_match_only(
        self, db_session: Session, medications_with_similar_tags
    ):
        """Test that replacing 'diabetes' doesn't affect 'pre-diabetes' or 'diabetes-type2'."""
        # Replace only 'diabetes' tag
        updated_count = tag_service.replace_tag_across_entities(
            db_session, old_tag="diabetes", new_tag="type1-diabetes"
        )

        # Should update only 1 record
        assert updated_count == 1

        # Verify the medications
        db_session.refresh(medications_with_similar_tags["diabetes"])
        db_session.refresh(medications_with_similar_tags["pre-diabetes"])
        db_session.refresh(medications_with_similar_tags["diabetes-type2"])

        # 'diabetes' should be replaced with 'type1-diabetes'
        assert medications_with_similar_tags["diabetes"].tags == ["type1-diabetes"]

        # Others should remain unchanged
        assert medications_with_similar_tags["pre-diabetes"].tags == ["pre-diabetes"]
        assert medications_with_similar_tags["diabetes-type2"].tags == ["diabetes-type2"]

    def test_short_tag_doesnt_match_longer_tags(
        self, db_session: Session, test_patient
    ):
        """Test that a short tag like 'tag' doesn't match 'tags' or 'my-tag'."""
        # Create medications with similar tags
        med1 = medication_crud.create(
            db_session,
            obj_in=MedicationCreate(
                patient_id=test_patient.id,
                medication_name="Med1",
                dosage="10mg",
                frequency="daily",
                route="oral",
                effective_period_start=date(2024, 1, 1),
                status="active",
                tags=["tag"]
            )
        )

        med2 = medication_crud.create(
            db_session,
            obj_in=MedicationCreate(
                patient_id=test_patient.id,
                medication_name="Med2",
                dosage="20mg",
                frequency="daily",
                route="oral",
                effective_period_start=date(2024, 1, 1),
                status="active",
                tags=["tags"]
            )
        )

        med3 = medication_crud.create(
            db_session,
            obj_in=MedicationCreate(
                patient_id=test_patient.id,
                medication_name="Med3",
                dosage="30mg",
                frequency="daily",
                route="oral",
                effective_period_start=date(2024, 1, 1),
                status="active",
                tags=["my-tag"]
            )
        )

        db_session.commit()

        # Delete only 'tag' (not 'tags' or 'my-tag')
        updated_count = tag_service.delete_tag_across_entities(db_session, tag="tag")

        # Should update only 1 record
        assert updated_count == 1

        # Verify
        db_session.refresh(med1)
        db_session.refresh(med2)
        db_session.refresh(med3)

        assert med1.tags == []
        assert med2.tags == ["tags"]
        assert med3.tags == ["my-tag"]

    def test_tag_with_special_characters(
        self, db_session: Session, test_patient
    ):
        """Test exact matching with tags containing special characters."""
        # Create medications with tags containing special chars
        med1 = medication_crud.create(
            db_session,
            obj_in=MedicationCreate(
                patient_id=test_patient.id,
                medication_name="Med1",
                dosage="10mg",
                frequency="daily",
                route="oral",
                effective_period_start=date(2024, 1, 1),
                status="active",
                tags=["covid-19"]
            )
        )

        med2 = medication_crud.create(
            db_session,
            obj_in=MedicationCreate(
                patient_id=test_patient.id,
                medication_name="Med2",
                dosage="20mg",
                frequency="daily",
                route="oral",
                effective_period_start=date(2024, 1, 1),
                status="active",
                tags=["covid"]
            )
        )

        db_session.commit()

        # Rename only 'covid-19'
        updated_count = tag_service.rename_tag_across_entities(
            db_session, old_tag="covid-19", new_tag="sars-cov-2"
        )

        # Should update only 1 record
        assert updated_count == 1

        # Verify
        db_session.refresh(med1)
        db_session.refresh(med2)

        assert med1.tags == ["sars-cov-2"]
        assert med2.tags == ["covid"]
