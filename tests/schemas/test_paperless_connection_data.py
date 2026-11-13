"""PaperlessConnectionData accepts "no credentials" so Test Connection can use saved ones (issue #1227)."""

import pytest
from pydantic import ValidationError

from app.schemas.user_preferences import PaperlessConnectionData

URL = "http://127.0.0.1:8000"


@pytest.fixture(autouse=True)
def allow_private_urls(monkeypatch):
    monkeypatch.setattr("app.core.config.settings.ALLOW_PRIVATE_INTEGRATION_URLS", True)


def _messages(exc_info) -> list[str]:
    return [error["msg"] for error in exc_info.value.errors()]


class TestNoCredentialsProvided:
    """The saved-credentials path: the endpoint falls back to stored credentials."""

    def test_url_only(self):
        data = PaperlessConnectionData(paperless_url=URL)

        assert data.paperless_api_token is None
        assert data.paperless_username is None
        assert data.paperless_password is None

    def test_empty_strings_for_every_credential(self):
        # What the frontend sent when only saved credentials existed
        data = PaperlessConnectionData(
            paperless_url=URL,
            paperless_api_token="",
            paperless_username="",
            paperless_password="",
        )

        assert data.paperless_api_token is None
        assert data.paperless_username is None
        assert data.paperless_password is None

    def test_empty_username_and_password_only(self):
        data = PaperlessConnectionData(
            paperless_url=URL, paperless_username="", paperless_password=""
        )

        assert data.paperless_username is None
        assert data.paperless_password is None

    def test_explicit_nulls(self):
        data = PaperlessConnectionData(
            paperless_url=URL,
            paperless_api_token=None,
            paperless_username=None,
            paperless_password=None,
        )

        assert data.paperless_username is None

    def test_whitespace_only_values_are_treated_as_missing(self):
        data = PaperlessConnectionData(
            paperless_url=URL,
            paperless_api_token="   ",
            paperless_username="  ",
            paperless_password="   ",
        )

        assert data.paperless_api_token is None
        assert data.paperless_username is None
        assert data.paperless_password is None


class TestTokenAuth:
    def test_token_only(self):
        data = PaperlessConnectionData(
            paperless_url=URL, paperless_api_token="dummytoken123"
        )

        assert data.paperless_api_token == "dummytoken123"

    def test_token_is_stripped(self):
        data = PaperlessConnectionData(
            paperless_url=URL, paperless_api_token="  dummytoken123  "
        )

        assert data.paperless_api_token == "dummytoken123"

    def test_token_with_blank_basic_credentials(self):
        data = PaperlessConnectionData(
            paperless_url=URL,
            paperless_api_token="dummytoken123",
            paperless_username="",
            paperless_password="",
        )

        assert data.paperless_api_token == "dummytoken123"
        assert data.paperless_username is None

    def test_short_token_reports_only_the_token_error(self):
        with pytest.raises(ValidationError) as exc_info:
            PaperlessConnectionData(paperless_url=URL, paperless_api_token="short")

        assert _messages(exc_info) == ["Value error, API token appears to be too short"]


class TestBasicAuth:
    def test_username_and_password(self):
        data = PaperlessConnectionData(
            paperless_url=URL, paperless_username=" admin ", paperless_password="secret"
        )

        assert data.paperless_username == "admin"
        assert data.paperless_password == "secret"

    def test_password_is_not_stripped(self):
        data = PaperlessConnectionData(
            paperless_url=URL, paperless_username="admin", paperless_password=" pw "
        )

        assert data.paperless_password == " pw "

    @pytest.mark.parametrize(
        "fields",
        [
            {"paperless_username": "admin"},
            {"paperless_username": "admin", "paperless_password": ""},
            {"paperless_password": "secret"},
            {"paperless_username": "", "paperless_password": "secret"},
        ],
    )
    def test_only_one_of_username_or_password_is_rejected(self, fields):
        with pytest.raises(ValidationError) as exc_info:
            PaperlessConnectionData(paperless_url=URL, **fields)

        assert _messages(exc_info) == [
            "Value error, Both username and password are required when no API token is provided"
        ]

    def test_short_username_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            PaperlessConnectionData(
                paperless_url=URL, paperless_username="a", paperless_password="secret"
            )

        assert any("Username too short" in m for m in _messages(exc_info))

    def test_short_password_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            PaperlessConnectionData(
                paperless_url=URL, paperless_username="admin", paperless_password="ab"
            )

        assert any("Password too short" in m for m in _messages(exc_info))
