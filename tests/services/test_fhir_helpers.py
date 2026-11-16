"""
Tests for the small FHIR helpers shared by the mappers.
"""

import time
from datetime import date

import pytest

from app.services.importers.mappers import _fhir as f


class TestFhirHelpers:
    """Test date parsing, number coercion and the bundle index."""

    def test_date_keeps_the_source_calendar_day(self):
        """Test that a dateTime near midnight keeps the date as written, with no zone shift."""
        assert f.parse_date("2024-01-01T23:30:00-05:00") == date(2024, 1, 1)
        assert f.parse_date("2024-01-01T00:30:00+09:00") == date(2024, 1, 1)
        assert f.parse_date("2024") == date(2024, 1, 1)
        assert f.parse_date("2024-07") == date(2024, 7, 1)
        assert f.parse_date("not a date") is None

    def test_to_float(self):
        """Test numbers and numeric strings coerce and anything else is None."""
        assert f.to_float("5") == 5.0
        assert f.to_float(0.5) == 0.5
        assert f.to_float("five") is None
        assert f.to_float(None) is None
        assert f.to_float(True) is None
        assert f.to_float(float("inf")) is None

    def test_to_float_rejects_extreme_exponents(self):
        """Test that a value number_text would write as a huge string is rejected."""
        assert f.to_float("1e-999990") is None
        assert f.to_float("0e-999990") == 0.0
        assert f.to_float("1e-51") is None
        assert f.to_float("1e-50") == 1e-50
        assert f.to_float(1e-300) is None
        assert f.to_float("1e51") is None
        assert f.to_float("1e50") == 1e50
        assert f.to_float("0.00001") == 0.00001
        assert f.to_float(2400000) == 2400000.0

    def test_bundle_index_is_shared_only_inside_indexed(self):
        """Test that one index serves a bundle inside indexed() and nothing outlives it."""
        bundle = {
            "resourceType": "Bundle",
            "entry": [
                {"resource": {"resourceType": "Medication", "id": "m1"}},
                {"resource": "not a resource"},
                {"resource": {"resourceType": 7, "id": "x"}},
            ],
        }
        with f.indexed(bundle) as index:
            assert f.bundle_index(bundle) is index
            assert f.bundle_index({"entry": []}) is not index
            assert (
                f.resolve(bundle, "Medication", {"reference": "Medication/m1"})
                is bundle["entry"][0]["resource"]
            )
            assert (
                f.resolve(bundle, "Medication", {"reference": "Medication/m2"}) is None
            )
            assert list(index.resources) == [("Medication", "m1")]
        assert f._CURRENT.get() is None
        assert f.bundle_index(bundle) is not index


def _medication(name, **fields):
    return {"resourceType": "Medication", "id": "m1", "code": {"text": name}, **fields}


def _entries(*resources, urls=()):
    entries = [{"resource": resource} for resource in resources]
    for entry, url in zip(entries, urls):
        entry["fullUrl"] = url
    return {"resourceType": "Bundle", "entry": entries}


