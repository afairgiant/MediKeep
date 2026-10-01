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
    def test_headers_separated_by_body_each_get_a_break(self):
        gen = _generator()
        story = [
            Paragraph("Section", gen.styles["SectionHeader"]),
            Paragraph("Body 1", gen.styles["CustomBody"]),
            Paragraph("Sub", gen.styles["SubsectionHeader"]),
            Paragraph("Body 2", gen.styles["CustomBody"]),
            Paragraph("Record", gen.styles["RecordHeader"]),
            Paragraph("Body 3", gen.styles["CustomBody"]),
        ]
        result = gen._keep_headers_with_body(story)

        assert len(result) == 9
        for i in (0, 3, 6):
            assert isinstance(result[i], CondPageBreak)
        assert [f for f in result if not isinstance(f, CondPageBreak)] == story

    def test_consecutive_headers_share_one_break_reserving_the_whole_group(self):
        gen = _generator()
        date_header = Paragraph("DATE", gen.styles["DateGroupHeader"])
        gap = Spacer(1, 6)
        test_header = Paragraph("TEST", gen.styles["SubsectionHeader"])
        body = Paragraph("body", gen.styles["CustomBody"])
        result = gen._keep_headers_with_body([date_header, gap, test_header, body])

        breaks = [f for f in result if isinstance(f, CondPageBreak)]
        assert len(breaks) == 1
        assert result[0] is breaks[0]
        expected = (
            gen._header_height(date_header)
            + 6
            + gen._header_height(test_header)
            + 4 * gen.BODY_LINE_HEIGHT
        )
        assert breaks[0].height == expected
        assert result[1:] == [date_header, gap, test_header, body]

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


class TestHeaderGroupLayout:
    """A date heading followed by a test heading must move as one group."""

    # SimpleDocTemplate's frame also has 6pt of padding at the top and bottom
    USABLE = letter[1] - 1 * inch - 0.75 * inch - 12

    def _story(self, gen, free_points):
        return [
            Spacer(1, self.USABLE - free_points),
            Paragraph("DATE", gen.styles["DateGroupHeader"]),
            Spacer(1, 0.05 * inch),
            Paragraph("TEST", gen.styles["SubsectionHeader"]),
        ] + [Paragraph(f"body {i}", gen.styles["CustomBody"]) for i in range(6)]

    def _room_for_date_heading_and_four_lines_only(self, gen):
        """Enough for the date heading + 4 body lines, but not the test heading too."""
        date_style = gen.styles["DateGroupHeader"]
        date_height = (
            date_style.leading + date_style.spaceBefore + date_style.spaceAfter
        )
        return date_height + 4 * gen.BODY_LINE_HEIGHT + 2

    def test_date_heading_is_not_stranded_before_a_test_heading(self):
        gen = _generator()
        story = self._story(gen, self._room_for_date_heading_and_four_lines_only(gen))
        placed = _build(gen._keep_headers_with_body(story))

        assert placed["DATE"] == placed["TEST"] == placed["body 0"] == 2

    def test_per_header_breaks_would_have_stranded_the_date_heading(self):
        """Documents the bug: a break before each header separately strands DATE."""
        gen = _generator()
        story = self._story(gen, self._room_for_date_heading_and_four_lines_only(gen))
        per_header = []
        for flowable in story:
            if gen._is_header(flowable):
                per_header.append(
                    CondPageBreak(
                        gen._header_height(flowable) + 4 * gen.BODY_LINE_HEIGHT
                    )
                )
            per_header.append(flowable)
        placed = _build(per_header)

        assert placed["DATE"] == 1
        assert placed["TEST"] == 2

    def test_group_stays_on_the_page_when_everything_fits(self):
        gen = _generator()
        story = self._story(gen, 300)
        placed = _build(gen._keep_headers_with_body(story))

        assert placed["DATE"] == placed["TEST"] == placed["body 0"] == 1
