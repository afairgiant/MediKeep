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


from datetime import date, datetime

from app.schemas.custom_reports import (
    CustomReportRequest,
    DateRange,
    NoMatchingRecordsError,
    RecordSummary,
)


def _service():
    return CustomReportService.__new__(CustomReportService)


def _rec(**kwargs):
    return SimpleNamespace(**kwargs)


class TestCategoryDateFields:
    @pytest.mark.parametrize("category", sorted(CustomReportService.CATEGORY_DATE_FIELDS))
    def test_date_field_is_real_column(self, category):
        model = CustomReportService.CATEGORY_MODELS[category]
        column = CustomReportService.CATEGORY_DATE_FIELDS[category]
        assert column in model.__table__.columns


class TestApplyReportFilters:
    def test_no_filters_returns_all(self):
        records = [_rec(id=1, onset_date=None, tags=None)]
        assert _service()._apply_report_filters(records, "conditions", None, None) == records

    def test_date_bounds_inclusive(self):
        records = [
            _rec(id=1, onset_date=date(2024, 1, 1)),
            _rec(id=2, onset_date=date(2024, 6, 1)),
            _rec(id=3, onset_date=date(2024, 12, 31)),
            _rec(id=4, onset_date=date(2025, 1, 1)),
        ]
        dr = DateRange(start_date=date(2024, 1, 1), end_date=date(2024, 12, 31))
        out = _service()._apply_report_filters(records, "conditions", dr, None)
        assert [r.id for r in out] == [1, 2, 3]

    def test_open_ended_range(self):
        records = [_rec(id=1, onset_date=date(2020, 1, 1)), _rec(id=2, onset_date=date(2024, 1, 1))]
        dr = DateRange(start_date=date(2023, 1, 1))
        out = _service()._apply_report_filters(records, "conditions", dr, None)
        assert [r.id for r in out] == [2]

    def test_null_date_excluded_when_bound_set(self):
        records = [_rec(id=1, onset_date=None), _rec(id=2, onset_date=date(2024, 1, 1))]
        dr = DateRange(start_date=date(2023, 1, 1))
        out = _service()._apply_report_filters(records, "conditions", dr, None)
        assert [r.id for r in out] == [2]

    def test_datetime_column_uses_date_part(self):
        records = [
            _rec(id=1, recorded_date=datetime(2024, 3, 1, 23, 59)),
            _rec(id=2, recorded_date=datetime(2024, 3, 2, 0, 1)),
        ]
        dr = DateRange(end_date=date(2024, 3, 1))
        out = _service()._apply_report_filters(records, "vitals", dr, None)
        assert [r.id for r in out] == [1]

    def test_category_without_date_not_date_filtered(self):
        records = [_rec(id=1, created_at=datetime(2000, 1, 1))]
        dr = DateRange(start_date=date(2024, 1, 1))
        out = _service()._apply_report_filters(records, "emergency_contacts", dr, None)
        assert out == records

    def test_reference_categories_exempt(self):
        records = [_rec(id=1, created_at=datetime(2000, 1, 1), tags=None)]
        dr = DateRange(start_date=date(2024, 1, 1))
        svc = _service()
        assert svc._apply_report_filters(records, "practitioners", dr, ["x"]) == records

    def test_tags_any_match_case_insensitive(self):
        records = [
            _rec(id=1, tags=["Diabetes"]),
            _rec(id=2, tags=["cardio", "urgent"]),
            _rec(id=3, tags=[]),
            _rec(id=4, tags=None),
        ]
        out = _service()._apply_report_filters(records, "medications", None, ["diabetes", "URGENT"])
        assert [r.id for r in out] == [1, 2]

    def test_tags_exclude_category_without_tags_column(self):
        records = [_rec(id=1, recorded_date=datetime(2024, 1, 1))]
        out = _service()._apply_report_filters(records, "vitals", None, ["x"])
        assert out == []

    def test_date_and_tags_are_anded(self):
        records = [
            _rec(id=1, onset_date=date(2024, 1, 1), tags=["a"]),
            _rec(id=2, onset_date=date(2020, 1, 1), tags=["a"]),
            _rec(id=3, onset_date=date(2024, 1, 1), tags=["b"]),
        ]
        dr = DateRange(start_date=date(2023, 1, 1))
        out = _service()._apply_report_filters(records, "conditions", dr, ["a"])
        assert [r.id for r in out] == [1]


