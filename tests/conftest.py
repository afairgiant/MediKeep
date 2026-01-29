"""
Pytest configuration and fixtures for Medical Records application tests.
"""
import asyncio
import os
import tempfile
from datetime import date
from typing import AsyncGenerator, Generator

# CRITICAL: Set test environment variables BEFORE importing app modules
# This ensures the app uses the test database instead of production
os.environ["TESTING"] = "1"
os.environ["DATABASE_URL"] = "sqlite:///test_database.db"  # File-based SQLite for tests
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
os.environ["LOG_LEVEL"] = "WARNING"  # Reduce log noise in tests
os.environ["SKIP_MIGRATIONS"] = "true"  # Skip Alembic migrations for SQLite tests

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session

from app.core.config import settings
from app.core.database import get_db, Base
from app.main import app
from app.api import deps
from app.models.models import User, Patient
from app.crud.user import user as user_crud
from app.crud.patient import patient as patient_crud
from app.schemas.user import UserCreate
from app.schemas.patient import PatientCreate
from app.core.utils.security import create_access_token
from tests.utils.user import create_random_user, create_user_authentication_headers
from app.core.events import setup_event_system

# Initialize event system for tests
setup_event_system()

# Test database setup
@pytest.fixture(scope="session")
def test_db_engine():
    """Create a test database engine using file-based SQLite.

    Using a file-based SQLite database instead of in-memory avoids
    connection-sharing issues and makes debugging easier.
    """
    import os

    # Use file-based SQLite database for tests
    test_db_file = "test_database.db"

    # Remove existing test database if it exists
    if os.path.exists(test_db_file):
        os.remove(test_db_file)

    SQLALCHEMY_DATABASE_URL = f"sqlite:///{test_db_file}"

    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={
            "check_same_thread": False,
        },
        echo=False,  # Set to True for SQL debugging
    )

    # Create all tables
    Base.metadata.create_all(bind=engine)

    yield engine

    # Cleanup
    engine.dispose()

    # Remove test database file
    # Use a small delay and retry to handle Windows file locking
    import time
    for attempt in range(5):
        try:
            if os.path.exists(test_db_file):
                os.remove(test_db_file)
            break
        except PermissionError:
            if attempt < 4:
                time.sleep(0.1)  # Wait 100ms and retry
            else:
                # On final attempt, just warn instead of failing
                import warnings
                warnings.warn(f"Could not delete test database file: {test_db_file}")


@pytest.fixture(scope="function")
def db_session(test_db_engine) -> Generator[Session, None, None]:
    """Create a database session for testing."""
    TestingSessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=test_db_engine
    )

    # Create session directly from engine
    # With StaticPool, all sessions share the same connection to the in-memory database
    session = TestingSessionLocal()

    yield session

    # Clean up: Delete all data but keep schema intact
    # This is faster than dropping/recreating tables and avoids FK constraint issues
    session.rollback()  # Rollback any uncommitted changes

    # Delete all rows from all tables (in reverse order to handle FKs)
    for table in reversed(Base.metadata.sorted_tables):
        session.execute(table.delete())
    session.commit()

    session.close()


