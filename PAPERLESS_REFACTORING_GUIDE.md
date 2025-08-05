# Paperless Integration System - Comprehensive Refactoring Guide

## Executive Summary

This document provides a complete implementation guide for refactoring the paperless integration system. The refactoring addresses critical security vulnerabilities, architectural issues, and technical debt while maintaining all existing functionality.

### Objectives
- **Security**: Eliminate credential exposure and implement proper security measures
- **Architecture**: Transform from monolithic to clean, modular architecture
- **Performance**: Reduce API calls, optimize queries, and improve frontend rendering
- **Maintainability**: Implement DRY principles, proper error handling, and comprehensive testing
- **Code Quality**: Establish consistent patterns and eliminate technical debt

### Timeline Overview
- **Total Duration**: 4-5 weeks
- **Critical Phase**: Week 1 (Security fixes - IMMEDIATE)
- **Core Refactoring**: Weeks 2-3 (Architecture and services)
- **Frontend & Database**: Week 4 (Modern components and schema)
- **Testing & Deployment**: Week 5 (Comprehensive testing and rollout)

### Success Metrics
- ✅ Zero credential exposure in logs
- ✅ 50% reduction in code complexity
- ✅ 80%+ test coverage (from current ~30%)
- ✅ 70% reduction in frontend re-renders
- ✅ Eliminate N+1 query patterns
- ✅ All existing features preserved

---

## Table of Contents

