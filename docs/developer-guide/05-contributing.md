# Development Guide

**Last Updated:** February 2, 2026

Personal development guide for MediKeep - a medical records management system built with FastAPI and React.

---

## 📋 Table of Contents

- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

> **💡 New to the project?** See the [Quick Start Guide](00-quickstart.md) for setup instructions.

---

## Development Workflow

### Branch Naming

```bash
feature/medication-reminders
fix/lab-result-display
hotfix/security-patch
docs/update-api-guide
```

### Commit Messages

```
feat(medications): add reminder system
fix(lab-results): correct date sorting
docs: update API reference
chore: update dependencies
```

**Format:** `<type>(<scope>): <description>`

**Types:** feat, fix, docs, style, refactor, perf, test, chore, build

---

## Code Style

### Python (Backend)

**Imports:**

```python
# Standard library
import os
from datetime import datetime

# Third-party
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

# Local
from app.models.models import User
from app.core.config import settings
```

**Naming:**

```python
# Variables: snake_case
user_id = 123
patient_name = "John"

# Constants: UPPER_SNAKE_CASE
MAX_FILE_SIZE = 15 * 1024 * 1024
ALLOWED_TYPES = ['image/jpeg', 'image/png']

# Functions: snake_case, verb-based
def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    pass

# Classes: PascalCase
class PatientService:
    pass
```

**Logging:**

```python
from app.core.logging_config import get_logger

logger = get_logger(__name__, "app")

# Good
logger.info("Patient created", extra={
    "user_id": user_id,
    "patient_id": patient.id,
    "component": "patient_management"
})

# ❌ NEVER log PHI (names, SSN, medical details)
logger.error(f"Failed for {patient.name}")  # BAD!
```

**Error Handling:**

```python
from app.core.error_handling import (
    NotFoundException,
    ValidationException,
    handle_database_errors
)

@router.post("/")
def create_medication(...):
    with handle_database_errors(request=request):
        if start_date > end_date:
            raise ValidationException(
                message="Start date cannot be after end date",
                request=request
            )
        return medication.create(db, obj_in=medication_in)
```

### JavaScript/React (Frontend)

**File Naming:**

```
PatientList.js          # Components: PascalCase
dateHelpers.js          # Utilities: camelCase
errorMessages.js        # Constants: camelCase
```

**Component Structure:**

```javascript
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Button, Card } from '@mantine/core';

import { medicationApi } from '../../services/api';
import logger from '../../services/logger';

function MedicationCard({ medication, onEdit }) {
  const [loading, setLoading] = useState(false);

  const handleEdit = async () => {
    setLoading(true);
    try {
      await onEdit(medication.id);
      logger.info('medication_edited', 'Medication edited', {
        medicationId: medication.id,
        component: 'MedicationCard',
      });
    } catch (error) {
      logger.error('medication_edit_failed', 'Edit failed', {
        error: error.message,
        component: 'MedicationCard',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Button onClick={handleEdit} loading={loading}>
        Edit
      </Button>
    </Card>
  );
}

MedicationCard.propTypes = {
  medication: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
  }).isRequired,
  onEdit: PropTypes.func.isRequired,
};

export default MedicationCard;
```

**❌ NEVER use console.log in production:**

```javascript
// ❌ BAD
console.log('User data:', userData);

// ✅ Good
import logger from '../services/logger';

logger.info('user_loaded', 'User data loaded', {
  userId: userData.id,
  component: 'UserProfile',
});
```

### Security Rules

**CRITICAL - NEVER:**

- ❌ Commit real patient data
- ❌ Log PHI (names, SSN, medical details)
- ❌ Use string concatenation for SQL queries
- ❌ Trust user input without validation
- ❌ Leave console.log or debug code in production

**ALWAYS:**

- ✅ Use parameterized queries (SQLAlchemy ORM)
- ✅ Validate all inputs on frontend AND backend
- ✅ Check file types strictly for uploads
- ✅ Include type hints in Python code
- ✅ Use proper error handling

---

## Testing

### Backend Tests

**Run tests:**

```bash
# All tests
pytest

# Specific file
pytest tests/api/test_medications.py

# With coverage
pytest --cov=app --cov-report=html

# Verbose
pytest -v
```

**Run the full suite in shards (faster):**

