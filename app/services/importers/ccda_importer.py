"""
C-CDA importer: a Continuity of Care Document as XML, or the IHE XDM zip that
MyChart produces for "Download my record". Conversion to FHIR is done by the
healthrecord-bridge package, which is an optional install.
"""

import re
from datetime import datetime, timezone
from typing import Iterator, List, Optional, Tuple

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields

from .base_importer import BaseHealthRecordImporter, ImportFormatError
from .upload import iter_zip_members

logger = get_logger(__name__, "app")

MISSING_LIBRARY_MESSAGE = (
    "C-CDA import needs the healthrecord-bridge package. "
    "Install it with: pip install -r requirements-import.txt"
)
# Fixed messages: the library's error text quotes the file name and parser output
INVALID_DOCUMENT_MESSAGE = "Not a valid C-CDA document"
UNSAFE_DOCUMENT_MESSAGE = (
    "Not a valid C-CDA document: DOCTYPE and entity declarations are not accepted"
)

MAX_NOTES = 20
# Longest piece of text from the file (a title, a value, a name) put in a note
MAX_NOTE_TEXT = 100

CDA_NAMESPACE = b"urn:hl7-org:v3"
# Resources about the document rather than the patient
DOCUMENT_RESOURCE_TYPES = ("DocumentReference", "Provenance")
_UTF8_BOM = b"\xef\xbb\xbf"
_UTF16_BOMS = (b"\xff\xfe", b"\xfe\xff")
_WHITESPACE = re.compile(rb"[ \t\r\n]*")
# The root element's name, with or without a namespace prefix
_ROOT_NAME = re.compile(rb"<(?:[^\s:<>/]+:)?ClinicalDocument(?=[\s/>]|\Z)")


def _root_start_tag(data: bytes) -> Optional[bytes]:
    """The root element's start tag, read past the XML prolog, or None.

    The prolog (declaration, processing instructions, comments and a DOCTYPE)
    can be any length, so this scans rather than looking at a fixed head. Each
    step moves forward, so the cost is linear in the file.
    """
    pos = 0
    while True:
        pos = _WHITESPACE.match(data, pos).end()
        if data.startswith(b"<?", pos):
            close = data.find(b"?>", pos + 2)
            if close < 0:
                return None
            pos = close + 2
        elif data.startswith(b"<!--", pos):
            close = data.find(b"-->", pos + 4)
            if close < 0:
                return None
            pos = close + 3
        elif data.startswith(b"<!DOCTYPE", pos):
            # An internal subset in [...] may itself hold '>' characters. The
            # search for '[' stops at the candidate '>', so each step reads only
            # its own declaration and a run of them stays linear
            close = data.find(b">", pos)
            if close < 0:
                return None
            subset = data.find(b"[", pos, close)
            if subset >= 0:
                subset_end = data.find(b"]", subset)
                close = data.find(b">", subset_end) if subset_end >= 0 else -1
                if close < 0:
                    return None
            pos = close + 1
        else:
            break
    if not data.startswith(b"<", pos):
        return None
    close = data.find(b">", pos)
    return data[pos:] if close < 0 else data[pos : close + 1]


def looks_like_ccda(data: bytes) -> bool:
    """True when the root element is ClinicalDocument in the CDA namespace."""
    if data.startswith(_UTF16_BOMS):
        # XML requires a byte order mark on UTF-16; read it as text
        data = data.decode("utf-16", errors="ignore").encode("utf-8")
    elif data.startswith(_UTF8_BOM):
        data = data[len(_UTF8_BOM) :]
    tag = _root_start_tag(data)
    return tag is not None and bool(_ROOT_NAME.match(tag)) and CDA_NAMESPACE in tag


