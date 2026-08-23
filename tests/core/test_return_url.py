"""Unit tests for is_safe_return_url.

This is the backend half of the open-redirect guard: the value it screens is stored
against the OAuth state parameter and echoed back by /auth/sso/callback, so anything
it lets through is consumed immediately after a successful sign-in.

The protocol-relative forms are named individually on purpose. They are the cases a
naive startswith("/") check waves through, and they are the reason this function
exists rather than an inline one-liner at the endpoint.
"""

import pytest

from app.core.utils.return_url import MAX_RETURN_URL_LENGTH, is_safe_return_url


class TestAccepted:
    @pytest.mark.parametrize(
        "value",
        [
            "/",
            "/dashboard",
            "/patients/42",
            "/lab-results?status=open",
            "/lab-results?status=open#results",
            "/patients/42/",
            # Not rejected here even though the frontend refuses it as a return
            # path: loop avoidance is a navigation rule, and a 400 would be a hard
            # failure where the client already falls back to /dashboard.
            "/login",
        ],
    )
    def test_root_relative_paths_are_accepted(self, value):
        assert is_safe_return_url(value) is True

    def test_a_path_at_the_length_limit_is_accepted(self):
        value = "/" + "a" * (MAX_RETURN_URL_LENGTH - 1)

        assert len(value) == MAX_RETURN_URL_LENGTH
        assert is_safe_return_url(value) is True


class TestRejected:
    @pytest.mark.parametrize(
        "value, why",
        [
            ("https://evil.example", "absolute URL"),
            ("http://evil.example/dashboard", "absolute URL with a path"),
            ("//evil.example", "protocol-relative"),
            ("//evil.example/dashboard", "protocol-relative with a path"),
            ("/\\evil.example", "backslash form of protocol-relative"),
            ("\\\\evil.example", "UNC-style backslashes"),
            ("/dashboard\\..\\admin", "backslash anywhere"),
            ("../admin", "relative, not root-relative"),
            ("dashboard", "bare relative path"),
            ("javascript:alert(1)", "scheme"),
            ("data:text/html,<script>", "data scheme"),
            ("/\thttps://evil.example", "tab a browser would strip"),
            ("/dashboard\nSet-Cookie: x", "newline"),
            ("", "empty"),
            ("   ", "whitespace only, not root-relative"),
        ],
    )
    def test_off_origin_and_malformed_values_are_rejected(self, value, why):
        assert is_safe_return_url(value) is False, why

    def test_none_is_rejected(self):
        # Callers decide what "no return URL" means; the endpoint treats None as
        # absent and never calls this.
        assert is_safe_return_url(None) is False

    @pytest.mark.parametrize("value", [42, [], {"path": "/dashboard"}])
    def test_non_strings_are_rejected(self, value):
        assert is_safe_return_url(value) is False

    def test_an_over_long_path_is_rejected(self):
        assert is_safe_return_url("/" + "a" * MAX_RETURN_URL_LENGTH) is False
