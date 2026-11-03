"""Compare the patient in an uploaded bundle with the selected MediKeep patient."""

from dataclasses import dataclass, field
from datetime import date
from typing import List, Optional

from app.models.patient import Patient


@dataclass
class PatientMatch:
    """Demographics found in the file and any differences from the selected patient."""

    full_name: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    warnings: List[str] = field(default_factory=list)

    @property
    def found(self) -> bool:
        """True when the file carried any demographics at all."""
        return bool(self.full_name or self.birth_date or self.gender)


def _first_patient(bundle: dict) -> Optional[dict]:
    """The bundle's first Patient resource, if any."""
    for entry in bundle.get("entry", []):
        resource = entry.get("resource") or {}
        if resource.get("resourceType") == "Patient":
            return resource
    return None


def _name_parts(resource: dict):
    """(given tokens, family, full display) from the first usable HumanName."""
    names = resource.get("name")
    for name in names if isinstance(names, list) else []:
        if not isinstance(name, dict):
            continue
        given_raw = name.get("given")
        given = [g for g in given_raw if g] if isinstance(given_raw, list) else []
        family = name.get("family") or ""
        if given or family:
            text = name.get("text") or " ".join([*given, family]).strip()
            return given, family, text
    return [], "", None


def _parse_date(value: Optional[str]) -> Optional[date]:
    """Date from the first ten characters of a FHIR date, or None."""
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _norm(value: Optional[str]) -> str:
    """Lower-case with collapsed whitespace, for comparisons."""
    return " ".join((value or "").split()).lower()


def compare_patient(bundle: dict, patient: Patient) -> PatientMatch:
    """Build a PatientMatch for the bundle's first Patient resource."""
    resource = _first_patient(bundle)
    if resource is None:
        return PatientMatch()

    given, family, text = _name_parts(resource)
    match = PatientMatch(
        full_name=text,
        birth_date=_parse_date(resource.get("birthDate")),
        gender=resource.get("gender"),
    )

    # Middle names are common in exports and absent in MediKeep, so compare
    # the first given name and the family name only
    file_first = _norm(given[0]) if given else ""
    file_last = _norm(family)
    own_first = _norm(patient.first_name).split(" ", maxsplit=1)[0]
    own_last = _norm(patient.last_name)
    if (file_first and file_first != own_first) or (
        file_last and file_last != own_last
    ):
        match.warnings.append(
            f"The file is for {text} but the selected patient is "
            f"{patient.first_name} {patient.last_name}."
        )
    if (
        match.birth_date
        and patient.birth_date
        and match.birth_date != patient.birth_date
    ):
        match.warnings.append(
            f"The file's birth date {match.birth_date.isoformat()} differs from "
            f"the selected patient's {patient.birth_date.isoformat()}."
        )
    return match
