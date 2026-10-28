"""Unit tests for the shared sliding-window rate limiter.

The limiter backs three endpoints with different keys (IP and user id), so the
boundary behavior is tested here once rather than at each call site.
"""

import threading
from unittest.mock import patch

import pytest

from app.core.utils.rate_limit import (
    SlidingWindowRateLimiter,
    failure_slots,
    reserve_all,
)


@pytest.fixture
def limiter():
    return SlidingWindowRateLimiter(max_requests=3, window_seconds=60)


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

    def test_retry_after_is_zero_once_the_window_has_expired(self, limiter):
        """A fully-expired window is no limit at all - reading it unpruned would
        floor to 1 and tell the caller to wait for a limit that has lapsed."""
        with patch("app.core.utils.rate_limit.time.time", return_value=1000.0):
            for _ in range(3):
                limiter.is_allowed("k")

        with patch("app.core.utils.rate_limit.time.time", return_value=1061.0):
            assert limiter.get_retry_after("k") == 0

    def test_reset_time_is_not_in_the_past_once_the_window_has_expired(self, limiter):
        """Unpruned, this would report oldest + window - a timestamp already gone."""
        with patch("app.core.utils.rate_limit.time.time", return_value=1000.0):
            for _ in range(3):
                limiter.is_allowed("k")

        with patch("app.core.utils.rate_limit.time.time", return_value=1061.0):
            assert limiter.get_reset_time("k") == 1061.0

    def test_headers_are_self_consistent_after_expiry(self, limiter):
        """Remaining prunes and the other two did not, so they could disagree."""
        with patch("app.core.utils.rate_limit.time.time", return_value=1000.0):
            for _ in range(3):
                limiter.is_allowed("k")

        with patch("app.core.utils.rate_limit.time.time", return_value=1061.0):
            headers = limiter.rate_limit_headers("k")

        assert headers["X-RateLimit-Remaining"] == "3"
        assert headers["Retry-After"] == "0"


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

    def test_sweep_runs_at_most_once_per_window(self, limiter):
        """A store held above the threshold by live keys must not be rescanned on
        every request - that would make the defense the amplifier."""
        with patch("app.core.utils.rate_limit.time.time", return_value=1000.0):
            for i in range(limiter._SWEEP_THRESHOLD + 1):
                limiter.is_allowed(f"live-{i}")
            # The threshold is crossed by the final insert, so the next request is
            # the first one to see an over-threshold store and sweep.
            limiter.is_allowed("trigger")

        assert limiter._last_sweep == 1000.0

        # Still over the threshold, but inside the same window: no rescan.
        with patch("app.core.utils.rate_limit.time.time", return_value=1030.0):
            limiter.is_allowed("x")

        assert limiter._last_sweep == 1000.0

        # A full window later, one sweep is allowed again.
        with patch("app.core.utils.rate_limit.time.time", return_value=1061.0):
            limiter.is_allowed("y")

        assert limiter._last_sweep == 1061.0


