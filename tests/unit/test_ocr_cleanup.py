"""
Unit tests for OCR artifact cleanup utilities.

Tests the OCR cleanup methods in BaseLabParser that handle common OCR errors
found in scanned lab reports (quote marks, special characters, corruption).
"""

import pytest
from app.services.lab_parsers.base_parser import BaseLabParser
from app.services.lab_parsers.labcorp_parser_v2 import LabCorpParserV2


class TestOCRCleanup:
    """Test suite for OCR artifact cleanup."""

    @pytest.fixture
    def parser(self):
        """Create a LabCorp parser instance for testing."""
        return LabCorpParserV2()

    # ===== Leading Character Corruption Tests =====

    def test_clean_leading_caret(self, parser):
        """Test removal of leading ^ character (^asos → Basos)."""
        assert parser.clean_ocr_artifacts("^asos") == "Basos"

    def test_clean_leading_h_corruption(self, parser):
        """Test correction of h -> N at start (hNeutrophils → Neutrophils)."""
        # Note: The pattern requires uppercase after h
        assert parser.clean_ocr_artifacts("hNeutrophils") == "Neutrophils"

    def test_clean_hl_pattern(self, parser):
        """Test correction of hl -> N pattern (hleutrophils → Neutrophils)."""
        assert parser.clean_ocr_artifacts("hleutrophils") == "Neutrophils"

    # ===== Trailing Quote Mark Tests =====

    def test_clean_trailing_double_quote(self, parser):
        """Test removal of trailing double quote (WBC" → WBC)."""
        assert parser.clean_ocr_artifacts('WBC"') == "WBC"

    def test_clean_trailing_single_quote(self, parser):
        """Test removal of trailing single quote/apostrophe (RBC' → RBC)."""
        assert parser.clean_ocr_artifacts("RBC'") == "RBC"

    def test_clean_multiple_trailing_quotes(self, parser):
        """Test removal of multiple trailing quote marks (Hemoglobin"' → Hemoglobin)."""
        assert parser.clean_ocr_artifacts('Hemoglobin"\'') == "Hemoglobin"

    # ===== Special Characters with Quotes Tests =====

    def test_clean_angle_bracket_with_quote(self, parser):
        """Test removal of < with quote (RBC<" → RBC)."""
        assert parser.clean_ocr_artifacts('RBC<"') == "RBC"

    def test_clean_angle_bracket_without_quote(self, parser):
        """Test removal of < without quote (RBC< → RBC)."""
        assert parser.clean_ocr_artifacts('RBC<') == "RBC"

    def test_clean_greater_than_with_quote(self, parser):
        """Test removal of > with quote (TEST>" → TEST)."""
        assert parser.clean_ocr_artifacts('TEST>"') == "TEST"

    def test_clean_greater_than_without_quote(self, parser):
        """Test removal of > without quote (TEST> → TEST)."""
        assert parser.clean_ocr_artifacts('TEST>') == "TEST"

    # ===== Unicode/OCR Misread Tests =====

    def test_clean_lijn_pattern(self, parser):
        """Test correction of lijn -> Im (lijnmature → Immature)."""
        result = parser.clean_ocr_artifacts("lijnmature Granulocytes")
        assert "Imm" in result
        assert result == "Immature Granulocytes"

    # ===== Combined Corruption Tests =====

    def test_clean_combined_corruption_caret_quote(self, parser):
        """Test combined ^asos" → Basos."""
        assert parser.clean_ocr_artifacts('^asos"') == "Basos"

    def test_clean_combined_corruption_angle_quote(self, parser):
        """Test combined RBC<" → RBC."""
        assert parser.clean_ocr_artifacts('RBC<"') == "RBC"

    def test_clean_combined_hl_quote(self, parser):
        """Test combined hleutrophils" → Neutrophils."""
        result = parser.clean_ocr_artifacts('hleutrophils"')
        assert result == "Neutrophils"

    # ===== Aggressive Mode Tests =====

    def test_aggressive_removes_multiple_spaces(self, parser):
        """Test aggressive mode removes multiple spaces."""
        result = parser.clean_ocr_artifacts("WBC  5.4", aggressive=True)
        assert "  " not in result
        assert result == "WBC 5.4"

    def test_aggressive_removes_all_quotes(self, parser):
        """Test aggressive mode removes all quotes from text."""
        result = parser.clean_ocr_artifacts('WBC" 5.4 "High"', aggressive=True)
        assert '"' not in result
        assert "'" not in result

    # ===== Edge Cases =====

    def test_clean_empty_string(self, parser):
        """Test cleanup of empty string returns empty."""
        assert parser.clean_ocr_artifacts("") == ""

    def test_clean_no_artifacts(self, parser):
        """Test cleanup of clean text returns unchanged."""
        assert parser.clean_ocr_artifacts("WBC") == "WBC"
        assert parser.clean_ocr_artifacts("Hemoglobin") == "Hemoglobin"

    def test_clean_preserves_valid_characters(self, parser):
        """Test cleanup preserves valid characters like parentheses."""
        assert parser.clean_ocr_artifacts("Neutrophils (Absolute)") == "Neutrophils (Absolute)"

    def test_clean_multiple_patterns_in_one_string(self, parser):
        """Test multiple cleanup patterns applied to same string."""
        # Start with ^, end with ", has hl pattern
        result = parser.clean_ocr_artifacts('^hleutrophils"')
        # Should apply: ^ removal, hl->Nl correction, " removal
        # But the patterns are independent, so order matters
        # Let's test what actually happens
        assert '"' not in result  # Quote should be removed
        assert '^' not in result  # Caret should be removed


