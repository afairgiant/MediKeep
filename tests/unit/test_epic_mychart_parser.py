"""
Unit tests for Epic MyChart Parser.

Tests the Epic MyChart lab result parser including detection, value extraction,
flag determination, gauge artifact filtering, and edge cases.
"""

import pytest
from app.services.lab_parsers.epic_mychart_parser import EpicMyChartParser
from tests.fixtures.lab_text_samples import (
    EPIC_MYCHART_RENAL_PANEL,
    EPIC_MYCHART_FULL_PANEL,
    EPIC_MYCHART_WITH_FLAGS,
    LABCORP_CLEAN_TEXT,
    QUEST_DIAGNOSTICS_SAMPLE,
    EMPTY_PDF_TEXT,
)


class TestEpicMyChartDetection:
    """Test Epic MyChart format detection (can_parse method)."""

    @pytest.fixture
    def parser(self):
        return EpicMyChartParser()

    def test_can_parse_epic_mychart_format(self, parser):
        """Test detection of Epic MyChart PDF format."""
        assert parser.can_parse(EPIC_MYCHART_RENAL_PANEL) is True
        assert parser.can_parse(EPIC_MYCHART_FULL_PANEL) is True
        assert parser.can_parse(EPIC_MYCHART_WITH_FLAGS) is True

    def test_cannot_parse_labcorp_format(self, parser):
        """Test rejection of LabCorp format."""
        assert parser.can_parse(LABCORP_CLEAN_TEXT) is False

    def test_cannot_parse_quest_format(self, parser):
        """Test rejection of Quest Diagnostics format."""
        assert parser.can_parse(QUEST_DIAGNOSTICS_SAMPLE) is False

    def test_cannot_parse_empty_text(self, parser):
        """Test rejection of empty text."""
        assert parser.can_parse(EMPTY_PDF_TEXT) is False
        assert parser.can_parse("") is False
        assert parser.can_parse("   ") is False

    def test_cannot_parse_generic_text(self, parser):
        """Test rejection of generic text without Epic indicators."""
        assert parser.can_parse("Some random text about lab results") is False


class TestEpicMyChartBasicParsing:
    """Test basic parsing of Epic MyChart results."""

    @pytest.fixture
    def parser(self):
        return EpicMyChartParser()

    def test_parse_renal_panel_count(self, parser):
        """Test parsing extracts correct number of tests from renal panel."""
        results = parser.parse(EPIC_MYCHART_RENAL_PANEL)
        assert len(results) == 3

    def test_parse_full_panel_count(self, parser):
        """Test parsing extracts correct number of tests from full panel."""
        results = parser.parse(EPIC_MYCHART_FULL_PANEL)
        assert len(results) == 12

    def test_parse_extracts_correct_test_names(self, parser):
        """Test that test names are correctly extracted."""
        results = parser.parse(EPIC_MYCHART_RENAL_PANEL)
        test_names = {r.test_name for r in results}

        assert "Creatinine Level" in test_names
        assert "Blood Urea Nitrogen (BUN)" in test_names
        assert "Calcium Level" in test_names

    def test_parse_extracts_correct_values(self, parser):
        """Test that numeric values are correctly extracted."""
        results = parser.parse(EPIC_MYCHART_RENAL_PANEL)

        creatinine = next(
            (r for r in results if "Creatinine" in r.test_name), None
        )
        assert creatinine is not None
        assert creatinine.value == 0.72

        bun = next(
            (r for r in results if "BUN" in r.test_name), None
        )
        assert bun is not None
        assert bun.value == 15.0

        calcium = next(
            (r for r in results if "Calcium" in r.test_name), None
        )
        assert calcium is not None
        assert calcium.value == 9.4

    def test_parse_extracts_correct_units(self, parser):
        """Test that units are correctly extracted from normal range lines."""
        results = parser.parse(EPIC_MYCHART_RENAL_PANEL)

        creatinine = next(
            (r for r in results if "Creatinine" in r.test_name), None
        )
        assert creatinine is not None
        assert creatinine.unit == "mg/dL"

    def test_parse_extracts_correct_reference_ranges(self, parser):
        """Test that reference ranges are correctly extracted."""
        results = parser.parse(EPIC_MYCHART_RENAL_PANEL)

        creatinine = next(
            (r for r in results if "Creatinine" in r.test_name), None
        )
        assert creatinine is not None
        assert creatinine.reference_range == "0.50 - 0.90"

        bun = next(
            (r for r in results if "BUN" in r.test_name), None
        )
        assert bun is not None
        assert bun.reference_range == "7 - 25"

    def test_parse_extracts_test_date(self, parser):
        """Test that collection date is extracted from Epic format."""
        results = parser.parse(EPIC_MYCHART_RENAL_PANEL)
        assert len(results) > 0
        assert results[0].test_date == "2025-04-10"

    def test_all_results_have_same_date(self, parser):
        """Test all results share the same collection date."""
        results = parser.parse(EPIC_MYCHART_RENAL_PANEL)
        dates = {r.test_date for r in results}
        assert len(dates) == 1
        assert "2025-04-10" in dates


