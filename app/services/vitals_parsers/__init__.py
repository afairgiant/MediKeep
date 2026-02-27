"""
Vitals CSV parsers.

Pluggable parser system for importing vitals from device-specific CSV exports.
Mirrors the pattern in app/services/lab_parsers/.
"""

from typing import Dict, List, Optional

from .base_parser import BaseVitalsParser, VitalsParseResult, VitalsReading
from .dexcom_parser import DexcomParser


class VitalsParserRegistry:
    """Registry for vitals CSV parsers keyed by device identifier."""

    def __init__(self):
        self._parsers: Dict[str, BaseVitalsParser] = {}
        self._register_defaults()

    def _register_defaults(self):
        self.register(DexcomParser())

    def register(self, parser: BaseVitalsParser):
        """Register a parser by its import_source key."""
        self._parsers[parser.IMPORT_SOURCE_KEY] = parser

    def get_parser(self, key: str) -> Optional[BaseVitalsParser]:
        """Get a parser by device key."""
        return self._parsers.get(key)

    def get_available_devices(self) -> List[dict]:
        """Return list of {key, name} for all registered parsers."""
        return [
            {"key": p.IMPORT_SOURCE_KEY, "name": p.DEVICE_NAME}
            for p in self._parsers.values()
        ]

    def auto_detect(self, csv_content: str) -> Optional[BaseVitalsParser]:
        """Try to auto-detect the correct parser for the given CSV content."""
        for parser in self._parsers.values():
            if parser.validate_format(csv_content):
                return parser
        return None


# Global registry instance
vitals_parser_registry = VitalsParserRegistry()


__all__ = [
    "BaseVitalsParser",
    "VitalsParseResult",
    "VitalsReading",
    "DexcomParser",
    "VitalsParserRegistry",
    "vitals_parser_registry",
]
