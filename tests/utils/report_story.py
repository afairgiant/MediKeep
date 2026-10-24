"""Helpers for reading the text of report and export PDF stories in tests."""

from typing import Any, Iterable, List

from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, Table

from app.services.export_service import ExportService
from app.services.report_translations import get_translator


def _cell_text(cell: Any) -> str:
    return str(cell.text) if isinstance(cell, Paragraph) else str(cell)


def story_texts(story: Iterable[Any]) -> List[str]:
    """Flatten a story into text lines, in document order.

    Paragraphs yield their markup text. Tables yield one line per row; a
    two-column label/value row reads "Label: value" so assertions can treat
    table rows like the old one-line-per-field paragraphs.
    """
    lines: List[str] = []
    for element in story:
        if isinstance(element, Table):
            for row in element._cellvalues:
                cells = [_cell_text(cell) for cell in row]
                if len(cells) == 2:
                    lines.append(f"{cells[0]}: {cells[1]}")
                else:
                    lines.append(" ".join(cells))
        elif hasattr(element, "text"):
            lines.append(str(element.text))
    return lines


def export_card_rows(section_name: str, record: dict, language: str) -> List[tuple]:
    """(label, value) text pairs of one export PDF card for ``record``."""
    story: List[Any] = []
    ExportService.__new__(ExportService)._add_card_based_section(
        story,
        [record],
        section_name,
        getSampleStyleSheet(),
        translator=get_translator(language),
    )
    return [
        (getattr(label, "text", label), getattr(value, "text", value))
        for flowable in story
        if isinstance(flowable, Table)
        for label, value in flowable._cellvalues
    ]
