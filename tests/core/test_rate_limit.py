"""Unit tests for the shared sliding-window rate limiter.

The limiter backs three endpoints with different keys (IP and user id), so the
boundary behavior is tested here once rather than at each call site.
"""

from unittest.mock import patch

import pytest

from app.core.utils.rate_limit import SlidingWindowRateLimiter, get_client_ip


@pytest.fixture
def limiter():
    return SlidingWindowRateLimiter(max_requests=3, window_seconds=60)


class FakeRequest:
    """Minimal stand-in for a Request - get_client_ip reads headers and client."""

    class _Client:
        def __init__(self, host):
            self.host = host

    def __init__(self, headers=None, host="203.0.113.7"):
        self.headers = headers or {}
        self.client = self._Client(host) if host else None


class TestLimitBoundary:
    def test_requests_up_to_the_limit_are_allowed(self, limiter):
        assert [limiter.is_allowed("k") for _ in range(3)] == [True, True, True]

    def test_one_over_the_limit_is_rejected(self, limiter):
        for _ in range(3):
            limiter.is_allowed("k")

        assert limiter.is_allowed("k") is False

    def test_rejection_does_not_extend_the_window(self, limiter):
        """A rejected request must not be recorded, or the window would never drain."""
        for _ in range(3):
            limiter.is_allowed("k")
        first_reset = limiter.get_reset_time("k")

        limiter.is_allowed("k")

        assert limiter.get_reset_time("k") == first_reset

    def test_keys_are_independent(self, limiter):
        for _ in range(3):
            limiter.is_allowed("first")

        assert limiter.is_allowed("second") is True


class TestWindowExpiry:
    def test_first_request_after_a_full_window_is_allowed(self, limiter):
        with patch("app.core.utils.rate_limit.time.time", return_value=1000.0):
            for _ in range(3):
                limiter.is_allowed("k")
            assert limiter.is_allowed("k") is False

        with patch("app.core.utils.rate_limit.time.time", return_value=1061.0):
            assert limiter.is_allowed("k") is True

    def test_partial_window_expiry_frees_exactly_one_slot(self, limiter):
        with patch("app.core.utils.rate_limit.time.time", return_value=1000.0):
            limiter.is_allowed("k")
        with patch("app.core.utils.rate_limit.time.time", return_value=1030.0):
            limiter.is_allowed("k")
            limiter.is_allowed("k")

        # At t=1061 only the first request has aged out.
        with patch("app.core.utils.rate_limit.time.time", return_value=1061.0):
            assert limiter.is_allowed("k") is True
            assert limiter.is_allowed("k") is False

    def test_pruned_to_empty_key_is_deleted(self, limiter):
        """Idle keys must not accumulate - this is why it is not a defaultdict."""
        with patch("app.core.utils.rate_limit.time.time", return_value=1000.0):
            limiter.is_allowed("k")
        assert "k" in limiter._requests

        with patch("app.core.utils.rate_limit.time.time", return_value=1061.0):
            limiter.get_remaining_requests("k")

        assert "k" not in limiter._requests

    def test_unseen_key_creates_no_entry(self, limiter):
        limiter.get_remaining_requests("never-seen")
        limiter.get_retry_after("never-seen")
        limiter.get_reset_time("never-seen")

        assert limiter._requests == {}


