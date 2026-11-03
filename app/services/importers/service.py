"""
Preview and execute for health record imports.

Both walk the bundle once: each resource with a registered mapper becomes a
planned row classified as new, duplicate or changed against import_provenance.
Execute writes the new rows and a provenance row for each.
"""

import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import Request
from sqlalchemy.orm import Session

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.utils.client_ip import get_client_ip
from app.crud.activity_log import activity_log
from app.models.activity_log import ActionType, EntityType
from app.models.import_provenance import ImportProvenance
from app.models.patient import Patient
from app.schemas.health_record_import import (
    HealthRecordImportPreviewResponse,
    HealthRecordImportResponse,
    ImportedPatientSummary,
    SectionPreviewCount,
    SectionResultCount,
)

from . import provenance as prov
from .mappers import MappedRecord, resource_mapper_registry
from .patient_match import compare_patient

logger = get_logger(__name__, "app")

NEW = "new"
DUPLICATE = "duplicate"
CHANGED = "changed"


@dataclass
class _PlannedRow:
    """One mapped resource and what the import would do with it."""

    mapped: MappedRecord
    mapper: Any
    content_hash: str
    status: str  # NEW, DUPLICATE or CHANGED
    existing: Optional[ImportProvenance] = None
    locally_edited: bool = False
    stale: Optional[ImportProvenance] = None  # Provenance whose record is gone
    record: Any = None  # The existing row, fetched once with the plan


@dataclass
class _Plan:
    """Everything the import would do with one bundle."""

    rows: List[_PlannedRow] = field(default_factory=list)
    unsupported: Dict[str, int] = field(default_factory=dict)
    total_resources: int = 0
    warnings: List[str] = field(default_factory=list)
    seen_hashes: Set[Tuple[str, str]] = field(default_factory=set)
    seen_ids: Set[Tuple[str, str]] = field(default_factory=set)
    claimed: Set[int] = field(default_factory=set)  # Provenance ids already matched
    by_key: Dict[Tuple[str, str, str], ImportProvenance] = field(default_factory=dict)
    by_hash: Dict[Tuple[str, str], ImportProvenance] = field(default_factory=dict)
    records: Dict[Tuple[str, int], Any] = field(default_factory=dict)


