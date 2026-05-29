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
    is_combined=False,
    components=None,
):
    return SimpleNamespace(
        id=id_,
        vaccine_name=vaccine_name,
        common_names=common_names,
        is_combined=is_combined,
        components=components,
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


def test_fk_present_returns_components_for_combined():
    dtap = make_library_entry(
        10, "DTaP", is_combined=True,
        components=["Diphtheria", "Tetanus", "Pertussis"],
    )
    index = {"by_id": {10: dtap}, "by_name": {"dtap": dtap}}
    imm = make_immunization("anything", standardized_vaccine_id=10)
    components, matched = resolve_components(imm, index)
    assert components == ["Diphtheria", "Tetanus", "Pertussis"]
    assert matched is True


def test_fk_present_returns_vaccine_name_for_single_disease():
    polio = make_library_entry(11, "Polio (IPV)")
    index = {"by_id": {11: polio}, "by_name": {"polio (ipv)": polio}}
    imm = make_immunization("Polio (IPV)", standardized_vaccine_id=11)
    components, matched = resolve_components(imm, index)
    assert components == ["Polio (IPV)"]
    assert matched is True


def test_fk_missing_falls_back_to_exact_name_match():
    mmr = make_library_entry(
        12, "MMR", is_combined=True,
        components=["Measles", "Mumps", "Rubella"],
    )
    index = {"by_id": {12: mmr}, "by_name": {"mmr": mmr}}
    imm = make_immunization("MMR")
    components, matched = resolve_components(imm, index)
    assert components == ["Measles", "Mumps", "Rubella"]
    assert matched is True


def test_name_match_is_case_insensitive():
    flu = make_library_entry(13, "Influenza")
    index = {"by_id": {13: flu}, "by_name": {"influenza": flu}}
    imm = make_immunization("INFLUENZA")
    components, matched = resolve_components(imm, index)
    assert components == ["Influenza"]
    assert matched is True


def test_common_name_match():
    shingrix = make_library_entry(
        14, "Recombinant Zoster Vaccine", common_names=["Shingrix"],
    )
    index = {
        "by_id": {14: shingrix},
        "by_name": {
            "recombinant zoster vaccine": shingrix,
            "shingrix": shingrix,
        },
    }
    imm = make_immunization("Shingrix")
    components, matched = resolve_components(imm, index)
    assert components == ["Recombinant Zoster Vaccine"]
    assert matched is True


def test_no_match_returns_empty():
    index = {"by_id": {}, "by_name": {}}
    imm = make_immunization("Bigfoot Vaccine")
    components, matched = resolve_components(imm, index)
    assert components == []
    assert matched is False


def test_fk_pointing_to_missing_entry_falls_back_to_name():
    mmr = make_library_entry(
        12, "MMR", is_combined=True, components=["Measles", "Mumps", "Rubella"],
    )
    index = {"by_id": {12: mmr}, "by_name": {"mmr": mmr}}
    imm = make_immunization("MMR", standardized_vaccine_id=999)
    components, matched = resolve_components(imm, index)
    assert components == ["Measles", "Mumps", "Rubella"]
    assert matched is True


def test_combined_vaccine_with_null_components_treated_as_unmatched():
    bad = make_library_entry(15, "BadCombo", is_combined=True, components=None)
    index = {"by_id": {15: bad}, "by_name": {"badcombo": bad}}
    imm = make_immunization("BadCombo", standardized_vaccine_id=15)
    components, matched = resolve_components(imm, index)
    assert components == []
    assert matched is False


def test_build_library_index_populates_name_and_id_maps():
    mmr = make_library_entry(
        12, "MMR", common_names=["MMR II"], is_combined=True,
        components=["Measles", "Mumps", "Rubella"],
    )
    polio = make_library_entry(13, "Polio")

    class StubQuery:
        def all(self):
            return [mmr, polio]

    class StubDB:
        def query(self, _model):
            return StubQuery()

    index = build_library_index(StubDB())
    assert index["by_id"][12] is mmr
    assert index["by_id"][13] is polio
    assert index["by_name"]["mmr"] is mmr
    assert index["by_name"]["mmr ii"] is mmr  # common name indexed
    assert index["by_name"]["polio"] is polio
