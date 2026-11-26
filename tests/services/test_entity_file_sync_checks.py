"""
Paperless-ngx and Papra sync checks.

Each check finds remote files through the record they are attached to, so it must
look at every record type files can be attached to (#1267). Only files on patients the
user can edit are checked or changed.
"""

import logging
from contextlib import asynccontextmanager
from datetime import date, datetime
from pathlib import Path
from urllib.parse import parse_qs
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.crud.patient import patient as patient_crud
from app.models.models import (
    EntityFile,
    MedicalEquipment,
    UserPreferences,
    get_utc_now,
)
from app.schemas.patient import PatientCreate
from app.services.generic_entity_file_service import (
    GenericEntityFileService,
    _ContentMatches,
    _file_name_matches,
)
from tests.utils.attachment_records import add_record_for_every_file_entity_type
from tests.utils.log_output import persisted_text
from tests.utils.paperless_uploads import (
    member,
    patient_for,
    share,
    use_paperless,
    use_papra,
)
from tests.utils.user import create_random_user

pytestmark = pytest.mark.asyncio

FILE_NAME = "manual.pdf"


class _RemoteWhereEveryDocumentIsGone:
    """Stands in for a Paperless service or a Papra client."""

    def __init__(self):
        self.checked = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False

    def get_auth_type(self):
        return "token"

    async def check_document_exists(self, document_id):
        self.checked.append(document_id)
        return False

    async def get_document_info(self, document_id):
        self.checked.append(document_id)
        return None


class _FakePaperlessApi:
    """Answers each Paperless API request with HTTP 200 and the body ``respond(endpoint)`` returns."""

    def __init__(self, respond):
        self.respond = respond

    @asynccontextmanager
    async def _make_request(self, method, endpoint):
        yield SimpleNamespace(
            status=200, json=AsyncMock(return_value=self.respond(endpoint))
        )


def _equipment(db_session, patient_id):
    record = MedicalEquipment(
        patient_id=patient_id,
        equipment_name="CPAP",
        equipment_type="cpap",
        status="active",
    )
    db_session.add(record)
    db_session.commit()
    return record


def _remote_file(
    db_session,
    record,
    backend,
    document_id,
    sync_status="synced",
    task_uuid=None,
    entity_type="medical-equipment",
    uploaded_by_user_id=None,
):
    entity_file = EntityFile(
        entity_type=entity_type,
        entity_id=record.id,
        file_name=FILE_NAME,
        file_path=f"{backend}://",
        file_type="application/pdf",
        file_size=1024,
        uploaded_at=get_utc_now(),
        storage_backend=backend,
        sync_status=sync_status,
        paperless_document_id=document_id if backend == "paperless" else None,
        paperless_task_uuid=task_uuid,
        papra_document_id=document_id if backend == "papra" else None,
        uploaded_by_user_id=uploaded_by_user_id,
    )
    db_session.add(entity_file)
    db_session.commit()
    return entity_file


def _remote_file_on_every_type(db_session, patient_id, backend, with_document_id):
    """One remote file under every entity type files can be attached to, keyed by that type."""
    files = {}
    for entity_type, record in add_record_for_every_file_entity_type(
        db_session, patient_id, date(2026, 1, 1)
    ):
        document_id = str(len(files) + 1) if with_document_id else None
        files[entity_type] = _remote_file(
            db_session, record, backend, document_id, entity_type=entity_type
        )
    return files


def _sync_statuses(db_session, files):
    for entity_file in files.values():
        db_session.refresh(entity_file)
    return {
        entity_type: entity_file.sync_status
        for entity_type, entity_file in files.items()
    }


async def _run_paperless_sync_check(db_session, user_id, remote):
    """Run the Paperless sync check against ``remote``; task resolution leaves every task pending."""
    with (
        patch(
            "app.services.generic_entity_file_service.has_usable_credentials",
            return_value=True,
        ),
        patch(
            "app.services.generic_entity_file_service.credential_kwargs",
            return_value={},
        ),
        patch(
            "app.services.paperless_service.create_paperless_service",
            return_value=remote,
        ),
        patch.object(
            GenericEntityFileService,
            "_resolve_task_uuids_to_document_ids",
            new=AsyncMock(),
        ),
    ):
        return await GenericEntityFileService().check_paperless_sync_status(
            db_session, user_id
        )


