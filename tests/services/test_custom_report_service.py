"""
Unit tests for CustomReportService helpers.
"""

import pytest
from types import SimpleNamespace

from app.services.custom_report_service import CustomReportService


def _condition(**kwargs):
    defaults = dict(
        id=99,
        condition_name=None,
        diagnosis=None,
        code_description=None,
        icd10_code=None,
    )
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


class TestFormatConditionName:
    def test_prefers_condition_name(self):
        c = _condition(condition_name="Hypertension", diagnosis="HTN", code_description="desc", icd10_code="I10")
        assert CustomReportService._format_condition_name(c) == "Hypertension"

    def test_falls_back_to_diagnosis(self):
        c = _condition(diagnosis="HTN", code_description="desc", icd10_code="I10")
        assert CustomReportService._format_condition_name(c) == "HTN"

    def test_falls_back_to_code_description(self):
        c = _condition(code_description="Essential hypertension", icd10_code="I10")
        assert CustomReportService._format_condition_name(c) == "Essential hypertension"

    def test_falls_back_to_icd10_code(self):
        c = _condition(icd10_code="I10")
        assert CustomReportService._format_condition_name(c) == "I10"

    def test_falls_back_to_id_sentinel(self):
        c = _condition(id=42)
        assert CustomReportService._format_condition_name(c) == "Condition #42"
