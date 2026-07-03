"""
Tests for the vaccine library sync service.

Verifies the upsert-from-JSON behavior that replaces hand-written Alembic
migrations for shared/data/vaccine_library.json content changes (issue #864
resurfaced because prior JSON-only additions never reached already-migrated
databases; this service is the permanent fix).
"""

from typing import Any, Dict, List

import pytest
from sqlalchemy.orm import Session

from app.models.clinical import StandardizedVaccine
from app.services import vaccine_library_sync as sync_module
from app.services.vaccine_library_sync import sync_vaccine_library


def _entry(
    vaccine_name: str,
    who_code: str = None,
    short_name: str = None,
    category: str = "Viral",
    common_names: List[str] = None,
    is_combined: bool = False,
    components: List[str] = None,
    disease_keys: List[str] = None,
    default_manufacturer: str = None,
    is_common: bool = False,
    display_order: int = None,
) -> Dict[str, Any]:
    return {
        "who_code": who_code,
        "vaccine_name": vaccine_name,
        "short_name": short_name,
        "category": category,
        "common_names": common_names,
        "is_combined": is_combined,
        "components": components,
        "disease_keys": disease_keys,
        "default_manufacturer": default_manufacturer,
        "is_common": is_common,
        "display_order": display_order,
    }


@pytest.fixture(autouse=True)
def _clean_table(db_session: Session):
    """Every test starts from an empty standardized_vaccines table."""
    db_session.query(StandardizedVaccine).delete()
    db_session.commit()
    yield
    db_session.query(StandardizedVaccine).delete()
    db_session.commit()


def _patch_entries(monkeypatch, entries: List[Dict[str, Any]]) -> None:
    monkeypatch.setattr(sync_module, "get_vaccine_entries", lambda: entries)


class TestInsertMissing:
    def test_inserts_new_row_by_who_code(self, db_session, monkeypatch):
        entries = [
            _entry("Covid-19", who_code="Covid19", disease_keys=["COVID-19"]),
        ]
        _patch_entries(monkeypatch, entries)

        result = sync_vaccine_library(db_session)

        assert result == {"inserted": 1, "updated": 0, "unchanged": 0}
        row = (
            db_session.query(StandardizedVaccine)
            .filter(StandardizedVaccine.who_code == "Covid19")
            .one()
        )
        assert row.vaccine_name == "Covid-19"
        assert row.disease_keys == ["COVID-19"]

    def test_inserts_new_row_by_vaccine_name_when_no_who_code(
        self, db_session, monkeypatch
    ):
        entries = [
            _entry(
                "Zoster Recombinant (Shingles)",
                who_code=None,
                short_name="RZV",
                disease_keys=["Shingles"],
            ),
        ]
        _patch_entries(monkeypatch, entries)

        result = sync_vaccine_library(db_session)

        assert result == {"inserted": 1, "updated": 0, "unchanged": 0}
        row = (
            db_session.query(StandardizedVaccine)
            .filter(StandardizedVaccine.vaccine_name == "Zoster Recombinant (Shingles)")
            .one()
        )
        assert row.who_code is None
        assert row.short_name == "RZV"


class TestUpdateDrift:
    def test_updates_drifted_field_and_preserves_id(self, db_session, monkeypatch):
        entries = [_entry("Rabies", who_code="Rabies", disease_keys=["Rabies"])]
        _patch_entries(monkeypatch, entries)
        sync_vaccine_library(db_session)

        original = (
            db_session.query(StandardizedVaccine)
            .filter(StandardizedVaccine.who_code == "Rabies")
            .one()
        )
        original_id = original.id

        # Simulate a JSON edit: disease_keys and common_names change.
        entries[0]["disease_keys"] = ["Rabies", "Post-exposure"]
        entries[0]["common_names"] = ["Imovax", "RabAvert"]

        result = sync_vaccine_library(db_session)

        assert result == {"inserted": 0, "updated": 1, "unchanged": 0}
        updated = db_session.get(StandardizedVaccine, original_id)
        assert updated.id == original_id
        assert updated.disease_keys == ["Rabies", "Post-exposure"]
        assert updated.common_names == ["Imovax", "RabAvert"]

    def test_matches_by_name_case_insensitively(self, db_session, monkeypatch):
        entries = [_entry("Rotavirus", who_code=None, disease_keys=["Rotavirus"])]
        _patch_entries(monkeypatch, entries)
        sync_vaccine_library(db_session)

        # Library re-casts the name; match should still find the existing row.
        entries[0]["vaccine_name"] = "ROTAVIRUS"
        result = sync_vaccine_library(db_session)

        assert result["inserted"] == 0
        assert db_session.query(StandardizedVaccine).count() == 1

    def test_name_matched_row_gains_who_code_without_duplicating(
        self, db_session, monkeypatch
    ):
        entries = [
            _entry(
                "Tick-borne Encephalitis",
                who_code=None,
                disease_keys=["Tick-borne Encephalitis"],
            )
        ]
        _patch_entries(monkeypatch, entries)
        sync_vaccine_library(db_session)

        original = (
            db_session.query(StandardizedVaccine)
            .filter(StandardizedVaccine.vaccine_name == "Tick-borne Encephalitis")
            .one()
        )
        original_id = original.id
        assert original.who_code is None

        # Simulate a JSON edit: the entry gains a who_code it didn't have
        # before. Without the name-match fallback, the who_code lookup
        # misses and this would insert a duplicate row instead of updating.
        entries[0]["who_code"] = "TickBorneEncephalitis"
        result = sync_vaccine_library(db_session)

        assert result == {"inserted": 0, "updated": 1, "unchanged": 0}
        assert db_session.query(StandardizedVaccine).count() == 1
        updated = db_session.get(StandardizedVaccine, original_id)
        assert updated.id == original_id
        assert updated.who_code == "TickBorneEncephalitis"


