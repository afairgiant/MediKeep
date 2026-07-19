"""
Tests for Lab Result CRUD operations.
"""

import pytest
from datetime import date, timedelta
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.crud.lab_result import (
    lab_result as lab_result_crud,
    lab_result_medication,
    lab_result_procedure,
)
from app.crud.medication import medication as medication_crud
from app.crud.patient import patient as patient_crud
from app.crud.practitioner import practitioner as practitioner_crud
from app.crud.procedure import procedure as procedure_crud
from app.models.models import LabResult, LabResultMedication, LabResultProcedure
from app.schemas.lab_result import (
    LabResultCreate,
    LabResultMedicationCreate,
    LabResultProcedureCreate,
    LabResultUpdate,
)
from app.schemas.medication import MedicationCreate
from app.schemas.patient import PatientCreate
from app.schemas.practitioner import PractitionerCreate
from app.schemas.procedure import ProcedureCreate


class TestLabResultCRUD:
    """Test Lab Result CRUD operations."""

    @pytest.fixture
    def test_patient(self, db_session: Session, test_user):
        """Create a test patient for lab result tests."""
        patient_data = PatientCreate(
            first_name="John",
            last_name="Doe",
            birth_date=date(1990, 1, 1),
            gender="M",
            address="123 Main St",
        )
        return patient_crud.create_for_user(
            db_session, user_id=test_user.id, patient_data=patient_data
        )

    @pytest.fixture
    def test_practitioner(self, db_session: Session, default_specialty):
        """Create a test practitioner for lab result tests."""
        practitioner_data = PractitionerCreate(
            name="Dr. Sarah Smith",
            specialty_id=default_specialty.id,
            practice="City Medical Center",
            phone_number="555-555-0123",
        )
        return practitioner_crud.create(db_session, obj_in=practitioner_data)

    def test_create_lab_result(
        self, db_session: Session, test_patient, test_practitioner
    ):
        """Test creating a lab result record."""
        lab_result_data = LabResultCreate(
            patient_id=test_patient.id,
            test_name="Complete Blood Count",
            test_code="CBC",
            test_category="blood work",
            test_type="routine",
            facility="City Medical Lab",
            status="ordered",
            ordered_date=date(2024, 1, 15),
            practitioner_id=test_practitioner.id,
            notes="Fasting required",
        )

        lab_result = lab_result_crud.create(db_session, obj_in=lab_result_data)

        assert lab_result is not None
        assert lab_result.test_name == "Complete Blood Count"
        assert lab_result.test_code == "CBC"
        assert lab_result.test_category == "blood work"
        assert lab_result.test_type == "routine"
        assert lab_result.facility == "City Medical Lab"
        assert lab_result.status == "ordered"
        assert lab_result.ordered_date == date(2024, 1, 15)
        assert lab_result.patient_id == test_patient.id
        assert lab_result.practitioner_id == test_practitioner.id
        assert lab_result.notes == "Fasting required"

    def test_get_by_test_code(
        self, db_session: Session, test_patient, test_practitioner
    ):
        """Test getting lab results by test code."""
        # Create lab results with same test code
        lab_result1_data = LabResultCreate(
            patient_id=test_patient.id,
            test_name="Glucose Test 1",
            test_code="GLU",
            test_category="chemistry",
            ordered_date=date(2024, 1, 10),
            practitioner_id=test_practitioner.id,
        )

        lab_result2_data = LabResultCreate(
            patient_id=test_patient.id,
            test_name="Glucose Test 2",
            test_code="GLU",
            test_category="chemistry",
            ordered_date=date(2024, 1, 15),
            practitioner_id=test_practitioner.id,
        )

        # Create lab result with different test code
        lab_result3_data = LabResultCreate(
            patient_id=test_patient.id,
            test_name="Cholesterol Test",
            test_code="CHOL",
            test_category="chemistry",
            ordered_date=date(2024, 1, 12),
            practitioner_id=test_practitioner.id,
        )

        lab_result_crud.create(db_session, obj_in=lab_result1_data)
        created_lab_result2 = lab_result_crud.create(
            db_session, obj_in=lab_result2_data
        )
        lab_result_crud.create(db_session, obj_in=lab_result3_data)

        # Get lab results by test code GLU
        results = lab_result_crud.get_by_test_code(db_session, test_code="GLU")

        assert len(results) == 2
        # Should be ordered by ordered_date desc, so newer test first
        assert results[0].id == created_lab_result2.id
        assert results[0].test_name == "Glucose Test 2"
        assert results[1].test_name == "Glucose Test 1"

    def test_get_by_patient_and_test_code(
        self, db_session: Session, test_patient, test_practitioner, test_user
    ):
        """Test getting lab results by patient and test code."""
        # Create another patient
        from app.crud.user import user as user_crud
        from app.schemas.user import UserCreate

        user_data = UserCreate(
            username="testuser2",
            email="test2@example.com",
            password="testpass123",
            full_name="Test User 2",
            role="user",
        )
        other_user = user_crud.create(db_session, obj_in=user_data)

        patient_data = PatientCreate(
            first_name="Jane",
            last_name="Smith",
            birth_date=date(1985, 5, 15),
            gender="F",
            address="456 Oak Ave",
        )
        other_patient = patient_crud.create_for_user(
            db_session, user_id=other_user.id, patient_data=patient_data
        )

        # Create lab results for different patients with same test code
        lab_result1_data = LabResultCreate(
            patient_id=test_patient.id,
            test_name="Hemoglobin A1C",
            test_code="HBA1C",
            test_category="chemistry",
            ordered_date=date(2024, 1, 10),
            practitioner_id=test_practitioner.id,
        )

        lab_result2_data = LabResultCreate(
            patient_id=other_patient.id,
            test_name="Hemoglobin A1C",
            test_code="HBA1C",
            test_category="chemistry",
            ordered_date=date(2024, 1, 15),
            practitioner_id=test_practitioner.id,
        )

        created_lab_result1 = lab_result_crud.create(
            db_session, obj_in=lab_result1_data
        )
        lab_result_crud.create(db_session, obj_in=lab_result2_data)

        # Get lab results for specific patient and test code
        results = lab_result_crud.get_by_patient_and_test_code(
            db_session, patient_id=test_patient.id, test_code="HBA1C"
        )

        assert len(results) == 1
        assert results[0].id == created_lab_result1.id
        assert results[0].patient_id == test_patient.id

    def test_search_by_test_code_pattern(
        self, db_session: Session, test_patient, test_practitioner
    ):
        """Test searching lab results by test code pattern."""
        # Create lab results with similar test codes
        lab_results_data = [
            LabResultCreate(
                patient_id=test_patient.id,
                test_name="Hepatitis B Surface Antigen",
                test_code="HBSAG",
                test_category="immunology",
                ordered_date=date(2024, 1, 10),
                practitioner_id=test_practitioner.id,
            ),
            LabResultCreate(
                patient_id=test_patient.id,
                test_name="Hepatitis C Antibody",
                test_code="HCVAB",
                test_category="immunology",
                ordered_date=date(2024, 1, 12),
                practitioner_id=test_practitioner.id,
            ),
            LabResultCreate(
                patient_id=test_patient.id,
                test_name="Blood Glucose",
                test_code="GLUC",
                test_category="chemistry",
                ordered_date=date(2024, 1, 15),
                practitioner_id=test_practitioner.id,
            ),
        ]

        for lab_result_data in lab_results_data:
            lab_result_crud.create(db_session, obj_in=lab_result_data)

        # Search for lab results containing "HB" in test code
        results = lab_result_crud.search_by_test_code_pattern(
            db_session, test_code_pattern="HB"
        )

        assert len(results) == 1
        assert results[0].test_code == "HBSAG"
        assert results[0].test_name == "Hepatitis B Surface Antigen"

    def test_update_lab_result(
        self, db_session: Session, test_patient, test_practitioner
    ):
        """Test updating a lab result."""
        # Create lab result
        lab_result_data = LabResultCreate(
            patient_id=test_patient.id,
            test_name="Thyroid Function Panel",
            test_code="TSH",
            test_category="chemistry",
            status="ordered",
            ordered_date=date(2024, 1, 10),
            practitioner_id=test_practitioner.id,
        )

        created_lab_result = lab_result_crud.create(db_session, obj_in=lab_result_data)

        # Update lab result with completion
        update_data = LabResultUpdate(
            status="completed",
            labs_result="normal",
            completed_date=date(2024, 1, 12),
            notes="TSH levels within normal range",
        )

        updated_lab_result = lab_result_crud.update(
            db_session, db_obj=created_lab_result, obj_in=update_data
        )

        assert updated_lab_result.status == "completed"
        assert updated_lab_result.labs_result == "normal"
        assert updated_lab_result.completed_date == date(2024, 1, 12)
        assert updated_lab_result.notes == "TSH levels within normal range"
        assert updated_lab_result.test_name == "Thyroid Function Panel"  # Unchanged

    def test_delete_lab_result(
        self, db_session: Session, test_patient, test_practitioner
    ):
        """Test deleting a lab result."""
        # Create lab result
        lab_result_data = LabResultCreate(
            patient_id=test_patient.id,
            test_name="Lipid Panel",
            test_code="LIPID",
            test_category="chemistry",
            ordered_date=date(2024, 1, 5),
            practitioner_id=test_practitioner.id,
        )

        created_lab_result = lab_result_crud.create(db_session, obj_in=lab_result_data)
        lab_result_id = created_lab_result.id

        # Delete lab result
        deleted_lab_result = lab_result_crud.delete(db_session, id=lab_result_id)

        assert deleted_lab_result is not None
        assert deleted_lab_result.id == lab_result_id

        # Verify lab result is deleted
        retrieved_lab_result = lab_result_crud.get(db_session, id=lab_result_id)
        assert retrieved_lab_result is None

    def test_lab_result_status_validation(
        self, db_session: Session, test_patient, test_practitioner
    ):
        """Test lab result status validation."""
        # Test valid status
        valid_lab_result = LabResultCreate(
            patient_id=test_patient.id,
            test_name="Blood Culture",
            test_code="BLOODCX",
            test_category="microbiology",
            status="in-progress",
            ordered_date=date(2024, 1, 1),
            practitioner_id=test_practitioner.id,
        )

        lab_result = lab_result_crud.create(db_session, obj_in=valid_lab_result)
        assert lab_result.status == "in-progress"

    def test_lab_result_category_validation(
        self, db_session: Session, test_patient, test_practitioner
    ):
        """Test lab result category validation."""
        # Test valid category
        lab_result_data = LabResultCreate(
            patient_id=test_patient.id,
            test_name="X-Ray Chest",
            test_code="XRAY",
            test_category="imaging",
            ordered_date=date(2024, 1, 1),
            practitioner_id=test_practitioner.id,
        )

        lab_result = lab_result_crud.create(db_session, obj_in=lab_result_data)
        assert lab_result.test_category == "imaging"

    def test_lab_result_type_validation(
        self, db_session: Session, test_patient, test_practitioner
    ):
        """Test lab result type validation."""
        # Test valid test type
        lab_result_data = LabResultCreate(
            patient_id=test_patient.id,
            test_name="Troponin I",
            test_code="TROP",
            test_category="chemistry",
            test_type="stat",
            ordered_date=date(2024, 1, 1),
            practitioner_id=test_practitioner.id,
        )

        lab_result = lab_result_crud.create(db_session, obj_in=lab_result_data)
        assert lab_result.test_type == "stat"

    def test_labs_result_interpretation_validation(
        self, db_session: Session, test_patient, test_practitioner
    ):
        """Test lab result interpretation validation."""
        # Create lab result and update with result interpretation
        lab_result_data = LabResultCreate(
            patient_id=test_patient.id,
            test_name="BUN/Creatinine",
            test_code="BUN",
            test_category="chemistry",
            ordered_date=date(2024, 1, 1),
            practitioner_id=test_practitioner.id,
        )

        created_lab_result = lab_result_crud.create(db_session, obj_in=lab_result_data)

        # Update with high result
        update_data = LabResultUpdate(
            status="completed", labs_result="high", completed_date=date(2024, 1, 3)
        )

        updated_lab_result = lab_result_crud.update(
            db_session, db_obj=created_lab_result, obj_in=update_data
        )

        assert updated_lab_result.labs_result == "high"

    def test_date_order_validation(
        self, db_session: Session, test_patient, test_practitioner
    ):
        """Test that completed date validation works correctly."""
        # Test valid date order
        lab_result_data = LabResultCreate(
            patient_id=test_patient.id,
            test_name="Prothrombin Time",
            test_code="PT",
            test_category="hematology",
            ordered_date=date(2024, 1, 10),
            completed_date=date(2024, 1, 12),
            practitioner_id=test_practitioner.id,
        )

        lab_result = lab_result_crud.create(db_session, obj_in=lab_result_data)
        assert lab_result.ordered_date == date(2024, 1, 10)
        assert lab_result.completed_date == date(2024, 1, 12)

    def test_test_code_normalization(
        self, db_session: Session, test_patient, test_practitioner
    ):
        """Test that test codes are normalized to uppercase."""
        lab_result_data = LabResultCreate(
            patient_id=test_patient.id,
            test_name="C-Reactive Protein",
            test_code="crp",  # lowercase
            test_category="chemistry",
            ordered_date=date(2024, 1, 1),
            practitioner_id=test_practitioner.id,
        )

        lab_result = lab_result_crud.create(db_session, obj_in=lab_result_data)
        assert lab_result.test_code == "CRP"  # Should be uppercase

    def test_get_lab_results_with_pagination(
        self, db_session: Session, test_patient, test_practitioner
    ):
        """Test getting lab results with pagination."""
        # Create multiple lab results
        for i in range(5):
            lab_result_data = LabResultCreate(
                patient_id=test_patient.id,
                test_name=f"Test {i}",
                test_code=f"T{i}",
                test_category="chemistry",
                ordered_date=date(2024, 1, i + 1),
                practitioner_id=test_practitioner.id,
            )
            lab_result_crud.create(db_session, obj_in=lab_result_data)

        # Test pagination using base query method
        first_page = lab_result_crud.query(
            db_session, filters={"patient_id": test_patient.id}, skip=0, limit=3
        )
        second_page = lab_result_crud.query(
            db_session, filters={"patient_id": test_patient.id}, skip=3, limit=3
        )

        assert len(first_page) == 3
        assert len(second_page) == 2

        # Verify no overlap
        first_page_ids = {lr.id for lr in first_page}
        second_page_ids = {lr.id for lr in second_page}
        assert first_page_ids.isdisjoint(second_page_ids)

    def test_critical_result_workflow(
        self, db_session: Session, test_patient, test_practitioner
    ):
        """Test a complete workflow for a critical lab result."""
        # Create urgent lab order
        lab_result_data = LabResultCreate(
            patient_id=test_patient.id,
            test_name="Cardiac Enzymes",
            test_code="CKMB",
            test_category="cardiology",
            test_type="urgent",
            facility="Emergency Lab",
            status="ordered",
            ordered_date=date.today(),
            practitioner_id=test_practitioner.id,
            notes="Patient with chest pain",
        )

        created_lab_result = lab_result_crud.create(db_session, obj_in=lab_result_data)

        # Update to in-progress
        update_in_progress = LabResultUpdate(status="in-progress")
        updated_lab_result = lab_result_crud.update(
            db_session, db_obj=created_lab_result, obj_in=update_in_progress
        )
        assert updated_lab_result.status == "in-progress"

        # Complete with critical result
        update_critical = LabResultUpdate(
            status="completed",
            labs_result="critical",
            completed_date=date.today(),
            notes="Critical value - immediate physician notification required",
        )

        final_lab_result = lab_result_crud.update(
            db_session, db_obj=updated_lab_result, obj_in=update_critical
        )

        assert final_lab_result.status == "completed"
        assert final_lab_result.labs_result == "critical"
        assert final_lab_result.completed_date == date.today()
        assert "immediate physician notification" in final_lab_result.notes

    def test_get_with_files(self, db_session: Session, test_patient, test_practitioner):
        """Test getting lab result with associated files."""
        # Create lab result
        lab_result_data = LabResultCreate(
            patient_id=test_patient.id,
            test_name="MRI Brain",
            test_code="MRI",
            test_category="imaging",
            ordered_date=date(2024, 1, 10),
            practitioner_id=test_practitioner.id,
        )

        created_lab_result = lab_result_crud.create(db_session, obj_in=lab_result_data)

        # Get lab result with files (method exists but files feature might not be implemented)
        lab_result_with_files = lab_result_crud.get_with_files(
            db_session, lab_result_id=created_lab_result.id
        )

        assert lab_result_with_files is not None
        assert lab_result_with_files.id == created_lab_result.id
        assert lab_result_with_files.test_name == "MRI Brain"


