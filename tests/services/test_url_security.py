"""
Tests for GHSA-8j33 (SSRF via integration URLs).

Covers the tiered url_security helper and the Pydantic schema validators that
gate user-configured Paperless/Papra URLs.

Tiering:
* link-local / cloud-metadata (169.254.x) -> always blocked
* private/loopback (10/172.16/192.168, 127.x) -> allowed by default, blocked
  only when ALLOW_PRIVATE_INTEGRATION_URLS is False
* public -> always allowed
"""

import pytest
from pydantic import ValidationError

from app.core.utils.url_security import (
    INSECURE_URL_ERROR,
    METADATA_URL_ERROR,
    PRIVATE_URL_ERROR,
    UNRESOLVED_URL_ERROR,
    classify_url,
    validate_integration_url,
)
from app.schemas.user_preferences import PaperlessConnectionData, PapraConnectionData


class TestClassifyUrl:
    @pytest.mark.parametrize(
        "url",
        [
            "http://169.254.169.254/latest/meta-data/",  # cloud metadata
            "http://169.254.1.1:8000",  # link-local
        ],
    )
    def test_link_local_and_metadata_are_metadata(self, url):
        assert classify_url(url) == "metadata"

    @pytest.mark.parametrize(
        "url",
        [
            "http://127.0.0.1:8000",
            "http://localhost:8000",
            "http://10.0.0.5:5432",
            "http://192.168.1.10:9000",
            "http://172.18.0.2:8080",  # docker default range
            "http://100.64.0.1:8000",  # CGNAT shared address space (not routable)
        ],
    )
    def test_private_and_loopback_are_internal(self, url):
        assert classify_url(url) == "internal"

    @pytest.mark.parametrize("url", ["https://8.8.8.8", "https://1.1.1.1"])
    def test_public_is_public(self, url):
        assert classify_url(url) == "public"

    def test_unresolvable_is_indeterminate(self):
        assert classify_url("https://host.invalid") == "indeterminate"


class TestAddressTiers:
    def test_metadata_blocked_even_when_private_allowed(self):
        with pytest.raises(ValueError) as exc:
            validate_integration_url("http://169.254.169.254/", allow_private=True)
        assert str(exc.value) == METADATA_URL_ERROR

    def test_metadata_blocked_when_private_not_allowed(self):
        with pytest.raises(ValueError) as exc:
            validate_integration_url("http://169.254.169.254/", allow_private=False)
        assert str(exc.value) == METADATA_URL_ERROR

    def test_internal_blocked_when_not_allowed(self):
        with pytest.raises(ValueError) as exc:
            validate_integration_url("http://127.0.0.1:8000", allow_private=False)
        assert str(exc.value) == PRIVATE_URL_ERROR

    def test_internal_allowed_when_allowed(self):
        # Should not raise
        validate_integration_url("http://127.0.0.1:8000", allow_private=True)
        validate_integration_url("http://192.168.1.5:8000", allow_private=True)

    def test_public_allowed(self):
        validate_integration_url("https://8.8.8.8", allow_private=False)

    def test_shared_cgnat_blocked_when_not_allowed(self):
        # 100.64.0.0/10 is not globally routable -> treated as internal and
        # blocked when private addresses are not allowed
        with pytest.raises(ValueError) as exc:
            validate_integration_url("http://100.64.0.1:8000", allow_private=False)
        assert str(exc.value) == PRIVATE_URL_ERROR

    def test_shared_cgnat_allowed_when_allowed(self):
        validate_integration_url("http://100.64.0.1:8000", allow_private=True)

    def test_unresolved_rejected_by_default(self):
        # Fail closed: an unresolvable host is indeterminate, not "allowed"
        with pytest.raises(ValueError) as exc:
            validate_integration_url("https://host.invalid", allow_private=True)
        assert str(exc.value) == UNRESOLVED_URL_ERROR

    def test_unresolved_allowed_when_opted_in(self):
        # Save-time validators may accept indeterminate results
        validate_integration_url(
            "https://host.invalid", allow_private=True, allow_unresolved=True
        )

    def test_noop_for_empty(self):
        validate_integration_url(None, allow_private=False)
        validate_integration_url("", allow_private=False)


_FAKE_DNS = {
    "paperless-container": "172.18.0.5",
    "nas.lan": "192.168.1.2",
    "ts-host": "100.100.1.1",
    "public.example": "8.8.8.8",
}


@pytest.fixture
def dns(fake_dns):
    fake_dns(_FAKE_DNS)


