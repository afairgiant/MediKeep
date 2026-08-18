"""Tests for GitHub manual account linking against real User rows.

This flow was completely broken: the credential check read ``existing_user.password``,
an attribute User does not have, so every attempt raised AttributeError and the
endpoint's broad except turned it into a 500. It survived earlier work because the
existing coverage patches ``sso_service.resolve_github_manual_link`` itself, so the
credential check underneath never executed.

These tests therefore call the real service method against a real user with a real
password hash. Nothing here may patch resolve_github_manual_link.
"""

import inspect
from datetime import datetime, timedelta

import pytest

from app.auth.sso.base_provider import SSOUserInfo
from app.auth.sso.exceptions import SSOAuthenticationError
from app.auth.sso.providers import GitHubProvider
from app.core.utils.security import verify_password
from app.crud.user import user as user_crud
from app.models.models import User
from app.schemas.user import UserCreate
from app.services.sso_service import _STATE_TTL, SSOService, _state_storage

PASSWORD = "linkpassword123"
TEMP_TOKEN = "github-temp-token"


pytestmark = pytest.mark.usefixtures("clean_sso_state")


@pytest.fixture
def service():
    return SSOService()


@pytest.fixture
def local_user(db_session) -> User:
    return user_crud.create(
        db_session,
        obj_in=UserCreate(
            username="githublinker",
            email="githublinker@example.com",
            password=PASSWORD,
            full_name="GitHub Linker",
            role="user",
        ),
    )


def store_link_token(token: str = TEMP_TOKEN, *, age: timedelta = timedelta(0)) -> str:
    created_at = datetime.utcnow() - age
    key = f"github_manual_link_{token}"
    _state_storage[key] = {
        "created_at": created_at,
        "sso_user_info": {
            "sub": "github-12345",
            "email": None,
            "name": "GitHub Linker",
        },
        "expires_at": created_at + _STATE_TTL,
    }
    return key


class TestSuccessfulLink:
    def test_correct_password_links_the_account(self, service, db_session, local_user):
        key = store_link_token()

        result = service.resolve_github_manual_link(
            TEMP_TOKEN, "githublinker", PASSWORD, db_session
        )

        assert result["user"].id == local_user.id
        assert result["is_new_user"] is False
        assert key not in _state_storage  # single-use

    def test_link_records_the_github_identity(self, service, db_session, local_user):
        store_link_token()

        service.resolve_github_manual_link(
            TEMP_TOKEN, "githublinker", PASSWORD, db_session
        )

        db_session.refresh(local_user)
        assert local_user.external_id == "github-12345"
        assert local_user.last_sso_login is not None

    def test_link_promotes_local_to_hybrid(self, service, db_session, local_user):
        assert local_user.auth_method == "local"
        store_link_token()

        service.resolve_github_manual_link(
            TEMP_TOKEN, "githublinker", PASSWORD, db_session
        )

        db_session.refresh(local_user)
        assert local_user.auth_method == "hybrid"
        assert local_user.account_linked_at is not None


class TestRejectedCredentials:
    def test_wrong_password_raises_the_auth_error_not_an_attribute_error(
        self, service, db_session, local_user
    ):
        """The regression: this used to raise AttributeError, surfacing as a 500."""
        store_link_token()

        with pytest.raises(
            SSOAuthenticationError, match="Invalid username or password"
        ):
            service.resolve_github_manual_link(
                TEMP_TOKEN, "githublinker", "wrongpassword", db_session
            )

    def test_unknown_username_gives_the_same_error(
        self, service, db_session, local_user
    ):
        """Identical responses - a differing one would enumerate usernames."""
        store_link_token()

        with pytest.raises(
            SSOAuthenticationError, match="Invalid username or password"
        ):
            service.resolve_github_manual_link(
                TEMP_TOKEN, "nosuchuser", PASSWORD, db_session
            )

    def test_failed_attempt_does_not_consume_the_token(
        self, service, db_session, local_user
    ):
        """A typo must not force the user back through the whole OAuth redirect."""
        key = store_link_token()

        with pytest.raises(SSOAuthenticationError):
            service.resolve_github_manual_link(
                TEMP_TOKEN, "githublinker", "wrongpassword", db_session
            )

        assert key in _state_storage

    def test_failed_attempt_does_not_link_the_account(
        self, service, db_session, local_user
    ):
        store_link_token()

        with pytest.raises(SSOAuthenticationError):
            service.resolve_github_manual_link(
                TEMP_TOKEN, "githublinker", "wrongpassword", db_session
            )

        db_session.refresh(local_user)
        assert local_user.external_id is None
        assert local_user.auth_method == "local"


class TestTokenExpiry:
    def test_expired_token_is_rejected_and_deleted(
        self, service, db_session, local_user
    ):
        key = store_link_token(age=_STATE_TTL + timedelta(minutes=1))

        with pytest.raises(SSOAuthenticationError, match="expired"):
            service.resolve_github_manual_link(
                TEMP_TOKEN, "githublinker", PASSWORD, db_session
            )

        assert key not in _state_storage

    def test_unknown_token_is_rejected(self, service, db_session, local_user):
        with pytest.raises(SSOAuthenticationError, match="Invalid or expired"):
            service.resolve_github_manual_link(
                "never-issued", "githublinker", PASSWORD, db_session
            )


class TestManualLinkPrompt:
    """The prompt the user answers has to name the account it is asking about."""

    def test_github_user_info_carries_the_login_name(self):
        info = GitHubProvider("id", "secret", "https://app/callback").format_user_info(
            {"id": 12345, "login": "octocat", "name": "The Octocat", "email": None}
        )

        assert info.username == "octocat"

    def test_manual_link_response_uses_the_github_username(self, service):
        info = SSOUserInfo(sub="github-1", email=None, username="octocat", name="Octo")

        result = service._return_github_manual_linking(info)

        assert result["github_user_info"]["github_username"] == "octocat"

    def test_missing_login_falls_back_to_a_generic_label(self, service):
        info = SSOUserInfo(sub="github-1", email=None, name="Octo")

        result = service._return_github_manual_linking(info)

        assert result["github_user_info"]["github_username"] == "GitHub User"


class TestCoverageIsHonest:
    """The defect this module covers survived precisely because the existing tests
    patched the service method, so the credential check never ran. Assert that the
    method these tests call is the real implementation, not a stand-in."""

    def test_method_under_test_is_not_patched(self):
        method = SSOService.resolve_github_manual_link

        assert inspect.isfunction(method)
        assert method.__module__ == "app.services.sso_service"

    def test_credential_check_actually_runs(self, service, db_session, local_user):
        """Fails if verify_password is never reached - the shape of the old bug."""
        store_link_token()
        calls = []

        def spy(plain, hashed):
            calls.append((plain, hashed))
            # verify_password is imported into this module's namespace at import
            # time, so this name still refers to the real function after the patch.
            return verify_password(plain, hashed)

        with pytest.MonkeyPatch.context() as mp:
            mp.setattr("app.core.utils.security.verify_password", spy)
            service.resolve_github_manual_link(
                TEMP_TOKEN, "githublinker", PASSWORD, db_session
            )

        assert len(calls) == 1
        assert calls[0][0] == PASSWORD
        assert calls[0][1] == local_user.password_hash
