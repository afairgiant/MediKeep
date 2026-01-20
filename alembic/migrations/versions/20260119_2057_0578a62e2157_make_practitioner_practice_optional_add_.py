"""make_practitioner_practice_optional_add_email

Revision ID: 0578a62e2157
Revises: add_a1c_to_vitals
Create Date: 2026-01-19 20:57:58.651483

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0578a62e2157'
down_revision = 'add_a1c_to_vitals'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add email column to practitioners table
    op.add_column('practitioners', sa.Column('email', sa.String(), nullable=True))

    # Make practice column optional (nullable)
    op.alter_column('practitioners', 'practice',
               existing_type=sa.VARCHAR(),
               nullable=True)


def downgrade() -> None:
    # First, update NULL practice values to a default before making column required
    op.execute(
        "UPDATE practitioners SET practice = 'Not Specified' WHERE practice IS NULL"
    )

    # Make practice column required again (nullable=False)
    op.alter_column('practitioners', 'practice',
               existing_type=sa.VARCHAR(),
               nullable=False)

    # Remove email column
    op.drop_column('practitioners', 'email')
