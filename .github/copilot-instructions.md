# MediKeep Copilot Instructions

## Overview
- **Purpose**: Guide AI coding agents to be productive in the MediKeep codebase.
- **Stack**: FastAPI (Python 3.12+), SQLAlchemy, Alembic, PostgreSQL (or SQLite in Windows EXE), React 18 with Vite, Mantine UI.
- **Entry points**:
  - Backend server: `run.py` (development with hot‑reload, production Windows EXE mode).
  - Frontend dev server: `npm run dev` (Vite) – see `frontend/package.json`.

## Core Architecture
- **Backend** (`app/`):
  - `app/main.py` creates the FastAPI app, registers middleware, error handling, static files, and includes the router from `app/api/v1/api.py`.
  - **Routers** are grouped by domain (e.g., `patients`, `lab_result`, `notifications`). Each router lives in `app/api/v1/endpoints/`.
  - **Database**: `app/core/database/database.py` builds an engine based on `Settings.DATABASE_URL` (PostgreSQL) or a SQLite path for Windows EXE. Connection health checks and SQLite pragmas are defined here.
  - **Startup** (`app/core/startup.py`): validates DB, runs migrations, creates a default admin user, initializes activity tracking and notification subscriptions.
  - **Config** (`app/core/config.py`): central `Settings` class reads env vars, provides paths for uploads, logs, backups, and SSO configuration.
- **Frontend** (`frontend/`):
  - Entry point `src/main.jsx` mounts the React app.
  - API client wrappers live in `src/services/api/`.
  - UI components use Mantine; styling conventions are in `src/styles/`.
  - Tests are under `src/__tests__/` using Vitest.

## Common Development Workflows
1. **Backend**
   - Run locally: `python run.py` (auto‑reload enabled).
   - Run tests: `pytest` (see `tests/`).
   - Apply migrations: `alembic upgrade head` (or `scripts/populate_test_data.py` for seed data).
   - Lint/format: `ruff .` (project uses `ruff` for linting).
2. **Frontend**
   - Install deps: `npm ci`.
   - Start dev server: `npm run dev` (Vite hot‑module replacement).
   - Run tests: `npm test` (Vitest).
   - Build for prod: `npm run build`.
3. **Docker**
   - Bring up all services: `docker-compose up -d` (includes Postgres, Nginx, etc.).
   - Run backend inside container: `docker compose exec backend python run.py`.
   - Use `docker compose exec backend pytest` for container‑based testing.

## Project‑Specific Conventions
- **Environment variables** are defined in `.env` and accessed via `Settings`. Important vars: `DATABASE_URL`, `LOG_LEVEL`, `SSO_ENABLED`, `UPLOAD_DIR`.
- **File paths**: Use `settings.UPLOAD_DIR`, `settings.LOG_DIR`, `settings.BACKUP_DIR` – never hard‑code absolute paths.
- **Logging**: All modules obtain a logger via `get_logger(__name__, "app")`. Structured logs include `category` and `event` fields.
- **Error handling**: Centralized in `app/core/http/error_handling.py`; API endpoints should raise `HTTPException` with appropriate status codes.
- **Activity tracking**: Manual logging via `app.api.activity_logging` – automatic tracking is disabled to avoid duplicate entries.
- **SSO**: Configured via `settings` (client ID/secret, issuer URL). Provider types supported: `google`, `github`, `oidc`, `authentik`, `authelia`, `keycloak`.
- **Testing**: Backend tests use fixtures from `tests/fixtures/`. Frontend tests use React Testing Library; avoid `console.log` in production code.
- **Database migrations**: Alembic scripts live in `alembic/versions/`. Run `alembic upgrade head` after schema changes.
- **Static files**: Served from `frontend/public/` and mounted via `app.core.http.static_files.setup_static_files`.

## Integration Points
- **Paperless‑ngx**: Configured in `settings` (`PAPERLESS_*`). API client in `app/api/v1/endpoints/paperless.py`.
- **Notifications**: Event system (`app.core.events`) publishes events; `app.services.notification_handlers` subscribes and forwards to user channels.
- **SSO**: Routes under `/auth/sso` in `app/api/v1/endpoints/sso.py`.
- **External services** (e.g., email, SMS) are accessed via `app.services.*` modules – follow the same pattern for new integrations.

## Quick Reference for AI Agents
- **Add a new endpoint**: create a router in `app/api/v1/endpoints/`, register in `app/api/v1/api.py`, add Pydantic schemas in `app/schemas/`, and write CRUD in `app/crud/`.
- **Add a new DB model**: define in `app/models/models.py`, run `alembic revision --autogenerate -m "add <model>"`, then `alembic upgrade head`.
- **Add a frontend feature**: create React component under `src/components/`, use Mantine UI, add API calls via `src/services/api/`, write Vitest in `src/__tests__/`.
- **Run CI locally**: `./run-tests.sh` executes both backend (`pytest`) and frontend (`npm test`).

---
*These instructions are kept concise for AI agents; refer to the full developer guide in `docs/developer-guide/` for deeper details.*