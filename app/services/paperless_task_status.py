"""Normalization of paperless-ngx task payloads across API versions 9 and 10.

Paperless-ngx 3.0 serves API v10 by default, which renamed the task fields v9
exposed: status values became lowercase, `result` became the `result_data`
object, and `related_document` became the `related_document_ids` list.
"""

import re
from dataclasses import dataclass
from typing import Any, Dict, Optional

DOCUMENT_ID_PATTERN = re.compile(r"document id (\d+)", re.IGNORECASE)

STATUS_SUCCESS = "success"

FAILURE_STATUSES = frozenset({"failure", "failed", "revoked"})
IN_PROGRESS_STATUSES = frozenset({"pending", "started", "retry", "received"})

DUPLICATE_KEYWORDS = (
    "duplicate",
    "already exists",
    "similar document",
    "document with this checksum",
    "identical file",
    "not consuming",
)


@dataclass(frozen=True)
class ParsedTask:
    """A paperless task reduced to the fields MediKeep acts on."""

    status: str
    document_id: Optional[str] = None
    error_message: Optional[str] = None
    is_duplicate: bool = False

    @property
    def is_success(self) -> bool:
        return self.status == STATUS_SUCCESS

    @property
    def is_failure(self) -> bool:
        return self.status in FAILURE_STATUSES

    @property
    def is_in_progress(self) -> bool:
        return self.status in IN_PROGRESS_STATUSES


def extract_task(payload: Any, task_uuid: Any) -> Optional[Dict[str, Any]]:
    """Pull the task with ``task_uuid`` out of a /api/tasks/ response body.

    Accepts the bare list, the paginated envelope, and a single task object.
    A lone task with no ``task_id`` field is accepted as the requested one.
    """
    tasks = _task_list(payload)
    if not tasks:
        return None

    wanted = str(task_uuid)
    if any(isinstance(task, dict) and "task_id" in task for task in tasks):
        return next(
            (
                task
                for task in tasks
                if isinstance(task, dict) and str(task.get("task_id")) == wanted
            ),
            None,
        )

    return tasks[0] if len(tasks) == 1 else None


def _task_list(payload: Any) -> list:
    if isinstance(payload, list):
        return payload

    if isinstance(payload, dict):
        results = payload.get("results")
        if isinstance(results, list):
            return results
        if "status" in payload:
            return [payload]

    return []


def parse_task(task: Dict[str, Any]) -> ParsedTask:
    """Normalize one task object from either API version.

    `document_id` is populated only for successful tasks - v10 also lists the
    original document under `related_document_ids` when an upload was rejected
    as a duplicate.
    """
    status = str(task.get("status") or "").lower()

    if status == STATUS_SUCCESS:
        return ParsedTask(status=status, document_id=_extract_document_id(task))

    if status in FAILURE_STATUSES:
        error_message = _extract_error_message(task)
        return ParsedTask(
            status=status,
            error_message=error_message,
            is_duplicate=_is_duplicate(task, error_message),
        )

    return ParsedTask(status=status)


def _extract_document_id(task: Dict[str, Any]) -> Optional[str]:
    related_ids = task.get("related_document_ids")
    if isinstance(related_ids, list) and related_ids:
        return str(related_ids[0])

    related_document = task.get("related_document")
    if related_document:
        return str(related_document)

    for key in ("result_data", "result"):
        document_id = _document_id_from_result(task.get(key))
        if document_id:
            return document_id

    return None


def _document_id_from_result(result: Any) -> Optional[str]:
    if isinstance(result, dict):
        document_id = result.get("document_id") or result.get("id")
        return str(document_id) if document_id else None

    if isinstance(result, str):
        match = DOCUMENT_ID_PATTERN.search(result)
        return match.group(1) if match else None

    return None


def _extract_error_message(task: Dict[str, Any]) -> Optional[str]:
    result = task.get("result")
    if isinstance(result, str) and result.strip():
        return result

    result_data = task.get("result_data")
    if isinstance(result_data, dict):
        for key in ("error_message", "reason"):
            value = result_data.get(key)
            if value:
                return str(value)
        duplicate_of = result_data.get("duplicate_of")
        if duplicate_of:
            return f"Not consuming: It is a duplicate of document #{duplicate_of}"

    return None


def _is_duplicate(task: Dict[str, Any], error_message: Optional[str]) -> bool:
    result_data = task.get("result_data")
    if isinstance(result_data, dict) and result_data.get("duplicate_of"):
        return True

    duplicates = task.get("duplicate_documents")
    if isinstance(duplicates, list) and duplicates:
        return True

    if not error_message:
        return False

    lowered = error_message.lower()
    file_name = _task_file_name(task)
    if file_name:
        # Paperless quotes the file name, which must not decide the outcome
        lowered = lowered.replace(file_name.lower(), "")
    return any(keyword in lowered for keyword in DUPLICATE_KEYWORDS)


def _task_file_name(task: Dict[str, Any]) -> Optional[str]:
    """The uploaded file's name: v10 ``input_data.filename``, v9 ``task_file_name``."""
    input_data = task.get("input_data")
    if isinstance(input_data, dict) and input_data.get("filename"):
        return str(input_data["filename"])
    file_name = task.get("task_file_name")
    return str(file_name) if file_name else None
