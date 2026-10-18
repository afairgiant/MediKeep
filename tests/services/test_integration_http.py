"""
Tests for GHSA-3jrc (SSRF via redirects and unpinned integration clients).

Every Paperless/Papra session must connect only to the validated addresses and
refuse any hop - redirects included - that leaves the configured origin.
"""

import ipaddress
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
import pytest_asyncio
from aiohttp import web
from fastapi import HTTPException
from yarl import URL

from app.api.v1.endpoints import paperless as paperless_endpoint
from app.core.utils.integration_http import (
    UNSAFE_REDIRECT_MESSAGE,
    PinnedTarget,
    UnsafeRedirectError,
    _hop_guard,
    build_integration_session,
)
from app.schemas.user_preferences import PaperlessConnectionData
from app.services.paperless_auth import PaperlessAuth
from app.services.paperless_client import PaperlessClient, PaperlessConnectionError
from app.services.paperless_service import (
    PaperlessRedirectError,
    PaperlessServiceToken,
)
from app.services.paperless_task_resolver import PaperlessTaskResolver
from app.services.papra_auth import PapraAuth
from app.services.papra_client import PapraClient, PapraConnectionError

# Real resolution, so pre-fix clients actually reach the server and follow redirects.
HOST = "localhost"
LOOPBACK = (ipaddress.IPv4Address("127.0.0.1"),)


class _Server:
    """Local HTTP server; ``redirect_to`` makes every path except /secret answer 302."""

    def __init__(self):
        self.port = None
        self.redirect_to = None
        self.secret_hits = 0

    @property
    def base_url(self):
        return f"http://{HOST}:{self.port}"

    async def handle(self, request):
        if request.path == "/secret":
            self.secret_hits += 1
            return web.Response(body=b"SECRET")
        if self.redirect_to:
            raise web.HTTPFound(self.redirect_to.format(port=self.port))
        return web.json_response({"ok": True, "organizations": []})


@pytest_asyncio.fixture
async def server(monkeypatch):
    monkeypatch.setattr("app.core.config.settings.ALLOW_PRIVATE_INTEGRATION_URLS", True)
    srv = _Server()
    app = web.Application()
    app.router.add_route("*", "/{tail:.*}", srv.handle)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", 0)
    await site.start()
    srv.port = runner.addresses[0][1]
    try:
        yield srv
    finally:
        await runner.cleanup()


IP_LITERAL_REDIRECT = "http://127.0.0.1:{port}/secret"

OFF_ORIGIN_REDIRECTS = [
    pytest.param(IP_LITERAL_REDIRECT, id="ip-literal"),
    pytest.param(f"http://{HOST}:1/secret", id="other-port"),
    pytest.param("http://169.254.169.254/latest/meta-data/", id="cloud-metadata"),
]


@pytest.mark.asyncio
class TestBuildIntegrationSession:
    async def test_plain_request_succeeds(self, server):
        async with build_integration_session(
            PinnedTarget(server.base_url, LOOPBACK)
        ) as session:
            async with session.get(f"{server.base_url}/api/") as response:
                assert (await response.json())["ok"] is True

    async def test_same_host_redirect_followed(self, server):
        server.redirect_to = f"http://{HOST}:{{port}}/secret"
        async with build_integration_session(
            PinnedTarget(server.base_url, LOOPBACK)
        ) as session:
            async with session.get(f"{server.base_url}/api/") as response:
                assert await response.read() == b"SECRET"

    @pytest.mark.parametrize("target", OFF_ORIGIN_REDIRECTS)
    async def test_off_origin_redirect_refused(self, server, target):
        server.redirect_to = target
        async with build_integration_session(
            PinnedTarget(server.base_url, LOOPBACK)
        ) as session:
            with pytest.raises(UnsafeRedirectError):
                async with session.get(f"{server.base_url}/api/"):
                    pass
        assert server.secret_hits == 0

    async def test_per_request_proxy_refused(self, server):
        async with build_integration_session(
            PinnedTarget(server.base_url, LOOPBACK)
        ) as session:
            with pytest.raises(UnsafeRedirectError):
                async with session.get(
                    f"{server.base_url}/api/", proxy=f"http://127.0.0.1:{server.port}"
                ):
                    pass

    async def test_trust_env_rejected(self, server):
        with pytest.raises(ValueError):
            build_integration_session(
                PinnedTarget(server.base_url, LOOPBACK), trust_env=True
            )

    async def test_connects_to_pinned_address_after_dns_changes(self, server, fake_dns):
        fake_dns({HOST: "8.8.8.8"})
        async with build_integration_session(
            PinnedTarget(server.base_url, LOOPBACK)
        ) as session:
            async with session.get(f"{server.base_url}/api/") as response:
                assert response.status == 200


