"""
C-CDA importer: a Continuity of Care Document as XML, or the IHE XDM zip that
MyChart produces for "Download my record". Conversion to FHIR is done by the
healthrecord-bridge package, which is an optional install.
"""

import re
from datetime import datetime, timezone
from typing import Dict, Iterator, List, Optional, Tuple, Union

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields

from .base_importer import BaseHealthRecordImporter, ImportFormatError
from .mappers import resource_mapper_registry
from .mappers._fhir import lookup_keys, obj, objects, resource_id, text
from .patient_match import (
    BirthDate,
    birth_date_text,
    birth_dates_compatible,
    more_exact_birth_date,
    patient_reference_fields,
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
    "Documents in the zip use the same record ids for patients that cannot be "
    "confirmed to be one person, so they cannot be combined. Import each document "
    "separately."
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
# merge_bundles gives each record the fullUrl <prefix><id>
MERGED_URL_PREFIX = "urn:uuid:"
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
    """Where the root element's start tag begins, past the XML prolog, or None."""
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
            # The end is the '>' after an internal subset in [...], when there is one
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
    """True when the root element is ClinicalDocument and the namespace bound to its prefix is the CDA one."""
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
        """Accept a C-CDA .xml, or any .zip: it is not read here, to_bundle says what is wrong with one."""
        name = filename.lower()
        if name.endswith(".xml"):
            return looks_like_ccda(data)
        # This is the only zip format
        return name.endswith(".zip")

    def to_bundle(self, data: bytes, filename: str) -> Tuple[dict, List[str]]:
        """Convert every document in the upload into one merged Bundle."""
        try:
            from healthrecord_bridge.ccda import UnsafeXmlError, convert_bytes
            from healthrecord_bridge.fhir.bundle import merge_bundles
        except ImportError as exc:
            raise ImportFormatError(MISSING_LIBRARY_MESSAGE) from exc

        if filename.lower().endswith(".zip"):
            documents = self._documents(data)
        else:
            documents = iter([(filename, data)])

        converted = []
        count = 0
        failure: Optional[Exception] = None
        # Each document is converted as it is read; after one fails, the rest
        # are read without converting and an archive error is raised first
        for name, content in documents:
            count += 1
            if failure is not None:
                continue
            try:
                bundle, report = convert_bytes(content, name)
                _check_converted(bundle)
            except Exception as exc:
                # Any error of the converter is reported as an invalid file
                failure = exc
                continue
            converted.append((_document_date(bundle), name, bundle, report))
        if not count:
            raise ImportFormatError("The zip file contains no C-CDA documents")
        if failure is not None:
            logger.warning(
                "Health record import upload is not a valid C-CDA",
                extra={
                    LogFields.EVENT: "health_import_invalid_ccda",
                    LogFields.ERROR: type(failure).__name__,
                },
            )
            message = (
                UNSAFE_DOCUMENT_MESSAGE
                if isinstance(failure, UnsafeXmlError)
                else INVALID_DOCUMENT_MESSAGE
            )
            raise ImportFormatError(message) from failure

        # Oldest document first, in archive order within one date
        converted.sort(key=lambda item: _sort_key(item[0]))
        bundles = [bundle for _, _, bundle, _ in converted]
        born = _patient_birth_dates(bundles)
        notes = _conflict_notes([(date, bundle) for date, _, bundle, _ in converted])
        for _, name, _, report in converted:
            notes.extend(_report_notes(report, prefix=name if count > 1 else ""))
        if len(notes) > MAX_NOTES:
            hidden = len(notes) - MAX_NOTES
            noun = "note" if hidden == 1 else "notes"
            notes = [*notes[:MAX_NOTES], f"{hidden} more conversion {noun} not shown"]
        merged = merge_bundles(bundles)
        # Each merged Patient gets the most exact birth date given for its id
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
    for _, resource in _resources(bundle):
        if resource["resourceType"] == "DocumentReference":
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


def _check_converted(bundle) -> None:
    """Raise ValueError unless every entry of the bundle holds a resource with a type and an id."""
    entries = bundle.get("entry") if isinstance(bundle, dict) else None
    if not isinstance(entries, list):
        raise ValueError("converted bundle has no entry list")
    for entry in entries:
        resource = entry.get("resource") if isinstance(entry, dict) else None
        if not (
            isinstance(resource, dict)
            and text(resource.get("resourceType"))
            and isinstance(resource.get("id"), str)
            and resource_id(resource) == resource["id"]
        ):
            raise ValueError("converted entry has no resource, type or id")


def _resources(bundle: dict) -> Iterator[Tuple[dict, dict]]:
    """Yield (entry, resource) for each entry whose resource has a resourceType; others are skipped."""
    for entry in objects(obj(bundle).get("entry")):
        resource = entry.get("resource")
        if isinstance(resource, dict) and isinstance(resource.get("resourceType"), str):
            yield entry, resource


def _content(resource: dict) -> dict:
    """The resource without its meta, which names the document it was converted from."""
    return {key: value for key, value in resource.items() if key != "meta"}


def _sort_key(date: Optional[datetime]) -> Tuple[int, datetime]:
    """Undated documents sort first, so any dated document outranks them."""
    return (1, date) if date else (0, datetime.min.replace(tzinfo=timezone.utc))


def _patient_birth_dates(bundles: List[dict]) -> Dict[str, BirthDate]:
    """The most exact birth date the documents give for each Patient id that has a readable one.

    Raises ImportFormatError when a Patient id has birth dates that cannot be
    one person's, or a record id is used for, or referred to by records of,
    Patients not confirmed to be one person.
    """
    # The most exact birth date seen so far for each Patient id
    patients: Dict[str, BirthDate] = {}
    present: List[Dict[str, str]] = []
    # The id of each document's Patient, or None unless it has exactly one
    sole: List[Optional[str]] = []
    for bundle in bundles:
        # Reference to Patient id, for the Patients of this document
        own: Dict[str, str] = {}
        ids = set()
        for _, resource in _resources(bundle):
            if resource["resourceType"] != "Patient":
                continue
            patient_id = resource_id(resource)
            ids.add(patient_id)
            if patient_id is None:
                continue
            own[f"Patient/{patient_id}"] = patient_id
            _same_person(
                patients,
                patient_id,
                read_birth_date(resource.get("birthDate")),
                PATIENT_ID_BIRTH_DATES_MESSAGE,
            )
        present.append(own)
        sole.append(ids.pop() if len(ids) == 1 else None)
    # The Patient id of the first copy of each record, which later copies are compared with
    owners: Dict[Tuple[str, str], str] = {}
    referenced = resource_mapper_registry.referenced_types()
    # The first copy of each referenced record
    copies: Dict[Tuple[str, str], dict] = {}
    # For each referenced record: the person of every copy and of every record
    # that refers to it from a document without a copy. The person is the Patient
    # id the record names, else its document's one Patient id, else the
    # document's place
    shared: Dict[Tuple[str, str], Dict[Union[str, int], None]] = {}
    differing = set()
    for place, (bundle, own) in enumerate(zip(bundles, present)):
        # The referenced records this document holds, and the people of its
        # records that refer to each
        held = set()
        refer: Dict[Tuple[str, str], Dict[Union[str, int], None]] = {}
        for _, resource in _resources(bundle):
            key = (resource["resourceType"], resource_id(resource))
            if key[0] in (*DOCUMENT_RESOURCE_TYPES, "Patient"):
                continue
            owner = own.get(_patient_reference(resource))
            person = owner if owner is not None else sole[place]
            person = place if person is None else person
            for target in _referred(resource):
                refer.setdefault(target, {}).setdefault(person)
            if key[1] is None:
                continue
            if key[0] in referenced:
                held.add(key)
                content = _content(resource)
                shared.setdefault(key, {}).setdefault(person)
                if content != copies.setdefault(key, content):
                    differing.add(key)
            if owner is None:
                continue
            first = owners.setdefault(key, owner)
            if first != owner and not _born_the_same_day(
                patients.get(first), patients.get(owner)
            ):
                raise ImportFormatError(SHARED_RECORD_IDS_MESSAGE)
        # A record referred to and not held counts as a copy that differs from every other
        for key, people in refer.items():
            if key not in held:
                shared.setdefault(key, {}).update(people)
                differing.add(key)
    for key in differing:
        # Referred to, but held by no document
        if key not in copies:
            continue
        first, *rest = shared[key]
        # A place is not a Patient id, so it has no birth date and confirms nobody
        if not all(
            _born_the_same_day(patients.get(first), patients.get(other))
            for other in rest
        ):
            raise ImportFormatError(SHARED_RECORD_IDS_MESSAGE)
    return patients


def _referred(resource: dict) -> Iterator[Tuple[str, str]]:
    """Keys of the records the merged bundle can resolve the resource's references to: by fullUrl and by type and id."""
    for resource_type, reference in resource_mapper_registry.bundle_references(
        resource
    ):
        keys = lookup_keys(resource_type, reference)
        if keys is None:
            continue
        url, key = keys
        if url.startswith(MERGED_URL_PREFIX):
            yield resource_type, url[len(MERGED_URL_PREFIX) :]
        if key[1] is not None:
            yield key


def _born_the_same_day(first: Optional[BirthDate], second: Optional[BirthDate]) -> bool:
    """True when both birth dates are given to the day and are the same day."""
    return first is not None and len(first) == 3 and first == second


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
    """Set birthDate, on a copy of each merged Patient, to the known one for its id when that gives more parts."""
    for entry, resource in _resources(merged):
        if resource["resourceType"] != "Patient":
            continue
        known = born.get(resource_id(resource))
        current = read_birth_date(resource.get("birthDate"))
        if more_exact_birth_date(current, known) != current:
            entry["resource"] = {**resource, "birthDate": birth_date_text(known)}


def _patient_reference(resource: dict) -> Optional[str]:
    """The reference string of the first field that names the resource's patient, or None."""
    for name in patient_reference_fields(resource.get("resourceType")):
        value = resource.get(name)
        reference = value.get("reference") if isinstance(value, dict) else None
        if isinstance(reference, str):
            return reference
    return None


def _conflict_notes(documents: List[Tuple[Optional[datetime], dict]]) -> List[str]:
    """Notes counting the resources whose copies differ, for (document date, bundle) pairs in merge order.

    Each resource is counted once: as settled by archive order, else by an
    undated copy, else by date.
    """
    copies = {}
    for date, bundle in documents:
        rank = _sort_key(date)
        for _, resource in _resources(bundle):
            key = (resource["resourceType"], resource_id(resource))
            if key[0] in DOCUMENT_RESOURCE_TYPES or key[1] is None:
                continue
            copies.setdefault(key, []).append((rank, _content(resource)))

    undated = _sort_key(None)
    by_date = by_dated = by_position = 0
    for versions in copies.values():
        kept_rank, kept = versions[-1]
        differing = [rank for rank, content in versions[:-1] if content != kept]
        if not differing:
            continue
        if kept_rank in differing:
            by_position += 1
        elif undated in differing:
            by_dated += 1
        else:
            by_date += 1

    notes = []
    if by_date:
        notes.append(
            f"{_records_appear(by_date)} in more than one document with different "
            "content; the newest document's copy was kept"
        )
    if by_dated:
        notes.append(
            f"{_records_appear(by_dated)} in more than one document with different "
            "content, and one of the documents has no date; the copy from the "
            "latest dated document was kept"
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
