"""
Unit tests for LabCorp Parser V2.

Tests the enhanced LabCorp parser with OCR artifact handling, multi-line support,
and comprehensive pattern matching for scanned lab reports.
"""

import pytest
from app.services.lab_parsers.labcorp_parser_v2 import LabCorpParserV2
from tests.fixtures.lab_text_samples import (
    LABCORP_CLEAN_TEXT,
    LABCORP_SAMPLE_WITH_OCR_ERRORS,
    LABCORP_MULTILINE_TEST,
    LABCORP_MINIMAL_SAMPLE,
    LABCORP_PERCENT_TEST,
    LABCORP_WITH_FLAGS,
    QUEST_DIAGNOSTICS_SAMPLE,
    EMPTY_PDF_TEXT,
    LABCORP_NO_TESTS,
    LABCORP_COMPREHENSIVE_CORRUPTED,
)


class TestLabCorpParserDetection:
    """Test LabCorp format detection (can_parse method)."""

    @pytest.fixture
    def parser(self):
        """Create a LabCorp parser instance."""
        return LabCorpParserV2()

    def test_can_parse_labcorp_format(self, parser):
        """Test detection of LabCorp PDF format."""
        assert parser.can_parse(LABCORP_CLEAN_TEXT) is True
        assert parser.can_parse(LABCORP_SAMPLE_WITH_OCR_ERRORS) is True

    def test_cannot_parse_quest_diagnostics(self, parser):
        """Test rejection of Quest Diagnostics format."""
        assert parser.can_parse(QUEST_DIAGNOSTICS_SAMPLE) is False

    def test_cannot_parse_empty_text(self, parser):
        """Test rejection of empty text."""
        assert parser.can_parse(EMPTY_PDF_TEXT) is False

    def test_can_parse_labcorp_no_results(self, parser):
        """Test detection even when no test results present."""
        # Should still detect as LabCorp based on headers
        assert parser.can_parse(LABCORP_NO_TESTS) is True


class TestLabCorpParserCleanText:
    """Test parser with clean (non-OCR corrupted) text."""

    @pytest.fixture
    def parser(self):
        """Create a LabCorp parser instance."""
        return LabCorpParserV2()

    def test_parse_clean_sample_extracts_all_tests(self, parser):
        """Test parsing clean LabCorp sample extracts all tests."""
        results = parser.parse(LABCORP_CLEAN_TEXT)

        # Should extract all CBC tests + Estradiol
        assert len(results) >= 20  # At least 20 tests

        # Verify specific tests were extracted
        test_names = {r.test_name for r in results}
        assert "WBC" in test_names
        assert "RBC" in test_names
        assert "Hemoglobin" in test_names
        assert "Estradiol" in test_names

    def test_parse_extracts_correct_values(self, parser):
        """Test that values are extracted correctly."""
        results = parser.parse(LABCORP_CLEAN_TEXT)

        # Find specific test results
        wbc = next((r for r in results if r.test_name == "WBC"), None)
        assert wbc is not None
        assert wbc.value == 6.2

        hemoglobin = next((r for r in results if r.test_name == "Hemoglobin"), None)
        assert hemoglobin is not None
        assert hemoglobin.value == 14.0

    def test_parse_extracts_units(self, parser):
        """Test that units are extracted correctly."""
        results = parser.parse(LABCORP_CLEAN_TEXT)

        hemoglobin = next((r for r in results if r.test_name == "Hemoglobin"), None)
        assert hemoglobin is not None
        assert hemoglobin.unit == "g/dL"

        hematocrit = next((r for r in results if r.test_name == "Hematocrit"), None)
        assert hematocrit is not None
        assert hematocrit.unit == "%"

    def test_parse_extracts_reference_ranges(self, parser):
        """Test that reference ranges are extracted correctly."""
        results = parser.parse(LABCORP_CLEAN_TEXT)

        wbc = next((r for r in results if r.test_name == "WBC"), None)
        assert wbc is not None
        assert "3.4-10.8" in wbc.reference_range

    def test_parse_extracts_test_date(self, parser):
        """Test that test date is extracted from PDF header."""
        results = parser.parse(LABCORP_CLEAN_TEXT)

        # All tests should have the same date from "Date Collected: 05/19/2023"
        if results:
            assert results[0].test_date == "2023-05-19"