@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Create a test client with database session override.

    IMPORTANT: The dependency override must be set BEFORE creating the TestClient
    and cleared AFTER the TestClient is closed to avoid leaking state between tests.
    """

    def override_get_db():
        """Override that yields the test database session."""
        try:
            yield db_session
        finally:
            pass  # Session cleanup handled by db_session fixture

    # Override BEFORE creating client
    app.dependency_overrides[get_db] = override_get_db

    # Create test client
    with TestClient(app, raise_server_exceptions=True) as test_client:
        yield test_client

    # Clean up overrides after client is closed
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def test_user(db_session: Session) -> User:
    """Create a test user."""
    user_data = UserCreate(
        username="testuser",
        email="test@example.com",
        password="testpassword123",
        full_name="Test User",
        role="user"
    )
    user = user_crud.create(db_session, obj_in=user_data)
    
# Don't create patient automatically - let tests create as needed
    
    return user


@pytest.fixture(scope="function")
def test_admin_user(db_session: Session) -> User:
    """Create a test admin user."""
    user_data = UserCreate(
        username="admin",
        email="admin@example.com",
        password="adminpassword123",
        full_name="Admin User",
        role="admin"
    )
    return user_crud.create(db_session, obj_in=user_data)


@pytest.fixture(scope="function")
def test_patient(db_session: Session, test_user: User) -> Patient:
    """Create a patient record for the test user."""
    patient_data = PatientCreate(
        first_name="Test",
        last_name="User",
        birth_date=date(1990, 1, 1),
        gender="M",
        address="123 Test St"
    )
    patient = patient_crud.create_for_user(
        db_session,
        user_id=test_user.id,
        patient_data=patient_data
    )
    # Set as active patient for multi-patient system
    test_user.active_patient_id = patient.id
    db_session.commit()
    db_session.refresh(test_user)
    return patient


@pytest.fixture(scope="function")
def user_token_headers(test_user: User) -> dict[str, str]:
    """Create authentication headers for test user."""
    access_token = create_access_token(data={"sub": test_user.username})
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture(scope="function")
def admin_token_headers(test_admin_user: User) -> dict[str, str]:
    """Create authentication headers for admin user."""
    access_token = create_access_token(data={"sub": test_admin_user.username})
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture(scope="function")
def authenticated_client(client: TestClient, user_token_headers: dict) -> TestClient:
    """Test client with authentication headers pre-configured."""
    client.headers.update(user_token_headers)
    return client


@pytest.fixture(scope="function")
def admin_client(client: TestClient, admin_token_headers: dict) -> TestClient:
    """Test client with admin authentication headers pre-configured."""
    client.headers.update(admin_token_headers)
    return client


# Async fixtures for async tests
@pytest_asyncio.fixture
async def async_db_session(test_db_engine) -> AsyncGenerator[Session, None]:
    """Create an async database session for testing."""
    # Note: This is a simplified version. In a real async setup,
    # you would use async SQLAlchemy
    TestingSessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=test_db_engine
    )
    
    connection = test_db_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()


# Test data fixtures
@pytest.fixture
def sample_medication_data():
    """Sample medication data for testing."""
    return {
        "name": "Test Medication",
        "dosage": "10mg",
        "frequency": "Daily",
        "start_date": "2023-01-01",
        "end_date": None,
        "prescribing_doctor": "Dr. Test",
        "notes": "Test medication notes",
        "status": "active"
    }


@pytest.fixture
def sample_lab_result_data():
    """Sample lab result data for testing."""
    return {
        "test_name": "Complete Blood Count",
        "test_date": "2023-06-15",
        "result": "Normal",
        "reference_range": "Within normal limits",
        "ordering_doctor": "Dr. Test",
        "lab_name": "Test Lab",
        "notes": "All values normal",
        "status": "completed"
    }


@pytest.fixture
def sample_practitioner_data():
    """Sample practitioner data for testing."""
    return {
        "name": "Dr. Test Smith",
        "specialty": "Family Medicine",
        "phone_number": "555-0123",
        "email": "dr.test@example.com",
        "address": "123 Medical Center Dr",
        "website": "https://drtest.com",
        "rating": 4.5,
        "status": "active"
    }


@pytest.fixture
def sample_vitals_data():
    """Sample vitals data for testing."""
    return {
        "measurement_date": "2023-12-01",
        "systolic_bp": 120,
        "diastolic_bp": 80,
        "heart_rate": 72,
        "temperature": 98.6,
        "weight": 180,
        "height": 70,
        "bmi": 25.8,
        "notes": "Normal vitals"
    }


# Environment setup
@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Setup test environment variables.

    CRITICAL: This runs BEFORE any app modules are imported to ensure
    the test DATABASE_URL is used when creating the engine.
    """
    os.environ["TESTING"] = "1"
    os.environ["DATABASE_URL"] = "sqlite:///test_database.db"  # File-based for tests
    os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only"
    os.environ["LOG_LEVEL"] = "WARNING"  # Reduce log noise in tests
    os.environ["SKIP_MIGRATIONS"] = "true"  # Skip Alembic migrations for SQLite tests

    yield

    # Cleanup
    if "TESTING" in os.environ:
        del os.environ["TESTING"]
    if "SKIP_MIGRATIONS" in os.environ:
        del os.environ["SKIP_MIGRATIONS"]


# File handling fixtures
@pytest.fixture
def temp_upload_dir():
    """Create a temporary directory for file uploads during testing."""
    with tempfile.TemporaryDirectory() as temp_dir:
        original_upload_dir = getattr(settings, 'UPLOAD_DIR', None)
        settings.UPLOAD_DIR = temp_dir
        
        yield temp_dir
        
        if original_upload_dir:
            settings.UPLOAD_DIR = original_upload_dir


