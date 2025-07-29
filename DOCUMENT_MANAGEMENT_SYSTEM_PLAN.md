# Current Work: Scalable Document Management System Implementation

## Project Overview
We are implementing a **DRY, maintainable, and scalable** document management system for the medical records application. Currently, only the LabResults page has document management features with **800+ lines of entity-specific code** that needs to be abstracted into reusable components.

## Current State Analysis

### ✅ Existing LabResults Implementation
**File:** `frontend/src/pages/medical/LabResults.js` (Lines 157-620)

**Current Architecture Issues:**
- **Non-DRY**: Hardcoded for lab-results only
- **Mixed concerns**: File management logic embedded in page component
- **Complex state**: 5 separate state variables for file management
- **Hardcoded endpoints**: `/lab-results/{id}/files`, `/lab-result-files/{id}/download`
- **No reusability**: Everything is LabResult-specific

**Current State Variables:**
```javascript
const [selectedFiles, setSelectedFiles] = useState([]);           // Current files for entity
const [fileUpload, setFileUpload] = useState({ file: null, description: '' }); // Upload form
const [pendingFiles, setPendingFiles] = useState([]);            // Files to upload on save
const [filesToDelete, setFilesToDelete] = useState([]);          // Files marked for deletion
const [filesCounts, setFilesCounts] = useState({});              // File counts for display
```

**Current API Pattern:**
```javascript
// Entity-specific methods (NOT DRY)
apiService.getLabResultFiles(labResultId)
apiService.deleteLabResultFile(fileId)
apiService.post(`/lab-results/${id}/files`, formData)  // Upload
apiService.get(`/lab-result-files/${fileId}/download`) // Download
```

**Current File Management Features:**
1. **File Count Display** - Badge showing "X attached" in cards
2. **Batch Upload** - Multiple files during create/edit operations
3. **File Deletion** - Mark for deletion, actual delete on save
4. **File Download** - Direct blob download with proper filename
5. **File Upload** - With optional description field
6. **Progress Tracking** - Loading states and error handling
7. **Performance Optimization** - Batched file count loading with abort controllers

### 🎯 Target Pages for Integration
1. **Insurance.js** - NO document management currently
2. **Visits.js** - NO document management currently  
3. **Procedures.js** - NO document management currently

## Detailed Implementation Plan

### Phase 1: Create DRY Foundation Components

#### 1.1 DocumentManager Component
**File:** `frontend/src/components/shared/DocumentManager.js`

**Purpose:** Central, reusable file management component that abstracts all file operations

**Props Interface:**
```javascript
interface DocumentManagerProps {
  entityType: 'lab-result' | 'insurance' | 'visit' | 'procedure';
  entityId: string | number;
  mode: 'view' | 'edit' | 'create';
  config?: EntityFileConfig;
  onFileCountChange?: (count: number) => void;
  onError?: (error: string) => void;
  className?: string;
}
```

**Key Features:**
- **Generic API calls** - Works with any entity type
- **Mode-based rendering** - Different UI for view/edit/create
- **Configuration-driven** - Entity-specific rules via config
- **Event callbacks** - Parent components can react to changes
- **Error boundary** - Comprehensive error handling

**State Management:**
```javascript
const useDocumentManager = (entityType, entityId, mode) => {
  const [files, setFiles] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [filesToDelete, setFilesToDelete] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [loading, setLoading] = useState(false);
  
  // Generic file operations
  const loadFiles = useCallback(async () => {
    const files = await apiService.getEntityFiles(entityType, entityId);
    setFiles(files);
    return files;
  }, [entityType, entityId]);
  
  const uploadFile = useCallback(async (file, description) => {
    return await apiService.uploadEntityFile(entityType, entityId, file, description);
  }, [entityType, entityId]);
  
  const deleteFile = useCallback(async (fileId) => {
    return await apiService.deleteEntityFile(fileId);
  }, []);
  
  const downloadFile = useCallback(async (fileId, fileName) => {
    return await apiService.downloadEntityFile(fileId, fileName);
  }, []);
  
  return {
    files,
    pendingFiles,
    filesToDelete,
    uploadProgress,
    loading,
    actions: {
      loadFiles,
      uploadFile,
      deleteFile,
      downloadFile,
      addPendingFile: (file, description) => setPendingFiles(prev => [...prev, {file, description, id: Date.now()}]),
      removePendingFile: (id) => setPendingFiles(prev => prev.filter(f => f.id !== id)),
      markForDeletion: (fileId) => setFilesToDelete(prev => [...prev, fileId]),
      unmarkForDeletion: (fileId) => setFilesToDelete(prev => prev.filter(id => id !== fileId))
    }
  };
};
```

