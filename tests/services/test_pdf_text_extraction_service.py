"""Unit tests for PDFTextExtractionService error handling and OCR language selection."""

from unittest.mock import MagicMock, patch

import pytest

from app.services.pdf_text_extraction_service import (
    DEFAULT_OCR_LANGUAGE,
    EXTRACTION_FAILED_MESSAGE,
    PDFTextExtractionService,
    resolve_ocr_languages,
)

SERVICE_MODULE = "app.services.pdf_text_extraction_service"


@pytest.fixture
def service():
    return PDFTextExtractionService()


class TestResolveOcrLanguages:
    @pytest.mark.parametrize(
        "configured,installed,expected",
        [
            ("eng", ["eng", "osd"], ("eng", [])),
            ("eng+deu+ell", ["eng", "deu", "ell"], ("eng+deu+ell", [])),
            ("eng+deu+ell", ["eng", "ell"], ("eng+ell", ["deu"])),
            (" eng + ell ", ["eng", "ell"], ("eng+ell", [])),
            ("ell", ["eng", "ell"], ("ell", [])),
        ],
    )
    def test_keeps_installed_languages(self, configured, installed, expected):
        assert resolve_ocr_languages(configured, installed) == expected

    @pytest.mark.parametrize("configured", ["deu+ell", "", "+"])
    def test_falls_back_to_default_when_nothing_usable(self, configured):
        usable, _ = resolve_ocr_languages(configured, ["eng"])
        assert usable == DEFAULT_OCR_LANGUAGE


class TestOcrLang:
    def test_uses_configured_languages(self, service):
        service.settings.OCR_LANGUAGES = "eng+deu+ell"
        with patch(f"{SERVICE_MODULE}.pytesseract.get_languages") as get_languages:
            get_languages.return_value = ["eng", "deu", "ell", "osd"]
            assert service.ocr_lang == "eng+deu+ell"

    def test_skips_missing_language(self, service):
        service.settings.OCR_LANGUAGES = "eng+ell"
        with patch(f"{SERVICE_MODULE}.pytesseract.get_languages", return_value=["eng"]):
            assert service.ocr_lang == "eng"

    def test_defaults_when_languages_cannot_be_listed(self, service):
        service.settings.OCR_LANGUAGES = "eng+ell"
        with patch(
            f"{SERVICE_MODULE}.pytesseract.get_languages",
            side_effect=RuntimeError("tesseract missing"),
        ):
            assert service.ocr_lang == DEFAULT_OCR_LANGUAGE

    def test_ocr_passes_lang_to_tesseract(self, service):
        service.ocr_available = True
        service.__dict__["ocr_lang"] = "eng+ell"
        with patch(
            f"{SERVICE_MODULE}.convert_from_bytes", return_value=[MagicMock()]
        ), patch.object(service, "_preprocess_image"), patch(
            f"{SERVICE_MODULE}.pytesseract.image_to_string", return_value="text"
        ) as image_to_string:
            service._extract_ocr_text(b"%PDF")

        assert image_to_string.call_args.kwargs["lang"] == "eng+ell"


class TestExtractTextFailure:
    def test_returns_generic_error_not_exception_text(self, service):
        with patch.object(
            service,
            "_extract_native_text",
            side_effect=ValueError("internal path C:/secret/file.pdf"),
        ):
            result = service.extract_text(b"%PDF", "abc123")

        assert result["method"] == "failed"
        assert result["error"] == EXTRACTION_FAILED_MESSAGE
        assert "secret" not in result["error"]
