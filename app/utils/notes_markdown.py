"""Render Markdown notes as ReportLab Paragraph markup.

The dialect must match the frontend notes renderer (frontend/src/utils/notesMarkdown.ts):
CommonMark plus strikethrough and task lists, a single newline is a line break, and raw
HTML, indented code, setext headings and character references stay literal text.
"""

import html
from typing import List, Optional, Tuple

from markdown_it import MarkdownIt
from markdown_it.token import Token
from mdit_py_plugins.tasklists import tasklists_plugin

# Free-text columns stored as Markdown, keyed by report/export section name.
MARKDOWN_FIELDS_BY_SECTION = {
    "allergies": frozenset({"notes"}),
    "conditions": frozenset({"notes"}),
    "emergency_contacts": frozenset({"notes"}),
    "encounters": frozenset(
        {"notes", "diagnosis", "treatment_plan", "follow_up_instructions"}
    ),
    "family_history": frozenset({"notes"}),
    "immunizations": frozenset({"notes"}),
    "injuries": frozenset(
        {"notes", "recovery_notes", "mechanism", "treatment_received"}
    ),
    "insurance": frozenset({"notes"}),
    "lab_results": frozenset({"notes"}),
    "medical_equipment": frozenset({"notes", "usage_instructions"}),
    "medications": frozenset({"notes", "side_effects"}),
    "procedures": frozenset(
        {"notes", "anesthesia_notes", "description", "procedure_complications"}
    ),
    "symptoms": frozenset({"general_notes"}),
    "treatments": frozenset({"notes", "description"}),
    "vitals": frozenset({"notes"}),
}

# Markdown columns on child records listed under a section record, keyed by list field.
NESTED_MARKDOWN_FIELDS = {
    "family_history": {"conditions": frozenset({"notes"})},
    "symptoms": {"occurrences": frozenset({"notes", "resolution_notes"})},
}

# Block kinds; only headings and nested lists are laid out differently.
_TEXT, _HEADING, _LIST = "text", "heading", "list"
_SAFE_LINK_PREFIXES = ("http://", "https://", "mailto:")
_INDENT = "&nbsp;" * 4
_HEADING_SIZE_STEP = {"h1": 3, "h2": 2, "h3": 1}
_INLINE_TAGS = {
    "strong_open": "<b>",
    "strong_close": "</b>",
    "em_open": "<i>",
    "em_close": "</i>",
    "s_open": "<strike>",
    "s_close": "</strike>",
    "softbreak": "<br/>",
    "hardbreak": "<br/>",
}


def _build_parser() -> MarkdownIt:
    parser = MarkdownIt("commonmark", {"html": False, "breaks": True})
    parser.enable("strikethrough")
    # Old plain-text notes use these shapes by accident; keep them literal.
    parser.disable(["code", "lheading", "html_block", "html_inline", "entity"])
    parser.use(tasklists_plugin)
    # Accept every link so unsafe ones reach _render_inline and show as their text only.
    parser.validateLink = lambda url: True
    return parser


_PARSER = _build_parser()


def _escape(text: str) -> str:
    return html.escape(text, quote=False)


def _is_safe_link(href: str) -> bool:
    return href.strip().lower().startswith(_SAFE_LINK_PREFIXES)


def _matching_close(tokens: List[Token], start: int) -> int:
    depth = 0
    for index in range(start, len(tokens)):
        depth += tokens[index].nesting
        if depth == 0:
            return index
    return len(tokens) - 1


def _render_inline(children: Optional[List[Token]]) -> str:
    parts: List[str] = []
    open_links: List[bool] = []
    for token in children or []:
        kind = token.type
        if kind in _INLINE_TAGS:
            parts.append(_INLINE_TAGS[kind])
        elif kind == "link_open":
            href = str(token.attrs.get("href", ""))
            safe = _is_safe_link(href)
            open_links.append(safe)
            if safe:
                parts.append(f'<a href="{html.escape(href, quote=True)}"><u>')
        elif kind == "link_close":
            if open_links and open_links.pop():
                parts.append("</u></a>")
        elif kind == "html_inline":
            # Only the tasklists plugin emits this, since raw HTML is disabled.
            parts.append("[x]" if "checked" in token.content else "[&nbsp;&nbsp;]")
        else:
            parts.append(_escape(token.content))
    return "".join(parts)


