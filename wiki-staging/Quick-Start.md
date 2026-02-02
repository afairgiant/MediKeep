# Developer Quick Start Guide

**Last Updated:** October 5, 2025

Get MediKeep up and running on your local machine in under 10 minutes for active development.

---

## 🎯 What You'll Build

By the end of this guide, you'll have:
- ✅ Complete MediKeep development environment
- ✅ Frontend and backend running locally with hot reload
- ✅ PostgreSQL database with test data
- ✅ API documentation at your fingertips
- ✅ Ready to start contributing

---

## ⚡ Quick Setup (10 Minutes)

### Prerequisites

Ensure you have installed:
- **Python 3.12+** - [Download](https://www.python.org/downloads/)
- **Node.js 18+** - [Download](https://nodejs.org/)
- **PostgreSQL 15+** OR **Docker** - [PostgreSQL Download](https://www.postgresql.org/download/) | [Docker Download](https://docs.docker.com/get-docker/)
- **Git** - [Download](https://git-scm.com/downloads)

**Verify installations:**
```bash
python --version  # Should be 3.11+
node --version    # Should be 18+
git --version     # Any recent version
```

**Choose Your Setup:**
- **Option 1 (Recommended):** Development Setup - Run code locally with hot reload
- **Option 2 (Optional):** Docker Testing - Test production build locally

---

## 🛠️ Option 1: Development Setup (Recommended)

**Run backend and frontend locally with hot reload for active development.**

This is the recommended setup for contributing to MediKeep. You'll run the code directly from your local clone, allowing you to make changes and see them immediately.

### Step 1: Clone Repository

```bash
git clone https://github.com/afairgiant/MediKeep.git
cd MediKeep
```

### Step 2: Set Up Backend

#### 2.1 Create Virtual Environment

```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# Linux/Mac
python3 -m venv .venv
source .venv/bin/activate
```

#### 2.2 Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

#### 2.3 Configure Environment

```bash
# Create .env file in root directory
cat > .env << EOF
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medikeep_dev
DB_USER=medikeep
DB_PASSWORD=dev_password

# Security
SECRET_KEY=dev-secret-key-change-in-production
DEBUG=True

# Application
APP_NAME=MediKeep
LOG_LEVEL=DEBUG
EOF
```

#### 2.4 Set Up Database

**Option A: Docker (Easiest)**
```bash
docker run -d \
  --name medikeep-postgres \
  -e POSTGRES_DB=medikeep_dev \
  -e POSTGRES_USER=medikeep \
  -e POSTGRES_PASSWORD=dev_password \
  -p 5432:5432 \
  postgres:15-alpine
```

**Option B: Local PostgreSQL**
```bash
# Create database and user
psql -U postgres << EOF
CREATE DATABASE medikeep_dev;
CREATE USER medikeep WITH PASSWORD 'dev_password';
GRANT ALL PRIVILEGES ON DATABASE medikeep_dev TO medikeep;
\q
EOF
```

#### 2.5 Run Migrations

```bash
alembic upgrade head
```

#### 2.6 Start Backend Server

```bash
# Option A: Using the run script (simplest)
python run.py

# Option B: Using uvicorn directly
uvicorn app.main:app --reload --port 8000
```

**Backend is now running at:** http://localhost:8000
**API Documentation:** http://localhost:8000/docs

### Step 3: Set Up Frontend

**Open a new terminal window** (keep backend running)

#### 3.1 Install Dependencies

```bash
cd frontend
npm install
```

#### 3.2 Configure Environment

```bash
# Create .env.local
echo "REACT_APP_API_URL=http://localhost:8000" > .env.local
```

#### 3.3 Start Development Server

```bash
npm start
```

**Frontend is now running at:** http://localhost:3000

**You're ready to develop!** 🎉
- Make changes to backend code → Server auto-reloads
- Make changes to frontend code → Browser auto-refreshes
- Check API docs at http://localhost:8000/docs
- Default login: `admin` / `admin123`

---

## 🐳 Option 2: Docker Testing Setup (Optional)

**Test the production build locally using Docker.**

This option runs the pre-built production image. Use this to test how your changes work in production, but NOT for daily development (you won't see code changes without rebuilding).

### Step 1: Clone Repository

```bash
git clone https://github.com/afairgiant/MediKeep.git
cd MediKeep
```

### Step 2: Create Environment File

```bash
# Copy example environment file to root directory
cp docker/.env.example .env

# Edit .env and change:
# - DB_PASSWORD (line 4)
# - SECRET_KEY (line 8)
```

### Step 3: Start Production Containers

```bash
# Start using docker-compose file from docker/ directory
cd docker
docker compose up -d

# Or from root directory:
# docker compose -f docker/docker-compose.yml up -d
```

### Step 4: Access Application

- **Application:** http://localhost:8005 (production build - frontend + backend combined)
- **API Docs:** http://localhost:8005/docs
- **Database:** localhost:5432

**Default Login:**
- Username: `admin`
- Password: `admin123`

**Note:** To see code changes in this setup, you must rebuild the Docker image:
```bash
cd docker
docker compose down
docker compose up -d --build
```

---

## ✅ Verify Installation

### Check Backend

```bash
# Health check
curl http://localhost:8000/health

# Should return: {"status":"healthy"}
```

```bash
# API documentation
open http://localhost:8000/docs
```

### Check Frontend

1. Open http://localhost:3000
2. You should see the login page
3. Login with: `admin` / `admin123`
4. You should see the dashboard

### Check Database

```bash
# Connect to database
psql -h localhost -U medikeep -d medikeep_dev

# List tables
\dt

# Should see tables: users, patients, medications, etc.

# Exit
\q
```

---

## 📚 Next Steps

### 1. Explore the Codebase

```
MediKeep/
├── app/                  # Backend (Python/FastAPI)
│   ├── api/             # API endpoints
│   ├── models/          # Database models
│   ├── schemas/         # Pydantic schemas
│   └── services/        # Business logic
│
├── frontend/            # Frontend (React)
│   └── src/
│       ├── components/  # React components
│       ├── pages/       # Page components
│       ├── services/    # API services
│       └── hooks/       # Custom hooks
│
└── docs/               # Documentation
```

### 2. Read the Documentation

- **[Architecture Guide](01-architecture.md)** - Understand the system design
- **[API Reference](API-Reference)** - Explore available endpoints
- **[Database Schema](Database-Schema)** - Learn the data model
- **[Development Guide](Contributing)** - Code standards and workflow

### 3. Run Tests

**Backend:**
```bash
# All tests
pytest

# With coverage
pytest --cov=app --cov-report=html

# Specific test
pytest tests/api/test_medications.py -v
```

**Frontend:**
```bash
cd frontend

# All tests
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### 4. Make Your First Change

**Try this simple task:**

1. Add a new field to medication display
2. Update the backend schema
3. Update the frontend component
4. Run tests
5. Create a pull request

**Example:**
```python
# app/schemas/medication.py
class MedicationResponse(BaseModel):
    id: int
    name: str
    dosage: Optional[str]
    # Add this field
    notes: Optional[str]
```

```javascript
// frontend/src/components/medications/MedicationCard.js
<Text size="sm" color="dimmed">
  {medication.notes}
</Text>
```

---

## 🐛 Troubleshooting

### Backend Won't Start

**Error: ModuleNotFoundError**
```bash
# Solution: Activate virtual environment
# Windows
.venv\Scripts\activate

# Linux/Mac
source .venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

**Error: Database connection failed**
```bash
# Check if PostgreSQL is running
# Docker
docker ps | grep postgres

# Local
pg_isready -h localhost -U medikeep

# Check .env file has correct credentials
cat .env | grep DB_
```

**Error: Address already in use (port 8000)**
```bash
# Find process using port 8000
# Windows
netstat -ano | findstr :8000

# Linux/Mac
lsof -i :8000

# Kill the process or use different port
uvicorn app.main:app --reload --port 8001
```

### Frontend Won't Start

**Error: EADDRINUSE (port 3000)**
```bash
# Kill process on port 3000
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm start
```

**Error: Module not found**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Error: API calls failing (CORS)**
```bash
# Ensure backend is running on port 8000
# Check .env.local has correct API URL
cat .env.local

# Should be: REACT_APP_API_URL=http://localhost:8000
```

### Database Issues

**Can't connect to database**
```bash
# Test connection
psql -h localhost -U medikeep -d medikeep_dev

# If fails, check:
# 1. PostgreSQL is running
# 2. Credentials are correct
# 3. Database exists

# Recreate database if needed
psql -U postgres -c "DROP DATABASE IF EXISTS medikeep_dev;"
psql -U postgres -c "CREATE DATABASE medikeep_dev;"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE medikeep_dev TO medikeep;"
```

**Migration errors**
```bash
# Reset migrations (CAUTION: Deletes data!)
alembic downgrade base
alembic upgrade head

# Or start fresh
psql -U postgres -c "DROP DATABASE medikeep_dev;"
psql -U postgres -c "CREATE DATABASE medikeep_dev;"
alembic upgrade head
```

---

## 💡 Useful Commands

### Development

```bash
# Backend
python run.py                            # Start backend with auto-reload
alembic revision --autogenerate -m ""   # Create migration
alembic upgrade head                     # Apply migrations
pytest -v                                # Run tests (verbose)
black .                                  # Format code
pylint app/                              # Lint code

# Frontend
npm start                                # Start dev server
npm test                                 # Run tests
npm run lint                             # Lint code
npm run build                            # Build for production
```

### Database

```bash
# Connect
psql -h localhost -U medikeep -d medikeep_dev

# Useful psql commands
\dt                    # List tables
\d table_name         # Describe table
\du                   # List users
\l                    # List databases
\q                    # Quit
```

### Docker

```bash
# Start PostgreSQL only (for development)
docker run -d --name medikeep-postgres \
  -e POSTGRES_DB=medikeep_dev \
  -e POSTGRES_USER=medikeep \
  -e POSTGRES_PASSWORD=dev_password \
  -p 5432:5432 postgres:15-alpine

# Stop PostgreSQL
docker stop medikeep-postgres
docker rm medikeep-postgres

# Production build testing
cd docker
docker compose up -d
docker compose down
docker compose logs -f
```

---

## 🎓 Learning Resources

### Python/FastAPI

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy Tutorial](https://docs.sqlalchemy.org/en/14/tutorial/)
- [Pydantic Documentation](https://docs.pydantic.dev/)

### React/JavaScript

- [React Documentation](https://react.dev/)
- [Mantine UI Components](https://mantine.dev/)
- [React Testing Library](https://testing-library.com/react)

### Database

- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)

### Tools

- [Git Documentation](https://git-scm.com/doc)
- [Docker Documentation](https://docs.docker.com/)

---

## 🤝 Get Help

### Documentation

- [Architecture Guide](01-architecture.md)
- [API Reference](API-Reference)
- [Database Schema](Database-Schema)
- [Deployment Guide](Deployment)
- [Development Guide](Contributing)

### Community

- **Issues:** [GitHub Issues](https://github.com/afairgiant/MediKeep/issues)
- **Discussions:** [GitHub Discussions](https://github.com/afairgiant/MediKeep/discussions)
- **Code:** Review existing PRs for examples

### Ask Questions

**Before asking:**
1. Check this guide
2. Search existing issues
3. Read the docs

**When asking:**
- Include error messages
- Share your environment (OS, versions)
- Describe what you've tried
- Provide code snippets

---

## 📝 Development Checklist

### Daily Workflow

- [ ] Pull latest changes: `git pull origin main`
- [ ] Activate virtual environment
- [ ] Start backend: `python run.py`
- [ ] Start frontend: `cd frontend && npm start`
- [ ] Check API docs: http://localhost:8000/docs
- [ ] Make changes
- [ ] Run tests: `pytest` and `npm test`
- [ ] Commit with clear message
- [ ] Push to your branch

### Before Pull Request

- [ ] All tests pass
- [ ] Code follows style guide
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] No debug code
- [ ] Migrations created (if needed)
- [ ] Self-review completed

---

## 🎉 You're Ready!

Congratulations! You now have a fully functional MediKeep development environment.

**What's Next?**

1. **Pick an issue** from [GitHub Issues](https://github.com/afairgiant/MediKeep/issues)
2. **Create a branch**: `git checkout -b feature/your-feature`
3. **Make changes** following the [Development Guide](Contributing)
4. **Submit a PR** and get feedback

**Need help?** Don't hesitate to ask in [GitHub Discussions](https://github.com/afairgiant/MediKeep/discussions)!

Happy coding! 🚀

---

**Quick Reference:**
- Backend: http://localhost:8000
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs
- Database: localhost:5432
- Default Login: `admin` / `admin123`
