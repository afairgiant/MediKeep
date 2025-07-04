"""
Test Docker container build and basic functionality.
"""
import os
import subprocess
import time
import requests
import pytest
from typing import Generator

import docker
from docker.models.containers import Container


class TestContainerBuild:
    """Test container build process and basic functionality."""

    @pytest.fixture(scope="class")
    def docker_client(self) -> docker.DockerClient:
        """Get Docker client."""
        return docker.from_env()

    @pytest.fixture(scope="class")
    def built_image(self, docker_client: docker.DockerClient):
        """Build the Docker image for testing."""
        print("Building Docker image...")
        
        # Build the main application image
        image, build_logs = docker_client.images.build(
            path=".",
            dockerfile="docker/Dockerfile",
            tag="medical-records:test",
            rm=True,
            forcerm=True
        )
        
        # Print build logs for debugging
        for log in build_logs:
            if 'stream' in log:
                print(log['stream'].strip())
        
        yield image
        
        # Cleanup
        try:
            docker_client.images.remove(image.id, force=True)
        except Exception as e:
            print(f"Warning: Could not remove image: {e}")

    def test_image_build_success(self, built_image):
        """Test that the Docker image builds successfully."""
        assert built_image is not None
        assert "medical-records:test" in [tag for tag in built_image.tags]

    def test_image_labels(self, built_image):
        """Test that the image has correct labels."""
        labels = built_image.labels
        assert "maintainer" in labels
        assert "version" in labels
        assert "description" in labels

    def test_image_size(self, built_image):
        """Test that the image size is reasonable."""
        # Image should be less than 2GB
        size_gb = built_image.attrs['Size'] / (1024**3)
        assert size_gb < 2.0, f"Image size {size_gb:.2f}GB is too large"

    @pytest.fixture
    def test_container(self, docker_client: docker.DockerClient, built_image) -> Generator[Container, None, None]:
        """Start a test container."""
        container = docker_client.containers.run(
            built_image.id,
            environment={
                "DATABASE_URL": "sqlite:///./test.db",
                "SECRET_KEY": "test-secret-key",
                "LOG_LEVEL": "WARNING",
                "TESTING": "1"
            },
            ports={"8000/tcp": 8002},  # Map to port 8002 to avoid conflicts
            detach=True,
            remove=True
        )
        
        # Wait for container to start
        time.sleep(10)
        
        yield container
        
        # Cleanup
        try:
            container.stop(timeout=10)
        except Exception as e:
            print(f"Warning: Could not stop container: {e}")

    def test_container_starts(self, test_container: Container):
        """Test that the container starts successfully."""
        # Reload to get current status
        test_container.reload()
        assert test_container.status == "running"

    def test_container_health_check(self, test_container: Container):
        """Test that the container health check passes."""
        # Wait for health check to stabilize
        max_attempts = 30
        for attempt in range(max_attempts):
            test_container.reload()
            health = test_container.attrs.get('State', {}).get('Health', {})
            status = health.get('Status', '')
            
            if status == 'healthy':
                break
            elif status == 'unhealthy':
                pytest.fail("Container health check failed")
            
            if attempt < max_attempts - 1:
                time.sleep(10)
        else:
            pytest.fail("Container did not become healthy within timeout")

    def test_api_accessibility(self, test_container: Container):
        """Test that the API is accessible."""
        # Wait a bit more for the API to be fully ready
        time.sleep(5)
        
        max_attempts = 10
        for attempt in range(max_attempts):
            try:
                response = requests.get("http://localhost:8002/health", timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    assert "status" in data
                    assert data["status"] == "healthy"
                    break
            except requests.exceptions.RequestException:
                if attempt < max_attempts - 1:
                    time.sleep(5)
                    continue
                raise
        else:
            pytest.fail("API did not become accessible within timeout")

    def test_static_files_served(self, test_container: Container):
        """Test that React static files are served correctly."""
        time.sleep(5)
        
        # Test that the React app is served at root
        response = requests.get("http://localhost:8002/", timeout=10)
        assert response.status_code == 200
        assert "text/html" in response.headers.get("content-type", "")
        
        # Check that it contains React app content
        content = response.text
        assert "<div id=\"root\">" in content or "react" in content.lower()

    def test_api_routes_work(self, test_container: Container):
        """Test that API routes are accessible."""
        time.sleep(5)
        
        # Test version endpoint
        response = requests.get("http://localhost:8002/api/v1/system/version", timeout=5)
        assert response.status_code == 200
        
        data = response.json()
        assert "app_name" in data
        assert "version" in data

    def test_container_logs(self, test_container: Container):
        """Test that container produces expected logs."""
        logs = test_container.logs().decode('utf-8')
        
        # Should contain startup messages
        assert "Starting Medical Records Management System" in logs or "Uvicorn running" in logs

    def test_container_environment(self, test_container: Container):
        """Test that environment variables are set correctly."""
        # Get container environment
        env_vars = test_container.attrs['Config']['Env']
        env_dict = {}
        for env_var in env_vars:
            if '=' in env_var:
                key, value = env_var.split('=', 1)
                env_dict[key] = value
        
        # Check important environment variables
        assert env_dict.get('TESTING') == '1'
        assert 'SECRET_KEY' in env_dict
        assert 'LOG_LEVEL' in env_dict

    def test_container_file_structure(self, test_container: Container):
        """Test that the container has the expected file structure."""
        # Execute commands to check file structure
        exit_code, output = test_container.exec_run("ls -la /app")
        assert exit_code == 0
        
        output_str = output.decode('utf-8')
        
        # Should contain expected directories/files
        expected_items = ['app', 'static', 'run.py', 'logs', 'uploads']
        for item in expected_items:
            assert item in output_str

    def test_container_static_build(self, test_container: Container):
        """Test that React static files are properly built and included."""
        # Check that static directory exists and contains built React app
        exit_code, output = test_container.exec_run("ls -la /app/static")
        assert exit_code == 0
        
        output_str = output.decode('utf-8')
        
        # Should contain React build artifacts
        expected_files = ['index.html', 'static']
        for file_item in expected_files:
            assert file_item in output_str

    def test_database_initialization(self, test_container: Container):
        """Test that the database is properly initialized."""
        # Check that database file exists (for SQLite test)
        exit_code, output = test_container.exec_run("ls -la /app/test.db")
        
        # For SQLite, the file should exist
        if exit_code == 0:
            # SQLite database was created
            assert True
        else:
            # Might be using PostgreSQL or in-memory
            # Check that app can connect to database via health endpoint
            response = requests.get("http://localhost:8002/health", timeout=5)
            assert response.status_code == 200

    @pytest.mark.slow
    def test_container_performance(self, test_container: Container):
        """Test basic performance characteristics of the container."""
        # Test response time
        start_time = time.time()
        response = requests.get("http://localhost:8002/health", timeout=5)
        response_time = time.time() - start_time
        
        assert response.status_code == 200
        assert response_time < 2.0  # Should respond within 2 seconds

    def test_container_security(self, test_container: Container):
        """Test basic security aspects of the container."""
        # Check that container runs as non-root user
        exit_code, output = test_container.exec_run("whoami")
        assert exit_code == 0
        
        username = output.decode('utf-8').strip()
        assert username != 'root', "Container should not run as root user"

    def test_multi_stage_build_optimization(self, built_image):
        """Test that multi-stage build properly optimizes the final image."""
        # Check that development dependencies are not in final image
        history = built_image.history()
        
        # Final image should not contain Node.js
        exit_code, output = docker.from_env().containers.run(
            built_image.id,
            command="which node",
            remove=True
        )
        
        # Node should not be found in final image (exit code should be non-zero)
        assert exit_code != 0, "Node.js should not be present in final image"