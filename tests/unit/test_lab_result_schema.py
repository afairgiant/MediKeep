"""
Unit tests for LabResult schema notes validation.

Tests cover:
1. LabResultCreate validates notes at/above 5000 char limit
2. LabResultUpdate validates notes at/above 5000 char limit
3. LabResultResponse serializes notes >1000 chars without error (regression test)
4. LabResultBase (inherited by Response) does NOT have a notes validator
"""

import pytest
from datetime import date, datetime
from pydantic import ValidationError

from app.schemas.lab_result import (
    LabResultBase,
    LabResultCreate,
    LabResultUpdate,
    LabResultResponse,
)


def make_create(**overrides):
    """Helper to create a LabResultCreate with sensible defaults."""
    defaults = {
        "test_name": "Complete Blood Count",
        "patient_id": 1,
    }
    defaults.update(overrides)
    return LabResultCreate(**defaults)


def make_update(**overrides):
    """Helper to create a LabResultUpdate with sensible defaults."""
    return LabResultUpdate(**overrides)


class TestLabResultCreateNotesValidation:
    """Tests for notes validation on LabResultCreate."""

    def test_create_notes_at_limit(self):
        """Notes exactly at 5000 chars should be accepted."""
        notes = "x" * 5000
        result = make_create(notes=notes)
        assert len(result.notes) == 5000

    def test_create_notes_above_limit(self):
        """Notes exceeding 5000 chars should be rejected."""
        notes = "x" * 5001
        with pytest.raises(ValidationError, match="5000"):
            make_create(notes=notes)

    def test_create_notes_none(self):
        """None notes should be accepted."""
        result = make_create(notes=None)
        assert result.notes is None

    def test_create_notes_empty_string(self):
        """Empty string notes should normalize to None."""
        result = make_create(notes="")
        assert result.notes is None

    def test_create_notes_whitespace_stripped(self):
        """Notes should be stripped of leading/trailing whitespace."""
        result = make_create(notes="  some notes  ")
        assert result.notes == "some notes"

    def test_create_notes_medical_length(self):
        """Notes of 1500 chars (typical MRI report) should be accepted."""
        notes = "x" * 1500
        result = make_create(notes=notes)
        assert len(result.notes) == 1500


class TestLabResultUpdateNotesValidation:
    """Tests for notes validation on LabResultUpdate."""

    def test_update_notes_at_limit(self):
        """Notes exactly at 5000 chars should be accepted."""
        notes = "x" * 5000
        result = make_update(notes=notes)
        assert len(result.notes) == 5000

    def test_update_notes_above_limit(self):
        """Notes exceeding 5000 chars should be rejected."""
        notes = "x" * 5001
        with pytest.raises(ValidationError, match="5000"):
            make_update(notes=notes)

    def test_update_notes_none(self):
        """None notes (not provided) should be accepted."""
        result = make_update(notes=None)
        assert result.notes is None

    def test_update_notes_whitespace_stripped(self):
        """Notes should be stripped of leading/trailing whitespace."""
        result = make_update(notes="  updated notes  ")
        assert result.notes == "updated notes"

    def test_update_notes_1500_chars(self):
        """Update with 1500 char notes (previously would bypass validation)."""
        notes = "x" * 1500
        result = make_update(notes=notes)
        assert len(result.notes) == 1500


class TestLabResultResponseNotesRegression:
    """Regression tests: Response schema must NOT reject notes already in DB."""

    def test_response_with_notes_over_1000_chars(self):
        """Response with >1000 char notes must NOT raise (was the original bug)."""
        notes = "x" * 1500
        response = LabResultResponse(
            id=1,
            test_name="MRI Brain",
            patient_id=1,
            notes=notes,
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 1),
        )
        assert len(response.notes) == 1500

    def test_response_with_notes_over_5000_chars(self):
        """Response with >5000 char notes must NOT raise.

        Data already in the DB should always serialize successfully,
        even if it exceeds the current input validation limit.
        """
        notes = "x" * 6000
        response = LabResultResponse(
            id=1,
            test_name="Detailed Report",
            patient_id=1,
            notes=notes,
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 1),
        )
        assert len(response.notes) == 6000

    def test_response_with_notes_at_exactly_1001_chars(self):
        """The exact boundary that caused the original 500 error."""
        notes = "x" * 1001
        response = LabResultResponse(
            id=1,
            test_name="Blood Work",
            patient_id=1,
            notes=notes,
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 1),
        )
        assert len(response.notes) == 1001


class TestLabResultBaseHasNoNotesValidator:
    """Verify that LabResultBase does not validate notes length."""

    def test_base_accepts_long_notes(self):
        """LabResultBase should accept notes of any length (no validator)."""
        notes = "x" * 10000
        base = LabResultBase(
            test_name="Test",
            patient_id=1,
            notes=notes,
        )
        assert len(base.notes) == 10000


