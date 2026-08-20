"""Tests for the forced-password-change guard and the auth_method promotion.

A pure-SSO account's password_hash is a random token that was discarded at
creation, so must_change_password can never be satisfied and locks the account out
until its next SSO login clears it. Two changes make that coherent:

1. Admin password reset promotes 'sso' to 'hybrid' - the account genuinely has a
   usable local password from that moment, and /auth/login already accepted it.
2. PUT /admin/models/user/{id} refuses to set the flag on an account that has no
   usable password.

The two interact: the admin UI resets first, then sets the flag, so the flag write
sees a 'hybrid' account and is allowed.
"""

import logging

import pytest

from app.models.models import User
from tests.api.conftest import LOCAL_PASSWORD

ADMIN_MODELS_LOGGER = "medical_records.app.api.v1.admin.models"


def user_url(user_id: int) -> str:
    return f"/api/v1/admin/models/user/{user_id}"


def reset_url(user_id: int) -> str:
    return f"/api/v1/admin/models/users/{user_id}/reset-password"


@pytest.fixture
def make_user(make_sso_user):
    """Create a user with a given auth_method and no linked SSO identity."""

    def factory(
        auth_method: str = "sso",
        username: str = "guardtarget",
        must_change_password: bool = False,
    ) -> User:
        return make_sso_user(
            username=username,
            auth_method=auth_method,
            must_change_password=must_change_password,
            link_sso_identity=False,
        )

    return factory


class TestHasUsablePassword:
    """The property the guard and the SSO login clear both key off."""

    @pytest.mark.parametrize(
        "auth_method, expected",
        [("sso", False), ("local", True), ("hybrid", True)],
    )
    def test_property_for_each_auth_method(self, make_user, auth_method, expected):
        user = make_user(auth_method=auth_method, username=f"prop{auth_method}")

        assert user.has_usable_password is expected


class TestForcedChangeGuard:
    def test_setting_the_flag_on_an_sso_account_is_refused(
        self, admin_client, make_user, db_session
    ):
        user = make_user(auth_method="sso")

        response = admin_client.put(
            user_url(user.id), json={"must_change_password": True}
        )

        assert response.status_code == 400
        db_session.expire_all()
        assert db_session.get(User, user.id).must_change_password is False

    def test_refusal_message_says_what_to_do_instead(self, admin_client, make_user):
        user = make_user(auth_method="sso", username="msgtarget")

        response = admin_client.put(
            user_url(user.id), json={"must_change_password": True}
        )

        body = str(response.json())
        assert "SSO-only account" in body
        assert "Reset the user's password first" in body

    def test_refusal_emits_a_security_event(self, admin_client, make_user, caplog):
        user = make_user(auth_method="sso", username="eventtarget")

        with caplog.at_level(logging.WARNING, logger=ADMIN_MODELS_LOGGER):
            admin_client.put(user_url(user.id), json={"must_change_password": True})

        events = [getattr(record, "event", None) for record in caplog.records]
        assert "forced_password_change_blocked_sso_account" in events

    @pytest.mark.parametrize("auth_method", ["local", "hybrid"])
    def test_setting_the_flag_on_a_password_account_still_works(
        self, admin_client, make_user, db_session, auth_method
    ):
        user = make_user(auth_method=auth_method, username=f"allow{auth_method}")

        response = admin_client.put(
            user_url(user.id), json={"must_change_password": True}
        )

        assert response.status_code == 200
        db_session.expire_all()
        assert db_session.get(User, user.id).must_change_password is True

    def test_clearing_the_flag_on_an_sso_account_is_always_allowed(
        self, admin_client, make_user, db_session
    ):
        user = make_user(
            auth_method="sso", username="clearme", must_change_password=True
        )

        response = admin_client.put(
            user_url(user.id), json={"must_change_password": False}
        )

        assert response.status_code == 200
        db_session.expire_all()
        assert db_session.get(User, user.id).must_change_password is False

    def test_unrelated_updates_to_an_sso_account_are_unaffected(
        self, admin_client, make_user
    ):
        user = make_user(auth_method="sso", username="unrelated")

        response = admin_client.put(user_url(user.id), json={"full_name": "New Name"})

        assert response.status_code == 200