class TestCRUDLabResultMedication:
    """Tests for the LabResultMedication junction CRUD operations."""

    @pytest.fixture
    def patient_with_data(self, db_session: Session, test_user):
        """Create a patient with a lab result and two medications."""
        patient = patient_crud.create_for_user(
            db_session,
            user_id=test_user.id,
            patient_data=PatientCreate(
                first_name="Med",
                last_name="Patient",
                birth_date=date(1990, 1, 1),
                gender="M",
                address="123 Test St",
            ),
        )

        lab_result = lab_result_crud.create(
            db_session,
            obj_in=LabResultCreate(
                patient_id=patient.id,
                test_name="Liver Function Panel",
                test_code="LFT",
                test_category="chemistry",
                ordered_date=date(2024, 1, 10),
                status="completed",
            ),
        )

        medication = medication_crud.create(
            db_session,
            obj_in=MedicationCreate(
                patient_id=patient.id,
                medication_name="Atorvastatin",
                dosage="20mg",
                status="active",
            ),
        )

        medication2 = medication_crud.create(
            db_session,
            obj_in=MedicationCreate(
                patient_id=patient.id,
                medication_name="Metformin",
                dosage="500mg",
                status="active",
            ),
        )

        return {
            "patient": patient,
            "lab_result": lab_result,
            "medication": medication,
            "medication2": medication2,
        }

    def test_create_relationship(self, db_session, patient_with_data):
        """Test creating a lab result medication relationship."""
        lr = patient_with_data["lab_result"]
        med = patient_with_data["medication"]

        relationship = lab_result_medication.create(
            db_session,
            obj_in=LabResultMedicationCreate(
                lab_result_id=lr.id,
                medication_id=med.id,
                relevance_note="Ordered to monitor liver function on this medication",
            ),
        )

        assert relationship.id is not None
        assert relationship.lab_result_id == lr.id
        assert relationship.medication_id == med.id
        assert (
            relationship.relevance_note
            == "Ordered to monitor liver function on this medication"
        )
        assert relationship.created_at is not None

    def test_get_by_lab_result(self, db_session, patient_with_data):
        """Test querying relationships by lab result."""
        lr = patient_with_data["lab_result"]
        med = patient_with_data["medication"]
        med2 = patient_with_data["medication2"]

        lab_result_medication.create(
            db_session,
            obj_in=LabResultMedicationCreate(lab_result_id=lr.id, medication_id=med.id),
        )
        lab_result_medication.create(
            db_session,
            obj_in=LabResultMedicationCreate(lab_result_id=lr.id, medication_id=med2.id),
        )

        results = lab_result_medication.get_by_lab_result(
            db_session, lab_result_id=lr.id
        )
        assert len(results) == 2
        med_ids = {r.medication_id for r in results}
        assert med.id in med_ids
        assert med2.id in med_ids

    def test_get_by_lab_result_and_medication(self, db_session, patient_with_data):
        """Test querying a specific lab result-medication pair."""
        lr = patient_with_data["lab_result"]
        med = patient_with_data["medication"]

        lab_result_medication.create(
            db_session,
            obj_in=LabResultMedicationCreate(lab_result_id=lr.id, medication_id=med.id),
        )

        result = lab_result_medication.get_by_lab_result_and_medication(
            db_session, lab_result_id=lr.id, medication_id=med.id
        )
        assert result is not None
        assert result.lab_result_id == lr.id
        assert result.medication_id == med.id

    def test_get_by_lab_result_and_medication_not_found(
        self, db_session, patient_with_data
    ):
        """Test querying a nonexistent pair returns None."""
        result = lab_result_medication.get_by_lab_result_and_medication(
            db_session, lab_result_id=99999, medication_id=99999
        )
        assert result is None

    def test_delete_by_lab_result_and_medication(self, db_session, patient_with_data):
        """Test deleting a specific relationship by its pair."""
        lr = patient_with_data["lab_result"]
        med = patient_with_data["medication"]

        lab_result_medication.create(
            db_session,
            obj_in=LabResultMedicationCreate(lab_result_id=lr.id, medication_id=med.id),
        )

        deleted = lab_result_medication.delete_by_lab_result_and_medication(
            db_session, lab_result_id=lr.id, medication_id=med.id
        )
        assert deleted is True

        result = lab_result_medication.get_by_lab_result_and_medication(
            db_session, lab_result_id=lr.id, medication_id=med.id
        )
        assert result is None

    def test_delete_nonexistent_returns_false(self, db_session):
        """Test deleting a nonexistent relationship returns False."""
        deleted = lab_result_medication.delete_by_lab_result_and_medication(
            db_session, lab_result_id=99999, medication_id=99999
        )
        assert deleted is False

    def test_unique_constraint_violation(self, db_session, patient_with_data):
        """Test that creating a duplicate lab result-medication pair raises IntegrityError."""
        lr = patient_with_data["lab_result"]
        med = patient_with_data["medication"]

        lab_result_medication.create(
            db_session,
            obj_in=LabResultMedicationCreate(lab_result_id=lr.id, medication_id=med.id),
        )

        with pytest.raises(IntegrityError):
            lab_result_medication.create(
                db_session,
                obj_in=LabResultMedicationCreate(
                    lab_result_id=lr.id, medication_id=med.id
                ),
            )

    def test_cascade_delete_lab_result(self, db_session, patient_with_data):
        """Test that deleting the lab result cascades to relationships."""
        lr = patient_with_data["lab_result"]
        med = patient_with_data["medication"]

        lab_result_medication.create(
            db_session,
            obj_in=LabResultMedicationCreate(lab_result_id=lr.id, medication_id=med.id),
        )

        db_session.delete(lr)
        db_session.commit()

        results = lab_result_medication.get_by_lab_result(
            db_session, lab_result_id=lr.id
        )
        assert len(results) == 0

    def test_cascade_delete_medication(self, db_session, patient_with_data):
        """Test that deleting the medication cascades to relationships."""
        lr = patient_with_data["lab_result"]
        med = patient_with_data["medication"]

        lab_result_medication.create(
            db_session,
            obj_in=LabResultMedicationCreate(lab_result_id=lr.id, medication_id=med.id),
        )

        db_session.delete(med)
        db_session.commit()

        results = lab_result_medication.get_by_lab_result(
            db_session, lab_result_id=lr.id
        )
        assert len(results) == 0


