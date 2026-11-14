"""Which saved Paperless credentials are used for which chosen method."""

import inspect
from types import SimpleNamespace

import pytest

from app.models.user import UserPreferences
from app.services.paperless_auth_methods import (
    AUTH_METHODS,
    DEFAULT_AUTH_METHOD,
    credential_kwargs,
    has_usable_credentials,
    is_valid_auth_method,
    resolve_auth_method,
    will_have_credentials,
)


def make_prefs(token=None, username=None, password=None, method=None):
    return SimpleNamespace(
        paperless_api_token_encrypted=token,
        paperless_username_encrypted=username,
        paperless_password_encrypted=password,
        paperless_auth_method=method,
    )


class TestResolveAuthMethod:
    @pytest.mark.parametrize(
        "prefs, expected",
        [
            (make_prefs(token="t"), "token"),
            (make_prefs(username="u", password="p"), "basic_auth"),
            (make_prefs(token="t", username="u", password="p"), "token"),
            (make_prefs(username="u"), DEFAULT_AUTH_METHOD),
            (make_prefs(), DEFAULT_AUTH_METHOD),
        ],
        ids=["token", "basic", "both_prefers_token", "half_basic", "nothing"],
    )
    def test_unset_choice_uses_first_method_with_credentials(self, prefs, expected):
        assert resolve_auth_method(prefs) == expected

    def test_stored_choice_beats_token_priority(self):
        prefs = make_prefs(token="t", username="u", password="p", method="basic_auth")
        assert resolve_auth_method(prefs) == "basic_auth"

    def test_stored_choice_is_kept_even_without_credentials(self):
        prefs = make_prefs(token="t", method="basic_auth")
        assert resolve_auth_method(prefs) == "basic_auth"
        assert has_usable_credentials(prefs) is False

    @pytest.mark.parametrize("stored", ["", "sso", "TOKEN", 5])
    def test_unrecognised_stored_value_falls_back_to_legacy_order(self, stored):
        prefs = make_prefs(username="u", password="p", method=stored)
        assert resolve_auth_method(prefs) == "basic_auth"


class TestCredentialKwargs:
    def test_token_method_passes_only_the_token(self):
        prefs = make_prefs(token="t", username="u", password="p", method="token")
        assert credential_kwargs(prefs) == {"encrypted_token": "t"}

    def test_basic_method_passes_no_token_even_when_one_is_saved(self):
        prefs = make_prefs(token="t", username="u", password="p", method="basic_auth")
        assert credential_kwargs(prefs) == {
            "encrypted_username": "u",
            "encrypted_password": "p",
        }


class TestHasCredentials:
    def test_basic_needs_both_username_and_password(self):
        assert has_usable_credentials(make_prefs(username="u"), "basic_auth") is False
        assert (
            has_usable_credentials(make_prefs(username="u", password="p"), "basic_auth")
            is True
        )


class TestWillHaveCredentials:
    def test_empty_pending_value_does_not_replace_a_saved_one(self):
        prefs = make_prefs(username="u")
        assert (
            will_have_credentials(
                prefs, "basic_auth", {"paperless_password_encrypted": ""}
            )
            is False
        )

    def test_username_saved_and_password_pending(self):
        prefs = make_prefs(username="u")
        assert will_have_credentials(
            prefs, "basic_auth", {"paperless_password_encrypted": "p"}
        )


def test_is_valid_auth_method():
    assert is_valid_auth_method("token")
    assert is_valid_auth_method("basic_auth")
    assert not is_valid_auth_method("sso")
    assert not is_valid_auth_method(None)
    assert not is_valid_auth_method(["token"])


class TestRegistryMatchesTheRealModelAndFactory:
    """The helpers read columns with getattr(..., None), so a wrong name would
    silently report "no credentials" instead of failing."""

    def test_every_credential_column_exists_on_the_model(self):
        for method in AUTH_METHODS.values():
            for column in method.credential_columns.values():
                assert hasattr(UserPreferences, column), (method.id, column)

    def test_every_keyword_is_a_factory_parameter(self):
        from app.services.paperless_client import create_paperless_client
        from app.services.paperless_service import create_paperless_service

        for factory in (create_paperless_service, create_paperless_client):
            parameters = inspect.signature(factory).parameters
            for method in AUTH_METHODS.values():
                for keyword in method.credential_columns:
                    assert keyword in parameters, (factory.__name__, keyword)
