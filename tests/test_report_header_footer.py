"""Tests for #1097: optional page header/footer on custom report PDFs."""

import asyncio
from datetime import datetime

import pytest

from app.schemas.custom_reports import CustomReportRequest
from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.report_translations import get_translator


def _run(report_data, monkeypatch, positions=False):
    """Generate a PDF and return (pdf_bytes, recorded text draws)."""
    draws = []
    x_positions = []
    gen = CustomReportPDFGenerator()
    original = gen._header_footer_canvas

    def recording(title, generation_date):
        base = original(title, generation_date)

        class Recording(base):
            def drawString(self, x, y, text, *a, **k):
                draws.append(("left", text))
                x_positions.append((text, x))
                return super().drawString(x, y, text, *a, **k)

            def drawRightString(self, x, y, text, *a, **k):
                draws.append(("right", text))
                x_positions.append((text, x))
                return super().drawRightString(x, y, text, *a, **k)

        return Recording

    monkeypatch.setattr(gen, "_header_footer_canvas", recording)
    pdf = asyncio.run(gen.generate_pdf(report_data))
    return (pdf, draws, x_positions) if positions else (pdf, draws)


def _data(**overrides):
    records = [
        {"id": i, "medication_name": f"Med {i}", "status": "active"} for i in range(60)
    ]
    data = {
        "report_title": "Dossier de Marie",
        "generation_date": datetime(2026, 3, 4, 10, 30),
        "data": {"medications": records},
        "language": "en",
        "date_format": "mdy",
    }
    data.update(overrides)
    return data


class TestHeaderFooter:
    def test_request_defaults_to_on(self):
        request = CustomReportRequest(
            selected_records=[{"category": "medications", "record_ids": [1]}]
        )
        assert request.include_header_footer is True

    def test_request_can_turn_off(self):
        request = CustomReportRequest(
            selected_records=[{"category": "medications", "record_ids": [1]}],
            include_header_footer=False,
        )
        assert request.include_header_footer is False

    def test_defaults_on_when_key_missing(self, monkeypatch):
        pdf, draws = _run(_data(), monkeypatch)
        assert pdf.startswith(b"%PDF")
        assert draws

    def test_title_and_numbering_on_every_page(self, monkeypatch):
        _, draws = _run(_data(include_header_footer=True), monkeypatch)
        titles = [t for side, t in draws if t == "Dossier de Marie"]
        numbers = [t for side, t in draws if t.startswith("Page ")]
        assert len(numbers) >= 2, "fixture must span several pages"
        assert len(titles) == len(numbers)
        total = len(numbers)
        assert numbers == [f"Page {n} of {total}" for n in range(1, total + 1)]

    def test_footer_date_uses_user_format(self, monkeypatch):
        _, draws = _run(_data(date_format="dmy"), monkeypatch)
        assert (
            "left",
            "Generated: 04/03/2026 10:30 | Confidential Medical Information",
        ) in draws

    def test_default_title_is_localized_in_header(self, monkeypatch):
        _, draws = _run(
            _data(report_title="Custom Medical Report", language="fr"), monkeypatch
        )
        assert ("left", "Rapport médical personnalisé") in draws
        assert any(
            t.startswith("Page 1 sur") for side, t in draws if t.startswith("Page ")
        )

    def test_disabled_draws_nothing(self, monkeypatch):
        pdf, draws = _run(_data(include_header_footer=False), monkeypatch)
        assert pdf.startswith(b"%PDF")
        assert draws == []

    def test_title_with_markup_chars_is_not_double_escaped(self, monkeypatch):
        _, draws = _run(_data(report_title="Tom & <Jerry>"), monkeypatch)
        assert ("left", "Tom & <Jerry>") in draws

    def test_even_pages_mirror_odd_pages(self, monkeypatch):
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.units import inch

        _, _, xs = _run(_data(), monkeypatch, positions=True)
        left, right = 0.75 * inch, letter[0] - 0.75 * inch
        header_xs = [x for text, x in xs if text == "Dossier de Marie"]
        footer_date_xs = [x for text, x in xs if text.startswith("Generated:")]
        page_xs = [x for text, x in xs if text.startswith("Page ")]
        assert len(header_xs) >= 2

        for index, (header_x, date_x, page_x) in enumerate(
            zip(header_xs, footer_date_xs, page_xs), start=1
        ):
            if index % 2:
                assert (header_x, date_x, page_x) == (left, left, right)
            else:
                assert (header_x, date_x, page_x) == (right, right, left)


class TestQuickReferencePageNumber:
    def test_no_placeholder_page_count(self):
        gen = CustomReportPDFGenerator()
        gen.translator = get_translator("en", "mdy")
        story = gen._create_quick_reference_summary(
            {"total_records": 1, "categories": 1}, {"medications": [{"id": 1}]}
        )
        texts = []
        for el in story:
            for row in getattr(el, "_cellvalues", []):
                for cell in row:
                    for para in cell if isinstance(cell, list) else [cell]:
                        texts.append(getattr(para, "text", str(para)))
        assert texts
        assert not any(" of X" in t or "Page:" in t for t in texts)

    def test_footer_uses_same_date_as_report_body(self, monkeypatch):
        _, draws = _run(_data(generation_date="2026-03-04T10:30:00"), monkeypatch)
        assert (
            "left",
            "Generated: 03/04/2026 10:30 | Confidential Medical Information",
        ) in draws

    @pytest.mark.parametrize("language", ["en", "zh"])
    @pytest.mark.parametrize("mirrored_page", [1, 2])
    def test_long_title_is_truncated_to_fit(self, monkeypatch, language, mirrored_page):
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.units import inch
        from reportlab.pdfbase import pdfmetrics

        title = ("非常长的报告标题" if language == "zh" else "Very long title ") * 30
        title = title[:250]
        _, draws = _run(_data(report_title=title, language=language), monkeypatch)
        headers = [t for side, t in draws if t.startswith(title[:5])]
        assert len(headers) >= 2
        text = headers[mirrored_page - 1]
        assert text.endswith("...")
        assert text != title

        gen = CustomReportPDFGenerator()
        gen.translator = get_translator(language, "mdy")
        font = (
            gen.font_cjk_normal
            if language in gen.CJK_LANGUAGES
            else gen._create_styles()["SmallText"].fontName
        )
        assert pdfmetrics.stringWidth(text, font, 8) <= letter[0] - 1.5 * inch

    def test_short_title_is_not_changed(self, monkeypatch):
        _, draws = _run(_data(report_title="Short title"), monkeypatch)
        assert ("left", "Short title") in draws
