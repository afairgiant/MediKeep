# Medical Records Management System

A medical records management system with React frontend and FastAPI backend.

## STILL VERY MUCH SO A WORK IN PROGRESS! EXPECT BREAKING CHANGES OFTEN!

## Quick Start

### 1️⃣ Install Docker & Docker Compose

Ensure you have [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed.

### 2️⃣ Create docker-compose.yml

Create a `docker-compose.yml` file with content:

```yaml

services:  

# PostgreSQL Database Service
  postgres:
    image: postgres:15.8-alpine
    container_name: medical-records-db
    environment:
      POSTGRES_DB: ${DB_NAME:-medical_records}
      POSTGRES_USER: ${DB_USER:-medapp}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data-prod:/var/lib/postgresql/data
      - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"    
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-medapp} -d ${DB_NAME:-medical_records}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - medical-records-network

  # Combined Frontend + Backend Application Service
  medical-records-app:
    image: ghcr.io/afairgiant/personal-medical-records-keeper/medical-records:latest
    # build:
    #   context: ..
    #   dockerfile: docker/Dockerfile    
    container_name: medical-records-app
    ports:
      - ${APP_PORT:-8005}:8000  # Single port serves both React app and FastAPI      
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: ${DB_NAME:-medical_records}
      DB_USER: ${DB_USER:-medapp}
      DB_PASSWORD: ${DB_PASSWORD}
      SECRET_KEY: ${SECRET_KEY:-your-secret-key-here}
    volumes:
      - app_uploads:/app/uploads
      - app_logs:/app/logs
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
    networks:
      - medical-records-network

# Named volumes for data persistence
volumes:
  postgres_data-prod:
    driver: local
  app_uploads:
    driver: local
  app_logs:
    driver: local

# Network for service communication
networks:
  medical-records-network:
    driver: bridge
```
Create a .env file(or copy the env.example in the docker folder)
```bash
# Environment variables for Docker Compose
# Copy this file to .env and update the values

# Database Configuration
DB_NAME=medical_records
DB_USER=medapp
DB_PASSWORD=your_secure_database_password_here

# Application port
APP_PORT=8005


Create a .env file(or copy the env.example in the docker folder)
```bash
# Environment variables for Docker Compose
# Copy this file to .env and update the values

# Database Configuration
DB_NAME=medical_records
DB_USER=medapp
DB_PASSWORD=your_secure_database_password_here


# Application Security
SECRET_KEY=your-very-secure-secret-key-for-jwt-tokens-change-this-in-production

# Optional: Override default settings
# ACCESS_TOKEN_EXPIRE_MINUTES=30
# ALGORITHM=HS256
```

### 3️⃣ Start the Containers

Run the following command to start the services:

```ini
docker compose up -d
```
Note: Do not use ```docker-compose```.

### 4️⃣ Access the app

Once the containers are up, access the app in your browser at:

```ini
http://localhost:8005
```

### Demo Login
- Username: `admin`
- Password: `admin123`

## To Do

1. Revamp the logging system since it currently broken/not working great
2. Create and setup methods to change user passwords.
3. Update the admin dashboard to work with the new api setup
4. Update admin health status with working info
5. Backup / Restores
6. Exports
7. Finish adding individual search & filtering to each page
8. Whole patient search