@pytest.mark.usefixtures("dns")
class TestHttpRule:
    @pytest.mark.parametrize(
        "url",
        [
            "http://paperless-container:8000",  # issue #1056
            "http://nas.lan",
            "http://ts-host:3000",
            "http://127.0.0.1:8000",
            "https://public.example",
            "https://paperless-container:8000",
        ],
    )
    def test_accepted(self, url):
        validate_integration_url(url, allow_private=True)

    def test_http_to_public_host_rejected(self):
        with pytest.raises(ValueError) as exc:
            validate_integration_url("http://public.example", allow_private=True)
        assert str(exc.value) == INSECURE_URL_ERROR

    def test_http_to_public_ip_rejected(self):
        with pytest.raises(ValueError) as exc:
            validate_integration_url("http://8.8.8.8", allow_private=False)
        assert str(exc.value) == INSECURE_URL_ERROR

    def test_http_unresolved_accepted_when_opted_in(self):
        validate_integration_url(
            "http://host.invalid", allow_private=True, allow_unresolved=True
        )

    def test_http_unresolved_reports_unresolved_not_https(self):
        with pytest.raises(ValueError) as exc:
            validate_integration_url("http://paperless-typo:8000", allow_private=True)
        assert str(exc.value) == UNRESOLVED_URL_ERROR

    def test_https_unresolved_rejected_by_default(self):
        with pytest.raises(ValueError) as exc:
            validate_integration_url("https://host.invalid", allow_private=True)
        assert str(exc.value) == UNRESOLVED_URL_ERROR

    def test_private_host_reports_lockdown_not_https(self):
        with pytest.raises(ValueError) as exc:
            validate_integration_url(
                "http://paperless-container:8000", allow_private=False
            )
        assert str(exc.value) == PRIVATE_URL_ERROR


class TestSchemaValidation:
    """Default config allows private (ALLOW_PRIVATE_INTEGRATION_URLS=True)."""

    def test_paperless_accepts_private_by_default(self, monkeypatch):
        monkeypatch.setattr(
            "app.core.config.settings.ALLOW_PRIVATE_INTEGRATION_URLS", True
        )
        data = PaperlessConnectionData(
            paperless_url="http://127.0.0.1:8000",
            paperless_api_token="dummytoken123",
        )
        assert data.paperless_url == "http://127.0.0.1:8000"

    def test_papra_accepts_private_by_default(self, monkeypatch):
        monkeypatch.setattr(
            "app.core.config.settings.ALLOW_PRIVATE_INTEGRATION_URLS", True
        )
        data = PapraConnectionData(
            papra_url="http://10.0.0.5:3000",
            papra_api_token="dummytoken123",
            papra_organization_id="org_1",
        )
        assert data.papra_url == "http://10.0.0.5:3000"

    def test_metadata_rejected_even_by_default(self):
        # https so it clears the HTTPS-for-external check and reaches SSRF logic
        with pytest.raises(ValidationError) as exc:
            PaperlessConnectionData(
                paperless_url="https://169.254.169.254/",
                paperless_api_token="dummytoken123",
            )
        message = str(exc.value).lower()
        assert "metadata" in message or "link-local" in message

    def test_public_accepted(self):
        data = PaperlessConnectionData(
            paperless_url="https://8.8.8.8",
            paperless_api_token="dummytoken123",
        )
        assert data.paperless_url == "https://8.8.8.8"

    def test_lockdown_rejects_private(self, monkeypatch):
        monkeypatch.setattr(
            "app.core.config.settings.ALLOW_PRIVATE_INTEGRATION_URLS", False
        )
        with pytest.raises(ValidationError) as exc:
            PaperlessConnectionData(
                paperless_url="http://127.0.0.1:8000",
                paperless_api_token="dummytoken123",
            )
        assert "private" in str(exc.value).lower()

    @pytest.mark.usefixtures("dns")
    def test_paperless_accepts_docker_service_name_over_http(self, monkeypatch):
        monkeypatch.setattr(
            "app.core.config.settings.ALLOW_PRIVATE_INTEGRATION_URLS", True
        )
        data = PaperlessConnectionData(
            paperless_url="http://paperless-container:8000",
            paperless_api_token="dummytoken123",
        )
        assert data.paperless_url == "http://paperless-container:8000"

    @pytest.mark.usefixtures("dns")
    def test_http_to_public_host_rejected(self):
        with pytest.raises(ValidationError) as exc:
            PaperlessConnectionData(
                paperless_url="http://public.example",
                paperless_api_token="dummytoken123",
            )
        assert "https" in str(exc.value).lower()
