"""Compare the patients in an uploaded bundle with the selected MediKeep patient.

A file can hold more than one person (a zip of documents put together by
hand). The birth date decides who is who: names change and are abbreviated, a
birth date is not. Records of a person born on another day than the selected
patient are left out when the file also holds someone born on the selected
patient's day, and with them the records whose patient cannot be told. In
every other file all is kept and warned about, for the user to judge at the
preview.

A birth date may be given as a year or a year and month only. It is compared
as far as it goes: a different year is another person, the same year alone
confirms nobody.
"""

import re
from dataclasses import dataclass, field
from datetime import date
from typing import Dict, List, Optional, Tuple

from app.models.patient import Patient

from .base_importer import ImportFormatError
from .mappers._fhir import fold as _norm
from .mappers._fhir import objects, resource_id
from .mappers._fhir import text as _text

# Most patient warnings listed before the rest are only counted
MAX_PATIENT_WARNINGS = 20
NOTHING_TO_COMPARE_MESSAGE = (
    "The file has a patient record without a usable name or birth date, "
    "so it could not be checked against the selected patient."
)
NO_MATCHING_PATIENT_MESSAGE = (
    "The file holds records for more than one person and none of them has the "
    "selected patient's birth date. Import each person's file separately."
)
SAME_ID_MESSAGE = (
    "The file has patient records for different people under the same id, so "
    "its records cannot be told apart. Import each person's file separately."
)
# Reference fields a record uses to say whose it is
PATIENT_REFERENCE_FIELDS = ("subject", "patient")
# Schemes of a reference or fullUrl that is nothing but an id
URN_SCHEMES = ("urn:uuid:", "urn:oid:")

# A birth date as far as the file gives it: (year,), (year, month) or
# (year, month, day)
BirthDate = Tuple[int, ...]
_YEAR_OR_MONTH = re.compile(r"(\d{4})(?:-(\d{2}))?", re.ASCII)
_FULL_DATE = re.compile(r"(\d{4})-(\d{2})-(\d{2})", re.ASCII)


@dataclass
class PatientMatch:
    """Demographics found in the file and any differences from the selected patient.

    bundle is what to import: the upload itself, or a copy without the records
    of the people who were left out. positions then gives, for each entry of
    the copy, its index in the upload; it is None for the upload itself.
    """

    full_name: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    warnings: List[str] = field(default_factory=list)
    bundle: Optional[dict] = None
    positions: Optional[List[int]] = None

    @property
    def found(self) -> bool:
        """True when the file carried any demographics at all."""
        return bool(self.full_name or self.birth_date or self.gender)


def _patients(bundle: dict) -> List[dict]:
    """The bundle's Patient resources, in order."""
    return [
        resource
        for entry in bundle.get("entry", [])
        if (resource := entry.get("resource") or {}).get("resourceType") == "Patient"
    ]


def _name_parts(resource: dict):
    """(given tokens, family, full display) from the first usable HumanName."""
    names = resource.get("name")
    for name in names if isinstance(names, list) else []:
        if not isinstance(name, dict):
            continue
        given_raw = name.get("given")
        given = (
            [g for g in given_raw if _text(g)] if isinstance(given_raw, list) else []
        )
        family = _text(name.get("family")) or ""
        if given or family:
            text = _text(name.get("text")) or " ".join([*given, family]).strip()
            return given, family, text
    return [], "", None


