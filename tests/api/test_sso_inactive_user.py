"""A deactivated user signing in via SSO must be told so, not shown a 500.

`_check_user_active` raises UnauthorizedException from inside each SSO endpoint's
try block, and the broad `except Exception` underneath converted it into
`500 SSO authentication failed`. The account was refused - correctly - but the
message said the identity provider had failed.

This blocks more than tidiness. The redirect design rejects a silent bounce back to
the IdP specifically because it "completely hides the deactivated-account case", so
the error page the frontend is about to grow has nothing accurate to render until
the status code tells the truth.

All three login endpoints are tested separately: each carries its own try/except and
a fix applied to one is easy to miss on the others.
"""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.api.v1.endpoints import sso as sso_endpoint
from app.services import sso_service as sso_module

CALLBACK_URL = "/api/v1/auth/sso/callback"
RESOLVE_CONFLICT_URL = "/api/v1/auth/sso/resolve-conflict"
RESOLVE_GITHUB_URL = "/api/v1/auth/sso/resolve-github-link"

DEACTIVATED = "deactivated"


pytestmark = pytest.mark.usefixtures("clean_sso_state")


@pytest.fixture
def inactive_user(make_sso_user):
    return make_sso_user(username="inactivessouser", is_active=False)


@pytest.fixture
def sso_result(inactive_user):
    """What a service call returns once authentication itself has succeeded.

    The user really is deactivated in the database; only the outbound IdP work is
    replaced. What is under test is the endpoint's exception handling, so the
    service is stubbed as the collaborator it is.
    """
    return {"user": inactive_user, "is_new_user": False, "auth_method": "sso"}


@pytest.fixture
def callback_flow(sso_result):
    """A /callback that reaches _check_user_active with a real inactive user."""
    with patch.object(sso_module.settings, "SSO_ENABLED", True):
        with patch.object(sso_module, "create_sso_provider") as factory:
            factory.return_value.get_auth_url.return_value = "https://idp/authorize"

            async def exchange(_code):
                return {"access_token": "token"}

            async def user_info(_token):
                class Info:
                    sub = "external-inactivessouser"
                    email = "inactivessouser@example.com"
                    name = "Inactive SSO User"

                return Info()

            factory.return_value.exchange_code_for_token = exchange
            factory.return_value.get_user_info = user_info

            with patch.object(
                sso_module.SSOService, "_find_or_create_user", return_value=sso_result
            ):
                yield


def assert_deactivation_response(response):
    assert (
        response.status_code == 401
    ), "not a 500 - the account was refused, not the IdP"
    assert DEACTIVATED in response.json()["message"].lower()


class TestCallback:
    def test_a_deactivated_user_gets_the_deactivation_message(
        self, client: TestClient, callback_flow
    ):
        initiate = client.post("/api/v1/auth/sso/initiate")
        state = initiate.json()["state"]

        response = client.post(CALLBACK_URL, json={"code": "authcode", "state": state})

        assert_deactivation_response(response)

    def test_an_unexpected_error_is_still_a_500(
        self, client: TestClient, callback_flow
    ):
        """The broad handler still does its job for genuine failures."""
        with patch.object(
            sso_module.SSOService,
            "complete_authentication",
            side_effect=RuntimeError("boom"),
        ):
            response = client.post(
                CALLBACK_URL, json={"code": "authcode", "state": "anything"}
            )

        assert response.status_code == 500


class TestResolveConflict:
    def test_a_deactivated_user_gets_the_deactivation_message(
        self, client: TestClient, sso_result
    ):
        with patch.object(
            sso_endpoint.sso_service,
            "resolve_account_conflict",
            return_value=sso_result,
        ):
            response = client.post(
                RESOLVE_CONFLICT_URL,
                json={
                    "temp_token": "token",
                    "action": "link",
                    "preference": "auto_link",
                },
            )

        assert_deactivation_response(response)


class TestResolveGitHubLink:
    def test_a_deactivated_user_gets_the_deactivation_message(
        self, client: TestClient, sso_result
    ):
        with patch.object(
            sso_endpoint.sso_service,
            "resolve_github_manual_link",
            return_value=sso_result,
        ):
            response = client.post(
                RESOLVE_GITHUB_URL,
                json={
                    "temp_token": "token",
                    "username": "inactivessouser",
                    "password": "irrelevant",
                },
            )

        assert_deactivation_response(response)
