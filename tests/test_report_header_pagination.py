"""Tests for keeping report headers together with their body text (no headers
stranded at the bottom of a page)."""

import io

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.platypus import (
    CondPageBreak,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)

from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.report_translations import get_translator


def _generator():
    gen = CustomReportPDFGenerator()
    gen.translator = get_translator("en", "mdy")
    return gen


class _RecordingDoc(SimpleDocTemplate):
    """Records the page each flowable with text ends up on."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.placed = {}

    def afterFlowable(self, flowable):
        text = getattr(flowable, "text", None)
        if text:
            self.placed[text] = self.page


def _build(story):
    doc = _RecordingDoc(
        io.BytesIO(),
        pagesize=letter,
        topMargin=1 * inch,
        bottomMargin=0.75 * inch,
    )
    doc.build(story)
    return doc.placed


def _page_filler(gen, lines):
    return [Paragraph(f"filler {i}", gen.styles["CustomBody"]) for i in range(lines)]


class TestKeepHeadersWithBody:
    def test_conditional_break_inserted_before_each_header_style(self):
        gen = _generator()
        story = [
            Paragraph("Section", gen.styles["SectionHeader"]),
            Paragraph("Sub", gen.styles["SubsectionHeader"]),
            Paragraph("Record", gen.styles["RecordHeader"]),
            Paragraph("Body", gen.styles["CustomBody"]),
        ]
        result = gen._keep_headers_with_body(story)

        assert len(result) == 7
        for i in (0, 2, 4):
            assert isinstance(result[i], CondPageBreak)
        assert [f for f in result if not isinstance(f, CondPageBreak)] == story

    def test_no_extra_break_after_an_explicit_page_break(self):
        gen = _generator()
        story = [PageBreak(), Paragraph("Section", gen.styles["SectionHeader"])]
        assert len(gen._keep_headers_with_body(story)) == 2

    def test_reserves_room_for_four_body_lines(self):
        gen = _generator()
        style = gen.styles["SectionHeader"]
        result = gen._keep_headers_with_body([Paragraph("S", style)])
        expected = (
            style.leading
            + style.spaceBefore
            + style.spaceAfter
            + 4 * gen.BODY_LINE_HEIGHT
        )
        assert result[0].height == expected

    def test_body_paragraphs_are_left_alone(self):
        gen = _generator()
        story = [Paragraph("Body", gen.styles["CustomBody"])]
        assert gen._keep_headers_with_body(story) == story

    def test_body_style_forbids_widows_and_orphans(self):
        style = _generator().styles["CustomBody"]
        assert style.allowWidows == 0
        assert style.allowOrphans == 0


class TestLayout:
    USABLE = letter[1] - 1 * inch - 0.75 * inch

    def _story(self, gen, free_points):
        """A page-filling spacer that leaves `free_points` free on page 1, then a
        header and body text."""
        return (
            [Spacer(1, self.USABLE - free_points)]
            + [Paragraph("HEADER", gen.styles["RecordHeader"])]
            + [Paragraph(f"body {i}", gen.styles["CustomBody"]) for i in range(6)]
        )

    def _header_height(self, gen):
        style = gen.styles["RecordHeader"]
        return style.leading + style.spaceBefore + style.spaceAfter

    def test_header_with_little_room_moves_to_the_next_page_with_its_body(self):
        gen = _generator()
        story = self._story(gen, self._header_height(gen) + 8)
        placed = _build(gen._keep_headers_with_body(story))

        assert placed["body 0"] == placed["HEADER"] == 2

    def test_without_the_check_the_header_is_stranded(self):
        gen = _generator()
        story = self._story(gen, self._header_height(gen) + 8)
        placed = _build(story)

        assert placed["HEADER"] == 1
        assert placed["body 0"] == 2

    def test_header_with_enough_room_stays_on_the_page(self):
        gen = _generator()
        story = self._story(gen, 300)
        placed = _build(gen._keep_headers_with_body(story))

        assert placed["HEADER"] == 1
        assert placed["body 0"] == 1
