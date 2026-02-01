"""
Tests for LabTestComponent CRUD operations.
"""
import pytest
from datetime import date
from sqlalchemy.orm import Session

from app.crud.lab_test_component import lab_test_component as lab_test_component_crud
from app.crud.lab_result import lab_result as lab_result_crud
from app.crud.patient import patient as patient_crud
from app.models.models import LabTestComponent
from app.schemas.lab_test_component import (
    LabTestComponentCreate,
    LabTestComponentUpdate,
    LabTestComponentBulkCreate
)
from app.schemas.lab_result import LabResultCreate
from app.schemas.patient import PatientCreate


class TestLabTestComponentCRUD:
    """Test LabTestComponent CRUD operations."""

    @pytest.fixture
    def test_patient(self, db_session: Session, test_user):
        """Create a test patient for lab test component tests."""
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
    def test_lab_result(self, db_session: Session, test_patient):
        """Create a test lab result for component tests."""
        lab_result_data = LabResultCreate(
            patient_id=test_patient.id,
            test_name="Complete Blood Count",
            test_category="blood work",
            status="completed",
            completed_date=date(2024, 1, 15)
        )
        return lab_result_crud.create(db_session, obj_in=lab_result_data)

    def test_create_lab_test_component(self, db_session: Session, test_lab_result):
        """Test creating a lab test component."""
        component_data = LabTestComponentCreate(
            lab_result_id=test_lab_result.id,
            test_name="Hemoglobin",
            abbreviation="HGB",
            value=14.5,
            unit="g/dL",
            ref_range_min=12.0,
            ref_range_max=16.0,
            status="normal",
            category="hematology"
        )

        component = lab_test_component_crud.create(db_session, obj_in=component_data)

        assert component is not None
        assert component.test_name == "Hemoglobin"
        assert component.abbreviation == "HGB"
        assert component.value == 14.5
        assert component.status == "normal"
        assert component.lab_result_id == test_lab_result.id
        assert component.canonical_test_name is None  # Not set by default

    def test_create_lab_test_component_with_canonical_name(self, db_session: Session, test_lab_result):
        """Test creating a lab test component with canonical test name."""
        component_data = LabTestComponentCreate(
            lab_result_id=test_lab_result.id,
            test_name="HGB",
            abbreviation="HGB",
            value=14.5,
            unit="g/dL",
            ref_range_min=12.0,
            ref_range_max=16.0,
            status="normal",
            category="hematology",
            canonical_test_name="Hemoglobin"
        )

        component = lab_test_component_crud.create(db_session, obj_in=component_data)

        assert component is not None
        assert component.test_name == "HGB"
        assert component.canonical_test_name == "Hemoglobin"

    def test_get_by_lab_result(self, db_session: Session, test_lab_result):
        """Test getting all components for a lab result."""
        components_data = [
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Hemoglobin",
                value=14.5,
                unit="g/dL",
                display_order=1
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="White Blood Cells",
                value=7.5,
                unit="K/uL",
                display_order=2
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Platelets",
                value=250,
                unit="K/uL",
                display_order=3
            )
        ]

        for comp_data in components_data:
            lab_test_component_crud.create(db_session, obj_in=comp_data)

        components = lab_test_component_crud.get_by_lab_result(
            db_session, lab_result_id=test_lab_result.id
        )

        assert len(components) == 3
        # Should be ordered by display_order
        assert components[0].display_order <= components[1].display_order

    def test_get_by_test_name(self, db_session: Session, test_lab_result):
        """Test getting components by test name."""
        components_data = [
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Glucose",
                value=95,
                unit="mg/dL"
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Glucose Fasting",
                value=90,
                unit="mg/dL"
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Cholesterol",
                value=180,
                unit="mg/dL"
            )
        ]

        for comp_data in components_data:
            lab_test_component_crud.create(db_session, obj_in=comp_data)

        glucose_results = lab_test_component_crud.get_by_test_name(
            db_session, test_name="Glucose"
        )

        assert len(glucose_results) == 2

    def test_get_by_abbreviation(self, db_session: Session, test_lab_result):
        """Test getting components by abbreviation."""
        component_data = LabTestComponentCreate(
            lab_result_id=test_lab_result.id,
            test_name="Hemoglobin A1c",
            abbreviation="HBA1C",
            value=5.7,
            unit="%"
        )
        lab_test_component_crud.create(db_session, obj_in=component_data)

        results = lab_test_component_crud.get_by_abbreviation(
            db_session, abbreviation="HBA1C"
        )

        assert len(results) == 1
        assert results[0].abbreviation == "HBA1C"

    def test_get_by_category(self, db_session: Session, test_lab_result):
        """Test getting components by category."""
        components_data = [
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Test 1",
                value=10,
                unit="unit",
                category="hematology"
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Test 2",
                value=20,
                unit="unit",
                category="chemistry"
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Test 3",
                value=30,
                unit="unit",
                category="hematology"
            )
        ]

        for comp_data in components_data:
            lab_test_component_crud.create(db_session, obj_in=comp_data)

        hematology = lab_test_component_crud.get_by_category(
            db_session, category="hematology"
        )

        assert len(hematology) == 2
        assert all(c.category == "hematology" for c in hematology)

    def test_get_by_status(self, db_session: Session, test_lab_result):
        """Test getting components by status."""
        components_data = [
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Normal Test",
                value=10,
                unit="unit",
                status="normal"
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="High Test",
                value=50,
                unit="unit",
                status="high"
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Another Normal",
                value=15,
                unit="unit",
                status="normal"
            )
        ]

        for comp_data in components_data:
            lab_test_component_crud.create(db_session, obj_in=comp_data)

        normal_results = lab_test_component_crud.get_by_status(
            db_session, status="normal"
        )

        assert len(normal_results) == 2
        assert all(c.status == "normal" for c in normal_results)

    def test_get_abnormal_results(self, db_session: Session, test_lab_result):
        """Test getting abnormal results."""
        components_data = [
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Normal",
                value=10,
                unit="unit",
                status="normal"
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="High",
                value=50,
                unit="unit",
                status="high"
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Low",
                value=2,
                unit="unit",
                status="low"
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Critical",
                value=1,
                unit="unit",
                status="critical"
            )
        ]

        for comp_data in components_data:
            lab_test_component_crud.create(db_session, obj_in=comp_data)

        abnormal = lab_test_component_crud.get_abnormal_results(
            db_session, lab_result_id=test_lab_result.id
        )

        assert len(abnormal) == 3
        statuses = [c.status for c in abnormal]
        assert "normal" not in statuses

    def test_get_critical_results(self, db_session: Session, test_lab_result):
        """Test getting critical results."""
        components_data = [
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Normal Test",
                value=10,
                unit="unit",
                status="normal"
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Critical Test",
                value=0.5,
                unit="unit",
                status="critical"
            )
        ]

        for comp_data in components_data:
            lab_test_component_crud.create(db_session, obj_in=comp_data)

        critical = lab_test_component_crud.get_critical_results(
            db_session, lab_result_id=test_lab_result.id
        )

        assert len(critical) == 1
        assert critical[0].status == "critical"

    def test_search_components(self, db_session: Session, test_lab_result):
        """Test searching components."""
        components_data = [
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Blood Glucose",
                abbreviation="GLU",
                value=95,
                unit="mg/dL"
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Glucose Tolerance",
                value=140,
                unit="mg/dL"
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Cholesterol",
                value=180,
                unit="mg/dL"
            )
        ]

        for comp_data in components_data:
            lab_test_component_crud.create(db_session, obj_in=comp_data)

        results = lab_test_component_crud.search_components(
            db_session, query_text="Glucose"
        )

        assert len(results) == 2

    def test_bulk_create(self, db_session: Session, test_lab_result):
        """Test bulk creating components."""
        components = [
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Test 1",
                value=10,
                unit="unit"
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Test 2",
                value=20,
                unit="unit"
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Test 3",
                value=30,
                unit="unit"
            )
        ]

        bulk_data = LabTestComponentBulkCreate(
            lab_result_id=test_lab_result.id,
            components=components
        )

        created = lab_test_component_crud.bulk_create(
            db_session, obj_in=bulk_data
        )

        assert len(created) == 3
        assert all(c.lab_result_id == test_lab_result.id for c in created)

    def test_bulk_create_with_canonical_names(self, db_session: Session, test_lab_result):
        """Test bulk creating components with canonical test names."""
        components = [
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="WBC",
                value=7.5,
                unit="K/uL",
                canonical_test_name="White Blood Cell Count"
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="HGB",
                value=14.5,
                unit="g/dL",
                canonical_test_name="Hemoglobin"
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="PLT",
                value=250,
                unit="K/uL",
                canonical_test_name="Platelet Count"
            )
        ]

        bulk_data = LabTestComponentBulkCreate(
            lab_result_id=test_lab_result.id,
            components=components
        )

        created = lab_test_component_crud.bulk_create(
            db_session, obj_in=bulk_data
        )

        assert len(created) == 3
        assert created[0].canonical_test_name == "White Blood Cell Count"
        assert created[1].canonical_test_name == "Hemoglobin"
        assert created[2].canonical_test_name == "Platelet Count"

    def test_get_statistics_by_lab_result(self, db_session: Session, test_lab_result):
        """Test getting statistics for a lab result."""
        components_data = [
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Test 1",
                value=10,
                unit="unit",
                status="normal",
                category="hematology"
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Test 2",
                value=50,
                unit="unit",
                status="high",
                category="chemistry"
            ),
            LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name="Test 3",
                value=1,
                unit="unit",
                status="critical",
                category="hematology"
            )
        ]

        for comp_data in components_data:
            lab_test_component_crud.create(db_session, obj_in=comp_data)

        stats = lab_test_component_crud.get_statistics_by_lab_result(
            db_session, lab_result_id=test_lab_result.id
        )

        assert stats["total_components"] == 3
        assert stats["normal_count"] == 1
        assert stats["critical_count"] == 1
        assert stats["abnormal_count"] == 2
        assert "hematology" in stats["category_breakdown"]
        assert stats["category_breakdown"]["hematology"] == 2

    def test_delete_by_lab_result(self, db_session: Session, test_lab_result):
        """Test deleting all components for a lab result."""
        # Create components
        for i in range(3):
            component_data = LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name=f"Test {i+1}",
                value=10 + i,
                unit="unit"
            )
            lab_test_component_crud.create(db_session, obj_in=component_data)

        # Delete all
        deleted_count = lab_test_component_crud.delete_by_lab_result(
            db_session, lab_result_id=test_lab_result.id
        )

        assert deleted_count == 3

        # Verify deleted
        remaining = lab_test_component_crud.get_by_lab_result(
            db_session, lab_result_id=test_lab_result.id
        )
        assert len(remaining) == 0

    def test_get_unique_test_names(self, db_session: Session, test_lab_result):
        """Test getting unique test names."""
        test_names = ["Hemoglobin", "Glucose", "Cholesterol", "Hemoglobin"]

        for i, name in enumerate(test_names):
            component_data = LabTestComponentCreate(
                lab_result_id=test_lab_result.id,
                test_name=name,
                value=10 + i,
                unit="unit"
            )
            lab_test_component_crud.create(db_session, obj_in=component_data)

        unique_names = lab_test_component_crud.get_unique_test_names(db_session)

        assert len(unique_names) == 3

    def test_update_component(self, db_session: Session, test_lab_result):
        """Test updating a component."""
        component_data = LabTestComponentCreate(
            lab_result_id=test_lab_result.id,
            test_name="Original Test",
            value=10,
            unit="mg/dL",
            status="normal"
        )
        created = lab_test_component_crud.create(db_session, obj_in=component_data)

        update_data = LabTestComponentUpdate(
            value=15,
            status="high",
            notes="Updated value"
        )

        updated = lab_test_component_crud.update(
            db_session, db_obj=created, obj_in=update_data
        )

        assert updated.value == 15
        assert updated.status == "high"
        assert updated.notes == "Updated value"
        assert updated.test_name == "Original Test"  # Unchanged

    def test_update_component_canonical_name(self, db_session: Session, test_lab_result):
        """Test updating a component's canonical test name."""
        component_data = LabTestComponentCreate(
            lab_result_id=test_lab_result.id,
            test_name="WBC",
            value=7.5,
            unit="K/uL"
        )
        created = lab_test_component_crud.create(db_session, obj_in=component_data)

        # Initially no canonical name
        assert created.canonical_test_name is None

        # Update with canonical name
        update_data = LabTestComponentUpdate(
            canonical_test_name="White Blood Cell Count"
        )

        updated = lab_test_component_crud.update(
            db_session, db_obj=created, obj_in=update_data
        )

        assert updated.canonical_test_name == "White Blood Cell Count"
        assert updated.test_name == "WBC"  # Original name unchanged

    def test_delete_component(self, db_session: Session, test_lab_result):
        """Test deleting a single component."""
        component_data = LabTestComponentCreate(
            lab_result_id=test_lab_result.id,
            test_name="To Delete",
            value=10,
            unit="unit"
        )
        created = lab_test_component_crud.create(db_session, obj_in=component_data)
        component_id = created.id

        deleted = lab_test_component_crud.delete(db_session, id=component_id)

        assert deleted is not None
        assert deleted.id == component_id

        # Verify deleted
        retrieved = lab_test_component_crud.get(db_session, id=component_id)
        assert retrieved is None

    def test_auto_calculate_status(self, db_session: Session, test_lab_result):
        """Test auto-calculation of status based on reference ranges."""
        # Low value
        low_component = LabTestComponentCreate(
            lab_result_id=test_lab_result.id,
            test_name="Low Test",
            value=5,
            unit="unit",
            ref_range_min=10,
            ref_range_max=20
        )
        low_created = lab_test_component_crud.create(db_session, obj_in=low_component)
        assert low_created.status == "low"

        # High value
        high_component = LabTestComponentCreate(
            lab_result_id=test_lab_result.id,
            test_name="High Test",
            value=25,
            unit="unit",
            ref_range_min=10,
            ref_range_max=20
        )
        high_created = lab_test_component_crud.create(db_session, obj_in=high_component)
        assert high_created.status == "high"

        # Normal value
        normal_component = LabTestComponentCreate(
            lab_result_id=test_lab_result.id,
            test_name="Normal Test",
            value=15,
            unit="unit",
            ref_range_min=10,
            ref_range_max=20
        )
        normal_created = lab_test_component_crud.create(db_session, obj_in=normal_component)
        assert normal_created.status == "normal"
