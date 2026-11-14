"""
Tests for the FHIR MedicationStatement and MedicationRequest mappers.
"""

from datetime import date

from app.models.clinical import Medication
from app.services.importers.mappers import _fhir as f
from app.services.importers.mappers.medication_mapper import (
    NO_KNOWN_MEDICATIONS,
    MedicationRequestMapper,
    MedicationStatementMapper,
)
from app.services.importers.provenance import content_hash

RXNORM = "http://www.nlm.nih.gov/research/umls/rxnorm"
SNOMED = "http://snomed.info/sct"
EMPTY = {"resourceType": "Bundle", "entry": []}


def _concept(code, display):
    return {"coding": [{"system": RXNORM, "code": code, "display": display}]}


def _statement(**overrides):
    resource = {
        "resourceType": "MedicationStatement",
        "id": "ms1",
        "status": "active",
        "medicationCodeableConcept": _concept("314076", "Lisinopril 10 MG Oral Tablet"),
        "effectivePeriod": {"start": "2019-03-02"},
        "reasonCode": [{"text": "Hypertension"}],
        "dosage": [
            {"text": "Take 1 tablet by mouth once daily", "route": {"text": "Oral"}}
        ],
    }
    resource.update(overrides)
    return resource


def _request(**overrides):
    resource = {
        "resourceType": "MedicationRequest",
        "id": "mr1",
        "status": "active",
        "intent": "order",
        "medicationCodeableConcept": _concept("745679", "Albuterol Inhaler"),
        "authoredOn": "2003-01-10",
        "dosageInstruction": [
            {
                "route": {"coding": [{"display": "Respiratory tract route"}]},
                "timing": {
                    "repeat": {
                        "frequency": 2,
                        "period": 1,
                        "periodUnit": "d",
                        "boundsPeriod": {"start": "2003-01-10", "end": "2004-08-15"},
                    }
                },
                "doseAndRate": [{"doseQuantity": {"value": 2, "unit": "{puff}"}}],
            }
        ],
    }
    resource.update(overrides)
    return resource


def _bundle(*resources):
    return {"resourceType": "Bundle", "entry": [{"resource": r} for r in resources]}


