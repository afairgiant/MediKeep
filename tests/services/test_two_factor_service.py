"""two_factor_service: code windows, replay, backup codes, blocked reasons, removal."""

import threading
import time
from unittest.mock import patch

import pytest
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.models.mfa import UserBackupCode, UserTotp
from app.services import two_factor_service as tfs
from app.services.credential_encryption import mfa_credential_encryption
from tests.utils.two_factor import code_at, enroll, make_user, totp_row

# A fixed instant in the middle of a 30-second step
NOW = 1_800_000_015.0


@pytest.fixture
def user(db_session: Session):
    return make_user(db_session, "twofactor")


@pytest.fixture
def enrolled(db_session: Session, user):
    secret, codes = enroll(db_session, user)
    # Clear the confirmation step so every window position in a test is unused
    totp_row(db_session, user).last_used_step = None
    db_session.commit()
    return secret, codes


class TestTotpWindow:
    @pytest.mark.parametrize("offset", [-1, 0, 1])
    def test_adjacent_steps_are_accepted(self, db_session, user, enrolled, offset):
        secret, _ = enrolled

        tfs.verify_totp(db_session, user, code_at(secret, offset, NOW), now=NOW)

    @pytest.mark.parametrize("offset", [-2, 2])
    def test_steps_a_minute_away_are_rejected(self, db_session, user, enrolled, offset):
        secret, _ = enrolled

        with pytest.raises(tfs.CodeRejected):
            tfs.verify_totp(db_session, user, code_at(secret, offset, NOW), now=NOW)

    def test_spaces_in_code_are_ignored(self, db_session, user, enrolled):
        secret, _ = enrolled
        code = code_at(secret, 0, NOW)

        tfs.verify_totp(db_session, user, f"{code[:3]} {code[3:]}", now=NOW)

    @pytest.mark.parametrize("bad", ["", "12345", "1234567", "abcdef", "١٢٣٤٥٦"])
    def test_malformed_codes_are_rejected(self, db_session, user, enrolled, bad):
        with pytest.raises(tfs.CodeRejected):
            tfs.verify_totp(db_session, user, bad, now=NOW)

    def test_not_enrolled_is_rejected(self, db_session, user):
        with pytest.raises(tfs.CodeRejected):
            tfs.verify_totp(db_session, user, "123456", now=NOW)


