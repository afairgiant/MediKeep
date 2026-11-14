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
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.utils.client_ip import request_audit_fields
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
from .mappers._fhir import indexed, resource_id
from .mappers.base_mapper import MAPPING_ERRORS
from .patient_match import compare_patient

logger = get_logger(__name__, "app")

NEW = "new"
DUPLICATE = "duplicate"
CHANGED = "changed"

MAX_WARNINGS = 50


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
    skip_reasons: Set[str] = field(default_factory=set)  # Already in warnings
    seen_hashes: Set[Tuple[str, str]] = field(default_factory=set)
    seen_ids: Set[Tuple[str, str]] = field(default_factory=set)
    matched_by_id: Set[int] = field(default_factory=set)  # Provenance ids
    id_matched_hashes: Set[Tuple[str, str]] = field(default_factory=set)
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
        notes: Optional[List[str]] = None,
    ) -> HealthRecordImportPreviewResponse:
        """Classify every resource without writing anything."""
        match = compare_patient(bundle, patient)
        plan = self._build_plan(match.bundle, patient, source, match.positions)
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
            warnings=[*match.warnings, *(notes or []), *plan.warnings],
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
        notes: Optional[List[str]] = None,
    ) -> HealthRecordImportResponse:
        """Write the planned rows, their provenance and the log entry in one transaction."""
        match = compare_patient(bundle, patient)
        plan = self._build_plan(match.bundle, patient, source, match.positions)
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
            warnings=[*match.warnings, *(notes or []), *plan.warnings],
        )
        self._log_activity(response, patient, user_id, request)
        self.db.commit()
        return response

    def _build_plan(
        self,
        bundle: dict,
        patient: Patient,
        source: str,
        positions: Optional[List[int]] = None,
    ) -> _Plan:
        """Map each resource and classify it against existing provenance.

        positions gives each entry's index in the upload when the bundle is a
        copy with entries left out, so that warnings number entries as the
        user's file does.
        """
        # The mappers share one index of the bundle, dropped when the plan is done
        with indexed(bundle):
            return self._plan_entries(bundle, patient, source, positions)

    def _plan_entries(
        self,
        bundle: dict,
        patient: Patient,
        source: str,
        positions: Optional[List[int]] = None,
    ) -> _Plan:
        """The plan body; run inside indexed(bundle)."""
        plan = _Plan()
        accepted: List[Tuple[MappedRecord, Any]] = []
        for index, entry in enumerate(bundle.get("entry", [])):
            resource = entry.get("resource") or {}
            resource_type = resource.get("resourceType")
            if resource_type == "Patient":
                continue
            plan.total_resources += 1
            if not isinstance(resource_type, str) or not resource_type:
                plan.unsupported["invalid"] = plan.unsupported.get("invalid", 0) + 1
                position = index if positions is None else positions[index]
                plan.warnings.append(
                    f"Skipped entry {position}: resourceType missing or not a string"
                )
                continue
            mapper = resource_mapper_registry.get_mapper(resource_type)
            if mapper is None:
                plan.unsupported[resource_type] = (
                    plan.unsupported.get(resource_type, 0) + 1
                )
                continue
            label = f"{resource_type}/{resource_id(resource) or '?'}"
            try:
                mapped = mapper.map(resource, bundle)
            except MAPPING_ERRORS as exc:
                # Exception text can echo clinical values, so only its type is logged
                logger.warning(
                    "Health record import could not map a resource",
                    extra={
                        LogFields.EVENT: "health_import_resource_unmapped",
                        LogFields.PATIENT_ID: patient.id,
                        LogFields.MODEL: resource_type,
                        LogFields.ERROR: type(exc).__name__,
                    },
                )
                plan.warnings.append(f"Skipped {label}: could not be mapped")
                continue
            if mapped is None:
                reason = mapper.skip_reason(resource, bundle)
                if reason and reason not in plan.skip_reasons:
                    plan.skip_reasons.add(reason)
                    plan.warnings.append(reason)
                continue
            if not self._validate(mapped, mapper, patient):
                plan.warnings.append(f"Skipped {label}: failed validation")
                continue
            accepted.append((mapped, mapper))

        mapped_items = []
        for mapped, mapper in self._drop_covered(accepted):
            plan.warnings.extend(f"{mapped.label}: {w}" for w in mapped.warnings)
            mapped_items.append((mapped, mapper, prov.content_hash(mapped.hash_parts)))
        self._load_existing(plan, patient, mapped_items, source)
        for mapped, mapper, incoming_hash in mapped_items:
            plan.rows.append(
                self._classify(plan, mapped, source, mapper, incoming_hash)
            )
        if len(plan.warnings) > MAX_WARNINGS:
            hidden = len(plan.warnings) - MAX_WARNINGS
            plan.warnings = plan.warnings[:MAX_WARNINGS]
            plan.warnings.append(f"{hidden} more warnings not shown")
        return plan

    def _validate(self, mapped: MappedRecord, mapper: Any, patient: Patient) -> bool:
        """Run the mapped values through the record type's create schema."""
        schema = getattr(mapper, "CREATE_SCHEMA", None)
        if schema is None:
            return True
        try:
            checked = schema.model_validate({**mapped.data, "patient_id": patient.id})
        except ValidationError as exc:
            # The error text echoes the rejected values, so only fields and types are logged
            logger.warning(
                "Health record import rejected a mapped resource",
                extra={
                    LogFields.EVENT: "health_import_resource_invalid",
                    LogFields.PATIENT_ID: patient.id,
                    LogFields.MODEL: mapped.record_type,
                    LogFields.ERROR: ", ".join(
                        f"{'.'.join(map(str, e['loc']))}:{e['type']}"
                        for e in exc.errors()
                    ),
                },
            )
            return False
        # Keep the schema's normalized values so the row matches what the API would write,
        # and hash those values, so the stored hash always matches the written row
        mapped.data = {key: getattr(checked, key) for key in mapped.data}
        mapped.hash_parts = mapper.hash_parts_for_data(mapped.data)
        return True

    @staticmethod
    def _drop_covered(
        accepted: List[Tuple[MappedRecord, Any]],
    ) -> List[Tuple[MappedRecord, Any]]:
        """The accepted records minus those another record from the file stands for."""
        mappers = dict.fromkeys(mapper for _, mapper in accepted)
        dropped = {
            id(record) for mapper in mappers for record in mapper.covered(accepted)
        }
        return [(m, mapper) for m, mapper in accepted if id(m) not in dropped]

    def _load_existing(
        self,
        plan: _Plan,
        patient: Patient,
        mapped_items: List[Tuple[MappedRecord, Any, str]],
        source: str,
    ) -> None:
        """Fetch the patient's provenance and the matched rows in a few queries."""
        if not mapped_items:
            return
        record_types = {mapped.record_type for mapped, _, _ in mapped_items}
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
        reserved_ids: Set[Tuple[str, str]] = set()
        for mapped, mapper, incoming_hash in mapped_items:
            existing, by_id = self._find_existing(plan, mapped, source, incoming_hash)
            if existing is not None:
                id_key = (mapped.record_type, mapped.external_id)
                # A repeat of an id is classified as a duplicate, so only the first reserves
                if by_id and id_key not in reserved_ids:
                    reserved_ids.add(id_key)
                    plan.matched_by_id.add(existing.id)
                    plan.id_matched_hashes.add((mapped.record_type, incoming_hash))
                wanted.setdefault(mapped.record_type, set()).add(existing.record_id)
                models[mapped.record_type] = mapper.MODEL
        for record_type, ids in wanted.items():
            model = models[record_type]
            for row in self.db.query(model).filter(model.id.in_(ids)).all():
                plan.records[(record_type, row.id)] = row

    @staticmethod
    def _find_existing(
        plan: _Plan, mapped: MappedRecord, source: str, incoming_hash: str
    ) -> Tuple[Optional[ImportProvenance], bool]:
        """Provenance for a mapped record, and whether it matched on the source id."""
        if mapped.external_id:
            existing = plan.by_key.get((mapped.record_type, source, mapped.external_id))
            if existing is not None:
                return existing, True
        return plan.by_hash.get((mapped.record_type, incoming_hash)), False

    def _classify(
        self,
        plan: _Plan,
        mapped: MappedRecord,
        source: str,
        mapper,
        incoming_hash: str,
    ):
        """Decide new, duplicate or changed for one mapped record."""
        hash_key = (mapped.record_type, incoming_hash)
        id_key = (mapped.record_type, mapped.external_id or "")
        existing, by_id = self._find_existing(plan, mapped, source, incoming_hash)
        # A copy of a resource the file matches by id defers to it, even when it comes first
        if not by_id and hash_key in plan.id_matched_hashes:
            if mapped.external_id:
                plan.seen_ids.add(id_key)
            return _PlannedRow(mapped, mapper, incoming_hash, DUPLICATE)
        # A resource repeated within the upload is a duplicate of the first copy
        if hash_key in plan.seen_hashes or (
            mapped.external_id and id_key in plan.seen_ids
        ):
            return _PlannedRow(mapped, mapper, incoming_hash, DUPLICATE)
        plan.seen_hashes.add(hash_key)
        if mapped.external_id:
            plan.seen_ids.add(id_key)

        if existing is None:
            return _PlannedRow(mapped, mapper, incoming_hash, NEW)
        # A row some resource in the file matches by id is that resource's, whatever the order
        if not by_id and existing.id in plan.matched_by_id:
            return _PlannedRow(mapped, mapper, incoming_hash, DUPLICATE)

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
        ip_address, user_agent = request_audit_fields(request)
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
            ip_address=ip_address,
            user_agent=user_agent,
            commit=False,
        )