class TestMedicationStatementMapper:
    """Test MedicationStatement resources become medication rows."""

    mapper = MedicationStatementMapper()

    def test_sig_route_dates_and_indication(self):
        """Test the sig becomes the dosage and route, dates and reason are carried over."""
        mapped = self.mapper.map(_statement(), EMPTY)
        assert mapped.record_type == "medication"
        assert mapped.data["medication_name"] == "Lisinopril 10 MG Oral Tablet"
        assert mapped.data["dosage"] == "Take 1 tablet by mouth once daily"
        assert mapped.data["frequency"] is None
        assert mapped.data["route"] == "oral"
        assert mapped.data["indication"] == "Hypertension"
        assert mapped.data["effective_period_start"] == date(2019, 3, 2)
        assert mapped.data["effective_period_end"] is None
        assert mapped.data["status"] == "active"
        assert mapped.data["medication_type"] == "prescription"
        assert mapped.data["notes"] is None

    def test_status_mapping(self):
        """Test intended, not-taken and unknown statuses."""
        assert (
            self.mapper.map(_statement(status="intended"), EMPTY).data["status"]
            == "active"
        )
        assert (
            self.mapper.map(_statement(status="not-taken"), EMPTY).data["status"]
            == "cancelled"
        )
        assert (
            self.mapper.map(_statement(status="unknown"), EMPTY).data["status"]
            == "active"
        )

    def test_entered_in_error_is_skipped(self):
        """Test that an entered-in-error statement is not mapped."""
        assert self.mapper.map(_statement(status="entered-in-error"), EMPTY) is None

    def test_long_sig_goes_to_notes(self):
        """Test that a sig over the dosage limit is kept in full in the notes."""
        sig = (
            "Take one tablet by mouth every morning with food and a full glass of water"
        )
        mapped = self.mapper.map(_statement(dosage=[{"text": sig}]), EMPTY)
        assert mapped.data["dosage"].endswith("...")
        assert mapped.data["notes"] == f"Sig: {sig}"
        assert "dosage truncated to 50 characters" in mapped.warnings

    def test_unknown_route_goes_to_notes(self):
        """Test that a route MediKeep has no value for is left empty and kept in notes."""
        resource = _statement(dosage=[{"route": {"text": "Intravitreal"}}])
        mapped = self.mapper.map(resource, EMPTY)
        assert mapped.data["route"] is None
        assert mapped.data["notes"] == "Route: Intravitreal"
        assert mapped.warnings == [
            "route 'Intravitreal' is not in MediKeep's list, kept in notes"
        ]

    def test_route_codes_and_displays(self):
        """Test SNOMED route codes and display wordings map onto MediKeep's values."""
        cases = [
            ({"coding": [{"system": SNOMED, "code": "26643006"}]}, "oral"),
            ({"coding": [{"system": SNOMED, "code": "447694001"}]}, "inhalation"),
            ({"coding": [{"system": SNOMED, "code": "6064005"}]}, "topical"),
            ({"coding": [{"system": SNOMED, "code": "45890007"}]}, None),
            ({"text": "Ophthalmic route"}, None),
            ({"coding": [{"system": SNOMED, "code": "10547007"}]}, "aural"),
            ({"text": "Oral route"}, "oral"),
            ({"text": "Respiratory tract route"}, "inhalation"),
            ({"coding": [{"display": "Intramuscular route"}]}, "intramuscular"),
            ({"text": "by mouth"}, "oral"),
        ]
        for concept, expected in cases:
            resource = _statement(dosage=[{"route": concept}])
            assert self.mapper.map(resource, EMPTY).data["route"] == expected

    def test_string_numbers_are_coerced(self):
        """Test that a dose or period given as a string still renders."""
        resource = _statement(
            dosage=[
                {
                    "doseAndRate": [{"doseQuantity": {"value": "5", "unit": "mg"}}],
                    "timing": {
                        "repeat": {"frequency": 1, "period": "0.5", "periodUnit": "d"}
                    },
                }
            ]
        )
        mapped = self.mapper.map(resource, EMPTY)
        assert mapped.data["dosage"] == "5 mg"
        assert mapped.data["frequency"] == "2 times per day"

    def test_unusable_numbers_drop_only_that_field(self):
        """Test that a dose that is not a number leaves the rest of the row intact."""
        resource = _statement(
            dosage=[
                {
                    "text": "Take as directed",
                    "doseAndRate": [{"doseQuantity": {"value": "five", "unit": "mg"}}],
                }
            ]
        )
        mapped = self.mapper.map(resource, EMPTY)
        assert mapped.data["dosage"] == "Take as directed"

    def test_end_before_start_is_dropped(self):
        """Test that an end date before the start is dropped with a warning."""
        resource = _statement(
            effectivePeriod={"start": "2019-03-02", "end": "2018-01-01"}
        )
        mapped = self.mapper.map(resource, EMPTY)
        assert mapped.data["effective_period_end"] is None
        assert mapped.warnings == ["end before start, end date dropped"]

    def test_reference_to_bundle_medication(self):
        """Test that a medicationReference is resolved against the bundle."""
        medication = {
            "resourceType": "Medication",
            "id": "m9",
            "code": {"text": "Metformin 500 MG Oral Tablet"},
        }
        resource = _statement(medicationReference={"reference": "Medication/m9"})
        resource.pop("medicationCodeableConcept")
        mapped = self.mapper.map(resource, _bundle(medication, resource))
        assert mapped.data["medication_name"] == "Metformin 500 MG Oral Tablet"

    def test_without_name_is_skipped(self):
        """Test that a statement with no resolvable drug name is not mapped."""
        resource = _statement(medicationReference={"reference": "Medication/missing"})
        resource.pop("medicationCodeableConcept")
        assert self.mapper.map(resource, EMPTY) is None

    def test_hash_matches_row(self):
        """Test that a row built from the mapped data hashes the same as the resource."""
        mapped = self.mapper.map(_statement(), EMPTY)
        row = Medication(patient_id=1, **mapped.data)
        assert content_hash(self.mapper.hash_parts_for_row(row)) == content_hash(
            mapped.hash_parts
        )
        row.dosage = "2 tablets"
        assert content_hash(self.mapper.hash_parts_for_row(row)) != content_hash(
            mapped.hash_parts
        )