class TestEpicMyChartSpecialCases:
    """Test special Epic MyChart formats."""

    @pytest.fixture
    def parser(self):
        return EpicMyChartParser()

    def test_egfr_above_range_format(self, parser):
        """Test parsing EGFR with 'above >=90' range format."""
        results = parser.parse(EPIC_MYCHART_FULL_PANEL)

        egfr = next(
            (r for r in results if "EGFR" in r.test_name), None
        )
        assert egfr is not None
        assert egfr.value == 126.0
        assert egfr.reference_range == ">=90"
        assert egfr.unit == "mL/min/1.73m2"

    def test_egfr_value_label_pattern(self, parser):
        """Test that 'Value' label before EGFR number is handled."""
        results = parser.parse(EPIC_MYCHART_FULL_PANEL)

        egfr = next(
            (r for r in results if "EGFR" in r.test_name), None
        )
        assert egfr is not None
        # Value should be 126, not some artifact
        assert egfr.value == 126.0

    def test_anion_gap_without_level_suffix(self, parser):
        """Test Anion Gap (no 'Level' suffix) is parsed correctly."""
        results = parser.parse(EPIC_MYCHART_FULL_PANEL)

        anion_gap = next(
            (r for r in results if "Anion Gap" in r.test_name), None
        )
        assert anion_gap is not None
        assert anion_gap.value == 10.0
        assert anion_gap.reference_range == "5 - 15"

    def test_full_panel_all_values_valid(self, parser):
        """Test all extracted values from full panel are valid numbers."""
        results = parser.parse(EPIC_MYCHART_FULL_PANEL)

        for result in results:
            assert isinstance(result.value, (int, float))
            assert result.value >= 0

    def test_full_panel_all_have_units(self, parser):
        """Test all extracted results have units."""
        results = parser.parse(EPIC_MYCHART_FULL_PANEL)

        for result in results:
            assert result.unit, f"Missing unit for {result.test_name}"

    def test_full_panel_all_have_reference_ranges(self, parser):
        """Test all extracted results have reference ranges."""
        results = parser.parse(EPIC_MYCHART_FULL_PANEL)

        for result in results:
            assert result.reference_range, (
                f"Missing reference range for {result.test_name}"
            )


