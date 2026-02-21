# Installation Guide

This guide covers how to install and set up MediKeep for personal or family use.

---

## Quick Start (Docker)

The fastest way to get MediKeep running - no need to clone the repository.

### 1. Create a project folder

```bash
mkdir medikeep
cd medikeep
```

### 2. Create docker-compose.yml

Create a file named `docker-compose.yml` with this content:

```yaml
services:
  postgres:
    image: postgres:15.8-alpine
    container_name: medikeep-db
    environment:
      POSTGRES_DB: ${DB_NAME:-medical_records}
      POSTGRES_USER: ${DB_USER:-medapp}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test:
        [
          'CMD-SHELL',
          'pg_isready -U ${DB_USER:-medapp} -d ${DB_NAME:-medical_records}',
        ]
      interval: 60s
      timeout: 10s
      retries: 3
      start_period: 30s
    restart: unless-stopped
    networks:
      - medikeep-network

  medikeep-app:
    image: ghcr.io/afairgiant/medikeep:latest
    container_name: medikeep-app
    ports:
      - ${APP_PORT:-8005}:8000
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: ${DB_NAME:-medical_records}
      DB_USER: ${DB_USER:-medapp}
      DB_PASSWORD: ${DB_PASSWORD}
      SECRET_KEY: ${SECRET_KEY}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
      TZ: ${TZ:-UTC}
    volumes:
      - app_uploads:/app/uploads
      - app_logs:/app/logs
      - app_backups:/app/backups
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - medikeep-network

volumes:
  postgres_data:
  app_uploads:
  app_logs:
  app_backups:

networks:
  medikeep-network:
    driver: bridge
```

### 3. Create .env file

Create a file named `.env` with your configuration:

```bash
# Database
DB_NAME=medical_records
DB_USER=medapp
DB_PASSWORD=choose-a-secure-password

# Application
APP_PORT=8005
SECRET_KEY=generate-a-random-secret-key
LOG_LEVEL=INFO
TZ=America/New_York
```

> **Tip:** Generate a secure secret key with: `openssl rand -hex 32`

### 4. Start MediKeep

```bash
docker compose up -d
```

### 5. Access MediKeep

Open **http://localhost:8005** in your browser.

Default credentials: `admin` / `admin123`

> **Important:** Change the default password immediately after first login!

---

## System Requirements

### Minimum

| Resource | Requirement           |
| -------- | --------------------- |
| CPU      | 2 cores               |
| RAM      | 2 GB                  |
| Disk     | 20 GB                 |
| Docker   | 24.0+ with Compose v2 |

### Recommended

| Resource | Requirement |
| -------- | ----------- |
| CPU      | 4 cores     |
| RAM      | 4 GB        |
| Disk     | 50 GB SSD   |

---

## Configuration Options

### Essential Settings

| Variable      | Description                         | Required |
| ------------- | ----------------------------------- | -------- |
| `DB_PASSWORD` | Database password                   | Yes      |
| `SECRET_KEY`  | JWT signing key (use random string) | Yes      |

### Optional Settings

| Variable    | Description             | Default         |
| ----------- | ----------------------- | --------------- |
| `APP_PORT`  | Port to access MediKeep | 8005            |
| `DB_NAME`   | Database name           | medical_records |
| `DB_USER`   | Database user           | medapp          |
| `LOG_LEVEL` | Logging level           | INFO            |
| `TZ`        | Timezone                | UTC             |

### Docker Secrets (Optional)

You can pass sensitive values via mounted files instead of plain environment variables. Set `VAR_FILE=/run/secrets/filename` for any of: `DB_USER`, `DB_PASSWORD`, `DATABASE_URL`, `SECRET_KEY`, `ADMIN_DEFAULT_PASSWORD`, `SSO_CLIENT_ID`, `SSO_CLIENT_SECRET`, `PAPERLESS_SALT`, `NOTIFICATION_ENCRYPTION_SALT`.

See [Deployment Guide](Deployment-Guide#docker-secrets-_file-pattern) for full details and examples.

### SSO Configuration (Optional)

To enable SSO login, add these to your `.env`:

```bash
SSO_ENABLED=true
SSO_PROVIDER_TYPE=github  # google, github, oidc, authentik, authelia, keycloak
SSO_CLIENT_ID=your-client-id
SSO_CLIENT_SECRET=your-client-secret
SSO_REDIRECT_URI=http://localhost:8005/api/v1/sso/callback
```

See [SSO Quick Start](SSO-Quick-Start) for detailed setup.

---

## Post-Installation

### 1. Change Default Password

Immediately after first login:

1. Go to **Settings**
2. Find the **Security** section
3. Click **Change Password**

### 2. Create Patient Profiles

1. Go to **Patients** in the sidebar
2. Click **Add Patient**
3. Add yourself and any family members

### 3. Set Up Backups

MediKeep includes built-in backup functionality. You can also manually backup:

```bash
# Database backup
docker compose exec postgres pg_dump -U medapp medical_records > backup.sql
```

---

## Updating MediKeep

```bash
# Pull the latest image
docker compose pull

# Restart with the new version
docker compose up -d
```

---

## Troubleshooting

### Container won't start

Check logs:

```bash
docker compose logs medikeep-app
docker compose logs postgres
```

### Database connection error

1. Make sure PostgreSQL is healthy:
   ```bash
   docker compose ps
   ```
2. Verify `DB_PASSWORD` in `.env` matches what PostgreSQL was initialized with

### Port already in use

Change `APP_PORT` in your `.env`:

```bash
APP_PORT=8006
```

### Reset everything and start fresh

```bash
# Stop and remove containers and volumes
docker compose down -v

# Start fresh
docker compose up -d
```

> **Warning:** This deletes all data!

---

## Advanced: Development Setup

If you want to contribute to MediKeep or run from source, see the [Developer Guide](Developer-Guide) and [Quick Start Guide](Quick-Start-Guide).

---

## Next Steps

- [User Guide](User-Guide) - Learn how to use MediKeep
- [Deployment Guide](Deployment-Guide) - Production deployment with HTTPS
- [FAQ](FAQ) - Common questions
