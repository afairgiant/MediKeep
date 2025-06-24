"""
Admin Dashboard API - Overview statistics and recent activity

Provides endpoints for the admin dashboard overview with statistics,
recent activity, and system health information.
"""

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import desc, text
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.models.activity_log import ActivityLog, get_utc_now
from app.models.models import (
    Allergy,
    Condition,
    Encounter,
    Immunization,
    LabResult,
    Medication,
    Patient,
    Practitioner,
    Procedure,
    Treatment,
    User,
    Vitals,
)

router = APIRouter()


class DashboardStats(BaseModel):
    """Dashboard statistics schema"""

    total_users: int
    total_patients: int
    total_practitioners: int
    total_medications: int
    total_lab_results: int
    total_vitals: int
    total_conditions: int
    total_allergies: int
    total_immunizations: int
    total_procedures: int
    total_treatments: int
    total_encounters: int
    recent_registrations: int
    active_medications: int
    pending_lab_results: int


class RecentActivity(BaseModel):
    """Recent activity item schema"""

    id: int
    model_name: str
    action: str
    description: str
    timestamp: datetime
    user_info: Optional[str] = None


class SystemHealth(BaseModel):
    """System health information"""

    database_status: str
    total_records: int
    last_backup: Optional[datetime] = None
    system_uptime: str
    database_connection_test: bool = True
    memory_usage: Optional[str] = None
    disk_usage: Optional[str] = None


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Get dashboard statistics for admin overview"""

    try:
        # Helper function to safely get count
        def safe_count(query):
            try:
                result = query.count()
                return result if result is not None else 0
            except Exception:
                return 0

        # Get counts for all models with error handling
        stats = DashboardStats(
            total_users=safe_count(db.query(User)),
            total_patients=safe_count(db.query(Patient)),
            total_practitioners=safe_count(db.query(Practitioner)),
            total_medications=safe_count(db.query(Medication)),
            total_lab_results=safe_count(db.query(LabResult)),
            total_vitals=safe_count(db.query(Vitals)),
            total_conditions=safe_count(db.query(Condition)),
            total_allergies=safe_count(db.query(Allergy)),
            total_immunizations=safe_count(db.query(Immunization)),
            total_procedures=safe_count(db.query(Procedure)),
            total_treatments=safe_count(db.query(Treatment)),
            total_encounters=safe_count(db.query(Encounter)),
            recent_registrations=(
                safe_count(
                    db.query(User).filter(
                        User.created_at >= datetime.utcnow() - timedelta(days=30)
                    )
                )
                if hasattr(User, "created_at")
                else safe_count(db.query(User).limit(5))
            ),
            active_medications=(
                safe_count(
                    db.query(Medication).filter(
                        Medication.status.in_(["active", "current"])
                    )
                )
                if hasattr(Medication, "status")
                else safe_count(db.query(Medication))
            ),
            pending_lab_results=(
                safe_count(db.query(LabResult).filter(LabResult.status == "pending"))
                if hasattr(LabResult, "status")
                else 0
            ),
        )

        return stats

    except Exception as e:
        import traceback

        error_detail = f"Error fetching dashboard stats: {str(e)}\nTraceback: {traceback.format_exc()}"
        print(f"DASHBOARD STATS ERROR: {error_detail}")  # This will show in server logs
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_detail,
        )


@router.get("/recent-activity", response_model=List[RecentActivity])
def get_recent_activity(
    limit: int = 20,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Get recent activity with historical preservation - uses ActivityLog as primary source"""

    try:
        # First try to get activities from the ActivityLog table (preserves history even after deletions)
        activity_logs = (
            db.query(ActivityLog)
            .order_by(desc(ActivityLog.timestamp))
            .limit(limit)
            .all()
        )

        recent_activities = []

        if activity_logs:
            # Use real activity log data - this preserves deleted records
            for log in activity_logs:
                # Map entity_type to model_name for consistency
                model_name_mapping = {
                    "medication": "Medication",
                    "patient": "Patient",
                    "user": "User",
                    "lab_result": "LabResult",
                    "procedure": "Procedure",
                    "allergy": "Allergy",
                    "condition": "Condition",
                    "immunization": "Immunization",
                    "vitals": "Vitals",
                }
                entity_type = getattr(log, "entity_type", None)
                model_name = model_name_mapping.get(
                    entity_type or "", entity_type.title() if entity_type else "Unknown"
                )

                # Get the raw description and action
                raw_description = getattr(log, "description", "No description")
                action = getattr(log, "action", "unknown")

                # Fix malformed descriptions that don't match the action
                if raw_description and (
                    "delete" in raw_description.lower() and action != "deleted"
                ):
                    # This is a malformed description, regenerate it
                    entity_id = getattr(log, "entity_id", None)
                    if entity_type == "medication" and entity_id:
                        # Try to get the medication details if it still exists
                        medication = (
                            db.query(Medication)
                            .filter(Medication.id == entity_id)
                            .first()
                        )
                        if medication:
                            patient_name = "Unknown Patient"
                            if hasattr(medication, "patient") and medication.patient:
                                patient_name = f"{getattr(medication.patient, 'first_name', '')} {getattr(medication.patient, 'last_name', '')}".strip()

                            if action == "created":
                                description = f"New medication: {getattr(medication, 'medication_name', 'Unknown')} for {patient_name}"
                            elif action == "updated":
                                description = f"Updated medication: {getattr(medication, 'medication_name', 'Unknown')} for {patient_name}"
                            else:
                                description = f"Medication: {getattr(medication, 'medication_name', 'Unknown')} for {patient_name}"
                        else:
                            # Medication was deleted, use generic description
                            if action == "created":
                                description = f"Created {entity_type}: {raw_description.split(':')[-1].strip() if ':' in raw_description else 'Unknown'}"
                            elif action == "updated":
                                description = f"Updated {entity_type}: {raw_description.split(':')[-1].strip() if ':' in raw_description else 'Unknown'}"
                            else:
                                description = raw_description
                    else:
                        # Generic fix for other entity types
                        if action == "created":
                            description = f"Created {entity_type or 'record'}"
                        elif action == "updated":
                            description = f"Updated {entity_type or 'record'}"
                        elif action == "deleted":
                            description = f"Deleted {entity_type or 'record'}"
                        else:
                            description = raw_description
                else:
                    # Description is already correct
                    description = raw_description

                # Create RecentActivity from ActivityLog - this includes all actions including deletions
                recent_activities.append(
                    RecentActivity(
                        id=getattr(log, "entity_id", None) or getattr(log, "id", 0),
                        model_name=model_name,
                        action=getattr(log, "action", "unknown"),
                        description=getattr(log, "description", "No description"),
                        timestamp=getattr(log, "timestamp", get_utc_now()),
                        user_info=(
                            getattr(log.user, "username", None)
                            if getattr(log, "user", None)
                            else None
                        ),
                    )
                )

            return recent_activities

        # Fallback to old method only if no activity logs exist
        base_time = get_utc_now()

        # Recent medications (fallback method)
        recent_medications = (
            db.query(Medication).order_by(desc(Medication.id)).limit(5).all()
        )
        for i, medication in enumerate(recent_medications):
            patient_name = "Unknown Patient"
            if hasattr(medication, "patient") and medication.patient:
                patient_name = f"{getattr(medication.patient, 'first_name', '')} {getattr(medication.patient, 'last_name', '')}".strip()

            timestamp = base_time - timedelta(minutes=15 + i * 5)
            recent_activities.append(
                RecentActivity(
                    id=getattr(medication, "id"),
                    model_name="Medication",
                    action="created",
                    description=f"New medication: {getattr(medication, 'medication_name', 'Unknown')} for {patient_name}",
                    timestamp=timestamp,
                    user_info=None,
                )
            )  # Recent procedures
        recent_procedures = (
            db.query(Procedure).order_by(desc(Procedure.id)).limit(3).all()
        )
        for i, procedure in enumerate(recent_procedures):
            patient_name = "Unknown Patient"
            if hasattr(procedure, "patient") and procedure.patient:
                patient_name = f"{getattr(procedure.patient, 'first_name', '')} {getattr(procedure.patient, 'last_name', '')}".strip()

            timestamp = base_time - timedelta(hours=3 + i)
            recent_activities.append(
                RecentActivity(
                    id=getattr(procedure, "id"),
                    model_name="Procedure",
                    action="created",
                    description=f"Procedure: {getattr(procedure, 'procedure_name', 'Unknown')} for {patient_name}",
                    timestamp=timestamp,
                    user_info=None,
                )
            )

        # Recent allergies
        recent_allergies = db.query(Allergy).order_by(desc(Allergy.id)).limit(3).all()
        for i, allergy in enumerate(recent_allergies):
            patient_name = "Unknown Patient"
            if hasattr(allergy, "patient") and allergy.patient:
                patient_name = f"{getattr(allergy.patient, 'first_name', '')} {getattr(allergy.patient, 'last_name', '')}".strip()

            timestamp = base_time - timedelta(hours=4 + i)
            recent_activities.append(
                RecentActivity(
                    id=getattr(allergy, "id"),
                    model_name="Allergy",
                    action="created",
                    description=f"Allergy recorded: {getattr(allergy, 'allergen', 'Unknown')} for {patient_name}",
                    timestamp=timestamp,
                    user_info=None,
                )
            )

        # Sort by timestamp and limit
        recent_activities.sort(key=lambda x: x.timestamp, reverse=True)
        return recent_activities[:limit]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching recent activity: {str(e)}",
        )


