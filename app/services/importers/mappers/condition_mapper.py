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

# Columns a re-import overwrites; a local edit to any of them marks the row as edited
HASH_FIELDS = (
    "snomed_code",
    "icd10_code",
    "diagnosis",
    "code_description",
    "severity",
    "onset_date",
    "end_date",
    "status",
)


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
        warnings: list = []
        diagnosis = f.name_for(code, warnings, "diagnosis")
        if not diagnosis:
            return None

        label = f"Condition/{f.resource_id(resource) or '?'}"
        onset_date = f.past_date(
            f.parse_date(f.period(resource, "onset")[0]), warnings, "onset date"
        )
        end_date = f.past_date(
            f.parse_date(f.period(resource, "abatement")[0]), warnings, "end date"
        )
        # The dates are settled first, so a dropped end date never decides the status
        if end_date and onset_date and end_date < onset_date:
            warnings.append("abatement before onset, end date dropped")
            end_date = None
        status = CONDITION_STATUS.get(
            f.status_code(resource, "clinicalStatus", f.CONDITION_CLINICAL)
        )
        if status is None:
            status = "resolved" if end_date else "active"
        # An abatement date means the condition is over whatever the status says
        if end_date and status not in ("resolved", "inactive"):
            status = "resolved"

        icd10 = f.whole_coding(
            code, (f.ICD10CM, f.ICD10), MAX_ICD10, warnings, "ICD-10 code"
        )
        icd10_code = f.code_text(icd10.get("code"))
        # The description belongs to the coding whose code is stored
        icd_display = f.text(icd10.get("display"))
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
            "icd10_code": icd10_code,
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
            external_id=f.resource_id(resource),
            data=data,
            hash_parts=self.hash_parts_for_data(data),
            label=label,
            warnings=warnings,
        )

    def hash_parts_for_row(self, row: Any) -> Tuple[Any, ...]:
        """The hashed columns; content_hash folds case, spacing and date format."""
        return tuple(getattr(row, name) for name in HASH_FIELDS)

    @staticmethod
    def _severity(resource: dict) -> Optional[str]:
        """SeverityLevel value from Condition.severity, matched on its display text."""
        text = (f.display_for(resource.get("severity")) or "").lower()
        return next((word for word in SEVERITY_WORDS if word in text), None)
