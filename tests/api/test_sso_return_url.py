"""The return_url given to /initiate is carried through to the /callback response.

The frontend now consumes this field, and validates it before navigating. This module
also covers the server-side half of that guard: a value that is not a root-relative
internal path is refused at /initiate, so it is never written into the state store and
any future consumer inherits the guarantee.

A client-only check is defeated by anyone talking to the API directly, and the value
is consumed at the highest-trust moment in the app - immediately after a successful
sign-in.
"""

import logging
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.api.v1.endpoints import sso as sso_endpoint
from app.models.models import User
from app.services import sso_service as sso_module
from app.services.sso_service import _state_storage

INITIATE_URL = "/api/v1/auth/sso/initiate"
CALLBACK_URL = "/api/v1/auth/sso/callback"

SSO_ENDPOINT_LOGGER = "medical_records.sso.api.v1.endpoints.sso"


pytestmark = pytest.mark.usefixtures("clean_sso_state")


@pytest.fixture(autouse=True)
def fresh_rate_limiter():
    """Clear the per-IP counter on /initiate around every test in this module.

    The limiter is a module-scope singleton keyed by client IP, and every test here
    calls the same endpoint from the same address, so without this the later tests
    in the file are throttled by the earlier ones.
    """
    sso_endpoint._initiate_limiter.reset()
    yield
    sso_endpoint._initiate_limiter.reset()


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


HOSTILE_RETURN_URLS = [
    "https://evil.example",
    # The forms a naive startswith("/") check waves through.
    "//evil.example",
    # And the ones urlsplit itself waves through: it reports a netloc only for
    # exactly two leading slashes, while a browser skips every leading slash and
    # resolves all of these off-origin.
    "///evil.example",
    "////evil.example",
    "/\\evil.example",
    "../admin",
    "javascript:alert(1)",
]


@pytest.mark.parametrize("hostile", HOSTILE_RETURN_URLS)
def test_a_non_internal_return_url_is_refused(
    client: TestClient, sso_flow, hostile: str
):
    response = client.post(INITIATE_URL, params={"return_url": hostile})

    # 400, specifically. The endpoint's broad `except Exception` re-reports anything
    # raised inside its try block as a 500, so a test asserting only "not 200" would
    # pass against a guard written in the wrong place.
    assert response.status_code == 400


@pytest.mark.parametrize("hostile", HOSTILE_RETURN_URLS)
def test_a_refused_return_url_mints_no_state_entry(
    client: TestClient, sso_flow, hostile: str
):
    """The point of the exercise: a hostile value never enters the store."""
    client.post(INITIATE_URL, params={"return_url": hostile})

    assert _state_storage == {}


def test_the_refusal_is_logged_as_a_security_event(
    client: TestClient, sso_flow, caplog
):
    with caplog.at_level(logging.INFO, logger=SSO_ENDPOINT_LOGGER):
        client.post(INITIATE_URL, params={"return_url": "https://evil.example"})

    events = [getattr(record, "event", None) for record in caplog.records]
    assert "sso_return_url_rejected" in events


def test_the_rate_limit_is_checked_before_the_return_url(
    client: TestClient, sso_flow, limiter_ceiling
):
    """Deliberate ordering: a caller probing this endpoint burns its quota."""
    limiter_ceiling(sso_endpoint._initiate_limiter, 1)
    client.post(INITIATE_URL, params={"return_url": "/dashboard"})

    response = client.post(INITIATE_URL, params={"return_url": "https://evil.example"})

    assert response.status_code == 429


@pytest.mark.parametrize("value", ["/patients/42", "/lab-results?status=open", "/"])
def test_internal_paths_are_still_accepted(client: TestClient, sso_flow, value: str):
    assert client.post(INITIATE_URL, params={"return_url": value}).status_code == 200


def test_an_empty_return_url_is_treated_as_absent(client: TestClient, sso_flow):
    """`?return_url=` means "no deep link", not a value to reject.

    FastAPI binds a bare parameter to "" rather than None, so a `is not None` guard
    sends it to is_safe_return_url, which refuses it. A client that appends the
    parameter unconditionally would then be unable to start SSO at all - and under
    SSO_ONLY_MODE it has no password login to fall back to.
    """
    response = client.post(INITIATE_URL, params={"return_url": ""})

    assert response.status_code == 200


def test_an_empty_return_url_carries_through_as_null(client: TestClient, sso_flow):
    stub_token_exchange(sso_flow)

    initiate = client.post(INITIATE_URL, params={"return_url": ""})
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
