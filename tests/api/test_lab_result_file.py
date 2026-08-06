"""
Regression tests for GHSA-hmv9 (cross-user IDOR in the lab-result-files API).

The /api/v1/lab-result-files/* endpoints historically looked up files and lab
results by their raw, sequential ID with no verification that the owning patient
belonged to (or was shared with) the current user. Any authenticated account
could read, enumerate, modify, and delete any other user's lab-result files.

These tests assert that every endpoint now enforces patient-scoped access:
reads require 'view', writes/deletes require 'edit', and the unfiltered
list/search endpoints only ever return the caller's own files.
"""

import io
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.lab_result import lab_result as lab_result_crud
from app.crud.patient import patient as patient_crud
from app.models.models import PatientShare
from app.schemas.lab_result import LabResultCreate
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers


def _make_user_with_patient(db_session: Session, first_name: str):
    """Create a user with an active patient and return (user, patient, headers)."""
    user_data = create_random_user(db_session)
    patient = patient_crud.create_for_user(
        db_session,
        user_id=user_data["user"].id,
        patient_data=PatientCreate(
            first_name=first_name,
            last_name="Tester",
            birth_date=date(1988, 3, 3),
            gender="M",
        ),
    )
    user_data["user"].active_patient_id = patient.id
    db_session.commit()
    db_session.refresh(user_data["user"])
    headers = create_user_token_headers(user_data["user"].username)
    return user_data["user"], patient, headers


class TestLabResultFileCrossUserAccess:
    """A user with no relationship to the owner must be fully locked out."""

    @pytest.fixture
    def owner_setup(self, db_session: Session, client: TestClient):
        """Owner with a lab result and one uploaded file."""
        owner, patient, headers = _make_user_with_patient(db_session, "Owner")
        lab_result = lab_result_crud.create(
            db_session,
            obj_in=LabResultCreate(
                test_name="Confidential Panel",
                completed_date=date.today(),
                status="completed",
                patient_id=patient.id,
            ),
        )
        files = {
            "file": ("hiv_panel.txt", io.BytesIO(b"CONFIDENTIAL RESULT"), "text/plain")
        }
        upload = client.post(
            f"/api/v1/lab-result-files/upload/{lab_result.id}",
            headers=headers,
            files=files,
        )
        assert upload.status_code == 201
        return {
            "owner_headers": headers,
            "lab_result_id": lab_result.id,
            "file_id": upload.json()["id"],
        }

    @pytest.fixture
    def attacker_headers(self, db_session: Session):
        """A brand-new, unrelated account."""
        _, _, headers = _make_user_with_patient(db_session, "Attacker")
        return headers

    def test_owner_can_download_own_file(self, client, owner_setup):
        resp = client.get(
            f"/api/v1/lab-result-files/{owner_setup['file_id']}/download",
            headers=owner_setup["owner_headers"],
        )
        assert resp.status_code == 200

    def test_attacker_cannot_read_metadata(
        self, client, owner_setup, attacker_headers
    ):
        resp = client.get(
            f"/api/v1/lab-result-files/{owner_setup['file_id']}",
            headers=attacker_headers,
        )
        assert resp.status_code == 403

    def test_attacker_cannot_download(self, client, owner_setup, attacker_headers):
        resp = client.get(
            f"/api/v1/lab-result-files/{owner_setup['file_id']}/download",
            headers=attacker_headers,
        )
        assert resp.status_code == 403

    def test_attacker_cannot_update(self, client, owner_setup, attacker_headers):
        resp = client.put(
            f"/api/v1/lab-result-files/{owner_setup['file_id']}",
            headers=attacker_headers,
            json={"description": "tampered"},
        )
        assert resp.status_code == 403

    def test_attacker_cannot_delete(self, client, owner_setup, attacker_headers):
        resp = client.delete(
            f"/api/v1/lab-result-files/{owner_setup['file_id']}",
            headers=attacker_headers,
        )
        assert resp.status_code == 403

    def test_attacker_cannot_upload_to_owner_lab_result(
        self, client, owner_setup, attacker_headers
    ):
        files = {"file": ("evil.txt", io.BytesIO(b"evil"), "text/plain")}
        resp = client.post(
            f"/api/v1/lab-result-files/upload/{owner_setup['lab_result_id']}",
            headers=attacker_headers,
            files=files,
        )
        assert resp.status_code == 403

    def test_attacker_cannot_list_owner_files(
        self, client, owner_setup, attacker_headers
    ):
        """The unfiltered list endpoint must not leak other users' files."""
        resp = client.get(
            "/api/v1/lab-result-files/", headers=attacker_headers
        )
        assert resp.status_code == 200
        returned_ids = {item["id"] for item in resp.json()}
        assert owner_setup["file_id"] not in returned_ids

    def test_attacker_cannot_read_files_by_lab_result(
        self, client, owner_setup, attacker_headers
    ):
        resp = client.get(
            f"/api/v1/lab-result-files/lab-result/{owner_setup['lab_result_id']}",
            headers=attacker_headers,
        )
        assert resp.status_code == 403

    def test_attacker_search_excludes_owner_files(
        self, client, owner_setup, attacker_headers
    ):
        resp = client.get(
            "/api/v1/lab-result-files/search/by-filename",
            headers=attacker_headers,
            params={"filename_pattern": "hiv"},
        )
        assert resp.status_code == 200
        returned_ids = {item["id"] for item in resp.json()}
        assert owner_setup["file_id"] not in returned_ids

    def test_attacker_cannot_delete_all_owner_files(
        self, client, owner_setup, attacker_headers
    ):
        resp = client.delete(
            f"/api/v1/lab-result-files/lab-result/{owner_setup['lab_result_id']}/files",
            headers=attacker_headers,
        )
        assert resp.status_code == 403


