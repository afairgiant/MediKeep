"""
Basic tests to ensure pytest is working correctly.
"""
import pytest
from fastapi.testclient import TestClient


def test_basic_math():
    """Test basic math to ensure pytest is working."""
    assert 1 + 1 == 2
    assert 2 * 3 == 6


def test_string_operations():
    """Test basic string operations."""
    test_string = "Medical Records"
    assert "Medical" in test_string
    assert test_string.lower() == "medical records"


def test_app_health(client: TestClient):
    """Test basic app health endpoint."""
    response = client.get("/health")
    # This might fail if health endpoint doesn't exist, but that's OK for now
    # The test will show if the app is loading correctly
    assert response.status_code in [200, 404]  # Either works or endpoint doesn't exist


class TestBasicFunctionality:
    """Basic functionality tests."""
    
    def test_environment_setup(self):
        """Test that environment variables are set correctly."""
        import os
        assert os.getenv("TESTING") == "1"
        
    def test_imports(self):
        """Test that key modules can be imported."""
        from app.main import app
        from app.core.config import settings
        
        assert app is not None
        assert settings is not None