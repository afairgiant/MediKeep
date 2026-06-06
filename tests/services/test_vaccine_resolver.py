"""Unit tests for app.services.vaccine_resolver."""

from datetime import date
from types import SimpleNamespace

from app.services.vaccine_resolver import (
    build_library_index,
    resolve_components,
)


def make_library_entry(
    id_: int,
    vaccine_name: str,
    common_names=None,
    short_name=None,
    is_combined=False,
    components=None,
    disease_keys=None,
):
    return SimpleNamespace(
        id=id_,
        vaccine_name=vaccine_name,
        common_names=common_names,
        short_name=short_name,
        is_combined=is_combined,
        components=components,
        disease_keys=disease_keys,
    )


def make_immunization(
    vaccine_name: str,
    standardized_vaccine_id=None,
):
    return SimpleNamespace(
        vaccine_name=vaccine_name,
        standardized_vaccine_id=standardized_vaccine_id,
        date_administered=date(2024, 1, 1),
    )


def _stub_db(vaccines):
    """Minimal stand-in for a SQLAlchemy Session that satisfies build_library_index."""

    class StubQuery:
        def all(self):
            return vaccines

    class StubDB:
        def query(self, _model):
            return StubQuery()

    return StubDB()


def test_fk_present_returns_disease_keys_for_combined():
    dtap = make_library_entry(
        10,
        "DTaP",
        is_combined=True,
        components=["Diphtheria toxoid", "Tetanus toxoid", "Pertussis (acellular)"],
        disease_keys=["Diphtheria", "Tetanus", "Pertussis"],
    )
    index = {"by_id": {10: dtap}, "by_name": {"dtap": dtap}}
    imm = make_immunization("anything", standardized_vaccine_id=10)
    components, matched, _ = resolve_components(imm, index)
    # Resolver returns canonical disease keys, NOT raw antigen labels.
    assert components == ["Diphtheria", "Tetanus", "Pertussis"]
    assert matched is True


def test_fk_present_returns_disease_keys_for_single_vaccine():
    """Singles must emit the same canonical disease key as combos covering it,
    so the standalone IPV record and a DTaP-IPV record bucket together (issue #864)."""
    ipv = make_library_entry(
        11,
        "Polio Vaccine - Inactivated (IPV)",
        disease_keys=["Polio"],
    )
    index = {
        "by_id": {11: ipv},
        "by_name": {"polio vaccine - inactivated (ipv)": ipv},
    }
    imm = make_immunization(
        "Polio Vaccine - Inactivated (IPV)", standardized_vaccine_id=11
    )
    components, matched, _ = resolve_components(imm, index)
    assert components == ["Polio"]
    assert matched is True


def test_fk_missing_falls_back_to_exact_name_match():
    mmr = make_library_entry(
        12,
        "MMR",
        is_combined=True,
        disease_keys=["Measles", "Mumps", "Rubella"],
    )
    index = {"by_id": {12: mmr}, "by_name": {"mmr": mmr}}
    imm = make_immunization("MMR")
    components, matched, _ = resolve_components(imm, index)
    assert components == ["Measles", "Mumps", "Rubella"]
    assert matched is True


def test_name_match_is_case_insensitive():
    flu = make_library_entry(13, "Influenza", disease_keys=["Influenza"])
    index = {"by_id": {13: flu}, "by_name": {"influenza": flu}}
    imm = make_immunization("INFLUENZA")
    components, matched, _ = resolve_components(imm, index)
    assert components == ["Influenza"]
    assert matched is True


def test_common_name_match():
    shingrix = make_library_entry(
        14,
        "Recombinant Zoster Vaccine",
        common_names=["Shingrix"],
        disease_keys=["Shingles"],
    )
    index = {
        "by_id": {14: shingrix},
        "by_name": {
            "recombinant zoster vaccine": shingrix,
            "shingrix": shingrix,
        },
    }
    imm = make_immunization("Shingrix")
    components, matched, _ = resolve_components(imm, index)
    assert components == ["Shingles"]
    assert matched is True