def read_birth_date(value) -> Optional[BirthDate]:
    """The parts of a FHIR date that the string gives, or None when it is not a date.

    Reads YYYY, YYYY-MM and YYYY-MM-DD, in digits and with these hyphens
    only, after spaces around the value are dropped. A longer string such as
    a dateTime is read by its first ten characters, which must be a
    YYYY-MM-DD. No other form is read: not a week date (1960-W01-1), an
    ordinal date (1960-033), a date without hyphens (19600202) or one with a
    part of fewer digits (1960-2-2), and not a date that does not exist
    (1960-02-30). The parts not given are not filled in, so a year alone is
    not taken for the first of January.
    """
    value = _text(value)
    if value is None:
        return None
    value = value.strip()
    partial = _YEAR_OR_MONTH.fullmatch(value)
    full = _FULL_DATE.fullmatch(value[:10])
    try:
        if partial:
            year, month = int(partial[1]), partial[2]
            # date() checks the range of the year and the month
            date(year, int(month or 1), 1)
            return (year, int(month)) if month else (year,)
        if full:
            parts = (int(full[1]), int(full[2]), int(full[3]))
            # date() checks that the day exists
            date(*parts)
            return parts
    except ValueError:
        pass
    return None


def birth_dates_compatible(
    first: Optional[BirthDate], second: Optional[BirthDate]
) -> bool:
    """True unless the two birth dates differ in a part that both give.

    1975 and 1975-01-01 can be one person; 1975 and 1960 cannot. A birth date
    that is missing or unreadable (None) differs from nothing.
    """
    if first is None or second is None:
        return True
    shared = min(len(first), len(second))
    return first[:shared] == second[:shared]


def more_exact_birth_date(
    first: Optional[BirthDate], second: Optional[BirthDate]
) -> Optional[BirthDate]:
    """The one of two compatible birth dates that gives more parts.

    Compatibility does not carry over (1975 fits both 1975-01 and 1975-02), so
    a run of values is checked against the most exact one seen so far: a value
    that fits it fits every value before it.
    """
    if first is None or (second is not None and len(second) > len(first)):
        return second
    return first


def birth_date_text(birth_date: BirthDate) -> str:
    """The birth date as a FHIR date of the same precision: 1975, 1975-01, 1975-01-01."""
    year, *rest = birth_date
    return "-".join([f"{year:04d}", *(f"{part:02d}" for part in rest)])


def _full_date(birth_date: Optional[BirthDate]) -> Optional[date]:
    """A date when the birth date is given to the day, else None."""
    return date(*birth_date) if birth_date and len(birth_date) == 3 else None


def _differs(birth_date: Optional[BirthDate], patient: Patient) -> bool:
    """True when a part the file gives is not the selected patient's."""
    own = patient.birth_date
    if not (birth_date and own):
        return False
    return not birth_dates_compatible(birth_date, (own.year, own.month, own.day))


def compare_patient(bundle: dict, patient: Patient) -> PatientMatch:
    """Build a PatientMatch from the bundle's Patient resources.

    Every Patient is compared with the selected one, since a zip of documents
    can describe more than one person. Other people's records are left out of
    match.bundle (see _other_people) and the summary comes from the first
    Patient that is kept. Each distinct warning is given once, and past
    MAX_PATIENT_WARNINGS the rest are counted in one line.

    Raises ImportFormatError when the file holds several people and none of
    them can be the selected patient, or when a person left out cannot be told
    from one who is kept (see _PatientIndex).
    """
    patients = _patients(bundle)
    if not patients:
        return PatientMatch(bundle=bundle)

    others = _other_people(patients, patient)
    kept = [p for p in patients if id(p) not in others]
    given, family, text = _name_parts(kept[0])
    match = PatientMatch(
        full_name=text,
        birth_date=_full_date(read_birth_date(kept[0].get("birthDate"))),
        gender=_text(kept[0].get("gender")),
        bundle=bundle,
    )
    # What was left out comes ahead of the warnings about the people kept.
    # The one unidentified line is first, so it is always shown; the lines per
    # person follow and, past the cap, are counted like any other warning
    found = []
    if others:
        match.bundle, match.positions, left_out, unidentified = _without(bundle, others)
        if unidentified:
            found.append(
                f"Left out {unidentified} "
                f"{'record' if unidentified == 1 else 'records'} whose patient "
                "could not be identified in the file."
            )
        found.extend(_left_out_warnings(patients, left_out, patient))
    found.extend(w for resource in kept for w in _differences(resource, patient))
    seen = set()
    for warning in found:
        if warning in seen:
            continue
        seen.add(warning)
        if len(match.warnings) < MAX_PATIENT_WARNINGS:
            match.warnings.append(warning)
    hidden = len(seen) - len(match.warnings)
    if hidden:
        match.warnings.append(
            f"{hidden} more patient {'warning' if hidden == 1 else 'warnings'} not shown"
        )
    return match


