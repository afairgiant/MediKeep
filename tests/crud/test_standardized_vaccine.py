"""
Tests for StandardizedVaccine CRUD operations.

Covers seed-data ingestion, lookup helpers, full-text + fuzzy search,
relevance ranking (exact > common_names > startswith > contains), the
is_common boost on tie-breaks, autocomplete output shape, and the
combined-vaccine flag round-trip.
"""

from typing import List

import pytest
from sqlalchemy.orm import Session

from app.crud import standardized_vaccine as crud
from app.models.clinical import StandardizedVaccine


def _seed(db: Session) -> List[StandardizedVaccine]:
    """
    Insert a small curated fixture set covering all the search and ranking
    paths the autocomplete relies on.
    """
    fixtures = [
        {
            "who_code": "Covid19",
            "vaccine_name": "Covid-19",
            "short_name": "COVID-19",
            "category": "Viral",
            "common_names": ["COVID", "Coronavirus", "Comirnaty", "Spikevax"],
            "is_combined": False,
            "components": None,
            "default_manufacturer": None,
            "is_common": True,
            "display_order": 1,
        },
        {
            "who_code": "MeaslesMumpsandRubella",
            "vaccine_name": "Measles, Mumps and Rubella",
            "short_name": "MMR",
            "category": "Combined",
            "common_names": ["MMR", "Priorix"],
            "is_combined": True,
            "components": ["Measles", "Mumps", "Rubella"],
            "default_manufacturer": None,
            "is_common": True,
            "display_order": 5,
        },
        {
            "who_code": None,
            "vaccine_name": "Measles, Mumps, Rubella and Varicella",
            "short_name": "MMRV",
            "category": "Combined",
            "common_names": ["MMRV", "ProQuad"],
            "is_combined": True,
            "components": ["Measles", "Mumps", "Rubella", "Varicella"],
            "default_manufacturer": None,
            "is_common": True,
            "display_order": 8,
        },
        {
            "who_code": "HumanPapillomavirusQuadrivalent",
            "vaccine_name": "Human Papillomavirus (Quadrivalent)",
            "short_name": "HPV4",
            "category": "Viral",
            "common_names": ["HPV", "HPV4", "Gardasil"],
            "is_combined": False,
            "components": None,
            "default_manufacturer": None,
            "is_common": False,
            "display_order": None,
        },
        {
            "who_code": None,
            "vaccine_name": "Zoster Recombinant (Shingles)",
            "short_name": "RZV",
            "category": "Viral",
            "common_names": ["Shingles", "Shingrix", "Zoster"],
            "is_combined": False,
            "components": None,
            "default_manufacturer": None,
            "is_common": True,
            "display_order": 6,
        },
        {
            "who_code": "BCG",
            "vaccine_name": "BCG",
            "short_name": "BCG",
            "category": "Bacterial",
            # Bare "vaccine" entry lets the tie-break test match this row at
            # the same relevance tier as Rabies below (which also has it),
            # giving the common/uncommon ordering check something to verify.
            "common_names": ["Tuberculosis vaccine", "vaccine"],
            "is_combined": False,
            "components": None,
            "default_manufacturer": None,
            "is_common": True,
            "display_order": 10,
        },
        {
            "who_code": "Rabies",
            "vaccine_name": "Rabies",
            "short_name": "Rabies",
            "category": "Viral",
            "common_names": ["Imovax", "vaccine"],
            "is_combined": False,
            "components": None,
            "default_manufacturer": None,
            "is_common": False,
            "display_order": None,
        },
    ]
    return [crud.create_vaccine(db, data) for data in fixtures]


@pytest.fixture
def vaccines(db_session: Session) -> List[StandardizedVaccine]:
    """Provide a clean per-test fixture set, isolating from migration seed."""
    db_session.query(StandardizedVaccine).delete()
    db_session.commit()
    return _seed(db_session)