#### 1.2 FileUploadZone Component
**File:** `frontend/src/components/shared/FileUploadZone.js`

**Purpose:** Drag-and-drop file upload interface with validation

**Props Interface:**
```javascript
interface FileUploadZoneProps {
  acceptedTypes: string[];
  maxSize: number;
  maxFiles?: number;
  multiple?: boolean;
  onUpload: (files: File[], descriptions?: string[]) => void;
  onValidationError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
}
```

**Features:**
- **Drag & drop support** - Visual feedback for drag states
- **File validation** - Type, size, and count limits
- **Progress indicators** - Upload progress with cancel support
- **Description input** - Optional description per file
- **Preview thumbnails** - For image files
- **Accessibility** - Keyboard navigation and screen reader support

#### 1.3 FileList Component  
**File:** `frontend/src/components/shared/FileList.js`

**Purpose:** Display files with metadata and action buttons

**Props Interface:**
```javascript
interface FileListProps {
  files: FileItem[];
  filesToDelete?: string[];
  showActions?: boolean;
  showDescriptions?: boolean;
  onDownload?: (fileId: string, fileName: string) => void;
  onDelete?: (fileId: string) => void;
  onPreview?: (file: FileItem) => void;
  onRestore?: (fileId: string) => void;
  className?: string;
}

interface FileItem {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  description?: string;
  uploaded_at: string;
  category?: string;
}
```

**Features:**
- **File metadata display** - Name, size, type, upload date
- **Action buttons** - Download, delete, preview, restore
- **Visual states** - Highlight files marked for deletion
- **Sorting options** - By name, date, size, type
- **Bulk operations** - Select multiple files for actions
- **File icons** - Type-specific icons and thumbnails

#### 1.4 FileCountBadge Component
**File:** `frontend/src/components/shared/FileCountBadge.js`

**Purpose:** Consistent file count display across all cards

**Props Interface:**
```javascript
interface FileCountBadgeProps {
  count: number;
  entityType: string;
  variant?: 'badge' | 'text' | 'icon';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  loading?: boolean;
}
```

### Phase 2: DRY API Layer Enhancement

#### 2.1 Generic File Management Methods
**File:** `frontend/src/services/api/fileManagement.js`

**New Generic Methods:**
```javascript
class FileManagementAPI {
  // Get files for any entity
  async getEntityFiles(entityType, entityId, signal) {
    const endpoint = this.getFileEndpoint(entityType, entityId);
    return await this.get(endpoint, { signal });
  }
  
  // Upload file to any entity
  async uploadEntityFile(entityType, entityId, file, description, signal) {
    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('description', description);
    
    const endpoint = this.getFileEndpoint(entityType, entityId);
    return await this.post(endpoint, formData, { 
      signal,
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
  
  // Delete file (generic - file ID is enough)
  async deleteEntityFile(fileId, signal) {
    return await this.delete(`/files/${fileId}`, { signal });
  }
  
  // Download file (generic - file ID is enough)
  async downloadEntityFile(fileId, fileName, signal) {
    const blob = await this.get(`/files/${fileId}/download`, {
      signal,
      responseType: 'blob'
    });
    
    // Handle blob download
    if (blob instanceof Blob) {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  }
  
  // Helper to map entity types to endpoints
  getFileEndpoint(entityType, entityId) {
    const endpointMap = {
      'lab-result': `/lab-results/${entityId}/files`,
      'insurance': `/insurances/${entityId}/files`,
      'visit': `/visits/${entityId}/files`,
      'procedure': `/procedures/${entityId}/files`
    };
    
    const endpoint = endpointMap[entityType];
    if (!endpoint) {
      throw new Error(`Unsupported entity type: ${entityType}`);
    }
    
    return endpoint;
  }
  
  // Batch operations for performance
  async getMultipleEntityFilesCounts(entityType, entityIds, signal) {
    return await this.post('/files/batch-counts', {
      entity_type: entityType,
      entity_ids: entityIds
    }, { signal });
  }
}
```

