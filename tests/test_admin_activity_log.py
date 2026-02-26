"""
Tests for Admin Activity Log API endpoints.

Tests cover:
- GET /api/v1/admin/activity-log (paginated, filtered)
- GET /api/v1/admin/activity-log/export (CSV export)
- GET /api/v1/admin/activity-log/filters (filter options)
- Authorization (admin-only access)
"""

import csv
import io
from datetime import datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from app.models.activity_log import ActionType, ActivityLog, EntityType


@pytest.fixture
def sample_activities(db_session: Session, test_admin_user):
    """Create sample activity log entries for testing."""
    now = datetime.utcnow()
    activities = []

    for i in range(5):
        activity = ActivityLog(
            user_id=test_admin_user.id,
            action=ActionType.CREATED,
            entity_type=EntityType.PATIENT,
            entity_id=i + 1,
            description=f"Created patient record #{i + 1}",
            timestamp=now - timedelta(hours=i),
            ip_address="127.0.0.1",
        )
        db_session.add(activity)
        activities.append(activity)

    # Add a different action type for filter testing
    delete_activity = ActivityLog(
        user_id=test_admin_user.id,
        action=ActionType.DELETED,
        entity_type=EntityType.MEDICATION,
        entity_id=100,
        description="Deleted medication record",
        timestamp=now - timedelta(hours=10),
        ip_address="192.168.1.1",
    )
    db_session.add(delete_activity)
    activities.append(delete_activity)

    # Add a login activity
    login_activity = ActivityLog(
        user_id=test_admin_user.id,
        action=ActionType.LOGIN,
        entity_type=EntityType.USER,
        description="User logged in",
        timestamp=now - timedelta(days=2),
        ip_address="10.0.0.1",
    )
    db_session.add(login_activity)
    activities.append(login_activity)

    db_session.commit()
    for a in activities:
        db_session.refresh(a)
    return activities


class TestGetActivityLog:
    """Tests for GET /api/v1/admin/activity-log"""

    def test_returns_paginated_results(self, admin_client, sample_activities):
        response = admin_client.get("/api/v1/admin/activity-log")
        assert response.status_code == 200

        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "per_page" in data
        assert "total_pages" in data
        assert data["total"] == 7
        assert data["page"] == 1
        assert len(data["items"]) == 7

    def test_pagination_params(self, admin_client, sample_activities):
        response = admin_client.get("/api/v1/admin/activity-log?page=1&per_page=3")
        assert response.status_code == 200

        data = response.json()
        assert len(data["items"]) == 3
        assert data["total"] == 7
        assert data["total_pages"] == 3

    def test_filter_by_action(self, admin_client, sample_activities):
        response = admin_client.get("/api/v1/admin/activity-log?action=deleted")
        assert response.status_code == 200

        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["action"] == "deleted"

    def test_filter_by_entity_type(self, admin_client, sample_activities):
        response = admin_client.get("/api/v1/admin/activity-log?entity_type=patient")
        assert response.status_code == 200

        data = response.json()
        assert data["total"] == 5
        for item in data["items"]:
            assert item["entity_type"] == "patient"

    def test_filter_by_search(self, admin_client, sample_activities):
        response = admin_client.get("/api/v1/admin/activity-log?search=medication")
        assert response.status_code == 200

        data = response.json()
        assert data["total"] == 1
        assert "medication" in data["items"][0]["description"].lower()

    def test_filter_by_user_id(self, admin_client, sample_activities, test_admin_user):
        response = admin_client.get(f"/api/v1/admin/activity-log?user_id={test_admin_user.id}")
        assert response.status_code == 200

        data = response.json()
        assert data["total"] == 7

    def test_filter_by_date_range(self, admin_client, sample_activities):
        now = datetime.utcnow()
        start = (now - timedelta(hours=6)).isoformat()
        end = now.isoformat()

        response = admin_client.get(
            f"/api/v1/admin/activity-log?start_date={start}&end_date={end}"
        )
        assert response.status_code == 200

        data = response.json()
        # Should include the 5 patient entries (0-5 hours ago) but not the
        # deleted medication (10 hours ago) or login (2 days ago)
        assert data["total"] == 5

    def test_items_have_expected_fields(self, admin_client, sample_activities):
        response = admin_client.get("/api/v1/admin/activity-log")
        assert response.status_code == 200

        item = response.json()["items"][0]
        assert "id" in item
        assert "user_id" in item
        assert "username" in item
        assert "action" in item
        assert "entity_type" in item
        assert "entity_type_display" in item
        assert "description" in item
        assert "timestamp" in item

    def test_empty_results(self, admin_client):
        response = admin_client.get("/api/v1/admin/activity-log")
        assert response.status_code == 200

        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []


