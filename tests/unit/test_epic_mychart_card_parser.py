"""
Unit tests for the Epic MyChart card/gauge "Test Details" parser.

Fixtures are synthetic layout-preserved pages (no real patient data) built to
reproduce the structural quirks of the real export: two-column cards, doubled-
digit gauge artifacts, "Normal value:" anchors, value+flag lines, and non-
numeric values.
"""

import pytest

from app.services.lab_parsers import LabParserRegistry
from app.services.lab_parsers.epic_mychart_card_parser import EpicMyChartCardParser
from tests.fixtures.lab_text_samples import (
    EPIC_MYCHART_RENAL_PANEL,
    LABCORP_CLEAN_TEXT,
    QUEST_DIAGNOSTICS_SAMPLE,
    EMPTY_PDF_TEXT,
)

GUTTER = 46
LEFT_INDENT = "        "


def build_page(cards, collected="Collected on Jul 07, 2025 3:10 PM", footer_lab=None):
    """Assemble a layout-preserved page from ``cards``.

    Each card is an ``(left_lines, right_lines)`` tuple. Right-column content is
    placed at a fixed gutter column so the parser's anchor-based column
    detection sees a consistent split point.
    """
    lines = [
        "   8/6/25, 12:10 PM".ljust(40) + "MyChart - Test Details",
        LEFT_INDENT + "SAMPLE PANEL",
        LEFT_INDENT + collected,
        "       Results",
    ]
    for left_lines, right_lines in cards:
        rows = max(len(left_lines), len(right_lines))
        for r in range(rows):
            left = left_lines[r] if r < len(left_lines) else ""
            right = right_lines[r] if r < len(right_lines) else ""
            left_cell = LEFT_INDENT + left
            if right:
                lines.append(left_cell.ljust(GUTTER) + right)
            else:
                lines.append(left_cell)
    if footer_lab:
        lines.append(LEFT_INDENT + f"Performed at: 01 - {footer_lab}")
    lines.append(LEFT_INDENT + "Authorizing provider: Ronald Oglesby, DO")
    lines.append(LEFT_INDENT + "Result status: Final")
    lines.append(
        LEFT_INDENT + "MyChart licensed from Epic Systems Corporation 1999 - 2025"
    )
    lines.append(
        LEFT_INDENT + "https://mychart.example.com/UPC/app/test-results/details?x=1"
    )
    return "\n".join(lines)


# A two-column CBC-like page with numeric values, a High flag, and doubled gauges.
TWO_COLUMN_CBC = build_page(
    [
        (
            [
                "WBC",
                "Normal range: 3.4 - 10.8 x10E3/uL",
                "14.2 High",
                "33..44 1100..88",
            ],
            ["RBC", "Normal range: 4.14 - 5.80 x10E6/uL", "4.88", "44..1144 55..88"],
        ),
        (
            ["Hemoglobin", "Normal range: 13.0 - 17.7 g/dL", "15.0", "1133 1177..77"],
            ["Hematocrit", "Normal range: 37.5 - 51.0 %", "43.4", "3377..55 5511"],
        ),
    ]
)

# A two-column urinalysis page with qualitative "Normal value:" cards.
TWO_COLUMN_QUALITATIVE = build_page(
    [
        (
            ["Protein, UA", "Normal value: Negative", "Value", "Negative"],
            ["Glucose, UA", "Normal value: Negative", "Value", "3+"],
        ),
    ]
)

# A single-column GFR card whose value is an inequality (">60").
GFR_INEQUALITY = build_page(
    [
        (["GFR Calculation", "Normal value: >=60 mL/min", "Value", ">60"], []),
    ]
)

# A single-column card using "Normal value: Not Estab." with a numeric value.
NOT_ESTAB_NUMERIC = build_page(
    [
        (["Creatinine, Ur", "Normal value: Not Estab. mg/dL", "Value", "398.9"], []),
    ]
)


