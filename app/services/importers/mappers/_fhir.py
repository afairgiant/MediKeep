"""
Small FHIR helpers shared by the resource mappers.
"""

from contextlib import contextmanager
from contextvars import ContextVar
from datetime import date
from typing import Any, Dict, Iterator, List, Optional, Tuple

SNOMED = "http://snomed.info/sct"
ICD10CM = "http://hl7.org/fhir/sid/icd-10-cm"
ICD10 = "http://hl7.org/fhir/sid/icd-10"
RXNORM = "http://www.nlm.nih.gov/research/umls/rxnorm"
CONDITION_CLINICAL = "http://terminology.hl7.org/CodeSystem/condition-clinical"
ALLERGY_CLINICAL = "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical"


def codings(concept: Optional[dict]) -> List[dict]:
    """Coding entries of a CodeableConcept; empty for None or malformed input."""
    if not isinstance(concept, dict):
        return []
    return [c for c in concept.get("coding") or [] if isinstance(c, dict)]


def code_for(concept: Optional[dict], *systems: str) -> Optional[str]:
    """Code of the first coding in one of the given systems, in priority order."""
    for system in systems:
        for coding in codings(concept):
            if coding.get("system") == system and coding.get("code"):
                return str(coding["code"])
    return None


def first_code(concept: Optional[dict]) -> Optional[str]:
    """First code in a CodeableConcept regardless of system."""
    for coding in codings(concept):
        if coding.get("code"):
            return str(coding["code"])
    return None


def display_for(concept: Optional[dict]) -> Optional[str]:
    """Text for a CodeableConcept, falling back from text to display to code."""
    if not isinstance(concept, dict):
        return None
    text = concept.get("text")
    if text and str(text).strip():
        return str(text).strip()
    for coding in codings(concept):
        if coding.get("display"):
            return str(coding["display"]).strip()
    return first_code(concept)


def status_code(resource: dict, field: str, system: str) -> str:
    """Lower-cased code of a status CodeableConcept such as clinicalStatus."""
    concept = resource.get(field)
    return (code_for(concept, system) or first_code(concept) or "").lower()


def parse_date(value: Any) -> Optional[date]:
    """Parse a FHIR date or dateTime of any precision into a date."""
    if not value or not isinstance(value, str):
        return None
    text = value.strip()
    try:
        if len(text) == 4:
            return date(int(text), 1, 1)
        if len(text) == 7:
            return date(int(text[:4]), int(text[5:7]), 1)
        # The calendar date as written in the source's own zone; no UTC shift
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def past_date(value: Optional[date], warnings: List[str], what: str) -> Optional[date]:
    """Drop a date after today with a warning; the create schemas reject the whole row."""
    if value is not None and value > date.today():
        warnings.append(f"{what} {value.isoformat()} is in the future, dropped")
        return None
    return value


def to_float(value: Any) -> Optional[float]:
    """A finite float from a number or numeric string, else None."""
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number and abs(number) != float("inf") else None


def period(resource: dict, base: str) -> Tuple[Optional[str], Optional[str]]:
    """(start, end) strings from the <base>DateTime or <base>Period element."""
    if resource.get(f"{base}DateTime"):
        return resource[f"{base}DateTime"], None
    value = resource.get(f"{base}Period") or {}
    return value.get("start"), value.get("end")


def notes_text(resource: dict) -> Optional[str]:
    """Join the resource's Annotation texts into one string."""
    texts = [n.get("text") for n in resource.get("note") or [] if isinstance(n, dict)]
    joined = "\n".join(t.strip() for t in texts if t and t.strip())
    return joined or None


def ref_id(reference: Optional[dict]) -> Optional[str]:
    """Resource id from a Reference, accepting "Type/id", "#id" and "urn:uuid:id"."""
    ref = reference.get("reference") if isinstance(reference, dict) else None
    if not ref:
        return None
    ref = str(ref).replace("urn:uuid:", "").lstrip("#")
    return ref.rsplit("/", 1)[-1] or None


