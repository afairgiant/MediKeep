"""
Tests for Admin Model Export endpoint.

Tests cover:
- GET /api/v1/admin/models/{model_name}/export (CSV export)
- CSV headers match FIELD_DISPLAY_CONFIG list_fields
- Search filtering in export
- Invalid model returns 404
- Non-admin returns 403
"""

import csv
import io

import pytest
from sqlalchemy.orm import Session

from app.models.practice import Pharmacy


@pytest.fixture
def sample_pharmacies(db_session: Session):
    """Create sample pharmacy records for testing."""
    pharmacies = []
    for i in range(3):
        p = Pharmacy(
            name=f"Test Pharmacy {i + 1}",
            brand="TestBrand" if i < 2 else "OtherBrand",
            city=f"City{i + 1}",
            state="CA",
            phone_number=f"555-000{i + 1}",
        )
        db_session.add(p)
        pharmacies.append(p)
    db_session.commit()
    for p in pharmacies:
        db_session.refresh(p)
    return pharmacies


class TestModelExport:
    """Tests for GET /api/v1/admin/models/{model_name}/export"""

    BASE_URL = "/api/v1/admin/models"

    def test_returns_csv(self, admin_client, sample_pharmacies):
        response = admin_client.get(f"{self.BASE_URL}/pharmacy/export")
        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]
        assert "attachment" in response.headers.get("content-disposition", "")
        assert "pharmacy_export.csv" in response.headers["content-disposition"]

    def test_csv_headers_include_all_columns(self, admin_client, sample_pharmacies):
        response = admin_client.get(f"{self.BASE_URL}/pharmacy/export")
        content = response.text
        reader = csv.reader(io.StringIO(content))
        headers = next(reader)
        # Export should include all model columns, not just list_fields
        assert "Id" in headers
        assert "Name" in headers
        assert "Brand" in headers
        assert "City" in headers
        assert "State" in headers
        assert "Phone Number" in headers
        # Should also include columns NOT in list_fields
        assert "Street Address" in headers
        assert "Zip Code" in headers
        assert "Website" in headers

    def test_csv_has_data_rows(self, admin_client, sample_pharmacies):
        response = admin_client.get(f"{self.BASE_URL}/pharmacy/export")
        content = response.text
        reader = csv.reader(io.StringIO(content))
        rows = list(reader)
        # Header + 3 data rows
        assert len(rows) == 4

    def test_csv_data_values(self, admin_client, sample_pharmacies):
        response = admin_client.get(f"{self.BASE_URL}/pharmacy/export")
        content = response.text
        reader = csv.reader(io.StringIO(content))
        headers = next(reader)
        name_idx = headers.index("Name")
        rows = list(reader)
        names = [row[name_idx] for row in rows]
        assert "Test Pharmacy 1" in names
        assert "Test Pharmacy 2" in names
        assert "Test Pharmacy 3" in names

    def test_search_filtering(self, admin_client, sample_pharmacies):
        response = admin_client.get(
            f"{self.BASE_URL}/pharmacy/export", params={"search": "Test Pharmacy 1"}
        )
        assert response.status_code == 200
        content = response.text
        reader = csv.reader(io.StringIO(content))
        rows = list(reader)
        # Header + filtered results (at least 1 matching row)
        assert len(rows) >= 2

    def test_invalid_model_returns_404(self, admin_client):
        response = admin_client.get(f"{self.BASE_URL}/nonexistent_model/export")
        assert response.status_code == 404

    def test_non_admin_returns_403(self, authenticated_client):
        response = authenticated_client.get(f"{self.BASE_URL}/pharmacy/export")
        assert response.status_code == 403

    def test_unauthenticated_returns_401(self, client):
        response = client.get(f"{self.BASE_URL}/pharmacy/export")
        assert response.status_code == 401

    def test_empty_model_returns_header_only(self, admin_client):
        response = admin_client.get(f"{self.BASE_URL}/pharmacy/export")
        assert response.status_code == 200
        content = response.text
        reader = csv.reader(io.StringIO(content))
        rows = list(reader)
        # Header only, no data rows
        assert len(rows) == 1
