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
