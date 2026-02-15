"""
Tests for Practice schema validation.
"""
import pytest
from pydantic import ValidationError

from app.schemas.practice import (
    PracticeCreate,
    PracticeLocationSchema,
    PracticeUpdate,
    PracticeSummary,
    PracticeWithPractitioners,
)


class TestPracticeLocationSchema:
    """Test PracticeLocationSchema validation."""

    def test_valid_location(self):
        """Test creating a valid location."""
        location = PracticeLocationSchema(
            label="Main Office",
            address="123 Medical Dr",
            city="Durham",
            state="NC",
            zip="27701",
            phone="919-555-0100",
        )
        assert location.label == "Main Office"
        assert location.address == "123 Medical Dr"
        assert location.city == "Durham"
        assert location.state == "NC"
        assert location.zip == "27701"
        assert location.phone == "919-555-0100"

    def test_all_fields_optional(self):
        """Test that all location fields are optional."""
        location = PracticeLocationSchema()
        assert location.label is None
        assert location.address is None
        assert location.city is None
        assert location.state is None
        assert location.zip is None
        assert location.phone is None

    def test_label_too_long(self):
        """Test that label over 100 chars is rejected."""
        with pytest.raises(ValidationError):
            PracticeLocationSchema(label="A" * 101)

    def test_address_too_long(self):
        """Test that address over 200 chars is rejected."""
        with pytest.raises(ValidationError):
            PracticeLocationSchema(address="A" * 201)

    def test_phone_invalid_characters(self):
        """Test that location phone rejects invalid characters."""
        with pytest.raises(ValidationError):
            PracticeLocationSchema(phone="not-a-phone!")

    def test_phone_valid_formats(self):
        """Test that various valid phone formats are accepted."""
        valid_phones = ["919-555-0100", "(919) 555-0100", "+1 919.555.0100"]
        for phone in valid_phones:
            location = PracticeLocationSchema(phone=phone)
            assert location.phone is not None

    def test_empty_string_fields_become_none(self):
        """Test that empty string fields are converted to None."""
        location = PracticeLocationSchema(label="  ", address="  ")
        assert location.label is None
        assert location.address is None


class TestPracticeCreate:
    """Test PracticeCreate schema validation."""

    def test_valid_create_minimal(self):
        """Test creating a practice with only required fields."""
        practice = PracticeCreate(name="Durham Family Medicine")
        assert practice.name == "Durham Family Medicine"
        assert practice.phone_number is None
        assert practice.fax_number is None
        assert practice.website is None
        assert practice.patient_portal_url is None
        assert practice.notes is None
        assert practice.locations is None

    def test_valid_create_all_fields(self):
        """Test creating a practice with all fields."""
        practice = PracticeCreate(
            name="Heart Health Center",
            phone_number="919-555-1000",
            fax_number="919-555-1001",
            website="https://hearthealthcenter.com",
            patient_portal_url="https://portal.hearthealthcenter.com",
            notes="Specializes in cardiac care",
            locations=[
                {
                    "label": "Main Office",
                    "address": "123 Medical Dr",
                    "city": "Durham",
                    "state": "NC",
                    "zip": "27701",
                }
            ],
        )
        assert practice.name == "Heart Health Center"
        assert practice.phone_number == "919-555-1000"
        assert practice.fax_number == "919-555-1001"
        assert practice.website == "https://hearthealthcenter.com"
        assert practice.locations is not None
        assert len(practice.locations) == 1
        assert practice.locations[0].label == "Main Office"

    def test_name_required(self):
        """Test that name is required."""
        with pytest.raises(ValidationError):
            PracticeCreate(name="")

    def test_name_whitespace_only_rejected(self):
        """Test that whitespace-only name is rejected."""
        with pytest.raises(ValidationError):
            PracticeCreate(name="   ")

    def test_name_too_short(self):
        """Test that name under 2 chars is rejected."""
        with pytest.raises(ValidationError):
            PracticeCreate(name="A")

    def test_name_too_long(self):
        """Test that name over 150 chars is rejected."""
        with pytest.raises(ValidationError):
            PracticeCreate(name="A" * 151)

    def test_name_stripped(self):
        """Test that name is stripped of leading/trailing whitespace."""
        practice = PracticeCreate(name="  Heart Health Center  ")
        assert practice.name == "Heart Health Center"

    def test_phone_number_valid(self):
        """Test valid phone number formats."""
        practice = PracticeCreate(name="Test Practice", phone_number="919-555-1234")
        assert practice.phone_number == "919-555-1234"

    def test_phone_number_invalid(self):
        """Test that invalid phone numbers are rejected."""
        with pytest.raises(ValidationError):
            PracticeCreate(name="Test Practice", phone_number="not-a-phone!")

    def test_fax_number_valid(self):
        """Test valid fax number."""
        practice = PracticeCreate(name="Test Practice", fax_number="(919) 555-1235")
        assert practice.fax_number == "(919) 555-1235"

    def test_fax_number_invalid(self):
        """Test that invalid fax numbers are rejected."""
        with pytest.raises(ValidationError):
            PracticeCreate(name="Test Practice", fax_number="abc")

    def test_website_auto_https(self):
        """Test that website without protocol gets https:// prepended."""
        practice = PracticeCreate(name="Test Practice", website="example.com")
        assert practice.website == "https://example.com"

    def test_website_preserves_https(self):
        """Test that website with https:// is preserved."""
        practice = PracticeCreate(
            name="Test Practice", website="https://example.com"
        )
        assert practice.website == "https://example.com"

    def test_website_invalid(self):
        """Test that invalid website URL is rejected."""
        with pytest.raises(ValidationError):
            PracticeCreate(name="Test Practice", website="not a url at all")

    def test_patient_portal_url_valid(self):
        """Test valid patient portal URL."""
        practice = PracticeCreate(
            name="Test Practice",
            patient_portal_url="https://portal.example.com",
        )
        assert practice.patient_portal_url == "https://portal.example.com"

    def test_patient_portal_url_auto_https(self):
        """Test that patient portal URL gets https:// prepended."""
        practice = PracticeCreate(
            name="Test Practice", patient_portal_url="portal.example.com"
        )
        assert practice.patient_portal_url == "https://portal.example.com"

    def test_notes_valid(self):
        """Test valid notes field."""
        practice = PracticeCreate(name="Test Practice", notes="Some notes here")
        assert practice.notes == "Some notes here"

    def test_notes_too_long(self):
        """Test that notes over 2000 chars are rejected."""
        with pytest.raises(ValidationError):
            PracticeCreate(name="Test Practice", notes="A" * 2001)

    def test_notes_whitespace_stripped(self):
        """Test that notes whitespace is stripped and empty becomes None."""
        practice = PracticeCreate(name="Test Practice", notes="  ")
        assert practice.notes is None

    def test_multiple_locations(self):
        """Test practice with multiple locations."""
        practice = PracticeCreate(
            name="Multi-Location Practice",
            locations=[
                {"label": "Main Office", "city": "Durham"},
                {"label": "Branch Office", "city": "Raleigh"},
            ],
        )
        assert len(practice.locations) == 2
        assert practice.locations[0].city == "Durham"
        assert practice.locations[1].city == "Raleigh"


