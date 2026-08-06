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
    METADATA_URL_ERROR,
    PRIVATE_URL_ERROR,
    classify_url,
    validate_no_ssrf,
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
        ],
    )
    def test_private_and_loopback_are_internal(self, url):
        assert classify_url(url) == "internal"

    @pytest.mark.parametrize("url", ["https://8.8.8.8", "https://1.1.1.1"])
    def test_public_is_none(self, url):
        assert classify_url(url) is None

    def test_unresolvable_is_none(self):
        assert classify_url("https://host.invalid") is None


class TestValidateNoSsrf:
    def test_metadata_blocked_even_when_private_allowed(self):
        with pytest.raises(ValueError) as exc:
            validate_no_ssrf("http://169.254.169.254/", allow_private=True)
        assert str(exc.value) == METADATA_URL_ERROR

    def test_metadata_blocked_when_private_not_allowed(self):
        with pytest.raises(ValueError) as exc:
            validate_no_ssrf("http://169.254.169.254/", allow_private=False)
        assert str(exc.value) == METADATA_URL_ERROR

    def test_internal_blocked_when_not_allowed(self):
        with pytest.raises(ValueError) as exc:
            validate_no_ssrf("http://127.0.0.1:8000", allow_private=False)
        assert str(exc.value) == PRIVATE_URL_ERROR

    def test_internal_allowed_when_allowed(self):
        # Should not raise
        validate_no_ssrf("http://127.0.0.1:8000", allow_private=True)
        validate_no_ssrf("http://192.168.1.5:8000", allow_private=True)

    def test_public_allowed(self):
        validate_no_ssrf("https://8.8.8.8", allow_private=False)

    def test_noop_for_empty(self):
        validate_no_ssrf(None, allow_private=False)
        validate_no_ssrf("", allow_private=False)


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