#### 2.2 Configuration System
**File:** `frontend/src/config/fileManagement.js`

**Entity-Specific Configuration:**
```javascript
export const FILE_MANAGEMENT_CONFIG = {
  'lab-result': {
    acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.gif', '.txt', '.csv', '.xml', '.json', '.doc', '.docx', '.xls', '.xlsx'],
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,
    categories: ['result', 'report', 'image', 'document'],
    displayName: 'Lab Result',
    allowedOperations: ['upload', 'download', 'delete', 'preview']
  },
  
  'insurance': {
    acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'],
    maxSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 5,
    categories: ['card', 'policy', 'claim', 'eob', 'correspondence'],
    displayName: 'Insurance',
    allowedOperations: ['upload', 'download', 'delete']
  },
  
  'visit': {
    acceptedTypes: ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.txt'],
    maxSize: 15 * 1024 * 1024, // 15MB
    maxFiles: 8,
    categories: ['summary', 'referral', 'prescription', 'test_order', 'correspondence'],
    displayName: 'Visit',
    allowedOperations: ['upload', 'download', 'delete', 'preview']
  },
  
  'procedure': {
    acceptedTypes: ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.dcm'],
    maxSize: 20 * 1024 * 1024, // 20MB
    maxFiles: 12,
    categories: ['consent', 'report', 'image', 'instructions', 'billing'],
    displayName: 'Procedure',
    allowedOperations: ['upload', 'download', 'delete', 'preview']
  }
};

export const getFileConfig = (entityType) => {
  const config = FILE_MANAGEMENT_CONFIG[entityType];
  if (!config) {
    throw new Error(`No file configuration found for entity type: ${entityType}`);
  }
  return config;
};
```

### Phase 3: Integration Implementation

#### 3.1 Integration Pattern
**Common Integration Steps for Each Page:**

1. **Import DocumentManager:**
```javascript
import DocumentManager from '../../components/shared/DocumentManager';
import FileCountBadge from '../../components/shared/FileCountBadge';
```

2. **Add File Count State:**
```javascript
const [filesCounts, setFilesCounts] = useState({});
```

3. **Update Cards to Show File Counts:**
```javascript
// Replace existing file count display with:
<FileCountBadge
  count={filesCounts[item.id] || 0}
  entityType="insurance" // or "visit", "procedure"
  size="sm"
  onClick={() => handleViewItem(item)}
/>
```

4. **Add DocumentManager to View Modal:**
```javascript
<DocumentManager
  entityType="insurance"
  entityId={viewingItem?.id}
  mode="view"
  onFileCountChange={(count) => setFilesCounts(prev => ({
    ...prev,
    [viewingItem.id]: count
  }))}
  onError={setError}
/>
```

5. **Add DocumentManager to Edit Modal:**
```javascript
<DocumentManager
  entityType="insurance"
  entityId={editingItem?.id}
  mode="edit"
  onFileCountChange={(count) => setFilesCounts(prev => ({
    ...prev,
    [editingItem.id]: count
  }))}
  onError={setError}
/>
```

#### 3.2 Insurance Page Integration
**File:** `frontend/src/pages/medical/Insurance.js`

**Integration Points:**
- **Card View:** Add file count badge next to company name
- **View Modal:** Add documents section with download/upload capabilities
- **Edit Form:** File management section in modal

**Specific Requirements:**
- Insurance card images (front/back)
- Policy documents
- Claims and EOBs
- Correspondence

#### 3.3 Visits Page Integration  
**File:** `frontend/src/pages/medical/Visits.js`

**Integration Points:**
- **Card View:** File count in visit summary
- **View Modal:** Visit documents section
- **Edit Form:** Attach visit-related documents

**Specific Requirements:**
- Visit summaries
- Referral letters
- Test orders
- Prescription images
- Doctor notes

