"""Drop legacy practitioners.specialty string column (PR2 contract step)

Revision ID: a3b4c5d6e7f8
Revises: 7a1b9c0d2e3f
Create Date: 2026-04-22 09:00:00.000000

Contract step of the expand-contract migration started in PR1. The
``practitioners.specialty`` string column is now fully superseded by the
``specialty_id`` FK and the ``MedicalSpecialty`` lookup table. Every
application code path reads from the FK (either directly or via the
``specialty_name`` computed property).

Pre-flight safety: the upgrade refuses to run if any practitioner row has a
NULL ``specialty_id``. PR1's backfill left NULL for rows with empty/whitespace
originals, so those must be reassigned via the admin MedicalSpecialty UI
before this migration can run.

Downgrade rehydrates the string column from ``medical_specialties.name`` via
the existing FK. Practitioners with NULL ``specialty_id`` (which shouldn't
exist post-pre-flight, but belt-and-suspenders) get ``'Unknown'`` so the
column's NOT NULL constraint can be restored.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = 'a3b4c5d6e7f8'
down_revision = '7a1b9c0d2e3f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()

    # 1. Pre-flight: every practitioner must have a specialty_id. PR1 backfill
    # left NULL for empty/whitespace originals; those must be resolved before
    # PR2 can make the column NOT NULL.
    null_ids = connection.execute(
        text(
            "SELECT id FROM practitioners WHERE specialty_id IS NULL ORDER BY id"
        )
    ).fetchall()
    if null_ids:
        ids = ", ".join(str(row[0]) for row in null_ids)
        raise RuntimeError(
            "Cannot drop practitioners.specialty: "
            f"{len(null_ids)} practitioner(s) have NULL specialty_id "
            f"(ids: {ids}). Assign a specialty to each via the admin "
            "MedicalSpecialty UI and rerun the migration."
        )

    # 2. Promote specialty_id to NOT NULL now that every row has a value.
    op.alter_column(
        'practitioners',
        'specialty_id',
        existing_type=sa.Integer(),
        nullable=False,
    )

    # 3. Drop the legacy string column.
    op.drop_column('practitioners', 'specialty')


def downgrade() -> None:
    # 1. Re-add the string column as nullable so we can backfill.
    op.add_column(
        'practitioners',
        sa.Column('specialty', sa.String(), nullable=True),
    )

    connection = op.get_bind()

    # 2. Backfill from the lookup table. This is lossy vs. the original PR1
    # casing/whitespace nuance (PR1 canonicalized on its own backfill), but it
    # round-trips correctly against the state this migration leaves behind.
    connection.execute(
        text(
            "UPDATE practitioners SET specialty = ms.name "
            "FROM medical_specialties ms "
            "WHERE practitioners.specialty_id = ms.id"
        )
    )

    # 3. Any remaining NULLs (shouldn't exist after step 2 since specialty_id
    # is NOT NULL at this point, but guard so the NOT NULL restore below
    # doesn't fail) get a placeholder.
    connection.execute(
        text(
            "UPDATE practitioners SET specialty = 'Unknown' "
            "WHERE specialty IS NULL"
        )
    )

    # 4. Restore the original NOT NULL constraint on specialty.
    op.alter_column(
        'practitioners',
        'specialty',
        existing_type=sa.String(),
        nullable=False,
    )

    # 5. Relax specialty_id back to nullable (its PR1 state).
    op.alter_column(
        'practitioners',
        'specialty_id',
        existing_type=sa.Integer(),
        nullable=True,
    )
