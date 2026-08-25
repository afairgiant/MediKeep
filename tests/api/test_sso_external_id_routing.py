"""Tests for GitHub login routing by ``external_id`` (spec 8.13, criterion 16).

Manual linking has always *written* the GitHub identity onto the account -
``_link_existing_user`` sets ``external_id`` and ``sso_provider`` - but nothing
ever read it back. ``_find_or_create_user`` routes on the *absence* of an email
before any lookup runs, so a GitHub user whose email the provider does not expose
completed the link once and was re-prompted for their local password on every
login afterwards. Under ``SSO_ONLY_MODE`` they have no local password to answer
with, which turns a working prompt into a lockout.

Criterion 16 is "can complete manual account linking *and sign in*", so the shape
that matters is: link once, then sign in twice. These tests drive the real service
against real ``User`` rows - nothing here may patch the method under test, which is
how the credential bug underneath this same flow (8.5) survived earlier coverage.
"""

from datetime import timedelta

import pytest

from app.auth.sso.base_provider import SSOUserInfo
from app.core.config import settings
from app.crud.user import user as user_crud
from app.models.models import User
from app.services.sso_service import SSOService, _state_storage
from tests.api.conftest import LOCAL_PASSWORD
from tests.utils.sso import store_github_link_token

GITHUB_ID = "github-99881"
TEMP_TOKEN = "github-routing-token"


pytestmark = pytest.mark.usefixtures("clean_sso_state")


@pytest.fixture
def service():
    return SSOService()


@pytest.fixture
def github_provider(monkeypatch):
    """The GitHub-no-email branch only exists when GitHub is the configured provider."""
    monkeypatch.setattr(settings, "SSO_PROVIDER_TYPE", "github")
    return "github"


@pytest.fixture
def local_user(make_sso_user) -> User:
    """An ordinary password account, not yet linked to any provider."""
    return make_sso_user(
        username="githubrouter", auth_method="local", link_sso_identity=False
    )


@pytest.fixture
def linked_user(service, db_session, local_user, github_provider) -> User:
    """``local_user`` after completing the real manual link - i.e. their first login."""
    store_github_link_token(TEMP_TOKEN, sub=GITHUB_ID)
    service.resolve_github_manual_link(
        TEMP_TOKEN, local_user.username, LOCAL_PASSWORD, db_session
    )
    db_session.refresh(local_user)
    return local_user


def github_login(sub: str = GITHUB_ID) -> SSOUserInfo:
    """What the provider hands us for an account with a private email."""
    return SSOUserInfo(
        sub=sub, email=None, username="githubrouter", name="GitHub Router"
    )


def link_identity(db_session, user: User, *, sso_provider: str, external_id=GITHUB_ID):
    """Attach a provider identity directly, bypassing the manual-link flow."""
    user.external_id = external_id
    user.sso_provider = sso_provider
    user.auth_method = "hybrid"
    db_session.commit()
    return user


class TestSecondLoginAfterLinking:
    """Criterion 16: link once, then sign in - twice."""

    def test_linked_user_signs_in_without_the_manual_link_prompt(
        self, service, db_session, linked_user
    ):
        result = service._find_or_create_user(github_login(), db_session)

        assert "github_manual_link" not in result
        assert result["user"].id == linked_user.id
        assert result["is_new_user"] is False

    def test_second_login_does_not_mint_a_new_link_token(
        self, service, db_session, linked_user
    ):
        assert not _state_storage, "the resolved token should have been consumed"

        service._find_or_create_user(github_login(), db_session)

        # A manual-link prompt would have stored a fresh temp token here.
        assert not _state_storage

    def test_second_login_refreshes_last_sso_login_and_keeps_hybrid(
        self, service, db_session, linked_user
    ):
        assert linked_user.auth_method == "hybrid"

        backdated = linked_user.last_sso_login - timedelta(hours=1)
        linked_user.last_sso_login = backdated
        db_session.commit()

        service._find_or_create_user(github_login(), db_session)
        db_session.refresh(linked_user)

        assert linked_user.last_sso_login > backdated
        assert linked_user.auth_method == "hybrid"


class TestUnlinkedUsersStillGetThePrompt:
    def test_unknown_github_identity_reaches_the_manual_link_prompt(
        self, service, db_session, local_user, github_provider
    ):
        result = service._find_or_create_user(github_login(), db_session)

        assert result["github_manual_link"] is True
        assert result["github_user_info"]["github_id"] == GITHUB_ID

    def test_a_different_github_account_is_not_matched_to_the_linked_one(
        self, service, db_session, linked_user
    ):
        result = service._find_or_create_user(
            github_login(sub="github-other"), db_session
        )

        assert result["github_manual_link"] is True

    def test_same_external_id_under_another_provider_does_not_match(
        self, service, db_session, local_user, github_provider
    ):
        # A row left behind by a previous SSO_PROVIDER_TYPE, carrying an id that
        # happens to collide with the GitHub one.
        link_identity(db_session, local_user, sso_provider="google")

        result = service._find_or_create_user(github_login(), db_session)

        assert result["github_manual_link"] is True


class TestUnrelatedPathsAreUnaffected:
    def test_github_user_with_an_email_still_routes_by_email(
        self, service, db_session, local_user, github_provider
    ):
        link_identity(db_session, local_user, sso_provider="github")

        result = service._find_or_create_user(
            SSOUserInfo(
                sub=GITHUB_ID,
                email=local_user.email,
                username="githubrouter",
                name="GitHub Router",
            ),
            db_session,
        )

        assert "github_manual_link" not in result
        assert result["user"].id == local_user.id

    def test_non_github_provider_never_enters_the_branch(
        self, service, db_session, local_user, monkeypatch
    ):
        monkeypatch.setattr(settings, "SSO_PROVIDER_TYPE", "oidc")
        link_identity(db_session, local_user, sso_provider="oidc")

        result = service._find_or_create_user(
            SSOUserInfo(sub=GITHUB_ID, email=local_user.email, name="GitHub Router"),
            db_session,
        )

        assert "github_manual_link" not in result
        assert result["user"].id == local_user.id


class TestGetByExternalId:
    """The lookup itself - the half that did not exist at all before."""

    def test_finds_a_linked_account(self, db_session, local_user):
        link_identity(db_session, local_user, sso_provider="github")

        found = user_crud.get_by_external_id(
            db_session, external_id=GITHUB_ID, sso_provider="github"
        )
        assert found is not None and found.id == local_user.id

    def test_provider_must_match(self, db_session, local_user):
        link_identity(db_session, local_user, sso_provider="github")

        assert (
            user_crud.get_by_external_id(
                db_session, external_id=GITHUB_ID, sso_provider="google"
            )
            is None
        )

    def test_case_is_preserved(self, db_session, local_user):
        """query() lowercases string filters; a mixed-case sub must still match."""
        mixed = "Abc-DEF-123"
        link_identity(db_session, local_user, sso_provider="oidc", external_id=mixed)

        found = user_crud.get_by_external_id(
            db_session, external_id=mixed, sso_provider="oidc"
        )
        assert found is not None and found.id == local_user.id

    @pytest.mark.parametrize(
        "external_id,sso_provider",
        [(None, "github"), ("", "github"), (GITHUB_ID, None), (GITHUB_ID, "")],
    )
    def test_missing_halves_match_nothing(
        self, db_session, local_user, external_id, sso_provider
    ):
        """Both columns are nullable - a None filter must not match every unlinked row."""
        assert (
            user_crud.get_by_external_id(
                db_session, external_id=external_id, sso_provider=sso_provider
            )
            is None
        )