class TestTagsRequestValidation:
    def _req(self, tags):
        return CustomReportRequest(
            selected_records=[{"category": "medications", "record_ids": [1]}],
            tags=tags,
        )

    def test_normalizes_and_dedupes(self):
        assert self._req([" a ", "A", "", "b"]).tags == ["a", "b"]

    def test_empty_becomes_none(self):
        assert self._req(["  "]).tags is None

    def test_too_many_tags_rejected(self):
        with pytest.raises(ValueError):
            self._req([f"t{i}" for i in range(51)])

    def test_overlong_tag_rejected(self):
        with pytest.raises(ValueError):
            self._req(["x" * 101])


class TestNoMatchingRecords:
    @pytest.mark.asyncio
    async def test_filters_removing_everything_raise_no_matching_records(self):
        from unittest.mock import AsyncMock, MagicMock, patch

        svc = _service()
        svc.db = MagicMock()
        svc._log_report_generation_start = AsyncMock()
        svc._log_report_generation_failed = AsyncMock()
        svc.validate_record_ownership = AsyncMock()
        svc._get_selected_records = AsyncMock(return_value=[])
        request = CustomReportRequest(
            selected_records=[{"category": "medications", "record_ids": [1]}],
            date_range={"start_date": "2024-01-01"},
            tags=["diabetes"],
        )
        with patch(
            "app.services.custom_report_service.user_preferences_crud"
        ) as prefs:
            prefs.get_by_user_id.return_value = None
            with pytest.raises(NoMatchingRecordsError, match="No records match"):
                await svc.generate_selective_report(1, request)


class TestCountMatchingRecords:
    @pytest.mark.asyncio
    async def test_counts_use_the_same_filters_as_generation(self):
        from unittest.mock import AsyncMock, MagicMock

        svc = _service()
        svc.db = MagicMock()
        records = {
            "conditions": [
                SimpleNamespace(id=1, onset_date=date(2024, 5, 1), tags=["a"]),
                SimpleNamespace(id=2, onset_date=date(2019, 5, 1), tags=["a"]),
                SimpleNamespace(id=3, onset_date=date(2024, 5, 1), tags=["b"]),
            ],
            "medications": [],
        }

        def fake_query(patient_id, category, record_ids):
            return SimpleNamespace(all=lambda: records[category])

        svc._build_selection_query = fake_query
        request = CustomReportRequest(
            selected_records=[
                {"category": "conditions", "record_ids": [1, 2, 3]},
                {"category": "medications", "record_ids": [9]},
            ],
            date_range={"start_date": "2023-01-01"},
            tags=["a"],
        )
        svc.validate_record_ownership = AsyncMock()
        svc._get_active_patient = lambda user_id: SimpleNamespace(id=5)

        result = await svc.count_matching_records(1, request)

        assert result == {
            "total": 1,
            "categories": {"conditions": 1, "medications": 0},
            "matching_ids": {"conditions": [1], "medications": []},
        }


class TestDisplayedDateMatchesFilterDate:
    def test_uses_the_filter_column_with_no_fallback(self):
        lab = SimpleNamespace(
            ordered_date=None,
            created_at=datetime(2024, 5, 1),
            updated_at=datetime(2024, 6, 1),
        )
        assert _service()._get_date_field(lab, "lab_results") is None

    def test_returns_the_filter_column_when_set(self):
        lab = SimpleNamespace(
            ordered_date=date(2023, 2, 3), created_at=datetime(2024, 5, 1)
        )
        assert _service()._get_date_field(lab, "lab_results") == date(2023, 2, 3)

    def test_categories_without_a_clinical_date_show_created_at(self):
        created = datetime(2024, 5, 1)
        record = SimpleNamespace(created_at=created)
        assert _service()._get_date_field(record, "practitioners") == created

    @pytest.mark.parametrize("category", sorted(CustomReportService.CATEGORY_MODELS))
    def test_every_category_has_a_usable_date_column(self, category):
        model = CustomReportService.CATEGORY_MODELS[category]
        column = CustomReportService.CATEGORY_DATE_FIELDS.get(category, "created_at")
        assert column in model.__table__.columns