#### 3.4 Procedures Page Integration
**File:** `frontend/src/pages/medical/Procedures.js`

**Integration Points:**
- **Card View:** Document count with procedure details
- **View Modal:** Procedure documentation section
- **Edit Form:** Pre/post procedure documents

**Specific Requirements:**
- Consent forms
- Procedure reports
- Before/after images
- Instructions
- Billing documents

### Phase 4: Advanced Features

#### 4.1 File Preview System
**Component:** `FilePreview.js`
- PDF viewer integration
- Image gallery with zoom
- Document thumbnail generation
- Print functionality

#### 4.2 File Organization
**Features:**
- Category-based filtering
- Date range filtering
- File type filtering
- Search by filename/description
- Bulk operations (delete, download as zip)

#### 4.3 Performance Optimizations
**Implementations:**
- Lazy loading of file lists
- Virtual scrolling for large file lists
- Image compression for uploads
- Background file count loading
- Caching strategies

## Technical Implementation Details

### Component Structure
```
src/components/shared/
├── DocumentManager/
│   ├── index.js (main component)
│   ├── DocumentManager.module.css
│   ├── FileUploadZone.js
│   ├── FileList.js
│   ├── FilePreview.js
│   └── hooks/
│       ├── useDocumentManager.js
│       ├── useFileUpload.js
│       └── useFileDownload.js
├── FileCountBadge/
│   ├── index.js
│   └── FileCountBadge.module.css
└── FilePreview/
    ├── index.js
    ├── PDFViewer.js
    ├── ImageViewer.js
    └── FilePreview.module.css
```

### API Endpoint Structure
```
Backend API Endpoints:
GET    /api/v1/{entity-type}/{id}/files          # Get entity files
POST   /api/v1/{entity-type}/{id}/files          # Upload file
DELETE /api/v1/files/{file-id}                   # Delete file
GET    /api/v1/files/{file-id}/download          # Download file
POST   /api/v1/files/batch-counts                # Batch file counts
```

### Error Handling Strategy
- **Component-level**: Each component handles its own errors
- **User feedback**: Toast notifications for success/error states
- **Logging**: Comprehensive error logging with context
- **Graceful degradation**: UI remains functional if file operations fail
- **Retry logic**: Automatic retry for failed operations

### Testing Strategy
- **Unit tests**: Individual component functionality
- **Integration tests**: Full file management workflows
- **Performance tests**: Large file handling and batch operations
- **Accessibility tests**: Keyboard navigation and screen reader support

## ⚠️ CRITICAL: Database Migration Analysis & Data Preservation

### Current Database Structure Analysis

**Existing File Management System:**
- **Table:** `lab_result_files`
- **Model:** `LabResultFile` in `app/models/models.py:356`
- **Schema:** `app/schemas/lab_result_file.py`
- **CRUD:** `app/crud/lab_result_file.py`
- **Service:** `app/services/file_management_service.py`

**Current Database Schema:**
```sql
CREATE TABLE lab_result_files (
    id INTEGER PRIMARY KEY,
    lab_result_id INTEGER REFERENCES lab_results(id),
    file_name VARCHAR NOT NULL,
    file_path VARCHAR NOT NULL,
    file_type VARCHAR NOT NULL,
    file_size INTEGER,
    description VARCHAR,
    uploaded_at DATETIME NOT NULL
);
```

**Current File Storage:**
- **Location:** `uploads/lab_result_files/`
- **Files Found:** 19 files in development environment (production may have hundreds/thousands)
- **Multi-User System:** Each user account may have one or multiple patients
- **Multi-Patient per User:** Each patient may have varying numbers of uploaded files
- **File Distribution:** Files distributed across User → Patient → LabResult → File hierarchy
- **Naming:** UUID-based filenames for security
- **Trash System:** `uploads/trash/` with date-based organization

### Data Migration Strategy (ZERO DATA LOSS)

#### Phase 1: Extend Database Schema
**New Generic File Table:**
```sql
CREATE TABLE entity_files (
    id INTEGER PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,      -- 'lab-result', 'insurance', 'visit', 'procedure'
    entity_id INTEGER NOT NULL,            -- Foreign key to entity
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INTEGER,
    description TEXT,
    category VARCHAR(100),                 -- 'result', 'report', 'card', etc.
    uploaded_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_entity_type_id (entity_type, entity_id),
    INDEX idx_category (category),
    INDEX idx_uploaded_at (uploaded_at)
);
```