@pytest.fixture
def other_users_equipment(db_session):
    other = create_random_user(db_session)
    patient = patient_crud.create_for_user(
        db_session,
        user_id=other["user"].id,
        patient_data=PatientCreate(
            first_name="Other",
            last_name="User",
            birth_date=date(1990, 1, 1),
            gender="F",
        ),
    )
    return _equipment(db_session, patient.id)


@pytest.fixture
def remote():
    return _RemoteWhereEveryDocumentIsGone()


class TestPaperlessChecks:
    @pytest.fixture(autouse=True)
    def paperless_enabled(self, db_session, test_user):
        db_session.add(
            UserPreferences(
                user_id=test_user.id,
                paperless_enabled=True,
                paperless_url="https://paperless.invalid",
            )
        )
        db_session.commit()

    async def test_orphaned_equipment_file_is_marked_missing(
        self, db_session, test_user, test_patient, other_users_equipment
    ):
        mine = _remote_file(
            db_session, _equipment(db_session, test_patient.id), "paperless", None
        )
        theirs = _remote_file(db_session, other_users_equipment, "paperless", None)

        await GenericEntityFileService()._handle_orphaned_paperless_records(
            db_session, test_user.id
        )

        db_session.refresh(mine)
        db_session.refresh(theirs)
        assert mine.sync_status == "missing"
        assert theirs.sync_status == "synced"

    async def test_orphaned_files_on_every_record_type_are_marked_missing(
        self, db_session, test_user, test_patient
    ):
        files = _remote_file_on_every_type(
            db_session, test_patient.id, "paperless", with_document_id=False
        )

        await GenericEntityFileService()._handle_orphaned_paperless_records(
            db_session, test_user.id
        )

        assert _sync_statuses(db_session, files) == dict.fromkeys(files, "missing")

    async def test_file_whose_task_failed_is_marked_missing(
        self, db_session, test_user, test_patient
    ):
        # _resolve_task_uuids_to_document_ids marks a failed task "failed" but
        # keeps its task UUID, so a task UUID alone must not shield a record.
        failed = _remote_file(
            db_session,
            _equipment(db_session, test_patient.id),
            "paperless",
            None,
            sync_status="failed",
            task_uuid="task-failed",
        )

        await GenericEntityFileService()._handle_orphaned_paperless_records(
            db_session, test_user.id
        )

        db_session.refresh(failed)
        assert failed.sync_status == "missing"

    async def test_duplicate_upload_stays_duplicate(
        self, db_session, test_user, test_patient, remote
    ):
        duplicate = _remote_file(
            db_session,
            _equipment(db_session, test_patient.id),
            "paperless",
            None,
            sync_status="duplicate",
        )

        await GenericEntityFileService()._handle_orphaned_paperless_records(
            db_session, test_user.id
        )
        result = await _run_paperless_sync_check(db_session, test_user.id, remote)

        assert result == {duplicate.id: True}
        db_session.refresh(duplicate)
        assert duplicate.sync_status == "duplicate"

    async def test_upload_still_processing_is_not_marked_missing(
        self, db_session, test_user, test_patient, remote
    ):
        # Regression for #1273: the orphan check ran before task resolution and
        # marked uploads Paperless was still processing as missing.
        processing = _remote_file(
            db_session,
            _equipment(db_session, test_patient.id),
            "paperless",
            None,
            sync_status="processing",
            task_uuid="task-in-progress",
        )

        result = await _run_paperless_sync_check(db_session, test_user.id, remote)

        assert result == {processing.id: True}
        assert remote.checked == []
        db_session.refresh(processing)
        assert processing.sync_status == "processing"
        assert processing.paperless_task_uuid == "task-in-progress"

    async def test_upload_whose_task_paperless_lost_is_found_by_checksum(
        self, db_session, test_user, test_patient
    ):
        # Paperless no longer knows the first upload's task, so its document is
        # looked up by checksum and upload time. The second upload's task is
        # still running, so it is left alone.
        equipment = _equipment(db_session, test_patient.id)
        lost = _remote_file(
            db_session,
            equipment,
            "paperless",
            None,
            sync_status="processing",
            task_uuid="task-lost",
        )
        running = _remote_file(
            db_session,
            equipment,
            "paperless",
            None,
            sync_status="processing",
            task_uuid="task-running",
        )
        task_bodies = {
            "task-lost": {"results": []},
            "task-running": {
                "results": [
                    {
                        "task_id": "task-running",
                        "status": "STARTED",
                        "related_document": None,
                    }
                ]
            },
        }
        paperless = _FakePaperlessApi(
            lambda endpoint: task_bodies[endpoint.split("task_id=", 1)[1]]
        )
        service = GenericEntityFileService()

        with patch.object(
            service,
            "_find_documents_with_upload_content",
            new=AsyncMock(return_value=_ContentMatches(["555"])),
        ) as search:
            await service._resolve_task_uuids_to_document_ids(
                db_session, paperless, [lost, running], test_user.id
            )

        search.assert_awaited_once()
        db_session.refresh(lost)
        db_session.refresh(running)
        assert lost.sync_status == "synced"
        assert lost.paperless_document_id == "555"
        assert lost.paperless_task_uuid is None
        assert running.sync_status == "processing"
        assert running.paperless_document_id is None
        assert running.paperless_task_uuid == "task-running"

    async def test_upload_whose_task_cannot_be_read_is_found_by_checksum(
        self, db_session, test_user, test_patient
    ):
        # Regression for #1280: the account can upload but Paperless refuses its task reads.
        upload = _remote_file(
            db_session,
            _equipment(db_session, test_patient.id),
            "paperless",
            None,
            sync_status="processing",
            task_uuid="task-forbidden",
        )

        class _TasksForbidden:
            user_id = 1

            @asynccontextmanager
            async def _make_request(self, method, endpoint):
                yield SimpleNamespace(status=403, json=AsyncMock(return_value={}))

        service = GenericEntityFileService()
        with patch.object(
            service,
            "_find_documents_with_upload_content",
            new=AsyncMock(return_value=_ContentMatches(["321"])),
        ):
            await service._resolve_task_uuids_to_document_ids(
                db_session, _TasksForbidden(), [upload], test_user.id
            )

        db_session.refresh(upload)
        assert upload.sync_status == "synced"
        assert upload.paperless_document_id == "321"
        assert upload.paperless_task_uuid is None

    async def test_deleted_equipment_document_is_marked_missing(
        self, db_session, test_user, test_patient, other_users_equipment, remote
    ):
        mine = _remote_file(
            db_session, _equipment(db_session, test_patient.id), "paperless", "101"
        )
        theirs = _remote_file(db_session, other_users_equipment, "paperless", "202")

        result = await _run_paperless_sync_check(db_session, test_user.id, remote)

        assert result == {mine.id: False}
        assert remote.checked == ["101"]
        db_session.refresh(mine)
        db_session.refresh(theirs)
        assert mine.sync_status == "missing"
        assert theirs.sync_status == "synced"

    async def test_deleted_documents_on_every_record_type_are_marked_missing(
        self, db_session, test_user, test_patient, remote
    ):
        files = _remote_file_on_every_type(
            db_session, test_patient.id, "paperless", with_document_id=True
        )

        result = await _run_paperless_sync_check(db_session, test_user.id, remote)

        assert _sync_statuses(db_session, files) == dict.fromkeys(files, "missing")
        assert result == {f.id: False for f in files.values()}


