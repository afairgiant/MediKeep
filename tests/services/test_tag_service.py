"""
Tests for TagService - verifying exact tag matching behavior.
"""

import logging
import pytest
from datetime import date
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.services.tag_service import (
    renamed_tags,
    replaced_tags,
    tag_service,
    tags_without,
)
from app.crud.medication import medication as medication_crud
from app.crud.patient import patient as patient_crud
from app.models.activity_log import ActionType, EntityType
from app.models.models import (
    ActivityLog,
    BloodDonation,
    Condition,
    Medication,
    Patient,
)
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
            address="123 Main St",
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
                tags=["diabetes"],
            ),
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
                tags=["pre-diabetes"],
            ),
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
                tags=["diabetes-type2"],
            ),
        )

        db_session.commit()
        return {"diabetes": med1, "pre-diabetes": med2, "diabetes-type2": med3}

    def test_rename_tag_exact_match_only(
        self, db_session: Session, test_user, medications_with_similar_tags
    ):
        """Test that renaming 'diabetes' doesn't affect 'pre-diabetes' or 'diabetes-type2'."""
        # Rename only 'diabetes' tag
        updated_count = tag_service.rename_tag_across_entities(
            db_session,
            old_tag="diabetes",
            new_tag="type1-diabetes",
            user_id=test_user.id,
        ).records_updated

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
        assert medications_with_similar_tags["diabetes-type2"].tags == [
            "diabetes-type2"
        ]

    def test_delete_tag_exact_match_only(
        self, db_session: Session, test_user, medications_with_similar_tags
    ):
        """Test that deleting 'diabetes' doesn't affect 'pre-diabetes' or 'diabetes-type2'."""
        # Delete only 'diabetes' tag
        updated_count = tag_service.delete_tag_across_entities(
            db_session, tag="diabetes", user_id=test_user.id
        ).records_updated

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
        assert medications_with_similar_tags["diabetes-type2"].tags == [
            "diabetes-type2"
        ]

    def test_replace_tag_exact_match_only(
        self, db_session: Session, test_user, medications_with_similar_tags
    ):
        """Test that replacing 'diabetes' doesn't affect 'pre-diabetes' or 'diabetes-type2'."""
        # Replace only 'diabetes' tag
        updated_count = tag_service.replace_tag_across_entities(
            db_session,
            old_tag="diabetes",
            new_tag="type1-diabetes",
            user_id=test_user.id,
        ).records_updated

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
        assert medications_with_similar_tags["diabetes-type2"].tags == [
            "diabetes-type2"
        ]

    def test_short_tag_doesnt_match_longer_tags(
        self, db_session: Session, test_user, test_patient
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
                tags=["tag"],
            ),
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
                tags=["tags"],
            ),
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
                tags=["my-tag"],
            ),
        )

        db_session.commit()

        # Delete only 'tag' (not 'tags' or 'my-tag')
        updated_count = tag_service.delete_tag_across_entities(
            db_session, tag="tag", user_id=test_user.id
        ).records_updated

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
        self, db_session: Session, test_user, test_patient
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
                tags=["covid-19"],
            ),
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
                tags=["covid"],
            ),
        )

        db_session.commit()

        # Rename only 'covid-19'
        updated_count = tag_service.rename_tag_across_entities(
            db_session, old_tag="covid-19", new_tag="sars-cov-2", user_id=test_user.id
        ).records_updated

        # Should update only 1 record
        assert updated_count == 1

        # Verify
        db_session.refresh(med1)
        db_session.refresh(med2)

        assert med1.tags == ["sars-cov-2"]
        assert med2.tags == ["covid"]


