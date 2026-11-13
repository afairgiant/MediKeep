"""
Tests for the FHIR Condition mapper.
"""

from datetime import date

from app.models.clinical import Condition
from app.services.importers.mappers.condition_mapper import ConditionMapper
from app.services.importers.provenance import content_hash

CLINICAL = "http://terminology.hl7.org/CodeSystem/condition-clinical"
VERIFICATION = "http://terminology.hl7.org/CodeSystem/condition-ver-status"
BUNDLE = {"resourceType": "Bundle", "entry": []}


def _status(code, system=CLINICAL):
    return {"coding": [{"system": system, "code": code}]}


def _condition(**overrides):
    resource = {
        "resourceType": "Condition",
        "id": "c1",
        "clinicalStatus": _status("active"),
        "code": {
            "coding": [
                {
                    "system": "http://snomed.info/sct",
                    "code": "59621000",
                    "display": "Essential hypertension",
                },
                {
                    "system": "http://hl7.org/fhir/sid/icd-10-cm",
                    "code": "I10",
                    "display": "Essential (primary) hypertension",
                },
            ]
        },
        "onsetDateTime": "2018-02-14",
    }
    resource.update(overrides)
    return resource


class TestConditionMapper:
    """Test Condition resources become condition rows."""

    mapper = ConditionMapper()

    def test_codes_dates_and_status(self):
        """Test that codes, onset date and status are carried over."""
        mapped = self.mapper.map(_condition(), BUNDLE)
        assert mapped.record_type == "condition"
        assert mapped.external_id == "c1"
        assert mapped.data["diagnosis"] == "Essential hypertension"
        assert mapped.data["condition_name"] == "Essential hypertension"
        assert mapped.data["icd10_code"] == "I10"
        assert mapped.data["snomed_code"] == "59621000"
        assert mapped.data["code_description"] == "Essential (primary) hypertension"
        assert mapped.data["onset_date"] == date(2018, 2, 14)
        assert mapped.data["status"] == "active"
        assert mapped.data["end_date"] is None
        assert mapped.warnings == []

    def test_text_wins_over_display(self):
        """Test that CodeableConcept.text is preferred for the diagnosis."""
        resource = _condition()
        resource["code"]["text"] = "High blood pressure"
        assert (
            self.mapper.map(resource, BUNDLE).data["diagnosis"] == "High blood pressure"
        )

    def test_resolved_with_abatement(self):
        """Test a resolved condition with month-precision onset and an abatement date."""
        resource = _condition(
            clinicalStatus=_status("resolved"),
            onsetPeriod={"start": "2010-05"},
            abatementDateTime="2015-01-20",
        )
        resource.pop("onsetDateTime")
        mapped = self.mapper.map(resource, BUNDLE)
        assert mapped.data["status"] == "resolved"
        assert mapped.data["onset_date"] == date(2010, 5, 1)
        assert mapped.data["end_date"] == date(2015, 1, 20)

    def test_status_mapping(self):
        """Test remission and relapse map to the closest ConditionStatus values."""
        assert (
            self.mapper.map(
                _condition(clinicalStatus=_status("remission")), BUNDLE
            ).data["status"]
            == "inactive"
        )
        assert (
            self.mapper.map(_condition(clinicalStatus=_status("relapse")), BUNDLE).data[
                "status"
            ]
            == "relapse"
        )

    def test_missing_status_is_derived(self):
        """Test that status comes from the abatement date when clinicalStatus is absent."""
        resource = _condition(abatementDateTime="2020-01-01")
        resource.pop("clinicalStatus")
        assert self.mapper.map(resource, BUNDLE).data["status"] == "resolved"
        resource.pop("abatementDateTime")
        assert self.mapper.map(resource, BUNDLE).data["status"] == "active"

    def test_abatement_overrides_active(self):
        """Test that an active condition with an abatement date is stored as resolved."""
        mapped = self.mapper.map(_condition(abatementDateTime="2020-01-01"), BUNDLE)
        assert mapped.data["status"] == "resolved"

    def test_abatement_before_onset_is_dropped(self):
        """Test that an end date before the onset is dropped with a warning."""
        mapped = self.mapper.map(_condition(abatementDateTime="2010-01-01"), BUNDLE)
        assert mapped.data["end_date"] is None
        assert mapped.warnings == ["abatement before onset, end date dropped"]

    def test_future_dates_are_dropped_and_the_row_kept(self):
        """Test that onset and end dates after today are dropped, since the schema rejects them."""
        mapped = self.mapper.map(
            _condition(onsetDateTime="2999-01-01", abatementDateTime="2999-06-01"),
            BUNDLE,
        )
        assert mapped.data["onset_date"] is None
        assert mapped.data["end_date"] is None
        assert mapped.data["status"] == "active"
        assert mapped.warnings == [
            "onset date 2999-01-01 is in the future, dropped",
            "end date 2999-06-01 is in the future, dropped",
        ]

    def test_severity_and_notes(self):
        """Test severity from its display text and notes joined from annotations."""
        resource = _condition(
            severity={
                "coding": [
                    {"code": "24484000", "display": "Severe (severity modifier)"}
                ]
            },
            note=[{"text": "First note."}, {"text": "Second note."}],
        )
        mapped = self.mapper.map(resource, BUNDLE)
        assert mapped.data["severity"] == "severe"
        assert mapped.data["notes"] == "First note.\nSecond note."

    def test_unknown_severity_is_none(self):
        """Test that a severity text without a known word is left empty."""
        resource = _condition(severity={"text": "Unknown"})
        assert self.mapper.map(resource, BUNDLE).data["severity"] is None

    def test_oversized_codes_are_dropped_not_cut(self):
        """Test that a code over its column limit is dropped whole, never shortened."""
        resource = _condition(
            code={
                "coding": [
                    {"system": "http://snomed.info/sct", "code": "1" * 21},
                    {
                        "system": "http://hl7.org/fhir/sid/icd-10-cm",
                        "code": "I10.ABCDEFGH",
                    },
                ],
                "text": "Hypertension",
            }
        )
        mapped = self.mapper.map(resource, BUNDLE)
        assert mapped.data["snomed_code"] is None
        assert mapped.data["icd10_code"] is None
        assert "SNOMED code longer than 20 characters, dropped" in mapped.warnings
        assert "ICD-10 code longer than 10 characters, dropped" in mapped.warnings
        resource["code"]["coding"].append(
            {"system": "http://hl7.org/fhir/sid/icd-10", "code": "I10"}
        )
        assert self.mapper.map(resource, BUNDLE).data["icd10_code"] == "I10"

    def test_blank_code_is_passed_over(self):
        """Test that a whitespace-only code is skipped and a later one used."""
        resource = _condition(
            code={
                "coding": [
                    {"system": "http://snomed.info/sct", "code": "  "},
                    {"system": "http://snomed.info/sct", "code": "59621000"},
                ],
                "text": "Hypertension",
            }
        )
        assert self.mapper.map(resource, BUNDLE).data["snomed_code"] == "59621000"

    def test_long_diagnosis_is_truncated_with_warning(self):
        """Test that text over the column limit is cut and reported."""
        resource = _condition(code={"text": "x" * 600})
        mapped = self.mapper.map(resource, BUNDLE)
        assert len(mapped.data["diagnosis"]) == 500
        assert mapped.data["diagnosis"].endswith("...")
        assert "diagnosis truncated to 500 characters" in mapped.warnings

    def test_entered_in_error_and_refuted_are_skipped(self):
        """Test that a ruled-out or erroneous condition is not mapped."""
        for code in ("entered-in-error", "refuted"):
            resource = _condition(verificationStatus=_status(code, VERIFICATION))
            assert self.mapper.map(resource, BUNDLE) is None, code

    def test_provisional_is_noted(self):
        """Test that a provisional or differential diagnosis stays active with a note."""
        for code in ("provisional", "differential"):
            resource = _condition(verificationStatus=_status(code, VERIFICATION))
            mapped = self.mapper.map(resource, BUNDLE)
            assert mapped.data["status"] == "active"
            assert mapped.data["notes"] == f"Verification: {code}"

    def test_without_name_is_skipped(self):
        """Test that a Condition without a code is not mapped."""
        assert (
            self.mapper.map({"resourceType": "Condition", "id": "c4"}, BUNDLE) is None
        )

    def test_hash_matches_row(self):
        """Test that a row built from the mapped data hashes the same as the resource."""
        mapped = self.mapper.map(_condition(), BUNDLE)
        row = Condition(patient_id=1, **mapped.data)
        assert content_hash(self.mapper.hash_parts_for_row(row)) == content_hash(
            mapped.hash_parts
        )
        row.diagnosis = "Edited by hand"
        assert content_hash(self.mapper.hash_parts_for_row(row)) != content_hash(
            mapped.hash_parts
        )
        row.diagnosis = mapped.data["diagnosis"]
        for field_name, value in (
            ("severity", "severe"),
            ("icd10_code", "I15"),
            ("code_description", "Edited by hand"),
        ):
            original = getattr(row, field_name)
            setattr(row, field_name, value)
            assert content_hash(self.mapper.hash_parts_for_row(row)) != content_hash(
                mapped.hash_parts
            ), field_name
            setattr(row, field_name, original)