SHA256 = "5f2b" * 16
MD5 = "9c1e" * 8


def _paperless_upload(sha256=SHA256, md5=MD5):
    """An unsaved Paperless upload made at noon UTC on 2026-11-19."""
    return EntityFile(
        entity_type="medical_equipment",
        entity_id=1,
        file_name=FILE_NAME,
        file_path="paperless://",
        file_type="application/pdf",
        storage_backend="paperless",
        sync_status="processing",
        uploaded_at=datetime(2026, 11, 19, 12, 0),
        paperless_sha256=sha256,
        paperless_md5=md5,
    )


def _paperless_listing_by_checksum(documents_by_checksum, requests=None):
    """A fake Paperless that lists the documents with the requested checksum."""

    def respond(endpoint):
        if requests is not None:
            requests.append(endpoint)
        query = parse_qs(endpoint.split("?", 1)[1])
        return {"results": documents_by_checksum.get(query["checksum__iexact"][0], [])}

    return _FakePaperlessApi(respond)


async def _find(upload, paperless):
    return await GenericEntityFileService()._find_documents_with_upload_content(
        upload, paperless
    )


@pytest.mark.parametrize(
    "added, matches",
    [
        # Stored upload times are naive UTC; Paperless timestamps can carry "Z".
        ("2026-11-19T12:05:00Z", _ContentMatches(["7"])),
        ("2026-11-19T12:05:00+00:00", _ContentMatches(["7"])),
        ("2026-11-19T15:00:00Z", _ContentMatches([])),
        ("2026-11-19T09:00:00Z", _ContentMatches([], earlier_copy=True)),
    ],
    ids=[
        "z_suffix",
        "utc_offset",
        "added_after_the_upload_window",
        "added_before_the_upload_window",
    ],
)
async def test_checksum_match_must_be_added_around_the_upload(added, matches):
    # "created" is the date read from the document, often long before the upload
    document = {"id": 7, "created": "2019-03-02", "added": added}
    paperless = _paperless_listing_by_checksum({SHA256: [document]})

    assert await _find(_paperless_upload(), paperless) == matches