class TestAmbiguousReferences:
    """Test references to an id or fullUrl that the bundle has differing copies of."""

    ID_FORMS = (
        "Medication/m1",
        "urn:uuid:m1",
        "https://x.example/Medication/m1",
    )

    def test_differing_copies_of_an_id_do_not_resolve(self):
        """Test that no copy is picked when two resources share a type and id."""
        for copies in (
            [_medication("Lisinopril"), _medication("Metformin")],
            [_medication("Lisinopril"), _medication("Lisinopril"), _medication("X")],
            [_medication("Lisinopril"), _medication("Lisinopril", form={"text": "x"})],
        ):
            bundle = _entries(*copies)
            for form in self.ID_FORMS:
                reference = {"reference": form}
                assert f.resolve(bundle, "Medication", reference) is None, form
                index = f.BundleIndex(bundle)
                assert index.target("Medication", reference) == (None, True), form

    def test_identical_copies_resolve(self):
        """Test that copies differing only in meta resolve to the first one."""
        first = _medication("Lisinopril", meta={"source": "a.xml"})
        bundle = _entries(first, _medication("Lisinopril", meta={"source": "b.xml"}))
        for form in self.ID_FORMS:
            reference = {"reference": form}
            assert f.resolve(bundle, "Medication", reference) is first, form
            assert f.BundleIndex(bundle).target("Medication", reference) == (
                first,
                False,
            )

    def test_same_id_of_another_type_is_not_a_copy(self):
        """Test that only resources of one type and id are compared."""
        medication = _medication("Lisinopril")
        bundle = _entries({"resourceType": "Organization", "id": "m1"}, medication)
        reference = {"reference": "Medication/m1"}
        assert f.resolve(bundle, "Medication", reference) is medication

    def test_differing_copies_of_a_full_url_do_not_resolve(self):
        """Test that a fullUrl given to two differing entries names neither."""
        url = "https://a.example/fhir/Medication/m1"
        first = _medication("Lisinopril")
        first["id"] = "other"
        bundle = _entries(first, _medication("Metformin"), urls=(url, url))
        index = f.BundleIndex(bundle)
        assert index.target("Medication", {"reference": url}) == (None, True)
        assert f.resolve(bundle, "Medication", {"reference": f" {url} "}) is None
        # Each id is used once, so a reference by id still resolves
        assert f.resolve(bundle, "Medication", {"reference": "Medication/other"}) is (
            first
        )

    def test_identical_copies_of_a_full_url_resolve(self):
        """Test that a fullUrl repeated with the same content resolves to the first entry."""
        url = "urn:uuid:5b1e3a2c-0000-4000-8000-000000000001"
        first = _medication("Lisinopril", meta={"versionId": "1"})
        bundle = _entries(first, _medication("Lisinopril"), urls=(url, url))
        assert f.resolve(bundle, "Medication", {"reference": url}) is first

    def test_unique_full_url_resolves_among_differing_ids(self):
        """Test that an exact fullUrl picks its entry although the id has differing copies."""
        right = _medication("Metformin")
        bundle = _entries(
            _medication("Lisinopril"),
            right,
            urls=("https://a.example/Medication/m1", "https://b.example/Medication/m1"),
        )
        index = f.BundleIndex(bundle)
        assert index.target(
            "Medication", {"reference": "https://b.example/Medication/m1"}
        ) == (right, False)
        assert index.target("Medication", {"reference": "Medication/m1"}) == (
            None,
            True,
        )

    def test_full_url_shared_with_another_type_resolves(self):
        """Test that an entry of another type at the fullUrl is not a copy."""
        url = "urn:uuid:m1"
        medication = _medication("Lisinopril")
        organization = {"resourceType": "Organization", "id": "m1"}
        for resources in ((medication, organization), (organization, medication)):
            index = f.BundleIndex(_entries(*resources, urls=(url, url)))
            assert index.target("Medication", {"reference": url}) == (medication, False)
            assert index.target("Organization", {"reference": url}) == (
                organization,
                False,
            )

    def test_differing_copies_at_a_full_url_are_counted_per_type(self):
        """Test that only differing copies of the requested type make a fullUrl ambiguous."""
        url = "urn:uuid:m1"
        medication = _medication("Lisinopril")
        other = _medication("Metformin")
        other["id"] = "m2"
        first = {"resourceType": "Organization", "id": "m1", "name": "One"}
        second = {"resourceType": "Organization", "id": "m1", "name": "Two"}
        for resources in (
            (first, medication, second, other),
            (medication, other, first),
        ):
            index = f.BundleIndex(_entries(*resources, urls=(url,) * 4))
            assert index.target("Medication", {"reference": url}) == (None, True)
        index = f.BundleIndex(_entries(first, medication, second, urls=(url,) * 3))
        assert index.target("Medication", {"reference": url}) == (medication, False)
        assert index.target("Organization", {"reference": url}) == (None, True)

    def test_full_url_and_id_marks_are_separate(self):
        """Test that differing copies at a fullUrl do not mark the type and id spelled the same."""
        medication = {"resourceType": "Medication", "id": "x", "code": {"text": "A"}}
        bundle = _entries(
            {"resourceType": "x", "id": "1"},
            {"resourceType": "x", "id": "2"},
            medication,
            urls=("Medication", "Medication"),
        )
        index = f.BundleIndex(bundle)
        assert index.target("Medication", {"reference": "Medication/x"}) == (
            medication,
            False,
        )

    def test_full_url_of_another_type_only_goes_on_to_the_id(self):
        """Test that a fullUrl no entry of the type has is looked up by type and id, like one no entry has."""
        url = "urn:uuid:m1"
        organization = {"resourceType": "Organization", "id": "o1"}
        medication = _medication("Lisinopril")
        for held in (_entries(organization, urls=(url,)), _entries()):
            entries = held["entry"]
            index = f.BundleIndex({"entry": [*entries, {"resource": medication}]})
            assert index.target("Medication", {"reference": url}) == (medication, False)
            differing = [{"resource": medication}, {"resource": _medication("Other")}]
            index = f.BundleIndex({"entry": [*entries, *differing]})
            assert index.target("Medication", {"reference": url}) == (None, True)
            index = f.BundleIndex({"entry": entries})
            assert index.target("Medication", {"reference": url}) == (None, False)

    def test_missing_target_is_not_ambiguous(self):
        """Test that a reference to nothing in the bundle is unresolved, not ambiguous."""
        index = f.BundleIndex(_entries(_medication("Lisinopril")))
        for reference in ({"reference": "Medication/m2"}, {"display": "x"}, None, "m1"):
            assert index.target("Medication", reference) == (None, False)

    def test_copies_too_deep_to_compare_do_not_resolve(self):
        """Test that a RecursionError while comparing two copies makes the key ambiguous."""

        class TooDeep:
            def __eq__(self, other):
                raise RecursionError

        url = "https://a.example/Medication/m1"
        bundle = _entries(
            _medication("Lisinopril", form=TooDeep()),
            _medication("Lisinopril", form=TooDeep()),
            urls=(url, url),
        )
        index = f.BundleIndex(bundle)
        for form in (*self.ID_FORMS, url):
            assert index.target("Medication", {"reference": form}) == (None, True)
        with f.indexed(bundle):
            assert f.resolve(bundle, "Medication", {"reference": "#m1"}) is None

    def test_copy_only_in_the_whole_bundle_makes_the_id_ambiguous(self):
        """Test that indexed() takes ambiguity from the whole bundle a filtered one was made from."""
        url = "https://a.example/Medication/m1"
        kept = _medication("Metformin")
        whole = _entries(kept, _medication("Lisinopril"), urls=(url, url))
        part = {**whole, "entry": whole["entry"][:1]}
        for reference in ({"reference": "Medication/m1"}, {"reference": url}):
            with f.indexed(part):
                assert f.bundle_index(part).target("Medication", reference) == (
                    kept,
                    False,
                )
            with f.indexed(part, whole) as index:
                assert f.bundle_index(part) is index
                assert index.target("Medication", reference) == (None, True)
                assert f.resolve(part, "Medication", reference) is None
        assert f._CURRENT.get() is None

    def test_whole_bundle_that_is_the_bundle_is_not_indexed_again(self, monkeypatch):
        """Test that indexed(bundle, bundle) walks the bundle once."""
        built = []
        build = f.BundleIndex.__init__
        monkeypatch.setattr(
            f.BundleIndex,
            "__init__",
            lambda self, bundle: (built.append(bundle), build(self, bundle))[1],
        )
        bundle = _entries(_medication("Metformin"))
        with f.indexed(bundle, bundle):
            pass
        assert built == [bundle]

    def test_many_copies_are_indexed_in_linear_time(self):
        """Test that copies of one id are each compared with the first only while none differs."""
        wide = {f"k{i}": i for i in range(20000)}
        same = [_medication("Lisinopril", **wide) for _ in range(100)]
        other = [_medication(f"Drug {i}") for i in range(20000)]
        started = time.monotonic()
        index = f.BundleIndex(_entries(*same, *other))
        # Linear takes about half a second; rebuilding the first copy per entry took 26 s
        assert time.monotonic() - started < 5
        assert index.target("Medication", {"reference": "Medication/m1"}) == (
            None,
            True,
        )