class TestEpicMyChartFlagDetermination:
    """Test flag determination based on value vs reference range."""

    @pytest.fixture
    def parser(self):
        return EpicMyChartParser()

    def test_normal_values_have_no_flag(self, parser):
        """Test values within normal range get no flag."""
        results = parser.parse(EPIC_MYCHART_RENAL_PANEL)

        for result in results:
            assert result.flag == "", (
                f"{result.test_name} = {result.value} should not be flagged"
            )

    def test_high_glucose_flagged(self, parser):
        """Test glucose above normal range is flagged High."""
        results = parser.parse(EPIC_MYCHART_WITH_FLAGS)

        glucose = next(
            (r for r in results if "Glucose" in r.test_name), None
        )
        assert glucose is not None
        assert glucose.value == 118.0
        assert glucose.flag == "High"

    def test_low_creatinine_flagged(self, parser):
        """Test creatinine below normal range is flagged Low."""
        results = parser.parse(EPIC_MYCHART_WITH_FLAGS)

        creatinine = next(
            (r for r in results if "Creatinine" in r.test_name), None
        )
        assert creatinine is not None
        assert creatinine.value == 0.42
        assert creatinine.flag == "Low"

    def test_low_egfr_flagged(self, parser):
        """Test EGFR below >=90 threshold is flagged Low."""
        results = parser.parse(EPIC_MYCHART_WITH_FLAGS)

        egfr = next(
            (r for r in results if "EGFR" in r.test_name), None
        )
        assert egfr is not None
        assert egfr.value == 72.0
        assert egfr.flag == "Low"

    def test_normal_sodium_not_flagged(self, parser):
        """Test sodium within range is not flagged."""
        results = parser.parse(EPIC_MYCHART_WITH_FLAGS)

        sodium = next(
            (r for r in results if "Sodium" in r.test_name), None
        )
        assert sodium is not None
        assert sodium.value == 140.0
        assert sodium.flag == ""

    def test_boundary_value_not_flagged(self, parser):
        """Test value exactly at boundary is not flagged."""
        parser_inst = EpicMyChartParser()
        assert parser_inst._determine_flag(0.50, "0.50 - 0.90") == ""
        assert parser_inst._determine_flag(0.90, "0.50 - 0.90") == ""

    def test_determine_flag_high(self, parser):
        """Test _determine_flag returns High for values above range."""
        assert parser._determine_flag(11.0, "3 - 10") == "High"

    def test_determine_flag_low(self, parser):
        """Test _determine_flag returns Low for values below range."""
        assert parser._determine_flag(2.0, "3 - 10") == "Low"


class TestEpicMyChartGaugeArtifacts:
    """Test that gauge endpoint pairs are not extracted as values."""

    @pytest.fixture
    def parser(self):
        return EpicMyChartParser()

    def test_gauge_endpoints_not_extracted(self, parser):
        """Test gauge endpoint numbers are filtered out."""
        results = parser.parse(EPIC_MYCHART_RENAL_PANEL)

        creatinine = next(
            (r for r in results if "Creatinine" in r.test_name), None
        )
        assert creatinine is not None
        # Should be 0.72, not 0.50 or 0.90 (gauge endpoints)
        assert creatinine.value == 0.72

    def test_no_result_matches_gauge_endpoints(self, parser):
        """Test no result has a value equal to range endpoints."""
        results = parser.parse(EPIC_MYCHART_RENAL_PANEL)

        for result in results:
            low, high = parser._extract_range_bounds(result.reference_range)
            if low is not None and high is not None:
                assert not parser._numbers_match(
                    result.value, low
                ), f"{result.test_name} value matches low bound"
                assert not parser._numbers_match(
                    result.value, high
                ), f"{result.test_name} value matches high bound"


class TestEpicMyChartEdgeCases:
    """Test edge cases and error handling."""

    @pytest.fixture
    def parser(self):
        return EpicMyChartParser()

    def test_empty_text_returns_empty_list(self, parser):
        """Test parsing empty text returns empty list."""
        assert parser.parse("") == []
        assert parser.parse("   ") == []

    def test_no_normal_range_anchors(self, parser):
        """Test text without 'Normal range:' returns empty list."""
        text = """
        MyChart - licensed from Epic Systems Corporation
        Collected on Apr 10, 2025
        Some text without any normal range anchors.
        """
        results = parser.parse(text)
        assert results == []

    def test_patient_info_not_extracted(self, parser):
        """Test patient metadata is not extracted as test names."""
        results = parser.parse(EPIC_MYCHART_FULL_PANEL)

        test_names_lower = {r.test_name.lower() for r in results}
        assert "patient" not in test_names_lower
        assert "authorizing provider" not in test_names_lower
        assert "result status" not in test_names_lower
        assert "resulting lab" not in test_names_lower

    def test_deduplication(self, parser):
        """Test results are deduplicated by test name."""
        results = parser.parse(EPIC_MYCHART_FULL_PANEL)

        test_names = [r.test_name for r in results]
        assert len(test_names) == len(set(name.lower() for name in test_names))

    def test_results_have_confidence_scores(self, parser):
        """Test all results have confidence scores."""
        results = parser.parse(EPIC_MYCHART_RENAL_PANEL)

        for result in results:
            assert hasattr(result, "confidence")
            assert 0.0 <= result.confidence <= 1.0

    def test_results_serializable(self, parser):
        """Test all results can be converted to dict."""
        results = parser.parse(EPIC_MYCHART_RENAL_PANEL)

        for result in results:
            d = result.to_dict()
            assert isinstance(d, dict)
            assert "test_name" in d
            assert "value" in d
            assert "unit" in d
            assert "reference_range" in d


