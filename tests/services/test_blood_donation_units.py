"""Unit tests for hemoglobin unit conversion."""

import pytest

from app.models.enums import get_all_hemoglobin_units
from app.services.blood_donation_units import (
    HEMOGLOBIN_UNIT_LABELS,
    convert_hemoglobin_from_g_dl,
    resolve_hemoglobin_unit,
)


def test_every_unit_has_a_label():
    assert set(HEMOGLOBIN_UNIT_LABELS) == set(get_all_hemoglobin_units())


@pytest.mark.parametrize(
    "unit, expected",
    [("g_dl", 14.0), ("g_l", 140), ("mmol_l", 8.7)],
)
def test_conversion_from_g_dl(unit, expected):
    assert convert_hemoglobin_from_g_dl(14.0, unit) == expected


def test_none_stays_none():
    assert convert_hemoglobin_from_g_dl(None, "g_l") is None


@pytest.mark.parametrize("unit", [None, "", "bogus"])
def test_unset_or_unknown_unit_falls_back_to_g_dl(unit):
    assert resolve_hemoglobin_unit(unit) == "g_dl"
    assert convert_hemoglobin_from_g_dl(13.5, unit) == 13.5