class TestTagReadsScopedToUser:
    """Regression tests for #1044: two users sharing a tag name."""

    SHARED_TAG = "diabetes"

    @pytest.fixture
    def shared_tag_setup(self, db_session: Session, test_user, test_recipient):
        tag_service.create_tag(db_session, tag=self.SHARED_TAG, user_id=test_user.id)
        tag_service.create_tag(
            db_session, tag=self.SHARED_TAG, user_id=test_recipient.id
        )
        tag_service.create_tag(db_session, tag="other-only", user_id=test_recipient.id)

    def test_popular_lists_shared_name_once(
        self, db_session: Session, test_user, shared_tag_setup
    ):
        result = tag_service.get_popular_tags_across_entities(
            db_session, user_id=test_user.id
        )

        assert [row["tag"] for row in result] == [self.SHARED_TAG]

    def test_popular_empty_entity_fallback_lists_only_own_tags(
        self, db_session: Session, test_user, shared_tag_setup
    ):
        result = tag_service.get_popular_tags_across_entities(
            db_session, entity_types=["not_an_entity"], user_id=test_user.id
        )

        assert [row["tag"] for row in result] == [self.SHARED_TAG]

    def test_autocomplete_excludes_other_users_tags(
        self, db_session: Session, test_user, shared_tag_setup
    ):
        assert tag_service.autocomplete_tags(
            db_session, query="", user_id=test_user.id
        ) == [self.SHARED_TAG]
        assert (
            tag_service.autocomplete_tags(
                db_session, query="other", user_id=test_user.id
            )
            == []
        )

    def test_user_id_is_required(self, db_session: Session):
        with pytest.raises(TypeError):
            tag_service.get_popular_tags_across_entities(db_session)
        with pytest.raises(TypeError):
            tag_service.autocomplete_tags(db_session, query="dia")


class TestTagServiceBloodDonations:
    """Blood donations take part in tag management like other tagged entities."""

    @pytest.fixture
    def donation(self, db_session: Session, test_user):
        patient = patient_crud.create_for_user(
            db_session,
            user_id=test_user.id,
            patient_data=PatientCreate(
                first_name="Jane",
                last_name="Doe",
                birth_date=date(1990, 1, 1),
                gender="F",
                address="1 Main St",
            ),
        )
        donation = BloodDonation(
            patient_id=patient.id,
            donation_date=date(2026, 1, 1),
            donation_type="whole_blood",
            tags=["regular"],
        )
        db_session.add(donation)
        db_session.commit()
        return donation

    def test_rename_updates_donation_tags(self, db_session, test_user, donation):
        updated = tag_service.rename_tag_across_entities(
            db_session, old_tag="regular", new_tag="routine", user_id=test_user.id
        ).records_updated

        db_session.refresh(donation)
        assert updated == 1
        assert donation.tags == ["routine"]

    def test_delete_removes_donation_tags(self, db_session, test_user, donation):
        tag_service.delete_tag_across_entities(
            db_session, tag="regular", user_id=test_user.id
        )

        db_session.refresh(donation)
        assert "regular" not in (donation.tags or [])

    def test_donation_tags_appear_in_popular_tags(
        self, db_session, test_user, donation
    ):
        tag_service.create_tag(db_session, tag="regular", user_id=test_user.id)

        result = tag_service.get_popular_tags_across_entities(
            db_session, user_id=test_user.id
        )

        row = next(r for r in result if r["tag"] == "regular")
        assert row["usage_count"] == 1
        assert "blood_donation" in row["entity_types"]

    def test_donation_tags_are_found_by_search(self, db_session, test_user, donation):
        results = tag_service.search_across_entities_by_tags(
            db_session, tags=["regular"], patient_id=donation.patient_id
        )

        assert [row["id"] for row in results["blood_donation"]] == [donation.id]


class TestTagListFunctions:
    def test_rename_keeps_order(self):
        assert renamed_tags(["a", "flu", "b"], "flu", "cold") == ["a", "cold", "b"]

    def test_rename_into_a_tag_already_present_drops_the_copy(self):
        assert renamed_tags(["flu", "a", "cold"], "flu", "cold") == ["cold", "a"]

    def test_without_removes_every_copy(self):
        assert tags_without(["flu", "a", "flu"], "flu") == ["a"]
        assert tags_without(["flu"], "flu") == []

    def test_replace_sorts_and_dedupes(self):
        assert replaced_tags(["b", "flu", "cold"], "flu", "cold") == ["b", "cold"]


