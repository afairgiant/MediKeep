"""
Maps FHIR AllergyIntolerance resources onto the Allergy table.
"""

from typing import Any, List, Optional, Tuple

from app.models.clinical import Allergy
from app.schemas.allergy import AllergyCreate

from . import _fhir as f
from .base_mapper import BaseResourceMapper, MappedRecord

ALLERGY_STATUS = {"active": "active", "inactive": "inactive", "resolved": "resolved"}
CRITICALITY_SEVERITY = {"low": "mild", "high": "severe"}

# The column is required; this is what an import writes when the file has no reaction
NO_REACTION = "Not specified"

MAX_ALLERGEN = 200
MAX_REACTION = 500
MAX_NOTES = 5000


class AllergyMapper(BaseResourceMapper):
    """AllergyIntolerance -> allergies row."""

    RESOURCE_TYPE = "AllergyIntolerance"
    RECORD_TYPE = "allergy"
    MODEL = Allergy
    CREATE_SCHEMA = AllergyCreate

    def map(self, resource: dict, bundle: dict) -> Optional[MappedRecord]:
        """Map one AllergyIntolerance; None when refuted, in error or unnamed."""
        verification = f.status_code(resource, "verificationStatus", "")
        if verification in ("entered-in-error", "refuted"):
            return None
        allergen = f.display_for(resource.get("code"))
        if not allergen:
            return None

        warnings: list = []
        reactions = [r for r in resource.get("reaction") or [] if isinstance(r, dict)]
        reaction = f.fit(
            self._reaction_text(reactions), MAX_REACTION, warnings, "reaction"
        )
        status = ALLERGY_STATUS.get(
            f.status_code(resource, "clinicalStatus", f.ALLERGY_CLINICAL), "active"
        )
        if verification == "unconfirmed":
            status = "unconfirmed"
        onset_date = f.past_date(
            f.parse_date(f.period(resource, "onset")[0]), warnings, "onset date"
        )
        allergen = f.fit(allergen, MAX_ALLERGEN, warnings, "allergen")
        data = {
            "allergen": allergen,
            "reaction": reaction or NO_REACTION,
            "severity": self._severity(resource, reactions),
            "status": status,
            "onset_date": onset_date,
            "notes": f.fit(f.notes_text(resource), MAX_NOTES, warnings, "notes"),
        }
        return MappedRecord(
            record_type=self.RECORD_TYPE,
            external_id=resource.get("id"),
            data=data,
            hash_parts=self._parts(
                allergen, data["reaction"], data["severity"], onset_date, status
            ),
            label=f"AllergyIntolerance/{resource.get('id', '?')}",
            warnings=warnings,
        )

    def hash_parts_for_row(self, row: Any) -> Tuple[Any, ...]:
        """The same hash_parts, read back from an existing row."""
        return self._parts(
            row.allergen, row.reaction, row.severity, row.onset_date, row.status
        )

    @staticmethod
    def _parts(allergen, reaction, severity, onset_date, status) -> Tuple[Any, ...]:
        """Normalize the same way from a resource and from a row."""
        return (
            f.norm(allergen),
            f.norm(reaction),
            f.norm(severity),
            f.iso(onset_date),
            status,
        )

    @staticmethod
    def _reaction_text(reactions: List[dict]) -> Optional[str]:
        """Distinct manifestation names across all reactions, else the description."""
        names: List[str] = []
        descriptions: List[str] = []
        for reaction in reactions:
            for concept in reaction.get("manifestation") or []:
                text = f.display_for(concept)
                if text and text not in names:
                    names.append(text)
            if reaction.get("description"):
                descriptions.append(str(reaction["description"]).strip())
        return ", ".join(names) or "; ".join(descriptions) or None

    @staticmethod
    def _severity(resource: dict, reactions: List[dict]) -> str:
        """First reaction severity, else criticality, else "none"."""
        for reaction in reactions:
            if reaction.get("severity") in ("mild", "moderate", "severe"):
                return reaction["severity"]
        return CRITICALITY_SEVERITY.get(resource.get("criticality"), "none")
