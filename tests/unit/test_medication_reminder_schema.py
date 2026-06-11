"""
Tests for medication reminder Pydantic validation and notification template.
"""

import pytest
from pydantic import ValidationError

from app.schemas.medication import MedicationBase, MedicationUpdate
from app.services.notification_templates import medication_reminder_due_template


class TestReminderTimesValidator:
    """Validation rules for the reminder_times field on Medication schemas."""

    def test_none_is_accepted(self):
        med = MedicationBase(medication_name="Aspirin", reminder_times=None)
        assert med.reminder_times is None

    def test_empty_list_is_accepted(self):
        med = MedicationBase(medication_name="Aspirin", reminder_times=[])
        assert med.reminder_times == []

    def test_valid_times_are_sorted(self):
        med = MedicationBase(
            medication_name="Aspirin", reminder_times=["20:00", "08:00", "14:00"]
        )
        assert med.reminder_times == ["08:00", "14:00", "20:00"]

    @pytest.mark.parametrize(
        "bad_time",
        ["8:00", "24:00", "08:60", "0800", "08", "08:00am", "ab:cd", "", " 08:00"],
    )
    def test_invalid_format_rejected(self, bad_time):
        with pytest.raises(ValidationError) as exc:
            MedicationBase(medication_name="Aspirin", reminder_times=[bad_time])
        assert "HH:MM" in str(exc.value)

    def test_non_string_entry_rejected(self):
        with pytest.raises(ValidationError):
            MedicationBase(medication_name="Aspirin", reminder_times=[800])

    def test_duplicates_rejected(self):
        with pytest.raises(ValidationError) as exc:
            MedicationBase(medication_name="Aspirin", reminder_times=["08:00", "08:00"])
        assert "Duplicate" in str(exc.value)

    def test_too_many_entries_rejected(self):
        thirteen_times = [f"{h:02d}:00" for h in range(13)]
        with pytest.raises(ValidationError) as exc:
            MedicationBase(medication_name="Aspirin", reminder_times=thirteen_times)
        assert "12" in str(exc.value)

    def test_max_entries_accepted(self):
        twelve_times = [f"{h:02d}:00" for h in range(12)]
        med = MedicationBase(medication_name="Aspirin", reminder_times=twelve_times)
        assert len(med.reminder_times) == 12

    def test_update_schema_applies_same_validation(self):
        with pytest.raises(ValidationError):
            MedicationUpdate(reminder_times=["bad"])

    def test_reminder_enabled_defaults_false_on_base(self):
        med = MedicationBase(medication_name="Aspirin")
        assert med.reminder_enabled is False

    def test_reminder_enabled_passthrough(self):
        med = MedicationBase(medication_name="Aspirin", reminder_enabled=True)
        assert med.reminder_enabled is True


class TestMedicationReminderTemplate:
    """The notification template that renders the user-facing message."""

    def test_renders_with_dosage(self):
        title, body = medication_reminder_due_template(
            {
                "medication_name": "Metformin",
                "dosage": "500mg",
                "scheduled_time_local": "08:00",
            }
        )
        assert "Metformin" in title
        assert "Metformin" in body
        assert "500mg" in body
        assert "08:00" in body

    def test_renders_without_dosage(self):
        title, body = medication_reminder_due_template(
            {"medication_name": "Aspirin", "scheduled_time_local": "20:00"}
        )
        assert "Aspirin" in title
        assert "(" not in body  # no empty dosage parens

    def test_is_test_flag_produces_test_messaging(self):
        title, body = medication_reminder_due_template(
            {"medication_name": "Aspirin", "is_test": True}
        )
        assert "Test" in title
        assert "test" in body.lower()

    def test_missing_fields_fall_back_to_placeholders(self):
        title, body = medication_reminder_due_template({})
        assert "your medication" in body
