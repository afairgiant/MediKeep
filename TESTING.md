# Medical Records Application - Testing Guide

This document provides comprehensive information about testing the Medical Records application, including unit tests, integration tests, container tests, and end-to-end testing.

## Table of Contents

- [Overview](#overview)
- [Test Architecture](#test-architecture)
- [Quick Start](#quick-start)
- [Running Tests](#running-tests)
- [Test Types](#test-types)
- [CI/CD Pipeline](#cicd-pipeline)
- [Container Testing](#container-testing)
- [Coverage Reports](#coverage-reports)
- [Troubleshooting](#troubleshooting)

## Overview

The Medical Records application uses a comprehensive testing strategy designed for the single-container deployment architecture. Tests cover:

- **Frontend**: React components, services, and user interactions
- **Backend**: API endpoints, database operations, and business logic
- **Integration**: Container builds, API integration, and data flow
- **End-to-End**: Complete user workflows from registration to medical records management
- **Security**: Vulnerability scanning and security testing
- **Performance**: Load testing and response time benchmarks

## Test Architecture

### Frontend Testing Stack
- **Framework**: Jest + React Testing Library
- **Mocking**: MSW (Mock Service Worker) for API mocking
- **Coverage**: Istanbul code coverage
- **Utilities**: Custom render functions with provider contexts

### Backend Testing Stack
- **Framework**: pytest + pytest-asyncio
- **Database**: SQLite for unit tests, PostgreSQL for integration
- **API Testing**: FastAPI TestClient + httpx
- **Fixtures**: Comprehensive test data factories

### Container Testing
- **Build Testing**: Docker multi-stage build verification
- **Integration**: Docker Compose with test services
- **E2E**: Container-based application testing
- **Security**: Trivy vulnerability scanning

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.12+
- Docker & Docker Compose
- Git

### Install Dependencies

```bash
# Frontend dependencies
cd frontend
npm ci

# Backend dependencies (from root)
pip install -r requirements.txt
pip install pytest pytest-asyncio pytest-cov httpx faker
```

### Run Quick Tests

```bash
# Use the test runner script
./scripts/run-tests.sh quick

# Or run manually
cd frontend && npm test -- --watchAll=false
pytest tests/unit/ tests/api/ -v
```

## Running Tests

### Using the Test Runner Script

The `scripts/run-tests.sh` script provides easy access to all test types:

```bash
# Quick tests (unit only)
./scripts/run-tests.sh quick

# Full test suite
./scripts/run-tests.sh full

# Frontend tests only
./scripts/run-tests.sh frontend
./scripts/run-tests.sh frontend unit
./scripts/run-tests.sh frontend coverage

# Backend tests only
./scripts/run-tests.sh backend
./scripts/run-tests.sh backend api
./scripts/run-tests.sh backend coverage

# Container tests
./scripts/run-tests.sh container build
./scripts/run-tests.sh container integration

# Performance tests
./scripts/run-tests.sh performance

# Cleanup
./scripts/run-tests.sh cleanup
```

### Manual Test Execution

#### Frontend Tests

```bash
cd frontend

# Unit tests
npm test -- --watchAll=false

# With coverage
npm run test:coverage

# Specific test file
npm test -- Login.test.js --watchAll=false

# Linting
npm run lint
```

#### Backend Tests

```bash
# Set environment variables
export TESTING=1
export SECRET_KEY="test-secret-key"
export DATABASE_URL="sqlite:///./test.db"

# Unit tests
pytest tests/unit/ -v

# API tests
pytest tests/api/ -v

# Integration tests
pytest tests/integration/ -v

# With coverage
pytest tests/ --cov=app --cov-report=html

# Specific test file
pytest tests/api/test_auth.py -v

# Performance markers
pytest tests/ -m "not slow" -v
```

## Test Types

### Unit Tests

**Frontend Unit Tests** (`frontend/src/**/*.test.js`)
- Component rendering and behavior
- Service layer functions
- Utility functions
- State management

**Backend Unit Tests** (`tests/unit/`)
- CRUD operations
- Business logic functions
- Data validation
- Utility functions

### Integration Tests

**API Integration** (`tests/api/`)
- Authentication flows
- CRUD endpoints
- Data relationships
- Error handling

**Database Integration** (`tests/integration/`)
- Database operations
- Migration testing
- Data integrity
- Performance queries

### Container Tests

**Build Tests** (`tests/container/`)
- Docker image build verification
- Multi-stage build optimization
- Security configuration
- File structure validation

**Runtime Tests**
- Container startup and health checks
- API accessibility through container
- Static file serving
- Environment configuration

### End-to-End Tests

**User Workflows** (`tests/e2e/`)
- Complete registration flow
- Medical records management
- Practitioner assignment
- Data export functionality
- Error handling scenarios

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/test.yml`) runs:

### On Every Push/PR:
1. **Frontend Tests**: Linting + unit tests + coverage
2. **Backend Tests**: Linting + unit/API tests + coverage  
3. **Security Scan**: Trivy vulnerability scanning
4. **Container Tests**: Build verification + integration tests

### On Main Branch:
5. **E2E Tests**: Complete user workflow testing
6. **Performance Tests**: Basic load testing
7. **Docker Build**: Multi-platform image build and push

### Nightly (Scheduled):
- Full test suite including performance tests
- Extended security scanning
- Container security analysis

## Container Testing

### Test with Docker Compose

```bash
# Run all container tests
docker-compose -f docker-compose.test.yml up --abort-on-container-exit

# Run specific test suite
docker-compose -f docker-compose.test.yml up backend-unit-tests
docker-compose -f docker-compose.test.yml up backend-integration-tests
docker-compose -f docker-compose.test.yml up e2e-tests

# Security scanning
docker-compose -f docker-compose.test.yml up security-scan

# Performance testing
docker-compose -f docker-compose.test.yml up performance-tests
```

### Manual Container Testing

```bash
# Build test image
docker build -f docker/Dockerfile.test -t medical-records:test .

# Run unit tests in container
docker run --rm \
  -e TESTING=1 \
  -e SKIP_MIGRATIONS=true \
  medical-records:test

# Run integration tests with database
docker run --rm \
  --network host \
  -e TESTING=1 \
  -e DATABASE_URL="postgresql://user:pass@localhost:5432/test_db" \
  medical-records:test

# Start application for E2E testing
docker run -d \
  --name test-app \
  -p 8000:8000 \
  -e TESTING=1 \
  -e RUN_SERVER=true \
  medical-records:test
```

## Coverage Reports

### Frontend Coverage

```bash
cd frontend
npm run test:coverage

# Open HTML report
open coverage/lcov-report/index.html
```

### Backend Coverage

```bash
pytest tests/ --cov=app --cov-report=html --cov-report=term-missing

# Open HTML report
open htmlcov/index.html
```

### Coverage Thresholds

- **Frontend**: 70% minimum coverage
- **Backend**: 70% minimum coverage
- **Critical paths**: 90% minimum coverage

## Troubleshooting

### Common Issues

#### Frontend Tests

**Issue**: Tests timeout or fail to start
```bash
# Clear cache and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Issue**: MSW handlers not working
```bash
# Check MSW setup in setupTests.js
# Verify handler imports in test files
```

#### Backend Tests

**Issue**: Database connection errors
```bash
# Ensure test database URL is correct
export DATABASE_URL="sqlite:///./test.db"

# For PostgreSQL integration tests
docker-compose -f docker-compose.test.yml up postgres-test
```

**Issue**: Import errors
```bash
# Add project root to Python path
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

#### Container Tests

**Issue**: Container build failures
```bash
# Clean Docker cache
docker system prune -f
docker-compose -f docker-compose.test.yml down --volumes
```

**Issue**: Port conflicts
```bash
# Stop other services using ports
sudo lsof -ti:8000 | xargs kill -9
sudo lsof -ti:5432 | xargs kill -9
```

### Debug Mode

#### Frontend Debug
```bash
cd frontend
npm test -- --verbose --no-coverage
```

#### Backend Debug
```bash
pytest tests/ -v -s --tb=long --log-cli-level=DEBUG
```

#### Container Debug
```bash
# Run container interactively
docker run -it --rm medical-records:test /bin/bash

# Check container logs
docker logs container-name
```

### Performance Issues

#### Slow Tests
```bash
# Run only fast tests
pytest tests/ -m "not slow"

# Profile test execution
pytest tests/ --durations=10
```

#### Memory Issues
```bash
# Reduce parallel test execution
pytest tests/ -n auto --maxprocesses=2

# Monitor resource usage
docker stats
```

## Best Practices

### Writing Tests

1. **Use descriptive test names**: Clearly describe what is being tested
2. **Follow AAA pattern**: Arrange, Act, Assert
3. **Keep tests isolated**: Each test should be independent
4. **Use appropriate test level**: Unit vs Integration vs E2E
5. **Mock external dependencies**: Use MSW for frontend, mocks for backend

### Test Data

1. **Use factories**: Create test data with factory functions
2. **Avoid hard-coded data**: Use dynamic test data generation
3. **Clean up after tests**: Ensure tests don't affect each other
4. **Use meaningful test data**: Data should represent realistic scenarios

### CI/CD

1. **Fail fast**: Run quick tests first
2. **Parallel execution**: Run independent test suites in parallel
3. **Caching**: Cache dependencies and build artifacts
4. **Security**: Regular vulnerability scanning
5. **Documentation**: Keep testing documentation up to date

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure all test types pass
3. Maintain or improve coverage
4. Update test documentation
5. Consider adding E2E tests for user-facing features

For questions or issues with testing, please check the troubleshooting section or create an issue in the repository.