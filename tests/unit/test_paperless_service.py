"""
Unit tests for paperless service.
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
import aiohttp
from aiohttp import web

from app.services.paperless_service import (
    PaperlessService,
    PaperlessServiceToken,
    PaperlessServiceBase,
    PaperlessError,
    PaperlessConnectionError,
    PaperlessAuthenticationError,
    PaperlessUploadError,
    create_paperless_service,
    create_paperless_service_with_token,
    create_paperless_service_with_username_password
)
from app.services.credential_encryption import credential_encryption


class TestPaperlessService:
    """Test cases for PaperlessService."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.base_url = "https://paperless.example.com"
        self.api_token = "a1b2c3d4e5f6789012345678901234567890abcd"
        self.username = "testuser"
        self.password = "testpass"
        self.user_id = 123
        
    def test_init_valid_url_basic_auth(self):
        """Test service initialization with valid HTTPS URL using basic auth."""
        service = PaperlessService(self.base_url, self.username, self.password, self.user_id)
        assert service.base_url == self.base_url
        assert service.username == self.username
        assert service.password == self.password
        assert service.user_id == self.user_id
        assert service.get_auth_type() == "basic_auth"
        
    def test_init_valid_url_token_auth(self):
        """Test service initialization with valid HTTPS URL using token auth."""
        service = PaperlessServiceToken(self.base_url, self.api_token, self.user_id)
        assert service.base_url == self.base_url
        assert service.api_token == self.api_token
        assert service.user_id == self.user_id
        assert service.get_auth_type() == "token"
        
    def test_init_invalid_url_basic_auth(self):
        """Test service initialization rejects HTTP URLs with basic auth."""
        with pytest.raises(PaperlessConnectionError, match="must use HTTPS"):
            PaperlessService("http://insecure.example.com", self.username, self.password, self.user_id)
            
    def test_init_invalid_url_token_auth(self):
        """Test service initialization rejects HTTP URLs with token auth."""
        with pytest.raises(PaperlessConnectionError, match="must use HTTPS"):
            PaperlessServiceToken("http://insecure.example.com", self.api_token, self.user_id)
    
    def test_safe_endpoint_validation(self):
        """Test endpoint validation for SSRF prevention."""
        service = PaperlessService(self.base_url, self.username, self.password, self.user_id)
        
        # Valid endpoints
        assert service._is_safe_endpoint("/api/documents/") is True
        assert service._is_safe_endpoint("/api/documents/123/") is True
        assert service._is_safe_endpoint("/api/tags/") is True
        assert service._is_safe_endpoint("/api/token/") is True
        
        # Invalid endpoints
        assert service._is_safe_endpoint("/admin/") is False
        assert service._is_safe_endpoint("/api/users/") is False
        assert service._is_safe_endpoint("/../etc/passwd") is False
    
    @pytest.mark.asyncio
    async def test_connection_test_success(self):
        """Test successful connection test."""
        service = PaperlessService(self.base_url, self.username, self.password, self.user_id)
        
        # Mock successful response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {"count": 0, "results": []}
        mock_response.headers = {"X-Version": "2.6.3", "X-Api-Version": "6"}
        
        with patch.object(service, '_make_request') as mock_request:
            mock_request.return_value.__aenter__.return_value = mock_response
            
            result = await service.test_connection()
            
            assert result["status"] == "connected"
            assert result["server_version"] == "2.6.3"
            assert result["api_version"] == "6"
            assert result["user_id"] == self.user_id
            
    @pytest.mark.asyncio
    async def test_connection_test_auth_failure(self):
        """Test connection test with authentication failure."""
        service = PaperlessService(self.base_url, self.username, self.password, self.user_id)
        
        # Mock 401 response
        mock_response = AsyncMock()
        mock_response.status = 401
        
        with patch.object(service, '_make_request') as mock_request:
            mock_request.return_value.__aenter__.return_value = mock_response
            
            with pytest.raises(PaperlessAuthenticationError, match="Invalid API token"):
                await service.test_connection()
    
    @pytest.mark.asyncio
    async def test_upload_document_success(self):
        """Test successful document upload."""
        service = PaperlessService(self.base_url, self.username, self.password, self.user_id)
        
        # Mock successful upload response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {"task_id": "abc123"}
        
        with patch.object(service, '_make_request') as mock_request:
            mock_request.return_value.__aenter__.return_value = mock_response
            
            file_data = b"test file content"
            filename = "test.pdf"
            entity_type = "lab-result"
            entity_id = 456
            
            result = await service.upload_document(
                file_data, filename, entity_type, entity_id
            )
            
            assert result["status"] == "uploaded"
            assert result["task_id"] == "abc123"
            assert result["filename"] == filename
            assert result["file_size"] == len(file_data)
            assert result["entity_type"] == entity_type
            assert result["entity_id"] == entity_id
    
    @pytest.mark.asyncio
    async def test_upload_document_too_large(self):
        """Test upload with file too large."""
        service = PaperlessService(self.base_url, self.username, self.password, self.user_id)
        
        # Create file data larger than limit
        with patch('app.services.paperless_service.settings.PAPERLESS_MAX_UPLOAD_SIZE', 100):
            file_data = b"x" * 200  # 200 bytes, limit is 100
            
            with pytest.raises(PaperlessUploadError, match="exceeds maximum"):
                await service.upload_document(
                    file_data, "large.pdf", "lab-result", 456
                )
    
    @pytest.mark.asyncio
    async def test_download_document_success(self):
        """Test successful document download."""
        service = PaperlessService(self.base_url, self.username, self.password, self.user_id)
        
        # Mock successful download response
        mock_response = AsyncMock()
        mock_response.status = 200
        expected_content = b"document content"
        mock_response.read.return_value = expected_content
        
        with patch.object(service, '_make_request') as mock_request:
            mock_request.return_value.__aenter__.return_value = mock_response
            
            document_id = 789
            result = await service.download_document(document_id)
            
            assert result == expected_content
    
    @pytest.mark.asyncio
    async def test_download_document_not_found(self):
        """Test download with document not found."""
        service = PaperlessService(self.base_url, self.username, self.password, self.user_id)
        
        # Mock 404 response
        mock_response = AsyncMock()
        mock_response.status = 404
        
        with patch.object(service, '_make_request') as mock_request:
            mock_request.return_value.__aenter__.return_value = mock_response
            
            with pytest.raises(PaperlessError, match="not found"):
                await service.download_document(999)
    
    @pytest.mark.asyncio
    async def test_delete_document_success(self):
        """Test successful document deletion."""
        service = PaperlessService(self.base_url, self.username, self.password, self.user_id)
        
        # Mock successful deletion response
        mock_response = AsyncMock()
        mock_response.status = 204
        
        with patch.object(service, '_make_request') as mock_request:
            mock_request.return_value.__aenter__.return_value = mock_response
            
            document_id = 789
            result = await service.delete_document(document_id)
            
            assert result is True
    
    @pytest.mark.asyncio
    async def test_delete_document_not_found(self):
        """Test deletion with document not found (should succeed)."""
        service = PaperlessService(self.base_url, self.username, self.password, self.user_id)
        
        # Mock 404 response (document already deleted)
        mock_response = AsyncMock()
        mock_response.status = 404
        
        with patch.object(service, '_make_request') as mock_request:
            mock_request.return_value.__aenter__.return_value = mock_response
            
            document_id = 999
            result = await service.delete_document(document_id)
            
            assert result is True  # Should succeed since document is already gone
    
    @pytest.mark.asyncio
    async def test_search_documents_success(self):
        """Test successful document search."""
        service = PaperlessService(self.base_url, self.username, self.password, self.user_id)
        
        # Mock successful search response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "count": 2,
            "results": [
                {"id": 1, "title": "Document 1"},
                {"id": 2, "title": "Document 2"}
            ]
        }
        
        with patch.object(service, '_make_request') as mock_request:
            mock_request.return_value.__aenter__.return_value = mock_response
            
            query = "test query"
            result = await service.search_documents(query)
            
            assert result["count"] == 2
            assert len(result["results"]) == 2
            
            # Verify user context was added to query
            mock_request.assert_called_once()
            call_args = mock_request.call_args
            params = call_args[1]["params"]
            assert f"medical_record_user_id:{self.user_id}" in params["query"]
    
    @pytest.mark.asyncio
    async def test_search_documents_empty_query(self):
        """Test document search with empty query."""
        service = PaperlessService(self.base_url, self.username, self.password, self.user_id)
        
        # Mock successful search response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {"count": 0, "results": []}
        
        with patch.object(service, '_make_request') as mock_request:
            mock_request.return_value.__aenter__.return_value = mock_response
            
            result = await service.search_documents("")
            
            # Verify user context filtering is still applied
            mock_request.assert_called_once()
            call_args = mock_request.call_args
            params = call_args[1]["params"]
            assert params["query"] == f"custom_fields.medical_record_user_id:{self.user_id}"