class TestLabResultResponseRefRangeTextRegression:
    """Regression (#894 twin): Response must NOT reject over-limit ref_range_text.

    Length is enforced on the input schemas, but data already in the DB (or
    inserted by non-API paths such as OCR import) must always serialize so the
    record stays viewable and editable instead of raising ResponseValidationError.
    """

    def test_response_with_over_limit_ref_range_text(self):
        text = "x" * 600
        response = LabResultResponse(
            id=1,
            test_name="Lipid Panel",
            patient_id=1,
            ref_range_text=text,
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 1),
        )
        assert len(response.ref_range_text) == 600

    def test_base_accepts_long_ref_range_text(self):
        """LabResultBase normalizes but does not enforce length."""
        base = LabResultBase(
            test_name="Test",
            patient_id=1,
            ref_range_text="x" * 10000,
        )
        assert len(base.ref_range_text) == 10000


class TestLabResultNumericFieldsCreate:
    """Tests for numeric result field validation on LabResultCreate/LabResultBase."""

    def test_valid_value_and_unit(self):
        result = make_create(value=5.4, unit="mmol/L")
        assert result.value == 5.4
        assert result.unit == "mmol/L"

    def test_value_none_accepted(self):
        result = make_create(value=None)
        assert result.value is None

    def test_value_infinite_rejected(self):
        import math

        with pytest.raises(ValidationError, match="finite"):
            make_create(value=math.inf)

    def test_value_out_of_range_rejected(self):
        with pytest.raises(ValidationError, match="reasonable"):
            make_create(value=2_000_000)

    def test_unit_stripped(self):
        result = make_create(unit="  mg/dL  ")
        assert result.unit == "mg/dL"

    def test_unit_empty_string_normalizes_to_none(self):
        result = make_create(unit="   ")
        assert result.unit is None

    def test_unit_too_long_rejected(self):
        with pytest.raises(ValidationError, match="50"):
            make_create(unit="x" * 51)

    def test_ref_range_valid(self):
        result = make_create(ref_range_min=4.0, ref_range_max=5.6)
        assert result.ref_range_min == 4.0
        assert result.ref_range_max == 5.6

    def test_ref_range_inverted_rejected(self):
        with pytest.raises(ValidationError, match="maximum must be greater"):
            make_create(ref_range_min=5.6, ref_range_max=4.0)

    def test_ref_range_equal_rejected(self):
        with pytest.raises(ValidationError, match="maximum must be greater"):
            make_create(ref_range_min=5.0, ref_range_max=5.0)

    def test_ref_range_only_min(self):
        result = make_create(ref_range_min=4.0)
        assert result.ref_range_min == 4.0
        assert result.ref_range_max is None

    def test_ref_range_text_stripped(self):
        result = make_create(ref_range_text="  4.0-5.6  ")
        assert result.ref_range_text == "4.0-5.6"

    def test_ref_range_text_empty_normalizes_to_none(self):
        result = make_create(ref_range_text="   ")
        assert result.ref_range_text is None

    def test_ref_range_text_at_limit_accepted(self):
        text = "x" * 500
        result = make_create(ref_range_text=text)
        assert result.ref_range_text == text

    def test_ref_range_text_too_long_rejected(self):
        with pytest.raises(ValidationError, match="500"):
            make_create(ref_range_text="x" * 501)

    def test_all_numeric_fields_none(self):
        """All fields optional — omitting them should be fine."""
        result = make_create()
        assert result.value is None
        assert result.unit is None
        assert result.ref_range_min is None
        assert result.ref_range_max is None
        assert result.ref_range_text is None


class TestLabResultNumericFieldsUpdate:
    """Tests for numeric result field validation on LabResultUpdate."""

    def test_update_valid_value(self):
        result = make_update(value=6.1, unit="%")
        assert result.value == 6.1
        assert result.unit == "%"

    def test_update_value_infinite_rejected(self):
        import math

        with pytest.raises(ValidationError, match="finite"):
            make_update(value=math.inf)

    def test_update_ref_range_inverted_rejected(self):
        with pytest.raises(ValidationError, match="maximum must be greater"):
            make_update(ref_range_min=10.0, ref_range_max=5.0)

    def test_update_ref_range_text_at_limit_accepted(self):
        text = "x" * 500
        result = make_update(ref_range_text=text)
        assert result.ref_range_text == text

    def test_update_ref_range_text_too_long_rejected(self):
        with pytest.raises(ValidationError, match="500"):
            make_update(ref_range_text="x" * 501)

    def test_update_ref_range_text_stripped(self):
        result = make_update(ref_range_text="  Negative  ")
        assert result.ref_range_text == "Negative"

    def test_update_all_none(self):
        result = make_update(
            value=None, unit=None, ref_range_min=None, ref_range_max=None
        )
        assert result.value is None
