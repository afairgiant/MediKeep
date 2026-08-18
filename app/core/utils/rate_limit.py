"""Shared in-memory sliding-window rate limiting.

One implementation, extracted from the two hand-rolled copies that previously lived
in ``app.api.v1.endpoints.system`` (IP-keyed) and
``app.api.v1.endpoints.medical_specialty`` (user-keyed). The key is opaque to the
limiter, so callers choose what they throttle on.

Counters live in process memory: they are not shared between workers and do not
survive a restart. That is adequate for abuse prevention, not for hard quotas.
"""

import math
import threading
import time
from collections import deque
from collections.abc import Hashable
from typing import Deque, Dict, Optional

from fastapi import Request

from app.core.logging.constants import sanitize_log_input


class SlidingWindowRateLimiter:
    """Allow at most ``max_requests`` per key within a rolling ``window_seconds``.

    Entries are created only when a request is actually recorded, and a key whose
    window prunes to empty is deleted rather than left behind - so a ``defaultdict``
    does not accumulate an empty deque per key ever seen. Pruning is lazy, though:
    it happens when a key is looked up again, which never comes for a key seen once.
    ``_SWEEP_THRESHOLD`` bounds that residue.

    Thread-safe. FastAPI runs non-``async`` endpoints in a threadpool, and three of
    the call sites are plain ``def``, so requests genuinely execute in parallel:
    without the lock, two threads can pass the limit check before either records its
    request, and a sweep iterating the dict while another thread inserts raises
    ``RuntimeError: dictionary changed size during iteration``.
    """

    # Past this many tracked keys, a request sweeps stale keys rather than only its
    # own, which caps the residue of one-shot keys - for an IP-keyed limiter on an
    # unauthenticated endpoint, one entry per address a distributed source cares to
    # use. Well above any legitimate concurrent-client count, so a real deployment
    # never pays for the sweep.
    _SWEEP_THRESHOLD = 10000

    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: Dict[Hashable, Deque[float]] = {}
        # Re-entrant so rate_limit_headers can call the public getters, which take
        # the lock themselves, without deadlocking.
        self._lock = threading.RLock()
        self._last_sweep = 0.0

    def _prune(self, key: Hashable, now: float) -> Optional[Deque[float]]:
        """Drop timestamps outside the window; return the live deque or None.

        Caller must hold ``_lock``.
        """
        window = self._requests.get(key)
        if window is None:
            return None

        while window and window[0] <= now - self.window_seconds:
            window.popleft()

        if not window:
            del self._requests[key]
            return None

        return window

    def _maybe_sweep(self, now: float) -> None:
        """Drop keys whose windows have fully aged out, at most once per window.

        Throttled because the scan is O(tracked keys): a store held above the
        threshold by *live* keys would otherwise be rescanned on every request, so
        the defense against one-shot-key growth would itself become the amplifier.
        Caller must hold ``_lock``.
        """
        if len(self._requests) <= self._SWEEP_THRESHOLD:
            return
        if now - self._last_sweep < self.window_seconds:
            return

        self._last_sweep = now
        cutoff = now - self.window_seconds
        stale = [
            key
            for key, window in self._requests.items()
            if not window or window[-1] <= cutoff
        ]
        for key in stale:
            del self._requests[key]

    def is_allowed(self, key: Hashable) -> bool:
        """Record a request and return whether it is under the limit."""
        now = time.time()

        with self._lock:
            self._maybe_sweep(now)
            window = self._prune(key, now)

            if window is None:
                window = deque()

            if len(window) < self.max_requests:
                window.append(now)
                self._requests[key] = window
                return True

            return False

    def get_remaining_requests(self, key: Hashable) -> int:
        """Requests still available to this key in the current window."""
        with self._lock:
            window = self._prune(key, time.time())
            used = len(window) if window else 0
            return max(0, self.max_requests - used)

    def get_reset_time(self, key: Hashable) -> float:
        """Unix timestamp at which this key's oldest request leaves the window."""
        with self._lock:
            window = self._requests.get(key)
            if not window:
                return time.time()
            return window[0] + self.window_seconds

    def get_retry_after(self, key: Hashable) -> int:
        """Whole seconds a limited caller should wait, for the Retry-After header.

        Rounded up and floored at 1 - a Retry-After of 0 invites an immediate retry
        that would be rejected again.
        """
        with self._lock:
            window = self._requests.get(key)
            if not window:
                return 0
            return max(1, math.ceil(window[0] + self.window_seconds - time.time()))

    def rate_limit_headers(self, key: Hashable) -> Dict[str, str]:
        """Standard `429` headers for a rejected request.

        Lives here so every call site reports the same set from the same numbers -
        the limit in particular was previously hardcoded per endpoint and went stale
        the moment the limiter was configured differently.
        """
        with self._lock:
            return {
                "Retry-After": str(self.get_retry_after(key)),
                "X-RateLimit-Limit": str(self.max_requests),
                "X-RateLimit-Remaining": str(self.get_remaining_requests(key)),
                "X-RateLimit-Reset": str(int(self.get_reset_time(key))),
            }

    def reset(self) -> None:
        """Discard all recorded requests. For tests - module-scope limiter state
        otherwise leaks between them."""
        with self._lock:
            self._requests.clear()
            self._last_sweep = 0.0


def get_client_ip(request: Request) -> str:
    """Safely extract the client IP, preferring proxy headers.

    Shared so every IP-keyed limiter resolves addresses the same way. If a
    deployment's reverse proxy does not set these headers, this resolves to the
    proxy's own address and one limiter bucket covers every user behind it - a
    pre-existing, app-wide property of this resolution, not of any one caller.
    """
    potential_ips = [
        request.headers.get("x-forwarded-for", "").split(",")[0].strip(),
        request.headers.get("x-real-ip", ""),
        getattr(request.client, "host", "unknown") if request.client else "unknown",
    ]

    for ip in potential_ips:
        if ip and ip != "unknown":
            return sanitize_log_input(ip, max_length=45)  # IPv6 max length

    return "unknown"