def _other_people(patients: List[dict], patient: Patient) -> Dict[int, dict]:
    """The Patient resources whose records are left out, keyed by id().

    A Patient with a birth date other than the selected patient's is another
    person. Their records are left out only when the file also has a Patient
    with the selected patient's birth date: without one, nothing in the file
    says which records are the selected patient's. A Patient with no readable
    birth date is never left out and does not count as that match, and neither
    does one whose year, or year and month, is all the file gives and agrees.
    A file where the other birth dates given can all be one person's (the same
    date, or a year and a date within it) is about one person and is kept
    whole, with warnings, as a file with a single Patient always was. A file
    of several other people is refused.
    """
    own = patient.birth_date
    matching = False
    differing = {}
    for resource in patients:
        birth_date = read_birth_date(resource.get("birthDate"))
        if _differs(birth_date, patient):
            differing[id(resource)] = birth_date
        elif own and birth_date == (own.year, own.month, own.day):
            matching = True
    if not differing:
        return {}
    if matching:
        return {id(p): p for p in patients if id(p) in differing}
    # One person when every value fits the most exact one: each is then a
    # leading part of it, and so of any longer value among them
    distinct = set(differing.values())
    longest = max(distinct, key=len)
    if all(birth_dates_compatible(value, longest) for value in distinct):
        return {}
    raise ImportFormatError(NO_MATCHING_PATIENT_MESSAGE)


def _patient_id(reference: str) -> Optional[str]:
    """The Patient id a reference string or fullUrl names, or None.

    Reads Patient/<id>, an absolute URL ending in /Patient/<id> (either may end
    in /_history/<version>) and urn:uuid:<id> or urn:oid:<id>. The type is
    checked, so Group/5 and Condition/5 name no Patient.
    """
    for scheme in URN_SCHEMES:
        if reference.startswith(scheme):
            return reference[len(scheme) :] or None
    parts = reference.split("/")
    if len(parts) >= 4 and parts[-2] == "_history":
        parts = parts[:-2]
    relative = len(parts) == 2
    if (relative or "://" in reference) and parts[-2:-1] == ["Patient"]:
        return parts[-1] or None
    return None


class _PatientIndex:
    """The bundle's Patient resources by entry fullUrl and by id.

    A Patient is also known by the id its fullUrl ends in, which is what a
    relative reference is resolved against when the resource has no id.
    Spaces around a fullUrl or a reference are not part of it, and a fullUrl
    of nothing else is taken as absent.
    """

    def __init__(self, bundle: dict, others: Dict[int, dict]):
        """Walk the bundle once.

        Raises ImportFormatError when a Patient that is left out and one that
        is kept go by the same fullUrl or id: a reference to it could mean
        either, so no record could be given to the right person.
        """
        self.by_url: Dict[str, dict] = {}
        self.by_id: Dict[str, dict] = {}
        # fullUrls of other resources: a reference to one is not to a Patient
        self.other_urls = set()
        for entry in bundle.get("entry", []):
            resource = entry.get("resource") or {}
            # _text gives None for a string of spaces only
            full_url = _text(entry.get("fullUrl"))
            if full_url:
                full_url = full_url.strip()
            if resource.get("resourceType") != "Patient":
                if full_url:
                    self.other_urls.add(full_url)
                continue
            names = [(self.by_url, full_url), (self.by_id, resource_id(resource))]
            if full_url:
                names.append((self.by_id, _patient_id(full_url)))
            for known, name in names:
                if name is None:
                    continue
                first = known.setdefault(name, resource)
                if (id(first) in others) != (id(resource) in others):
                    raise ImportFormatError(SAME_ID_MESSAGE)

    def find(self, reference) -> Optional[dict]:
        """The Patient a Reference points at: its exact fullUrl first, then its id."""
        ref = reference.get("reference") if isinstance(reference, dict) else None
        if _text(ref) is None:
            return None
        ref = ref.strip()
        if ref in self.by_url:
            return self.by_url[ref]
        if ref in self.other_urls:
            return None
        return self.by_id.get(_patient_id(ref))


