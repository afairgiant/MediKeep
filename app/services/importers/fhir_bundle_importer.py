"""FHIR R4 Bundle importer: a JSON file that is already in the internal format."""

import json

from .base_importer import BaseHealthRecordImporter, ImportFormatError


class FhirBundleImporter(BaseHealthRecordImporter):
    """Importer for FHIR R4 Bundle JSON files."""

    FORMAT_KEY = "fhir_bundle"
    FORMAT_NAME = "FHIR R4 Bundle (JSON)"
    EXTENSIONS = ("json",)
    SOURCE = "fhir"

    def validate_format(self, data: bytes, filename: str) -> bool:
        """Accept .json files whose top-level resourceType is Bundle."""
        if not filename.lower().endswith(".json"):
            return False
        try:
            return self._load(data).get("resourceType") == "Bundle"
        except (ImportFormatError, RecursionError):
            return False

    def to_bundle(self, data: bytes, filename: str) -> dict:
        """Parse the JSON and check that it is a Bundle with an entry list."""
        bundle = self._load(data)
        if bundle.get("resourceType") != "Bundle":
            raise ImportFormatError("File is not a FHIR Bundle")
        if not isinstance(bundle.get("entry", []), list):
            raise ImportFormatError("Bundle entry is not a list")
        bundle.setdefault("entry", [])
        return bundle

    @staticmethod
    def _load(data: bytes) -> dict:
        try:
            parsed = json.loads(data.decode("utf-8-sig"))
        except (UnicodeDecodeError, ValueError) as exc:
            raise ImportFormatError(f"Invalid JSON: {exc}") from exc
        except RecursionError as exc:
            raise ImportFormatError("JSON is nested too deeply") from exc
        if not isinstance(parsed, dict):
            raise ImportFormatError("JSON root is not an object")
        return parsed
