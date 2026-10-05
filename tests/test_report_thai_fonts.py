"""Thai PDF/chart font selection."""

import pytest
from reportlab.lib.fonts import tt2ps

from app.services import report_fonts
from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.report_fonts import (
    DEDICATED_FONT_LANGUAGES,
    find_dedicated_font_path,
    find_thai_font_path,
)

THAI_INSTALLED = find_thai_font_path() is not None


class TestFontLookup:
    def test_thai_is_dedicated_font_language(self):
        assert "th" in DEDICATED_FONT_LANGUAGES
        assert "zh" in DEDICATED_FONT_LANGUAGES

    @pytest.mark.parametrize("lang", ["en", "fr", "ru", "el", ""])
    def test_latin_languages_need_no_dedicated_font(self, lang):
        assert find_dedicated_font_path(lang) is None

    def test_thai_lookup_uses_thai_paths(self, monkeypatch, tmp_path):
        font = tmp_path / "Thai.ttf"
        font.write_bytes(b"x")
        monkeypatch.setattr(report_fonts, "THAI_NORMAL_FONT_PATHS", [str(font)])
        assert find_dedicated_font_path("th") == str(font)
        assert find_dedicated_font_path("zh") != str(font)

    def test_missing_thai_font_returns_none(self, monkeypatch):
        monkeypatch.setattr(report_fonts, "THAI_NORMAL_FONT_PATHS", ["/nope.ttf"])
        assert find_dedicated_font_path("th") is None


class TestGeneratorFonts:
    def test_dedicated_fonts_none_for_latin(self):
        assert CustomReportPDFGenerator()._dedicated_fonts("en") is None

    def test_thai_uses_thai_fonts(self):
        gen = CustomReportPDFGenerator()
        assert gen._dedicated_fonts("th") == (gen.font_thai_normal, gen.font_thai_bold)

    def test_cjk_still_uses_cjk_fonts(self):
        gen = CustomReportPDFGenerator()
        assert gen._dedicated_fonts("zh") == (gen.font_cjk_normal, gen.font_cjk_bold)

    def test_missing_thai_font_falls_back_to_latin(self, monkeypatch):
        monkeypatch.setattr(
            "app.services.custom_report_pdf_generator.THAI_NORMAL_FONT_PATHS", []
        )
        gen = CustomReportPDFGenerator()
        assert gen._has_thai_font is False
        assert gen.font_thai_normal == gen.font_normal

    @pytest.mark.skipif(not THAI_INSTALLED, reason="no Thai font installed")
    def test_thai_font_registered_when_installed(self):
        gen = CustomReportPDFGenerator()
        assert gen._has_thai_font is True
        assert gen.font_thai_normal == "ThaiFont"

    @pytest.mark.skipif(find_thai_font_path() is None, reason="no Thai font installed")
    def test_inline_bold_maps_to_thai_bold(self):
        gen = CustomReportPDFGenerator()
        assert tt2ps("ThaiFont", 1, 0) == gen.font_thai_bold
        assert tt2ps("ThaiFont", 0, 0) == "ThaiFont"