class TestBulkTagChanges:
    @pytest.fixture
    def owned(self, db_session: Session, test_user):
        """Two patients owned by test_user, each with tagged records."""
        patients = [
            Patient(
                user_id=test_user.id,
                owner_user_id=test_user.id,
                first_name=name,
                last_name="Doe",
                birth_date=date(1990, 1, 1),
            )
            for name in ("Ann", "Bea")
        ]
        db_session.add_all(patients)
        db_session.flush()
        records = [
            Medication(
                patient_id=patients[0].id,
                medication_name="Med",
                status="active",
                tags=["flu", "a"],
            ),
            Condition(
                patient_id=patients[0].id,
                condition_name="Cold",
                diagnosis="Cold",
                status="active",
                tags=["flu"],
            ),
            Medication(
                patient_id=patients[1].id,
                medication_name="Med",
                status="active",
                tags=["flu"],
            ),
        ]
        db_session.add_all(records)
        db_session.commit()
        tag_service.create_tag(db_session, tag="flu", user_id=test_user.id)
        return patients, records

    @pytest.fixture
    def others_record(self, db_session: Session, test_recipient):
        patient = patient_crud.create_for_user(
            db_session,
            user_id=test_recipient.id,
            patient_data=PatientCreate(
                first_name="Cy",
                last_name="Roe",
                birth_date=date(1990, 1, 1),
                gender="M",
                address="2 Main St",
            ),
        )
        record = Medication(
            patient_id=patient.id, medication_name="Med", status="active", tags=["flu"]
        )
        db_session.add(record)
        db_session.commit()
        return record

    def _tags(self, db_session: Session, record):
        db_session.expire_all()
        return db_session.get(type(record), record.id).tags

    def test_rename_counts_records_by_entity_type(
        self, db_session: Session, test_user, owned
    ):
        change = tag_service.rename_tag_across_entities(
            db_session, old_tag="flu", new_tag="cold", user_id=test_user.id
        )

        assert change.records_updated == 3
        assert change.records_by_entity == {"medication": 2, "condition": 1}
        assert change.registry_action == "renamed"

    def test_rename_to_itself_keeps_the_registry_row(
        self, db_session: Session, test_user, owned
    ):
        flu = tag_service.get_popular_tags_across_entities(
            db_session, user_id=test_user.id
        )[0]
        tag_service.update_tag_color(
            db_session, tag_id=flu["id"], user_id=test_user.id, color="#ff0000"
        )

        change = tag_service.rename_tag_across_entities(
            db_session, old_tag="flu", new_tag="flu", user_id=test_user.id
        )

        assert change.records_updated == 0
        row = tag_service.get_popular_tags_across_entities(
            db_session, user_id=test_user.id
        )[0]
        assert (row["id"], row["color"]) == (flu["id"], "#ff0000")

    def test_bulk_change_keeps_updated_at(self, db_session: Session, test_user, owned):
        _, records = owned
        before = [record.updated_at for record in records]

        tag_service.rename_tag_across_entities(
            db_session, old_tag="flu", new_tag="cold", user_id=test_user.id
        )

        db_session.expire_all()
        assert [record.updated_at for record in records] == before

    def test_replace_registers_the_new_tag(self, db_session: Session, test_user, owned):
        change = tag_service.replace_tag_across_entities(
            db_session, old_tag="flu", new_tag="cold", user_id=test_user.id
        )

        assert change.registry_action == "replaced"
        assert tag_service.autocomplete_tags(
            db_session, query="", user_id=test_user.id
        ) == ["cold"]

    def test_rename_of_an_unregistered_tag_registers_the_new_name(
        self, db_session: Session, test_user, owned
    ):
        change = tag_service.rename_tag_across_entities(
            db_session, old_tag="a", new_tag="b", user_id=test_user.id
        )

        assert change.records_updated == 1
        assert change.registry_action == "added"
        assert change.tag_id is not None
        assert tag_service.autocomplete_tags(
            db_session, query="", user_id=test_user.id
        ) == ["b", "flu"]

    def test_rename_of_an_unregistered_tag_into_a_registered_one(
        self, db_session: Session, test_user, owned
    ):
        flu = tag_service.get_popular_tags_across_entities(
            db_session, user_id=test_user.id
        )[0]

        change = tag_service.rename_tag_across_entities(
            db_session, old_tag="a", new_tag="flu", user_id=test_user.id
        )

        assert (change.registry_action, change.tag_id) == ("existing", flu["id"])

    def test_register_skips_tags_already_there(
        self, db_session: Session, test_user, owned
    ):
        assert tag_service._register(db_session, test_user.id, ["flu", "new"]) == 1
        db_session.commit()
        assert tag_service.autocomplete_tags(
            db_session, query="", user_id=test_user.id
        ) == ["flu", "new"]

    def test_another_users_records_are_left_alone(
        self, db_session: Session, test_user, owned, others_record
    ):
        tag_service.delete_tag_across_entities(
            db_session, tag="flu", user_id=test_user.id
        )

        assert self._tags(db_session, others_record) == ["flu"]

    def test_one_activity_entry_per_patient(
        self, db_session: Session, test_user, owned
    ):
        patients, _ = owned
        change = tag_service.rename_tag_across_entities(
            db_session, old_tag="flu", new_tag="cold", user_id=test_user.id
        )

        entries = db_session.scalars(
            select(ActivityLog).where(ActivityLog.entity_type == EntityType.TAG)
        ).all()
        assert {entry.patient_id for entry in entries} == {p.id for p in patients}
        first = next(e for e in entries if e.patient_id == patients[0].id)
        assert first.action == ActionType.UPDATED
        assert first.entity_id == change.tag_id
        assert first.user_id == test_user.id
        assert first.event_metadata["records_changed"] == {
            "medication": 1,
            "condition": 1,
        }

    def test_a_failure_saves_nothing(
        self, db_session: Session, test_user, owned, monkeypatch
    ):
        _, records = owned

        def fail(*args, **kwargs):
            raise RuntimeError("activity log unavailable")

        monkeypatch.setattr(tag_service, "_record_activity", fail)

        with pytest.raises(RuntimeError):
            tag_service.rename_tag_across_entities(
                db_session, old_tag="flu", new_tag="cold", user_id=test_user.id
            )

        assert [self._tags(db_session, r) for r in records] == [
            ["flu", "a"],
            ["flu"],
            ["flu"],
        ]
        assert tag_service.autocomplete_tags(
            db_session, query="", user_id=test_user.id
        ) == ["flu"]
        assert db_session.scalars(select(ActivityLog)).all() == []

    def test_logs_carry_no_tag_text(
        self, db_session: Session, test_user, owned, caplog
    ):
        caplog.set_level(logging.DEBUG)

        tag_service.rename_tag_across_entities(
            db_session, old_tag="flu", new_tag="cold", user_id=test_user.id
        )
        tag_service.search_across_entities_by_tags(
            db_session, tags=["cold"], patient_id=owned[0][0].id
        )
        tag_service.delete_tag_across_entities(
            db_session, tag="cold", user_id=test_user.id
        )

        logged = " ".join(
            f"{record.getMessage()} {record.__dict__}" for record in caplog.records
        )
        assert "flu" not in logged
        assert "cold" not in logged

    def test_popular_merges_usage_across_entity_types(
        self, db_session: Session, test_user, owned, others_record
    ):
        row = tag_service.get_popular_tags_across_entities(
            db_session, user_id=test_user.id
        )[0]

        assert row["tag"] == "flu"
        assert row["usage_count"] == 3
        assert row["entity_types"] == ["condition", "medication"]

    def test_sync_registers_tags_found_on_records(
        self, db_session: Session, test_user, owned
    ):
        assert tag_service.sync_tags_from_records(db_session, user_id=test_user.id) == 1
        assert tag_service.autocomplete_tags(
            db_session, query="", user_id=test_user.id
        ) == ["a", "flu"]

    def test_search_requires_a_patient(self, db_session: Session):
        with pytest.raises(TypeError):
            tag_service.search_across_entities_by_tags(db_session, tags=["flu"])

    def test_autocomplete_treats_percent_literally(
        self, db_session: Session, test_user, owned
    ):
        assert (
            tag_service.autocomplete_tags(db_session, query="%", user_id=test_user.id)
            == []
        )

    def test_tags_that_are_not_a_list_are_skipped(
        self, db_session: Session, test_user, owned
    ):
        patients, _ = owned
        odd = Medication(
            patient_id=patients[0].id, medication_name="Odd", status="active", tags=None
        )
        db_session.add(odd)
        db_session.commit()

        change = tag_service.delete_tag_across_entities(
            db_session, tag="flu", user_id=test_user.id
        )

        assert change.records_updated == 3