class TestVersionedReferences:
    """Test references that end in /_history/<version>."""

    VERSIONED = (
        "Medication/m1/_history/2",
        " Medication/m1/_history/2 ",
        "https://x.example/fhir/Medication/m1/_history/2",
        "Medication/m1/_history/",
    )

    def test_version_is_not_the_id(self):
        """Test that the id before /_history/ is used, whatever Medication has the version as its id."""
        right = _medication("Lisinopril")
        wrong = _named("2", "Metformin")
        for resources in ((right, wrong), (wrong, right), (right,)):
            index = f.BundleIndex(_entries(*resources))
            for form in self.VERSIONED:
                reference = {"reference": form}
                assert f.ref_id(reference) == "m1", form
                assert f.lookup_keys("Medication", reference) == (
                    form.strip(),
                    ("Medication", "m1"),
                )
                assert index.target("Medication", reference) == (right, False), form
        index = f.BundleIndex(_entries(wrong))
        for form in self.VERSIONED:
            assert index.target("Medication", {"reference": form}) == (None, False)

    def test_other_references_keep_their_last_segment(self):
        """Test that only <id>/_history/<version> after a type or base is shortened."""
        for form, expected in (
            ("Medication/m1", "m1"),
            ("Medication/_history", "_history"),
            ("Medication/_history/2", "2"),
            ("_history/2", "2"),
            ("m1/_history/2", "2"),
            ("urn:uuid:m1/_history/2", "2"),
            ("Medication/_history/_history/2", "_history"),
            ("Medication/m1/_history/2/x", "x"),
            ("Medication/m1/_history/2/", None),
            ("//_history/2", None),
            ("/_history/", None),
            ("_history", "_history"),
            ("#_history", None),
            ("urn:uuid:#m1", "#m1"),
            ("///", None),
        ):
            reference = {"reference": form}
            assert f.ref_id(reference) == expected, form
            index = f.BundleIndex(_entries(_named("_history", "Odd")))
            index.target("Medication", reference)

    MISMATCHED = (
        "Medication/m1/_history/2",
        " Medication/m1/_history/2 ",
        "https://x.example/fhir/Medication/m1/_history/2",
    )

    @staticmethod
    def _versioned(version, name="Lisinopril"):
        return _medication(name, meta={"versionId": version})

    def test_other_version_does_not_resolve(self):
        """Test that the entry of the id is not the target when its versionId is another one."""
        for version in ("3", "02", "2 ", ""):
            bundle = _entries(self._versioned(version))
            for form in self.MISMATCHED:
                reference = {"reference": form}
                index = f.BundleIndex(bundle)
                assert index.target("Medication", reference) == (None, False), form
                assert f.resolve(bundle, "Medication", reference) is None

    def test_same_version_resolves(self):
        """Test that the entry of the id whose versionId is the one named is the target."""
        held = self._versioned("2")
        index = f.BundleIndex(_entries(held))
        for form in self.MISMATCHED:
            assert index.target("Medication", {"reference": form}) == (held, False)

    @pytest.mark.parametrize(
        "meta", [None, {}, {"versionId": None}, {"versionId": 3}, "3", ["3"], 3]
    )
    def test_entry_without_a_version_resolves(self, meta):
        """Test that a missing or malformed meta.versionId is no version."""
        held = _medication("Lisinopril", meta=meta)
        index = f.BundleIndex(_entries(held))
        for form in self.MISMATCHED:
            assert index.target("Medication", {"reference": form}) == (held, False)

    def test_unhashable_version_does_not_raise(self):
        """Test that a list or object versionId is no version."""
        for version in (["2"], {"value": "2"}, [], 2.5, True):
            held = _medication("Lisinopril", meta={"versionId": version})
            index = f.BundleIndex(_entries(held, _medication("Lisinopril")))
            for form in self.MISMATCHED:
                assert index.target("Medication", {"reference": form}) == (held, False)

    def test_reference_without_a_version_resolves_to_any_version(self):
        """Test that the versionId only counts for a reference that names one."""
        held = self._versioned("3")
        index = f.BundleIndex(_entries(held))
        for form in ("Medication/m1", "urn:uuid:m1", "Medication/m1/_history/"):
            assert index.target("Medication", {"reference": form}) == (held, False)

    def test_other_version_at_the_full_url_does_not_resolve(self):
        """Test that the entry at the reference's exact fullUrl is held to the version too."""
        url = "https://x.example/fhir/Medication/m1/_history/2"
        for version, resolves in (("3", False), ("2", True), (None, True)):
            held = {**self._versioned(version), "id": "x1"}
            index = f.BundleIndex(_entries(held, _medication("Other"), urls=(url,)))
            expected = (held, False) if resolves else (None, False)
            assert index.target("Medication", {"reference": url}) == expected

    def test_copy_of_the_version_is_used_among_identical_copies(self):
        """Test that of copies differing only in meta, the one of the version named is the target."""
        second, third = self._versioned("2"), self._versioned("3")
        plain = _medication("Lisinopril")
        reference = {"reference": "Medication/m1/_history/2"}
        for copies, expected in (
            ((second, third), second),
            ((third, second), second),
            ((third, plain, second), second),
            ((third, plain), plain),
            ((plain, third), plain),
            ((third, self._versioned("3")), None),
            ((third, self._versioned("4")), None),
        ):
            index = f.BundleIndex(_entries(*copies))
            found = index.target("Medication", reference)
            assert found[0] is expected and found[1] is False
            assert index.target("Medication", {"reference": "Medication/m1"}) == (
                copies[0],
                False,
            )

    def test_copy_of_the_version_is_used_at_a_full_url(self):
        """Test that copies at one fullUrl are told apart by version as copies of an id are."""
        url = "urn:uuid:m1/_history/2"
        second = {**self._versioned("2"), "id": "x2"}
        third = {**self._versioned("3"), "id": "x2"}
        for copies in ((second, third), (third, second)):
            index = f.BundleIndex(_entries(*copies, urls=(url, url)))
            assert index.target("Medication", {"reference": url}) == (copies[0], False)
        url = "https://x.example/Medication/x2/_history/2"
        for copies in ((second, third), (third, second)):
            index = f.BundleIndex(_entries(*copies, urls=(url, url)))
            found = index.target("Medication", {"reference": url})
            assert found[0] is second and found[1] is False
        index = f.BundleIndex(_entries(third, urls=(url,)))
        assert index.target("Medication", {"reference": url}) == (None, False)

    def test_differing_copies_of_two_versions_stay_ambiguous(self):
        """Test that copies with different content resolve to none, whatever their versions."""
        bundle = _entries(self._versioned("2"), self._versioned("3", "Metformin"))
        index = f.BundleIndex(bundle)
        for form in self.MISMATCHED:
            assert index.target("Medication", {"reference": form}) == (None, True)

    def test_left_out_copy_of_the_version_does_not_resolve(self):
        """Test that only a kept copy of the version named, or a kept one without a version, is the target."""
        second, third = self._versioned("2"), self._versioned("3")
        plain = _medication("Lisinopril")
        form = "Medication/m1/_history/2"
        for copies, kept, expected in (
            ((second, third), (1,), None),
            ((third, second), (0,), None),
            ((third, second), (1,), second),
            ((second, third), (0,), second),
            ((second, plain), (1,), plain),
            ((plain, second), (1,), second),
            ((plain, third), (1,), None),
            ((second, third), (), None),
        ):
            whole = _entries(*copies)
            with f.indexed(_part(whole, *kept), whole) as index:
                found = index.target("Medication", {"reference": form})
            assert found[0] is expected and found[1] is False


