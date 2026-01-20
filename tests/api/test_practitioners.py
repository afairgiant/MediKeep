"""
Test practitioner API endpoints and schema validation.

Tests cover:
- Creating practitioners with/without optional practice field
- Creating practitioners with/without optional email field
- Email validation edge cases (invalid formats, case normalization)
- Updating practitioners to add/remove email and practice fields
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.schemas.practitioner import (
    PractitionerCreate,
    PractitionerUpdate,
    _validate_practice_value,
    _validate_email_value,
)


class TestPractitionerSchemaValidation:
    """Test practitioner schema validators."""

    # ============================================
    # Practice Field Validation Tests
    # ============================================

    def test_practice_valid(self):
        """Test valid practice values."""
        assert _validate_practice_value("City Hospital") == "City Hospital"
        assert _validate_practice_value("  Trimmed Practice  ") == "Trimmed Practice"
        assert _validate_practice_value("AB") == "AB"  # Minimum length

    def test_practice_none_returns_none(self):
        """Test that None practice returns None."""
        assert _validate_practice_value(None) is None

    def test_practice_empty_string_returns_none(self):
        """Test that empty string practice returns None."""
        assert _validate_practice_value("") is None
        assert _validate_practice_value("   ") is None

    def test_practice_too_short_raises_error(self):
        """Test that practice less than 2 chars raises ValueError."""
        with pytest.raises(ValueError, match="at least 2 characters"):
            _validate_practice_value("A")

    def test_practice_too_long_raises_error(self):
        """Test that practice over 100 chars raises ValueError."""
        with pytest.raises(ValueError, match="less than 100 characters"):
            _validate_practice_value("A" * 101)

    # ============================================
    # Email Field Validation Tests
    # ============================================

    def test_email_valid(self):
        """Test valid email addresses."""
        assert _validate_email_value("doctor@hospital.com") == "doctor@hospital.com"
        assert _validate_email_value("dr.smith@clinic.org") == "dr.smith@clinic.org"
        assert _validate_email_value("name+tag@domain.co.uk") == "name+tag@domain.co.uk"

    def test_email_case_normalization(self):
        """Test that email is normalized to lowercase."""
        assert _validate_email_value("Doctor@Hospital.COM") == "doctor@hospital.com"
        assert _validate_email_value("DR.SMITH@CLINIC.ORG") == "dr.smith@clinic.org"

    def test_email_whitespace_trimmed(self):
        """Test that whitespace is trimmed from email."""
        assert _validate_email_value("  doctor@hospital.com  ") == "doctor@hospital.com"

    def test_email_none_returns_none(self):
        """Test that None email returns None."""
        assert _validate_email_value(None) is None

    def test_email_empty_string_returns_none(self):
        """Test that empty string email returns None."""
        assert _validate_email_value("") is None
        assert _validate_email_value("   ") is None

    def test_email_invalid_format_raises_error(self):
        """Test that invalid email formats raise ValueError."""
        invalid_emails = [
            "notanemail",
            "missing@domain",
            "@nodomain.com",
            "no@.com",
            "spaces in@email.com",
            "no@@double.com",
        ]
        for email in invalid_emails:
            with pytest.raises(ValueError, match="valid email address"):
                _validate_email_value(email)

    def test_email_too_long_raises_error(self):
        """Test that email over 254 chars raises ValueError."""
        long_email = "a" * 246 + "@test.com"  # 255 chars (246 + 9 = 255)
        with pytest.raises(ValueError, match="less than 254 characters"):
            _validate_email_value(long_email)


class TestPractitionerCreateSchema:
    """Test PractitionerCreate schema."""

    def test_create_with_all_fields(self):
        """Test creating practitioner with all fields."""
        practitioner = PractitionerCreate(
            name="Dr. Jane Smith",
            specialty="Cardiology",
            practice="City Medical Center",
            phone_number="555-123-4567",
            email="jane.smith@hospital.com",
            website="https://drjanesmith.com",
            rating=4.5
        )
        assert practitioner.name == "Dr. Jane Smith"
        assert practitioner.practice == "City Medical Center"
        assert practitioner.email == "jane.smith@hospital.com"

    def test_create_without_practice(self):
        """Test creating practitioner without practice (optional field)."""
        practitioner = PractitionerCreate(
            name="Dr. John Doe",
            specialty="General Practice"
        )
        assert practitioner.name == "Dr. John Doe"
        assert practitioner.practice is None

    def test_create_without_email(self):
        """Test creating practitioner without email (optional field)."""
        practitioner = PractitionerCreate(
            name="Dr. John Doe",
            specialty="General Practice",
            practice="Local Clinic"
        )
        assert practitioner.email is None

    def test_create_with_empty_practice_converts_to_none(self):
        """Test that empty practice string converts to None."""
        practitioner = PractitionerCreate(
            name="Dr. John Doe",
            specialty="General Practice",
            practice=""
        )
        assert practitioner.practice is None

    def test_create_with_empty_email_converts_to_none(self):
        """Test that empty email string converts to None."""
        practitioner = PractitionerCreate(
            name="Dr. John Doe",
            specialty="General Practice",
            email=""
        )
        assert practitioner.email is None

    def test_create_email_normalized(self):
        """Test that email is normalized on create."""
        practitioner = PractitionerCreate(
            name="Dr. John Doe",
            specialty="General Practice",
            email="  DR.DOE@HOSPITAL.COM  "
        )
        assert practitioner.email == "dr.doe@hospital.com"


class TestPractitionerUpdateSchema:
    """Test PractitionerUpdate schema."""

    def test_update_practice_to_value(self):
        """Test updating practice to a new value."""
        update = PractitionerUpdate(practice="New Hospital")
        assert update.practice == "New Hospital"

    def test_update_practice_to_none(self):
        """Test updating practice to None (removing it)."""
        update = PractitionerUpdate(practice=None)
        assert update.practice is None

    def test_update_practice_empty_string_to_none(self):
        """Test that empty practice string converts to None on update."""
        update = PractitionerUpdate(practice="")
        assert update.practice is None

    def test_update_email_to_value(self):
        """Test updating email to a new value."""
        update = PractitionerUpdate(email="new@email.com")
        assert update.email == "new@email.com"

    def test_update_email_to_none(self):
        """Test updating email to None (removing it)."""
        update = PractitionerUpdate(email=None)
        assert update.email is None

    def test_update_email_empty_string_to_none(self):
        """Test that empty email string converts to None on update."""
        update = PractitionerUpdate(email="")
        assert update.email is None

    def test_update_email_normalized(self):
        """Test that email is normalized on update."""
        update = PractitionerUpdate(email="NEW@EMAIL.COM")
        assert update.email == "new@email.com"


class TestPractitionerAPI:
    """Test practitioner API endpoints."""

    def test_create_practitioner_with_all_fields(self, authenticated_client: TestClient):
        """Test creating practitioner with all fields including email."""
        practitioner_data = {
            "name": "Dr. Sarah Johnson",
            "specialty": "Internal Medicine",
            "practice": "City Medical Center",
            "phone_number": "555-555-0123",
            "email": "sarah.johnson@citymed.com",
            "website": "https://citymed.com/drjohnson",
            "rating": 4.8
        }

        response = authenticated_client.post("/api/v1/practitioners/", json=practitioner_data)

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Dr. Sarah Johnson"
        assert data["practice"] == "City Medical Center"
        assert data["email"] == "sarah.johnson@citymed.com"
        assert data["rating"] == 4.8

    def test_create_practitioner_without_practice(self, authenticated_client: TestClient):
        """Test creating practitioner without practice (Italian use case)."""
        practitioner_data = {
            "name": "Dr. Marco Rossi",
            "specialty": "Cardiologia",
            "phone_number": "555-555-0124",
            "email": "marco.rossi@email.it"
        }

        response = authenticated_client.post("/api/v1/practitioners/", json=practitioner_data)

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Dr. Marco Rossi"
        assert data["practice"] is None
        assert data["email"] == "marco.rossi@email.it"

    def test_create_practitioner_without_email(self, authenticated_client: TestClient):
        """Test creating practitioner without email."""
        practitioner_data = {
            "name": "Dr. Emily Chen",
            "specialty": "Pediatrics",
            "practice": "Children's Hospital"
        }

        response = authenticated_client.post("/api/v1/practitioners/", json=practitioner_data)

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Dr. Emily Chen"
        assert data["email"] is None

    def test_create_practitioner_email_normalized(self, authenticated_client: TestClient):
        """Test that email is normalized to lowercase on creation."""
        practitioner_data = {
            "name": "Dr. Test Doctor",
            "specialty": "Testing",
            "email": "  TEST@HOSPITAL.COM  "
        }

        response = authenticated_client.post("/api/v1/practitioners/", json=practitioner_data)

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@hospital.com"

    def test_create_practitioner_invalid_email_rejected(self, authenticated_client: TestClient):
        """Test that invalid email is rejected."""
        practitioner_data = {
            "name": "Dr. Bad Email",
            "specialty": "Testing",
            "email": "not-a-valid-email"
        }

        response = authenticated_client.post("/api/v1/practitioners/", json=practitioner_data)

        assert response.status_code == 422  # Validation error

    def test_update_practitioner_add_email(self, authenticated_client: TestClient):
        """Test adding email to existing practitioner."""
        # First create without email
        create_data = {
            "name": "Dr. Update Test",
            "specialty": "Testing",
            "practice": "Test Clinic"
        }
        create_response = authenticated_client.post("/api/v1/practitioners/", json=create_data)
        assert create_response.status_code == 200
        practitioner_id = create_response.json()["id"]

        # Then add email
        update_data = {"email": "update.test@clinic.com"}
        update_response = authenticated_client.put(
            f"/api/v1/practitioners/{practitioner_id}",
            json=update_data
        )

        assert update_response.status_code == 200
        data = update_response.json()
        assert data["email"] == "update.test@clinic.com"

    def test_update_practitioner_remove_practice(self, authenticated_client: TestClient):
        """Test removing practice from existing practitioner."""
        # First create with practice
        create_data = {
            "name": "Dr. Remove Practice",
            "specialty": "Testing",
            "practice": "Old Hospital"
        }
        create_response = authenticated_client.post("/api/v1/practitioners/", json=create_data)
        assert create_response.status_code == 200
        practitioner_id = create_response.json()["id"]

        # Then remove practice by setting to empty string
        update_data = {"practice": ""}
        update_response = authenticated_client.put(
            f"/api/v1/practitioners/{practitioner_id}",
            json=update_data
        )

        assert update_response.status_code == 200
        data = update_response.json()
        assert data["practice"] is None

    def test_update_practitioner_remove_email(self, authenticated_client: TestClient):
        """Test removing email from existing practitioner."""
        # First create with email
        create_data = {
            "name": "Dr. Remove Email",
            "specialty": "Testing",
            "email": "to.remove@test.com"
        }
        create_response = authenticated_client.post("/api/v1/practitioners/", json=create_data)
        assert create_response.status_code == 200
        practitioner_id = create_response.json()["id"]

        # Then remove email by setting to empty string
        update_data = {"email": ""}
        update_response = authenticated_client.put(
            f"/api/v1/practitioners/{practitioner_id}",
            json=update_data
        )

        assert update_response.status_code == 200
        data = update_response.json()
        assert data["email"] is None

    def test_get_practitioner_with_optional_fields(self, authenticated_client: TestClient):
        """Test getting practitioner displays optional fields correctly."""
        # Create practitioner without optional fields
        create_data = {
            "name": "Dr. Minimal",
            "specialty": "Minimal Testing"
        }
        create_response = authenticated_client.post("/api/v1/practitioners/", json=create_data)
        assert create_response.status_code == 200
        practitioner_id = create_response.json()["id"]

        # Get the practitioner
        get_response = authenticated_client.get(f"/api/v1/practitioners/{practitioner_id}")

        assert get_response.status_code == 200
        data = get_response.json()
        assert data["name"] == "Dr. Minimal"
        assert data["practice"] is None
        assert data["email"] is None

    def test_list_practitioners_includes_optional_fields(self, authenticated_client: TestClient):
        """Test listing practitioners includes optional fields in response."""
        # Create a practitioner with all fields
        create_data = {
            "name": "Dr. Full Fields",
            "specialty": "Complete",
            "practice": "Full Hospital",
            "email": "full@test.com"
        }
        authenticated_client.post("/api/v1/practitioners/", json=create_data)

        # List practitioners
        response = authenticated_client.get("/api/v1/practitioners/")

        assert response.status_code == 200
        practitioners = response.json()
        assert len(practitioners) > 0

        # Find our practitioner
        full_practitioner = next(
            (p for p in practitioners if p["name"] == "Dr. Full Fields"),
            None
        )
        assert full_practitioner is not None
        assert full_practitioner["practice"] == "Full Hospital"
        assert full_practitioner["email"] == "full@test.com"