A serial `pytest` run of the whole backend suite takes 10 minutes or more. `scripts/run_backend_tests_sharded.py` splits the test files across several pytest processes that run at the same time (6 by default). That brings a full run down to a few minutes. Use it when you need the whole suite, for example before opening a PR. For a single file or directory, plain `pytest` is still quicker.

```bash
# Linux / macOS
python3 scripts/run_backend_tests_sharded.py

# Windows
.venv\Scripts\python.exe scripts\run_backend_tests_sharded.py

# Options
python3 scripts/run_backend_tests_sharded.py --shards 4             # Fewer processes
python3 scripts/run_backend_tests_sharded.py tests/api tests/crud   # Only some directories
python3 scripts/run_backend_tests_sharded.py -- -x -k medication    # Args after -- go to every pytest process
python3 scripts/run_backend_tests_sharded.py --keep                 # Keep the shard copies for debugging
```

How it works:

- Test files are assigned to shards by file size, so each shard gets about the same amount of work.
- Each shard runs in its own temporary copy of the working tree. `tests/conftest.py` uses `test_database.db` relative to the working directory and deletes it at startup, so shards sharing one directory would delete each other's database. The copy includes uncommitted changes and your `.env` file, but not gitignored files such as `node_modules` or `.venv`. The script needs `git` on your PATH.
- Each shard writes its output to a log file. At the end the script lists every failed and errored test and prints the log directory. The copies are deleted; the logs are kept.
- The exit code is 0 when every shard passed. Otherwise it is the highest pytest exit code from any shard: 1 means tests failed, and 2 to 4 mean a shard was interrupted or could not run (its log says why). The exit code is 5 only when no shard collected any tests, for example when `-k` matches nothing.

Limitations:

- The shards run with the Python interpreter that started the script, so start it with your virtualenv's Python.
- There is no combined coverage report. Use `pytest --cov=app` for coverage.
- `-x` and `--maxfail` stop only the shard that hit the failure.
- Files are grouped differently from a serial run. A test that passes only when another file runs before it in the same session can fail here. That test has a hidden dependency and should be fixed.

**Example test:**

```python
def test_create_medication(db: Session):
    user = create_test_user(db)
    patient = create_test_patient(db, user_id=user.id)
    token = get_auth_token(user)

    data = {
        "name": "Aspirin",
        "dosage": "100mg",
        "patient_id": patient.id
    }

    response = client.post(
        "/api/v1/medications/",
        json=data,
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Aspirin"
```

### Frontend Tests (Vitest)

**Run tests:**

```bash
cd frontend

# Watch mode (default)
npm test

# Single run
npm run test:run

# With coverage
npm run test:coverage

# Vitest UI (interactive browser interface)
npm run test:ui
```

**Example test:**

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import MedicationCard from '../MedicationCard';

test('calls onEdit when button clicked', () => {
  const handleEdit = vi.fn();
  const med = { id: 1, name: 'Aspirin' };

  render(<MedicationCard medication={med} onEdit={handleEdit} />);

  fireEvent.click(screen.getByText('Edit'));
  expect(handleEdit).toHaveBeenCalledWith(1);
});
```

### Before Committing

```bash
# Backend
pytest                  # All tests pass
black .                 # Code formatted
pylint app/            # No critical issues

