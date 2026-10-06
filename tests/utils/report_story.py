"""Helpers for reading the text of a custom report story in tests."""

from typing import Any, Iterable, List

from reportlab.platypus import Paragraph, Table


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
