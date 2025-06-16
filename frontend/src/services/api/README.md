#OUT OF DATE


# API Services Documentation

This directory contains the modular API services for the Medical Records application. The API has been refactored from a single monolithic service into focused, maintainable modules.

## Structure

```
src/services/api/
├── baseApi.js          # Base API service with common functionality
├── authApi.js          # Authentication-related API calls
├── patientApi.js       # Patient information API calls
├── labResultApi.js     # Lab results and file management API calls
├── medicationApi.js    # Medication management API calls
├── immunizationApi.js  # Immunization management API calls
├── index.js            # Main API service that combines all modules
├── services.js         # Export file for all services
└── README.md           # This documentation
```

## Base API Service (`baseApi.js`)

Contains common functionality used by all API modules:

- **Configuration**: API base URL and environment handling
- **Authentication**: Headers and token management
- **Error Handling**: Standardized error handling and auth redirects
- **HTTP Methods**: Reusable GET, POST, PUT, DELETE methods

### Key Features:
- Automatic authentication error handling (401 redirects to login)
- Standardized validation error parsing
- Common response handling patterns

## Individual API Modules

### Authentication API (`authApi.js`)
- `login(username, password)` - User authentication

### Patient API (`patientApi.js`)
- `getCurrentPatient()` - Get current user's patient information
- `createCurrentPatient(patientData)` - Create patient profile
- `updateCurrentPatient(patientData)` - Update patient information
- `getRecentActivity()` - Get recent activity (if implemented)

### Lab Result API (`labResultApi.js`)
- CRUD operations for lab results
- File upload/download functionality
- Patient-specific lab result queries

### Medication API (`medicationApi.js`)
- CRUD operations for medications
- Patient-specific medication queries

### Immunization API (`immunizationApi.js`)
- CRUD operations for immunizations
- Patient-specific immunization queries

## Usage

### Using the Combined API Service (Recommended)
```javascript
import { apiService } from '../services/api';

// All methods are available directly
const patient = await apiService.getCurrentPatient();
const immunizations = await apiService.getPatientImmunizations(patientId);
```

### Using Individual Modules (For New Code)
```javascript
import { PatientApiService, ImmunizationApiService } from '../services/api/services';

const patientApi = new PatientApiService();
const immunizationApi = new ImmunizationApiService();

const patient = await patientApi.getCurrentPatient();
const immunizations = await immunizationApi.getPatientImmunizations(patientId);
```

### Using Module-Specific Access
```javascript
import { apiService } from '../services/api';

// Access specific modules
const patient = await apiService.patient.getCurrentPatient();
const immunizations = await apiService.immunization.getPatientImmunizations(patientId);
```

## Backward Compatibility

The original `api.js` file is maintained for backward compatibility. All existing imports will continue to work:

```javascript
import { apiService } from '../services/api';
// All existing method calls work exactly the same
```

## Benefits of Modular Structure

1. **Separation of Concerns**: Each module handles a specific domain
2. **Maintainability**: Easier to find, update, and test specific functionality
3. **Reusability**: Modules can be used independently or combined
4. **Scalability**: Easy to add new API modules for new features
5. **Testing**: Individual modules can be unit tested in isolation
6. **Code Organization**: Logical grouping of related functionality

## Adding New API Modules

To add a new API module:

1. Create a new file (e.g., `conditionApi.js`)
2. Extend `BaseApiService`
3. Implement domain-specific methods
4. Add to `index.js` for combined access
5. Export from `services.js`
6. Add backward compatibility methods if needed

Example:
```javascript
// conditionApi.js
import BaseApiService from './baseApi';

class ConditionApiService extends BaseApiService {
  async getConditions() {
    return this.get('/api/v1/conditions', 'Failed to fetch conditions');
  }
}

export default ConditionApiService;
```

## Error Handling

All API modules inherit standardized error handling:

- **401 Unauthorized**: Automatic redirect to login page
- **Validation Errors**: Parsed and formatted for user display
- **Network Errors**: Graceful handling with user-friendly messages
- **Generic Errors**: Fallback error messages

## Authentication

Authentication is handled automatically by the base service:

- JWT tokens are automatically included in requests
- Token expiration is detected and handled
- Users are redirected to login when authentication fails