class TestPaperlessServiceCreation:
    """Test cases for paperless service creation."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.paperless_url = "https://paperless.example.com"
        self.api_token = "a1b2c3d4e5f6789012345678901234567890abcd"
        self.user_id = 123
        
    @pytest.mark.asyncio
    async def test_create_service_success(self):
        """Test successful service creation with encrypted token."""
        # Encrypt token
        encrypted_token = credential_encryption.encrypt_token(self.api_token)
        
        service = await create_paperless_service(
            self.paperless_url, encrypted_token, self.user_id
        )
        
        assert service.base_url == self.paperless_url
        assert service.api_token == self.api_token
        assert service.user_id == self.user_id
    
    @pytest.mark.asyncio
    async def test_create_service_invalid_token(self):
        """Test service creation with invalid encrypted token."""
        invalid_encrypted_token = "invalid_token"
        
        with pytest.raises(PaperlessError, match="Service creation failed"):
            await create_paperless_service(
                self.paperless_url, invalid_encrypted_token, self.user_id
            )
    
    @pytest.mark.asyncio
    async def test_create_service_empty_token(self):
        """Test service creation with empty token."""
        with pytest.raises(PaperlessError, match="Failed to decrypt API token"):
            await create_paperless_service(
                self.paperless_url, "", self.user_id
            )


class TestCredentialEncryption:
    """Test cases for credential encryption."""
    
    def test_encrypt_decrypt_token(self):
        """Test token encryption and decryption."""
        original_token = "a1b2c3d4e5f6789012345678901234567890abcd"
        
        # Encrypt token
        encrypted = credential_encryption.encrypt_token(original_token)
        assert encrypted is not None
        assert encrypted != original_token
        assert len(encrypted) > len(original_token)
        
        # Decrypt token
        decrypted = credential_encryption.decrypt_token(encrypted)
        assert decrypted == original_token
    
    def test_encrypt_empty_token(self):
        """Test encrypting empty token."""
        result = credential_encryption.encrypt_token("")
        assert result is None
        
        result = credential_encryption.encrypt_token(None)
        assert result is None
    
    def test_decrypt_empty_token(self):
        """Test decrypting empty token."""
        result = credential_encryption.decrypt_token("")
        assert result is None
        
        result = credential_encryption.decrypt_token(None)
        assert result is None
    
    def test_is_encrypted(self):
        """Test encrypted token detection."""
        original_token = "a1b2c3d4e5f6789012345678901234567890abcd"
        encrypted_token = credential_encryption.encrypt_token(original_token)
        
        assert credential_encryption.is_encrypted(original_token) is False
        assert credential_encryption.is_encrypted(encrypted_token) is True
        assert credential_encryption.is_encrypted("") is False
        assert credential_encryption.is_encrypted("short") is False
    
    def test_invalid_token_format(self):
        """Test invalid token format validation."""
        from app.services.credential_encryption import SecurityError
        
        # Test with a token that's too short (less than 10 characters)
        with pytest.raises(SecurityError, match="Invalid API token format"):
            credential_encryption.encrypt_token("short")


class TestPaperlessAuthentication:
    """Test cases for dual authentication support."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.base_url = "https://paperless.example.com"
        self.api_token = "a1b2c3d4e5f6789012345678901234567890abcd"
        self.username = "testuser"
        self.password = "testpass"
        self.user_id = 123
        
    def test_smart_factory_token_priority(self):
        """Test that smart factory prioritizes token auth over basic auth."""
        with patch('app.services.credential_encryption.credential_encryption.decrypt_token') as mock_decrypt:
            # Mock successful decryption for both token and credentials
            mock_decrypt.side_effect = lambda x: {
                'encrypted_token': self.api_token,
                'encrypted_username': self.username,
                'encrypted_password': self.password
            }.get(x, x)
            
            service = create_paperless_service(
                paperless_url=self.base_url,
                encrypted_token='encrypted_token',
                encrypted_username='encrypted_username', 
                encrypted_password='encrypted_password',
                user_id=self.user_id
            )
            
            assert isinstance(service, PaperlessServiceToken)
            assert service.get_auth_type() == "token"
    
    def test_smart_factory_basic_auth_fallback(self):
        """Test that smart factory falls back to basic auth when no token available."""
        with patch('app.services.credential_encryption.credential_encryption.decrypt_token') as mock_decrypt:
            # Mock successful decryption for credentials only
            mock_decrypt.side_effect = lambda x: {
                'encrypted_username': self.username,
                'encrypted_password': self.password
            }.get(x, x)
            
            service = create_paperless_service(
                paperless_url=self.base_url,
                encrypted_token=None,
                encrypted_username='encrypted_username',
                encrypted_password='encrypted_password',
                user_id=self.user_id
            )
            
            assert isinstance(service, PaperlessService)
            assert service.get_auth_type() == "basic_auth"
    
    def test_smart_factory_no_credentials(self):
        """Test that smart factory raises error when no valid credentials."""
        with pytest.raises(PaperlessError, match="No valid authentication credentials"):
            create_paperless_service(
                paperless_url=self.base_url,
                encrypted_token=None,
                encrypted_username=None,
                encrypted_password=None,
                user_id=self.user_id
            )
    
    def test_token_service_creation(self):
        """Test creating token service directly."""
        with patch('app.services.credential_encryption.credential_encryption.decrypt_token') as mock_decrypt:
            mock_decrypt.return_value = self.api_token
            
            service = create_paperless_service_with_token(
                paperless_url=self.base_url,
                encrypted_token='encrypted_token',
                user_id=self.user_id
            )
            
            assert isinstance(service, PaperlessServiceToken)
            assert service.get_auth_type() == "token"
            assert service.api_token == self.api_token
    
    def test_basic_auth_service_creation(self):
        """Test creating basic auth service directly."""
        with patch('app.services.credential_encryption.credential_encryption.decrypt_token') as mock_decrypt:
            mock_decrypt.side_effect = [self.username, self.password]
            
            service = create_paperless_service_with_username_password(
                paperless_url=self.base_url,
                encrypted_username='encrypted_username',
                encrypted_password='encrypted_password',
                user_id=self.user_id
            )
            
            assert isinstance(service, PaperlessService)
            assert service.get_auth_type() == "basic_auth"
            assert service.username == self.username
            assert service.password == self.password


# Integration test fixtures (commented out - would need actual paperless instance)
"""
@pytest.mark.integration
class TestPaperlessIntegration:
    \"\"\"Integration tests with real paperless instance (requires setup).\"\"\"
    
    @pytest.fixture
    def paperless_config(self):
        \"\"\"Paperless configuration for integration tests.\"\"\"
        return {
            "url": os.getenv("TEST_PAPERLESS_URL"),
            "token": os.getenv("TEST_PAPERLESS_TOKEN"),
            "user_id": 1
        }
    
    @pytest.mark.asyncio
    async def test_real_connection(self, paperless_config):
        \"\"\"Test connection to real paperless instance.\"\"\"
        if not all(paperless_config.values()):
            pytest.skip("Paperless integration test config not provided")
        
        service = PaperlessService(
            paperless_config["url"],
            paperless_config["token"],
            paperless_config["user_id"]
        )
        
        async with service:
            result = await service.test_connection()
            assert result["status"] == "connected"
"""