"""
Spot checks that test_library.json entries carry the LOINC code of the test
they name. Displays below are from LOINC (checked with tx.fhir.org $lookup).
"""

import json
from pathlib import Path

import pytest

TEST_LIBRARY_PATH = (
    Path(__file__).resolve().parents[2] / "shared" / "data" / "test_library.json"
)

# Codes that name a different observation than the entries that carried them.
UNRELATED_CODES = {
    "5894-1": "Prothrombin time (PT) actual/Normal",
    "89024-4": "Hearing threshold Ear - left --500 Hz",
    "89016-0": "Hearing threshold Ear - left --1000 Hz",
    "89023-6": "Hearing threshold Ear - right --4000 Hz",
    "89022-8": "Hearing threshold Ear - left --4000 Hz",
    "89015-2": "Pure tone air conduction threshold audiometry panel",
    "89014-5": "Oxygen was used for preoxygenation",
}


@pytest.fixture(scope="module")
def entries_by_name():
    with TEST_LIBRARY_PATH.open(encoding="utf-8") as f:
        return {entry["test_name"]: entry for entry in json.load(f)["tests"]}


def test_ptt_uses_an_aptt_code(entries_by_name):
    # 3173-2 = "aPTT in Blood by Coagulation assay", as in the coagulation panel template
    assert entries_by_name["Partial Thromboplastin Time"]["test_code"] == "3173-2"


def test_no_entry_carries_an_unrelated_code(entries_by_name):
    carriers = {
        name: entry["test_code"]
        for name, entry in entries_by_name.items()
        if entry.get("test_code") in UNRELATED_CODES
    }
    assert not carriers, carriers