class TestThreadSafety:
    """Three of the four call sites are sync `def` endpoints, which FastAPI runs in
    a threadpool - so these paths genuinely execute in parallel."""

    def test_concurrent_requests_do_not_exceed_the_limit(self):
        limiter = SlidingWindowRateLimiter(max_requests=10, window_seconds=60)
        admitted = []
        barrier = threading.Barrier(8)

        def hammer():
            barrier.wait()  # maximize overlap on the read-modify-write
            for _ in range(20):
                if limiter.is_allowed("shared"):
                    admitted.append(1)

        threads = [threading.Thread(target=hammer) for _ in range(8)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        assert sum(admitted) == 10

        # Timestamps are read under the lock, so they land in lock-acquisition
        # order. _prune pops from the left only while the leftmost is expired, so
        # an out-of-order deque would strand expired entries.
        recorded = list(limiter._requests["shared"])
        assert recorded == sorted(recorded)

    def test_concurrent_mixed_operations_complete(self):
        """Smoke cover for the locked paths under real parallelism: reads nested
        inside writes complete without error and without deadlocking.

        The nesting matters - rate_limit_headers takes the lock and then calls
        getters that take it again, so a plain Lock here would hang. It is a weaker
        test than the over-admission one above: an interleaving that corrupts the
        dict mid-sweep is possible in principle but did not reproduce on demand.
        """
        limiter = SlidingWindowRateLimiter(max_requests=1000, window_seconds=60)
        for i in range(limiter._SWEEP_THRESHOLD + 1):
            limiter.is_allowed(f"seed-{i}")

        errors = []
        barrier = threading.Barrier(4)

        def hammer(worker: int):
            barrier.wait()
            try:
                for i in range(200):
                    limiter.is_allowed(f"w{worker}-{i}")
                    limiter.rate_limit_headers(f"w{worker}-{i}")
            except Exception as exc:  # noqa: BLE001 - the assertion is "none raised"
                errors.append(exc)

        threads = [threading.Thread(target=hammer, args=(n,)) for n in range(4)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        assert errors == []

    def test_reset_clears_recorded_requests(self, limiter):
        for _ in range(3):
            limiter.is_allowed("k")

        limiter.reset()

        assert limiter.is_allowed("k") is True


class TestRelease:
    def test_release_frees_one_slot(self, limiter):
        for _ in range(3):
            limiter.is_allowed("k")

        limiter.release("k")

        assert limiter.get_remaining_requests("k") == 1

    def test_release_of_unknown_key_is_a_no_op(self, limiter):
        limiter.release("never-seen")

        assert limiter.get_remaining_requests("never-seen") == 3


class TestFailureSlot:
    def test_success_gives_the_slot_back(self, limiter):
        limiter.is_allowed("k")
        with limiter.failure_slot("k", counted=(ValueError,)):
            pass

        assert limiter.get_remaining_requests("k") == 3

    def test_counted_failure_keeps_the_slot(self, limiter):
        limiter.is_allowed("k")
        with pytest.raises(ValueError):
            with limiter.failure_slot("k", counted=(ValueError,)):
                raise ValueError

        assert limiter.get_remaining_requests("k") == 2

    def test_unexpected_error_gives_the_slot_back(self, limiter):
        limiter.is_allowed("k")
        with pytest.raises(RuntimeError):
            with limiter.failure_slot("k", counted=(ValueError,)):
                raise RuntimeError

        assert limiter.get_remaining_requests("k") == 3


class TestTooManyRequests:
    def test_carries_standard_headers_and_error_code(self, limiter):
        for _ in range(3):
            limiter.is_allowed("k")

        rejection = limiter.too_many_requests("k", "Slow down.", "some_code")

        assert rejection.status_code == 429
        assert rejection.headers["X-Error-Code"] == "some_code"
        assert {"Retry-After", "X-RateLimit-Limit", "X-RateLimit-Reset"} <= set(
            rejection.headers
        )
        assert rejection.detail.startswith("Slow down. Please wait ")


class TestReserveAll:
    def test_takes_a_slot_under_every_limit(self):
        first, second = SlidingWindowRateLimiter(2, 60), SlidingWindowRateLimiter(2, 60)

        assert reserve_all([(first, "a"), (second, "b")]) is None

        assert first.get_remaining_requests("a") == 1
        assert second.get_remaining_requests("b") == 1

    def test_full_limit_gives_back_the_slots_already_taken(self):
        first, full = SlidingWindowRateLimiter(2, 60), SlidingWindowRateLimiter(1, 60)
        full.is_allowed("b")

        assert reserve_all([(first, "a"), (full, "b")]) == (full, "b")

        assert first.get_remaining_requests("a") == 2

    def test_empty_list_reserves_nothing(self):
        assert reserve_all([]) is None


class TestFailureSlots:
    def _reserved(self):
        limits = [
            (SlidingWindowRateLimiter(3, 60), "k"),
            (SlidingWindowRateLimiter(3, 60), "k"),
        ]
        assert reserve_all(limits) is None
        return limits

    def test_success_releases_every_slot(self):
        limits = self._reserved()

        with failure_slots(limits, counted=(ValueError,)):
            pass

        assert all(l.get_remaining_requests(k) == 3 for l, k in limits)

    def test_counted_failure_keeps_every_slot(self):
        limits = self._reserved()

        with pytest.raises(ValueError):
            with failure_slots(limits, counted=(ValueError,)):
                raise ValueError()

        assert all(l.get_remaining_requests(k) == 2 for l, k in limits)

    def test_other_error_releases_every_slot(self):
        limits = self._reserved()

        with pytest.raises(KeyError):
            with failure_slots(limits, counted=(ValueError,)):
                raise KeyError()

        assert all(l.get_remaining_requests(k) == 3 for l, k in limits)


class TestFullAndClearKeys:
    def test_full_keys_lists_only_keys_at_the_limit(self):
        limiter = SlidingWindowRateLimiter(2, 60)
        limiter.is_allowed("full")
        limiter.is_allowed("full")
        limiter.is_allowed("partial")

        assert limiter.full_keys() == ["full"]

    def test_full_keys_ignores_expired_requests(self):
        limiter = SlidingWindowRateLimiter(1, 60)
        with patch("app.core.utils.rate_limit.time.time", return_value=1000.0):
            limiter.is_allowed("k")

        with patch("app.core.utils.rate_limit.time.time", return_value=1061.0):
            assert limiter.full_keys() == []

    def test_clear_keys_forgets_only_matching_keys(self):
        limiter = SlidingWindowRateLimiter(1, 60)
        for key in (("alice", "1.1.1.1"), ("alice", "2.2.2.2"), ("bob", "1.1.1.1")):
            limiter.is_allowed(key)

        cleared = limiter.clear_keys(lambda key: key[0] == "alice")

        assert cleared == 2
        assert limiter.full_keys() == [("bob", "1.1.1.1")]
