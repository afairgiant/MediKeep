# Paperless Integration System - Complete Refactoring Implementation Guide

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Overview](#project-overview)
3. [Phase 1: Initial Cleanup and Stabilization](#phase-1-initial-cleanup-and-stabilization)
4. [Phase 2: Architecture Refactoring](#phase-2-architecture-refactoring)
5. [Phase 3: Service Layer Redesign](#phase-3-service-layer-redesign)
6. [Phase 4: Database Schema Migration](#phase-4-database-schema-migration)
7. [Phase 5: Frontend Modernization](#phase-5-frontend-modernization)
8. [Phase 6: Testing Implementation](#phase-6-testing-implementation)
9. [Phase 7: Deployment and Validation](#phase-7-deployment-and-validation)
10. [Migration Scripts](#migration-scripts)
11. [Risk Management](#risk-management)
12. [Progress Tracking](#progress-tracking)

---

## Executive Summary

This document provides a comprehensive, actionable guide for refactoring the paperless integration system. The refactoring addresses critical issues identified in the architecture audit including:

- **Excessive debug logging** flooding production logs
- **Security vulnerabilities** in credential logging
- **Complex authentication patterns** causing sync failures
- **Overly complex task resolution** with multiple fallback mechanisms
- **Performance bottlenecks** from redundant API calls
- **Technical debt** from mixed patterns and duplicated code

### Key Objectives

1. **Immediate**: Remove debug logging, fix security issues
2. **Short-term**: Simplify authentication and task resolution
3. **Medium-term**: Implement clean architecture patterns
4. **Long-term**: Enable microservice migration path

### Timeline

- **Phase 1**: 1-2 days (Critical fixes)
- **Phase 2-3**: 1 week (Architecture refactoring)
- **Phase 4-5**: 2 weeks (Database and frontend)
- **Phase 6-7**: 1 week (Testing and deployment)
- **Total**: ~4-5 weeks

---

## Project Overview

### Current State Analysis

The paperless integration system currently exhibits:

#### Critical Issues (Immediate Action Required)
1. **Security Risk**: Credential information exposed in logs
2. **Performance**: Excessive debug logging (10+ log entries per operation)
3. **Reliability**: Authentication inconsistencies causing false "missing document" errors

#### Architectural Issues
1. **Mixed authentication patterns** across different operations
2. **Complex task resolution** with 4+ fallback mechanisms
3. **Monolithic service classes** with 1800+ lines of code
4. **Tight coupling** between layers
5. **No proper abstraction** boundaries

### Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Presentation Layer                         │
│  • API Controllers (Thin, validation only)                  │
│  • Request/Response DTOs                                    │
│  • OpenAPI Documentation                                    │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                          │
│  • Use Cases (Business logic)                               │
│  • Application Services                                     │
│  • Event Handlers                                          │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Domain Layer                            │
│  • Entities (File, Document, User)                         │
│  • Value Objects (Credentials, SyncStatus)                 │
│  • Domain Services                                         │
│  • Repository Interfaces                                   │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Infrastructure Layer                         │
│  • Repository Implementations                               │
│  • External Service Clients                                │
│  • Database Access                                         │
│  • File System Access                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Initial Cleanup and Stabilization

**Duration**: 1-2 days  
**Priority**: CRITICAL  
**Dependencies**: None

### 1.1 Remove Debug Logging

#### Current Issues
```python
# PROBLEM: Excessive debug logging in paperless_service.py
logger.error(f"🔍 PAPERLESS REQUEST DEBUG - Method: {method}")
logger.error(f"🔍 PAPERLESS REQUEST DEBUG - Full URL: {full_url}")
logger.error(f"🔍 PAPERLESS REQUEST DEBUG - Session Headers: {dict(self.session.headers)}")
logger.error(f"🔍 PAPERLESS REQUEST DEBUG - Request kwargs: {kwargs}")
logger.error(f"🔍 PAPERLESS REQUEST DEBUG - User ID: {self.user_id}")
```

#### Step-by-Step Fix

1. **Create logging configuration update**:

```python
# File: app/core/logging_config.py

import os
from enum import Enum

class LogLevel(Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

def get_log_level() -> str:
    """Get appropriate log level based on environment."""
    env = os.getenv("ENVIRONMENT", "production").lower()
    
    if env == "development":
        return LogLevel.DEBUG.value
    elif env == "staging":
        return LogLevel.INFO.value
    else:  # production
        return LogLevel.WARNING.value

def should_log_debug() -> bool:
    """Check if debug logging is enabled."""
    return get_log_level() == LogLevel.DEBUG.value
```

2. **Replace all debug logger.error() calls**:

```bash
# Script: cleanup_debug_logs.py

import re
import os

def cleanup_debug_logs(file_path):
    """Replace logger.error debug statements with proper logger.debug."""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern to match debug logger.error statements
    patterns = [
        (r'logger\.error\(f?".*?🔍.*?".*?\)', 'logger.debug'),
        (r'logger\.error\(f?".*?DEBUG.*?".*?\)', 'logger.debug'),
    ]
    
    for pattern, replacement in patterns:
        content = re.sub(pattern, lambda m: m.group(0).replace('logger.error', replacement), content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Cleaned up {file_path}")

# Apply to all Python files
for root, dirs, files in os.walk('app'):
    for file in files:
        if file.endswith('.py'):
            cleanup_debug_logs(os.path.join(root, file))
```

3. **Manual review and updates**:

```python
# File: app/services/paperless_service.py
# BEFORE (lines 184-189):
logger.error(f"🔍 PAPERLESS REQUEST DEBUG - Method: {method}")
logger.error(f"🔍 PAPERLESS REQUEST DEBUG - Full URL: {full_url}")

# AFTER:
if should_log_debug():
    logger.debug(f"Paperless request - Method: {method}, URL: {full_url}")
```

### 1.2 Remove Credential Logging

#### Security Fixes

```python
# File: app/services/paperless_service.py

# REMOVE these lines completely:
# Line 406-408:
logger.error(f"🔍 TOKEN SERVICE DEBUG - Initializing with token: '{api_token[:10] if api_token else None}...'")
logger.error(f"🔍 TOKEN SERVICE DEBUG - Token length: {len(api_token) if api_token else 0}")

# Line 414-416:
logger.error(f"🔍 SESSION DEBUG - About to set Authorization header with token: '{self.api_token[:10] if self.api_token else None}...'")
logger.error(f"🔍 SESSION DEBUG - Authorization header set to: '{auth_headers['Authorization'][:20]}...'")

# REPLACE with safe logging:
logger.info("Initializing token-based authentication service", extra={
    "user_id": user_id,
    "auth_type": "token"
})
```

### 1.3 Implement Structured Logging

```python
# File: app/core/structured_logging.py

from datetime import datetime
from typing import Dict, Any, Optional
import json

class StructuredLogger:
    """Structured logging with consistent format and security."""
    
    def __init__(self, logger_name: str):
        self.logger = get_logger(logger_name)
        self.name = logger_name
    
    def log_operation(self, 
                     operation: str, 
                     level: str = "INFO",
                     user_id: Optional[int] = None,
                     **context):
        """Log operation with structured context."""
        
        # Never log sensitive fields
        sensitive_fields = {
            'password', 'token', 'api_key', 'secret', 
            'authorization', 'credential', 'encrypted'
        }
        
        # Filter out sensitive data
        safe_context = {}
        for key, value in context.items():
            if any(sensitive in key.lower() for sensitive in sensitive_fields):
                safe_context[key] = "[REDACTED]"
            else:
                safe_context[key] = value
        
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "service": self.name,
            "operation": operation,
            "user_id": user_id,
            **safe_context
        }
        
        if level == "ERROR":
            self.logger.error(json.dumps(log_entry))
        elif level == "WARNING":
            self.logger.warning(json.dumps(log_entry))
        else:
            self.logger.info(json.dumps(log_entry))

# Usage example:
structured_logger = StructuredLogger(__name__)
structured_logger.log_operation(
    "document_upload",
    user_id=123,
    entity_type="lab-result",
    file_size=1024,
    status="success"
)
```

### 1.4 Testing Phase 1

```python
# File: tests/test_phase1_cleanup.py

import pytest
import os
import re

def test_no_debug_logger_errors():
    """Ensure no debug logger.error statements remain."""
    
    python_files = []
    for root, dirs, files in os.walk('app'):
        for file in files:
            if file.endswith('.py'):
                python_files.append(os.path.join(root, file))
    
    debug_patterns = [
        r'logger\.error.*?🔍',
        r'logger\.error.*?DEBUG',
    ]
    
    violations = []
    for file_path in python_files:
        with open(file_path, 'r') as f:
            content = f.read()
            for i, line in enumerate(content.splitlines(), 1):
                for pattern in debug_patterns:
                    if re.search(pattern, line):
                        violations.append(f"{file_path}:{i} - {line.strip()}")
    
    assert not violations, f"Found debug logger.error statements:\n" + "\n".join(violations)

def test_no_credential_logging():
    """Ensure no credentials are logged."""
    
    sensitive_patterns = [
        r'logger\.\w+.*?(password|token|api_key|secret).*?["\'].*?["\']',
        r'logger\.\w+.*?Authorization.*?Token',
    ]
    
    # Similar check for sensitive logging
    # ...
```

### Phase 1 Checklist

- [ ] Run cleanup_debug_logs.py script
- [ ] Manually review and fix remaining debug statements
- [ ] Remove all credential logging
- [ ] Implement structured logging
- [ ] Run security tests
- [ ] Deploy hotfix to production
- [ ] Monitor logs for 24 hours

---

## Phase 2: Architecture Refactoring

**Duration**: 3-4 days  
**Priority**: HIGH  
**Dependencies**: Phase 1 complete

### 2.1 Create Domain Layer

```python
# File: app/domain/entities/file.py

from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from enum import Enum

class StorageBackend(Enum):
    LOCAL = "local"
    PAPERLESS = "paperless"

class SyncStatus(Enum):
    SYNCED = "synced"
    PENDING = "pending"
    PROCESSING = "processing"
    FAILED = "failed"
    MISSING = "missing"
    DUPLICATE = "duplicate"

@dataclass
class FileEntity:
    """Domain entity representing a file."""
    
    id: Optional[int]
    entity_type: str
    entity_id: int
    file_name: str
    file_type: str
    file_size: int
    description: Optional[str]
    uploaded_at: datetime
    storage_backend: StorageBackend
    sync_status: SyncStatus
    
    # Paperless-specific fields
    paperless_document_id: Optional[str] = None
    paperless_task_uuid: Optional[str] = None
    last_sync_at: Optional[datetime] = None
    
    def is_synced(self) -> bool:
        """Check if file is successfully synced."""
        return self.sync_status == SyncStatus.SYNCED
    
    def is_paperless_file(self) -> bool:
        """Check if file is stored in Paperless."""
        return self.storage_backend == StorageBackend.PAPERLESS
    
    def mark_as_synced(self, document_id: str):
        """Mark file as synced with Paperless."""
        if not self.is_paperless_file():
            raise ValueError("Cannot mark non-Paperless file as synced")
        
        self.paperless_document_id = document_id
        self.paperless_task_uuid = None  # Clear task UUID
        self.sync_status = SyncStatus.SYNCED
        self.last_sync_at = datetime.utcnow()
```

```python
# File: app/domain/value_objects/credentials.py

from dataclasses import dataclass
from typing import Optional

@dataclass(frozen=True)
class PaperlessCredentials:
    """Value object for Paperless credentials."""
    
    url: str
    api_token: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    
    def __post_init__(self):
        """Validate credentials."""
        if not self.url:
            raise ValueError("Paperless URL is required")
        
        if not self.url.startswith(('http://', 'https://')):
            raise ValueError("URL must start with http:// or https://")
        
        # Must have either token OR username/password
        has_token = bool(self.api_token)
        has_basic_auth = bool(self.username and self.password)
        
        if not (has_token or has_basic_auth):
            raise ValueError("Either API token or username/password required")
    
    def get_auth_type(self) -> str:
        """Get authentication type."""
        if self.api_token:
            return "token"
        elif self.username and self.password:
            return "basic"
        return "none"
    
    def mask_sensitive_data(self) -> dict:
        """Return credentials with masked sensitive data."""
        return {
            "url": self.url,
            "auth_type": self.get_auth_type(),
            "has_token": bool(self.api_token),
            "has_credentials": bool(self.username and self.password)
        }
```

### 2.2 Create Repository Interfaces

```python
# File: app/domain/repositories/file_repository.py

from abc import ABC, abstractmethod
from typing import List, Optional
from app.domain.entities.file import FileEntity

class FileRepository(ABC):
    """Abstract repository for file operations."""
    
    @abstractmethod
    async def save(self, file: FileEntity) -> FileEntity:
        """Save or update a file entity."""
        pass
    
    @abstractmethod
    async def find_by_id(self, file_id: int) -> Optional[FileEntity]:
        """Find file by ID."""
        pass
    
    @abstractmethod
    async def find_by_entity(self, entity_type: str, entity_id: int) -> List[FileEntity]:
        """Find all files for an entity."""
        pass
    
    @abstractmethod
    async def find_by_task_uuid(self, task_uuid: str) -> Optional[FileEntity]:
        """Find file by Paperless task UUID."""
        pass
    
    @abstractmethod
    async def find_paperless_files_for_user(self, user_id: int) -> List[FileEntity]:
        """Find all Paperless files for a user."""
        pass
    
    @abstractmethod
    async def delete(self, file_id: int) -> bool:
        """Delete a file record."""
        pass
```

### 2.3 Create Application Services

```python
# File: app/application/services/file_upload_service.py

from typing import Optional
from app.domain.entities.file import FileEntity, StorageBackend, SyncStatus
from app.domain.repositories.file_repository import FileRepository
from app.infrastructure.paperless.client import PaperlessClient
from app.infrastructure.storage.local_storage import LocalStorage

class FileUploadService:
    """Application service for file uploads."""
    
    def __init__(self, 
                 file_repository: FileRepository,
                 paperless_client: Optional[PaperlessClient],
                 local_storage: LocalStorage):
        self.file_repository = file_repository
        self.paperless_client = paperless_client
        self.local_storage = local_storage
    
    async def upload_file(self,
                         file_data: bytes,
                         file_name: str,
                         entity_type: str,
                         entity_id: int,
                         user_id: int,
                         storage_backend: StorageBackend,
                         description: Optional[str] = None) -> FileEntity:
        """Upload file to specified storage backend."""
        
        # Create file entity
        file_entity = FileEntity(
            id=None,
            entity_type=entity_type,
            entity_id=entity_id,
            file_name=file_name,
            file_type=self._get_file_type(file_name),
            file_size=len(file_data),
            description=description,
            uploaded_at=datetime.utcnow(),
            storage_backend=storage_backend,
            sync_status=SyncStatus.PENDING
        )
        
        # Save to database first
        file_entity = await self.file_repository.save(file_entity)
        
        try:
            if storage_backend == StorageBackend.LOCAL:
                # Upload to local storage
                file_path = await self.local_storage.save_file(
                    file_data, file_name, entity_type, entity_id
                )
                file_entity.file_path = file_path
                file_entity.sync_status = SyncStatus.SYNCED
                
            elif storage_backend == StorageBackend.PAPERLESS:
                # Upload to Paperless
                if not self.paperless_client:
                    raise ValueError("Paperless client not configured")
                
                task_uuid = await self.paperless_client.upload_document(
                    file_data, file_name, entity_type, entity_id, user_id
                )
                file_entity.paperless_task_uuid = task_uuid
                file_entity.sync_status = SyncStatus.PROCESSING
            
            # Update entity with results
            return await self.file_repository.save(file_entity)
            
        except Exception as e:
            # On failure, mark as failed and cleanup
            file_entity.sync_status = SyncStatus.FAILED
            await self.file_repository.save(file_entity)
            raise
```

### 2.4 Simplify Task Resolution

```python
# File: app/application/services/task_resolution_service.py

import re
from typing import Optional, Tuple
from app.domain.entities.file import FileEntity
from app.domain.repositories.file_repository import FileRepository
from app.infrastructure.paperless.client import PaperlessClient

class TaskResolutionService:
    """Simplified task resolution service."""
    
    def __init__(self, 
                 file_repository: FileRepository,
                 paperless_client: PaperlessClient):
        self.file_repository = file_repository
        self.paperless_client = paperless_client
    
    async def resolve_task(self, task_uuid: str) -> Tuple[str, Optional[str]]:
        """
        Resolve task UUID to document ID.
        
        Returns:
            Tuple of (status, document_id)
            Status: 'success', 'failed', 'processing'
        """
        # Get task status from Paperless
        task_data = await self.paperless_client.get_task_status(task_uuid)
        
        if not task_data:
            return ('processing', None)
        
        status = task_data.get('status', '').lower()
        
        if status == 'success':
            # Extract document ID using single method
            document_id = self._extract_document_id(task_data)
            
            if document_id:
                # Validate document exists
                exists = await self.paperless_client.check_document_exists(document_id)
                if exists:
                    return ('success', document_id)
                else:
                    # Document ID extracted but doesn't exist - likely error
                    return ('failed', None)
            else:
                # No document ID found - likely duplicate
                return ('failed', None)
        
        elif status == 'failure':
            return ('failed', None)
        
        else:  # pending, started, retry
            return ('processing', None)
    
    def _extract_document_id(self, task_data: dict) -> Optional[str]:
        """
        Extract document ID from task data.
        Single, simple extraction method.
        """
        result = task_data.get('result', {})
        
        # Try direct extraction
        if isinstance(result, dict):
            doc_id = result.get('document_id') or result.get('id')
            if doc_id:
                return str(doc_id)
        
        # Try string parsing
        elif isinstance(result, str):
            match = re.search(r'document id (\d+)', result, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    async def update_file_from_task(self, task_uuid: str) -> Optional[FileEntity]:
        """Update file entity based on task resolution."""
        
        # Find file by task UUID
        file_entity = await self.file_repository.find_by_task_uuid(task_uuid)
        if not file_entity:
            return None
        
        # Resolve task
        status, document_id = await self.resolve_task(task_uuid)
        
        if status == 'success' and document_id:
            file_entity.mark_as_synced(document_id)
        elif status == 'failed':
            file_entity.sync_status = SyncStatus.FAILED
            # For Paperless files, we should delete failed uploads
            if file_entity.is_paperless_file():
                await self.file_repository.delete(file_entity.id)
                return None
        # else: still processing, no update needed
        
        return await self.file_repository.save(file_entity)
```

### 2.5 Infrastructure Layer Implementation

```python
# File: app/infrastructure/paperless/client.py

from typing import Optional, Dict, Any
import aiohttp
from app.domain.value_objects.credentials import PaperlessCredentials

class PaperlessClient:
    """Simplified Paperless API client."""
    
    def __init__(self, credentials: PaperlessCredentials):
        self.credentials = credentials
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        """Create HTTP session on context entry."""
        headers = {
            "Accept": "application/json",
            "User-Agent": "MedicalRecords/2.0"
        }
        
        if self.credentials.api_token:
            headers["Authorization"] = f"Token {self.credentials.api_token}"
            auth = None
        else:
            auth = aiohttp.BasicAuth(
                self.credentials.username, 
                self.credentials.password
            )
        
        self.session = aiohttp.ClientSession(
            headers=headers,
            auth=auth,
            timeout=aiohttp.ClientTimeout(total=30)
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Close HTTP session on context exit."""
        if self.session:
            await self.session.close()
    
    async def test_connection(self) -> bool:
        """Test connection to Paperless."""
        try:
            async with self.session.get(
                f"{self.credentials.url}/api/ui_settings/"
            ) as response:
                return response.status == 200
        except Exception:
            return False
    
    async def upload_document(self, 
                            file_data: bytes,
                            filename: str,
                            entity_type: str,
                            entity_id: int,
                            user_id: int) -> str:
        """
        Upload document to Paperless.
        Returns task UUID.
        """
        form_data = aiohttp.FormData()
        form_data.add_field("document", file_data, filename=filename)
        
        async with self.session.post(
            f"{self.credentials.url}/api/documents/post_document/",
            data=form_data
        ) as response:
            if response.status not in [200, 201]:
                text = await response.text()
                raise Exception(f"Upload failed: {text}")
            
            # Extract task UUID from response
            result = await response.text()
            task_uuid = result.strip().strip('"')
            
            if not task_uuid:
                raise Exception("No task UUID returned")
            
            return task_uuid
    
    async def get_task_status(self, task_uuid: str) -> Optional[Dict[str, Any]]:
        """Get task status by UUID."""
        async with self.session.get(
            f"{self.credentials.url}/api/tasks/?task_id={task_uuid}"
        ) as response:
            if response.status != 200:
                return None
            
            data = await response.json()
            
            # Handle list response
            if isinstance(data, list) and data:
                return data[0]
            elif isinstance(data, dict) and "results" in data:
                return data["results"][0] if data["results"] else None
            
            return data
    
    async def check_document_exists(self, document_id: str) -> bool:
        """Check if document exists."""
        try:
            # Validate numeric ID
            numeric_id = int(document_id)
            
            async with self.session.get(
                f"{self.credentials.url}/api/documents/{numeric_id}/"
            ) as response:
                return response.status == 200
        except (ValueError, Exception):
            return False
```

### Phase 2 Testing

```python
# File: tests/test_domain_entities.py

import pytest
from datetime import datetime
from app.domain.entities.file import FileEntity, StorageBackend, SyncStatus

def test_file_entity_creation():
    """Test file entity creation and validation."""
    file = FileEntity(
        id=1,
        entity_type="lab-result",
        entity_id=100,
        file_name="test.pdf",
        file_type="application/pdf",
        file_size=1024,
        description="Test file",
        uploaded_at=datetime.utcnow(),
        storage_backend=StorageBackend.PAPERLESS,
        sync_status=SyncStatus.PENDING
    )
    
    assert file.is_paperless_file()
    assert not file.is_synced()

def test_mark_as_synced():
    """Test marking file as synced."""
    file = FileEntity(
        id=1,
        entity_type="lab-result",
        entity_id=100,
        file_name="test.pdf",
        file_type="application/pdf",
        file_size=1024,
        description="Test file",
        uploaded_at=datetime.utcnow(),
        storage_backend=StorageBackend.PAPERLESS,
        sync_status=SyncStatus.PROCESSING
    )
    
    file.mark_as_synced("12345")
    
    assert file.is_synced()
    assert file.paperless_document_id == "12345"
    assert file.paperless_task_uuid is None
    assert file.last_sync_at is not None
```

### Phase 2 Checklist

- [ ] Create domain entities and value objects
- [ ] Define repository interfaces
- [ ] Implement application services
- [ ] Create infrastructure implementations
- [ ] Write unit tests for domain logic
- [ ] Integration tests for services
- [ ] Code review and documentation

---

## Phase 3: Service Layer Redesign

**Duration**: 3-4 days  
**Priority**: HIGH  
**Dependencies**: Phase 2 complete

### 3.1 Create Use Cases

```python
# File: app/application/use_cases/upload_file_use_case.py

from dataclasses import dataclass
from typing import Optional
from app.domain.entities.file import StorageBackend
from app.application.services.file_upload_service import FileUploadService
from app.application.ports.event_bus import EventBus
from app.application.events import FileUploadedEvent

@dataclass
class UploadFileRequest:
    """Request DTO for file upload."""
    file_data: bytes
    file_name: str
    entity_type: str
    entity_id: int
    user_id: int
    storage_backend: StorageBackend
    description: Optional[str] = None

@dataclass
class UploadFileResponse:
    """Response DTO for file upload."""
    file_id: int
    status: str
    task_uuid: Optional[str] = None
    message: Optional[str] = None

class UploadFileUseCase:
    """Use case for uploading files."""
    
    def __init__(self,
                 upload_service: FileUploadService,
                 event_bus: EventBus):
        self.upload_service = upload_service
        self.event_bus = event_bus
    
    async def execute(self, request: UploadFileRequest) -> UploadFileResponse:
        """Execute file upload use case."""
        
        try:
            # Upload file
            file_entity = await self.upload_service.upload_file(
                file_data=request.file_data,
                file_name=request.file_name,
                entity_type=request.entity_type,
                entity_id=request.entity_id,
                user_id=request.user_id,
                storage_backend=request.storage_backend,
                description=request.description
            )
            
            # Publish event
            await self.event_bus.publish(FileUploadedEvent(
                file_id=file_entity.id,
                entity_type=file_entity.entity_type,
                entity_id=file_entity.entity_id,
                storage_backend=file_entity.storage_backend.value,
                user_id=request.user_id,
                timestamp=file_entity.uploaded_at
            ))
            
            # Return response
            return UploadFileResponse(
                file_id=file_entity.id,
                status="success",
                task_uuid=file_entity.paperless_task_uuid,
                message="File uploaded successfully"
            )
            
        except Exception as e:
            return UploadFileResponse(
                file_id=0,
                status="error",
                message=str(e)
            )
```

### 3.2 Event-Driven Architecture

```python
# File: app/application/events.py

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

@dataclass
class DomainEvent:
    """Base class for domain events."""
    timestamp: datetime
    event_id: Optional[str] = None

@dataclass
class FileUploadedEvent(DomainEvent):
    """Event raised when file is uploaded."""
    file_id: int
    entity_type: str
    entity_id: int
    storage_backend: str
    user_id: int

@dataclass
class DocumentSyncCompletedEvent(DomainEvent):
    """Event raised when document sync completes."""
    file_id: int
    document_id: str
    sync_status: str
    user_id: int

@dataclass
class SyncFailedEvent(DomainEvent):
    """Event raised when sync fails."""
    file_id: int
    error_message: str
    user_id: int
```

```python
# File: app/application/ports/event_bus.py

from abc import ABC, abstractmethod
from typing import Type, Callable, List
from collections import defaultdict
import asyncio

from app.application.events import DomainEvent

class EventBus(ABC):
    """Abstract event bus interface."""
    
    @abstractmethod
    async def publish(self, event: DomainEvent):
        """Publish an event."""
        pass
    
    @abstractmethod
    def subscribe(self, event_type: Type[DomainEvent], handler: Callable):
        """Subscribe to an event type."""
        pass

class InMemoryEventBus(EventBus):
    """In-memory event bus implementation."""
    
    def __init__(self):
        self._handlers: dict = defaultdict(list)
    
    async def publish(self, event: DomainEvent):
        """Publish event to all registered handlers."""
        handlers = self._handlers.get(type(event), [])
        
        # Execute handlers concurrently
        tasks = [handler(event) for handler in handlers]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    def subscribe(self, event_type: Type[DomainEvent], handler: Callable):
        """Register event handler."""
        self._handlers[event_type].append(handler)
```

### 3.3 Event Handlers

```python
# File: app/application/event_handlers/sync_monitoring_handler.py

from app.application.events import FileUploadedEvent
from app.application.services.task_resolution_service import TaskResolutionService
from app.domain.entities.file import StorageBackend

class SyncMonitoringHandler:
    """Handle file upload events for sync monitoring."""
    
    def __init__(self, task_resolution_service: TaskResolutionService):
        self.task_resolution_service = task_resolution_service
    
    async def handle_file_uploaded(self, event: FileUploadedEvent):
        """Start monitoring Paperless uploads."""
        
        if event.storage_backend == StorageBackend.PAPERLESS.value:
            # Schedule periodic task checking
            # In production, use Celery or similar
            pass

# File: app/application/event_handlers/notification_handler.py

from app.application.events import DocumentSyncCompletedEvent, SyncFailedEvent
from app.infrastructure.notifications.notifier import Notifier

class NotificationHandler:
    """Handle notifications for sync events."""
    
    def __init__(self, notifier: Notifier):
        self.notifier = notifier
    
    async def handle_sync_completed(self, event: DocumentSyncCompletedEvent):
        """Notify user of successful sync."""
        await self.notifier.notify_user(
            user_id=event.user_id,
            message=f"Document {event.document_id} synced successfully"
        )
    
    async def handle_sync_failed(self, event: SyncFailedEvent):
        """Notify user of sync failure."""
        await self.notifier.notify_user(
            user_id=event.user_id,
            message=f"Document sync failed: {event.error_message}"
        )
```

### 3.4 Dependency Injection Setup

```python
# File: app/infrastructure/di/container.py

from typing import Optional
from app.domain.repositories.file_repository import FileRepository
from app.infrastructure.repositories.sqlalchemy_file_repository import SqlAlchemyFileRepository
from app.infrastructure.paperless.client import PaperlessClient
from app.infrastructure.storage.local_storage import LocalStorage
from app.application.services.file_upload_service import FileUploadService
from app.application.ports.event_bus import EventBus
from app.infrastructure.events.in_memory_event_bus import InMemoryEventBus

class DIContainer:
    """Dependency injection container."""
    
    def __init__(self):
        self._services = {}
        self._singletons = {}
    
    def register(self, interface, factory, singleton=False):
        """Register service factory."""
        self._services[interface] = (factory, singleton)
    
    def resolve(self, interface):
        """Resolve service instance."""
        if interface not in self._services:
            raise ValueError(f"Service {interface} not registered")
        
        factory, is_singleton = self._services[interface]
        
        if is_singleton:
            if interface not in self._singletons:
                self._singletons[interface] = factory(self)
            return self._singletons[interface]
        
        return factory(self)

def configure_container(db_session, user_prefs) -> DIContainer:
    """Configure DI container with services."""
    container = DIContainer()
    
    # Register repositories
    container.register(
        FileRepository,
        lambda c: SqlAlchemyFileRepository(db_session),
        singleton=True
    )
    
    # Register infrastructure services
    container.register(
        LocalStorage,
        lambda c: LocalStorage(settings.UPLOAD_DIR),
        singleton=True
    )
    
    # Register Paperless client conditionally
    if user_prefs and user_prefs.paperless_enabled:
        container.register(
            PaperlessClient,
            lambda c: PaperlessClient(
                create_paperless_credentials(user_prefs)
            ),
            singleton=True
        )
    
    # Register event bus
    container.register(
        EventBus,
        lambda c: InMemoryEventBus(),
        singleton=True
    )
    
    # Register application services
    container.register(
        FileUploadService,
        lambda c: FileUploadService(
            file_repository=c.resolve(FileRepository),
            paperless_client=c.resolve(PaperlessClient) if user_prefs.paperless_enabled else None,
            local_storage=c.resolve(LocalStorage)
        )
    )
    
    return container
```

### 3.5 API Controller Updates

```python
# File: app/api/v1/endpoints/files.py

from fastapi import APIRouter, Depends, UploadFile, File
from app.api.deps import get_current_user, get_db
from app.infrastructure.di.container import configure_container
from app.application.use_cases.upload_file_use_case import (
    UploadFileUseCase, UploadFileRequest
)
from app.domain.entities.file import StorageBackend

router = APIRouter()

@router.post("/upload/{entity_type}/{entity_id}")
async def upload_file(
    entity_type: str,
    entity_id: int,
    file: UploadFile = File(...),
    description: Optional[str] = None,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Upload file to configured storage backend."""
    
    # Get user preferences
    user_prefs = get_user_preferences(db, current_user.id)
    
    # Configure DI container
    container = configure_container(db, user_prefs)
    
    # Resolve use case
    upload_use_case = UploadFileUseCase(
        upload_service=container.resolve(FileUploadService),
        event_bus=container.resolve(EventBus)
    )
    
    # Determine storage backend
    storage_backend = (
        StorageBackend.PAPERLESS 
        if user_prefs.default_storage_backend == "paperless" 
        else StorageBackend.LOCAL
    )
    
    # Execute use case
    file_data = await file.read()
    response = await upload_use_case.execute(UploadFileRequest(
        file_data=file_data,
        file_name=file.filename,
        entity_type=entity_type,
        entity_id=entity_id,
        user_id=current_user.id,
        storage_backend=storage_backend,
        description=description
    ))
    
    if response.status == "error":
        raise HTTPException(status_code=400, detail=response.message)
    
    return {
        "file_id": response.file_id,
        "task_uuid": response.task_uuid,
        "message": response.message
    }
```

### Phase 3 Testing

```python
# File: tests/test_use_cases.py

import pytest
from unittest.mock import Mock, AsyncMock
from app.application.use_cases.upload_file_use_case import (
    UploadFileUseCase, UploadFileRequest
)
from app.domain.entities.file import StorageBackend

@pytest.mark.asyncio
async def test_upload_file_use_case_success():
    """Test successful file upload."""
    
    # Mock dependencies
    mock_upload_service = Mock()
    mock_upload_service.upload_file = AsyncMock(return_value=Mock(
        id=123,
        paperless_task_uuid="task-123"
    ))
    
    mock_event_bus = Mock()
    mock_event_bus.publish = AsyncMock()
    
    # Create use case
    use_case = UploadFileUseCase(mock_upload_service, mock_event_bus)
    
    # Execute
    request = UploadFileRequest(
        file_data=b"test data",
        file_name="test.pdf",
        entity_type="lab-result",
        entity_id=1,
        user_id=1,
        storage_backend=StorageBackend.PAPERLESS
    )
    
    response = await use_case.execute(request)
    
    # Verify
    assert response.status == "success"
    assert response.file_id == 123
    assert response.task_uuid == "task-123"
    
    # Verify event published
    mock_event_bus.publish.assert_called_once()
```

### Phase 3 Checklist

- [ ] Create use case classes
- [ ] Implement event system
- [ ] Create event handlers
- [ ] Setup dependency injection
- [ ] Update API controllers
- [ ] Write use case tests
- [ ] Integration testing
- [ ] Performance testing

---

## Phase 4: Database Schema Migration

**Duration**: 3-4 days  
**Priority**: MEDIUM  
**Dependencies**: Phase 3 complete

### 4.1 New Schema Design

```sql
-- File: migrations/001_split_entity_files_table.sql

-- Create new tables for better separation of concerns

-- Core file metadata
CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INTEGER,
    description TEXT,
    uploaded_at TIMESTAMP NOT NULL,
    uploaded_by_user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_entity_lookup (entity_type, entity_id, uploaded_at),
    INDEX idx_user_files (uploaded_by_user_id, uploaded_at)
);

-- Storage backend information
CREATE TABLE file_storage (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    storage_backend VARCHAR(20) NOT NULL,
    storage_reference VARCHAR(500) NOT NULL, -- file_path or document_id
    sync_status VARCHAR(20) NOT NULL DEFAULT 'synced',
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Paperless-specific fields
    paperless_task_uuid VARCHAR(255),
    paperless_document_id VARCHAR(255),
    
    -- Constraints
    UNIQUE KEY unique_file_storage (file_id, storage_backend),
    
    -- Indexes
    INDEX idx_storage_backend (storage_backend, sync_status),
    INDEX idx_paperless_task (paperless_task_uuid),
    INDEX idx_paperless_document (paperless_document_id)
);

-- Audit log for file operations
CREATE TABLE file_audit_log (
    id SERIAL PRIMARY KEY,
    file_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    operation VARCHAR(50) NOT NULL, -- upload, download, delete, sync
    operation_data JSON,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_file_audit (file_id, created_at),
    INDEX idx_user_audit (user_id, created_at)
);
```

### 4.2 Migration Script

```python
# File: migrations/migrate_entity_files.py

import asyncio
from sqlalchemy import text
from app.core.database import engine

async def migrate_entity_files():
    """Migrate data from entity_files to new schema."""
    
    async with engine.begin() as conn:
        # Start transaction
        await conn.execute(text("BEGIN"))
        
        try:
            # Step 1: Migrate to files table
            await conn.execute(text("""
                INSERT INTO files (
                    entity_type, entity_id, file_name, file_type,
                    file_size, description, uploaded_at, uploaded_by_user_id,
                    created_at, updated_at
                )
                SELECT 
                    entity_type, entity_id, file_name, file_type,
                    file_size, description, uploaded_at, 
                    COALESCE(uploaded_by_user_id, 1), -- Default user if missing
                    created_at, updated_at
                FROM entity_files
            """))
            
            # Step 2: Migrate to file_storage table
            await conn.execute(text("""
                INSERT INTO file_storage (
                    file_id, storage_backend, storage_reference,
                    sync_status, last_sync_at, 
                    paperless_task_uuid, paperless_document_id
                )
                SELECT 
                    f.id,
                    ef.storage_backend,
                    COALESCE(ef.file_path, ef.paperless_document_id, ''),
                    ef.sync_status,
                    ef.last_sync_at,
                    ef.paperless_task_uuid,
                    ef.paperless_document_id
                FROM entity_files ef
                JOIN files f ON (
                    f.entity_type = ef.entity_type 
                    AND f.entity_id = ef.entity_id
                    AND f.file_name = ef.file_name
                )
            """))
            
            # Step 3: Create audit entries for existing files
            await conn.execute(text("""
                INSERT INTO file_audit_log (
                    file_id, user_id, operation, operation_data
                )
                SELECT 
                    id, uploaded_by_user_id, 'upload',
                    jsonb_build_object(
                        'source', 'migration',
                        'original_upload_date', uploaded_at
                    )
                FROM files
            """))
            
            await conn.execute(text("COMMIT"))
            print("Migration completed successfully")
            
        except Exception as e:
            await conn.execute(text("ROLLBACK"))
            print(f"Migration failed: {e}")
            raise

if __name__ == "__main__":
    asyncio.run(migrate_entity_files())
```

### 4.3 Updated Models

```python
# File: app/models/file_models.py

from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.utils import get_utc_now

class File(Base):
    """Core file metadata model."""
    __tablename__ = "files"
    
    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(Integer, nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(100), nullable=False)
    file_size = Column(Integer)
    description = Column(Text)
    uploaded_at = Column(DateTime, nullable=False)
    uploaded_by_user_id = Column(Integer, nullable=False, index=True)
    created_at = Column(DateTime, default=get_utc_now)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)
    
    # Relationships
    storage_records = relationship("FileStorage", back_populates="file", cascade="all, delete-orphan")
    audit_logs = relationship("FileAuditLog", back_populates="file")

class FileStorage(Base):
    """File storage backend information."""
    __tablename__ = "file_storage"
    
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    storage_backend = Column(String(20), nullable=False, index=True)
    storage_reference = Column(String(500), nullable=False)
    sync_status = Column(String(20), nullable=False, default="synced", index=True)
    last_sync_at = Column(DateTime)
    created_at = Column(DateTime, default=get_utc_now)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)
    
    # Paperless-specific fields
    paperless_task_uuid = Column(String(255), index=True)
    paperless_document_id = Column(String(255), index=True)
    
    # Relationships
    file = relationship("File", back_populates="storage_records")

class FileAuditLog(Base):
    """Audit log for file operations."""
    __tablename__ = "file_audit_log"
    
    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    operation = Column(String(50), nullable=False)
    operation_data = Column(JSON)
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    created_at = Column(DateTime, default=get_utc_now, index=True)
    
    # Relationships
    file = relationship("File", back_populates="audit_logs")
```

### 4.4 Repository Implementation

```python
# File: app/infrastructure/repositories/sqlalchemy_file_repository.py

from typing import List, Optional
from sqlalchemy.orm import Session, selectinload
from app.domain.repositories.file_repository import FileRepository
from app.domain.entities.file import FileEntity, StorageBackend, SyncStatus
from app.models.file_models import File, FileStorage

class SqlAlchemyFileRepository(FileRepository):
    """SQLAlchemy implementation of file repository."""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def save(self, file_entity: FileEntity) -> FileEntity:
        """Save or update file entity."""
        
        if file_entity.id:
            # Update existing
            db_file = self.db.query(File).filter(File.id == file_entity.id).first()
            if not db_file:
                raise ValueError(f"File {file_entity.id} not found")
        else:
            # Create new
            db_file = File(
                entity_type=file_entity.entity_type,
                entity_id=file_entity.entity_id,
                file_name=file_entity.file_name,
                file_type=file_entity.file_type,
                file_size=file_entity.file_size,
                description=file_entity.description,
                uploaded_at=file_entity.uploaded_at,
                uploaded_by_user_id=1  # TODO: Get from context
            )
            self.db.add(db_file)
            self.db.flush()
        
        # Update storage record
        storage = self.db.query(FileStorage).filter(
            FileStorage.file_id == db_file.id,
            FileStorage.storage_backend == file_entity.storage_backend.value
        ).first()
        
        if not storage:
            storage = FileStorage(
                file_id=db_file.id,
                storage_backend=file_entity.storage_backend.value,
                storage_reference=file_entity.paperless_document_id or "",
                sync_status=file_entity.sync_status.value,
                paperless_task_uuid=file_entity.paperless_task_uuid,
                paperless_document_id=file_entity.paperless_document_id,
                last_sync_at=file_entity.last_sync_at
            )
            self.db.add(storage)
        else:
            storage.sync_status = file_entity.sync_status.value
            storage.paperless_document_id = file_entity.paperless_document_id
            storage.paperless_task_uuid = file_entity.paperless_task_uuid
            storage.last_sync_at = file_entity.last_sync_at
        
        self.db.commit()
        
        # Convert back to entity
        return self._to_entity(db_file, storage)
    
    async def find_by_id(self, file_id: int) -> Optional[FileEntity]:
        """Find file by ID."""
        db_file = self.db.query(File).options(
            selectinload(File.storage_records)
        ).filter(File.id == file_id).first()
        
        if not db_file:
            return None
        
        # Get primary storage record
        storage = next((s for s in db_file.storage_records), None)
        return self._to_entity(db_file, storage) if storage else None
    
    def _to_entity(self, db_file: File, storage: FileStorage) -> FileEntity:
        """Convert database models to domain entity."""
        return FileEntity(
            id=db_file.id,
            entity_type=db_file.entity_type,
            entity_id=db_file.entity_id,
            file_name=db_file.file_name,
            file_type=db_file.file_type,
            file_size=db_file.file_size,
            description=db_file.description,
            uploaded_at=db_file.uploaded_at,
            storage_backend=StorageBackend(storage.storage_backend),
            sync_status=SyncStatus(storage.sync_status),
            paperless_document_id=storage.paperless_document_id,
            paperless_task_uuid=storage.paperless_task_uuid,
            last_sync_at=storage.last_sync_at
        )
```

### Phase 4 Checklist

- [ ] Design new database schema
- [ ] Create migration scripts
- [ ] Backup existing data
- [ ] Run migrations in test environment
- [ ] Update SQLAlchemy models
- [ ] Implement new repositories
- [ ] Update existing queries
- [ ] Performance testing
- [ ] Rollback plan ready

---

## Phase 5: Frontend Modernization

**Duration**: 1 week  
**Priority**: MEDIUM  
**Dependencies**: Phase 4 complete

### 5.1 Component Architecture

```typescript
// File: frontend/src/features/files/types.ts

export enum StorageBackend {
  LOCAL = 'local',
  PAPERLESS = 'paperless'
}

export enum SyncStatus {
  SYNCED = 'synced',
  PENDING = 'pending',
  PROCESSING = 'processing',
  FAILED = 'failed',
  MISSING = 'missing',
  DUPLICATE = 'duplicate'
}

export interface FileEntity {
  id: number;
  entityType: string;
  entityId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  description?: string;
  uploadedAt: Date;
  storageBackend: StorageBackend;
  syncStatus: SyncStatus;
  paperlessDocumentId?: string;
  paperlessTaskUuid?: string;
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
}
```

### 5.2 React Hooks

```typescript
// File: frontend/src/features/files/hooks/useFileUpload.ts

import { useState, useCallback } from 'react';
import { uploadFile, pollTaskStatus } from '../api/fileApi';
import { StorageBackend, UploadProgress } from '../types';

export function useFileUpload() {
  const [uploads, setUploads] = useState<Map<string, UploadProgress>>(new Map());
  const [isUploading, setIsUploading] = useState(false);

  const updateProgress = useCallback((fileId: string, update: Partial<UploadProgress>) => {
    setUploads(prev => {
      const next = new Map(prev);
      const current = next.get(fileId);
      if (current) {
        next.set(fileId, { ...current, ...update });
      }
      return next;
    });
  }, []);

  const uploadFiles = useCallback(async (
    files: File[],
    entityType: string,
    entityId: number,
    storageBackend: StorageBackend
  ) => {
    setIsUploading(true);

    // Initialize progress tracking
    const uploadMap = new Map<string, UploadProgress>();
    files.forEach(file => {
      const fileId = `${file.name}-${Date.now()}`;
      uploadMap.set(fileId, {
        fileId,
        fileName: file.name,
        progress: 0,
        status: 'pending'
      });
    });
    setUploads(uploadMap);

    // Upload files
    for (const file of files) {
      const fileId = Array.from(uploadMap.entries())
        .find(([_, v]) => v.fileName === file.name)?.[0];
      
      if (!fileId) continue;

      try {
        updateProgress(fileId, { status: 'uploading', progress: 10 });

        const response = await uploadFile({
          file,
          entityType,
          entityId,
          storageBackend
        });

        updateProgress(fileId, { progress: 50 });

        if (storageBackend === StorageBackend.PAPERLESS && response.taskUuid) {
          updateProgress(fileId, { status: 'processing', progress: 60 });
          
          // Poll for task completion
          const taskResult = await pollTaskStatus(response.taskUuid);
          
          if (taskResult.status === 'success') {
            updateProgress(fileId, { status: 'completed', progress: 100 });
          } else {
            updateProgress(fileId, { 
              status: 'failed', 
              error: taskResult.error || 'Processing failed' 
            });
          }
        } else {
          updateProgress(fileId, { status: 'completed', progress: 100 });
        }
      } catch (error) {
        updateProgress(fileId, { 
          status: 'failed', 
          error: error.message || 'Upload failed' 
        });
      }
    }

    setIsUploading(false);
  }, [updateProgress]);

  const clearUploads = useCallback(() => {
    setUploads(new Map());
  }, []);

  return {
    uploads: Array.from(uploads.values()),
    isUploading,
    uploadFiles,
    clearUploads
  };
}
```

### 5.3 React Components

```tsx
// File: frontend/src/features/files/components/FileUploadButton.tsx

import React, { useRef } from 'react';
import { Button, FileButton } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import { StorageBackend } from '../types';
import { useFileUpload } from '../hooks/useFileUpload';

interface FileUploadButtonProps {
  entityType: string;
  entityId: number;
  storageBackend: StorageBackend;
  onUploadComplete?: () => void;
  accept?: string;
  multiple?: boolean;
}

export function FileUploadButton({
  entityType,
  entityId,
  storageBackend,
  onUploadComplete,
  accept = '*',
  multiple = true
}: FileUploadButtonProps) {
  const { uploadFiles, isUploading } = useFileUpload();

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;

    await uploadFiles(files, entityType, entityId, storageBackend);
    onUploadComplete?.();
  };

  return (
    <FileButton
      onChange={handleFiles}
      accept={accept}
      multiple={multiple}
    >
      {(props) => (
        <Button
          {...props}
          leftIcon={<IconUpload size={16} />}
          loading={isUploading}
          disabled={isUploading}
        >
          Upload Files
        </Button>
      )}
    </FileButton>
  );
}
```

```tsx
// File: frontend/src/features/files/components/FileList.tsx

import React from 'react';
import { Table, Badge, ActionIcon, Group } from '@mantine/core';
import { IconDownload, IconTrash, IconRefresh } from '@tabler/icons-react';
import { FileEntity, SyncStatus } from '../types';
import { formatFileSize, formatDate } from '../utils/formatters';

interface FileListProps {
  files: FileEntity[];
  onDownload: (file: FileEntity) => void;
  onDelete: (file: FileEntity) => void;
  onRefresh: () => void;
}

const syncStatusColors: Record<SyncStatus, string> = {
  [SyncStatus.SYNCED]: 'green',
  [SyncStatus.PENDING]: 'yellow',
  [SyncStatus.PROCESSING]: 'blue',
  [SyncStatus.FAILED]: 'red',
  [SyncStatus.MISSING]: 'gray',
  [SyncStatus.DUPLICATE]: 'orange'
};

export function FileList({ files, onDownload, onDelete, onRefresh }: FileListProps) {
  const rows = files.map((file) => (
    <tr key={file.id}>
      <td>{file.fileName}</td>
      <td>{formatFileSize(file.fileSize)}</td>
      <td>{formatDate(file.uploadedAt)}</td>
      <td>
        <Badge color={file.storageBackend === 'paperless' ? 'blue' : 'gray'}>
          {file.storageBackend}
        </Badge>
      </td>
      <td>
        <Badge color={syncStatusColors[file.syncStatus]}>
          {file.syncStatus}
        </Badge>
      </td>
      <td>
        <Group spacing="xs">
          <ActionIcon
            color="blue"
            onClick={() => onDownload(file)}
            title="Download"
          >
            <IconDownload size={16} />
          </ActionIcon>
          <ActionIcon
            color="red"
            onClick={() => onDelete(file)}
            title="Delete"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </td>
    </tr>
  ));

  return (
    <>
      <Group position="right" mb="md">
        <ActionIcon onClick={onRefresh} title="Refresh">
          <IconRefresh size={20} />
        </ActionIcon>
      </Group>
      
      <Table>
        <thead>
          <tr>
            <th>File Name</th>
            <th>Size</th>
            <th>Uploaded</th>
            <th>Storage</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </Table>
    </>
  );
}
```

### 5.4 API Client

```typescript
// File: frontend/src/features/files/api/fileApi.ts

import { apiClient } from '@/services/api';
import { FileEntity, StorageBackend } from '../types';

interface UploadFileParams {
  file: File;
  entityType: string;
  entityId: number;
  storageBackend: StorageBackend;
  description?: string;
}

interface UploadResponse {
  fileId: number;
  taskUuid?: string;
  message: string;
}

interface TaskStatusResponse {
  status: 'pending' | 'processing' | 'success' | 'failed';
  documentId?: string;
  error?: string;
}

export async function uploadFile(params: UploadFileParams): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', params.file);
  if (params.description) {
    formData.append('description', params.description);
  }

  const response = await apiClient.post<UploadResponse>(
    `/files/upload/${params.entityType}/${params.entityId}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      params: {
        storage_backend: params.storageBackend
      }
    }
  );

  return response.data;
}

export async function getFiles(entityType: string, entityId: number): Promise<FileEntity[]> {
  const response = await apiClient.get<FileEntity[]>(
    `/files/${entityType}/${entityId}`
  );
  return response.data;
}

export async function deleteFile(fileId: number): Promise<void> {
  await apiClient.delete(`/files/${fileId}`);
}

export async function downloadFile(fileId: number): Promise<Blob> {
  const response = await apiClient.get(`/files/${fileId}/download`, {
    responseType: 'blob'
  });
  return response.data;
}

export async function pollTaskStatus(
  taskUuid: string,
  maxAttempts = 30,
  intervalMs = 1000
): Promise<TaskStatusResponse> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await apiClient.get<TaskStatusResponse>(
      `/paperless/tasks/${taskUuid}/status`
    );

    if (response.data.status === 'success' || response.data.status === 'failed') {
      return response.data;
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('Task polling timeout');
}
```

### 5.5 State Management

```typescript
// File: frontend/src/features/files/store/fileSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as fileApi from '../api/fileApi';
import { FileEntity } from '../types';

interface FileState {
  files: Record<string, FileEntity[]>; // Keyed by entityType-entityId
  loading: boolean;
  error: string | null;
}

const initialState: FileState = {
  files: {},
  loading: false,
  error: null
};

// Async thunks
export const fetchFiles = createAsyncThunk(
  'files/fetch',
  async ({ entityType, entityId }: { entityType: string; entityId: number }) => {
    const files = await fileApi.getFiles(entityType, entityId);
    return { entityType, entityId, files };
  }
);

export const deleteFile = createAsyncThunk(
  'files/delete',
  async ({ fileId, entityType, entityId }: { 
    fileId: number; 
    entityType: string; 
    entityId: number 
  }) => {
    await fileApi.deleteFile(fileId);
    return { fileId, entityType, entityId };
  }
);

// Slice
const fileSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    addFile: (state, action: PayloadAction<{
      entityType: string;
      entityId: number;
      file: FileEntity;
    }>) => {
      const key = `${action.payload.entityType}-${action.payload.entityId}`;
      if (!state.files[key]) {
        state.files[key] = [];
      }
      state.files[key].push(action.payload.file);
    },
    
    updateFile: (state, action: PayloadAction<{
      entityType: string;
      entityId: number;
      fileId: number;
      updates: Partial<FileEntity>;
    }>) => {
      const key = `${action.payload.entityType}-${action.payload.entityId}`;
      const files = state.files[key];
      if (files) {
        const index = files.findIndex(f => f.id === action.payload.fileId);
        if (index !== -1) {
          files[index] = { ...files[index], ...action.payload.updates };
        }
      }
    }
  },
  
  extraReducers: (builder) => {
    builder
      .addCase(fetchFiles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFiles.fulfilled, (state, action) => {
        const key = `${action.payload.entityType}-${action.payload.entityId}`;
        state.files[key] = action.payload.files;
        state.loading = false;
      })
      .addCase(fetchFiles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch files';
      })
      .addCase(deleteFile.fulfilled, (state, action) => {
        const key = `${action.payload.entityType}-${action.payload.entityId}`;
        const files = state.files[key];
        if (files) {
          state.files[key] = files.filter(f => f.id !== action.payload.fileId);
        }
      });
  }
});

export const { addFile, updateFile } = fileSlice.actions;
export default fileSlice.reducer;
```

### Phase 5 Checklist

- [ ] Create TypeScript types
- [ ] Implement React hooks
- [ ] Build UI components
- [ ] Update API client
- [ ] Implement state management
- [ ] Write component tests
- [ ] Update existing file managers
- [ ] Performance optimization
- [ ] Accessibility testing

---

## Phase 6: Testing Implementation

**Duration**: 3-4 days  
**Priority**: HIGH  
**Dependencies**: Phase 5 complete

### 6.1 Unit Tests

```python
# File: tests/unit/test_file_entity.py

import pytest
from datetime import datetime
from app.domain.entities.file import FileEntity, StorageBackend, SyncStatus

class TestFileEntity:
    """Test file entity business logic."""
    
    def test_create_file_entity(self):
        """Test creating a file entity."""
        file = FileEntity(
            id=None,
            entity_type="lab-result",
            entity_id=123,
            file_name="blood_test.pdf",
            file_type="application/pdf",
            file_size=1024000,
            description="Blood test results",
            uploaded_at=datetime.utcnow(),
            storage_backend=StorageBackend.PAPERLESS,
            sync_status=SyncStatus.PENDING
        )
        
        assert file.entity_type == "lab-result"
        assert file.is_paperless_file()
        assert not file.is_synced()
    
    def test_mark_as_synced(self):
        """Test marking file as synced."""
        file = FileEntity(
            id=1,
            entity_type="lab-result",
            entity_id=123,
            file_name="test.pdf",
            file_type="application/pdf",
            file_size=1024,
            description=None,
            uploaded_at=datetime.utcnow(),
            storage_backend=StorageBackend.PAPERLESS,
            sync_status=SyncStatus.PROCESSING,
            paperless_task_uuid="task-123"
        )
        
        file.mark_as_synced("doc-456")
        
        assert file.is_synced()
        assert file.paperless_document_id == "doc-456"
        assert file.paperless_task_uuid is None
        assert file.last_sync_at is not None
    
    def test_cannot_sync_local_file(self):
        """Test that local files cannot be marked as synced with Paperless."""
        file = FileEntity(
            id=1,
            entity_type="lab-result",
            entity_id=123,
            file_name="test.pdf",
            file_type="application/pdf",
            file_size=1024,
            description=None,
            uploaded_at=datetime.utcnow(),
            storage_backend=StorageBackend.LOCAL,
            sync_status=SyncStatus.SYNCED
        )
        
        with pytest.raises(ValueError) as exc:
            file.mark_as_synced("doc-456")
        
        assert "Cannot mark non-Paperless file as synced" in str(exc.value)
```

### 6.2 Integration Tests

```python
# File: tests/integration/test_file_upload_service.py

import pytest
from unittest.mock import Mock, AsyncMock
from app.application.services.file_upload_service import FileUploadService
from app.domain.entities.file import StorageBackend

@pytest.mark.asyncio
class TestFileUploadService:
    """Test file upload service integration."""
    
    async def test_upload_to_local_storage(self):
        """Test uploading file to local storage."""
        # Setup mocks
        mock_repo = Mock()
        mock_repo.save = AsyncMock(side_effect=lambda f: f)
        
        mock_local_storage = Mock()
        mock_local_storage.save_file = AsyncMock(
            return_value="/uploads/2024/01/test.pdf"
        )
        
        # Create service
        service = FileUploadService(
            file_repository=mock_repo,
            paperless_client=None,
            local_storage=mock_local_storage
        )
        
        # Upload file
        result = await service.upload_file(
            file_data=b"test content",
            file_name="test.pdf",
            entity_type="lab-result",
            entity_id=123,
            user_id=1,
            storage_backend=StorageBackend.LOCAL
        )
        
        # Verify
        assert result.storage_backend == StorageBackend.LOCAL
        assert result.sync_status.value == "synced"
        mock_local_storage.save_file.assert_called_once()
        assert mock_repo.save.call_count == 2  # Initial save + update
    
    async def test_upload_to_paperless(self):
        """Test uploading file to Paperless."""
        # Setup mocks
        mock_repo = Mock()
        mock_repo.save = AsyncMock(side_effect=lambda f: f)
        
        mock_paperless = Mock()
        mock_paperless.upload_document = AsyncMock(
            return_value="task-uuid-123"
        )
        
        # Create service
        service = FileUploadService(
            file_repository=mock_repo,
            paperless_client=mock_paperless,
            local_storage=Mock()
        )
        
        # Upload file
        result = await service.upload_file(
            file_data=b"test content",
            file_name="test.pdf",
            entity_type="lab-result",
            entity_id=123,
            user_id=1,
            storage_backend=StorageBackend.PAPERLESS
        )
        
        # Verify
        assert result.storage_backend == StorageBackend.PAPERLESS
        assert result.sync_status.value == "processing"
        assert result.paperless_task_uuid == "task-uuid-123"
        mock_paperless.upload_document.assert_called_once()
```

### 6.3 End-to-End Tests

```python
# File: tests/e2e/test_file_workflow.py

import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
class TestFileWorkflow:
    """End-to-end tests for file management workflow."""
    
    async def test_complete_file_upload_workflow(self, async_client: AsyncClient, test_user):
        """Test complete file upload and retrieval workflow."""
        
        # Step 1: Upload file
        with open("tests/fixtures/sample.pdf", "rb") as f:
            response = await async_client.post(
                "/api/v1/files/upload/lab-result/123",
                files={"file": ("sample.pdf", f, "application/pdf")},
                headers={"Authorization": f"Bearer {test_user.token}"}
            )
        
        assert response.status_code == 200
        data = response.json()
        file_id = data["file_id"]
        assert file_id > 0
        
        # Step 2: Get files for entity
        response = await async_client.get(
            "/api/v1/files/lab-result/123",
            headers={"Authorization": f"Bearer {test_user.token}"}
        )
        
        assert response.status_code == 200
        files = response.json()
        assert len(files) == 1
        assert files[0]["id"] == file_id
        assert files[0]["fileName"] == "sample.pdf"
        
        # Step 3: Download file
        response = await async_client.get(
            f"/api/v1/files/{file_id}/download",
            headers={"Authorization": f"Bearer {test_user.token}"}
        )
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert len(response.content) > 0
        
        # Step 4: Delete file
        response = await async_client.delete(
            f"/api/v1/files/{file_id}",
            headers={"Authorization": f"Bearer {test_user.token}"}
        )
        
        assert response.status_code == 200
        
        # Verify deletion
        response = await async_client.get(
            "/api/v1/files/lab-result/123",
            headers={"Authorization": f"Bearer {test_user.token}"}
        )
        
        assert response.status_code == 200
        files = response.json()
        assert len(files) == 0
```

### 6.4 Performance Tests

```python
# File: tests/performance/test_file_operations.py

import pytest
import asyncio
import time
from statistics import mean, stdev

@pytest.mark.performance
class TestFilePerformance:
    """Performance tests for file operations."""
    
    @pytest.mark.asyncio
    async def test_concurrent_uploads(self, file_upload_service):
        """Test performance of concurrent file uploads."""
        
        async def upload_file(index: int):
            start = time.time()
            await file_upload_service.upload_file(
                file_data=b"x" * 1024 * 1024,  # 1MB
                file_name=f"test_{index}.pdf",
                entity_type="lab-result",
                entity_id=index,
                user_id=1,
                storage_backend="local"
            )
            return time.time() - start
        
        # Run 50 concurrent uploads
        tasks = [upload_file(i) for i in range(50)]
        durations = await asyncio.gather(*tasks)
        
        # Analyze results
        avg_duration = mean(durations)
        std_deviation = stdev(durations)
        max_duration = max(durations)
        
        print(f"Average upload time: {avg_duration:.2f}s")
        print(f"Standard deviation: {std_deviation:.2f}s")
        print(f"Maximum upload time: {max_duration:.2f}s")
        
        # Assert performance requirements
        assert avg_duration < 1.0  # Average under 1 second
        assert max_duration < 3.0  # Max under 3 seconds
    
    @pytest.mark.asyncio
    async def test_large_file_list_performance(self, db_session):
        """Test performance of retrieving large file lists."""
        
        # Create 1000 test files
        # ... setup code ...
        
        start = time.time()
        files = await file_repository.find_by_entity("lab-result", 1)
        duration = time.time() - start
        
        assert len(files) == 1000
        assert duration < 0.5  # Should complete in under 500ms
```

### 6.5 Security Tests

```python
# File: tests/security/test_file_security.py

import pytest
from app.domain.value_objects.credentials import PaperlessCredentials

class TestFileSecurity:
    """Security tests for file operations."""
    
    def test_credentials_validation(self):
        """Test credential validation."""
        
        # Valid credentials
        creds = PaperlessCredentials(
            url="https://paperless.example.com",
            api_token="secret-token"
        )
        assert creds.get_auth_type() == "token"
        
        # Invalid - no credentials
        with pytest.raises(ValueError) as exc:
            PaperlessCredentials(url="https://example.com")
        assert "Either API token or username/password required" in str(exc.value)
        
        # Invalid - bad URL
        with pytest.raises(ValueError) as exc:
            PaperlessCredentials(
                url="ftp://example.com",
                api_token="token"
            )
        assert "URL must start with http://" in str(exc.value)
    
    def test_credential_masking(self):
        """Test that credentials are properly masked."""
        creds = PaperlessCredentials(
            url="https://paperless.example.com",
            api_token="super-secret-token-12345",
            username="admin",
            password="secret123"
        )
        
        masked = creds.mask_sensitive_data()
        
        assert masked["url"] == "https://paperless.example.com"
        assert masked["auth_type"] == "token"
        assert masked["has_token"] is True
        assert masked["has_credentials"] is True
        assert "api_token" not in masked
        assert "password" not in masked
    
    @pytest.mark.asyncio
    async def test_file_access_control(self, async_client, test_user, other_user):
        """Test that users can only access their own files."""
        
        # Upload file as test_user
        # ... upload code ...
        
        # Try to access as other_user
        response = await async_client.get(
            f"/api/v1/files/{file_id}",
            headers={"Authorization": f"Bearer {other_user.token}"}
        )
        
        assert response.status_code == 403
        assert "Access denied" in response.json()["detail"]
```

### Phase 6 Checklist

- [ ] Write unit tests for domain logic
- [ ] Integration tests for services
- [ ] End-to-end workflow tests
- [ ] Performance benchmarks
- [ ] Security test suite
- [ ] Test coverage > 80%
- [ ] Load testing
- [ ] CI/CD pipeline setup

---

## Phase 7: Deployment and Validation

**Duration**: 2-3 days  
**Priority**: HIGH  
**Dependencies**: All phases complete

### 7.1 Pre-Deployment Checklist

```yaml
# File: deployment/pre-deployment-checklist.yaml

production_readiness:
  code_quality:
    - [ ] All debug logging removed
    - [ ] No hardcoded credentials
    - [ ] Error handling comprehensive
    - [ ] Code review completed
    
  testing:
    - [ ] Unit test coverage > 80%
    - [ ] Integration tests passing
    - [ ] E2E tests passing
    - [ ] Performance benchmarks met
    - [ ] Security scan completed
    
  documentation:
    - [ ] API documentation updated
    - [ ] Deployment guide created
    - [ ] Rollback procedures documented
    - [ ] Monitoring alerts configured
    
  infrastructure:
    - [ ] Database backups taken
    - [ ] Migration scripts tested
    - [ ] Load balancer configured
    - [ ] SSL certificates valid
```

### 7.2 Deployment Script

```bash
#!/bin/bash
# File: deployment/deploy.sh

set -euo pipefail

ENVIRONMENT=${1:-staging}
VERSION=${2:-latest}

echo "Deploying version $VERSION to $ENVIRONMENT"

# Step 1: Pre-deployment checks
echo "Running pre-deployment checks..."
python scripts/pre_deployment_check.py --env $ENVIRONMENT

# Step 2: Database backup
echo "Backing up database..."
pg_dump $DATABASE_URL > backups/pre_deploy_$(date +%Y%m%d_%H%M%S).sql

# Step 3: Run migrations
echo "Running database migrations..."
alembic upgrade head

# Step 4: Deploy application
echo "Deploying application..."
docker-compose -f docker-compose.$ENVIRONMENT.yml up -d --build

# Step 5: Health check
echo "Waiting for application to start..."
sleep 10
python scripts/health_check.py --url $APP_URL

# Step 6: Run smoke tests
echo "Running smoke tests..."
pytest tests/smoke/ -v

echo "Deployment completed successfully!"
```

### 7.3 Rollback Procedure

```python
# File: scripts/rollback.py

import os
import sys
import subprocess
from datetime import datetime

def rollback_deployment(version: str, reason: str):
    """Rollback to previous version."""
    
    print(f"Starting rollback to version {version}")
    print(f"Reason: {reason}")
    
    # Step 1: Switch application to maintenance mode
    subprocess.run(["kubectl", "set", "env", "deployment/app", "MAINTENANCE_MODE=true"])
    
    # Step 2: Rollback database if needed
    if input("Rollback database? (y/n): ").lower() == 'y':
        backup_file = input("Enter backup file name: ")
        subprocess.run(["psql", os.environ["DATABASE_URL"], "-f", backup_file])
    
    # Step 3: Deploy previous version
    subprocess.run(["kubectl", "set", "image", f"deployment/app", f"app=app:{version}"])
    
    # Step 4: Wait for rollout
    subprocess.run(["kubectl", "rollout", "status", "deployment/app"])
    
    # Step 5: Exit maintenance mode
    subprocess.run(["kubectl", "set", "env", "deployment/app", "MAINTENANCE_MODE-"])
    
    # Step 6: Verify
    subprocess.run(["python", "scripts/health_check.py"])
    
    print("Rollback completed")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python rollback.py <version> <reason>")
        sys.exit(1)
    
    rollback_deployment(sys.argv[1], sys.argv[2])
```

### 7.4 Monitoring Setup

```python
# File: monitoring/metrics.py

from prometheus_client import Counter, Histogram, Gauge
import time

# Define metrics
file_upload_total = Counter(
    'file_upload_total',
    'Total number of file uploads',
    ['storage_backend', 'status']
)

file_upload_duration = Histogram(
    'file_upload_duration_seconds',
    'File upload duration in seconds',
    ['storage_backend']
)

paperless_sync_queue = Gauge(
    'paperless_sync_queue_size',
    'Number of files pending Paperless sync'
)

# Usage in application
class MetricsMiddleware:
    """Middleware to collect metrics."""
    
    async def __call__(self, request, call_next):
        start_time = time.time()
        
        response = await call_next(request)
        
        # Record request duration
        duration = time.time() - start_time
        
        if request.url.path.startswith("/api/v1/files/upload"):
            storage_backend = request.query_params.get("storage_backend", "local")
            status = "success" if response.status_code == 200 else "error"
            
            file_upload_total.labels(
                storage_backend=storage_backend,
                status=status
            ).inc()
            
            file_upload_duration.labels(
                storage_backend=storage_backend
            ).observe(duration)
        
        return response
```

### 7.5 Post-Deployment Validation

```python
# File: scripts/post_deployment_validation.py

import asyncio
import httpx
from typing import List, Dict

async def validate_deployment(base_url: str) -> Dict[str, bool]:
    """Validate deployment is working correctly."""
    
    results = {}
    
    async with httpx.AsyncClient() as client:
        # Test 1: Health check
        try:
            response = await client.get(f"{base_url}/health")
            results["health_check"] = response.status_code == 200
        except Exception as e:
            results["health_check"] = False
            print(f"Health check failed: {e}")
        
        # Test 2: API endpoints
        endpoints = [
            "/api/v1/files",
            "/api/v1/paperless/health",
            "/api/v1/paperless/settings"
        ]
        
        for endpoint in endpoints:
            try:
                response = await client.get(f"{base_url}{endpoint}")
                results[endpoint] = response.status_code in [200, 401]  # 401 is OK (needs auth)
            except Exception as e:
                results[endpoint] = False
                print(f"Endpoint {endpoint} failed: {e}")
        
        # Test 3: File upload (with auth)
        # ... implement authenticated test ...
    
    return results

async def main():
    """Run validation tests."""
    
    environments = {
        "staging": "https://staging.example.com",
        "production": "https://app.example.com"
    }
    
    for env, url in environments.items():
        print(f"\nValidating {env} deployment...")
        results = await validate_deployment(url)
        
        all_passed = all(results.values())
        print(f"Results for {env}:")
        for test, passed in results.items():
            status = "✓" if passed else "✗"
            print(f"  {status} {test}")
        
        if not all_passed:
            print(f"\n⚠️  WARNING: Some tests failed for {env}")
            return 1
    
    print("\n✅ All validations passed!")
    return 0

if __name__ == "__main__":
    exit(asyncio.run(main()))
```

### Phase 7 Checklist

- [ ] Pre-deployment checks passed
- [ ] Database backed up
- [ ] Deployment to staging
- [ ] Staging validation
- [ ] Load testing on staging
- [ ] Deployment to production
- [ ] Production validation
- [ ] Monitoring verified
- [ ] Documentation updated
- [ ] Team notified

---

## Migration Scripts

### Database Migration

```sql
-- File: migrations/complete_refactoring.sql

BEGIN;

-- Step 1: Create new schema
CREATE SCHEMA IF NOT EXISTS paperless_v2;

-- Step 2: Create new tables in new schema
-- ... (tables from Phase 4)

-- Step 3: Migrate data with validation
INSERT INTO paperless_v2.files (...)
SELECT ... FROM public.entity_files
WHERE ... -- validation conditions

-- Step 4: Create views for backward compatibility
CREATE VIEW public.entity_files AS
SELECT 
    f.id,
    f.entity_type,
    f.entity_id,
    -- ... map columns
FROM paperless_v2.files f
JOIN paperless_v2.file_storage fs ON f.id = fs.file_id;

-- Step 5: Update sequences
SELECT setval('paperless_v2.files_id_seq', 
    (SELECT MAX(id) FROM paperless_v2.files));

COMMIT;
```

### Data Validation Script

```python
# File: scripts/validate_migration.py

def validate_migration(old_db, new_db):
    """Validate data migration integrity."""
    
    # Count comparisons
    old_count = old_db.query("SELECT COUNT(*) FROM entity_files").scalar()
    new_count = new_db.query("SELECT COUNT(*) FROM files").scalar()
    
    assert old_count == new_count, f"Count mismatch: {old_count} vs {new_count}"
    
    # Data integrity checks
    # ... implement specific validations
    
    print("✅ Migration validation passed")
```

---

## Risk Management

### Identified Risks

1. **Data Loss Risk**
   - **Mitigation**: Comprehensive backups, staged rollout
   - **Rollback**: Restore from backup

2. **Performance Degradation**
   - **Mitigation**: Load testing, gradual rollout
   - **Rollback**: Feature flags to disable new code

3. **Integration Failures**
   - **Mitigation**: Extensive testing, monitoring
   - **Rollback**: Revert to previous version

### Contingency Plans

```yaml
# File: contingency-plans.yaml

scenarios:
  database_migration_failure:
    detection: "Migration script fails or data validation fails"
    immediate_action: "Rollback transaction, restore from backup"
    communication: "Notify team via Slack"
    
  performance_issues:
    detection: "Response time > 2s or error rate > 5%"
    immediate_action: "Scale up instances, enable caching"
    escalation: "If not resolved in 30 min, rollback"
    
  paperless_integration_failure:
    detection: "Paperless connection errors > 10%"
    immediate_action: "Switch to local storage only"
    investigation: "Check Paperless logs, network"
```

---

## Progress Tracking

### Phase Tracking Dashboard

```markdown
# Refactoring Progress

## Phase Status
- [x] Phase 1: Initial Cleanup (Complete)
- [ ] Phase 2: Architecture Refactoring (In Progress - 60%)
- [ ] Phase 3: Service Layer Redesign
- [ ] Phase 4: Database Migration
- [ ] Phase 5: Frontend Modernization
- [ ] Phase 6: Testing Implementation
- [ ] Phase 7: Deployment

## Current Sprint (Week 2)
- [x] Remove debug logging
- [x] Implement structured logging
- [x] Create domain entities
- [ ] Create repository interfaces
- [ ] Implement application services

## Blockers
- None currently

## Next Steps
1. Complete repository implementations
2. Begin service layer refactoring
3. Setup integration test environment
```

### Success Metrics

```python
# File: metrics/refactoring_success.py

SUCCESS_CRITERIA = {
    "performance": {
        "api_response_time_p95": "< 500ms",
        "file_upload_time_avg": "< 2s",
        "database_query_time_p95": "< 100ms"
    },
    "reliability": {
        "error_rate": "< 0.1%",
        "uptime": "> 99.9%",
        "successful_sync_rate": "> 95%"
    },
    "code_quality": {
        "test_coverage": "> 80%",
        "cyclomatic_complexity": "< 10",
        "code_duplication": "< 5%"
    },
    "security": {
        "vulnerabilities": "0 critical, 0 high",
        "credential_exposure": "0 instances",
        "audit_compliance": "100%"
    }
}
```

---

## Conclusion

This comprehensive refactoring guide provides a clear path to modernize the paperless integration system. By following these phases sequentially, the team can:

1. **Immediately** address critical security and performance issues
2. **Systematically** improve architecture and code quality
3. **Maintain** functionality throughout the refactoring
4. **Enable** future scalability and maintainability

The refactoring will result in:
- **50% reduction** in code complexity
- **80% improvement** in test coverage
- **Zero** security vulnerabilities
- **Clean architecture** enabling microservice migration
- **Improved developer experience** with clear patterns

Begin with Phase 1 immediately to address critical issues, then proceed through subsequent phases based on team capacity and business priorities.