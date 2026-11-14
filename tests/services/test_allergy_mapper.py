"""
Tests for the FHIR AllergyIntolerance mapper.
"""

from datetime import date

from app.models.clinical import Allergy
from app.services.importers.mappers.allergy_mapper import (
    NO_KNOWN_ALLERGIES,
    NO_REACTION,
    AllergyMapper,
)
from app.services.importers.provenance import content_hash

CLINICAL = "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical"
VERIFICATION = "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification"
SNOMED = "http://snomed.info/sct"
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

    def test_no_known_allergies_gives_a_skip_reason(self):
        """Test that a refuted entry coded as a kind of allergy reports no known allergies."""
        refuted = _status("refuted", VERIFICATION)
        resource = _allergy(
            verificationStatus=refuted,
            code={"coding": [{"system": SNOMED, "code": "419199007"}]},
        )
        assert self.mapper.map(resource, BUNDLE) is None
        assert self.mapper.skip_reason(resource, BUNDLE) == NO_KNOWN_ALLERGIES
        assert (
            self.mapper.skip_reason(_allergy(verificationStatus=refuted), BUNDLE)
            is None
        )

    def test_refuted_without_code_is_skipped_without_a_reason(self):
        """Test that a refuted entry with no code is not read as no known allergies."""
        resource = _allergy(verificationStatus=_status("refuted", VERIFICATION))
        del resource["code"]
        assert self.mapper.map(resource, BUNDLE) is None
        assert self.mapper.skip_reason(resource, BUNDLE) is None
        assert self.mapper.skip_reason(_allergy(), BUNDLE) is None

    def test_refuted_kind_names_the_kind(self):
        """Test that a refuted food or drug allergy does not claim no allergies at all."""
        refuted = _status("refuted", VERIFICATION)
        cases = {
            "414285001": "Allergies: file states no known food allergies",
            "416098002": "Allergies: file states no known drug allergies",
            "426232007": "Allergies: file states no known environmental allergies",
            "609328004": NO_KNOWN_ALLERGIES,
            "232347008": "Allergies: file states no known animal allergies",
            "444316004": "Allergies: file states no known seasonal allergies",
            "12481000132103": (
                "Allergies: file states no known biological substance allergies"
            ),
            "418471000": ("Allergies: file states no known adverse reactions to food"),
        }
        for code, reason in cases.items():
            resource = _allergy(
                verificationStatus=refuted,
                code={"coding": [{"system": SNOMED, "code": code}]},
            )
            assert self.mapper.map(resource, BUNDLE) is None
            assert self.mapper.skip_reason(resource, BUNDLE) == reason

    def test_no_known_allergy_code_is_not_imported_as_an_allergy(self):
        """Test that a confirmed "no known allergy" entry is skipped with a reason."""
        cases = {
            "716186003": NO_KNOWN_ALLERGIES,
            "409137002": "Allergies: file states no known drug allergies",
            "429625007": "Allergies: file states no known food allergies",
            "428607008": "Allergies: file states no known environmental allergies",
            "428197003": "Allergies: file states no known insect allergies",
            "716220001": "Allergies: file states no known animal allergies",
            "1003774007": "Allergies: file states no known latex allergies",
        }
        for code, reason in cases.items():
            for verification in (None, _status("confirmed", VERIFICATION)):
                resource = _allergy(
                    verificationStatus=verification,
                    code={
                        "coding": [
                            {
                                "system": SNOMED,
                                "code": code,
                                "display": "No known allergy",
                            }
                        ]
                    },
                )
                assert self.mapper.map(resource, BUNDLE) is None
                assert self.mapper.skip_reason(resource, BUNDLE) == reason

    def test_no_known_allergies_no_longer_current_gives_no_reason(self):
        """Test that an inactive or resolved no-allergy statement is skipped silently."""
        for clinical in ("inactive", "resolved"):
            refuted_kind = _allergy(
                clinicalStatus=_status(clinical),
                verificationStatus=_status("refuted", VERIFICATION),
                code={"coding": [{"system": SNOMED, "code": "419199007"}]},
            )
            situation = _allergy(
                clinicalStatus=_status(clinical),
                code={"coding": [{"system": SNOMED, "code": "716186003"}]},
            )
            for resource in (refuted_kind, situation):
                assert self.mapper.map(resource, BUNDLE) is None
                assert self.mapper.skip_reason(resource, BUNDLE) is None

    def test_refuted_no_known_allergy_is_skipped_without_a_reason(self):
        """Test that a refuted "no known allergy" is not reported as no allergies."""
        resource = _allergy(
            verificationStatus=_status("refuted", VERIFICATION),
            code={"coding": [{"system": SNOMED, "code": "716186003"}]},
        )
        assert self.mapper.map(resource, BUNDLE) is None
        assert self.mapper.skip_reason(resource, BUNDLE) is None

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


class TestMalformedAllergyFields:
    """Wrongly typed fields are ignored rather than failing the resource."""

    def test_non_string_criticality_and_reaction_parts(self):
        """Test that a list criticality and string reaction entries are passed over."""
        resource = _allergy(
            criticality=["high"],
            reaction=["hives", {"manifestation": "hives", "description": 5}],
        )
        mapped = AllergyMapper().map(resource, BUNDLE)
        assert mapped.data["severity"] == "none"
        assert mapped.data["reaction"] == "Not specified"
