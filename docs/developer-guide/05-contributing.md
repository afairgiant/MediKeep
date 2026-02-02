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
SECRET_KEY=dev-secret-key
DEBUG=True

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
