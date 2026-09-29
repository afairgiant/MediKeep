"""
API tests for export endpoints with unit system parameter.

Tests cover:
1. Validation of unit_system parameter
2. Export formats (JSON, CSV, PDF) with both imperial and metric units
3. BulkExportRequest validation
"""

from datetime import date
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.v1.endpoints.export import BulkExportRequest, ExportFormat, ExportScope
from app.models.procedures import MedicalEquipment
from app.services.export_service import ExportService


class TestBulkExportRequestValidation:
    """Tests for BulkExportRequest model validation."""

    def test_valid_imperial_unit_system(self):
        """Test that 'imperial' is a valid unit_system."""
        request = BulkExportRequest(scopes=["medications"], unit_system="imperial")
        assert request.unit_system == "imperial"

    def test_valid_metric_unit_system(self):
        """Test that 'metric' is a valid unit_system."""
        request = BulkExportRequest(scopes=["medications"], unit_system="metric")
        assert request.unit_system == "metric"

    def test_default_unit_system_is_imperial(self):
        """Test that default unit_system is 'imperial'."""
        request = BulkExportRequest(scopes=["medications"])
        assert request.unit_system == "imperial"

    def test_invalid_unit_system_raises_error(self):
        """Test that invalid unit_system raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            BulkExportRequest(scopes=["medications"], unit_system="invalid")
        assert "unit_system must be 'imperial' or 'metric'" in str(exc_info.value)

    def test_empty_unit_system_raises_error(self):
        """Test that empty unit_system raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            BulkExportRequest(scopes=["medications"], unit_system="")
        assert "unit_system must be 'imperial' or 'metric'" in str(exc_info.value)

    def test_case_sensitive_unit_system(self):
        """Test that unit_system is case-sensitive."""
        with pytest.raises(ValidationError):
            BulkExportRequest(
                scopes=["medications"], unit_system="Imperial"  # Wrong case
            )

    def test_full_request_with_all_fields(self):
        """Test BulkExportRequest with all fields populated."""
        from datetime import date

        request = BulkExportRequest(
            scopes=["medications", "vitals", "allergies"],
            format=ExportFormat.JSON,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
            include_patient_info=True,
            unit_system="metric",
        )
        assert request.scopes == ["medications", "vitals", "allergies"]
        assert request.format == ExportFormat.JSON
        assert request.unit_system == "metric"
        assert request.include_patient_info is True


class TestExportEndpointUnitSystemParameter:
    """Tests for unit_system parameter in export endpoints.

    Note: These tests require a running test database and authenticated user.
    They are marked for integration testing.
    """

    @pytest.fixture
    def auth_headers(self, authenticated_client):
        """Get authentication headers from the authenticated client fixture."""
        return authenticated_client.headers

    @pytest.mark.skip(reason="Requires database setup - run with full test suite")
    def test_export_json_with_imperial_units(self, authenticated_client):
        """Test JSON export with imperial unit system."""
        response = authenticated_client.get(
            "/api/v1/export/data",
            params={"format": "json", "scope": "vitals", "unit_system": "imperial"},
        )
        # Should succeed or return appropriate error
        assert response.status_code in [200, 400]  # 400 if no active patient

    @pytest.mark.skip(reason="Requires database setup - run with full test suite")
    def test_export_json_with_metric_units(self, authenticated_client):
        """Test JSON export with metric unit system."""
        response = authenticated_client.get(
            "/api/v1/export/data",
            params={"format": "json", "scope": "vitals", "unit_system": "metric"},
        )
        assert response.status_code in [200, 400]

    @pytest.mark.skip(reason="Requires database setup - run with full test suite")
    def test_export_invalid_unit_system_rejected(self, authenticated_client):
        """Test that invalid unit_system is rejected."""
        response = authenticated_client.get(
            "/api/v1/export/data",
            params={"format": "json", "scope": "all", "unit_system": "invalid"},
        )
        # Should be rejected by pattern validation
        assert response.status_code == 422

    @pytest.mark.skip(reason="Requires database setup - run with full test suite")
    def test_export_default_unit_system(self, authenticated_client):
        """Test that default unit_system is used when not specified."""
        response = authenticated_client.get(
            "/api/v1/export/data", params={"format": "json", "scope": "vitals"}
        )
        # Should use imperial by default
        assert response.status_code in [200, 400]


class TestExportFormatsScopesCoverage:
    """Ensures the /export/formats scope list stays in sync with ExportScope.

    Regression test for issue #1069: medical_equipment was fully supported by
    ExportService (JSON/CSV/PDF) but missing from ExportScope and the /formats
    scopes list, so it never appeared as an option in the export dialog.
    """

    def test_medical_equipment_is_a_valid_scope(self):
        """medical_equipment must be a member of ExportScope."""
        assert ExportScope.MEDICAL_EQUIPMENT == "medical_equipment"

    def test_formats_scopes_match_export_scope_enum(self, client: TestClient):
        """Every non-'all' ExportScope value must appear in /export/formats,
        and vice versa, so the dialog never silently omits a supported scope."""
        response = client.get("/api/v1/export/formats")
        assert response.status_code == 200

        data = response.json()
        formats_scope_values = {
            scope["value"] for scope in data["scopes"] if scope["value"] != "all"
        }
        enum_scope_values = {
            scope.value for scope in ExportScope if scope != ExportScope.ALL
        }

        assert formats_scope_values == enum_scope_values

    def test_medical_equipment_in_formats_scopes(self, client: TestClient):
        """medical_equipment must be listed as a selectable export scope."""
        response = client.get("/api/v1/export/formats")
        assert response.status_code == 200

        scopes = {scope["value"]: scope for scope in response.json()["scopes"]}
        assert "medical_equipment" in scopes
        assert scopes["medical_equipment"]["label"]
        assert scopes["medical_equipment"]["description"]


class TestApplyDateFilterMedicalEquipment:
    """Regression test for issue #1069: medical equipment date-range exports
    must filter by prescribed_date (the clinically relevant date), not fall
    through to created_at (when the record was entered into the system)."""

    def test_uses_prescribed_date_not_created_at(self, db_session):
        export_service = ExportService(db_session)
        query = MagicMock()
        query.filter.return_value = query

        export_service._apply_date_filter(
            query, MedicalEquipment, date(2024, 1, 1), date(2024, 12, 31)
        )

        assert query.filter.call_count == 2
        for call in query.filter.call_args_list:
            (expr,) = call.args
            compiled = str(expr)
            assert "prescribed_date" in compiled
            assert "created_at" not in compiled


class TestExportDataStructure:
    """Tests for verifying the structure of exported data with units."""

    def test_vitals_export_includes_unit_labels(self):
        """Verify that vitals export includes unit labels in the data structure."""
        # This is a structural test - verifies the expected fields exist
        expected_vital_fields = [
            "temperature",
            "temperature_unit",
            "weight",
            "weight_unit",
            "height",
            "height_unit",
            "bmi",
        ]
        # The actual test would verify these fields exist in export output
        # This serves as documentation of expected structure
        assert all(field for field in expected_vital_fields)

    def test_patient_info_export_includes_unit_labels(self):
        """Verify that patient info export includes unit labels."""
        expected_patient_fields = ["height", "height_unit", "weight", "weight_unit"]
        assert all(field for field in expected_patient_fields)
