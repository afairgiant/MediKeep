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

*[Document continues with Phases 3-6, testing implementation, deployment procedures, and progress tracking systems...]*