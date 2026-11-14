"""Compare the patient in an uploaded bundle with the selected MediKeep patient."""

from dataclasses import dataclass, field
from datetime import date
from typing import List, Optional

from app.models.patient import Patient

from .mappers._fhir import fold as _norm
from .mappers._fhir import text as _text


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


def _parse_date(value) -> Optional[date]:
    """Date from the first ten characters of a FHIR date string, or None."""
    value = _text(value)
    if value is None:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def compare_patient(bundle: dict, patient: Patient) -> PatientMatch:
    """Build a PatientMatch from the bundle's Patient resources.

    The summary comes from the first Patient. Every Patient is compared with the
    selected one, since a zip of documents can describe more than one person.
    """
    patients = _patients(bundle)
    if not patients:
        return PatientMatch()

    given, family, text = _name_parts(patients[0])
    match = PatientMatch(
        full_name=text,
        birth_date=_parse_date(patients[0].get("birthDate")),
        gender=_text(patients[0].get("gender")),
    )
    for resource in patients:
        for warning in _differences(resource, patient):
            if warning not in match.warnings:
                match.warnings.append(warning)
    return match


def _differences(resource: dict, patient: Patient) -> List[str]:
    """Warnings for a Patient resource whose name or birth date differ from the selection."""
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
    birth_date = _parse_date(resource.get("birthDate"))
    if birth_date and patient.birth_date and birth_date != patient.birth_date:
        warnings.append(
            f"The file's birth date {birth_date.isoformat()} differs from "
            f"the selected patient's {patient.birth_date.isoformat()}."
        )
    return warnings
