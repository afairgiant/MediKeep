"""
Small FHIR helpers shared by the resource mappers.
"""

from contextlib import contextmanager
from contextvars import ContextVar
from datetime import date
from decimal import Context, Decimal
from typing import Any, Dict, Iterator, List, Optional, Tuple

SNOMED = "http://snomed.info/sct"
ICD10CM = "http://hl7.org/fhir/sid/icd-10-cm"
ICD10 = "http://hl7.org/fhir/sid/icd-10"
RXNORM = "http://www.nlm.nih.gov/research/umls/rxnorm"
CONDITION_CLINICAL = "http://terminology.hl7.org/CodeSystem/condition-clinical"
ALLERGY_CLINICAL = "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical"


def text(value: Any) -> Optional[str]:
    """The value when it is a non-empty string, else None."""
    return value if isinstance(value, str) and value.strip() else None


def fold(value: Optional[str]) -> str:
    """Lower-case with collapsed whitespace, for comparisons."""
    return " ".join((value or "").split()).lower()


def resource_id(resource: dict) -> Optional[str]:
    """The resource id as a string; None when it is missing or not an id."""
    value = resource.get("id")
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    return value.strip() if text(value) else None


def obj(value: Any) -> dict:
    """The value when it is a JSON object, else an empty one."""
    return value if isinstance(value, dict) else {}


def objects(value: Any) -> List[dict]:
    """The JSON objects in a list value; empty for anything that is not a list."""
    return [v for v in value if isinstance(v, dict)] if isinstance(value, list) else []


def code_text(value: Any) -> Optional[str]:
    """A code as a string: a non-blank string stripped, or an integer written out."""
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    return value.strip() if text(value) else None


def codings(concept: Optional[dict]) -> List[dict]:
    """Coding entries of a CodeableConcept; empty for None or malformed input."""
    return objects(obj(concept).get("coding"))


def code_for(concept: Optional[dict], *systems: str) -> Optional[str]:
    """Code of the first coding in one of the given systems, in priority order."""
    for system in systems:
        for coding in codings(concept):
            if coding.get("system") == system and code_text(coding.get("code")):
                return code_text(coding["code"])
    return None


def first_code(concept: Optional[dict]) -> Optional[str]:
    """First code in a CodeableConcept regardless of system."""
    for coding in codings(concept):
        if code_text(coding.get("code")):
            return code_text(coding["code"])
    return None


def label_for(concept: Optional[dict]) -> Optional[str]:
    """Human-readable text for a CodeableConcept: its text, else a coding display."""
    concept = obj(concept)
    if text(concept.get("text")):
        return concept["text"].strip()
    for coding in codings(concept):
        if text(coding.get("display")):
            return coding["display"].strip()
    return None


def name_for(concept: Optional[dict], warnings: List[str], what: str) -> Optional[str]:
    """The concept's text or display, else its bare code with a warning."""
    name = label_for(concept)
    if name is None and first_code(concept) is not None:
        warnings.append(f"no {what} text in the file, the code is used")
        return first_code(concept)
    return name


def display_for(concept: Optional[dict]) -> Optional[str]:
    """Text for a CodeableConcept, falling back from text to display to code."""
    return label_for(concept) or first_code(concept)


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


# A nonzero number must be at least 10**-MAX_EXPONENT and under 10**(MAX_EXPONENT + 1)
# in size, since number_text writes it out in full; zero is written as "0"
MAX_EXPONENT = 50


def number_text(value: Any) -> str:
    """A number written out in full: 2400000, 0.00001 and 2.5, never 2.4e+06.

    Takes the parsed JSON value (after to_float has accepted it) rather than its
    float, so integers and numeric strings keep every digit, however long.
    """
    raw = str(value).strip()
    number = Decimal(raw).normalize(Context(prec=max(28, len(raw))))
    if number == 0:
        number = Decimal(0)  # No "-0"
    return format(number, "f")


def to_float(value: Any) -> Optional[float]:
    """A finite float from a number or numeric string, else None.

    The value must also be readable as a Decimal, which number_text uses, and a
    nonzero one must be inside the MAX_EXPONENT range: "1e-999990" reads as 0.0, but
    number_text would write it out as a million digits.
    """
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
        exact = Decimal(str(value).strip())
    except (TypeError, ValueError, OverflowError, ArithmeticError):
        return None
    if number != number or abs(number) == float("inf"):
        return None
    if not exact.is_zero() and abs(exact.adjusted()) > MAX_EXPONENT:
        return None
    return number


def period(resource: dict, base: str) -> Tuple[Optional[str], Optional[str]]:
    """(start, end) strings from the <base>DateTime or <base>Period element."""
    if resource.get(f"{base}DateTime"):
        return resource[f"{base}DateTime"], None
    value = obj(resource.get(f"{base}Period"))
    return value.get("start"), value.get("end")


def notes_text(resource: dict) -> Optional[str]:
    """Join the resource's Annotation texts into one string."""
    texts = [text(n.get("text")) for n in objects(resource.get("note"))]
    joined = "\n".join(t.strip() for t in texts if t)
    return joined or None


def ref_id(reference: Optional[dict]) -> Optional[str]:
    """Resource id from a Reference, accepting "Type/id", "#id" and "urn:uuid:id"."""
    ref = text(obj(reference).get("reference"))
    if ref is None:
        return None
    ref = ref.strip().replace("urn:uuid:", "").lstrip("#")
    return ref.rsplit("/", 1)[-1] or None


class BundleIndex:
    """Resources of one bundle keyed by (type, id) and by fullUrl."""

    def __init__(self, bundle: dict):
        """Walk the bundle once."""
        self.resources: Dict[Tuple[str, str], dict] = {}
        self.by_url: Dict[str, dict] = {}
        for entry in bundle.get("entry") or []:
            resource = entry.get("resource") if isinstance(entry, dict) else None
            if not isinstance(resource, dict):
                continue
            resource_type = resource.get("resourceType")
            if not isinstance(resource_type, str):
                continue
            if resource_id(resource) is not None:
                self.resources.setdefault(
                    (resource_type, resource_id(resource)), resource
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
    ref = text(obj(reference).get("reference"))
    if ref is None:
        return None
    index = bundle_index(bundle)
    by_url = index.by_url.get(ref.strip())
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


def whole_coding(
    concept: Optional[dict],
    systems: Tuple[str, ...],
    limit: int,
    warnings: List[str],
    what: str,
) -> dict:
    """First coding in the given systems, in priority order, whose code fits whole.

    A code is never cut, since a shortened code would look real; one that is too
    long is passed over with a warning. Returns {} when none fits.
    """
    for system in systems:
        for coding in codings(concept):
            code = code_text(coding.get("code"))
            if coding.get("system") != system or code is None:
                continue
            if len(code) <= limit:
                return coding
            warnings.append(f"{what} longer than {limit} characters, dropped")
    return {}


def whole_code(
    concept: Optional[dict],
    systems: Tuple[str, ...],
    limit: int,
    warnings: List[str],
    what: str,
) -> Optional[str]:
    """The code of whole_coding(), or None."""
    return code_text(whole_coding(concept, systems, limit, warnings, what).get("code"))