class CcdaImporter(BaseHealthRecordImporter):
    """Importer for C-CDA XML documents and MyChart XDM zips."""

    FORMAT_KEY = "ccda"
    FORMAT_NAME = "C-CDA document or MyChart export (XML, zip)"
    EXTENSIONS = ("xml", "zip")
    SOURCE = "ccda"

    def validate_format(self, data: bytes, filename: str) -> bool:
        """Accept a C-CDA .xml, or a .zip that holds one or cannot be read (to_bundle says why)."""
        name = filename.lower()
        if name.endswith(".xml"):
            return looks_like_ccda(data)
        if name.endswith(".zip"):
            try:
                return any(True for _ in self._documents(data))
            except ImportFormatError:
                # A zip that breaks a cap or is damaged is still claimed, since
                # this is the only zip format, so to_bundle reports the reason
                return True
        return False

    def to_bundle(self, data: bytes, filename: str) -> Tuple[dict, List[str]]:
        """Convert every document in the upload into one merged Bundle."""
        try:
            from healthrecord_bridge.ccda import UnsafeXmlError, convert_bytes
            from healthrecord_bridge.fhir.bundle import merge_bundles
        except ImportError as exc:
            raise ImportFormatError(MISSING_LIBRARY_MESSAGE) from exc

        if filename.lower().endswith(".zip"):
            documents = list(self._documents(data))
            if not documents:
                raise ImportFormatError("The zip file contains no C-CDA documents")
        else:
            documents = [(filename, data)]

        converted = []
        for name, content in documents:
            try:
                bundle, report = convert_bytes(content, name)
            except Exception as exc:
                # CcdaError is the library's input error; anything else is a
                # converter bug on odd input, still reported as an invalid file
                logger.warning(
                    "Health record import upload is not a valid C-CDA",
                    extra={
                        LogFields.EVENT: "health_import_invalid_ccda",
                        LogFields.ERROR: type(exc).__name__,
                    },
                )
                message = (
                    UNSAFE_DOCUMENT_MESSAGE
                    if isinstance(exc, UnsafeXmlError)
                    else INVALID_DOCUMENT_MESSAGE
                )
                raise ImportFormatError(message) from exc
            converted.append((name, bundle, report))

        # Documents may repeat an entry (the same problem in two visit summaries)
        # and the merge keeps the last copy, so order them oldest first: the
        # newest document's version wins, not the one last in the archive
        converted.sort(key=lambda item: _sort_key(_document_date(item[1])))
        bundles = [bundle for _, bundle, _ in converted]
        notes: List[str] = []
        conflicts = _count_conflicts(bundles)
        if conflicts:
            notes.append(
                f"{conflicts} {'record appears' if conflicts == 1 else 'records appear'} "
                "in more than one document with different content; "
                "the newest document's copy was kept"
            )
        for name, _, report in converted:
            notes.extend(
                _report_notes(report, prefix=name if len(documents) > 1 else "")
            )
        if len(notes) > MAX_NOTES:
            hidden = len(notes) - MAX_NOTES
            notes = [*notes[:MAX_NOTES], f"{hidden} more conversion notes not shown"]
        return merge_bundles(bundles), notes

    @staticmethod
    def _documents(data: bytes) -> Iterator[Tuple[str, bytes]]:
        """Yield the C-CDA members of a zip; XDM metadata and other XML are skipped."""
        for name, content in iter_zip_members(data, (".xml",)):
            if looks_like_ccda(content):
                yield name, content


def _document_date(bundle: dict) -> Optional[datetime]:
    """When the document was produced, from its DocumentReference, or None."""
    for entry in bundle.get("entry", []):
        resource = entry.get("resource") or {}
        if resource.get("resourceType") == "DocumentReference":
            value = resource.get("date")
            if not isinstance(value, str):
                return None
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                return None
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed
    return None


def _sort_key(date: Optional[datetime]) -> Tuple[int, datetime]:
    """Undated documents sort first, so any dated document outranks them."""
    return (1, date) if date else (0, datetime.min.replace(tzinfo=timezone.utc))


def _count_conflicts(bundles: List[dict]) -> int:
    """How many resources appear in more than one bundle with different content.

    Only content is compared. The resources that describe the document itself
    are left out (Provenance records the archive member it came from,
    DocumentReference the date of each version), and so is each resource's
    meta, which names the document it was converted from.
    """
    seen = {}
    conflicting = set()
    for bundle in bundles:
        for entry in bundle.get("entry", []):
            resource = entry["resource"]
            if resource["resourceType"] in DOCUMENT_RESOURCE_TYPES:
                continue
            key = (resource["resourceType"], resource["id"])
            content = {k: v for k, v in resource.items() if k != "meta"}
            if key in seen and seen[key] != content:
                conflicting.add(key)
            seen[key] = content
    return len(conflicting)


def _clip(text: str) -> str:
    """Text from the file, cut to MAX_NOTE_TEXT characters."""
    text = str(text)
    if len(text) <= MAX_NOTE_TEXT:
        return text
    return text[: MAX_NOTE_TEXT - 1] + "\u2026"


def _report_notes(report, prefix: str = "") -> List[str]:
    """Turn the library's conversion report into one line per thing not converted."""
    lead = f"{_clip(prefix)}: " if prefix else ""
    notes = []
    for document in report.documents:
        for unknown in document.unknown_sections:
            if not unknown.entries:
                continue
            title = _clip(unknown.title or unknown.code or "untitled")
            notes.append(
                f"{lead}Section '{title}' is not converted yet "
                f"({unknown.entries} {'entry' if unknown.entries == 1 else 'entries'})"
            )
        for section in document.sections:
            if section.null_flavor:
                notes.append(
                    f"{lead}Section '{section.name}' is marked "
                    f"{_clip(section.null_flavor)}"
                )
            reasons = {}
            for skipped in section.skipped:
                reasons[skipped.reason] = reasons.get(skipped.reason, 0) + 1
            for reason, count in reasons.items():
                notes.append(f"{lead}{section.name}: {count} skipped ({_clip(reason)})")
    return notes