class TestExportActivityLog:
    """Tests for GET /api/v1/admin/activity-log/export"""

    def test_returns_csv(self, admin_client, sample_activities):
        response = admin_client.get("/api/v1/admin/activity-log/export")
        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]
        assert "attachment" in response.headers.get("content-disposition", "")

    def test_csv_has_correct_headers(self, admin_client, sample_activities):
        response = admin_client.get("/api/v1/admin/activity-log/export")
        content = response.text
        reader = csv.reader(io.StringIO(content))
        headers = next(reader)
        assert headers == [
            "Timestamp", "User", "Action", "Entity Type",
            "Entity ID", "Description", "IP Address",
        ]

    def test_csv_has_data_rows(self, admin_client, sample_activities):
        response = admin_client.get("/api/v1/admin/activity-log/export")
        content = response.text
        reader = csv.reader(io.StringIO(content))
        rows = list(reader)
        # Header + 7 data rows
        assert len(rows) == 8

    def test_export_respects_filters(self, admin_client, sample_activities):
        response = admin_client.get("/api/v1/admin/activity-log/export?action=deleted")
        content = response.text
        reader = csv.reader(io.StringIO(content))
        rows = list(reader)
        # Header + 1 filtered row
        assert len(rows) == 2


class TestGetActivityLogFilters:
    """Tests for GET /api/v1/admin/activity-log/filters"""

    def test_returns_filter_options(self, admin_client, sample_activities):
        response = admin_client.get("/api/v1/admin/activity-log/filters")
        assert response.status_code == 200

        data = response.json()
        assert "actions" in data
        assert "entity_types" in data
        assert "users" in data

    def test_actions_include_all_types(self, admin_client, sample_activities):
        response = admin_client.get("/api/v1/admin/activity-log/filters")
        data = response.json()

        action_values = [a["value"] for a in data["actions"]]
        assert "created" in action_values
        assert "deleted" in action_values
        assert "login" in action_values

    def test_entity_types_have_display_names(self, admin_client, sample_activities):
        response = admin_client.get("/api/v1/admin/activity-log/filters")
        data = response.json()

        entity_map = {et["value"]: et["label"] for et in data["entity_types"]}
        assert entity_map["patient"] == "Patient"
        assert entity_map["lab_result"] == "Lab Result"

    def test_users_include_active_users(self, admin_client, sample_activities, test_admin_user):
        response = admin_client.get("/api/v1/admin/activity-log/filters")
        data = response.json()

        user_ids = [u["value"] for u in data["users"]]
        assert test_admin_user.id in user_ids


class TestActivityLogAuth:
    """Tests for authorization on activity log endpoints."""

    def test_non_admin_gets_403_on_list(self, authenticated_client):
        response = authenticated_client.get("/api/v1/admin/activity-log")
        assert response.status_code == 403

    def test_non_admin_gets_403_on_export(self, authenticated_client):
        response = authenticated_client.get("/api/v1/admin/activity-log/export")
        assert response.status_code == 403

    def test_non_admin_gets_403_on_filters(self, authenticated_client):
        response = authenticated_client.get("/api/v1/admin/activity-log/filters")
        assert response.status_code == 403

    def test_unauthenticated_gets_401_on_list(self, client):
        response = client.get("/api/v1/admin/activity-log")
        assert response.status_code == 401