@pytest.fixture
def sample_test_file():
    """Create a sample test file for upload testing."""
    with tempfile.NamedTemporaryFile(mode='w+', suffix='.txt', delete=False) as f:
        f.write("This is a test file for lab results.")
        f.flush()

        yield f.name

        # Cleanup
        try:
            os.unlink(f.name)
        except OSError:
            pass


# Patient Sharing Test Fixtures
@pytest.fixture
def test_recipient(db_session: Session) -> User:
    """Create a second test user for patient sharing tests."""
    user_data = UserCreate(
        username="recipient",
        email="recipient@example.com",
        password="recipientpass123",
        full_name="Recipient User",
        role="user"
    )
    return user_crud.create(db_session, obj_in=user_data)


@pytest.fixture
def test_invitation(db_session: Session, test_user: User, test_recipient: User, test_patient: Patient):
    """Create a pending patient share invitation."""
    from app.models.models import Invitation
    from app.core.utils.datetime_utils import get_utc_now
    from datetime import timedelta

    invitation = Invitation(
        sent_by_user_id=test_user.id,
        sent_to_user_id=test_recipient.id,
        invitation_type='patient_share',
        status='pending',
        title=f"Patient Share: {test_patient.first_name} {test_patient.last_name}",
        context_data={
            'patient_id': test_patient.id,
            'patient_name': f"{test_patient.first_name} {test_patient.last_name}",
            'patient_birth_date': test_patient.birth_date.isoformat() if test_patient.birth_date else None,
            'permission_level': 'view'
        },
        expires_at=get_utc_now() + timedelta(days=7)
    )
    db_session.add(invitation)
    db_session.commit()
    db_session.refresh(invitation)
    return invitation


@pytest.fixture
def test_share(db_session: Session, test_user: User, test_recipient: User, test_patient: Patient):
    """Create an existing patient share."""
    from app.models.models import PatientShare

    share = PatientShare(
        patient_id=test_patient.id,
        shared_by_user_id=test_user.id,
        shared_with_user_id=test_recipient.id,
        permission_level='view',
        is_active=True
    )
    db_session.add(share)
    db_session.commit()
    db_session.refresh(share)
    return share


@pytest.fixture
def recipient_token_headers(test_recipient: User) -> dict[str, str]:
    """Create authentication headers for recipient user."""
    access_token = create_access_token(data={"sub": test_recipient.username})
    return {"Authorization": f"Bearer {access_token}"}


# Mocking utilities
@pytest.fixture
def mock_email_service(monkeypatch):
    """Mock email service for testing."""
    sent_emails = []
    
    def mock_send_email(to_email: str, subject: str, body: str):
        sent_emails.append({
            "to": to_email,
            "subject": subject,
            "body": body
        })
        return True
    
    # Mock the email service if it exists
    # monkeypatch.setattr("app.services.email.send_email", mock_send_email)
    
    return sent_emails


@pytest.fixture
def mock_file_storage(monkeypatch, temp_upload_dir):
    """Mock file storage operations for testing."""
    stored_files = {}
    
    def mock_store_file(file_content: bytes, filename: str) -> str:
        file_path = os.path.join(temp_upload_dir, filename)
        with open(file_path, 'wb') as f:
            f.write(file_content)
        stored_files[filename] = file_path
        return file_path
    
    def mock_delete_file(filename: str) -> bool:
        file_path = stored_files.get(filename)
        if file_path and os.path.exists(file_path):
            os.unlink(file_path)
            del stored_files[filename]
            return True
        return False
    
    return {
        "store_file": mock_store_file,
        "delete_file": mock_delete_file,
        "stored_files": stored_files
    }


# Performance testing utilities
@pytest.fixture
def performance_timer():
    """Utility for measuring test performance."""
    import time
    
    class Timer:
        def __init__(self):
            self.start_time = None
            self.end_time = None
        
        def start(self):
            self.start_time = time.time()
        
        def stop(self):
            self.end_time = time.time()
            return self.duration
        
        @property
        def duration(self):
            if self.start_time and self.end_time:
                return self.end_time - self.start_time
            return None
    
    return Timer()


# Cleanup utilities
@pytest.fixture(autouse=True)
def cleanup_after_test():
    """Automatically cleanup after each test."""
    yield
    
    # Clear any global state
    # Reset singletons, clear caches, etc.
    pass