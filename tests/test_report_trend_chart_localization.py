"""Regression tests: trend chart text and stats table were not localized and
rendered junk characters in Chinese (the table used the default Latin font)."""

from datetime import date, datetime

import pytest

from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.report_fonts import find_cjk_font_path
from app.services.report_translations import ReportTranslator, get_translator
from app.services.trend_chart_generator import TrendChartGenerator

LAB_DATA = {
    "dates": [date(2026, 1, 5), date(2026, 2, 10)],
    "values": [90, 101],
    "statuses": ["normal"] * 2,
    "display_name": "Glucose",
    "unit": "mg/dL",
    "date_from": datetime(2026, 1, 1),
    "date_to": None,
}


class TestRangeLabel:
    def test_english_default_unchanged(self):
        label = TrendChartGenerator()._range_label(datetime(2026, 1, 1), None)
        assert label == "Requested range: Jan 01, 2026  –  latest"

    def test_translated_label_uses_user_date_format(self):
        gen = TrendChartGenerator(translator=get_translator("fr", "dmy"))
        label = gen._range_label(datetime(2026, 1, 1), datetime(2026, 3, 4))
        assert label == "Période demandée : 01/01/2026 – 04/03/2026"
        assert "Requested" not in label

    def test_open_ended_range_uses_translated_words(self):
        gen = TrendChartGenerator(translator=get_translator("zh", "ymd"))
        label = gen._range_label(None, datetime(2026, 3, 4))
        assert "最早" in label and "earliest" not in label

    @pytest.mark.parametrize(
        "lang", ["en", "fr", "de", "es", "it", "pt", "ru", "sv", "nl", "pl", "zh", "el"]
    )
    def test_chart_text_keys_exist_in_every_language(self, lang):
        t = ReportTranslator(lang)
        for key in ("requested_range", "earliest", "latest", "normal_range", "chart_range_note"):
            assert "_" not in t.text(key, **{"from": "a", "to": "b"})


class TestChartRendering:
    def test_chart_renders_with_translator(self):
        png = TrendChartGenerator(
            translator=get_translator("fr", "dmy")
        ).generate_lab_test_chart(dict(LAB_DATA))
        assert png and png.startswith(b"\x89PNG")

    @pytest.mark.skipif(find_cjk_font_path() is None, reason="no CJK font installed")
    def test_chart_renders_with_cjk_font(self):
        gen = TrendChartGenerator(
            translator=get_translator("zh", "ymd"), font_path=find_cjk_font_path()
        )
        png = gen.generate_lab_test_chart({**LAB_DATA, "display_name": "血糖"})
        assert png and png.startswith(b"\x89PNG")

    def test_missing_font_path_is_not_required(self):
        assert TrendChartGenerator(font_path=None)._text_kwargs() == {}


class TestStatsTable:
    @pytest.fixture
    def gen(self):
        g = CustomReportPDFGenerator()
        g.translator = get_translator("zh", "ymd")
        g.table_font_normal = g.font_cjk_normal
        g.table_font_bold = g.font_cjk_bold
        return g

    def test_blood_pressure_rows_are_translated(self, gen):
        data = gen._build_chart_stats_table(
            {
                "systolic": {"latest": 120, "average": 118, "min": 110, "max": 130, "count": 5},
                "diastolic": {"latest": 80, "average": 79, "min": 70, "max": 88},
            },
            "mmHg",
        )
        assert data[1][0] == "收缩压" and data[2][0] == "舒张压"

    def test_section_applies_table_font_to_headers(self, gen):
        story = gen._create_trend_charts_section(
            [
                {
                    "title": "t",
                    "png_bytes": TrendChartGenerator().generate_lab_test_chart(dict(LAB_DATA)),
                    "statistics": {"latest": 1, "average": 1, "min": 1, "max": 1, "count": 2},
                    "unit": "u",
                    "date_from": datetime(2026, 1, 1),
                }
            ]
        )
        block = next(f for f in story if hasattr(f, "_content"))
        table = next(e for e in block._content if hasattr(e, "_cellvalues"))
        assert table._cellStyles[0][0].fontname == gen.table_font_bold
        assert table._cellStyles[1][0].fontname == gen.table_font_normal
        footnote = next(e for e in block._content if hasattr(e, "text") and e.text.startswith("*"))
        assert "图表" in footnote.text


class TestTickLabels:
    @pytest.mark.parametrize(
        "fmt,expected_short",
        [("mdy", "03/04"), ("dmy", "04/03"), ("dmy_dot", "04.03."), ("ymd", "03-04")],
    )
    def test_short_date_follows_date_format(self, fmt, expected_short):
        assert get_translator("fr", fmt).format_short_date(datetime(2026, 3, 4)) == expected_short

    def test_translator_ticks_have_no_english_month_names(self):
        from matplotlib.figure import Figure

        from app.services.trend_chart_generator import _format_date_axis

        gen = TrendChartGenerator(translator=get_translator("zh", "ymd"))
        fig = Figure()
        ax = fig.add_subplot()
        ax.plot([datetime(2026, 1, 5), datetime(2026, 3, 10)], [1, 2])
        _format_date_axis(ax, tick_formats=gen._tick_formats())
        fig.canvas.draw()
        labels = [t.get_text() for t in ax.get_xticklabels() if t.get_text()]
        assert labels and not any(m in l for l in labels for m in ("Jan", "Feb", "Mar"))
        assert labels[0].startswith("2026-")

    def test_english_default_keeps_month_names(self):
        assert TrendChartGenerator()._tick_formats() is None