class TestFragmentReferences:
    """Test "#id" references, which name a contained resource and no bundle entry."""

    FRAGMENTS = ("#m1", " #m1 ", "#", "# ", "#Medication/m1", "##m1", "#m1/_history/2")

    def test_fragment_is_not_looked_up(self):
        """Test that a fragment has no id and no lookup keys."""
        for form in self.FRAGMENTS:
            reference = {"reference": form}
            assert f.ref_id(reference) is None, form
            assert f.lookup_keys("Medication", reference) is None, form

    def test_fragment_does_not_resolve_to_an_entry(self):
        """Test that no entry is the target, by id or by a fullUrl that is the fragment."""
        for form in self.FRAGMENTS:
            reference = {"reference": form}
            for bundle in (
                _entries(_medication("Lisinopril")),
                _entries(_medication("Lisinopril"), urls=(form.strip(),)),
                _entries(_medication("Lisinopril"), _medication("Metformin")),
            ):
                index = f.BundleIndex(bundle)
                assert index.target("Medication", reference) == (None, False), form
                assert f.resolve(bundle, "Medication", reference) is None, form

    def test_hash_after_urn_uuid_is_part_of_the_id(self):
        """Test that "urn:uuid:#m1" is looked up as id "#m1", so no entry with id m1 answers it."""
        reference = {"reference": "urn:uuid:#m1"}
        assert f.ref_id(reference) == "#m1"
        assert f.lookup_keys("Medication", reference) == (
            "urn:uuid:#m1",
            ("Medication", "#m1"),
        )
        bundle = _entries(_medication("Lisinopril"))
        assert f.BundleIndex(bundle).target("Medication", reference) == (None, False)
        assert f.resolve(bundle, "Medication", reference) is None

    def test_fragment_id(self):
        """Test that the id is everything after the "#", and None for any other reference."""
        for form, expected in (
            ("#m1", "m1"),
            (" #m1 ", "m1"),
            ("#", ""),
            ("# ", ""),
            ("#a/b", "a/b"),
            ("##m1", "#m1"),
            ("# m1", " m1"),
            ("Medication/m1", None),
            ("urn:uuid:m1", None),
            ("urn:uuid:#m1", None),
            ("Medication/#m1", None),
        ):
            assert f.fragment_id({"reference": form}) == expected, form
        for reference in (None, "#m1", {}, {"reference": 5}, {"reference": ["#m1"]}):
            assert f.fragment_id(reference) is None


