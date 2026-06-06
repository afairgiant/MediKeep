"""Integrity checks for shared/data/vaccine_library.json.

These tests guard against drift between the JSON library and the resolver's
expectations — especially the ``disease_keys`` contract added for the
immunization history By-Disease view (issue #864). If someone adds a new
vaccine entry without filling in ``disease_keys``, this catches it.
"""

import json
from pathlib import Path

import pytest


LIBRARY_FILE = (
    Path(__file__).resolve().parents[2] / "shared" / "data" / "vaccine_library.json"
)


@pytest.fixture(scope="module")
def library() -> dict:
    with LIBRARY_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def test_library_file_exists():
    assert LIBRARY_FILE.exists(), f"Vaccine library JSON missing at {LIBRARY_FILE}"


def test_every_entry_has_non_empty_disease_keys(library):
    """Every vaccine must declare which diseases it covers, so the resolver
    can group it. Empty/missing disease_keys would silently hide records from
    the By Disease view."""
    missing = [
        v["vaccine_name"] for v in library["vaccines"] if not v.get("disease_keys")
    ]
    assert (
        not missing
    ), "These vaccines have missing or empty disease_keys:\n  - " + "\n  - ".join(
        missing
    )


def test_disease_keys_are_unique_per_entry(library):
    """A combo listing the same disease twice would inflate dose counts in the
    history view's per-disease badges."""
    bad = []
    for v in library["vaccines"]:
        keys = v.get("disease_keys") or []
        if len(set(keys)) != len(keys):
            bad.append((v["vaccine_name"], keys))
    assert not bad, f"Duplicate disease_keys entries:\n{bad}"


def test_single_vaccines_have_exactly_one_disease_key(library):
    """is_combined=False means a single-disease vaccine — by definition it
    covers exactly one disease. More than one would indicate a mis-tag."""
    bad = []
    for v in library["vaccines"]:
        if v.get("is_combined"):
            continue
        keys = v.get("disease_keys") or []
        if len(keys) != 1:
            bad.append((v["vaccine_name"], keys))
    assert not bad, (
        "Single-disease vaccines must have exactly one disease_keys entry:\n" f"{bad}"
    )


def test_combined_vaccines_have_at_least_two_disease_keys(library):
    """is_combined=True means more than one disease covered. A combo with only
    one disease_key is either a tag bug or should be flipped to is_combined=False."""
    bad = []
    for v in library["vaccines"]:
        if not v.get("is_combined"):
            continue
        keys = v.get("disease_keys") or []
        if len(keys) < 2:
            bad.append((v["vaccine_name"], keys))
    # MenACWY-type vaccines collapse multiple serogroups to "Meningococcal";
    # OPV variants collapse Polio types to "Polio". Both legitimately resolve
    # to a single disease key despite is_combined=True (they bundle multiple
    # antigens against the same disease).
    allowed_single_disease_combos = {
        "Meningococcal ACYWX (Polysaccharide conjugate)",
        "Meningococcal ACYW-135 (conjugate vaccine)",
        "Meningococcal ACYW-135 Tetanus Toxoid (conjugate vaccine)",
        "Meningococcal A+C (Polysaccharide)",
        "Polio Vaccine - Oral (OPV) Bivalent Types 1 and 3",
        "Polio Vaccine - Oral (OPV) Trivalent",
    }
    bad = [entry for entry in bad if entry[0] not in allowed_single_disease_combos]
    assert not bad, (
        "Combined vaccines (is_combined=True) should cover ≥2 diseases:\n" f"{bad}"
    )


def test_polio_vaccines_share_one_disease_key(library):
    """Regression for issue #864: all Polio-containing vaccines must use a
    single 'Polio' bucket. If someone ever adds a new polio variant with a
    different key, this catches the split before users see it."""
    polio_entries = [
        v
        for v in library["vaccines"]
        if "Polio" in (v.get("components") or [])
        or "polio" in v["vaccine_name"].lower()
        or any("polio" in c.lower() for c in (v.get("components") or []))
    ]
    assert polio_entries, "Expected to find polio-related vaccines"
    for v in polio_entries:
        assert "Polio" in (v.get("disease_keys") or []), (
            f"{v['vaccine_name']!r} touches polio but lacks 'Polio' in "
            f"disease_keys: {v.get('disease_keys')}"
        )