class TestCardDetection:
    @pytest.fixture
    def parser(self):
        return EpicMyChartCardParser()

    def test_detects_two_column_card(self, parser):
        assert parser.can_parse(TWO_COLUMN_CBC) is True

    def test_detects_qualitative_card(self, parser):
        assert parser.can_parse(TWO_COLUMN_QUALITATIVE) is True

    def test_rejects_single_column_epic_text(self, parser):
        # The simple single-column format belongs to the fallback parser.
        assert parser.can_parse(EPIC_MYCHART_RENAL_PANEL) is False

    def test_rejects_labcorp(self, parser):
        assert parser.can_parse(LABCORP_CLEAN_TEXT) is False

    def test_rejects_quest(self, parser):
        assert parser.can_parse(QUEST_DIAGNOSTICS_SAMPLE) is False

    def test_rejects_empty(self, parser):
        assert parser.can_parse(EMPTY_PDF_TEXT) is False
        assert parser.can_parse("") is False


class TestTwoColumnParsing:
    @pytest.fixture
    def parser(self):
        return EpicMyChartCardParser()

    def test_extracts_all_four_components(self, parser):
        results = parser.parse(TWO_COLUMN_CBC)
        names = {r.test_name for r in results}
        assert names == {"WBC", "RBC", "Hemoglobin", "Hematocrit"}

    def test_left_and_right_values(self, parser):
        results = {r.test_name: r for r in parser.parse(TWO_COLUMN_CBC)}
        assert results["WBC"].value == 14.2
        assert results["RBC"].value == 4.88
        assert results["Hemoglobin"].value == 15.0
        assert results["Hematocrit"].value == 43.4

    def test_units_and_ranges(self, parser):
        results = {r.test_name: r for r in parser.parse(TWO_COLUMN_CBC)}
        assert results["WBC"].unit == "x10E3/uL"
        assert results["WBC"].reference_range == "3.4 - 10.8"
        assert results["RBC"].reference_range == "4.14 - 5.80"

    def test_explicit_flag_preserved(self, parser):
        results = {r.test_name: r for r in parser.parse(TWO_COLUMN_CBC)}
        assert results["WBC"].flag == "High"

    def test_gauge_lines_not_taken_as_values(self, parser):
        # 14.2 must win over the doubled gauge "33..44 1100..88".
        results = {r.test_name: r for r in parser.parse(TWO_COLUMN_CBC)}
        for name, expected in {
            "WBC": 14.2,
            "RBC": 4.88,
            "Hemoglobin": 15.0,
            "Hematocrit": 43.4,
        }.items():
            assert results[name].value == expected


class TestQualitativeParsing:
    @pytest.fixture
    def parser(self):
        return EpicMyChartCardParser()

    def test_negative_and_plus_values(self, parser):
        results = {r.test_name: r for r in parser.parse(TWO_COLUMN_QUALITATIVE)}
        assert results["Protein, UA"].qualitative_value == "Negative"
        assert results["Protein, UA"].value is None
        assert results["Glucose, UA"].qualitative_value == "3+"

    def test_inequality_value(self, parser):
        results = parser.parse(GFR_INEQUALITY)
        assert len(results) == 1
        assert results[0].test_name == "GFR Calculation"
        assert results[0].qualitative_value == ">60"
        assert results[0].value is None

    def test_not_estab_numeric_value(self, parser):
        results = parser.parse(NOT_ESTAB_NUMERIC)
        assert len(results) == 1
        assert results[0].test_name == "Creatinine, Ur"
        assert results[0].value == 398.9
        assert results[0].reference_range == "Not Estab."
        assert results[0].unit == "mg/dL"


