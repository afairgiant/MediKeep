"""Standard export PDF uses a language-appropriate font."""

import asyncio
import re

import pytest

from app.services.export_service import ExportService
from app.services.report_fonts import find_thai_font_path


def _export_data(language):
    return {
        "export_metadata": {
            "language": language,
            "date_format": "mdy",
            "generated_at": "2026-10-05T00:00:00",
        },
        "patient_info": {"first_name": "Somchai", "last_name": "Jaidee"},
        "medications": [{"medication_name": "Paracetamol", "status": "active"}],
    }


def _base_fonts(pdf):
    return set(re.findall(rb"/BaseFont /([^\s/>]+)", pdf))


def _pdf(language):
    service = ExportService.__new__(ExportService)
    return asyncio.run(service.convert_to_pdf(_export_data(language)))


class TestPdfFonts:
    def test_latin_language_keeps_helvetica(self):
        assert ExportService._pdf_fonts("en") == ("Helvetica", "Helvetica-Bold")

    def test_thai_does_not_use_helvetica(self):
        normal, bold = ExportService._pdf_fonts("th")
        assert "Helvetica" not in (normal, bold) or find_thai_font_path() is None

    def test_english_pdf_is_valid_and_uses_helvetica(self):
        pdf = _pdf("en")
        assert pdf.startswith(b"%PDF")
        assert b"Helvetica-Bold" in _base_fonts(pdf)

    @pytest.mark.skipif(find_thai_font_path() is None, reason="no Thai font installed")
    def test_thai_pdf_embeds_thai_font(self):
        pdf = _pdf("th")
        assert pdf.startswith(b"%PDF")
        fonts = _base_fonts(pdf)
        assert b"Helvetica-Bold" not in fonts
        assert any(b"+" in f for f in fonts)
        assert b"PDF Generation Error" not in pdf