async def test_lookup_asks_for_the_sha256_then_the_md5():
    requests = []

    await _find(_paperless_upload(), _paperless_listing_by_checksum({}, requests))

    assert [parse_qs(r.split("?", 1)[1])["checksum__iexact"] for r in requests] == [
        [SHA256],
        [MD5],
    ]


async def test_sha256_match_skips_the_md5_lookup():
    requests = []
    paperless = _paperless_listing_by_checksum(
        {SHA256: [{"id": 7, "added": "2026-11-19T12:05:00Z"}]}, requests
    )

    await _find(_paperless_upload(), paperless)

    assert len(requests) == 1


async def test_md5_match_is_from_a_paperless_that_rejects_re_uploads():
    paperless = _paperless_listing_by_checksum(
        {MD5: [{"id": 9, "added": "2026-11-19T12:05:00Z"}]}
    )

    assert await _find(_paperless_upload(), paperless) == _ContentMatches(
        ["9"], rejects_re_uploads=True
    )


async def test_upload_without_stored_checksums_is_not_looked_up():
    requests = []

    matches = await _find(
        _paperless_upload(sha256=None, md5=None),
        _paperless_listing_by_checksum({}, requests),
    )

    assert matches == _ContentMatches([])
    assert requests == []


async def test_failed_lookup_finds_nothing():
    def respond(endpoint):
        raise ConnectionError("Paperless went away")

    assert await _find(
        _paperless_upload(), _FakePaperlessApi(respond)
    ) == _ContentMatches([])


@pytest.mark.parametrize(
    "document, matches",
    [
        ({"title": "manual"}, True),
        ({"title": "Manual.PDF"}, True),
        ({"title": "", "original_file_name": "manual.pdf"}, True),
        ({"title": "man"}, False),
        ({"title": "my manual"}, False),
        ({"title": "", "original_file_name": "old-manual.pdf"}, False),
    ],
    ids=[
        "stem",
        "full_name_any_case",
        "original_name",
        "prefix",
        "longer_title",
        "other_original",
    ],
)
def test_file_name_match_is_exact(document, matches):
    assert _file_name_matches(document, "manual.pdf") is matches


async def _run_papra_sync_check(db_session, user_id, remote):
    with patch("app.services.papra_client.create_papra_client", return_value=remote):
        return await GenericEntityFileService().check_papra_sync_status(
            db_session, user_id
        )


