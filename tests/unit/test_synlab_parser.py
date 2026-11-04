"""Unit tests for the Synlab (Germany) lab report parser."""

import pytest

from app.services.lab_parsers import SynlabParser, lab_parser_registry
from app.services.pdf_text_extraction_service import pdf_extraction_service
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

    def test_egfr_keeps_its_unit(self, parser):
        """The cut-off eGFR unit is printed in full."""
        egfr = by_name(parser.parse(SYNLAB_REPORT_TEXT))["Estimated GFR"]
        assert egfr.value == 104
        assert egfr.unit == "mL/min/1.73m2"
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

    def test_number_at_the_end_of_a_name_is_not_the_value(self, parser):
        """Synlab prints "Vitamin B 12", so 12 must not be read as the result."""
        result = parser.parse("VITB12 Vitamin B 12\n412 pg/ml 211-911")
        assert len(result) == 1
        assert (result[0].value, result[0].unit) == (412, "pg/mL")

    def test_row_ending_in_its_value_keeps_it(self, parser):
        """A unit-less value stays when the next line is another test."""
        results = parser.parse("XQ Quotient 12\nNA Natrium 141 mmol/l 136 - 145")
        assert results[0].value == 12
        assert results[1].value == 141

    @pytest.mark.parametrize(
        "line, name, unit",
        [
            (
                "KCL Kreatinin-Clearance 110 ml/min 80-140",
                "Kreatinin-Clearance",
                "mL/min",
            ),
            (
                "ACR Albumin/Kreatinin-Quotient 12 mg/g <30",
                "Albumin/Kreatinin-Quotient",
                "mg/g",
            ),
        ],
    )
    def test_creatinine_derived_tests_keep_their_own_name(
        self, parser, line, name, unit
    ):
        """Clearance and ratio tests stay off the creatinine trend."""
        result = parser.parse(line)[0]
        assert (result.test_name, result.unit) == (name, unit)

    def test_plain_creatinine_still_maps(self, parser):
        """An unknown code with a creatinine description still links."""
        assert parser.parse("KREX Kreatinin 0.9 mg/dl 0.7-1.2")[0].test_name == (
            "Creatinine"
        )

    @pytest.mark.parametrize(
        "line, name",
        [
            ("XLH LDL/HDL - Index: 1.9 kA < 3", "LDL/HDL Ratio"),
            ("XCH Chol./HDL-Quotient 3.9 kA <5", "Total Cholesterol/HDL Ratio"),
        ],
    )
    def test_ratios_in_the_library_still_map(self, parser, line, name):
        """Ratios with a library entry aren't caught by the quotient check."""
        assert parser.parse(line)[0].test_name == name

    @pytest.mark.parametrize(
        "line, name",
        [
            ("ULEU Leukozyten im Urin 12 /µl <25", "Leukozyten im Urin"),
            ("UGLU Glucose i. U. 15 mg/dl <30", "Glucose i. U."),
            ("UKRE Sammelurin-Kreatinin 1.2 g/l 0.5-2.0", "Sammelurin-Kreatinin"),
            ("XBILI Bilirubin indirekt 0.4 mg/dl <0.8", "Bilirubin indirekt"),
        ],
    )
    def test_other_tests_keep_their_own_name(self, parser, line, name):
        """Urine tests and indirect bilirubin stay off the blood test trends."""
        assert parser.parse(line)[0].test_name == name

    def test_direct_bilirubin(self, parser):
        """Direct bilirubin has its own library test."""
        assert parser.parse("XBILD Bilirubin direkt 0.2 mg/dl <0.3")[0].test_name == (
            "Direct Bilirubin"
        )

    @pytest.mark.parametrize(
        "line, name",
        [
            ("XHS Harnsäure 5.1 mg/dl 3.4-7.0", "Uric Acid"),
            ("XHST Harnstoff 29 mg/dl 19-44", "Urea"),
            ("XBIL Bilirubin gesamt 0.6 mg/dl <1.2", "Total Bilirubin"),
        ],
    )
    def test_similar_names_still_map(self, parser, line, name):
        """Harn- names and total bilirubin aren't caught by the check."""
        assert parser.parse(line)[0].test_name == name