class TestMedicationRequestMapper:
    """Test MedicationRequest resources become medication rows."""

    mapper = MedicationRequestMapper()

    def test_dose_timing_route_and_bounds(self):
        """Test structured dose, timing and bounds are rendered as text and dates."""
        mapped = self.mapper.map(_request(), EMPTY)
        assert mapped.data["dosage"] == "2 puff"
        assert mapped.data["frequency"] == "2 times per day"
        assert mapped.data["route"] == "inhalation"
        assert mapped.data["effective_period_start"] == date(2003, 1, 10)
        assert mapped.data["effective_period_end"] == date(2004, 8, 15)

    def test_contained_medication(self):
        """Test that a contained Medication supplies the name."""
        resource = _request(
            contained=[
                {
                    "resourceType": "Medication",
                    "id": "inner",
                    "code": {"text": "Albuterol 0.09 MG/ACTUAT Inhaler"},
                }
            ],
            medicationReference={"reference": "#inner"},
        )
        resource.pop("medicationCodeableConcept")
        mapped = self.mapper.map(resource, EMPTY)
        assert mapped.data["medication_name"] == "Albuterol 0.09 MG/ACTUAT Inhaler"

    def test_no_start_when_no_bounds(self):
        """Test that authoredOn is not used as the start when the timing has no bounds."""
        resource = _request(dosageInstruction=[{"text": "2 puffs twice daily"}])
        mapped = self.mapper.map(resource, EMPTY)
        assert mapped.data["effective_period_start"] is None
        assert mapped.hash_parts[5] is None
        assert mapped.data["dosage"] == "2 puffs twice daily"

    def test_validity_period_is_start(self):
        """Test that dispenseRequest.validityPeriod is the start when the timing has no bounds."""
        resource = _request(
            dosageInstruction=[{"text": "2 puffs twice daily"}],
            dispenseRequest={"validityPeriod": {"start": "2003-02-01"}},
        )
        mapped = self.mapper.map(resource, EMPTY)
        assert mapped.data["effective_period_start"] == date(2003, 2, 1)

    def test_frequency_wording(self):
        """Test the wording for daily, every N days and timed doses."""
        cases = [
            ({"frequency": 1, "period": 1, "periodUnit": "d"}, "daily"),
            ({"frequency": 1, "period": 2, "periodUnit": "wk"}, "every 2 weeks"),
            (
                {"frequency": 3, "period": 1, "periodUnit": "d", "when": ["AC"]},
                "3 times per day (AC)",
            ),
            ({"frequency": 1, "period": 1, "periodUnit": "h"}, "every hour"),
            ({"frequency": 1, "period": 0.5, "periodUnit": "d"}, "2 times per day"),
            ({"frequency": 1, "period": 0.333, "periodUnit": "d"}, "3 times per day"),
            ({"frequency": 1, "period": 0.25, "periodUnit": "h"}, "4 times per hour"),
            ({"frequency": 1, "period": 0.4, "periodUnit": "d"}, "3 times per day"),
        ]
        for repeat, expected in cases:
            resource = _request(dosageInstruction=[{"timing": {"repeat": repeat}}])
            assert self.mapper.map(resource, EMPTY).data["frequency"] == expected

    def test_unusable_periods_are_dropped_with_a_warning(self):
        """Test that tiny, negative and zero periods give no frequency and a warning."""
        for period in (1e-310, -1, 0):
            repeat = {"frequency": 1, "period": period, "periodUnit": "d"}
            resource = _request(dosageInstruction=[{"timing": {"repeat": repeat}}])
            mapped = self.mapper.map(resource, EMPTY)
            assert mapped.data["frequency"] is None, period
            assert any("dropped" in w for w in mapped.warnings), period

    def test_period_that_is_not_a_number_is_dropped_with_a_warning(self):
        """Test that a bad period is reported like a bad frequency, not silently lost."""
        for period in ("abc", "1e-999990"):
            repeat = {"frequency": 2, "period": period, "periodUnit": "d"}
            resource = _request(dosageInstruction=[{"timing": {"repeat": repeat}}])
            mapped = self.mapper.map(resource, EMPTY)
            assert mapped.data["frequency"] is None, period
            assert "period is not a usable number, timing dropped" in mapped.warnings

    def test_zero_frequency_is_dropped_with_a_warning(self):
        """Test that a frequency of zero is not read as once."""
        repeat = {"frequency": 0, "period": 1, "periodUnit": "d"}
        resource = _request(dosageInstruction=[{"timing": {"repeat": repeat}}])
        mapped = self.mapper.map(resource, EMPTY)
        assert mapped.data["frequency"] is None
        assert any("zero or less" in w for w in mapped.warnings)

    def test_cancelled_and_error_are_skipped(self):
        """Test that cancelled and entered-in-error requests are not mapped."""
        for status in ("cancelled", "entered-in-error"):
            assert self.mapper.map(_request(status=status), EMPTY) is None

    def test_draft_is_active(self):
        """Test that a draft request is stored as active."""
        assert (
            self.mapper.map(_request(status="draft"), EMPTY).data["status"] == "active"
        )

    def test_reference_resolves_by_exact_full_url(self):
        """Test that an absolute reference picks the entry with that fullUrl, not the first id match."""
        bundle = {
            "resourceType": "Bundle",
            "entry": [
                {
                    "fullUrl": "https://a.example/fhir/Medication/m1",
                    "resource": {
                        "resourceType": "Medication",
                        "id": "m1",
                        "code": _concept("1", "Wrong Drug"),
                    },
                },
                {
                    "fullUrl": "https://b.example/fhir/Medication/m1",
                    "resource": {
                        "resourceType": "Medication",
                        "id": "m1",
                        "code": _concept("2", "Right Drug"),
                    },
                },
            ],
        }
        resource = _request(
            medicationReference={"reference": "https://b.example/fhir/Medication/m1"}
        )
        resource.pop("medicationCodeableConcept")
        assert self.mapper.map(resource, bundle).data["medication_name"] == "Right Drug"

    def test_large_bundle_is_indexed_once(self, monkeypatch):
        """Test that thousands of statements share one index instead of a scan per lookup."""
        statements = [
            _statement(
                id=f"ms{i}",
                medicationCodeableConcept=None,
                medicationReference={"reference": f"Medication/missing{i}"},
            )
            for i in range(2000)
        ]
        for statement in statements:
            statement.pop("medicationCodeableConcept")
        requests = [_request(id=f"mr{i}") for i in range(50)]
        bundle = _bundle(*statements, *requests)
        built = []
        real_index = f.BundleIndex

        def counting_index(b):
            built.append(b)
            return real_index(b)

        monkeypatch.setattr(f, "BundleIndex", counting_index)
        with f.indexed(bundle):
            mapped = [self.mapper.map(r, bundle) for r in requests]
            statement_mapper = MedicationStatementMapper()
            for statement in statements:
                statement_mapper.map(statement, bundle)
        assert built == [bundle]
        assert all(m is not None for m in mapped)
        assert mapped[0].data["medication_name"] == "Albuterol Inhaler"

    def test_reference_resolved_once_per_map(self, monkeypatch):
        """Test that one map() outside indexed() builds the index once, not per lookup."""
        resource = _request(medicationReference={"reference": "Medication/missing"})
        resource.pop("medicationCodeableConcept")
        bundle = _bundle(resource)
        built = []
        real_index = f.BundleIndex

        def counting_index(b):
            built.append(b)
            return real_index(b)

        monkeypatch.setattr(f, "BundleIndex", counting_index)
        assert self.mapper.map(resource, bundle) is None
        assert built == [bundle]

    def test_hash_matches_row(self):
        """Test that a row built from the mapped data hashes the same as the resource."""
        mapped = self.mapper.map(_request(), EMPTY)
        row = Medication(patient_id=1, **mapped.data)
        assert content_hash(self.mapper.hash_parts_for_row(row)) == content_hash(
            mapped.hash_parts
        )
        # Every column a re-import overwrites counts as an edit when changed
        row.route = "nasal"
        assert content_hash(self.mapper.hash_parts_for_row(row)) != content_hash(
            mapped.hash_parts
        )