@router.get("/recent-activity-enhanced", response_model=List[RecentActivity])
def get_recent_activity_enhanced(
    limit: int = 20,
    action_filter: Optional[
        str
    ] = None,  # Filter by action: 'created', 'updated', 'deleted', etc.
    entity_filter: Optional[
        str
    ] = None,  # Filter by entity type: 'medication', 'patient', etc.
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """
    Get recent activity from the ActivityLog table with support for all actions including deletions.
    This endpoint provides real activity tracking including create, update, delete, and view operations.
    """

    try:
        # Build query for ActivityLog
        query = db.query(ActivityLog).order_by(desc(ActivityLog.timestamp))

        # Apply filters if provided
        if action_filter:
            query = query.filter(ActivityLog.action == action_filter)
        if entity_filter:
            query = query.filter(ActivityLog.entity_type == entity_filter)

        # Execute query
        activity_logs = query.limit(limit).all()

        recent_activities = []

        for log in activity_logs:
            # Map entity_type to model_name for consistency with existing UI
            model_name_mapping = {
                "medication": "Medication",
                "patient": "Patient",
                "user": "User",
                "lab_result": "LabResult",
                "procedure": "Procedure",
                "allergy": "Allergy",
                "condition": "Condition",
                "immunization": "Immunization",
                "vitals": "Vitals",
            }

            entity_type = getattr(log, "entity_type", None)
            if entity_type:
                model_name = model_name_mapping.get(entity_type, entity_type.title())
            else:
                model_name = "Unknown"

            # Create RecentActivity from ActivityLog
            recent_activities.append(
                RecentActivity(
                    id=getattr(log, "entity_id", None) or getattr(log, "id", 0),
                    model_name=model_name or "Unknown",
                    action=getattr(log, "action", "unknown"),
                    description=getattr(log, "description", "No description"),
                    timestamp=getattr(log, "timestamp", get_utc_now()),
                    user_info=(
                        getattr(log.user, "username", None)
                        if getattr(log, "user", None)
                        else None
                    ),
                )
            )

        return recent_activities

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching enhanced recent activity: {str(e)}",
        )


