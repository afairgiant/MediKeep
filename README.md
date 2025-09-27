# MediKeep

> **⚠️ IMPORTANT: Repository and Image Name Change**
>
> This project was formerly known as **Personal-Medical-Records-Keeper** and has been renamed to **MediKeep**.
>
> **Breaking Changes:**
>
> - Docker image has moved from `ghcr.io/afairgiant/personal-medical-records-keeper/medical-records` to `ghcr.io/afairgiant/medikeep`
> - Repository will move from `afairgiant/Personal-Medical-Records-Keeper` to `afairgiant/MediKeep`
> - Container names have changed from `medical-records-*` to `medikeep-*`
>
> Please update your configurations accordingly.

---

Your personal health record keeper - built with React frontend and FastAPI backend.

[![CodeQL](https://github.com/afairgiant/Personal-Medical-Records-Keeper/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/afairgiant/Personal-Medical-Records-Keeper/actions/workflows/github-code-scanning/codeql)
[![Medical Records Docker Image CI](https://github.com/afairgiant/Personal-Medical-Records-Keeper/actions/workflows/docker-image.yml/badge.svg)](https://github.com/afairgiant/Personal-Medical-Records-Keeper/actions/workflows/docker-image.yml)

## This is actively being worked on!

## Screenshots

### Dashboard
The main dashboard provides an overview of your health records and recent activity.

![Dashboard View](docs/assets/screenshots_MediKeep/Screenshot%202025-09-27_Dashboard.png)

### Medications
Track and manage all your medications, dosages, and schedules in one place.

![Medications Page](docs/assets/screenshots_MediKeep/Screenshot%202025-09-27_Medications.png)

### Report Builder
Generate custom health reports and export your medical data for sharing with healthcare providers.

![Report Builder Page](docs/assets/screenshots_MediKeep/Screenshot%202025-09-27_Report%20Builder.png)

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
      - postgres_data:/var/lib/postgresql/data
      - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - '5432:5432'
    healthcheck:
      test:
        [
          'CMD-SHELL',
          'pg_isready -U ${DB_USER:-medapp} -d ${DB_NAME:-medical_records}',
        ]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - medical-records-network

  # Combined Frontend + Backend Application Service
  medical-records-app:
    image: ghcr.io/afairgiant/medikeep:latest
    # build:
    #   context: ..
    #   dockerfile: docker/Dockerfile
    container_name: medical-records-app
    ports:
      - ${APP_PORT:-8005}:8000 # Single port serves both React app and FastAPI
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: ${DB_NAME:-medical_records}
      DB_USER: ${DB_USER:-medapp}
      DB_PASSWORD: ${DB_PASSWORD}
      SECRET_KEY: ${SECRET_KEY:-your-secret-key-here}
      TZ: $(TZ:-America/New_York)
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
      #PUID: ${PUID} # Enable if using bind mounts
      #PGID: ${PGID} # Enable if using bind mounts

      # SSL Configuration - set ENABLE_SSL=true in .env to enable HTTPS - Uncomment if needed
      #ENABLE_SSL: ${ENABLE_SSL:-false}
      # SSO Configuration (Optional) - SSO is disabled by default
      SSO_ENABLED: ${SSO_ENABLED:-false}
      #SSO_PROVIDER_TYPE: ${SSO_PROVIDER_TYPE:-oidc}
      #SSO_CLIENT_ID: ${SSO_CLIENT_ID:-}
      #SSO_CLIENT_SECRET: ${SSO_CLIENT_SECRET:-}
      #SSO_ISSUER_URL: ${SSO_ISSUER_URL:-}
      #SSO_REDIRECT_URI: ${SSO_REDIRECT_URI:-}
      #SSO_ALLOWED_DOMAINS: ${SSO_ALLOWED_DOMAINS:-[]}

    volumes:
      - app_uploads:/app/uploads
      - app_logs:/app/logs
      - app_backups:/app/backups
      # Uncomment the line below and create certificates if you want HTTPS
      # - ./certs:/app/certs:ro
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8000/health']
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
    networks:
      - medical-records-network

# Named volumes for data persistence
volumes:
  postgres_data:
    driver: local
  app_uploads:
    driver: local
  app_logs:
    driver: local
  app_backups:
    driver: local

# Network for service communication
networks:
  medical-records-network:
    driver: bridge
```

#### Create a .env file(or copy the env.example in the docker folder)

```bash
# Environment variables for Docker Compose
# Copy this file to .env and update the values

# Database Configuration
DB_NAME=medical_records
DB_USER=medapp
DB_PASSWORD=your_secure_database_password_here #Change me

# Application port
APP_PORT=8005

# Application Security Key
SECRET_KEY=your-very-secure-secret-key-for-jwt-tokens-change-this-in-production

TZ=America/New_York
LOG_LEVEL=INFO #INFO or DEBUG
ENABLE_SSL=false # false or true
```

### 3️⃣ Start the Containers

Run the following command to start the services:

```ini
docker compose up -d
```

Note: Do not use `docker-compose`.

### 4️⃣ Access the app

Once the containers are up, access the app in your browser at:

```ini
http://localhost:8005
```

### Default Login

- Username: `admin`
- Password: `admin123`

## Backup and Restore

The app can be backed up using the Admin Dashboard.
Additionally, a backup/restore CLI is available.
This can be used with cron to automate scheduled backups.
See [Backup and Restore CLI](app/scripts/README_BACKUP_CLI.md) for more details.

Backups are stored under `/app/backups`. This should be mapped to
an external location or volume so that it can be stored safely in case a
restore is needed.

## SSO

The app has SSO capabilities.
As of right now, Google and Github are offically supported and tested.
ODIC SSO(keycloak, authlia, etc) should be supported but I haven't tested them yet.

See [SSO Quick Start](app/docs/SSO_QUICK_START.md) for google/github.

See [SSO Full Guide](app/docs/SSO_SETUP_GUIDE.md) for a more detailed guide.