class TestNoMedicationStatements:
    """Test entries that say there is no medication, or not to give one."""

    statements = MedicationStatementMapper()
    requests = MedicationRequestMapper()
    NOTHING = {
        "coding": [
            {"system": SNOMED, "code": "410942007", "display": "Drug or medicament"}
        ]
    }

    def test_not_taken_drug_or_medicament_is_no_known_medications(self):
        """Test that the C-CDA "no known medications" entry is skipped with a warning."""
        resource = _statement(
            status="not-taken", medicationCodeableConcept=self.NOTHING
        )
        assert self.statements.map(resource, EMPTY) is None
        assert self.statements.skip_reason(resource, EMPTY) == NO_KNOWN_MEDICATIONS

    def test_no_known_medications_through_a_referenced_medication(self):
        """Test that the rule also applies when the code is on a bundled Medication."""
        medication = {"resourceType": "Medication", "id": "m1", "code": self.NOTHING}
        resource = _statement(
            status="not-taken", medicationReference={"reference": "Medication/m1"}
        )
        del resource["medicationCodeableConcept"]
        bundle = _bundle(resource, medication)
        assert self.statements.map(resource, bundle) is None
        assert self.statements.skip_reason(resource, bundle) == NO_KNOWN_MEDICATIONS

    def test_taken_drug_or_medicament_and_not_taken_drug_are_kept(self):
        """Test that only the not-taken generic concept counts as no medications."""
        generic = _statement(medicationCodeableConcept=self.NOTHING)
        assert self.statements.map(generic, EMPTY).data["status"] == "active"
        named = _statement(status="not-taken")
        assert self.statements.map(named, EMPTY).data["status"] == "cancelled"
        assert (
            self.statements.skip_reason(_statement(status="entered-in-error"), EMPTY)
            is None
        )

    def test_no_known_medications_situation_code(self):
        """Test that SNOMED's "No known medications" is skipped with the warning."""
        situation = {
            "coding": [
                {
                    "system": SNOMED,
                    "code": "787481004",
                    "display": "No known medications",
                }
            ]
        }
        for status in ("active", "completed"):
            resource = _statement(status=status, medicationCodeableConcept=situation)
            assert self.statements.map(resource, EMPTY) is None
            assert self.statements.skip_reason(resource, EMPTY) == NO_KNOWN_MEDICATIONS
        # Not taking "no known medications" is a double negative: skipped silently
        resource = _statement(status="not-taken", medicationCodeableConcept=situation)
        assert self.statements.map(resource, EMPTY) is None
        assert self.statements.skip_reason(resource, EMPTY) is None

    def test_do_not_perform_drug_or_medicament_is_an_order_not_to_give(self):
        """Test that a do-not-give order is worded literally, whatever its drug."""
        resource = _request(doNotPerform=True, medicationCodeableConcept=self.NOTHING)
        assert self.requests.map(resource, EMPTY) is None
        assert self.requests.skip_reason(resource, EMPTY) == (
            "Skipped MedicationRequest/mr1: an order not to give the medication"
        )

    def test_withdrawn_entries_give_no_warning(self):
        """Test that cancelled and entered-in-error entries are skipped silently."""
        for status in ("cancelled", "entered-in-error"):
            for drug in (self.NOTHING, _concept("1191", "aspirin")):
                order = _request(
                    status=status, doNotPerform=True, medicationCodeableConcept=drug
                )
                assert self.requests.map(order, EMPTY) is None
                assert self.requests.skip_reason(order, EMPTY) is None
            statement = _statement(
                status=status, medicationCodeableConcept=self.NOTHING
            )
            assert self.statements.map(statement, EMPTY) is None
            assert self.statements.skip_reason(statement, EMPTY) is None

    def test_do_not_perform_request_is_skipped_with_a_warning(self):
        """Test that an order not to give a drug does not become an active medication."""
        resource = _request(doNotPerform=True)
        assert self.requests.map(resource, EMPTY) is None
        assert self.requests.skip_reason(resource, EMPTY) == (
            "Skipped MedicationRequest/mr1: an order not to give the medication"
        )
        assert self.requests.map(_request(doNotPerform=False), EMPTY) is not None
        assert self.requests.skip_reason(_request(), EMPTY) is None


