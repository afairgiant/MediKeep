"""
Base class for health record importers.
Each file format (FHIR bundle, C-CDA, ...) has an importer that turns an upload
into a FHIR R4 Bundle dict for the resource mappers.
"""

from abc import ABC, abstractmethod
from typing import List, Tuple


class ImportFormatError(ValueError):
    """The upload is not a usable file of the expected format."""


class BaseHealthRecordImporter(ABC):
    """Base class for health record importers."""

    FORMAT_KEY = "generic"
    FORMAT_NAME = "Generic"
    EXTENSIONS: Tuple[str, ...] = ()
    SOURCE = "generic"  # Written to import_provenance.source

    @abstractmethod
    def validate_format(self, data: bytes, filename: str) -> bool:
        """Check whether the upload looks like this importer's format."""

    @abstractmethod
    def to_bundle(self, data: bytes, filename: str) -> Tuple[dict, List[str]]:
        """
        Convert the upload into a FHIR R4 Bundle dict, or raise ImportFormatError.

        Also returns notes about the conversion, shown in the preview and execute
        warnings (for example sections the converter did not map); an empty list
        when there are none.
        """
