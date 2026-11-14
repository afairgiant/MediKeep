"""
C-CDA importer: a Continuity of Care Document as XML, or the IHE XDM zip that
MyChart produces for "Download my record". Conversion to FHIR is done by the
healthrecord-bridge package, which is an optional install.
"""

import re
from datetime import datetime, timezone
from typing import Dict, Iterator, List, Optional, Tuple

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields

from .base_importer import BaseHealthRecordImporter, ImportFormatError
from .patient_match import (
    PATIENT_REFERENCE_FIELDS,
    BirthDate,
    birth_date_text,
    birth_dates_compatible,
    more_exact_birth_date,
    read_birth_date,
)
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
SHARED_RECORD_IDS_MESSAGE = (
    "Documents in the zip are for different people but use the same record ids, "
    "so they cannot be combined. Import each document separately."
)
PATIENT_ID_BIRTH_DATES_MESSAGE = (
    "Documents in the zip give different birth dates for the same patient id, "
    "so they cannot be combined. Import each document separately."
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
_ROOT_NAME = re.compile(rb"<(?:([^\s:<>/]+):)?ClinicalDocument(?=[\s/>]|\Z)")
# One attribute of a start tag; a quoted value may hold '>'
_ATTRIBUTE = re.compile(
    rb"""[ \t\r\n]+([^\s=<>/"']+)[ \t\r\n]*=[ \t\r\n]*(?:"([^"]*)"|'([^']*)')"""
)


def _root_start(data: bytes) -> Optional[int]:
    """Where the root element's start tag begins, past the XML prolog, or None.

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
    return pos if data.startswith(b"<", pos) else None


def looks_like_ccda(data: bytes) -> bool:
    """True when the root element is ClinicalDocument in the CDA namespace.

    The namespace has to be the one bound to the root's own prefix (or the
    default namespace for an unprefixed root); a declaration for some other
    prefix does not count.
    """
    if data.startswith(_UTF16_BOMS):
        # XML requires a byte order mark on UTF-16; read it as text
        data = data.decode("utf-16", errors="ignore").encode("utf-8")
    elif data.startswith(_UTF8_BOM):
        data = data[len(_UTF8_BOM) :]
    start = _root_start(data)
    root = _ROOT_NAME.match(data, start) if start is not None else None
    if root is None:
        return False
    declaration = b"xmlns:" + root.group(1) if root.group(1) else b"xmlns"
    pos = root.end()
    while attribute := _ATTRIBUTE.match(data, pos):
        if attribute.group(1) == declaration:
            value = attribute.group(2)
            if value is None:
                value = attribute.group(3)
            return value == CDA_NAMESPACE
        pos = attribute.end()
    return False


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
            converted.append((_document_date(bundle), name, bundle, report))

        # Documents may repeat an entry (the same problem in two visit summaries)
        # and the merge keeps the last copy, so order them oldest first: the
        # newest document's version wins, not the one last in the archive.
        # The sort is stable, so documents with one date keep their archive order
        converted.sort(key=lambda item: _sort_key(item[0]))
        bundles = [bundle for _, _, bundle, _ in converted]
        born = _patient_birth_dates(bundles)
        notes = _conflict_notes([(date, bundle) for date, _, bundle, _ in converted])
        for _, name, _, report in converted:
            notes.extend(
                _report_notes(report, prefix=name if len(documents) > 1 else "")
            )
        if len(notes) > MAX_NOTES:
            hidden = len(notes) - MAX_NOTES
            noun = "note" if hidden == 1 else "notes"
            notes = [*notes[:MAX_NOTES], f"{hidden} more conversion {noun} not shown"]
        merged = merge_bundles(bundles)
        # The last copy of a Patient may give less of the birth date than another
        _keep_exact_birth_dates(merged, born)
        return merged, notes

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


def _patient_birth_dates(bundles: List[dict]) -> Dict[str, BirthDate]:
    """The most exact birth date the documents give for each Patient id.

    Raises when merging the documents would mix the records of two people.
    The merge keeps one copy per resource type and id, before the patients are
    compared. So it is refused when two documents use one id for a record of
    different people, where one person's record would replace the other's, and
    when they use one Patient id for different people, where both would become
    one Patient.

    The birth date tells people apart, as in patient_match: a record's person
    is the Patient its subject or patient names in its own document, and only
    birth dates that cannot be one person's are a difference. Documents may
    give one person different Patient ids, so the ids alone say nothing. A
    copy whose Patient is not in its document or has no readable birth date
    is merged, and so are the resources that describe the document.

    A Patient id that no document gives a readable birth date is not in the
    result.
    """
    # The most exact birth date seen so far for each Patient id and record
    patients: Dict[str, BirthDate] = {}
    records: Dict[Tuple[str, str], Optional[BirthDate]] = {}
    for bundle in bundles:
        # A record may come before its Patient, so read the Patients first
        born: Dict[str, Optional[BirthDate]] = {}
        for entry in bundle.get("entry", []):
            resource = entry["resource"]
            if resource["resourceType"] == "Patient":
                birth_date = read_birth_date(resource.get("birthDate"))
                born[f"Patient/{resource['id']}"] = birth_date
                _same_person(
                    patients, resource["id"], birth_date, PATIENT_ID_BIRTH_DATES_MESSAGE
                )
        for entry in bundle.get("entry", []):
            resource = entry["resource"]
            if resource["resourceType"] in (*DOCUMENT_RESOURCE_TYPES, "Patient"):
                continue
            birth_date = born.get(_patient_reference(resource))
            key = (resource["resourceType"], resource["id"])
            _same_person(records, key, birth_date, SHARED_RECORD_IDS_MESSAGE)
    return patients


def _same_person(
    seen: dict, key, birth_date: Optional[BirthDate], message: str
) -> None:
    """Note the birth date given for key; raise when it cannot go with an earlier one."""
    if birth_date is None:
        return
    known = seen.get(key)
    if not birth_dates_compatible(known, birth_date):
        raise ImportFormatError(message)
    seen[key] = more_exact_birth_date(known, birth_date)


def _keep_exact_birth_dates(merged: dict, born: Dict[str, BirthDate]) -> None:
    """Give each Patient of the merged bundle the most exact birth date known for its id.

    The merge keeps the last copy of a Patient, which may give only the year
    of a birth date that an earlier document gave in full, and the patients
    are compared by what the merged copy says. Only birthDate is set, on a
    copy of the resource, and only when the known value gives more parts than
    the merged one.
    """
    for entry in merged.get("entry", []):
        resource = entry["resource"]
        if resource["resourceType"] != "Patient":
            continue
        known = born.get(resource["id"])
        current = read_birth_date(resource.get("birthDate"))
        if more_exact_birth_date(current, known) != current:
            entry["resource"] = {**resource, "birthDate": birth_date_text(known)}


def _patient_reference(resource: dict) -> Optional[str]:
    """The reference string of the resource's subject or patient, or None."""
    for name in PATIENT_REFERENCE_FIELDS:
        value = resource.get(name)
        reference = value.get("reference") if isinstance(value, dict) else None
        if isinstance(reference, str):
            return reference
    return None


