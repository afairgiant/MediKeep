"""Identifiers interpolated into sequence monitor SQL are quoted."""

from sqlalchemy import text
from sqlalchemy.dialects import postgresql

from app.scripts.sequence_monitor import (
    SequenceMonitor,
    SequenceQueryBuilder,
    quote_identifier,
    quote_qualified,
)


def test_plain_name_is_left_as_is():
    assert quote_identifier("users_id_seq") == "users_id_seq"


def test_name_needing_quotes_is_quoted_and_escaped():
    assert quote_identifier("Users") == '"Users"'
    assert quote_identifier('x"; DROP TABLE users; --') == '"x""; DROP TABLE users; --"'


def test_query_builder_quotes_every_identifier():
    assert SequenceQueryBuilder.get_sequence_current_value("Seq") == (
        'SELECT last_value, is_called FROM "Seq"'
    )
    assert SequenceQueryBuilder.get_table_max_value("Table", "Id") == (
        'SELECT COALESCE(MAX("Id"), 0) as max_value FROM "Table"'
    )


def test_schema_qualified_name_is_quoted_part_by_part():
    assert quote_qualified("public.users_id_seq") == "public.users_id_seq"
    assert quote_qualified("public.Users_id_seq") == 'public."Users_id_seq"'


def test_percent_in_name_is_escaped_once_by_text():
    statement = text(SequenceQueryBuilder.get_sequence_current_value("a%b"))

    assert str(statement.compile(dialect=postgresql.dialect())).endswith('"a%%b"')


def test_setval_target_is_schema_qualified_and_quoted():
    assert SequenceMonitor()._qualified_sequence("Mixed_seq") == 'public."Mixed_seq"'