def test_bloated_display_string_resolves_via_pass4_index():
    """Heal path for records saved by v0.67.0's form bug: the picker wrote the
    autocomplete display value ``"<vaccine_name> (<short_name>)"`` into
    ``vaccine_name`` instead of the short_name. ~64 of 72 library entries were
    affected. Pass 4 indexes that bloated pattern as an alias so the history
    endpoint's auto-backfill heals these records on next read — no data
    migration required."""
    tdap = make_library_entry(
        17,
        "Tetanus-Diphtheria-Pertussis (Adult, acellular)",
        short_name="Tdap",
        is_combined=True,
        disease_keys=["Tetanus", "Diphtheria", "Pertussis"],
    )
    index = build_library_index(_stub_db([tdap]))

    # Exactly what a v0.67.0 record looks like for a Tdap pick: vaccine_name
    # is the full autocomplete display value, FK is NULL.
    bloated = make_immunization(
        "Tetanus-Diphtheria-Pertussis (Adult, acellular) (Tdap)",
        standardized_vaccine_id=None,
    )
    components, matched, vaccine = resolve_components(bloated, index)
    assert matched is True
    assert vaccine is tdap
    assert components == ["Tetanus", "Diphtheria", "Pertussis"]


def test_display_alias_not_registered_when_short_equals_canonical():
    """No suffix is appended for entries where short_name == vaccine_name
    (BCG, Malaria, ...), so no bloated alias should exist for them. Defends
    against accidentally indexing "BCG (BCG)" as a separate key."""
    bcg = make_library_entry(18, "BCG", short_name="BCG", disease_keys=["Tuberculosis"])
    index = build_library_index(_stub_db([bcg]))
    assert "bcg" in index["by_name"]
    assert "bcg (bcg)" not in index["by_name"]


def test_display_alias_never_displaces_canonical_match():
    """The bloated display alias is registered last via setdefault. If a hypothetical
    second vaccine had ``"<A.vaccine_name> (<A.short_name>)"`` as its own canonical
    name, that canonical (pass 1) must still win."""
    a = make_library_entry(1, "Influenza", short_name="Flu", disease_keys=["Influenza"])
    # Pathological: B's canonical name happens to equal A's bloated display.
    b = make_library_entry(2, "Influenza (Flu)", disease_keys=["Influenza Other"])

    for order in ([a, b], [b, a]):
        index = build_library_index(_stub_db(order))
        assert index["by_name"]["influenza (flu)"] is b, (
            "B's canonical name must beat A's bloated-display alias "
            f"regardless of iteration order {[v.vaccine_name for v in order]!r}"
        )


def test_short_name_match_resolves_unlinked_combos():
    """Regression for issue #864: the autocomplete picker writes ``short_name``
    into ``vaccine_name`` for many combos. Without short_name indexing, curated
    entries with no WHO code (no FK) like DT-IPV or DTaP-Hib went unmatched."""
    dtap_hib = make_library_entry(
        16,
        "Diphtheria-Tetanus-Pertussis (acellular)-Haemophilus influenzae type b",
        short_name="DTaP-Hib",
        common_names=["DTaP/Hib", "Tetramune", "Infanrix-Hib"],  # short_name NOT here
        is_combined=True,
        disease_keys=["Diphtheria", "Tetanus", "Pertussis", "Hib"],
    )
    index = build_library_index(_stub_db([dtap_hib]))

    # Picker stored short_name as vaccine_name and didn't set the FK.
    imm = make_immunization("DTaP-Hib", standardized_vaccine_id=None)
    components, matched, _ = resolve_components(imm, index)
    assert matched is True
    assert components == ["Diphtheria", "Tetanus", "Pertussis", "Hib"]


def test_short_name_index_never_displaces_canonical_or_alias():
    """short_name is indexed last; if another vaccine's canonical name or
    common-name alias already owns that key, short_name must not steal it."""
    # Vaccine A has canonical name "HepB" (so by_name["hepb"] → A after pass 1)
    a = make_library_entry(1, "HepB", disease_keys=["Hepatitis B"])
    # Vaccine B uses "HepB" as its short_name (would collide in pass 3)
    b = make_library_entry(
        2,
        "Hepatitis B (Combined Brand)",
        short_name="HepB",
        disease_keys=["Hepatitis B", "Other"],
    )

    # Try both iteration orders — canonical entry A must win either way.
    for order in ([a, b], [b, a]):
        index = build_library_index(_stub_db(order))
        assert index["by_name"]["hepb"] is a, (
            "Canonical vaccine_name must beat a short_name collision regardless of "
            f"iteration order {[v.vaccine_name for v in order]!r}"
        )


def test_short_name_does_not_overwrite_common_name_alias():
    """A common-name alias placed in pass 2 must beat a short_name placed in
    pass 3 — common_names is the higher-precedence alias channel."""
    # Vaccine A claims "Twinrix" via common_names (pass 2 owns this key first).
    a = make_library_entry(
        1,
        "Hepatitis A and Hepatitis B (Combined)",
        common_names=["Twinrix", "HepA-HepB"],
        disease_keys=["Hepatitis A", "Hepatitis B"],
    )
    # Vaccine B uses "Twinrix" as its short_name — pass 3 must not displace A.
    b = make_library_entry(
        2,
        "Some Unrelated Vaccine",
        short_name="Twinrix",
        disease_keys=["Unrelated"],
    )

    for order in ([a, b], [b, a]):
        index = build_library_index(_stub_db(order))
        assert index["by_name"]["twinrix"] is a


