"""Two-factor data across its lifecycle: migration, account deletion, CLI reset, startup."""

from unittest.mock import patch

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core import auth_mode
from app.core.config import settings
from app.models.activity_log import ActionType, ActivityLog
from app.models.mfa import UserBackupCode, UserTotp
from app.models.models import User
from app.scripts import reset_user_mfa
from app.services import two_factor_service
from app.services.user_deletion_service import UserDeletionService
from tests.utils.migrations import run_migration
from tests.utils.two_factor import PASSWORD, code_at, enroll, make_user

MIGRATION = "20261025_1100_e3a9c5d1f742_add_two_factor_tables.py"


@pytest.fixture
def target(db_session: Session) -> User:
    return make_user(db_session, "lifecycle")


def _rows(db: Session, user_id: int) -> tuple[int, int]:
    db.expire_all()
    return (
        db.query(UserTotp).filter(UserTotp.user_id == user_id).count(),
        db.query(UserBackupCode).filter(UserBackupCode.user_id == user_id).count(),
    )


class TestMigration:
    def test_upgrade_creates_tables_and_downgrade_removes_them(self):
        engine = sa.create_engine("sqlite://")
        with engine.begin() as conn:
            conn.execute(sa.text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))

        run_migration(engine, MIGRATION, "upgrade")

        inspector = sa.inspect(engine)
        assert {"user_totp", "user_backup_codes"} <= set(inspector.get_table_names())
        totp_cols = {c["name"] for c in inspector.get_columns("user_totp")}
        assert totp_cols == {
            "id",
            "user_id",
            "secret_encrypted",
            "enabled_at",
            "last_used_step",
            "created_at",
            "updated_at",
        }
        indexes = {i["name"] for i in inspector.get_indexes("user_backup_codes")}
        assert "idx_user_backup_codes_user_id" in indexes
        fks = inspector.get_foreign_keys("user_backup_codes")
        assert fks[0]["referred_table"] == "users"
        assert fks[0]["options"].get("ondelete") == "CASCADE"

        run_migration(engine, MIGRATION, "downgrade")

        remaining = set(sa.inspect(engine).get_table_names())
        assert not {"user_totp", "user_backup_codes"} & remaining


class TestAccountDeletion:
    def test_deletion_service_removes_two_factor_rows(
        self, db_session: Session, target, test_user, test_admin_user
    ):
        enroll(db_session, target)

        stats = UserDeletionService().delete_user_account(db_session, target.id)
        db_session.commit()

        assert stats["deleted_records"]["totp"] == 1
        assert stats["deleted_records"]["backup_codes"] == 10
        assert _rows(db_session, target.id) == (0, 0)

    def test_generic_admin_delete_cascades(
        self, admin_client: TestClient, db_session: Session, target
    ):
        enroll(db_session, target)
        target_id = target.id

        response = admin_client.delete(f"/api/v1/admin/models/user/{target_id}")

        assert response.status_code == 200
        assert _rows(db_session, target_id) == (0, 0)


class TestResetCli:
    def test_resets_enrolled_user(self, db_session: Session, target):
        enroll(db_session, target)
        before = target.session_version
        db_session.commit()

        code, message = reset_user_mfa.reset_user_mfa("lifecycle")

        assert code == reset_user_mfa.EXIT_OK
        assert "turned off" in message
        assert _rows(db_session, target.id) == (0, 0)
        db_session.refresh(target)
        assert target.session_version == before + 1
        entry = (
            db_session.query(ActivityLog)
            .filter(ActivityLog.action == ActionType.TWO_FACTOR_RESET)
            .one()
        )
        assert entry.event_metadata["source"] == "reset_user_mfa_script"

    def test_user_without_two_factor(self, db_session: Session, target):
        db_session.commit()

        code, message = reset_user_mfa.reset_user_mfa("lifecycle")

        assert code == reset_user_mfa.EXIT_OK
        assert "did not have two-factor" in message

    def test_unknown_user(self, db_session: Session):
        code, _ = reset_user_mfa.reset_user_mfa("nobody-here")

        assert code == reset_user_mfa.EXIT_NOT_FOUND

    def test_prompt_declined_changes_nothing(self, db_session: Session, target):
        enroll(db_session, target)
        db_session.commit()

        with patch("sys.argv", ["reset_user_mfa.py", "--username", "lifecycle"]):
            with patch("builtins.input", return_value="n"):
                assert reset_user_mfa.main() == reset_user_mfa.EXIT_CANCELLED

        assert _rows(db_session, target.id) == (1, 10)

    def test_yes_skips_the_prompt(self, db_session: Session, target):
        enroll(db_session, target)
        db_session.commit()

        argv = ["reset_user_mfa.py", "--username", "lifecycle", "--yes"]
        with patch("sys.argv", argv), patch("builtins.input") as prompt:
            assert reset_user_mfa.main() == reset_user_mfa.EXIT_OK
        prompt.assert_not_called()

    def test_user_can_sign_in_with_password_afterwards(
        self, client: TestClient, db_session: Session, target
    ):
        enroll(db_session, target)
        db_session.commit()
        reset_user_mfa.reset_user_mfa("lifecycle")

        client.cookies.clear()
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "lifecycle", "password": PASSWORD},
        )

        assert "access_token" in response.json()


