"""
Tests for Immunization CRUD operations.
"""
import pytest
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.crud.immunization import immunization as immunization_crud
from app.crud.patient import patient as patient_crud
from app.crud.practitioner import practitioner as practitioner_crud
from app.models.models import Immunization
from app.schemas.immunization import ImmunizationCreate, ImmunizationUpdate
from app.schemas.patient import PatientCreate
from app.schemas.practitioner import PractitionerCreate


class TestImmunizationCRUD:
    """Test Immunization CRUD operations."""

    @pytest.fixture
    def test_patient(self, db_session: Session, test_user):
        """Create a test patient for immunization tests."""
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
        """Create a test practitioner for immunization tests."""
        practitioner_data = PractitionerCreate(
            name="Dr. Sarah Johnson",
            specialty="Immunology",
            practice="City Health Center",
            phone_number="555-555-0123"
        )
        return practitioner_crud.create(db_session, obj_in=practitioner_data)

    def test_create_immunization(self, db_session: Session, test_patient, test_practitioner):
        """Test creating an immunization record."""
        immunization_data = ImmunizationCreate(
            patient_id=test_patient.id,
            vaccine_name="COVID-19 Vaccine",
            date_administered=date(2024, 1, 15),
            dose_number=1,
            lot_number="ABC123",
            manufacturer="Pfizer",
            site="Left arm",
            route="intramuscular",
            expiration_date=date(2024, 6, 15),
            notes="First dose of COVID-19 vaccine series",
            practitioner_id=test_practitioner.id
        )
        
        immunization = immunization_crud.create(db_session, obj_in=immunization_data)
        
        assert immunization is not None
        assert immunization.vaccine_name == "COVID-19 Vaccine"
        assert immunization.date_administered == date(2024, 1, 15)
        assert immunization.dose_number == 1
        assert immunization.lot_number == "ABC123"
        assert immunization.manufacturer == "Pfizer"
        assert immunization.site == "Left arm"
        assert immunization.route == "intramuscular"
        assert immunization.expiration_date == date(2024, 6, 15)
        assert immunization.notes == "First dose of COVID-19 vaccine series"
        assert immunization.patient_id == test_patient.id
        assert immunization.practitioner_id == test_practitioner.id

    def test_get_immunization_by_id(self, db_session: Session, test_patient, test_practitioner):
        """Test retrieving an immunization by ID."""
        immunization_data = ImmunizationCreate(
            patient_id=test_patient.id,
            vaccine_name="Flu Vaccine",
            date_administered=date(2024, 1, 10),
            dose_number=1,
            practitioner_id=test_practitioner.id
        )
        
        created_immunization = immunization_crud.create(db_session, obj_in=immunization_data)
        
        retrieved_immunization = immunization_crud.get(db_session, id=created_immunization.id)
        
        assert retrieved_immunization is not None
        assert retrieved_immunization.id == created_immunization.id
        assert retrieved_immunization.vaccine_name == "Flu Vaccine"
        assert retrieved_immunization.patient_id == test_patient.id

    def test_get_immunizations_by_patient(self, db_session: Session, test_patient, test_practitioner, test_user):
        """Test getting immunizations filtered by patient."""
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
        
        # Create immunizations for different patients
        immunization1_data = ImmunizationCreate(
            patient_id=test_patient.id,
            vaccine_name="Hepatitis B",
            date_administered=date(2024, 1, 10),
            practitioner_id=test_practitioner.id
        )
        
        immunization2_data = ImmunizationCreate(
            patient_id=other_patient.id,
            vaccine_name="Tetanus",
            date_administered=date(2024, 1, 15),
            practitioner_id=test_practitioner.id
        )
        
        created_immunization1 = immunization_crud.create(db_session, obj_in=immunization1_data)
        immunization_crud.create(db_session, obj_in=immunization2_data)
        
        # Get immunizations for specific patient
        patient_immunizations = immunization_crud.query(
            db_session, filters={"patient_id": test_patient.id}
        )
        
        assert len(patient_immunizations) == 1
        assert patient_immunizations[0].id == created_immunization1.id
        assert patient_immunizations[0].patient_id == test_patient.id

    def test_update_immunization(self, db_session: Session, test_patient, test_practitioner):
        """Test updating an immunization record."""
        # Create immunization
        immunization_data = ImmunizationCreate(
            patient_id=test_patient.id,
            vaccine_name="Measles, Mumps, Rubella",
            date_administered=date(2024, 1, 10),
            dose_number=1,
            notes="First dose",
            practitioner_id=test_practitioner.id
        )
        
        created_immunization = immunization_crud.create(db_session, obj_in=immunization_data)
        
        # Update immunization
        update_data = ImmunizationUpdate(
            dose_number=2,
            notes="Second dose - booster",
            lot_number="XYZ789",
            manufacturer="Merck"
        )
        
        updated_immunization = immunization_crud.update(
            db_session, db_obj=created_immunization, obj_in=update_data
        )
        
        assert updated_immunization.dose_number == 2
        assert updated_immunization.notes == "Second dose - booster"
        assert updated_immunization.lot_number == "XYZ789"
        assert updated_immunization.manufacturer == "Merck"
        assert updated_immunization.vaccine_name == "Measles, Mumps, Rubella"  # Unchanged

    def test_delete_immunization(self, db_session: Session, test_patient, test_practitioner):
        """Test deleting an immunization record."""
        # Create immunization
        immunization_data = ImmunizationCreate(
            patient_id=test_patient.id,
            vaccine_name="Polio",
            date_administered=date(2024, 1, 10),
            practitioner_id=test_practitioner.id
        )
        
        created_immunization = immunization_crud.create(db_session, obj_in=immunization_data)
        immunization_id = created_immunization.id
        
        # Delete immunization
        deleted_immunization = immunization_crud.delete(db_session, id=immunization_id)
        
        assert deleted_immunization is not None
        assert deleted_immunization.id == immunization_id
        
        # Verify immunization is deleted
        retrieved_immunization = immunization_crud.get(db_session, id=immunization_id)
        assert retrieved_immunization is None

    def test_get_by_vaccine_name(self, db_session: Session, test_patient, test_practitioner):
        """Test searching immunizations by vaccine name."""
        # Create multiple immunizations
        immunizations_data = [
            ImmunizationCreate(
                patient_id=test_patient.id,
                vaccine_name="COVID-19 Vaccine",
                date_administered=date(2024, 1, 10),
                dose_number=1,
                practitioner_id=test_practitioner.id
            ),
            ImmunizationCreate(
                patient_id=test_patient.id,
                vaccine_name="COVID-19 Vaccine",
                date_administered=date(2024, 2, 10),
                dose_number=2,
                practitioner_id=test_practitioner.id
            ),
            ImmunizationCreate(
                patient_id=test_patient.id,
                vaccine_name="Flu Vaccine",
                date_administered=date(2024, 1, 15),
                practitioner_id=test_practitioner.id
            )
        ]
        
        for immunization_data in immunizations_data:
            immunization_crud.create(db_session, obj_in=immunization_data)
        
        # Search for COVID-19 vaccines
        covid_vaccines = immunization_crud.get_by_vaccine(
            db_session, vaccine_name="COVID-19 Vaccine", patient_id=test_patient.id
        )
        
        assert len(covid_vaccines) == 2
        for vaccine in covid_vaccines:
            assert "COVID-19" in vaccine.vaccine_name

    def test_get_recent_immunizations(self, db_session: Session, test_patient, test_practitioner):
        """Test getting recent immunizations within specified days."""
        # Create immunizations with different dates
        recent_immunization = ImmunizationCreate(
            patient_id=test_patient.id,
            vaccine_name="Recent Vaccine",
            date_administered=date.today() - timedelta(days=30),
            practitioner_id=test_practitioner.id
        )
        
        old_immunization = ImmunizationCreate(
            patient_id=test_patient.id,
            vaccine_name="Old Vaccine",
            date_administered=date.today() - timedelta(days=400),
            practitioner_id=test_practitioner.id
        )
        
        created_recent = immunization_crud.create(db_session, obj_in=recent_immunization)
        immunization_crud.create(db_session, obj_in=old_immunization)
        
        # Get recent immunizations (last 365 days)
        recent_immunizations = immunization_crud.get_recent_immunizations(
            db_session, patient_id=test_patient.id, days=365
        )
        
        assert len(recent_immunizations) == 1
        assert recent_immunizations[0].id == created_recent.id
        assert recent_immunizations[0].vaccine_name == "Recent Vaccine"

    def test_get_due_for_booster(self, db_session: Session, test_patient, test_practitioner):
        """Test checking if patient is due for booster shot."""
        # Test case 1: No previous vaccination - should be due
        is_due = immunization_crud.get_due_for_booster(
            db_session, 
            patient_id=test_patient.id,
            vaccine_name="Tetanus",
            months_interval=12
        )
        assert is_due is True
        
        # Test case 2: Recent vaccination - should not be due
        recent_immunization = ImmunizationCreate(
            patient_id=test_patient.id,
            vaccine_name="Tetanus",
            date_administered=date.today() - timedelta(days=30),
            practitioner_id=test_practitioner.id
        )
        immunization_crud.create(db_session, obj_in=recent_immunization)
        
        is_due = immunization_crud.get_due_for_booster(
            db_session, 
            patient_id=test_patient.id,
            vaccine_name="Tetanus",
            months_interval=12
        )
        assert is_due is False
        
        # Test case 3: Old vaccination - should be due
        old_immunization = ImmunizationCreate(
            patient_id=test_patient.id,
            vaccine_name="Hepatitis B",
            date_administered=date.today() - timedelta(days=400),
            practitioner_id=test_practitioner.id
        )
        immunization_crud.create(db_session, obj_in=old_immunization)
        
        is_due = immunization_crud.get_due_for_booster(
            db_session, 
            patient_id=test_patient.id,
            vaccine_name="Hepatitis B",
            months_interval=12
        )
        assert is_due is True

    def test_route_validation(self, db_session: Session, test_patient, test_practitioner):
        """Test vaccine route validation."""
        # Test valid route
        valid_immunization = ImmunizationCreate(
            patient_id=test_patient.id,
            vaccine_name="Vaccine with Valid Route",
            date_administered=date(2024, 1, 15),
            route="intramuscular",
            practitioner_id=test_practitioner.id
        )
        
        immunization = immunization_crud.create(db_session, obj_in=valid_immunization)
        assert immunization.route == "intramuscular"
        
        # Test route normalization (should convert to lowercase)
        normalized_immunization = ImmunizationCreate(
            patient_id=test_patient.id,
            vaccine_name="Vaccine with Normalized Route",
            date_administered=date(2024, 1, 16),
            route="SUBCUTANEOUS",
            practitioner_id=test_practitioner.id
        )
        
        immunization = immunization_crud.create(db_session, obj_in=normalized_immunization)
        assert immunization.route == "subcutaneous"

    def test_date_validation(self, db_session: Session, test_patient, test_practitioner):
        """Test date validation for immunizations."""
        # Test valid dates
        immunization_data = ImmunizationCreate(
            patient_id=test_patient.id,
            vaccine_name="Date Validation Test",
            date_administered=date(2024, 1, 10),
            expiration_date=date(2024, 6, 10),
            practitioner_id=test_practitioner.id
        )
        
        immunization = immunization_crud.create(db_session, obj_in=immunization_data)
        assert immunization.date_administered == date(2024, 1, 10)
        assert immunization.expiration_date == date(2024, 6, 10)

    def test_vaccine_series_tracking(self, db_session: Session, test_patient, test_practitioner):
        """Test tracking of vaccine series (multiple doses)."""
        # Create a vaccine series
        vaccine_series = [
            ImmunizationCreate(
                patient_id=test_patient.id,
                vaccine_name="Hepatitis A",
                date_administered=date(2024, 1, 15),
                dose_number=1,
                notes="First dose of Hepatitis A series",
                practitioner_id=test_practitioner.id
            ),
            ImmunizationCreate(
                patient_id=test_patient.id,
                vaccine_name="Hepatitis A",
                date_administered=date(2024, 7, 15),
                dose_number=2,
                notes="Second dose of Hepatitis A series",
                practitioner_id=test_practitioner.id
            )
        ]
        
        created_doses = []
        for dose_data in vaccine_series:
            dose = immunization_crud.create(db_session, obj_in=dose_data)
            created_doses.append(dose)
        
        # Get all doses for this vaccine
        all_doses = immunization_crud.get_by_vaccine(
            db_session, vaccine_name="Hepatitis A", patient_id=test_patient.id
        )
        
        assert len(all_doses) == 2
        
        # Verify doses are ordered by date (most recent first)
        assert all_doses[0].dose_number == 2
        assert all_doses[1].dose_number == 1
        assert all_doses[0].date_administered > all_doses[1].date_administered

    def test_immunization_with_minimal_data(self, db_session: Session, test_patient, test_practitioner):
        """Test creating immunization with only required fields."""
        minimal_immunization = ImmunizationCreate(
            patient_id=test_patient.id,
            vaccine_name="Minimal Vaccine",
            date_administered=date(2024, 1, 15),
            practitioner_id=test_practitioner.id
        )
        
        immunization = immunization_crud.create(db_session, obj_in=minimal_immunization)
        
        assert immunization is not None
        assert immunization.vaccine_name == "Minimal Vaccine"
        assert immunization.date_administered == date(2024, 1, 15)
        assert immunization.patient_id == test_patient.id
        assert immunization.practitioner_id == test_practitioner.id
        # Optional fields should be None
        assert immunization.dose_number is None
        assert immunization.lot_number is None
        assert immunization.manufacturer is None

    def test_immunization_pagination(self, db_session: Session, test_patient, test_practitioner):
        """Test pagination of immunization records."""
        # Create multiple immunizations
        for i in range(7):
            immunization_data = ImmunizationCreate(
                patient_id=test_patient.id,
                vaccine_name=f"Vaccine {i}",
                date_administered=date(2024, 1, i + 1),
                practitioner_id=test_practitioner.id
            )
            immunization_crud.create(db_session, obj_in=immunization_data)
        
        # Test pagination
        first_page = immunization_crud.query(
            db_session, 
            filters={"patient_id": test_patient.id},
            skip=0, 
            limit=3
        )
        second_page = immunization_crud.query(
            db_session, 
            filters={"patient_id": test_patient.id},
            skip=3, 
            limit=3
        )
        
        assert len(first_page) == 3
        assert len(second_page) == 3
        
        # Verify no overlap
        first_page_ids = {imm.id for imm in first_page}
        second_page_ids = {imm.id for imm in second_page}
        assert first_page_ids.isdisjoint(second_page_ids)

    def test_immunization_search_functionality(self, db_session: Session, test_patient, test_practitioner):
        """Test search functionality for immunizations."""
        # Create immunizations with different vaccine names
        vaccines_data = [
            ImmunizationCreate(
                patient_id=test_patient.id,
                vaccine_name="Influenza Vaccine",
                date_administered=date(2024, 1, 10),
                practitioner_id=test_practitioner.id
            ),
            ImmunizationCreate(
                patient_id=test_patient.id,
                vaccine_name="Influenza Booster",
                date_administered=date(2024, 2, 10),
                practitioner_id=test_practitioner.id
            ),
            ImmunizationCreate(
                patient_id=test_patient.id,
                vaccine_name="COVID-19 Vaccine",
                date_administered=date(2024, 1, 15),
                practitioner_id=test_practitioner.id
            )
        ]
        
        for vaccine_data in vaccines_data:
            immunization_crud.create(db_session, obj_in=vaccine_data)
        
        # Search for influenza vaccines
        influenza_vaccines = immunization_crud.query(
            db_session,
            filters={"patient_id": test_patient.id},
            search={"field": "vaccine_name", "term": "Influenza"}
        )
        
        assert len(influenza_vaccines) == 2
        for vaccine in influenza_vaccines:
            assert "Influenza" in vaccine.vaccine_name

    def test_immunization_ordering(self, db_session: Session, test_patient, test_practitioner):
        """Test that immunizations are ordered correctly by date."""
        # Create immunizations with different dates
        immunization1_data = ImmunizationCreate(
            patient_id=test_patient.id,
            vaccine_name="Vaccine 1",
            date_administered=date(2024, 1, 10),
            practitioner_id=test_practitioner.id
        )
        
        immunization2_data = ImmunizationCreate(
            patient_id=test_patient.id,
            vaccine_name="Vaccine 2",
            date_administered=date(2024, 1, 20),
            practitioner_id=test_practitioner.id
        )
        
        immunization3_data = ImmunizationCreate(
            patient_id=test_patient.id,
            vaccine_name="Vaccine 3",
            date_administered=date(2024, 1, 15),
            practitioner_id=test_practitioner.id
        )
        
        immunization_crud.create(db_session, obj_in=immunization1_data)
        immunization_crud.create(db_session, obj_in=immunization2_data)
        immunization_crud.create(db_session, obj_in=immunization3_data)
        
        # Get immunizations ordered by date (most recent first)
        ordered_immunizations = immunization_crud.query(
            db_session,
            filters={"patient_id": test_patient.id},
            order_by="date_administered",
            order_desc=True
        )
        
        assert len(ordered_immunizations) == 3
        assert ordered_immunizations[0].vaccine_name == "Vaccine 2"  # Most recent (Jan 20)
        assert ordered_immunizations[1].vaccine_name == "Vaccine 3"  # Middle (Jan 15)
        assert ordered_immunizations[2].vaccine_name == "Vaccine 1"  # Oldest (Jan 10)