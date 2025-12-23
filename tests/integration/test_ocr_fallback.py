"""
Integration tests for quality-based OCR fallback system.

Tests the automatic OCR retry when native extraction yields poor results.
"""

import pytest
from unittest.mock import Mock, patch
from app.services.pdf_text_extraction_service import PDFTextExtractionService


class TestOCRFallbackIntegration:
    """Integration tests for OCR fallback functionality."""

    @pytest.fixture
    def extraction_service(self):
        """Create a PDF extraction service instance."""
        return PDFTextExtractionService()

    @pytest.fixture
    def mock_pdf_bytes(self):
        """Mock PDF bytes for testing."""
        return b"mock_pdf_content"

    @pytest.fixture
    def labcorp_native_poor_quality(self):
        """Mock LabCorp text with only 3 tests (below threshold)."""
        return """
Laboratory Corporation of America
Date Collected: 05/19/2023

CBC With Differential/Platelet

Test Current Result and Flag Previous Result and Date Units Reference Interval
WBC 6.2 8.6 11/23/2022 x10E3/uL 3.4-10.8
RBC 4.85 4.66 11/23/2022 x10E6/uL 4.14-5.80
Hemoglobin 14.0 13.8 11/23/2022 g/dL 13.0-17.7
"""

    @pytest.fixture
    def labcorp_ocr_good_quality(self):
        """Mock LabCorp OCR text with 10 tests (above threshold)."""
        return """
Laboratory Corporation of America
Date Collected: 05/19/2023

CBC With Differential/Platelet

Test Current Result and Flag Previous Result and Date Units Reference Interval
WBC" 6.2 8.6 11/23/2022 xlOE3/uL 3.4-10.8
RBC<" 4.85 4.66 11/23/2022 xlOE6/uL 4.14-5.80
Hemoglobin" 14.0 13.8 11/23/2022 g/dL 13.0-17.7
Hematocrit" 41.4 40.5 11/23/2022 % 37.5-51.0
MCV" 85 87 11/23/2022 fL 79-97
MCH" 28.9 29.6 11/23/2022 Pg 26.6-33.0
MCHC" 33.8 34.1 11/23/2022 g/dL 31.5-35.7
RDW" 12.2 12.5 11/23/2022 % 11.6-15.4
Platelets" 225 242 11/23/2022 X10E3/UL 150-450
Neutrophils" 52 55 11/23/2022 % Not Estab.
"""

    @pytest.fixture
    def labcorp_native_good_quality(self):
        """Mock LabCorp text with 10 tests (above threshold)."""
        return """
Laboratory Corporation of America
Date Collected: 05/19/2023

CBC With Differential/Platelet

Test Current Result and Flag Previous Result and Date Units Reference Interval
WBC 6.2 8.6 11/23/2022 x10E3/uL 3.4-10.8
RBC 4.85 4.66 11/23/2022 x10E6/uL 4.14-5.80
Hemoglobin 14.0 13.8 11/23/2022 g/dL 13.0-17.7
Hematocrit 41.4 40.5 11/23/2022 % 37.5-51.0
MCV 85 87 11/23/2022 fL 79-97
MCH 28.9 29.6 11/23/2022 Pg 26.6-33.0
MCHC 33.8 34.1 11/23/2022 g/dL 31.5-35.7
RDW 12.2 12.5 11/23/2022 % 11.6-15.4
Platelets 225 242 11/23/2022 X10E3/UL 150-450
Neutrophils 52 55 11/23/2022 % Not Estab.
"""

    def test_fallback_triggered_on_poor_quality(
        self,
        extraction_service,
        mock_pdf_bytes,
        labcorp_native_poor_quality,
        labcorp_ocr_good_quality
    ):
        """
        Test that OCR fallback is triggered when native extraction yields < 5 tests.

        Scenario: Native extracts 3 tests, OCR extracts 10 tests, fallback succeeds.
        """
        with patch.object(extraction_service, '_extract_native_text') as mock_native, \
             patch.object(extraction_service, '_extract_ocr_text') as mock_ocr, \
             patch.object(extraction_service, 'ocr_available', True):

            # Mock native extraction returns poor quality text (3 tests)
            mock_native.return_value = {
                'text': labcorp_native_poor_quality,
                'page_count': 1,
                'char_count': len(labcorp_native_poor_quality)
            }

            # Mock OCR extraction returns good quality text (10 tests)
            mock_ocr.return_value = {
                'text': labcorp_ocr_good_quality,
                'page_count': 1,
                'char_count': len(labcorp_ocr_good_quality)
            }

            # Extract text
            result = extraction_service.extract_text(mock_pdf_bytes, "test.pdf")

            # Assertions
            assert result['fallback_triggered'] is True, "Fallback should be triggered"
            assert result['native_test_count'] == 3, "Should record original test count"
            assert result['test_count'] == 10, "Should return OCR test count"
            assert 'ocr' in result['method'], "Method should indicate OCR was used"
            assert result['lab_name'] == 'LabCorp', "Should identify LabCorp"
            assert result['confidence'] == 0.85, "OCR confidence should be 0.85"

            # Verify OCR was called
            mock_ocr.assert_called_once()

    def test_fallback_not_triggered_on_good_quality(
        self,
        extraction_service,
        mock_pdf_bytes,
        labcorp_native_good_quality
    ):
        """
        Test that OCR fallback is NOT triggered when native extraction yields >= 5 tests.

        Scenario: Native extracts 10 tests, no fallback needed.
        """
        with patch.object(extraction_service, '_extract_native_text') as mock_native, \
             patch.object(extraction_service, '_extract_ocr_text') as mock_ocr, \
             patch.object(extraction_service, 'ocr_available', True):

            # Mock native extraction returns good quality text (10 tests)
            mock_native.return_value = {
                'text': labcorp_native_good_quality,
                'page_count': 1,
                'char_count': len(labcorp_native_good_quality)
            }

            # Extract text
            result = extraction_service.extract_text(mock_pdf_bytes, "test.pdf")

            # Assertions
            assert result['fallback_triggered'] is False, "Fallback should NOT be triggered"
            assert result['test_count'] == 10, "Should return native test count"
            assert result['method'] == 'labcorp_parser', "Should use native parser"
            assert result['confidence'] == 0.98, "Native confidence should be 0.98"

            # Verify OCR was NOT called
            mock_ocr.assert_not_called()

    def test_fallback_unsuccessful_returns_native(
        self,
        extraction_service,
        mock_pdf_bytes,
        labcorp_native_poor_quality
    ):
        """
        Test that when OCR fallback doesn't improve results, native results are returned.

        Scenario: Native extracts 3 tests, OCR also extracts 3 tests, no improvement.
        """
        with patch.object(extraction_service, '_extract_native_text') as mock_native, \
             patch.object(extraction_service, '_extract_ocr_text') as mock_ocr, \
             patch.object(extraction_service, 'ocr_available', True):

            # Both native and OCR return same poor quality (3 tests)
            mock_native.return_value = {
                'text': labcorp_native_poor_quality,
                'page_count': 1,
                'char_count': len(labcorp_native_poor_quality)
            }

            mock_ocr.return_value = {
                'text': labcorp_native_poor_quality,  # OCR returns same quality
                'page_count': 1,
                'char_count': len(labcorp_native_poor_quality)
            }

            # Extract text
            result = extraction_service.extract_text(mock_pdf_bytes, "test.pdf")

            # Assertions
            assert result['fallback_triggered'] is False, "Fallback unsuccessful, should be False"
            assert result['test_count'] == 3, "Should return native test count"
            assert result['method'] == 'labcorp_parser', "Should use native parser"
            assert result['confidence'] == 0.98, "Should have native confidence"

            # Verify OCR was attempted
            mock_ocr.assert_called_once()

    def test_fallback_disabled_by_config(
        self,
        extraction_service,
        mock_pdf_bytes,
        labcorp_native_poor_quality
    ):
        """
        Test that OCR fallback is NOT triggered when disabled in config.

        Scenario: Config disabled, native extracts 3 tests, no fallback attempted.
        """
        with patch.object(extraction_service, '_extract_native_text') as mock_native, \
             patch.object(extraction_service, '_extract_ocr_text') as mock_ocr, \
             patch.object(extraction_service, 'ocr_available', True), \
             patch('app.core.config.Settings') as mock_settings:

            # Disable OCR fallback in config
            mock_settings_instance = Mock()
            mock_settings_instance.OCR_FALLBACK_ENABLED = False
            mock_settings_instance.OCR_FALLBACK_MIN_TESTS = 5
            mock_settings.return_value = mock_settings_instance

            # Mock native extraction returns poor quality text (3 tests)
            mock_native.return_value = {
                'text': labcorp_native_poor_quality,
                'page_count': 1,
                'char_count': len(labcorp_native_poor_quality)
            }

            # Extract text
            result = extraction_service.extract_text(mock_pdf_bytes, "test.pdf")

            # Assertions
            assert result['fallback_triggered'] is False, "Fallback disabled, should be False"
            assert result['test_count'] == 3, "Should return native test count"

            # Verify OCR was NOT called
            mock_ocr.assert_not_called()

    def test_fallback_not_attempted_when_ocr_unavailable(
        self,
        extraction_service,
        mock_pdf_bytes,
        labcorp_native_poor_quality
    ):
        """
        Test that OCR fallback is NOT attempted when Tesseract is unavailable.

        Scenario: OCR not available, native extracts 3 tests, no fallback.
        """
        with patch.object(extraction_service, '_extract_native_text') as mock_native, \
             patch.object(extraction_service, '_extract_ocr_text') as mock_ocr, \
             patch.object(extraction_service, 'ocr_available', False):

            # Mock native extraction returns poor quality text (3 tests)
            mock_native.return_value = {
                'text': labcorp_native_poor_quality,
                'page_count': 1,
                'char_count': len(labcorp_native_poor_quality)
            }

            # Extract text
            result = extraction_service.extract_text(mock_pdf_bytes, "test.pdf")

            # Assertions
            assert result['fallback_triggered'] is False, "OCR unavailable, no fallback"
            assert result['test_count'] == 3, "Should return native test count"

            # Verify OCR was NOT called
            mock_ocr.assert_not_called()

    def test_fallback_metadata_fields_present(
        self,
        extraction_service,
        mock_pdf_bytes,
        labcorp_native_poor_quality,
        labcorp_ocr_good_quality
    ):
        """
        Test that all required metadata fields are present in the response.
        """
        with patch.object(extraction_service, '_extract_native_text') as mock_native, \
             patch.object(extraction_service, '_extract_ocr_text') as mock_ocr, \
             patch.object(extraction_service, 'ocr_available', True):

            mock_native.return_value = {
                'text': labcorp_native_poor_quality,
                'page_count': 1,
                'char_count': len(labcorp_native_poor_quality)
            }

            mock_ocr.return_value = {
                'text': labcorp_ocr_good_quality,
                'page_count': 1,
                'char_count': len(labcorp_ocr_good_quality)
            }

            result = extraction_service.extract_text(mock_pdf_bytes, "test.pdf")

            # Verify all metadata fields are present
            required_fields = [
                'text', 'method', 'confidence', 'page_count', 'char_count',
                'error', 'lab_name', 'test_count', 'test_date',
                'fallback_triggered', 'native_test_count'
            ]

            for field in required_fields:
                assert field in result, f"Missing required field: {field}"

    def test_fallback_threshold_boundary(
        self,
        extraction_service,
        mock_pdf_bytes
    ):
        """
        Test fallback behavior at the exact threshold boundary (5 tests).

        Scenario: Native extracts exactly 5 tests, no fallback (>= threshold).
        """
        # Text with exactly 5 tests
        boundary_text = """
Laboratory Corporation of America
Date Collected: 05/19/2023

CBC With Differential/Platelet

Test Current Result and Flag Previous Result and Date Units Reference Interval
WBC 6.2 8.6 11/23/2022 x10E3/uL 3.4-10.8
RBC 4.85 4.66 11/23/2022 x10E6/uL 4.14-5.80
Hemoglobin 14.0 13.8 11/23/2022 g/dL 13.0-17.7
Hematocrit 41.4 40.5 11/23/2022 % 37.5-51.0
MCV 85 87 11/23/2022 fL 79-97
"""

        with patch.object(extraction_service, '_extract_native_text') as mock_native, \
             patch.object(extraction_service, '_extract_ocr_text') as mock_ocr, \
             patch.object(extraction_service, 'ocr_available', True):

            mock_native.return_value = {
                'text': boundary_text,
                'page_count': 1,
                'char_count': len(boundary_text)
            }

            result = extraction_service.extract_text(mock_pdf_bytes, "test.pdf")

            # At threshold (5 tests), no fallback should occur
            assert result['fallback_triggered'] is False
            assert result['test_count'] == 5
            mock_ocr.assert_not_called()