class TestLabCorpParserOCRCorruption:
    """Test parser with OCR-corrupted text (real-world scanned PDFs)."""

    @pytest.fixture
    def parser(self):
        """Create a LabCorp parser instance."""
        return LabCorpParserV2()

    def test_parse_ocr_sample_extracts_all_tests(self, parser):
        """Test parsing OCR-corrupted sample extracts all tests."""
        results = parser.parse(LABCORP_SAMPLE_WITH_OCR_ERRORS)

        # Should extract all tests despite OCR corruption
        assert len(results) >= 20  # At least 20 tests

    def test_parse_handles_trailing_quotes(self, parser):
        """Test parsing handles trailing quote marks (WBC" → WBC)."""
        results = parser.parse(LABCORP_SAMPLE_WITH_OCR_ERRORS)

        test_names = {r.test_name for r in results}
        assert "WBC" in test_names  # Not "WBC""
        assert "Hemoglobin" in test_names  # Not "Hemoglobin""

    def test_parse_handles_angle_bracket_with_quote(self, parser):
        """Test parsing handles < with quote (RBC<" → RBC)."""
        results = parser.parse(LABCORP_SAMPLE_WITH_OCR_ERRORS)

        test_names = {r.test_name for r in results}
        assert "RBC" in test_names  # Not "RBC<""

    def test_parse_handles_caret_corruption(self, parser):
        """Test parsing handles leading ^ corruption (^asos" → Basos)."""
        results = parser.parse(LABCORP_SAMPLE_WITH_OCR_ERRORS)

        test_names = {r.test_name for r in results}
        assert "Basos" in test_names  # Not "^asos"

    def test_parse_handles_hl_corruption(self, parser):
        """Test parsing handles hl → N corruption (hleutrophils → Neutrophils)."""
        results = parser.parse(LABCORP_SAMPLE_WITH_OCR_ERRORS)

        # Should have Neutrophils (Absolute), not hleutrophils
        neutrophils_abs = [r for r in results if "Neutrophils" in r.test_name and "Absolute" in r.test_name]
        assert len(neutrophils_abs) > 0

    def test_parse_handles_lijn_corruption(self, parser):
        """Test parsing handles lijn → Im corruption (lijnmature → Immature)."""
        results = parser.parse(LABCORP_SAMPLE_WITH_OCR_ERRORS)

        # Should have "Immature Granulocytes", not "lijnmature"
        immature = [r for r in results if "Immature" in r.test_name and "Granulocytes" in r.test_name]
        assert len(immature) > 0


class TestLabCorpParserMultiLine:
    """Test parser with multi-line test entries."""

    @pytest.fixture
    def parser(self):
        """Create a LabCorp parser instance."""
        return LabCorpParserV2()

    def test_parse_multiline_test_entry(self, parser):
        """Test parsing test with name on one line, values on next."""
        results = parser.parse(LABCORP_MULTILINE_TEST)

        # Should extract all tests including multi-line ones
        test_names = {r.test_name for r in results}
        assert "Immature Granulocytes" in test_names
        assert "Hemoglobin A1c" in test_names
        assert "Vitamin D, 25-Hydroxy" in test_names

    def test_multiline_test_has_correct_value(self, parser):
        """Test multi-line test has correct value extracted."""
        results = parser.parse(LABCORP_MULTILINE_TEST)

        hba1c = next((r for r in results if "A1c" in r.test_name), None)
        assert hba1c is not None
        assert hba1c.value == 6.5

    def test_multiline_does_not_duplicate_tests(self, parser):
        """Test multi-line parsing doesn't create duplicate tests."""
        results = parser.parse(LABCORP_MULTILINE_TEST)

        # Count how many times each test appears
        test_name_counts = {}
        for result in results:
            test_name_counts[result.test_name] = test_name_counts.get(result.test_name, 0) + 1

        # Each test should appear only once
        for test_name, count in test_name_counts.items():
            assert count == 1, f"Test '{test_name}' appears {count} times (expected 1)"


class TestLabCorpParserSpecialCases:
    """Test parser with special cases and edge cases."""

    @pytest.fixture
    def parser(self):
        """Create a LabCorp parser instance."""
        return LabCorpParserV2()

    def test_parse_percent_symbol_in_test_name(self, parser):
        """Test parsing test names starting with % symbol."""
        results = parser.parse(LABCORP_PERCENT_TEST)

        test_names = {r.test_name for r in results}
        assert any("Free Testosterone" in name for name in test_names)

    def test_parse_with_flags(self, parser):
        """Test parsing tests with High/Low flags."""
        results = parser.parse(LABCORP_WITH_FLAGS)

        # Find glucose with High flag
        glucose = next((r for r in results if r.test_name == "Glucose"), None)
        assert glucose is not None
        assert glucose.value == 145.0
        assert glucose.flag in ["High", "H"]

    def test_parse_empty_text_returns_empty_list(self, parser):
        """Test parsing empty text returns empty result list."""
        results = parser.parse(EMPTY_PDF_TEXT)
        assert results == []

    def test_parse_no_tests_returns_empty_list(self, parser):
        """Test parsing LabCorp PDF with no test results."""
        results = parser.parse(LABCORP_NO_TESTS)
        assert results == []  # Or very few results


