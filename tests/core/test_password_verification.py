"""verify_password at bcrypt's input limit."""

import bcrypt

from app.core.utils.security import get_password_hash, verify_password


def test_matching_password():
    assert verify_password("Password123", get_password_hash("Password123")) is True


def test_password_at_the_limit_still_checks():
    password = "x" * 72

    assert verify_password(password, get_password_hash(password)) is True


def test_password_past_the_limit_is_checked_not_an_error():
    assert verify_password("y" * 73, get_password_hash("x" * 72)) is False


def test_long_password_hashed_by_bcrypt_4_still_signs_in():
    password = "x" * 72 + "tail"
    legacy_hash = bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt(rounds=4))

    assert verify_password(password, legacy_hash.decode()) is True


def test_limit_counts_bytes_not_characters():
    assert verify_password("\u00e9" * 37, get_password_hash("x")) is False


def test_password_past_the_limit_hashes_and_checks():
    password = "\u00e9" * 37 + "tail"

    assert verify_password(password, get_password_hash(password)) is True