class TestPapraCheck:
    @pytest.fixture(autouse=True)
    def papra_enabled(self, db_session, test_user):
        db_session.add(
            UserPreferences(
                user_id=test_user.id,
                papra_enabled=True,
                papra_url="https://papra.invalid",
                papra_api_token_encrypted="encrypted-token",
            )
        )
        db_session.commit()

    async def test_deleted_equipment_document_is_marked_missing(
        self, db_session, test_user, test_patient, other_users_equipment, remote
    ):
        mine = _remote_file(
            db_session, _equipment(db_session, test_patient.id), "papra", "doc-1"
        )
        theirs = _remote_file(db_session, other_users_equipment, "papra", "doc-2")

        result = await _run_papra_sync_check(db_session, test_user.id, remote)

        assert result == {mine.id: False}
        assert remote.checked == ["doc-1"]
        db_session.refresh(mine)
        db_session.refresh(theirs)
        assert mine.sync_status == "missing"
        assert theirs.sync_status == "synced"

    async def test_deleted_documents_on_every_record_type_are_marked_missing(
        self, db_session, test_user, test_patient, remote
    ):
        files = _remote_file_on_every_type(
            db_session, test_patient.id, "papra", with_document_id=True
        )

        result = await _run_papra_sync_check(db_session, test_user.id, remote)

        assert _sync_statuses(db_session, files) == dict.fromkeys(files, "missing")
        assert result == {f.id: False for f in files.values()}


SHARED_PAPERLESS = "https://paperless.family"
SHARED_PAPRA = "https://papra.family"


class _RemoteWhereEveryDocumentExists(_RemoteWhereEveryDocumentIsGone):
    async def check_document_exists(self, document_id):
        self.checked.append(document_id)
        return True


class _RemoteThatFails(_RemoteWhereEveryDocumentIsGone):
    async def check_document_exists(self, document_id):
        self.checked.append(document_id)
        raise RuntimeError("connection reset")


