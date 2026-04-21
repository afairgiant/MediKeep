"""Add medical_specialties table and practitioner.specialty_id FK

Revision ID: 7a1b9c0d2e3f
Revises: f9fc8447c620
Create Date: 2026-04-20 14:00:00.000000

Promotes medical specialty from a free-text string field on Practitioner to a
managed lookup table so admins can curate canonical names.

PR1 (this migration) is expand-only:
- Creates medical_specialties table
- Adds practitioners.specialty_id nullable FK
- Backfills specialty_id using most-common-casing-wins dedupe
- Leaves practitioners.specialty string column in place for dual-write

PR2 (follow-up) will drop practitioners.specialty after a verification window.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = '7a1b9c0d2e3f'
down_revision = 'f9fc8447c620'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Expand-only migration: create medical_specialties, add specialty_id FK,
    backfill via most-common-casing-wins dedupe. Does NOT drop the existing
    practitioners.specialty string column — that happens in PR2.
    """
    # 1. Create the medical_specialties lookup table.
    # Uniqueness is enforced on lower(trim(name)) via a functional index below
    # so "Cardiology", "cardiology", and "Cardiology " cannot coexist.
    op.create_table(
        'medical_specialties',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False,
                  server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'uq_medical_specialties_name_lower',
        'medical_specialties',
        [sa.text('lower(trim(name))')],
        unique=True,
    )

    # 2. Add nullable specialty_id column (FK constraint added after backfill)
    op.add_column(
        'practitioners',
        sa.Column('specialty_id', sa.Integer(), nullable=True)
    )

    # 3. Data migration: backfill medical_specialties and practitioners.specialty_id
    connection = op.get_bind()

    # Query distinct specialty strings ordered by usage count so the most common
    # casing wins the canonical form (e.g. "ENT" stays uppercase if dominant).
    # LOWER() groups case-variants; the raw `specialty` tie-breaker makes the
    # ordering deterministic for case-only ties like "ENT" vs "ent".
    rows = connection.execute(
        text(
            "SELECT specialty, COUNT(*) AS c FROM practitioners "
            "WHERE specialty IS NOT NULL AND TRIM(specialty) != '' "
            "GROUP BY specialty "
            "ORDER BY c DESC, LOWER(specialty) ASC, specialty ASC"
        )
    ).fetchall()

    canonical_by_key: dict[str, str] = {}
    mappings_log: list[tuple[str, str]] = []
    for row in rows:
        raw = row[0]
        if raw is None:
            continue
        trimmed = raw.strip()
        if not trimmed:
            continue
        key = trimmed.lower()
        if key not in canonical_by_key:
            canonical_by_key[key] = trimmed
        mappings_log.append((raw, canonical_by_key[key]))

    # Insert canonical specialties
    now_sql = "CURRENT_TIMESTAMP"
    id_by_key: dict[str, int] = {}
    for key, canonical in canonical_by_key.items():
        result = connection.execute(
            text(
                f"INSERT INTO medical_specialties "
                f"(name, description, is_active, created_at, updated_at) "
                f"VALUES (:name, NULL, true, {now_sql}, {now_sql}) "
                f"RETURNING id"
            ),
            {"name": canonical},
        )
        new_id = result.scalar()
        id_by_key[key] = new_id

    # Link practitioners to the new specialty_ids
    for key, spec_id in id_by_key.items():
        connection.execute(
            text(
                "UPDATE practitioners SET specialty_id = :spec_id "
                "WHERE LOWER(TRIM(specialty)) = :key"
            ),
            {"spec_id": spec_id, "key": key},
        )

    unmigrated = connection.execute(
        text(
            "SELECT COUNT(*) FROM practitioners "
            "WHERE specialty_id IS NULL"
        )
    ).scalar()

    # Log migration summary (visible during alembic upgrade)
    print(
        f"[medical_specialties migration] Created {len(canonical_by_key)} specialties "
        f"from {len(mappings_log)} distinct raw values. "
        f"{unmigrated} practitioner(s) left with NULL specialty_id "
        f"(empty/whitespace originals)."
    )
    if mappings_log:
        print("[medical_specialties migration] original -> canonical mapping:")
        for raw, canonical in mappings_log:
            if raw != canonical:
                print(f"  {raw!r} -> {canonical!r}")

    # 4. Add FK constraint with ondelete=RESTRICT
    op.create_foreign_key(
        'fk_practitioners_specialty_id',
        'practitioners', 'medical_specialties',
        ['specialty_id'], ['id'],
        ondelete='RESTRICT',
    )

    # 5. Index for performance
    op.create_index(
        'idx_practitioners_specialty_id',
        'practitioners',
        ['specialty_id'],
    )

    # NOTE: practitioners.specialty column is intentionally NOT dropped here.
    # PR2 will drop it after a verification window.


def downgrade() -> None:
    """
    Reverse the expand migration. Because we never dropped practitioners.specialty,
    this is a clean rollback: drop the FK, index, and column, then drop the table.
    The original string data on practitioners.specialty is preserved intact.
    """
    op.drop_index(
        'idx_practitioners_specialty_id',
        table_name='practitioners',
    )
    op.drop_constraint(
        'fk_practitioners_specialty_id',
        'practitioners',
        type_='foreignkey',
    )
    op.drop_column('practitioners', 'specialty_id')
    op.drop_table('medical_specialties')
