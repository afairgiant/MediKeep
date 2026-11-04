"""
Maps FHIR MedicationStatement and MedicationRequest resources onto the Medication table.
"""

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Dict, List, Optional, Set, Tuple

from pydantic import ValidationError

from app.models.clinical import Medication
from app.schemas.medication import MedicationCreate

from . import _fhir as f
from .base_mapper import MAPPING_ERRORS, BaseResourceMapper, MappedRecord

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

# Route text (lower-cased, with a trailing "route" removed) -> MedicationBase route value
ROUTES = {
    "oral": "oral",
    "by mouth": "oral",
    "po": "oral",
    "injection": "injection",
    "topical": "topical",
    "cutaneous": "topical",
    "transdermal": "topical",
    "dental": "topical",
    "ophthalmic": "topical",
    "vaginal": "topical",
    "intravenous": "intravenous",
    "iv": "intravenous",
    "intramuscular": "intramuscular",
    "im": "intramuscular",
    "subcutaneous": "subcutaneous",
    "sc": "subcutaneous",
    "inhalation": "inhalation",
    "respiratory tract": "inhalation",
    "respiratory (inhalation)": "inhalation",
    "inhaled": "inhalation",
    "endotracheal": "inhalation",
    "nasal": "nasal",
    "intranasal": "nasal",
    "rectal": "rectal",
    "sublingual": "sublingual",
    "otic": "aural",
    "auricular (otic)": "aural",
}
# SNOMED CT route codes -> MedicationBase route value
ROUTE_CODES = {
    "26643006": "oral",
    "47625008": "intravenous",
    "78421000": "intramuscular",
    "34206005": "subcutaneous",
    "6064005": "topical",
    "45890007": "topical",
    "372449004": "topical",
    "54485002": "topical",
    "16857009": "topical",
    "447694001": "inhalation",
    "372450004": "inhalation",
    "46713006": "nasal",
    "10547007": "aural",
    "37161004": "rectal",
    "37839007": "sublingual",
    "420254004": "injection",
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


def medication_name(resource: dict, bundle: dict) -> Optional[str]:
    """Drug name from the inline concept, a contained Medication, or a bundle entry."""
    name = f.display_for(resource.get("medicationCodeableConcept"))
    if name:
        return name
    reference = resource.get("medicationReference") or {}
    target_id = f.ref_id(reference)
    for contained in resource.get("contained") or []:
        if isinstance(contained, dict) and contained.get("id") == target_id:
            return f.display_for(contained.get("code"))
    target = f.resolve(bundle, "Medication", reference)
    if target:
        return f.display_for(target.get("code"))
    return str(reference.get("display")).strip() if reference.get("display") else None


def medication_code(resource: dict, bundle: dict) -> Optional[str]:
    """RxNorm code from the inline concept, a contained Medication, or a bundle entry."""
    code = f.code_for(resource.get("medicationCodeableConcept"), f.RXNORM)
    if code:
        return code
    reference = resource.get("medicationReference")
    target_id = f.ref_id(reference)
    for contained in resource.get("contained") or []:
        if isinstance(contained, dict) and contained.get("id") == target_id:
            return f.code_for(contained.get("code"), f.RXNORM)
    target = f.resolve(bundle, "Medication", reference)
    return f.code_for(target.get("code"), f.RXNORM) if target else None


def route_value(concept: Optional[dict]) -> Tuple[Optional[str], Optional[str]]:
    """(MedicationBase route value or None, the text as written)."""
    text = f.display_for(concept)
    code = f.code_for(concept, f.SNOMED)
    if code in ROUTE_CODES:
        return ROUTE_CODES[code], text
    key = " ".join((text or "").lower().split())
    if key.endswith(" route"):
        key = key[: -len(" route")]
    return ROUTES.get(key), text


def _dose_text(dosage: dict) -> Optional[str]:
    """Dose from doseQuantity or doseRange, with UCUM count units spelled out."""
    for entry in dosage.get("doseAndRate") or []:
        if not isinstance(entry, dict):
            continue
        quantity = entry.get("doseQuantity")
        if isinstance(quantity, dict):
            value = f.to_float(quantity.get("value"))
            if value is not None:
                unit = quantity.get("unit") or quantity.get("code") or ""
                return f"{value:g} {DOSE_UNITS.get(unit, unit)}".strip()
        rng = entry.get("doseRange")
        if isinstance(rng, dict):
            low = f.to_float((rng.get("low") or {}).get("value"))
            high = f.to_float((rng.get("high") or {}).get("value"))
            unit = (rng.get("high") or rng.get("low") or {}).get("unit") or ""
            if low is not None and high is not None:
                return f"{low:g}-{high:g} {unit}".strip()
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
    repeat = timing.get("repeat") or {}
    freq = f.to_float(repeat.get("frequency"))
    period = f.to_float(repeat.get("period"))
    unit = PERIOD_UNITS.get(repeat.get("periodUnit"))
    if freq is None and repeat.get("frequency") is not None:
        warnings.append("frequency is not a number, timing dropped")
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
            text = f"every {period:g} {unit}s"
        elif period == 1:
            text = f"{freq:g} times per {unit}"
        else:
            text = f"{freq:g} times per {period:g} {unit}s"
    else:
        text = f.display_for(timing.get("code"))
    when = repeat.get("when")
    if text and isinstance(when, list) and when:
        text = f"{text} ({', '.join(str(w) for w in when)})"
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
        """Map one resource; None when cancelled, in error or unnamed."""
        raw_status = str(resource.get("status") or "").lower()
        if raw_status in SKIPPED_STATUS:
            return None
        name = medication_name(resource, bundle)
        if not name:
            return None

        warnings: list = []
        dosages = resource.get(self.DOSAGE_FIELD) or []
        dosage = dosages[0] if dosages and isinstance(dosages[0], dict) else {}
        sig = " ".join(str(dosage.get("text") or "").split()) or None
        dose = _dose_text(dosage) or sig
        route, route_text = route_value(dosage.get("route"))
        status = self.STATUS_MAP.get(raw_status, "active")
        start, end = self.dates(resource, dosage)
        if start and end and end < start:
            warnings.append("end before start, end date dropped")
            end = None

        dose = f.fit(dose, MAX_DOSAGE, warnings, "dosage")
        # The full sig goes to notes when the dosage column does not hold it as is
        notes_parts = [f"Sig: {sig}"] if sig and sig != dose else []
        if route is None and route_text:
            # MediKeep only accepts its own route list; keep the original wording
            warnings.append(
                f"route '{route_text}' is not in MediKeep's list, kept in notes"
            )
            notes_parts.append(f"Route: {route_text}")
        if f.notes_text(resource):
            notes_parts.append(f.notes_text(resource))
        reasons = [f.display_for(c) for c in resource.get("reasonCode") or []]

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
            external_id=resource.get("id"),
            data=data,
            hash_parts=self._parts(
                name,
                data["dosage"],
                data["frequency"],
                route,
                data["indication"],
                start,
                end,
                status,
            ),
            label=f"{self.RESOURCE_TYPE}/{resource.get('id', '?')}",
            warnings=warnings,
        )

    def hash_parts_for_row(self, row: Any) -> Tuple[Any, ...]:
        """The same hash_parts, read back from an existing row."""
        return self._parts(
            row.medication_name,
            row.dosage,
            row.frequency,
            row.route,
            row.indication,
            row.effective_period_start,
            row.effective_period_end,
            row.status,
        )

    @staticmethod
    def _parts(
        name, dosage, frequency, route, indication, start, end, status
    ) -> Tuple[Any, ...]:
        """Normalize the same way from a resource and from a row."""
        return (
            f.norm(name),
            f.norm(dosage),
            f.norm(frequency),
            f.norm(route),
            f.norm(indication),
            f.iso(start),
            f.iso(end),
            status,
        )

    def dates(self, resource: dict, dosage: dict):
        """(start, end) dates for the resource type."""
        raise NotImplementedError


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

    def map(self, resource: dict, bundle: dict) -> Optional[MappedRecord]:
        """Map one request, unless a statement for the same drug covers it."""
        if self._has_statement(resource, bundle):
            return None
        return super().map(resource, bundle)

    def dates(self, resource: dict, dosage: dict):
        bounds = ((dosage.get("timing") or {}).get("repeat") or {}).get(
            "boundsPeriod"
        ) or {}
        validity = (resource.get("dispenseRequest") or {}).get("validityPeriod") or {}
        # authoredOn is when the order was written, not when therapy began
        start = bounds.get("start") or validity.get("start")
        end = bounds.get("end") or validity.get("end")
        return f.parse_date(start), f.parse_date(end)

    def _has_statement(self, resource: dict, bundle: dict) -> bool:
        """True when a statement in the bundle covers the same drug and start."""
        key = self._drug_key(resource, bundle)
        if key is None:
            return False
        dosages = resource.get(self.DOSAGE_FIELD) or []
        start, _ = self.dates(resource, dosages[0] if dosages else {})
        starts = self._statement_starts(bundle).get(key)
        if not starts:
            return False
        # A statement with no start date covers every request for the drug
        return start is None or None in starts or start in starts

    def _statement_starts(self, bundle: dict) -> Dict[str, Set[Optional[date]]]:
        """Drug key -> start dates of the bundle's usable statements, built once."""
        index = f.bundle_index(bundle)
        cached = index.memo.get("statement_starts")
        if cached is not None:
            return cached
        starts: Dict[str, Set[Optional[date]]] = {}
        for other in index.by_type.get("MedicationStatement", []):
            if str(other.get("status") or "").lower() in SKIPPED_STATUS:
                continue
            key = self._drug_key(other, bundle)
            if key is None or not _usable_statement(other, bundle):
                continue
            other_start = f.parse_date(f.period(other, "effective")[0])
            starts.setdefault(key, set()).add(other_start)
        index.memo["statement_starts"] = starts
        return starts

    @staticmethod
    def _drug_key(resource: dict, bundle: dict) -> Optional[str]:
        """RxNorm code when present, else the lower-cased name."""
        return medication_code(resource, bundle) or f.norm(
            medication_name(resource, bundle)
        )


def _usable_statement(statement: dict, bundle: dict) -> bool:
    """True when the statement will itself be imported, so it may stand in for a request."""
    try:
        mapped = MedicationStatementMapper().map(statement, bundle)
        if mapped is None:
            return False
        MedicationCreate.model_validate({**mapped.data, "patient_id": 0})
    except (ValidationError, *MAPPING_ERRORS):
        return False
    return True
