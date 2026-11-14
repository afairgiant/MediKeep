"""
Maps FHIR MedicationStatement and MedicationRequest resources onto the Medication table.
"""

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Dict, List, Optional, Tuple

from app.models.clinical import Medication
from app.schemas.medication import MedicationCreate

from . import _fhir as f
from .base_mapper import BaseResourceMapper, MappedRecord

STATEMENT_STATUS = {
    "active": "active",
    "intended": "active",
    "completed": "completed",
    "stopped": "stopped",
    "on-hold": "on-hold",
    "not-taken": "cancelled",
}
REQUEST_STATUS = {
    "active": "active",
    "draft": "active",
    "completed": "completed",
    "stopped": "stopped",
    "on-hold": "on-hold",
}
SKIPPED_STATUS = ("entered-in-error", "cancelled")

# SNOMED 410942007 "Drug or medicament": C-CDA says "no known medications" with a
# negated entry of this code, which arrives as a not-taken statement
NO_MEDICATION_CODES = {"410942007"}
# SNOMED 787481004 "No known medications" says the same as a situation; a not-taken
# statement of it is a double negative and is skipped without a warning
NO_KNOWN_MEDICATION_CODES = {"787481004"}
NO_KNOWN_MEDICATIONS = "Medications: file states no known medications"

# Routes are mapped only where a MediKeep value fits. Anything else (ophthalmic,
# vaginal, transdermal, ...) is left empty and kept in the notes. Respiratory tract
# is broader than inhalation (it includes nasal), but inhalation is the closest
# value and nasal has its own code, so it maps to inhalation.
# Route text (folded, with a trailing "(qualifier value)", "(route)", "route" or "use"
# removed) -> MedicationBase route value. Includes the SNOMED CT synonyms of each code
# in ROUTE_CODES, so a code's own wording is not reported as a mismatch.
ROUTES = {
    "oral": "oral",
    "by mouth": "oral",
    "po": "oral",
    "po - per os": "oral",
    "per os": "oral",
    "orally": "oral",
    "per oral": "oral",
    "peroral": "oral",
    "injection": "injection",
    "topical": "topical",
    "cutaneous": "topical",
    "intravenous": "intravenous",
    "iv": "intravenous",
    "intramuscular": "intramuscular",
    "im": "intramuscular",
    "subcutaneous": "subcutaneous",
    "sc": "subcutaneous",
    "subdermal": "subcutaneous",
    "inhalation": "inhalation",
    "respiratory tract": "inhalation",
    "respiratory (inhalation)": "inhalation",
    "inhaled": "inhalation",
    "nasal": "nasal",
    "intranasal": "nasal",
    "rectal": "rectal",
    "rectally": "rectal",
    "per rectum": "rectal",
    "sublingual": "sublingual",
    "sublingually": "sublingual",
    "otic": "aural",
    "auricular": "aural",
    "auricular (otic)": "aural",
    "in ear": "aural",
}
ROUTE_SUFFIXES = (" (qualifier value)", " (route)", " route", " use")
# SNOMED CT route codes -> MedicationBase route value. Each code was checked
# against SNOMED CT; its preferred term is in the comment.
ROUTE_CODES = {
    "26643006": "oral",  # Oral route
    "47625008": "intravenous",  # Intravenous route
    "78421000": "intramuscular",  # Intramuscular route
    "34206005": "subcutaneous",  # Subcutaneous route
    "6064005": "topical",  # Topical route
    "447694001": "inhalation",  # Respiratory tract route (see above)
    "46713006": "nasal",  # Nasal route
    "10547007": "aural",  # Otic route
    "37161004": "rectal",  # Rectal route
    "37839007": "sublingual",  # Sublingual route
}
DOSE_UNITS = {
    "{tbl}": "tablet",
    "{capsule}": "capsule",
    "{puff}": "puff",
    "{spray}": "spray",
    "{drop}": "drop",
}
PERIOD_UNITS = {
    "s": "second",
    "min": "minute",
    "h": "hour",
    "d": "day",
    "wk": "week",
    "mo": "month",
    "a": "year",
}