class HealthRecordImportService:
    """Preview and execute imports of a FHIR bundle for one patient."""

    def __init__(self, db: Session):
        """Bind the service to a database session."""
        self.db = db

    def preview(
        self,
        bundle: dict,
        patient: Patient,
        source: str,
        format_key: str,
    ) -> HealthRecordImportPreviewResponse:
        """Classify every resource without writing anything."""
        plan = self._build_plan(bundle, patient, source)
        counts: Dict[str, SectionPreviewCount] = {}
        for row in plan.rows:
            section = counts.setdefault(row.mapped.record_type, SectionPreviewCount())
            if row.status == NEW:
                section.new += 1
            elif row.status == DUPLICATE:
                section.duplicate += 1
            else:
                section.changed += 1
            if row.locally_edited:
                section.edited += 1
        match = compare_patient(bundle, patient)
        summary = None
        if match.found:
            summary = ImportedPatientSummary(
                full_name=match.full_name,
                birth_date=match.birth_date,
                gender=match.gender,
            )
        return HealthRecordImportPreviewResponse(
            source=source,
            format_key=format_key,
            total_resources=plan.total_resources,
            counts=counts,
            unsupported=plan.unsupported,
            patient=summary,
            warnings=[*match.warnings, *plan.warnings],
        )

    def execute(
        self,
        bundle: dict,
        patient: Patient,
        source: str,
        format_key: str,
        user_id: int,
        request: Optional[Request] = None,
        sections: Optional[Set[str]] = None,
        skip_edited: bool = True,
    ) -> HealthRecordImportResponse:
        """Write the planned rows, their provenance and the log entry in one transaction."""
        match = compare_patient(bundle, patient)
        plan = self._build_plan(bundle, patient, source)
        batch_id = uuid.uuid4().hex
        counts: Dict[str, SectionResultCount] = {}

        for row in plan.rows:
            record_type = row.mapped.record_type
            if sections is not None and record_type not in sections:
                continue
            section = counts.setdefault(record_type, SectionResultCount())
            self._apply(row, section, patient, source, batch_id, skip_edited)

        response = HealthRecordImportResponse(
            source=source,
            format_key=format_key,
            import_batch_id=batch_id,
            counts=counts,
            unsupported=plan.unsupported,
            warnings=[*match.warnings, *plan.warnings],
        )
        self._log_activity(response, patient, user_id, request)
        self.db.commit()
        return response

    def _build_plan(self, bundle: dict, patient: Patient, source: str) -> _Plan:
        """Map each resource and classify it against existing provenance."""
        plan = _Plan()
        mapped_items: List[Tuple[MappedRecord, Any]] = []
        for index, entry in enumerate(bundle.get("entry", [])):
            resource = entry.get("resource") or {}
            resource_type = resource.get("resourceType")
            if resource_type == "Patient":
                continue
            plan.total_resources += 1
            if not isinstance(resource_type, str) or not resource_type:
                plan.unsupported["invalid"] = plan.unsupported.get("invalid", 0) + 1
                plan.warnings.append(
                    f"Skipped entry {index}: resourceType missing or not a string"
                )
                continue
            mapper = resource_mapper_registry.get_mapper(resource_type)
            if mapper is None:
                plan.unsupported[resource_type] = (
                    plan.unsupported.get(resource_type, 0) + 1
                )
                continue
            label = f"{resource_type}/{resource.get('id', '?')}"
            try:
                mapped = mapper.map(resource, bundle)
            except (AttributeError, KeyError, IndexError, ValueError, TypeError) as exc:
                # The detail stays in the server log; the client gets a fixed line
                logger.warning(
                    "Health record import could not map a resource",
                    extra={LogFields.PATIENT_ID: patient.id, LogFields.ERROR: str(exc)},
                )
                plan.warnings.append(f"Skipped {label}: could not be mapped")
                continue
            if mapped is None:
                continue
            mapped_items.append((mapped, mapper))

        self._load_existing(plan, patient, mapped_items, source)
        for mapped, mapper in mapped_items:
            plan.rows.append(self._classify(plan, mapped, source, mapper))
        return plan

    def _load_existing(
        self,
        plan: _Plan,
        patient: Patient,
        mapped_items: List[Tuple[MappedRecord, Any]],
        source: str,
    ) -> None:
        """Fetch the patient's provenance and the matched rows in a few queries."""
        if not mapped_items:
            return
        record_types = {mapped.record_type for mapped, _ in mapped_items}
        for existing in prov.list_for_patient(self.db, patient.id, record_types):
            if existing.external_id:
                key = (existing.record_type, existing.source, existing.external_id)
                plan.by_key.setdefault(key, existing)
            plan.by_hash.setdefault(
                (existing.record_type, existing.content_hash), existing
            )

        # One query per record type for the rows the provenance points at
        wanted: Dict[str, Set[int]] = {}
        models = {}
        for mapped, mapper in mapped_items:
            existing = self._find_existing(plan, mapped, source)
            if existing is not None:
                wanted.setdefault(mapped.record_type, set()).add(existing.record_id)
                models[mapped.record_type] = mapper.MODEL
        for record_type, ids in wanted.items():
            model = models[record_type]
            for row in self.db.query(model).filter(model.id.in_(ids)).all():
                plan.records[(record_type, row.id)] = row

    @staticmethod
    def _find_existing(
        plan: _Plan, mapped: MappedRecord, source: str
    ) -> Optional[ImportProvenance]:
        """Provenance for a mapped record: by source id first, then by content."""
        if mapped.external_id:
            existing = plan.by_key.get((mapped.record_type, source, mapped.external_id))
            if existing is not None:
                return existing
        incoming_hash = prov.content_hash(mapped.hash_parts)
        return plan.by_hash.get((mapped.record_type, incoming_hash))

    def _classify(self, plan: _Plan, mapped: MappedRecord, source: str, mapper):
        """Decide new, duplicate or changed for one mapped record."""
        incoming_hash = prov.content_hash(mapped.hash_parts)

        # A resource repeated within the upload is a duplicate of the first copy
        hash_key = (mapped.record_type, incoming_hash)
        id_key = (mapped.record_type, mapped.external_id or "")
        if hash_key in plan.seen_hashes or (
            mapped.external_id and id_key in plan.seen_ids
        ):
            return _PlannedRow(mapped, mapper, incoming_hash, DUPLICATE)
        plan.seen_hashes.add(hash_key)
        if mapped.external_id:
            plan.seen_ids.add(id_key)

        existing = self._find_existing(plan, mapped, source)
        if existing is None:
            return _PlannedRow(mapped, mapper, incoming_hash, NEW)
        # Two resources can match one provenance row (one by id, one by content);
        # only the first may update it
        if existing.id in plan.claimed:
            return _PlannedRow(mapped, mapper, incoming_hash, DUPLICATE)
        plan.claimed.add(existing.id)

        row = plan.records.get((mapped.record_type, existing.record_id))
        if row is None:
            # The record was deleted after import; execute replaces the provenance
            return _PlannedRow(mapped, mapper, incoming_hash, NEW, stale=existing)

        current_hash = prov.content_hash(mapper.hash_parts_for_row(row))
        locally_edited = prov.is_locally_edited(existing, current_hash)
        if locally_edited or existing.content_hash != incoming_hash:
            return _PlannedRow(
                mapped,
                mapper,
                incoming_hash,
                CHANGED,
                existing,
                locally_edited,
                None,
                row,
            )
        return _PlannedRow(
            mapped, mapper, incoming_hash, DUPLICATE, existing, False, None, row
        )

    def _apply(
        self,
        row: _PlannedRow,
        section: SectionResultCount,
        patient: Patient,
        source: str,
        batch_id: str,
        skip_edited: bool,
    ) -> None:
        """Write or skip one planned row and count what happened."""
        if row.status == DUPLICATE:
            self._refresh_external_id(row, source)
            section.skipped_duplicate += 1
        elif row.status == CHANGED and row.locally_edited and skip_edited:
            section.skipped_edited += 1
        elif row.status == CHANGED:
            self._update_row(row, source)
            section.updated += 1
        else:
            self._create_row(row, patient, source, batch_id)
            section.created += 1

    def _create_row(
        self, row: _PlannedRow, patient: Patient, source: str, batch_id: str
    ) -> None:
        """Insert the record and its provenance, replacing stale provenance."""
        if row.stale is not None:
            self.db.delete(row.stale)
            self.db.flush()
        db_obj = row.mapper.MODEL(patient_id=patient.id, **row.mapped.data)
        self.db.add(db_obj)
        self.db.flush()
        self.db.add(
            ImportProvenance(
                patient_id=patient.id,
                record_type=row.mapped.record_type,
                record_id=db_obj.id,
                source=source,
                external_id=row.mapped.external_id,
                content_hash=row.content_hash,
                import_batch_id=batch_id,
            )
        )

    def _update_row(self, row: _PlannedRow, source: str) -> None:
        """Copy the new values onto the existing row, keeping user-owned fields."""
        db_obj = row.record
        for field_name, value in row.mapped.data.items():
            if field_name in row.mapper.preserve_on_update:
                continue
            if hasattr(db_obj, field_name):
                setattr(db_obj, field_name, value)
        row.existing.content_hash = row.content_hash
        self._refresh_external_id(row, source)

    @staticmethod
    def _refresh_external_id(row: _PlannedRow, source: str) -> None:
        """Store the source's current id when a hash match came with a new one."""
        if (
            row.existing is not None
            and row.existing.source == source
            and row.mapped.external_id
            and row.existing.external_id != row.mapped.external_id
        ):
            row.existing.external_id = row.mapped.external_id

    def _log_activity(
        self,
        response: HealthRecordImportResponse,
        patient: Patient,
        user_id: int,
        request: Optional[Request],
    ) -> None:
        """Add one activity-log entry to the open transaction."""
        created = sum(c.created for c in response.counts.values())
        updated = sum(c.updated for c in response.counts.values())
        activity_log.log_activity(
            self.db,
            action=ActionType.IMPORTED,
            entity_type=EntityType.HEALTH_RECORD_IMPORT,
            patient_id=patient.id,
            user_id=user_id,
            description=(
                f"Imported {created} records from {response.source} "
                f"({updated} updated, batch {response.import_batch_id[:8]})"
            ),
            metadata={
                "source": response.source,
                "format_key": response.format_key,
                "import_batch_id": response.import_batch_id,
                "counts": {k: v.model_dump() for k, v in response.counts.items()},
                "unsupported": response.unsupported,
            },
            ip_address=get_client_ip(request) if request is not None else None,
            user_agent=(
                request.headers.get("user-agent") if request is not None else None
            ),
            commit=False,
        )
