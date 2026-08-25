"""The API must expose its rate-limit headers to cross-origin JavaScript.

A 429 is only actionable if the client can read how long to wait. Requests are
same-origin in production, so this is invisible there -- but the dev server on
:3000 talks to the API on :8000, and `simpleAuthService.makeRequest` tries that
direct origin first. Anything missing from the CORS expose list therefore reads
as null throughout development while working in production, which is the shape of
bug that survives the entire time a feature is being built.

Note these assertions need an `Origin` header. Starlette's CORSMiddleware emits
nothing at all for a same-origin request, so a test without one passes vacuously
no matter what the expose list contains.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings

RATE_LIMIT_HEADERS = [
    "Retry-After",
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
    "X-Error-Code",
]


@pytest.fixture(scope="module")
def allowed_origin() -> str:
    """An origin the CORS middleware will actually answer for.

    Read rather than hardcoded: the middleware only answers for an allowed
    origin, so a hardcoded value silently stops testing anything if the default
    changes. A fixture rather than a module constant because
    `CORS_ALLOWED_ORIGINS` can be configured empty -- subscripting at import time
    turned that into an IndexError during collection, failing the whole module
    instead of skipping it.
    """
    origins = settings.CORS_ALLOWED_ORIGINS
    if not origins:
        pytest.skip("CORS_ALLOWED_ORIGINS is empty -- no origin to assert against")
    return origins[0]


@pytest.fixture(scope="module")
def exposed_headers(allowed_origin: str) -> set:
    """The exposed-header set, fetched once.

    Module-scoped deliberately. The answer is middleware configuration and cannot
    vary between cases, so fetching per case meant six identical trips through
    the full stack -- each also building and tearing down a database session via
    the function-scoped `client` fixture, for a request that touches no database.

    Builds its own client rather than taking the `client` fixture, which is
    function-scoped and cannot be depended on from module scope.
    """
    from app.main import app

    with TestClient(app) as module_client:
        response = module_client.get(
            "/api/v1/auth/sso/config", headers={"Origin": allowed_origin}
        )

    assert response.status_code == 200
    raw = response.headers.get("access-control-expose-headers", "")
    assert raw, "CORS middleware exposed nothing -- is the Origin still allowed?"
    return {value.strip().lower() for value in raw.split(",")}


@pytest.mark.parametrize("header", RATE_LIMIT_HEADERS)
def test_rate_limit_header_is_exposed(exposed_headers: set, header: str):
    """Each header a 429 carries must be readable cross-origin."""
    assert header.lower() in exposed_headers


def test_existing_exposed_headers_are_preserved(exposed_headers: set):
    """The additions must not have replaced what was already exposed."""
    assert "x-request-id" in exposed_headers
    assert "content-disposition" in exposed_headers