class TestStartupWarnings:
    def _events(self, db: Session) -> list[str]:
        return [event for event, _ in auth_mode.warnings(db)]

    def test_nothing_without_enrolled_users(self, db_session: Session):
        with patch.multiple(
            settings, TWO_FACTOR_ENABLED=False, SECRET_KEY_IS_EPHEMERAL=True
        ):
            events = self._events(db_session)

        assert auth_mode.TWO_FACTOR_OFF_EVENT not in events
        assert auth_mode.EPHEMERAL_KEY_EVENT not in events

    def test_kill_switch_with_enrolled_users(self, db_session: Session, target):
        enroll(db_session, target)

        with patch.object(settings, "TWO_FACTOR_ENABLED", False):
            assert auth_mode.TWO_FACTOR_OFF_EVENT in self._events(db_session)

    def test_ephemeral_key_with_enrolled_users(self, db_session: Session, target):
        enroll(db_session, target)

        with patch.object(settings, "SECRET_KEY_IS_EPHEMERAL", True):
            assert auth_mode.EPHEMERAL_KEY_EVENT in self._events(db_session)

    def test_pending_setup_does_not_count(self, db_session: Session, target):
        two_factor_service.start_enrollment(db_session, target)

        with patch.object(settings, "TWO_FACTOR_ENABLED", False):
            assert auth_mode.TWO_FACTOR_OFF_EVENT not in self._events(db_session)

    def test_without_a_session_nothing_is_checked(self):
        with patch.object(settings, "TWO_FACTOR_ENABLED", False):
            assert auth_mode.TWO_FACTOR_OFF_EVENT not in self._events(None)


class TestConfig:
    def test_kill_switch_is_parsed_strictly(self, monkeypatch):
        from app.core import config

        monkeypatch.setenv("TWO_FACTOR_ENABLED", "fasle")
        errors_before = dict(config._AUTH_FLAG_PARSE_ERRORS)
        try:
            assert config._strict_bool("TWO_FACTOR_ENABLED", default=True) is True
            assert config._AUTH_FLAG_PARSE_ERRORS["TWO_FACTOR_ENABLED"] == "fasle"
        finally:
            config._AUTH_FLAG_PARSE_ERRORS.clear()
            config._AUTH_FLAG_PARSE_ERRORS.update(errors_before)

    def test_kill_switch_defaults_on(self):
        assert settings.TWO_FACTOR_ENABLED is True

    @pytest.mark.parametrize(
        "key, ephemeral",
        [("", True), ("change-me", True), ("short", True), ("x" * 32, False)],
    )
    def test_ephemeral_key_detection(self, key, ephemeral):
        from app.core import config

        with patch.object(config, "get_secret", return_value=key):
            resolved, is_ephemeral = config._get_secret_key()

        assert is_ephemeral is ephemeral
        assert (resolved == key) is not ephemeral

    def test_new_action_types_are_listed_for_filters(self):
        listed = ActionType.get_all_actions()
        for action in (
            ActionType.TWO_FACTOR_ENABLED,
            ActionType.TWO_FACTOR_DISABLED,
            ActionType.TWO_FACTOR_RESET,
            ActionType.BACKUP_CODES_REGENERATED,
            ActionType.SESSIONS_REVOKED,
        ):
            assert action in listed


def test_enrolled_user_survives_a_round_trip(db_session: Session, target):
    secret, _ = enroll(db_session, target)

    two_factor_service.verify_totp(db_session, target, code_at(secret))
