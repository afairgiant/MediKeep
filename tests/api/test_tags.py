"""
Tests for the standalone tag-registry endpoints (app/api/v1/endpoints/tags.py).

Regression coverage for a bypass reported after the #1040 fix landed: a user
was able to create a tag with the value ``< &8 HTML > <p>`` even though
entity tags (via TaggedEntityMixin / TaggedEntityUpdateMixin) were already
allowlisted. The tag-registry endpoints - create/rename/replace - write tag
values directly (rename/replace via raw SQL straight into every taggable
entity's ``tags`` column) and had no validation of their own, so they were a
separate bypass of the same allowlist. This file covers that these three
endpoints now reject the same payloads TaggedEntityMixin does, and that the
rename/replace bypass in particular can no longer poison an existing
record's tags.

Uses shared fixtures from tests/api/conftest.py: user_with_patient,
authenticated_headers.
"""

import pytest
from fastapi.testclient import TestClient

MALICIOUS_TAG = "< &8 HTML > <p>"

# A blank or punctuation-only tag would otherwise pass normalize_and_validate_tag:
# all() over "" is vacuously True, and "." itself is allowed punctuation.
BLANK_OR_PUNCTUATION_ONLY_TAGS = ["", "   ", "...", "---", ":::"]


def _create_allergy_with_tag(client, headers, patient_id, tag):
    response = client.post(
        "/api/v1/allergies/",
        json={
            "allergen": "Penicillin",
            "reaction": "Hives",
            "severity": "severe",
            "status": "active",
            "patient_id": patient_id,
            "tags": [tag],
        },
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()


class TestTagCreateEndpointRejectsInjection:
    def test_create_rejects_reported_payload(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        response = client.post(
            "/api/v1/tags/create",
            json={"tag": MALICIOUS_TAG},
            headers=authenticated_headers,
        )
        assert response.status_code == 422

    def test_create_accepts_normal_tag(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        response = client.post(
            "/api/v1/tags/create",
            json={"tag": "Pre Diabetes"},
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text
        assert response.json()["tag"] == "pre-diabetes"

    @pytest.mark.parametrize("payload", BLANK_OR_PUNCTUATION_ONLY_TAGS)
    def test_create_rejects_blank_and_punctuation_only(
        self, client: TestClient, user_with_patient, authenticated_headers, payload
    ):
        response = client.post(
            "/api/v1/tags/create",
            json={"tag": payload},
            headers=authenticated_headers,
        )
        assert response.status_code == 422, response.text


class TestTagRenameEndpointRejectsInjection:
    def test_rename_rejects_reported_payload_and_leaves_record_untouched(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        allergy = _create_allergy_with_tag(
            client,
            authenticated_headers,
            user_with_patient["patient"].id,
            "diabetes",
        )

        response = client.put(
            "/api/v1/tags/rename",
            params={"old_tag": "diabetes", "new_tag": MALICIOUS_TAG},
            headers=authenticated_headers,
        )
        assert response.status_code == 400

        # The bypass this test guards against: rename/replace write straight
        # into every entity's tags column via raw SQL, so if validation were
        # skipped the payload would show up here even though nothing else
        # about the allergy record was touched.
        check = client.get(
            f"/api/v1/allergies/{allergy['id']}", headers=authenticated_headers
        )
        assert check.json()["tags"] == ["diabetes"]

    def test_rename_accepts_normal_tag(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        # rename_tag_across_entities writes via Postgres-only JSON functions
        # (json_agg / json_array_elements_text), which the SQLite test DB
        # doesn't support - so this only asserts the request clears
        # validation, not that the underlying rename SQL runs. That part is
        # pre-existing and untouched by this fix.
        _create_allergy_with_tag(
            client,
            authenticated_headers,
            user_with_patient["patient"].id,
            "diabetes",
        )

        response = client.put(
            "/api/v1/tags/rename",
            params={"old_tag": "diabetes", "new_tag": "Type 2 Diabetes"},
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text
        # The frontend uses this to show what was actually stored in its
        # success toast, rather than the raw un-normalized input.
        assert response.json()["new_tag"] == "type-2-diabetes"

    @pytest.mark.parametrize("payload", BLANK_OR_PUNCTUATION_ONLY_TAGS)
    def test_rename_rejects_blank_and_punctuation_only_new_tag(
        self, client: TestClient, user_with_patient, authenticated_headers, payload
    ):
        allergy = _create_allergy_with_tag(
            client,
            authenticated_headers,
            user_with_patient["patient"].id,
            "diabetes",
        )

        response = client.put(
            "/api/v1/tags/rename",
            params={"old_tag": "diabetes", "new_tag": payload},
            headers=authenticated_headers,
        )
        assert response.status_code == 400, response.text

        # Guards the actual impact: a blank/punctuation-only new_tag must not
        # blank the tag across the record via the raw-SQL rename path.
        check = client.get(
            f"/api/v1/allergies/{allergy['id']}", headers=authenticated_headers
        )
        assert check.json()["tags"] == ["diabetes"]


class TestTagReplaceEndpointRejectsInjection:
    def test_replace_rejects_reported_payload_and_leaves_record_untouched(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        allergy = _create_allergy_with_tag(
            client,
            authenticated_headers,
            user_with_patient["patient"].id,
            "diabetes",
        )

        response = client.put(
            "/api/v1/tags/replace",
            params={"old_tag": "diabetes", "new_tag": MALICIOUS_TAG},
            headers=authenticated_headers,
        )
        assert response.status_code == 400

        check = client.get(
            f"/api/v1/allergies/{allergy['id']}", headers=authenticated_headers
        )
        assert check.json()["tags"] == ["diabetes"]

    def test_replace_accepts_normal_tag_and_returns_normalized_new_tag(
        self, client: TestClient, user_with_patient, authenticated_headers
    ):
        # replace_tag_across_entities writes via Postgres-only JSON functions,
        # same limitation noted on the rename test above - this only asserts
        # the request clears validation and the response is well-formed.
        _create_allergy_with_tag(
            client,
            authenticated_headers,
            user_with_patient["patient"].id,
            "diabetes",
        )

        response = client.put(
            "/api/v1/tags/replace",
            params={"old_tag": "diabetes", "new_tag": "Type 2 Diabetes"},
            headers=authenticated_headers,
        )
        assert response.status_code == 200, response.text
        assert response.json()["new_tag"] == "type-2-diabetes"

    @pytest.mark.parametrize("payload", BLANK_OR_PUNCTUATION_ONLY_TAGS)
    def test_replace_rejects_blank_and_punctuation_only_new_tag(
        self, client: TestClient, user_with_patient, authenticated_headers, payload
    ):
        allergy = _create_allergy_with_tag(
            client,
            authenticated_headers,
            user_with_patient["patient"].id,
            "diabetes",
        )

        response = client.put(
            "/api/v1/tags/replace",
            params={"old_tag": "diabetes", "new_tag": payload},
            headers=authenticated_headers,
        )
        assert response.status_code == 400, response.text

        check = client.get(
            f"/api/v1/allergies/{allergy['id']}", headers=authenticated_headers
        )
        assert check.json()["tags"] == ["diabetes"]
