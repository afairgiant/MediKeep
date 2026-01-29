"""
Shared fixtures for API tests.
"""
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.patient import patient as patient_crud
from app.schemas.patient import PatientCreate
from tests.utils.user import create_random_user, create_user_token_headers


@pytest.fixture
def user_with_patient(db_session: Session):
    """Create a user with patient record for testing.

    This is a commonly used fixture across multiple API test files.
    Returns a dict with 'user', 'email', 'password', and 'patient' keys.
    """
    user_data = create_random_user(db_session)
    patient_data = PatientCreate(
        first_name="Test",
        last_name="User",
        birth_date=date(1990, 1, 1),
        gender="M",
        address="123 Test St"
    )
    patient = patient_crud.create_for_user(
        db_session, user_id=user_data["user"].id, patient_data=patient_data
    )
    user_data["user"].active_patient_id = patient.id
    db_session.commit()
    db_session.refresh(user_data["user"])
    return {**user_data, "patient": patient}


@pytest.fixture
def authenticated_headers(user_with_patient):
    """Create authentication headers for the test user.

    This fixture depends on user_with_patient and creates
    JWT authentication headers for API requests.
    """
    return create_user_token_headers(user_with_patient["user"].username)


@pytest.fixture
def populated_patient_data(client: TestClient, user_with_patient, authenticated_headers):
    """Create various medical records for testing search and reports.

    This fixture populates the patient with:
    - 2 medications (Lisinopril, Metformin)
    - 2 conditions (Hypertension, Type 2 Diabetes)
    - 1 allergy (Penicillin)
    - 1 immunization (COVID-19 Vaccine)

    Useful for search, reporting, and data summary tests.
    """
    patient_id = user_with_patient["patient"].id

    # Create medications
    client.post(
        "/api/v1/medications/",
        json={
            "medication_name": "Lisinopril",
            "dosage": "10mg daily",
            "indication": "Hypertension",
            "status": "active",
            "effective_period_start": str(date.today() - timedelta(days=30)),
            "patient_id": patient_id
        },
        headers=authenticated_headers
    )

    client.post(
        "/api/v1/medications/",
        json={
            "medication_name": "Metformin",
            "dosage": "500mg twice daily",
            "indication": "Type 2 Diabetes",
            "status": "active",
            "effective_period_start": str(date.today() - timedelta(days=60)),
            "patient_id": patient_id
        },
        headers=authenticated_headers
    )

    # Create conditions
    client.post(
        "/api/v1/conditions/",
        json={
            "condition_name": "Hypertension",
            "diagnosis": "Essential hypertension, stage 1",
            "status": "active",
            "diagnosed_date": str(date.today() - timedelta(days=365)),
            "patient_id": patient_id
        },
        headers=authenticated_headers
    )

    client.post(
        "/api/v1/conditions/",
        json={
            "condition_name": "Type 2 Diabetes Mellitus",
            "diagnosis": "Diabetes type 2, well controlled",
            "status": "active",
            "diagnosed_date": str(date.today() - timedelta(days=180)),
            "patient_id": patient_id
        },
        headers=authenticated_headers
    )

    # Create allergy
    client.post(
        "/api/v1/allergies/",
        json={
            "allergen": "Penicillin",
            "severity": "severe",
            "reaction": "Anaphylaxis",
            "status": "active",
            "patient_id": patient_id
        },
        headers=authenticated_headers
    )

    # Create immunization
    client.post(
        "/api/v1/immunizations/",
        json={
            "vaccine_name": "COVID-19 Vaccine",
            "date_administered": str(date.today() - timedelta(days=90)),
            "status": "completed",
            "patient_id": patient_id
        },
        headers=authenticated_headers
    )

    return user_with_patient
