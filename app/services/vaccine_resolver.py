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

    Canonical ``vaccine_name`` is indexed first; ``common_names`` are then
    added via ``setdefault`` so a brand alias never displaces another
    vaccine's canonical name, regardless of iteration order.
    """
    vaccines = db.query(StandardizedVaccine).all()
    by_id: dict[int, StandardizedVaccine] = {}
    by_name: dict[str, StandardizedVaccine] = {}

    # Pass 1: canonical names (and id index). Canonical entries always win.
    for vaccine in vaccines:
        by_id[vaccine.id] = vaccine
        if vaccine.vaccine_name:
            by_name[vaccine.vaccine_name.lower()] = vaccine

    # Pass 2: common-name aliases. setdefault ensures they cannot displace
    # any canonical entry indexed in pass 1.
    for vaccine in vaccines:
        for alt in vaccine.common_names or []:
            if alt:
                by_name.setdefault(alt.lower(), vaccine)

    return {"by_id": by_id, "by_name": by_name}


def _components_for(vaccine: StandardizedVaccine) -> list[str]:
    """Return the disease components covered by a vaccine.

    Combined vaccines surface their stored components; single-disease vaccines
    return their own canonical name. A combined vaccine with missing
    components is treated as unmatched — the caller decides what to do.
    """
    if vaccine.is_combined:
        components = vaccine.components or []
        return list(components)
    return [vaccine.vaccine_name]


def resolve_components(
    immunization: Immunization,
    library_index: LibraryIndex,
) -> tuple[list[str], bool]:
    """Resolve an immunization to its disease components.

    Returns ``(components, was_matched)``. Matching order:
      1. FK lookup via ``standardized_vaccine_id``.
      2. Exact (case-insensitive) match on ``vaccine_name`` or a library
         entry's ``common_names``.
      3. No match → empty list, ``was_matched=False``.

    A combined vaccine with empty ``components`` is reported as unmatched so
    the UI can flag the data issue rather than silently rendering nothing.
    """
    vaccine: StandardizedVaccine | None = None

    if immunization.standardized_vaccine_id is not None:
        vaccine = library_index["by_id"].get(immunization.standardized_vaccine_id)

    if vaccine is None and immunization.vaccine_name:
        vaccine = library_index["by_name"].get(immunization.vaccine_name.lower())

    if vaccine is None:
        return [], False

    components = _components_for(vaccine)
    if not components:
        return [], False
    return components, True
