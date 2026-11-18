"""Hemoglobin unit conversion and display of blood donation readings. Hemoglobin is stored in g/dL."""

from typing import Optional

from app.models.enums import HemoglobinUnit

DEFAULT_HEMOGLOBIN_UNIT = HemoglobinUnit.G_DL.value

HEMOGLOBIN_UNIT_LABELS = {
    HemoglobinUnit.G_DL.value: "g/dL",
    HemoglobinUnit.G_L.value: "g/L",
    HemoglobinUnit.MMOL_L.value: "mmol/L",
}

# Multiply a g/dL value by this to get the unit. mmol/L uses the hemoglobin
# monomer mass (16114 g/mol).
_FROM_G_DL = {
    HemoglobinUnit.G_DL.value: 1.0,
    HemoglobinUnit.G_L.value: 10.0,
    HemoglobinUnit.MMOL_L.value: 0.6206,
}


def resolve_hemoglobin_unit(unit: Optional[str]) -> str:
    """Return a valid unit key, falling back to g/dL for unset or unknown values."""
    return unit if unit in _FROM_G_DL else DEFAULT_HEMOGLOBIN_UNIT


def convert_hemoglobin_from_g_dl(
    value: Optional[float], unit: Optional[str]
) -> Optional[float]:
    """Convert a stored g/dL value to the given unit, rounded for display."""
    if value is None:
        return None
    unit = resolve_hemoglobin_unit(unit)
    return round(value * _FROM_G_DL[unit], _decimals(unit))


def format_hemoglobin(value: Optional[float], unit: Optional[str]) -> Optional[str]:
    """Display text for a stored g/dL value in the given unit, e.g. '140 g/L'."""
    if value is None:
        return None
    unit = resolve_hemoglobin_unit(unit)
    return (
        f"{value * _FROM_G_DL[unit]:.{_decimals(unit)}f} {HEMOGLOBIN_UNIT_LABELS[unit]}"
    )


def format_blood_pressure(
    systolic: Optional[int], diastolic: Optional[int]
) -> Optional[str]:
    """'120/80' with '?' for a missing side; None when neither is recorded."""
    if systolic is None and diastolic is None:
        return None
    systolic_text = "?" if systolic is None else systolic
    diastolic_text = "?" if diastolic is None else diastolic
    return f"{systolic_text}/{diastolic_text}"


def _decimals(unit: str) -> int:
    return 0 if unit == HemoglobinUnit.G_L.value else 1
