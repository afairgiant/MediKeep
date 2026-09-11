"""Cover for the trusted-proxy client IP resolution.

The property under test is that a caller cannot choose its own value. Every case
here is really one question asked twice: with the peer trusted, and with it not.
"""

import ipaddress
import logging

import pytest

from app.core.config import _parse_trusted_proxies, settings
from app.core.startup import _log_client_ip_resolution
from app.core.utils.client_ip import get_client_ip

STARTUP_LOGGER = "medical_records.app.core.startup"


class FakeRequest:
    """Minimal stand-in for a Request - get_client_ip reads headers and client."""

    class _Client:
        def __init__(self, host):
            self.host = host

    def __init__(self, headers=None, host="203.0.113.7"):
        self.headers = headers or {}
        self.client = self._Client(host) if host else None


@pytest.fixture
def trust(monkeypatch):
    """Trust the given CIDRs for the duration of one test."""

    def apply(*cidrs):
        networks = [ipaddress.ip_network(cidr) for cidr in cidrs]
        monkeypatch.setattr(settings, "TRUSTED_PROXY_NETWORKS", networks)

    return apply


class TestUntrustedPeer:
    """A peer outside the trust set - and TRUSTED_PROXY_IPS=none, which empties it."""

    def test_x_forwarded_for_is_ignored(self, trust):
        trust()
        request = FakeRequest({"x-forwarded-for": "198.51.100.4"})

        assert get_client_ip(request) == "203.0.113.7"

    def test_x_real_ip_is_ignored(self, trust):
        trust()
        request = FakeRequest({"x-real-ip": "198.51.100.9"})

        assert get_client_ip(request) == "203.0.113.7"

    def test_headers_from_an_untrusted_peer_are_ignored(self, trust):
        trust("10.0.0.0/8")
        request = FakeRequest({"x-forwarded-for": "198.51.100.4"}, host="203.0.113.7")

        assert get_client_ip(request) == "203.0.113.7"

    def test_returns_unknown_without_a_client(self, trust):
        trust()

        assert get_client_ip(FakeRequest(host=None)) == "unknown"


class TestTrustedPeer:
    def test_x_forwarded_for_is_honored(self, trust):
        trust("10.0.0.0/8")
        request = FakeRequest({"x-forwarded-for": "198.51.100.4"}, host="10.0.0.1")

        assert get_client_ip(request) == "198.51.100.4"

    def test_x_real_ip_is_honored_when_forwarded_for_is_absent(self, trust):
        trust("10.0.0.0/8")
        request = FakeRequest({"x-real-ip": "198.51.100.9"}, host="10.0.0.1")

        assert get_client_ip(request) == "198.51.100.9"

    def test_ipv6_peers_and_clients_resolve(self, trust):
        trust("fd00::/8")
        request = FakeRequest({"x-forwarded-for": "2001:db8::5"}, host="fd00::1")

        assert get_client_ip(request) == "2001:db8::5"


class TestForwardedChain:
    """Right-to-left: only the rightmost entries were written by peers we trust."""

    def test_the_last_untrusted_hop_wins(self, trust):
        trust("10.0.0.0/8")
        # The client claimed a hop of its own before reaching our proxy.
        request = FakeRequest(
            {"x-forwarded-for": "192.0.2.1, 198.51.100.4, 10.0.0.2"}, host="10.0.0.1"
        )

        assert get_client_ip(request) == "198.51.100.4"

    def test_garbage_entries_are_skipped(self, trust):
        trust("10.0.0.0/8")
        request = FakeRequest(
            {"x-forwarded-for": "198.51.100.4, not-an-ip"}, host="10.0.0.1"
        )

        assert get_client_ip(request) == "198.51.100.4"

    def test_an_entirely_unreadable_header_falls_back_to_the_peer(self, trust):
        trust("10.0.0.0/8")
        request = FakeRequest({"x-forwarded-for": "nonsense"}, host="10.0.0.1")

        assert get_client_ip(request) == "10.0.0.1"

    def test_an_all_trusted_chain_falls_back_to_the_peer(self, trust):
        trust("10.0.0.0/8")
        request = FakeRequest(
            {"x-forwarded-for": "10.0.0.2, 10.0.0.3"}, host="10.0.0.1"
        )

        assert get_client_ip(request) == "10.0.0.1"


class TestTheDefault:
    """Unset means private ranges: a proxied install keeps working untouched."""

    @pytest.fixture(autouse=True)
    def shipped_default(self, monkeypatch):
        networks, _ = _parse_trusted_proxies("")
        monkeypatch.setattr(settings, "TRUSTED_PROXY_NETWORKS", networks)

    def test_a_proxy_on_a_docker_network_is_believed(self):
        request = FakeRequest({"x-forwarded-for": "198.51.100.4"}, host="172.18.0.5")

        assert get_client_ip(request) == "198.51.100.4"

    def test_a_proxy_on_the_same_host_is_believed(self):
        request = FakeRequest({"x-forwarded-for": "198.51.100.4"}, host="127.0.0.1")

        assert get_client_ip(request) == "198.51.100.4"

    def test_a_caller_on_the_public_internet_is_not(self):
        """The header a directly-exposed instance receives is unsigned noise."""
        request = FakeRequest({"x-forwarded-for": "10.0.0.9"}, host="203.0.113.7")

        assert get_client_ip(request) == "203.0.113.7"