class TestStandardizedVaccineLookups:
    def test_count(self, db_session: Session, vaccines):
        assert crud.count_vaccines(db_session) == len(vaccines)

    def test_count_filtered_by_category(self, db_session: Session, vaccines):
        assert crud.count_vaccines(db_session, category="Combined") == 2
        assert crud.count_vaccines(db_session, category="Viral") == 4
        assert crud.count_vaccines(db_session, category="Bacterial") == 1

    def test_get_by_id(self, db_session: Session, vaccines):
        first = vaccines[0]
        assert crud.get_vaccine_by_id(db_session, first.id).vaccine_name == "Covid-19"

    def test_get_by_id_missing_returns_none(self, db_session: Session, vaccines):
        assert crud.get_vaccine_by_id(db_session, 99999) is None

    def test_get_by_who_code(self, db_session: Session, vaccines):
        v = crud.get_vaccine_by_who_code(db_session, "Covid19")
        assert v is not None
        assert v.vaccine_name == "Covid-19"

    def test_get_by_who_code_missing_returns_none(
        self, db_session: Session, vaccines
    ):
        assert crud.get_vaccine_by_who_code(db_session, "NotARealCode") is None

    def test_get_by_name_case_insensitive(self, db_session: Session, vaccines):
        v = crud.get_vaccine_by_name(db_session, "covid-19")
        assert v is not None
        assert v.short_name == "COVID-19"


class TestStandardizedVaccineSearch:
    def test_empty_query_returns_common_vaccines_in_order(
        self, db_session: Session, vaccines
    ):
        results = crud.search_vaccines(db_session, "")
        common = [v for v in results if v.is_common]
        names = [v.short_name for v in common]
        assert names == ["COVID-19", "MMR", "RZV", "MMRV", "BCG"]

    def test_exact_short_name_match_ranks_first(
        self, db_session: Session, vaccines
    ):
        results = crud.search_vaccines(db_session, "MMR")
        assert results[0].short_name == "MMR"

    def test_common_name_match_via_json(self, db_session: Session, vaccines):
        results = crud.search_vaccines(db_session, "Gardasil")
        names = [v.short_name for v in results]
        assert "HPV4" in names

    def test_common_name_match_returns_shingles_brand(
        self, db_session: Session, vaccines
    ):
        results = crud.search_vaccines(db_session, "Shingrix")
        assert any(v.short_name == "RZV" for v in results)

    def test_startswith_match(self, db_session: Session, vaccines):
        results = crud.search_vaccines(db_session, "Mea")
        names = [v.vaccine_name for v in results]
        assert any(n.startswith("Measles") for n in names)

    def test_contains_match(self, db_session: Session, vaccines):
        results = crud.search_vaccines(db_session, "Rubella")
        assert {v.short_name for v in results} == {"MMR", "MMRV"}

    def test_who_code_exact_match(self, db_session: Session, vaccines):
        results = crud.search_vaccines(db_session, "BCG")
        assert results[0].short_name == "BCG"

    def test_category_filter(self, db_session: Session, vaccines):
        results = crud.search_vaccines(db_session, "Mea", category="Combined")
        for r in results:
            assert r.category == "Combined"

    def test_limit_respected(self, db_session: Session, vaccines):
        results = crud.search_vaccines(db_session, "", limit=2)
        assert len(results) <= 2

    def test_unknown_query_returns_empty(self, db_session: Session, vaccines):
        results = crud.search_vaccines(db_session, "zzzzzzz_nonexistent")
        assert results == []


class TestStandardizedVaccineRanking:
    def test_exact_match_outranks_contains_match(
        self, db_session: Session, vaccines
    ):
        """
        Both MMR (exact short_name match) and MMRV (contains 'mmr') should
        appear, but MMR must come first.
        """
        results = crud.search_vaccines(db_session, "mmr")
        names = [v.short_name for v in results]
        assert names.index("MMR") < names.index("MMRV")

    def test_is_common_boost_breaks_relevance_ties(
        self, db_session: Session, vaccines
    ):
        """
        When entries match at the same relevance tier (here: all via a
        common_names 'contains' on the word "vaccine"), is_common rows must
        sort before is_common=False rows. The fixture has both — BCG/Cholera
        (common) and Rabies (uncommon) — so this exercises the ordering
        rather than no-op'ing when only one match exists.
        """
        results = crud.search_vaccines(db_session, "vaccine")
        assert len(results) >= 2, "fixture must produce at least 2 hits"
        common_hits = [v for v in results if v.is_common]
        uncommon_hits = [v for v in results if not v.is_common]
        assert common_hits, "fixture must include at least one is_common hit"
        assert uncommon_hits, "fixture must include at least one uncommon hit"
        last_common_idx = max(results.index(v) for v in common_hits)
        first_uncommon_idx = min(results.index(v) for v in uncommon_hits)
        assert last_common_idx < first_uncommon_idx


