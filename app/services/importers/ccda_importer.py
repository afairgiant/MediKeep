"""
C-CDA importer: a Continuity of Care Document as XML, or the IHE XDM zip that
MyChart produces for "Download my record". Conversion to FHIR is done by the
healthrecord-bridge package, which is an optional install.
"""

from typing import Iterator, List, Tuple

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

# How much of a file to look at when deciding whether it is a C-CDA
SNIFF_BYTES = 4096
MAX_NOTES = 20
# Longest piece of text from the file (a title, a value, a name) put in a note
MAX_NOTE_TEXT = 100


def looks_like_ccda(data: bytes) -> bool:
    """True when the start of the file names the CDA namespace and root element."""
    head = data[:SNIFF_BYTES]
    if head.startswith((b"\xff\xfe", b"\xfe\xff")):
        # XML requires a byte order mark on UTF-16; read the start as text
        head = head.decode("utf-16", errors="ignore").encode("utf-8")
    return b"urn:hl7-org:v3" in head and b"ClinicalDocument" in head


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

        bundles = []
        notes: List[str] = []
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
            bundles.append(bundle)
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
