"""
Vaccine Library Sync Service

Keeps `standardized_vaccines` in sync with shared/data/vaccine_library.json
on every application startup.
"""

from typing import Any, Dict, TypedDict

from sqlalchemy.orm import Session

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.models.clinical import StandardizedVaccine
from app.services.vaccine_library_loader import get_vaccine_entries

logger = get_logger(__name__, "app")

__all__ = ["sync_vaccine_library", "VaccineLibrarySyncResult"]

# Fields mirrored from the library JSON onto an existing row when they drift.
# `who_code` is included: a row first matched by name (no code yet) can gain
# one in a later JSON edit, and this heals it onto the row instead of leaving
# it permanently NULL. `id`/`created_at`/`updated_at` are managed by the
# ORM/DB and never mirrored.
_MIRRORED_FIELDS = (
    "who_code",
    "vaccine_name",
    "short_name",
    "category",
    "common_names",
    "is_combined",
    "components",
    "disease_keys",
    "default_manufacturer",
    "is_common",
    "display_order",
)


class VaccineLibrarySyncResult(TypedDict):
    inserted: int
    updated: int
    unchanged: int


def _entry_field_values(entry: Dict[str, Any]) -> Dict[str, Any]:
    return {
        # Normalize "" to None: an empty-string who_code must never be
        # treated differently from an absent one (the DB's unique index on
        # who_code treats repeated "" values as duplicates, unlike NULL).
        "who_code": entry.get("who_code") or None,
        "vaccine_name": entry["vaccine_name"],
        "short_name": entry.get("short_name"),
        "category": entry.get("category"),
        "common_names": entry.get("common_names"),
        "is_combined": bool(entry.get("is_combined", False)),
        "components": entry.get("components"),
        "disease_keys": entry.get("disease_keys"),
        "default_manufacturer": entry.get("default_manufacturer"),
        "is_common": bool(entry.get("is_common", False)),
        "display_order": entry.get("display_order"),
    }


def _apply_if_changed(row: StandardizedVaccine, values: Dict[str, Any]) -> bool:
    """Overwrite mirrored fields on ``row`` that differ from ``values``.

    Returns True if anything actually changed.
    """
    changed = False
    for field in _MIRRORED_FIELDS:
        if getattr(row, field) != values[field]:
            setattr(row, field, values[field])
            changed = True
    return changed


def sync_vaccine_library(db: Session) -> VaccineLibrarySyncResult:
    """Upsert ``standardized_vaccines`` from shared/data/vaccine_library.json.

    Runs on every app startup (see ``run_startup_data_migrations``) instead
    of relying on a hand-written Alembic migration per library change —
    every future change that only touches vaccine_library.json (new vaccine,
    corrected disease_keys, etc.) now reaches already-deployed databases on
    next boot, no migration required. Historical drift already baked into
    old JSON-only commits (#865, #866, #893) was closed out by a one-time
    catch-up migration (a5b6c7d8e9f0); this service is what prevents the
    same class of drift going forward.

    Matching precedence mirrors ``vaccine_resolver.build_library_index`` and
    that historical migration: ``who_code`` when present, falling back to a
    case-insensitive ``vaccine_name`` match if no row has that code yet (e.g.
    a row first synced with no code later gains one in a JSON edit — the
    fallback finds it by name instead of inserting a duplicate, and
    ``who_code`` itself heals onto the row via ``_apply_if_changed``).
    Existing rows are fully overwritten on drift — safe because
    standardized_vaccines has no
    user-writable API (``app/api/v1/endpoints/standardized_vaccine.py`` is
    GET-only), so there is no user data to clobber. Rows whose entry has
    been removed from the JSON are left in place rather than deleted, since
    ``immunizations.standardized_vaccine_id`` may reference them (ON DELETE
    SET NULL would silently unlink real records over a bad JSON edit) — a
    warning is logged instead so the drift is visible.

    Concurrency note: ``vaccine_name`` has no DB-level unique constraint for
    ``who_code IS NULL`` rows, so two app instances booting at the exact
    same moment could theoretically both decide to insert the same
    no-who-code vaccine. Accepted as a non-issue for MediKeep's typical
    single-container self-hosted deployment rather than adding a schema
    migration and an advisory lock for it — revisit if that deployment
    assumption ever changes.
    """
    entries = get_vaccine_entries()

    existing = db.query(StandardizedVaccine).all()
    by_who_code = {v.who_code: v for v in existing if v.who_code}
    by_name_lower = {
        v.vaccine_name.lower(): v
        for v in existing
        if v.who_code is None and v.vaccine_name
    }

    matched_ids = set()
    result: VaccineLibrarySyncResult = {"inserted": 0, "updated": 0, "unchanged": 0}

    for entry in entries:
        if not entry.get("vaccine_name"):
            logger.warning(
                "Vaccine library entry missing vaccine_name, skipping",
                extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "vaccine_library_sync_entry_skipped",
                    "who_code": entry.get("who_code"),
                },
            )
            continue

        who_code = entry.get("who_code") or None
        name_lower = entry["vaccine_name"].lower()
        values = _entry_field_values(entry)

        # who_code takes precedence, but falls back to a name match if no
        # row has that code yet — otherwise a row first synced without a
        # code (matched by name) looks "not found" the moment its JSON entry
        # gains a code, and gets inserted again as a duplicate.
        row = by_who_code.get(who_code) if who_code else None
        if row is None:
            row = by_name_lower.get(name_lower)

        if row is None:
            row = StandardizedVaccine(**values)
            db.add(row)
            result["inserted"] += 1
        else:
            matched_ids.add(row.id)
            if _apply_if_changed(row, values):
                result["updated"] += 1
            else:
                result["unchanged"] += 1

        # Make this entry's row visible to later entries in the same pass —
        # otherwise a duplicate who_code/name later in the JSON would look
        # "not found" against the pre-loop snapshot and get inserted again,
        # tripping the DB's unique constraint on who_code. by_name_lower
        # stays uncoded-only: registering a coded row there too would let a
        # later entry with a *different* who_code but the same display name
        # match it via the name fallback and overwrite its who_code, merging
        # two distinct vaccines into one row.
        if who_code:
            by_who_code[who_code] = row
        else:
            by_name_lower[name_lower] = row

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    db_only = [v for v in existing if v.id not in matched_ids]
    if db_only:
        logger.warning(
            "Standardized vaccines present in DB but absent from the library JSON",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "vaccine_library_sync_db_only_rows",
                "who_codes": sorted(v.who_code for v in db_only if v.who_code),
                "vaccine_names": sorted(
                    v.vaccine_name for v in db_only if v.who_code is None
                ),
            },
        )

    logger.info(
        "Vaccine library sync completed",
        extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "vaccine_library_sync_completed",
            LogFields.COUNT: len(entries),
            "inserted": result["inserted"],
            "updated": result["updated"],
            "unchanged": result["unchanged"],
        },
    )

    return result