class TestBehindACDN:
    """Cloudflare in front of the deployment's own reverse proxy - the common
    homelab shape, which must keep resolving the visitor with no configuration."""

    @pytest.fixture(autouse=True)
    def shipped_default(self, monkeypatch):
        networks, _ = _parse_trusted_proxies("")
        monkeypatch.setattr(settings, "TRUSTED_PROXY_NETWORKS", networks)

    def test_the_visitor_behind_a_cloudflare_edge_is_found(self):
        request = FakeRequest(
            {"x-forwarded-for": "198.51.100.4, 172.68.10.2"}, host="172.18.0.5"
        )

        assert get_client_ip(request) == "198.51.100.4"

    def test_an_ipv6_edge_is_skipped_too(self):
        request = FakeRequest(
            {"x-forwarded-for": "198.51.100.4, 2606:4700::1"}, host="172.18.0.5"
        )

        assert get_client_ip(request) == "198.51.100.4"

    def test_a_forged_prefix_is_still_discarded(self):
        """The CDN appends the address it saw, so the forgery stays to its left."""
        request = FakeRequest(
            {"x-forwarded-for": "1.2.3.4, 198.51.100.4, 172.68.10.2"},
            host="172.18.0.5",
        )

        assert get_client_ip(request) == "198.51.100.4"

    def test_a_cdn_edge_is_not_trusted_as_a_peer(self):
        """Someone else's Cloudflare account pointed at this origin: headers ignored.

        Skipping an edge mid-chain says our own proxy vouched for it. A request
        arriving *from* one carries no such vouching.
        """
        request = FakeRequest({"x-forwarded-for": "1.2.3.4"}, host="172.68.10.2")

        assert get_client_ip(request) == "172.68.10.2"


class TestParsingTheSetting:
    """An entry this cannot read is dropped, never trusted, and never fatal."""

    def test_a_cidr_and_a_bare_address_both_parse(self):
        networks, rejected = _parse_trusted_proxies("10.0.0.0/8, 192.168.1.5")

        assert [str(n) for n in networks] == ["10.0.0.0/8", "192.168.1.5/32"]
        assert rejected == []

    def test_ipv6_parses(self):
        networks, rejected = _parse_trusted_proxies("fd00::/8")

        assert [str(n) for n in networks] == ["fd00::/8"]
        assert rejected == []

    def test_host_bits_are_tolerated(self):
        """`10.0.0.1/8` is what an operator writes; refusing it helps nobody."""
        networks, rejected = _parse_trusted_proxies("10.0.0.1/8")

        assert [str(n) for n in networks] == ["10.0.0.0/8"]
        assert rejected == []

    def test_blank_entries_are_skipped(self):
        networks, rejected = _parse_trusted_proxies("10.0.0.0/8, , ")

        assert [str(n) for n in networks] == ["10.0.0.0/8"]
        assert rejected == []

    def test_an_unset_value_trusts_the_private_ranges(self):
        networks, rejected = _parse_trusted_proxies("")

        assert "10.0.0.0/8" in [str(n) for n in networks]
        assert "127.0.0.0/8" in [str(n) for n in networks]
        assert rejected == []

    def test_none_trusts_nothing(self):
        assert _parse_trusted_proxies("none") == ([], [])
        assert _parse_trusted_proxies("NONE") == ([], [])

    def test_an_explicit_value_replaces_the_defaults(self):
        """Pinning one proxy must not leave every other private peer trusted."""
        networks, _ = _parse_trusted_proxies("172.18.0.5")

        assert [str(n) for n in networks] == ["172.18.0.5/32"]

    def test_an_unreadable_entry_is_reported_not_trusted(self):
        networks, rejected = _parse_trusted_proxies("10.0.0.0/8, not-a-cidr")

        assert [str(n) for n in networks] == ["10.0.0.0/8"]
        assert rejected == ["not-a-cidr"]


class TestStartupReporting:
    """`docker logs` is the whole diagnostic surface for a self-hosted instance."""

    @pytest.fixture
    def configured(self, monkeypatch):
        """Set the raw value and everything derived from it, as a boot would."""

        def apply(raw):
            networks, rejected = _parse_trusted_proxies(raw)
            monkeypatch.setattr(settings, "TRUSTED_PROXY_IPS", raw)
            monkeypatch.setattr(settings, "TRUSTED_PROXY_NETWORKS", networks)
            monkeypatch.setattr(settings, "TRUSTED_PROXY_PARSE_ERRORS", rejected)

        return apply

    def test_it_names_the_default_when_nothing_is_configured(self, caplog, monkeypatch):
        monkeypatch.setattr(settings, "TRUSTED_PROXY_IPS", "")
        monkeypatch.setattr(settings, "TRUSTED_PROXY_PARSE_ERRORS", [])

        with caplog.at_level(logging.INFO, logger=STARTUP_LOGGER):
            _log_client_ip_resolution()

        assert "private ranges (default)" in caplog.text

    def test_it_says_when_the_operator_has_pinned_a_proxy(self, caplog, configured):
        configured("10.0.0.0/8")

        with caplog.at_level(logging.INFO, logger=STARTUP_LOGGER):
            _log_client_ip_resolution()

        assert "TRUSTED_PROXY_IPS" in caplog.text
        assert "1 network(s)" in caplog.text

    def test_an_unreadable_entry_is_warned_about_by_name(self, caplog, configured):
        configured("not-a-cidr")

        with caplog.at_level(logging.WARNING, logger=STARTUP_LOGGER):
            _log_client_ip_resolution()

        assert "not-a-cidr" in caplog.text
        events = [getattr(record, "event", None) for record in caplog.records]
        assert "trusted_proxy_entry_unreadable" in events

    def test_an_unreadable_entry_does_not_fail_the_boot(self, configured):
        configured("nonsense")

        _log_client_ip_resolution()
