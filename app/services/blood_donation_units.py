"""Hemoglobin unit conversion. Values are stored in g/dL."""

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
    return round(value * _FROM_G_DL[unit], 1 if unit != HemoglobinUnit.G_L.value else 0)
