"""Visit start time and reminder settings on the encounter API."""

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.notifications import NotificationChannel, NotificationPreference

URL = "/api/v1/encounters/"


def _payload(patient_id, **overrides):
    data = {
        "reason": "Checkup",
        "date": str(date.today() + timedelta(days=7)),
        "patient_id": patient_id,
    }
    data.update(overrides)
    return data


def _create(client, headers, patient_id, **overrides):
    response = client.post(URL, json=_payload(patient_id, **overrides), headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def _enable_channel(db_session: Session, user_id: int) -> None:
    channel = NotificationChannel(
        user_id=user_id,
        name="test-ntfy",
        channel_type="ntfy",
        config_encrypted="not-really-encrypted",
        is_enabled=True,
    )
    db_session.add(channel)
    db_session.commit()
    db_session.add(
        NotificationPreference(
            user_id=user_id,
            channel_id=channel.id,
            event_type="visit_reminder_due",
            is_enabled=True,
        )
    )
    db_session.commit()


class TestVisitTimeAndReminderFields:
    def test_defaults_to_all_day_with_reminders_off(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        body = _create(client, authenticated_headers, user_with_patient["patient"].id)

        assert body["visit_time"] is None
        assert body["reminder_enabled"] is False
        assert body["reminder_offsets"] is None
        assert body["reminder_include_details"] is False

    def test_round_trips_time_and_sorted_offsets(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        body = _create(
            client,
            authenticated_headers,
            user_with_patient["patient"].id,
            visit_time="14:30:45",
            reminder_enabled=True,
            reminder_offsets=[1440, 60, 0],
            reminder_include_details=True,
        )

        assert body["visit_time"] == "14:30:00"
        assert body["reminder_offsets"] == [0, 60, 1440]
        assert body["reminder_include_details"] is True

    def test_blank_time_is_all_day(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        body = _create(
            client,
            authenticated_headers,
            user_with_patient["patient"].id,
            visit_time="",
        )
        assert body["visit_time"] is None

    @pytest.mark.parametrize(
        "overrides",
        [
            {"reminder_offsets": [60]},
            {"reminder_offsets": [-1440]},
            {"reminder_offsets": [31 * 1440]},
            {"reminder_offsets": [1440, 1440]},
            {"reminder_offsets": [i * 1440 for i in range(11)]},
            {"visit_time": "25:00"},
        ],
        ids=[
            "hours-on-all-day",
            "negative",
            "too-far",
            "duplicate",
            "too-many",
            "bad-time",
        ],
    )
    def test_rejects_invalid_reminders(
        self, client: TestClient, user_with_patient, authenticated_headers, overrides
    ):
        response = client.post(
            URL,
            json=_payload(user_with_patient["patient"].id, **overrides),
            headers=authenticated_headers,
        )
        assert response.status_code == 422

    def test_update_rejects_hour_offset_when_clearing_time(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        visit = _create(
            client,
            authenticated_headers,
            user_with_patient["patient"].id,
            visit_time="09:15",
            reminder_offsets=[60],
        )
        response = client.put(
            f"{URL}{visit['id']}",
            json={"visit_time": None, "reminder_offsets": [60]},
            headers=authenticated_headers,
        )
        assert response.status_code == 422

    @pytest.mark.parametrize(
        "saved, sent, expected",
        [
            (
                {"visit_time": "09:15", "reminder_offsets": [60]},
                {"visit_time": None},
                422,
            ),
            ({}, {"reminder_offsets": [60]}, 422),
            ({"visit_time": "09:15"}, {"reminder_offsets": [60]}, 200),
            ({"reminder_offsets": [1440]}, {"visit_time": None}, 200),
        ],
        ids=["clear-time", "hours-on-all-day", "hours-on-timed", "days-on-all-day"],
    )
    def test_partial_update_is_checked_against_saved_values(
        self,
        client: TestClient,
        user_with_patient,
        authenticated_headers,
        saved,
        sent,
        expected,
    ):
        visit = _create(
            client, authenticated_headers, user_with_patient["patient"].id, **saved
        )
        response = client.put(
            f"{URL}{visit['id']}", json=sent, headers=authenticated_headers
        )
        assert response.status_code == expected

    def test_update_rejects_null_reminder_enabled(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        visit = _create(client, authenticated_headers, user_with_patient["patient"].id)
        response = client.put(
            f"{URL}{visit['id']}",
            json={"reminder_enabled": None},
            headers=authenticated_headers,
        )
        assert response.status_code == 422

    def test_update_sets_reminders(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        visit = _create(client, authenticated_headers, user_with_patient["patient"].id)
        response = client.put(
            f"{URL}{visit['id']}",
            json={
                "visit_time": "08:00",
                "reminder_enabled": True,
                "reminder_offsets": [120],
            },
            headers=authenticated_headers,
        )
        assert response.status_code == 200
        assert response.json()["reminder_offsets"] == [120]


class TestVisitReminderTestEndpoint:
    def _url(self, encounter_id):
        return f"{URL}{encounter_id}/reminders/test"

    def test_returns_204_when_channel_enabled(
        self,
        client: TestClient,
        db_session: Session,
        user_with_patient,
        authenticated_headers,
    ):
        visit = _create(
            client,
            authenticated_headers,
            user_with_patient["patient"].id,
            reminder_enabled=True,
            reminder_offsets=[1440],
        )
        _enable_channel(db_session, user_with_patient["user"].id)

        response = client.post(self._url(visit["id"]), headers=authenticated_headers)
        assert response.status_code == 204

    def test_returns_400_when_reminders_off(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        visit = _create(client, authenticated_headers, user_with_patient["patient"].id)
        response = client.post(self._url(visit["id"]), headers=authenticated_headers)
        assert response.status_code == 400

    def test_returns_422_when_no_channel(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        visit = _create(
            client,
            authenticated_headers,
            user_with_patient["patient"].id,
            reminder_enabled=True,
            reminder_offsets=[1440],
        )
        response = client.post(self._url(visit["id"]), headers=authenticated_headers)
        assert response.status_code == 422

    def test_returns_404_for_unknown_visit(
        self, client: TestClient, authenticated_headers
    ):
        response = client.post(self._url(999999), headers=authenticated_headers)
        assert response.status_code == 404