def _named(key, name, **fields):
    return {"resourceType": "Medication", "id": key, "code": {"text": name}, **fields}


def _part(whole, *kept):
    return {**whole, "entry": [whole["entry"][place] for place in kept]}


class TestLeftOutReferences:
    """Test references whose target in the whole bundle is not in the filtered one."""

    URL = "urn:uuid:m1"

    @staticmethod
    def _target(part, whole, reference):
        with f.indexed(part, whole) as index:
            found = index.target("Medication", {"reference": reference})
            assert f.resolve(part, "Medication", {"reference": reference}) is found[0]
        return found

    def test_differing_copies_left_out_at_a_full_url_do_not_resolve(self):
        """Test that the id is not tried when the fullUrl is ambiguous among entries left out."""
        third = _named("m1", "Third")
        whole = _entries(
            _named("x1", "One"), _named("x2", "Two"), third, urls=(self.URL, self.URL)
        )
        part = _part(whole, 2)
        assert self._target(part, whole, self.URL) == (None, True)
        assert self._target(whole, whole, self.URL) == (None, True)
        assert self._target(part, whole, "Medication/m1") == (third, False)

    def test_target_left_out_at_a_full_url_does_not_resolve(self):
        """Test that the id is not tried when the entry at the fullUrl is left out."""
        first, third = _named("x1", "One"), _named("m1", "Third")
        whole = _entries(first, third, urls=(self.URL,))
        part = _part(whole, 1)
        assert self._target(whole, whole, self.URL) == (first, False)
        assert self._target(part, whole, self.URL) == (None, False)
        assert self._target(part, whole, "Medication/m1") == (third, False)

    def test_target_left_out_by_id_does_not_resolve(self):
        """Test that a resource left out is not found by any form of its id."""
        whole = _entries(_medication("Lisinopril"), _named("m2", "Kept"))
        part = _part(whole, 1)
        for form in TestAmbiguousReferences.ID_FORMS:
            assert self._target(part, whole, form) == (None, False), form

    def test_kept_target_resolves(self):
        """Test that a kept resource is found by its fullUrl and by its id."""
        kept = _medication("Metformin")
        whole = _entries(_named("x1", "One"), kept, urls=("urn:uuid:x1", self.URL))
        part = _part(whole, 1)
        for form in (*TestAmbiguousReferences.ID_FORMS, self.URL):
            assert self._target(part, whole, form) == (kept, False), form
            assert self._target(whole, whole, form) == (kept, False), form

    def test_kept_identical_copy_resolves(self):
        """Test that the first kept copy is found when an identical first copy is left out."""
        left_out = _medication("Metformin", meta={"source": "a.xml"})
        kept = _medication("Metformin", meta={"source": "b.xml"})
        last = _medication("Metformin", meta={"source": "c.xml"})
        whole = _entries(left_out, kept, last, urls=(self.URL, self.URL, self.URL))
        for form in (*TestAmbiguousReferences.ID_FORMS, self.URL):
            assert self._target(_part(whole, 1, 2), whole, form) == (kept, False), form
            assert self._target(_part(whole, 0, 1), whole, form)[0] is left_out, form
            assert self._target(_part(whole), whole, form) == (None, False), form

    def test_kept_copy_among_differing_copies_does_not_resolve(self):
        """Test that differing copies stay ambiguous whichever of them is kept."""
        whole = _entries(_medication("Lisinopril"), _medication("Metformin"))
        for kept in ((0,), (1,), ()):
            for form in TestAmbiguousReferences.ID_FORMS:
                assert self._target(_part(whole, *kept), whole, form) == (None, True)

    def test_full_url_of_another_type_is_tried_by_id(self):
        """Test that a fullUrl held only by an entry of another type is tried by id, kept or left out."""
        third = _named("m1", "Third")
        whole = _entries(
            {"resourceType": "Organization", "id": "o1"}, third, urls=(self.URL,)
        )
        assert self._target(whole, whole, self.URL) == (third, False)
        assert self._target(_part(whole, 1), whole, self.URL) == (third, False)
        assert self._target(_part(whole, 0), whole, self.URL) == (None, False)

    def test_target_left_out_at_a_full_url_shared_with_another_type(self):
        """Test that a kept entry of another type at the fullUrl does not stand in for the one left out."""
        first, third = _named("x1", "One"), _named("m1", "Third")
        organization = {"resourceType": "Organization", "id": "m1"}
        for order in ((0, 1), (1, 0)):
            resources = [(first, organization)[place] for place in order]
            whole = _entries(*resources, third, urls=(self.URL, self.URL))
            kept = [
                place
                for place in range(3)
                if whole["entry"][place]["resource"] is not first
            ]
            assert self._target(whole, whole, self.URL) == (first, False)
            assert self._target(_part(whole, *kept), whole, self.URL) == (None, False)

    def test_whole_bundle_is_indexed_once(self, monkeypatch):
        """Test that indexed(part, whole) walks the whole bundle once and the part not at all."""
        built = []
        build = f.BundleIndex.__init__
        monkeypatch.setattr(
            f.BundleIndex,
            "__init__",
            lambda self, bundle, *rest: (
                built.append(bundle),
                build(self, bundle, *rest),
            )[1],
        )
        whole = _entries(_medication("Metformin"), _named("m2", "Other"))
        with f.indexed(_part(whole, 0), whole):
            pass
        assert built == [whole]