class TestSharedPatients:
    """An editor's checks cover the patients shared with them, through their own connection."""

    @pytest.fixture
    def owner(self, db_session):
        return member(db_session, SHARED_PAPERLESS, SHARED_PAPRA)

    @pytest.fixture
    def editor(self, db_session):
        return member(db_session, SHARED_PAPERLESS, SHARED_PAPRA)

    def _shared_equipment(
        self, db_session, owner, editor, permission_level="edit", restrict=None
    ):
        """Equipment on an owner's patient shared with ``editor``; ``restrict(patient, share)`` may narrow it."""
        patient = patient_for(db_session, owner.id)
        patient_share = share(
            db_session, patient, owner.id, editor.id, permission_level
        )
        if restrict:
            restrict(patient, patient_share)
            db_session.commit()
        return _equipment(db_session, patient.id)

    async def test_paperless_check_marks_the_editors_own_upload_missing(
        self, db_session, owner, editor, remote
    ):
        record = self._shared_equipment(db_session, owner, editor)
        mine = _remote_file(
            db_session, record, "paperless", "7", uploaded_by_user_id=editor.id
        )

        result = await _run_paperless_sync_check(db_session, editor.id, remote)

        assert result == {mine.id: False}
        db_session.refresh(mine)
        assert mine.sync_status == "missing"

    async def test_another_users_upload_not_found_is_left_alone(
        self, db_session, owner, editor, remote
    ):
        # Paperless answers 404 for a document this account may not view
        record = self._shared_equipment(db_session, owner, editor)
        theirs = _remote_file(
            db_session, record, "paperless", "7", uploaded_by_user_id=owner.id
        )

        result = await _run_paperless_sync_check(db_session, editor.id, remote)

        assert result == {theirs.id: None}
        assert remote.checked == ["7"]
        db_session.refresh(theirs)
        assert theirs.sync_status == "synced"

    async def test_another_users_upload_that_is_found_recovers(
        self, db_session, owner, editor
    ):
        record = self._shared_equipment(db_session, owner, editor)
        theirs = _remote_file(
            db_session,
            record,
            "paperless",
            "7",
            sync_status="error",
            uploaded_by_user_id=owner.id,
        )

        result = await _run_paperless_sync_check(
            db_session, editor.id, _RemoteWhereEveryDocumentExists()
        )

        assert result == {theirs.id: True}
        db_session.refresh(theirs)
        assert theirs.sync_status == "synced"

    @pytest.mark.parametrize(
        "permission_level, restrict",
        [
            ("view", None),
            ("edit", lambda _, s: setattr(s, "expires_at", datetime(2020, 1, 1))),
            ("edit", lambda _, s: setattr(s, "is_active", False)),
            ("edit", lambda p, _: setattr(p, "privacy_level", "private")),
        ],
        ids=["view-only", "expired", "inactive", "private-patient"],
    )
    async def test_share_without_edit_access_is_not_checked(
        self, db_session, owner, editor, remote, permission_level, restrict
    ):
        record = self._shared_equipment(
            db_session, owner, editor, permission_level, restrict
        )
        shared = _remote_file(
            db_session, record, "paperless", "7", uploaded_by_user_id=owner.id
        )
        papra = _remote_file(
            db_session, record, "papra", "doc-7", uploaded_by_user_id=owner.id
        )

        assert await _run_paperless_sync_check(db_session, editor.id, remote) == {}
        assert await _run_papra_sync_check(db_session, editor.id, remote) == {}
        assert remote.checked == []
        db_session.refresh(shared)
        db_session.refresh(papra)
        assert (shared.sync_status, papra.sync_status) == ("synced", "synced")

    @pytest.mark.parametrize("backend", ["paperless", "papra"])
    async def test_unknown_uploader_is_checked_only_on_own_patients(
        self, db_session, owner, editor, remote, backend
    ):
        shared = _remote_file(
            db_session, self._shared_equipment(db_session, owner, editor), backend, "7"
        )
        own = _remote_file(
            db_session,
            _equipment(db_session, patient_for(db_session, editor.id).id),
            backend,
            "8",
        )

        run = (
            _run_paperless_sync_check
            if backend == "paperless"
            else _run_papra_sync_check
        )
        result = await run(db_session, editor.id, remote)

        assert result == {own.id: False}
        db_session.refresh(shared)
        assert shared.sync_status == "synced"

    async def test_orphan_pass_covers_an_edit_share(self, db_session, owner, editor):
        record = self._shared_equipment(db_session, owner, editor)
        orphan = _remote_file(
            db_session, record, "paperless", None, uploaded_by_user_id=owner.id
        )
        unknown = _remote_file(db_session, record, "paperless", None)

        await GenericEntityFileService()._handle_orphaned_paperless_records(
            db_session, editor.id
        )

        db_session.refresh(orphan)
        db_session.refresh(unknown)
        assert (orphan.sync_status, unknown.sync_status) == ("missing", "synced")

    async def test_papra_check_covers_an_edit_share(
        self, db_session, owner, editor, remote
    ):
        record = self._shared_equipment(db_session, owner, editor)
        shared = _remote_file(
            db_session, record, "papra", "doc-7", uploaded_by_user_id=owner.id
        )
        shared.papra_organization_id = "org-1"
        db_session.commit()

        result = await _run_papra_sync_check(db_session, editor.id, remote)

        assert result == {shared.id: False}
        assert remote.checked == ["doc-7"]


@pytest.mark.parametrize(
    "backend, remote_cls",
    [
        ("paperless", _RemoteWhereEveryDocumentIsGone),
        ("paperless", _RemoteThatFails),
        ("papra", _RemoteWhereEveryDocumentIsGone),
    ],
)
async def test_sync_checks_never_log_file_names(
    db_session, test_user, test_patient, caplog, backend, remote_cls
):
    record = _equipment(db_session, test_patient.id)
    if backend == "paperless":
        use_paperless(db_session, test_user.id)
        _remote_file(db_session, record, "paperless", "1")
        _remote_file(db_session, record, "paperless", None, sync_status="failed")
        run = _run_paperless_sync_check
    else:
        use_papra(db_session, test_user.id)
        _remote_file(db_session, record, "papra", "doc-1")
        run = _run_papra_sync_check

    with caplog.at_level(logging.DEBUG):
        await run(db_session, test_user.id, remote_cls())

    assert caplog.records
    assert Path(FILE_NAME).stem not in persisted_text(caplog)
