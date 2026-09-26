"""Connection-time URL validation for PapraAuth."""

import pytest

from app.services.papra_auth import PapraAuth
from app.services.papra_client import PapraConnectionError


def test_http_to_private_hostname_allowed(monkeypatch, fake_dns):
    monkeypatch.setattr("app.core.config.settings.ALLOW_PRIVATE_INTEGRATION_URLS", True)
    fake_dns({"papra": "172.18.0.5"})
    auth = PapraAuth("http://papra:1221", token="t", organization_id="org_1")
    assert auth.url == "http://papra:1221"


def test_http_to_public_hostname_rejected(fake_dns):
    fake_dns({"papra.example.com": "8.8.8.8"})
    with pytest.raises(PapraConnectionError, match="must use HTTPS"):
        PapraAuth("http://papra.example.com", token="t", organization_id="org_1")