@pytest.mark.asyncio
class TestHopGuard:
    async def _send(self, guard, url, proxy=None):
        async def handler(_req):
            return "sent"

        return await guard(SimpleNamespace(url=URL(url), proxy=proxy), handler)

    async def test_same_origin_allowed(self):
        guard = _hop_guard(HOST, "http", 8000)
        assert await self._send(guard, f"http://{HOST}:8000/api/") == "sent"

    async def test_https_downgrade_refused(self):
        guard = _hop_guard(HOST, "https", 443)
        with pytest.raises(UnsafeRedirectError):
            await self._send(guard, f"http://{HOST}:443/api/")

    async def test_http_upgrade_on_same_port_refused(self):
        guard = _hop_guard(HOST, "http", 8443)
        with pytest.raises(UnsafeRedirectError):
            await self._send(guard, f"https://{HOST}:8443/api/")

    async def test_proxy_refused(self):
        guard = _hop_guard(HOST, "http", 8000)
        with pytest.raises(UnsafeRedirectError):
            await self._send(
                guard, f"http://{HOST}:8000/api/", proxy=URL("http://10.0.0.1:3128")
            )

    async def test_http_upgrade_to_default_https_port_refused(self):
        guard = _hop_guard(HOST, "http", 80)
        with pytest.raises(UnsafeRedirectError):
            await self._send(guard, f"https://{HOST}/api/")

    async def test_other_port_refused(self):
        guard = _hop_guard(HOST, "http", 8000)
        with pytest.raises(UnsafeRedirectError):
            await self._send(guard, f"http://{HOST}:8001/api/")

    async def test_other_hostname_refused(self):
        guard = _hop_guard(HOST, "http", 80)
        with pytest.raises(UnsafeRedirectError):
            await self._send(guard, "http://evil.example/api/")

    async def test_host_comparison_ignores_case(self):
        guard = _hop_guard(HOST, "https", 443)
        assert await self._send(guard, f"https://{HOST.upper()}/api/") == "sent"


@pytest.mark.asyncio
async def test_pinned_paperless_service_refuses_ip_literal_redirect(server):
    server.redirect_to = IP_LITERAL_REDIRECT
    service = PaperlessServiceToken(server.base_url, "t" * 40, user_id=1)
    await service._create_session()
    try:
        with pytest.raises(UnsafeRedirectError):
            async with service.session.get(f"{server.base_url}/api/"):
                pass
    finally:
        await service._close_session()
    assert server.secret_hits == 0


def _paperless_auth(server):
    return PaperlessAuth(server.base_url, token="t" * 40)


def _papra_auth(server):
    return PapraAuth(server.base_url, token="t", organization_id="org_1")


async def _paperless_download(server):
    async with PaperlessClient(_paperless_auth(server)) as client:
        return await client.download_document("1")


async def _paperless_document_info(server):
    async with PaperlessClient(_paperless_auth(server)) as client:
        return await client.get_document_info("1")


async def _paperless_test_connection(server):
    success, _ = await _paperless_auth(server).test_connection()
    return success


