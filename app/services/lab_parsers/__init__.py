"""
Lab-specific PDF parsers.

This module provides a registry of lab-specific parsers that can automatically
detect and parse different lab formats (LabCorp, Quest, etc.).
"""

from typing import Callable, List, Optional

from .base_parser import BaseLabParser, LabTestResult
from .epic_mychart_card_parser import EpicMyChartCardParser
from .epic_mychart_parser import EpicMyChartSingleColumnParser
from .labcorp_parser_v2 import LabCorpParserV2
from .quest_parser import QuestParser


class LabParserRegistry:
    """Registry for lab-specific parsers."""

    def __init__(self):
        # Register all available parsers. Order matters: the first parser whose
        # can_parse() matches wins.
        #
        # The Epic MyChart card parser is tried FIRST because its signature (the
        # MyChart "Test Details" header, the Epic Systems license, and the
        # gauge/two-column card structure) is unambiguous and far more specific
        # than a substring match. MyChart exports of labs performed by LabCorp
        # or Quest name that lab in the footer, so without this precedence the
        # LabCorp/Quest parsers would greedily claim them and fail on the Epic
        # layout. A genuine LabCorp/Quest report never carries the Epic card
        # signature, so this ordering does not affect their routing.
        #
        # The single-column Epic parser is the fallback for simpler Epic text
        # that lacks the card signature.
        self.parsers: List[BaseLabParser] = [
            EpicMyChartCardParser(),
            LabCorpParserV2(),  # Using improved V2 parser
            QuestParser(),
            EpicMyChartSingleColumnParser(),
        ]

    def get_parser(self, text: str) -> Optional[BaseLabParser]:
        """
        Find the appropriate parser for the given text.

        Args:
            text: Extracted PDF text

        Returns:
            Parser instance if match found, None otherwise
        """
        for parser in self.parsers:
            if parser.can_parse(text):
                return parser
        return None

    def parse(
        self,
        text: str,
        layout_text_provider: Optional[Callable[[], Optional[str]]] = None,
    ) -> tuple[List[LabTestResult], str]:
        """
        Automatically detect lab and parse results.

        Args:
            text: Extracted PDF text (plain, used for detection)
            layout_text_provider: Callable returning layout-preserved text
                (pdfplumber ``layout=True``). Invoked lazily only when the
                selected parser sets ``prefers_layout_text``, so the expensive
                layout extraction is skipped for parsers that do not need it.

        Returns:
            (List of test results, lab name)
        """
        parser = self.get_parser(text)
        if parser is None:
            # No specific parser found, return empty
            return [], "Unknown"

        parse_text = text
        if parser.prefers_layout_text and layout_text_provider is not None:
            layout_text = layout_text_provider()
            if layout_text:
                parse_text = layout_text

        results = parser.parse(parse_text)
        return results, parser.LAB_NAME


# Global registry instance
lab_parser_registry = LabParserRegistry()


__all__ = [
    "BaseLabParser",
    "LabTestResult",
    "LabCorpParserV2",
    "QuestParser",
    "EpicMyChartCardParser",
    "EpicMyChartSingleColumnParser",
    "LabParserRegistry",
    "lab_parser_registry",
]