class TestConditionDates:
    """Status is worked out from the dates that survive the checks."""

    mapper = ConditionMapper()

    def test_abatement_before_onset_keeps_the_source_status(self):
        """Test the case from review: active, onset after abatement."""
        mapped = self.mapper.map(
            _condition(onsetDateTime="2020-05-01", abatementDateTime="2019-01-01"),
            BUNDLE,
        )
        assert mapped.data["status"] == "active"
        assert mapped.data["end_date"] is None
        assert mapped.warnings == ["abatement before onset, end date dropped"]

    def test_abatement_before_onset_without_status_is_active(self):
        """Test that a dropped end date no longer implies resolved."""
        resource = _condition(
            onsetDateTime="2020-05-01", abatementDateTime="2019-01-01"
        )
        resource.pop("clinicalStatus")
        assert self.mapper.map(resource, BUNDLE).data["status"] == "active"

    def test_list_values_are_not_written_as_text(self):
        """Test that list codes and text are ignored instead of stringified."""
        resource = _condition(
            code={
                "coding": [
                    {"system": "http://snomed.info/sct", "code": ["59621000"]},
                    {"system": "http://hl7.org/fhir/sid/icd-10-cm", "code": "I10"},
                ],
                "text": ["Hypertension"],
            }
        )
        mapped = self.mapper.map(resource, BUNDLE)
        assert mapped.data["snomed_code"] is None
        assert mapped.data["icd10_code"] == "I10"
        assert mapped.data["diagnosis"] == "I10"
        assert "no diagnosis text in the file, the code is used" in mapped.warnings

    def test_code_description_belongs_to_the_stored_code(self):
        """Test that a non-string display is ignored and the description matches the code."""
        resource = _condition(
            code={
                "coding": [
                    {
                        "system": "http://hl7.org/fhir/sid/icd-10-cm",
                        "code": "J10.ABCDEFGH",
                        "display": "Too long",
                    },
                    {
                        "system": "http://hl7.org/fhir/sid/icd-10-cm",
                        "code": "J10",
                        "display": ["Influenza"],
                    },
                    {
                        "system": "http://hl7.org/fhir/sid/icd-10",
                        "code": "J11",
                        "display": "Influenza, virus not identified",
                    },
                ],
                "text": "Flu",
            }
        )
        mapped = self.mapper.map(resource, BUNDLE)
        assert mapped.data["icd10_code"] == "J10"
        assert mapped.data["code_description"] is None

    def test_code_description_comes_from_the_same_system(self):
        """Test that ICD-10-CM wins and its own display is used, not the WHO one."""
        resource = _condition(
            code={
                "coding": [
                    {
                        "system": "http://hl7.org/fhir/sid/icd-10",
                        "code": "J10",
                        "display": "WHO text",
                    },
                    {
                        "system": "http://hl7.org/fhir/sid/icd-10-cm",
                        "code": "J10",
                        "display": "CM text",
                    },
                ],
                "text": "Flu",
            }
        )
        mapped = self.mapper.map(resource, BUNDLE)
        assert mapped.data["icd10_code"] == "J10"
        assert mapped.data["code_description"] == "CM text"