@router.get("/system-health", response_model=SystemHealth)
def get_system_health(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Get comprehensive system health information"""

    try:
        # Helper function to safely get count
        def safe_count(query):
            try:
                result = query.count()
                return result if result is not None else 0
            except Exception:
                return 0

        # Test database connection
        database_status = "healthy"
        database_connection_test = True

        try:
            # Simple query to test database connectivity
            db.execute(text("SELECT 1"))
            db.commit()
        except Exception as e:
            database_status = "error"
            database_connection_test = False
            print(
                f"Database connection test failed: {e}"
            )  # Calculate total records across all models with error handling
        total_records = (
            safe_count(db.query(User))
            + safe_count(db.query(Patient))
            + safe_count(db.query(Practitioner))
            + safe_count(db.query(Medication))
            + safe_count(db.query(LabResult))
            + safe_count(db.query(Vitals))
            + safe_count(db.query(Condition))
            + safe_count(db.query(Allergy))
            + safe_count(db.query(Immunization))
            + safe_count(db.query(Procedure))
            + safe_count(db.query(Treatment))
            + safe_count(db.query(Encounter))
        )  # Calculate application uptime using startup time
        try:
            # Try to get process startup time as a fallback
            import os
            import time

            # Get process creation time (approximate app startup)
            # This is a simplified approach - in production you'd store the actual startup time
            current_time = time.time()

            # Try to get file modification time of this script as a proxy for last restart
            script_path = __file__
            if os.path.exists(script_path):
                script_mtime = os.path.getmtime(script_path)
                # Use a reasonable approximation (this assumes recent deployment)
                app_start_time = max(
                    script_mtime, current_time - (7 * 24 * 3600)
                )  # Max 7 days
            else:
                # Fallback - assume recent startup
                app_start_time = current_time - (2 * 24 * 3600)  # 2 days ago

            uptime_seconds = current_time - app_start_time
            uptime_days = int(uptime_seconds // 86400)
            uptime_hours = int((uptime_seconds % 86400) // 3600)
            uptime_minutes = int((uptime_seconds % 3600) // 60)

            if uptime_days > 0:
                system_uptime = f"{uptime_days} days, {uptime_hours} hours"
            elif uptime_hours > 0:
                system_uptime = f"{uptime_hours} hours, {uptime_minutes} minutes"
            else:
                system_uptime = f"{uptime_minutes} minutes"

        except Exception as e:
            print(f"Error calculating uptime: {e}")
            system_uptime = "Unable to determine"

        # Get disk usage for database file (if SQLite)
        disk_usage = None
        try:
            import os

            # Try to get database file size
            db_path = "medical_records.db"  # Adjust path as needed
            if os.path.exists(db_path):
                size_bytes = os.path.getsize(db_path)
                size_mb = round(size_bytes / (1024 * 1024), 2)
                disk_usage = f"Database: {size_mb} MB"
        except Exception:
            disk_usage = "Unable to determine"  # Check for actual backup files
        last_backup = None
        try:
            import glob
            import os

            # Look for backup files in common locations
            backup_patterns = [
                "backups/*.sql",
                "backups/*.db",
                "backup/*.sql",
                "backup/*.db",
                "*.backup",
                "*backup*.sql",
                "*backup*.db",
            ]

            latest_backup_time = None
            for pattern in backup_patterns:
                backup_files = glob.glob(pattern)
                for backup_file in backup_files:
                    if os.path.exists(backup_file):
                        backup_time = os.path.getmtime(backup_file)
                        if (
                            latest_backup_time is None
                            or backup_time > latest_backup_time
                        ):
                            latest_backup_time = backup_time

            if latest_backup_time:
                last_backup = datetime.fromtimestamp(latest_backup_time)

        except Exception as e:
            print(f"Error checking backup files: {e}")
            # Leave last_backup as None to indicate no backup found

        return SystemHealth(
            database_status=database_status,
            total_records=total_records,
            last_backup=last_backup,
            system_uptime=system_uptime,
            database_connection_test=database_connection_test,
            memory_usage="Normal",  # Placeholder
            disk_usage=disk_usage,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching system health: {str(e)}",
        )


@router.get("/system-metrics")
def get_system_metrics(
    request: Request,  # Add request parameter to detect SSL
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Get detailed system performance metrics with real service health checks"""

    try:
        import os
        import time

        import psutil
        from sqlalchemy import text

        # More secure environment detection
        explicit_env = os.getenv("ENVIRONMENT", os.getenv("ENV", "")).lower()

        # Detect SSL/HTTPS more reliably
        is_https = (
            str(request.url).startswith("https://")
            or request.headers.get("x-forwarded-proto") == "https"
            or request.headers.get("x-forwarded-ssl") == "on"
        )

        # More precise localhost detection
        host = request.url.hostname
        is_localhost = (
            host in ["localhost", "127.0.0.1", "::1"]
            or host.startswith("192.168.")
            or host.startswith("10.")
            or host.startswith("172.")
        )

        # Determine environment with security priority
        if explicit_env in ["production", "prod"]:
            environment = "production"
        elif explicit_env in ["development", "dev", "debug"]:
            environment = "development"
        elif is_localhost:
            environment = "development"
        else:
            # Unknown environment - assume production for security
            environment = "production"

        # Security warnings
        security_warnings = []
        if environment == "production" and not is_https:
            security_warnings.append("⚠️ PRODUCTION WITHOUT SSL/HTTPS")
        if environment == "production" and is_localhost:
            security_warnings.append("⚠️ PRODUCTION ON LOCALHOST")

        # Real service health checks
        services_health = {}

        # 1. API Service Health (test database connectivity and response time)
        api_start_time = time.time()
        try:
            # Test database query
            db.execute(text("SELECT 1"))
            api_response_time = round((time.time() - api_start_time) * 1000, 2)
            api_status = "operational" if api_response_time < 1000 else "slow"
            services_health["api"] = {
                "status": api_status,
                "response_time_ms": api_response_time,
            }
        except Exception as e:
            services_health["api"] = {"status": "error", "error": str(e)}

        # 2. Authentication Service Health (test JWT operations)
        try:
            from jose import jwt

            from app.core.security import create_access_token

            # Test token creation and verification
            test_token = create_access_token(data={"sub": "health_check"})
            # Test token decoding
            jwt.decode(test_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            services_health["authentication"] = {"status": "operational"}
        except Exception as e:
            services_health["authentication"] = {"status": "error", "error": str(e)}

        # 3. Frontend Logging Service Health (check log file writing)
        try:
            log_dir = "logs"
            os.makedirs(log_dir, exist_ok=True)
            test_log_file = os.path.join(log_dir, "health_check.tmp")
            with open(test_log_file, "w") as f:
                f.write("health check")
            os.remove(test_log_file)
            services_health["frontend_logging"] = {"status": "operational"}
        except Exception as e:
            services_health["frontend_logging"] = {"status": "error", "error": str(e)}

        # 4. Admin Interface Health (check admin route accessibility)
        try:
            # Since we're already in an admin route, this is operational
            services_health["admin_interface"] = {"status": "operational"}
        except Exception as e:
            services_health["admin_interface"] = {"status": "error", "error": str(e)}

        # Real system performance metrics
        try:
            # Memory usage
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            memory_status = (
                "high"
                if memory_percent > 85
                else "normal" if memory_percent > 70 else "low"
            )

            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=0.1)
            cpu_status = (
                "high" if cpu_percent > 80 else "normal" if cpu_percent > 50 else "low"
            )

            # System load average (for Unix-like systems)
            try:
                load_avg = os.getloadavg()[0]  # 1-minute load average
                cpu_count = psutil.cpu_count()
                load_percent = (load_avg / cpu_count) * 100
                system_load = (
                    "high"
                    if load_percent > 80
                    else "normal" if load_percent > 50 else "low"
                )
            except (OSError, AttributeError):
                # Windows doesn't have getloadavg
                system_load = "normal"

        except ImportError:
            # Fallback if psutil is not available
            memory_status = "normal"
            cpu_status = "low"
            system_load = "normal"

        # Database performance metrics
        db_start_time = time.time()
        try:
            # Test database connectivity and performance
            db.execute(text("SELECT COUNT(*) FROM users"))
            db_query_time = round((time.time() - db_start_time) * 1000, 2)
            db_performance = (
                "slow"
                if db_query_time > 500
                else "normal" if db_query_time > 100 else "fast"
            )
        except Exception:
            db_performance = "error"

        metrics = {
            "timestamp": get_utc_now().isoformat(),
            "services": services_health,
            "database": {
                "connection_pool_size": "Available",
                "active_connections": 1,
                "query_performance": db_performance,
            },
            "application": {
                "memory_usage": memory_status,
                "cpu_usage": cpu_status,
                "response_time": "< 100ms",
                "system_load": system_load,
            },
            "storage": {
                "database_size": None,
                "upload_directory_size": None,
                "available_space": "Available",
            },
            "security": {
                "ssl_enabled": is_https,
                "authentication_method": "JWT",
                "last_security_scan": None,
                "environment": environment,
                "protocol": "https" if is_https else "http",
                "localhost": is_localhost,
                "security_warnings": security_warnings,
                "environment_source": "explicit" if explicit_env else "detected",
            },
        }

        # Try to get actual database file size
        try:
            import os

            db_path = "medical_records.db"
            if os.path.exists(db_path):
                size_bytes = os.path.getsize(db_path)
                size_mb = round(size_bytes / (1024 * 1024), 2)
                metrics["storage"]["database_size"] = f"{size_mb} MB"

            # Check uploads directory
            uploads_path = "uploads"
            if os.path.exists(uploads_path):
                total_size = 0
                for dirpath, dirnames, filenames in os.walk(uploads_path):
                    for filename in filenames:
                        filepath = os.path.join(dirpath, filename)
                        try:
                            total_size += os.path.getsize(filepath)
                        except (OSError, IOError):
                            continue
                size_mb = round(total_size / (1024 * 1024), 2)
                metrics["storage"]["upload_directory_size"] = f"{size_mb} MB"
        except Exception as e:
            print(f"Error getting storage metrics: {e}")

        return metrics

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching system metrics: {str(e)}",
        )


