"""
Tests for Emergency Contact CRUD operations.
"""
import pytest
from datetime import date
from sqlalchemy.orm import Session

from app.crud.emergency_contact import emergency_contact as emergency_contact_crud
from app.crud.patient import patient as patient_crud
from app.models.models import EmergencyContact
from app.schemas.emergency_contact import EmergencyContactCreate, EmergencyContactUpdate
from app.schemas.patient import PatientCreate


class TestEmergencyContactCRUD:
    """Test Emergency Contact CRUD operations."""

    @pytest.fixture
    def test_patient(self, db_session: Session, test_user):
        """Create a test patient for emergency contact tests."""
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

    def test_create_emergency_contact(self, db_session: Session, test_patient):
        """Test creating an emergency contact record."""
        contact_data = EmergencyContactCreate(
            name="Jane Doe",
            relationship="spouse",
            phone_number="555-123-4567",
            secondary_phone="555-987-6543",
            email="jane.doe@example.com",
            is_primary=True,
            is_active=True,
            address="123 Main St, Anytown, USA",
            notes="Available 24/7"
        )
        
        contact = emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=contact_data
        )
        
        assert contact is not None
        assert contact.name == "Jane Doe"
        assert contact.relationship == "spouse"
        assert contact.phone_number == "555-123-4567"
        assert contact.secondary_phone == "555-987-6543"
        assert contact.email == "jane.doe@example.com"
        assert contact.is_primary is True
        assert contact.is_active is True
        assert contact.address == "123 Main St, Anytown, USA"
        assert contact.notes == "Available 24/7"
        assert contact.patient_id == test_patient.id

    def test_get_emergency_contact_by_id(self, db_session: Session, test_patient):
        """Test retrieving an emergency contact by ID."""
        contact_data = EmergencyContactCreate(
            name="Bob Smith",
            relationship="friend",
            phone_number="555-111-2222",
            is_primary=False,
            is_active=True
        )
        
        created_contact = emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=contact_data
        )
        
        retrieved_contact = emergency_contact_crud.get(db_session, id=created_contact.id)
        
        assert retrieved_contact is not None
        assert retrieved_contact.id == created_contact.id
        assert retrieved_contact.name == "Bob Smith"
        assert retrieved_contact.relationship == "friend"
        assert retrieved_contact.patient_id == test_patient.id

    def test_get_contacts_by_patient_id(self, db_session: Session, test_patient, test_user):
        """Test getting all emergency contacts for a patient."""
        # Create another user and patient for isolation testing
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
        
        # Create contacts for different patients
        contact1_data = EmergencyContactCreate(
            name="Alice Johnson",
            relationship="parent",
            phone_number="555-111-1111"
        )
        
        contact2_data = EmergencyContactCreate(
            name="Bob Johnson",
            relationship="sibling",
            phone_number="555-222-2222"
        )
        
        contact3_data = EmergencyContactCreate(
            name="Charlie Brown",
            relationship="friend",
            phone_number="555-333-3333"
        )
        
        # Create contacts for test_patient
        created_contact1 = emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=contact1_data
        )
        created_contact2 = emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=contact2_data
        )
        
        # Create contact for other_patient
        emergency_contact_crud.create_for_patient(
            db_session, patient_id=other_patient.id, obj_in=contact3_data
        )
        
        # Get contacts for specific patient
        patient_contacts = emergency_contact_crud.get_by_patient_id(
            db_session, patient_id=test_patient.id
        )
        
        assert len(patient_contacts) == 2
        contact_names = {contact.name for contact in patient_contacts}
        assert contact_names == {"Alice Johnson", "Bob Johnson"}
        
        # Verify patient isolation
        for contact in patient_contacts:
            assert contact.patient_id == test_patient.id

    def test_update_emergency_contact(self, db_session: Session, test_patient):
        """Test updating an emergency contact."""
        # Create contact
        contact_data = EmergencyContactCreate(
            name="Mary Wilson",
            relationship="parent",
            phone_number="555-444-5555",
            email="mary.wilson@example.com",
            is_primary=False,
            notes="Original notes"
        )
        
        created_contact = emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=contact_data
        )
        
        # Update contact
        update_data = EmergencyContactUpdate(
            phone_number="555-555-6666",
            email="mary.wilson.updated@example.com",
            is_primary=True,
            notes="Updated notes - new phone number"
        )
        
        updated_contact = emergency_contact_crud.update(
            db_session, db_obj=created_contact, obj_in=update_data
        )
        
        assert updated_contact.phone_number == "555-555-6666"
        assert updated_contact.email == "mary.wilson.updated@example.com"
        assert updated_contact.is_primary is True
        assert updated_contact.notes == "Updated notes - new phone number"
        assert updated_contact.name == "Mary Wilson"  # Unchanged
        assert updated_contact.relationship == "parent"  # Unchanged

    def test_delete_emergency_contact(self, db_session: Session, test_patient):
        """Test deleting an emergency contact."""
        # Create contact
        contact_data = EmergencyContactCreate(
            name="David Brown",
            relationship="neighbor",
            phone_number="555-777-8888"
        )
        
        created_contact = emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=contact_data
        )
        contact_id = created_contact.id
        
        # Delete contact
        deleted_contact = emergency_contact_crud.delete(db_session, id=contact_id)
        
        assert deleted_contact is not None
        assert deleted_contact.id == contact_id
        
        # Verify contact is deleted
        retrieved_contact = emergency_contact_crud.get(db_session, id=contact_id)
        assert retrieved_contact is None

    def test_primary_contact_management(self, db_session: Session, test_patient):
        """Test primary contact management functionality."""
        # Create first contact as primary
        contact1_data = EmergencyContactCreate(
            name="Primary Contact 1",
            relationship="spouse",
            phone_number="555-111-1111",
            is_primary=True
        )
        
        contact1 = emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=contact1_data
        )
        
        # Verify it's primary
        primary_contact = emergency_contact_crud.get_primary_contact(
            db_session, patient_id=test_patient.id
        )
        assert primary_contact is not None
        assert primary_contact.id == contact1.id
        assert primary_contact.is_primary is True
        
        # Create second contact as primary - should unset the first
        contact2_data = EmergencyContactCreate(
            name="Primary Contact 2",
            relationship="parent",
            phone_number="555-222-2222",
            is_primary=True
        )
        
        contact2 = emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=contact2_data
        )
        
        # Verify second contact is now primary
        primary_contact = emergency_contact_crud.get_primary_contact(
            db_session, patient_id=test_patient.id
        )
        assert primary_contact.id == contact2.id
        assert primary_contact.is_primary is True
        
        # Verify first contact is no longer primary
        db_session.refresh(contact1)
        assert contact1.is_primary is False

    def test_set_primary_contact(self, db_session: Session, test_patient):
        """Test setting a contact as primary using the set_primary_contact method."""
        # Create two contacts, both non-primary
        contact1_data = EmergencyContactCreate(
            name="Contact 1",
            relationship="friend",
            phone_number="555-111-1111",
            is_primary=False
        )
        
        contact2_data = EmergencyContactCreate(
            name="Contact 2",
            relationship="sibling",
            phone_number="555-222-2222",
            is_primary=False
        )
        
        contact1 = emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=contact1_data
        )
        contact2 = emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=contact2_data
        )
        
        # Set contact2 as primary
        updated_contact = emergency_contact_crud.set_primary_contact(
            db_session, contact_id=contact2.id, patient_id=test_patient.id
        )
        
        assert updated_contact.id == contact2.id
        assert updated_contact.is_primary is True
        
        # Verify it's the primary contact
        primary_contact = emergency_contact_crud.get_primary_contact(
            db_session, patient_id=test_patient.id
        )
        assert primary_contact.id == contact2.id

    def test_get_active_contacts(self, db_session: Session, test_patient):
        """Test getting only active emergency contacts."""
        # Create active and inactive contacts
        active_contact_data = EmergencyContactCreate(
            name="Active Contact",
            relationship="spouse",
            phone_number="555-111-1111",
            is_primary=True,
            is_active=True
        )
        
        inactive_contact_data = EmergencyContactCreate(
            name="Inactive Contact",
            relationship="friend",
            phone_number="555-222-2222",
            is_primary=False,
            is_active=False
        )
        
        active_contact = emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=active_contact_data
        )
        emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=inactive_contact_data
        )
        
        # Get active contacts
        active_contacts = emergency_contact_crud.get_active_contacts(
            db_session, patient_id=test_patient.id
        )
        
        assert len(active_contacts) == 1
        assert active_contacts[0].id == active_contact.id
        assert active_contacts[0].is_active is True

    def test_relationship_validation(self, db_session: Session, test_patient):
        """Test relationship validation and normalization."""
        # Test valid relationship
        contact_data = EmergencyContactCreate(
            name="Valid Relationship",
            relationship="spouse",
            phone_number="555-111-1111"
        )
        
        contact = emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=contact_data
        )
        assert contact.relationship == "spouse"
        
        # Test relationship normalization (should convert to lowercase)
        contact_data2 = EmergencyContactCreate(
            name="Normalized Relationship",
            relationship="PARENT",
            phone_number="555-222-2222"
        )
        
        contact2 = emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=contact_data2
        )
        assert contact2.relationship == "parent"

    def test_phone_number_validation(self, db_session: Session, test_patient):
        """Test phone number validation."""
        # Test valid phone numbers
        contact_data = EmergencyContactCreate(
            name="Valid Phone",
            relationship="friend",
            phone_number="555-123-4567",
            secondary_phone="(555) 987-6543"
        )
        
        contact = emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=contact_data
        )
        assert contact.phone_number == "555-123-4567"
        assert contact.secondary_phone == "(555) 987-6543"

    def test_email_validation(self, db_session: Session, test_patient):
        """Test email validation and normalization."""
        # Test valid email
        contact_data = EmergencyContactCreate(
            name="Valid Email",
            relationship="sibling",
            phone_number="555-111-1111",
            email="Test.User@Example.COM"
        )
        
        contact = emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=contact_data
        )
        # Email should be normalized to lowercase
        assert contact.email == "test.user@example.com"

    def test_contact_ordering(self, db_session: Session, test_patient):
        """Test that contacts are ordered properly (primary first, then by name)."""
        # Create contacts in different order
        contact1_data = EmergencyContactCreate(
            name="Zebra Contact",
            relationship="friend",
            phone_number="555-111-1111",
            is_primary=False
        )
        
        contact2_data = EmergencyContactCreate(
            name="Alpha Contact",
            relationship="sibling",
            phone_number="555-222-2222",
            is_primary=True
        )
        
        contact3_data = EmergencyContactCreate(
            name="Beta Contact",
            relationship="parent",
            phone_number="555-333-3333",
            is_primary=False
        )
        
        emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=contact1_data
        )
        emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=contact2_data
        )
        emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=contact3_data
        )
        
        # Get active contacts (ordered by primary first, then name)
        active_contacts = emergency_contact_crud.get_active_contacts(
            db_session, patient_id=test_patient.id
        )
        
        assert len(active_contacts) == 3
        # Primary contact should be first
        assert active_contacts[0].name == "Alpha Contact"
        assert active_contacts[0].is_primary is True
        # Non-primary contacts should be ordered by name
        assert active_contacts[1].name == "Beta Contact"
        assert active_contacts[2].name == "Zebra Contact"

    def test_contact_with_minimal_data(self, db_session: Session, test_patient):
        """Test creating contact with only required fields."""
        minimal_contact = EmergencyContactCreate(
            name="Minimal Contact",
            relationship="friend",
            phone_number="555-111-1111"
        )
        
        contact = emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=minimal_contact
        )
        
        assert contact is not None
        assert contact.name == "Minimal Contact"
        assert contact.relationship == "friend"
        assert contact.phone_number == "555-111-1111"
        assert contact.patient_id == test_patient.id
        # Default values
        assert contact.is_primary is False
        assert contact.is_active is True
        # Optional fields should be None
        assert contact.secondary_phone is None
        assert contact.email is None
        assert contact.address is None
        assert contact.notes is None

    def test_contact_search_functionality(self, db_session: Session, test_patient):
        """Test search functionality for emergency contacts."""
        # Create contacts with different names
        contacts_data = [
            EmergencyContactCreate(
                name="John Smith",
                relationship="friend",
                phone_number="555-111-1111"
            ),
            EmergencyContactCreate(
                name="John Doe",
                relationship="sibling",
                phone_number="555-222-2222"
            ),
            EmergencyContactCreate(
                name="Jane Smith",
                relationship="parent",
                phone_number="555-333-3333"
            )
        ]
        
        for contact_data in contacts_data:
            emergency_contact_crud.create_for_patient(
                db_session, patient_id=test_patient.id, obj_in=contact_data
            )
        
        # Search for contacts with "John" in name
        john_contacts = emergency_contact_crud.query(
            db_session,
            filters={"patient_id": test_patient.id},
            search={"field": "name", "term": "John"}
        )
        
        assert len(john_contacts) == 2
        for contact in john_contacts:
            assert "John" in contact.name

    def test_contact_update_preserves_patient_id(self, db_session: Session, test_patient):
        """Test that updating a contact preserves patient_id."""
        # Create contact
        contact_data = EmergencyContactCreate(
            name="Test Contact",
            relationship="friend",
            phone_number="555-111-1111"
        )
        
        created_contact = emergency_contact_crud.create_for_patient(
            db_session, patient_id=test_patient.id, obj_in=contact_data
        )
        
        # Update contact
        update_data = EmergencyContactUpdate(
            name="Updated Contact",
            phone_number="555-999-9999"
        )
        
        updated_contact = emergency_contact_crud.update(
            db_session, db_obj=created_contact, obj_in=update_data
        )
        
        # Verify patient_id is preserved
        assert updated_contact.patient_id == test_patient.id
        assert updated_contact.name == "Updated Contact"
        assert updated_contact.phone_number == "555-999-9999"

    def test_multiple_active_contacts_management(self, db_session: Session, test_patient):
        """Test managing multiple active contacts with different statuses."""
        # Create multiple contacts with different statuses
        contacts_data = [
            EmergencyContactCreate(
                name="Primary Active",
                relationship="spouse",
                phone_number="555-111-1111",
                is_primary=True,
                is_active=True
            ),
            EmergencyContactCreate(
                name="Secondary Active",
                relationship="parent",
                phone_number="555-222-2222",
                is_primary=False,
                is_active=True
            ),
            EmergencyContactCreate(
                name="Inactive Contact",
                relationship="friend",
                phone_number="555-333-3333",
                is_primary=False,
                is_active=False
            )
        ]
        
        created_contacts = []
        for contact_data in contacts_data:
            contact = emergency_contact_crud.create_for_patient(
                db_session, patient_id=test_patient.id, obj_in=contact_data
            )
            created_contacts.append(contact)
        
        # Get all contacts
        all_contacts = emergency_contact_crud.get_by_patient_id(
            db_session, patient_id=test_patient.id
        )
        assert len(all_contacts) == 3
        
        # Get active contacts
        active_contacts = emergency_contact_crud.get_active_contacts(
            db_session, patient_id=test_patient.id
        )
        assert len(active_contacts) == 2
        
        # Get primary contact
        primary_contact = emergency_contact_crud.get_primary_contact(
            db_session, patient_id=test_patient.id
        )
        assert primary_contact is not None
        assert primary_contact.name == "Primary Active"
        assert primary_contact.is_primary is True
        assert primary_contact.is_active is True