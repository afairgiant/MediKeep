"""Regression tests for #1093: insurance coverage/contact sub-titles in the
custom report PDF were printed as raw snake_case keys."""

import pytest

from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.report_translations import (
    SUPPORTED_LANGUAGES,
    ReportTranslator,
    get_translator,
)

# Keys the Insurance form writes into coverage_details / contact_info
# (frontend/src/utils/nestedFormUtils.js, insuranceFieldConfig).
COVERAGE_KEYS = [
    "primary_care_physician",
    "deductible_individual",
    "deductible_family",
    "copay_primary_care",
    "copay_specialist",
    "copay_emergency_room",
    "copay_urgent_care",
    "plan_type",
    "dental_plan_type",
    "vision_plan_type",
    "prescription_plan_type",
    "annual_maximum",
    "preventive_coverage",
    "basic_coverage",
    "major_coverage",
    "exam_copay",
    "frame_allowance",
    "lens_coverage",
    "contact_allowance",
    "bin_number",
    "pcn_number",
    "rxgroup",
    "copay_generic",
    "copay_brand",
    "copay_specialty",
    "pharmacy_network_info",
]
CONTACT_KEYS = [
    "customer_service_phone",
    "claims_address",
    "website_url",
    "preauth_phone",
    "provider_services_phone",
]


def _extract_text(story) -> str:
    return " ".join(str(el.text) for el in story if hasattr(el, "text"))


@pytest.fixture
def generator():
    gen = CustomReportPDFGenerator()
    gen.translator = get_translator("en", "mdy")
    return gen


class TestInsuranceDetailLabels:
    @pytest.mark.parametrize("lang", list(SUPPORTED_LANGUAGES))
    @pytest.mark.parametrize("key", COVERAGE_KEYS + CONTACT_KEYS)
    def test_every_form_key_has_a_label_in_every_language(self, lang, key):
        label = ReportTranslator(language=lang).insurance_detail(key)
        assert label and "_" not in label
        assert label != key

    def test_english_labels(self):
        t = ReportTranslator(language="en")
        assert t.insurance_detail("deductible_individual") == "Individual Deductible"
        assert t.insurance_detail("customer_service_phone") == "Customer Service Phone"

    def test_unknown_key_is_title_cased(self):
        t = ReportTranslator(language="en")
        assert t.insurance_detail("some_new_field") == "Some New Field"


class TestInsuranceReportSubtitles:
    def test_coverage_and_contact_keys_are_not_printed_as_snake_case(self, generator):
        record = {
            "company_name": "Acme Health",
            "coverage_details": {"deductible_individual": "500", "plan_type": "PPO"},
            "contact_info": {"customer_service_phone": "555-0100"},
        }
        text = _extract_text(generator._format_insurance([record]))

        for raw in ("deductible_individual", "plan_type", "customer_service_phone"):
            assert raw not in text
        assert "500" in text and "PPO" in text and "555-0100" in text

    def test_numeric_zero_is_kept(self, generator):
        record = {
            "company_name": "Acme Health",
            "coverage_details": {
                "deductible_individual": 0,
                "copay_generic": 0.0,
                "basic_coverage": "0",
                "plan_type": "PPO",
            },
            "contact_info": {"customer_service_phone": 0},
        }
        text = _extract_text(generator._format_insurance([record]))

        assert "Individual Deductible: 0" in text
        assert "Generic Copay: 0.0" in text
        assert "Basic Coverage %: 0" in text
        assert "Customer Service Phone: 0" in text

    @pytest.mark.parametrize("empty", [None, "", "   ", [], {}])
    def test_absent_and_empty_values_are_still_skipped(self, generator, empty):
        record = {
            "company_name": "Acme Health",
            "coverage_details": {"deductible_individual": empty, "plan_type": "PPO"},
            "contact_info": {"website_url": empty},
        }
        text = _extract_text(generator._format_insurance([record]))

        assert "Individual Deductible" not in text
        assert "Website" not in text
        assert "PPO" in text

    def test_section_is_omitted_when_every_value_is_empty(self, generator):
        record = {
            "company_name": "Acme Health",
            "coverage_details": {"deductible_individual": None, "plan_type": ""},
        }
        text = _extract_text(generator._format_insurance([record]))

        assert "Coverage:" not in text

    def test_empty_values_are_skipped(self, generator):
        record = {
            "company_name": "Acme Health",
            "coverage_details": {"deductible_individual": "", "plan_type": "PPO"},
        }
        text = _extract_text(generator._format_insurance([record]))
        assert "Individual Deductible" not in text
        assert "PPO" in text

    def test_section_prefixes_come_from_the_translator(self):
        gen = CustomReportPDFGenerator()
        gen.translator = get_translator("fr", "dmy")
        record = {
            "company_name": "Acme",
            "coverage_details": {"plan_type": "PPO"},
            "contact_info": {"website_url": "example.org"},
        }
        text = _extract_text(gen._format_insurance([record]))
        assert "Couverture" in text and "Contact" in text
        assert "Coverage:" not in text


class TestInsuranceRecordSeparation:
    """Each insurance record must start with a visually distinct header."""

    def test_each_record_starts_with_a_record_header(self, generator):
        records = [
            {"company_name": "Acme Health", "plan_name": "Gold"},
            {"company_name": "Beta Care"},
            {"company_name": "Gamma Plan", "is_primary": True},
        ]
        story = generator._format_insurance(records)

        headers = [
            el
            for el in story
            if hasattr(el, "style") and el.style.name == "RecordHeader"
        ]
        assert len(headers) == 3
        header_text = " ".join(str(h.text) for h in headers)
        for company in ("Acme Health", "Beta Care", "Gamma Plan"):
            assert company in header_text

    def test_record_header_is_shaded_and_spaced(self, generator):
        style = generator.styles["RecordHeader"]
        assert style.backColor is not None
        assert style.spaceBefore > 0