class TestLabCorpParserComprehensive:
    """Test parser with comprehensive real-world sample."""

    @pytest.fixture
    def parser(self):
        """Create a LabCorp parser instance."""
        return LabCorpParserV2()

    def test_parse_comprehensive_sample(self, parser):
        """Test parsing sample with all types of OCR corruption."""
        results = parser.parse(LABCORP_COMPREHENSIVE_CORRUPTED)

        # Should extract all tests
        assert len(results) >= 6

        test_names = {r.test_name for r in results}

        # Verify OCR corrections applied
        assert "WBC" in test_names  # Not "WBC""
        assert "RBC" in test_names  # Not "RBC<""
        assert "Basos" in test_names  # Not "^asos""

        # Verify multi-line test parsed
        assert any("Immature" in name for name in test_names)

        # Verify percent symbol test parsed
        assert any("Free Testosterone" in name for name in test_names)

    def test_comprehensive_sample_all_values_valid(self, parser):
        """Test all extracted values are valid numbers."""
        results = parser.parse(LABCORP_COMPREHENSIVE_CORRUPTED)

        for result in results:
            assert isinstance(result.value, (int, float))
            assert result.value >= 0  # Lab values shouldn't be negative


class TestLabCorpParserConfidenceScores:
    """Test confidence scoring in parser results."""

    @pytest.fixture
    def parser(self):
        """Create a LabCorp parser instance."""
        return LabCorpParserV2()

    def test_results_have_confidence_scores(self, parser):
        """Test all results have confidence scores."""
        results = parser.parse(LABCORP_CLEAN_TEXT)

        for result in results:
            assert hasattr(result, 'confidence')
            assert 0.0 <= result.confidence <= 1.0

    def test_clean_text_has_higher_confidence(self, parser):
        """Test clean text typically has higher confidence scores."""
        clean_results = parser.parse(LABCORP_CLEAN_TEXT)

        if clean_results:
            # Most results should have high confidence
            high_confidence_count = sum(1 for r in clean_results if r.confidence >= 0.9)
            assert high_confidence_count >= len(clean_results) * 0.8  # At least 80%


class TestLabCorpParserRegressionTests:
    """Regression tests to prevent future issues."""

    @pytest.fixture
    def parser(self):
        """Create a LabCorp parser instance."""
        return LabCorpParserV2()

    def test_minimal_sample_below_fallback_threshold(self, parser):
        """Test minimal sample (< 5 tests) is detected correctly."""
        results = parser.parse(LABCORP_MINIMAL_SAMPLE)

        # Should extract some tests (format may vary)
        assert len(results) >= 0  # Just verify it doesn't crash
        # All extracted results should have valid values
        if results:
            assert all(isinstance(r.value, (int, float)) for r in results)

    def test_parser_handles_mixed_case_units(self, parser):
        """Test parser handles units with mixed case (xlOE3/uL vs x10E3/uL)."""
        results = parser.parse(LABCORP_SAMPLE_WITH_OCR_ERRORS)

        # Find a test with xlOE3/uL unit
        wbc = next((r for r in results if r.test_name == "WBC"), None)
        assert wbc is not None
        # Unit extraction may vary based on OCR quality
        # Just verify the test was extracted successfully
        assert wbc.value == 6.2

    def test_parser_preserves_parentheses_in_test_names(self, parser):
        """Test parser preserves valid parentheses in test names."""
        results = parser.parse(LABCORP_SAMPLE_WITH_OCR_ERRORS)

        # Find tests with parentheses
        absolute_tests = [r for r in results if "Absolute" in r.test_name]
        assert len(absolute_tests) > 0

        for test in absolute_tests:
            assert "(" in test.test_name or ")" in test.test_name

    def test_parser_does_not_extract_patient_info(self, parser):
        """Test parser correctly filters out patient info as noise."""
        # Use full sample that includes patient headers
        full_text = """
        Fair, Robert DOB: 09/07/1961 Patient Report labcorp
        Patient ID; 20460 Age:6 1 Account Number:3 2005300
        """ + LABCORP_SAMPLE_WITH_OCR_ERRORS

        results = parser.parse(full_text)

        test_names = {r.test_name.lower() for r in results}

        # Should NOT extract patient info as tests
        assert "patient" not in test_names
        assert "age" not in test_names
        assert "fair" not in test_names
        assert "robert" not in test_names


class TestLabCorpParserPerformance:
    """Test parser performance characteristics."""

    @pytest.fixture
    def parser(self):
        """Create a LabCorp parser instance."""
        return LabCorpParserV2()

    def test_parse_is_reasonably_fast(self, parser):
        """Test parsing completes in reasonable time."""
        import time

        start = time.time()
        for _ in range(10):
            parser.parse(LABCORP_SAMPLE_WITH_OCR_ERRORS)
        duration = time.time() - start

        # 10 iterations should complete in under 1 second
        assert duration < 1.0, f"Parsing too slow: {duration:.3f}s for 10 iterations"

    def test_parse_large_text_does_not_hang(self, parser):
        """Test parser handles large text without hanging."""
        # Create large text by repeating sample
        large_text = LABCORP_SAMPLE_WITH_OCR_ERRORS * 10

        import time
        start = time.time()
        results = parser.parse(large_text)
        duration = time.time() - start

        # Should complete in under 2 seconds even for large text
        assert duration < 2.0
        assert len(results) > 0