class TestHeaderHelpers:
    def test_remaining_counts_down(self, limiter):
        assert limiter.get_remaining_requests("k") == 3
        limiter.is_allowed("k")
        assert limiter.get_remaining_requests("k") == 2

    def test_remaining_is_zero_at_the_limit(self, limiter):
        for _ in range(3):
            limiter.is_allowed("k")

        assert limiter.get_remaining_requests("k") == 0

    def test_reset_time_is_the_oldest_request_plus_the_window(self, limiter):
        with patch("app.core.utils.rate_limit.time.time", return_value=1000.0):
            limiter.is_allowed("k")
            assert limiter.get_reset_time("k") == 1060.0

    def test_retry_after_is_never_zero_while_limited(self, limiter):
        """A Retry-After of 0 invites an immediate retry that would fail again."""
        with patch("app.core.utils.rate_limit.time.time", return_value=1000.0):
            for _ in range(3):
                limiter.is_allowed("k")

        # 0.5s left in the window rounds up to 1, not down to 0.
        with patch("app.core.utils.rate_limit.time.time", return_value=1059.5):
            assert limiter.get_retry_after("k") == 1

    def test_retry_after_is_zero_for_an_unknown_key(self, limiter):
        assert limiter.get_retry_after("k") == 0


class TestRateLimitHeaders:
    """One header set, built from the limiter's own numbers, for every call site."""

    def test_headers_report_the_limiters_configured_limit(self, limiter):
        for _ in range(3):
            limiter.is_allowed("k")

        headers = limiter.rate_limit_headers("k")

        assert headers["X-RateLimit-Limit"] == "3"
        assert headers["X-RateLimit-Remaining"] == "0"

    def test_limit_header_follows_a_reconfigured_ceiling(self, limiter):
        """A hardcoded per-endpoint limit went stale the moment this changed."""
        limiter.max_requests = 1
        limiter.is_allowed("k")

        assert limiter.rate_limit_headers("k")["X-RateLimit-Limit"] == "1"

    def test_headers_carry_a_usable_retry_after_and_reset(self, limiter):
        with patch("app.core.utils.rate_limit.time.time", return_value=1000.0):
            for _ in range(3):
                limiter.is_allowed("k")

            headers = limiter.rate_limit_headers("k")

        assert headers["Retry-After"] == "60"
        assert headers["X-RateLimit-Reset"] == "1060"


class TestKeyStoreIsBounded:
    """Keys seen once are pruned only on lookup, so a threshold sweep bounds them."""

    def test_stale_keys_are_swept_once_past_the_threshold(self, limiter):
        with patch("app.core.utils.rate_limit.time.time", return_value=1000.0):
            for i in range(limiter._SWEEP_THRESHOLD + 1):
                limiter.is_allowed(f"one-shot-{i}")

        assert len(limiter._requests) == limiter._SWEEP_THRESHOLD + 1

        # A later request past the threshold sweeps every window that has aged out.
        with patch("app.core.utils.rate_limit.time.time", return_value=1061.0):
            limiter.is_allowed("fresh")

        assert len(limiter._requests) == 1
        assert "fresh" in limiter._requests

    def test_sweep_does_not_drop_live_keys(self, limiter):
        with patch("app.core.utils.rate_limit.time.time", return_value=1000.0):
            for i in range(limiter._SWEEP_THRESHOLD + 1):
                limiter.is_allowed(f"one-shot-{i}")

        # Only 30s later - nothing has aged out of a 60s window.
        with patch("app.core.utils.rate_limit.time.time", return_value=1030.0):
            limiter.is_allowed("fresh")

        assert len(limiter._requests) == limiter._SWEEP_THRESHOLD + 2

    def test_reset_clears_recorded_requests(self, limiter):
        for _ in range(3):
            limiter.is_allowed("k")

        limiter.reset()

        assert limiter.is_allowed("k") is True


class TestGetClientIp:
    def test_prefers_x_forwarded_for(self):
        request = FakeRequest({"x-forwarded-for": "198.51.100.4, 10.0.0.1"})

        assert get_client_ip(request) == "198.51.100.4"

    def test_falls_back_to_x_real_ip(self):
        request = FakeRequest({"x-real-ip": "198.51.100.9"})

        assert get_client_ip(request) == "198.51.100.9"

    def test_falls_back_to_the_socket_address(self):
        assert get_client_ip(FakeRequest()) == "203.0.113.7"

    def test_returns_unknown_without_a_client(self):
        assert get_client_ip(FakeRequest(host=None)) == "unknown"
