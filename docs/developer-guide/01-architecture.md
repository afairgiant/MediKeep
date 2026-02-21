# MediKeep Architecture Documentation

**Last Updated:** February 20, 2026

## System Architecture Overview

### Architecture Diagram
```
+-----------------------+
|    Reverse Proxy      | (Optional: Nginx, Caddy, Traefik)
|    SSL/TLS Term       |
+-----------+-----------+
            |
+-----------v-----------+
|    MediKeep App       | Port 8000
|  React SPA + FastAPI  |
+-----------+-----------+
            |
+-----------v-----------+
|    PostgreSQL 15      | Port 5432
+-----------------------+
```

### Technology Stack
- **Frontend**: React 18, Mantine UI 8.x, Vite 7.x
- **Backend**: FastAPI, Python 3.12+
- **Database**: PostgreSQL 15+, SQLAlchemy 2.0, Alembic migrations
- **Authentication**: JWT access tokens, SSO (Google, GitHub, Microsoft/Azure AD)
- **Localization**: i18next (6 languages: en, fr, de, es, it, pt)
- **Deployment**: Docker (single container, frontend + backend)
- **Testing**: Vitest (frontend), Pytest (backend)

## Frontend Architecture

### Directory Structure
```
frontend/src/
├── components/
│   ├── adapters/       # Responsive wrappers for Mantine components
│   ├── admin/          # Admin panel
│   ├── auth/           # Login, ProtectedRoute
│   ├── medical/        # 14 medical data categories
│   ├── navigation/     # Desktop/Tablet/Mobile responsive nav
│   ├── reports/        # Custom report builder
│   ├── settings/       # User/notification/Paperless settings
│   └── shared/         # Reusable components (DocumentManager, etc.)
├── constants/          # Shared constants
├── contexts/           # React contexts (Auth, App, Theme, Preferences)
├── hooks/              # Custom hooks (~30)
├── i18n/               # i18next config and namespaces
├── pages/              # Route page components
├── services/
│   ├── api/            # API service classes (extend BaseApiService)
│   ├── auth/           # Auth service
│   └── medical/        # Medical data services
├── types/              # TypeScript type definitions
└── utils/              # Helper functions
```

### Key Patterns

**API Services** -- All API communication goes through service classes extending `BaseApiService`:

```javascript
// frontend/src/services/api/patientApi.jsx
class PatientApiService extends BaseApiService {
  async getPatients() {
    return this.get('/patients/');
  }
}
```

**State Management** -- Context API for global state (auth, theme, preferences), custom hooks for component-level state. No external state library.

**Responsive Navigation** -- Auto-switching Desktop/Tablet/Mobile navigation components based on breakpoints via `ResponsiveProvider`.

**Routing** -- React Router with protected routes. Authentication checked via `ProtectedRoute` wrapper.

## Backend Architecture

### Directory Structure
```
app/
├── api/v1/
│   ├── endpoints/      # 42 endpoint modules
│   └── admin/          # Admin-only endpoints
├── auth/sso/           # SSO providers (Google, GitHub, Microsoft)
├── core/
│   ├── database/       # Connection, migrations, utils
│   ├── events/         # Domain event bus
│   ├── http/           # Error handling, middleware, response models
│   ├── logging/        # Structured logging (config, constants, helpers)
│   └── uploads/        # Upload handling
├── crud/               # 33 CRUD modules (one per model)
├── events/             # Domain events (backup, collaboration, security)
├── models/             # 14 SQLAlchemy model modules
├── schemas/            # Pydantic v2 request/response schemas
├── scripts/            # CLI tools (backup, restore, emergency admin)
├── services/           # 31 service modules (business logic)
└── utils/              # Helper functions
```

### Request Flow

```
HTTP Request
  -> FastAPI Router (app/api/v1/endpoints/)
    -> Authentication (Depends(get_current_user))
    -> Patient access check (PatientAccessService)
    -> CRUD operation (app/crud/)
    -> Domain events emitted (app/core/events/bus.py)
    -> Pydantic response schema
  -> HTTP Response
```

### Authentication
- JWT access tokens (configurable expiration, default 8 hours)
- SSO via Google, GitHub, Microsoft/Azure AD, or generic OIDC
- Dependency injection for auth: `current_user: User = Depends(get_current_user)`
- Patient ownership verified on every data access

### Domain Event System
Cross-cutting concerns (audit logging, notifications, collaboration) are handled through a domain event bus (`app/core/events/`). Event definitions live in `app/events/`.

### Error Handling
- Custom exception classes (`app/exceptions/`)
- Centralized error response format (`app/core/http/`)
- Structured logging with `LogFields` constants
- User-friendly messages returned to frontend

## Database Architecture

### Design Principles
- Normalized relational schema
- Soft deletes with `deleted_at` where appropriate
- All tables include `id`, `created_at`, `updated_at`
- Indexes on foreign keys and frequently queried fields
- Alembic migrations (reversible with `upgrade()` and `downgrade()`)

### Model Organization

Models are split across 14 modules in `app/models/`:

| Module | Tables |
|---|---|
| `user.py` | users, user_preferences, user_tags, system_settings |
| `patient.py` | patients, patient_photos, emergency_contacts, insurances |
| `clinical.py` | medications, encounters, conditions, immunizations, allergies, vitals, symptoms, symptom_occurrences |
| `labs.py` | lab_results, lab_result_files, lab_test_components, standardized_tests |
| `procedures.py` | procedures, treatments, medical_equipment |
| `injuries.py` | injury_types, injuries |
| `family.py` | family_members, family_conditions |
| `sharing.py` | patient_shares, invitations, family_history_shares |
| `files.py` | entity_files, backup_records |
| `reporting.py` | report_templates, report_generation_audit |
| `notifications.py` | notification_channels, notification_preferences, notification_history |
| `practice.py` | practices, practitioners, pharmacies |
| `associations.py` | treatment_encounters, treatment_lab_results, treatment_equipment |
| `activity_log.py` | activity_logs |

## Security

### Authentication & Authorization
- JWT tokens for session auth (no refresh tokens)
- SSO via Google, GitHub, Microsoft, or generic OIDC providers
- Role-based access control (admin vs regular user)
- Patient ownership/sharing verified on every data access

### Data Protection
- Input validation on both frontend (form validation) and backend (Pydantic schemas)
- Parameterized queries only (SQLAlchemy ORM)
- File upload validation (type, size, content)
- Structured logging that never includes PHI

## Deployment

- Single Docker container (React SPA served by FastAPI)
- PostgreSQL in separate container or external
- Environment-based configuration (`.env` file)
- Optional reverse proxy for SSL termination (Nginx, Caddy, Traefik)
- Migrations run automatically on container startup via entrypoint

See [Deployment Guide](04-deployment.md) for full details.

## Logging

- Structured JSON logging (app.log, security.log)
- Automatic log rotation (logrotate in Docker, Python fallback)
- Audit trail for critical operations (login, data access, sharing)
- Logging helpers in `app/core/logging/helpers.py`
