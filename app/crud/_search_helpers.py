"""
Shared search-condition helpers used across catalog CRUD modules.

Kept generic and dialect-neutral so both standardized_test and
standardized_vaccine (and any future catalog) can share one implementation.
"""

from sqlalchemy import String, func


def json_array_text_contains(column, search_term: str):
    """
    Cross-database substring search on a JSON-serialized text representation
    of a column. Works on PostgreSQL and SQLite by casting the JSON value to
    text and matching the quoted form (`"term"`).

    Note: this is technically a *text* contains over the JSON serialization,
    not a true array-element match. Catalog searches rely on this looser
    semantics (e.g. searching "flu" surfaces entries whose common_names
    contains "Influenza"), so the function name reflects that.

    For production optimization on a single dialect, consider:
    - PostgreSQL: a functional GIN index on
      `LOWER(jsonb_array_elements_text(column))`.
    - SQLite: a generated text column holding the joined values.
    """
    # autoescape=True so LIKE meta-characters (%, _, /) in the user query
    # are treated literally; explicit \" escape so internal quotes can't
    # break the surrounding JSON-string match.
    safe_term = search_term.lower().replace('"', '\\"')
    return func.lower(func.cast(column, String)).contains(
        f'"{safe_term}"', autoescape=True
    )
