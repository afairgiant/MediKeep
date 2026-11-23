"""Attachments of exported records: which files go into an export ZIP, and where.

Uploads are EntityFile rows tied to a record by ``entity_type`` and ``entity_id``,
whether the file is stored locally, in Paperless-ngx or in Papra. Lab results also
have an older table, LabResultFile, that is still read for files not copied across.

Each export scope maps to one source below. A file lands at
``attachments/{scope}/{record date}_{record name}/{file name}``.
"""

import csv
import io
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.logging.config import get_logger
from app.core.utils.stored_files import resolve_stored_file
from app.models.models import (
    Allergy,
    Condition,
    Encounter,
    EntityFile,
    Immunization,
    Injury,
    Insurance,
    LabResult,
    LabResultFile,
    MedicalEquipment,
    Medication,
    Procedure,
    Symptom,
    Treatment,
)
from app.services.export_zip_paths import ZipPathAllocator
from app.services.report_translations import get_translator
from app.utils.csv_safety import neutralize_formula

logger = get_logger(__name__, "app")

ATTACHMENTS_ROOT = "attachments"
INDEX_NAME = f"{ATTACHMENTS_ROOT}/INDEX.csv"
LEFT_OUT_MANIFEST_NAME = "FILES_NOT_INCLUDED.txt"


@dataclass(frozen=True)
class AttachmentSource:
    """Where the attachments of one export scope come from.

    ``label_attrs`` and ``date_attrs`` are tried in order for a record's name and date
    (used for its folder and in the index). ``filter_attr`` is the column the scope's
    export filters its date range on; None means the export's default for the model,
    so attachments follow exactly the records the export lists.
    """

    scope: str
    model: type
    entity_types: Tuple[str, ...]
    label_attrs: Tuple[str, ...]
    date_attrs: Tuple[str, ...]
    filter_attr: Optional[str] = None
    has_legacy_files: bool = False


ATTACHMENT_SOURCES: Tuple[AttachmentSource, ...] = (
    AttachmentSource(
        "medications",
        Medication,
        ("medication",),
        ("medication_name",),
        ("effective_period_start",),
    ),
    AttachmentSource(
        "lab_results",
        LabResult,
        ("lab-result",),
        ("test_name",),
        ("completed_date", "ordered_date"),
        has_legacy_files=True,
    ),
    AttachmentSource(
        "allergies", Allergy, ("allergy",), ("allergen",), ("onset_date",)
    ),
    AttachmentSource(
        "conditions",
        Condition,
        ("condition",),
        ("condition_name", "diagnosis"),
        ("onset_date",),
    ),
    AttachmentSource(
        "immunizations",
        Immunization,
        ("immunization",),
        ("vaccine_name",),
        ("date_administered",),
    ),
    AttachmentSource(
        "procedures", Procedure, ("procedure",), ("procedure_name",), ("date",)
    ),
    AttachmentSource(
        "treatments", Treatment, ("treatment",), ("treatment_name",), ("start_date",)
    ),
    AttachmentSource(
        "encounters",
        Encounter,
        ("encounter", "visit"),
        ("reason", "visit_type"),
        ("date",),
    ),
    AttachmentSource(
        "symptoms",
        Symptom,
        ("symptom",),
        ("symptom_name",),
        ("first_occurrence_date",),
        filter_attr="first_occurrence_date",
    ),
    AttachmentSource(
        "injuries",
        Injury,
        ("injury",),
        ("injury_name",),
        ("date_of_injury",),
        filter_attr="date_of_injury",
    ),
    AttachmentSource(
        "insurance",
        Insurance,
        ("insurance",),
        ("company_name", "insurance_type"),
        ("effective_date",),
        filter_attr="effective_date",
    ),
    AttachmentSource(
        "medical_equipment",
        MedicalEquipment,
        ("medical-equipment",),
        ("equipment_name",),
        ("prescribed_date",),
    ),
)