class TestSynlabHintBlocks:
    def test_all_lines_of_a_hint_block_are_skipped(self, parser):
        """Target values in a hint block don't become results."""
        assert (
            parser.parse(
                "Hinweise: Zielwerte\nESC 2019: LDL < 55\nCV Risiko Zielwert < 116"
            )
            == []
        )

    @pytest.mark.parametrize(
        "line, name",
        [
            ("NHDL Non-HDL-Cholesterin + 173 mg/dl <145", "Non-HDL Cholesterol"),
            ("CRP C-reak.Protein <0.15 mg/dl <0.50", "C-Reactive Protein"),
            ("HEPC Anti-HCV negativ", "Hepatitis C Antibody"),
            ("XQ Unbekannter Test 12 mg/dl 5-20", "Unbekannter Test"),
        ],
    )
    def test_next_result_row_ends_the_block(self, parser, line, name):
        """Parsing resumes at the first row that looks like a result."""
        results = parser.parse(f"Hinweise: Zielwerte\nCV Risiko Zielwert < 116\n{line}")
        assert [r.test_name for r in results] == [name]

    def test_next_line_row_ends_the_block(self, parser):
        """A row with its value on the next line also ends the block."""
        results = parser.parse(
            "Hinweise: Zielwerte\nserum ratsam.\nVITB12 Vitamin B 12\n412 pg/ml 211-911"
        )
        assert [(r.test_name, r.value) for r in results] == [("Vitamin B12", 412)]

    def test_panel_header_ends_the_block(self, parser):
        """A panel header ends the block and yields no result itself."""
        results = parser.parse(
            "Hinweise: Zielwerte\nKBBX Kleines Blutbild\nHB Hämoglobin 14.2 g/dl 13.5-17.2"
        )
        assert [r.test_name for r in results] == ["Hemoglobin"]

    def test_page_header_ends_the_block(self, parser):
        """The next page starts fresh, even with a unit-less first row."""
        results = parser.parse(
            "Hinweise: Zielwerte\n"
            "Seite 1\n"
            "Laborwerte von Dr. Muster\n"
            "XQ Quotient 12"
        )
        assert [r.value for r in results] == [12]


class TestSynlabComparisonResults:
    def test_keeps_unit_flag_and_range(self, parser):
        """A <, > result keeps what is needed to read it: mg/l vs mg/dl is 10x."""
        result = parser.parse("CRP CRP + >60 mg/l <5")[0]
        assert result.value is None
        assert result.qualitative_value == ">60"
        assert (result.unit, result.flag, result.reference_range) == (
            "mg/L",
            "High",
            "<5",
        )

    def test_next_line_value_keeps_unit_and_range(self, parser):
        """The same applies when the value is on the next line."""
        result = parser.parse("CRP CRP quantitativ\n< 0.3 mg/dl < 0.5")[0]
        assert result.qualitative_value == "<0.3"
        assert (result.unit, result.reference_range) == ("mg/dL", "<0.5")

    def test_keeps_tiers_also_after_a_page_break(self, parser):
        """Tiers are collected and merged as for numeric results."""
        results = parser.parse(
            "HDL HDL-Chol. >90 mg/dl progn.günstig: > 60\n"
            "Seite 1\n"
            "HDL HDL-Chol. >90 mg/dl progn.günstig: > 60\n"
            "Risiko erhöht: < 40"
        )
        assert len(results) == 1
        assert results[0].reference_range == (
            "progn.günstig: > 60; Risiko erhöht: < 40"
        )

    def test_counts_are_scaled(self, parser):
        """Value and range use the same scale, as for numeric results."""
        result = parser.parse("LEU Leukozyten <2000 n/µl 3900 - 10200")[0]
        assert result.qualitative_value == "<2"
        assert (result.unit, result.reference_range) == ("K/uL", "3.9-10.2")


class TestSynlabFormattedText:
    """The text the extraction service hands to Bulk Entry."""

    @staticmethod
    def formatted_lines(text):
        result = pdf_extraction_service._try_lab_specific_parsing(
            text, extraction_method="native"
        )
        return result["text"].split("\n")

    def test_comparison_result_line(self):
        """Comparison results use the normal line format."""
        assert "C-Reactive Protein: <0.15 mg/dL (<0.50)" in self.formatted_lines(
            SYNLAB_REPORT_TEXT
        )

    def test_flagged_comparison_result_line(self):
        """A flag follows the range, as on numeric lines."""
        text = SYNLAB_REPORT_TEXT.replace(
            "CRP C-reak.Protein <0.15 mg/dl <0.50",
            "CRP C-reak.Protein + >60 mg/l <5",
        )
        assert "C-Reactive Protein: >60 mg/L (<5) [High]" in self.formatted_lines(text)

    def test_qualitative_result_line_stays_bare(self):
        """A qualitative result stays bare for the Bulk Entry qualitative matcher."""
        assert "Hepatitis C Antibody: Not Detected" in self.formatted_lines(
            SYNLAB_REPORT_2023_TEXT
        )

    def test_egfr_line_keeps_unit_and_range(self):
        """The eGFR line has the unit and the range."""
        assert "Estimated GFR: 104.0 mL/min/1.73m2 (>60)" in self.formatted_lines(
            SYNLAB_REPORT_TEXT
        )