# Frontend
npm run lint           # Linting passes
npm run build          # Build succeeds (Vite)
npm run test:run       # Tests pass (Vitest)
```

---

## Common Tasks

### Add API Endpoint

1. **Create endpoint:**

   ```python
   # app/api/v1/endpoints/reminders.py
   from fastapi import APIRouter, Depends

   router = APIRouter()

   @router.post("/")
   def create_reminder(
       reminder_in: ReminderCreate,
       db: Session = Depends(deps.get_db),
       current_user: User = Depends(deps.get_current_user)
   ):
       """Create medication reminder."""
       return reminder_service.create(db, reminder_in)
   ```

2. **Add to router:**

   ```python
   # app/api/v1/api.py
   from app.api.v1.endpoints import reminders

   api_router.include_router(
       reminders.router,
       prefix="/reminders",
       tags=["reminders"]
   )
   ```

3. **Create schema:**

   ```python
   # app/schemas/reminder.py
   from pydantic import BaseModel

   class ReminderCreate(BaseModel):
       medication_id: int
       time: str
   ```

   Response schemas must never reject a row already in the database, so when one shares
   fields with a validating `Base`, inherit from `read_model(Base)` rather than `Base`:

   ```python
   from app.schemas.read_model import read_model

   class ReminderResponse(read_model(ReminderBase)):
       id: int
       model_config = ConfigDict(from_attributes=True)
   ```

   `tests/unit/test_response_schema_leniency.py` fails if a route's response model carries a
   validator or constraint that can raise on stored data.

4. **Add tests:**
   ```python
   def test_create_reminder(client, auth_headers):
       response = client.post(
           "/api/v1/reminders/",
           json={"medication_id": 1, "time": "08:00"},
           headers=auth_headers
       )
       assert response.status_code == 201
   ```

### Add Database Model

1. **Add model:**

   ```python
   # app/models/models.py
   class Reminder(Base):
       __tablename__ = "reminders"

       id = Column(Integer, primary_key=True)
       medication_id = Column(Integer, ForeignKey("medications.id"))
       time = Column(Time)
       created_at = Column(DateTime, default=get_utc_now)
   ```

2. **Create migration:**

   ```bash
   alembic revision --autogenerate -m "Add reminder table"
   ```

3. **Review and apply:**
   ```bash
   cat alembic/versions/xxxxx_add_reminder_table.py
   alembic upgrade head
   ```

### Add Frontend Component

1. **Create component:**

   ```javascript
   // frontend/src/components/ReminderCard.js
   import React from 'react';
   import PropTypes from 'prop-types';
   import { Card, Text } from '@mantine/core';

   function ReminderCard({ reminder }) {
     return (
       <Card>
         <Text>{reminder.time}</Text>
       </Card>
     );
   }

   ReminderCard.propTypes = {
     reminder: PropTypes.shape({
       id: PropTypes.number.isRequired,
       time: PropTypes.string.isRequired,
     }).isRequired,
   };

   export default ReminderCard;
   ```

2. **Add tests:**
   ```javascript
   test('renders reminder time', () => {
     const reminder = { id: 1, time: '08:00 AM' };
     render(<ReminderCard reminder={reminder} />);
     expect(screen.getByText('08:00 AM')).toBeInTheDocument();
   });
   ```

### Record Forms and Validation

Every record Add/Edit dialog (Allergy, Injury, Medication, ...) uses one form for both Add and Edit. Build a new one the same way, and copy an existing form such as `InjuryFormWrapper.jsx`.

1. **Use `RecordForm` in place of `<form>`** (`frontend/src/components/shared/RecordForm.tsx`).
2. **Mark mandatory fields with the `required` prop.** That is the whole rule, for text inputs, dates and Selects, on any tab. On submit, `RecordForm` finds the first empty or invalid field, switches to its tab, focuses it, and says which field it is in a popup. The page's submit handler runs only when every field passes.
3. **Put `<FormErrorPopup error={formError} />` right after the `RecordForm` opening tag** (`frontend/src/components/shared/FormErrorPopup.tsx`). It pops up over the form with the message from `RecordForm`, the page's own form check, or the server, and the user dismisses it with OK. When it is about a field, the cursor goes to that field. Escape closes only the popup, not the form.
4. **Other rules go in the page's form check** (for example `validateInjuryForm` in `utils/injuryFormUtils.ts`): a range, or one field that depends on another. Return a translated message that names the field, never a hardcoded string: use the helpers in `utils/formCheckMessages.ts` (for example `requiredMessage('shared:labels.medicationName', 'Medication Name')`) or a `t()` call. Pass it to `setFormError` from `useMedicalData`, never to the page-level `setError`. A page alert sits behind the open dialog, where nobody sees it. If the form component runs a check of its own before calling the page, give its message to the popup too: `error={checkError || formError}` (see `VitalsForm.jsx`).
5. **The backend is the final check.** When a save fails, `useMedicalData` puts the server's message in `formError`, and the popup shows it.
6. **Clear `formError` when a save starts.** `useMedicalData`'s `createItem` and `updateItem` already do. A page that saves some other way calls `setFormError(null)` before saving, or an error from the last save pops up again.

Do not use a plain `<form>`, and do not add `noValidate` yourself. The browser's own check stops the submit without a word when a required field is on a tab that is not showing, and it never checks a non-searchable Mantine `Select`.

### Database Migrations

```bash
# Create migration
alembic revision --autogenerate -m "description"