class TestDoseText:
    """Doses keep their full value without scientific notation."""

    mapper = MedicationStatementMapper()

    def _dose(self, quantity):
        resource = _statement(dosage=[{"doseAndRate": [{"doseQuantity": quantity}]}])
        return self.mapper.map(resource, EMPTY).data["dosage"]

    def test_large_and_small_values_are_written_in_full(self):
        """Test the values from review: no exponent and no lost digits."""
        assert self._dose({"value": 2400000, "unit": "[iU]"}) == "2400000 [iU]"
        assert self._dose({"value": 1234567}) == "1234567"
        assert self._dose({"value": 0.00001, "unit": "mg"}) == "0.00001 mg"
        assert self._dose({"value": 2.50, "unit": "mg"}) == "2.5 mg"
        assert self._dose({"value": "10", "unit": "mg"}) == "10 mg"
        assert self._dose({"value": 12345678901234567890}) == "12345678901234567890"
        long_value = "12345678901234567890123456789012"
        assert self._dose({"value": long_value}) == long_value

    def test_tiny_exponent_is_not_written_out(self):
        """Test that 1e-999990, which reads as 0.0, is dropped, not written in full."""
        resource = _statement(
            dosage=[
                {
                    "text": "1 tablet",
                    "doseAndRate": [{"doseQuantity": {"value": "1e-999990"}}],
                }
            ]
        )
        mapped = self.mapper.map(resource, EMPTY)
        assert mapped.data["dosage"] == "1 tablet"
        assert mapped.warnings == []

    def test_number_too_large_for_a_float_does_not_fail_the_resource(self):
        """Test that a JSON integer past float range drops the dose, not the medication."""
        mapped = self.mapper.map(
            _statement(
                dosage=[{"doseAndRate": [{"doseQuantity": {"value": 10**400}}]}]
            ),
            EMPTY,
        )
        assert mapped is not None
        assert mapped.data["dosage"] is None
        assert self._dose({"value": " 2.50 ", "unit": "mg"}) == "2.5 mg"

    def test_dose_range_is_written_in_full(self):
        """Test that both ends of a range keep their digits."""
        resource = _statement(
            dosage=[
                {
                    "doseAndRate": [
                        {
                            "doseRange": {
                                "low": {"value": 1000000, "unit": "[iU]"},
                                "high": {"value": 1500000, "unit": "[iU]"},
                            }
                        }
                    ]
                }
            ]
        )
        assert self.mapper.map(resource, EMPTY).data["dosage"] == "1000000-1500000 [iU]"

    def test_frequency_numbers_are_written_in_full(self):
        """Test that timing counts never switch to scientific notation."""
        repeat = {"frequency": 1, "period": 1000000, "periodUnit": "h"}
        resource = _statement(dosage=[{"timing": {"repeat": repeat}}])
        assert (
            self.mapper.map(resource, EMPTY).data["frequency"] == "every 1000000 hours"
        )
        repeat = {"frequency": "12345678901234567891", "period": 3, "periodUnit": "d"}
        resource = _statement(dosage=[{"timing": {"repeat": repeat}}])
        assert (
            self.mapper.map(resource, EMPTY)
            .data["frequency"]
            .startswith("12345678901234567891 times per 3 days")
        )


