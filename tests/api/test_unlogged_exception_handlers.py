"""Handlers that replace an exception with a fixed message still log it (issue #1200).

When the response hides the cause, the log is the only place it is recorded, so
it has to be there. The static rule in tests/core/test_error_responses_no_exception_text.py
covers every handler; these check that the text really reaches a log record for
the handlers that were missing it.
"""

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

import app.api.v1.endpoints.papra as papra_module
import app.api.v1.endpoints.practitioner as practitioner_module
from app.crud.base import CRUDBase
from app.crud.medical_specialty import medical_specialty
from app.models.models import UserPreferences

# Stands in for the detail that makes a failure diagnosable.
CAUSE = "CAUSE-DETAIL constraint practitioners_fk /var/lib/db"


def _logged_causes(caplog):
    return [str(getattr(record, "error", "")) for record in caplog.records]


def _database_refusal() -> IntegrityError:
    return IntegrityError("DELETE FROM practitioners", {}, Exception(CAUSE))


class TestPractitionerDeleteRefusedByDatabase:
    def test_cause_is_logged_and_client_gets_the_fixed_message(
        self, authenticated_client, monkeypatch, caplog
    ):
        def refuse(*args, **kwargs):
            raise _database_refusal()

        monkeypatch.setattr(practitioner_module, "handle_delete_with_logging", refuse)

        with caplog.at_level("WARNING"):
            response = authenticated_client.delete("/api/v1/practitioners/987654")

        assert response.status_code == 409
        assert response.json()["message"] == practitioner_module.IN_USE_DETAIL
        assert CAUSE not in response.text
        assert any(CAUSE in cause for cause in _logged_causes(caplog))


class TestSpecialtyDeleteRefusedByDatabase:
    def test_cause_is_logged_and_client_gets_the_fixed_message(
        self, db_session, monkeypatch, caplog
    ):
        def refuse(*args, **kwargs):
            raise _database_refusal()

        monkeypatch.setattr(CRUDBase, "delete", refuse)

        with caplog.at_level("WARNING"):
            with pytest.raises(HTTPException) as raised:
                medical_specialty.delete(db_session, id=987654)

        assert raised.value.status_code == 409
        assert CAUSE not in str(raised.value.detail)
        assert any(CAUSE in cause for cause in _logged_causes(caplog))


class TestPapraSavedTokenCannotBeDecrypted:
    def test_cause_is_logged_and_client_gets_the_fixed_message(
        self, authenticated_client, db_session, test_user, monkeypatch, caplog
    ):
        db_session.add(
            UserPreferences(
                user_id=test_user.id,
                papra_enabled=True,
                papra_url="http://127.0.0.1:9",
                papra_api_token_encrypted="not-decryptable",
            )
        )
        db_session.commit()

        def undecryptable(token):
            raise papra_module.SecurityError(CAUSE)

        monkeypatch.setattr(papra_module, "decrypt_papra_token", undecryptable)

        with caplog.at_level("ERROR"):
            response = authenticated_client.post(
                "/api/v1/papra/test-connection",
                json={
                    "papra_url": "http://127.0.0.1:9",
                    "papra_organization_id": "org_1",
                },
            )

        assert response.status_code == 400
        assert "re-enter your token" in response.json()["message"]
        assert CAUSE not in response.text
        assert any(CAUSE in cause for cause in _logged_causes(caplog))


class TestPapraConnectionTestKeepsItsDeliberate400s:
    """These 400s used to be swallowed by the broad handler and returned as a 500."""

    def test_no_token_and_nothing_saved(self, authenticated_client):
        response = authenticated_client.post(
            "/api/v1/papra/test-connection",
            json={"papra_url": "http://127.0.0.1:9", "papra_organization_id": "org_1"},
        )

        assert response.status_code == 400
        assert "No API token provided" in response.json()["message"]