async def _paperless_task_status(server):
    return await PaperlessTaskResolver(_paperless_auth(server))._get_task_status("abc")


async def _paperless_document_exists(server):
    resolver = PaperlessTaskResolver(_paperless_auth(server))
    return await resolver._verify_document_exists("1")


async def _papra_download(server):
    async with PapraClient(_papra_auth(server)) as client:
        return await client.download_document("doc_1")


async def _papra_test_connection(server):
    success, _ = await _papra_auth(server).test_connection()
    return success


async def _papra_list_organizations(server):
    return await _papra_auth(server).list_organizations()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "call",
    [
        _paperless_download,
        _paperless_document_info,
        _paperless_test_connection,
        _paperless_task_status,
        _paperless_document_exists,
        _papra_download,
        _papra_test_connection,
        _papra_list_organizations,
    ],
)
async def test_client_refuses_ip_literal_redirect(server, call):
    server.redirect_to = IP_LITERAL_REDIRECT
    try:
        result = await call(server)
    except (PaperlessConnectionError, PapraConnectionError):
        result = None
    assert not result
    assert server.secret_hits == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("make_auth", [_paperless_auth, _papra_auth])
async def test_auth_test_connection_explains_redirect(server, make_auth):
    server.redirect_to = IP_LITERAL_REDIRECT
    assert await make_auth(server).test_connection() == (
        False,
        UNSAFE_REDIRECT_MESSAGE,
    )


@pytest.mark.asyncio
async def test_paperless_service_test_connection_raises_redirect_error(server):
    server.redirect_to = IP_LITERAL_REDIRECT
    service = PaperlessServiceToken(server.base_url, "t" * 40, user_id=1)
    await service._create_session()
    try:
        with pytest.raises(PaperlessRedirectError):
            await service.test_connection()
    finally:
        await service._close_session()


@pytest.mark.asyncio
async def test_test_connection_endpoint_explains_redirect():
    class RedirectingService:
        async def test_connection(self):
            raise PaperlessRedirectError(UNSAFE_REDIRECT_MESSAGE)

    @asynccontextmanager
    async def fake_factory(*args, **kwargs):
        yield RedirectingService()

    prefs = MagicMock(
        paperless_api_token_encrypted="encrypted-token",
        paperless_username_encrypted=None,
        paperless_password_encrypted=None,
    )
    connection_data = PaperlessConnectionData.model_construct(
        paperless_url="https://paperless.example.com",
        paperless_api_token=None,
        paperless_username=None,
        paperless_password=None,
    )
    with patch.object(
        paperless_endpoint.user_preferences, "get_by_user_id", return_value=prefs
    ), patch.object(paperless_endpoint, "create_paperless_service", fake_factory):
        with pytest.raises(HTTPException) as exc_info:
            await paperless_endpoint.test_paperless_connection(
                connection_data=connection_data,
                current_user=MagicMock(id=2),
                db=MagicMock(),
            )
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == UNSAFE_REDIRECT_MESSAGE


@pytest.mark.asyncio
@pytest.mark.parametrize("call", [_paperless_download, _papra_download])
async def test_client_download_succeeds_without_redirect(server, call):
    assert b'"ok"' in await call(server)


@pytest.mark.asyncio
async def test_paperless_auth_uses_pinned_address(server, fake_dns):
    auth = _paperless_auth(server)
    fake_dns({HOST: "8.8.8.8"})
    success, _ = await auth.test_connection()
    assert success is True


def test_paperless_auth_rejects_unresolved_host(fake_dns):
    fake_dns({})
    with pytest.raises(PaperlessConnectionError, match="could not be resolved"):
        PaperlessAuth("https://paperless.invalid", token="t" * 40)


def test_paperless_auth_rejects_metadata_host(fake_dns):
    fake_dns({"rebind.example": "169.254.169.254"})
    with pytest.raises(PaperlessConnectionError, match="cloud-metadata"):
        PaperlessAuth("http://rebind.example", token="t" * 40)