MAX_NAME = 100
MAX_DOSAGE = 50
MAX_FREQUENCY = 50
MAX_INDICATION = 500
MAX_NOTES = 1000  # MedicationCreate allows 1000 here, less than the other tables
MAX_TIMES_PER_PERIOD = 48

# Columns a re-import overwrites; a local edit to any of them marks the row as edited
HASH_FIELDS = (
    "medication_name",
    "dosage",
    "frequency",
    "route",
    "indication",
    "effective_period_start",
    "effective_period_end",
    "status",
)


def _medication(resource: dict, bundle: dict) -> dict:
    """The contained or bundled Medication that medicationReference points to, or {}."""
    reference = f.obj(resource.get("medicationReference"))
    target_id = f.ref_id(reference)
    if target_id is None:
        return {}
    for contained in f.objects(resource.get("contained")):
        if f.resource_id(contained) == target_id:
            return contained
    return f.resolve(bundle, "Medication", reference) or {}


def medication_name(resource: dict, medication: dict) -> Optional[str]:
    """Drug name from the inline concept, the referenced Medication, or the display.

    A bare code is not a name, so a concept with only an RxNorm code does not count.
    """
    name = f.label_for(resource.get("medicationCodeableConcept")) or f.label_for(
        medication.get("code")
    )
    if name:
        return name
    display = f.text(f.obj(resource.get("medicationReference")).get("display"))
    return display.strip() if display else None


def medication_code(resource: dict, medication: dict) -> Optional[str]:
    """RxNorm code from the inline concept or the referenced Medication."""
    return f.code_for(resource.get("medicationCodeableConcept"), f.RXNORM) or (
        f.code_for(medication.get("code"), f.RXNORM)
    )


def _route_from_text(text: Optional[str]) -> Optional[str]:
    """MedicationBase route value for a route wording, or None."""
    key = f.fold(text)
    for suffix in ROUTE_SUFFIXES:
        if key.endswith(suffix):
            key = key[: -len(suffix)]
    return ROUTES.get(key)


