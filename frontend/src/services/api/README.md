# API Services Documentation

This directory contains the streamlined API services for the Medical Records application. The API has been optimized into a focused, maintainable structure with comprehensive medical record management capabilities.

## Structure

```
src/services/api/
├── baseApi.js          # Base API service with common functionality and request management
├── adminApi.js         # Admin-specific API calls and management functions
├── index.js            # Main comprehensive API service with all medical endpoints
└── README.md           # This documentation
```

## Base API Service (`baseApi.js`)

Contains common functionality and advanced request management features:

- **Configuration**: Environment-aware API base URL configuration
- **Authentication**: JWT token validation and automatic cleanup
- **Request Management**: Queue-based request handling with concurrency control
- **Error Handling**: Comprehensive error handling and logging
- **Performance**: Request batching and connection management

### Key Features:

- Automatic token validation and expiration checking
- Request queuing to prevent overwhelming the server
- Concurrent request limiting (max 3 simultaneous requests)
- Environment-specific URL handling for development and production
- Advanced error parsing and user-friendly error messages

## Main API Service (`index.js`)

The comprehensive API service that provides all medical record management functionality:

### Authentication & Security

- `login(username, password, signal)` - User authentication with OAuth2 flow
- `register(username, password, email, fullName, signal)` - User registration
- Automatic JWT token validation and expiration handling
- Secure request headers with Bearer token authentication

### Patient Management

- `getCurrentPatient(signal)` - Get current user's patient information
- `createCurrentPatient(patientData, signal)` - Create patient profile
- `updateCurrentPatient(patientData, signal)` - Update patient information
- `getRecentActivity(signal)` - Get recent patient activity

### Medical Records

#### Lab Results

- `getLabResults(signal)` - Get all lab results
- `getPatientLabResults(patientId, signal)` - Get lab results for specific patient
- `getLabResult(labResultId, signal)` - Get single lab result
- `createLabResult(labResultData, signal)` - Create new lab result
- `updateLabResult(labResultId, labResultData, signal)` - Update lab result
- `deleteLabResult(labResultId, signal)` - Delete lab result

#### Lab Result Files

- `getLabResultFiles(labResultId, signal)` - Get files for lab result
- `uploadLabResultFile(labResultId, file, description, signal)` - Upload file
- `downloadLabResultFile(fileId, signal)` - Download file as blob
- `deleteLabResultFile(fileId, signal)` - Delete file

#### Medications

- `getMedications(signal)` - Get all medications
- `getPatientMedications(patientId, signal)` - Get patient medications
- `createMedication(medicationData, signal)` - Create medication (with validation)
- `updateMedication(medicationId, medicationData, signal)` - Update medication
- `deleteMedication(medicationId, signal)` - Delete medication

#### Immunizations

- `getImmunizations(signal)` - Get all immunizations
- `getPatientImmunizations(patientId, signal)` - Get patient immunizations
- `createImmunization(immunizationData, signal)` - Create immunization
- `updateImmunization(immunizationId, immunizationData, signal)` - Update immunization
- `deleteImmunization(immunizationId, signal)` - Delete immunization

#### Allergies

- `getAllergies(signal)` - Get all allergies
- `getPatientAllergies(patientId, signal)` - Get patient allergies
- `getAllergy(allergyId, signal)` - Get single allergy
- `createAllergy(allergyData, signal)` - Create allergy
- `updateAllergy(allergyId, allergyData, signal)` - Update allergy
- `deleteAllergy(allergyId, signal)` - Delete allergy

#### Conditions

- `getConditions(signal)` - Get all conditions
- `getPatientConditions(patientId, signal)` - Get patient conditions
- `getCondition(conditionId, signal)` - Get single condition
- `createCondition(conditionData, signal)` - Create condition
- `updateCondition(conditionId, conditionData, signal)` - Update condition
- `deleteCondition(conditionId, signal)` - Delete condition

#### Treatments