#### Phase 2: Data Migration Script
**Migration Process:**
1. **Preserve Existing Data**: Keep `lab_result_files` table intact during migration
2. **Multi-User Analysis**: Scan all user accounts and their associated patients
3. **File Ownership Mapping**: Ensure files are correctly associated with users/patients
4. **Batch Migration**: Process files in batches to handle large volumes efficiently
5. **Per-User Verification**: Verify file access permissions during migration
6. **Cross-User Isolation**: Ensure no user can access another user's files
7. **File Path Updates**: Restructure file storage while maintaining security boundaries
8. **Comprehensive Integrity Check**: Verify all files accessible by correct users only
9. **Complete Backup**: Full system backup before any changes

**Migration Script:**
```python
# Phase 2 Migration Script (app/scripts/migrate_file_system.py)
def migrate_lab_result_files_to_generic():
    """Migrate existing lab_result_files to new entity_files system - handles multi-user/patient system"""
    
    # Step 1: Pre-migration analysis
    logger.info("=== PRE-MIGRATION ANALYSIS ===")
    total_users = db.query(User).count()
    total_patients = db.query(Patient).count()
    total_lab_results = db.query(LabResult).count()
    total_files = db.query(LabResultFile).count()
    
    logger.info(f"System Overview:")
    logger.info(f"  - Total Users: {total_users}")
    logger.info(f"  - Total Patients: {total_patients}")
    logger.info(f"  - Total Lab Results: {total_lab_results}")
    logger.info(f"  - Total Files to Migrate: {total_files}")
    
    # Step 2: Verify file ownership chain (User -> Patient -> LabResult -> File)
    orphaned_files = []
    user_file_counts = {}
    
    for user in db.query(User).all():
        user_patients = db.query(Patient).filter(Patient.user_id == user.id).all()
        user_file_count = 0
        patient_file_counts = {}
        
        logger.info(f"User {user.id} ({user.email}) has {len(user_patients)} patient(s)")
        
        for patient in user_patients:
            patient_lab_results = db.query(LabResult).filter(LabResult.patient_id == patient.id).all()
            patient_file_count = 0
            
            for lab_result in patient_lab_results:
                lab_result_files = db.query(LabResultFile).filter(LabResultFile.lab_result_id == lab_result.id).all()
                patient_file_count += len(lab_result_files)
                user_file_count += len(lab_result_files)
            
            patient_file_counts[patient.id] = patient_file_count
            logger.info(f"  - Patient {patient.id} ({patient.first_name} {patient.last_name}): {patient_file_count} files")
            
            # Check for orphaned files within this patient's files
            for lab_result in patient_lab_results:
                lab_result_files = db.query(LabResultFile).filter(LabResultFile.lab_result_id == lab_result.id).all()
                for file in lab_result_files:
                    if not os.path.exists(file.file_path):
                        orphaned_files.append({
                            'file_id': file.id,
                            'file_name': file.file_name,
                            'user_id': user.id,
                            'patient_id': patient.id,
                            'lab_result_id': lab_result.id,
                            'reason': 'file_not_found_on_disk'
                        })
        
        user_file_counts[user.id] = user_file_count
        logger.info(f"User {user.id} ({user.email}): {user_file_count} files")
    
    if orphaned_files:
        logger.warning(f"Found {len(orphaned_files)} orphaned/missing files")
        for orphan in orphaned_files:
            logger.warning(f"  - File ID {orphan['file_id']}: {orphan['file_name']} ({orphan['reason']})")
    
    # Step 3: Create new entity_files table
    create_entity_files_table()
    
    # Step 4: Migrate data in batches with user/patient verification
    batch_size = 100
    migrated_count = 0
    migration_errors = []
    
    try:
        # Process files by user for better organization and verification
        for user in db.query(User).all():
            logger.info(f"=== MIGRATING FILES FOR USER {user.id} ({user.email}) ===")
            user_migrated = 0
            
            # Get all files for this user through the ownership chain
            user_files_query = db.query(LabResultFile).join(
                LabResult, LabResultFile.lab_result_id == LabResult.id
            ).join(
                Patient, LabResult.patient_id == Patient.id
            ).filter(Patient.user_id == user.id)
            
            user_total_files = user_files_query.count()
            logger.info(f"User {user.id} has {user_total_files} files to migrate")
            
            # Process user's files in batches
            for offset in range(0, user_total_files, batch_size):
                user_files_batch = user_files_query.offset(offset).limit(batch_size).all()
                
                for lab_file in user_files_batch:
                    try:
                        # Verify file exists on disk before migrating
                        if not os.path.exists(lab_file.file_path):
                            migration_errors.append({
                                'file_id': lab_file.id,
                                'user_id': user.id,
                                'error': f'File not found: {lab_file.file_path}'
                            })
                            continue
                        
                        # Get the lab result to verify ownership chain
                        lab_result = db.query(LabResult).filter(LabResult.id == lab_file.lab_result_id).first()
                        patient = db.query(Patient).filter(Patient.id == lab_result.patient_id).first()
                        
                        # Double-check ownership
                        if patient.user_id != user.id:
                            migration_errors.append({
                                'file_id': lab_file.id,
                                'user_id': user.id,
                                'error': f'Ownership chain broken: file belongs to user {patient.user_id}, not {user.id}'
                            })
                            continue
                            
                        entity_file = EntityFile(
                            entity_type='lab-result',
                            entity_id=lab_file.lab_result_id,
                            file_name=lab_file.file_name,
                            file_path=lab_file.file_path,  # Keep existing path initially
                            file_type=lab_file.file_type,
                            file_size=lab_file.file_size,
                            description=lab_file.description,
                            category='result',  # Default category
                            uploaded_at=lab_file.uploaded_at,
                            # Add ownership tracking for verification
                            metadata={
                                'user_id': user.id,
                                'patient_id': patient.id,
                                'migrated_from': 'lab_result_files'
                            }
                        )
                        db.add(entity_file)
                        migrated_count += 1
                        user_migrated += 1
                        
                    except Exception as e:
                        migration_errors.append({
                            'file_id': lab_file.id,
                            'user_id': user.id,
                            'error': str(e)
                        })
                
                # Commit batch and report progress
                db.commit()
                logger.info(f"User {user.id} progress: {user_migrated}/{user_total_files} files")
            
            logger.info(f"User {user.id} migration completed: {user_migrated} files migrated")
        
        logger.info(f"=== MIGRATION SUMMARY ===")
        logger.info(f"Total files processed: {migrated_count}")
        logger.info(f"Migration errors: {len(migration_errors)}")
        
        if migration_errors:
            logger.error("Migration errors encountered:")
            for error in migration_errors:
                logger.error(f"  File {error['file_id']} (User {error['user_id']}): {error['error']}")
            
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        db.rollback()
        raise
    
    # Step 5: Comprehensive verification with user/patient isolation
    verify_migration_integrity_multi_user(total_files, migrated_count, user_file_counts)
    
    logger.info(f"Multi-user migration completed: {migrated_count} files successfully migrated")
    return migrated_count, migration_errors

def verify_migration_integrity_multi_user(original_total, migrated_count, user_file_counts):
    """Verify migration maintained proper user/patient isolation"""
    
    logger.info("=== VERIFYING MULTI-USER MIGRATION INTEGRITY ===")
    
    # Verify total counts match
    new_total = db.query(EntityFile).filter(EntityFile.entity_type == 'lab-result').count()
    logger.info(f"Original files: {original_total}, Migrated: {migrated_count}, New table: {new_total}")
    
    # Verify per-user file counts
    for user_id, expected_count in user_file_counts.items():
        # Count files for this user in new system
        actual_count = db.query(EntityFile).filter(
            EntityFile.entity_type == 'lab-result',
            EntityFile.metadata['user_id'].astext == str(user_id)
        ).count()
        
        if actual_count != expected_count:
            logger.error(f"User {user_id}: Expected {expected_count} files, found {actual_count}")
        else:
            logger.info(f"User {user_id}: ✓ {actual_count} files verified")
    
    # Verify no cross-user file access
    logger.info("Verifying user isolation...")
    users = db.query(User).all()
    for user in users:
        user_files = db.query(EntityFile).filter(
            EntityFile.metadata['user_id'].astext == str(user.id)
        ).all()
        
        for file in user_files:
            # Verify file is only accessible through this user's patients
            lab_result = db.query(LabResult).filter(LabResult.id == file.entity_id).first()
            patient = db.query(Patient).filter(Patient.id == lab_result.patient_id).first()
            
            if patient.user_id != user.id:
                logger.error(f"SECURITY VIOLATION: File {file.id} accessible by wrong user!")
                raise Exception("Migration compromised user isolation!")
    
    logger.info("✓ User isolation verified - no cross-user file access detected")
    logger.info("✓ Migration integrity verification completed successfully")
```

