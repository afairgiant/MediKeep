"""
Tests for ActivityLog CRUD operations.
"""
import pytest
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session

from app.crud.activity_log import activity_log as activity_log_crud
from app.crud.patient import patient as patient_crud
from app.models.activity_log import ActivityLog, ActionType, EntityType
from app.schemas.patient import PatientCreate


class TestActivityLogCRUD:
    """Test ActivityLog CRUD operations."""

    @pytest.fixture
    def test_patient(self, db_session: Session, test_user):
        """Create a test patient for activity log tests."""
        patient_data = PatientCreate(
            first_name="John",
            last_name="Doe",
            birth_date=date(1990, 1, 1),
            gender="M",
            address="123 Main St"
        )
        return patient_crud.create_for_user(
            db_session, user_id=test_user.id, patient_data=patient_data
        )

    def test_log_activity(self, db_session: Session, test_user, test_patient):
        """Test logging a new activity."""
        activity = activity_log_crud.log_activity(
            db_session,
            action=ActionType.CREATED,
            entity_type=EntityType.MEDICATION,
            description="Created new medication record",
            user_id=test_user.id,
            patient_id=test_patient.id,
            entity_id=123
        )

        assert activity is not None
        assert activity.action == ActionType.CREATED
        assert activity.entity_type == EntityType.MEDICATION
        assert activity.description == "Created new medication record"
        assert activity.user_id == test_user.id
        assert activity.patient_id == test_patient.id
        assert activity.entity_id == 123
        assert activity.timestamp is not None

    def test_log_activity_with_metadata(self, db_session: Session, test_user):
        """Test logging activity with metadata."""
        metadata = {"old_value": "10mg", "new_value": "20mg", "field": "dosage"}

        activity = activity_log_crud.log_activity(
            db_session,
            action=ActionType.UPDATED,
            entity_type=EntityType.MEDICATION,
            description="Updated medication dosage",
            user_id=test_user.id,
            metadata=metadata,
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0"
        )

        assert activity is not None
        assert activity.ip_address == "192.168.1.1"
        assert activity.user_agent == "Mozilla/5.0"

    def test_get_by_user(self, db_session: Session, test_user, test_patient):
        """Test getting activities by user."""
        # Create multiple activities for the user
        for i in range(5):
            activity_log_crud.log_activity(
                db_session,
                action=ActionType.VIEWED,
                entity_type=EntityType.PATIENT,
                description=f"Viewed patient record {i+1}",
                user_id=test_user.id,
                patient_id=test_patient.id
            )

        activities = activity_log_crud.get_by_user(
            db_session, user_id=test_user.id
        )

        assert len(activities) == 5
        assert all(a.user_id == test_user.id for a in activities)

    def test_get_by_user_with_pagination(self, db_session: Session, test_user):
        """Test getting activities by user with pagination."""
        # Create 10 activities
        for i in range(10):
            activity_log_crud.log_activity(
                db_session,
                action=ActionType.VIEWED,
                entity_type=EntityType.PATIENT,
                description=f"Activity {i+1}",
                user_id=test_user.id
            )

        # Get first page
        first_page = activity_log_crud.get_by_user(
            db_session, user_id=test_user.id, skip=0, limit=5
        )
        assert len(first_page) == 5

        # Get second page
        second_page = activity_log_crud.get_by_user(
            db_session, user_id=test_user.id, skip=5, limit=5
        )
        assert len(second_page) == 5

        # Ensure no overlap
        first_ids = {a.id for a in first_page}
        second_ids = {a.id for a in second_page}
        assert first_ids.isdisjoint(second_ids)

    def test_get_by_patient(self, db_session: Session, test_user, test_patient):
        """Test getting activities by patient."""
        # Create activities for the patient
        actions = [ActionType.CREATED, ActionType.VIEWED, ActionType.UPDATED]
        for action in actions:
            activity_log_crud.log_activity(
                db_session,
                action=action,
                entity_type=EntityType.MEDICATION,
                description=f"Medication {action}",
                user_id=test_user.id,
                patient_id=test_patient.id
            )

        activities = activity_log_crud.get_by_patient(
            db_session, patient_id=test_patient.id
        )

        assert len(activities) == 3
        assert all(a.patient_id == test_patient.id for a in activities)

    def test_get_recent_activity(self, db_session: Session, test_user):
        """Test getting recent system-wide activity."""
        # Create activities
        for i in range(3):
            activity_log_crud.log_activity(
                db_session,
                action=ActionType.CREATED,
                entity_type=EntityType.PATIENT,
                description=f"Created patient {i+1}",
                user_id=test_user.id
            )

        recent = activity_log_crud.get_recent_activity(
            db_session, hours=24, limit=10
        )

        assert len(recent) == 3
        # Should be ordered by timestamp descending
        assert recent[0].timestamp >= recent[1].timestamp

    def test_get_by_entity(self, db_session: Session, test_user, test_patient):
        """Test getting activities for a specific entity."""
        # Create activities for specific medication (entity_id=42)
        entity_id = 42
        for action in [ActionType.CREATED, ActionType.UPDATED, ActionType.VIEWED]:
            activity_log_crud.log_activity(
                db_session,
                action=action,
                entity_type=EntityType.MEDICATION,
                description=f"Medication action: {action}",
                user_id=test_user.id,
                patient_id=test_patient.id,
                entity_id=entity_id
            )

        # Create activity for different entity
        activity_log_crud.log_activity(
            db_session,
            action=ActionType.CREATED,
            entity_type=EntityType.MEDICATION,
            description="Different medication",
            user_id=test_user.id,
            entity_id=99
        )

        activities = activity_log_crud.get_by_entity(
            db_session, entity_type=EntityType.MEDICATION, entity_id=entity_id
        )

        assert len(activities) == 3
        assert all(a.entity_id == entity_id for a in activities)

    def test_get_by_action_type(self, db_session: Session, test_user):
        """Test getting activities by action type."""
        # Create different types of activities
        activity_log_crud.log_activity(
            db_session,
            action=ActionType.CREATED,
            entity_type=EntityType.PATIENT,
            description="Created patient",
            user_id=test_user.id
        )
        activity_log_crud.log_activity(
            db_session,
            action=ActionType.DELETED,
            entity_type=EntityType.MEDICATION,
            description="Deleted medication",
            user_id=test_user.id
        )
        activity_log_crud.log_activity(
            db_session,
            action=ActionType.DELETED,
            entity_type=EntityType.ALLERGY,
            description="Deleted allergy",
            user_id=test_user.id
        )

        # Get all deletions
        deletions = activity_log_crud.get_by_action_type(
            db_session, action=ActionType.DELETED
        )

        assert len(deletions) == 2
        assert all(a.action == ActionType.DELETED for a in deletions)

    def test_get_by_action_type_for_user(self, db_session: Session, test_user, test_admin_user):
        """Test getting activities by action type filtered by user."""
        # Create activities for different users
        activity_log_crud.log_activity(
            db_session,
            action=ActionType.LOGIN,
            entity_type=EntityType.USER,
            description="User logged in",
            user_id=test_user.id
        )
        activity_log_crud.log_activity(
            db_session,
            action=ActionType.LOGIN,
            entity_type=EntityType.USER,
            description="Admin logged in",
            user_id=test_admin_user.id
        )

        # Get logins for specific user
        user_logins = activity_log_crud.get_by_action_type(
            db_session, action=ActionType.LOGIN, user_id=test_user.id
        )

        assert len(user_logins) == 1
        assert user_logins[0].user_id == test_user.id

    def test_search_activities_by_user(self, db_session: Session, test_user, test_admin_user):
        """Test searching activities with user filter."""
        # Create activities for different users
        for i in range(3):
            activity_log_crud.log_activity(
                db_session,
                action=ActionType.VIEWED,
                entity_type=EntityType.PATIENT,
                description=f"User activity {i+1}",
                user_id=test_user.id
            )

        for i in range(2):
            activity_log_crud.log_activity(
                db_session,
                action=ActionType.VIEWED,
                entity_type=EntityType.PATIENT,
                description=f"Admin activity {i+1}",
                user_id=test_admin_user.id
            )

        results = activity_log_crud.search_activities(
            db_session, user_id=test_user.id
        )

        assert len(results) == 3
        assert all(r.user_id == test_user.id for r in results)

    def test_search_activities_by_entity_type(self, db_session: Session, test_user):
        """Test searching activities with entity type filter."""
        activity_log_crud.log_activity(
            db_session,
            action=ActionType.CREATED,
            entity_type=EntityType.MEDICATION,
            description="Created medication",
            user_id=test_user.id
        )
        activity_log_crud.log_activity(
            db_session,
            action=ActionType.CREATED,
            entity_type=EntityType.ALLERGY,
            description="Created allergy",
            user_id=test_user.id
        )

        results = activity_log_crud.search_activities(
            db_session, entity_type=EntityType.MEDICATION
        )

        assert len(results) == 1
        assert results[0].entity_type == EntityType.MEDICATION

    def test_search_activities_by_description(self, db_session: Session, test_user):
        """Test searching activities by description text."""
        activity_log_crud.log_activity(
            db_session,
            action=ActionType.CREATED,
            entity_type=EntityType.MEDICATION,
            description="Created blood pressure medication",
            user_id=test_user.id
        )
        activity_log_crud.log_activity(
            db_session,
            action=ActionType.CREATED,
            entity_type=EntityType.MEDICATION,
            description="Created cholesterol medication",
            user_id=test_user.id
        )
        activity_log_crud.log_activity(
            db_session,
            action=ActionType.CREATED,
            entity_type=EntityType.ALLERGY,
            description="Created peanut allergy",
            user_id=test_user.id
        )

        results = activity_log_crud.search_activities(
            db_session, description_search="medication"
        )

        assert len(results) == 2

    def test_search_activities_by_date_range(self, db_session: Session, test_user):
        """Test searching activities within date range."""
        now = datetime.utcnow()

        # Create activity
        activity_log_crud.log_activity(
            db_session,
            action=ActionType.CREATED,
            entity_type=EntityType.PATIENT,
            description="Created patient",
            user_id=test_user.id
        )

        # Search within current time range
        results = activity_log_crud.search_activities(
            db_session,
            start_date=now - timedelta(hours=1),
            end_date=now + timedelta(hours=1)
        )

        assert len(results) >= 1

    def test_get_activity_summary(self, db_session: Session, test_user, test_patient):
        """Test getting activity summary statistics."""
        # Create various activities
        activities_data = [
            (ActionType.CREATED, EntityType.MEDICATION),
            (ActionType.CREATED, EntityType.ALLERGY),
            (ActionType.UPDATED, EntityType.MEDICATION),
            (ActionType.VIEWED, EntityType.PATIENT),
            (ActionType.DELETED, EntityType.ALLERGY),
        ]

        for action, entity_type in activities_data:
            activity_log_crud.log_activity(
                db_session,
                action=action,
                entity_type=entity_type,
                description=f"{action} {entity_type}",
                user_id=test_user.id,
                patient_id=test_patient.id
            )

        summary = activity_log_crud.get_activity_summary(
            db_session, user_id=test_user.id, days=30
        )

        assert summary["total_activities"] == 5
        assert summary["days_covered"] == 30
        assert ActionType.CREATED in summary["actions"]
        assert summary["actions"][ActionType.CREATED] == 2
        assert EntityType.MEDICATION in summary["entities"]
        assert summary["entities"][EntityType.MEDICATION] == 2

    def test_get_activity_summary_empty(self, db_session: Session, test_user):
        """Test activity summary with no activities."""
        summary = activity_log_crud.get_activity_summary(
            db_session, user_id=test_user.id, days=30
        )

        assert summary["total_activities"] == 0
        assert summary["actions"] == {}
        assert summary["entities"] == {}

    def test_activity_ordering(self, db_session: Session, test_user):
        """Test that activities are ordered by timestamp descending."""
        # Create activities with slight delays (timestamps will differ)
        for i in range(3):
            activity_log_crud.log_activity(
                db_session,
                action=ActionType.VIEWED,
                entity_type=EntityType.PATIENT,
                description=f"Activity {i+1}",
                user_id=test_user.id
            )

        activities = activity_log_crud.get_by_user(
            db_session, user_id=test_user.id
        )

        # Should be newest first
        for i in range(len(activities) - 1):
            assert activities[i].timestamp >= activities[i + 1].timestamp

    def test_log_activity_minimal(self, db_session: Session):
        """Test logging activity with minimal required fields."""
        activity = activity_log_crud.log_activity(
            db_session,
            action=ActionType.CREATED,
            entity_type=EntityType.SYSTEM,
            description="System event"
        )

        assert activity is not None
        assert activity.user_id is None
        assert activity.patient_id is None
        assert activity.entity_id is None
        assert activity.action == ActionType.CREATED

    def test_multiple_patients_isolation(self, db_session: Session, test_user, test_admin_user):
        """Test that patient activities are properly isolated."""
        # Create two patients (each under a different user)
        patient1_data = PatientCreate(
            first_name="Patient", last_name="One",
            birth_date=date(1990, 1, 1), gender="M", address="123 St"
        )
        patient2_data = PatientCreate(
            first_name="Patient", last_name="Two",
            birth_date=date(1985, 1, 1), gender="F", address="456 Ave"
        )

        patient1 = patient_crud.create_for_user(
            db_session, user_id=test_user.id, patient_data=patient1_data
        )
        patient2 = patient_crud.create_for_user(
            db_session, user_id=test_admin_user.id, patient_data=patient2_data
        )

        # Log activities for each patient
        for i in range(3):
            activity_log_crud.log_activity(
                db_session,
                action=ActionType.VIEWED,
                entity_type=EntityType.PATIENT,
                description=f"Patient 1 activity {i+1}",
                user_id=test_user.id,
                patient_id=patient1.id
            )

        for i in range(2):
            activity_log_crud.log_activity(
                db_session,
                action=ActionType.VIEWED,
                entity_type=EntityType.PATIENT,
                description=f"Patient 2 activity {i+1}",
                user_id=test_user.id,
                patient_id=patient2.id
            )

        patient1_activities = activity_log_crud.get_by_patient(
            db_session, patient_id=patient1.id
        )
        patient2_activities = activity_log_crud.get_by_patient(
            db_session, patient_id=patient2.id
        )

        assert len(patient1_activities) == 3
        assert len(patient2_activities) == 2
        assert all(a.patient_id == patient1.id for a in patient1_activities)
        assert all(a.patient_id == patient2.id for a in patient2_activities)
