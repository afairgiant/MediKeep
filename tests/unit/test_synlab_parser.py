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
    """Return a fresh Synlab parser."""
    return SynlabParser()


def by_name(results):
    """Index parsed results by canonical test name."""
    return {r.test_name: r for r in results}


class TestSynlabDetection:
    def test_detects_synlab_report(self, parser):
        """Detects synlab report."""
        assert parser.can_parse(SYNLAB_REPORT_TEXT) is True
        assert parser.can_parse(SYNLAB_REPORT_2023_TEXT) is True

    def test_rejects_other_labs(self, parser):
        """Rejects other labs."""
        assert parser.can_parse(LABCORP_CLEAN_TEXT) is False
        assert parser.can_parse(QUEST_DIAGNOSTICS_SAMPLE) is False
        assert parser.can_parse(EMPTY_PDF_TEXT) is False

    def test_mentioning_synlab_alone_is_not_enough(self, parser):
        """Mentioning synlab alone is not enough."""
        assert parser.can_parse("Befund von Synlab\nGlucose 95 mg/dl") is False

    def test_registry_routes_to_synlab(self):
        """Registry routes to synlab."""
        results, lab_name = lab_parser_registry.parse(SYNLAB_REPORT_TEXT)
        assert lab_name == "Synlab"
        assert len(results) > 0


class TestSynlabReport:
    def test_extracts_every_result_once(self, parser):
        """Extracts every result once."""
        results = parser.parse(SYNLAB_REPORT_TEXT)
        names = [r.test_name for r in results]
        assert len(names) == 29
        assert len(set(names)) == len(names)  # page-break repeat removed
        assert "Urea" in names

    def test_maps_codes_to_canonical_english_names(self, parser):
        """Maps codes to canonical english names."""
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
        """Value unit range and flag."""
        alt = by_name(parser.parse(SYNLAB_REPORT_TEXT))["Alanine Aminotransferase"]
        assert alt.value == 55.0
        assert alt.unit == "U/L"
        assert alt.reference_range == "<50.0"
        assert alt.flag == "High"

    def test_description_with_digits_keeps_the_real_value(self, parser):
        """Description with digits keeps the real value."""
        b12 = by_name(parser.parse(SYNLAB_REPORT_TEXT))["Vitamin B12"]
        assert b12.value == 412
        assert b12.unit == "pg/mL"
        assert b12.reference_range == "211-911"

    def test_units_are_normalized(self, parser):
        """Units are normalized."""
        results = by_name(parser.parse(SYNLAB_REPORT_TEXT))
        assert results["White Blood Cell Count"].unit == "K/uL"
        assert results["White Blood Cell Count"].value == 6.4
        assert results["Red Blood Cell Count"].unit == "M/uL"
        assert results["Iron"].unit == "umol/L"
        assert results["Thyroid Stimulating Hormone"].unit == "mIU/L"
        assert results["Total Cholesterol/HDL Ratio"].unit == "ratio"

    def test_values_stay_in_reported_units(self, parser):
        """Values stay in reported units."""
        calcium = by_name(parser.parse(SYNLAB_REPORT_TEXT))["Calcium"]
        assert calcium.value == 2.32
        assert calcium.unit == "mmol/L"

    def test_egfr_unit_left_for_library_default(self, parser):
        """Egfr unit left for library default."""
        egfr = by_name(parser.parse(SYNLAB_REPORT_TEXT))["Estimated GFR"]
        assert egfr.value == 104
        assert egfr.unit == ""
        assert egfr.reference_range == ">60"

    def test_below_limit_result_is_text(self, parser):
        """Below limit result is text."""
        crp = by_name(parser.parse(SYNLAB_REPORT_TEXT))["C-Reactive Protein"]
        assert crp.value is None
        assert crp.qualitative_value == "<0.15"

    def test_hint_blocks_and_panel_headers_are_skipped(self, parser):
        """Hint blocks and panel headers are skipped."""
        names = [r.test_name for r in parser.parse(SYNLAB_REPORT_TEXT)]
        assert not any("Kleines Blutbild" in n or "Zielwert" in n for n in names)

    def test_report_date(self, parser):
        """Report date."""
        results = parser.parse(SYNLAB_REPORT_TEXT)
        assert {r.test_date for r in results} == {"2025-03-15"}


