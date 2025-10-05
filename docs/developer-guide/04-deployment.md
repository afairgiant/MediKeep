# MediKeep Deployment Guide

Complete guide for deploying MediKeep in production environments.

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Prerequisites](#prerequisites)
3. [Docker Deployment (Recommended)](#docker-deployment-recommended)
4. [Environment Variables Reference](#environment-variables-reference)
5. [SSL/HTTPS Setup](#sslhttps-setup)
6. [Reverse Proxy Configuration](#reverse-proxy-configuration)
7. [Database Setup](#database-setup)
8. [Production Deployment Checklist](#production-deployment-checklist)
9. [Cloud Deployment](#cloud-deployment)
10. [Scaling & Performance](#scaling--performance)
11. [Monitoring & Logging](#monitoring--logging)
12. [Backup & Disaster Recovery](#backup--disaster-recovery)
13. [Maintenance](#maintenance)
14. [Troubleshooting](#troubleshooting)

## Deployment Overview

### Architecture

MediKeep uses a multi-stage Docker build that combines:

- **Frontend**: React application (built with Node.js 20)
- **Backend**: FastAPI (Python 3.12)
- **Database**: PostgreSQL 15.8
- **File Storage**: Local filesystem with volume mounts

```
┌──────────────────┐
│   Reverse Proxy  │ (Optional: Nginx, Caddy, Traefik)
│   SSL/TLS Term   │
└────────┬─────────┘
         │
┌────────▼─────────┐
│   MediKeep App   │ Port 8000 (HTTP/HTTPS)
│ Frontend+Backend │
└────────┬─────────┘
         │
┌────────▼─────────┐
│   PostgreSQL 15  │ Port 5432
└──────────────────┘
```

### Deployment Options

1. **Docker Compose** (Recommended) - Easiest, most consistent
2. **Docker with External Database** - More scalable
3. **Cloud Platforms** - AWS, GCP, Azure, DigitalOcean
4. **Manual Installation** - Not recommended, requires extensive setup

### Security Considerations

- All passwords and secrets MUST be changed from defaults
- HTTPS is strongly recommended for production
- Database should not be exposed externally
- Regular backups are essential for medical data
- Access logs must be monitored for suspicious activity

## Prerequisites

### System Requirements

**Minimum:**

- 2 CPU cores
- 2 GB RAM
- 20 GB disk space
- Docker 24.0+ and Docker Compose v2

**Recommended:**

- 4 CPU cores
- 4 GB RAM
- 100 GB disk space (for medical records and backups)
- SSD storage for database
- Regular backup strategy

### Software Requirements

- Docker 24.0 or later
- Docker Compose v2 (not legacy `docker-compose`)
- PostgreSQL 15+ (included in Docker setup)
- SSL certificates (for HTTPS)

### Network Requirements

- Port 8000 (or custom APP_PORT) available
- Port 5432 for PostgreSQL (only if external access needed)
- Outbound internet access (for SSO providers, if used)

## Docker Deployment (Recommended)

### Quick Start (5 Minutes)

#### 1. Create Project Directory

```bash
mkdir medikeep
cd medikeep
```

#### 2. Create docker-compose.yml

```yaml
services:
  # PostgreSQL Database Service
  postgres:
    image: postgres:15.8-alpine
    container_name: medikeep-db
    environment:
      POSTGRES_DB: ${DB_NAME:-medical_records}
      POSTGRES_USER: ${DB_USER:-medapp}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - '5432:5432' # Remove this line in production (internal only)
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
      - medikeep-network

  # Combined Frontend + Backend Application Service
  medikeep-app:
    image: ghcr.io/afairgiant/medikeep:latest
    container_name: medikeep-app
    ports:
      - ${APP_PORT:-8000}:8000
    environment:
      # Database Configuration
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: ${DB_NAME:-medical_records}
      DB_USER: ${DB_USER:-medapp}
      DB_PASSWORD: ${DB_PASSWORD}

      # Security
      SECRET_KEY: ${SECRET_KEY}
      ADMIN_DEFAULT_PASSWORD: ${ADMIN_DEFAULT_PASSWORD:-admin123}

      # Application Settings
      TZ: ${TZ:-America/New_York}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
      DEBUG: ${DEBUG:-false}

      # SSL Configuration (optional)
      ENABLE_SSL: ${ENABLE_SSL:-false}

      # SSO Configuration (optional)
      SSO_ENABLED: ${SSO_ENABLED:-false}

      # Optional: Enable for bind mounts
      #PUID: ${PUID}
      #PGID: ${PGID}

    volumes:
      - app_uploads:/app/uploads
      - app_logs:/app/logs
      - app_backups:/app/backups
      # Uncomment for HTTPS:
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
      - medikeep-network

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
  medikeep-network:
    driver: bridge
```

#### 3. Create .env File

```bash
# Create .env file with your configuration
cat > .env << 'EOF'
# Database Configuration
DB_NAME=medical_records
DB_USER=medapp
DB_PASSWORD=your-very-secure-database-password-here

# Application Port
APP_PORT=8000

# Security - CHANGE THIS!
SECRET_KEY=your-very-secure-secret-key-min-32-chars-for-jwt-tokens

# Default Admin Password (only affects fresh installations)
ADMIN_DEFAULT_PASSWORD=your-secure-admin-password

# Timezone
TZ=America/New_York

# Logging
LOG_LEVEL=INFO

# SSL (set to true after setting up certificates)
ENABLE_SSL=false

# SSO (optional)
SSO_ENABLED=false
EOF
```

**IMPORTANT**: Edit the `.env` file and change:

- `DB_PASSWORD` to a strong, unique password
- `SECRET_KEY` to a secure random string (minimum 32 characters)
- `ADMIN_DEFAULT_PASSWORD` to a secure password

Generate secure keys:

```bash
# Generate SECRET_KEY (Linux/Mac)
openssl rand -hex 32

# Or use Python
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

#### 4. Start the Application

```bash
docker compose up -d
```

#### 5. Verify Deployment

```bash
# Check container status
docker compose ps

# View logs
docker compose logs -f

# Check health
curl http://localhost:8000/health
```

#### 6. Access the Application

Open your browser to: `http://localhost:8000`

Default credentials (change immediately):

- Username: `admin`
- Password: Value of `ADMIN_DEFAULT_PASSWORD` (default: `admin123`)

### Docker Volume Management

#### Using Docker Volumes (Recommended)

Docker volumes are managed by Docker and have no permission issues:

```yaml
volumes:
  - app_uploads:/app/uploads
  - app_logs:/app/logs
  - app_backups:/app/backups
```

Backup volumes:

```bash
# Backup a volume
docker run --rm -v medikeep_app_backups:/data -v $(pwd):/backup alpine tar czf /backup/backups.tar.gz -C /data .

# Restore a volume
docker run --rm -v medikeep_app_backups:/data -v $(pwd):/backup alpine tar xzf /backup/backups.tar.gz -C /data
```

#### Using Bind Mounts

For easier access to files from the host:

```yaml
volumes:
  - ./uploads:/app/uploads
  - ./logs:/app/logs
  - ./backups:/app/backups
```

**Important**: Fix permissions first:

```bash
# Create directories
mkdir -p uploads logs backups

# Set ownership (use your user ID)
sudo chown -R 1000:1000 uploads logs backups

# Or use PUID/PGID in docker-compose.yml:
environment:
  PUID: 1000  # Your user ID: id -u
  PGID: 1000  # Your group ID: id -g
```

See [BIND_MOUNT_PERMISSIONS.md](../BIND_MOUNT_PERMISSIONS.md) for detailed troubleshooting.

### Building from Source

To build your own image instead of using the pre-built one:

```yaml
medikeep-app:
  build:
    context: .
    dockerfile: docker/Dockerfile
  # ... rest of configuration
```

Then build and start:

```bash
docker compose build
docker compose up -d
```

### Updating the Application

```bash
# Pull latest image
docker compose pull

# Recreate containers with new image
docker compose up -d

# Check logs for migration status
docker compose logs -f medikeep-app
```

Database migrations run automatically on container startup.

## Environment Variables Reference

Complete reference of all configuration options from `app/core/config.py`.

### Core Application Settings

| Variable   | Type    | Default    | Description                                      |
| ---------- | ------- | ---------- | ------------------------------------------------ |
| `APP_NAME` | string  | `MediKeep` | Application name (hardcoded)                     |
| `VERSION`  | string  | `0.33.1`   | Application version (hardcoded)                  |
| `DEBUG`    | boolean | `true`     | Enable debug mode (set to `false` in production) |

### Database Configuration

| Variable       | Type    | Default        | Required | Description                                            |
| -------------- | ------- | -------------- | -------- | ------------------------------------------------------ |
| `DB_HOST`      | string  | `localhost`    | Yes      | PostgreSQL host                                        |
| `DB_PORT`      | integer | `5432`         | No       | PostgreSQL port                                        |
| `DB_NAME`      | string  | -              | Yes      | Database name                                          |
| `DB_USER`      | string  | -              | Yes      | Database user                                          |
| `DB_PASSWORD`  | string  | -              | Yes      | Database password                                      |
| `DATABASE_URL` | string  | Auto-generated | No       | Full connection string (overrides individual settings) |

**Example:**

```env
DB_HOST=postgres
DB_PORT=5432
DB_NAME=medical_records
DB_USER=medapp
DB_PASSWORD=secure-password-here
```

### Security Configuration

| Variable                      | Type    | Default                   | Required | Description                                |
| ----------------------------- | ------- | ------------------------- | -------- | ------------------------------------------ |
| `SECRET_KEY`                  | string  | `your_default_secret_key` | Yes      | JWT signing key (min 32 chars recommended) |
| `ALGORITHM`                   | string  | `HS256`                   | No       | JWT algorithm (hardcoded)                  |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | integer | `480`                     | No       | JWT token expiration (8 hours)             |
| `ADMIN_DEFAULT_PASSWORD`      | string  | `admin123`                | No       | Default admin password for fresh installs  |
| `ALLOW_USER_REGISTRATION`     | boolean | `true`                    | No       | Allow new user registration                |

**Example:**

```env
SECRET_KEY=c7f9a8b2d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5
ACCESS_TOKEN_EXPIRE_MINUTES=480
ADMIN_DEFAULT_PASSWORD=MySecurePassword123!
ALLOW_USER_REGISTRATION=true
```

### SSL/HTTPS Configuration

| Variable       | Type    | Default                    | Required       | Description             |
| -------------- | ------- | -------------------------- | -------------- | ----------------------- |
| `ENABLE_SSL`   | boolean | `false`                    | No             | Enable HTTPS            |
| `SSL_CERTFILE` | string  | `/app/certs/localhost.crt` | If SSL enabled | Path to SSL certificate |
| `SSL_KEYFILE`  | string  | `/app/certs/localhost.key` | If SSL enabled | Path to SSL private key |

**Example:**

```env
ENABLE_SSL=true
SSL_CERTFILE=/app/certs/medikeep.crt
SSL_KEYFILE=/app/certs/medikeep.key
```

### File Storage Configuration

| Variable        | Type    | Default     | Description                   |
| --------------- | ------- | ----------- | ----------------------------- |
| `UPLOAD_DIR`    | path    | `./uploads` | Upload directory path         |
| `MAX_FILE_SIZE` | integer | `10485760`  | Max file size in bytes (10MB) |

**Example:**

```env
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=15728640  # 15MB
```

### Backup Configuration

| Variable                | Type    | Default     | Description                    |
| ----------------------- | ------- | ----------- | ------------------------------ |
| `BACKUP_DIR`            | path    | `./backups` | Backup directory path          |
| `BACKUP_RETENTION_DAYS` | integer | `7`         | Days to keep backups           |
| `BACKUP_MIN_COUNT`      | integer | `5`         | Minimum backups to always keep |
| `BACKUP_MAX_COUNT`      | integer | `50`        | Warning threshold for backups  |

**Example:**

```env
BACKUP_DIR=/app/backups
BACKUP_RETENTION_DAYS=30
BACKUP_MIN_COUNT=10
BACKUP_MAX_COUNT=100
```

### Trash/Soft Delete Configuration

| Variable               | Type    | Default           | Description                       |
| ---------------------- | ------- | ----------------- | --------------------------------- |
| `TRASH_DIR`            | path    | `./uploads/trash` | Trash directory for deleted files |
| `TRASH_RETENTION_DAYS` | integer | `30`              | Days to keep deleted files        |

**Example:**

```env
TRASH_DIR=/app/uploads/trash
TRASH_RETENTION_DAYS=60
```

### SSO Configuration

| Variable                        | Type       | Default | Required       | Description                                                               |
| ------------------------------- | ---------- | ------- | -------------- | ------------------------------------------------------------------------- |
| `SSO_ENABLED`                   | boolean    | `false` | No             | Enable SSO authentication                                                 |
| `SSO_PROVIDER_TYPE`             | string     | `oidc`  | If SSO enabled | Provider: `google`, `github`, `oidc`, `authentik`, `authelia`, `keycloak` |
| `SSO_CLIENT_ID`                 | string     | -       | If SSO enabled | OAuth client ID                                                           |
| `SSO_CLIENT_SECRET`             | string     | -       | If SSO enabled | OAuth client secret                                                       |
| `SSO_ISSUER_URL`                | string     | -       | For OIDC       | OIDC issuer URL                                                           |
| `SSO_REDIRECT_URI`              | string     | -       | If SSO enabled | OAuth redirect URI                                                        |
| `SSO_ALLOWED_DOMAINS`           | JSON array | `[]`    | No             | Allowed email domains                                                     |
| `SSO_RATE_LIMIT_ATTEMPTS`       | integer    | `10`    | No             | Max SSO attempts per window                                               |
| `SSO_RATE_LIMIT_WINDOW_MINUTES` | integer    | `10`    | No             | Rate limit window                                                         |

**Example (Google):**

```env
SSO_ENABLED=true
SSO_PROVIDER_TYPE=google
SSO_CLIENT_ID=your-client-id.apps.googleusercontent.com
SSO_CLIENT_SECRET=your-client-secret
SSO_REDIRECT_URI=https://medikeep.example.com/api/v1/sso/callback
SSO_ALLOWED_DOMAINS=["example.com"]
```

**Example (OIDC/Keycloak):**

```env
SSO_ENABLED=true
SSO_PROVIDER_TYPE=keycloak
SSO_CLIENT_ID=medikeep
SSO_CLIENT_SECRET=your-secret
SSO_ISSUER_URL=https://keycloak.example.com/realms/master
SSO_REDIRECT_URI=https://medikeep.example.com/api/v1/sso/callback
```

### Paperless-ngx Integration

| Variable                          | Type    | Default                         | Description                      |
| --------------------------------- | ------- | ------------------------------- | -------------------------------- |
| `PAPERLESS_REQUEST_TIMEOUT`       | integer | `30`                            | API request timeout (seconds)    |
| `PAPERLESS_CONNECT_TIMEOUT`       | integer | `10`                            | Connection timeout (seconds)     |
| `PAPERLESS_UPLOAD_TIMEOUT`        | integer | `300`                           | Upload timeout (5 minutes)       |
| `PAPERLESS_PROCESSING_TIMEOUT`    | integer | `1800`                          | Max processing time (30 minutes) |
| `PAPERLESS_STATUS_CHECK_INTERVAL` | integer | `10`                            | Status check interval (seconds)  |
| `PAPERLESS_MAX_UPLOAD_SIZE`       | integer | `52428800`                      | Max upload size (50MB)           |
| `PAPERLESS_RETRY_ATTEMPTS`        | integer | `3`                             | Number of retry attempts         |
| `PAPERLESS_SALT`                  | string  | `paperless_integration_salt_v1` | Encryption salt                  |

**Example:**

```env
PAPERLESS_REQUEST_TIMEOUT=60
PAPERLESS_UPLOAD_TIMEOUT=600
PAPERLESS_MAX_UPLOAD_SIZE=104857600  # 100MB
```

### Logging Configuration

| Variable             | Type    | Default  | Description                                    |
| -------------------- | ------- | -------- | ---------------------------------------------- |
| `LOG_LEVEL`          | string  | `INFO`   | Log level: `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `LOG_DIR`            | string  | `./logs` | Log directory path                             |
| `LOG_RETENTION_DAYS` | integer | `180`    | Days to keep logs                              |
| `ENABLE_DEBUG_LOGS`  | boolean | `false`  | Enable debug logging                           |

**Example:**

```env
LOG_LEVEL=INFO
LOG_DIR=/app/logs
LOG_RETENTION_DAYS=365
```

### Log Rotation Configuration

| Variable                    | Type    | Default | Description                                 |
| --------------------------- | ------- | ------- | ------------------------------------------- |
| `LOG_ROTATION_METHOD`       | string  | `auto`  | Method: `auto`, `python`, `logrotate`       |
| `LOG_ROTATION_SIZE`         | string  | `5M`    | Size threshold (e.g., `5M`, `10M`, `1G`)    |
| `LOG_ROTATION_TIME`         | string  | `daily` | Time interval: `daily`, `weekly`, `monthly` |
| `LOG_ROTATION_BACKUP_COUNT` | integer | `30`    | Number of rotated files to keep             |
| `LOG_COMPRESSION`           | boolean | `true`  | Compress rotated logs                       |

**Example:**

```env
LOG_ROTATION_METHOD=logrotate
LOG_ROTATION_SIZE=10M
LOG_ROTATION_TIME=daily
LOG_ROTATION_BACKUP_COUNT=60
LOG_COMPRESSION=true
```

In Docker, logrotate is automatically configured. See [Log Rotation](#log-rotation) section.

### Database Sequence Monitoring

| Variable                          | Type    | Default | Description                |
| --------------------------------- | ------- | ------- | -------------------------- |
| `ENABLE_SEQUENCE_MONITORING`      | boolean | `true`  | Enable sequence monitoring |
| `SEQUENCE_CHECK_ON_STARTUP`       | boolean | `true`  | Check sequences at startup |
| `SEQUENCE_AUTO_FIX`               | boolean | `true`  | Auto-fix sequence issues   |
| `SEQUENCE_MONITOR_INTERVAL_HOURS` | integer | `24`    | Monitoring interval        |

**Example:**

```env
ENABLE_SEQUENCE_MONITORING=true
SEQUENCE_CHECK_ON_STARTUP=true
SEQUENCE_AUTO_FIX=true
```

### Docker-Specific Variables

| Variable | Type    | Default            | Description                                 |
| -------- | ------- | ------------------ | ------------------------------------------- |
| `PUID`   | integer | `1000`             | User ID for file permissions (bind mounts)  |
| `PGID`   | integer | `1000`             | Group ID for file permissions (bind mounts) |
| `TZ`     | string  | `America/New_York` | Container timezone                          |

**Example:**

```env
PUID=1000
PGID=1000
TZ=Europe/London
```

## SSL/HTTPS Setup

### Using Self-Signed Certificates (Development/Testing)

#### 1. Generate Certificates

```bash
# Create certificates directory
mkdir certs
cd certs

# Generate self-signed certificate (valid for 1 year)
openssl req -x509 -newkey rsa:2048 \
  -keyout localhost.key \
  -out localhost.crt \
  -days 365 \
  -nodes \
  -subj "/CN=localhost"

cd ..
```

#### 2. Mount Certificates in Docker

Edit `docker-compose.yml`:

```yaml
volumes:
  - app_uploads:/app/uploads
  - app_logs:/app/logs
  - app_backups:/app/backups
  - ./certs:/app/certs:ro # Add this line
```

#### 3. Enable SSL

Update `.env`:

```env
ENABLE_SSL=true
```

#### 4. Restart Container

```bash
docker compose down
docker compose up -d
```

Access via: `https://localhost:8000`

**Note**: Browsers will show a security warning for self-signed certificates. Click "Advanced" and "Proceed to localhost".

### Using Let's Encrypt (Production)

For production, use Let's Encrypt with a reverse proxy (recommended) or certbot directly.

#### Option 1: With Reverse Proxy (Recommended)

Use Nginx, Caddy, or Traefik to handle SSL termination. See [Reverse Proxy Configuration](#reverse-proxy-configuration).

#### Option 2: Direct with Certbot

```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d medikeep.example.com

# Copy certificates
sudo cp /etc/letsencrypt/live/medikeep.example.com/fullchain.pem ./certs/medikeep.crt
sudo cp /etc/letsencrypt/live/medikeep.example.com/privkey.pem ./certs/medikeep.key
sudo chown $(id -u):$(id -g) ./certs/*

# Update .env
ENABLE_SSL=true
SSL_CERTFILE=/app/certs/medikeep.crt
SSL_KEYFILE=/app/certs/medikeep.key
```

Set up auto-renewal:

```bash
# Add to crontab
0 3 * * * certbot renew --post-hook "cp /etc/letsencrypt/live/medikeep.example.com/*.pem /path/to/certs/ && docker compose restart medikeep-app"
```

### Using Custom Certificates

If you have certificates from your organization:

```bash
# Copy certificates to certs directory
cp your-cert.crt certs/medikeep.crt
cp your-key.key certs/medikeep.key

# Update .env
ENABLE_SSL=true
SSL_CERTFILE=/app/certs/medikeep.crt
SSL_KEYFILE=/app/certs/medikeep.key
```

### Testing HTTPS

```bash
# Check certificate
openssl s_client -connect localhost:8000 -showcerts

# Test with curl
curl -k https://localhost:8000/health

# Check in browser
# Visit: https://localhost:8000
```

## Reverse Proxy Configuration

Using a reverse proxy is recommended for production to handle SSL termination, load balancing, and additional security.

### Nginx Configuration

#### Basic HTTP

```nginx
# /etc/nginx/sites-available/medikeep
server {
    listen 80;
    server_name medikeep.example.com;

    # Increase timeouts for large uploads
    client_max_body_size 100M;
    client_body_timeout 300s;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for long uploads
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Health check endpoint (optional)
    location /health {
        proxy_pass http://localhost:8000/health;
        access_log off;
    }
}
```

#### HTTPS with Let's Encrypt

```nginx
# /etc/nginx/sites-available/medikeep
server {
    listen 80;
    server_name medikeep.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name medikeep.example.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/medikeep.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/medikeep.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # HSTS (optional but recommended)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # File upload limits
    client_max_body_size 100M;
    client_body_timeout 300s;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        # Timeouts
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Static files caching (if serving static directly)
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        proxy_pass http://localhost:8000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable and test:

```bash
sudo ln -s /etc/nginx/sites-available/medikeep /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Apache Configuration

```apache
# /etc/apache2/sites-available/medikeep.conf
<VirtualHost *:80>
    ServerName medikeep.example.com
    Redirect permanent / https://medikeep.example.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName medikeep.example.com

    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/medikeep.example.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/medikeep.example.com/privkey.pem

    # Security headers
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"

    # Proxy configuration
    ProxyPreserveHost On
    ProxyPass / http://localhost:8000/
    ProxyPassReverse / http://localhost:8000/

    # Upload limits
    LimitRequestBody 104857600  # 100MB

    # Timeout settings
    ProxyTimeout 300
</VirtualHost>
```

Enable modules and site:

```bash
sudo a2enmod proxy proxy_http ssl headers
sudo a2ensite medikeep
sudo apache2ctl configtest
sudo systemctl reload apache2
```

### Traefik Configuration (Docker Labels)

```yaml
services:
  medikeep-app:
    image: ghcr.io/afairgiant/medikeep:latest
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.medikeep.rule=Host(`medikeep.example.com`)'
      - 'traefik.http.routers.medikeep.entrypoints=websecure'
      - 'traefik.http.routers.medikeep.tls.certresolver=letsencrypt'
      - 'traefik.http.services.medikeep.loadbalancer.server.port=8000'

      # HTTP to HTTPS redirect
      - 'traefik.http.routers.medikeep-http.rule=Host(`medikeep.example.com`)'
      - 'traefik.http.routers.medikeep-http.entrypoints=web'
      - 'traefik.http.routers.medikeep-http.middlewares=redirect-to-https'
      - 'traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https'
```

### Caddy Configuration

Caddy automatically handles HTTPS with Let's Encrypt:

```caddy
# Caddyfile
medikeep.example.com {
    reverse_proxy localhost:8000

    # Upload limits
    request_body {
        max_size 100MB
    }

    # Timeouts
    timeouts {
        read 5m
        write 5m
    }
}
```

Start Caddy:

```bash
caddy run --config Caddyfile
```

## Database Setup

### Using Docker Compose Database (Recommended)

The included `docker-compose.yml` already configures PostgreSQL. No additional setup needed.

### Using External PostgreSQL

If using an existing PostgreSQL server:

#### 1. Create Database

```sql
-- Connect as postgres user
psql -U postgres

-- Create database and user
CREATE DATABASE medical_records;
CREATE USER medapp WITH ENCRYPTED PASSWORD 'secure-password-here';
GRANT ALL PRIVILEGES ON DATABASE medical_records TO medapp;

-- Grant schema permissions
\c medical_records
GRANT ALL ON SCHEMA public TO medapp;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO medapp;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO medapp;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO medapp;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO medapp;
```

#### 2. Update docker-compose.yml

Remove the postgres service and update app environment:

```yaml
services:
  medikeep-app:
    image: ghcr.io/afairgiant/medikeep:latest
    environment:
      DB_HOST: your-postgres-host.example.com
      DB_PORT: 5432
      DB_NAME: medical_records
      DB_USER: medapp
      DB_PASSWORD: secure-password-here
      # ... other variables
```

### Database Performance Tuning

For production PostgreSQL, tune these settings in `postgresql.conf`:

```ini
# Connection settings
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1  # For SSD
effective_io_concurrency = 200  # For SSD
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
```

Restart PostgreSQL after changes:

```bash
sudo systemctl restart postgresql
```

### Running Migrations Manually

Migrations run automatically on container startup. To run manually:

```bash
# Inside container
docker exec -it medikeep-app python -m alembic -c alembic/alembic.ini upgrade head

# Or from host (if you have the code)
cd /path/to/medikeep
python -m alembic -c alembic/alembic.ini upgrade head
```

### Database Backup (PostgreSQL)

```bash
# Manual backup
docker exec medikeep-db pg_dump -U medapp medical_records > backup.sql

# Restore
docker exec -i medikeep-db psql -U medapp medical_records < backup.sql

# Automated backup (cron)
0 2 * * * docker exec medikeep-db pg_dump -U medapp medical_records | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz
```

See [Backup & Disaster Recovery](#backup--disaster-recovery) for application-level backups.

## Production Deployment Checklist

Use this checklist before going live:

### Security

- [ ] Changed default admin password (`ADMIN_DEFAULT_PASSWORD`)
- [ ] Set strong `SECRET_KEY` (minimum 32 random characters)
- [ ] Changed database password (`DB_PASSWORD`)
- [ ] Set `DEBUG=false`
- [ ] Enabled HTTPS (`ENABLE_SSL=true`)
- [ ] Configured SSL certificates (not self-signed)
- [ ] Database not exposed externally (removed port `5432` mapping)
- [ ] Reviewed SSO configuration (if enabled)
- [ ] Set up firewall rules
- [ ] Configured fail2ban or similar (optional)

### Data Protection

- [ ] Configured automated backups
- [ ] Tested backup restoration process
- [ ] Set appropriate `BACKUP_RETENTION_DAYS`
- [ ] Configured `TRASH_RETENTION_DAYS` for file recovery
- [ ] Backups stored on separate server/service
- [ ] Documented recovery procedures

### Performance

- [ ] Database on SSD storage
- [ ] Sufficient disk space allocated (100GB+ recommended)
- [ ] Reverse proxy configured with caching
- [ ] Log rotation enabled and tested
- [ ] Database performance tuned
- [ ] Resource limits set (Docker memory/CPU)

### Monitoring

- [ ] Log monitoring configured
- [ ] Health check endpoint monitored
- [ ] Disk space monitoring
- [ ] Database connection monitoring
- [ ] Alerting configured for critical issues
- [ ] Log retention policy defined

### Documentation

- [ ] Admin credentials documented securely
- [ ] Backup procedures documented
- [ ] Disaster recovery plan created
- [ ] Environment variables documented
- [ ] SSL certificate renewal process documented
- [ ] Contact information for on-call staff

### Testing

- [ ] Tested user registration flow
- [ ] Tested file uploads (photos, lab results)
- [ ] Tested backup creation and restoration
- [ ] Verified HTTPS redirects
- [ ] Tested under load (optional)
- [ ] Verified log rotation
- [ ] Tested on target browsers

### Compliance (if applicable)

- [ ] HIPAA compliance reviewed (if handling US PHI)
- [ ] GDPR compliance reviewed (if handling EU data)
- [ ] Data retention policies implemented
- [ ] Access logging enabled
- [ ] Encryption at rest configured (if required)
- [ ] Audit trail reviewed

## Cloud Deployment

### AWS Deployment

#### Using ECS Fargate

1. **Push image to ECR**:

```bash
# Authenticate
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag ghcr.io/afairgiant/medikeep:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/medikeep:latest
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/medikeep:latest
```

2. **Create RDS PostgreSQL instance**:

   - Engine: PostgreSQL 15.x
   - Instance class: db.t3.small or larger
   - Storage: 50GB GP3 SSD
   - Enable automated backups

3. **Create ECS Task Definition**:

```json
{
  "family": "medikeep",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "medikeep-app",
      "image": "YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/medikeep:latest",
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DB_HOST",
          "value": "your-rds-endpoint.region.rds.amazonaws.com"
        },
        { "name": "DB_NAME", "value": "medical_records" },
        { "name": "DB_USER", "value": "medapp" }
      ],
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:db-password"
        },
        {
          "name": "SECRET_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:secret-key"
        }
      ],
      "mountPoints": [
        {
          "sourceVolume": "efs-uploads",
          "containerPath": "/app/uploads"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/medikeep",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "medikeep"
        }
      }
    }
  ],
  "volumes": [
    {
      "name": "efs-uploads",
      "efsVolumeConfiguration": {
        "fileSystemId": "fs-xxxxx",
        "transitEncryption": "ENABLED"
      }
    }
  ]
}
```

4. **Create Application Load Balancer** with HTTPS listener

5. **Create ECS Service** with the task definition

#### Using EC2

```bash
# Install Docker
sudo yum update -y
sudo yum install docker -y
sudo service docker start
sudo usermod -a -G docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone or copy docker-compose.yml
mkdir medikeep
cd medikeep
# Copy docker-compose.yml and .env

# Start services
docker-compose up -d
```

### Google Cloud Platform

#### Using Cloud Run

1. **Build and push image**:

```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/medikeep
```

2. **Create Cloud SQL PostgreSQL instance**:

```bash
gcloud sql instances create medikeep-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1
```

3. **Deploy to Cloud Run**:

```bash
gcloud run deploy medikeep \
  --image gcr.io/PROJECT_ID/medikeep \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "DB_HOST=/cloudsql/PROJECT_ID:us-central1:medikeep-db" \
  --set-secrets "DB_PASSWORD=db-password:latest,SECRET_KEY=secret-key:latest" \
  --add-cloudsql-instances PROJECT_ID:us-central1:medikeep-db \
  --memory 2Gi \
  --cpu 1
```

### Azure

#### Using Container Instances

```bash
# Create resource group
az group create --name medikeep-rg --location eastus

# Create PostgreSQL
az postgres server create \
  --resource-group medikeep-rg \
  --name medikeep-db \
  --location eastus \
  --admin-user medapp \
  --admin-password SecurePassword123! \
  --sku-name B_Gen5_1

# Create database
az postgres db create \
  --resource-group medikeep-rg \
  --server-name medikeep-db \
  --name medical_records

# Deploy container
az container create \
  --resource-group medikeep-rg \
  --name medikeep-app \
  --image ghcr.io/afairgiant/medikeep:latest \
  --dns-name-label medikeep \
  --ports 8000 \
  --environment-variables \
    DB_HOST=medikeep-db.postgres.database.azure.com \
    DB_NAME=medical_records \
    DB_USER=medapp@medikeep-db \
  --secure-environment-variables \
    DB_PASSWORD=SecurePassword123! \
    SECRET_KEY=your-secret-key
```

### DigitalOcean

#### Using App Platform

1. Create `app.yaml`:

```yaml
name: medikeep
services:
  - name: web
    image:
      registry_type: GHCR
      registry: ghcr.io
      repository: afairgiant/medikeep
      tag: latest
    envs:
      - key: DB_HOST
        value: ${medikeep-db.HOSTNAME}
      - key: DB_PORT
        value: ${medikeep-db.PORT}
      - key: DB_NAME
        value: ${medikeep-db.DATABASE}
      - key: DB_USER
        value: ${medikeep-db.USERNAME}
      - key: DB_PASSWORD
        value: ${medikeep-db.PASSWORD}
        type: SECRET
      - key: SECRET_KEY
        value: your-secret-key
        type: SECRET
    http_port: 8000
    instance_count: 1
    instance_size_slug: basic-xs

databases:
  - name: medikeep-db
    engine: PG
    version: '15'
    size: db-s-1vcpu-1gb
```

2. Deploy:

```bash
doctl apps create --spec app.yaml
```

## Scaling & Performance

### Horizontal Scaling

To scale MediKeep horizontally, you need:

1. **Shared file storage** (not local volumes)
2. **Load balancer**
3. **Database connection pooling**

#### Example with NFS/EFS

```yaml
services:
  medikeep-app:
    image: ghcr.io/afairgiant/medikeep:latest
    deploy:
      replicas: 3
    volumes:
      - type: volume
        source: shared-uploads
        target: /app/uploads
        volume:
          nocopy: true
    environment:
      # Use external PostgreSQL
      DB_HOST: postgres.example.com

volumes:
  shared-uploads:
    driver: local
    driver_opts:
      type: nfs
      o: addr=nfs-server.example.com,rw
      device: ':/path/to/uploads'
```

### Database Connection Pooling

Use PgBouncer for connection pooling:

```yaml
services:
  pgbouncer:
    image: pgbouncer/pgbouncer
    environment:
      DATABASES_HOST: postgres
      DATABASES_PORT: 5432
      DATABASES_DBNAME: medical_records
      DATABASES_USER: medapp
      DATABASES_PASSWORD: ${DB_PASSWORD}
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 1000
      DEFAULT_POOL_SIZE: 20
    ports:
      - '6432:6432'

  medikeep-app:
    environment:
      DB_HOST: pgbouncer
      DB_PORT: 6432
```

### CDN for Static Files

Serve static files through a CDN:

```nginx
# Nginx configuration
location /static/ {
    proxy_pass http://localhost:8000;
    proxy_cache static_cache;
    proxy_cache_valid 200 1y;
    expires 1y;
    add_header Cache-Control "public, immutable";
}

proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=static_cache:10m max_size=1g;
```

### Caching Strategy

Implement Redis for session caching (requires code modifications):

```yaml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

## Monitoring & Logging

### Application Logs

#### Log Locations

All logs are stored in `/app/logs/` (or `LOG_DIR`):

- `app.log` - Application logs (API calls, user activity)
- `security.log` - Security events (failed logins, access attempts)

#### Accessing Logs

```bash
# Docker Compose
docker compose logs -f medikeep-app

# View application logs
docker exec medikeep-app tail -f /app/logs/app.log

# View security logs
docker exec medikeep-app tail -f /app/logs/security.log

# Search logs
docker exec medikeep-app grep "ERROR" /app/logs/app.log
```

### Log Rotation

MediKeep includes automatic log rotation using logrotate (in Docker) or Python rotation.

#### Docker (Automatic)

Logrotate is pre-configured in Docker images:

- Rotates when size exceeds 5MB OR daily (whichever comes first)
- Keeps 30 rotated files
- Compresses old logs
- Configuration: `/etc/logrotate.d/medikeep`

View rotation config:

```bash
docker exec medikeep-app cat /etc/logrotate.d/medikeep
```

Force rotation (testing):

```bash
docker exec medikeep-app logrotate -f /etc/logrotate.d/medikeep
```

#### Manual/Development

Set in `.env`:

```env
LOG_ROTATION_METHOD=python
LOG_ROTATION_SIZE=10M
LOG_ROTATION_TIME=daily
LOG_ROTATION_BACKUP_COUNT=30
LOG_COMPRESSION=true
```

See [LOG_ROTATION.md](../working_docs/Done%20or%20Semi%20Done/LOG_ROTATION.md) for details.

### Health Monitoring

#### Health Check Endpoint

```bash
curl http://localhost:8000/health
```

Response:

```json
{
  "status": "healthy",
  "version": "0.33.1",
  "database": "connected"
}
```

#### Docker Health Checks

Built into `docker-compose.yml`:

```bash
# Check container health
docker ps
# Look for "healthy" status

# View health check logs
docker inspect medikeep-app | jq '.[0].State.Health'
```

### Centralized Logging (Production)

#### Using ELK Stack

```yaml
services:
  elasticsearch:
    image: elasticsearch:8.10.0
    environment:
      - discovery.type=single-node
      - 'ES_JAVA_OPTS=-Xms512m -Xmx512m'
    volumes:
      - es_data:/usr/share/elasticsearch/data

  logstash:
    image: logstash:8.10.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
      - app_logs:/logs:ro

  kibana:
    image: kibana:8.10.0
    ports:
      - '5601:5601'
    environment:
      ELASTICSEARCH_HOSTS: http://elasticsearch:9200

volumes:
  es_data:
```

#### Using Loki + Grafana

```yaml
services:
  loki:
    image: grafana/loki:latest
    ports:
      - '3100:3100'
    command: -config.file=/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:latest
    volumes:
      - app_logs:/var/log:ro
      - ./promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - '3000:3000'
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

### Metrics and Alerting

#### Basic Monitoring Script

```bash
#!/bin/bash
# monitor.sh - Basic health monitoring

check_health() {
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health)
    if [ "$response" != "200" ]; then
        echo "ALERT: MediKeep health check failed (HTTP $response)"
        # Send alert (email, Slack, PagerDuty, etc.)
    fi
}

check_disk() {
    usage=$(df /var/lib/docker/volumes | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$usage" -gt 80 ]; then
        echo "ALERT: Disk usage at ${usage}%"
    fi
}

check_health
check_disk
```

Add to crontab:

```bash
*/5 * * * * /path/to/monitor.sh
```

#### Using Prometheus

Create `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'medikeep'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics' # Requires adding metrics endpoint
```

## Backup & Disaster Recovery

### Application Backup System

MediKeep includes a comprehensive backup system accessible via:

1. **Admin Dashboard** (Web UI)
2. **Backup CLI** (Command-line for automation)

#### Backup Types

- **Database Only** - PostgreSQL dump
- **Files Only** - Uploaded photos, lab results
- **Full Backup** - Database + Files

### Using the Backup CLI

See [README_BACKUP_CLI.md](../../app/scripts/README_BACKUP_CLI.md) for complete documentation.

#### Creating Backups

```bash
# Database backup
docker exec medikeep-app backup_db

# Files backup
docker exec medikeep-app backup_files

# Full system backup (recommended)
docker exec medikeep-app backup_full "Daily automated backup"
```

#### Listing Backups

```bash
# List all backups
docker exec medikeep-app restore list

# List only database backups
docker exec medikeep-app restore list database
```

#### Restoring from Backup

```bash
# 1. Preview restore (ALWAYS do this first)
docker exec medikeep-app restore preview 123

# 2. Review warnings and get confirmation code

# 3. Execute restore with confirmation code
docker exec medikeep-app restore restore 123 123_1430
```

**Important**: The restore process automatically creates a safety backup before restoring.

### Automated Backup Schedule

#### Using Cron

```bash
# Add to host crontab
crontab -e
```

```cron
# Daily database backup at 2 AM
0 2 * * * docker exec medikeep-app backup_db "Daily automated backup" >> /var/log/medikeep-backup.log 2>&1

# Weekly full backup on Sunday at 3 AM
0 3 * * 0 docker exec medikeep-app backup_full "Weekly full backup" >> /var/log/medikeep-backup.log 2>&1

# Cleanup old backups monthly (handled by retention policy)
0 4 1 * * docker exec medikeep-app python -c "from app.services.backup_service import BackupService; BackupService().cleanup_old_backups()"
```

### Backup Retention Policy

Configure in `.env`:

```env
# Keep backups for 30 days
BACKUP_RETENTION_DAYS=30

# Always keep at least 5 backups
BACKUP_MIN_COUNT=5

# Warn if more than 50 backups
BACKUP_MAX_COUNT=50
```

### Backup Storage

#### Docker Volumes

Backups are stored in `/app/backups` volume:

```bash
# Backup the backup volume
docker run --rm \
  -v medikeep_app_backups:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/backups-$(date +%Y%m%d).tar.gz -C /data .
```

#### External Storage

Mount external storage for backups:

```yaml
volumes:
  - /mnt/nas/medikeep-backups:/app/backups
```

Or use cloud storage:

```bash
# Sync to S3
aws s3 sync /var/lib/docker/volumes/medikeep_app_backups/_data s3://my-bucket/medikeep-backups/

# Sync to Azure Blob
azcopy sync /var/lib/docker/volumes/medikeep_app_backups/_data "https://account.blob.core.windows.net/backups"
```

### Disaster Recovery Procedures

#### Complete System Failure

1. **Restore Infrastructure**:

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Create medikeep directory
mkdir -p /opt/medikeep
cd /opt/medikeep
```

2. **Restore Configuration**:

```bash
# Copy docker-compose.yml and .env from backups
# Or recreate from documentation
```

3. **Restore Data Volumes**:

```bash
# Restore backup volume
docker volume create medikeep_app_backups
docker run --rm \
  -v medikeep_app_backups:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/backups-20250104.tar.gz -C /data

# Create empty volumes
docker volume create medikeep_postgres_data
docker volume create medikeep_app_uploads
docker volume create medikeep_app_logs
```

4. **Start Services**:

```bash
docker compose up -d
```

5. **Restore from Backup**:

```bash
# List available backups
docker exec medikeep-app restore list

# Preview and restore
docker exec medikeep-app restore preview <backup_id>
docker exec medikeep-app restore restore <backup_id> <confirmation_code>
```

#### Data Corruption

1. **Identify corruption**: Check logs
2. **Stop services**: `docker compose down`
3. **Restore from last known good backup**
4. **Verify data integrity**
5. **Restart services**: `docker compose up -d`

### Testing Backup/Restore

**Test quarterly** to ensure backups work:

```bash
# 1. Create test backup
docker exec medikeep-app backup_full "Disaster recovery test"

# 2. Note the backup ID
BACKUP_ID=$(docker exec medikeep-app restore list | grep "Disaster recovery test" | awk '{print $1}')

# 3. In a TEST environment, restore
docker exec medikeep-app restore preview $BACKUP_ID
# Review and restore
docker exec medikeep-app restore restore $BACKUP_ID <confirmation_code>

# 4. Verify data integrity
# - Check patient records
# - Verify file uploads
# - Test login
```

Document results and update procedures as needed.

## Maintenance

### Updating MediKeep

#### Minor Updates

```bash
# Pull latest image
docker compose pull

# Restart with new image
docker compose up -d

# Verify update
docker compose logs -f medikeep-app
```

Database migrations run automatically.

#### Major Updates

For major version changes:

1. **Read release notes** for breaking changes
2. **Create full backup**:
   ```bash
   docker exec medikeep-app backup_full "Pre-upgrade backup v0.33.1 to v1.0.0"
   ```
3. **Update image tag** in docker-compose.yml (if pinned)
4. **Pull and restart**:
   ```bash
   docker compose pull
   docker compose up -d
   ```
5. **Monitor logs** for migration errors:
   ```bash
   docker compose logs -f medikeep-app
   ```
6. **Test critical functions**:
   - Login
   - Patient record access
   - File uploads
   - Backup creation

### Rolling Updates (Zero-Downtime)

For production with multiple instances:

```bash
# Update one instance at a time
docker service update --image ghcr.io/afairgiant/medikeep:latest medikeep-app

# Or with Docker Compose (automatic rolling update)
docker compose up -d --no-deps --scale medikeep-app=3
```

### Database Maintenance

#### Vacuum and Analyze

```bash
# Regular maintenance (weekly)
docker exec medikeep-db psql -U medapp -d medical_records -c "VACUUM ANALYZE;"

# Full vacuum (monthly, during low usage)
docker exec medikeep-db psql -U medapp -d medical_records -c "VACUUM FULL ANALYZE;"
```

Add to crontab:

```cron
0 3 * * 0 docker exec medikeep-db psql -U medapp -d medical_records -c "VACUUM ANALYZE;"
```

#### Re-index

```bash
# Reindex database (quarterly)
docker exec medikeep-db psql -U medapp -d medical_records -c "REINDEX DATABASE medical_records;"
```

### Log Cleanup

Logs are automatically rotated. Manual cleanup:

```bash
# Remove old rotated logs (older than 180 days)
docker exec medikeep-app find /app/logs -name "*.gz" -mtime +180 -delete

# Check log disk usage
docker exec medikeep-app du -sh /app/logs
```

### Docker Cleanup

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes (CAUTION)
docker volume prune

# Remove unused networks
docker network prune

# Complete cleanup (excludes volumes)
docker system prune -a
```

### Certificate Renewal

#### Let's Encrypt (with reverse proxy)

Automatic with Caddy. For Nginx/Apache:

```bash
# Test renewal
sudo certbot renew --dry-run

# Add to crontab
0 3 1 * * certbot renew --post-hook "systemctl reload nginx"
```

#### Manual Certificates

Replace certificates in `certs/` directory and restart:

```bash
# Copy new certificates
cp new-cert.crt certs/medikeep.crt
cp new-cert.key certs/medikeep.key

# Restart container
docker compose restart medikeep-app
```

## Troubleshooting

### Common Deployment Issues

#### Container Won't Start

**Symptoms**: Container exits immediately

**Diagnosis**:

```bash
# Check logs
docker compose logs medikeep-app

# Check container status
docker compose ps
```

**Common Causes**:

1. **Database connection failure**:

   ```bash
   # Check database is running
   docker compose ps postgres

   # Test connection
   docker exec medikeep-db pg_isready -U medapp
   ```

2. **Missing environment variables**:

   ```bash
   # Verify .env file exists
   cat .env

   # Check required variables
   docker compose config
   ```

3. **Port already in use**:

   ```bash
   # Check what's using port 8000
   sudo lsof -i :8000

   # Change APP_PORT in .env
   ```

#### Database Connection Problems

**Error**: `could not connect to server: Connection refused`

**Solutions**:

1. **Check database is healthy**:

   ```bash
   docker compose ps postgres
   docker compose logs postgres
   ```

2. **Verify credentials**:

   ```bash
   # Test connection
   docker exec medikeep-db psql -U medapp -d medical_records -c "SELECT 1;"
   ```

3. **Check network**:

   ```bash
   # Verify containers are on same network
   docker network ls
   docker network inspect medikeep_medikeep-network
   ```

4. **Reset database**:
   ```bash
   docker compose down -v  # WARNING: Deletes all data
   docker compose up -d
   ```

#### SSL/HTTPS Issues

**Error**: `HTTPS enabled but certificates not found`

**Solutions**:

1. **Verify certificate files**:

   ```bash
   # Check files exist
   ls -la certs/

   # Should show: localhost.crt, localhost.key
   ```

2. **Check volume mount**:

   ```bash
   # Verify mount in docker-compose.yml
   docker compose config | grep certs

   # Should show: - ./certs:/app/certs:ro
   ```

3. **Check inside container**:

   ```bash
   docker exec medikeep-app ls -la /app/certs/
   ```

4. **Regenerate certificates**:
   ```bash
   cd certs
   openssl req -x509 -newkey rsa:2048 -keyout localhost.key -out localhost.crt -days 365 -nodes -subj "/CN=localhost"
   docker compose restart medikeep-app
   ```

**Error**: Browser shows "NET::ERR_CERT_AUTHORITY_INVALID"

**Solution**: This is normal for self-signed certificates. Click "Advanced" → "Proceed to localhost". For production, use proper CA-signed certificates.

#### Permission Denied Errors

**Error**: `Permission denied: /app/uploads`

**Solutions**:

1. **Use Docker volumes** (recommended):

   ```yaml
   volumes:
     - app_uploads:/app/uploads # Not ./uploads
   ```

2. **Fix bind mount permissions**:

   ```bash
   # Set ownership
   sudo chown -R 1000:1000 uploads logs backups

   # Or use PUID/PGID
   PUID=1000 PGID=1000 docker compose up -d
   ```

See [BIND_MOUNT_PERMISSIONS.md](../BIND_MOUNT_PERMISSIONS.md) for complete guide.

#### Migration Failures

**Error**: `alembic.util.exc.CommandError: Can't locate revision identified by`

**Solutions**:

1. **Check migration status**:

   ```bash
   docker exec medikeep-app python -m alembic -c alembic/alembic.ini current
   docker exec medikeep-app python -m alembic -c alembic/alembic.ini history
   ```

2. **Force to head** (if database is empty):

   ```bash
   docker exec medikeep-app python -m alembic -c alembic/alembic.ini stamp head
   docker exec medikeep-app python -m alembic -c alembic/alembic.ini upgrade head
   ```

3. **Reset migrations** (WARNING: loses data):
   ```bash
   docker compose down
   docker volume rm medikeep_postgres_data
   docker compose up -d
   ```

### Performance Problems

#### Slow Application Response

**Diagnosis**:

```bash
# Check container resources
docker stats medikeep-app

# Check database performance
docker exec medikeep-db psql -U medapp -d medical_records -c "
SELECT pid, age(clock_timestamp(), query_start), usename, query
FROM pg_stat_activity
WHERE query != '<IDLE>' AND query NOT ILIKE '%pg_stat_activity%'
ORDER BY query_start desc;
"
```

**Solutions**:

1. **Increase container resources**:

   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2'
         memory: 4G
       reservations:
         cpus: '1'
         memory: 2G
   ```

2. **Tune PostgreSQL** (see [Database Performance Tuning](#database-performance-tuning))

3. **Enable caching** with reverse proxy

4. **Check disk I/O**:
   ```bash
   docker exec medikeep-db iostat -x 1
   ```

#### High Memory Usage

**Diagnosis**:

```bash
docker stats medikeep-app
```

**Solutions**:

1. **Reduce workers** (if customized)
2. **Adjust database connections**
3. **Enable log rotation**
4. **Clear old backups**:
   ```bash
   docker exec medikeep-app ls -lh /app/backups
   ```

### Log Analysis

#### Finding Errors

```bash
# Recent errors
docker exec medikeep-app grep -i error /app/logs/app.log | tail -20

# Failed logins
docker exec medikeep-app grep "failed login" /app/logs/security.log

# Database errors
docker compose logs postgres | grep -i error
```

#### Debug Mode

Enable detailed logging temporarily:

```env
# .env
LOG_LEVEL=DEBUG
DEBUG=true
```

Restart:

```bash
docker compose restart medikeep-app
```

**Remember**: Disable debug mode in production after troubleshooting.

### Getting Help

If issues persist:

1. **Check existing issues**: https://github.com/afairgiant/MediKeep/issues
2. **Collect diagnostic information**:

   ```bash
   # System info
   docker version
   docker compose version

   # Container status
   docker compose ps
   docker compose logs > medikeep-logs.txt

   # Configuration (remove secrets!)
   docker compose config
   ```

3. **Create GitHub issue** with:
   - MediKeep version
   - Docker version
   - docker-compose.yml (sanitized)
   - Error logs
   - Steps to reproduce

## Additional Resources

- **Main README**: [README.md](../../README.md)
- **Backup CLI Guide**: [README_BACKUP_CLI.md](../../app/scripts/README_BACKUP_CLI.md)
- **SSO Setup**: [SSO_SETUP_GUIDE.md](../SSO_SETUP_GUIDE.md)
- **SSO Quick Start**: [SSO_QUICK_START.md](../SSO_QUICK_START.md)
- **Bind Mount Permissions**: [BIND_MOUNT_PERMISSIONS.md](../BIND_MOUNT_PERMISSIONS.md)
- **Log Rotation**: [LOG_ROTATION.md](../working_docs/Done%20or%20Semi%20Done/LOG_ROTATION.md)
- **HTTPS Setup**: [README_HTTPS.md](../working_docs/Done%20or%20Semi%20Done/README_HTTPS.md)

---

**Last Updated**: 2025-10-05
**MediKeep Version**: 0.33.1
