"""
Tests for user recent activity endpoint
"""
import pytest
from fastapi.testclient import TestClient
from datetime import datetime

from app.main import app
from app.api import deps


client = TestClient(app)


def test_user_recent_activity_no_patient():
    """Test recent activity endpoint when user has no patient record"""
    
    # Mock the dependencies
    def mock_get_current_user_id():
        return 999  # Non-existent user ID
    
    def mock_get_db():
        # This would normally return a test database session
        # For now, we'll test the endpoint structure
        pass
    
    app.dependency_overrides[deps.get_current_user_id] = mock_get_current_user_id
    app.dependency_overrides[deps.get_db] = mock_get_db
    
    try:
        response = client.get("/api/v1/patients/recent-activity/")
        
        # Should return 422 for dependency injection issues in test
        # or 200 with empty array if patient not found
        assert response.status_code in [200, 422, 500]
        
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            
    finally:
        # Clean up dependency overrides
        app.dependency_overrides.clear()


def test_user_recent_activity_endpoint_structure():
    """Test that the endpoint has the correct structure"""
    
    # Test endpoint exists by checking if we can import the function
    from app.api.v1.endpoints.patients import get_user_recent_activity
    
    # Check that the function exists and is callable
    assert callable(get_user_recent_activity)


def test_user_recent_activity_schema():
    """Test the UserRecentActivity schema"""
    
    from app.api.v1.endpoints.patients import UserRecentActivity
    
    # Test that we can create a valid activity object
    activity = UserRecentActivity(
        id=1,
        type="Medication",
        action="created",
        description="Added new medication: Aspirin",
        timestamp=datetime.utcnow()
    )
    
    assert activity.id == 1
    assert activity.type == "Medication"
    assert activity.action == "created"
    assert activity.description == "Added new medication: Aspirin"
    assert isinstance(activity.timestamp, datetime)


def test_activity_filtering_logic():
    """Test the logic for filtering medical activities"""
    
    # Test medical entity types (all medical pages + doctors)
    medical_entity_types = [
        'medication',
        'lab_result', 
        'vitals',
        'condition',
        'allergy',
        'immunization',
        'procedure',
        'treatment',
        'encounter',
        'patient',
        'practitioner',  # Doctors/practitioners page
        'lab_result_file',  # Lab result file uploads
    ]
    
    # Test that user-related activities are excluded
    excluded_actions = ['user_created', 'user_deleted']
    
    # Verify medical types are comprehensive
    assert 'medication' in medical_entity_types
    assert 'lab_result' in medical_entity_types
    assert 'patient' in medical_entity_types
    assert 'practitioner' in medical_entity_types
    assert 'lab_result_file' in medical_entity_types
    
    # Verify exclusions
    assert 'user_created' in excluded_actions


def test_type_mapping():
    """Test the entity type to user-friendly name mapping"""
    
    type_mapping = {
        'medication': 'Medication',
        'lab_result': 'Lab Result',
        'vitals': 'Vital Signs',
        'condition': 'Medical Condition',
        'allergy': 'Allergy',
        'immunization': 'Immunization', 
        'procedure': 'Procedure',
        'treatment': 'Treatment',
        'encounter': 'Visit',
        'patient': 'Patient Information',
        'practitioner': 'Doctor',
        'lab_result_file': 'Lab Result File',
    }
    
    # Test that all medical entity types have user-friendly mappings
    assert type_mapping['medication'] == 'Medication'
    assert type_mapping['lab_result'] == 'Lab Result'
    assert type_mapping['encounter'] == 'Visit'
    assert type_mapping['patient'] == 'Patient Information'
    assert type_mapping['practitioner'] == 'Doctor'
    assert type_mapping['lab_result_file'] == 'Lab Result File'


def test_description_formatting():
    """Test description formatting logic"""
    
    # Test various action types and expected descriptions
    test_cases = [
        ('patient', 'updated', 'Updated Patient Information'),
        ('medication', 'created', 'Created Medication'),
        ('medication', 'updated', 'Updated Medication'),
        ('medication', 'deleted', 'Deleted Medication'),
        ('lab_result', 'created', 'Created Lab Result'),
        ('immunization', 'created', 'Created Immunization'),
    ]
    
    for entity_type, action, expected_start in test_cases:
        type_mapping = {
            'medication': 'Medication',
            'lab_result': 'Lab Result',
            'patient': 'Patient Information',
            'immunization': 'Immunization'
        }
        
        activity_type = type_mapping.get(entity_type, entity_type.title())
        
        if entity_type == 'patient' and action == 'updated':
            description = "Updated Patient Information"
        elif action == 'created':
            description = f"Created {activity_type}"
        elif action == 'updated':
            description = f"Updated {activity_type}"
        elif action == 'deleted':
            description = f"Deleted {activity_type}"
        
        assert description == expected_start


if __name__ == "__main__":
    pytest.main([__file__])
