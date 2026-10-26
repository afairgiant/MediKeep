"""In-memory store for short-lived values handed to a client as opaque tokens.

Per process and lost on restart, so it needs the single worker the container pins.
"""

import secrets
import threading
import time
from collections.abc import Hashable
from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class StoredEntry:
    value: Any
    expires_at: float
    owner: Optional[Hashable] = None


class EphemeralStore:
    """Thread-safe token -> value map with a fixed lifetime and a size cap.

    Expired entries are swept on every write; past max_entries the oldest are
    evicted, which reads to their holder exactly like an expiry. An owner holds at
    most one entry: storing another for the same owner replaces the earlier one.
    """

    def __init__(self, ttl_seconds: int, max_entries: int):
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self._entries: Dict[str, StoredEntry] = {}
        self._lock = threading.Lock()

    def put(self, value: Any, owner: Optional[Hashable] = None) -> str:
        """Store value under a new unguessable token and return the token."""
        token = secrets.token_urlsafe(32)
        now = time.monotonic()
        with self._lock:
            self._sweep(now, replacing=owner)
            self._insert(token, StoredEntry(value, now + self.ttl_seconds, owner))
        return token

    def take(self, token: str) -> Optional[StoredEntry]:
        """Remove and return the live entry for token, or None.

        Atomic, so two requests presenting one token cannot both hold it.
        """
        with self._lock:
            entry = self._entries.pop(token, None)
        if entry is None or entry.expires_at <= time.monotonic():
            return None
        return entry

    def put_back(self, token: str, entry: StoredEntry) -> None:
        """Return an entry from take() under its token, keeping its original expiry.

        Dropped instead if its owner was given a newer entry in the meantime.
        """
        now = time.monotonic()
        if entry.expires_at <= now:
            return
        with self._lock:
            self._sweep(now)
            if entry.owner is not None and any(
                e.owner == entry.owner for e in self._entries.values()
            ):
                return
            self._insert(token, entry)

    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)

    def reset(self) -> None:
        """Discard every entry. For tests."""
        with self._lock:
            self._entries.clear()

    def _sweep(self, now: float, replacing: Optional[Hashable] = None) -> None:
        stale = [
            key
            for key, e in self._entries.items()
            if e.expires_at <= now or (replacing is not None and e.owner == replacing)
        ]
        for key in stale:
            del self._entries[key]

    def _insert(self, token: str, entry: StoredEntry) -> None:
        self._entries[token] = entry
        # The sweep leaves at most one entry over the cap: the one just inserted
        if len(self._entries) > self.max_entries:
            oldest = min(self._entries, key=lambda k: self._entries[k].expires_at)
            del self._entries[oldest]
