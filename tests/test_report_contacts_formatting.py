"""Tests for practitioner and pharmacy contact details in the custom report.

Pharmacies store address parts (street_address, city, state, zip_code, country),
not a single "address"; practitioners have no address of their own, only their
practice's locations. Both were missing from the report.
"""

import asyncio
from datetime import date

import pytest

from app.models.models import Practice, Practitioner
from app.models.practice import MedicalSpecialty
from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.custom_report_service import CustomReportService
from app.services.report_translations import get_translator
from tests.utils.report_story import story_texts

@pytest.fixture
def generator():
    gen = CustomReportPDFGenerator()
    gen.translator = get_translator("en", "mdy")
    return gen


def _text(story) -> str:
    return " ".join(story_texts(story))


class TestJoinAddress:
    def test_full_address(self):
        join = CustomReportPDFGenerator._join_address
        assert (
            join("123 Main St", "Springfield", "IL", "62701", "USA")
            == "123 Main St, Springfield, IL 62701, USA"
        )

    def test_skips_missing_parts(self):
        join = CustomReportPDFGenerator._join_address
        assert join("123 Main St", None, "IL", None) == "123 Main St, IL"
        assert join(None, "Springfield", None, "62701") == "Springfield, 62701"
        assert join("", " ", None, None) == ""


def _paragraph_texts(story):
    return story_texts(story)


class TestPharmacyFormatting:
    def test_address_phone_and_website_are_on_separate_lines(self, generator):
        story = generator._format_pharmacies(
            [
                {
                    "name": "CVS",
                    "street_address": "123 Main St",
                    "city": "Springfield",
                    "phone_number": "555-0100",
                    "website": "https://cvs.example",
                }
            ]
        )
        lines = [t.strip() for t in _paragraph_texts(story)]
        assert lines[1:] == [
            "Address: 123 Main St, Springfield",
            "Phone Number: 555-0100",
            "Website: https://cvs.example",
        ]
        assert not any("|" in line for line in lines)

    def test_only_present_details_get_a_line(self, generator):
        story = generator._format_pharmacies(
            [{"name": "P", "phone_number": "555-0100"}]
        )
        lines = [t.strip() for t in _paragraph_texts(story)]
        assert lines[1:] == ["Phone Number: 555-0100"]

    def test_address_phone_and_website_are_printed(self, generator):
        story = generator._format_pharmacies(
            [
                {
                    "name": "CVS - Main Street",
                    "street_address": "123 Main St",
                    "city": "Springfield",
                    "state": "IL",
                    "zip_code": "62701",
                    "phone_number": "555-0100",
                    "website": "https://cvs.example",
                }
            ]
        )
        text = _text(story)
        assert "Address: 123 Main St, Springfield, IL 62701" in text
        assert "555-0100" in text
        assert "https://cvs.example" in text

    def test_long_address_is_not_truncated(self, generator):
        street = "1234 A Very Long Boulevard Name That Goes On " * 3
        story = generator._format_pharmacies(
            [{"name": "P", "street_address": street.strip(), "city": "Springfield"}]
        )
        assert street.strip() in _text(story)
        assert "..." not in _text(story)

    def test_pharmacy_without_contact_details_prints_only_the_name(self, generator):
        story = generator._format_pharmacies([{"name": "Bare Pharmacy"}])
        text = _text(story)
        assert "Bare Pharmacy" in text
        assert "Address" not in text and "Website" not in text


class TestPractitionerFormatting:
    def test_details_are_on_separate_lines(self, generator):
        story = generator._format_practitioners(
            [
                {
                    "name": "Dr. Smith",
                    "specialty": "Cardiology",
                    "practice": "Heart Clinic",
                    "phone_number": "555-0111",
                    "website": "https://heart.example",
                    "locations": [
                        {"label": "Main", "address": "1 Heart Way", "city": "Town"}
                    ],
                }
            ]
        )
        lines = [t.strip() for t in _paragraph_texts(story)]
        assert lines[1:] == [
            "Practice: Heart Clinic",
            "Phone Number: 555-0111",
            "Website: https://heart.example",
            "Address: Main - 1 Heart Way, Town",
        ]
        assert not any("|" in line for line in lines)

    def test_only_present_details_get_a_line(self, generator):
        story = generator._format_practitioners(
            [{"name": "Dr. Smith", "phone_number": "555-0111"}]
        )
        lines = [t.strip() for t in _paragraph_texts(story)]
        assert lines[1:] == ["Phone Number: 555-0111"]

    def test_each_practice_location_prints_as_an_address_line(self, generator):
        story = generator._format_practitioners(
            [
                {
                    "name": "Dr. Smith",
                    "specialty": "Cardiology",
                    "practice": "Heart Clinic",
                    "phone_number": "555-0111",
                    "website": "https://heart.example",
                    "locations": [
                        {
                            "label": "Main",
                            "address": "1 Heart Way",
                            "city": "Springfield",
                            "state": "IL",
                            "zip": "62701",
                        },
                        {"address": "9 Side St", "city": "Shelbyville"},
                    ],
                }
            ]
        )
        text = _text(story)
        assert "Address: Main - 1 Heart Way, Springfield, IL 62701" in text
        assert "Address: 9 Side St, Shelbyville" in text
        assert "555-0111" in text and "https://heart.example" in text

    def test_empty_locations_print_no_address_line(self, generator):
        story = generator._format_practitioners(
            [
                {
                    "name": "Dr. Smith",
                    "locations": [{"label": "Empty"}, {}],
                }
            ]
        )
        assert "Address" not in _text(story)

    def test_practitioner_without_locations_key(self, generator):
        story = generator._format_practitioners([{"name": "Dr. Jones"}])
        assert "Dr. Jones" in _text(story)


class TestPractitionerRecordEnrichment:
    """The service must supply specialty and practice locations."""

    def test_selected_practitioner_includes_specialty_and_locations(
        self, db_session, test_user
    ):
        specialty = MedicalSpecialty(name="Cardiology", is_active=True)
        db_session.add(specialty)
        practice = Practice(
            name="Heart Clinic",
            locations=[
                {"label": "Main", "address": "1 Heart Way", "city": "Springfield"}
            ],
        )
        db_session.add(practice)
        db_session.flush()
        practitioner = Practitioner(
            name="Dr. Smith", specialty_id=specialty.id, practice_id=practice.id
        )
        db_session.add(practitioner)
        db_session.commit()

        service = CustomReportService(db_session)
        records = asyncio.run(
            service._get_selected_records(1, "practitioners", [practitioner.id])
        )

        assert records[0]["specialty"] == "Cardiology"
        assert records[0]["practice"] == "Heart Clinic"
        assert records[0]["locations"][0]["address"] == "1 Heart Way"

    def test_practitioner_without_a_practice_has_no_locations(
        self, db_session, test_user
    ):
        specialty = MedicalSpecialty(name="Dermatology", is_active=True)
        db_session.add(specialty)
        db_session.flush()
        practitioner = Practitioner(name="Dr. Solo", specialty_id=specialty.id)
        db_session.add(practitioner)
        db_session.commit()

        service = CustomReportService(db_session)
        records = asyncio.run(
            service._get_selected_records(1, "practitioners", [practitioner.id])
        )

        assert records[0]["specialty"] == "Dermatology"
        assert "locations" not in records[0]