class TestLabResultFileSharePermissions:
    """View shares are read-only; edit shares can manage files."""

    def _setup(self, db_session, client, permission_level):
        owner, owner_patient, owner_headers = _make_user_with_patient(
            db_session, "ShareOwner"
        )
        lab_result = lab_result_crud.create(
            db_session,
            obj_in=LabResultCreate(
                test_name="Shared Panel",
                completed_date=date.today(),
                status="completed",
                patient_id=owner_patient.id,
            ),
        )
        files = {"file": ("shared.txt", io.BytesIO(b"shared content"), "text/plain")}
        upload = client.post(
            f"/api/v1/lab-result-files/upload/{lab_result.id}",
            headers=owner_headers,
            files=files,
        )
        assert upload.status_code == 201
        file_id = upload.json()["id"]

        recipient, _, recipient_headers = _make_user_with_patient(
            db_session, "ShareRecipient"
        )
        share = PatientShare(
            patient_id=owner_patient.id,
            shared_by_user_id=owner.id,
            shared_with_user_id=recipient.id,
            permission_level=permission_level,
            is_active=True,
        )
        db_session.add(share)
        db_session.commit()
        return {
            "recipient_headers": recipient_headers,
            "lab_result_id": lab_result.id,
            "file_id": file_id,
        }

    def test_view_share_can_download_but_not_delete(self, client, db_session):
        ctx = self._setup(db_session, client, "view")

        download = client.get(
            f"/api/v1/lab-result-files/{ctx['file_id']}/download",
            headers=ctx["recipient_headers"],
        )
        assert download.status_code == 200

        delete = client.delete(
            f"/api/v1/lab-result-files/{ctx['file_id']}",
            headers=ctx["recipient_headers"],
        )
        assert delete.status_code == 403

    def test_view_share_cannot_update(self, client, db_session):
        ctx = self._setup(db_session, client, "view")
        resp = client.put(
            f"/api/v1/lab-result-files/{ctx['file_id']}",
            headers=ctx["recipient_headers"],
            json={"description": "tampered by view user"},
        )
        assert resp.status_code == 403

    def test_edit_share_can_upload_and_delete(self, client, db_session):
        ctx = self._setup(db_session, client, "edit")

        files = {"file": ("added.txt", io.BytesIO(b"added"), "text/plain")}
        upload = client.post(
            f"/api/v1/lab-result-files/upload/{ctx['lab_result_id']}",
            headers=ctx["recipient_headers"],
            files=files,
        )
        assert upload.status_code == 201

        delete = client.delete(
            f"/api/v1/lab-result-files/{upload.json()['id']}",
            headers=ctx["recipient_headers"],
        )
        assert delete.status_code == 200