class TestSynlabMeasuredValueWins:
    """A number or word from the range column must never replace the value."""

    @pytest.mark.parametrize(
        "line, value, unit, reference_range",
        [
            ("K Kalium 4.2 mmol/l 3.5 bis 5.1", 4.2, "mmol/L", "3.5 bis 5.1"),
            ("K Kalium 4.2 mmol/l ≤ 5.1", 4.2, "mmol/L", "≤5.1"),
            ("CK CK 120 U/l ≤190", 120, "U/L", "≤190"),
            (
                "TSH TSH 1.5 mU/l 0.27 - 4.2 (Erw.)",
                1.5,
                "mIU/L",
                "0.27 - 4.2 (Erw.)",
            ),
            ("HEPC Anti-HCV 0.1 S/CO negativ", 0.1, "S/CO", "negativ"),
        ],
    )
    def test_any_range_text(self, parser, line, value, unit, reference_range):
        """Range text the patterns don't know stays in the range."""
        result = parser.parse(line)[0]
        assert (result.value, result.unit) == (value, unit)
        assert result.reference_range == reference_range
        assert result.flag == ""

    def test_comparison_range_with_a_unit(self, parser):
        """A range that repeats the unit doesn't replace the value."""
        result = parser.parse("CRP C-reak.Protein 0.3 mg/dl < 0.5 mg/dl")[0]
        assert (result.value, result.reference_range) == (0.3, "< 0.5 mg/dl")

    def test_flagged_value_with_a_qualitative_range(self, parser):
        """A reactive index keeps its flag instead of reading as Negative."""
        result = parser.parse("HBS HBs-Antigen + 1.5 Index negativ")[0]
        assert (result.value, result.flag) == (1.5, "High")
        assert result.qualitative_value == ""
        assert (result.unit, result.reference_range) == ("Index", "negativ")

    def test_qualitative_range_without_a_unit(self, parser):
        """The word isn't read as a unit."""
        result = parser.parse("HBS HBs-Antigen 0.3 negativ")[0]
        assert (result.value, result.unit) == (0.3, "")
        assert result.reference_range == "negativ"

    def test_free_range_is_scaled_with_the_value(self, parser):
        """Range text uses the same scale as the value."""
        result = parser.parse("LEU Leukozyten 5120 n/µl 3900 bis 10200")[0]
        assert (result.value, result.reference_range) == (5.12, "3.9 bis 10.2")

    @pytest.mark.parametrize(
        "line, value",
        [
            ("VITB12 Vitamin B 12 412 pg/ml 211-911", 412),
            ("CKDEPI eGFR 2021 Formel 88 ml/min/1,7 >60", 88),
        ],
    )
    def test_numbers_in_a_name_are_still_not_values(self, parser, line, value):
        """A number in the name isn't taken for the measured value."""
        assert parser.parse(line)[0].value == value

    def test_unitless_decimal_is_not_part_of_the_name(self, parser):
        """Only a whole number can be the end of a name."""
        result = parser.parse("LDLHDL LDL/HDL-Quotient 2.5\n5.0 mg/dl <7")
        assert result[0].value == 2.5

    def test_comparison_on_next_line_does_not_replace_the_value(self, parser):
        """A target such as "< 3.5 Risiko" isn't the real value."""
        result = parser.parse("LDLHDL LDL/HDL-Quotient 2\n< 3.5 Risiko")
        assert result[0].value == 2

    @pytest.mark.parametrize(
        "unit, expected", [("10^3/µl", "K/uL"), ("10^6/µl", "M/uL")]
    )
    def test_other_powers_of_ten(self, parser, unit, expected):
        """These spellings would reach Bulk Entry as the unit "10"."""
        assert parser.parse(f"RET Retikulozyten 50 {unit} 25-100")[0].unit == expected


