"""
Tests for Insurance CRUD operations.
"""
import pytest
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.crud.insurance import insurance as insurance_crud
from app.crud.patient import patient as patient_crud
from app.models.models import Insurance
from app.schemas.insurance import InsuranceCreate, InsuranceUpdate
from app.schemas.patient import PatientCreate


class TestInsuranceCRUD:
    """Test Insurance CRUD operations."""

    @pytest.fixture
    def test_patient(self, db_session: Session, test_user):
        """Create a test patient for insurance tests."""
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

    def test_create_insurance(self, db_session: Session, test_patient):
        """Test creating an insurance record."""
        insurance_data = InsuranceCreate(
            patient_id=test_patient.id,
            insurance_type="medical",
            company_name="Blue Cross Blue Shield",
            member_name="John Doe",
            member_id="BC123456",
            group_number="GRP001",
            effective_date=date(2024, 1, 1),
            status="active",
            is_primary=True
        )

        insurance = insurance_crud.create(db_session, obj_in=insurance_data)

        assert insurance is not None
        assert insurance.company_name == "Blue Cross Blue Shield"
        assert insurance.insurance_type == "medical"
        assert insurance.member_id == "BC123456"
        assert insurance.is_primary is True
        assert insurance.status == "active"
        assert insurance.patient_id == test_patient.id

    def test_get_by_patient(self, db_session: Session, test_patient):
        """Test getting all insurance records for a patient."""
        # Create multiple insurance records
        insurances = [
            InsuranceCreate(
                patient_id=test_patient.id,
                insurance_type="medical",
                company_name="Medical Insurance Co",
                member_name="John Doe",
                member_id="MED001",
                effective_date=date(2024, 1, 1),
                status="active"
            ),
            InsuranceCreate(
                patient_id=test_patient.id,
                insurance_type="dental",
                company_name="Dental Insurance Co",
                member_name="John Doe",
                member_id="DEN001",
                effective_date=date(2024, 1, 1),
                status="active"
            ),
            InsuranceCreate(
                patient_id=test_patient.id,
                insurance_type="vision",
                company_name="Vision Insurance Co",
                member_name="John Doe",
                member_id="VIS001",
                effective_date=date(2024, 1, 1),
                status="inactive"
            )
        ]

        for ins_data in insurances:
            insurance_crud.create(db_session, obj_in=ins_data)

        patient_insurances = insurance_crud.get_by_patient(
            db_session, patient_id=test_patient.id
        )

        assert len(patient_insurances) == 3

    def test_get_active_by_patient(self, db_session: Session, test_patient):
        """Test getting only active insurance records for a patient."""
        # Create active and inactive insurance records
        active_insurance = InsuranceCreate(
            patient_id=test_patient.id,
            insurance_type="medical",
            company_name="Active Insurance",
            member_name="John Doe",
            member_id="ACT001",
            effective_date=date(2024, 1, 1),
            status="active"
        )
        inactive_insurance = InsuranceCreate(
            patient_id=test_patient.id,
            insurance_type="dental",
            company_name="Inactive Insurance",
            member_name="John Doe",
            member_id="INA001",
            effective_date=date(2024, 1, 1),
            status="inactive"
        )

        insurance_crud.create(db_session, obj_in=active_insurance)
        insurance_crud.create(db_session, obj_in=inactive_insurance)

        active_insurances = insurance_crud.get_active_by_patient(
            db_session, patient_id=test_patient.id
        )

        assert len(active_insurances) == 1
        assert active_insurances[0].status == "active"
        assert active_insurances[0].company_name == "Active Insurance"

    def test_get_by_type(self, db_session: Session, test_patient):
        """Test getting insurance records by type."""
        # Create different types of insurance
        insurance_types = ["medical", "dental", "medical"]
        for i, ins_type in enumerate(insurance_types):
            insurance_data = InsuranceCreate(
                patient_id=test_patient.id,
                insurance_type=ins_type,
                company_name=f"Company {i+1}",
                member_name="John Doe",
                member_id=f"MEM{i+1:03d}",
                effective_date=date(2024, 1, 1),
                status="active"
            )
            insurance_crud.create(db_session, obj_in=insurance_data)

        medical_insurances = insurance_crud.get_by_type(
            db_session, patient_id=test_patient.id, insurance_type="medical"
        )

        assert len(medical_insurances) == 2

        dental_insurances = insurance_crud.get_by_type(
            db_session, patient_id=test_patient.id, insurance_type="dental"
        )

        assert len(dental_insurances) == 1

    def test_get_primary_medical(self, db_session: Session, test_patient):
        """Test getting the primary medical insurance."""
        # Create primary and secondary medical insurances
        primary_insurance = InsuranceCreate(
            patient_id=test_patient.id,
            insurance_type="medical",
            company_name="Primary Medical",
            member_name="John Doe",
            member_id="PRI001",
            effective_date=date(2024, 1, 1),
            status="active",
            is_primary=True
        )
        secondary_insurance = InsuranceCreate(
            patient_id=test_patient.id,
            insurance_type="medical",
            company_name="Secondary Medical",
            member_name="John Doe",
            member_id="SEC001",
            effective_date=date(2024, 1, 1),
            status="active",
            is_primary=False
        )

        insurance_crud.create(db_session, obj_in=primary_insurance)
        insurance_crud.create(db_session, obj_in=secondary_insurance)

        primary = insurance_crud.get_primary_medical(
            db_session, patient_id=test_patient.id
        )

        assert primary is not None
        assert primary.company_name == "Primary Medical"
        assert primary.is_primary is True

    def test_get_primary_medical_none(self, db_session: Session, test_patient):
        """Test getting primary medical when none exists."""
        # Create non-primary insurance
        insurance_data = InsuranceCreate(
            patient_id=test_patient.id,
            insurance_type="medical",
            company_name="Non-Primary",
            member_name="John Doe",
            member_id="NP001",
            effective_date=date(2024, 1, 1),
            status="active",
            is_primary=False
        )
        insurance_crud.create(db_session, obj_in=insurance_data)

        primary = insurance_crud.get_primary_medical(
            db_session, patient_id=test_patient.id
        )

        assert primary is None

    def test_get_by_status(self, db_session: Session, test_patient):
        """Test getting insurance records by status."""
        statuses = ["active", "inactive", "expired", "active"]
        for i, status in enumerate(statuses):
            insurance_data = InsuranceCreate(
                patient_id=test_patient.id,
                insurance_type="medical",
                company_name=f"Company {i+1}",
                member_name="John Doe",
                member_id=f"STA{i+1:03d}",
                effective_date=date(2024, 1, 1),
                status=status
            )
            insurance_crud.create(db_session, obj_in=insurance_data)

        active = insurance_crud.get_by_status(
            db_session, patient_id=test_patient.id, status="active"
        )
        assert len(active) == 2

        inactive = insurance_crud.get_by_status(
            db_session, patient_id=test_patient.id, status="inactive"
        )
        assert len(inactive) == 1

        expired = insurance_crud.get_by_status(
            db_session, patient_id=test_patient.id, status="expired"
        )
        assert len(expired) == 1

    def test_update_status(self, db_session: Session, test_patient):
        """Test updating insurance status."""
        insurance_data = InsuranceCreate(
            patient_id=test_patient.id,
            insurance_type="medical",
            company_name="Test Insurance",
            member_name="John Doe",
            member_id="UPD001",
            effective_date=date(2024, 1, 1),
            status="active"
        )
        created = insurance_crud.create(db_session, obj_in=insurance_data)

        updated = insurance_crud.update_status(
            db_session, insurance_id=created.id, status="inactive"
        )

        assert updated is not None
        assert updated.status == "inactive"

    def test_update_status_not_found(self, db_session: Session):
        """Test updating status for non-existent insurance."""
        updated = insurance_crud.update_status(
            db_session, insurance_id=99999, status="inactive"
        )

        assert updated is None

    def test_set_primary(self, db_session: Session, test_patient):
        """Test setting insurance as primary."""
        # Create two medical insurances
        insurance1 = InsuranceCreate(
            patient_id=test_patient.id,
            insurance_type="medical",
            company_name="Insurance 1",
            member_name="John Doe",
            member_id="INS001",
            effective_date=date(2024, 1, 1),
            status="active",
            is_primary=True
        )
        insurance2 = InsuranceCreate(
            patient_id=test_patient.id,
            insurance_type="medical",
            company_name="Insurance 2",
            member_name="John Doe",
            member_id="INS002",
            effective_date=date(2024, 1, 1),
            status="active",
            is_primary=False
        )

        created1 = insurance_crud.create(db_session, obj_in=insurance1)
        created2 = insurance_crud.create(db_session, obj_in=insurance2)

        # Set insurance 2 as primary
        result = insurance_crud.set_primary(
            db_session, patient_id=test_patient.id, insurance_id=created2.id
        )

        assert result is not None
        assert result.is_primary is True

        # Verify insurance 1 is no longer primary
        db_session.refresh(created1)
        assert created1.is_primary is False

    def test_set_primary_wrong_patient(self, db_session: Session, test_user, test_admin_user):
        """Test setting primary fails for wrong patient."""
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

        # Create insurance for patient 1
        insurance_data = InsuranceCreate(
            patient_id=patient1.id,
            insurance_type="medical",
            company_name="Test Insurance",
            member_name="John Doe",
            member_id="TEST001",
            effective_date=date(2024, 1, 1),
            status="active"
        )
        created = insurance_crud.create(db_session, obj_in=insurance_data)

        # Try to set as primary for wrong patient
        result = insurance_crud.set_primary(
            db_session, patient_id=patient2.id, insurance_id=created.id
        )

        assert result is None

    def test_get_expiring_soon(self, db_session: Session, test_patient):
        """Test getting insurance expiring soon."""
        today = date.today()

        # Create insurances with different expiration dates
        expirations = [
            today + timedelta(days=10),  # Expiring soon
            today + timedelta(days=45),  # Not expiring within 30 days
            None,  # No expiration
            today + timedelta(days=20),  # Expiring soon
        ]

        for i, exp_date in enumerate(expirations):
            insurance_data = InsuranceCreate(
                patient_id=test_patient.id,
                insurance_type="medical",
                company_name=f"Company {i+1}",
                member_name="John Doe",
                member_id=f"EXP{i+1:03d}",
                effective_date=date(2024, 1, 1),
                expiration_date=exp_date,
                status="active"
            )
            insurance_crud.create(db_session, obj_in=insurance_data)

        expiring = insurance_crud.get_expiring_soon(
            db_session, patient_id=test_patient.id, days=30
        )

        assert len(expiring) == 2
        # Should be ordered by expiration date
        assert expiring[0].expiration_date <= expiring[1].expiration_date

    def test_get_expiring_soon_inactive_excluded(self, db_session: Session, test_patient):
        """Test that inactive insurances are excluded from expiring soon."""
        today = date.today()

        # Create active expiring insurance
        active_insurance = InsuranceCreate(
            patient_id=test_patient.id,
            insurance_type="medical",
            company_name="Active Expiring",
            member_name="John Doe",
            member_id="AEX001",
            effective_date=date(2024, 1, 1),
            expiration_date=today + timedelta(days=15),
            status="active"
        )

        # Create inactive expiring insurance
        inactive_insurance = InsuranceCreate(
            patient_id=test_patient.id,
            insurance_type="medical",
            company_name="Inactive Expiring",
            member_name="John Doe",
            member_id="IEX001",
            effective_date=date(2024, 1, 1),
            expiration_date=today + timedelta(days=15),
            status="inactive"
        )

        insurance_crud.create(db_session, obj_in=active_insurance)
        insurance_crud.create(db_session, obj_in=inactive_insurance)

        expiring = insurance_crud.get_expiring_soon(
            db_session, patient_id=test_patient.id, days=30
        )

        assert len(expiring) == 1
        assert expiring[0].company_name == "Active Expiring"

    def test_search_by_company(self, db_session: Session, test_patient):
        """Test searching insurance by company name."""
        companies = [
            "Blue Cross Blue Shield",
            "Aetna Health",
            "Blue Shield California"
        ]

        for i, company in enumerate(companies):
            insurance_data = InsuranceCreate(
                patient_id=test_patient.id,
                insurance_type="medical",
                company_name=company,
                member_name="John Doe",
                member_id=f"SCH{i+1:03d}",
                effective_date=date(2024, 1, 1),
                status="active"
            )
            insurance_crud.create(db_session, obj_in=insurance_data)

        # Search for "Blue"
        results = insurance_crud.search_by_company(
            db_session, patient_id=test_patient.id, company_name="Blue"
        )

        assert len(results) == 2
        company_names = [r.company_name for r in results]
        assert "Blue Cross Blue Shield" in company_names
        assert "Blue Shield California" in company_names

    def test_search_by_company_case_insensitive(self, db_session: Session, test_patient):
        """Test that company search is case insensitive."""
        insurance_data = InsuranceCreate(
            patient_id=test_patient.id,
            insurance_type="medical",
            company_name="United Healthcare",
            member_name="John Doe",
            member_id="UHC001",
            effective_date=date(2024, 1, 1),
            status="active"
        )
        insurance_crud.create(db_session, obj_in=insurance_data)

        # Search with different cases
        results_lower = insurance_crud.search_by_company(
            db_session, patient_id=test_patient.id, company_name="united"
        )
        results_upper = insurance_crud.search_by_company(
            db_session, patient_id=test_patient.id, company_name="HEALTHCARE"
        )

        assert len(results_lower) == 1
        assert len(results_upper) == 1

    def test_update_insurance(self, db_session: Session, test_patient):
        """Test updating an insurance record."""
        insurance_data = InsuranceCreate(
            patient_id=test_patient.id,
            insurance_type="medical",
            company_name="Original Company",
            member_name="John Doe",
            member_id="ORI001",
            effective_date=date(2024, 1, 1),
            status="active"
        )
        created = insurance_crud.create(db_session, obj_in=insurance_data)

        update_data = InsuranceUpdate(
            company_name="Updated Company",
            notes="Policy changed"
        )

        updated = insurance_crud.update(
            db_session, db_obj=created, obj_in=update_data
        )

        assert updated.company_name == "Updated Company"
        assert updated.notes == "Policy changed"
        assert updated.member_id == "ORI001"  # Unchanged

    def test_delete_insurance(self, db_session: Session, test_patient):
        """Test deleting an insurance record."""
        insurance_data = InsuranceCreate(
            patient_id=test_patient.id,
            insurance_type="medical",
            company_name="To Delete",
            member_name="John Doe",
            member_id="DEL001",
            effective_date=date(2024, 1, 1),
            status="active"
        )
        created = insurance_crud.create(db_session, obj_in=insurance_data)
        insurance_id = created.id

        deleted = insurance_crud.delete(db_session, id=insurance_id)

        assert deleted is not None
        assert deleted.id == insurance_id

        # Verify deleted
        retrieved = insurance_crud.get(db_session, id=insurance_id)
        assert retrieved is None
