# Multi-stage build for React + FastAPI Medical Records System

# Stage 1: Build React frontend
FROM node:18-alpine AS frontend-build

# Set NODE_ENV for optimization
ENV NODE_ENV=production
ENV REACT_APP_API_URL=""

WORKDIR /frontend

# Copy package files first for better layer caching
COPY frontend/package*.json ./

# Install dependencies
RUN npm install --silent --no-audit --no-fund

# Copy frontend source
COPY frontend/ ./

# Build the React app with optimizations
RUN npm run build && \
    # Remove source maps and unnecessary files for production
    find build -name "*.map" -delete

# Stage 2: Python backend with built React app
FROM python:3.12-slim AS backend

# Set Python environment variables for optimization
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONHASHSEED=random \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies in a single layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user early for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set work directory
WORKDIR /app

# Copy requirements first for better layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source files
COPY app/ ./app/
COPY run.py .

# Copy built React app from frontend stage
COPY --from=frontend-build /frontend/build ./static

# Create directories and set permissions in one layer
RUN mkdir -p logs uploads/labwork && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Add labels for better maintenance
LABEL maintainer="afairgiant" \
      version="0.1.0" \
      description="Medical Records System - React + FastAPI"

# Health check with better configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start the application with better configuration
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]