- `getTreatments(signal)` - Get all treatments
- `getPatientTreatments(patientId, signal)` - Get patient treatments
- `getTreatment(treatmentId, signal)` - Get single treatment
- `createTreatment(treatmentData, signal)` - Create treatment
- `updateTreatment(treatmentId, treatmentData, signal)` - Update treatment
- `deleteTreatment(treatmentId, signal)` - Delete treatment

#### Procedures

- `getProcedures(signal)` - Get all procedures
- `getPatientProcedures(patientId, signal)` - Get patient procedures
- `getProcedure(procedureId, signal)` - Get single procedure
- `createProcedure(procedureData, signal)` - Create procedure
- `updateProcedure(procedureId, procedureData, signal)` - Update procedure
- `deleteProcedure(procedureId, signal)` - Delete procedure

#### Encounters

- `getEncounters(signal)` - Get all encounters
- `getPatientEncounters(patientId, signal)` - Get patient encounters
- `getEncounter(encounterId, signal)` - Get single encounter
- `createEncounter(encounterData, signal)` - Create encounter
- `updateEncounter(encounterId, encounterData, signal)` - Update encounter
- `deleteEncounter(encounterId, signal)` - Delete encounter

### Healthcare Providers

- `getPractitioners(signal)` - Get all practitioners
- `getPractitioner(practitionerId, signal)` - Get single practitioner
- `createPractitioner(practitionerData, signal)` - Create practitioner
- `updatePractitioner(practitionerId, practitionerData, signal)` - Update practitioner
- `deletePractitioner(practitionerId, signal)` - Delete practitioner

## Admin API Service (`adminApi.js`)

Specialized service for administrative functions, extending the base API service:

### Dashboard & Monitoring

- `getDashboardStats()` - Get system dashboard statistics
- `getRecentActivity(limit)` - Get recent system activity
- `getSystemHealth()` - Get system health status
- `getSystemMetrics()` - Get detailed system metrics
- `getStorageHealth()` - Get storage system health
- `getFrontendLogHealth()` - Get frontend logging health

### Data Management

- `getAvailableModels()` - Get list of available data models
- `getModelMetadata(modelName)` - Get metadata for specific model
- `getModelRecords(modelName, params)` - Get records with pagination and search
- `getModelRecord(modelName, recordId)` - Get single model record
- `createModelRecord(modelName, data)` - Create new record
- `updateModelRecord(modelName, recordId, data)` - Update record
- `deleteModelRecord(modelName, recordId)` - Delete record

### Bulk Operations

- `bulkDeleteRecords(modelName, recordIds)` - Delete multiple records
- `bulkUpdateRecords(modelName, recordIds, updateData)` - Update multiple records
- `globalSearch(query, models)` - Search across multiple models
- `exportModelData(modelName, format)` - Export data in various formats

### System Administration

- `getDetailedStats()` - Get comprehensive system statistics
- `getActivityLog(params)` - Get activity logs with filtering
- `testAdminAccess()` - Verify admin privileges

## Usage

### Main API Service (Recommended)

```javascript
import { apiService } from '../services/api';

// Authentication
const loginResult = await apiService.login(username, password);

// Patient management
const patient = await apiService.getCurrentPatient();
await apiService.updateCurrentPatient(patientData);

// Medical records
const medications = await apiService.getPatientMedications(patientId);
const labResults = await apiService.getLabResults();

// File handling
const file = document.querySelector('input[type="file"]').files[0];
await apiService.uploadLabResultFile(labResultId, file, 'Blood work results');
const blob = await apiService.downloadLabResultFile(fileId);

// With AbortController for request cancellation
const controller = new AbortController();
const data = await apiService.getMedications(controller.signal);
// controller.abort(); // Cancel request if needed
```

### Admin API Service

```javascript
import { adminApiService } from '../services/api/adminApi';

// Dashboard data
const stats = await adminApiService.getDashboardStats();
const health = await adminApiService.getSystemHealth();

// Data management
const models = await adminApiService.getAvailableModels();
const patients = await adminApiService.getModelRecords('Patient', {
  page: 1,
  per_page: 25,
  search: 'john',
});

// Bulk operations
await adminApiService.bulkDeleteRecords('Patient', [1, 2, 3]);
const searchResults = await adminApiService.globalSearch('diabetes');
```

