"""EphemeralStore: opaque tokens, expiry, single holder, size cap."""

from unittest.mock import patch

from app.core.utils.ephemeral_store import EphemeralStore

CLOCK = "app.core.utils.ephemeral_store.time.monotonic"


def test_take_returns_value_once():
    store = EphemeralStore(ttl_seconds=60, max_entries=10)
    token = store.put({"user_id": 1})

    assert store.take(token).value == {"user_id": 1}
    assert store.take(token) is None


def test_unknown_token_is_none():
    assert EphemeralStore(60, 10).take("nope") is None


def test_tokens_are_unguessable_and_distinct():
    store = EphemeralStore(60, 10)
    tokens = {store.put(i) for i in range(5)}

    assert len(tokens) == 5
    assert all(len(t) >= 40 for t in tokens)


def test_expired_entry_is_not_returned():
    store = EphemeralStore(ttl_seconds=60, max_entries=10)
    with patch(CLOCK, return_value=1000.0):
        token = store.put("x")
    with patch(CLOCK, return_value=1060.0):
        assert store.take(token) is None


def test_put_back_keeps_original_expiry():
    store = EphemeralStore(ttl_seconds=60, max_entries=10)
    with patch(CLOCK, return_value=1000.0):
        token = store.put("x")
    with patch(CLOCK, return_value=1050.0):
        entry = store.take(token)
        store.put_back(token, entry)
    with patch(CLOCK, return_value=1059.0):
        entry = store.take(token)
        assert entry.value == "x"
        store.put_back(token, entry)
    with patch(CLOCK, return_value=1061.0):
        assert store.take(token) is None


def test_put_back_of_expired_entry_is_dropped():
    store = EphemeralStore(ttl_seconds=60, max_entries=10)
    with patch(CLOCK, return_value=1000.0):
        token = store.put("x")
        entry = store.take(token)
    with patch(CLOCK, return_value=1100.0):
        store.put_back(token, entry)
        assert len(store) == 0


def test_writes_sweep_expired_entries():
    store = EphemeralStore(ttl_seconds=60, max_entries=10)
    with patch(CLOCK, return_value=1000.0):
        store.put("old")
    with patch(CLOCK, return_value=1100.0):
        store.put("new")
        assert len(store) == 1


def test_cap_evicts_oldest():
    store = EphemeralStore(ttl_seconds=60, max_entries=2)
    with patch(CLOCK, return_value=1000.0):
        first = store.put(1)
    with patch(CLOCK, return_value=1001.0):
        second = store.put(2)
    with patch(CLOCK, return_value=1002.0):
        third = store.put(3)
        assert store.take(first) is None
        assert store.take(second).value == 2
        assert store.take(third).value == 3


def test_owner_holds_one_entry():
    store = EphemeralStore(60, 10)
    first = store.put("a", owner=1)
    second = store.put("b", owner=1)

    assert store.take(first) is None
    assert store.take(second).value == "b"


def test_entries_without_owner_never_replace_each_other():
    store = EphemeralStore(60, 10)
    tokens = [store.put(i) for i in range(3)]

    assert all(store.take(t) is not None for t in tokens)


def test_put_back_yields_to_a_newer_entry_of_the_owner():
    store = EphemeralStore(60, 10)
    old = store.put("old", owner=1)
    entry = store.take(old)
    newer = store.put("new", owner=1)

    store.put_back(old, entry)

    assert store.take(old) is None
    assert store.take(newer).value == "new"


def test_put_back_restores_when_owner_has_nothing_newer():
    store = EphemeralStore(60, 10)
    token = store.put("x", owner=1)
    entry = store.take(token)

    store.put_back(token, entry)

    assert store.take(token).value == "x"