class TestFlagComputation:
    @pytest.fixture
    def parser(self):
        return EpicMyChartCardParser()

    def test_high_from_range(self, parser):
        assert parser._compute_flag(12.0, "3 - 10", 3.0, 10.0) == "High"

    def test_low_from_range(self, parser):
        assert parser._compute_flag(2.0, "3 - 10", 3.0, 10.0) == "Low"

    def test_within_range_no_flag(self, parser):
        assert parser._compute_flag(5.0, "3 - 10", 3.0, 10.0) == ""

    def test_gte_range_low(self, parser):
        assert parser._compute_flag(50.0, ">=60", None, None) == "Low"

    def test_lte_range_high(self, parser):
        assert parser._compute_flag(130.0, "<=126", None, None) == "High"

    def test_computed_flag_applied_on_parse(self, parser):
        results = {r.test_name: r for r in parser.parse(TWO_COLUMN_CBC)}
        # Hematocrit 43.4 within 37.5-51.0 -> no flag.
        assert results["Hematocrit"].flag == ""


class TestGaugeDetection:
    @pytest.fixture
    def parser(self):
        return EpicMyChartCardParser()

    def test_doubled_gauge_recognised(self, parser):
        # _is_doubled_gauge takes the space-free (compact) form.
        assert parser._is_doubled_gauge("110000220000") is True
        assert parser._is_doubled_gauge("44..8855..66") is True

    def test_doubled_gauge_line_filtered(self, parser):
        assert parser._is_gauge("110000 220000", 100.0, 200.0) is True

    def test_real_value_not_flagged_as_gauge(self, parser):
        assert parser._is_doubled_gauge("14.2") is False
        assert parser._is_gauge("14.2", 3.4, 10.8) is False

    def test_plain_gauge_matches_bounds(self, parser):
        assert parser._is_gauge("3.4 10.8", 3.4, 10.8) is True


class TestNameCleaning:
    @pytest.fixture
    def parser(self):
        return EpicMyChartCardParser()

    def test_embedded_digits_preserved(self, parser):
        # Significant digits in a name must survive superscript stripping.
        assert parser.clean_test_name("Vitamin B12") == "Vitamin B12"
        assert parser.clean_test_name("Hemoglobin A1C") == "Hemoglobin A1C"

    def test_whitespace_delimited_superscript_stripped(self, parser):
        # Footnote markers (space-delimited two-digit runs) are still removed.
        assert parser.clean_test_name("Folate 01") == "Folate"
        assert parser.clean_test_name("WBC 02") == "WBC"


class TestDateExtraction:
    @pytest.fixture
    def parser(self):
        return EpicMyChartCardParser()

    def test_collected_on_month_name(self, parser):
        results = parser.parse(TWO_COLUMN_CBC)
        assert all(r.test_date == "2025-07-07" for r in results)


class TestDeduplication:
    @pytest.fixture
    def parser(self):
        return EpicMyChartCardParser()

    def test_no_duplicate_names(self, parser):
        results = parser.parse(TWO_COLUMN_CBC)
        names = [r.test_name for r in results]
        assert len(names) == len(set(n.lower() for n in names))

    def test_empty_text(self, parser):
        assert parser.parse("") == []
        assert parser.parse("   ") == []


class TestRegistryRouting:
    def test_card_layout_routes_to_card_parser_over_labcorp(self):
        """Regression: MyChart exports naming LabCorp in the footer must still
        route to the card parser, not LabCorp."""
        page = build_page(
            [
                (
                    ["WBC", "Normal range: 3.4 - 10.8 x10E3/uL", "14.2 High"],
                    ["RBC", "Normal range: 4.14 - 5.80 x10E6/uL", "4.88"],
                ),
            ],
            footer_lab="Labcorp Dallas",
        )
        registry = LabParserRegistry()
        parser = registry.get_parser(page)
        assert type(parser).__name__ == "EpicMyChartCardParser"

    def test_registry_parse_uses_layout_text(self):
        registry = LabParserRegistry()
        results, lab_name = registry.parse(
            TWO_COLUMN_CBC, layout_text_provider=lambda: TWO_COLUMN_CBC
        )
        assert lab_name == "Epic MyChart"
        assert len(results) == 4

    def test_card_parser_registered_before_labcorp(self):
        registry = LabParserRegistry()
        names = [type(p).__name__ for p in registry.parsers]
        assert names.index("EpicMyChartCardParser") < names.index("LabCorpParserV2")