# Review migration
cat alembic/versions/xxxxx_description.py

# Apply migration
alembic upgrade head

# Rollback
alembic downgrade -1

# Check version
alembic current
```

---

## Troubleshooting

### Backend Issues

**Server won't start:**

```bash
# Check logs
docker logs medical-records-app

# Test database connection
psql -h localhost -U medikeep -d medikeep_dev

# Check config
python -c "from app.core.config import settings; print(settings.DATABASE_URL)"
```

**Import errors:**

```bash
# Reinstall dependencies
pip install -r requirements.txt --force-reinstall

# Check Python version
python --version  # Should be 3.12+
```

### Frontend Issues

**Build fails:**

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for errors
npm run build
```

**Vite/React errors:**

```bash
# Clear Vite cache
rm -rf node_modules/.vite
npm run dev

# Full cache clear
rm -rf node_modules/.vite node_modules/.cache
npm run dev
```

### Test Issues

**Tests failing:**

```bash
# Run specific test with verbose output
pytest tests/api/test_medications.py::test_create -v

# Check test database setup
pytest --setup-show

# Clear pytest cache
pytest --cache-clear
```

### Database Issues

**Migration conflicts:**

```bash
# Check current version
alembic current

# Downgrade to specific version
alembic downgrade <revision>

# Drop and recreate (development only!)
alembic downgrade base
alembic upgrade head
```

**Connection issues:**

```bash
# Test PostgreSQL is running
docker ps | grep postgres

# Test connection
psql -h localhost -p 5432 -U medikeep -d medikeep_dev

# Check .env file has correct credentials
cat .env | grep DB_
```

---

## Version Management

**Semantic Versioning:** `MAJOR.MINOR.PATCH`

- `MAJOR`: Breaking changes
- `MINOR`: New features (backwards compatible)
- `PATCH`: Bug fixes

**Update version:**

```python
# app/core/config.py
VERSION = "1.4.0"
```

**Tag release:**

```bash
git tag -a v1.4.0 -m "Release 1.4.0"
git push origin v1.4.0
```

---

## Quick Reference

### File Structure

```
app/
├── api/v1/endpoints/    # API endpoints
├── core/               # Configuration, logging
├── models/             # Database models
├── schemas/            # Pydantic schemas
├── services/           # Business logic
└── utils/             # Helpers

frontend/src/
├── components/         # React components
├── services/          # API clients
├── hooks/             # Custom hooks
├── utils/             # Helpers
└── constants/         # Shared constants
```

### Environment Variables

```bash
# Backend (.env)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medikeep_dev
DB_USER=medikeep
DB_PASSWORD=your_password
SECRET_KEY=dev-secret-key-change-me-please-123456
DEBUG=true
ENABLE_API_DOCS=true

# Frontend (.env) - Vite uses VITE_ prefix
VITE_API_URL=/api/v1
VITE_NAME=MediKeep
VITE_DEBUG=true
```

### Useful Commands

```bash
# Docker
docker compose up                    # Start all services
docker compose down                  # Stop all services
docker compose logs -f app          # Follow app logs

# Backend
uvicorn app.main:app --reload       # Start dev server
alembic upgrade head                # Run migrations
pytest --cov=app                    # Run tests with coverage
black . && pylint app/              # Format and lint

# Frontend (Vite + Vitest)
npm run dev                         # Start Vite dev server (port 3000)
npm start                           # Alias for npm run dev
npm run build                       # Build for production
npm run preview                     # Preview production build
npm test                            # Run tests in watch mode
npm run test:run                    # Run tests once
npm run test:coverage               # Run tests with coverage
npm run test:ui                     # Vitest UI (interactive)
```

### Key Files

- **[README.md](../../README.md)** - Project overview
- **[Architecture Guide](01-architecture.md)** - System architecture
- **[Database Schema](03-database-schema.md)** - Database reference
- **[Deployment Guide](04-deployment.md)** - Production deployment

---

## Medical Data Safety

**Remember: This handles personal health information!**

- ❌ Never commit real patient data to Git
- ❌ Never log patient names, SSN, or medical details
- ❌ Never share database dumps with PHI
- ✅ Always use test/fake data for development
- ✅ Always sanitize logs (IDs only, no personal info)

---

**Happy coding! 🎉**
