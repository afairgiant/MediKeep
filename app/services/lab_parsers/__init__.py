"""
Lab-specific PDF parsers.

This module provides a registry of lab-specific parsers that can automatically
detect and parse different lab formats (LabCorp, Quest, etc.).
"""

from typing import List, Optional
from .base_parser import BaseLabParser, LabTestResult
from .labcorp_parser_v2 import LabCorpParserV2
from .quest_parser import QuestParser


class LabParserRegistry:
    """Registry for lab-specific parsers."""

    def __init__(self):
        # Register all available parsers
        self.parsers: List[BaseLabParser] = [
            LabCorpParserV2(),  # Using improved V2 parser
            QuestParser(),
            # Add more parsers here as they're implemented:
            # SonoraQuestParser(),
            # etc.
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

    def parse(self, text: str) -> tuple[List[LabTestResult], str]:
        """
        Automatically detect lab and parse results.

        Args:
            text: Extracted PDF text

        Returns:
            (List of test results, lab name)
        """
        parser = self.get_parser(text)

        if parser:
            results = parser.parse(text)
            return results, parser.LAB_NAME

        # No specific parser found, return empty
        return [], "Unknown"


# Global registry instance
lab_parser_registry = LabParserRegistry()


__all__ = [
    'BaseLabParser',
    'LabTestResult',
    'LabCorpParserV2',
    'QuestParser',
    'LabParserRegistry',
    'lab_parser_registry'
]