#### Phase 3: File Storage Restructuring
**Current Structure:**
```
uploads/
└── lab_result_files/
    ├── uuid-file1.pdf
    ├── uuid-file2.png
    └── ...
```

**New Scalable Structure:**
```
uploads/
├── files/
│   ├── lab-results/
│   │   ├── uuid-file1.pdf  (moved from lab_result_files/)
│   │   └── uuid-file2.png
│   ├── insurance/
│   ├── visits/
│   └── procedures/
└── trash/  (existing trash system preserved)
```

**File Migration:**
```python
def migrate_file_storage():
    """Move files to new directory structure - handles large volumes efficiently"""
    old_path = "uploads/lab_result_files/"
    new_path = "uploads/files/lab-results/"
    
    # Create new directory structure
    os.makedirs(new_path, exist_ok=True)
    
    # Get all files to migrate
    files_to_migrate = []
    for file in os.listdir(old_path):
        if os.path.isfile(os.path.join(old_path, file)):
            files_to_migrate.append(file)
    
    total_files = len(files_to_migrate)
    logger.info(f"Starting file migration: {total_files} files to move")
    
    # Move files with progress tracking
    moved_count = 0
    failed_moves = []
    
    for i, file in enumerate(files_to_migrate):
        try:
            old_file_path = os.path.join(old_path, file)
            new_file_path = os.path.join(new_path, file)
            
            # Verify source file exists and is readable
            if not os.path.exists(old_file_path):
                logger.warning(f"Source file not found: {old_file_path}")
                continue
                
            # Move file (preserves timestamps and metadata)
            shutil.move(old_file_path, new_file_path)
            moved_count += 1
            
            # Progress reporting every 100 files
            if (i + 1) % 100 == 0:
                logger.info(f"File migration progress: {moved_count}/{total_files} ({(moved_count/total_files)*100:.1f}%)")
                
        except Exception as e:
            logger.error(f"Failed to move file {file}: {e}")
            failed_moves.append(file)
    
    # Update database paths in batches
    update_file_paths_in_database(old_path, new_path)
    
    # Report results
    logger.info(f"File migration completed: {moved_count} files moved, {len(failed_moves)} failed")
    if failed_moves:
        logger.error(f"Failed file moves: {failed_moves}")
        
    return moved_count, failed_moves
```

