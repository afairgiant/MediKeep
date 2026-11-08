"""
Tests for the small FHIR helpers shared by the mappers.
"""

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
