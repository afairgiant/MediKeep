"""
Maps FHIR Condition resources onto the Condition table.
"""

from typing import Any, Optional, Tuple

from app.models.clinical import Condition
from app.schemas.condition import ConditionCreate

from . import _fhir as f
from .base_mapper import BaseResourceMapper, MappedRecord

# FHIR condition-clinical code -> ConditionStatus value
CONDITION_STATUS = {
    "active": "active",
    "recurrence": "recurrence",
    "relapse": "relapse",
    "inactive": "inactive",
    "remission": "inactive",
    "resolved": "resolved",
}
SEVERITY_WORDS = ("mild", "moderate", "severe")
# A ruled-out or erroneous diagnosis is not a condition the patient has
SKIPPED_VERIFICATION = ("entered-in-error", "refuted")
NOTED_VERIFICATION = ("provisional", "differential", "unconfirmed")

MAX_DIAGNOSIS = 500
MAX_ICD10 = 10
MAX_SNOMED = 20
MAX_NOTES = 5000


class ConditionMapper(BaseResourceMapper):
    """Condition -> conditions row."""

    RESOURCE_TYPE = "Condition"
    RECORD_TYPE = "condition"
    MODEL = Condition
    CREATE_SCHEMA = ConditionCreate
    # condition_name is the user's own label for the diagnosis; the source sets it once
    preserve_on_update = ("notes", "tags", "condition_name")

    def map(self, resource: dict, bundle: dict) -> Optional[MappedRecord]:
        """Map one Condition; None when refuted, in error or without a name."""
        verification = f.status_code(resource, "verificationStatus", "")
        if verification in SKIPPED_VERIFICATION:
            return None
        code = resource.get("code")
        diagnosis = f.display_for(code)
        if not diagnosis:
            return None

        warnings: list = []
        label = f"Condition/{resource.get('id', '?')}"
        onset_date = f.past_date(
            f.parse_date(f.period(resource, "onset")[0]), warnings, "onset date"
        )
        end_date = f.past_date(
            f.parse_date(f.period(resource, "abatement")[0]), warnings, "end date"
        )
        status = CONDITION_STATUS.get(
            f.status_code(resource, "clinicalStatus", f.CONDITION_CLINICAL)
        )
        if status is None:
            status = "resolved" if end_date else "active"
        # An abatement date means the condition is over whatever the status says
        if end_date and status not in ("resolved", "inactive"):
            status = "resolved"
        if end_date and onset_date and end_date < onset_date:
            warnings.append("abatement before onset, end date dropped")
            end_date = None

        icd_display = next(
            (
                c.get("display")
                for c in f.codings(code)
                if c.get("system") in (f.ICD10CM, f.ICD10) and c.get("display")
            ),
            None,
        )
        notes_parts = []
        if verification in NOTED_VERIFICATION:
            notes_parts.append(f"Verification: {verification}")
        if f.notes_text(resource):
            notes_parts.append(f.notes_text(resource))
        diagnosis = f.fit(diagnosis, MAX_DIAGNOSIS, warnings, "diagnosis")
        data = {
            "diagnosis": diagnosis,
            "condition_name": diagnosis,
            "status": status,
            "severity": self._severity(resource),
            "onset_date": onset_date,
            "end_date": end_date,
            "icd10_code": f.whole_code(
                code, (f.ICD10CM, f.ICD10), MAX_ICD10, warnings, "ICD-10 code"
            ),
            "snomed_code": f.whole_code(
                code, (f.SNOMED,), MAX_SNOMED, warnings, "SNOMED code"
            ),
            "code_description": f.fit(
                icd_display, MAX_DIAGNOSIS, warnings, "code text"
            ),
            "notes": f.fit(
                "\n".join(notes_parts) or None, MAX_NOTES, warnings, "notes"
            ),
        }
        return MappedRecord(
            record_type=self.RECORD_TYPE,
            external_id=resource.get("id"),
            data=data,
            hash_parts=self._parts(
                data["snomed_code"],
                data["icd10_code"],
                diagnosis,
                data["code_description"],
                data["severity"],
                onset_date,
                end_date,
                status,
            ),
            label=label,
            warnings=warnings,
        )

    def hash_parts_for_row(self, row: Any) -> Tuple[Any, ...]:
        """The same hash_parts, read back from an existing row."""
        return self._parts(
            row.snomed_code,
            row.icd10_code,
            row.diagnosis,
            row.code_description,
            row.severity,
            row.onset_date,
            row.end_date,
            row.status,
        )

    @staticmethod
    def _parts(
        snomed,
        icd10,
        diagnosis,
        code_description,
        severity,
        onset_date,
        end_date,
        status,
    ) -> Tuple[Any, ...]:
        """Normalize the same way from a resource and from a row."""
        return (
            snomed or None,
            icd10 or None,
            f.norm(diagnosis),
            f.norm(code_description),
            f.norm(severity),
            f.iso(onset_date),
            f.iso(end_date),
            status,
        )

    @staticmethod
    def _severity(resource: dict) -> Optional[str]:
        """SeverityLevel value from Condition.severity, matched on its display text."""
        text = (f.display_for(resource.get("severity")) or "").lower()
        return next((word for word in SEVERITY_WORDS if word in text), None)
