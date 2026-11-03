"""Tests for the patient match check on uploaded bundles."""

from datetime import date
from types import SimpleNamespace

from app.services.importers.patient_match import compare_patient


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
