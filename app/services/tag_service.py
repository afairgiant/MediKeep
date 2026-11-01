"""Tag registry (`user_tags`) and tag operations across a user's tagged records."""

import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple

from fastapi import Request
from sqlalchemy import (
    and_,
    bindparam,
    exists,
    func,
    literal,
    or_,
    select,
    true,
    union_all,
    update,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database.utils import insert_ignoring_conflicts, json_array_elements
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields, sanitize_log_input
from app.core.utils.client_ip import request_audit_fields
from app.crud.activity_log import activity_log
from app.models.activity_log import ActionType, EntityType
from app.models.models import (
    Allergy,
    BloodDonation,
    Condition,
    Encounter,
    Immunization,
    Injury,
    LabResult,
    MedicalEquipment,
    Medication,
    Patient,
    Procedure,
    Symptom,
    Treatment,
    UserTag,
)

logger = get_logger(__name__, "app")

ENTITY_MODELS: Dict[str, Any] = {
    "lab_result": LabResult,
    "medication": Medication,
    "condition": Condition,
    "procedure": Procedure,
    "immunization": Immunization,
    "treatment": Treatment,
    "encounter": Encounter,
    "allergy": Allergy,
    "injury": Injury,
    "symptom": Symptom,
    "medical_equipment": MedicalEquipment,
    "blood_donation": BloodDonation,
}


def renamed_tags(tags: List[str], old_tag: str, new_tag: str) -> List[str]:
    """`old_tag` becomes `new_tag` in place; a second copy of `new_tag` is dropped."""
    result: List[str] = []
    for tag in tags:
        tag = new_tag if tag == old_tag else tag
        if tag == new_tag and new_tag in result:
            continue
        result.append(tag)
    return result


def tags_without(tags: List[str], removed: str) -> List[str]:
    return [tag for tag in tags if tag != removed]


def replaced_tags(tags: List[str], old_tag: str, new_tag: str) -> List[str]:
    """`old_tag` becomes `new_tag`, then duplicates are dropped and the list is sorted."""
    return sorted({new_tag if tag == old_tag else tag for tag in tags})


@dataclass
class TagChange:
    """What a rename, delete or replace changed."""

    # patient id -> entity type -> records changed
    records: Dict[int, Dict[str, int]] = field(default_factory=dict)
    tag_id: Optional[int] = None
    registry_action: str = "none"

    @property
    def records_updated(self) -> int:
        return sum(sum(by_type.values()) for by_type in self.records.values())

    @property
    def records_by_entity(self) -> Dict[str, int]:
        totals: Dict[str, int] = {}
        for by_type in self.records.values():
            for entity_type, count in by_type.items():
                totals[entity_type] = totals.get(entity_type, 0) + count
        return totals


class TagService:
    """Tags are per user: the registry and every bulk change cover the user's own patients only."""

    @staticmethod
    def _owned_patient_ids(user_id: int):
        return select(Patient.id).where(Patient.user_id == user_id)

    @staticmethod
    def _has_tag(db: Session, tags_column, tag: str):
        elements = json_array_elements(db, tags_column)
        return exists().where(elements.c.value == tag)

    def _models(self, entity_types: Optional[List[str]]):
        for entity_type in entity_types or ENTITY_MODELS:
            model = ENTITY_MODELS.get(entity_type)
            if model is None:
                logger.warning(
                    "Unknown entity type in tag query",
                    extra={"entity_type": sanitize_log_input(entity_type)},
                )
                continue
            yield entity_type, model

    def _tag_usage(
        self, db: Session, models: Iterable[Tuple[str, Any]], user_id: int
    ) -> list:
        """(tag, entity_type, record count) rows across the user's patients, in one query."""
        owned = self._owned_patient_ids(user_id)
        parts = []
        for entity_type, model in models:
            elements = json_array_elements(db, model.tags)
            tag = elements.c.value
            parts.append(
                select(tag, literal(entity_type), func.count())
                .select_from(model)
                .join(elements, true())
                .where(model.patient_id.in_(owned))
                .group_by(tag)
            )
        return db.execute(union_all(*parts)).all() if parts else []

    @staticmethod
    def _register(db: Session, user_id: int, tags: List[str]) -> int:
        """Add tags to the user's registry, skipping any already there; returns how many were added."""
        return insert_ignoring_conflicts(
            db,
            UserTag,
            [{"user_id": user_id, "tag": tag} for tag in tags],
            ["user_id", "tag"],
        )

    def get_popular_tags_across_entities(
        self,
        db: Session,
        *,
        entity_types: Optional[List[str]] = None,
        limit: int = 20,
        user_id: int,
    ) -> List[Dict[str, Any]]:
        """The user's registered tags, most used first; usage counts only their own patients.

        Returns an empty list if the database read fails.
        """
        usage: Dict[str, int] = {}
        types_by_tag: Dict[str, set] = {}
        try:
            models = list(self._models(entity_types))
            for tag, entity_type, count in self._tag_usage(db, models, user_id):
                usage[tag] = usage.get(tag, 0) + count
                types_by_tag.setdefault(tag, set()).add(entity_type)
            registry = db.scalars(
                select(UserTag).where(UserTag.user_id == user_id)
            ).all()
        except SQLAlchemyError as e:
            logger.error(
                "Failed to retrieve user tags",
                extra={LogFields.USER_ID: user_id, LogFields.ERROR: type(e).__name__},
            )
            return []

        rows = [
            {
                "id": user_tag.id,
                "tag": user_tag.tag,
                "color": user_tag.color,
                "usage_count": usage.get(user_tag.tag, 0),
                "entity_types": sorted(types_by_tag.get(user_tag.tag, ())),
            }
            for user_tag in registry
        ]
        rows.sort(key=lambda row: (-row["usage_count"], row["tag"]))
        return rows[:limit]

    def search_across_entities_by_tags(
        self,
        db: Session,
        *,
        tags: List[str],
        patient_id: int,
        entity_types: Optional[List[str]] = None,
        limit_per_entity: int = 10,
        match_mode: str = "any",
    ) -> Dict[str, List[Dict[str, Any]]]:
        """One patient's records carrying any (or, with match_mode "all", every) tag.

        Rows are full column dicts, newest first. An unknown or failing entity type
        gives an empty list.
        """
        valid_tags = [tag for tag in tags if isinstance(tag, str) and len(tag) <= 100]
        combine = and_ if match_mode == "all" else or_

        results: Dict[str, List[Dict[str, Any]]] = {
            entity_type: [] for entity_type in entity_types or ENTITY_MODELS
        }
        for entity_type, model in self._models(entity_types) if valid_tags else ():
            table = model.__table__
            statement = (
                select(table)
                .where(
                    table.c.patient_id == patient_id,
                    combine(*(self._has_tag(db, table.c.tags, t) for t in valid_tags)),
                )
                .order_by(table.c.created_at.desc())
                .limit(limit_per_entity)
            )
            try:
                # A failed query must not abort the transaction for the remaining types
                with db.begin_nested():
                    results[entity_type] = [
                        dict(row._mapping) for row in db.execute(statement)
                    ]
            except SQLAlchemyError as e:
                logger.error(
                    "Failed to search entity by tags",
                    extra={
                        "entity_type": entity_type,
                        LogFields.ERROR: type(e).__name__,
                    },
                )

        logger.info(
            "Completed cross-entity tag search",
            extra={
                LogFields.EVENT: "tags_search_completed",
                LogFields.PATIENT_ID: patient_id,
                "tag_count": len(valid_tags),
                "match_mode": match_mode,
                "result_count": sum(len(rows) for rows in results.values()),
            },
        )
        return results

    def autocomplete_tags(
        self, db: Session, *, query: str, user_id: int, limit: int = 10
    ) -> List[str]:
        """The user's tags starting with `query`, case-insensitive; `%` and `_` are literal."""
        try:
            return list(
                db.scalars(
                    select(UserTag.tag)
                    .where(
                        UserTag.user_id == user_id,
                        UserTag.tag.istartswith(query, autoescape=True),
                    )
                    .order_by(UserTag.tag)
                    .limit(limit)
                )
            )
        except SQLAlchemyError as e:
            logger.error(
                "Failed to generate tag autocomplete",
                extra={LogFields.USER_ID: user_id, LogFields.ERROR: type(e).__name__},
            )
            return []

    def _change_records(
        self,
        db: Session,
        *,
        tag: str,
        user_id: int,
        new_tags: Callable[[List[str]], List[str]],
    ) -> TagChange:
        """Rewrite the tags of the user's records carrying `tag`; leaves updated_at unchanged."""
        change = TagChange()
        owned = self._owned_patient_ids(user_id)
        for entity_type, model in ENTITY_MODELS.items():
            table = model.__table__
            # Row locks stop a concurrent edit of the same record from being overwritten
            records = db.execute(
                select(table.c.id, table.c.patient_id, table.c.tags)
                .where(
                    table.c.patient_id.in_(owned), self._has_tag(db, table.c.tags, tag)
                )
                .with_for_update()
            ).all()
            if not records:
                continue
            db.execute(
                update(table)
                .where(table.c.id == bindparam("record_id"))
                .values(
                    tags=bindparam("new_tags", type_=table.c.tags.type),
                    updated_at=table.c.updated_at,
                ),
                [
                    {"record_id": record.id, "new_tags": new_tags(list(record.tags))}
                    for record in records
                ],
            )
            for record in records:
                by_type = change.records.setdefault(record.patient_id, {})
                by_type[entity_type] = by_type.get(entity_type, 0) + 1
        return change

    @staticmethod
    def _registry_row(db: Session, user_id: int, tag: str) -> Optional[UserTag]:
        return db.scalar(
            select(UserTag).where(UserTag.user_id == user_id, UserTag.tag == tag)
        )

    def _record_activity(
        self,
        db: Session,
        *,
        change: TagChange,
        action: str,
        operation: str,
        # The activity feed shows only the text after the first colon
        describe: Callable[[int], str],
        user_id: int,
        request: Optional[Request],
    ) -> None:
        ip_address, user_agent = request_audit_fields(request)
        for patient_id, by_type in change.records.items():
            activity_log.log_activity(
                db,
                action=action,
                entity_type=EntityType.TAG,
                description=sanitize_log_input(describe(sum(by_type.values()))),
                user_id=user_id,
                patient_id=patient_id,
                entity_id=change.tag_id,
                metadata={
                    "operation": operation,
                    "records_changed": by_type,
                    "registry_action": change.registry_action,
                },
                ip_address=ip_address,
                user_agent=user_agent,
                commit=False,
            )

    def _bulk_change(
        self,
        db: Session,
        *,
        operation: str,
        action: str,
        tag: str,
        new_tags: Callable[[List[str]], List[str]],
        update_registry: Callable[[TagChange], None],
        describe: Callable[[int], str],
        user_id: int,
        request: Optional[Request],
    ) -> TagChange:
        """Rewrite `tag` on the user's records, update the registry and log activity.

        One transaction: on any error everything is rolled back and the error re-raised.
        """
        started = time.monotonic()
        try:
            change = self._change_records(
                db, tag=tag, user_id=user_id, new_tags=new_tags
            )
            update_registry(change)
            self._record_activity(
                db,
                change=change,
                action=action,
                operation=operation,
                describe=describe,
                user_id=user_id,
                request=request,
            )
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(
                f"Tag {operation} failed",
                extra={
                    LogFields.EVENT: f"tag_{operation}_failed",
                    LogFields.USER_ID: user_id,
                    LogFields.ERROR: type(e).__name__,
                },
            )
            raise
        logger.info(
            f"Tag {operation} completed",
            extra={
                LogFields.EVENT: f"tag_{operation}d",
                LogFields.USER_ID: user_id,
                LogFields.DURATION: round((time.monotonic() - started) * 1000),
                "tag_id": change.tag_id,
                "records_changed": change.records_by_entity,
                "registry_action": change.registry_action,
            },
        )
        return change

    def rename_tag_across_entities(
        self,
        db: Session,
        *,
        old_tag: str,
        new_tag: str,
        user_id: int,
        request: Optional[Request] = None,
    ) -> TagChange:
        """Rename a tag on the user's own patients' records and in their registry.

        All or nothing: on any error nothing is saved and the error is re-raised.
        Writes one activity entry per patient whose records changed. Renaming a tag
        to itself changes nothing.
        """
        if old_tag == new_tag:
            return TagChange()

        def update_registry(change: TagChange) -> None:
            old_row = self._registry_row(db, user_id, old_tag)
            existing = self._registry_row(db, user_id, new_tag)
            if old_row and existing:
                db.delete(old_row)
                change.tag_id, change.registry_action = (
                    existing.id,
                    "merged_into_existing",
                )
            elif old_row:
                old_row.tag = new_tag
                change.tag_id, change.registry_action = old_row.id, "renamed"
            elif change.records:
                if existing is None:
                    self._register(db, user_id, [new_tag])
                    existing = self._registry_row(db, user_id, new_tag)
                    change.registry_action = "added"
                else:
                    change.registry_action = "existing"
                change.tag_id = existing.id

        return self._bulk_change(
            db,
            operation="rename",
            action=ActionType.UPDATED,
            tag=old_tag,
            new_tags=lambda tags: renamed_tags(tags, old_tag, new_tag),
            update_registry=update_registry,
            describe=lambda n: f"Tag: '{old_tag}' renamed to '{new_tag}' on {n} record(s)",
            user_id=user_id,
            request=request,
        )

    def delete_tag_across_entities(
        self,
        db: Session,
        *,
        tag: str,
        user_id: int,
        request: Optional[Request] = None,
    ) -> TagChange:
        """Remove a tag from the user's own patients' records and from their registry.

        All or nothing, with one activity entry per patient whose records changed.
        """

        def update_registry(change: TagChange) -> None:
            row = self._registry_row(db, user_id, tag)
            if row:
                change.tag_id, change.registry_action = row.id, "deleted"
                db.delete(row)

        return self._bulk_change(
            db,
            operation="delete",
            action=ActionType.DELETED,
            tag=tag,
            new_tags=lambda tags: tags_without(tags, tag),
            update_registry=update_registry,
            describe=lambda n: f"Tag: '{tag}' removed from {n} record(s)",
            user_id=user_id,
            request=request,
        )

    def replace_tag_across_entities(
        self,
        db: Session,
        *,
        old_tag: str,
        new_tag: str,
        user_id: int,
        request: Optional[Request] = None,
    ) -> TagChange:
        """Replace a tag on the user's own patients' records; each list ends up sorted and unique.

        The old tag leaves the registry and the new one joins it. All or nothing, with
        one activity entry per patient whose records changed. Replacing a tag with
        itself changes nothing.
        """
        if old_tag == new_tag:
            return TagChange()

        def update_registry(change: TagChange) -> None:
            row = self._registry_row(db, user_id, old_tag)
            if row:
                db.delete(row)
                db.flush()
            if row or change.records:
                self._register(db, user_id, [new_tag])
                change.tag_id = self._registry_row(db, user_id, new_tag).id
                change.registry_action = "replaced" if row else "added"

        return self._bulk_change(
            db,
            operation="replace",
            action=ActionType.UPDATED,
            tag=old_tag,
            new_tags=lambda tags: replaced_tags(tags, old_tag, new_tag),
            update_registry=update_registry,
            describe=lambda n: f"Tag: '{old_tag}' replaced with '{new_tag}' on {n} record(s)",
            user_id=user_id,
            request=request,
        )

    def create_tag(self, db: Session, *, tag: str, user_id: int) -> None:
        """Add a tag to the user's registry; a tag already there is left as is."""
        try:
            self._register(db, user_id, [tag])
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(
                "Failed to create tag",
                extra={LogFields.USER_ID: user_id, LogFields.ERROR: type(e).__name__},
            )
            raise

    def update_tag_color(
        self, db: Session, *, tag_id: int, user_id: int, color: Optional[str]
    ) -> bool:
        """Set a registry tag's color; False when the user has no tag with that id."""
        try:
            result = db.execute(
                update(UserTag)
                .where(UserTag.id == tag_id, UserTag.user_id == user_id)
                .values(color=color)
            )
            if result.rowcount == 0:
                logger.warning(
                    "Tag not found for color update",
                    extra={"tag_id": tag_id, LogFields.USER_ID: user_id},
                )
                return False
            db.commit()
            logger.info(
                "Tag color updated",
                extra={
                    LogFields.EVENT: "tag_color_updated",
                    "tag_id": tag_id,
                    LogFields.USER_ID: user_id,
                },
            )
            return True
        except Exception as e:
            db.rollback()
            logger.error(
                "Failed to update tag color",
                extra={
                    "tag_id": tag_id,
                    LogFields.USER_ID: user_id,
                    LogFields.ERROR: type(e).__name__,
                },
            )
            raise

    def sync_tags_from_records(self, db: Session, *, user_id: int) -> int:
        """Register every tag found on the user's own patients' records; returns how many were added.

        Returns 0 instead of raising if the database fails.
        """
        try:
            found = {
                tag for tag, _, _ in self._tag_usage(db, ENTITY_MODELS.items(), user_id)
            }
            added = self._register(db, user_id, sorted(found))
            db.commit()
        except SQLAlchemyError as e:
            db.rollback()
            logger.error(
                "Failed to sync tags from medical records",
                extra={LogFields.USER_ID: user_id, LogFields.ERROR: type(e).__name__},
            )
            return 0

        logger.info(
            "Synced tags from medical records",
            extra={
                LogFields.EVENT: "tags_synced",
                LogFields.USER_ID: user_id,
                "tags_found": len(found),
                "tags_added": added,
            },
        )
        return added


tag_service = TagService()
