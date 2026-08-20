"""The return_url given to /initiate is carried through to the /callback response.

Ships inert - no frontend reads this field yet. Deep links currently survive SSO via
sessionStorage, which does not work in private browsing; the consumer for this field
is a later PR (SSO_ONLY_MODE_SPEC.md 8.8). Tested now because the field is easy to
drop silently while nothing depends on it.
"""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.models.models import User
from app.services import sso_service as sso_module
from app.services.sso_service import _state_storage

INITIATE_URL = "/api/v1/auth/sso/initiate"
CALLBACK_URL = "/api/v1/auth/sso/callback"


pytestmark = pytest.mark.usefixtures("clean_sso_state")


@pytest.fixture
def sso_user(make_sso_user) -> User:
    return make_sso_user(username="returnurluser")


@pytest.fixture
def sso_flow(sso_user):
    """SSO enabled, with the provider and token exchange stubbed out.

    The state entry is real - only the outbound IdP calls are replaced - so the
    return_url genuinely travels through the state store.
    """
    with patch.object(sso_module.settings, "SSO_ENABLED", True):
        with patch.object(sso_module, "create_sso_provider") as factory:
            factory.return_value.get_auth_url.return_value = "https://idp/authorize"
            with patch.object(
                sso_module.SSOService,
                "_find_or_create_user",
                return_value={
                    "user": sso_user,
                    "is_new_user": False,
                    "auth_method": "sso",
                },
            ):
                yield factory


def stub_token_exchange(factory):
    """Make the provider return a token and user info without network access."""
    provider = factory.return_value

    async def exchange(_code):
        return {"access_token": "token"}

    async def user_info(_token):
        class Info:
            sub = "external-returnurl"
            email = "returnurluser@example.com"
            name = "Return URL User"

        return Info()

    provider.exchange_code_for_token = exchange
    provider.get_user_info = user_info


def test_callback_returns_the_return_url_that_initiate_was_given(
    client: TestClient, sso_flow
):
    stub_token_exchange(sso_flow)

    initiate = client.post(INITIATE_URL, params={"return_url": "/patients/42"})
    state = initiate.json()["state"]

    response = client.post(CALLBACK_URL, json={"code": "authcode", "state": state})

    assert response.status_code == 200
    assert response.json()["return_url"] == "/patients/42"


def test_flow_started_without_a_return_url_yields_null(client: TestClient, sso_flow):
    stub_token_exchange(sso_flow)

    initiate = client.post(INITIATE_URL)
    state = initiate.json()["state"]

    response = client.post(CALLBACK_URL, json={"code": "authcode", "state": state})

    assert response.status_code == 200
    assert response.json()["return_url"] is None


def test_the_state_entry_is_still_single_use(client: TestClient, sso_flow):
    stub_token_exchange(sso_flow)

    initiate = client.post(INITIATE_URL, params={"return_url": "/patients/42"})
    state = initiate.json()["state"]

    first = client.post(CALLBACK_URL, json={"code": "authcode", "state": state})
    second = client.post(CALLBACK_URL, json={"code": "authcode", "state": state})

    assert first.status_code == 200
    assert second.status_code != 200
    assert state not in _state_storage
