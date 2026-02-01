"""
Tests for Canonical Test Matching Service.
"""
import pytest

from app.services.canonical_test_matching import (
    CanonicalTestMatchingService,
    canonical_test_matching,
)


class TestCanonicalTestMatchingService:
    """Test canonical test name matching service."""

    @pytest.fixture
    def matching_service(self):
        """Create a fresh instance of the matching service."""
        return CanonicalTestMatchingService()

    def test_service_initialization(self, matching_service):
        """Test that the service initializes with the test library."""
        assert matching_service is not None
        assert len(matching_service.test_library) > 0
        assert isinstance(matching_service.test_library, list)

    def test_singleton_instance(self):
        """Test that canonical_test_matching is a singleton instance."""
        assert canonical_test_matching is not None
        assert isinstance(canonical_test_matching, CanonicalTestMatchingService)

    # Test exact matches on canonical test_name
    def test_exact_match_canonical_name(self, matching_service):
        """Test exact match on canonical test name."""
        result = matching_service.find_canonical_match("White Blood Cell Count")
        assert result == "White Blood Cell Count"

    def test_exact_match_canonical_name_case_insensitive(self, matching_service):
        """Test exact match is case-insensitive."""
        result = matching_service.find_canonical_match("WHITE BLOOD CELL COUNT")
        assert result == "White Blood Cell Count"

        result = matching_service.find_canonical_match("white blood cell count")
        assert result == "White Blood Cell Count"

    # Test exact matches on abbreviation
    def test_exact_match_abbreviation(self, matching_service):
        """Test exact match on abbreviation."""
        result = matching_service.find_canonical_match("WBC")
        assert result == "White Blood Cell Count"

        result = matching_service.find_canonical_match("HGB")
        assert result == "Hemoglobin"

        result = matching_service.find_canonical_match("TSH")
        assert result == "Thyroid Stimulating Hormone"

    def test_exact_match_abbreviation_case_insensitive(self, matching_service):
        """Test abbreviation matching is case-insensitive."""
        result = matching_service.find_canonical_match("wbc")
        assert result == "White Blood Cell Count"

        result = matching_service.find_canonical_match("Wbc")
        assert result == "White Blood Cell Count"

    # Test exact matches on common_names
    def test_exact_match_common_name(self, matching_service):
        """Test exact match on common name."""
        result = matching_service.find_canonical_match("White Blood Cells")
        assert result == "White Blood Cell Count"

        result = matching_service.find_canonical_match("Leukocytes")
        assert result == "White Blood Cell Count"

    def test_exact_match_common_name_case_insensitive(self, matching_service):
        """Test common name matching is case-insensitive."""
        result = matching_service.find_canonical_match("RED BLOOD CELLS")
        assert result == "Red Blood Cell Count"

        result = matching_service.find_canonical_match("erythrocytes")
        assert result == "Red Blood Cell Count"

    # Test testosterone variations (complex test case)
    def test_testosterone_total_variations(self, matching_service):
        """Test various testosterone naming conventions."""
        testosterone_variations = [
            "Testosterone",
            "Total Testosterone",
            "Testosterone, Total",
            "Testosterone Total",
            "Testosterone, Total, LC/MS",
            "Testosterone, Total, LC/MS A",
            "Testosterone, Total, MS",
            "Testosterone,Total",
            "TESTOSTERONE, TOTAL",
            "TESTOSTERONE,TOTAL",
            "Testosterone, Serum",
            "Serum Testosterone",
        ]

        for variation in testosterone_variations:
            result = matching_service.find_canonical_match(variation)
            assert result == "Testosterone", f"Failed to match: {variation}"

    def test_testosterone_free_variations(self, matching_service):
        """Test various free testosterone naming conventions."""
        free_testosterone_variations = [
            "Testosterone Free",
            "Free Testosterone",
            "Testosterone, Free",
            "Testosterone,Free",
            "Free Testosterone (Direct)",
            "Testosterone Free (Direct)",
            "Testosterone, Free, Direct",
            "Free Test",
            "TESTOSTERONE, FREE",
            "TESTOSTERONE,FREE",
            "FREE TESTOSTERONE",
        ]

        for variation in free_testosterone_variations:
            result = matching_service.find_canonical_match(variation)
            assert result == "Testosterone Free", f"Failed to match: {variation}"

    # Test cholesterol variations
    def test_cholesterol_variations(self, matching_service):
        """Test various cholesterol naming conventions."""
        total_chol_variations = [
            "Cholesterol",
            "Total Chol",
            "CHOLESTEROL, TOTAL",
            "Cholesterol Total",
        ]

        for variation in total_chol_variations:
            result = matching_service.find_canonical_match(variation)
            assert result == "Total Cholesterol", f"Failed to match: {variation}"

    def test_ldl_variations(self, matching_service):
        """Test LDL cholesterol variations."""
        ldl_variations = [
            "LDL",
            "LDL-C",
            "Bad Cholesterol",
            "LDL-CHOLESTEROL",
            "LDL Calculated",
        ]

        for variation in ldl_variations:
            result = matching_service.find_canonical_match(variation)
            assert result == "LDL Cholesterol", f"Failed to match: {variation}"

    def test_hdl_variations(self, matching_service):
        """Test HDL cholesterol variations."""
        hdl_variations = [
            "HDL",
            "HDL-C",
            "Good Cholesterol",
            "HDL CHOLESTEROL",
        ]

        for variation in hdl_variations:
            result = matching_service.find_canonical_match(variation)
            assert result == "HDL Cholesterol", f"Failed to match: {variation}"

    # Test differential count variations
    def test_lymphocyte_variations(self, matching_service):
        """Test lymphocyte naming variations."""
        result = matching_service.find_canonical_match("Lymphs")
        assert result == "Lymphocytes"

        result = matching_service.find_canonical_match("Lymphocytes")
        assert result == "Lymphocytes"

    def test_absolute_lymphocyte_variations(self, matching_service):
        """Test absolute lymphocyte variations."""
        absolute_lymph_variations = [
            "Absolute Lymphocytes",
            "ALC",
            "Lymphs (Absolute)",
            "Lymphs(Absolute)",
        ]

        for variation in absolute_lymph_variations:
            result = matching_service.find_canonical_match(variation)
            assert result == "Lymphocytes (Absolute)", f"Failed to match: {variation}"

    # Test input normalization
    def test_normalize_input_whitespace(self, matching_service):
        """Test that input normalization handles whitespace."""
        result = matching_service.find_canonical_match("  WBC  ")
        assert result == "White Blood Cell Count"

        result = matching_service.find_canonical_match("\tHemoglobin\n")
        assert result == "Hemoglobin"

    def test_normalize_input_trailing_punctuation(self, matching_service):
        """Test that trailing punctuation is removed."""
        result = matching_service.find_canonical_match("Hemoglobin,")
        assert result == "Hemoglobin"

        result = matching_service.find_canonical_match("Glucose;")
        assert result == "Glucose"

        result = matching_service.find_canonical_match("Cholesterol:")
        assert result == "Total Cholesterol"

    # Test no match scenarios
    def test_no_match_unknown_test(self, matching_service):
        """Test that unknown tests return None."""
        result = matching_service.find_canonical_match("Unknown Blood Test XYZ")
        assert result is None

    def test_no_match_empty_string(self, matching_service):
        """Test that empty string returns None."""
        result = matching_service.find_canonical_match("")
        assert result is None

        result = matching_service.find_canonical_match("   ")
        assert result is None

    def test_no_match_none(self, matching_service):
        """Test that None input returns None."""
        result = matching_service.find_canonical_match(None)
        assert result is None

    # Test get_test_info
    def test_get_test_info_valid(self, matching_service):
        """Test getting test info for valid canonical name."""
        info = matching_service.get_test_info("Hemoglobin")

        assert info is not None
        assert info["test_name"] == "Hemoglobin"
        assert info["abbreviation"] == "HGB"
        assert info["test_code"] == "718-7"
        assert "HGB" in info["common_names"]
        assert "Hb" in info["common_names"]

    def test_get_test_info_case_insensitive(self, matching_service):
        """Test that get_test_info is case-insensitive."""
        info = matching_service.get_test_info("HEMOGLOBIN")

        assert info is not None
        assert info["test_name"] == "Hemoglobin"

    def test_get_test_info_invalid(self, matching_service):
        """Test getting test info for invalid name."""
        info = matching_service.get_test_info("Unknown Test")
        assert info is None

    # Test get_all_canonical_names
    def test_get_all_canonical_names(self, matching_service):
        """Test getting list of all canonical test names."""
        all_names = matching_service.get_all_canonical_names()

        assert isinstance(all_names, list)
        assert len(all_names) > 0
        assert "White Blood Cell Count" in all_names
        assert "Hemoglobin" in all_names
        assert "Total Cholesterol" in all_names
        assert "Thyroid Stimulating Hormone" in all_names

    # Test edge cases
    def test_match_priority_canonical_over_abbreviation(self, matching_service):
        """Test that canonical name has priority over abbreviation."""
        # If a test has both a canonical name and abbreviation that match,
        # canonical should take priority
        result = matching_service.find_canonical_match("Hemoglobin")
        assert result == "Hemoglobin"

    def test_match_complex_names(self, matching_service):
        """Test matching complex test names."""
        result = matching_service.find_canonical_match("Mean Corpuscular Hemoglobin Concentration")
        assert result == "Mean Corpuscular Hemoglobin Concentration"

        result = matching_service.find_canonical_match("MCHC")
        assert result == "Mean Corpuscular Hemoglobin Concentration"

    def test_ratio_tests(self, matching_service):
        """Test matching ratio-based tests."""
        result = matching_service.find_canonical_match("BUN/Creatinine Ratio")
        assert result == "BUN/Creatinine Ratio"

        result = matching_service.find_canonical_match("BUN/Cr")
        assert result == "BUN/Creatinine Ratio"

        result = matching_service.find_canonical_match("LDL/HDL Ratio")
        assert result == "LDL/HDL Ratio"

        result = matching_service.find_canonical_match("Cholesterol Ratio")
        assert result == "LDL/HDL Ratio"

    # Test specific important tests
    def test_glucose_matching(self, matching_service):
        """Test glucose test matching."""
        glucose_variations = [
            "Glucose",
            "Blood Glucose",
            "Blood Sugar",
            "Glu",
        ]

        for variation in glucose_variations:
            result = matching_service.find_canonical_match(variation)
            assert result == "Glucose", f"Failed to match: {variation}"

    def test_hba1c_matching(self, matching_service):
        """Test HbA1c matching."""
        hba1c_variations = [
            "Hemoglobin A1c",
            "HbA1c",
            "A1c",
            "Glycated Hemoglobin",
        ]

        for variation in hba1c_variations:
            result = matching_service.find_canonical_match(variation)
            assert result == "Hemoglobin A1c", f"Failed to match: {variation}"

    def test_thyroid_matching(self, matching_service):
        """Test thyroid test matching."""
        result = matching_service.find_canonical_match("TSH")
        assert result == "Thyroid Stimulating Hormone"

        result = matching_service.find_canonical_match("Thyrotropin")
        assert result == "Thyroid Stimulating Hormone"

        result = matching_service.find_canonical_match("Free T4")
        assert result == "Free T4"

        result = matching_service.find_canonical_match("FT4")
        assert result == "Free T4"

    def test_electrolyte_matching(self, matching_service):
        """Test electrolyte matching."""
        result = matching_service.find_canonical_match("Sodium")
        assert result == "Sodium"

        result = matching_service.find_canonical_match("Na")
        assert result == "Sodium"

        result = matching_service.find_canonical_match("Potassium")
        assert result == "Potassium"

        result = matching_service.find_canonical_match("K")
        assert result == "Potassium"
