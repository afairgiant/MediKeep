"""Validation tests for blood donation schemas."""

from datetime import date, datetime, timedelta
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.schemas.blood_donation import (
    BloodDonationCreate,
    BloodDonationResponse,
    BloodDonationUpdate,
)


def _valid(**overrides):
    data = {
        "donation_date": date(2026, 9, 1),
        "donation_type": "whole_blood",
        "patient_id": 1,
    }
    data.update(overrides)
    return data


class TestBloodDonationCreate:
    def test_minimal_valid(self):
        donation = BloodDonationCreate(**_valid())
        assert donation.donation_type == "whole_blood"
        assert donation.tags == []

    def test_full_valid(self):
        donation = BloodDonationCreate(
            **_valid(
                location="DRK Blutspende",
                systolic_bp=125,
                diastolic_bp=80,
                temperature=98.6,
                hemoglobin=14.2,
                notes="All good",
                tags=["drk"],
            )
        )
        assert donation.hemoglobin == 14.2

    def test_type_is_normalized(self):
        assert BloodDonationCreate(**_valid(donation_type=" Plasma ")).donation_type == "plasma"

    def test_unknown_type_rejected(self):
        with pytest.raises(ValidationError, match="Donation type must be one of"):
            BloodDonationCreate(**_valid(donation_type="bone_marrow"))

    def test_future_date_rejected(self):
        with pytest.raises(ValidationError):
            BloodDonationCreate(**_valid(donation_date=date.today() + timedelta(days=5)))

    def test_today_date_accepted(self):
        donation = BloodDonationCreate(**_valid(donation_date=date.today()))
        assert donation.donation_date == date.today()

    @pytest.mark.parametrize(
        "field,value",
        [
            ("systolic_bp", 59),
            ("systolic_bp", 251),
            ("diastolic_bp", 29),
            ("diastolic_bp", 151),
            ("temperature", 79.9),
            ("temperature", 115.1),
            ("hemoglobin", 2.9),
            ("hemoglobin", 25.1),
        ],
    )
    def test_out_of_range_rejected(self, field, value):
        with pytest.raises(ValidationError):
            BloodDonationCreate(**_valid(**{field: value}))

    @pytest.mark.parametrize(
        "field,value",
        [
            ("systolic_bp", 60),
            ("systolic_bp", 250),
            ("diastolic_bp", 30),
            ("diastolic_bp", 150),
            ("temperature", 80),
            ("temperature", 115),
            ("hemoglobin", 3),
            ("hemoglobin", 25),
        ],
    )
    def test_boundary_values_accepted(self, field, value):
        # Avoid tripping the systolic > diastolic cross-check when testing
        # diastolic boundaries in isolation.
        overrides = {field: value}
        if field == "diastolic_bp":
            overrides["systolic_bp"] = 250
        donation = BloodDonationCreate(**_valid(**overrides))
        assert getattr(donation, field) == value

    def test_systolic_must_exceed_diastolic(self):
        with pytest.raises(ValidationError, match="Systolic"):
            BloodDonationCreate(**_valid(systolic_bp=80, diastolic_bp=80))

    def test_whitespace_location_and_notes_become_none(self):
        donation = BloodDonationCreate(**_valid(location="   ", notes="   "))
        assert donation.location is None
        assert donation.notes is None

    def test_location_and_notes_are_stripped(self):
        donation = BloodDonationCreate(
            **_valid(location="  DRK Blutspende  ", notes="  All good  ")
        )
        assert donation.location == "DRK Blutspende"
        assert donation.notes == "All good"


class TestBloodDonationUpdate:
    def test_all_fields_optional(self):
        update = BloodDonationUpdate()
        assert update.model_dump(exclude_unset=True) == {}

    def test_tags_none_means_unchanged(self):
        assert BloodDonationUpdate().tags is None

    def test_invalid_type_rejected(self):
        with pytest.raises(ValidationError):
            BloodDonationUpdate(donation_type="foo")

    def test_donation_type_normalized_on_update(self):
        update = BloodDonationUpdate(donation_type=" Plasma ")
        assert update.donation_type == "plasma"

    def test_bp_order_checked_when_both_given(self):
        with pytest.raises(ValidationError, match="Systolic"):
            BloodDonationUpdate(systolic_bp=70, diastolic_bp=90)

    def test_systolic_only_update_accepted(self):
        # Schema-level only: cross-checking against the stored diastolic
        # value happens in the CRUD layer, not here.
        update = BloodDonationUpdate(systolic_bp=125)
        assert update.systolic_bp == 125

    def test_explicit_null_donation_date_rejected(self):
        with pytest.raises(ValidationError, match="[Dd]onation date"):
            BloodDonationUpdate(donation_date=None)

    def test_explicit_null_donation_type_rejected(self):
        with pytest.raises(ValidationError, match="[Dd]onation type"):
            BloodDonationUpdate(donation_type=None)

    def test_whitespace_location_and_notes_become_none(self):
        update = BloodDonationUpdate(location="   ", notes="   ")
        assert update.location is None
        assert update.notes is None

    def test_location_and_notes_are_stripped(self):
        update = BloodDonationUpdate(location="  DRK  ", notes="  fine  ")
        assert update.location == "DRK"
        assert update.notes == "fine"


class TestBloodDonationResponse:
    def test_lenient_on_read_with_unknown_type_and_bad_bp_order(self):
        # Simulates an ORM row written before stricter validation existed
        # (or written directly via CRUD without going through Create/Update):
        # an unknown donation_type and a diastolic reading above systolic.
        # The response schema must build this without raising.
        row = SimpleNamespace(
            id=1,
            patient_id=1,
            donation_date=date(2026, 9, 1),
            donation_type="bone_marrow",
            location=None,
            systolic_bp=70,
            diastolic_bp=80,
            temperature=None,
            hemoglobin=None,
            notes=None,
            tags=[],
            created_at=datetime(2026, 9, 1, 12, 0, 0),
            updated_at=datetime(2026, 9, 1, 12, 0, 0),
        )
        response = BloodDonationResponse.model_validate(row)
        assert response.donation_type == "bone_marrow"
        assert response.systolic_bp == 70
        assert response.diastolic_bp == 80

    def test_lenient_on_read_with_out_of_range_values(self):
        # Out-of-range screening values (e.g. historical data entered before
        # tighter bounds existed) must not block reading the record.
        row = SimpleNamespace(
            id=2,
            patient_id=1,
            donation_date=date(2026, 9, 1),
            donation_type="whole_blood",
            location=None,
            systolic_bp=400,
            diastolic_bp=None,
            temperature=200.0,
            hemoglobin=50.0,
            notes=None,
            tags=[],
            created_at=datetime(2026, 9, 1, 12, 0, 0),
            updated_at=datetime(2026, 9, 1, 12, 0, 0),
        )
        response = BloodDonationResponse.model_validate(row)
        assert response.systolic_bp == 400
        assert response.temperature == 200.0
        assert response.hemoglobin == 50.0
