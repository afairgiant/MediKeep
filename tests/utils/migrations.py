"""Helpers for running a single Alembic migration against a throwaway engine."""

import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations

VERSIONS_DIR = (
    Path(__file__).resolve().parents[2] / "alembic" / "migrations" / "versions"
)


def load_migration_module(filename: str):
    """Import a migration by file name; a dotted import cannot reach alembic/."""
    path = VERSIONS_DIR / filename
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run_migration(engine, filename: str, direction: str) -> None:
    """Run a migration's upgrade() or downgrade() in an Alembic operations context."""
    module = load_migration_module(filename)
    with engine.begin() as conn:
        ops = Operations(MigrationContext.configure(conn))
        # the module bound `op` at import time, so tests must rebind it
        original_op = module.op
        module.op = ops
        try:
            getattr(module, direction)()
        finally:
            module.op = original_op