### Legacy API Service (Backward Compatibility)

```javascript
import { apiService } from '../services/api.js';
// All existing method calls work exactly the same
const patient = await apiService.getCurrentPatient();
```

## Backward Compatibility

The legacy `api.js` file is maintained for complete backward compatibility. All existing imports will continue to work without changes:

```javascript
import { apiService } from '../services/api';
// All existing method calls work exactly the same
```

The legacy file simply re-exports the main API service from `./api/index.js`, ensuring no breaking changes for existing code.

## Benefits of Current Structure

1. **Comprehensive Coverage**: Single service covers all medical record endpoints
2. **Performance Optimized**: Request queuing and concurrency control prevent server overload
3. **Error Resilience**: Advanced error handling with automatic token cleanup
4. **Development Friendly**: Environment-aware configuration with fallback URLs
5. **Admin Separation**: Dedicated admin service for administrative functions
6. **File Handling**: Built-in support for file uploads/downloads with proper MIME types
7. **Request Cancellation**: AbortController support for all endpoints
8. **Logging Integration**: Comprehensive request/response logging for debugging
9. **Docker Compatible**: Multiple URL fallbacks for containerized environments
10. **Backward Compatible**: Zero breaking changes from previous API versions

## Adding New API Endpoints

To add new medical record endpoints to the main API service:

1. Add the new methods to the `ApiService` class in `index.js`
2. Follow the existing pattern for HTTP methods and error handling
3. Include AbortController signal support for cancellation
4. Add comprehensive JSDoc comments for the new methods

Example:

```javascript
// Vital Signs methods
getVitalSigns(signal) {
  return this.get('/vital-signs/', { signal });
}

getPatientVitalSigns(patientId, signal) {
  return this.get(`/vital-signs/?patient_id=${patientId}`, { signal });
}

createVitalSigns(vitalSignsData, signal) {
  return this.post('/vital-signs/', vitalSignsData, { signal });
}
```

For admin-specific functionality, extend the `AdminApiService` class in `adminApi.js`.

## Error Handling

The API services provide comprehensive error handling:

- **401 Unauthorized**: Automatic token cleanup and user notification
- **422 Validation Errors**: Detailed field-level error parsing and user-friendly messages
- **Network Errors**: Graceful handling with multiple URL fallbacks for Docker environments
- **Token Expiration**: Automatic detection and cleanup of expired JWT tokens
- **Request Timeouts**: Built-in timeout handling with user feedback
- **File Upload Errors**: Specific handling for file upload failures
- **Generic Errors**: Fallback error messages for unexpected scenarios

All errors are logged with context information for debugging.

## Authentication & Security

Authentication is handled automatically across all services:

- **JWT Token Management**: Automatic inclusion in request headers
- **Token Validation**: Real-time validation of token expiration
- **Automatic Cleanup**: Expired tokens are automatically removed from storage
- **Request Security**: All authenticated requests include proper Authorization headers
- **OAuth2 Flow**: Login follows FastAPI OAuth2PasswordRequestForm standard
- **Environment Security**: Different security configurations for development and production

The system automatically handles token expiration and prompts users to re-authenticate when necessary.

## Request Management Features

### Performance Optimization

- **Request Queuing**: Prevents overwhelming the server with concurrent requests
- **Concurrency Control**: Maximum 3 simultaneous requests to maintain performance
- **Intelligent Retries**: Multiple URL attempts for Docker compatibility
- **Response Caching**: Efficient handling of repeated requests

### Developer Experience

- **AbortController Support**: All methods support request cancellation
- **Comprehensive Logging**: Detailed request/response logging for debugging
- **Environment Awareness**: Automatic URL selection based on development/production
- **TypeScript Ready**: Well-structured for TypeScript integration
- **Error Context**: Rich error information with request details
