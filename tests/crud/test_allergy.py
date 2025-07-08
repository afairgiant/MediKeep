"""
Tests for Allergy CRUD operations.
"""
import pytest
from datetime import date
from sqlalchemy.orm import Session

from app.crud.allergy import allergy as allergy_crud
from app.crud.patient import patient as patient_crud
from app.models.models import Allergy
from app.schemas.allergy import AllergyCreate, AllergyUpdate
from app.schemas.patient import PatientCreate


class TestAllergyCRUD:
    """Test Allergy CRUD operations."""

    @pytest.fixture
    def test_patient(self, db_session: Session, test_user):
        """Create a test patient for allergy tests."""
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

    def test_create_allergy(self, db_session: Session, test_patient):
        """Test creating an allergy record."""
        allergy_data = AllergyCreate(
            patient_id=test_patient.id,
            allergen="Penicillin",
            severity="severe",
            reaction="rash, difficulty breathing",
            onset_date=date(2023, 1, 1),
            status="active"
        )
        
        allergy = allergy_crud.create(db_session, obj_in=allergy_data)
        
        assert allergy is not None
        assert allergy.allergen == "Penicillin"
        assert allergy.severity == "severe"
        assert allergy.reaction == "rash, difficulty breathing"
        assert allergy.patient_id == test_patient.id
        assert allergy.status == "active"

    def test_get_active_allergies(self, db_session: Session, test_patient):
        """Test getting active allergies for a patient."""
        # Create active allergy
        active_allergy = AllergyCreate(
            patient_id=test_patient.id,
            allergen="Penicillin",
            severity="severe",
            reaction="rash",
            onset_date=date(2023, 1, 1),
            status="active"
        )
        
        # Create inactive allergy
        inactive_allergy = AllergyCreate(
            patient_id=test_patient.id,
            allergen="Shellfish",
            severity="mild",
            reaction="hives",
            onset_date=date(2023, 1, 1),
            status="inactive"
        )
        
        created_active = allergy_crud.create(db_session, obj_in=active_allergy)
        created_inactive = allergy_crud.create(db_session, obj_in=inactive_allergy)
        
        # Get active allergies
        active_allergies = allergy_crud.get_active_allergies(
            db_session, patient_id=test_patient.id
        )
        
        assert len(active_allergies) == 1
        assert active_allergies[0].id == created_active.id
        assert active_allergies[0].allergen == "Penicillin"
        assert active_allergies[0].status == "active"

    def test_get_critical_allergies(self, db_session: Session, test_patient):
        """Test getting critical allergies for a patient."""
        # Create allergies with different severities
        allergies_data = [
            AllergyCreate(
                patient_id=test_patient.id,
                allergen="Penicillin",
                severity="severe",
                reaction="anaphylaxis",
                onset_date=date(2023, 1, 1),
                status="active"
            ),
            AllergyCreate(
                patient_id=test_patient.id,
                allergen="Peanuts",
                severity="life-threatening",
                reaction="severe anaphylaxis",
                onset_date=date(2023, 1, 1),
                status="active"
            ),
            AllergyCreate(
                patient_id=test_patient.id,
                allergen="Shellfish",
                severity="mild",
                reaction="hives",
                onset_date=date(2023, 1, 1),
                status="active"
            )
        ]
        
        created_allergies = []
        for allergy_data in allergies_data:
            created_allergies.append(allergy_crud.create(db_session, obj_in=allergy_data))
        
        # Get critical allergies
        critical_allergies = allergy_crud.get_critical_allergies(
            db_session, patient_id=test_patient.id
        )
        
        assert len(critical_allergies) == 2
        
        # Should be ordered by severity (life-threatening first)
        assert critical_allergies[0].allergen == "Peanuts"
        assert critical_allergies[0].severity == "life-threatening"
        assert critical_allergies[1].allergen == "Penicillin"
        assert critical_allergies[1].severity == "severe"

    def test_get_by_severity(self, db_session: Session, test_patient):
        """Test getting allergies by severity."""
        # Create allergies with different severities
        allergies_data = [
            AllergyCreate(
                patient_id=test_patient.id,
                allergen="Penicillin",
                severity="severe",
                reaction="rash",
                onset_date=date(2023, 1, 1),
                status="active"
            ),
            AllergyCreate(
                patient_id=test_patient.id,
                allergen="Shellfish",
                severity="mild",
                reaction="hives",
                onset_date=date(2023, 1, 1),
                status="active"
            ),
            AllergyCreate(
                patient_id=test_patient.id,
                allergen="Dust",
                severity="mild",
                reaction="sneezing",
                onset_date=date(2023, 1, 1),
                status="active"
            )
        ]
        
        for allergy_data in allergies_data:
            allergy_crud.create(db_session, obj_in=allergy_data)
        
        # Get mild allergies
        mild_allergies = allergy_crud.get_by_severity(
            db_session, severity="mild", patient_id=test_patient.id
        )
        
        assert len(mild_allergies) == 2
        allergens = [allergy.allergen for allergy in mild_allergies]
        assert "Shellfish" in allergens
        assert "Dust" in allergens

    def test_get_by_allergen(self, db_session: Session, test_patient):
        """Test searching allergies by allergen."""
        # Create test allergies
        allergies_data = [
            AllergyCreate(
                patient_id=test_patient.id,
                allergen="Penicillin",
                severity="severe",
                reaction="rash",
                onset_date=date(2023, 1, 1),
                status="active"
            ),
            AllergyCreate(
                patient_id=test_patient.id,
                allergen="Ampicillin",
                severity="moderate",
                reaction="hives",
                onset_date=date(2023, 1, 1),
                status="active"
            ),
            AllergyCreate(
                patient_id=test_patient.id,
                allergen="Shellfish",
                severity="mild",
                reaction="stomach upset",
                onset_date=date(2023, 1, 1),
                status="active"
            )
        ]
        
        for allergy_data in allergies_data:
            allergy_crud.create(db_session, obj_in=allergy_data)
        
        # Search for allergies containing "cillin"
        results = allergy_crud.get_by_allergen(
            db_session, allergen="cillin", patient_id=test_patient.id
        )
        
        assert len(results) == 2
        allergens = [allergy.allergen for allergy in results]
        assert "Penicillin" in allergens
        assert "Ampicillin" in allergens

    def test_check_allergen_conflict(self, db_session: Session, test_patient):
        """Test checking for allergen conflicts."""
        # Create active allergy
        allergy_data = AllergyCreate(
            patient_id=test_patient.id,
            allergen="Penicillin",
            severity="severe",
            reaction="rash",
            onset_date=date(2023, 1, 1),
            status="active"
        )
        
        allergy_crud.create(db_session, obj_in=allergy_data)
        
        # Check for conflict with existing allergen
        has_conflict = allergy_crud.check_allergen_conflict(
            db_session, patient_id=test_patient.id, allergen="Penicillin"
        )
        
        assert has_conflict is True
        
        # Check for conflict with non-existing allergen
        no_conflict = allergy_crud.check_allergen_conflict(
            db_session, patient_id=test_patient.id, allergen="Aspirin"
        )
        
        assert no_conflict is False

    def test_check_allergen_conflict_inactive_allergy(self, db_session: Session, test_patient):
        """Test that inactive allergies don't trigger conflicts."""
        # Create inactive allergy
        allergy_data = AllergyCreate(
            patient_id=test_patient.id,
            allergen="Penicillin",
            severity="severe",
            reaction="rash",
            onset_date=date(2023, 1, 1),
            status="inactive"
        )
        
        allergy_crud.create(db_session, obj_in=allergy_data)
        
        # Check for conflict - should return False for inactive allergy
        has_conflict = allergy_crud.check_allergen_conflict(
            db_session, patient_id=test_patient.id, allergen="Penicillin"
        )
        
        assert has_conflict is False

    def test_update_allergy(self, db_session: Session, test_patient):
        """Test updating an allergy."""
        # Create allergy
        allergy_data = AllergyCreate(
            patient_id=test_patient.id,
            allergen="Penicillin",
            severity="moderate",
            reaction="rash",
            onset_date=date(2023, 1, 1),
            status="active"
        )
        
        created_allergy = allergy_crud.create(db_session, obj_in=allergy_data)
        
        # Update allergy
        update_data = AllergyUpdate(
            severity="severe",
            reaction="rash, difficulty breathing",
            notes="Severity increased after recent exposure"
        )
        
        updated_allergy = allergy_crud.update(
            db_session, db_obj=created_allergy, obj_in=update_data
        )
        
        assert updated_allergy.severity == "severe"
        assert updated_allergy.reaction == "rash, difficulty breathing"
        assert updated_allergy.notes == "Severity increased after recent exposure"
        assert updated_allergy.allergen == "Penicillin"  # Unchanged

    def test_delete_allergy(self, db_session: Session, test_patient):
        """Test deleting an allergy."""
        # Create allergy
        allergy_data = AllergyCreate(
            patient_id=test_patient.id,
            allergen="Penicillin",
            severity="severe",
            reaction="rash",
            onset_date=date(2023, 1, 1),
            status="active"
        )
        
        created_allergy = allergy_crud.create(db_session, obj_in=allergy_data)
        allergy_id = created_allergy.id
        
        # Delete allergy
        deleted_allergy = allergy_crud.delete(db_session, id=allergy_id)
        
        assert deleted_allergy is not None
        assert deleted_allergy.id == allergy_id
        
        # Verify allergy is deleted
        retrieved_allergy = allergy_crud.get(db_session, id=allergy_id)
        assert retrieved_allergy is None

    def test_allergy_severity_ordering(self, db_session: Session, test_patient):
        """Test that allergies are properly ordered by severity."""
        # Create allergies with different severities
        allergies_data = [
            AllergyCreate(
                patient_id=test_patient.id,
                allergen="Shellfish",
                severity="mild",
                reaction="hives",
                onset_date=date(2023, 1, 1),
                status="active"
            ),
            AllergyCreate(
                patient_id=test_patient.id,
                allergen="Penicillin",
                severity="severe",
                reaction="anaphylaxis",
                onset_date=date(2023, 1, 1),
                status="active"
            ),
            AllergyCreate(
                patient_id=test_patient.id,
                allergen="Dust",
                severity="moderate",
                reaction="sneezing",
                onset_date=date(2023, 1, 1),
                status="active"
            )
        ]
        
        for allergy_data in allergies_data:
            allergy_crud.create(db_session, obj_in=allergy_data)
        
        # Get active allergies (should be ordered by severity desc)
        active_allergies = allergy_crud.get_active_allergies(
            db_session, patient_id=test_patient.id
        )
        
        assert len(active_allergies) == 3
        
        # Verify ordering: severe, moderate, mild
        assert active_allergies[0].severity == "severe"
        assert active_allergies[1].severity == "moderate"
        assert active_allergies[2].severity == "mild"