class TestAuthMethodPromotion:
    def test_reset_promotes_an_sso_account_to_hybrid(
        self, admin_client, make_user, db_session
    ):
        user = make_user(auth_method="sso", username="promoteme")

        response = admin_client.post(
            reset_url(user.id), json={"new_password": "newpassword123"}
        )

        assert response.status_code == 200
        db_session.expire_all()
        assert db_session.get(User, user.id).auth_method == "hybrid"

    def test_promotion_emits_a_security_event(self, admin_client, make_user, caplog):
        user = make_user(auth_method="sso", username="promoteevent")

        with caplog.at_level(logging.WARNING, logger=ADMIN_MODELS_LOGGER):
            admin_client.post(
                reset_url(user.id), json={"new_password": "newpassword123"}
            )

        events = [getattr(record, "event", None) for record in caplog.records]
        assert "sso_account_promoted_to_hybrid" in events

    @pytest.mark.parametrize("auth_method", ["local", "hybrid"])
    def test_reset_leaves_other_auth_methods_untouched(
        self, admin_client, make_user, db_session, auth_method
    ):
        user = make_user(auth_method=auth_method, username=f"keep{auth_method}")

        admin_client.post(reset_url(user.id), json={"new_password": "newpassword123"})

        db_session.expire_all()
        assert db_session.get(User, user.id).auth_method == auth_method


class TestResetThenForceChangeSequence:
    """The order UserManagement.jsx issues these two calls in is load-bearing."""

    def test_reset_then_force_change_succeeds_end_to_end(
        self, admin_client, make_user, db_session
    ):
        user = make_user(auth_method="sso", username="sequence")

        reset = admin_client.post(
            reset_url(user.id), json={"new_password": "newpassword123"}
        )
        force = admin_client.put(user_url(user.id), json={"must_change_password": True})

        assert reset.status_code == 200
        assert force.status_code == 200

        db_session.expire_all()
        refreshed = db_session.get(User, user.id)
        assert refreshed.auth_method == "hybrid"
        assert refreshed.must_change_password is True

    def test_force_change_before_any_reset_is_refused(self, admin_client, make_user):
        """Documents the dependency: reversing the two calls breaks the flow."""
        user = make_user(auth_method="sso", username="reversed")

        response = admin_client.put(
            user_url(user.id), json={"must_change_password": True}
        )

        assert response.status_code == 400

    def test_reversing_the_order_would_also_wipe_the_flag(
        self, admin_client, make_user, db_session
    ):
        """update_password clears must_change_password, so a reset after the flag
        write would undo it even on an account that passes the guard."""
        user = make_user(
            auth_method="local", username="wipeorder", must_change_password=False
        )

        admin_client.put(user_url(user.id), json={"must_change_password": True})
        admin_client.post(reset_url(user.id), json={"new_password": "newpassword123"})

        db_session.expire_all()
        assert db_session.get(User, user.id).must_change_password is False


class TestPromotedAccountLogin:
    def test_sso_only_account_cannot_log_in_locally_before_a_reset(
        self, client, make_user
    ):
        """The state has_usable_password describes: the account's password is a
        random token nobody holds, so no local credential can satisfy /auth/login."""
        make_user(auth_method="sso", username="nolocalpassword")

        response = client.post(
            "/api/v1/auth/login",
            data={"username": "nolocalpassword", "password": LOCAL_PASSWORD},
        )

        assert response.status_code != 200

    def test_promoted_account_logs_in_locally_with_the_new_password(
        self, admin_client, client, make_user
    ):
        """The promotion asserts a capability the account already had - prove it."""
        user = make_user(auth_method="sso", username="localloginafterreset")

        admin_client.post(reset_url(user.id), json={"new_password": "newpassword123"})

        response = client.post(
            "/api/v1/auth/login",
            data={"username": "localloginafterreset", "password": "newpassword123"},
        )

        assert response.status_code == 200