class TestPracticeUpdate:
    """Test PracticeUpdate schema validation."""

    def test_all_fields_optional(self):
        """Test that all fields are optional for updates."""
        update = PracticeUpdate()
        assert update.name is None
        assert update.phone_number is None
        assert update.website is None

    def test_update_name_only(self):
        """Test updating only the name."""
        update = PracticeUpdate(name="New Practice Name")
        assert update.name == "New Practice Name"
        assert update.phone_number is None

    def test_update_name_too_short(self):
        """Test that update name under 2 chars is rejected."""
        with pytest.raises(ValidationError):
            PracticeUpdate(name="A")

    def test_update_name_too_long(self):
        """Test that update name over 150 chars is rejected."""
        with pytest.raises(ValidationError):
            PracticeUpdate(name="A" * 151)

    def test_empty_strings_to_none(self):
        """Test that empty strings are converted to None."""
        update = PracticeUpdate(
            phone_number="",
            fax_number="",
            website="",
            patient_portal_url="",
            notes="",
        )
        assert update.phone_number is None
        assert update.fax_number is None
        assert update.website is None
        assert update.patient_portal_url is None
        assert update.notes is None

    def test_update_phone(self):
        """Test updating phone number."""
        update = PracticeUpdate(phone_number="555-123-4567")
        assert update.phone_number == "555-123-4567"

    def test_update_website(self):
        """Test updating website."""
        update = PracticeUpdate(website="newsite.com")
        assert update.website == "https://newsite.com"

    def test_update_locations(self):
        """Test updating locations."""
        update = PracticeUpdate(
            locations=[{"label": "New Location", "city": "Chapel Hill"}]
        )
        assert len(update.locations) == 1
        assert update.locations[0].city == "Chapel Hill"


class TestPracticeSummary:
    """Test PracticeSummary schema."""

    def test_summary_fields(self):
        """Test that summary has only id and name."""
        summary = PracticeSummary(id=1, name="Test Practice")
        assert summary.id == 1
        assert summary.name == "Test Practice"


class TestPracticeWithPractitioners:
    """Test PracticeWithPractitioners schema."""

    def test_default_practitioner_count(self):
        """Test that practitioner_count defaults to 0."""
        from datetime import datetime

        practice = PracticeWithPractitioners(
            id=1,
            name="Test Practice",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        assert practice.practitioner_count == 0

    def test_custom_practitioner_count(self):
        """Test setting practitioner_count."""
        from datetime import datetime

        practice = PracticeWithPractitioners(
            id=1,
            name="Test Practice",
            created_at=datetime.now(),
            updated_at=datetime.now(),
            practitioner_count=5,
        )
        assert practice.practitioner_count == 5