class TestReplay:
    def test_same_code_twice_is_a_replay(self, db_session, user, enrolled):
        secret, _ = enrolled
        code = code_at(secret, 0, NOW)
        tfs.verify_totp(db_session, user, code, now=NOW)

        with pytest.raises(tfs.CodeRejected) as rejected:
            tfs.verify_totp(db_session, user, code, now=NOW)
        assert rejected.value.replayed

    def test_earlier_step_after_a_later_one_is_a_replay(
        self, db_session, user, enrolled
    ):
        secret, _ = enrolled
        tfs.verify_totp(db_session, user, code_at(secret, 1, NOW), now=NOW)

        with pytest.raises(tfs.CodeRejected):
            tfs.verify_totp(db_session, user, code_at(secret, 0, NOW), now=NOW)

    def test_confirmation_code_cannot_sign_in(self, db_session, user):
        secret, _ = tfs.start_enrollment(db_session, user)
        code = code_at(secret, 0, NOW)
        tfs.confirm_enrollment(db_session, user, code, now=NOW)

        with pytest.raises(tfs.CodeRejected):
            tfs.verify_totp(db_session, user, code, now=NOW)

    def test_concurrent_use_of_one_code_lets_one_through(
        self, db_session, user, enrolled, test_db_engine
    ):
        secret, _ = enrolled
        code = code_at(secret, 0, NOW)
        make_session = sessionmaker(bind=test_db_engine)
        results = []
        barrier = threading.Barrier(4)

        def attempt():
            session = make_session()
            try:
                barrier.wait()
                tfs.verify_totp(session, session.merge(user), code, now=NOW)
                results.append("ok")
            except tfs.CodeRejected:
                results.append("rejected")
            except Exception:
                # SQLite may refuse a concurrent writer outright; that is a rejection too
                results.append("rejected")
            finally:
                session.close()

        threads = [threading.Thread(target=attempt) for _ in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert results.count("ok") == 1


class TestUnreadableSecret:
    def test_decrypt_failure_is_reported_not_rejected(self, db_session, user, enrolled):
        row = totp_row(db_session, user)
        row.secret_encrypted = "not-a-valid-ciphertext"
        db_session.commit()

        with pytest.raises(tfs.TotpSecretUnavailable):
            tfs.verify_totp(db_session, user, "123456", now=NOW)

    def test_backup_codes_still_work(self, db_session, user, enrolled):
        _, codes = enrolled
        totp_row(db_session, user).secret_encrypted = "garbage"
        db_session.commit()

        assert tfs.verify_backup_code(db_session, user, codes[0]) == 9

    def test_secret_is_stored_encrypted(self, db_session, user, enrolled):
        secret, _ = enrolled
        stored = totp_row(db_session, user).secret_encrypted

        assert secret not in stored
        assert mfa_credential_encryption.decrypt_token(stored) == secret


class TestBackupCodes:
    def test_ten_codes_in_the_documented_format(self, enrolled):
        _, codes = enrolled

        assert len(codes) == 10
        assert len(set(codes)) == 10
        for code in codes:
            assert len(code) == 9 and code[4] == "-"
            assert set(code.replace("-", "")) <= set(tfs._CROCKFORD_ALPHABET)

    def test_codes_are_stored_hashed(self, db_session, user, enrolled):
        _, codes = enrolled
        hashes = [r.code_hash for r in db_session.query(UserBackupCode).all()]

        assert all(h.startswith("$2") for h in hashes)
        assert not any(c.replace("-", "") in h for c in codes for h in hashes)

    def test_each_code_works_once(self, db_session, user, enrolled):
        _, codes = enrolled
        assert tfs.verify_backup_code(db_session, user, codes[3]) == 9

        with pytest.raises(tfs.CodeRejected):
            tfs.verify_backup_code(db_session, user, codes[3])

    @pytest.mark.parametrize(
        "transform",
        [
            lambda c: c.lower(),
            lambda c: c.replace("-", ""),
            lambda c: f"  {c[:4]} {c[5:]} ",
        ],
    )
    def test_input_is_normalized(self, db_session, user, enrolled, transform):
        _, codes = enrolled

        tfs.verify_backup_code(db_session, user, transform(codes[0]))

    def test_confusable_letters_read_as_digits(self):
        assert tfs.normalize_backup_code("o1il-OOLI") == "0111" + "0011"

    @pytest.mark.parametrize("bad", ["", "ABCD-EFGH", "ABC", "ABCD-EFGH-IJKL"])
    def test_wrong_codes_are_rejected(self, db_session, user, enrolled, bad):
        with pytest.raises(tfs.CodeRejected):
            tfs.verify_backup_code(db_session, user, bad)

    def test_regenerate_invalidates_old_codes(self, db_session, user, enrolled):
        _, old = enrolled
        new = tfs.regenerate_backup_codes(db_session, user)

        with pytest.raises(tfs.CodeRejected):
            tfs.verify_backup_code(db_session, user, old[0])
        assert tfs.verify_backup_code(db_session, user, new[0]) == 9


class TestVerifyAnyCode:
    def test_six_digits_are_treated_as_totp(self, db_session, user, enrolled):
        secret, _ = enrolled

        tfs.verify_any_code(db_session, user, code_at(secret))

        assert totp_row(db_session, user).last_used_step is not None
        assert tfs.backup_codes_remaining(db_session, user) == 10

    def test_other_input_is_treated_as_backup_code(self, db_session, user, enrolled):
        _, codes = enrolled

        tfs.verify_any_code(db_session, user, codes[1])

        assert tfs.backup_codes_remaining(db_session, user) == 9

    def test_unreadable_secret_rejects_a_totp_code(self, db_session, user, enrolled):
        totp_row(db_session, user).secret_encrypted = "garbage"
        db_session.commit()

        with pytest.raises(tfs.CodeRejected):
            tfs.verify_any_code(db_session, user, "123456")


class TestEnrollment:
    def test_pending_secret_does_not_require_a_second_step(self, db_session, user):
        tfs.start_enrollment(db_session, user)

        assert tfs.has_pending_enrollment(db_session, user)
        assert not tfs.is_required_at_login(db_session, user)

    def test_restarting_setup_replaces_the_pending_secret(self, db_session, user):
        first, _ = tfs.start_enrollment(db_session, user)
        second, _ = tfs.start_enrollment(db_session, user)

        assert first != second
        assert db_session.query(UserTotp).count() == 1
        with pytest.raises(tfs.CodeRejected):
            tfs.confirm_enrollment(db_session, user, code_at(first, 0, NOW), now=NOW)

    def test_uri_names_issuer_and_user(self, db_session, user):
        with patch.object(settings, "TOTP_ISSUER", "Home MediKeep"):
            _, uri = tfs.start_enrollment(db_session, user)

        assert uri.startswith("otpauth://totp/")
        assert "issuer=Home%20MediKeep" in uri
        assert "twofactor" in uri

    def test_wrong_confirmation_code_leaves_it_off(self, db_session, user):
        tfs.start_enrollment(db_session, user)

        with pytest.raises(tfs.CodeRejected):
            tfs.confirm_enrollment(db_session, user, "000000", now=NOW)
        assert not tfs.is_totp_enabled(db_session, user)


class TestBlockedReason:
    def test_local_account_may_enroll(self, user):
        assert tfs.enrollment_blocked_reason(user) is None

    def test_kill_switch(self, user):
        with patch.object(settings, "TWO_FACTOR_ENABLED", False):
            assert tfs.enrollment_blocked_reason(user) == "disabled_by_operator"

    def test_sso_only_mode(self, user):
        with patch.object(settings, "SSO_ONLY_MODE", True):
            assert tfs.enrollment_blocked_reason(user) == "sso_only_mode"

    def test_sso_account(self, db_session, user):
        user.auth_method = "sso"
        db_session.commit()

        assert tfs.enrollment_blocked_reason(user) == "sso_account"

    def test_hybrid_account_may_enroll(self, db_session, user):
        user.auth_method = "hybrid"
        db_session.commit()

        assert tfs.enrollment_blocked_reason(user) is None

    def test_ephemeral_secret_key(self, user):
        with patch.object(settings, "SECRET_KEY_IS_EPHEMERAL", True):
            assert tfs.enrollment_blocked_reason(user) == "secret_key_not_configured"

    def test_kill_switch_skips_the_login_step(self, db_session, user, enrolled):
        with patch.object(settings, "TWO_FACTOR_ENABLED", False):
            assert not tfs.is_required_at_login(db_session, user)
        assert tfs.is_required_at_login(db_session, user)


class TestRemoveAll:
    def test_removes_rows_and_ends_sessions(self, db_session, user, enrolled):
        before = user.session_version

        assert tfs.remove_all(db_session, user) is True

        assert db_session.query(UserTotp).count() == 0
        assert db_session.query(UserBackupCode).count() == 0
        assert user.session_version == before + 1

    def test_reports_when_nothing_was_enabled(self, db_session, user):
        assert tfs.remove_all(db_session, user) is False


class TestTickets:
    def test_attempts_run_out(self, user):
        token = tfs.issue_challenge(user)["mfa_ticket"]
        for _ in range(tfs.MFA_TICKET_MAX_ATTEMPTS - 1):
            entry = tfs.take_ticket(token)
            tfs.return_ticket(token, entry, count_attempt=True)

        entry = tfs.take_ticket(token)
        tfs.return_ticket(token, entry, count_attempt=True)

        assert tfs.take_ticket(token) is None

    def test_uncounted_return_keeps_attempts(self, user):
        token = tfs.issue_challenge(user)["mfa_ticket"]
        entry = tfs.take_ticket(token)
        tfs.return_ticket(token, entry, count_attempt=False)

        assert tfs.take_ticket(token).value.attempts == 0

    def test_new_ticket_replaces_the_previous_one(self, db_session, user):
        first = tfs.issue_challenge(user)["mfa_ticket"]
        second = tfs.issue_challenge(user)["mfa_ticket"]

        assert tfs.take_ticket(first) is None
        assert tfs.take_ticket(second) is not None

    def test_other_users_tickets_survive(self, db_session, user):
        other = make_user(db_session, "otherticket")
        mine = tfs.issue_challenge(user)["mfa_ticket"]

        for _ in range(3):
            tfs.issue_challenge(other)

        assert tfs.take_ticket(mine) is not None
        assert len(tfs.mfa_tickets) == 1

    def test_ticket_carries_the_session_version(self, user):
        token = tfs.issue_challenge(user)["mfa_ticket"]

        assert tfs.take_ticket(token).value.session_version == user.session_version

    def test_ticket_expires(self, user):
        with patch(
            "app.core.utils.ephemeral_store.time.monotonic", return_value=1000.0
        ):
            token = tfs.issue_challenge(user)["mfa_ticket"]
        with patch(
            "app.core.utils.ephemeral_store.time.monotonic",
            return_value=1000.0 + tfs.MFA_TICKET_TTL_SECONDS,
        ):
            assert tfs.take_ticket(token) is None


def test_enroll_helper_leaves_current_code_free(db_session, user):
    secret, _ = enroll(db_session, user)

    tfs.verify_totp(db_session, user, code_at(secret), now=time.time())