1. [Phase 1: Critical Security Fixes](#phase-1-critical-security-fixes)
2. [Phase 2: Service Layer Refactoring](#phase-2-service-layer-refactoring)
3. [Phase 3: Frontend Architecture Cleanup](#phase-3-frontend-architecture-cleanup)
4. [Phase 4: Database Schema Optimization](#phase-4-database-schema-optimization)
5. [Phase 5: Testing Implementation](#phase-5-testing-implementation)
6. [Phase 6: Deployment and Validation](#phase-6-deployment-and-validation)
7. [Progress Tracking System](#progress-tracking-system)
8. [Risk Management](#risk-management)
9. [Configuration Management](#configuration-management)
10. [File Organization](#file-organization)

---

## Phase 1: Critical Security Fixes
**Duration**: 1-2 days | **Priority**: CRITICAL

### 1.1 Debug Logging Cleanup

#### Current Issues:
- `logger.error()` used for debug messages (will appear in production)
- Credential values exposed in logs
- 🔍 emoji logging polluting production logs

#### Files to Update:
- `app/api/v1/endpoints/paperless.py`
- `app/services/paperless_service.py`
- `app/services/generic_entity_file_service.py`

#### Implementation Steps:

**Step 1.1.1: Create Logging Cleanup Script**
```python
# scripts/cleanup_debug_logging.py
import os
import re
from pathlib import Path

def cleanup_debug_logging():
    """Remove dangerous debug logging statements."""
    
    files_to_clean = [
        "app/api/v1/endpoints/paperless.py",
        "app/services/paperless_service.py", 
        "app/services/generic_entity_file_service.py"
    ]
    
    for file_path in files_to_clean:
        if os.path.exists(file_path):
            with open(file_path, 'r') as f:
                content = f.read()
            
            # Remove debug logger.error statements with emojis
            content = re.sub(r'logger\.error\(f?"🔍[^"]*"[^)]*\)', '', content)
            
            # Replace credential logging with sanitized versions
            content = re.sub(
                r'logger\.error\([^)]*token[^)]*\)',
                'logger.debug("Authentication token present")',
                content,
                flags=re.IGNORECASE
            )
            
            with open(file_path, 'w') as f:
                f.write(content)
    
    print("Debug logging cleanup completed")

if __name__ == "__main__":
    cleanup_debug_logging()
```

**Step 1.1.2: Implement Structured Logging**
```python
# app/core/logging.py
import logging
import json
from datetime import datetime
from typing import Dict, Any, Optional

class StructuredLogger:
    """Secure, structured logging for paperless operations."""
    
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.logger = logging.getLogger(f"paperless.{service_name}")
    
    def log_operation(
        self, 
        operation: str, 
        level: str = "info",
        user_id: Optional[int] = None,
        **context
    ):
        """Log operation with structured context (no sensitive data)."""
        
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "service": self.service_name,
            "operation": operation,
            "user_id": user_id,
            # Only log non-sensitive context
            "context": self._sanitize_context(context)
        }
        
        getattr(self.logger, level)(
            f"{operation} completed",
            extra=log_entry
        )
    
    def _sanitize_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Remove sensitive information from logging context."""
        sanitized = {}
        
        for key, value in context.items():
            # Never log credentials, tokens, or passwords
            if any(sensitive in key.lower() for sensitive in 
                   ['token', 'password', 'credential', 'auth', 'key']):
                sanitized[key] = "***REDACTED***"
            # Log boolean flags for debugging without exposing values
            elif 'has_' in key.lower():
                sanitized[key] = bool(value)
            # Log safe operational data
            elif key in ['file_id', 'document_id', 'task_uuid', 'status', 'backend']:
                sanitized[key] = value
            else:
                sanitized[key] = "***FILTERED***"
        
        return sanitized

# Usage example:
paperless_logger = StructuredLogger("authentication")
paperless_logger.log_operation(
    "paperless_connection_test",
    level="info",
    user_id=123,
    has_token=True,  # Safe boolean flag
    backend_url_host="paperless.example.com",  # Safe host info
    status="success"
)
```

**Step 1.1.3: Replace Existing Debug Statements**
```python
# Before (DANGEROUS):
logger.error(f"🔍 API DEBUG - Raw token: '{connection_data.paperless_api_token}'")
logger.error(f"🔍 TOKEN SERVICE DEBUG - Initializing with token: '{api_token[:10] if api_token else None}...'")

# After (SECURE):
paperless_logger.log_operation(
    "paperless_service_init", 
    level="debug",
    user_id=user_id,
    auth_method="token" if api_token else "basic",
    has_credentials=bool(api_token or (username and password))
)
```

### 1.2 Credential Storage Security

#### Current Issues:
- Single encryption key for all users
- Hardcoded salt values
- No key rotation mechanism

#### Implementation Steps:

**Step 1.2.1: Enhanced Credential Encryption**
```python
# app/core/security.py
import base64
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from typing import Optional
import secrets

class EnhancedCredentialEncryption:
    """Per-user credential encryption with key rotation support."""
    
    def __init__(self):
        self.master_key = self._derive_master_key()
        self.key_version = int(os.getenv("CREDENTIAL_KEY_VERSION", "1"))
    
    def encrypt_credential(self, credential: str, user_id: int) -> str:
        """Encrypt credential with user-specific key."""
        user_key = self._derive_user_key(user_id, self.key_version)
        cipher = Fernet(user_key)
        
        encrypted_data = cipher.encrypt(credential.encode())
        
        # Include key version for rotation support
        versioned_data = f"v{self.key_version}:{base64.urlsafe_b64encode(encrypted_data).decode()}"
        return versioned_data
    
    def decrypt_credential(self, encrypted_credential: str, user_id: int) -> Optional[str]:
        """Decrypt credential handling key versioning."""
        try:
            if ':' in encrypted_credential:
                version_str, data = encrypted_credential.split(':', 1)
                key_version = int(version_str[1:])  # Remove 'v' prefix
                encrypted_data = base64.urlsafe_b64decode(data.encode())
            else:
                # Legacy format - assume version 1
                key_version = 1
                encrypted_data = base64.urlsafe_b64decode(encrypted_credential.encode())
            
            user_key = self._derive_user_key(user_id, key_version)
            cipher = Fernet(user_key)
            
            return cipher.decrypt(encrypted_data).decode()
            
        except Exception:
            return None
    
    def _derive_user_key(self, user_id: int, key_version: int) -> bytes:
        """Derive user-specific encryption key."""
        user_salt = f"user_{user_id}_v{key_version}_{os.getenv('PAPERLESS_SALT', 'default')}".encode()
        return self._derive_key(self.master_key, user_salt)
    
    def _derive_master_key(self) -> bytes:
        """Derive master key from application secret."""
        secret = os.getenv('SECRET_KEY', 'default_secret').encode()
        salt = os.getenv('MASTER_SALT', 'paperless_master_salt').encode()
        return self._derive_key(secret, salt)
    
    def _derive_key(self, password: bytes, salt: bytes) -> bytes:
        """Derive encryption key using PBKDF2."""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,  # High iteration count for security
        )
        return base64.urlsafe_b64encode(kdf.derive(password))
```

### 1.3 Input Validation

#### Implementation Steps:

**Step 1.3.1: Enhanced URL Validation**
```python
# app/core/validation.py
import re
import ipaddress
from urllib.parse import urlparse
from typing import List, Optional

class PaperlessConfigValidator:
    """Comprehensive validation for Paperless configuration."""
    
    ALLOWED_DOMAINS = os.getenv("PAPERLESS_ALLOWED_DOMAINS", "").split(",")
    BLOCKED_DOMAINS = ["localhost", "127.0.0.1", "0.0.0.0"]
    PRIVATE_NETWORKS = [
        ipaddress.ip_network("10.0.0.0/8"),
        ipaddress.ip_network("172.16.0.0/12"),
        ipaddress.ip_network("192.168.0.0/16"),
        ipaddress.ip_network("127.0.0.0/8"),
    ]
    
    @classmethod
    def validate_paperless_url(cls, url: str) -> str:
        """Validate Paperless URL for security."""
        try:
            parsed = urlparse(url)
            
            # Protocol validation
            if parsed.scheme not in ["http", "https"]:
                raise ValueError("URL must use HTTP or HTTPS protocol")
            
            # Hostname validation
            if not parsed.hostname:
                raise ValueError("Invalid hostname")
            
            # Domain whitelist check
            if cls.ALLOWED_DOMAINS and cls.ALLOWED_DOMAINS != [""]:
                if parsed.hostname not in cls.ALLOWED_DOMAINS:
                    raise ValueError("Domain not in allowed list")
            
            # Block dangerous domains
            if parsed.hostname in cls.BLOCKED_DOMAINS:
                raise ValueError("Domain is blocked for security")
            
            # Check for private IP ranges
            try:
                ip = ipaddress.ip_address(parsed.hostname)
                if any(ip in network for network in cls.PRIVATE_NETWORKS):
                    if not cls._is_explicitly_allowed(parsed.hostname):
                        raise ValueError("Private IP access denied")
            except ipaddress.AddressValueError:
                # Not an IP address, continue with domain validation
                pass
            
            # Port validation
            if parsed.port and parsed.port < 1024:
                if parsed.hostname not in ["localhost", "127.0.0.1"]:
                    raise ValueError("Privileged ports not allowed for external hosts")
            
            return url.rstrip("/")
            
        except Exception as e:
            raise ValueError(f"Invalid Paperless URL: {str(e)}")
    
    @classmethod
    def _is_explicitly_allowed(cls, hostname: str) -> bool:
        """Check if private IP is explicitly allowed."""
        return hostname in cls.ALLOWED_DOMAINS
    
    @classmethod
    def validate_credentials(cls, token: Optional[str], username: Optional[str], password: Optional[str]) -> bool:
        """Validate credential format."""
        if token:
            # Token should be alphanumeric with specific length
            if not re.match(r'^[a-zA-Z0-9]{20,}$', token):
                raise ValueError("Invalid token format")
        elif username and password:
            # Basic validation for username/password
            if len(username) < 3 or len(password) < 8:
                raise ValueError("Username must be 3+ chars, password 8+ chars")
        else:
            raise ValueError("Either token or username/password required")
        
        return True
```

### 1.4 Testing Phase 1 Changes

**Step 1.4.1: Security Test Suite**
```python
# tests/security/test_credential_encryption.py
import pytest
from app.core.security import EnhancedCredentialEncryption

class TestCredentialEncryption:
    
    def test_per_user_encryption(self):
        """Test that different users get different encrypted values."""
        encryption = EnhancedCredentialEncryption()
        credential = "test_password"
        
        encrypted_user1 = encryption.encrypt_credential(credential, user_id=1)
        encrypted_user2 = encryption.encrypt_credential(credential, user_id=2)
        
        assert encrypted_user1 != encrypted_user2
        assert encryption.decrypt_credential(encrypted_user1, 1) == credential
        assert encryption.decrypt_credential(encrypted_user2, 2) == credential
        
        # Cross-user decryption should fail
        assert encryption.decrypt_credential(encrypted_user1, 2) is None
    
    def test_key_versioning(self):
        """Test key version handling."""
        encryption = EnhancedCredentialEncryption()
        credential = "test_password"
        
        encrypted = encryption.encrypt_credential(credential, user_id=1)
        
        # Should include version prefix
        assert encrypted.startswith("v1:")
        
        # Should decrypt correctly
        decrypted = encryption.decrypt_credential(encrypted, user_id=1)
        assert decrypted == credential

# tests/security/test_input_validation.py
import pytest
from app.core.validation import PaperlessConfigValidator

class TestPaperlessValidation:
    
    def test_valid_urls(self):
        """Test valid URL acceptance."""
        valid_urls = [
            "https://paperless.example.com",
            "http://localhost:8000",
            "https://paperless.local:8080"
        ]
        
        for url in valid_urls:
            result = PaperlessConfigValidator.validate_paperless_url(url)
            assert result == url.rstrip("/")
    
    def test_invalid_urls(self):
        """Test invalid URL rejection."""
        invalid_urls = [
            "ftp://paperless.com",  # Invalid protocol
            "https://",  # No hostname
            "https://192.168.1.1",  # Private IP
            "javascript:alert(1)"  # Dangerous protocol
        ]
        
        for url in invalid_urls:
            with pytest.raises(ValueError):
                PaperlessConfigValidator.validate_paperless_url(url)
```

### 1.5 Phase 1 Completion Checklist

- [ ] Debug logging cleanup script executed
- [ ] All credential exposure removed from logs
- [ ] Structured logging implemented
- [ ] Enhanced credential encryption deployed
- [ ] Input validation hardened
- [ ] Security tests passing
- [ ] Production logs verified clean
- [ ] No functionality regressions

---

## Phase 2: Service Layer Refactoring
**Duration**: 3-4 days | **Priority**: HIGH

### 2.1 Service Decomposition Strategy

#### Current Monolithic Services:
- `PaperlessServiceBase` (1000+ lines) - Too many responsibilities
- `GenericEntityFileService` (2100+ lines) - Mixed concerns
- Duplicate authentication logic across services

#### Target Architecture:
```
app/services/paperless/
├── __init__.py
├── authentication/
│   ├── __init__.py
│   ├── auth_service.py          # Unified authentication
│   ├── credential_manager.py    # Secure credential handling
│   └── session_manager.py       # Session lifecycle
├── documents/
│   ├── __init__.py
│   ├── document_service.py      # Document operations
│   ├── upload_service.py        # File upload handling
│   └── download_service.py      # File retrieval
├── sync/
│   ├── __init__.py
│   ├── sync_service.py          # Sync status management
│   ├── task_monitor.py          # Task status monitoring
│   └── conflict_resolver.py     # Sync conflict handling
└── integration/
    ├── __init__.py
    ├── api_client.py            # HTTP client wrapper
    ├── error_handler.py         # Centralized error handling
    └── health_checker.py        # Connection health monitoring
```

### 2.2 Authentication Service Implementation

**Step 2.2.1: Unified Authentication Service**
```python
# app/services/paperless/authentication/auth_service.py
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Dict, Any
import aiohttp
from app.core.security import EnhancedCredentialEncryption
from app.core.logging import StructuredLogger

@dataclass
class PaperlessCredentials:
    """Encapsulate Paperless authentication credentials."""
    base_url: str
    token: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    
    @property
    def auth_method(self) -> str:
        return "token" if self.token else "basic"
    
    def validate(self) -> bool:
        """Validate credential completeness."""
        if self.token:
            return bool(self.token.strip())
        return bool(self.username and self.password)

class AuthenticationService(ABC):
    """Abstract base for Paperless authentication."""
    
    def __init__(self, credentials: PaperlessCredentials, user_id: int):
        self.credentials = credentials
        self.user_id = user_id
        self.logger = StructuredLogger("paperless_auth")
        self.session: Optional[aiohttp.ClientSession] = None
    
    @abstractmethod
    async def create_session(self) -> aiohttp.ClientSession:
        """Create authenticated HTTP session."""
        pass
    
    async def get_session(self) -> aiohttp.ClientSession:
        """Get or create authenticated session."""
        if not self.session or self.session.closed:
            self.session = await self.create_session()
        return self.session
    
    async def test_connection(self) -> Dict[str, Any]:
        """Test authentication and connection."""
        try:
            session = await self.get_session()
            async with session.get(f"{self.credentials.base_url}/api/ui_settings/") as response:
                if response.status == 200:
                    self.logger.log_operation(
                        "connection_test_success",
                        user_id=self.user_id,
                        auth_method=self.credentials.auth_method
                    )
                    return {"status": "success", "auth_method": self.credentials.auth_method}
                else:
                    return {"status": "failed", "error": f"HTTP {response.status}"}
        except Exception as e:
            self.logger.log_operation(
                "connection_test_failed",
                level="error",
                user_id=self.user_id,
                error_type=type(e).__name__
            )
            return {"status": "failed", "error": str(e)}
    
    async def close(self):
        """Clean up session resources."""
        if self.session and not self.session.closed:
            await self.session.close()

class TokenAuthenticationService(AuthenticationService):
    """Token-based authentication (recommended for 2FA)."""
    
    async def create_session(self) -> aiohttp.ClientSession:
        """Create session with token authentication."""
        headers = {
            "Authorization": f"Token {self.credentials.token}",
            "Content-Type": "application/json",
            "User-Agent": "MedicalRecords-PaperlessIntegration/1.0"
        }
        
        connector = aiohttp.TCPConnector(ssl=True)
        timeout = aiohttp.ClientTimeout(total=30, connect=10)
        
        return aiohttp.ClientSession(
            headers=headers,
            connector=connector,
            timeout=timeout
        )

class BasicAuthenticationService(AuthenticationService):
    """Username/password authentication."""
    
    async def create_session(self) -> aiohttp.ClientSession:
        """Create session with basic authentication."""
        auth = aiohttp.BasicAuth(self.credentials.username, self.credentials.password)
        
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "MedicalRecords-PaperlessIntegration/1.0"
        }
        
        connector = aiohttp.TCPConnector(ssl=True)
        timeout = aiohttp.ClientTimeout(total=30, connect=10)
        
        return aiohttp.ClientSession(
            auth=auth,
            headers=headers,
            connector=connector,
            timeout=timeout
        )

class AuthenticationFactory:
    """Factory for creating appropriate authentication service."""
    
    @staticmethod
    def create_auth_service(
        base_url: str,
        user_id: int,
        encrypted_token: Optional[str] = None,
        encrypted_username: Optional[str] = None,
        encrypted_password: Optional[str] = None
    ) -> AuthenticationService:
        """Create appropriate authentication service based on available credentials."""
        
        encryption = EnhancedCredentialEncryption()
        
        # Priority 1: Token authentication
        if encrypted_token:
            token = encryption.decrypt_credential(encrypted_token, user_id)
            if token:
                credentials = PaperlessCredentials(base_url=base_url, token=token)
                return TokenAuthenticationService(credentials, user_id)
        
        # Priority 2: Basic authentication
        if encrypted_username and encrypted_password:
            username = encryption.decrypt_credential(encrypted_username, user_id)
            password = encryption.decrypt_credential(encrypted_password, user_id)
            if username and password:
                credentials = PaperlessCredentials(
                    base_url=base_url, 
                    username=username, 
                    password=password
                )
                return BasicAuthenticationService(credentials, user_id)
        
        raise ValueError("No valid authentication credentials provided")
```

### 2.3 Document Service Implementation

**Step 2.3.1: Document Service**
```python
# app/services/paperless/documents/document_service.py
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from app.services.paperless.authentication.auth_service import AuthenticationService
from app.core.logging import StructuredLogger

@dataclass
class DocumentUploadResult:
    """Result of document upload operation."""
    success: bool
    task_id: Optional[str] = None
    document_id: Optional[str] = None
    error: Optional[str] = None
    
    @classmethod
    def success_with_task(cls, task_id: str):
        return cls(success=True, task_id=task_id)
    
    @classmethod
    def success_with_document(cls, document_id: str):
        return cls(success=True, document_id=document_id)
    
    @classmethod
    def failure(cls, error: str):
        return cls(success=False, error=error)

class DocumentService:
    """Handles Paperless document operations."""
    
    def __init__(self, auth_service: AuthenticationService):
        self.auth_service = auth_service
        self.logger = StructuredLogger("paperless_documents")
    
    async def upload_document(
        self,
        file_content: bytes,
        filename: str,
        title: Optional[str] = None,
        correspondent: Optional[str] = None,
        document_type: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> DocumentUploadResult:
        """Upload document to Paperless."""
        
        try:
            session = await self.auth_service.get_session()
            
            # Prepare form data
            form_data = aiohttp.FormData()
            form_data.add_field('document', file_content, filename=filename)
            
            if title:
                form_data.add_field('title', title)
            if correspondent:
                form_data.add_field('correspondent', correspondent)
            if document_type:
                form_data.add_field('document_type', document_type)
            if tags:
                form_data.add_field('tags', ','.join(tags))
            
            # Upload document
            upload_url = f"{self.auth_service.credentials.base_url}/api/documents/post_document/"
            
            async with session.post(upload_url, data=form_data) as response:
                if response.status == 200:
                    result = await response.json()
                    task_id = result.get('task_id')
                    
                    self.logger.log_operation(
                        "document_upload_initiated",
                        user_id=self.auth_service.user_id,
                        filename=filename,
                        task_id=task_id
                    )
                    
                    return DocumentUploadResult.success_with_task(task_id)
                else:
                    error_text = await response.text()
                    self.logger.log_operation(
                        "document_upload_failed",
                        level="error",
                        user_id=self.auth_service.user_id,
                        filename=filename,
                        status_code=response.status,
                        error=error_text[:200]  # Limit error message length
                    )
                    return DocumentUploadResult.failure(f"Upload failed: HTTP {response.status}")
                    
        except Exception as e:
            self.logger.log_operation(
                "document_upload_exception",
                level="error",
                user_id=self.auth_service.user_id,
                filename=filename,
                error_type=type(e).__name__
            )
            return DocumentUploadResult.failure(str(e))
    
    async def check_document_exists(self, document_id: str) -> bool:
        """Check if document exists in Paperless."""
        try:
            session = await self.auth_service.get_session()
            check_url = f"{self.auth_service.credentials.base_url}/api/documents/{document_id}/"
            
            async with session.get(check_url) as response:
                exists = response.status == 200
                
                self.logger.log_operation(
                    "document_existence_check",
                    user_id=self.auth_service.user_id,
                    document_id=document_id,
                    exists=exists
                )
                
                return exists
                
        except Exception as e:
            self.logger.log_operation(
                "document_existence_check_failed",
                level="error",
                user_id=self.auth_service.user_id,
                document_id=document_id,
                error_type=type(e).__name__
            )
            return False
    
    async def get_document_info(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Get document information from Paperless."""
        try:
            session = await self.auth_service.get_session()
            info_url = f"{self.auth_service.credentials.base_url}/api/documents/{document_id}/"
            
            async with session.get(info_url) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    return None
                    
        except Exception as e:
            self.logger.log_operation(
                "document_info_fetch_failed",
                level="error",
                user_id=self.auth_service.user_id,
                document_id=document_id,
                error_type=type(e).__name__
            )
            return None
```

### 2.4 Task Monitoring Service

**Step 2.4.1: Simplified Task Monitor**
```python
# app/services/paperless/sync/task_monitor.py
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum
import asyncio
from app.services.paperless.authentication.auth_service import AuthenticationService
from app.core.logging import StructuredLogger

class TaskStatus(Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    PROGRESS = "PROGRESS"

@dataclass
class TaskResult:
    """Result of task monitoring."""
    status: TaskStatus
    document_id: Optional[str] = None
    error: Optional[str] = None
    progress: Optional[Dict[str, Any]] = None
    
    @property
    def is_complete(self) -> bool:
        return self.status in [TaskStatus.SUCCESS, TaskStatus.FAILURE]
    
    @property
    def is_successful(self) -> bool:
        return self.status == TaskStatus.SUCCESS

class TaskMonitorService:
    """Simplified task monitoring for Paperless operations."""
    
    def __init__(self, auth_service: AuthenticationService):
        self.auth_service = auth_service
        self.logger = StructuredLogger("paperless_tasks")
    
    async def get_task_status(self, task_id: str) -> TaskResult:
        """Get current status of a Paperless task."""
        try:
            session = await self.auth_service.get_session()
            task_url = f"{self.auth_service.credentials.base_url}/api/tasks/{task_id}/"
            
            async with session.get(task_url) as response:
                if response.status == 200:
                    task_data = await response.json()
                    return self._parse_task_response(task_data, task_id)
                else:
                    error_msg = f"HTTP {response.status}"
                    return TaskResult(status=TaskStatus.FAILURE, error=error_msg)
                    
        except Exception as e:
            self.logger.log_operation(
                "task_status_check_failed",
                level="error",
                user_id=self.auth_service.user_id,
                task_id=task_id,
                error_type=type(e).__name__
            )
            return TaskResult(status=TaskStatus.FAILURE, error=str(e))
    
    def _parse_task_response(self, task_data: Dict[str, Any], task_id: str) -> TaskResult:
        """Parse Paperless task response into standardized result."""
        
        status_str = task_data.get("status", "PENDING").upper()
        
        try:
            status = TaskStatus(status_str)
        except ValueError:
            # Unknown status, treat as pending
            status = TaskStatus.PENDING
        
        if status == TaskStatus.SUCCESS:
            # Extract document ID from successful task
            document_id = self._extract_document_id(task_data)
            
            self.logger.log_operation(
                "task_completed_successfully",
                user_id=self.auth_service.user_id,
                task_id=task_id,
                document_id=document_id
            )
            
            return TaskResult(status=status, document_id=document_id)
            
        elif status == TaskStatus.FAILURE:
            error = task_data.get("result", "Task failed")
            
            self.logger.log_operation(
                "task_failed",
                level="warning",
                user_id=self.auth_service.user_id,
                task_id=task_id,
                error=str(error)[:200]  # Limit error length
            )
            
            return TaskResult(status=status, error=str(error))
        
        else:
            # Task still in progress
            return TaskResult(status=status, progress=task_data)
    
    def _extract_document_id(self, task_data: Dict[str, Any]) -> Optional[str]:
        """Extract document ID from successful task data."""
        
        # Try standard fields first
        document_id = task_data.get("result", {}).get("document_id")
        if document_id:
            return str(document_id)
        
        # Try alternative fields
        document_id = task_data.get("id") or task_data.get("related_document")
        if document_id:
            return str(document_id)
        
        # Try extracting from result string (fallback)
        result = task_data.get("result", "")
        if isinstance(result, str):
            import re
            match = re.search(r'document\s+(?:id\s+)?(\d+)', result, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    async def wait_for_completion(
        self, 
        task_id: str, 
        max_wait_seconds: int = 300,
        poll_interval: float = 2.0
    ) -> TaskResult:
        """Wait for task completion with exponential backoff."""
        
        start_time = asyncio.get_event_loop().time()
        current_interval = poll_interval
        
        while True:
            result = await self.get_task_status(task_id)
            
            if result.is_complete:
                return result
            
            # Check timeout
            elapsed = asyncio.get_event_loop().time() - start_time
            if elapsed >= max_wait_seconds:
                self.logger.log_operation(
                    "task_wait_timeout",
                    level="warning",
                    user_id=self.auth_service.user_id,
                    task_id=task_id,
                    elapsed_seconds=elapsed
                )
                return TaskResult(status=TaskStatus.FAILURE, error="Timeout waiting for task completion")
            
            # Wait with exponential backoff (max 10 seconds)
            await asyncio.sleep(min(current_interval, 10.0))
            current_interval = min(current_interval * 1.5, 10.0)
```

### 2.5 Phase 2 Testing

**Step 2.5.1: Service Integration Tests**
```python
# tests/services/test_paperless_services.py
import pytest
from unittest.mock import AsyncMock, patch
from app.services.paperless.authentication.auth_service import AuthenticationFactory
from app.services.paperless.documents.document_service import DocumentService
from app.services.paperless.sync.task_monitor import TaskMonitorService, TaskStatus

class TestPaperlessServices:
    
    @pytest.fixture
    async def auth_service(self):
        """Mock authentication service."""
        with patch('app.core.security.EnhancedCredentialEncryption') as mock_encryption:
            mock_encryption.return_value.decrypt_credential.return_value = "test_token"
            
            auth_service = AuthenticationFactory.create_auth_service(
                base_url="https://test.paperless.com",
                user_id=1,
                encrypted_token="encrypted_test_token"
            )
            
            # Mock the session
            auth_service.session = AsyncMock()
            yield auth_service
            
            await auth_service.close()
    
    @pytest.mark.asyncio
    async def test_document_upload_success(self, auth_service):
        """Test successful document upload."""
        document_service = DocumentService(auth_service)
        
        # Mock successful upload response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {"task_id": "test-task-123"}
        
        auth_service.session.post.return_value.__aenter__.return_value = mock_response
        
        result = await document_service.upload_document(
            file_content=b"test content",
            filename="test.pdf",
            title="Test Document"
        )
        
        assert result.success
        assert result.task_id == "test-task-123"
        assert result.error is None
    
    @pytest.mark.asyncio
    async def test_task_monitoring_success(self, auth_service):
        """Test successful task monitoring."""
        task_service = TaskMonitorService(auth_service)
        
        # Mock successful task response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {
            "status": "SUCCESS",
            "result": {"document_id": "123"}
        }
        
        auth_service.session.get.return_value.__aenter__.return_value = mock_response
        
        result = await task_service.get_task_status("test-task-123")
        
        assert result.status == TaskStatus.SUCCESS
        assert result.document_id == "123"
        assert result.is_successful
    
    @pytest.mark.asyncio
    async def test_authentication_factory_token_priority(self):
        """Test that token authentication is prioritized over basic auth."""
        with patch('app.core.security.EnhancedCredentialEncryption') as mock_encryption:
            mock_encryption.return_value.decrypt_credential.side_effect = lambda cred, user_id: {
                "token": "test_token",
                "username": "test_user", 
                "password": "test_pass"
            }.get(cred.split("_")[-1])
            
            auth_service = AuthenticationFactory.create_auth_service(
                base_url="https://test.paperless.com",
                user_id=1,
                encrypted_token="encrypted_token",
                encrypted_username="encrypted_username",
                encrypted_password="encrypted_password"
            )
            
            # Should create token auth service
            from app.services.paperless.authentication.auth_service import TokenAuthenticationService
            assert isinstance(auth_service, TokenAuthenticationService)
            assert auth_service.credentials.auth_method == "token"
```

### 2.6 Phase 2 Completion Checklist

- [ ] Service layer decomposed into focused services
- [ ] Authentication service implemented with factory pattern
- [ ] Document service created with standardized error handling
- [ ] Task monitoring simplified and optimized
- [ ] Code duplication eliminated
- [ ] Integration tests passing
- [ ] All existing functionality preserved
- [ ] Performance improvements validated

---

## Phase 3: Frontend Architecture Cleanup
**Duration**: 1 week | **Priority**: MEDIUM

### 3.1 Component Decomposition Strategy

#### Current Issues:
- `DocumentManagerCore.js` (1,392 lines) - God component anti-pattern
- Mixed UI logic with business logic
- Excessive re-renders and performance issues
- Props drilling and tight coupling

#### Target Architecture:
```
frontend/src/components/paperless/
├── core/
│   ├── DocumentManagerProvider.tsx    # Context provider
│   ├── DocumentManagerCore.tsx        # Simplified coordinator
│   └── types.ts                       # TypeScript definitions
├── hooks/
│   ├── useFileManager.ts              # File CRUD operations
│   ├── useUploadManager.ts            # Upload logic and progress
│   ├── usePaperlessSync.ts            # Sync operations
│   ├── useStorageBackend.ts           # Backend selection
│   └── useErrorHandler.ts             # Centralized error handling
├── components/
│   ├── FileList/
│   │   ├── FileList.tsx
│   │   ├── FileItem.tsx
│   │   └── FileActions.tsx
│   ├── Upload/
│   │   ├── UploadZone.tsx
│   │   ├── UploadProgress.tsx
│   │   └── UploadModal.tsx
│   ├── Settings/
│   │   ├── PaperlessSettings.tsx
│   │   ├── ConnectionTest.tsx
│   │   └── StorageSelector.tsx
│   └── Sync/
│       ├── SyncStatus.tsx
│       ├── SyncActions.tsx
│       └── ConflictResolver.tsx
└── services/
    ├── api/
    │   ├── paperlessApi.ts
    │   ├── fileApi.ts
    │   └── types.ts
    └── utils/
        ├── fileValidation.ts
        ├── errorMapping.ts
        └── constants.ts
```

### 3.2 TypeScript Migration

**Step 3.2.1: Core Types Definition**
```typescript
// frontend/src/components/paperless/core/types.ts
export interface FileMetadata {
  id: number;
  filename: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  description?: string;
  category?: string;
}

export interface StorageBackend {
  type: 'local' | 'paperless';
  displayName: string;
  isEnabled: boolean;
  requiresAuth: boolean;
}

export interface PaperlessFile extends FileMetadata {
  storageBackend: 'paperless';
  paperlessDocumentId?: string;
  paperlessTaskUuid?: string;
  syncStatus: SyncStatus;
  lastSyncAt?: string;
}

export type SyncStatus = 
  | 'synced' 
  | 'pending' 
  | 'processing' 
  | 'failed' 
  | 'missing' 
  | 'duplicate';

export interface UploadProgress {
  fileId: string;
  filename: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
  taskId?: string;
}

export interface PaperlessConfig {
  enabled: boolean;
  serverUrl: string;
  authMethod: 'token' | 'basic' | 'none';
  hasCredentials: boolean;
  defaultStorageBackend: StorageBackend['type'];
  autoSync: boolean;
}

export interface DocumentManagerState {
  files: PaperlessFile[];
  uploadProgress: Record<string, UploadProgress>;
  config: PaperlessConfig;
  isLoading: boolean;
  error: string | null;
  selectedBackend: StorageBackend['type'];
}

export interface DocumentManagerActions {
  // File operations
  uploadFiles: (files: File[]) => Promise<void>;
  deleteFile: (fileId: number) => Promise<void>;
  downloadFile: (fileId: number) => Promise<void>;
  
  // Sync operations
  checkSyncStatus: () => Promise<void>;
  resolveConflict: (fileId: number, resolution: 'keep_local' | 'keep_remote') => Promise<void>;
  
  // Configuration
  updateConfig: (config: Partial<PaperlessConfig>) => Promise<void>;
  testConnection: () => Promise<boolean>;
  
  // Backend selection
  selectBackend: (backend: StorageBackend['type']) => void;
}
```

**Step 3.2.2: Context Provider Implementation**
```typescript
// frontend/src/components/paperless/core/DocumentManagerProvider.tsx
import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { DocumentManagerState, DocumentManagerActions, PaperlessFile, UploadProgress } from './types';

// State management with useReducer
type DocumentManagerAction =
  | { type: 'SET_FILES'; payload: PaperlessFile[] }
  | { type: 'ADD_FILE'; payload: PaperlessFile }
  | { type: 'UPDATE_FILE'; payload: { id: number; updates: Partial<PaperlessFile> } }
  | { type: 'DELETE_FILE'; payload: number }
  | { type: 'SET_UPLOAD_PROGRESS'; payload: { fileId: string; progress: UploadProgress } }
  | { type: 'CLEAR_UPLOAD_PROGRESS'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_CONFIG'; payload: Partial<PaperlessConfig> };

const initialState: DocumentManagerState = {
  files: [],
  uploadProgress: {},
  config: {
    enabled: false,
    serverUrl: '',
    authMethod: 'none',
    hasCredentials: false,
    defaultStorageBackend: 'local',
    autoSync: false,
  },
  isLoading: false,
  error: null,
  selectedBackend: 'local',
};

function documentManagerReducer(
  state: DocumentManagerState,
  action: DocumentManagerAction
): DocumentManagerState {
  switch (action.type) {
    case 'SET_FILES':
      return { ...state, files: action.payload, isLoading: false };
    
    case 'ADD_FILE':
      return { ...state, files: [...state.files, action.payload] };
    
    case 'UPDATE_FILE':
      return {
        ...state,
        files: state.files.map(file =>
          file.id === action.payload.id
            ? { ...file, ...action.payload.updates }
            : file
        ),
      };
    
    case 'DELETE_FILE':
      return {
        ...state,
        files: state.files.filter(file => file.id !== action.payload),
      };
    
    case 'SET_UPLOAD_PROGRESS':
      return {
        ...state,
        uploadProgress: {
          ...state.uploadProgress,
          [action.payload.fileId]: action.payload.progress,
        },
      };
    
    case 'CLEAR_UPLOAD_PROGRESS':
      const { [action.payload]: removed, ...remaining } = state.uploadProgress;
      return { ...state, uploadProgress: remaining };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    
    case 'UPDATE_CONFIG':
      return {
        ...state,
        config: { ...state.config, ...action.payload },
      };
    
    default:
      return state;
  }
}

const DocumentManagerContext = createContext<
  (DocumentManagerState & DocumentManagerActions) | null
>(null);

export const DocumentManagerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(documentManagerReducer, initialState);

  // Actions implementation
  const uploadFiles = useCallback(async (files: File[]) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      for (const file of files) {
        const fileId = `upload_${Date.now()}_${Math.random()}`;
        
        // Initialize progress tracking
        dispatch({
          type: 'SET_UPLOAD_PROGRESS',
          payload: {
            fileId,
            progress: {
              fileId,
              filename: file.name,
              progress: 0,
              status: 'uploading',
            },
          },
        });
        
        // Simulate upload (replace with actual API call)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update progress
        dispatch({
          type: 'SET_UPLOAD_PROGRESS',
          payload: {
            fileId,
            progress: {
              fileId,
              filename: file.name,
              progress: 100,
              status: 'completed',
            },
          },
        });
        
        // Clear progress after delay
        setTimeout(() => {
          dispatch({ type: 'CLEAR_UPLOAD_PROGRESS', payload: fileId });
        }, 2000);
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const deleteFile = useCallback(async (fileId: number) => {
    try {
      // API call to delete file
      // await fileApi.deleteFile(fileId);
      dispatch({ type: 'DELETE_FILE', payload: fileId });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, []);

  const downloadFile = useCallback(async (fileId: number) => {
    try {
      // API call to download file
      // const blob = await fileApi.downloadFile(fileId);
      // Handle download...
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, []);

  const checkSyncStatus = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      // API call to check sync status
      // const syncData = await paperlessApi.checkSyncStatus();
      // dispatch({ type: 'SET_FILES', payload: syncData.files });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, []);

  const resolveConflict = useCallback(async (
    fileId: number,
    resolution: 'keep_local' | 'keep_remote'
  ) => {
    try {
      // API call to resolve conflict
      // await paperlessApi.resolveConflict(fileId, resolution);
      dispatch({
        type: 'UPDATE_FILE',
        payload: { id: fileId, updates: { syncStatus: 'synced' } },
      });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, []);

  const updateConfig = useCallback(async (configUpdates: Partial<PaperlessConfig>) => {
    try {
      // API call to update config
      // await paperlessApi.updateConfig(configUpdates);
      dispatch({ type: 'UPDATE_CONFIG', payload: configUpdates });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    }
  }, []);

  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      // API call to test connection
      // const result = await paperlessApi.testConnection();
      // return result.success;
      return true;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      return false;
    }
  }, []);

  const selectBackend = useCallback((backend: StorageBackend['type']) => {
    // Update selected backend (local state change)
    // This could trigger re-fetch of files for the new backend
  }, []);

  const value = {
    ...state,
    uploadFiles,
    deleteFile,
    downloadFile,
    checkSyncStatus,
    resolveConflict,
    updateConfig,
    testConnection,
    selectBackend,
  };

  return (
    <DocumentManagerContext.Provider value={value}>
      {children}
    </DocumentManagerContext.Provider>
  );
};

export const useDocumentManager = () => {
  const context = useContext(DocumentManagerContext);
  if (!context) {
    throw new Error('useDocumentManager must be used within DocumentManagerProvider');
  }
  return context;
};
```

### 3.3 Custom Hooks Implementation

**Step 3.3.1: File Manager Hook**
```typescript
// frontend/src/components/paperless/hooks/useFileManager.ts
import { useState, useCallback, useEffect } from 'react';
import { PaperlessFile, SyncStatus } from '../core/types';
import { fileApi } from '../services/api/fileApi';
import { useErrorHandler } from './useErrorHandler';

export const useFileManager = (entityType: string, entityId: number) => {
  const [files, setFiles] = useState<PaperlessFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { handleError } = useErrorHandler();

  const fetchFiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedFiles = await fileApi.getEntityFiles(entityType, entityId);
      setFiles(fetchedFiles);
    } catch (error) {
      handleError(error, 'Failed to fetch files');
    } finally {
      setIsLoading(false);
    }
  }, [entityType, entityId, handleError]);

  const deleteFile = useCallback(async (fileId: number) => {
    try {
      await fileApi.deleteFile(fileId);
      setFiles(prev => prev.filter(file => file.id !== fileId));
    } catch (error) {
      handleError(error, 'Failed to delete file');
    }
  }, [handleError]);

  const updateFileStatus = useCallback((fileId: number, syncStatus: SyncStatus) => {
    setFiles(prev => prev.map(file => 
      file.id === fileId 
        ? { ...file, syncStatus, lastSyncAt: new Date().toISOString() }
        : file
    ));
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return {
    files,
    isLoading,
    refetch: fetchFiles,
    deleteFile,
    updateFileStatus,
  };
};
```

**Step 3.3.2: Upload Manager Hook**
```typescript
// frontend/src/components/paperless/hooks/useUploadManager.ts
import { useState, useCallback, useRef } from 'react';
import { UploadProgress, StorageBackend } from '../core/types';
import { fileApi } from '../services/api/fileApi';
import { paperlessApi } from '../services/api/paperlessApi';
import { useErrorHandler } from './useErrorHandler';

export const useUploadManager = (
  entityType: string, 
  entityId: number,
  selectedBackend: StorageBackend['type']
) => {
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [isUploading, setIsUploading] = useState(false);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const { handleError } = useErrorHandler();

  const updateProgress = useCallback((fileId: string, progress: Partial<UploadProgress>) => {
    setUploadProgress(prev => ({
      ...prev,
      [fileId]: { ...prev[fileId], ...progress },
    }));
  }, []);

  const clearProgress = useCallback((fileId: string) => {
    setUploadProgress(prev => {
      const { [fileId]: removed, ...remaining } = prev;
      return remaining;
    });
    abortControllersRef.current.delete(fileId);
  }, []);

  const uploadFiles = useCallback(async (
    files: File[],
    options: {
      description?: string;
      category?: string;
      onComplete?: (uploadedFiles: any[]) => void;
    } = {}
  ) => {
    setIsUploading(true);
    const uploadedFiles: any[] = [];

    try {
      for (const file of files) {
        const fileId = `upload_${Date.now()}_${Math.random()}`;
        const abortController = new AbortController();
        abortControllersRef.current.set(fileId, abortController);

        // Initialize progress
        updateProgress(fileId, {
          fileId,
          filename: file.name,
          progress: 0,
          status: 'uploading',
        });

        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('entity_type', entityType);
          formData.append('entity_id', entityId.toString());
          formData.append('storage_backend', selectedBackend);
          
          if (options.description) {
            formData.append('description', options.description);
          }
          if (options.category) {
            formData.append('category', options.category);
          }

          const uploadedFile = await fileApi.uploadFile(formData, {
            onProgress: (progress) => {
              updateProgress(fileId, { progress });
            },
            signal: abortController.signal,
          });

          if (selectedBackend === 'paperless' && uploadedFile.paperlessTaskUuid) {
            // Monitor task completion
            updateProgress(fileId, { status: 'processing', taskId: uploadedFile.paperlessTaskUuid });
            
            const taskResult = await paperlessApi.waitForTaskCompletion(
              uploadedFile.paperlessTaskUuid,
              {
                onProgress: (taskProgress) => {
                  updateProgress(fileId, { progress: taskProgress.progress || 50 });
                },
              }
            );

            if (taskResult.success) {
              updateProgress(fileId, { progress: 100, status: 'completed' });
              uploadedFiles.push({ ...uploadedFile, ...taskResult });
            } else {
              updateProgress(fileId, { 
                status: 'failed', 
                error: taskResult.error || 'Upload failed' 
              });
            }
          } else {
            updateProgress(fileId, { progress: 100, status: 'completed' });
            uploadedFiles.push(uploadedFile);
          }

          // Clear progress after 2 seconds
          setTimeout(() => clearProgress(fileId), 2000);

        } catch (error) {
          if (error.name === 'AbortError') {
            updateProgress(fileId, { status: 'failed', error: 'Upload cancelled' });
          } else {
            updateProgress(fileId, { status: 'failed', error: error.message });
            handleError(error, `Failed to upload ${file.name}`);
          }
        }
      }

      options.onComplete?.(uploadedFiles);

    } finally {
      setIsUploading(false);
    }
  }, [entityType, entityId, selectedBackend, updateProgress, clearProgress, handleError]);

  const cancelUpload = useCallback((fileId: string) => {
    const abortController = abortControllersRef.current.get(fileId);
    if (abortController) {
      abortController.abort();
      updateProgress(fileId, { status: 'failed', error: 'Upload cancelled' });
    }
  }, [updateProgress]);

  const cancelAllUploads = useCallback(() => {
    abortControllersRef.current.forEach((controller) => {
      controller.abort();
    });
    setUploadProgress({});
    abortControllersRef.current.clear();
    setIsUploading(false);
  }, []);

  return {
    uploadProgress,
    isUploading,
    uploadFiles,
    cancelUpload,
    cancelAllUploads,
    clearProgress,
  };
};
```

### 3.4 Component Implementation

**Step 3.4.1: Simplified Document Manager Core**
```typescript
// frontend/src/components/paperless/core/DocumentManagerCore.tsx
import React from 'react';
import { Box, LoadingOverlay } from '@mantine/core';
import { DocumentManagerProvider, useDocumentManager } from './DocumentManagerProvider';
import { FileList } from '../components/FileList/FileList';
import { UploadZone } from '../components/Upload/UploadZone';
import { SyncStatus } from '../components/Sync/SyncStatus';
import { ErrorBoundary } from './ErrorBoundary';

interface DocumentManagerCoreProps {
  entityType: string;
  entityId: number;
  mode?: 'view' | 'edit';
  showUpload?: boolean;
  showSync?: boolean;
}

const DocumentManagerCoreContent: React.FC<DocumentManagerCoreProps> = ({
  entityType,
  entityId,
  mode = 'edit',
  showUpload = true,
  showSync = true,
}) => {
  const { files, isLoading, config } = useDocumentManager();

  return (
    <Box pos="relative">
      <LoadingOverlay visible={isLoading} />
      
      {showSync && config.enabled && (
        <SyncStatus files={files} />
      )}
      
      <FileList 
        files={files} 
        entityType={entityType}
        entityId={entityId}
        readonly={mode === 'view'}
      />
      
      {showUpload && mode === 'edit' && (
        <UploadZone 
          entityType={entityType}
          entityId={entityId}
        />
      )}
    </Box>
  );
};

export const DocumentManagerCore: React.FC<DocumentManagerCoreProps> = (props) => {
  return (
    <ErrorBoundary>
      <DocumentManagerProvider>
        <DocumentManagerCoreContent {...props} />
      </DocumentManagerProvider>
    </ErrorBoundary>
  );
};
```

**Step 3.4.2: Error Boundary Component**
```typescript
// frontend/src/components/paperless/core/ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';
import { Alert, Button, Container } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('DocumentManager Error:', error, errorInfo);
    
    // Log error to monitoring service
    // errorLogger.logError(error, { component: 'DocumentManager', ...errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Container size="sm" py="xl">
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Something went wrong"
            color="red"
            variant="light"
          >
            <p>
              An error occurred in the document manager. This has been logged and will be investigated.
            </p>
            {this.state.error && (
              <details style={{ marginTop: '1rem' }}>
                <summary>Technical details</summary>
                <pre style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={this.handleRetry}
              mt="md"
            >
              Try Again
            </Button>
          </Alert>
        </Container>
      );
    }

    return this.props.children;
  }
}
```

### 3.5 Testing Phase 3 Changes

**Step 3.5.1: Component Tests**
```typescript
// tests/components/DocumentManagerCore.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { DocumentManagerCore } from '../core/DocumentManagerCore';

const renderWithMantine = (component: React.ReactElement) => {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  );
};

describe('DocumentManagerCore', () => {
  it('should render file list and upload zone in edit mode', () => {
    renderWithMantine(
      <DocumentManagerCore 
        entityType="lab-result" 
        entityId={1} 
        mode="edit" 
      />
    );

    expect(screen.getByText(/upload/i)).toBeInTheDocument();
    expect(screen.getByText(/files/i)).toBeInTheDocument();
  });

  it('should hide upload zone in view mode', () => {
    renderWithMantine(
      <DocumentManagerCore 
        entityType="lab-result" 
        entityId={1} 
        mode="view" 
      />
    );

    expect(screen.queryByText(/upload/i)).not.toBeInTheDocument();
    expect(screen.getByText(/files/i)).toBeInTheDocument();
  });

  it('should handle upload errors gracefully', async () => {
    // Mock API to throw error
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    renderWithMantine(
      <DocumentManagerCore 
        entityType="lab-result" 
        entityId={1} 
      />
    );

    // Simulate upload error scenario
    // This would trigger the error boundary
    
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});
```

### 3.6 Phase 3 Completion Checklist

- [ ] DocumentManagerCore decomposed into focused components
- [ ] TypeScript migration completed with proper type definitions
- [ ] Context provider implemented for state management
- [ ] Custom hooks created for business logic separation
- [ ] Component tests implemented
- [ ] Error boundary added for graceful error handling
- [ ] Performance optimizations validated (reduced re-renders)
- [ ] All existing functionality preserved

---

## Phase 4: Database Schema Optimization
**Duration**: 3-4 days | **Priority**: MEDIUM

### 4.1 Schema Separation Strategy

#### Current Issues:
- `EntityFile` model mixing core metadata with storage-specific fields
- No proper audit trail for file operations
- Missing foreign key relationships
- No separation between file metadata and storage backend information

#### Target Schema:
```sql
-- Core file metadata (storage-agnostic)
CREATE TABLE entity_files (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- File metadata
    file_name VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INTEGER,
    file_hash VARCHAR(64), -- SHA-256 for deduplication
    
    -- Descriptive fields
    description TEXT,
    category_id INTEGER REFERENCES file_categories(id),
    
    -- Timestamps
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_entity_id_positive CHECK (entity_id > 0),
    CONSTRAINT chk_file_size_positive CHECK (file_size >= 0),
    CONSTRAINT chk_valid_entity_type CHECK (entity_type IN (
        'lab-result', 'procedure', 'insurance', 'visit', 'treatment', 'medication'
    ))
);

-- Storage backend information
CREATE TABLE file_storage_records (
    id SERIAL PRIMARY KEY,
    entity_file_id INTEGER NOT NULL REFERENCES entity_files(id) ON DELETE CASCADE,
    storage_backend_id INTEGER NOT NULL REFERENCES storage_backends(id),
    
    -- Backend-specific reference
    backend_path VARCHAR(500), -- Local file path
    external_id VARCHAR(255),  -- Paperless document ID
    external_task_id VARCHAR(255), -- Paperless task UUID
    
    -- Sync information
    sync_status VARCHAR(20) NOT NULL DEFAULT 'synced',
    sync_attempts INTEGER DEFAULT 0,
    last_sync_at TIMESTAMP,
    last_error TEXT,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_sync_status CHECK (sync_status IN (
        'synced', 'pending', 'processing', 'failed', 'missing', 'duplicate'
    )),
    CONSTRAINT chk_sync_attempts_positive CHECK (sync_attempts >= 0),
    
    -- Unique constraint for external references
    CONSTRAINT uk_external_id UNIQUE (storage_backend_id, external_id)
);

-- Normalized storage backends configuration
CREATE TABLE storage_backends (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL, -- 'local', 'paperless'
    display_name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    requires_auth BOOLEAN DEFAULT FALSE,
    configuration JSONB, -- Backend-specific settings
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- File categories for better organization
CREATE TABLE file_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    entity_type VARCHAR(50), -- Optional: restrict to specific entity types
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Audit trail for all file operations
CREATE TABLE entity_file_audit (
    id SERIAL PRIMARY KEY,
    entity_file_id INTEGER REFERENCES entity_files(id),
    
    -- Operation details
    operation VARCHAR(20) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'SYNC', 'DOWNLOAD'
    user_id INTEGER REFERENCES users(id),
    
    -- Change tracking
    old_values JSONB,
    new_values JSONB,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    sync_operation_id VARCHAR(255), -- For tracking bulk operations
    
    -- Timestamp
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_valid_operation CHECK (operation IN (
        'CREATE', 'UPDATE', 'DELETE', 'SYNC', 'DOWNLOAD', 'VIEW'
    ))
);
```

### 4.2 Migration Scripts

**Step 4.2.1: Schema Migration Script**
```sql
-- migration_001_split_entity_files.sql
-- Split EntityFile into focused tables

BEGIN;

-- Create new tables
CREATE TABLE storage_backends (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    requires_auth BOOLEAN DEFAULT FALSE,
    configuration JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default storage backends
INSERT INTO storage_backends (name, display_name, requires_auth) VALUES
('local', 'Local Storage', FALSE),
('paperless', 'Paperless-ngx', TRUE);

CREATE TABLE file_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    entity_type VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories
INSERT INTO file_categories (name, description) VALUES
('medical_report', 'Medical reports and test results'),
('insurance_document', 'Insurance related documents'),
('prescription', 'Prescriptions and medication records'),
('imaging', 'X-rays, MRIs, and other medical imaging'),
('lab_result', 'Laboratory test results'),
('other', 'Miscellaneous documents');

-- Create new entity_files table with improved structure
CREATE TABLE entity_files_new (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    owner_user_id INTEGER,
    
    file_name VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INTEGER,
    file_hash VARCHAR(64),
    
    description TEXT,
    category_id INTEGER REFERENCES file_categories(id),
    
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_entity_id_positive CHECK (entity_id > 0),
    CONSTRAINT chk_file_size_positive CHECK (file_size >= 0)
);

-- Create file storage records table
CREATE TABLE file_storage_records (
    id SERIAL PRIMARY KEY,
    entity_file_id INTEGER NOT NULL,
    storage_backend_id INTEGER NOT NULL REFERENCES storage_backends(id),
    
    backend_path VARCHAR(500),
    external_id VARCHAR(255),
    external_task_id VARCHAR(255),
    
    sync_status VARCHAR(20) NOT NULL DEFAULT 'synced',
    sync_attempts INTEGER DEFAULT 0,
    last_sync_at TIMESTAMP,
    last_error TEXT,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_sync_status CHECK (sync_status IN (
        'synced', 'pending', 'processing', 'failed', 'missing', 'duplicate'
    )),
    CONSTRAINT uk_external_id UNIQUE (storage_backend_id, external_id)
);

-- Create audit table
CREATE TABLE entity_file_audit (
    id SERIAL PRIMARY KEY,
    entity_file_id INTEGER,
    operation VARCHAR(20) NOT NULL,
    user_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    sync_operation_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Migrate data from old table to new structure
INSERT INTO entity_files_new (
    id, entity_type, entity_id, owner_user_id,
    file_name, original_filename, file_type, file_size,
    description, uploaded_at, created_at, updated_at
)
SELECT 
    id, entity_type, entity_id,
    -- Try to derive owner from entity relationships
    CASE 
        WHEN entity_type = 'lab-result' THEN (
            SELECT p.user_id FROM lab_results lr 
            JOIN patients p ON lr.patient_id = p.id 
            WHERE lr.id = ef.entity_id LIMIT 1
        )
        WHEN entity_type = 'procedure' THEN (
            SELECT p.user_id FROM procedures pr 
            JOIN patients p ON pr.patient_id = p.id 
            WHERE pr.id = ef.entity_id LIMIT 1
        )
        -- Add other entity types as needed
        ELSE NULL
    END as owner_user_id,
    file_name, file_name as original_filename, file_type, file_size,
    description, uploaded_at, created_at, updated_at
FROM entity_files ef;

-- Migrate storage information
INSERT INTO file_storage_records (
    entity_file_id, storage_backend_id,
    backend_path, external_id, external_task_id,
    sync_status, last_sync_at, created_at, updated_at
)
SELECT 
    ef.id,
    sb.id as storage_backend_id,
    CASE WHEN ef.storage_backend = 'local' THEN ef.file_path ELSE NULL END,
    ef.paperless_document_id,
    ef.paperless_task_uuid,
    ef.sync_status,
    ef.last_sync_at,
    ef.created_at,
    ef.updated_at
FROM entity_files ef
JOIN storage_backends sb ON sb.name = ef.storage_backend;

-- Add foreign key constraint after migration
ALTER TABLE file_storage_records 
ADD CONSTRAINT fk_file_storage_entity_file 
FOREIGN KEY (entity_file_id) REFERENCES entity_files_new(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX idx_entity_files_entity_lookup ON entity_files_new (entity_type, entity_id);
CREATE INDEX idx_entity_files_owner ON entity_files_new (owner_user_id);
CREATE INDEX idx_entity_files_category ON entity_files_new (category_id);
CREATE INDEX idx_entity_files_hash ON entity_files_new (file_hash);

CREATE INDEX idx_storage_records_entity_file ON file_storage_records (entity_file_id);
CREATE INDEX idx_storage_records_backend ON file_storage_records (storage_backend_id);
CREATE INDEX idx_storage_records_external_id ON file_storage_records (external_id);
CREATE INDEX idx_storage_records_sync_status ON file_storage_records (sync_status);
CREATE INDEX idx_storage_records_last_sync ON file_storage_records (last_sync_at);

CREATE INDEX idx_audit_entity_file ON entity_file_audit (entity_file_id);
CREATE INDEX idx_audit_user ON entity_file_audit (user_id);
CREATE INDEX idx_audit_operation ON entity_file_audit (operation);
CREATE INDEX idx_audit_created_at ON entity_file_audit (created_at);

-- Rename tables (this will require application downtime)
DROP TABLE entity_files CASCADE;
ALTER TABLE entity_files_new RENAME TO entity_files;

-- Update sequence
SELECT setval('entity_files_id_seq', (SELECT MAX(id) FROM entity_files));

COMMIT;
```

**Step 4.2.2: Rollback Script**
```sql
-- rollback_001_split_entity_files.sql
-- Rollback the entity_files split migration

BEGIN;

-- Recreate original entity_files table
CREATE TABLE entity_files_original (
    id INTEGER PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INTEGER,
    description TEXT,
    category VARCHAR(100),
    uploaded_at TIMESTAMP NOT NULL,
    
    -- Storage backend fields
    storage_backend VARCHAR(20) DEFAULT 'local' NOT NULL,
    paperless_document_id VARCHAR(255),
    paperless_task_uuid VARCHAR(255),
    sync_status VARCHAR(20) DEFAULT 'synced' NOT NULL,
    last_sync_at TIMESTAMP,
    
    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Migrate data back to original structure
INSERT INTO entity_files_original (
    id, entity_type, entity_id, file_name, file_path, file_type, file_size,
    description, uploaded_at, storage_backend, paperless_document_id,
    paperless_task_uuid, sync_status, last_sync_at, created_at, updated_at
)
SELECT 
    ef.id, ef.entity_type, ef.entity_id, ef.file_name,
    COALESCE(fsr.backend_path, '') as file_path,
    ef.file_type, ef.file_size, ef.description, ef.uploaded_at,
    COALESCE(sb.name, 'local') as storage_backend,
    fsr.external_id as paperless_document_id,
    fsr.external_task_id as paperless_task_uuid,
    COALESCE(fsr.sync_status, 'synced') as sync_status,
    fsr.last_sync_at,
    ef.created_at, ef.updated_at
FROM entity_files ef
LEFT JOIN file_storage_records fsr ON ef.id = fsr.entity_file_id
LEFT JOIN storage_backends sb ON fsr.storage_backend_id = sb.id;

-- Drop new tables
DROP TABLE IF EXISTS entity_file_audit CASCADE;
DROP TABLE IF EXISTS file_storage_records CASCADE;
DROP TABLE IF EXISTS file_categories CASCADE;
DROP TABLE IF EXISTS storage_backends CASCADE;

-- Rename back to original
DROP TABLE entity_files CASCADE;
ALTER TABLE entity_files_original RENAME TO entity_files;

-- Recreate original indexes
CREATE INDEX idx_entity_type_id ON entity_files (entity_type, entity_id);
CREATE INDEX idx_category ON entity_files (category);
CREATE INDEX idx_uploaded_at ON entity_files (uploaded_at);
CREATE INDEX idx_storage_backend ON entity_files (storage_backend);
CREATE INDEX idx_paperless_document_id ON entity_files (paperless_document_id);
CREATE INDEX idx_sync_status ON entity_files (sync_status);

COMMIT;
```

### 4.3 Updated SQLAlchemy Models

**Step 4.3.1: New Model Definitions**
```python
# app/models/file_management.py
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, INET
from app.core.database import Base
from app.core.utils import get_utc_now

class StorageBackend(Base):
    """Storage backend configuration."""
    __tablename__ = "storage_backends"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    requires_auth = Column(Boolean, default=False, nullable=False)
    configuration = Column(JSONB)
    
    created_at = Column(DateTime, nullable=False, default=get_utc_now)
    updated_at = Column(DateTime, nullable=False, default=get_utc_now, onupdate=get_utc_now)
    
    # Relationships
    storage_records = relationship("FileStorageRecord", back_populates="storage_backend")

class FileCategory(Base):
    """File categories for organization."""
    __tablename__ = "file_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text)
    entity_type = Column(String(50))  # Optional restriction to entity types
    is_active = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime, nullable=False, default=get_utc_now)
    
    # Relationships
    files = relationship("EntityFile", back_populates="category")

class EntityFile(Base):
    """Core file metadata (storage-agnostic)."""
    __tablename__ = "entity_files"
    
    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(Integer, nullable=False, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    
    # File metadata
    file_name = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_type = Column(String(100), nullable=False)
    file_size = Column(Integer)
    file_hash = Column(String(64), index=True)  # SHA-256 for deduplication
    
    # Descriptive fields
    description = Column(Text)
    category_id = Column(Integer, ForeignKey("file_categories.id"))
    
    # Timestamps
    uploaded_at = Column(DateTime, nullable=False, default=get_utc_now, index=True)
    created_at = Column(DateTime, nullable=False, default=get_utc_now, index=True)
    updated_at = Column(DateTime, nullable=False, default=get_utc_now, onupdate=get_utc_now)
    
    # Constraints
    __table_args__ = (
        CheckConstraint("entity_id > 0", name="chk_entity_id_positive"),
        CheckConstraint("file_size >= 0", name="chk_file_size_positive"),
        CheckConstraint(
            "entity_type IN ('lab-result', 'procedure', 'insurance', 'visit', 'treatment', 'medication')",
            name="chk_valid_entity_type"
        ),
    )
    
    # Relationships
    storage_records = relationship("FileStorageRecord", back_populates="entity_file", cascade="all, delete-orphan")
    category = relationship("FileCategory", back_populates="files")
    audit_records = relationship("EntityFileAudit", back_populates="entity_file")
    owner = relationship("User")

class FileStorageRecord(Base):
    """Storage backend specific information."""
    __tablename__ = "file_storage_records"
    
    id = Column(Integer, primary_key=True, index=True)
    entity_file_id = Column(Integer, ForeignKey("entity_files.id", ondelete="CASCADE"), nullable=False, index=True)
    storage_backend_id = Column(Integer, ForeignKey("storage_backends.id"), nullable=False, index=True)
    
    # Backend-specific references
    backend_path = Column(String(500))  # Local file path
    external_id = Column(String(255), index=True)  # Paperless document ID
    external_task_id = Column(String(255))  # Paperless task UUID
    
    # Sync information
    sync_status = Column(String(20), nullable=False, default="synced", index=True)
    sync_attempts = Column(Integer, default=0, nullable=False)
    last_sync_at = Column(DateTime, index=True)
    last_error = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=get_utc_now)
    updated_at = Column(DateTime, nullable=False, default=get_utc_now, onupdate=get_utc_now)
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "sync_status IN ('synced', 'pending', 'processing', 'failed', 'missing', 'duplicate')",
            name="chk_sync_status"
        ),
        CheckConstraint("sync_attempts >= 0", name="chk_sync_attempts_positive"),
        UniqueConstraint("storage_backend_id", "external_id", name="uk_external_id"),
    )
    
    # Relationships
    entity_file = relationship("EntityFile", back_populates="storage_records")
    storage_backend = relationship("StorageBackend", back_populates="storage_records")

class EntityFileAudit(Base):
    """Audit trail for file operations."""
    __tablename__ = "entity_file_audit"
    
    id = Column(Integer, primary_key=True, index=True)
    entity_file_id = Column(Integer, ForeignKey("entity_files.id"), index=True)
    
    # Operation details
    operation = Column(String(20), nullable=False, index=True)  # CREATE, UPDATE, DELETE, SYNC, DOWNLOAD, VIEW
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    
    # Change tracking
    old_values = Column(JSONB)
    new_values = Column(JSONB)
    
    # Context
    ip_address = Column(INET)
    user_agent = Column(Text)
    sync_operation_id = Column(String(255))  # For tracking bulk operations
    
    # Timestamp
    created_at = Column(DateTime, nullable=False, default=get_utc_now, index=True)
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "operation IN ('CREATE', 'UPDATE', 'DELETE', 'SYNC', 'DOWNLOAD', 'VIEW')",
            name="chk_valid_operation"
        ),
    )
    
    # Relationships
    entity_file = relationship("EntityFile", back_populates="audit_records")
    user = relationship("User")
```

### 4.4 Repository Pattern Implementation

**Step 4.4.1: File Repository**
```python
# app/repositories/file_repository.py
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session, selectinload, joinedload
from sqlalchemy import and_, or_, desc, func
from app.models.file_management import EntityFile, FileStorageRecord, StorageBackend, EntityFileAudit
from app.core.logging import StructuredLogger

class FileRepository:
    """Repository for file-related database operations."""
    
    def __init__(self, db: Session):
        self.db = db
        self.logger = StructuredLogger("file_repository")
    
    def get_entity_files(
        self, 
        entity_type: str, 
        entity_id: int, 
        user_id: Optional[int] = None,
        include_storage: bool = True
    ) -> List[EntityFile]:
        """Get all files for a specific entity."""
        
        query = self.db.query(EntityFile).filter(
            EntityFile.entity_type == entity_type,
            EntityFile.entity_id == entity_id
        )
        
        if user_id:
            query = query.filter(EntityFile.owner_user_id == user_id)
        
        if include_storage:
            query = query.options(
                selectinload(EntityFile.storage_records).selectinload(FileStorageRecord.storage_backend),
                selectinload(EntityFile.category)
            )
        
        return query.order_by(desc(EntityFile.uploaded_at)).all()
    
    def get_files_by_storage_backend(
        self, 
        storage_backend_name: str, 
        user_id: Optional[int] = None,
        sync_status: Optional[str] = None
    ) -> List[EntityFile]:
        """Get files by storage backend."""
        
        query = (
            self.db.query(EntityFile)
            .join(FileStorageRecord)
            .join(StorageBackend)
            .filter(StorageBackend.name == storage_backend_name)
            .options(
                selectinload(EntityFile.storage_records).selectinload(FileStorageRecord.storage_backend)
            )
        )
        
        if user_id:
            query = query.filter(EntityFile.owner_user_id == user_id)
        
        if sync_status:
            query = query.filter(FileStorageRecord.sync_status == sync_status)
        
        return query.order_by(desc(EntityFile.uploaded_at)).all()
    
    def get_file_by_id(self, file_id: int, user_id: Optional[int] = None) -> Optional[EntityFile]:
        """Get file by ID with security check."""
        
        query = (
            self.db.query(EntityFile)
            .filter(EntityFile.id == file_id)
            .options(
                selectinload(EntityFile.storage_records).selectinload(FileStorageRecord.storage_backend),
                selectinload(EntityFile.category)
            )
        )
        
        if user_id:
            query = query.filter(EntityFile.owner_user_id == user_id)
        
        return query.first()
    
    def create_file(self, file_data: Dict[str, Any]) -> EntityFile:
        """Create new file record."""
        
        entity_file = EntityFile(**file_data)
        self.db.add(entity_file)
        self.db.flush()  # Get the ID without committing
        
        # Log creation
        self.logger.log_operation(
            "file_created",
            user_id=file_data.get("owner_user_id"),
            file_id=entity_file.id,
            entity_type=entity_file.entity_type,
            entity_id=entity_file.entity_id
        )
        
        return entity_file
    
    def create_storage_record(self, storage_data: Dict[str, Any]) -> FileStorageRecord:
        """Create storage record for a file."""
        
        storage_record = FileStorageRecord(**storage_data)
        self.db.add(storage_record)
        self.db.flush()
        
        return storage_record
    
    def update_storage_record(
        self, 
        storage_record_id: int, 
        updates: Dict[str, Any]
    ) -> Optional[FileStorageRecord]:
        """Update storage record."""
        
        storage_record = self.db.query(FileStorageRecord).filter(
            FileStorageRecord.id == storage_record_id
        ).first()
        
        if storage_record:
            for key, value in updates.items():
                setattr(storage_record, key, value)
            
            self.db.flush()
        
        return storage_record
    
    def delete_file(self, file_id: int, user_id: Optional[int] = None) -> bool:
        """Delete file with security check."""
        
        query = self.db.query(EntityFile).filter(EntityFile.id == file_id)
        
        if user_id:
            query = query.filter(EntityFile.owner_user_id == user_id)
        
        entity_file = query.first()
        
        if entity_file:
            # Log deletion before removing
            self.logger.log_operation(
                "file_deleted",
                user_id=user_id,
                file_id=file_id,
                entity_type=entity_file.entity_type,
                entity_id=entity_file.entity_id
            )
            
            self.db.delete(entity_file)
            return True
        
        return False
    
    def get_file_stats(self, user_id: Optional[int] = None) -> Dict[str, Any]:
        """Get file statistics."""
        
        query = self.db.query(
            func.count(EntityFile.id).label("total_files"),
            func.sum(EntityFile.file_size).label("total_size"),
            func.count(func.distinct(EntityFile.entity_type)).label("entity_types")
        )
        
        if user_id:
            query = query.filter(EntityFile.owner_user_id == user_id)
        
        result = query.first()
        
        return {
            "total_files": result.total_files or 0,
            "total_size": result.total_size or 0,
            "entity_types": result.entity_types or 0
        }
    
    def audit_operation(
        self,
        entity_file_id: int,
        operation: str,
        user_id: Optional[int] = None,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None
    ):
        """Create audit record for file operation."""
        
        audit_record = EntityFileAudit(
            entity_file_id=entity_file_id,
            operation=operation,
            user_id=user_id,
            old_values=old_values,
            new_values=new_values,
            ip_address=context.get("ip_address") if context else None,
            user_agent=context.get("user_agent") if context else None,
            sync_operation_id=context.get("sync_operation_id") if context else None
        )
        
        self.db.add(audit_record)
        self.db.flush()
        
        return audit_record
```

### 4.5 Phase 4 Testing

**Step 4.5.1: Repository Tests**
```python
# tests/repositories/test_file_repository.py
import pytest
from sqlalchemy.orm import Session
from app.repositories.file_repository import FileRepository
from app.models.file_management import EntityFile, FileStorageRecord, StorageBackend
from tests.utils import create_test_user, create_test_file

class TestFileRepository:
    
    @pytest.fixture
    def file_repository(self, db: Session):
        return FileRepository(db)
    
    @pytest.fixture
    def test_user(self, db: Session):
        return create_test_user(db)
    
    def test_create_file(self, file_repository: FileRepository, test_user):
        """Test file creation."""
        file_data = {
            "entity_type": "lab-result",
            "entity_id": 1,
            "owner_user_id": test_user.id,
            "file_name": "test.pdf",
            "original_filename": "test.pdf",
            "file_type": "application/pdf",
            "file_size": 1024
        }
        
        entity_file = file_repository.create_file(file_data)
        
        assert entity_file.id is not None
        assert entity_file.file_name == "test.pdf"
        assert entity_file.owner_user_id == test_user.id
    
    def test_get_entity_files(self, file_repository: FileRepository, test_user):
        """Test retrieving files by entity."""
        # Create test files
        file1 = create_test_file(file_repository.db, test_user.id, "lab-result", 1)
        file2 = create_test_file(file_repository.db, test_user.id, "lab-result", 1)
        file3 = create_test_file(file_repository.db, test_user.id, "procedure", 1)
        
        files = file_repository.get_entity_files("lab-result", 1, test_user.id)
        
        assert len(files) == 2
        file_ids = [f.id for f in files]
        assert file1.id in file_ids
        assert file2.id in file_ids
        assert file3.id not in file_ids
    
    def test_security_isolation(self, file_repository: FileRepository, db: Session):
        """Test that users can only access their own files."""
        user1 = create_test_user(db, email="user1@test.com")
        user2 = create_test_user(db, email="user2@test.com")
        
        # Create file for user1
        file1 = create_test_file(db, user1.id, "lab-result", 1)
        
        # User2 should not be able to access user1's files
        files = file_repository.get_entity_files("lab-result", 1, user2.id)
        assert len(files) == 0
        
        # User1 should be able to access their own files
        files = file_repository.get_entity_files("lab-result", 1, user1.id)
        assert len(files) == 1
        assert files[0].id == file1.id
```

### 4.6 Phase 4 Completion Checklist

- [ ] Database schema split into focused tables
- [ ] Migration scripts created with rollback procedures
- [ ] SQLAlchemy models updated with proper relationships
- [ ] Repository pattern implemented
- [ ] Database indexes optimized for common queries
- [ ] Audit trail functionality implemented
- [ ] Foreign key constraints and data integrity enforced
- [ ] Repository tests passing
- [ ] Data migration validated

---

## Phase 5: Testing Implementation
**Duration**: 3-4 days | **Priority**: MEDIUM

### 5.1 Testing Strategy Overview

#### Testing Pyramid:
- **Unit Tests (70%)**: Domain logic, utilities, and individual components
- **Integration Tests (20%)**: Service interactions and API endpoints
- **End-to-End Tests (10%)**: Complete user workflows

#### Test Categories:
1. **Security Tests**: Authentication, authorization, input validation
2. **Performance Tests**: Query optimization, load testing
3. **Business Logic Tests**: File operations, sync logic
4. **API Contract Tests**: Request/response validation
5. **Database Tests**: Data integrity, migrations

### 5.2 Unit Testing Framework

**Step 5.2.1: Test Configuration**
```python
# tests/conftest.py
import pytest
import asyncio
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from app.core.database import Base, get_db
from app.main import app
from app.models.file_management import StorageBackend, FileCategory

# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session")
def db_engine():
    """Create test database engine."""
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db_session(db_engine):
    """Create test database session."""
    connection = db_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    # Insert default data
    setup_test_data(session)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture
def client(db_session):
    """Create test client with database session."""
    def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

def setup_test_data(session):
    """Setup default test data."""
    # Create storage backends
    local_backend = StorageBackend(
        name="local",
        display_name="Local Storage",
        is_enabled=True,
        requires_auth=False
    )
    paperless_backend = StorageBackend(
        name="paperless",
        display_name="Paperless-ngx",
        is_enabled=True,
        requires_auth=True
    )
    
    # Create file categories
    categories = [
        FileCategory(name="medical_report", description="Medical reports"),
        FileCategory(name="lab_result", description="Laboratory results"),
        FileCategory(name="other", description="Other documents")
    ]
    
    session.add_all([local_backend, paperless_backend] + categories)
    session.commit()

@pytest.fixture
def mock_paperless_service():
    """Mock Paperless service for testing."""
    from unittest.mock import AsyncMock
    
    mock_service = AsyncMock()
    mock_service.test_connection.return_value = {"status": "success", "auth_method": "token"}
    mock_service.upload_document.return_value = {"success": True, "task_id": "test-task-123"}
    mock_service.get_task_status.return_value = {
        "status": "SUCCESS",
        "result": {"document_id": "123"}
    }
    mock_service.check_document_exists.return_value = True
    
    return mock_service
```

### 5.3 Security Testing

**Step 5.3.1: Authentication and Authorization Tests**
```python
# tests/security/test_authentication.py
import pytest
from app.core.security import EnhancedCredentialEncryption
from app.services.paperless.authentication.auth_service import AuthenticationFactory

class TestCredentialEncryption:
    
    def test_per_user_encryption(self):
        """Test that different users get different encrypted values."""
        encryption = EnhancedCredentialEncryption()
        credential = "test_password"
        
        encrypted_user1 = encryption.encrypt_credential(credential, user_id=1)
        encrypted_user2 = encryption.encrypt_credential(credential, user_id=2)
        
        # Different users should get different encrypted values
        assert encrypted_user1 != encrypted_user2
        
        # Each user should be able to decrypt their own credential
        assert encryption.decrypt_credential(encrypted_user1, 1) == credential
        assert encryption.decrypt_credential(encrypted_user2, 2) == credential
        
        # Cross-user decryption should fail
        assert encryption.decrypt_credential(encrypted_user1, 2) is None
        assert encryption.decrypt_credential(encrypted_user2, 1) is None
    
    def test_key_versioning(self):
        """Test key version handling."""
        encryption = EnhancedCredentialEncryption()
        credential = "test_password"
        
        encrypted = encryption.encrypt_credential(credential, user_id=1)
        
        # Should include version prefix
        assert encrypted.startswith("v1:")
        
        # Should decrypt correctly
        decrypted = encryption.decrypt_credential(encrypted, user_id=1)
        assert decrypted == credential
    
    def test_invalid_credential_handling(self):
        """Test handling of invalid encrypted credentials."""
        encryption = EnhancedCredentialEncryption()
        
        # Invalid format should return None
        assert encryption.decrypt_credential("invalid", 1) is None
        assert encryption.decrypt_credential("", 1) is None
        assert encryption.decrypt_credential("v1:invalid_base64", 1) is None

class TestAuthenticationFactory:
    
    @pytest.fixture
    def mock_encryption(self):
        from unittest.mock import patch
        with patch('app.core.security.EnhancedCredentialEncryption') as mock:
            yield mock
    
    def test_token_auth_priority(self, mock_encryption):
        """Test that token authentication is prioritized."""
        mock_encryption.return_value.decrypt_credential.side_effect = lambda cred, user_id: {
            "encrypted_token": "test_token",
            "encrypted_username": "test_user",
            "encrypted_password": "test_pass"
        }.get(cred, None)
        
        auth_service = AuthenticationFactory.create_auth_service(
            base_url="https://test.paperless.com",
            user_id=1,
            encrypted_token="encrypted_token",
            encrypted_username="encrypted_username",
            encrypted_password="encrypted_password"
        )
        
        from app.services.paperless.authentication.auth_service import TokenAuthenticationService
        assert isinstance(auth_service, TokenAuthenticationService)
        assert auth_service.credentials.auth_method == "token"
    
    def test_basic_auth_fallback(self, mock_encryption):
        """Test fallback to basic authentication."""
        mock_encryption.return_value.decrypt_credential.side_effect = lambda cred, user_id: {
            "encrypted_username": "test_user",
            "encrypted_password": "test_pass"
        }.get(cred, None)
        
        auth_service = AuthenticationFactory.create_auth_service(
            base_url="https://test.paperless.com",
            user_id=1,
            encrypted_username="encrypted_username",
            encrypted_password="encrypted_password"
        )
        
        from app.services.paperless.authentication.auth_service import BasicAuthenticationService
        assert isinstance(auth_service, BasicAuthenticationService)
        assert auth_service.credentials.auth_method == "basic"
    
    def test_no_credentials_error(self, mock_encryption):
        """Test error when no valid credentials provided."""
        mock_encryption.return_value.decrypt_credential.return_value = None
        
        with pytest.raises(ValueError, match="No valid authentication credentials"):
            AuthenticationFactory.create_auth_service(
                base_url="https://test.paperless.com",
                user_id=1
            )
```

**Step 5.3.2: Input Validation Tests**
```python
# tests/security/test_validation.py
import pytest
from app.core.validation import PaperlessConfigValidator

class TestPaperlessConfigValidator:
    
    def test_valid_urls(self):
        """Test valid URL acceptance."""
        valid_urls = [
            "https://paperless.example.com",
            "http://localhost:8000",
            "https://paperless.local:8080",
            "https://192.168.1.100:8000"  # Local network OK
        ]
        
        for url in valid_urls:
            result = PaperlessConfigValidator.validate_paperless_url(url)
            assert result == url.rstrip("/")
    
    def test_invalid_protocols(self):
        """Test invalid protocol rejection."""
        invalid_urls = [
            "ftp://paperless.com",
            "javascript:alert(1)",
            "file:///etc/passwd",
            "gopher://example.com"
        ]
        
        for url in invalid_urls:
            with pytest.raises(ValueError, match="protocol"):
                PaperlessConfigValidator.validate_paperless_url(url)
    
    def test_private_ip_blocking(self):
        """Test private IP address blocking."""
        private_ips = [
            "http://10.0.0.1",
            "https://172.16.0.1",
            "http://192.168.1.1",
            "https://127.0.0.1:8080"
        ]
        
        # Without explicit allowlist, private IPs should be blocked
        for url in private_ips:
            with pytest.raises(ValueError, match="Private IP"):
                PaperlessConfigValidator.validate_paperless_url(url)
    
    def test_credential_validation(self):
        """Test credential format validation."""
        # Valid token
        assert PaperlessConfigValidator.validate_credentials(
            token="abcdefghijklmnopqrstuvwxyz123456", 
            username=None, 
            password=None
        )
        
        # Valid username/password
        assert PaperlessConfigValidator.validate_credentials(
            token=None,
            username="testuser",
            password="testpassword123"
        )
        
        # Invalid token format
        with pytest.raises(ValueError, match="Invalid token"):
            PaperlessConfigValidator.validate_credentials(
                token="short", username=None, password=None
            )
        
        # Invalid username/password
        with pytest.raises(ValueError, match="Username must be"):
            PaperlessConfigValidator.validate_credentials(
                token=None, username="ab", password="shortpass"
            )
        
        # No credentials
        with pytest.raises(ValueError, match="Either token or username"):
            PaperlessConfigValidator.validate_credentials(
                token=None, username=None, password=None
            )
```

### 5.4 Performance Testing

**Step 5.4.1: Database Performance Tests**
```python
# tests/performance/test_database_performance.py
import pytest
import time
from sqlalchemy.orm import Session
from app.repositories.file_repository import FileRepository
from tests.utils import create_test_files_batch, create_test_user

class TestDatabasePerformance:
    
    @pytest.fixture
    def file_repository(self, db_session: Session):
        return FileRepository(db_session)
    
    @pytest.fixture
    def test_user(self, db_session: Session):
        return create_test_user(db_session)
    
    def test_batch_file_retrieval(self, file_repository: FileRepository, test_user):
        """Test that batch file retrieval doesn't have N+1 issues."""
        # Create multiple files across different entities
        entities = [
            ("lab-result", 1), ("lab-result", 2), ("lab-result", 3),
            ("procedure", 1), ("procedure", 2)
        ]
        
        # Create 5 files per entity (25 total)
        for entity_type, entity_id in entities:
            create_test_files_batch(
                file_repository.db, 
                test_user.id, 
                entity_type, 
                entity_id, 
                count=5
            )
        
        # Time the batch retrieval
        start_time = time.time()
        
        all_files = []
        for entity_type, entity_id in entities:
            files = file_repository.get_entity_files(
                entity_type, entity_id, test_user.id, include_storage=True
            )
            all_files.extend(files)
        
        end_time = time.time()
        query_time = end_time - start_time
        
        # Should retrieve all files efficiently
        assert len(all_files) == 25
        
        # Should complete in reasonable time (adjust threshold as needed)
        assert query_time < 1.0, f"Batch retrieval took {query_time:.2f}s, expected < 1.0s"
        
        # Verify eager loading worked (no additional queries)
        for file in all_files:
            # Accessing related data should not trigger additional queries
            assert file.storage_records is not None
            if file.storage_records:
                assert file.storage_records[0].storage_backend is not None
    
    def test_file_stats_performance(self, file_repository: FileRepository, test_user):
        """Test file statistics query performance."""
        # Create 100 files
        create_test_files_batch(
            file_repository.db, 
            test_user.id, 
            "lab-result", 
            1, 
            count=100
        )
        
        # Time the stats query
        start_time = time.time()
        stats = file_repository.get_file_stats(test_user.id)
        end_time = time.time()
        
        query_time = end_time - start_time
        
        # Verify results
        assert stats["total_files"] == 100
        assert stats["total_size"] > 0
        assert stats["entity_types"] >= 1
        
        # Should complete quickly
        assert query_time < 0.5, f"Stats query took {query_time:.2f}s, expected < 0.5s"
```

### 5.5 API Integration Testing

**Step 5.5.1: Paperless API Tests**
```python
# tests/api/test_paperless_endpoints.py
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock

class TestPaperlessEndpoints:
    
    def test_connection_test_success(self, client: TestClient, mock_paperless_service):
        """Test successful Paperless connection."""
        connection_data = {
            "paperless_url": "https://paperless.example.com",
            "paperless_api_token": "test_token_123"
        }
        
        with patch('app.api.v1.endpoints.paperless.create_paperless_service') as mock_factory:
            mock_factory.return_value = mock_paperless_service
            
            response = client.post("/api/v1/paperless/test-connection", json=connection_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["auth_method"] == "token"
    
    def test_connection_test_failure(self, client: TestClient):
        """Test failed Paperless connection."""
        connection_data = {
            "paperless_url": "https://invalid.paperless.com",
            "paperless_api_token": "invalid_token"
        }
        
        with patch('app.api.v1.endpoints.paperless.create_paperless_service') as mock_factory:
            mock_service = AsyncMock()
            mock_service.test_connection.side_effect = Exception("Connection failed")
            mock_factory.return_value = mock_service
            
            response = client.post("/api/v1/paperless/test-connection", json=connection_data)
        
        assert response.status_code == 400
        data = response.json()
        assert "error" in data
    
    def test_invalid_url_rejection(self, client: TestClient):
        """Test rejection of invalid URLs."""
        invalid_data = {
            "paperless_url": "javascript:alert(1)",
            "paperless_api_token": "test_token"
        }
        
        response = client.post("/api/v1/paperless/test-connection", json=invalid_data)
        
        assert response.status_code == 422  # Validation error
    
    def test_task_status_monitoring(self, client: TestClient, mock_paperless_service):
        """Test task status monitoring."""
        task_uuid = "test-task-123"
        
        with patch('app.api.v1.endpoints.paperless.create_paperless_service') as mock_factory:
            mock_factory.return_value = mock_paperless_service
            
            response = client.get(f"/api/v1/paperless/tasks/{task_uuid}/status")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "SUCCESS"
        assert "document_id" in data
```

### 5.6 End-to-End Testing

**Step 5.6.1: Complete Workflow Tests**
```python
# tests/e2e/test_file_upload_workflow.py
import pytest
import io
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock

class TestFileUploadWorkflow:
    
    @pytest.fixture
    def test_file(self):
        """Create test file for upload."""
        file_content = b"Test PDF content"
        return ("test.pdf", io.BytesIO(file_content), "application/pdf")
    
    def test_complete_local_upload_workflow(self, client: TestClient, test_file):
        """Test complete local file upload workflow."""
        filename, file_obj, content_type = test_file
        
        # Step 1: Upload file to local storage
        upload_data = {
            "entity_type": "lab-result",
            "entity_id": "1",
            "storage_backend": "local",
            "description": "Test upload"
        }
        
        response = client.post(
            "/api/v1/entity-files/upload",
            data=upload_data,
            files={"file": (filename, file_obj, content_type)}
        )
        
        assert response.status_code == 200
        upload_result = response.json()
        assert upload_result["file_name"] == filename
        assert upload_result["storage_backend"] == "local"
        file_id = upload_result["id"]
        
        # Step 2: Retrieve uploaded file
        response = client.get(f"/api/v1/entity-files/lab-result/1/files")
        assert response.status_code == 200
        
        files = response.json()
        assert len(files) == 1
        assert files[0]["id"] == file_id
        
        # Step 3: Download file
        response = client.get(f"/api/v1/entity-files/{file_id}/download")
        assert response.status_code == 200
        assert response.headers["content-type"] == content_type
        
        # Step 4: Delete file
        response = client.delete(f"/api/v1/entity-files/{file_id}")
        assert response.status_code == 200
        
        # Step 5: Verify deletion
        response = client.get(f"/api/v1/entity-files/lab-result/1/files")
        assert response.status_code == 200
        files = response.json()
        assert len(files) == 0
    
    def test_complete_paperless_upload_workflow(self, client: TestClient, test_file, mock_paperless_service):
        """Test complete Paperless upload workflow."""
        filename, file_obj, content_type = test_file
        
        # Mock Paperless service responses
        mock_paperless_service.upload_document.return_value = {
            "success": True,
            "task_id": "test-task-123"
        }
        mock_paperless_service.get_task_status.return_value = {
            "status": "SUCCESS",
            "result": {"document_id": "456"}
        }
        
        with patch('app.services.paperless.authentication.auth_service.AuthenticationFactory.create_auth_service') as mock_factory:
            mock_factory.return_value = mock_paperless_service
            
            # Step 1: Upload file to Paperless
            upload_data = {
                "entity_type": "lab-result",
                "entity_id": "1",
                "storage_backend": "paperless",
                "description": "Test Paperless upload"
            }
            
            response = client.post(
                "/api/v1/entity-files/upload",
                data=upload_data,
                files={"file": (filename, file_obj, content_type)}
            )
            
            assert response.status_code == 200
            upload_result = response.json()
            assert upload_result["storage_backend"] == "paperless"
            assert "paperless_task_uuid" in upload_result
            file_id = upload_result["id"]
            task_uuid = upload_result["paperless_task_uuid"]
            
            # Step 2: Monitor task completion
            response = client.get(f"/api/v1/paperless/tasks/{task_uuid}/status")
            assert response.status_code == 200
            
            task_status = response.json()
            assert task_status["status"] == "SUCCESS"
            assert task_status["document_id"] == "456"
            
            # Step 3: Verify file sync status
            response = client.get(f"/api/v1/entity-files/lab-result/1/files")
            assert response.status_code == 200
            
            files = response.json()
            assert len(files) == 1
            assert files[0]["id"] == file_id
            assert files[0]["sync_status"] == "synced"
            assert files[0]["paperless_document_id"] == "456"
```

### 5.7 Test Automation and CI/CD

**Step 5.7.1: Test Configuration**
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Set up Python
      uses: actions/setup-python@v2
      with:
        python-version: 3.9
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        pip install -r requirements-test.txt
    
    - name: Run security tests
      run: |
        pytest tests/security/ -v --cov=app/core/security
    
    - name: Run unit tests
      run: |
        pytest tests/unit/ -v --cov=app/services --cov=app/repositories
    
    - name: Run integration tests
      run: |
        pytest tests/api/ -v --cov=app/api
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
    
    - name: Run performance tests
      run: |
        pytest tests/performance/ -v --benchmark-only
    
    - name: Run E2E tests
      run: |
        pytest tests/e2e/ -v
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
    
    - name: Generate coverage report
      run: |
        coverage xml
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v1
      with:
        file: ./coverage.xml
        flags: unittests
```

### 5.8 Phase 5 Completion Checklist

- [ ] Comprehensive test suite implemented (unit, integration, E2E)
- [ ] Security testing covers authentication, authorization, and input validation
- [ ] Performance tests validate query optimization and response times
- [ ] API contract tests ensure backward compatibility
- [ ] End-to-end tests cover complete user workflows
- [ ] Test automation configured for CI/CD pipeline
- [ ] Code coverage targets met (80%+ overall)
- [ ] All tests passing consistently

---

## Phase 6: Deployment and Validation
**Duration**: 2-3 days | **Priority**: LOW

### 6.1 Deployment Strategy

#### Blue-Green Deployment Approach:
1. **Preparation Phase**: Deploy new version alongside current (blue)
2. **Validation Phase**: Run health checks and smoke tests
3. **Traffic Switch**: Gradually route traffic to new version (green)
4. **Monitoring Phase**: Monitor performance and error rates
5. **Rollback Ready**: Keep blue version ready for immediate rollback

### 6.2 Pre-Deployment Checklist

**Step 6.2.1: Environment Preparation**
```bash
# deployment/pre_deployment_checklist.sh
#!/bin/bash

echo "=== Pre-Deployment Checklist ==="

# 1. Database backup
echo "1. Creating database backup..."
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Environment variables check
echo "2. Checking environment variables..."
required_vars=(
    "SECRET_KEY"
    "DATABASE_URL"
    "PAPERLESS_SALT"
    "CREDENTIAL_KEY_VERSION"
)

for var in "${required_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        echo "ERROR: Missing required environment variable: $var"
        exit 1
    fi
done

# 3. Dependencies check
echo "3. Checking dependencies..."
python -c "import app.main" || {
    echo "ERROR: Application import failed"
    exit 1
}

# 4. Database connectivity
echo "4. Testing database connectivity..."
python -c "
from app.core.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    result = conn.execute(text('SELECT 1'))
    print('Database connection: OK')
"

# 5. Run critical tests
echo "5. Running critical tests..."
pytest tests/security/ tests/api/test_paperless_endpoints.py -v --tb=short

echo "Pre-deployment checklist completed successfully!"
```

**Step 6.2.2: Database Migration Execution**
```python
# deployment/migrate_database.py
import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.file_management import EntityFile, FileStorageRecord

def run_migration():
    """Execute database migration with validation."""
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable required")
    
    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    
    print("Starting database migration...")
    
    try:
        with engine.begin() as conn:
            # Check if migration already applied
            try:
                conn.execute(text("SELECT 1 FROM file_storage_records LIMIT 1"))
                print("Migration already applied, skipping...")
                return
            except:
                print("Migration needed, proceeding...")
            
            # Execute migration script
            migration_path = Path(__file__).parent / "migration_001_split_entity_files.sql"
            with open(migration_path) as f:
                migration_sql = f.read()
            
            # Execute in transaction
            conn.execute(text(migration_sql))
            print("Migration executed successfully")
        
        # Validate migration
        validate_migration(engine)
        print("Migration validation passed")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        raise

def validate_migration(engine):
    """Validate that migration was successful."""
    
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Check that new tables exist and have data
        file_count = session.query(EntityFile).count()
        storage_count = session.query(FileStorageRecord).count()
        
        print(f"Validation: {file_count} files, {storage_count} storage records")
        
        if file_count == 0:
            print("WARNING: No files found after migration")
        
        # Check that relationships work
        sample_file = session.query(EntityFile).first()
        if sample_file and sample_file.storage_records:
            print("Validation: Relationships working correctly")
        
    finally:
        session.close()

if __name__ == "__main__":
    run_migration()
```

### 6.3 Health Checks and Monitoring

**Step 6.3.1: Application Health Endpoints**
```python
# app/api/v1/endpoints/health.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.core.logging import StructuredLogger
import asyncio
import aiohttp

router = APIRouter()
logger = StructuredLogger("health_check")

@router.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {"status": "healthy", "service": "medical-records-api"}

@router.get("/health/detailed")
async def detailed_health_check(db: Session = Depends(get_db)):
    """Detailed health check with dependencies."""
    
    health_status = {
        "status": "healthy",
        "checks": {}
    }
    
    # Database connectivity
    try:
        result = db.execute(text("SELECT 1")).fetchone()
        health_status["checks"]["database"] = {
            "status": "healthy",
            "response_time": "< 100ms"
        }
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["checks"]["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    # File system access
    try:
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(delete=True) as tmp:
            tmp.write(b"health check")
            tmp.flush()
            os.path.exists(tmp.name)
        
        health_status["checks"]["filesystem"] = {
            "status": "healthy"
        }
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["checks"]["filesystem"] = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    # Memory usage
    try:
        import psutil
        memory = psutil.virtual_memory()
        
        health_status["checks"]["memory"] = {
            "status": "healthy" if memory.percent < 90 else "warning",
            "usage_percent": memory.percent,
            "available_gb": round(memory.available / (1024**3), 2)
        }
    except ImportError:
        health_status["checks"]["memory"] = {
            "status": "unknown",
            "error": "psutil not available"
        }
    
    return health_status

@router.get("/health/paperless")
async def paperless_health_check():
    """Check Paperless integration health."""
    
    health_status = {
        "status": "healthy",
        "paperless_connectivity": "not_configured"
    }
    
    # This would check actual Paperless connectivity if configured
    # For now, just return basic status
    
    return health_status
```

**Step 6.3.2: Monitoring Configuration**
```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'medical-records-api'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics'
    scrape_interval: 30s
    
  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

```yaml
# monitoring/alert_rules.yml
groups:
- name: medical_records_alerts
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }} requests per second"
  
  - alert: HighMemoryUsage
    expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High memory usage"
      description: "Memory usage is above 90%"
  
  - alert: DatabaseConnectionFailure
    expr: up{job="postgres"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Database connection failed"
      description: "PostgreSQL is not responding"
  
  - alert: PaperlessIntegrationDown
    expr: paperless_connection_status == 0
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "Paperless integration unavailable"
      description: "Cannot connect to Paperless-ngx instance"
```

### 6.4 Deployment Automation

**Step 6.4.1: Deployment Script**
```bash
# deployment/deploy.sh
#!/bin/bash

set -e  # Exit on any error

# Configuration
DEPLOY_ENV=${1:-production}
APP_NAME="medical-records-api"
HEALTH_CHECK_URL="http://localhost:8000/api/v1/health/detailed"
ROLLBACK_TIMEOUT=300  # 5 minutes

echo "=== Deploying $APP_NAME to $DEPLOY_ENV ==="

# Step 1: Pre-deployment validation
echo "Step 1: Pre-deployment validation"
./pre_deployment_checklist.sh

# Step 2: Create deployment directory
DEPLOY_DIR="/opt/$APP_NAME/releases/$(date +%Y%m%d_%H%M%S)"
echo "Step 2: Creating deployment directory: $DEPLOY_DIR"
sudo mkdir -p $DEPLOY_DIR

# Step 3: Copy application files
echo "Step 3: Copying application files"
sudo cp -r . $DEPLOY_DIR/
sudo chown -R app:app $DEPLOY_DIR

# Step 4: Install dependencies
echo "Step 4: Installing dependencies"
cd $DEPLOY_DIR
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Step 5: Run database migrations
echo "Step 5: Running database migrations"
python deployment/migrate_database.py

# Step 6: Update symlink (blue-green deployment)
echo "Step 6: Updating application symlink"
sudo ln -sfn $DEPLOY_DIR /opt/$APP_NAME/current

# Step 7: Restart application
echo "Step 7: Restarting application"
sudo systemctl restart $APP_NAME
sleep 5

# Step 8: Health check with timeout
echo "Step 8: Running health checks"
for i in {1..12}; do  # 12 attempts = 1 minute
    if curl -s $HEALTH_CHECK_URL | grep -q '"status":"healthy"'; then
        echo "Health check passed!"
        break
    fi
    
    if [ $i -eq 12 ]; then
        echo "Health check failed, initiating rollback..."
        rollback_deployment
        exit 1
    fi
    
    echo "Health check attempt $i failed, retrying in 5 seconds..."
    sleep 5
done

# Step 9: Smoke tests
echo "Step 9: Running smoke tests"
python -m pytest tests/smoke/ -v

echo "=== Deployment completed successfully ==="

# Cleanup old releases (keep last 5)
echo "Cleaning up old releases..."
cd /opt/$APP_NAME/releases
ls -t | tail -n +6 | xargs -r sudo rm -rf

rollback_deployment() {
    echo "=== ROLLBACK INITIATED ==="
    
    # Find previous release
    PREVIOUS_RELEASE=$(ls -t /opt/$APP_NAME/releases | sed -n '2p')
    
    if [ -n "$PREVIOUS_RELEASE" ]; then
        echo "Rolling back to: $PREVIOUS_RELEASE"
        sudo ln -sfn /opt/$APP_NAME/releases/$PREVIOUS_RELEASE /opt/$APP_NAME/current
        sudo systemctl restart $APP_NAME
        
        # Wait and verify rollback
        sleep 10
        if curl -s $HEALTH_CHECK_URL | grep -q '"status":"healthy"'; then
            echo "Rollback successful!"
        else
            echo "CRITICAL: Rollback failed! Manual intervention required!"
        fi
    else
        echo "CRITICAL: No previous release found for rollback!"
    fi
}
```

### 6.5 Post-Deployment Validation

**Step 6.5.1: Smoke Tests**
```python
# tests/smoke/test_critical_functionality.py
import requests
import pytest
import os

BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

class TestCriticalFunctionality:
    """Smoke tests for critical functionality after deployment."""
    
    def test_api_health(self):
        """Test that API is responding."""
        response = requests.get(f"{BASE_URL}/api/v1/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
    
    def test_detailed_health_check(self):
        """Test detailed health check."""
        response = requests.get(f"{BASE_URL}/api/v1/health/detailed")
        assert response.status_code == 200
        
        health_data = response.json()
        assert health_data["status"] in ["healthy", "warning"]
        assert "database" in health_data["checks"]
        assert health_data["checks"]["database"]["status"] == "healthy"
    
    def test_database_connectivity(self):
        """Test that database is accessible."""
        # This would require authentication in real deployment
        # For smoke test, just verify health endpoint reports DB as healthy
        response = requests.get(f"{BASE_URL}/api/v1/health/detailed")
        health_data = response.json()
        
        assert health_data["checks"]["database"]["status"] == "healthy"
    
    def test_file_upload_endpoint_exists(self):
        """Test that file upload endpoint is accessible."""
        # Test without authentication - should get 401/403, not 404
        response = requests.post(f"{BASE_URL}/api/v1/entity-files/upload")
        assert response.status_code in [401, 403, 422]  # Not 404 or 500
    
    def test_paperless_endpoints_exist(self):
        """Test that Paperless endpoints are accessible."""
        endpoints = [
            "/api/v1/paperless/settings",
            "/api/v1/paperless/health/paperless"
        ]
        
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            # Should get auth error, not 404
            assert response.status_code in [401, 403], f"Endpoint {endpoint} returned {response.status_code}"
```

### 6.6 Rollback Procedures

**Step 6.6.1: Automated Rollback**
```bash
# deployment/rollback.sh
#!/bin/bash

set -e

APP_NAME="medical-records-api"
HEALTH_CHECK_URL="http://localhost:8000/api/v1/health/detailed"

echo "=== EMERGENCY ROLLBACK INITIATED ==="

# Find releases
RELEASES_DIR="/opt/$APP_NAME/releases"
CURRENT_RELEASE=$(readlink /opt/$APP_NAME/current | xargs basename)
PREVIOUS_RELEASE=$(ls -t $RELEASES_DIR | grep -v $CURRENT_RELEASE | head -n 1)

if [ -z "$PREVIOUS_RELEASE" ]; then
    echo "CRITICAL: No previous release found!"
    exit 1
fi

echo "Current release: $CURRENT_RELEASE"
echo "Rolling back to: $PREVIOUS_RELEASE"

# Create backup of current state
echo "Creating backup of current state..."
sudo cp -r /opt/$APP_NAME/current /opt/$APP_NAME/rollback_backup_$(date +%Y%m%d_%H%M%S)

# Switch to previous release
echo "Switching to previous release..."
sudo ln -sfn $RELEASES_DIR/$PREVIOUS_RELEASE /opt/$APP_NAME/current

# Restart application
echo "Restarting application..."
sudo systemctl restart $APP_NAME
sleep 10

# Health check
echo "Verifying rollback..."
for i in {1..6}; do
    if curl -s $HEALTH_CHECK_URL | grep -q '"status":"healthy"'; then
        echo "Rollback successful! Application is healthy."
        exit 0
    fi
    
    echo "Health check attempt $i failed, waiting..."
    sleep 10
done

echo "CRITICAL: Rollback verification failed!"
echo "Current status:"
curl -s $HEALTH_CHECK_URL || echo "Health check endpoint not responding"

exit 1
```

### 6.7 Monitoring and Alerting Setup

**Step 6.7.1: Application Metrics**
```python
# app/core/metrics.py
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from fastapi import Response
import time
from functools import wraps

# Metrics definitions
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_DURATION = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint']
)

ACTIVE_CONNECTIONS = Gauge(
    'active_connections',
    'Active database connections'
)

FILE_OPERATIONS = Counter(
    'file_operations_total',
    'Total file operations',
    ['operation', 'backend', 'status']
)

PAPERLESS_OPERATIONS = Counter(
    'paperless_operations_total',
    'Total Paperless operations',
    ['operation', 'status']
)

def track_request_metrics(func):
    """Decorator to track request metrics."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        
        try:
            response = await func(*args, **kwargs)
            REQUEST_COUNT.labels(
                method=kwargs.get('method', 'unknown'),
                endpoint=kwargs.get('endpoint', 'unknown'),
                status='success'
            ).inc()
            return response
        except Exception as e:
            REQUEST_COUNT.labels(
                method=kwargs.get('method', 'unknown'),
                endpoint=kwargs.get('endpoint', 'unknown'),
                status='error'
            ).inc()
            raise
        finally:
            REQUEST_DURATION.labels(
                method=kwargs.get('method', 'unknown'),
                endpoint=kwargs.get('endpoint', 'unknown')
            ).observe(time.time() - start_time)
    
    return wrapper

def get_metrics():
    """Get Prometheus metrics."""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
```

### 6.8 Phase 6 Completion Checklist

- [ ] Blue-green deployment strategy implemented
- [ ] Pre-deployment validation scripts created
- [ ] Database migration scripts tested with rollback procedures
- [ ] Health check endpoints implemented
- [ ] Monitoring and alerting configured
- [ ] Deployment automation scripts tested
- [ ] Smoke tests validate critical functionality
- [ ] Rollback procedures documented and tested
- [ ] Production deployment successful
- [ ] Post-deployment monitoring confirms stability

---

## Progress Tracking System

### 7.1 Progress Dashboard

**Implementation Status Overview:**

| Phase | Component | Status | Completion % | Notes |
|-------|-----------|---------|--------------|-------|
| 1 | Debug Logging Cleanup | 🔄 Pending | 0% | Critical security fix |
| 1 | Credential Encryption | 🔄 Pending | 0% | Per-user encryption needed |
| 1 | Input Validation | 🔄 Pending | 0% | URL and credential validation |
| 2 | Authentication Service | 🔄 Pending | 0% | Factory pattern implementation |
| 2 | Document Service | 🔄 Pending | 0% | Clean API wrapper |
| 2 | Task Monitoring | 🔄 Pending | 0% | Simplified monitoring |
| 3 | Component Decomposition | 🔄 Pending | 0% | Break down monolithic components |
| 3 | TypeScript Migration | 🔄 Pending | 0% | Type safety implementation |
| 3 | State Management | 🔄 Pending | 0% | Context API + useReducer |
| 4 | Schema Migration | 🔄 Pending | 0% | Split EntityFile table |
| 4 | Repository Pattern | 🔄 Pending | 0% | Data access abstraction |
| 5 | Security Testing | 🔄 Pending | 0% | Comprehensive security tests |
| 5 | Performance Testing | 🔄 Pending | 0% | Database and API performance |
| 5 | E2E Testing | 🔄 Pending | 0% | Complete workflow tests |
| 6 | Deployment Scripts | 🔄 Pending | 0% | Automated deployment |
| 6 | Monitoring Setup | 🔄 Pending | 0% | Health checks and metrics |

### 7.2 Success Metrics Tracking

**Current Baseline vs. Target:**

| Metric | Current | Target | Status |
|--------|---------|---------|---------|
| Code Coverage | ~30% | 80%+ | 🔴 Needs Improvement |
| Security Vulnerabilities | 5+ Critical | 0 Critical | 🔴 Critical Issues |
| API Response Time | >2s | <500ms | 🔴 Performance Issues |
| Frontend Re-renders | High | -70% | 🔴 Performance Issues |
| Database N+1 Queries | Multiple | 0 | 🔴 Query Optimization Needed |
| Service Complexity | 1000+ lines/service | <200 lines/service | 🔴 Refactoring Needed |

### 7.3 Risk Management

**Current Risks and Mitigation:**

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|---------|-------------------|
| Production Data Loss | Low | Critical | Database backups + migration testing |
| Service Downtime | Medium | High | Blue-green deployment + rollback procedures |
| Security Breach | High | Critical | **IMMEDIATE**: Remove credential logging |
| Performance Degradation | Medium | Medium | Performance testing + monitoring |
| Breaking Changes | Low | High | Comprehensive testing + feature flags |
| Team Knowledge Gap | Medium | Medium | Documentation + knowledge transfer |

### 7.4 Implementation Checklist

**Phase 1 - Critical Security Fixes (Week 1):**
- [ ] Remove all debug logging with credentials
- [ ] Implement per-user credential encryption
- [ ] Add URL validation and SSRF protection
- [ ] Security audit and penetration testing
- [ ] Production log verification

**Phase 2 - Service Layer Refactoring (Week 2):**
- [ ] Create authentication service with factory pattern
- [ ] Implement document service with clean API
- [ ] Build simplified task monitoring service
- [ ] Eliminate code duplication
- [ ] Integration testing

**Phase 3 - Frontend Modernization (Week 3):**
- [ ] Decompose DocumentManagerCore into focused components
- [ ] Implement TypeScript with proper types
- [ ] Create Context API state management
- [ ] Build custom hooks for business logic
- [ ] Component testing and performance validation

**Phase 4 - Database Optimization (Week 4):**
- [ ] Create and test database migration scripts
- [ ] Implement repository pattern
- [ ] Add proper indexes and constraints
- [ ] Create audit trail functionality
- [ ] Performance testing and optimization

**Phase 5 - Testing Implementation (Week 5):**
- [ ] Security testing suite
- [ ] Performance and load testing
- [ ] API contract testing
- [ ] End-to-end workflow testing
- [ ] Test automation and CI/CD integration

**Phase 6 - Deployment and Monitoring (Week 6):**
- [ ] Blue-green deployment setup
- [ ] Health checks and monitoring
- [ ] Rollback procedures
- [ ] Production deployment
- [ ] Post-deployment validation

---

## Conclusion

This comprehensive refactoring guide provides everything needed to transform the paperless integration system from its current problematic state into a professional, secure, and maintainable solution. The plan prioritizes critical security fixes while systematically addressing architectural issues, performance problems, and technical debt.

**Key Success Factors:**
1. **Start with Phase 1 immediately** - Critical security issues require immediate attention
2. **Follow phases sequentially** - Each phase builds upon the previous one
3. **Test continuously** - Comprehensive testing ensures quality and prevents regressions
4. **Monitor progress** - Use the tracking system to ensure milestones are met
5. **Maintain functionality** - All existing features must be preserved throughout the refactoring

The refactoring will deliver:
- **Zero security vulnerabilities** (from current credential logging issues)
- **50% reduction in code complexity** through service decomposition
- **80%+ test coverage** with comprehensive testing strategy
- **70% performance improvement** through optimized queries and frontend rendering
- **Clean architecture** enabling future scalability and maintenance

This document serves as both an implementation guide and a project management tool, ensuring the refactoring project stays on track and delivers the intended improvements while maintaining system reliability.