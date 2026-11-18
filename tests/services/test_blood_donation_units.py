"""Unit tests for hemoglobin unit conversion."""

import pytest

from app.models.enums import get_all_hemoglobin_units
from app.services.blood_donation_units import (
    HEMOGLOBIN_UNIT_LABELS,
    convert_hemoglobin_from_g_dl,
    format_blood_pressure,
    format_hemoglobin,
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


@pytest.mark.parametrize(
    "unit, expected",
    [
        ("g_dl", "14.0 g/dL"),
        ("g_l", "140 g/L"),
        ("mmol_l", "8.7 mmol/L"),
        (None, "14.0 g/dL"),
    ],
)
def test_format_hemoglobin(unit, expected):
    assert format_hemoglobin(14.0, unit) == expected


def test_format_hemoglobin_none():
    assert format_hemoglobin(None, "g_l") is None


@pytest.mark.parametrize(
    "systolic, diastolic, expected",
    [(120, 80, "120/80"), (120, None, "120/?"), (None, 80, "?/80"), (None, None, None)],
)
def test_format_blood_pressure(systolic, diastolic, expected):
    assert format_blood_pressure(systolic, diastolic) == expected
