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
from app.auth.sso.exceptions import SSOAuthenticationError
from app.core.config import settings
from app.crud.user import user as user_crud
from app.models.models import User
from app.services.sso_service import SSOService, _state_storage, _store_state_entry
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


@pytest.fixture
def stub_sso_provider(monkeypatch):
    """Stand in for the provider's two network calls.

    The collaborator is stubbed because it does real HTTP; the method under test
    never is - that is how the credential defect in this flow (8.5) survived.
    """

    def install(user_info: SSOUserInfo):
        class StubProvider:
            async def exchange_code_for_token(self, code):
                return {"access_token": "stub-access-token"}

            async def get_user_info(self, access_token):
                return user_info

        monkeypatch.setattr(
            "app.services.sso_service.create_sso_provider", lambda: StubProvider()
        )

    return install


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


class TestThroughCompleteAuthentication:
    """The callback path, not just the routing helper underneath it.

    Every other test here (and in ``test_sso_github_manual_link.py``) calls
    ``_find_or_create_user`` or ``resolve_github_manual_link`` directly. That
    leaves the caller unexercised, and the caller had a defect: its success log
    read ``result["is_new_user"]``, a key the manual-link response does not carry,
    so an unknown private-email GitHub user raised KeyError inside the endpoint's
    broad ``except`` and got a 500 instead of the prompt. Linking could never
    begin, which makes the second-login fix above unreachable for a new user.

    The provider is stubbed because it does network I/O; the method under test is
    not.
    """

    STATE = "state-token-routing"

    @pytest.fixture
    def valid_state(self):
        _store_state_entry(self.STATE, {"return_url": "/patients/42"})
        return self.STATE

    @pytest.mark.asyncio
    async def test_unknown_private_email_user_gets_the_prompt_not_a_keyerror(
        self,
        service,
        db_session,
        local_user,
        github_provider,
        stub_sso_provider,
        valid_state,
    ):
        stub_sso_provider(github_login())

        result = await service.complete_authentication("code", valid_state, db_session)

        assert result["github_manual_link"] is True
        assert result["github_user_info"]["github_id"] == GITHUB_ID
        assert "is_new_user" not in result

    @pytest.mark.asyncio
    async def test_the_prompt_response_still_carries_the_return_url(
        self,
        service,
        db_session,
        local_user,
        github_provider,
        stub_sso_provider,
        valid_state,
    ):
        stub_sso_provider(github_login())

        result = await service.complete_authentication("code", valid_state, db_session)

        assert result["return_url"] == "/patients/42"

    @pytest.mark.asyncio
    async def test_a_linked_user_completes_authentication_normally(
        self, service, db_session, linked_user, stub_sso_provider, valid_state
    ):
        stub_sso_provider(github_login())

        result = await service.complete_authentication("code", valid_state, db_session)

        assert "github_manual_link" not in result
        assert result["is_new_user"] is False
        assert result["user"].id == linked_user.id
        assert result["return_url"] == "/patients/42"


class TestAllowedDomainsWithNoEmail:
    """``SSO_ALLOWED_DOMAINS`` against a provider that exposes no email.

    ``_validate_email_domain`` read ``email.split()`` off ``None``, raising
    AttributeError outside any ``try`` in ``complete_authentication`` - a 500
    before ``_find_or_create_user`` ran at all, so neither the manual-link prompt
    nor the linked-user lookup was reachable on a domain-restricted instance.

    The policy is now explicit: no verifiable domain means refused. Skipping the
    check instead would let any GitHub user bypass the allowlist by making their
    email private.
    """

    STATE = "state-token-domains"

    @pytest.fixture
    def restricted_domains(self, monkeypatch):
        monkeypatch.setattr(settings, "SSO_ALLOWED_DOMAINS", ["example.com"])

    @pytest.fixture
    def valid_state(self):
        _store_state_entry(self.STATE, {"return_url": None})
        return self.STATE

    @pytest.mark.asyncio
    async def test_unlinked_user_is_refused_not_crashed(
        self,
        service,
        db_session,
        local_user,
        github_provider,
        stub_sso_provider,
        valid_state,
        restricted_domains,
    ):
        stub_sso_provider(github_login())

        with pytest.raises(SSOAuthenticationError) as exc:
            await service.complete_authentication("code", valid_state, db_session)

        assert "email" in str(exc.value).lower()

    @pytest.mark.asyncio
    async def test_linked_user_is_refused_too(
        self,
        service,
        db_session,
        linked_user,
        stub_sso_provider,
        valid_state,
        restricted_domains,
    ):
        """Deliberate: an allowlist the account cannot satisfy is not waived by
        having linked earlier. Flagged as a policy call - see the PR notes."""
        stub_sso_provider(github_login())

        with pytest.raises(SSOAuthenticationError):
            await service.complete_authentication("code", valid_state, db_session)

    @pytest.mark.asyncio
    async def test_without_an_allowlist_the_flow_is_untouched(
        self,
        service,
        db_session,
        linked_user,
        stub_sso_provider,
        valid_state,
    ):
        """The default configuration - no allowlist - must be unaffected."""
        stub_sso_provider(github_login())

        result = await service.complete_authentication("code", valid_state, db_session)

        assert result["user"].id == linked_user.id
