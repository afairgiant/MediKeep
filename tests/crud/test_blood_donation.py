"""CRUD tests for blood donations."""

from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.core.http.error_handling import ValidationException
from app.crud.blood_donation import blood_donation
from app.schemas.blood_donation import BloodDonationCreate, BloodDonationUpdate


def _create(db: Session, patient_id: int, **overrides):
    data = {
        "donation_date": date(2026, 5, 1),
        "donation_type": "whole_blood",
        "patient_id": patient_id,
    }
    data.update(overrides)
    return blood_donation.create(db, obj_in=BloodDonationCreate(**data))


class TestBloodDonationCrud:
    def test_create_and_get(self, db_session: Session, test_patient):
        created = _create(db_session, test_patient.id, hemoglobin=14.1)
        fetched = blood_donation.get(db_session, id=created.id)
        assert fetched.hemoglobin == 14.1
        assert fetched.donation_type == "whole_blood"

    def test_update(self, db_session: Session, test_patient):
        created = _create(db_session, test_patient.id)
        updated = blood_donation.update(
            db_session, db_obj=created, obj_in=BloodDonationUpdate(location="Clinic")
        )
        assert updated.location == "Clinic"

    def test_get_by_patient_newest_first(self, db_session: Session, test_patient):
        older = _create(db_session, test_patient.id, donation_date=date(2026, 1, 1))
        newer = _create(db_session, test_patient.id, donation_date=date(2026, 3, 1))
        result = blood_donation.get_by_patient(db_session, patient_id=test_patient.id)
        assert [d.id for d in result] == [newer.id, older.id]

    def test_same_day_ordered_by_newest_id_first(self, db_session: Session, test_patient):
        first = _create(db_session, test_patient.id, donation_date=date(2026, 4, 1))
        second = _create(db_session, test_patient.id, donation_date=date(2026, 4, 1))
        result = blood_donation.get_by_patient(db_session, patient_id=test_patient.id)
        assert [d.id for d in result] == [second.id, first.id]

    def test_get_latest(self, db_session: Session, test_patient):
        assert blood_donation.get_latest(db_session, patient_id=test_patient.id) is None
        _create(db_session, test_patient.id, donation_date=date(2026, 1, 1))
        latest = _create(
            db_session, test_patient.id, donation_date=date(2026, 2, 1), donation_type="plasma"
        )
        assert blood_donation.get_latest(db_session, patient_id=test_patient.id).id == latest.id

    def test_filter_by_type(self, db_session: Session, test_patient):
        _create(db_session, test_patient.id, donation_type="plasma")
        _create(db_session, test_patient.id, donation_type="whole_blood")
        result = blood_donation.get_by_patient(
            db_session, patient_id=test_patient.id, donation_type="plasma"
        )
        assert [d.donation_type for d in result] == ["plasma"]

    def test_tag_filtered_list_is_newest_first(self, db_session: Session, test_patient):
        """Quality-review fix: tag filtering must not lose the newest-first order."""
        older = _create(
            db_session, test_patient.id, donation_date=date(2026, 1, 1), tags=["drk"]
        )
        newer = _create(
            db_session, test_patient.id, donation_date=date(2026, 3, 1), tags=["drk"]
        )
        _create(db_session, test_patient.id, donation_date=date(2026, 2, 1), tags=["other"])

        result = blood_donation.get_by_patient(
            db_session, patient_id=test_patient.id, tags=["drk"]
        )
        assert [d.id for d in result] == [newer.id, older.id]

    def test_tag_match_any_mode(self, db_session: Session, test_patient):
        a = _create(db_session, test_patient.id, donation_date=date(2026, 1, 1), tags=["a"])
        b = _create(db_session, test_patient.id, donation_date=date(2026, 2, 1), tags=["b"])
        _create(db_session, test_patient.id, donation_date=date(2026, 3, 1), tags=["c"])

        result = blood_donation.get_by_patient(
            db_session, patient_id=test_patient.id, tags=["a", "b"], tag_match_all=False
        )
        assert {d.id for d in result} == {a.id, b.id}

    def test_tag_match_all_mode(self, db_session: Session, test_patient):
        both = _create(
            db_session, test_patient.id, donation_date=date(2026, 1, 1), tags=["a", "b"]
        )
        _create(db_session, test_patient.id, donation_date=date(2026, 2, 1), tags=["a"])

        result = blood_donation.get_by_patient(
            db_session, patient_id=test_patient.id, tags=["a", "b"], tag_match_all=True
        )
        assert [d.id for d in result] == [both.id]

    def test_donation_type_filter_combined_with_tags(
        self, db_session: Session, test_patient
    ):
        match = _create(
            db_session,
            test_patient.id,
            donation_type="plasma",
            donation_date=date(2026, 1, 1),
            tags=["drk"],
        )
        _create(
            db_session,
            test_patient.id,
            donation_type="whole_blood",
            donation_date=date(2026, 2, 1),
            tags=["drk"],
        )
        _create(
            db_session,
            test_patient.id,
            donation_type="plasma",
            donation_date=date(2026, 3, 1),
            tags=["other"],
        )

        result = blood_donation.get_by_patient(
            db_session, patient_id=test_patient.id, donation_type="plasma", tags=["drk"]
        )
        assert [d.id for d in result] == [match.id]

    def test_donation_type_filter_without_tags_unchanged(
        self, db_session: Session, test_patient
    ):
        _create(db_session, test_patient.id, donation_type="plasma")
        _create(db_session, test_patient.id, donation_type="whole_blood")
        result = blood_donation.get_by_patient(
            db_session, patient_id=test_patient.id, donation_type="plasma"
        )
        assert [d.donation_type for d in result] == ["plasma"]

    def test_delete(self, db_session: Session, test_patient):
        created = _create(db_session, test_patient.id)
        blood_donation.delete(db_session, id=created.id)
        assert blood_donation.get(db_session, id=created.id) is None


