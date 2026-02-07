"""add resolved_date to symptoms

Revision ID: 236764e73254
Revises: 2afb50647b47
Create Date: 2026-02-06 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '236764e73254'
down_revision: Union[str, None] = '2afb50647b47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('symptoms', sa.Column('resolved_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('symptoms', 'resolved_date')
