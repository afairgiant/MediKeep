"""Tests for the blood_donation_intervals user preference."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.user_preferences import user_preferences
from tests.utils.user import create_random_user, create_user_authentication_headers


def _headers(client: TestClient, db_session: Session):
    user_data = create_random_user(db_session)
    return create_user_authentication_headers(
        client=client,
        username=user_data["username"],
        password=user_data["password"],
    )


class TestBloodDonationIntervalsPreference:
    def test_defaults_to_null(self, client: TestClient, db_session: Session):
        headers = _headers(client, db_session)
        response = client.get("/api/v1/users/me/preferences", headers=headers)
        assert response.status_code == 200
        assert response.json()["blood_donation_intervals"] is None

    def test_update_and_persist(self, client: TestClient, db_session: Session):
        headers = _headers(client, db_session)
        intervals = {"whole_blood": 84, "plasma": 2}
        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"blood_donation_intervals": intervals},
        )
        assert response.status_code == 200
        assert response.json()["blood_donation_intervals"] == intervals

        response = client.get("/api/v1/users/me/preferences", headers=headers)
        assert response.json()["blood_donation_intervals"] == intervals

    def test_reset_with_null(self, client: TestClient, db_session: Session):
        headers = _headers(client, db_session)
        client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"blood_donation_intervals": {"plasma": 3}},
        )
        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"blood_donation_intervals": None},
        )
        assert response.status_code == 200
        assert response.json()["blood_donation_intervals"] is None

        # A follow-up GET must also reflect the reset, not just the PUT response.
        response = client.get("/api/v1/users/me/preferences", headers=headers)
        assert response.status_code == 200
        assert response.json()["blood_donation_intervals"] is None

    def test_empty_dict_treated_as_null(
        self, client: TestClient, db_session: Session
    ):
        headers = _headers(client, db_session)
        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"blood_donation_intervals": {}},
        )
        assert response.status_code == 200
        assert response.json()["blood_donation_intervals"] is None

        response = client.get("/api/v1/users/me/preferences", headers=headers)
        assert response.json()["blood_donation_intervals"] is None

    def test_boundary_values_accepted(
        self, client: TestClient, db_session: Session
    ):
        headers = _headers(client, db_session)
        for days in (1, 365):
            response = client.put(
                "/api/v1/users/me/preferences",
                headers=headers,
                json={"blood_donation_intervals": {"whole_blood": days}},
            )
            assert response.status_code == 200
            assert response.json()["blood_donation_intervals"] == {
                "whole_blood": days
            }

    def test_unknown_type_rejected(self, client: TestClient, db_session: Session):
        headers = _headers(client, db_session)
        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"blood_donation_intervals": {"bone_marrow": 30}},
        )
        assert response.status_code == 422

    def test_out_of_range_rejected(self, client: TestClient, db_session: Session):
        headers = _headers(client, db_session)
        for days in (0, 366):
            response = client.put(
                "/api/v1/users/me/preferences",
                headers=headers,
                json={"blood_donation_intervals": {"whole_blood": days}},
            )
            assert response.status_code == 422

    def test_boolean_value_rejected(self, client: TestClient, db_session: Session):
        """Booleans must not be accepted as interval day counts."""
        headers = _headers(client, db_session)
        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"blood_donation_intervals": {"whole_blood": True}},
        )
        assert response.status_code == 422

    def test_list_value_rejected(self, client: TestClient, db_session: Session):
        """A list instead of a dict must be rejected with 422, not 500."""
        headers = _headers(client, db_session)
        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"blood_donation_intervals": [1, 2]},
        )
        assert response.status_code == 422

    def test_string_value_rejected(self, client: TestClient, db_session: Session):
        """A plain string instead of a dict must be rejected with 422, not 500."""
        headers = _headers(client, db_session)
        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"blood_donation_intervals": "hello"},
        )
        assert response.status_code == 422

    def test_float_value_rejected(self, client: TestClient, db_session: Session):
        """Float interval values must be rejected (StrictInt only)."""
        headers = _headers(client, db_session)
        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"blood_donation_intervals": {"whole_blood": 56.5}},
        )
        assert response.status_code == 422

    def test_numeric_string_value_rejected(
        self, client: TestClient, db_session: Session
    ):
        """Numeric strings must not be coerced to int (StrictInt only)."""
        headers = _headers(client, db_session)
        response = client.put(
            "/api/v1/users/me/preferences",
            headers=headers,
            json={"blood_donation_intervals": {"whole_blood": "56"}},
        )
        assert response.status_code == 422

    def test_legacy_invalid_value_still_readable(
        self, client: TestClient, db_session: Session
    ):
        """
        A value that predates (or bypasses) validation — an out-of-range day
        count or an unknown donation type key — must not break reads. The
        read schema is intentionally lenient; the eligibility service's
        resolve_intervals() already ignores invalid entries at use time.
        """
        user_data = create_random_user(db_session)
        headers = create_user_authentication_headers(
            client=client,
            username=user_data["username"],
            password=user_data["password"],
        )
        user = user_data["user"]

        prefs = user_preferences.get_or_create_by_user_id(db_session, user_id=user.id)
        prefs.blood_donation_intervals = {"whole_blood": 400, "foo": 3}
        db_session.commit()

        response = client.get("/api/v1/users/me/preferences", headers=headers)
        assert response.status_code == 200
        assert response.json()["blood_donation_intervals"] == {
            "whole_blood": 400,
            "foo": 3,
        }