def _without(
    bundle: dict, others: Dict[int, dict]
) -> Tuple[dict, List[int], Dict[int, int], int]:
    """A copy of the bundle with only the records known to belong to the Patients kept.

    Also returns the index in the bundle of each entry kept, how many records
    each of the given Patients lost, and how many were dropped because the
    patient they name is not in the file: once someone is left out, a record
    that cannot be given to a kept Patient may be theirs. A record that names no patient at all (an Organization, a
    Medication) is shared and kept: one where neither subject nor patient is
    present, or where the value is null. Any other value, an empty one
    included, has to name a Patient in the file. A Provenance has no subject;
    it goes when one of its targets is a Patient left out.
    """
    index = _PatientIndex(bundle, others)
    left_out = dict.fromkeys(others, 0)
    unidentified = 0
    entries = []
    positions = []
    for position, entry in enumerate(bundle.get("entry", [])):
        resource = entry.get("resource") or {}
        if id(resource) in others:
            continue
        if resource.get("resourceType") == "Provenance":
            references = objects(resource.get("target"))
            shared = True
        else:
            references = [
                resource[name]
                for name in PATIENT_REFERENCE_FIELDS
                if resource.get(name) is not None
            ]
            shared = not references
        owners = [index.find(reference) for reference in references]
        other = next((o for o in owners if o is not None and id(o) in others), None)
        if other is not None:
            left_out[id(other)] += 1
        elif shared or any(o is not None for o in owners):
            entries.append(entry)
            positions.append(position)
        else:
            unidentified += 1
    return {**bundle, "entry": entries}, positions, left_out, unidentified


def _left_out_warnings(
    patients: List[dict], left_out: Dict[int, int], patient: Patient
) -> List[str]:
    """One line per person left out, with the number of their records dropped."""
    totals: Dict[Tuple[str, str], int] = {}
    for resource in patients:
        if id(resource) not in left_out:
            continue
        _, _, text = _name_parts(resource)
        born = birth_date_text(read_birth_date(resource["birthDate"]))
        key = (text or "a patient with no name", born)
        totals[key] = totals.get(key, 0) + left_out[id(resource)]
    return [
        f"Left out {count} {'record' if count == 1 else 'records'} for {name}, "
        f"whose birth date {born} differs from the selected "
        f"patient's {patient.birth_date.isoformat()}."
        for (name, born), count in totals.items()
    ]


def _differences(resource: dict, patient: Patient) -> List[str]:
    """Warnings for a Patient resource that differs from the selection or cannot be checked."""
    given, family, text = _name_parts(resource)
    warnings = []
    # Middle names are common in exports and absent in MediKeep, so compare
    # the first given name and the family name only
    file_first = _norm(given[0]) if given else ""
    file_last = _norm(family)
    own_first = _norm(patient.first_name).split(" ", maxsplit=1)[0]
    own_last = _norm(patient.last_name)
    if (file_first and file_first != own_first) or (
        file_last and file_last != own_last
    ):
        warnings.append(
            f"The file is for {text} but the selected patient is "
            f"{patient.first_name} {patient.last_name}."
        )
    birth_date = read_birth_date(resource.get("birthDate"))
    if not (file_first or file_last or birth_date):
        return [NOTHING_TO_COMPARE_MESSAGE]
    if _differs(birth_date, patient):
        warnings.append(
            f"The file's birth date {birth_date_text(birth_date)} differs from "
            f"the selected patient's {patient.birth_date.isoformat()}."
        )
    return warnings
