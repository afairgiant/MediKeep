"""Notification channels may only reach allowed addresses."""

import ipaddress
import socket
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from unittest.mock import MagicMock, patch

import pytest
from fastapi import status

from app.api.v1.endpoints.notifications import _test_limiter
from app.core.config import settings
from app.core.utils.pinned_dns import pinned_resolution
from app.services.notification_service import (
    TEST_ERROR_MESSAGE,
    NotificationService,
)

CHANNELS_URL = "/api/v1/notifications/channels"
METADATA_URLS = [
    "http://169.254.169.254",
    "https://169.254.169.254/latest",
    "http://[::ffff:169.254.169.254]",
    "http://[fe80::1]",
]


@pytest.fixture(autouse=True)
def reset_limiter():
    _test_limiter.reset()
    yield
    _test_limiter.reset()


@pytest.fixture
def private_blocked(monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_PRIVATE_INTEGRATION_URLS", False)


@pytest.fixture
def private_allowed(monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_PRIVATE_INTEGRATION_URLS", True)


@pytest.fixture
def apprise_mock():
    instance = MagicMock()
    instance.notify.return_value = True
    with patch("apprise.Apprise", return_value=instance) as factory:
        yield factory, instance


def _configs(url):
    return {
        "gotify": {"server_url": url, "app_token": "token12345"},
        "ntfy": {"server_url": url, "topic": "alerts"},
        "webhook": {"url": url, "method": "POST"},
    }


def _email_config(host):
    return {
        "smtp_host": host,
        "smtp_port": 587,
        "smtp_user": "user",
        "smtp_password": "secretpass",
        "from_email": "from@example.com",
        "to_email": "to@example.com",
    }


def _create(client, headers, channel_type, config, name="channel"):
    return client.post(
        CHANNELS_URL,
        headers=headers,
        json={"name": name, "channel_type": channel_type, "config": config},
    )


def _stored_channel(db_session, user, channel_type, config):
    """A channel saved without schema checks, as one saved before validation existed."""
    return NotificationService(db_session).create_channel(
        user_id=user.id,
        name=f"stored-{channel_type}",
        channel_type=channel_type,
        config=config,
    )


class TestSaveTimeValidation:
    @pytest.mark.parametrize("url", METADATA_URLS)
    @pytest.mark.parametrize("channel_type", ["gotify", "ntfy", "webhook"])
    def test_metadata_address_refused(
        self, client, user_token_headers, private_allowed, channel_type, url
    ):
        response = _create(
            client, user_token_headers, channel_type, _configs(url)[channel_type]
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT

    @pytest.mark.parametrize("host", ["169.254.169.254", "fe80::1"])
    def test_email_metadata_host_refused(
        self, client, user_token_headers, private_allowed, host
    ):
        response = _create(client, user_token_headers, "email", _email_config(host))
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT

    @pytest.mark.parametrize("channel_type", ["gotify", "ntfy", "webhook"])
    def test_private_address_follows_setting(
        self, client, user_token_headers, monkeypatch, channel_type
    ):
        config = _configs("http://192.168.1.10:8080")[channel_type]
        monkeypatch.setattr(settings, "ALLOW_PRIVATE_INTEGRATION_URLS", False)
        blocked = _create(client, user_token_headers, channel_type, config, "a")
        monkeypatch.setattr(settings, "ALLOW_PRIVATE_INTEGRATION_URLS", True)
        allowed = _create(client, user_token_headers, channel_type, config, "b")

        assert blocked.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
        assert allowed.status_code == status.HTTP_201_CREATED

    def test_private_email_host_follows_setting(
        self, client, user_token_headers, monkeypatch
    ):
        config = _email_config("10.0.0.5")
        monkeypatch.setattr(settings, "ALLOW_PRIVATE_INTEGRATION_URLS", False)
        blocked = _create(client, user_token_headers, "email", config, "a")
        monkeypatch.setattr(settings, "ALLOW_PRIVATE_INTEGRATION_URLS", True)
        allowed = _create(client, user_token_headers, "email", config, "b")

        assert blocked.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
        assert allowed.status_code == status.HTTP_201_CREATED

    def test_plain_http_to_public_address_refused(self, client, user_token_headers):
        response = _create(
            client, user_token_headers, "gotify", _configs("http://8.8.8.8")["gotify"]
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


class TestUpdateValidation:
    def _gotify(self, client, headers):
        response = _create(
            client,
            headers,
            "gotify",
            {"server_url": "https://8.8.8.8", "app_token": "realtoken12345"},
        )
        assert response.status_code == status.HTTP_201_CREATED
        return response.json()["id"]

    def _update(self, client, headers, channel_id, config):
        return client.put(
            f"{CHANNELS_URL}/{channel_id}", headers=headers, json={"config": config}
        )

    def _stored_config(self, db_session, user, channel_id):
        service = NotificationService(db_session)
        db_session.expire_all()
        return service.get_channel_config(service.get_channel(user.id, channel_id))

    @pytest.mark.parametrize("url", ["http://169.254.169.254", "not-a-url"])
    def test_disallowed_url_rejected(
        self, client, user_token_headers, private_allowed, url
    ):
        channel_id = self._gotify(client, user_token_headers)

        response = self._update(
            client, user_token_headers, channel_id, {"server_url": url}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_masked_token_keeps_stored_token(
        self, client, user_token_headers, db_session, test_user
    ):
        channel_id = self._gotify(client, user_token_headers)
        masked = client.get(
            f"{CHANNELS_URL}/{channel_id}", headers=user_token_headers
        ).json()["config_masked"]

        response = self._update(
            client,
            user_token_headers,
            channel_id,
            {"server_url": "https://8.8.4.4", "app_token": masked["app_token"]},
        )

        assert response.status_code == status.HTTP_200_OK
        config = self._stored_config(db_session, test_user, channel_id)
        assert config == {
            "server_url": "https://8.8.4.4",
            "app_token": "realtoken12345",
        }

    def test_partial_config_keeps_other_fields(
        self, client, user_token_headers, db_session, test_user
    ):
        channel_id = self._gotify(client, user_token_headers)

        response = self._update(client, user_token_headers, channel_id, {"priority": 8})

        assert response.status_code == status.HTTP_200_OK
        config = self._stored_config(db_session, test_user, channel_id)
        assert config["app_token"] == "realtoken12345"
        assert config["priority"] == 8

    def test_masked_password_keeps_stored_password(
        self, client, user_token_headers, db_session, test_user, private_allowed
    ):
        created = _create(
            client, user_token_headers, "email", _email_config("10.0.0.5")
        )
        channel_id = created.json()["id"]

        response = self._update(
            client,
            user_token_headers,
            channel_id,
            {"smtp_password": "****", "smtp_port": 465},
        )

        assert response.status_code == status.HTTP_200_OK
        config = self._stored_config(db_session, test_user, channel_id)
        assert config["smtp_password"] == "secretpass"
        assert config["smtp_port"] == 465


@pytest.mark.asyncio
class TestSendTimeCheck:
    @pytest.mark.parametrize(
        "channel_type,config",
        [
            ("gotify", {"server_url": "http://169.254.169.254", "app_token": "t"}),
            ("ntfy", {"server_url": "http://169.254.169.254", "topic": "x"}),
            ("webhook", {"url": "http://169.254.169.254/hook"}),
            ("email", _email_config("169.254.169.254")),
        ],
    )
    async def test_stored_metadata_address_never_reaches_apprise(
        self, db_session, test_user, apprise_mock, private_allowed, channel_type, config
    ):
        factory, _ = apprise_mock
        channel = _stored_channel(db_session, test_user, channel_type, config)
        service = NotificationService(db_session)
        service.set_preference(test_user.id, channel.id, "backup_completed", True)

        (history,) = await service.send_notification(
            test_user.id, "backup_completed", "title", "body"
        )
        success, message = await service.test_channel(test_user.id, channel.id)

        factory.assert_not_called()
        assert history.status == "failed"
        assert "metadata" in history.error_message
        assert success is False
        assert "metadata" in message

    async def test_stored_private_address_blocked_when_disallowed(
        self, db_session, test_user, apprise_mock, private_blocked
    ):
        factory, _ = apprise_mock
        channel = _stored_channel(
            db_session,
            test_user,
            "gotify",
            {"server_url": "http://192.168.1.10", "app_token": "t"},
        )

        success, _ = await NotificationService(db_session).test_channel(
            test_user.id, channel.id
        )

        factory.assert_not_called()
        assert success is False

    async def test_unresolvable_host_blocked_at_send(
        self, db_session, test_user, apprise_mock
    ):
        factory, _ = apprise_mock
        channel = _stored_channel(
            db_session,
            test_user,
            "gotify",
            {"server_url": "https://does-not-exist.invalid", "app_token": "t"},
        )

        success, _ = await NotificationService(db_session).test_channel(
            test_user.id, channel.id
        )

        factory.assert_not_called()
        assert success is False

    async def test_allowed_address_is_sent(
        self, db_session, test_user, apprise_mock, private_allowed
    ):
        factory, instance = apprise_mock
        channel = _stored_channel(
            db_session,
            test_user,
            "gotify",
            {"server_url": "http://192.168.1.10", "app_token": "t"},
        )

        success, _ = await NotificationService(db_session).test_channel(
            test_user.id, channel.id
        )

        assert success is True
        instance.notify.assert_called_once()

    async def test_unexpected_error_message_is_generic(
        self, db_session, test_user, apprise_mock, private_allowed
    ):
        _, instance = apprise_mock
        instance.notify.side_effect = ConnectionError("refused by 192.168.1.10:5432")
        channel = _stored_channel(
            db_session,
            test_user,
            "gotify",
            {"server_url": "http://192.168.1.10", "app_token": "t"},
        )

        success, message = await NotificationService(db_session).test_channel(
            test_user.id, channel.id
        )

        assert success is False
        assert message == TEST_ERROR_MESSAGE


class TestTestEndpointRateLimit:
    def test_eleventh_test_is_rejected(
        self, client, user_token_headers, apprise_mock, private_allowed
    ):
        channel_id = _create(
            client,
            user_token_headers,
            "gotify",
            {"server_url": "http://192.168.1.10", "app_token": "token12345"},
        ).json()["id"]
        url = f"{CHANNELS_URL}/{channel_id}/test"

        codes = [
            client.post(url, headers=user_token_headers).status_code for _ in range(11)
        ]

        assert codes[:10] == [status.HTTP_200_OK] * 10
        assert codes[10] == status.HTTP_429_TOO_MANY_REQUESTS


LOOPBACK = ipaddress.ip_address("127.0.0.1")


class TestPinnedResolution:
    def test_pinned_host_resolves_only_to_validated_address(self):
        with pinned_resolution("notify.test", [LOOPBACK]):
            infos = socket.getaddrinfo("notify.test", 443)

        assert {info[4][0] for info in infos} == {"127.0.0.1"}

    def test_other_hosts_fail_inside_the_pin(self):
        with pinned_resolution("notify.test", [LOOPBACK]):
            with pytest.raises(socket.gaierror):
                socket.getaddrinfo("redirect.test", 443)

    def test_other_threads_resolve_normally(self):
        seen = {}

        def resolve():
            seen["infos"] = socket.getaddrinfo("127.0.0.2", 80)

        with pinned_resolution("notify.test", [LOOPBACK]):
            worker = threading.Thread(target=resolve)
            worker.start()
            worker.join()

        assert {info[4][0] for info in seen["infos"]} == {"127.0.0.2"}

    def test_pin_ends_with_the_block(self):
        with pinned_resolution("notify.test", [LOOPBACK]):
            pass

        infos = socket.getaddrinfo("127.0.0.2", 80)
        assert {info[4][0] for info in infos} == {"127.0.0.2"}


class _RecordingHandler(BaseHTTPRequestHandler):
    requests = []

    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length", 0))
        self.rfile.read(length)
        _RecordingHandler.requests.append((self.path, self.headers.get("Host")))
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b"{}")

    def log_message(self, *args):
        pass


@pytest.fixture
def local_server():
    _RecordingHandler.requests = []
    server = HTTPServer(("127.0.0.1", 0), _RecordingHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server.server_address[1]
    server.shutdown()
    server.server_close()


@pytest.mark.asyncio
class TestSendConnectsToValidatedAddress:
    async def test_send_uses_pinned_address_and_keeps_hostname(
        self, db_session, test_user, local_server, private_allowed
    ):
        port = local_server
        channel = _stored_channel(
            db_session,
            test_user,
            "gotify",
            {"server_url": f"http://notify.test:{port}", "app_token": "token12345"},
        )

        # notify.test does not exist in DNS; only the pin can make it reach the server
        with patch(
            "app.services.notification_service.validate_integration_url",
            return_value=[LOOPBACK],
        ):
            success, _ = await NotificationService(db_session).test_channel(
                test_user.id, channel.id
            )

        assert success is True
        assert _RecordingHandler.requests == [("/message", f"notify.test:{port}")]

    async def test_send_never_resolves_hostname_again(
        self, db_session, test_user, apprise_mock, private_allowed
    ):
        _, instance = apprise_mock
        seen = {}

        def notify(**_kwargs):
            seen["pinned"] = socket.getaddrinfo("notify.test", 443)[0][4][0]
            with pytest.raises(socket.gaierror):
                socket.getaddrinfo("elsewhere.test", 443)
            return True

        instance.notify.side_effect = notify
        channel = _stored_channel(
            db_session,
            test_user,
            "webhook",
            {"url": "https://notify.test/hook"},
        )

        with patch(
            "app.services.notification_service.validate_integration_url",
            return_value=[ipaddress.ip_address("192.168.1.50")],
        ):
            (history,) = await _send_once(db_session, test_user, channel)

        assert history.status == "sent"
        assert seen["pinned"] == "192.168.1.50"


async def _send_once(db_session, user, channel):
    service = NotificationService(db_session)
    service.set_preference(user.id, channel.id, "backup_completed", True)
    return await service.send_notification(user.id, "backup_completed", "t", "b")
