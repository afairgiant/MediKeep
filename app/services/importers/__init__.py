"""
Health record importers.

Pluggable importer system for files exported from other systems (FHIR bundles,
C-CDA, ...). Each importer produces a FHIR R4 Bundle; the resource mappers in
mappers/ then write MediKeep rows. Mirrors the pattern in app/services/vitals_parsers/.
"""

from typing import Dict, List, Optional

from .base_importer import BaseHealthRecordImporter, ImportFormatError
from .fhir_bundle_importer import FhirBundleImporter


class HealthRecordImporterRegistry:
    """Registry for health record importers keyed by format."""

    def __init__(self):
        self._importers: Dict[str, BaseHealthRecordImporter] = {}
        self._register_defaults()

    def _register_defaults(self):
        self.register(FhirBundleImporter())

    def register(self, importer: BaseHealthRecordImporter):
        """Register an importer by its FORMAT_KEY."""
        self._importers[importer.FORMAT_KEY] = importer

    def get_importer(self, key: str) -> Optional[BaseHealthRecordImporter]:
        """Get an importer by format key."""
        return self._importers.get(key)

    def get_available_formats(self) -> List[dict]:
        """Return list of {key, name, extensions} for all registered importers."""
        return [
            {
                "key": i.FORMAT_KEY,
                "name": i.FORMAT_NAME,
                "extensions": list(i.EXTENSIONS),
            }
            for i in self._importers.values()
        ]

    def allowed_extensions(self) -> List[str]:
        """Every extension some importer accepts."""
        return sorted({e for i in self._importers.values() for e in i.EXTENSIONS})

    def detect(self, data: bytes, filename: str) -> Optional[BaseHealthRecordImporter]:
        """Try to auto-detect the importer for the upload."""
        for importer in self._importers.values():
            if importer.validate_format(data, filename):
                return importer
        return None


# Global registry instance
health_record_importer_registry = HealthRecordImporterRegistry()


__all__ = [
    "BaseHealthRecordImporter",
    "ImportFormatError",
    "FhirBundleImporter",
    "HealthRecordImporterRegistry",
    "health_record_importer_registry",
]
