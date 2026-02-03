# Installation Guide

This guide covers how to install and set up MediKeep for personal or family use.

---

## Quick Start (Docker)

The fastest way to get MediKeep running:

```bash
# Clone the repository
git clone https://github.com/afairgiant/MediKeep.git
cd MediKeep

# Copy and configure environment
cp docker/.env.example .env

# Start MediKeep
docker compose up -d
```

Access MediKeep at: **http://localhost:8005**

Default credentials: `admin` / `admin123`

> **Important:** Change the default password immediately after first login!

---

## System Requirements

### Minimum

| Resource | Requirement |
|----------|-------------|
| CPU | 2 cores |
| RAM | 2 GB |
| Disk | 20 GB |
| OS | Linux, macOS, or Windows with Docker |

### Recommended

| Resource | Requirement |
|----------|-------------|
| CPU | 4 cores |
| RAM | 4 GB |
| Disk | 50 GB SSD |

---

## Installation Options

### Option 1: Docker (Recommended)

**Prerequisites:**
- Docker 24.0+
- Docker Compose v2

**Steps:**

1. **Clone the repository**
   ```bash
   git clone https://github.com/afairgiant/MediKeep.git
   cd MediKeep
   ```

2. **Configure environment**
   ```bash
   cp docker/.env.example .env
   ```

   Edit `.env` and set:
   - `SECRET_KEY` - A random secure string
   - `DB_PASSWORD` - Database password
   - Any other settings you want to customize

3. **Start the application**
   ```bash
   docker compose up -d
   ```

4. **Verify it's running**
   ```bash
   docker compose ps
   ```

5. **Access MediKeep**
   - URL: http://localhost:8005
   - Login: admin / admin123

### Option 2: Manual Installation

For development or when Docker isn't available.

**Prerequisites:**
- Python 3.12+
- Node.js 18+
- PostgreSQL 15+

**Backend Setup:**

```bash
# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate

# Activate (Linux/macOS)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database settings

# Run migrations
alembic upgrade head

# Start backend
python run.py
```

**Frontend Setup:**

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

---

## Configuration

### Essential Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | JWT signing key | (required) |
| `DB_HOST` | Database host | localhost |
| `DB_PORT` | Database port | 5432 |
| `DB_NAME` | Database name | medikeep |
| `DB_USER` | Database user | medikeep |
| `DB_PASSWORD` | Database password | (required) |

### Optional Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging verbosity | INFO |
| `MAX_UPLOAD_SIZE` | Max file upload size | 15MB |
| `CORS_ORIGINS` | Allowed frontend URLs | * |
| `SSO_ENABLED` | Enable SSO login | false |

See the [Deployment Guide](Deployment-Guide#environment-variables-reference) for all options.

---

## Post-Installation

### 1. Change Default Password

Immediately after first login:
1. Click your username → **Profile**
2. Go to **Security**
3. Change your password

### 2. Create Patient Profiles

1. Go to **Patients**
2. Click **Add Patient**
3. Add yourself and any family members

### 3. Configure Backups

Set up regular backups:
```bash
# Database backup
docker compose exec db pg_dump -U medikeep medikeep > backup.sql

# Or use the built-in backup feature in Admin panel
```

### 4. (Optional) Enable HTTPS

For production use, configure SSL. See [Deployment Guide](Deployment-Guide#sslhttps-setup).

### 5. (Optional) Configure SSO

Enable Google/GitHub login. See [SSO Quick Start](SSO-Quick-Start).

---

## Updating

### Docker

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose down
docker compose up -d --build

# Run any new migrations
docker compose exec app alembic upgrade head
```

### Manual Installation

```bash
# Pull latest code
git pull

# Update backend dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Update frontend
cd frontend
npm install
npm run build
```

---

## Troubleshooting

### Container won't start

Check logs:
```bash
docker compose logs app
docker compose logs db
```

### Database connection error

Verify PostgreSQL is running:
```bash
docker compose ps db
```

Check credentials in `.env` match the database.

### Port already in use

Change the port in `.env`:
```
APP_PORT=8006
```

### Permission denied on uploads

Fix volume permissions:
```bash
sudo chown -R 1000:1000 ./uploads
```

---

## Next Steps

- [User Guide](User-Guide) - Learn how to use MediKeep
- [Deployment Guide](Deployment-Guide) - Production deployment
- [FAQ](FAQ) - Common questions