class TestDuplicateEntriesWithinOnePass:
    def test_two_entries_sharing_a_who_code_do_not_both_insert(
        self, db_session, monkeypatch
    ):
        # A malformed library (copy-paste mistake) with the same who_code
        # twice in one payload. The second must match the first's
        # newly-created row rather than tripping the who_code unique index.
        entries = [
            _entry("Typhoid Ps", who_code="TyphoidDup", disease_keys=["Typhoid"]),
            _entry("Typhoid Ps", who_code="TyphoidDup", disease_keys=["Typhoid"]),
        ]
        _patch_entries(monkeypatch, entries)

        result = sync_vaccine_library(db_session)

        assert result["inserted"] == 1
        assert db_session.query(StandardizedVaccine).count() == 1

    def test_two_entries_sharing_a_name_but_different_who_codes_stay_distinct(
        self, db_session, monkeypatch
    ):
        # Two genuinely different vaccines that happen to share a display
        # name. by_name_lower must stay uncoded-only, or the second entry's
        # name-fallback lookup would find the first's row and overwrite its
        # who_code, silently merging two distinct vaccines into one.
        entries = [
            _entry("Meningococcal Vaccine", who_code="MenX1", disease_keys=["Meningococcal"]),
            _entry("Meningococcal Vaccine", who_code="MenX2", disease_keys=["Meningococcal"]),
        ]
        _patch_entries(monkeypatch, entries)

        result = sync_vaccine_library(db_session)

        assert result["inserted"] == 2
        rows = db_session.query(StandardizedVaccine).all()
        assert {v.who_code for v in rows} == {"MenX1", "MenX2"}


class TestNoOp:
    def test_second_run_with_unchanged_library_is_a_pure_no_op(
        self, db_session, monkeypatch
    ):
        entries = [
            _entry("Covid-19", who_code="Covid19", disease_keys=["COVID-19"]),
            _entry("Rabies", who_code="Rabies", disease_keys=["Rabies"]),
            _entry(
                "Zoster Recombinant (Shingles)",
                who_code=None,
                disease_keys=["Shingles"],
            ),
        ]
        _patch_entries(monkeypatch, entries)

        first = sync_vaccine_library(db_session)
        assert first["inserted"] == 3

        second = sync_vaccine_library(db_session)

        assert second == {"inserted": 0, "updated": 0, "unchanged": 3}


class TestDbOnlyRowsNeverDeleted:
    def test_row_absent_from_json_is_left_in_place(self, db_session, monkeypatch):
        # A vaccine that exists in the DB (e.g. from a prior library version)
        # but has since been removed from the JSON.
        legacy = StandardizedVaccine(
            who_code="LegacyCode",
            vaccine_name="Legacy Vaccine",
            is_combined=False,
            is_common=False,
        )
        db_session.add(legacy)
        db_session.commit()
        legacy_id = legacy.id

        entries = [_entry("Covid-19", who_code="Covid19", disease_keys=["COVID-19"])]
        _patch_entries(monkeypatch, entries)

        sync_vaccine_library(db_session)

        assert db_session.get(StandardizedVaccine, legacy_id) is not None
        assert db_session.query(StandardizedVaccine).count() == 2
