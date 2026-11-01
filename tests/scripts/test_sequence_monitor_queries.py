"""Sequence monitor SQL: identifiers quoted once, schema-qualified, never parsed as binds."""

from sqlalchemy.dialects import postgresql

from app.scripts.sequence_monitor import (
    SequenceMonitor,
    SequenceQueryBuilder,
    quote_identifier,
    split_qualified,
)


def _sql(statement) -> str:
    return str(statement.compile(dialect=postgresql.dialect()))


def test_plain_name_is_left_as_is():
    assert quote_identifier("users_id_seq") == "users_id_seq"


def test_name_needing_quotes_is_quoted_and_escaped():
    assert quote_identifier("Users") == '"Users"'
    assert quote_identifier('x"; DROP TABLE users; --') == '"x""; DROP TABLE users; --"'


def test_reads_are_schema_qualified_and_quoted():
    assert _sql(SequenceQueryBuilder.get_sequence_current_value("Seq", "public")) == (
        'SELECT public."Seq".last_value, public."Seq".is_called \nFROM public."Seq"'
    )
    max_sql = _sql(SequenceQueryBuilder.get_table_max_value("Table", "Id", "public"))
    assert 'max(public."Table"."Id")' in max_sql
    assert max_sql.endswith('FROM public."Table"')
    assert _sql(SequenceQueryBuilder.get_row_count("Table", "public")).endswith(
        'FROM public."Table"'
    )


def test_percent_and_colon_in_names_survive_compilation():
    statement = SequenceQueryBuilder.get_sequence_current_value("a%:b", "public")

    assert 'public."a%%:b"' in _sql(statement)
    assert statement.compile(dialect=postgresql.dialect()).params == {}


def test_setval_target_is_schema_qualified_and_quoted():
    assert SequenceMonitor()._qualified_sequence("Mixed_seq") == 'public."Mixed_seq"'


def test_split_qualified_falls_back_to_the_default_schema():
    assert split_qualified("users_id_seq", "public") == ("public", "users_id_seq")
    assert split_qualified("audit.Users_id_seq", "public") == ("audit", "Users_id_seq")