class TestRouteCodes:
    """Only SNOMED route codes whose meaning matches a MediKeep route are mapped."""

    mapper = MedicationStatementMapper()

    def _route(self, code, text):
        resource = _statement(
            dosage=[
                {
                    "route": {
                        "coding": [{"system": SNOMED, "code": code}],
                        "text": text,
                    }
                }
            ]
        )
        return self.mapper.map(resource, EMPTY)

    def test_endocervical_and_body_cavity_are_not_mapped(self):
        """Test the two codes from review fall back to notes with a warning."""
        for code, text in (
            ("372450004", "Endocervical route"),
            ("420254004", "Body cavity route"),
        ):
            mapped = self._route(code, text)
            assert mapped.data["route"] is None, code
            assert f"Route: {text}" in mapped.data["notes"], code
            assert any("not in MediKeep's list" in w for w in mapped.warnings), code

    def test_unmapped_code_is_not_overridden_by_text(self):
        """Test a code outside the map with text naming a MediKeep route maps nothing."""
        for code, text in (
            ("372450004", "Inhalation"),  # Endocervical
            ("54485002", "Topical"),  # Ophthalmic
            ("16857009", "Topical route"),  # Vaginal
        ):
            mapped = self._route(code, text)
            assert mapped.data["route"] is None, code
            assert f"Route: {text} (SNOMED {code})" in mapped.data["notes"], code
            assert (
                f"route code {code} is not in MediKeep's list, kept in notes"
                in mapped.warnings
            ), code

    def test_unmapped_code_without_text_is_kept(self):
        """Test a bare code outside the map is kept in the notes, not lost."""
        mapped = self._route("54485002", None)
        assert mapped.data["route"] is None
        assert "Route: SNOMED 54485002" in mapped.data["notes"]


def _kept_requests(*resources):
    """Ids of the requests kept once the statements in the same file are seen."""
    bundle = _bundle(*resources)
    mappers = {
        "MedicationStatement": MedicationStatementMapper(),
        "MedicationRequest": MedicationRequestMapper(),
    }
    mapped = []
    with f.indexed(bundle):
        for resource in resources:
            mapper = mappers.get(resource["resourceType"])
            record = mapper.map(resource, bundle) if mapper else None
            if record is not None:
                mapped.append((record, mapper))
    dropped = mappers["MedicationRequest"].covered(mapped)
    return [
        record.external_id
        for record, mapper in mapped
        if isinstance(mapper, MedicationRequestMapper)
        and not any(record is d for d in dropped)
    ]