class TestCRUDLabResultProcedure:
    """Tests for the LabResultProcedure junction CRUD operations."""

    @pytest.fixture
    def patient_with_data(self, db_session: Session, test_user):
        """Create a patient with a lab result and two procedures."""
        patient = patient_crud.create_for_user(
            db_session,
            user_id=test_user.id,
            patient_data=PatientCreate(
                first_name="Proc",
                last_name="Patient",
                birth_date=date(1990, 1, 1),
                gender="M",
                address="123 Test St",
            ),
        )

        lab_result = lab_result_crud.create(
            db_session,
            obj_in=LabResultCreate(
                patient_id=patient.id,
                test_name="Pre-op Labs",
                test_code="PREOP",
                test_category="chemistry",
                ordered_date=date(2024, 1, 10),
                status="completed",
            ),
        )

        procedure = procedure_crud.create(
            db_session,
            obj_in=ProcedureCreate(
                patient_id=patient.id,
                procedure_name="Appendectomy",
                date=date(2024, 1, 15),
                status="completed",
            ),
        )

        procedure2 = procedure_crud.create(
            db_session,
            obj_in=ProcedureCreate(
                patient_id=patient.id,
                procedure_name="Blood Draw",
                date=date(2024, 1, 12),
                status="completed",
            ),
        )

        return {
            "patient": patient,
            "lab_result": lab_result,
            "procedure": procedure,
            "procedure2": procedure2,
        }

    def test_create_relationship(self, db_session, patient_with_data):
        """Test creating a lab result procedure relationship."""
        lr = patient_with_data["lab_result"]
        proc = patient_with_data["procedure"]

        relationship = lab_result_procedure.create(
            db_session,
            obj_in=LabResultProcedureCreate(
                lab_result_id=lr.id,
                procedure_id=proc.id,
                relevance_note="Pre-operative labs for this procedure",
            ),
        )

        assert relationship.id is not None
        assert relationship.lab_result_id == lr.id
        assert relationship.procedure_id == proc.id
        assert (
            relationship.relevance_note == "Pre-operative labs for this procedure"
        )
        assert relationship.created_at is not None

    def test_get_by_lab_result(self, db_session, patient_with_data):
        """Test querying relationships by lab result."""
        lr = patient_with_data["lab_result"]
        proc = patient_with_data["procedure"]
        proc2 = patient_with_data["procedure2"]

        lab_result_procedure.create(
            db_session,
            obj_in=LabResultProcedureCreate(lab_result_id=lr.id, procedure_id=proc.id),
        )
        lab_result_procedure.create(
            db_session,
            obj_in=LabResultProcedureCreate(lab_result_id=lr.id, procedure_id=proc2.id),
        )

        results = lab_result_procedure.get_by_lab_result(
            db_session, lab_result_id=lr.id
        )
        assert len(results) == 2
        proc_ids = {r.procedure_id for r in results}
        assert proc.id in proc_ids
        assert proc2.id in proc_ids

    def test_get_by_lab_result_and_procedure(self, db_session, patient_with_data):
        """Test querying a specific lab result-procedure pair."""
        lr = patient_with_data["lab_result"]
        proc = patient_with_data["procedure"]

        lab_result_procedure.create(
            db_session,
            obj_in=LabResultProcedureCreate(lab_result_id=lr.id, procedure_id=proc.id),
        )

        result = lab_result_procedure.get_by_lab_result_and_procedure(
            db_session, lab_result_id=lr.id, procedure_id=proc.id
        )
        assert result is not None
        assert result.lab_result_id == lr.id
        assert result.procedure_id == proc.id

    def test_get_by_lab_result_and_procedure_not_found(
        self, db_session, patient_with_data
    ):
        """Test querying a nonexistent pair returns None."""
        result = lab_result_procedure.get_by_lab_result_and_procedure(
            db_session, lab_result_id=99999, procedure_id=99999
        )
        assert result is None

    def test_delete_by_lab_result_and_procedure(self, db_session, patient_with_data):
        """Test deleting a specific relationship by its pair."""
        lr = patient_with_data["lab_result"]
        proc = patient_with_data["procedure"]

        lab_result_procedure.create(
            db_session,
            obj_in=LabResultProcedureCreate(lab_result_id=lr.id, procedure_id=proc.id),
        )

        deleted = lab_result_procedure.delete_by_lab_result_and_procedure(
            db_session, lab_result_id=lr.id, procedure_id=proc.id
        )
        assert deleted is True

        result = lab_result_procedure.get_by_lab_result_and_procedure(
            db_session, lab_result_id=lr.id, procedure_id=proc.id
        )
        assert result is None

    def test_delete_nonexistent_returns_false(self, db_session):
        """Test deleting a nonexistent relationship returns False."""
        deleted = lab_result_procedure.delete_by_lab_result_and_procedure(
            db_session, lab_result_id=99999, procedure_id=99999
        )
        assert deleted is False

    def test_unique_constraint_violation(self, db_session, patient_with_data):
        """Test that creating a duplicate lab result-procedure pair raises IntegrityError."""
        lr = patient_with_data["lab_result"]
        proc = patient_with_data["procedure"]

        lab_result_procedure.create(
            db_session,
            obj_in=LabResultProcedureCreate(lab_result_id=lr.id, procedure_id=proc.id),
        )

        with pytest.raises(IntegrityError):
            lab_result_procedure.create(
                db_session,
                obj_in=LabResultProcedureCreate(
                    lab_result_id=lr.id, procedure_id=proc.id
                ),
            )

    def test_cascade_delete_lab_result(self, db_session, patient_with_data):
        """Test that deleting the lab result cascades to relationships."""
        lr = patient_with_data["lab_result"]
        proc = patient_with_data["procedure"]

        lab_result_procedure.create(
            db_session,
            obj_in=LabResultProcedureCreate(lab_result_id=lr.id, procedure_id=proc.id),
        )

        db_session.delete(lr)
        db_session.commit()

        results = lab_result_procedure.get_by_lab_result(
            db_session, lab_result_id=lr.id
        )
        assert len(results) == 0

    def test_cascade_delete_procedure(self, db_session, patient_with_data):
        """Test that deleting the procedure cascades to relationships."""
        lr = patient_with_data["lab_result"]
        proc = patient_with_data["procedure"]

        lab_result_procedure.create(
            db_session,
            obj_in=LabResultProcedureCreate(lab_result_id=lr.id, procedure_id=proc.id),
        )

        db_session.delete(proc)
        db_session.commit()

        results = lab_result_procedure.get_by_lab_result(
            db_session, lab_result_id=lr.id
        )
        assert len(results) == 0