def _render_list(
    tokens: List[Token], ordered: bool, first: int, depth: int
) -> List[str]:
    lines: List[str] = []
    number = first
    index = 0
    while index < len(tokens):
        token = tokens[index]
        close = _matching_close(tokens, index)
        if token.type == "list_item_open":
            if ordered:
                marker = f"{number}. "
            elif "task-list-item" in str(token.attrs.get("class", "")):
                marker = ""
            else:
                marker = "&bull; "
            lead = _INDENT * depth + marker
            follow = _INDENT * (depth + 1)
            item_lines: List[str] = []
            for kind, block_lines in _render_blocks(
                tokens[index + 1 : close], depth + 1
            ):
                if kind == _LIST:
                    item_lines.extend(block_lines)
                else:
                    item_lines.extend(
                        (follow if item_lines else lead) + line for line in block_lines
                    )
            lines.extend(item_lines or [lead.rstrip()])
            number += 1
        index = close + 1
    return lines


def _render_blocks(tokens: List[Token], depth: int = 0) -> List[Tuple[str, List[str]]]:
    blocks: List[Tuple[str, List[str]]] = []
    index = 0
    while index < len(tokens):
        token = tokens[index]
        kind = token.type
        close = _matching_close(tokens, index)
        if kind == "paragraph_open":
            blocks.append((_TEXT, [_render_inline(tokens[index + 1].children)]))
        elif kind == "heading_open":
            text = f"<b>{_render_inline(tokens[index + 1].children)}</b>"
            step = _HEADING_SIZE_STEP.get(token.tag, 0)
            if step:
                text = f'<font size="+{step}">{text}</font>'
            blocks.append((_HEADING, [text]))
        elif kind in ("bullet_list_open", "ordered_list_open"):
            ordered = kind == "ordered_list_open"
            first = int(token.attrs.get("start", 1)) if ordered else 1
            lines = _render_list(tokens[index + 1 : close], ordered, first, depth)
            blocks.append((_LIST, lines))
        elif kind == "blockquote_open":
            inner = _render_blocks(tokens[index + 1 : close], depth)
            lines = [f"{_INDENT}<i>{line}</i>" for _, block in inner for line in block]
            blocks.append((_TEXT, lines))
        elif kind == "fence":
            code = _escape(token.content.rstrip("\n")).replace("\n", "<br/>")
            blocks.append((_TEXT, [code]))
        elif kind == "hr":
            blocks.append((_TEXT, ["&#8212;" * 3]))
        index = close + 1
    return blocks


def notes_to_plain_text(text: Optional[str]) -> str:
    """Markdown note -> its words on one line, for titles and short previews."""
    if not text:
        return ""
    words: List[str] = []
    for token in _PARSER.parse(text):
        for child in token.children or []:
            if child.type in ("softbreak", "hardbreak"):
                words.append(" ")
            elif child.type != "html_inline":
                words.append(child.content)
        if token.type in ("paragraph_close", "heading_close", "fence"):
            words.append(token.content + " ")
    return " ".join("".join(words).split())


def notes_to_reportlab_markup(text: Optional[str]) -> str:
    """Markdown note -> markup for a single ReportLab Paragraph.

    ``text`` must be raw (not already escaped). The result contains only escaped text and
    <b>, <i>, <strike>, <u>, <font size>, <br/> and http/https/mailto <a href> tags.
    """
    if not text:
        return ""
    parts: List[str] = []
    previous = None
    for kind, lines in _render_blocks(_PARSER.parse(text)):
        if previous is not None:
            # A heading is followed by a line break; other blocks by a blank line.
            parts.append("<br/>" if previous == _HEADING else "<br/><br/>")
        parts.append("<br/>".join(lines))
        previous = kind
    return "".join(parts)