class TestSynlab2023Layout:
    def test_counts_per_microliter_scaled_to_k_per_ul(self, parser):
        """Counts per microliter scaled to k per ul."""
        results = by_name(parser.parse(SYNLAB_REPORT_2023_TEXT))
        wbc = results["White Blood Cell Count"]
        assert wbc.value == 5.12
        assert wbc.unit == "K/uL"
        assert wbc.reference_range == "3.9-10.2"
        assert results["Red Blood Cell Count"].unit == "M/uL"
        assert results["Platelet Count"].unit == "K/uL"

    def test_minus_flag_means_low(self, parser):
        """Minus flag means low."""
        glucose = by_name(parser.parse(SYNLAB_REPORT_2023_TEXT))["Glucose"]
        assert glucose.value == 66
        assert glucose.flag == "Low"

    def test_tiered_ranges_are_kept_as_text(self, parser):
        """Tiered ranges are kept as text."""
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
        """Decimal comma."""
        egfr = by_name(parser.parse(SYNLAB_REPORT_2023_TEXT))["Estimated GFR"]
        assert egfr.value == 97.5

    def test_results_on_the_following_line(self, parser):
        """Results on the following line."""
        results = by_name(parser.parse(SYNLAB_REPORT_2023_TEXT))
        assert results["C-Reactive Protein"].qualitative_value == "<0.3"
        assert results["Intrinsic Factor Antibody"].qualitative_value == "<1.5"
        assert results["Hepatitis B Surface Antigen"].qualitative_value == "Positive"

    def test_qualitative_on_same_line(self, parser):
        """Qualitative on same line."""
        hcv = by_name(parser.parse(SYNLAB_REPORT_2023_TEXT))["Hepatitis C Antibody"]
        assert hcv.value is None
        assert hcv.qualitative_value == "Not Detected"

    def test_differential_percent_and_absolute(self, parser):
        """Differential percent and absolute."""
        results = by_name(parser.parse(SYNLAB_REPORT_2023_TEXT))
        assert results["Neutrophils"].unit == "%"
        assert results["Neutrophils (Absolute)"].value == 2.98
        assert results["Neutrophils (Absolute)"].unit == "K/uL"

    def test_ratio_and_antibody(self, parser):
        """Ratio and antibody."""
        results = by_name(parser.parse(SYNLAB_REPORT_2023_TEXT))
        assert results["LDL/HDL Ratio"].value == 1.9
        assert results["LDL/HDL Ratio"].reference_range == "<3"
        pca = results["Parietal Cell Antibody"]
        assert (pca.value, pca.unit, pca.reference_range) == (4.8, "U/mL", "<20")


# Made-up rows for the review fixes: capitalized qualitative words, two eGFR
# formulas, band vs segmented neutrophils, and a code whose description also
# names a differential cell type.
SYNLAB_EDGE_CASES_TEXT = """
Labor-Bericht vom 02.02.2024 - Endbefund
Synlab
Test Beschreibung +/- Ergebnis Einheit Normalwert
HEPC Anti-HCV Negativ
HBS. HBs-Antigen
Positiv
CKDEPI eGFR nach CKD-EPI 88 ml/min/1,7 >60
GFRKM GFR (MDRD-F.kurz,m) 91 ml/min/1.7 > 60
STABN Stabkernige Neutrophile 4.0 % 0.0 - 5.0
SEGN Segmentkernige Neutrophile 55.0 % 40.0 - 75.0
LEUK Leukozyten inkl. Lymphozyten 6.10 10^9/l 3.90-10.2
"""


class TestSynlabEdgeCases:
    def test_capitalized_qualitative_words(self, parser):
        """Capitalized qualitative words."""
        results = by_name(parser.parse(SYNLAB_EDGE_CASES_TEXT))
        assert results["Hepatitis C Antibody"].qualitative_value == "Negative"
        assert results["Hepatitis B Surface Antigen"].qualitative_value == "Positive"

    def test_different_tests_with_same_canonical_name_are_kept(self, parser):
        """Different tests with same canonical name are kept."""
        egfr = [
            r.value
            for r in parser.parse(SYNLAB_EDGE_CASES_TEXT)
            if r.test_name == "Estimated GFR"
        ]
        assert egfr == [88, 91]

    def test_band_cells_do_not_collapse_into_neutrophils(self, parser):
        """Band cells do not collapse into neutrophils."""
        results = by_name(parser.parse(SYNLAB_EDGE_CASES_TEXT))
        assert results["Band form Neutrophils"].value == 4.0
        assert results["Neutrophils"].value == 55.0

    def test_known_code_wins_over_description(self, parser):
        """Known code wins over description."""
        results = by_name(parser.parse(SYNLAB_EDGE_CASES_TEXT))
        assert results["White Blood Cell Count"].value == 6.1
        assert "Lymphocytes (Absolute)" not in results


# Made-up LDL row whose tiered target is split by a page break: Synlab
# repeats the row on the next page, followed by the remaining tiers.
SYNLAB_SPLIT_TIERS_TEXT = """
Labor-Bericht vom 03.03.2024 - Endbefund
Synlab
Test Beschreibung +/- Ergebnis Einheit Normalwert
LDLD LDL-Chol. direkt 118 mg/dl optimal: < 100
fast optimal: 100 - 129
Seite 1
Laborwerte von Dr. med. Erika Musterfrau
LDLD LDL-Chol. direkt 118 mg/dl optimal: < 100
grenzw. erhöht: 130 - 159
NA Natrium 139 mmol/l 136 - 145
"""


class TestSynlabPageBreakTiers:
    def test_tiers_after_a_repeated_row_are_merged(self, parser):
        """Tiers after a repeated row are merged."""
        results = parser.parse(SYNLAB_SPLIT_TIERS_TEXT)
        ldl = [r for r in results if r.test_name == "LDL Cholesterol"]
        assert len(ldl) == 1
        assert ldl[0].value == 118
        assert ldl[0].reference_range == (
            "optimal: < 100; fast optimal: 100 - 129; grenzw. erhöht: 130 - 159"
        )
        assert by_name(results)["Sodium"].value == 139


