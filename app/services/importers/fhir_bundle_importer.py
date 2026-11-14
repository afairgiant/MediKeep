"""FHIR R4 Bundle importer: a JSON file that is already in the internal format."""

import json
import re
from typing import List, Tuple

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields

from .base_importer import BaseHealthRecordImporter, ImportFormatError

logger = get_logger(__name__, "app")

SNIFF_BYTES = 4096
_BUNDLE_HEADER = re.compile(rb'"resourceType"\s*:\s*"Bundle"')


class FhirBundleImporter(BaseHealthRecordImporter):
    """Importer for FHIR R4 Bundle JSON files."""

    FORMAT_KEY = "fhir_bundle"
    FORMAT_NAME = "FHIR R4 Bundle (JSON)"
    EXTENSIONS = ("json",)
    SOURCE = "fhir"

    def validate_format(self, data: bytes, filename: str) -> bool:
        """Accept .json files whose root is a Bundle, sniffing the first bytes before parsing."""
        if not filename.lower().endswith(".json"):
            return False
        if _BUNDLE_HEADER.search(data[:SNIFF_BYTES]):
            return True
        # Key order is not fixed: sorted-key writers put entry before resourceType
        try:
            return self._load(data).get("resourceType") == "Bundle"
        except ImportFormatError:
            return False

    def to_bundle(self, data: bytes, filename: str) -> Tuple[dict, List[str]]:
        """Parse the JSON and check that it is a Bundle with an entry list."""
        bundle = self._load(data)
        if bundle.get("resourceType") != "Bundle":
            raise ImportFormatError("File is not a FHIR Bundle")
        entries = bundle.get("entry", [])
        if not isinstance(entries, list):
            raise ImportFormatError("Bundle entry is not a list")
        for index, entry in enumerate(entries):
            if not isinstance(entry, dict):
                raise ImportFormatError(f"Bundle entry {index} is not an object")
            if "resource" in entry and not isinstance(entry["resource"], dict):
                raise ImportFormatError(
                    f"Bundle entry {index} resource is not an object"
                )
        bundle["entry"] = entries
        return bundle, []

    @staticmethod
    def _load(data: bytes) -> dict:
        """Decode and parse the upload, raising ImportFormatError on bad input."""
        try:
            parsed = json.loads(data.decode("utf-8-sig"))
        except (UnicodeDecodeError, ValueError) as exc:
            logger.warning(
                "Health record import upload is not valid JSON",
                extra={
                    LogFields.EVENT: "health_import_invalid_json",
                    LogFields.ERROR: type(exc).__name__,
                },
            )
            raise ImportFormatError("File is not valid JSON") from exc
        except RecursionError as exc:
            raise ImportFormatError("JSON is nested too deeply") from exc
        if not isinstance(parsed, dict):
            raise ImportFormatError("JSON root is not an object")
        return parsed
