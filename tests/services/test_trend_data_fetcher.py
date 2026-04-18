"""
Tests for TrendDataFetcher service — specifically unit-scoped lab-test trends
used by the custom-reports feature. Ensures the same analyte recorded in
different units (e.g. Calcium mg/L vs mmol/L) is never merged into one series.
"""

from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.crud.lab_result import lab_result as lab_result_crud
from app.crud.lab_test_component import lab_test_component as lab_test_component_crud
from app.crud.patient import patient as patient_crud
from app.schemas.lab_result import LabResultCreate
from app.schemas.lab_test_component import LabTestComponentCreate
from app.schemas.patient import PatientCreate
from app.services.trend_data_fetcher import TrendDataFetcher


@pytest.fixture
def test_patient(db_session: Session, test_user):
    return patient_crud.create_for_user(
        db_session,
        user_id=test_user.id,
        patient_data=PatientCreate(
            first_name="Trend",
            last_name="Fetcher",
            birth_date=date(1980, 1, 1),
            gender="F",
            address="Fetcher Lane",
        ),
    )


@pytest.fixture
def seeded_multi_unit(db_session: Session, test_patient):
    """Seed Calcium readings in two units across two lab results."""
    lab1 = lab_result_crud.create(
        db_session,
        obj_in=LabResultCreate(
            patient_id=test_patient.id,
            test_name="Chem A",
            test_category="blood work",
            status="completed",
            completed_date=date(2026, 1, 1),
        ),
    )
    lab2 = lab_result_crud.create(
        db_session,
        obj_in=LabResultCreate(
            patient_id=test_patient.id,
            test_name="Chem B",
            test_category="blood work",
            status="completed",
            completed_date=date(2026, 2, 1),
        ),
    )
    for lab_id, value, unit in [
        (lab1.id, 97.0, "mg/L"),
        (lab1.id, 2.43, "mmol/L"),
        (lab2.id, 100.0, "mg/L"),
        (lab2.id, 2.50, "mmol/L"),
    ]:
        lab_test_component_crud.create(
            db_session,
            obj_in=LabTestComponentCreate(
                lab_result_id=lab_id,
                test_name="Calcium",
                value=value,
                unit=unit,
            ),
        )
    return test_patient


class TestFetchLabTestTrend:
    def test_unit_filter_returns_only_matching_unit(
        self, db_session: Session, seeded_multi_unit
    ):
        fetcher = TrendDataFetcher(db_session)
        result = fetcher.fetch_lab_test_trend(
            patient_id=seeded_multi_unit.id,
            test_name="Calcium",
            unit="mg/L",
        )
        assert result["unit"] == "mg/L"
        assert sorted(result["values"]) == [97.0, 100.0]
        # Display name embeds the unit so PDF titles can distinguish series.
        assert "mg/L" in result["display_name"]
        assert result["statistics"]["count"] == 2

    def test_unit_filter_second_unit_independent(
        self, db_session: Session, seeded_multi_unit
    ):
        fetcher = TrendDataFetcher(db_session)
        result = fetcher.fetch_lab_test_trend(
            patient_id=seeded_multi_unit.id,
            test_name="Calcium",
            unit="mmol/L",
        )
        assert result["unit"] == "mmol/L"
        assert sorted(result["values"]) == [2.43, 2.50]

    def test_legacy_no_unit_merges_all(self, db_session: Session, seeded_multi_unit):
        """Passing unit=None preserves the pre-fix merged behavior for legacy
        template callers — rather than silently breaking saved reports."""
        fetcher = TrendDataFetcher(db_session)
        result = fetcher.fetch_lab_test_trend(
            patient_id=seeded_multi_unit.id,
            test_name="Calcium",
        )
        assert result["statistics"]["count"] == 4


class TestGetAvailableLabTestNames:
    def test_returns_one_entry_per_unit(self, db_session: Session, seeded_multi_unit):
        fetcher = TrendDataFetcher(db_session)
        available = fetcher.get_available_lab_test_names(
            patient_id=seeded_multi_unit.id
        )
        calciums = [a for a in available if a["test_name"].lower() == "calcium"]
        assert len(calciums) == 2
        units = {c["unit"] for c in calciums}
        assert units == {"mg/L", "mmol/L"}
        counts = {c["unit"]: c["count"] for c in calciums}
        assert counts["mg/L"] == 2
        assert counts["mmol/L"] == 2


class TestCountLabTestRecords:
    def test_count_with_unit_filter(self, db_session: Session, seeded_multi_unit):
        fetcher = TrendDataFetcher(db_session)
        assert (
            fetcher.count_lab_test_records(
                patient_id=seeded_multi_unit.id,
                test_name="Calcium",
                unit="mg/L",
            )
            == 2
        )
        assert (
            fetcher.count_lab_test_records(
                patient_id=seeded_multi_unit.id,
                test_name="Calcium",
                unit="mmol/L",
            )
            == 2
        )

    def test_count_without_unit_is_legacy_total(
        self, db_session: Session, seeded_multi_unit
    ):
        fetcher = TrendDataFetcher(db_session)
        assert (
            fetcher.count_lab_test_records(
                patient_id=seeded_multi_unit.id,
                test_name="Calcium",
            )
            == 4
        )