class TestSynlabRowsAndTiers:
    def test_tier_lines_do_not_swallow_the_next_test(self, parser):
        """A test with a digit in its name is not a tier of the previous range."""
        results = by_name(
            parser.parse(
                "HDL HDL-Chol. 64 mg/dl progn.günstig: > 60\n"
                "Risiko erhöht: < 40\n"
                "VITB12 Vitamin B12\n"
                "412 pg/ml 211-911"
            )
        )
        assert results["HDL Cholesterol"].reference_range == (
            "progn.günstig: > 60; Risiko erhöht: < 40"
        )
        assert results["Vitamin B12"].value == 412
        assert results["Vitamin B12"].unit == "pg/mL"
        assert results["Vitamin B12"].reference_range == "211-911"

    @pytest.mark.parametrize(
        "text, name, value",
        [
            ("VITB12 Vitamin B12\n412 pg/ml 211-911", "Vitamin B12", 412),
            ("HBA1C HbA1c\n5.4 % 4.0-6.0", "Hemoglobin A1c", 5.4),
            ("VITDE Vitamin D3\n27.9 ng/ml 20.0-70.0", "Vitamin D", 27.9),
            ("K Kalium\n4.2 mmol/l 3.5-5.1", "Potassium", 4.2),
        ],
    )
    def test_value_on_next_line(self, parser, text, name, value):
        """Digits in the name and one-letter codes work for next-line values."""
        result = by_name(parser.parse(text))[name]
        assert result.value == value

    def test_prose_is_not_read_as_a_one_letter_code(self, parser):
        """An unknown one-letter first word followed by a number is not a result."""
        assert parser.parse("A Bericht folgt\n12 Tage") == []

    def test_negative_lower_bound(self, parser):
        """A negative lower bound stays in the range column."""
        result = parser.parse("BE Base excess 1.2 mmol/l -2.0 - 3.0")[0]
        assert result.test_name == "Base excess"
        assert (result.value, result.unit) == (1.2, "mmol/L")
        assert result.reference_range == "-2.0-3.0"
        assert result.flag == ""

    def test_range_label_is_not_read_as_a_unit(self, parser):
        """A row without a unit keeps its whole labelled range."""
        result = parser.parse("CHQ Quotient 3.9 Risiko erhöht: > 5")[0]
        assert result.value == 3.9
        assert result.unit == ""
        assert result.reference_range == "Risiko erhöht: > 5"

    @pytest.mark.parametrize(
        "line, unit",
        [
            ("HDL HDL-Chol. 64 mg/dl optimal: > 60", "mg/dL"),
            ("MCH MCH 30.2 pg normal: 27 - 33", "pg"),
            ("CHQ Quotient 3.9 kA optimal: < 5", "ratio"),
        ],
    )
    def test_real_unit_before_a_labelled_range_is_kept(self, parser, line, unit):
        """Real units stay units when a labelled range follows."""
        assert parser.parse(line)[0].unit == unit

    def test_negative_value(self, parser):
        """A negative result is a value, while "- 66" with a space is a flag."""
        base_excess = parser.parse("BE Base excess -1.2 mmol/l -2.0 - 3.0")[0]
        assert (base_excess.test_name, base_excess.value) == ("Base excess", -1.2)
        assert base_excess.flag == ""
        glucose = parser.parse("GLS Glucose - 66 mg/dl 70 - 100")[0]
        assert (glucose.value, glucose.flag) == (66, "Low")

    def test_scaling_a_range_with_a_negative_bound(self, parser):
        """Scaling handles a negative bound instead of raising."""
        assert parser._scale_range("-2000 - 3000", 0.001) == "-2-3"

    def test_next_line_rows_collect_all_tiers(self, parser):
        """A next-line row reads its extra tiers like a same-line row."""
        result = parser.parse(
            "LDLD LDL-Chol. direkt\n"
            "121 mg/dl optimal: < 100\n"
            "fast optimal: 100 - 129\n"
            "NA Natrium 141 mmol/l 136 - 145"
        )
        assert result[0].reference_range == "optimal: < 100; fast optimal: 100 - 129"
        assert result[1].test_name == "Sodium"

    def test_tiered_range_is_scaled_with_the_value(self, parser):
        """A tier printed per microliter is scaled like the value."""
        result = parser.parse("LEU Leukozyten 5120 n/µl normal: 3900 - 10200")[0]
        assert (result.value, result.unit) == (5.12, "K/uL")
        assert result.reference_range == "normal: 3.9 - 10.2"

    def test_tiers_merged_after_a_page_break_are_scaled(self, parser):
        """A tier from a repeated row uses the same scale as the first copy."""
        results = parser.parse(
            "LEU Leukozyten 5120 n/µl normal: 3900 - 10200\n"
            "Seite 1\n"
            "LEU Leukozyten 5120 n/µl normal: 3900 - 10200\n"
            "hoch: > 10200"
        )
        assert len(results) == 1
        assert results[0].reference_range == "normal: 3.9 - 10.2; hoch: > 10.2"