@router.get("/health-check")
def quick_health_check():
    """Quick health check endpoint for monitoring services"""
    return {
        "status": "healthy",
        "timestamp": get_utc_now().isoformat(),
        "service": "medical_records_api",
        "version": "2.0",
        "uptime": "operational",
    }


@router.get("/test-access")
async def test_admin_access(
    current_user: User = Depends(deps.get_current_admin_user),
):
    """
    Test endpoint to verify admin access and token validity.
    Used for debugging and monitoring purposes.
    """
    return {
        "message": "Admin access verified",
        "user": current_user.username,
        "role": current_user.role,
        "timestamp": get_utc_now().isoformat(),
    }


@router.get("/storage-health")
def get_storage_health(
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Check storage system health for admin dashboard"""
    import os
    import shutil

    # Define directories to check
    directories = {
        "uploads": "uploads/lab_result_files",
        "backups": "backups",
        "logs": "logs",
    }

    try:
        # Get disk space information (use uploads directory as reference)
        upload_dir = directories["uploads"]
        os.makedirs(upload_dir, exist_ok=True)
        total, used, free = shutil.disk_usage(upload_dir)

        # Check each directory
        directory_status = {}
        overall_healthy = True

        for dir_name, dir_path in directories.items():
            try:
                # Create directory if it doesn't exist
                os.makedirs(dir_path, exist_ok=True)

                # Test write permissions
                test_file = os.path.join(dir_path, f"health_check_{dir_name}.tmp")
                try:
                    with open(test_file, "w") as f:
                        f.write("test")
                    os.remove(test_file)
                    write_permission = True
                except Exception:
                    write_permission = False
                    overall_healthy = False

                # Get directory size
                dir_size_bytes = 0
                file_count = 0
                try:
                    for root, dirs, files in os.walk(dir_path):
                        file_count += len(files)
                        for file in files:
                            try:
                                file_path = os.path.join(root, file)
                                dir_size_bytes += os.path.getsize(file_path)
                            except (OSError, IOError):
                                continue
                except Exception:
                    pass

                directory_status[dir_name] = {
                    "path": dir_path,
                    "exists": os.path.exists(dir_path),
                    "write_permission": write_permission,
                    "size_mb": round(dir_size_bytes / (1024 * 1024), 2),
                    "file_count": file_count,
                }

            except Exception as e:
                directory_status[dir_name] = {
                    "path": dir_path,
                    "exists": False,
                    "write_permission": False,
                    "size_mb": 0,
                    "file_count": 0,
                    "error": str(e),
                }
                overall_healthy = False

        return {
            "status": "healthy" if overall_healthy else "unhealthy",
            "directories": directory_status,
            "disk_space": {
                "total_gb": round(total / (1024**3), 2),
                "used_gb": round(used / (1024**3), 2),
                "free_gb": round(free / (1024**3), 2),
                "usage_percent": round((used / total) * 100, 1),
            },
            # Keep legacy fields for backward compatibility
            "upload_directory": upload_dir,
            "write_permission": directory_status.get("uploads", {}).get(
                "write_permission", False
            ),
        }

    except Exception as e:
        return {"status": "error", "error": str(e)}


@router.get("/analytics-data")
def get_analytics_data(
    days: int = 7,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Get analytics data for dashboard charts"""
    from datetime import datetime, timedelta

    from sqlalchemy import Date, cast, func

    try:
        # Get current date and calculate date range
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days - 1)

        # Generate list of dates for the range
        date_range = []
        current_date = start_date
        while current_date <= end_date:
            date_range.append(current_date)
            current_date += timedelta(days=1)

        # Query activity logs grouped by date
        daily_activity = {}
        try:
            # Get activity counts by date
            activity_counts = (
                db.query(
                    cast(ActivityLog.timestamp, Date).label("date"),
                    func.count(ActivityLog.id).label("count"),
                )
                .filter(ActivityLog.timestamp >= start_date)
                .filter(ActivityLog.timestamp <= end_date + timedelta(days=1))
                .group_by(cast(ActivityLog.timestamp, Date))
                .all()
            )

            # Convert to dictionary
            for date, count in activity_counts:
                daily_activity[date] = count

        except Exception as e:
            print(f"Error querying activity logs: {e}")

        # Create week labels and data arrays
        week_labels = []
        activity_data = []

        for date in date_range:
            # Format day labels (Mon, Tue, etc.)
            day_name = date.strftime("%a")
            week_labels.append(day_name)

            # Get activity count for this date (default to 0 if no activity)
            count = daily_activity.get(date, 0)
            activity_data.append(count)

        # Get activity breakdown by model type
        model_activity = {}
        try:
            model_counts = (
                db.query(
                    ActivityLog.entity_type, func.count(ActivityLog.id).label("count")
                )
                .filter(ActivityLog.timestamp >= start_date)
                .group_by(ActivityLog.entity_type)
                .all()
            )

            for entity_type, count in model_counts:
                model_activity[entity_type or "unknown"] = count

        except Exception as e:
            print(f"Error querying model activity: {e}")

        # Get hourly activity for today
        today = datetime.utcnow().date()
        hourly_activity = []
        try:
            hourly_counts = (
                db.query(
                    func.extract("hour", ActivityLog.timestamp).label("hour"),
                    func.count(ActivityLog.id).label("count"),
                )
                .filter(cast(ActivityLog.timestamp, Date) == today)
                .group_by(func.extract("hour", ActivityLog.timestamp))
                .all()
            )

            # Create 24-hour array
            hourly_data = [0] * 24
            for hour, count in hourly_counts:
                if hour is not None:
                    hourly_data[int(hour)] = count

            hourly_activity = hourly_data

        except Exception as e:
            print(f"Error querying hourly activity: {e}")
            hourly_activity = [0] * 24

        return {
            "weekly_activity": {
                "labels": week_labels,
                "data": activity_data,
                "total": sum(activity_data),
            },
            "model_activity": model_activity,
            "hourly_activity": {
                "labels": [f"{i:02d}:00" for i in range(24)],
                "data": hourly_activity,
            },
            "date_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
                "days": days,
            },
        }

    except Exception as e:
        print(f"Error generating analytics data: {e}")
        # Return fallback data if there's an error
        return {
            "weekly_activity": {
                "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                "data": [0, 0, 0, 0, 0, 0, 0],
                "total": 0,
            },
            "model_activity": {},
            "hourly_activity": {
                "labels": [f"{i:02d}:00" for i in range(24)],
                "data": [0] * 24,
            },
            "error": str(e),
        }


@router.get("/stats-test")
def get_dashboard_stats_test():
    """Simple test endpoint to debug routing issues"""
    return {"message": "Test endpoint working", "status": "ok"}
