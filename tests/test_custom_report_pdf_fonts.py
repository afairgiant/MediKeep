"""Tests for per-language font selection in the custom report PDF generator."""

import re
from pathlib import Path

import pytest

import app.services.custom_report_pdf_generator as module
from app.services.custom_report_pdf_generator import CustomReportPDFGenerator


@pytest.fixture
def generator():
    gen = CustomReportPDFGenerator()
    # Distinct built-in fonts so the test does not depend on installed system fonts
    gen.font_normal = "Helvetica"
    gen.font_bold = "Helvetica-Bold"
    gen.font_cjk_normal = "Courier"
    gen.font_cjk_bold = "Courier-Bold"
    return gen


def _report_data(language):
    return {
        "report_title": "Test",
        "generation_date": "2026-01-01",
        "language": language,
        "data": {},
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("language", ["zh", "ja", "ko"])
async def test_cjk_language_uses_cjk_table_fonts(generator, language):
    await generator.generate_pdf(_report_data(language))

    assert generator.table_font_normal == "Courier"
    assert generator.table_font_bold == "Courier-Bold"
    assert generator.styles["SmallText"].fontName == "Courier"


@pytest.mark.asyncio
async def test_non_cjk_language_uses_latin_table_fonts(generator):
    await generator.generate_pdf(_report_data("en"))

    assert generator.table_font_normal == "Helvetica"
    assert generator.table_font_bold == "Helvetica-Bold"


@pytest.mark.asyncio
async def test_table_fonts_reset_after_cjk_report(generator):
    await generator.generate_pdf(_report_data("zh"))
    await generator.generate_pdf(_report_data("en"))

    assert generator.table_font_normal == "Helvetica"
    assert generator.table_font_bold == "Helvetica-Bold"


def test_table_styles_do_not_use_latin_only_fonts():
    """Table FONT/FONTNAME entries must use the per-report table fonts."""
    source = Path(module.__file__).read_text(encoding="utf-8")

    assert not re.search(r'"FONT", [^\n]*self\.font_(normal|bold)', source)
    assert not re.search(r'"FONTNAME", [^\n]*"Helvetica', source)