def _first_text(record: Any, attrs: Iterable[str]) -> str:
    for attr in attrs:
        value = getattr(record, attr, None)
        if value:
            return str(value)
    return ""


def _first_date(record: Any, attrs: Iterable[str]) -> Optional[date]:
    for attr in attrs:
        value = getattr(record, attr, None)
        if value:
            return value.date() if isinstance(value, datetime) else value
    return None


def _files_by_record(
    db: Session, source: AttachmentSource, record_ids: List[int]
) -> Dict[int, List[Any]]:
    """Files of each record, oldest upload first. Legacy rows already copied to
    EntityFile (same record, name and path) are not repeated."""
    files: Dict[int, List[Any]] = defaultdict(list)
    seen = set()
    entity_files = (
        db.query(EntityFile)
        .filter(
            EntityFile.entity_type.in_(source.entity_types),
            EntityFile.entity_id.in_(record_ids),
        )
        .order_by(EntityFile.id)
        .all()
    )
    for entity_file in entity_files:
        files[entity_file.entity_id].append(entity_file)
        seen.add((entity_file.entity_id, entity_file.file_name, entity_file.file_path))

    if source.has_legacy_files:
        legacy_files = (
            db.query(LabResultFile)
            .filter(LabResultFile.lab_result_id.in_(record_ids))
            .order_by(LabResultFile.id)
            .all()
        )
        for legacy_file in legacy_files:
            key = (
                legacy_file.lab_result_id,
                legacy_file.file_name,
                legacy_file.file_path,
            )
            if key not in seen:
                files[legacy_file.lab_result_id].append(legacy_file)
    return files


def _attachments_of_source(
    db: Session,
    source: AttachmentSource,
    patient_id: int,
    start_date: Optional[date],
    end_date: Optional[date],
    default_filter_column: Callable[[type], Any],
) -> List[Dict[str, Any]]:
    model = source.model
    column = (
        getattr(model, source.filter_attr)
        if source.filter_attr
        else default_filter_column(model)
    )
    query = db.query(model).filter(model.patient_id == patient_id)
    if column is not None:
        if start_date:
            query = query.filter(column >= start_date)
        if end_date:
            query = query.filter(column <= end_date)
    records = query.order_by(model.id).all()
    if not records:
        return []

    files = _files_by_record(db, source, [record.id for record in records])
    paths = ZipPathAllocator(root=f"{ATTACHMENTS_ROOT}/{source.scope}")
    attachments = []
    for record in records:
        if not files.get(record.id):
            continue
        label = _first_text(record, source.label_attrs)
        record_date = _first_date(record, source.date_attrs)
        folder = paths.folder(
            f"{record_date.isoformat() if record_date else 'undated'}"
            f"_{label or source.scope}"
        )
        for file in files[record.id]:
            storage_backend = getattr(file, "storage_backend", "local") or "local"
            file_path = file.file_path
            if storage_backend == "local":
                resolved = resolve_stored_file(file)
                if not resolved:
                    logger.warning(
                        f"Local file not found for {source.scope} file {file.id}",
                        extra={
                            "category": "app",
                            "event": "export_local_file_missing",
                            "file_id": file.id,
                        },
                    )
                file_path = str(resolved) if resolved else None

            attachments.append(
                {
                    "scope": source.scope,
                    "record_id": record.id,
                    "record_label": label,
                    "record_date": record_date.isoformat() if record_date else None,
                    "zip_path": paths.file(folder, file.file_name),
                    "file_path": file_path,
                    "file_name": file.file_name,
                    "file_type": file.file_type,
                    "file_size": file.file_size,
                    "storage_backend": storage_backend,
                    "paperless_document_id": getattr(
                        file, "paperless_document_id", None
                    ),
                    "papra_document_id": getattr(file, "papra_document_id", None),
                    "papra_organization_id": getattr(
                        file, "papra_organization_id", None
                    ),
                    "uploaded_by_user_id": getattr(file, "uploaded_by_user_id", None),
                }
            )
    return attachments