class TestAutocompleteOutputShape:
    def test_value_appends_short_name_when_distinct(
        self, db_session: Session, vaccines
    ):
        opts = crud.get_autocomplete_options(db_session, "MMR", limit=10)
        mmr_opt = next(
            (o for o in opts if o["label"] == "Measles, Mumps and Rubella"),
            None,
        )
        assert mmr_opt is not None, "MMR option missing from autocomplete results"
        assert mmr_opt["value"] == "Measles, Mumps and Rubella (MMR)"

    def test_value_omits_short_name_when_identical(
        self, db_session: Session, vaccines
    ):
        opts = crud.get_autocomplete_options(db_session, "BCG", limit=5)
        bcg = next((o for o in opts if o["label"] == "BCG"), None)
        assert bcg is not None, "BCG option missing from autocomplete results"
        assert bcg["value"] == "BCG"

    def test_combined_flag_and_components_carried_through(
        self, db_session: Session, vaccines
    ):
        opts = crud.get_autocomplete_options(db_session, "MMR", limit=10)
        mmr = next(
            (o for o in opts if o["label"] == "Measles, Mumps and Rubella"),
            None,
        )
        assert mmr is not None, "MMR option missing from autocomplete results"
        assert mmr["is_combined"] is True
        assert mmr["components"] == ["Measles", "Mumps", "Rubella"]

    def test_non_combined_components_is_none(self, db_session: Session, vaccines):
        opts = crud.get_autocomplete_options(db_session, "Covid", limit=5)
        covid = next((o for o in opts if o["label"] == "Covid-19"), None)
        assert covid is not None, "Covid-19 option missing from autocomplete results"
        assert covid["is_combined"] is False
        assert covid["components"] is None


class TestCommonAndCategory:
    def test_get_common_vaccines_excludes_uncommon(
        self, db_session: Session, vaccines
    ):
        common = crud.get_common_vaccines(db_session)
        assert all(v.is_common for v in common)
        assert all(v.vaccine_name != "Human Papillomavirus (Quadrivalent)" for v in common)

    def test_get_common_vaccines_sorted_by_display_order(
        self, db_session: Session, vaccines
    ):
        common = crud.get_common_vaccines(db_session)
        orders = [v.display_order for v in common if v.display_order is not None]
        assert orders == sorted(orders)

    def test_get_vaccines_by_category(self, db_session: Session, vaccines):
        viral = crud.get_vaccines_by_category(db_session, "Viral")
        assert all(v.category == "Viral" for v in viral)
        assert len(viral) == 4


class TestBulkAndClear:
    def test_bulk_create_inserts_all(self, db_session: Session):
        db_session.query(StandardizedVaccine).delete()
        db_session.commit()
        count = crud.bulk_create_vaccines(
            db_session,
            [
                {
                    "vaccine_name": "TestVax A",
                    "is_combined": False,
                    "is_common": False,
                },
                {
                    "vaccine_name": "TestVax B",
                    "is_combined": False,
                    "is_common": False,
                },
            ],
        )
        assert count == 2
        assert crud.count_vaccines(db_session) == 2

    def test_clear_all_returns_prior_count(
        self, db_session: Session, vaccines
    ):
        before = crud.count_vaccines(db_session)
        removed = crud.clear_all_vaccines(db_session)
        assert removed == before
        assert crud.count_vaccines(db_session) == 0
