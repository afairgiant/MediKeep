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

# SNOMED codes for a kind of allergy rather than a substance, with what a refuted
# one says there is none of; a C-CDA "no known allergies" entry arrives this way
ALLERGY_KIND_CODES = {
    "419199007": "allergies",  # Allergy to substance
    "609328004": "allergies",  # Allergic disposition, active; 419199007 is not
    "416098002": "drug allergies",  # Allergy to drug
    "414285001": "food allergies",  # Allergy to food
    "426232007": "environmental allergies",  # Environmental allergy
    "232347008": "animal allergies",  # Allergy to animal dander, inactive but still sent
    "444316004": "seasonal allergies",  # Seasonal allergy
    "12481000132103": "biological substance allergies",  # H/O: biological substance allergy
    "420134006": "adverse reactions",  # Propensity to adverse reaction
    "418038007": "adverse reactions to substances",  # ... to substance
    "419511003": "adverse reactions to drugs",  # ... to drug
    "418471000": "adverse reactions to food",  # ... to food
}
# SNOMED 716186003 "No known allergy" and every code under it (checked against the
# SNOMED hierarchy on tx.fhir.org); always skipped, with a
# warning unless refuted (a double negative) or entered in error
NO_KNOWN_ALLERGY_CODES = {
    "716186003": "allergies",  # No known allergy
    "409137002": "drug allergies",  # No known drug allergy
    "429625007": "food allergies",  # No known food allergy
    "428607008": "environmental allergies",  # No known environmental allergy
    "428197003": "insect allergies",  # No known insect allergy
    "716220001": "animal allergies",  # No known animal allergy
    "1003774007": "latex allergies",  # No known Hevea brasiliensis latex allergy
}
NO_KNOWN = "Allergies: file states no known {}"
NO_KNOWN_ALLERGIES = NO_KNOWN.format("allergies")

# The column is required; this is what an import writes when the file has no reaction
NO_REACTION = "Not specified"

MAX_ALLERGEN = 200
MAX_REACTION = 500
MAX_NOTES = 5000

# Columns a re-import overwrites; a local edit to any of them marks the row as edited
HASH_FIELDS = ("allergen", "reaction", "severity", "onset_date", "status")


class AllergyMapper(BaseResourceMapper):
    """AllergyIntolerance -> allergies row."""

    RESOURCE_TYPE = "AllergyIntolerance"
    RECORD_TYPE = "allergy"
    MODEL = Allergy
    CREATE_SCHEMA = AllergyCreate

    def map(self, resource: dict, bundle: dict) -> Optional[MappedRecord]:
        """Map one AllergyIntolerance; None when refuted, in error, unnamed or a no-allergy statement."""
        verification = f.status_code(resource, "verificationStatus", "")
        if verification in ("entered-in-error", "refuted"):
            return None
        if f.code_for(resource.get("code"), f.SNOMED) in NO_KNOWN_ALLERGY_CODES:
            return None
        warnings: list = []
        allergen = f.name_for(resource.get("code"), warnings, "allergen")
        if not allergen:
            return None

        reactions = f.objects(resource.get("reaction"))
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
            external_id=f.resource_id(resource),
            data=data,
            hash_parts=self.hash_parts_for_data(data),
            label=f"AllergyIntolerance/{f.resource_id(resource) or '?'}",
            warnings=warnings,
        )

    def skip_reason(self, resource: dict, bundle: dict) -> Optional[str]:
        """
        The "no known allergies" warning for a skipped no-allergy statement that
        is still current: a refuted kind of allergy, or a no-known-allergy
        situation code that is neither refuted nor entered in error.
        """
        if f.status_code(resource, "clinicalStatus", "") in ("inactive", "resolved"):
            return None
        verification = f.status_code(resource, "verificationStatus", "")
        code = f.code_for(resource.get("code"), f.SNOMED)
        if verification == "refuted":
            kind = ALLERGY_KIND_CODES.get(code)
        elif verification != "entered-in-error":
            kind = NO_KNOWN_ALLERGY_CODES.get(code)
        else:
            kind = None
        return NO_KNOWN.format(kind) if kind else None

    def hash_parts_for_row(self, row: Any) -> Tuple[Any, ...]:
        """The hashed columns; content_hash folds case, spacing and date format."""
        return tuple(getattr(row, name) for name in HASH_FIELDS)

    @staticmethod
    def _reaction_text(reactions: List[dict]) -> Optional[str]:
        """Distinct manifestation names across all reactions, else the description."""
        names: List[str] = []
        descriptions: List[str] = []
        for reaction in reactions:
            for concept in f.objects(reaction.get("manifestation")):
                text = f.display_for(concept)
                if text and text not in names:
                    names.append(text)
            description = reaction.get("description")
            if isinstance(description, str) and description.strip():
                descriptions.append(description.strip())
        return ", ".join(names) or "; ".join(descriptions) or None

    @staticmethod
    def _severity(resource: dict, reactions: List[dict]) -> str:
        """First reaction severity, else criticality, else "none"."""
        for reaction in reactions:
            if reaction.get("severity") in ("mild", "moderate", "severe"):
                return reaction["severity"]
        criticality = resource.get("criticality")
        if not isinstance(criticality, str):
            return "none"
        return CRITICALITY_SEVERITY.get(criticality, "none")
