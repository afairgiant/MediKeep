"""Merged rules: the check helpers and how updates apply them to stored rows."""

import importlib
import pkgutil
from datetime import date, timedelta
from types import SimpleNamespace
from typing import ClassVar, Optional

import pytest
from pydantic import BaseModel
from sqlalchemy import inspect

import app.schemas
from app.models.associations import TreatmentMedication
from app.models.clinical import (
    Condition,
    Encounter,
    Immunization,
    Medication,
    Symptom,
    SymptomOccurrence,
)
from app.models.family import FamilyMember
from app.models.labs import LabResult
from app.models.patient import Insurance
from app.models.procedures import MedicalEquipment, Procedure, Treatment
from app.schemas.condition import ConditionUpdate
from app.schemas.encounter import EncounterUpdate
from app.schemas.family_member import FamilyMemberUpdate
from app.schemas.immunization import ImmunizationUpdate
from app.schemas.insurance import InsuranceUpdate
from app.schemas.lab_result import LabResultUpdate
from app.schemas.medical_equipment import MedicalEquipmentUpdate
from app.schemas.medication import MedicationUpdate
from app.schemas.merged_rules import (
    MergedRule,
    MergedRuleError,
    check_merged_rules,
    ordered_check,
    status_date_check,
)
from app.schemas.procedure import ProcedureUpdate
from app.schemas.symptom import SymptomOccurrenceUpdate, SymptomUpdate
from app.schemas.treatment import TreatmentMedicationUpdate, TreatmentUpdate

# Model each update schema is applied to
UPDATE_MODELS = {
    ConditionUpdate: Condition,
    EncounterUpdate: Encounter,
    FamilyMemberUpdate: FamilyMember,
    ImmunizationUpdate: Immunization,
    InsuranceUpdate: Insurance,
    LabResultUpdate: LabResult,
    MedicalEquipmentUpdate: MedicalEquipment,
    MedicationUpdate: Medication,
    ProcedureUpdate: Procedure,
    SymptomOccurrenceUpdate: SymptomOccurrence,
    SymptomUpdate: Symptom,
    TreatmentMedicationUpdate: TreatmentMedication,
    TreatmentUpdate: Treatment,
}


class Update(BaseModel):
    start: Optional[int] = None
    end: Optional[int] = None
    notes: Optional[str] = None

    MERGED_RULES: ClassVar[tuple[MergedRule, ...]] = (
        MergedRule(("start", "end"), ordered_check("end before start")),
    )


STORED = SimpleNamespace(start=5, end=8, notes=None)
BROKEN = SimpleNamespace(start=5, end=1, notes=None)


def test_sent_field_is_checked_against_stored_field():
    with pytest.raises(MergedRuleError, match="end before start"):
        check_merged_rules(Update(end=1), STORED)


def test_valid_one_sided_update_passes():
    check_merged_rules(Update(end=9), STORED)


def test_cleared_field_passes():
    check_merged_rules(Update(start=None, end=1), STORED)


def test_unrelated_update_skips_the_rule_on_a_broken_row():
    check_merged_rules(Update(notes="x"), BROKEN)


def test_resending_stored_values_skips_the_rule_on_a_broken_row():
    check_merged_rules(Update(start=5, end=1, notes="x"), BROKEN)


def test_inputs_without_rules_pass():
    class Plain(BaseModel):
        end: Optional[int] = None

    check_merged_rules(Plain(end=1), STORED)
    check_merged_rules({"end": 1}, STORED)


@pytest.mark.parametrize(
    "strict, first, second, rejected",
    [
        (False, 5, 4, True),
        (False, 5, 5, False),
        (True, 5, 5, True),
        (False, 0.0, -1.0, True),
        (False, None, 1, False),
        (False, 1, None, False),
    ],
)
def test_ordered_check(strict, first, second, rejected):
    check = ordered_check("out of order", strict=strict)
    if rejected:
        with pytest.raises(ValueError, match="out of order"):
            check(first, second)
    else:
        check(first, second)


@pytest.mark.parametrize(
    "value, status, message",
    [
        (date.today() + timedelta(days=1), "completed", "in the future for completed"),
        (date.today() + timedelta(days=4000), "planned", "more than 10 years"),
        (date.today() + timedelta(days=1), "planned", None),
        (date.today() - timedelta(days=1), "completed", None),
        ("2099-01-01", "completed", None),
        (date.today() + timedelta(days=1), 1, None),
    ],
    ids=["future-done", "too-far", "future-ok", "past", "not-a-date", "not-a-status"],
)
def test_status_date_check(value, status, message):
    check = status_date_check("Visit date", "visits", future_ok={"planned"})
    if message:
        with pytest.raises(ValueError, match=message):
            check(value, status)
    else:
        check(value, status)


def _schemas_with_merged_rules():
    found = set()
    for info in pkgutil.iter_modules(app.schemas.__path__):
        module = importlib.import_module(f"app.schemas.{info.name}")
        for value in vars(module).values():
            if (
                isinstance(value, type)
                and issubclass(value, BaseModel)
                and "MERGED_RULES" in vars(value)
            ):
                found.add(value)
    return found


def test_every_schema_with_merged_rules_has_a_model():
    assert _schemas_with_merged_rules() == set(UPDATE_MODELS)


@pytest.mark.parametrize(
    "schema, model", UPDATE_MODELS.items(), ids=lambda v: getattr(v, "__name__", v)
)
def test_merged_rule_fields_are_model_columns(schema, model):
    columns = set(inspect(model).columns.keys())
    for rule in schema.MERGED_RULES:
        assert set(rule.fields) <= columns, rule.fields
