"""
Tests for Condition CRUD operations.
"""
import pytest
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.crud.condition import condition as condition_crud
from app.crud.patient import patient as patient_crud
from app.crud.practitioner import practitioner as practitioner_crud
from app.models.models import Condition
from app.schemas.condition import ConditionCreate, ConditionUpdate
from app.schemas.patient import PatientCreate
from app.schemas.practitioner import PractitionerCreate


class TestConditionCRUD:
    """Test Condition CRUD operations."""

    @pytest.fixture
    def test_patient(self, db_session: Session, test_user):
        """Create a test patient for condition tests."""
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

    @pytest.fixture
    def test_practitioner(self, db_session: Session):
        """Create a test practitioner for condition tests."""
        practitioner_data = PractitionerCreate(
            name="Dr. Sarah Smith",
            specialty="Internal Medicine",
            practice="City Medical Center",
            phone_number="555-555-0123"
        )
        return practitioner_crud.create(db_session, obj_in=practitioner_data)

    def test_create_condition(self, db_session: Session, test_patient, test_practitioner):
        """Test creating a condition record."""
        condition_data = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Hypertension",
            status="active",
            severity="moderate",
            onset_date=date(2024, 1, 15),
            icd10_code="I10",
            snomed_code="38341003",
            code_description="Essential hypertension",
            notes="Patient has mild hypertension, monitoring required",
            practitioner_id=test_practitioner.id
        )
        
        condition = condition_crud.create(db_session, obj_in=condition_data)
        
        assert condition is not None
        assert condition.diagnosis == "Hypertension"
        assert condition.status == "active"
        assert condition.severity == "moderate"
        assert condition.onset_date == date(2024, 1, 15)
        assert condition.icd10_code == "I10"
        assert condition.snomed_code == "38341003"
        assert condition.code_description == "Essential hypertension"
        assert condition.notes == "Patient has mild hypertension, monitoring required"
        assert condition.patient_id == test_patient.id
        assert condition.practitioner_id == test_practitioner.id

    def test_get_active_conditions(self, db_session: Session, test_patient, test_practitioner):
        """Test getting active conditions for a patient."""
        # Create active condition
        active_condition = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Diabetes Type 2",
            status="active",
            severity="mild",
            onset_date=date(2024, 1, 10),
            practitioner_id=test_practitioner.id
        )
        
        # Create resolved condition
        resolved_condition = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Common Cold",
            status="resolved",
            onset_date=date(2024, 1, 1),
            end_date=date(2024, 1, 7),
            practitioner_id=test_practitioner.id
        )
        
        created_active = condition_crud.create(db_session, obj_in=active_condition)
        condition_crud.create(db_session, obj_in=resolved_condition)
        
        # Get active conditions
        active_conditions = condition_crud.get_active_conditions(
            db_session, patient_id=test_patient.id
        )
        
        assert len(active_conditions) == 1
        assert active_conditions[0].id == created_active.id
        assert active_conditions[0].diagnosis == "Diabetes Type 2"
        assert active_conditions[0].status == "active"

    def test_get_active_conditions_by_patient_isolation(self, db_session: Session, test_patient, test_practitioner, test_user):
        """Test that active conditions are filtered by patient."""
        # Create another user and patient
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate
        
        user_data = UserCreate(
            username="testuser2",
            email="test2@example.com", 
            password="testpass123",
            full_name="Test User 2",
            role="user"
        )
        other_user = user_crud.create(db_session, obj_in=user_data)
        
        patient_data = PatientCreate(
            first_name="Jane",
            last_name="Smith",
            birth_date=date(1985, 5, 15),
            gender="F",
            address="456 Oak Ave"
        )
        other_patient = patient_crud.create_for_user(
            db_session, user_id=other_user.id, patient_data=patient_data
        )
        
        # Create active conditions for different patients
        condition1_data = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Asthma",
            status="active",
            practitioner_id=test_practitioner.id
        )
        
        condition2_data = ConditionCreate(
            patient_id=other_patient.id,
            diagnosis="Migraine",
            status="active",
            practitioner_id=test_practitioner.id
        )
        
        created_condition1 = condition_crud.create(db_session, obj_in=condition1_data)
        condition_crud.create(db_session, obj_in=condition2_data)
        
        # Get active conditions for specific patient
        patient_conditions = condition_crud.get_active_conditions(
            db_session, patient_id=test_patient.id
        )
        
        assert len(patient_conditions) == 1
        assert patient_conditions[0].id == created_condition1.id
        assert patient_conditions[0].patient_id == test_patient.id

    def test_update_condition(self, db_session: Session, test_patient, test_practitioner):
        """Test updating a condition."""
        # Create condition
        condition_data = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Depression",
            status="active",
            severity="moderate",
            onset_date=date(2024, 1, 10),
            practitioner_id=test_practitioner.id
        )
        
        created_condition = condition_crud.create(db_session, obj_in=condition_data)
        
        # Update condition
        update_data = ConditionUpdate(
            status="inactive",
            severity="mild",
            notes="Patient responded well to treatment",
            end_date=date(2024, 2, 15)
        )
        
        updated_condition = condition_crud.update(
            db_session, db_obj=created_condition, obj_in=update_data
        )
        
        assert updated_condition.status == "inactive"
        assert updated_condition.severity == "mild"
        assert updated_condition.notes == "Patient responded well to treatment"
        assert updated_condition.end_date == date(2024, 2, 15)
        assert updated_condition.diagnosis == "Depression"  # Unchanged

    def test_delete_condition(self, db_session: Session, test_patient, test_practitioner):
        """Test deleting a condition."""
        # Create condition
        condition_data = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Seasonal Allergies",
            status="active",
            practitioner_id=test_practitioner.id
        )
        
        created_condition = condition_crud.create(db_session, obj_in=condition_data)
        condition_id = created_condition.id
        
        # Delete condition
        deleted_condition = condition_crud.delete(db_session, id=condition_id)
        
        assert deleted_condition is not None
        assert deleted_condition.id == condition_id
        
        # Verify condition is deleted
        retrieved_condition = condition_crud.get(db_session, id=condition_id)
        assert retrieved_condition is None

    def test_condition_status_validation(self, db_session: Session, test_patient, test_practitioner):
        """Test condition status validation."""
        # Test valid status
        valid_condition = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Chronic Fatigue",
            status="chronic",
            practitioner_id=test_practitioner.id
        )
        
        condition = condition_crud.create(db_session, obj_in=valid_condition)
        assert condition.status == "chronic"
        
        # Test status normalization (should convert to lowercase)
        condition_data = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Anxiety",
            status="ACTIVE",
            practitioner_id=test_practitioner.id
        )
        
        condition = condition_crud.create(db_session, obj_in=condition_data)
        assert condition.status == "active"

    def test_condition_severity_validation(self, db_session: Session, test_patient, test_practitioner):
        """Test condition severity validation."""
        # Test valid severity
        condition_data = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Arthritis",
            status="active",
            severity="severe",
            practitioner_id=test_practitioner.id
        )
        
        condition = condition_crud.create(db_session, obj_in=condition_data)
        assert condition.severity == "severe"
        
        # Test severity normalization (should convert to lowercase)
        condition_data = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Back Pain",
            status="active",
            severity="MODERATE",
            practitioner_id=test_practitioner.id
        )
        
        condition = condition_crud.create(db_session, obj_in=condition_data)
        assert condition.severity == "moderate"

    def test_date_validation(self, db_session: Session, test_patient, test_practitioner):
        """Test date validation for conditions."""
        # Test valid date order
        condition_data = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Recovery Post Surgery",
            status="resolved",
            onset_date=date(2024, 1, 10),
            end_date=date(2024, 1, 20),
            practitioner_id=test_practitioner.id
        )
        
        condition = condition_crud.create(db_session, obj_in=condition_data)
        assert condition.onset_date == date(2024, 1, 10)
        assert condition.end_date == date(2024, 1, 20)

    def test_icd10_and_snomed_codes(self, db_session: Session, test_patient, test_practitioner):
        """Test conditions with medical codes."""
        condition_data = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Type 2 Diabetes Mellitus",
            status="active",
            severity="moderate",
            icd10_code="E11",
            snomed_code="44054006",
            code_description="Type 2 diabetes mellitus",
            practitioner_id=test_practitioner.id
        )
        
        condition = condition_crud.create(db_session, obj_in=condition_data)
        assert condition.icd10_code == "E11"
        assert condition.snomed_code == "44054006"
        assert condition.code_description == "Type 2 diabetes mellitus"

    def test_chronic_condition_management(self, db_session: Session, test_patient, test_practitioner):
        """Test managing chronic conditions."""
        # Create chronic condition
        condition_data = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Chronic Kidney Disease Stage 3",
            status="chronic",
            severity="moderate",
            onset_date=date(2023, 6, 15),
            icd10_code="N18.3",
            notes="Patient requires regular monitoring and dietary modifications",
            practitioner_id=test_practitioner.id
        )
        
        created_condition = condition_crud.create(db_session, obj_in=condition_data)
        
        # Update with progression
        update_data = ConditionUpdate(
            notes="Condition stable, continue current treatment plan",
            severity="moderate"
        )
        
        updated_condition = condition_crud.update(
            db_session, db_obj=created_condition, obj_in=update_data
        )
        
        assert updated_condition.status == "chronic"
        assert updated_condition.severity == "moderate"
        assert "stable" in updated_condition.notes

    def test_condition_recurrence(self, db_session: Session, test_patient, test_practitioner):
        """Test handling condition recurrence."""
        # Create condition with recurrence status
        condition_data = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Depression - Recurrent Episode",
            status="recurrence",
            severity="moderate",
            onset_date=date(2024, 1, 1),
            notes="Second episode within 12 months",
            practitioner_id=test_practitioner.id
        )
        
        condition = condition_crud.create(db_session, obj_in=condition_data)
        assert condition.status == "recurrence"
        assert condition.diagnosis == "Depression - Recurrent Episode"

    def test_get_conditions_with_pagination(self, db_session: Session, test_patient, test_practitioner):
        """Test getting conditions with pagination using base query method."""
        # Create multiple conditions
        for i in range(5):
            condition_data = ConditionCreate(
                patient_id=test_patient.id,
                diagnosis=f"Condition {i}",
                status="active",
                onset_date=date(2024, 1, i + 1),
                practitioner_id=test_practitioner.id
            )
            condition_crud.create(db_session, obj_in=condition_data)
        
        # Test pagination using base query method
        first_page = condition_crud.query(
            db_session, 
            filters={"patient_id": test_patient.id},
            skip=0, 
            limit=3
        )
        second_page = condition_crud.query(
            db_session, 
            filters={"patient_id": test_patient.id},
            skip=3, 
            limit=3
        )
        
        assert len(first_page) == 3
        assert len(second_page) == 2
        
        # Verify no overlap
        first_page_ids = {cond.id for cond in first_page}
        second_page_ids = {cond.id for cond in second_page}
        assert first_page_ids.isdisjoint(second_page_ids)

    def test_condition_workflow_lifecycle(self, db_session: Session, test_patient, test_practitioner):
        """Test a complete condition lifecycle workflow."""
        # Create initial condition
        condition_data = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Acute Bronchitis",
            status="active",
            severity="moderate",
            onset_date=date.today() - timedelta(days=7),
            notes="Patient presents with persistent cough and chest discomfort",
            practitioner_id=test_practitioner.id
        )
        
        created_condition = condition_crud.create(db_session, obj_in=condition_data)
        
        # Update to show improvement
        update_improving = ConditionUpdate(
            severity="mild",
            notes="Patient responding well to treatment, symptoms improving"
        )
        
        improving_condition = condition_crud.update(
            db_session, db_obj=created_condition, obj_in=update_improving
        )
        assert improving_condition.severity == "mild"
        
        # Update to resolved
        update_resolved = ConditionUpdate(
            status="resolved",
            end_date=date.today(),
            notes="Condition fully resolved, treatment completed successfully"
        )
        
        final_condition = condition_crud.update(
            db_session, db_obj=improving_condition, obj_in=update_resolved
        )
        
        assert final_condition.status == "resolved"
        assert final_condition.end_date == date.today()
        assert "fully resolved" in final_condition.notes

    def test_search_conditions_by_diagnosis(self, db_session: Session, test_patient, test_practitioner):
        """Test searching conditions by diagnosis using base query method."""
        # Create conditions with similar diagnoses - use a common prefix
        conditions_data = [
            ConditionCreate(
                patient_id=test_patient.id,
                diagnosis="Heart Disease",
                status="active",
                practitioner_id=test_practitioner.id
            ),
            ConditionCreate(
                patient_id=test_patient.id,
                diagnosis="Heart Failure",
                status="active",
                practitioner_id=test_practitioner.id
            ),
            ConditionCreate(
                patient_id=test_patient.id,
                diagnosis="Kidney Disease",
                status="active",
                practitioner_id=test_practitioner.id
            )
        ]
        
        for condition_data in conditions_data:
            condition_crud.create(db_session, obj_in=condition_data)
        
        # Search for heart-related conditions using base query search
        heart_conditions = condition_crud.query(
            db_session,
            search={"field": "diagnosis", "term": "Heart"}
        )
        
        assert len(heart_conditions) == 2
        for condition in heart_conditions:
            assert "Heart" in condition.diagnosis

    def test_condition_ordering_by_onset_date(self, db_session: Session, test_patient, test_practitioner):
        """Test that active conditions are ordered by onset date descending."""
        # Create conditions with different onset dates
        condition1_data = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Condition 1",
            status="active",
            onset_date=date.today() - timedelta(days=30),
            practitioner_id=test_practitioner.id
        )
        
        condition2_data = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Condition 2", 
            status="active",
            onset_date=date.today() - timedelta(days=10),
            practitioner_id=test_practitioner.id
        )
        
        condition3_data = ConditionCreate(
            patient_id=test_patient.id,
            diagnosis="Condition 3",
            status="active",
            onset_date=date.today() - timedelta(days=20),
            practitioner_id=test_practitioner.id
        )
        
        condition_crud.create(db_session, obj_in=condition1_data)
        condition_crud.create(db_session, obj_in=condition2_data)
        condition_crud.create(db_session, obj_in=condition3_data)
        
        # Get active conditions - should be ordered by onset_date desc
        active_conditions = condition_crud.get_active_conditions(
            db_session, patient_id=test_patient.id
        )
        
        assert len(active_conditions) == 3
        assert active_conditions[0].diagnosis == "Condition 2"  # Most recent (-10 days)
        assert active_conditions[1].diagnosis == "Condition 3"  # Middle (-20 days)
        assert active_conditions[2].diagnosis == "Condition 1"  # Oldest (-30 days)