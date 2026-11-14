"""Tests for the patient match check on uploaded bundles."""

import copy
import time
from datetime import date
from types import SimpleNamespace

import pytest

from app.services.importers import ImportFormatError
from app.services.importers.patient_match import (
    MAX_PATIENT_WARNINGS,
    NO_MATCHING_PATIENT_MESSAGE,
    SAME_ID_MESSAGE,
    birth_date_text,
    birth_dates_compatible,
    compare_patient,
    more_exact_birth_date,
    read_birth_date,
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


def _person(key, given, family, birth, records=2, by="subject"):
    """Entries for one person: a Patient with an id and conditions that point at it."""
    patient = {
        "resourceType": "Patient",
        "id": key,
        "name": [{"given": [given], "family": family}],
    }
    if birth:
        patient["birthDate"] = birth
    entries = [{"resource": patient}]
    for i in range(records):
        entries.append(
            {
                "resource": {
                    "resourceType": "Condition",
                    "id": f"{key}-c{i}",
                    by: {"reference": f"Patient/{key}"},
                }
            }
        )
    return entries


def _record(key, reference, by="subject", resource_type="Condition"):
    """An entry for one record whose patient field holds the given value."""
    return {"resource": {"resourceType": resource_type, "id": key, by: reference}}


def _left_out(count, birth="1975-01-01", name="Robin Sampleton"):
    noun = "record" if count == 1 else "records"
    return (
        f"Left out {count} {noun} for {name}, whose birth date {birth} "
        "differs from the selected patient's 1980-04-12."
    )


def _unidentified(count):
    noun = "record" if count == 1 else "records"
    return f"Left out {count} {noun} whose patient could not be identified in the file."


def _ids(bundle):
    return [e["resource"]["id"] for e in bundle["entry"]]


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

    def test_birth_date_given_as_a_year_warns_when_the_year_differs(self):
        """Test that a file about one person born in another year gets the date warning."""
        match = compare_patient(
            _bundle(["Jane"], "Sampleton", birth="1975"), _patient()
        )
        assert match.birth_date is None
        assert match.warnings == [
            "The file's birth date 1975 differs from the selected patient's "
            "1980-04-12."
        ]

    @pytest.mark.parametrize("birth", ["1980", "1980-04", " 1980-04-12T08:30:00Z"])
    def test_birth_date_that_agrees_as_far_as_it_goes_does_not_warn(self, birth):
        """Test that a year or year and month that fits the selected patient is no difference."""
        match = compare_patient(_bundle(["Jane"], "Sampleton", birth=birth), _patient())
        assert match.warnings == []

    def test_partial_birth_date_alone_is_enough_to_compare(self):
        """Test that a Patient with only a year is checked, not reported as uncheckable."""
        bundle = {
            "entry": [{"resource": {"resourceType": "Patient", "birthDate": "1975"}}]
        }
        assert compare_patient(bundle, _patient()).warnings == [
            "The file's birth date 1975 differs from the selected patient's "
            "1980-04-12."
        ]

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
                        "birthDate": "1975-13",
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


class TestBirthDateParts:
    """Test the comparison of birth dates given to different precision."""

    @pytest.mark.parametrize(
        "first, second",
        [
            (None, None),
            (None, (1975,)),
            ((1975,), (1975,)),
            ((1975,), (1975, 1)),
            ((1975,), (1975, 1, 1)),
            ((1975, 1), (1975, 1, 1)),
            ((1975, 1, 1), (1975, 1, 1)),
        ],
    )
    def test_birth_dates_that_can_be_one_persons(self, first, second):
        """Test that a missing value or a leading part of the other is compatible, either way round."""
        assert birth_dates_compatible(first, second)
        assert birth_dates_compatible(second, first)

    @pytest.mark.parametrize(
        "first, second",
        [
            ((1975,), (1960,)),
            ((1975,), (1960, 1, 1)),
            ((1975, 1), (1975, 2)),
            ((1975, 1), (1975, 2, 1)),
            ((1975, 1, 1), (1975, 1, 2)),
        ],
    )
    def test_birth_dates_that_differ_in_a_part_both_give(self, first, second):
        """Test that a difference in the year, month or day is not compatible, either way round."""
        assert not birth_dates_compatible(first, second)
        assert not birth_dates_compatible(second, first)

    @pytest.mark.parametrize(
        "first, second, expected",
        [
            (None, None, None),
            (None, (1975,), (1975,)),
            ((1975,), None, (1975,)),
            ((1975,), (1975, 1), (1975, 1)),
            ((1975, 1), (1975,), (1975, 1)),
            ((1975, 1), (1975, 1, 1), (1975, 1, 1)),
            ((1975, 1, 1), (1975,), (1975, 1, 1)),
            ((1975, 1, 1), (1975, 1, 1), (1975, 1, 1)),
        ],
    )
    def test_more_exact_birth_date_is_the_one_with_more_parts(
        self, first, second, expected
    ):
        """Test that the longer value is given whichever side it is on, and a value over none."""
        assert more_exact_birth_date(first, second) == expected

    def test_most_exact_value_of_a_run_catches_what_the_last_value_would_not(self):
        """Test that 1975-01, 1975, 1975-02 is caught by keeping 1975-01 over the later 1975."""
        known = more_exact_birth_date((1975, 1), (1975,))
        assert known == (1975, 1)
        assert birth_dates_compatible((1975,), (1975, 2))
        assert not birth_dates_compatible(known, (1975, 2))

    @pytest.mark.parametrize(
        "parts, text",
        [
            ((1975,), "1975"),
            ((1975, 1), "1975-01"),
            ((1975, 1, 1), "1975-01-01"),
            ((975, 12, 31), "0975-12-31"),
        ],
    )
    def test_birth_date_text_has_the_precision_of_the_parts(self, parts, text):
        """Test that the FHIR text is zero-padded and reads back as the same parts."""
        assert birth_date_text(parts) == text
        assert read_birth_date(text) == parts


class TestOtherPeopleInTheFile:
    """Test which records are kept when a file holds more than one person."""

    JANE = ("jane", "Jane", "Sampleton", "1980-04-12")
    ROBIN = ("robin", "Robin", "Sampleton", "1975-01-01")

    def test_person_with_another_birth_date_is_left_out(self):
        """Test that records of a person born on another day are dropped and counted."""
        bundle = {"entry": [*_person(*self.JANE), *_person(*self.ROBIN)]}
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "jane-c0", "jane-c1"]
        assert match.warnings == [
            "Left out 2 records for Robin Sampleton, whose birth date 1975-01-01 "
            "differs from the selected patient's 1980-04-12."
        ]

    def test_the_upload_is_not_changed(self):
        """Test that leaving records out builds a new bundle and keeps the input whole."""
        bundle = {"entry": [*_person(*self.JANE), *_person(*self.ROBIN)], "type": "x"}
        before = copy.deepcopy(bundle)
        match = compare_patient(bundle, _patient())
        assert bundle == before
        assert match.bundle is not bundle
        assert match.bundle["type"] == "x"

    def test_summary_comes_from_the_first_person_kept(self):
        """Test that a left-out person listed first does not become the file's patient."""
        bundle = {"entry": [*_person(*self.ROBIN), *_person(*self.JANE)]}
        match = compare_patient(bundle, _patient())
        assert match.full_name == "Jane Sampleton"
        assert match.birth_date == date(1980, 4, 12)

    def test_summary_gender_comes_from_the_first_person_kept(self):
        """Test that the gender shown is the kept person's, not that of a left-out person listed first."""
        robin, jane = _person(*self.ROBIN), _person(*self.JANE)
        robin[0]["resource"]["gender"] = "male"
        jane[0]["resource"]["gender"] = "female"
        match = compare_patient({"entry": [*robin, *jane]}, _patient())
        assert match.gender == "female"

    def test_same_birth_date_and_another_name_is_kept_with_a_warning(self):
        """Test that a name difference alone leaves the choice to the user."""
        bundle = {
            "entry": [
                *_person(*self.JANE),
                *_person("j2", "Janet", "Married", "1980-04-12"),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert match.bundle is bundle
        assert match.warnings == [
            "The file is for Janet Married but the selected patient is Jane Sampleton."
        ]

    def test_person_without_a_birth_date_is_kept_and_compared_by_name(self):
        """Test that a person with no birth date is kept, with only the name warning."""
        bundle = {
            "entry": [
                *_person(*self.JANE),
                *_person("x", "Robin", "Sampleton", None),
                *_person(*self.ROBIN),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "jane-c0", "jane-c1", "x", "x-c0", "x-c1"]
        assert match.warnings == [
            _left_out(2),
            "The file is for Robin Sampleton but the selected patient is Jane Sampleton.",
        ]

    def test_person_without_a_birth_date_and_the_same_name_gets_no_warning(self):
        """Test that a missing birth date alone is not warned about when the name matches."""
        bundle = {
            "entry": [
                *_person(*self.JANE),
                *_person("x", "Jane", "Sampleton", None),
                *_person(*self.ROBIN),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "jane-c0", "jane-c1", "x", "x-c0", "x-c1"]
        assert match.warnings == [_left_out(2)]

    def test_nobody_is_left_out_without_a_person_with_the_birth_date(self):
        """Test that a person with no birth date is not enough to leave another person out."""
        bundle = {
            "entry": [
                *_person("x", "Jane", "Sampleton", None),
                *_person(*self.ROBIN),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert match.bundle is bundle
        assert match.warnings == [
            "The file is for Robin Sampleton but the selected patient is Jane Sampleton.",
            "The file's birth date 1975-01-01 differs from the selected patient's "
            "1980-04-12.",
        ]

    @pytest.mark.parametrize("birth", ["1975", "1975-01", "1980-05", "1981-04"])
    def test_person_with_a_differing_partial_birth_date_is_left_out(self, birth):
        """Test that a year or year and month that cannot be the selected patient's leaves the person out."""
        bundle = {
            "entry": [
                *_person(*self.JANE),
                *_person("robin", "Robin", "Sampleton", birth),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "jane-c0", "jane-c1"]
        # The line shows the birth date as the file gives it
        assert match.warnings == [_left_out(2, birth=birth)]

    @pytest.mark.parametrize("birth", ["1980", "1980-04"])
    def test_person_with_a_consistent_partial_birth_date_is_kept(self, birth):
        """Test that a year or year and month that fits is neither a match nor a difference."""
        bundle = {
            "entry": [
                *_person("x", "Jane", "Sampleton", birth),
                *_person(*self.JANE),
                *_person(*self.ROBIN),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["x", "x-c0", "x-c1", "jane", "jane-c0", "jane-c1"]
        assert match.birth_date is None
        assert match.warnings == [_left_out(2)]

    def test_consistent_partial_birth_date_is_not_enough_to_leave_anyone_out(self):
        """Test that a person known only by the right year does not count as the selected patient."""
        bundle = {
            "entry": [
                *_person("x", "Jane", "Sampleton", "1980"),
                *_person(*self.ROBIN),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert match.bundle is bundle
        assert match.warnings == [
            "The file is for Robin Sampleton but the selected patient is Jane Sampleton.",
            "The file's birth date 1975-01-01 differs from the selected patient's "
            "1980-04-12.",
        ]

    @pytest.mark.parametrize(
        "birth", ["1960-W01-1", "19600202", "1960-2-2", "1960-02-30", "1960-033"]
    )
    def test_date_in_another_form_or_out_of_range_is_not_read(self, birth):
        """Test that only YYYY-MM-DD is read as a full date, not a week, ordinal or basic date."""
        assert read_birth_date(birth) is None

    @pytest.mark.parametrize(
        "birth", ["１９６０", "１９６０-０２", "１９６０-０２-０２"]
    )
    def test_date_in_full_width_digits_is_not_read(self, birth):
        """Test that only ASCII digits are read, not other digits that Unicode counts as decimal."""
        assert read_birth_date(birth) is None

    @pytest.mark.parametrize(
        "birth, parts",
        [
            ("1980-04-12", (1980, 4, 12)),
            ("1980-04-12T10:00:00Z", (1980, 4, 12)),
            (" 1980-04-12 ", (1980, 4, 12)),
            ("1980-04", (1980, 4)),
            ("1980", (1980,)),
        ],
    )
    def test_date_is_read_as_far_as_it_is_given(self, birth, parts):
        """Test the forms that are read, a dateTime by its first ten characters."""
        assert read_birth_date(birth) == parts

    @pytest.mark.parametrize("birth", ["1960-W01-1", "19600202"])
    def test_person_with_a_week_or_basic_birth_date_is_not_left_out(self, birth):
        """Test that a date the file does not give is not made up and compared."""
        bundle = {
            "entry": [
                *_person(*self.JANE),
                *_person("x", "Jane", "Sampleton", birth),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert match.bundle is bundle
        assert match.warnings == []
        assert not any("1960-01-04" in w or "1960-02-02" in w for w in match.warnings)

    @pytest.mark.parametrize(
        "birth",
        ["1975-13", "1975-00", "0000", "197", "19-5", "+975", "1975-1", "soon", 1975],
    )
    def test_invalid_partial_birth_date_is_not_read(self, birth):
        """Test that a value that is no year or year and month leaves nobody out and warns of no date."""
        bundle = {
            "entry": [
                *_person(*self.JANE),
                *_person("x", "Jane", "Sampleton", birth),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert match.bundle is bundle
        assert match.warnings == []

    @pytest.mark.parametrize(
        "births",
        [
            ("1975", "1960"),
            ("1975-01", "1975-02"),
            ("1975-01", "1975-02-02"),
            ("1975", "1975-01-01", "1975-02"),
        ],
    )
    def test_partial_birth_dates_of_several_people_are_rejected(self, births):
        """Test that birth dates that cannot be one person's are refused when nobody matches."""
        entries = []
        for i, birth in enumerate(births):
            entries.extend(_person(f"p{i}", "Robin", "Sampleton", birth))
        with pytest.raises(ImportFormatError) as raised:
            compare_patient({"entry": entries}, _patient())
        assert str(raised.value) == NO_MATCHING_PATIENT_MESSAGE

    def test_partial_and_full_birth_date_of_one_other_person_are_kept(self):
        """Test that a year and a full date within it count as one person, kept with warnings."""
        bundle = {
            "entry": [
                *_person("r1", "Robin", "Sampleton", "1975"),
                *_person(*self.ROBIN),
                *_person("r3", "Robin", "Sampleton", "1975-01"),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert match.bundle is bundle
        own = "differs from the selected patient's 1980-04-12."
        assert match.warnings == [
            "The file is for Robin Sampleton but the selected patient is Jane Sampleton.",
            f"The file's birth date 1975 {own}",
            f"The file's birth date 1975-01-01 {own}",
            f"The file's birth date 1975-01 {own}",
        ]

    def test_many_distinct_birth_dates_are_compared_in_linear_time(self):
        """Test that telling one person from several does not compare every pair of dates."""
        entries = []
        for i in range(30_000):
            birth = f"{1000 + i % 9000}-{1 + i % 12:02d}"
            entries.extend(_person(f"p{i}", "Robin", "Sampleton", birth, records=0))
        start = time.monotonic()
        with pytest.raises(ImportFormatError):
            compare_patient({"entry": entries}, _patient())
        assert time.monotonic() - start < 5.0

    def test_unknown_birth_date_and_two_other_people_is_rejected(self):
        """Test that two other birth dates are refused when nobody has the selected one."""
        bundle = {
            "entry": [
                *_person("x", "Jane", "Sampleton", None),
                *_person(*self.ROBIN),
                *_person("sam", "Sam", "Other", "1960-06-30"),
            ]
        }
        with pytest.raises(ImportFormatError) as raised:
            compare_patient(bundle, _patient())
        assert str(raised.value) == NO_MATCHING_PATIENT_MESSAGE

    def test_file_about_one_other_person_is_kept_with_warnings(self):
        """Test that a file whose only person has another birth date still imports."""
        bundle = {"entry": _person(*self.ROBIN)}
        match = compare_patient(bundle, _patient())
        assert match.bundle is bundle
        assert len(match.warnings) == 2
        assert "1975-01-01" in match.warnings[1]

    def test_two_records_of_one_other_person_are_kept_with_warnings(self):
        """Test that two Patient records sharing one birth date count as one person."""
        bundle = {
            "entry": [
                *_person(*self.ROBIN),
                *_person("r2", "Robin", "Sampleton", "1975-01-01"),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert match.bundle is bundle
        assert len(match.warnings) == 2

    def test_several_people_and_none_with_the_birth_date_is_rejected(self):
        """Test that a file of other people only is refused instead of guessed at."""
        bundle = {
            "entry": [
                *_person(*self.ROBIN),
                *_person("sam", "Sam", "Other", "1960-06-30"),
            ]
        }
        with pytest.raises(ImportFormatError) as raised:
            compare_patient(bundle, _patient())
        assert str(raised.value) == NO_MATCHING_PATIENT_MESSAGE

    def test_two_records_of_a_left_out_person_are_counted_together(self):
        """Test that one person's two Patient records give one line with the total."""
        bundle = {
            "entry": [
                *_person(*self.JANE),
                *_person(*self.ROBIN, records=1),
                *_person("r2", "Robin", "Sampleton", "1975-01-01", records=0),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "jane-c0", "jane-c1"]
        assert match.warnings == [
            "Left out 1 record for Robin Sampleton, whose birth date 1975-01-01 "
            "differs from the selected patient's 1980-04-12."
        ]

    def test_left_out_person_without_a_name(self):
        """Test the wording when the person left out has no usable name."""
        entries = _person(*self.ROBIN)
        del entries[0]["resource"]["name"]
        match = compare_patient({"entry": [*_person(*self.JANE), *entries]}, _patient())
        assert match.warnings == [
            "Left out 2 records for a patient with no name, whose birth date "
            "1975-01-01 differs from the selected patient's 1980-04-12."
        ]

    def test_references_by_patient_field_and_full_url_are_followed(self):
        """Test the reference forms a record can use to point at its patient."""
        robin = _person(*self.ROBIN, records=1, by="patient")
        robin[0]["fullUrl"] = "urn:uuid:0000-robin"
        robin.append(
            {
                "resource": {
                    "resourceType": "Condition",
                    "id": "by-url",
                    "subject": {"reference": "urn:uuid:0000-robin"},
                }
            }
        )
        robin.append(
            {
                "resource": {
                    "resourceType": "Provenance",
                    "id": "robin-document",
                    "target": [
                        {"reference": "Organization/org"},
                        {"reference": "Patient/robin"},
                    ],
                }
            }
        )
        shared = {"resource": {"resourceType": "Organization", "id": "org"}}
        own = {
            "resource": {
                "resourceType": "Provenance",
                "id": "jane-document",
                "target": [{"reference": "Patient/jane"}],
            }
        }
        dangling = {
            "resource": {
                "resourceType": "Condition",
                "id": "dangling",
                "subject": {"reference": "Patient/nobody"},
            }
        }
        odd = {"resource": {"resourceType": "Condition", "id": "odd", "subject": "x"}}
        bundle = {"entry": [*_person(*self.JANE), *robin, shared, own, dangling, odd]}
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == [
            "jane",
            "jane-c0",
            "jane-c1",
            "org",
            "jane-document",
        ]
        # The dangling and the malformed subject name nobody in the file
        assert match.warnings == [_unidentified(2), _left_out(3)]

    def test_reference_to_a_full_url_that_names_no_id_is_followed(self):
        """Test that a record is given to the Patient whose exact fullUrl it names, when no Patient id can be read from it."""
        jane = _person(*self.JANE, records=0)
        robin = _person(*self.ROBIN, records=0)
        jane[0]["fullUrl"] = "https://example.org/people/1"
        robin[0]["fullUrl"] = "https://example.org/people/2"
        bundle = {
            "entry": [
                *jane,
                *robin,
                _record("own", {"reference": "https://example.org/people/1"}),
                _record("theirs", {"reference": "https://example.org/people/2"}),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "own"]
        assert match.warnings == [_left_out(1)]
        assert not any("could not be identified" in w for w in match.warnings)

    @pytest.mark.parametrize(
        "full_url, reference",
        [
            (" urn:uuid:AA ", "urn:uuid:AA"),
            ("urn:uuid:AA", " urn:uuid:AA "),
            ("\turn:uuid:AA\n", " urn:uuid:AA"),
            (" https://ehr.example/fhir/Patient/AA ", "Patient/AA"),
        ],
    )
    def test_full_url_and_reference_are_matched_without_their_padding(
        self, full_url, reference
    ):
        """Test that spaces around a fullUrl or a reference do not hide the kept patient."""
        jane = _person(*self.JANE, records=0)
        jane[0]["fullUrl"] = full_url
        bundle = {
            "entry": [
                *jane,
                *_person(*self.ROBIN, records=0),
                _record("padded", {"reference": reference}),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "padded"]
        assert match.warnings == [_left_out(0)]

    def test_padded_full_url_of_another_resource_is_not_followed(self):
        """Test that a padded fullUrl of a Condition still stops the lookup by id."""
        jane = _person(*self.JANE, records=0)
        jane[0]["resource"]["id"] = "5"
        other = _record("other", {"reference": "Patient/5"})
        other["fullUrl"] = " urn:uuid:5 "
        bundle = {
            "entry": [
                *jane,
                *_person(*self.ROBIN, records=0),
                other,
                _record("unclear", {"reference": "urn:uuid:5"}),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["5", "other"]
        assert match.warnings == [_unidentified(1), _left_out(0)]

    def test_people_under_one_full_url_but_for_padding_are_rejected(self):
        """Test that a padded fullUrl is the same name as the unpadded one."""
        jane = _person(*self.JANE)
        robin = _person(*self.ROBIN)
        jane[0]["fullUrl"] = "urn:uuid:same"
        robin[0]["fullUrl"] = " urn:uuid:same "
        with pytest.raises(ImportFormatError) as raised:
            compare_patient({"entry": [*jane, *robin]}, _patient())
        assert str(raised.value) == SAME_ID_MESSAGE

    @pytest.mark.parametrize("order", [("robin", "jane"), ("jane", "robin")])
    def test_two_people_under_one_patient_id_are_rejected(self, order):
        """Test that a file is refused when a kept and a left-out Patient share an id."""
        people = {"robin": ("Robin", "1975-01-01"), "jane": ("Jane", "1980-04-12")}
        entries = []
        for who in order:
            given, birth = people[who]
            person = _person("1", given, "Sampleton", birth, records=1)
            person[1]["resource"]["id"] = f"{who}-c0"
            entries.extend(person)
        with pytest.raises(ImportFormatError) as raised:
            compare_patient({"entry": entries}, _patient())
        assert str(raised.value) == SAME_ID_MESSAGE

    def test_two_people_under_one_full_url_are_rejected(self):
        """Test that a file is refused when a kept and a left-out Patient share a fullUrl."""
        jane, robin = _person(*self.JANE), _person(*self.ROBIN)
        jane[0]["fullUrl"] = robin[0]["fullUrl"] = "urn:uuid:0000-shared"
        with pytest.raises(ImportFormatError) as raised:
            compare_patient({"entry": [*jane, *robin]}, _patient())
        assert str(raised.value) == SAME_ID_MESSAGE

    @pytest.mark.parametrize("order", [("jane", "robin"), ("robin", "jane")])
    def test_two_people_under_one_full_url_that_names_no_id_are_rejected(self, order):
        """Test that a shared fullUrl is refused by itself, when no Patient id can be read from it."""
        people = {
            "jane": _person(*self.JANE, records=1),
            "robin": _person(*self.ROBIN, records=1),
        }
        entries = []
        for who in order:
            people[who][0]["fullUrl"] = "https://example.org/people/1"
            entries.extend(people[who])
        with pytest.raises(ImportFormatError) as raised:
            compare_patient({"entry": entries}, _patient())
        assert str(raised.value) == SAME_ID_MESSAGE

    def test_full_url_of_one_person_naming_the_id_of_another_is_rejected(self):
        """Test that a left-out Patient whose fullUrl ends in a kept Patient's id is refused."""
        robin = _person(*self.ROBIN, records=0)
        del robin[0]["resource"]["id"]
        robin[0]["fullUrl"] = "https://example.org/fhir/Patient/jane"
        with pytest.raises(ImportFormatError) as raised:
            compare_patient({"entry": [*_person(*self.JANE), *robin]}, _patient())
        assert str(raised.value) == SAME_ID_MESSAGE

    def test_same_id_among_the_people_kept_is_not_rejected(self):
        """Test that two Patient records with one id and the same birth date still import."""
        bundle = {"entry": [*_person(*self.JANE), *_person(*self.JANE)]}
        match = compare_patient(bundle, _patient())
        assert match.bundle is bundle
        assert match.warnings == []

    def test_patient_ids_are_matched_as_integers_and_without_their_padding(self):
        """Test that a Patient id given as an integer or with spaces around it is still referenced."""
        jane = _person(7, "Jane", "Sampleton", "1980-04-12", records=0)
        robin = _person(" 8 ", "Robin", "Sampleton", "1975-01-01", records=0)
        bundle = {
            "entry": [
                *jane,
                *robin,
                _record("c7", {"reference": "Patient/7"}),
                _record("c8", {"reference": "Patient/8"}),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == [7, "c7"]
        assert match.warnings == [_left_out(1)]

    def test_record_for_a_patient_without_an_id_is_left_out_as_unidentified(self):
        """Test that a record is not kept when the Patient it names cannot be found."""
        robin = _person(*self.ROBIN, records=1)
        del robin[0]["resource"]["id"]
        bundle = {"entry": [*_person(*self.JANE), *robin]}
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "jane-c0", "jane-c1"]
        assert match.warnings == [_unidentified(1), _left_out(0)]

    def test_relative_reference_is_resolved_against_an_absolute_full_url(self):
        """Test that Patient/<id> finds a Patient known only by a fullUrl ending in that id."""
        robin = _person(*self.ROBIN, records=1)
        del robin[0]["resource"]["id"]
        robin[0]["fullUrl"] = "https://example.org/fhir/Patient/robin"
        bundle = {"entry": [*_person(*self.JANE), *robin]}
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "jane-c0", "jane-c1"]
        assert match.warnings == [_left_out(1)]

    @pytest.mark.parametrize(
        "reference",
        [
            "Patient/robin",
            " Patient/robin ",
            "Patient/robin/_history/2",
            "https://example.org/fhir/Patient/robin",
            "https://example.org/fhir/Patient/robin/_history/2",
            "urn:uuid:robin",
            "urn:oid:robin",
        ],
    )
    def test_reference_forms_that_name_a_patient(self, reference):
        """Test that each way to write a reference to a left-out Patient is followed."""
        bundle = {
            "entry": [
                *_person(*self.JANE),
                *_person(*self.ROBIN, records=0),
                _record("by-subject", {"reference": reference}),
                _record("by-patient", {"reference": reference}, by="patient"),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "jane-c0", "jane-c1"]
        assert match.warnings == [_left_out(2)]

    @pytest.mark.parametrize(
        "reference",
        [
            "Patient/jane/_history/2",
            "https://example.org/fhir/Patient/jane",
            "urn:uuid:jane",
            "urn:uuid:0000-jane",
        ],
    )
    def test_reference_forms_that_name_a_kept_patient(self, reference):
        """Test that a record pointing at a kept Patient in any form stays."""
        jane = _person(*self.JANE, records=0)
        jane[0]["fullUrl"] = "urn:uuid:0000-jane"
        bundle = {
            "entry": [
                *jane,
                *_person(*self.ROBIN, records=0),
                _record("own", {"reference": reference}),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "own"]
        assert match.warnings == [_left_out(0)]

    @pytest.mark.parametrize(
        "subject",
        [
            {"identifier": {"value": "MRN-1"}, "display": "Robin Sampleton"},
            {"reference": "Group/robin"},
            {"reference": "Patient/robin/extra"},
            {"reference": "Condition/Patient/robin"},
            {"reference": "#robin"},
            {"reference": "robin"},
            {"reference": 5},
            "Patient/robin",
            [{"reference": "Patient/robin"}],
        ],
    )
    def test_subject_that_names_no_patient_is_left_out_as_unidentified(self, subject):
        """Test that a subject of another type or shape is not read as a Patient reference."""
        bundle = {
            "entry": [
                *_person(*self.JANE),
                *_person(*self.ROBIN, records=0),
                _record("unclear", subject),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "jane-c0", "jane-c1"]
        assert match.warnings == [_unidentified(1), _left_out(0)]

    def test_unidentified_records_are_counted_in_one_line(self):
        """Test the plural of the line for records whose patient is not in the file."""
        bundle = {
            "entry": [
                *_person(*self.JANE),
                *_person(*self.ROBIN),
                _record("a", {"reference": "Patient/nobody"}),
                _record("b", {"display": "someone"}, by="patient"),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "jane-c0", "jane-c1"]
        assert match.warnings == [_unidentified(2), _left_out(2)]

    def test_records_about_no_patient_are_kept(self):
        """Test that shared records, with no subject or a null one, stay in the bundle."""
        shared = [
            {"resource": {"resourceType": "Organization", "id": "org"}},
            {"resource": {"resourceType": "Medication", "id": "med"}},
            _record("empty", None, resource_type="Practitioner"),
            _record("blank", None, by="patient", resource_type="Location"),
        ]
        bundle = {"entry": [*_person(*self.JANE), *shared, *_person(*self.ROBIN)]}
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == [
            "jane",
            "jane-c0",
            "jane-c1",
            "org",
            "med",
            "empty",
            "blank",
        ]
        assert match.warnings == [_left_out(2)]

    @pytest.mark.parametrize("by", ["subject", "patient"])
    @pytest.mark.parametrize("value", [{}, "", 0, [], False])
    def test_empty_patient_field_is_left_out_as_unidentified(self, value, by):
        """Test that a field present with an empty value is not read as no patient at all."""
        bundle = {
            "entry": [
                *_person(*self.JANE),
                *_person(*self.ROBIN, records=0),
                _record("unclear", value, by=by),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "jane-c0", "jane-c1"]
        assert match.warnings == [_unidentified(1), _left_out(0)]

    @pytest.mark.parametrize(
        "fields",
        [{}, {"subject": None}, {"patient": None}, {"subject": None, "patient": None}],
    )
    def test_record_with_no_patient_field_or_a_null_one_is_kept(self, fields):
        """Test that a record is shared when neither field is present or its value is null."""
        record = {"resource": {"resourceType": "Location", "id": "shared", **fields}}
        bundle = {
            "entry": [
                *_person(*self.JANE),
                *_person(*self.ROBIN, records=0),
                record,
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "jane-c0", "jane-c1", "shared"]
        assert match.warnings == [_left_out(0)]

    def test_null_field_next_to_a_reference_does_not_make_the_record_shared(self):
        """Test that the field that is set decides when the other one is null."""
        record = _record("unclear", {"display": "someone"}, by="patient")
        record["resource"]["subject"] = None
        bundle = {
            "entry": [
                *_person(*self.JANE),
                *_person(*self.ROBIN, records=0),
                record,
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "jane-c0", "jane-c1"]
        assert match.warnings == [_unidentified(1), _left_out(0)]

    @pytest.mark.parametrize("subject, patient", [("jane", "robin"), ("robin", "jane")])
    def test_record_naming_a_kept_and_a_left_out_patient_is_left_out(
        self, subject, patient
    ):
        """Test that a kept Patient in one field does not keep a record that names a left-out one in the other."""
        record = _record("both", {"reference": f"Patient/{subject}"})
        record["resource"]["patient"] = {"reference": f"Patient/{patient}"}
        bundle = {
            "entry": [
                *_person(*self.JANE),
                *_person(*self.ROBIN, records=0),
                record,
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "jane-c0", "jane-c1"]
        assert match.warnings == [_left_out(1)]

    @pytest.mark.parametrize(
        "nobody", [{"reference": "Patient/zz"}, {"display": "someone"}]
    )
    @pytest.mark.parametrize(
        "named, unresolved", [("patient", "subject"), ("subject", "patient")]
    )
    def test_record_naming_a_kept_patient_in_one_field_and_nobody_in_the_other_is_kept(
        self, named, unresolved, nobody
    ):
        """Test that a record is the kept patient's when either field names them and neither names a person left out."""
        record = _record("own", {"reference": "Patient/jane"}, by=named)
        record["resource"][unresolved] = nobody
        bundle = {"entry": [*_person(*self.JANE), *_person(*self.ROBIN), record]}
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "jane-c0", "jane-c1", "own"]
        assert match.warnings == [_left_out(2)]

    @pytest.mark.parametrize(
        "targets", [("jane", "robin"), ("robin", "jane"), ("jane", "robin", "jane")]
    )
    def test_provenance_targeting_a_kept_and_a_left_out_patient_is_left_out(
        self, targets
    ):
        """Test that a Provenance goes with the left-out Patient wherever a kept one stands among its targets."""
        provenance = {
            "resource": {
                "resourceType": "Provenance",
                "id": "both",
                "target": [{"reference": f"Patient/{who}"} for who in targets],
            }
        }
        bundle = {
            "entry": [
                *_person(*self.JANE),
                *_person(*self.ROBIN, records=0),
                provenance,
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "jane-c0", "jane-c1"]
        assert match.warnings == [_left_out(1)]

    def test_provenance_target_of_another_type_with_the_same_id_is_not_followed(self):
        """Test that a target Condition/5 is not taken for the left-out Patient/5."""
        provenance = {
            "resource": {
                "resourceType": "Provenance",
                "id": "jane-document",
                "target": [
                    {"reference": "Patient/jane"},
                    {"reference": "Condition/5"},
                    {"display": "a paper record"},
                ],
            }
        }
        bundle = {
            "entry": [
                *_person(*self.JANE, records=0),
                _record("5", {"reference": "Patient/jane"}),
                *_person("5", "Robin", "Sampleton", "1975-01-01", records=0),
                provenance,
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "5", "jane-document"]
        assert match.warnings == [_left_out(0)]

    def test_reference_to_the_full_url_of_another_resource_is_not_followed(self):
        """Test that urn:uuid:5 is the Condition with that fullUrl, not the left-out Patient/5."""
        condition = _record("c", {"reference": "Patient/jane"})
        condition["fullUrl"] = "urn:uuid:5"
        provenance = {
            "resource": {
                "resourceType": "Provenance",
                "id": "jane-document",
                "target": [{"reference": "urn:uuid:5"}],
            }
        }
        bundle = {
            "entry": [
                *_person(*self.JANE, records=0),
                condition,
                *_person("5", "Robin", "Sampleton", "1975-01-01", records=0),
                provenance,
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "c", "jane-document"]
        assert match.warnings == [_left_out(0)]

    def test_provenance_without_a_patient_target_is_kept(self):
        """Test that a Provenance naming no Patient is not counted as unidentified."""
        provenance = {
            "resource": {
                "resourceType": "Provenance",
                "id": "p",
                "target": [{"reference": "Organization/org"}],
            }
        }
        bundle = {"entry": [*_person(*self.JANE), *_person(*self.ROBIN), provenance]}
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "jane-c0", "jane-c1", "p"]
        assert match.warnings == [_left_out(2)]

    def test_left_out_lines_come_first_and_survive_the_cap(self):
        """Test that many name warnings cannot push the lines about what was left out past the cap."""
        entries = _person(*self.JANE)
        for i in range(25):
            entries.extend(_person(f"j{i}", f"Janet{i}", "Married", "1980-04-12"))
        entries.extend(_person(*self.ROBIN))
        entries.append(_record("lost", {"reference": "Patient/nobody"}))
        match = compare_patient({"entry": entries}, _patient())
        assert match.warnings[:2] == [_unidentified(1), _left_out(2)]
        assert match.warnings[2].startswith("The file is for Janet0 Married")
        assert len(match.warnings) == MAX_PATIENT_WARNINGS + 1
        assert match.warnings[-1] == "7 more patient warnings not shown"

    def test_unidentified_line_survives_many_people_left_out(self):
        """Test that more left-out people than the cap cannot hide the unidentified count."""
        entries = _person(*self.JANE)
        for i in range(25):
            entries.extend(_person(f"r{i}", f"Robin{i}", "Sampleton", "1975-01-01"))
        entries.append(_record("lost", {"reference": "Patient/nobody"}))
        match = compare_patient({"entry": entries}, _patient())
        assert match.warnings[0] == _unidentified(1)
        assert match.warnings[1] == _left_out(2, name="Robin0 Sampleton")
        assert len(match.warnings) == MAX_PATIENT_WARNINGS + 1
        assert match.warnings[-1] == "6 more patient warnings not shown"

    def test_many_records_are_sorted_in_linear_time(self):
        """Test that leaving people out of a large file does not cost quadratic time."""
        entries = _person(*self.JANE, records=0)
        for i in range(20_000):
            entries.extend(_person(f"r{i}", "Robin", "Sampleton", "1975-01-01"))
            entries.append(_record(f"j{i}", {"reference": "Patient/jane"}))
        start = time.monotonic()
        match = compare_patient({"entry": entries}, _patient())
        assert time.monotonic() - start < 5.0
        assert len(match.bundle["entry"]) == 20_001
        assert match.warnings == [_left_out(40_000)]

    def test_positions_give_each_kept_entry_its_place_in_the_upload(self):
        """Test that the entries kept are listed with their index in the file as uploaded."""
        bundle = {
            "entry": [
                *_person(*self.ROBIN),
                *_person(*self.JANE, records=0),
                {"resource": {"id": "bad"}},
                _record("c", {"reference": "Patient/jane"}),
            ]
        }
        match = compare_patient(bundle, _patient())
        assert _ids(match.bundle) == ["jane", "bad", "c"]
        assert match.positions == [3, 4, 5]

    def test_positions_are_not_given_when_nobody_is_left_out(self):
        """Test that a bundle passed through whole has no positions: the index is the place."""
        bundle = {"entry": [*_person(*self.JANE), {"resource": {"id": "bad"}}]}
        match = compare_patient(bundle, _patient())
        assert match.bundle is bundle
        assert match.positions is None

    def test_bundle_is_passed_through_when_nobody_is_left_out(self):
        """Test that the match carries the bundle itself in the ordinary cases."""
        for bundle in ({"entry": []}, {"entry": _person(*self.JANE)}):
            assert compare_patient(bundle, _patient()).bundle is bundle