def test_no_match_returns_empty():
    index = {"by_id": {}, "by_name": {}}
    imm = make_immunization("Bigfoot Vaccine")
    components, matched, _ = resolve_components(imm, index)
    assert components == []
    assert matched is False


def test_fk_pointing_to_missing_entry_falls_back_to_name():
    mmr = make_library_entry(
        12,
        "MMR",
        is_combined=True,
        disease_keys=["Measles", "Mumps", "Rubella"],
    )
    index = {"by_id": {12: mmr}, "by_name": {"mmr": mmr}}
    imm = make_immunization("MMR", standardized_vaccine_id=999)
    components, matched, _ = resolve_components(imm, index)
    assert components == ["Measles", "Mumps", "Rubella"]
    assert matched is True


def test_matched_vaccine_with_missing_disease_keys_reports_unmatched():
    """A library row whose disease_keys is empty/None means the row exists but
    can't be grouped. Caller distinguishes this from 'no library entry' via the
    third tuple element."""
    incomplete = make_library_entry(
        15,
        "ExoticVaccine",
        is_combined=True,
        disease_keys=None,
    )
    index = {"by_id": {15: incomplete}, "by_name": {"exoticvaccine": incomplete}}
    imm = make_immunization("ExoticVaccine", standardized_vaccine_id=15)
    components, matched, vaccine = resolve_components(imm, index)
    assert components == []
    assert matched is False
    assert vaccine is incomplete  # library row found, just unclassified


def test_resolve_returns_matched_vaccine_object():
    """The matched vaccine should be returned so callers can read extra fields
    (e.g., is_combined) without repeating the lookup."""
    dtap = make_library_entry(
        10,
        "DTaP",
        is_combined=True,
        disease_keys=["Diphtheria", "Tetanus", "Pertussis"],
    )
    index = {"by_id": {10: dtap}, "by_name": {"dtap": dtap}}
    imm = make_immunization("anything", standardized_vaccine_id=10)

    _components, _matched, vaccine = resolve_components(imm, index)
    assert vaccine is dtap
    assert vaccine.is_combined is True


def test_resolve_returns_none_vaccine_when_unmatched():
    index = {"by_id": {}, "by_name": {}}
    imm = make_immunization("Unknown")

    _, matched, vaccine = resolve_components(imm, index)
    assert matched is False
    assert vaccine is None


def test_build_library_index_populates_name_id_and_short_name_maps():
    mmr = make_library_entry(
        12,
        "MMR",
        common_names=["MMR II"],
        short_name="MMR",
        is_combined=True,
        disease_keys=["Measles", "Mumps", "Rubella"],
    )
    dtap_hib = make_library_entry(
        13,
        "Diphtheria-Tetanus-Pertussis (acellular)-Haemophilus influenzae type b",
        short_name="DTaP-Hib",
        disease_keys=["Diphtheria", "Tetanus", "Pertussis", "Hib"],
    )

    index = build_library_index(_stub_db([mmr, dtap_hib]))
    assert index["by_id"][12] is mmr
    assert index["by_id"][13] is dtap_hib
    assert index["by_name"]["mmr"] is mmr  # canonical
    assert index["by_name"]["mmr ii"] is mmr  # common name
    assert index["by_name"]["dtap-hib"] is dtap_hib  # short_name


def test_canonical_name_always_wins_over_alias_collision():
    """A common-name alias must never displace another vaccine's canonical name,
    regardless of iteration order in the catalog."""
    a = make_library_entry(
        1, "Flu", common_names=["Fluzone"], disease_keys=["Influenza"]
    )
    b = make_library_entry(2, "Fluzone", disease_keys=["Influenza"])

    for order in ([a, b], [b, a]):
        index = build_library_index(_stub_db(order))
        assert index["by_name"]["fluzone"] is b, (
            "B's canonical name 'Fluzone' must beat A's common-name alias "
            f"regardless of iteration order {[v.vaccine_name for v in order]!r}"
        )


def test_empty_canonical_name_is_skipped():
    """Defensive: an empty vaccine_name string must not pollute by_name with a blank key."""
    bad = make_library_entry(99, "")
    index = build_library_index(_stub_db([bad]))
    assert "" not in index["by_name"]
    assert 99 in index["by_id"]  # id index still populated
