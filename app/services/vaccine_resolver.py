"""
Resolve immunization records to the disease components they cover.

Used by the immunization history endpoint to expand combination vaccines
(e.g., DTaP) into their components (Diphtheria, Tetanus, Pertussis) and to
present a chronological history grouped by disease.

The resolver is split into:
- ``build_library_index`` — single DB read producing a lookup structure.
- ``resolve_components`` — pure function operating on the pre-built index.

This split keeps the per-record hot path free of I/O so it can be unit-tested
in isolation and run in tight loops without surprise queries.
"""

from typing import TypedDict

from sqlalchemy.orm import Session

from app.models.clinical import Immunization, StandardizedVaccine


class LibraryIndex(TypedDict):
    by_id: dict[int, StandardizedVaccine]
    by_name: dict[str, StandardizedVaccine]


def build_library_index(db: Session) -> LibraryIndex:
    """Build O(1) id and lower-cased name lookups for the full vaccine library.

    Four-pass build with strict precedence so a low-priority alias can never
    displace a higher-priority entry:

      1. Canonical ``vaccine_name`` (and id index) — always wins.
      2. ``common_names`` brand aliases (Twinrix, Shingrix, ...).
      3. ``short_name`` — needed because the autocomplete picker writes
         ``short_name`` into the immunization record's ``vaccine_name`` field
         (e.g. "DTaP-Hib", "DT-IPV"). Without this pass, curated entries
         without a WHO code (no FK) and whose short_name isn't already in
         ``common_names`` would fall through as unmatched (issue #864).
      4. ``"<vaccine_name> (<short_name>)"`` — the bloated autocomplete
         display string that v0.67.0 inadvertently saved as ``vaccine_name``
         for ~64 of 72 library entries (form bug, fixed for new writes in the
         same release as this resolver change). Indexing the broken pattern
         here lets existing records auto-heal through the history endpoint's
         FK backfill on next read — no data migration required.
    """
    vaccines = db.query(StandardizedVaccine).all()
    by_id: dict[int, StandardizedVaccine] = {}
    by_name: dict[str, StandardizedVaccine] = {}

    for vaccine in vaccines:
        by_id[vaccine.id] = vaccine
        if vaccine.vaccine_name:
            by_name[vaccine.vaccine_name.lower()] = vaccine

    for vaccine in vaccines:
        for alt in vaccine.common_names or []:
            if alt:
                by_name.setdefault(alt.lower(), vaccine)

    for vaccine in vaccines:
        if vaccine.short_name:
            by_name.setdefault(vaccine.short_name.lower(), vaccine)

    for vaccine in vaccines:
        if (
            vaccine.vaccine_name
            and vaccine.short_name
            and vaccine.short_name != vaccine.vaccine_name
        ):
            display = f"{vaccine.vaccine_name} ({vaccine.short_name})"
            by_name.setdefault(display.lower(), vaccine)

    return {"by_id": by_id, "by_name": by_name}


def _disease_keys_for(vaccine: StandardizedVaccine) -> list[str]:
    """Return the canonical disease keys this vaccine covers.

    ``disease_keys`` is a curated list of grouping-friendly disease names
    (e.g. ``["Polio"]``, ``["Diphtheria", "Tetanus", "Pertussis"]``). It is
    distinct from ``components``, which holds raw antigen labels for display
    ("Polio (Inactivated)", "Diphtheria toxoid") that vary between combination
    products and would fragment grouping if used as bucket keys.

    A library row whose ``disease_keys`` is missing or empty is reported as
    unmatched by the caller — the record still appears in the chronological
    By Date view, just not grouped By Disease.
    """
    return list(vaccine.disease_keys or [])


def resolve_components(
    immunization: Immunization,
    library_index: LibraryIndex,
) -> tuple[list[str], bool, StandardizedVaccine | None]:
    """Resolve an immunization to the canonical disease keys it covers.

    Returns ``(disease_keys, was_matched, matched_vaccine)``. Matching order:
      1. FK lookup via ``standardized_vaccine_id``.
      2. Exact (case-insensitive) match on ``vaccine_name``, a library entry's
         ``common_names``, or its ``short_name`` (the autocomplete picker
         writes ``short_name`` into ``vaccine_name`` for many combos).
      3. No match → ``([], False, None)``.

    ``matched_vaccine`` is returned so callers needing additional fields on
    the library entry (e.g., ``is_combined`` for response shaping) don't have
    to repeat the lookup. A library row with missing/empty ``disease_keys`` is
    reported as ``([], False, vaccine)`` — the match exists but the grouping
    data is incomplete, so the caller can distinguish "no library entry" from
    "library entry but unclassified."
    """
    vaccine: StandardizedVaccine | None = None

    if immunization.standardized_vaccine_id is not None:
        vaccine = library_index["by_id"].get(immunization.standardized_vaccine_id)

    if vaccine is None and immunization.vaccine_name:
        vaccine = library_index["by_name"].get(immunization.vaccine_name.lower())

    if vaccine is None:
        return [], False, None

    disease_keys = _disease_keys_for(vaccine)
    if not disease_keys:
        return [], False, vaccine  # match exists but grouping data incomplete
    return disease_keys, True, vaccine
