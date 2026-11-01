"""Unit tests for the Synlab (Germany) lab report parser."""

import pytest

from app.services.lab_parsers import SynlabParser, lab_parser_registry
from tests.fixtures.lab_text_samples import (
    EMPTY_PDF_TEXT,
    LABCORP_CLEAN_TEXT,
    QUEST_DIAGNOSTICS_SAMPLE,
    SYNLAB_REPORT_2023_TEXT,
    SYNLAB_REPORT_TEXT,
)


@pytest.fixture
def parser():
    return SynlabParser()


def by_name(results):
    return {r.test_name: r for r in results}


class TestSynlabDetection:
    def test_detects_synlab_report(self, parser):
        assert parser.can_parse(SYNLAB_REPORT_TEXT) is True
        assert parser.can_parse(SYNLAB_REPORT_2023_TEXT) is True

    def test_rejects_other_labs(self, parser):
        assert parser.can_parse(LABCORP_CLEAN_TEXT) is False
        assert parser.can_parse(QUEST_DIAGNOSTICS_SAMPLE) is False
        assert parser.can_parse(EMPTY_PDF_TEXT) is False

    def test_mentioning_synlab_alone_is_not_enough(self, parser):
        assert parser.can_parse("Befund von Synlab\nGlucose 95 mg/dl") is False

    def test_registry_routes_to_synlab(self):
        results, lab_name = lab_parser_registry.parse(SYNLAB_REPORT_TEXT)
        assert lab_name == "Synlab"
        assert len(results) > 0


class TestSynlabReport:
    def test_extracts_every_result_once(self, parser):
        results = parser.parse(SYNLAB_REPORT_TEXT)
        names = [r.test_name for r in results]
        assert len(names) == 29
        assert len(set(names)) == len(names)  # page-break repeat removed
        assert "Urea" in names

    def test_maps_codes_to_canonical_english_names(self, parser):
        results = by_name(parser.parse(SYNLAB_REPORT_TEXT))
        for name in [
            "White Blood Cell Count",
            "Platelet Count",
            "Red Cell Distribution Width",
            "Aspartate Aminotransferase",
            "Alanine Aminotransferase",
            "Gamma-glutamyl Transferase",
            "Vitamin B12",
            "Folate (Folic Acid)",
            "Vitamin D",
            "Estimated GFR",
            "Thyroid Stimulating Hormone",
        ]:
            assert name in results, name

    def test_value_unit_range_and_flag(self, parser):
        alt = by_name(parser.parse(SYNLAB_REPORT_TEXT))["Alanine Aminotransferase"]
        assert alt.value == 55.0
        assert alt.unit == "U/L"
        assert alt.reference_range == "<50.0"
        assert alt.flag == "High"

    def test_description_with_digits_keeps_the_real_value(self, parser):
        b12 = by_name(parser.parse(SYNLAB_REPORT_TEXT))["Vitamin B12"]
        assert b12.value == 412
        assert b12.unit == "pg/mL"
        assert b12.reference_range == "211-911"

    def test_units_are_normalized(self, parser):
        results = by_name(parser.parse(SYNLAB_REPORT_TEXT))
        assert results["White Blood Cell Count"].unit == "K/uL"
        assert results["White Blood Cell Count"].value == 6.4
        assert results["Red Blood Cell Count"].unit == "M/uL"
        assert results["Iron"].unit == "umol/L"
        assert results["Thyroid Stimulating Hormone"].unit == "mIU/L"
        assert results["Total Cholesterol/HDL Ratio"].unit == "ratio"

    def test_values_stay_in_reported_units(self, parser):
        calcium = by_name(parser.parse(SYNLAB_REPORT_TEXT))["Calcium"]
        assert calcium.value == 2.32
        assert calcium.unit == "mmol/L"

    def test_egfr_unit_left_for_library_default(self, parser):
        egfr = by_name(parser.parse(SYNLAB_REPORT_TEXT))["Estimated GFR"]
        assert egfr.value == 104
        assert egfr.unit == ""
        assert egfr.reference_range == ">60"

    def test_below_limit_result_is_text(self, parser):
        crp = by_name(parser.parse(SYNLAB_REPORT_TEXT))["C-Reactive Protein"]
        assert crp.value is None
        assert crp.qualitative_value == "<0.15"

    def test_hint_blocks_and_panel_headers_are_skipped(self, parser):
        names = [r.test_name for r in parser.parse(SYNLAB_REPORT_TEXT)]
        assert not any("Kleines Blutbild" in n or "Zielwert" in n for n in names)

    def test_report_date(self, parser):
        results = parser.parse(SYNLAB_REPORT_TEXT)
        assert {r.test_date for r in results} == {"2025-03-15"}


class TestSynlab2023Layout:
    def test_counts_per_microliter_scaled_to_k_per_ul(self, parser):
        results = by_name(parser.parse(SYNLAB_REPORT_2023_TEXT))
        wbc = results["White Blood Cell Count"]
        assert wbc.value == 5.12
        assert wbc.unit == "K/uL"
        assert wbc.reference_range == "3.9-10.2"
        assert results["Red Blood Cell Count"].unit == "M/uL"
        assert results["Platelet Count"].unit == "K/uL"

    def test_minus_flag_means_low(self, parser):
        glucose = by_name(parser.parse(SYNLAB_REPORT_2023_TEXT))["Glucose"]
        assert glucose.value == 66
        assert glucose.flag == "Low"

    def test_tiered_ranges_are_kept_as_text(self, parser):
        results = by_name(parser.parse(SYNLAB_REPORT_2023_TEXT))
        assert results["HDL Cholesterol"].reference_range == (
            "progn.günstig: > 60; Risiko erhöht: < 40"
        )
        ldl = results["LDL Cholesterol"]
        assert ldl.value == 121
        assert ldl.reference_range.startswith("optimal: < 100; fast optimal: 100 - 129")
        # The tier lines must not swallow the next test.
        assert results["Sodium"].value == 141

    def test_decimal_comma(self, parser):
        egfr = by_name(parser.parse(SYNLAB_REPORT_2023_TEXT))["Estimated GFR"]
        assert egfr.value == 97.5

    def test_results_on_the_following_line(self, parser):
        results = by_name(parser.parse(SYNLAB_REPORT_2023_TEXT))
        assert results["C-Reactive Protein"].qualitative_value == "<0.3"
        assert results["Intrinsic Factor Antibody"].qualitative_value == "<1.5"
        assert results["Hepatitis B Surface Antigen"].qualitative_value == "Positive"

    def test_qualitative_on_same_line(self, parser):
        hcv = by_name(parser.parse(SYNLAB_REPORT_2023_TEXT))["Hepatitis C Antibody"]
        assert hcv.value is None
        assert hcv.qualitative_value == "Not Detected"

    def test_differential_percent_and_absolute(self, parser):
        results = by_name(parser.parse(SYNLAB_REPORT_2023_TEXT))
        assert results["Neutrophils"].unit == "%"
        assert results["Neutrophils (Absolute)"].value == 2.98
        assert results["Neutrophils (Absolute)"].unit == "K/uL"

    def test_ratio_and_antibody(self, parser):
        results = by_name(parser.parse(SYNLAB_REPORT_2023_TEXT))
        assert results["LDL/HDL Ratio"].value == 1.9
        assert results["LDL/HDL Ratio"].reference_range == "<3"
        pca = results["Parietal Cell Antibody"]
        assert (pca.value, pca.unit, pca.reference_range) == (4.8, "U/mL", "<20")
