"""The chosen Paperless authentication method round-trips through the real routes.

These use the real database and the real response models: the Settings page
reads its state from GET /users/me/preferences, whose response model would drop
a field it did not declare.
"""

PREFS_URL = "/api/v1/users/me/preferences"
SETTINGS_URL = "/api/v1/paperless/settings"
BOTH_CREDENTIALS = {
    "paperless_api_token": "a-valid-token-0123456789",
    "paperless_username": "admin",
    "paperless_password": "secret-password",
}


def _prefs(client):
    response = client.get(PREFS_URL)
    assert response.status_code == 200, response.text
    return response.json()


def test_chosen_method_is_returned_by_every_settings_route(authenticated_client):
    saved = authenticated_client.put(SETTINGS_URL, json=BOTH_CREDENTIALS)
    assert saved.status_code == 200, saved.text
    # With nothing chosen the token still wins, as before the choice existed
    assert saved.json()["paperless_auth_method"] == "token"

    chosen = authenticated_client.put(
        SETTINGS_URL, json={"paperless_auth_method": "basic_auth"}
    )
    assert chosen.status_code == 200, chosen.text
    assert chosen.json()["paperless_auth_method"] == "basic_auth"
    assert chosen.json()["paperless_has_token"] is True  # the token is kept

    assert _prefs(authenticated_client)["paperless_auth_method"] == "basic_auth"
    assert (
        authenticated_client.get(SETTINGS_URL).json()["paperless_auth_method"]
        == "basic_auth"
    )


def test_general_preferences_update_keeps_the_chosen_method(authenticated_client):
    authenticated_client.put(SETTINGS_URL, json=BOTH_CREDENTIALS)
    authenticated_client.put(SETTINGS_URL, json={"paperless_auth_method": "basic_auth"})

    response = authenticated_client.put(PREFS_URL, json={"date_format": "dmy"})

    assert response.status_code == 200, response.text
    assert response.json()["paperless_auth_method"] == "basic_auth"


def test_unconfigured_method_is_rejected_and_nothing_is_saved(authenticated_client):
    authenticated_client.put(
        SETTINGS_URL,
        json={"paperless_api_token": BOTH_CREDENTIALS["paperless_api_token"]},
    )

    response = authenticated_client.put(
        SETTINGS_URL, json={"paperless_auth_method": "basic_auth"}
    )

    assert response.status_code == 400, response.text
    assert _prefs(authenticated_client)["paperless_auth_method"] == "token"
