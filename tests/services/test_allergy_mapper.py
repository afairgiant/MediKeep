"""
Tests for the FHIR AllergyIntolerance mapper.
"""

from datetime import date

from app.models.clinical import Allergy
from app.services.importers.mappers.allergy_mapper import NO_REACTION, AllergyMapper
from app.services.importers.provenance import content_hash

CLINICAL = "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical"
VERIFICATION = "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification"
BUNDLE = {"resourceType": "Bundle", "entry": []}


def _status(code, system=CLINICAL):
    return {"coding": [{"system": system, "code": code}]}


def _allergy(**overrides):
    resource = {
        "resourceType": "AllergyIntolerance",
        "id": "a1",
        "clinicalStatus": _status("active"),
        "code": {
            "coding": [
                {
                    "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                    "code": "7980",
                    "display": "Penicillin G",
                }
            ]
        },
        "onsetDateTime": "2001-05-20",
        "reaction": [
            {
                "manifestation": [{"text": "Hives"}, {"text": "Wheezing"}],
                "severity": "moderate",
            }
        ],
    }
    resource.update(overrides)
    return resource


class TestAllergyMapper:
    """Test AllergyIntolerance resources become allergy rows."""

    mapper = AllergyMapper()

    def test_reaction_severity_and_dates(self):
        """Test manifestations are joined and severity and onset carried over."""
        mapped = self.mapper.map(_allergy(), BUNDLE)
        assert mapped.record_type == "allergy"
        assert mapped.data["allergen"] == "Penicillin G"
        assert mapped.data["reaction"] == "Hives, Wheezing"
        assert mapped.data["severity"] == "moderate"
        assert mapped.data["status"] == "active"
        assert mapped.data["onset_date"] == date(2001, 5, 20)

    def test_missing_reaction_uses_placeholder(self):
        """Test that the required reaction column gets a placeholder when absent."""
        resource = _allergy()
        resource.pop("reaction")
        mapped = self.mapper.map(resource, BUNDLE)
        assert mapped.data["reaction"] == NO_REACTION
        assert mapped.data["severity"] == "none"

    def test_reaction_description_fallback(self):
        """Test that a reaction description is used when there is no manifestation."""
        resource = _allergy(reaction=[{"description": "Rash on arms"}])
        assert self.mapper.map(resource, BUNDLE).data["reaction"] == "Rash on arms"

    def test_criticality_sets_severity(self):
        """Test that criticality fills in severity when reactions carry none."""
        resource = _allergy(
            criticality="high", reaction=[{"manifestation": [{"text": "Rash"}]}]
        )
        assert self.mapper.map(resource, BUNDLE).data["severity"] == "severe"
        resource["criticality"] = "low"
        assert self.mapper.map(resource, BUNDLE).data["severity"] == "mild"

    def test_status_mapping(self):
        """Test inactive, resolved and unconfirmed statuses."""
        assert (
            self.mapper.map(_allergy(clinicalStatus=_status("resolved")), BUNDLE).data[
                "status"
            ]
            == "resolved"
        )
        unconfirmed = _allergy(verificationStatus=_status("unconfirmed", VERIFICATION))
        assert self.mapper.map(unconfirmed, BUNDLE).data["status"] == "unconfirmed"

    def test_missing_status_defaults_to_active(self):
        """Test that an allergy without clinicalStatus is stored as active."""
        resource = _allergy()
        resource.pop("clinicalStatus")
        assert self.mapper.map(resource, BUNDLE).data["status"] == "active"

    def test_refuted_and_error_are_skipped(self):
        """Test that refuted and entered-in-error allergies are not mapped."""
        for code in ("refuted", "entered-in-error"):
            resource = _allergy(verificationStatus=_status(code, VERIFICATION))
            assert self.mapper.map(resource, BUNDLE) is None

    def test_without_name_is_skipped(self):
        """Test that an allergy without a code is not mapped."""
        assert (
            self.mapper.map({"resourceType": "AllergyIntolerance", "id": "a2"}, BUNDLE)
            is None
        )

    def test_long_allergen_is_truncated_with_warning(self):
        """Test that an allergen over the column limit is cut and reported."""
        mapped = self.mapper.map(_allergy(code={"text": "y" * 250}), BUNDLE)
        assert len(mapped.data["allergen"]) == 200
        assert "allergen truncated to 200 characters" in mapped.warnings

    def test_future_onset_is_dropped_and_the_row_kept(self):
        """Test that an onset after today is dropped with a warning, since the schema rejects it."""
        mapped = self.mapper.map(_allergy(onsetDateTime="2999-01-01"), BUNDLE)
        assert mapped is not None
        assert mapped.data["onset_date"] is None
        assert mapped.warnings == ["onset date 2999-01-01 is in the future, dropped"]

    def test_hash_matches_row(self):
        """Test that a row built from the mapped data hashes the same as the resource."""
        mapped = self.mapper.map(_allergy(), BUNDLE)
        row = Allergy(patient_id=1, **mapped.data)
        assert content_hash(self.mapper.hash_parts_for_row(row)) == content_hash(
            mapped.hash_parts
        )
        row.reaction = "Anaphylaxis"
        assert content_hash(self.mapper.hash_parts_for_row(row)) != content_hash(
            mapped.hash_parts
        )
        row.reaction = mapped.data["reaction"]
        row.severity = "mild"
        assert content_hash(self.mapper.hash_parts_for_row(row)) != content_hash(
            mapped.hash_parts
        )