def _conflict_notes(documents: List[Tuple[Optional[datetime], dict]]) -> List[str]:
    """Notes counting the resources that documents describe differently.

    Takes (document date, bundle) pairs in merge order, oldest first, where the
    last copy of a resource is the one kept. A resource whose kept copy comes
    from a later-dated document than every copy that differs from it is counted
    as settled by date. When a differing copy has the same date as the kept one,
    or neither has a date, only the order in the archive chose between them, and
    those are counted apart so the note does not claim a newest document.

    Only content is compared. The resources that describe the document itself
    are left out (Provenance records the archive member it came from,
    DocumentReference the date of each version), and so is each resource's
    meta, which names the document it was converted from.
    """
    copies = {}
    for date, bundle in documents:
        rank = _sort_key(date)
        for entry in bundle.get("entry", []):
            resource = entry["resource"]
            if resource["resourceType"] in DOCUMENT_RESOURCE_TYPES:
                continue
            key = (resource["resourceType"], resource["id"])
            content = {k: v for k, v in resource.items() if k != "meta"}
            copies.setdefault(key, []).append((rank, content))

    by_date = by_position = 0
    for versions in copies.values():
        kept_rank, kept = versions[-1]
        differing = [rank for rank, content in versions[:-1] if content != kept]
        if not differing:
            continue
        if kept_rank in differing:
            by_position += 1
        else:
            by_date += 1

    notes = []
    if by_date:
        notes.append(
            f"{_records_appear(by_date)} in more than one document with different "
            "content; the newest document's copy was kept"
        )
    if by_position:
        notes.append(
            f"{_records_appear(by_position)} in more than one document with "
            "different content, and the documents have the same date or no date; "
            "the copy from the document later in the zip was kept"
        )
    return notes


def _records_appear(count: int) -> str:
    return f"{count} {'record appears' if count == 1 else 'records appear'}"


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
