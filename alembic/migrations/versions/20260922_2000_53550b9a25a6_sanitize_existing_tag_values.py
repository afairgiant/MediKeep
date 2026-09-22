"""Sanitize existing tag values to the new character allowlist

Revision ID: 53550b9a25a6
Revises: 33eb5c703580
Create Date: 2026-09-22 20:00:00.000000

Tags previously had no character restriction, so a legacy value can contain
characters the new allowlist in app.schemas.base_tags.normalize_and_validate_tag
rejects - e.g. "crohn's", "covid_19", "a/b" were all valid before that fix
(see public issue #1040). Response schemas now sanitize instead of raising on
read (TaggedEntityResponseMixin), so a legacy tag no longer turns "list this
record" into a 500 - but this migration does the one-time cleanup so the data
itself matches what the allowlist would produce going forward, rather than
relying on every read path to paper over it. Tags that collapse to the same
sanitized value (e.g. "crohn's" and "crohns" both -> "crohns") are
deduplicated; tags that sanitize to nothing (e.g. "...", "   ") are dropped.

Covers every taggable table (12 - see app.schemas.base_tags's consumers):
allergies, conditions, encounters, immunizations, injuries, insurances,
lab_results, medical_equipment, medications, procedures, symptoms,
treatments.

The sanitize logic is duplicated here (not imported from app.schemas) rather
than referencing current application code, matching the general Alembic
convention that a migration's behavior should not drift if the app code it
was based on later changes. It intentionally mirrors
app.schemas.base_tags._sanitize_tag exactly as of this migration's writing.

Reversibility: this is a lossy, one-way transform - there's no way to recover
the original value "crohn's" from "crohns" once the apostrophe is gone - so
downgrade() is a no-op. upgrade() is idempotent: a tag already in allowlist
form is unchanged by re-running it, so this migration can safely be re-run
after new tags are added.
"""

import json

import sqlalchemy as sa
from alembic import op

revision = "53550b9a25a6"
down_revision = "33eb5c703580"
branch_labels = None
depends_on = None

_TAGGED_TABLES = [
    "allergies",
    "conditions",
    "encounters",
    "immunizations",
    "injuries",
    "insurances",
    "lab_results",
    "medical_equipment",
    "medications",
    "procedures",
    "symptoms",
    "treatments",
]

_ALLOWED_TAG_PUNCTUATION = {".", "-", ":"}


def _sanitize_tag(tag):
    """Mirrors app.schemas.base_tags._sanitize_tag; see module docstring."""
    if not isinstance(tag, str):
        return None
    normalized = tag.lower().strip().replace(" ", "-")
    cleaned = "".join(
        c for c in normalized if c.isalnum() or c in _ALLOWED_TAG_PUNCTUATION
    )
    cleaned = cleaned[:50]
    if not any(c.isalnum() for c in cleaned):
        return None
    return cleaned


def _sanitize_tag_list(tags):
    if not isinstance(tags, list):
        return None
    seen = {}
    for tag in tags:
        cleaned = _sanitize_tag(tag)
        if cleaned is not None:
            seen[cleaned] = None
    return list(seen)


def _load_tags(raw):
    """Raw driver value for a JSON column: already a list (Postgres via
    psycopg2's JSON adaptation) or a JSON-text string (SQLite, and any
    driver that doesn't auto-deserialize)."""
    if raw is None:
        return None
    if isinstance(raw, str):
        try:
            loaded = json.loads(raw)
        except (TypeError, ValueError):
            return None
        return loaded if isinstance(loaded, list) else None
    return raw if isinstance(raw, list) else None


def upgrade() -> None:
    conn = op.get_bind()
    for table in _TAGGED_TABLES:
        rows = conn.execute(
            sa.text(f'SELECT id, tags FROM "{table}" WHERE tags IS NOT NULL')
        ).fetchall()
        for row_id, raw_tags in rows:
            tags = _load_tags(raw_tags)
            if tags is None:
                continue
            sanitized = _sanitize_tag_list(tags)
            if sanitized != tags:
                conn.execute(
                    sa.text(f'UPDATE "{table}" SET tags = :tags WHERE id = :id'),
                    {"tags": json.dumps(sanitized), "id": row_id},
                )


def downgrade() -> None:
    # Stripping disallowed characters is lossy - "crohn's" cannot be
    # recovered from "crohns" - so there is nothing meaningful to restore.
    pass
