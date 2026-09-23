"""
Regression tests for #1044: tag registry reads must be scoped to the calling user.

The tag SQL is PostgreSQL-only and the suite runs on SQLite, so these tests check
the statements and bound parameters sent to a mocked session. The behavioral
two-user tests live in tests/services/test_tag_service.py.
"""

import re
from unittest.mock import MagicMock

import pytest

from app.services.tag_service import tag_service

USER_ID = 42


@pytest.fixture
def db():
    session = MagicMock()
    session.execute.return_value.fetchall.return_value = []
    return session


def _executed(db):
    """Return (normalized SQL, params) of the single statement the session ran."""
    assert db.execute.call_count == 1
    clause, params = db.execute.call_args.args
    return re.sub(r"\s+", " ", str(clause)), params


class TestPopularTagsUserScoping:
    def test_registry_filtered_to_user(self, db):
        tag_service.get_popular_tags_across_entities(db, user_id=USER_ID)

        sql, params = _executed(db)
        assert "ut.user_id = :user_id" in sql
        assert params["user_id"] == USER_ID

    def test_every_usage_subquery_filtered_to_users_patients(self, db):
        tag_service.get_popular_tags_across_entities(db, user_id=USER_ID)

        sql, _ = _executed(db)
        patient_filter = tag_service._user_patient_filter()
        assert sql.count(patient_filter) == len(tag_service.ENTITY_TABLES)

    def test_fallback_query_filtered_to_user(self, db):
        tag_service.get_popular_tags_across_entities(
            db, entity_types=["not_an_entity"], user_id=USER_ID
        )

        sql, params = _executed(db)
        assert "WHERE user_id = :user_id" in sql
        assert params["user_id"] == USER_ID

    def test_user_id_is_required(self, db):
        with pytest.raises(TypeError):
            tag_service.get_popular_tags_across_entities(db)


class TestAutocompleteUserScoping:
    def test_filtered_to_user(self, db):
        tag_service.autocomplete_tags(db, query="dia", user_id=USER_ID)

        sql, params = _executed(db)
        assert "user_id = :user_id" in sql
        assert params["user_id"] == USER_ID

    def test_user_id_is_required(self, db):
        with pytest.raises(TypeError):
            tag_service.autocomplete_tags(db, query="dia")