class TestBloodDonationPartialUpdateBpValidation:
    """Code-review addition: a partial update must not create an invalid BP pair.

    The schema only validates BP order when both values are present in the
    payload, so a systolic-only or diastolic-only update could otherwise
    silently store systolic <= diastolic against the stored value.
    """

    def test_systolic_only_update_producing_invalid_pair_raises(
        self, db_session: Session, test_patient
    ):
        created = _create(db_session, test_patient.id, systolic_bp=120, diastolic_bp=80)

        with pytest.raises(ValidationException):
            blood_donation.update(
                db_session, db_obj=created, obj_in=BloodDonationUpdate(systolic_bp=70)
            )

        # Record must be left unchanged
        db_session.refresh(created)
        assert created.systolic_bp == 120
        assert created.diastolic_bp == 80

    def test_diastolic_only_update_producing_invalid_pair_raises(
        self, db_session: Session, test_patient
    ):
        created = _create(db_session, test_patient.id, systolic_bp=120, diastolic_bp=80)

        with pytest.raises(ValidationException):
            blood_donation.update(
                db_session, db_obj=created, obj_in=BloodDonationUpdate(diastolic_bp=130)
            )

        db_session.refresh(created)
        assert created.systolic_bp == 120
        assert created.diastolic_bp == 80

    def test_systolic_only_update_producing_valid_pair_succeeds(
        self, db_session: Session, test_patient
    ):
        created = _create(db_session, test_patient.id, systolic_bp=120, diastolic_bp=80)

        updated = blood_donation.update(
            db_session, db_obj=created, obj_in=BloodDonationUpdate(systolic_bp=130)
        )

        assert updated.systolic_bp == 130
        assert updated.diastolic_bp == 80

    def test_update_unrelated_field_on_record_without_bp_succeeds(
        self, db_session: Session, test_patient
    ):
        created = _create(db_session, test_patient.id)
        assert created.systolic_bp is None
        assert created.diastolic_bp is None

        updated = blood_donation.update(
            db_session, db_obj=created, obj_in=BloodDonationUpdate(location="Clinic")
        )

        assert updated.location == "Clinic"
        assert updated.systolic_bp is None
        assert updated.diastolic_bp is None

    def test_dict_obj_in_is_also_validated(self, db_session: Session, test_patient):
        """CRUDBase.update accepts dicts too (not just the Pydantic schema)."""
        created = _create(db_session, test_patient.id, systolic_bp=120, diastolic_bp=80)

        with pytest.raises(ValidationException):
            blood_donation.update(db_session, db_obj=created, obj_in={"systolic_bp": 70})

        db_session.refresh(created)
        assert created.systolic_bp == 120

    def test_dict_clearing_systolic_to_none_succeeds(
        self, db_session: Session, test_patient
    ):
        """An explicit null for one side only clears it; no pair is left to check."""
        created = _create(db_session, test_patient.id, systolic_bp=120, diastolic_bp=80)

        updated = blood_donation.update(
            db_session, db_obj=created, obj_in={"systolic_bp": None}
        )

        assert updated.systolic_bp is None
        assert updated.diastolic_bp == 80

    def test_dict_with_both_fields_in_invalid_pair_raises(
        self, db_session: Session, test_patient
    ):
        created = _create(db_session, test_patient.id, systolic_bp=120, diastolic_bp=80)

        with pytest.raises(ValidationException):
            blood_donation.update(
                db_session,
                db_obj=created,
                obj_in={"systolic_bp": 70, "diastolic_bp": 90},
            )

        db_session.refresh(created)
        assert created.systolic_bp == 120
        assert created.diastolic_bp == 80
