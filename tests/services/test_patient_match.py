"""Tests for the patient match check on uploaded bundles."""

import time
from datetime import date
from types import SimpleNamespace

from app.services.importers.patient_match import (
    MAX_PATIENT_WARNINGS,
    compare_patient,
)


def _bundle(given, family, birth="1980-04-12", gender="female"):
    return {
        "entry": [
            {
                "resource": {
                    "resourceType": "Patient",
                    "name": [{"given": given, "family": family}],
                    "birthDate": birth,
                    "gender": gender,
                }
            }
        ]
    }


def _patient(first="Jane", last="Sampleton", birth=date(1980, 4, 12)):
    return SimpleNamespace(first_name=first, last_name=last, birth_date=birth)


class TestComparePatient:
    """Test compare_patient."""

    def test_match_has_no_warnings(self):
        """Test that a matching name and birth date produces no warnings."""
        match = compare_patient(_bundle(["Jane"], "Sampleton"), _patient())
        assert match.full_name == "Jane Sampleton"
        assert match.birth_date == date(1980, 4, 12)
        assert match.gender == "female"
        assert match.warnings == []

    def test_middle_name_and_case_are_tolerated(self):
        """Test that a middle name in the file and different casing still match."""
        match = compare_patient(
            _bundle(["JANE", "Quinn"], "SAMPLETON"), _patient("jane", "sampleton")
        )
        assert match.warnings == []

    def test_name_mismatch_warns(self):
        """Test that a different family name produces one name warning."""
        match = compare_patient(_bundle(["Jane"], "Other"), _patient())
        assert len(match.warnings) == 1
        assert "Jane Other" in match.warnings[0]

    def test_birth_date_mismatch_warns(self):
        """Test that a different birth date produces one date warning."""
        match = compare_patient(
            _bundle(["Jane"], "Sampleton", birth="1981-01-01"), _patient()
        )
        assert len(match.warnings) == 1
        assert "1981-01-01" in match.warnings[0]

    def test_every_patient_in_the_file_is_compared(self):
        """Test that a second Patient resource that differs from the selection warns."""
        bundle = _bundle(["Jane"], "Sampleton")
        bundle["entry"].append(_bundle(["Robin"], "Sampleton")["entry"][0])
        match = compare_patient(bundle, _patient())
        assert match.full_name == "Jane Sampleton"
        assert match.warnings == [
            "The file is for Robin Sampleton but the selected patient is Jane Sampleton."
        ]

    def test_same_patient_twice_warns_once(self):
        """Test that two records of one mismatching patient give one warning."""
        bundle = _bundle(["Robin"], "Sampleton")
        bundle["entry"].append(_bundle(["Robin"], "Sampleton")["entry"][0])
        assert len(compare_patient(bundle, _patient()).warnings) == 1

    def test_many_different_patients_are_compared_in_linear_time(self):
        """Test that tens of thousands of distinct mismatches do not cost quadratic time."""
        bundle = {"entry": []}
        for i in range(40_000):
            bundle["entry"].append(_bundle([f"Robin{i}"], "Sampleton")["entry"][0])
        start = time.monotonic()
        match = compare_patient(bundle, _patient())
        assert time.monotonic() - start < 5.0
        assert len(match.warnings) == MAX_PATIENT_WARNINGS + 1
        assert match.warnings[0].startswith("The file is for Robin0 Sampleton")
        assert match.warnings[-1] == (
            f"{40_000 - MAX_PATIENT_WARNINGS} more patient warnings not shown"
        )

    def test_patient_with_nothing_to_compare_warns(self):
        """Test that a Patient record with no usable name or birth date is reported."""
        bundle = _bundle(["Jane"], "Sampleton")
        bundle["entry"].append({"resource": {"resourceType": "Patient", "id": "p2"}})
        bundle["entry"].append(
            {"resource": {"resourceType": "Patient", "name": "x", "birthDate": "soon"}}
        )
        match = compare_patient(bundle, _patient())
        assert match.full_name == "Jane Sampleton"
        assert match.warnings == [
            "The file has a patient record without a usable name or birth date, "
            "so it could not be checked against the selected patient."
        ]

    def test_name_given_only_as_text_is_reported_as_not_usable(self):
        """Test that a name with no given or family part is not compared, and the warning says so."""
        bundle = {
            "entry": [
                {
                    "resource": {
                        "resourceType": "Patient",
                        "name": [{"text": "Robin Other"}],
                        "birthDate": "1975",
                    }
                }
            ]
        }
        warnings = compare_patient(bundle, _patient()).warnings
        assert len(warnings) == 1
        assert "without a usable name or birth date" in warnings[0]

    def test_one_warning_past_the_cap_is_counted_in_the_singular(self):
        """Test the count line when exactly one warning is hidden."""
        bundle = {"entry": []}
        for i in range(MAX_PATIENT_WARNINGS + 1):
            bundle["entry"].append(_bundle([f"Robin{i}"], "Sampleton")["entry"][0])
        warnings = compare_patient(bundle, _patient()).warnings
        assert warnings[-1] == "1 more patient warning not shown"

    def test_exactly_the_cap_of_warnings_adds_no_count_line(self):
        """Test that MAX_PATIENT_WARNINGS distinct warnings are all shown as they are."""
        bundle = {"entry": []}
        for i in range(MAX_PATIENT_WARNINGS):
            bundle["entry"].append(_bundle([f"Robin{i}"], "Sampleton")["entry"][0])
        warnings = compare_patient(bundle, _patient()).warnings
        assert len(warnings) == MAX_PATIENT_WARNINGS
        assert all(w.startswith("The file is for") for w in warnings)

    def test_only_patient_with_nothing_to_compare_warns(self):
        """Test that a lone Patient record without demographics is also reported."""
        bundle = {"entry": [{"resource": {"resourceType": "Patient", "id": "p1"}}]}
        match = compare_patient(bundle, _patient())
        assert not match.found
        assert len(match.warnings) == 1
        assert "could not be checked" in match.warnings[0]

    def test_patient_with_only_a_birth_date_is_compared(self):
        """Test that a birth date alone is enough to check and gives no extra warning."""
        bundle = {
            "entry": [
                {"resource": {"resourceType": "Patient", "birthDate": "1980-04-12"}}
            ]
        }
        assert compare_patient(bundle, _patient()).warnings == []

    def test_bundle_without_patient(self):
        """Test that a bundle with no Patient resource yields an empty match."""
        match = compare_patient({"entry": []}, _patient())
        assert not match.found
        assert match.warnings == []

    def test_name_in_wrong_shape_is_skipped(self):
        """Test that a string name, a non-object entry or a string given list is ignored."""
        for name in ["Alex", ["Alex"], [{"given": "Alex", "family": "Testperson"}]]:
            bundle = _bundle(["Jane"], "Sampleton")
            bundle["entry"][0]["resource"]["name"] = name
            match = compare_patient(bundle, _patient())
            assert match.found
            assert match.full_name in (None, "Testperson")
            assert all("birth" not in w for w in match.warnings)

    def test_fields_in_wrong_type_are_ignored(self):
        """Test that non-string demographics are treated as absent, without a crash."""
        bundle = _bundle(["Jane"], "Sampleton", birth=123, gender={})
        bundle["entry"][0]["resource"]["name"] = [
            {"given": [7, "Jane"], "family": ["x"], "text": 5}
        ]
        match = compare_patient(bundle, _patient())
        assert match.full_name == "Jane"
        assert match.birth_date is None
        assert match.gender is None
        assert match.warnings == []
