"""
Admin API Router - Django-style admin interface backend

This module provides Django Admin-like functionality for the Medical Records system,
allowing administrators to manage all models through a unified interface.
"""

from fastapi import APIRouter

from app.api.v1.admin import (
    backup,
    bulk_operations,
    dashboard,
    maintenance,
    models,
    restore,
    trash_management,
)

router = APIRouter()

# Include admin sub-routers
router.include_router(dashboard.router, prefix="/dashboard", tags=["admin-dashboard"])

router.include_router(models.router, prefix="/models", tags=["admin-models"])

router.include_router(bulk_operations.router, prefix="/bulk", tags=["admin-bulk"])

router.include_router(backup.router, prefix="/backups", tags=["admin-backup"])

router.include_router(restore.router, prefix="/restore", tags=["admin-restore"])

router.include_router(trash_management.router, prefix="", tags=["admin-trash"])

router.include_router(maintenance.router, prefix="/maintenance", tags=["admin-maintenance"])

__all__ = ["router"]