class TestRequestPrecedence:
    """A request is dropped when an imported statement has the same drug and start."""

    def test_statement_for_same_drug_and_start_covers_the_request(self):
        """Test that matching RxNorm and start drop the request."""
        statement = _statement(
            medicationCodeableConcept=_concept("745679", "Albuterol Inhaler"),
            effectivePeriod={"start": "2003-01-10"},
        )
        assert _kept_requests(statement, _request()) == []

    def test_statement_with_other_start_does_not_cover(self):
        """Test that a different start date leaves the request in."""
        statement = _statement(
            medicationCodeableConcept=_concept("745679", "Albuterol Inhaler"),
            effectivePeriod={"start": "2010-01-01"},
        )
        assert _kept_requests(statement, _request()) == ["mr1"]

    def test_statement_without_start_covers(self):
        """Test that a statement with no start date covers every request for the drug."""
        statement = _statement(
            medicationCodeableConcept=_concept("745679", "Albuterol Inhaler")
        )
        statement.pop("effectivePeriod")
        assert _kept_requests(statement, _request()) == []

    def test_not_taken_statement_does_not_cover(self):
        """Test that a statement saying the drug was not taken leaves the request in."""
        statement = _statement(
            status="not-taken",
            medicationCodeableConcept=_concept("745679", "Albuterol Inhaler"),
        )
        statement.pop("effectivePeriod")
        assert _kept_requests(statement, _request()) == ["mr1"]

    def test_statement_by_reference_covers(self):
        """Test that RxNorm is read through a referenced Medication."""
        medication = {
            "resourceType": "Medication",
            "id": "albuterol",
            "code": _concept("745679", "Albuterol HFA"),
        }
        statement = _statement(
            medicationReference={"reference": "Medication/albuterol"},
            effectivePeriod={"start": "2003-01-10"},
        )
        statement.pop("medicationCodeableConcept")
        assert _kept_requests(medication, statement, _request()) == []

    def test_name_matches_when_only_one_side_has_rxnorm(self):
        """Test that a text-only statement covers a coded request of the same name."""
        statement = _statement(
            medicationCodeableConcept={"text": "albuterol  INHALER"},
            effectivePeriod={"start": "2003-01-10"},
        )
        assert _kept_requests(statement, _request()) == []

    def test_different_rxnorm_codes_do_not_match_on_name(self):
        """Test that two coded drugs with different codes are different drugs."""
        statement = _statement(
            medicationCodeableConcept=_concept("1", "Albuterol Inhaler"),
            effectivePeriod={"start": "2003-01-10"},
        )
        assert _kept_requests(statement, _request()) == ["mr1"]

    def test_only_statements_count(self):
        """Test that one request never drops another."""
        other = _request(id="mr2")
        assert _kept_requests(other, _request()) == ["mr2", "mr1"]

    def test_request_with_string_dosage_is_still_compared(self):
        """Test that a string in dosageInstruction neither crashes nor escapes the check."""
        statement = _statement(
            medicationCodeableConcept=_concept("745679", "Albuterol Inhaler"),
            effectivePeriod={"start": "2003-01-10"},
        )
        request = _request(dosageInstruction=["2 puffs twice daily"])
        assert MedicationRequestMapper().map(request, EMPTY) is not None
        assert _kept_requests(statement, request) == []


class TestMalformedMedicationFields:
    """Wrongly typed fields are ignored rather than failing the resource."""

    mapper = MedicationStatementMapper()

    def test_string_reference_and_list_unit(self):
        """Test a string medicationReference and a list unit."""
        resource = _statement(
            medicationReference="Medication/1",
            dosage=[{"doseAndRate": [{"doseQuantity": {"value": 5, "unit": ["mg"]}}]}],
        )
        mapped = self.mapper.map(resource, EMPTY)
        assert mapped.data["dosage"] == "5"

    def test_non_string_codes_are_not_written(self):
        """Test that a list where a code belongs is ignored, not stringified."""
        resource = _statement(
            medicationCodeableConcept={
                "coding": [
                    {"system": RXNORM, "code": ["314076"], "display": "Lisinopril"}
                ]
            },
            dosage=[{"route": {"coding": [{"system": SNOMED, "code": ["26643006"]}]}}],
        )
        mapped = self.mapper.map(resource, EMPTY)
        assert mapped.source_codes == {}
        assert mapped.data["route"] is None
        assert "[" not in (mapped.data["notes"] or "")

    def test_unusable_ids_become_none(self):
        """Test that a list or object id is not used as the external id."""
        for value in (["x"], {"a": 1}, True):
            assert self.mapper.map(_statement(id=value), EMPTY).external_id is None
        assert self.mapper.map(_statement(id=7), EMPTY).external_id == "7"