class TestCleanTestName:
    """Test suite for clean_test_name method (which uses clean_ocr_artifacts)."""

    @pytest.fixture
    def parser(self):
        """Create a LabCorp parser instance for testing."""
        return LabCorpParserV2()

    # ===== Integration Tests with Superscript Removal =====

    def test_clean_test_name_with_quote_and_superscript(self, parser):
        """Test full cleanup: WBC" 01 → WBC."""
        assert parser.clean_test_name('WBC" 01') == "WBC"

    def test_clean_test_name_caret_corruption_with_superscript(self, parser):
        """Test full cleanup: ^asos" 02 → Basos."""
        assert parser.clean_test_name('^asos" 02') == "Basos"

    def test_clean_test_name_angle_bracket_with_superscript(self, parser):
        """Test full cleanup: RBC<" 03 → RBC."""
        assert parser.clean_test_name('RBC<" 03') == "RBC"

    def test_clean_test_name_hl_corruption_with_superscript(self, parser):
        """Test full cleanup: hleutrophils" 04 → Neutrophils."""
        result = parser.clean_test_name('hleutrophils" 04')
        assert result == "Neutrophils"

    def test_clean_test_name_with_spaces_and_superscript(self, parser):
        """Test cleanup with extra spaces: Lymphs (Absolute)" 05 → Lymphs (Absolute)."""
        result = parser.clean_test_name('Lymphs (Absolute)" 05')
        assert result == "Lymphs (Absolute)"

    def test_clean_test_name_lijn_pattern_with_superscript(self, parser):
        """Test cleanup: lijnmature Granulocytes" 06 → Immature Granulocytes."""
        result = parser.clean_test_name('lijnmature Granulocytes" 06')
        assert "Immature" in result
        assert result == "Immature Granulocytes"

    # ===== Superscript Pattern Tests =====

    def test_clean_test_name_removes_trailing_superscript(self, parser):
        """Test removal of trailing 2-digit superscript."""
        assert parser.clean_test_name("WBC 01") == "WBC"
        assert parser.clean_test_name("RBC 02") == "RBC"
        assert parser.clean_test_name("Hemoglobin 03") == "Hemoglobin"

    def test_clean_test_name_removes_embedded_superscript(self, parser):
        """Test removal of embedded superscript with spaces."""
        # Pattern: \s+\d{2}\s+ removes " 01 " from middle
        result = parser.clean_test_name("Test 01 Name")
        assert result == "Test Name"

    # ===== Whitespace Normalization =====

    def test_clean_test_name_normalizes_whitespace(self, parser):
        """Test normalization of multiple spaces to single space."""
        assert parser.clean_test_name("WBC  5.4") == "WBC 5.4"
        assert parser.clean_test_name("Hemoglobin   A1c") == "Hemoglobin A1c"

    def test_clean_test_name_strips_leading_trailing_spaces(self, parser):
        """Test removal of leading/trailing whitespace."""
        assert parser.clean_test_name("  WBC  ") == "WBC"
        assert parser.clean_test_name("\tHemoglobin\n") == "Hemoglobin"

    # ===== Real-World Examples from Sample PDF =====

    def test_clean_real_world_wbc(self, parser):
        """Test real example: WBC" from sample PDF."""
        assert parser.clean_test_name('WBC"') == "WBC"

    def test_clean_real_world_rbc(self, parser):
        """Test real example: RBC<" from sample PDF."""
        assert parser.clean_test_name('RBC<"') == "RBC"

    def test_clean_real_world_neutrophils(self, parser):
        """Test real example: Neutrophils"' from sample PDF."""
        assert parser.clean_test_name('Neutrophils"\'') == "Neutrophils"

    def test_clean_real_world_basos(self, parser):
        """Test real example: ^asos" → Basos from sample PDF."""
        assert parser.clean_test_name('^asos"') == "Basos"

    def test_clean_real_world_hleutrophils(self, parser):
        """Test real example: hleutrophils (Absolute)" from sample PDF."""
        result = parser.clean_test_name('hleutrophils (Absolute)"')
        assert "Neutrophils" in result
        assert "(Absolute)" in result

    def test_clean_real_world_immature_granulocytes(self, parser):
        """Test real example: lijnmature Granulocytes" from sample PDF."""
        result = parser.clean_test_name('lijnmature Granulocytes"')
        assert result == "Immature Granulocytes"

    # ===== Edge Cases =====

    def test_clean_test_name_empty_string(self, parser):
        """Test cleanup of empty string."""
        assert parser.clean_test_name("") == ""

    def test_clean_test_name_only_spaces(self, parser):
        """Test cleanup of whitespace-only string."""
        assert parser.clean_test_name("   ") == ""

    def test_clean_test_name_no_changes_needed(self, parser):
        """Test cleanup of already clean test name."""
        assert parser.clean_test_name("WBC") == "WBC"
        assert parser.clean_test_name("Hemoglobin A1c") == "Hemoglobin A1c"
        assert parser.clean_test_name("Vitamin D, 25-Hydroxy") == "Vitamin D, 25-Hydroxy"

    def test_clean_test_name_preserves_special_chars(self, parser):
        """Test that valid special characters are preserved."""
        # Parentheses, commas, hyphens should be preserved
        assert parser.clean_test_name("Vitamin D, 25-Hydroxy") == "Vitamin D, 25-Hydroxy"
        assert parser.clean_test_name("TSH (Thyroid)") == "TSH (Thyroid)"
        assert parser.clean_test_name("A/G Ratio") == "A/G Ratio"

    def test_clean_test_name_percent_symbol(self, parser):
        """Test cleanup preserves % symbol in test names."""
        assert parser.clean_test_name("% Free Testosterone") == "% Free Testosterone"
