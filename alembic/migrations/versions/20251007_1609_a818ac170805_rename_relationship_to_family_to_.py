"""rename relationship_to_family to relationship_to_self

Revision ID: a818ac170805
Revises: df53ab5473dd
Create Date: 2025-10-07 16:09:10.652593

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a818ac170805'
down_revision = 'df53ab5473dd'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename column from relationship_to_family to relationship_to_self
    op.alter_column('patients', 'relationship_to_family',
                    new_column_name='relationship_to_self')


def downgrade() -> None:
    # Rename column back from relationship_to_self to relationship_to_family
    op.alter_column('patients', 'relationship_to_self',
                    new_column_name='relationship_to_family')