class TestEpicMyChartDateExtraction:
    """Test date extraction from Epic MyChart format."""

    @pytest.fixture
    def parser(self):
        return EpicMyChartParser()

    def test_extract_collected_on_date(self, parser):
        """Test extraction of 'Collected on' date."""
        text = "Collected on Apr 10, 2025"
        assert parser.extract_date_from_text(text) == "2025-04-10"

    def test_extract_full_month_name(self, parser):
        """Test extraction with full month name."""
        text = "Collected on January 5, 2025"
        assert parser.extract_date_from_text(text) == "2025-01-05"

    def test_extract_collection_date_colon(self, parser):
        """Test extraction of 'Collection date:' format."""
        text = "Collection date: Jun 15, 2025"
        assert parser.extract_date_from_text(text) == "2025-06-15"

    def test_no_date_returns_none(self, parser):
        """Test no date in text returns None."""
        text = "Some text without a date"
        assert parser.extract_date_from_text(text) is None


class TestEpicMyChartNormalRangeParsing:
    """Test _parse_normal_range helper directly."""

    @pytest.fixture
    def parser(self):
        return EpicMyChartParser()

    def test_standard_range(self, parser):
        """Test standard 'X - Y unit' format."""
        ref, unit = parser._parse_normal_range("Normal range: 0.50 - 0.90 mg/dL")
        assert ref == "0.50 - 0.90"
        assert unit == "mg/dL"

    def test_above_gte_range(self, parser):
        """Test 'above >=N unit' format."""
        ref, unit = parser._parse_normal_range(
            "Normal range: above >=90 mL/min/1.73m2"
        )
        assert ref == ">=90"
        assert unit == "mL/min/1.73m2"

    def test_less_than_range(self, parser):
        """Test '<N unit' format."""
        ref, unit = parser._parse_normal_range("Normal range: <150 mg/dL")
        assert ref == "<150"
        assert unit == "mg/dL"

    def test_integer_range(self, parser):
        """Test integer range without decimals."""
        ref, unit = parser._parse_normal_range("Normal range: 7 - 25 mg/dL")
        assert ref == "7 - 25"
        assert unit == "mg/dL"

    def test_empty_range(self, parser):
        """Test empty/invalid range returns empty strings."""
        ref, unit = parser._parse_normal_range("Normal range:")
        assert ref == ""
        assert unit == ""

    def test_not_normal_range_prefix(self, parser):
        """Test non-matching prefix returns empty strings."""
        ref, unit = parser._parse_normal_range("Reference range: 3.5 - 5.0 g/dL")
        assert ref == ""
        assert unit == ""


class TestEpicMyChartRegistryIntegration:
    """Test that Epic MyChart parser is properly registered."""

    def test_registry_contains_epic_parser(self):
        """Test parser registry includes EpicMyChartParser."""
        from app.services.lab_parsers import LabParserRegistry

        registry = LabParserRegistry()
        parser_types = [type(p).__name__ for p in registry.parsers]
        assert "EpicMyChartParser" in parser_types

    def test_registry_detects_epic_format(self):
        """Test registry auto-detects Epic MyChart format."""
        from app.services.lab_parsers import LabParserRegistry

        registry = LabParserRegistry()
        parser = registry.get_parser(EPIC_MYCHART_RENAL_PANEL)
        assert parser is not None
        assert parser.LAB_NAME == "Epic MyChart"

    def test_registry_parse_returns_lab_name(self):
        """Test registry parse returns correct lab name."""
        from app.services.lab_parsers import LabParserRegistry

        registry = LabParserRegistry()
        results, lab_name = registry.parse(EPIC_MYCHART_RENAL_PANEL)
        assert lab_name == "Epic MyChart"
        assert len(results) == 3