def route_value(
    concept: Optional[dict],
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """(MedicationBase route value or None, text for the notes, warning).

    A SNOMED code decides the route, and the wording only counts when there is no
    code. A code outside ROUTE_CODES leaves the route empty even when the wording
    names a MediKeep route, since the wording may not describe the code. Wording
    that names another route, or that is not in ROUTES, is not stored as the route,
    so it is returned for the notes with a warning.
    """
    label = f.label_for(concept)
    code = f.code_for(concept, f.SNOMED)
    if code:
        by_code = ROUTE_CODES.get(code)
        if by_code is None:
            kept = f"{label} (SNOMED {code})" if label else f"SNOMED {code}"
            return (
                None,
                kept,
                f"route code {code} is not in MediKeep's list, kept in notes",
            )
        by_text = _route_from_text(label)
        if label is not None and by_text is None:
            return (
                by_code,
                label,
                f"route text '{label}' is not a route wording the importer knows,"
                " the code is used and the text kept in notes",
            )
        if by_text is not None and by_text != by_code:
            return (
                by_code,
                label,
                f"route text '{label}' does not match the route code,"
                " the code is used and the text kept in notes",
            )
        return by_code, None, None
    by_text = _route_from_text(label)
    text = f.display_for(concept)
    if by_text is None and text:
        return None, text, f"route '{text}' is not in MediKeep's list, kept in notes"
    return by_text, None, None


def _unit(quantity: dict) -> str:
    """A Quantity's unit, falling back to its code, with UCUM count units spelled out."""
    for key in ("unit", "code"):
        unit = quantity.get(key)
        if isinstance(unit, str) and unit.strip():
            return DOSE_UNITS.get(unit.strip(), unit.strip())
    return ""


def _dose_text(dosage: dict) -> Optional[str]:
    """Dose from doseQuantity or doseRange, numbers written in full."""
    for entry in f.objects(dosage.get("doseAndRate")):
        quantity = f.obj(entry.get("doseQuantity"))
        if f.to_float(quantity.get("value")) is not None:
            return f"{f.number_text(quantity['value'])} {_unit(quantity)}".strip()
        low = f.obj(f.obj(entry.get("doseRange")).get("low"))
        high = f.obj(f.obj(entry.get("doseRange")).get("high"))
        if (
            f.to_float(low.get("value")) is not None
            and f.to_float(high.get("value")) is not None
        ):
            numbers = f"{f.number_text(low['value'])}-{f.number_text(high['value'])}"
            return f"{numbers} {_unit(high) or _unit(low)}".strip()
    return None


def _times_per(freq: float, period: float) -> Optional[int]:
    """Doses per period unit for a sub-unit period, rounded half up; None if absurd."""
    try:
        times = (Decimal(str(freq)) / Decimal(str(period))).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
    except ArithmeticError:
        return None
    if times < 1 or times > MAX_TIMES_PER_PERIOD:
        return None
    return int(times)


def _frequency_text(timing: Optional[dict], warnings: List[str]) -> Optional[str]:
    """Timing as short text like "daily" or "2 times per day"."""
    if not isinstance(timing, dict):
        return None
    repeat = f.obj(timing.get("repeat"))
    freq = f.to_float(repeat.get("frequency"))
    period = f.to_float(repeat.get("period"))
    period_unit = repeat.get("periodUnit")
    unit = PERIOD_UNITS.get(period_unit) if isinstance(period_unit, str) else None
    if freq is None and repeat.get("frequency") is not None:
        warnings.append("frequency is not a usable number, timing dropped")
        return None
    if period is None and repeat.get("period") is not None:
        warnings.append("period is not a usable number, timing dropped")
        return None
    if freq is None:
        freq = 1
    if period is not None and unit:
        if period <= 0 or freq <= 0:
            warnings.append("timing has a period or frequency of zero or less, dropped")
            return None
        if period < 1 and unit in ("day", "hour"):
            # Epic writes twice daily as period 0.5 d
            times = _times_per(freq, period)
            if times is None:
                warnings.append("timing is outside a usable range, dropped")
                return None
            text = f"{times} times per {unit}"
        elif freq == 1 and period == 1:
            text = "daily" if unit == "day" else f"every {unit}"
        elif freq == 1:
            text = f"every {f.number_text(repeat['period'])} {unit}s"
        elif period == 1:
            text = f"{f.number_text(repeat['frequency'])} times per {unit}"
        else:
            text = (
                f"{f.number_text(repeat['frequency'])} times per"
                f" {f.number_text(repeat['period'])} {unit}s"
            )
    else:
        text = f.display_for(timing.get("code"))
    when = repeat.get("when")
    when = [w for w in when if isinstance(w, str)] if isinstance(when, list) else []
    if text and when:
        text = f"{text} ({', '.join(when)})"
    return text


class _MedicationMapper(BaseResourceMapper):
    """Shared mapping for both medication resource types."""

    RECORD_TYPE = "medication"
    MODEL = Medication
    CREATE_SCHEMA = MedicationCreate
    # The source cannot tell prescription from over-the-counter; the user's choice stands
    preserve_on_update = ("notes", "tags", "medication_type")
    STATUS_MAP: dict = {}
    DOSAGE_FIELD = "dosage"

    def map(self, resource: dict, bundle: dict) -> Optional[MappedRecord]:
        """
        Map one resource; None when cancelled, in error, a do-not-give order,
        unnamed or no medication.
        """
        raw_status = (f.text(resource.get("status")) or "").strip().lower()
        if raw_status in SKIPPED_STATUS or resource.get("doNotPerform") is True:
            return None
        warnings: list = []
        # Resolved once; each lookup outside indexed() would build a new BundleIndex
        medication = _medication(resource, bundle)
        if (
            _states_no_medications(raw_status, resource, medication)
            or _snomed_code(resource, medication) in NO_KNOWN_MEDICATION_CODES
        ):
            return None
        rxnorm = medication_code(resource, medication)
        name = medication_name(resource, medication)
        if not name:
            # Keep the drug under its code (RxNorm first, else any) rather than lose it
            name = (
                rxnorm
                or f.first_code(resource.get("medicationCodeableConcept"))
                or f.first_code(medication.get("code"))
            )
            if name:
                warnings.append("no drug name in the file, the code is used")
        if not name:
            return None
        dosages = f.objects(resource.get(self.DOSAGE_FIELD))
        dosage = dosages[0] if dosages else {}
        sig = f.text(dosage.get("text"))
        sig = " ".join(sig.split()) if sig else None
        dose = _dose_text(dosage) or sig
        route, route_note, route_warning = route_value(dosage.get("route"))
        status = self.STATUS_MAP.get(raw_status, "active")
        start, end = self.dates(resource, dosage)
        if start and end and end < start:
            warnings.append("end before start, end date dropped")
            end = None

        dose = f.fit(dose, MAX_DOSAGE, warnings, "dosage")
        # The full sig goes to notes when the dosage column does not hold it as is
        notes_parts = [f"Sig: {sig}"] if sig and sig != dose else []
        if route_note:
            # MediKeep only accepts its own route list; keep what was not stored
            warnings.append(route_warning)
            notes_parts.append(f"Route: {route_note}")
        if f.notes_text(resource):
            notes_parts.append(f.notes_text(resource))
        reasons = [f.display_for(c) for c in f.objects(resource.get("reasonCode"))]

        name = f.fit(name, MAX_NAME, warnings, "name")
        data = {
            "medication_name": name,
            "medication_type": "prescription",
            "dosage": dose,
            "frequency": f.fit(
                _frequency_text(dosage.get("timing"), warnings),
                MAX_FREQUENCY,
                warnings,
                "frequency",
            ),
            "route": route,
            "indication": f.fit(
                ", ".join(r for r in reasons if r) or None,
                MAX_INDICATION,
                warnings,
                "indication",
            ),
            "effective_period_start": start,
            "effective_period_end": end,
            "status": status,
            "notes": f.fit(
                "\n".join(notes_parts) or None, MAX_NOTES, warnings, "notes"
            ),
        }
        return MappedRecord(
            record_type=self.RECORD_TYPE,
            external_id=f.resource_id(resource),
            data=data,
            hash_parts=self.hash_parts_for_data(data),
            label=f"{self.RESOURCE_TYPE}/{f.resource_id(resource) or '?'}",
            warnings=warnings,
            source_codes={"rxnorm": rxnorm} if rxnorm else {},
        )

    def hash_parts_for_row(self, row: Any) -> Tuple[Any, ...]:
        """The hashed columns; content_hash folds case, spacing and date format."""
        return tuple(getattr(row, name) for name in HASH_FIELDS)

    def dates(self, resource: dict, dosage: dict):
        """(start, end) dates for the resource type."""
        raise NotImplementedError

    def skip_reason(self, resource: dict, bundle: dict) -> Optional[str]:
        """Warning for a do-not-give order or a "no known medications" statement.

        Withdrawn (cancelled or entered-in-error) entries are skipped silently.
        """
        raw_status = (f.text(resource.get("status")) or "").strip().lower()
        if raw_status in SKIPPED_STATUS:
            return None
        if resource.get("doNotPerform") is True:
            label = f"{self.RESOURCE_TYPE}/{f.resource_id(resource) or '?'}"
            return f"Skipped {label}: an order not to give the medication"
        if _states_no_medications(raw_status, resource, _medication(resource, bundle)):
            return NO_KNOWN_MEDICATIONS
        return None


def _snomed_code(resource: dict, medication: dict) -> Optional[str]:
    """SNOMED code from the inline concept or the referenced Medication."""
    return f.code_for(resource.get("medicationCodeableConcept"), f.SNOMED) or (
        f.code_for(medication.get("code"), f.SNOMED)
    )


def _states_no_medications(raw_status: str, resource: dict, medication: dict) -> bool:
    """
    True for a not-taken statement of the generic drug concept, or for the
    "No known medications" situation code when it is not itself not-taken.
    """
    code = _snomed_code(resource, medication)
    if code in NO_KNOWN_MEDICATION_CODES:
        return raw_status != "not-taken"
    return raw_status == "not-taken" and code in NO_MEDICATION_CODES


class MedicationStatementMapper(_MedicationMapper):
    """MedicationStatement -> medications row."""

    RESOURCE_TYPE = "MedicationStatement"
    STATUS_MAP = STATEMENT_STATUS
    DOSAGE_FIELD = "dosage"

    def dates(self, resource: dict, dosage: dict):
        start, end = f.period(resource, "effective")
        return f.parse_date(start), f.parse_date(end)


class MedicationRequestMapper(_MedicationMapper):
    """MedicationRequest -> medications row, unless a statement already covers it."""

    RESOURCE_TYPE = "MedicationRequest"
    STATUS_MAP = REQUEST_STATUS
    DOSAGE_FIELD = "dosageInstruction"

    def dates(self, resource: dict, dosage: dict):
        repeat = f.obj(f.obj(dosage.get("timing")).get("repeat"))
        bounds = f.obj(repeat.get("boundsPeriod"))
        validity = f.obj(f.obj(resource.get("dispenseRequest")).get("validityPeriod"))
        # authoredOn is when the order was written, not when therapy began
        start = bounds.get("start") or validity.get("start")
        end = bounds.get("end") or validity.get("end")
        return f.parse_date(start), f.parse_date(end)

    def covered(
        self, mapped: List[Tuple[MappedRecord, BaseResourceMapper]]
    ) -> List[MappedRecord]:
        """Requests for a drug and start that a statement from the file already has.

        Only statements that were mapped and validated count, and not-taken ones do
        not. The drug matches on the RxNorm code when both sides have one, and on the
        name when either has none.
        """
        coded: Dict[str, _Starts] = {}
        named: Dict[str, _Starts] = {}
        named_uncoded: Dict[str, _Starts] = {}
        for record, mapper in mapped:
            if not isinstance(mapper, MedicationStatementMapper):
                continue
            if record.data["status"] == STATEMENT_STATUS["not-taken"]:
                continue  # A drug that was not taken does not stand for the request
            code = record.source_codes.get("rxnorm")
            start = record.data["effective_period_start"]
            name = f.fold(record.data["medication_name"])
            if code:
                coded.setdefault(code, _Starts()).add(start)
            else:
                named_uncoded.setdefault(name, _Starts()).add(start)
            named.setdefault(name, _Starts()).add(start)

        dropped = []
        for record, mapper in mapped:
            if mapper is not self:
                continue
            code = record.source_codes.get("rxnorm")
            name = f.fold(record.data["medication_name"])
            if code:
                candidates = [coded.get(code), named_uncoded.get(name)]
            else:
                candidates = [named.get(name)]
            start = record.data["effective_period_start"]
            if any(c is not None and c.covers(start) for c in candidates):
                dropped.append(record)
        return dropped


class _Starts:
    """Start dates of the statements for one drug."""

    def __init__(self):
        self.dates: set = set()
        self.open = False  # A statement without a start covers every request

    def add(self, start: Optional[date]) -> None:
        if start is None:
            self.open = True
        else:
            self.dates.add(start)

    def covers(self, start: Optional[date]) -> bool:
        """True for a request with this start; a request without one is covered by any."""
        return self.open or start is None or start in self.dates
