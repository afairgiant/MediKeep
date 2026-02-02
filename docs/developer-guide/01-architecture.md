# MediKeep Architecture Documentation

**Last Updated:** February 2, 2026

## System Architecture Overview

### Architecture Diagram
```
+-------------------+         +-------------------+         +-------------------+
|    React (Web)    |         |    FastAPI        |         |   PostgreSQL      |
|   Frontend Layer  | <-----> |  Backend Layer    | <-----> |   Database        |
|   (Mantine UI)    |         |  (Python)         |         |   Layer           |
+-------------------+         +-------------------+         +-------------------+
       |                             |                            |
       v                             v                            v
+-------------------+         +-------------------+         +-------------------+
| Browser/Client    |         | Application Core  |         | Data Storage       |
| Rendering         |         | Business Logic    |         | Persistence        |
+-------------------+         +-------------------+         +-------------------+
```

### Technology Stack
- **Frontend**: React 18.3, Mantine UI 8.x
- **Build Tool**: Vite 7.x (migrated from Create React App, October 2025)
- **Backend**: FastAPI 0.115, Python 3.12+
- **Database**: PostgreSQL 15+, SQLAlchemy 2.0
- **Authentication**: JWT-based SSO
- **Deployment**: Docker, Nginx
- **Testing**: Vitest (Frontend), Pytest (Backend)

### Build Tool Migration Notes
The project migrated from Create React App to Vite in October 2025 for significant performance improvements:
- Dev server startup: 15s to ~287ms (98% faster)
- Production builds: 90s to ~10s (88% faster)
- Hot reload: 3s to <100ms (97% faster)
- Build output directory: `frontend/build/`
- Environment variables now use `VITE_` prefix (not `REACT_APP_`)

### Communication Patterns
- RESTful API communication
- WebSocket for real-time updates (future)
- JWT token-based authentication
- HTTPS encryption for all communications

## Frontend Architecture

### Directory Structure
```
frontend/src/
├── components/
│   ├── layout/
│   ├── medical/
│   ├── ui/
│   └── shared/
├── contexts/
├── hooks/
├── pages/
├── services/
│   ├── api/
│   └── medical/
└── utils/
```

### Component Architecture
- **Atomic Design Principles**
  - Atomic: Basic UI components (Button, Input)
  - Molecules: Composed components
  - Organisms: Complex, connected components
  - Templates: Page-level layouts
  - Pages: Complete page implementations

### State Management
- **Context API** for global state
- **Custom Hooks** for localized state management
- Minimal global state to prevent complexity
- Performance-optimized with `useMemo` and `useCallback`

### Routing Strategy
- React Router for client-side routing
- Protected routes with authentication checks
- Lazy loading of route components

### API Communication
```javascript
// Example API Service Pattern
class PatientService extends BaseApiService {
  async getPatientDetails(patientId) {
    return this.get(`/patients/${patientId}`);
  }
}
```

### Custom Hooks Examples
```javascript
// Reusable form handling hook
function useFormHandlers(onInputChange) {
  const handleTextInputChange = useCallback((event) => {
    const { name, value } = event.target;
    onInputChange(name, value);
  }, [onInputChange]);

  return { handleTextInputChange };
}
```

## Backend Architecture

### Directory Structure
```
app/
├── api/
│   └── v1/
│       ├── endpoints/
│       └── admin/
├── core/
├── crud/
├── models/
├── schemas/
├── services/
└── utils/
```

### API Layer Organization
- Versioned API endpoints (`/api/v1/`)
- Separation of concerns
- Decorator-based authentication
- Comprehensive error handling

### Service Layer Pattern
```python
# Example Service Implementation
class PatientAccessService:
    def get_patient_details(self, patient_id: int, user: User):
        # Business logic for patient access
        if not self.has_access(user, patient_id):
            raise AccessDeniedException()
        return self.patient_repository.get(patient_id)
```

### Authentication Flow
1. User login via SSO/JWT
2. Token validation middleware
3. Role-based access control
4. Per-request permission checks

### Error Handling
- Custom exception classes
- Centralized error response format
- Logging of error contexts
- User-friendly error messages

## Database Architecture

### Design Principles
- Normalized relational schema
- Soft delete implementation
- Comprehensive indexing
- Audit trail for sensitive operations

### Key Entities
- Patient
- MedicalRecord
- FamilyHistory
- EmergencyContact
- Invitation

### Migration Strategy
- Alembic for database migrations
- Reversible migration scripts
- Version-controlled schema changes

## Security Architecture

### Authentication
- JWT with short-lived access tokens
- Refresh token mechanism
- SSO integration (Google, GitHub)
- Multi-factor authentication support

### Authorization
- Role-based access control (RBAC)
- Granular permissions
- Resource-level access checks

### Data Protection
- Encryption at rest and in transit
- Secure file upload handling
- Input validation and sanitization
- Protection against OWASP top 10 vulnerabilities

## Key Design Decisions

### Why React + FastAPI?
- React: Component-based, performant UI
- FastAPI: High-performance Python framework
- Strong typing with TypeScript/Pydantic
- Rapid development and scalability

### Deployment Considerations
- Containerized microservices
- Horizontal scalability
- CI/CD pipeline integration
- Environment-based configuration

## Performance Optimization

### Frontend
- Lazy loading of components
- Memoization of expensive computations
- Minimal re-renders
- Code splitting

### Backend
- Async database operations
- Caching strategies
- Efficient ORM queries
- Connection pooling

## Monitoring and Logging

- Structured logging
- Error tracking
- Performance metrics
- Audit trail for critical operations

## Future Roadmap
- Real-time updates with WebSockets
- Enhanced SSO integrations
- Machine learning insights
- Advanced reporting capabilities