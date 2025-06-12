# Multi-stage build for React + FastAPI Medical Records System

# Stage 1: Build React frontend
FROM node:18-alpine AS frontend-build

WORKDIR /frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm install

# Copy frontend source
COPY frontend/ ./

# Build the React app
RUN npm run build

# Stage 2: Python backend with built React app
FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source files
COPY app/ ./app/
COPY run.py .

# Copy built React app from frontend stage
COPY --from=frontend-build /frontend/build ./static

# Create directories for logs and uploads
RUN mkdir -p logs uploads/labwork

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Change ownership of app directory to appuser
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Create a startup script that fixes permissions
USER root
RUN echo '#!/bin/bash\n\
chown -R appuser:appuser /app/logs /app/uploads 2>/dev/null || true\n\
exec su-exec appuser "$@"' > /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

# Install su-exec for user switching
RUN apt-get update && apt-get install -y su-exec && rm -rf /var/lib/apt/lists/*

# Start the application
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]