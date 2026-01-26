"""
Tests for Injury CRUD operations.
"""
import pytest
from datetime import date
from sqlalchemy.orm import Session

from app.crud.injury import injury as injury_crud
from app.crud.patient import patient as patient_crud
from app.models.models import Injury
from app.schemas.injury import InjuryCreate, InjuryUpdate
from app.schemas.patient import PatientCreate


class TestInjuryCRUD:
    """Test Injury CRUD operations."""

    @pytest.fixture
    def test_patient(self, db_session: Session, test_user):
        """Create a test patient for injury tests."""
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

    def test_create_injury(self, db_session: Session, test_patient):
        """Test creating an injury record."""
        injury_data = InjuryCreate(
            patient_id=test_patient.id,
            injury_name="Right Ankle Sprain",
            body_part="Ankle",
            laterality="right",
            date_of_injury=date(2025, 12, 30),
            mechanism="Fell while hiking",
            severity="moderate",
            status="active",
            treatment_received="RICE protocol",
            notes="Follow up in 2 weeks"
        )

        injury = injury_crud.create(db_session, obj_in=injury_data)

        assert injury is not None
        assert injury.injury_name == "Right Ankle Sprain"
        assert injury.body_part == "Ankle"
        assert injury.laterality == "right"
        assert injury.severity == "moderate"
        assert injury.patient_id == test_patient.id
        assert injury.status == "active"

    def test_get_by_patient(self, db_session: Session, test_patient):
        """Test getting injuries by patient."""
        # Create multiple injuries
        injuries_data = [
            InjuryCreate(
                patient_id=test_patient.id,
                injury_name="Wrist Sprain",
                body_part="Wrist",
                severity="mild",
                status="resolved"
            ),
            InjuryCreate(
                patient_id=test_patient.id,
                injury_name="Knee Injury",
                body_part="Knee",
                severity="moderate",
                status="active"
            )
        ]

        for injury_data in injuries_data:
            injury_crud.create(db_session, obj_in=injury_data)

        # Get injuries by patient
        injuries = injury_crud.get_by_patient(db_session, patient_id=test_patient.id)

        assert len(injuries) == 2
        injury_names = [i.injury_name for i in injuries]
        assert "Wrist Sprain" in injury_names
        assert "Knee Injury" in injury_names

    def test_get_active_injuries(self, db_session: Session, test_patient):
        """Test getting active injuries for a patient."""
        # Create active injury
        active_injury = InjuryCreate(
            patient_id=test_patient.id,
            injury_name="Active Back Strain",
            body_part="Back",
            severity="moderate",
            status="active"
        )

        # Create resolved injury
        resolved_injury = InjuryCreate(
            patient_id=test_patient.id,
            injury_name="Old Ankle Sprain",
            body_part="Ankle",
            severity="mild",
            status="resolved"
        )

        created_active = injury_crud.create(db_session, obj_in=active_injury)
        injury_crud.create(db_session, obj_in=resolved_injury)

        # Get active injuries
        active_injuries = injury_crud.get_active_injuries(
            db_session, patient_id=test_patient.id
        )

        assert len(active_injuries) == 1
        assert active_injuries[0].id == created_active.id
        assert active_injuries[0].injury_name == "Active Back Strain"
        assert active_injuries[0].status == "active"

    def test_get_by_status(self, db_session: Session, test_patient):
        """Test getting injuries by status."""
        # Create injuries with different statuses
        injuries_data = [
            InjuryCreate(
                patient_id=test_patient.id,
                injury_name="Active Injury",
                body_part="Arm",
                severity="moderate",
                status="active"
            ),
            InjuryCreate(
                patient_id=test_patient.id,
                injury_name="Healing Injury",
                body_part="Leg",
                severity="mild",
                status="healing"
            ),
            InjuryCreate(
                patient_id=test_patient.id,
                injury_name="Resolved Injury",
                body_part="Wrist",
                severity="mild",
                status="resolved"
            )
        ]

        for injury_data in injuries_data:
            injury_crud.create(db_session, obj_in=injury_data)

        # Get healing injuries
        healing_injuries = injury_crud.get_by_status(
            db_session, status="healing", patient_id=test_patient.id
        )

        assert len(healing_injuries) == 1
        assert healing_injuries[0].injury_name == "Healing Injury"
        assert healing_injuries[0].status == "healing"

    def test_get_by_body_part(self, db_session: Session, test_patient):
        """Test getting injuries by body part."""
        # Create injuries on different body parts
        injuries_data = [
            InjuryCreate(
                patient_id=test_patient.id,
                injury_name="Right Knee Sprain",
                body_part="Knee",
                laterality="right",
                severity="moderate",
                status="active"
            ),
            InjuryCreate(
                patient_id=test_patient.id,
                injury_name="Left Knee Contusion",
                body_part="Knee",
                laterality="left",
                severity="mild",
                status="active"
            ),
            InjuryCreate(
                patient_id=test_patient.id,
                injury_name="Wrist Fracture",
                body_part="Wrist",
                severity="severe",
                status="active"
            )
        ]

        for injury_data in injuries_data:
            injury_crud.create(db_session, obj_in=injury_data)

        # Get knee injuries
        knee_injuries = injury_crud.get_by_body_part(
            db_session, body_part="Knee", patient_id=test_patient.id
        )

        assert len(knee_injuries) == 2
        injury_names = [i.injury_name for i in knee_injuries]
        assert "Right Knee Sprain" in injury_names
        assert "Left Knee Contusion" in injury_names

    def test_update_injury(self, db_session: Session, test_patient):
        """Test updating an injury."""
        # Create injury
        injury_data = InjuryCreate(
            patient_id=test_patient.id,
            injury_name="Shoulder Strain",
            body_part="Shoulder",
            laterality="right",
            severity="mild",
            status="active"
        )

        created_injury = injury_crud.create(db_session, obj_in=injury_data)

        # Update injury
        update_data = InjuryUpdate(
            severity="moderate",
            status="healing",
            treatment_received="Physical therapy started",
            recovery_notes="Showing improvement after 2 weeks"
        )

        updated_injury = injury_crud.update(
            db_session, db_obj=created_injury, obj_in=update_data
        )

        assert updated_injury.severity == "moderate"
        assert updated_injury.status == "healing"
        assert updated_injury.treatment_received == "Physical therapy started"
        assert updated_injury.recovery_notes == "Showing improvement after 2 weeks"
        assert updated_injury.injury_name == "Shoulder Strain"  # Unchanged

    def test_delete_injury(self, db_session: Session, test_patient):
        """Test deleting an injury."""
        # Create injury
        injury_data = InjuryCreate(
            patient_id=test_patient.id,
            injury_name="Injury to Delete",
            body_part="Finger",
            severity="mild",
            status="resolved"
        )

        created_injury = injury_crud.create(db_session, obj_in=injury_data)
        injury_id = created_injury.id

        # Delete injury
        deleted_injury = injury_crud.delete(db_session, id=injury_id)

        assert deleted_injury is not None
        assert deleted_injury.id == injury_id

        # Verify injury is deleted
        retrieved_injury = injury_crud.get(db_session, id=injury_id)
        assert retrieved_injury is None

    def test_injury_with_all_fields(self, db_session: Session, test_patient):
        """Test creating injury with all optional fields."""
        injury_data = InjuryCreate(
            patient_id=test_patient.id,
            injury_name="Complete Injury Record",
            body_part="Lower Back",
            laterality="not_applicable",
            date_of_injury=date(2025, 11, 15),
            mechanism="Lifting heavy object improperly",
            severity="moderate",
            status="active",
            treatment_received="Rest, ice, physical therapy",
            recovery_notes="Initial assessment shows muscle strain",
            notes="Patient works in warehouse, may need work restrictions",
            tags=["work-related", "lifting", "back"]
        )

        injury = injury_crud.create(db_session, obj_in=injury_data)

        assert injury.injury_name == "Complete Injury Record"
        assert injury.body_part == "Lower Back"
        assert injury.laterality == "not_applicable"
        assert injury.date_of_injury == date(2025, 11, 15)
        assert injury.mechanism == "Lifting heavy object improperly"
        assert injury.severity == "moderate"
        assert injury.status == "active"
        assert injury.treatment_received == "Rest, ice, physical therapy"
        assert injury.recovery_notes == "Initial assessment shows muscle strain"
        assert injury.notes == "Patient works in warehouse, may need work restrictions"
        assert "work-related" in injury.tags

    def test_injury_status_values(self, db_session: Session, test_patient):
        """Test all valid injury status values."""
        statuses = ["active", "healing", "resolved", "chronic"]

        for status in statuses:
            injury_data = InjuryCreate(
                patient_id=test_patient.id,
                injury_name=f"Injury with status {status}",
                body_part="Arm",
                severity="mild",
                status=status
            )

            injury = injury_crud.create(db_session, obj_in=injury_data)
            assert injury.status == status

    def test_injury_severity_values(self, db_session: Session, test_patient):
        """Test all valid injury severity values."""
        severities = ["mild", "moderate", "severe", "life-threatening"]

        for severity in severities:
            injury_data = InjuryCreate(
                patient_id=test_patient.id,
                injury_name=f"Injury with severity {severity}",
                body_part="Leg",
                severity=severity,
                status="active"
            )

            injury = injury_crud.create(db_session, obj_in=injury_data)
            assert injury.severity == severity

    def test_injury_laterality_values(self, db_session: Session, test_patient):
        """Test all valid laterality values."""
        lateralities = ["left", "right", "bilateral", "not_applicable"]

        for laterality in lateralities:
            injury_data = InjuryCreate(
                patient_id=test_patient.id,
                injury_name=f"Injury with laterality {laterality}",
                body_part="Arm",
                laterality=laterality,
                severity="mild",
                status="active"
            )

            injury = injury_crud.create(db_session, obj_in=injury_data)
            assert injury.laterality == laterality

    def test_get_with_relations(self, db_session: Session, test_patient):
        """Test getting injury with related data."""
        injury_data = InjuryCreate(
            patient_id=test_patient.id,
            injury_name="Injury with Relations",
            body_part="Knee",
            severity="moderate",
            status="active"
        )

        created_injury = injury_crud.create(db_session, obj_in=injury_data)

        # Get with relations
        injury_with_relations = injury_crud.get_with_relations(
            db_session, record_id=created_injury.id
        )

        assert injury_with_relations is not None
        assert injury_with_relations.id == created_injury.id
        assert injury_with_relations.injury_name == "Injury with Relations"

    def test_chronic_injury(self, db_session: Session, test_patient):
        """Test creating a chronic injury."""
        injury_data = InjuryCreate(
            patient_id=test_patient.id,
            injury_name="Chronic Lower Back Pain",
            body_part="Lower Back",
            laterality="not_applicable",
            date_of_injury=date(2020, 1, 15),
            mechanism="Original injury from car accident",
            severity="moderate",
            status="chronic",
            treatment_received="Ongoing physical therapy, pain management",
            recovery_notes="Managing symptoms, full recovery not expected",
            notes="Requires regular follow-up appointments"
        )

        injury = injury_crud.create(db_session, obj_in=injury_data)

        assert injury.status == "chronic"
        assert injury.date_of_injury == date(2020, 1, 15)
