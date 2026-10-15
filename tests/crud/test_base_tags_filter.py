"""CRUD tests for TagFilterMixin, exercised through the Allergy entity.

These cover TagFilterMixin directly (get_by_tags / get_multi_with_tag_filters)
rather than through any one entity's own tests, since no entity previously had
dedicated coverage for the mixin's AND/OR tag matching - a gap that let
``tags.contains([tag])`` silently drop any record holding more than the
queried tag(s) from both modes. See app/crud/base_tags.py for the fix.
"""

from sqlalchemy.orm import Session

from app.crud.allergy import allergy
from app.schemas.allergy import AllergyCreate


def _create(db: Session, patient_id: int, allergen: str, **overrides):
    data = {
        "allergen": allergen,
        "severity": "mild",
        "reaction": "rash",
        "patient_id": patient_id,
    }
    data.update(overrides)
    return allergy.create(db, obj_in=AllergyCreate(**data))


class TestTagFilterMixinViaAllergy:
    def _seed(self, db_session: Session, test_patient):
        """Three records: tags ["a","b"], ["b"], ["c"]."""
        ab = _create(db_session, test_patient.id, "Peanuts", tags=["a", "b"])
        b = _create(db_session, test_patient.id, "Shellfish", tags=["b"])
        c = _create(db_session, test_patient.id, "Pollen", tags=["c"])
        return ab, b, c

    def test_get_by_tags_or_single_tag_matches_only_that_record(
        self, db_session: Session, test_patient
    ):
        ab, b, c = self._seed(db_session, test_patient)
        result = allergy.get_by_tags(db_session, tags=["a"])
        assert [r.id for r in result] == [ab.id]

    def test_get_by_tags_or_two_tags_matches_both_records_holding_either(
        self, db_session: Session, test_patient
    ):
        ab, b, c = self._seed(db_session, test_patient)
        result = allergy.get_by_tags(db_session, tags=["b"])
        assert {r.id for r in result} == {ab.id, b.id}

    def test_get_by_tags_and_both_tags_matches_only_the_record_with_both(
        self, db_session: Session, test_patient
    ):
        ab, b, c = self._seed(db_session, test_patient)
        result = allergy.get_by_tags(
            db_session, tags=["a", "b"], tag_match_all=True
        )
        assert [r.id for r in result] == [ab.id]

    def test_get_by_tags_and_tags_from_different_records_matches_none(
        self, db_session: Session, test_patient
    ):
        ab, b, c = self._seed(db_session, test_patient)
        result = allergy.get_by_tags(
            db_session, tags=["a", "c"], tag_match_all=True
        )
        assert result == []

    def test_get_multi_with_tag_filters_combines_kwarg_filter_with_tags(
        self, db_session: Session, test_patient
    ):
        ab, b, c = self._seed(db_session, test_patient)
        # ab and b both hold tag "b"; only ab also has severity "moderate".
        severe = _create(
            db_session,
            test_patient.id,
            "Latex",
            severity="moderate",
            tags=["b"],
        )

        result = allergy.get_multi_with_tag_filters(
            db_session, tags=["b"], severity="moderate"
        )
        assert [r.id for r in result] == [severe.id]


class TestTagFilterMixinNonAsciiAndWildcards:
    """Quality-review follow-up: non-ASCII tags and LIKE metacharacters in a
    caller-supplied search term (the `tags` query param is never passed
    through the write-time allowlist, unlike a stored tag value).
    """

    def test_non_ascii_tag_written_through_orm_is_found(
        self, db_session: Session, test_patient
    ):
        # "köln" passes the write-time allowlist (str.isalnum() is True
        # for Unicode letters) and is stored by the ORM's JSON type, which
        # ensure_ascii-escapes it (``"k\\u00f6ln"``) rather than storing the
        # raw UTF-8 bytes a raw json_agg write would.
        record = _create(db_session, test_patient.id, "Pollen", tags=["köln"])

        result = allergy.get_by_tags(db_session, tags=["köln"])

        assert [r.id for r in result] == [record.id]

    def test_percent_wildcard_query_does_not_match_everything(
        self, db_session: Session, test_patient
    ):
        self._seed_plain(db_session, test_patient)

        result = allergy.get_by_tags(db_session, tags=["%"])

        assert result == []

    def test_underscore_wildcard_query_does_not_match_everything(
        self, db_session: Session, test_patient
    ):
        self._seed_plain(db_session, test_patient)

        result = allergy.get_by_tags(db_session, tags=["_"])

        assert result == []

    def test_query_tag_is_lowercased_to_match_stored_tag(
        self, db_session: Session, test_patient
    ):
        # Tags are lower-cased on write (normalize_and_validate_tag), so a
        # stored tag is always already "drk" - the search term needs the
        # same normalization or an upper-case query would never match it.
        record = _create(db_session, test_patient.id, "Latex", tags=["drk"])

        result = allergy.get_by_tags(db_session, tags=["DRK"])

        assert [r.id for r in result] == [record.id]

    def _seed_plain(self, db_session: Session, test_patient):
        _create(db_session, test_patient.id, "Peanuts", tags=["a"])
        _create(db_session, test_patient.id, "Shellfish", tags=["b"])
