"""Startup runs `alembic upgrade head`, which fails when the revision graph has more than one head."""

from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

ROOT = Path(__file__).resolve().parents[2]


def _scripts() -> ScriptDirectory:
    config = Config(str(ROOT / "alembic" / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "alembic" / "migrations"))
    return ScriptDirectory.from_config(config)


def test_single_head():
    heads = _scripts().get_heads()
    assert len(heads) == 1, (
        f"Multiple migration heads {heads}; add a merge migration with "
        "`alembic merge -m <message> <head> <head>`"
    )


def test_every_migration_is_reached_by_upgrading_to_head():
    scripts = _scripts()
    all_revisions = {script.revision for script in scripts.walk_revisions()}
    reached = {script.revision for script in scripts.iterate_revisions("head", "base")}
    assert reached == all_revisions