class TestSynlabNamesWithKnownCodes:
    @pytest.mark.parametrize(
        "line, name",
        [
            ("LEU Leukozyten im Urin 12 /µl <25", "Leukozyten im Urin"),
            ("ERY Erythrozyten im Urin 3 /µl <10", "Erythrozyten im Urin"),
            ("KREA Kreatinin im Urin 120 mg/dl", "Kreatinin im Urin"),
            ("KREA Kreatinin-Clearance 110 ml/min 80-140", "Kreatinin-Clearance"),
            ("BIL Bilirubin indirekt 0.4 mg/dl <0.8", "Bilirubin indirekt"),
            ("BIL Bilirubin direkt 0.2 mg/dl <0.3", "Direct Bilirubin"),
        ],
    )
    def test_description_more_specific_than_code(self, parser, line, name):
        """Reusing a blood test's code doesn't put these on its trend."""
        assert parser.parse(line)[0].test_name == name

    @pytest.mark.parametrize(
        "line, name",
        [
            ("TSHR TSH-Rezeptor-AK 0.5 IU/l <1.75", "TSH-Rezeptor-AK"),
            ("GLYK Glykohämoglobin 6.1 % 4-6", "Glykohämoglobin"),
            ("VIT125 1,25-OH-Vitamin D 40 pg/ml 20-80", "1,25-OH-Vitamin D"),
        ],
    )
    def test_related_analytes_keep_their_name(self, parser, line, name):
        """A different analyte with a similar name stays off the trend."""
        assert parser.parse(line)[0].test_name == name

    def test_quotient_with_a_known_code_still_maps(self, parser):
        """A known code still wins over a generic description."""
        result = parser.parse("CHQ Quotient 3.9 kA <5")[0]
        assert result.test_name == "Total Cholesterol/HDL Ratio"


class TestSynlabHintBlockEnds:
    @pytest.mark.parametrize(
        "hint",
        ["LDL Zielwert < 70 mg/dl", "CV Risiko Zielwert 116 mg/dl", "LDL < 70 mg/dl"],
    )
    def test_targets_that_look_like_results_stay_in_the_block(self, parser, hint):
        """Target values with a unit are still hint text."""
        assert parser.parse(f"Hinweise: Zielwerte\n{hint}") == []

    @pytest.mark.parametrize(
        "line, value",
        [("HB Hämoglobin 14", 14), ("XQ Foo 12 mg/dl", 12), ("XQ Foo 12 5-20", 12)],
    )
    def test_plain_results_end_the_block(self, parser, line, value):
        """A known code, unit or range is enough for a non-comparison value."""
        assert parser.parse(f"Hinweise: Zielwerte\n{line}")[0].value == value

    def test_comparison_result_with_unit_and_range_ends_the_block(self, parser):
        """An unknown code keeps its result if the row has both."""
        result = parser.parse("Hinweise: x\nXYZ Foo <0.2 mg/dl <0.5")[0]
        assert result.qualitative_value == "<0.2"


class TestSynlabScannedLayouts:
    """Layouts from real reports, with made-up values."""

    def test_tiers_with_text_after_the_range(self, parser):
        """Tier lines can start with a range or end in text."""
        results = parser.parse(
            "VITDL 25-OH-Vitamin D 41.5 ng/ml Empfohlene Spiegel:\n"
            "gesamt 20 - 70 bei Jüngeren\n"
            "25 - 70 ab etwa 50 Jahre\n"
            "> 30 optimaler Spiegel\n"
            "< 10 schwerer Mangel\n"
            "NA Natrium 141 mmol/l 136 - 145"
        )
        assert results[0].reference_range == (
            "Empfohlene Spiegel:; gesamt 20 - 70 bei Jüngeren; "
            "25 - 70 ab etwa 50 Jahre; > 30 optimaler Spiegel; < 10 schwerer Mangel"
        )
        assert results[1].test_name == "Sodium"

    def test_unit_and_range_on_the_row_with_the_value_below(self, parser):
        """The range bound on the row is not the result."""
        results = parser.parse(
            "CRP CRP quantitativ mg/dl < 0.5\n< 0.2\nNA Natrium 141 mmol/l 136 - 145"
        )
        assert results[0].qualitative_value == "<0.2"
        assert (results[0].unit, results[0].reference_range) == ("mg/dL", "<0.5")
        assert results[1].value == 141

    def test_numeric_value_below_with_a_flag(self, parser):
        """The next line can hold a flag and a number."""
        result = parser.parse("FE Eisen mmol/l 12.5-32.2\n+ 40.1")[0]
        assert (result.value, result.flag) == (40.1, "High")
        assert (result.unit, result.reference_range) == ("mmol/L", "12.5-32.2")

    def test_value_below_ends_a_hint_block(self, parser):
        """This layout is a result row, even though its range is a comparison."""
        results = parser.parse("Hinweise: x\nCRP CRP quantitativ mg/dl < 0.5\n< 0.2")
        assert results[0].qualitative_value == "<0.2"

    def test_row_with_a_comparison_range_keeps_its_own_value(self, parser):
        """A normal row followed by another test is unchanged."""
        results = parser.parse(
            "CRP C-reak.Protein 0.3 mg/dl < 0.5\nNA Natrium 141 mmol/l 136 - 145"
        )
        assert results[0].value == 0.3