def collect_attachments(
    db: Session,
    patient_id: int,
    scopes: Iterable[str],
    start_date: Optional[date],
    end_date: Optional[date],
    default_filter_column: Callable[[type], Any],
) -> List[Dict[str, Any]]:
    """Attachments of the exported records of ``scopes`` (``"all"`` means every scope).

    ``default_filter_column`` gives the date column the export filters a model on.
    A file that is missing on disk is still returned, with ``file_path`` None, so the
    export can report it. Scopes without attachments (such as vitals) are ignored.
    """
    wanted = set(scopes)
    attachments: List[Dict[str, Any]] = []
    for source in ATTACHMENT_SOURCES:
        if "all" in wanted or source.scope in wanted:
            attachments.extend(
                _attachments_of_source(
                    db,
                    source,
                    patient_id,
                    start_date,
                    end_date,
                    default_filter_column,
                )
            )
    return attachments


@dataclass(frozen=True)
class LeftOutFile:
    """A file that could not be added to an export ZIP, and why.

    ``reason`` is one of the keys of ``LEFT_OUT_REASON_TEXT_KEYS``; ``service`` names
    the remote integration the reason refers to, when there is one. ``scope``,
    ``record_label`` and ``record_date`` (ISO) say which record the file belongs to.
    """

    file_name: str
    scope: str
    record_label: str
    reason: str
    service: Optional[str] = None
    record_date: Optional[str] = None


# Reason -> reportPdf.json "report" text key
LEFT_OUT_REASON_TEXT_KEYS = {
    "not_found": "export_left_out_not_found",
    "not_configured": "export_left_out_not_configured",
    "download_failed": "export_left_out_download_failed",
    "stored_elsewhere": "export_left_out_stored_elsewhere",
    "failed": "export_left_out_failed",
}


def _one_line(text: Optional[str]) -> str:
    """User text kept on one line."""
    return " ".join((text or "").split())


def build_left_out_manifest(
    left_out: List[LeftOutFile], language: str = "en", date_format: str = "mdy"
) -> str:
    """Text for the ZIP entry that lists the files left out of the export."""
    translator = get_translator(language, date_format)
    lines = [translator.text("export_left_out_intro"), ""]
    for entry in left_out:
        reason = translator.text(
            LEFT_OUT_REASON_TEXT_KEYS.get(
                entry.reason, LEFT_OUT_REASON_TEXT_KEYS["failed"]
            ),
            service=entry.service or "",
        )
        record = ", ".join(
            part
            for part in (
                _one_line(entry.record_label),
                translator.format_date(entry.record_date) if entry.record_date else "",
            )
            if part
        )
        category = translator.category(entry.scope)
        lines.append(
            f"- {_one_line(entry.file_name)} ({category}: {record}): {reason}"
            if record
            else f"- {_one_line(entry.file_name)} ({category}): {reason}"
        )
    return "\n".join(lines) + "\n"


def build_attachments_index(
    attachments: List[Dict[str, Any]], language: str = "en", date_format: str = "mdy"
) -> str:
    """CSV for the ZIP entry that maps each file's path to its record.

    Starts with a BOM so Excel reads it as UTF-8, like the CSV export.
    """
    translator = get_translator(language, date_format)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            translator.field("zip_file_path"),
            translator.field("file_name"),
            translator.field("category"),
            translator.field("name"),
            translator.field("date"),
        ]
    )
    for attachment in attachments:
        writer.writerow(
            [
                neutralize_formula(value)
                for value in (
                    attachment["zip_path"],
                    attachment["file_name"],
                    translator.category(attachment["scope"]),
                    attachment["record_label"],
                    (
                        translator.format_date(attachment["record_date"])
                        if attachment["record_date"]
                        else ""
                    ),
                )
            ]
        )
    return "﻿" + output.getvalue()