class TestMedicationNames:
    """Where a medication's name comes from."""

    mapper = MedicationStatementMapper()

    def test_reference_display_when_the_medication_has_no_name(self):
        """Test that a resolved Medication without a code still uses the display."""
        medication = {"resourceType": "Medication", "id": "m1"}
        resource = _statement(
            medicationReference={"reference": "Medication/m1", "display": "Lisinopril"}
        )
        resource.pop("medicationCodeableConcept")
        mapped = self.mapper.map(resource, _bundle(medication))
        assert mapped.data["medication_name"] == "Lisinopril"

    def test_bare_rxnorm_code_is_used_with_a_warning(self):
        """Test that a Medication with only a code is kept and reported."""
        medication = {
            "resourceType": "Medication",
            "id": "m1",
            "code": {"coding": [{"system": RXNORM, "code": "314076"}]},
        }
        resource = _statement(medicationReference={"reference": "Medication/m1"})
        resource.pop("medicationCodeableConcept")
        mapped = self.mapper.map(resource, _bundle(medication))
        assert mapped.data["medication_name"] == "314076"
        assert "no drug name in the file, the code is used" in mapped.warnings

    def test_bare_non_rxnorm_code_is_kept_too(self):
        """Test that an NDC-only medication is kept under its code, not dropped."""
        resource = _statement(
            medicationCodeableConcept={
                "coding": [
                    {"system": "http://hl7.org/fhir/sid/ndc", "code": "0071-0155"}
                ]
            }
        )
        mapped = self.mapper.map(resource, EMPTY)
        assert mapped.data["medication_name"] == "0071-0155"
        assert mapped.source_codes == {}
        assert "no drug name in the file, the code is used" in mapped.warnings

    def test_integer_code_is_kept_as_the_name(self):
        """Test that a numeric code with no name is kept under the code."""
        resource = _statement(
            medicationCodeableConcept={"coding": [{"system": RXNORM, "code": 314076}]}
        )
        mapped = self.mapper.map(resource, EMPTY)
        assert mapped.data["medication_name"] == "314076"
        assert mapped.source_codes == {"rxnorm": "314076"}

    def test_list_status_is_not_stringified(self):
        """Test that a list status is treated as missing, without raising."""
        mapped = self.mapper.map(_statement(status=["entered-in-error"]), EMPTY)
        assert mapped.data["status"] == "active"

    def test_contained_medication_with_numeric_id(self):
        """Test that a contained Medication with id 1 matches reference #1."""
        resource = _statement(
            medicationReference={"reference": "#1"},
            contained=[
                {"resourceType": "Medication", "id": 1, "code": {"text": "Lisinopril"}}
            ],
        )
        resource.pop("medicationCodeableConcept")
        assert self.mapper.map(resource, EMPTY).data["medication_name"] == "Lisinopril"


class TestRouteConflict:
    """A route code wins over its text, but a disagreement is reported."""

    mapper = MedicationStatementMapper()

    def test_code_and_text_that_disagree(self):
        """Test oral code with inhaled text: oral, a warning and the text in notes."""
        resource = _statement(
            dosage=[
                {
                    "route": {
                        "coding": [{"system": SNOMED, "code": "26643006"}],
                        "text": "Inhaled",
                    }
                }
            ]
        )
        mapped = self.mapper.map(resource, EMPTY)
        assert mapped.data["route"] == "oral"
        assert "Route: Inhaled" in mapped.data["notes"]
        assert any("does not match the route code" in w for w in mapped.warnings)

    def test_code_with_text_medikeep_has_no_route_for(self):
        """Test oral code with ophthalmic text: the text is kept and reported, not lost."""
        resource = _statement(
            dosage=[
                {
                    "route": {
                        "coding": [{"system": SNOMED, "code": "26643006"}],
                        "text": "Ophthalmic",
                    }
                }
            ]
        )
        mapped = self.mapper.map(resource, EMPTY)
        assert mapped.data["route"] == "oral"
        assert "Route: Ophthalmic" in mapped.data["notes"]
        assert mapped.warnings == [
            "route text 'Ophthalmic' is not a route wording the importer knows,"
            " the code is used and the text kept in notes"
        ]

    def test_snomed_synonyms_agree_with_their_code(self):
        """Test the SNOMED synonyms of a mapped code are not reported as a mismatch."""
        for code, display in (
            ("26643006", "Oral use"),
            ("26643006", "Oral route (qualifier value)"),
            ("26643006", "Per os"),
            ("26643006", "Orally"),
            ("6064005", "Cutaneous use"),
            ("47625008", "IV use"),
            ("34206005", "Subdermal route"),
            ("447694001", "Inhalation route"),
            ("46713006", "Nasal use"),
            ("10547007", "In ear"),
            ("10547007", "Auricular use"),
            ("37161004", "Per rectum (route) (qualifier value)"),
            ("37161004", "Rectally"),
            ("37839007", "Sublingually"),
        ):
            resource = _statement(
                dosage=[
                    {
                        "route": {
                            "coding": [
                                {"system": SNOMED, "code": code, "display": display}
                            ]
                        }
                    }
                ]
            )
            mapped = self.mapper.map(resource, EMPTY)
            assert mapped.warnings == [], display
            assert mapped.data["notes"] is None or "Route:" not in mapped.data["notes"]

    def test_code_and_text_that_agree(self):
        """Test that matching code and text give no warning."""
        resource = _statement(
            dosage=[
                {
                    "route": {
                        "coding": [{"system": SNOMED, "code": "26643006"}],
                        "text": "Oral route",
                    }
                }
            ]
        )
        mapped = self.mapper.map(resource, EMPTY)
        assert mapped.data["route"] == "oral"
        assert mapped.warnings == []