### Migration Implementation Plan

#### Week 1: Infrastructure & Migration
1. **Create generic file models and schemas**
2. **Build migration scripts with extensive testing**
3. **Create comprehensive backup system**
4. **Implement new generic API methods**

#### Week 2: Safe Migration Execution
1. **Full system backup (database + files)**
2. **Execute database migration**
3. **Execute file system migration**
4. **Comprehensive integrity verification**
5. **Test existing LabResults functionality**

#### Week 3: Component Implementation
1. **Build reusable components**
2. **Update LabResults to use new system (backward compatible)**
3. **Extensive testing to ensure no functionality lost**

#### Week 4: New Entity Integration
1. **Add document management to Insurance page**
2. **Add document management to Visits page**
3. **Add document management to Procedures page**

### Data Integrity Verification

**Pre-Migration Checklist:**
- [ ] Full database backup created
- [ ] Complete file system backup (all user/patient files across entire system)
- [ ] Migration scripts tested on copy of production data with realistic volumes
- [ ] Performance testing completed for large-scale migration
- [ ] Rollback plan prepared and tested
- [ ] Downtime maintenance window scheduled
- [ ] All users notified of maintenance window

**Post-Migration Verification:**
- [ ] **ALL user files** accessible through new system (across all users/patients)
- [ ] All metadata preserved (names, descriptions, upload dates) for every file
- [ ] Original file paths working through compatibility layer
- [ ] LabResults page functionality unchanged **for all users**
- [ ] Performance equivalent or improved under realistic load
- [ ] **Per-user verification**: Random sampling across different user accounts
- [ ] **Per-patient verification**: Files correctly associated with proper patients
- [ ] **Cross-user isolation**: Users can only access their own files