class BundleIndex:
    """Resources of one bundle keyed by (type, id), plus room for mapper caches."""

    def __init__(self, bundle: dict):
        """Walk the bundle once."""
        self.resources: Dict[Tuple[str, str], dict] = {}
        self.by_url: Dict[str, dict] = {}
        self.by_type: Dict[str, List[dict]] = {}
        self.memo: Dict[str, Any] = {}  # Per-bundle caches owned by the mappers
        for entry in bundle.get("entry") or []:
            resource = entry.get("resource") if isinstance(entry, dict) else None
            if not isinstance(resource, dict):
                continue
            resource_type = resource.get("resourceType")
            if not isinstance(resource_type, str):
                continue
            self.by_type.setdefault(resource_type, []).append(resource)
            if resource.get("id") is not None:
                self.resources.setdefault(
                    (resource_type, str(resource["id"])), resource
                )
            full_url = entry.get("fullUrl")
            if isinstance(full_url, str) and full_url:
                self.by_url.setdefault(full_url, resource)

    def get(self, resource_type: str, resource_id: Any) -> Optional[dict]:
        """A resource by type and id, or None."""
        if resource_id is None:
            return None
        return self.resources.get((resource_type, str(resource_id)))


# The index of the bundle being planned; set only inside indexed(), so nothing
# outlives the import that built it
_CURRENT: ContextVar[Optional[Tuple[dict, BundleIndex]]] = ContextVar(
    "fhir_bundle_index", default=None
)


@contextmanager
def indexed(bundle: dict) -> Iterator[BundleIndex]:
    """Share one BundleIndex across every mapper call made for this bundle."""
    index = BundleIndex(bundle)
    token = _CURRENT.set((bundle, index))
    try:
        yield index
    finally:
        _CURRENT.reset(token)


def bundle_index(bundle: dict) -> BundleIndex:
    """The shared index inside indexed(bundle), else a fresh one."""
    current = _CURRENT.get()
    if current is not None and current[0] is bundle:
        return current[1]
    return BundleIndex(bundle)


def resolve(
    bundle: dict, resource_type: str, reference: Optional[dict]
) -> Optional[dict]:
    """The bundle entry a Reference points to: its exact fullUrl first, then type and id."""
    ref = reference.get("reference") if isinstance(reference, dict) else None
    if not ref:
        return None
    index = bundle_index(bundle)
    by_url = index.by_url.get(str(ref))
    if by_url is not None:
        return by_url if by_url.get("resourceType") == resource_type else None
    return index.get(resource_type, ref_id(reference))


def fit(
    value: Optional[str], limit: int, warnings: List[str], what: str
) -> Optional[str]:
    """Strip and shorten text to a column limit, recording a warning when it is cut."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if len(text) > limit:
        warnings.append(f"{what} truncated to {limit} characters")
        return text[: limit - 3].rstrip() + "..."
    return text


def whole_code(
    concept: Optional[dict],
    systems: Tuple[str, ...],
    limit: int,
    warnings: List[str],
    what: str,
) -> Optional[str]:
    """First code in the given systems, in priority order, that fits whole.

    A code is never cut, since a shortened code would look real; one that is too
    long is passed over with a warning.
    """
    for system in systems:
        for coding in codings(concept):
            if coding.get("system") != system or coding.get("code") is None:
                continue
            text = str(coding["code"]).strip()
            if not text:
                continue
            if len(text) <= limit:
                return text
            warnings.append(f"{what} longer than {limit} characters, dropped")
    return None


def norm(value: Optional[str]) -> Optional[str]:
    """Lower-cased, whitespace-collapsed text for hashing, or None."""
    if value is None:
        return None
    text = " ".join(str(value).split()).lower()
    return text or None


def iso(value: Optional[date]) -> Optional[str]:
    """ISO date string for hashing, or None."""
    return value.isoformat() if value else None
