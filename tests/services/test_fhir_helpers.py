"""
Tests for the small FHIR helpers shared by the mappers.
"""

import time
from datetime import date

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
        "#m1",
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
            ("#_history", "_history"),
            ("///", None),
        ):
            reference = {"reference": form}
            assert f.ref_id(reference) == expected, form
            index = f.BundleIndex(_entries(_named("_history", "Odd")))
            index.target("Medication", reference)


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
