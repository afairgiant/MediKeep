# Multi-stage build for React + FastAPI MediKeep System

# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-build

# DON'T set NODE_ENV=production yet - we need devDependencies (vite, rollup, esbuild) to build!
# We'll set it after npm install but before the final image
ENV VITE_API_URL=/api/v1
ENV CI=true
ENV GENERATE_SOURCEMAP=false

WORKDIR /frontend

# Copy package files first for better layer caching
COPY frontend/package.json frontend/package-lock.json* ./

# Install ALL dependencies (including devDependencies - we need vite/rollup/esbuild to build!)
# Use npm ci for reproducible builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=optional --silent --no-audit --no-fund

# Copy frontend source (node_modules is already ignored by .dockerignore)
COPY frontend/ ./

# Copy shared data directory (test library JSON, etc.) - needed for relative imports
COPY shared/ ../shared/

# Clean up test files
RUN find . -name "*.test.js" -o -name "*.test.jsx" -o -name "*.spec.js" -o -name "*.spec.jsx" | xargs rm -f && \
    rm -rf src/__tests__ src/**/__tests__

# Build the React app with optimizations and ignore ESLint warnings
RUN --mount=type=cache,target=/frontend/.cache \
    cp .eslintrc.production.js .eslintrc.js 2>/dev/null || true && \
    CI=false ESLINT_NO_DEV_ERRORS=true DISABLE_ESLINT_PLUGIN=true npm run build && \
    # Remove source maps and unnecessary files for production
    find build -name "*.map" -delete && \
    # Remove development dependencies after build to reduce layer size
    npm prune --production

# Stage 2: Python backend with built React app
FROM python:3.12-slim-bookworm AS backend

# Set Python environment variables for optimization
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONHASHSEED=random \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    LOG_ROTATION_METHOD=logrotate

# Install system dependencies in a single layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    bash \
    postgresql-client \
    gosu \
    logrotate \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user early for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set work directory
WORKDIR /app

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install Python dependencies with cache mount for faster builds
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy backend source files
COPY app/ ./app/
COPY run.py .

# Copy shared data directory (test library JSON, etc.)
COPY shared/ ./shared/

# Copy Alembic migrations and configuration
COPY alembic/ ./alembic/

# Copy and setup logrotate configuration
COPY config/logrotate.conf /etc/logrotate.d/medikeep
RUN chmod 644 /etc/logrotate.d/medikeep

# Copy built React app from frontend stage
COPY --from=frontend-build /frontend/build ./static

# Copy entrypoint script and set proper permissions
COPY docker/entrypoint.sh /app/entrypoint.sh

# Fix line endings for all script files (Windows to Unix conversion)
RUN find /app/app/scripts -type f \( -name "*.py" -o -name "backup_*" -o -name "restore*" \) -exec sed -i 's/\r$//' {} \; && \
    find /app -name "entrypoint.sh" -exec sed -i 's/\r$//' {} \;

# Create directories including certs mount point and set all permissions in one layer
RUN mkdir -p logs uploads/labwork uploads/photos/patients backups certs /usr/local/bin && \
    chmod +x /app/entrypoint.sh && \
    chmod +x /app/app/scripts/backup_db && \
    chmod +x /app/app/scripts/backup_files && \
    chmod +x /app/app/scripts/backup_full && \
    chmod +x /app/app/scripts/backup_cli.py && \
    chmod +x /app/app/scripts/test_backup_cli.py && \
    chmod +x /app/app/scripts/restore_cli.py && \
    chmod +x /app/app/scripts/restore && \
    chmod +x /app/app/scripts/test_restore_cli.py && \
    ln -sf /app/app/scripts/backup_db /usr/local/bin/backup_db && \
    ln -sf /app/app/scripts/backup_files /usr/local/bin/backup_files && \
    ln -sf /app/app/scripts/backup_full /usr/local/bin/backup_full && \
    ln -sf /app/app/scripts/restore /usr/local/bin/restore && \
    chown -R appuser:appuser /app

# Note: We start as root and switch to appuser in entrypoint.sh to allow PUID/PGID configuration
# USER appuser

# Expose port
EXPOSE 8000

# Add labels for better maintenance
LABEL maintainer="afairgiant" \
        version="0.7.0" \
        description="MediKeep - Your personal health record keeper"

# Health check with support for both HTTP and HTTPS
HEALTHCHECK --interval=120s --timeout=15s --start-period=60s --retries=2 \
    CMD curl -f -k http://localhost:8000/health || exit 1

# Start the application with migrations (using absolute path)
CMD ["/app/entrypoint.sh"]