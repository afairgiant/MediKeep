"""Unit tests for paperless-ngx task payload normalization (API v9 and v10)."""

import pytest

from app.services.paperless_task_status import (
    ParsedTask,
    extract_task,
    parse_task,
)


def v9_success(document_id: int = 2677) -> dict:
    """Task payload as paperless-ngx returns it for API version 9."""
    return {
        "id": 4109,
        "task_id": "4a8e8eee-bc89-4290-a7a5-5d01cb08d54d",
        "task_name": "consume_file",
        "status": "SUCCESS",
        "result": f"Success. New document id {document_id} created",
        "related_document": document_id,
        "duplicate_documents": [],
    }


def v10_success(document_id: int = 2677) -> dict:
    """Task payload as paperless-ngx 3.x returns it for API version 10."""
    return {
        "id": 4109,
        "task_id": "4a8e8eee-bc89-4290-a7a5-5d01cb08d54d",
        "task_type": "consume_file",
        "trigger_source": "api_upload",
        "status": "success",
        "status_display": "Success",
        "input_data": {"filename": "report.pdf"},
        "result_data": {"document_id": document_id},
        "related_document_ids": [document_id],
    }


class TestExtractTask:
    """Response envelope handling."""

    def test_paginated_response(self):
        assert extract_task({"count": 1, "results": [v10_success()]}) == v10_success()

    def test_bare_list_response(self):
        assert extract_task([v9_success()]) == v9_success()

    def test_single_task_object(self):
        assert extract_task(v10_success()) == v10_success()

    def test_empty_results(self):
        assert extract_task({"count": 0, "results": []}) is None

    def test_empty_list(self):
        assert extract_task([]) is None

    def test_unexpected_payload(self):
        assert extract_task("not a task") is None
        assert extract_task(None) is None
        assert extract_task({"detail": "Not found"}) is None


class TestParseSuccess:
    """Successful consumption across both API versions."""

    def test_v9_success(self):
        parsed = parse_task(v9_success())

        assert parsed.is_success
        assert parsed.document_id == "2677"
        assert parsed.is_duplicate is False

    def test_v10_success(self):
        parsed = parse_task(v10_success())

        assert parsed.is_success
        assert parsed.document_id == "2677"

    def test_v10_success_without_related_document_ids(self):
        task = v10_success()
        del task["related_document_ids"]

        assert parse_task(task).document_id == "2677"

    def test_v9_success_without_related_document(self):
        task = v9_success()
        del task["related_document"]

        assert parse_task(task).document_id == "2677"

    def test_v9_success_with_dict_result(self):
        task = v9_success()
        task["result"] = {"document_id": 55}
        del task["related_document"]

        assert parse_task(task).document_id == "55"

    def test_success_without_any_document_id(self):
        parsed = parse_task({"status": "success", "result_data": {}})

        assert parsed.is_success
        assert parsed.document_id is None


class TestParseFailure:
    """Failed consumption across both API versions."""

    def test_v9_duplicate(self):
        parsed = parse_task(
            {
                "status": "FAILURE",
                "result": "Not consuming report.pdf: It is a duplicate of report (#42)",
            }
        )

        assert parsed.is_failure
        assert parsed.is_duplicate is True
        assert parsed.document_id is None

    def test_v10_duplicate(self):
        parsed = parse_task(
            {
                "status": "failure",
                "result_data": {"duplicate_of": 42},
                "related_document_ids": [42],
            }
        )

        assert parsed.is_failure
        assert parsed.is_duplicate is True
        assert (
            parsed.error_message == "Not consuming: It is a duplicate of document #42"
        )
        # The duplicated document must not be linked as the upload's own document.
        assert parsed.document_id is None

    def test_v10_error_message(self):
        parsed = parse_task(
            {
                "status": "failure",
                "result_data": {"error_message": "OCR failed for report.pdf"},
            }
        )

        assert parsed.is_failure
        assert parsed.error_message == "OCR failed for report.pdf"
        assert parsed.is_duplicate is False

    def test_v10_reason(self):
        parsed = parse_task(
            {"status": "failure", "result_data": {"reason": "Unsupported file type"}}
        )

        assert parsed.error_message == "Unsupported file type"

    def test_failure_without_result(self):
        parsed = parse_task({"status": "failure"})

        assert parsed.is_failure
        assert parsed.error_message is None

    def test_revoked_counts_as_failure(self):
        assert parse_task({"status": "revoked"}).is_failure


class TestParseInProgress:
    """States that mean the upload has not finished yet."""

    @pytest.mark.parametrize(
        "status", ["PENDING", "pending", "STARTED", "started", "retry"]
    )
    def test_in_progress_statuses(self, status):
        parsed = parse_task({"status": status})

        assert parsed.is_in_progress
        assert parsed.is_success is False
        assert parsed.is_failure is False

    def test_missing_status(self):
        parsed = parse_task({})

        assert parsed.status == ""
        assert parsed.is_success is False
        assert parsed.is_failure is False
        assert parsed.is_in_progress is False


class TestParsedTask:
    """Defaults of the normalized result."""

    def test_defaults(self):
        parsed = ParsedTask(status="pending")

        assert parsed.document_id is None
        assert parsed.error_message is None
        assert parsed.is_duplicate is False