**Rollback Plan:**
- Keep original `lab_result_files` table until confirmed working
- Preserve original file paths through compatibility layer
- Ability to revert to old system if issues found
- Database transaction-based migration for atomic rollback

### File System Compatibility

**Dual System Support (During Transition):**
```python
# Support both old and new file systems during migration
class FileService:
    def get_file_path(self, entity_type, file_id):
        # Try new system first
        file_record = db.query(EntityFile).filter_by(id=file_id).first()
        if file_record:
            return file_record.file_path
            
        # Fallback to old system for lab results
        if entity_type == 'lab-result':
            old_file = db.query(LabResultFile).filter_by(id=file_id).first()
            if old_file:
                return old_file.file_path
                
        raise FileNotFoundError(f"File {file_id} not found")
```

This migration strategy ensures **ZERO DATA LOSS** while enabling the new scalable system.

### **Example Migration Output (Multi-Patient per User System):**
```
=== PRE-MIGRATION ANALYSIS ===
System Overview:
  - Total Users: 25
  - Total Patients: 73  (multiple patients per user account)
  - Total Lab Results: 1,247
  - Total Files to Migrate: 3,891

User 1 (parent@family.com) has 3 patient(s)
  - Patient 15 (John Smith): 45 files
  - Patient 16 (Jane Smith): 32 files  
  - Patient 17 (Baby Smith): 12 files
User 1 (parent@family.com): 89 files total

User 2 (doctor@clinic.com) has 1 patient(s)
  - Patient 8 (Self): 127 files
User 2 (doctor@clinic.com): 127 files total

User 3 (caregiver@home.com) has 2 patient(s)
  - Patient 22 (Mom): 156 files
  - Patient 23 (Dad): 78 files
User 3 (caregiver@home.com): 234 files total

=== MIGRATING FILES FOR USER 1 (parent@family.com) ===
User 1 has 89 files to migrate
User 1 progress: 89/89 files
User 1 migration completed: 89 files migrated

=== MIGRATING FILES FOR USER 2 (doctor@clinic.com) ===
User 2 has 127 files to migrate
User 2 progress: 127/127 files
User 2 migration completed: 127 files migrated

=== MIGRATION SUMMARY ===
Total files processed: 3,891
Migration errors: 0

=== VERIFYING MULTI-USER MIGRATION INTEGRITY ===
User 1: ✓ 89 files verified (across 3 patients)
User 2: ✓ 127 files verified (1 patient)
User 3: ✓ 234 files verified (across 2 patients)
✓ User isolation verified - no cross-user file access detected
✓ Patient isolation verified - files correctly associated with patients
```

**Key Multi-Patient Handling Features:**
- **Per-Patient File Counts**: Shows exactly how many files each patient has
- **Cross-Patient Verification**: Ensures files stay with the correct patient  
- **Family Account Support**: Parent managing multiple children's records
- **Caregiver Support**: Managing multiple family member records
- **Self-Care Support**: Users managing only their own records
- **Batch Processing**: Efficiently handles users with many patients
- **Granular Logging**: Detailed tracking per user and per patient

## Success Metrics
- **Code Reduction**: Remove ~800 lines of duplicate code per page
- **Consistency**: Same file management UX across all pages
- **Maintainability**: Single source of truth for file operations
- **Performance**: Sub-second file count loading for all entities
- **Extensibility**: Easy to add document management to new entity types

---
*Last Updated: 2025-07-29*
*Focus: Comprehensive, DRY, and maintainable document management system*