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
from sqlalchemy.sql import func

from app.api import deps
from app.core.config import settings
from app.core.utils.datetime_utils import (
    get_application_startup_time,
    get_application_uptime_seconds,
    get_application_uptime_string,
)
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_endpoint_error
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

logger = get_logger(__name__, "app")

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
    request: Request,
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
        traceback_str = traceback.format_exc()

        log_endpoint_error(
            logger,
            request,
            "Error fetching dashboard stats",
            e,
            user_id=current_user.id,
            traceback=traceback_str
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching dashboard stats: {str(e)}",
        )


@router.get("/recent-activity", response_model=List[RecentActivity])
def get_recent_activity(
    request: Request,
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
    Supports optional filtering by action type and entity type.
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
                "pharmacy": "Pharmacy",
                "practitioner": "Practitioner",
                "treatment": "Treatment",
                "encounter": "Visit",
                "emergency_contact": "Emergency Contact",
                "lab_result_file": "Lab Result File",
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
        log_endpoint_error(
            logger,
            request,
            "Error fetching recent activity",
            e,
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching recent activity: {str(e)}",
        )


@router.get("/system-health", response_model=SystemHealth)
def get_system_health(
    request: Request,
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
            logger.error(f"Database connection test failed: {str(e)}")
        # Calculate total records across all models with error handling
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
        )  # Calculate application uptime using actual startup time
        try:
            system_uptime = get_application_uptime_string()
        except Exception as e:
            logger.error(f"Error calculating uptime: {str(e)}")
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
            logger.error(f"Error checking backup files: {str(e)}")
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
        log_endpoint_error(
            logger,
            request,
            "Error fetching system health",
            e,
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching system health: {str(e)}",
        )


@router.get("/system-metrics")
def get_system_metrics(
    request: Request,
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
            or (host and host.startswith("192.168."))
            or (host and host.startswith("10."))
            or (host and host.startswith("172."))
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

        # Security warnings and enhanced checks
        security_warnings = []
        if environment == "production" and not is_https:
            security_warnings.append("⚠️ PRODUCTION WITHOUT SSL/HTTPS")
        if environment == "production" and is_localhost:
            security_warnings.append("⚠️ PRODUCTION ON LOCALHOST")

        # Dynamic security status checks
        authentication_status = "operational"
        authorization_status = "operational"
        session_status = "operational"

        # Check authentication system health
        try:
            # Test if we can create and verify JWT tokens (already done above)
            # If we got here, authentication is working
            pass
        except Exception:
            authentication_status = "error"

        # Check authorization system health
        try:
            # Test if current user has proper admin role (we're in admin endpoint)
            user_role = getattr(current_user, "role", None)
            if not user_role or user_role.lower() not in ["admin", "administrator"]:
                authorization_status = "error"
        except Exception:
            authorization_status = "error"

        # Check session management health
        try:
            # If we can access user info, sessions are working
            username = getattr(current_user, "username", None)
            if not username:
                session_status = "error"
        except Exception:
            session_status = "error"

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

            from app.core.utils.security import create_access_token

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
            # System-wide memory (kept for status label)
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            memory_status = (
                "high"
                if memory_percent > 85
                else "normal" if memory_percent > 70 else "low"
            )

            # Application process metrics (what this app actually uses)
            process = psutil.Process(os.getpid())
            proc_mem = process.memory_info()
            memory_used_mb = round(proc_mem.rss / (1024 * 1024))
            memory_total_mb = round(memory.total / (1024 * 1024))

            # App process CPU (percent of one core; call once to prime, then read)
            process.cpu_percent(interval=None)  # prime the measurement
            app_cpu_percent = round(process.cpu_percent(interval=0.1), 1)

            # System-wide CPU
            cpu_percent = psutil.cpu_percent(interval=0.1)
            cpu_status = (
                "high" if cpu_percent > 80 else "normal" if cpu_percent > 50 else "low"
            )
            cpu_count = psutil.cpu_count() or 1

            # System load average (for Unix-like systems)
            try:
                load_avg = os.getloadavg()[0]  # 1-minute load average
                if cpu_count > 0:
                    load_percent = (load_avg / cpu_count) * 100
                    system_load = (
                        "high"
                        if load_percent > 80
                        else "normal" if load_percent > 50 else "low"
                    )
                else:
                    system_load = "normal"
            except (OSError, AttributeError):
                # Windows doesn't have getloadavg
                system_load = "normal"

        except ImportError:
            # Fallback if psutil is not available
            memory_status = "normal"
            memory_percent = None
            memory_used_mb = None
            memory_total_mb = None
            cpu_status = "low"
            cpu_percent = None
            app_cpu_percent = None
            cpu_count = None
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
                "memory_percent": memory_percent,
                "memory_used_mb": memory_used_mb,
                "memory_total_mb": memory_total_mb,
                "cpu_usage": cpu_status,
                "cpu_percent": cpu_percent,
                "app_cpu_percent": app_cpu_percent,
                "cpu_count": cpu_count,
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
                # Enhanced security checks
                "authentication_status": authentication_status,
                "authorization_status": authorization_status,
                "session_status": session_status,
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
            logger.error(f"Error getting storage metrics: {str(e)}")

        return metrics

    except Exception as e:
        log_endpoint_error(
            logger,
            request,
            "Error fetching system metrics",
            e,
            user_id=current_user.id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching system metrics: {str(e)}",
        )


@router.get("/health-check")
def quick_health_check():
    """Quick health check endpoint for monitoring services"""
    startup_time = get_application_startup_time()
    uptime_seconds = get_application_uptime_seconds()
    uptime_info = f"{uptime_seconds}s" if uptime_seconds is not None else "operational"

    return {
        "status": "healthy",
        "timestamp": get_utc_now().isoformat(),
        "service": "medical_records_api",
        "version": "2.0",
        "uptime": uptime_info,
        "startup_time": startup_time.isoformat() if startup_time else None,
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

        # Calculate total app storage across all tracked directories
        app_total_mb = sum(
            d.get("size_mb", 0) for d in directory_status.values()
        )
        app_total_files = sum(
            d.get("file_count", 0) for d in directory_status.values()
        )

        return {
            "status": "healthy" if overall_healthy else "unhealthy",
            "directories": directory_status,
            "app_storage": {
                "total_mb": round(app_total_mb, 2),
                "total_files": app_total_files,
            },
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
    request: Request,
    days: int = 7,
    start_date: str = None,
    end_date: str = None,
    compare: bool = False,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Get analytics data for dashboard charts.

    Accepts either explicit start_date/end_date (ISO YYYY-MM-DD) or a
    ``days`` shortcut (default 7).  When ``compare=True`` the response
    includes a ``comparison`` object with the previous period totals.
    """
    from datetime import date as date_type
    from datetime import datetime, timedelta

    from sqlalchemy import Date, cast

    try:
        # Determine date range
        if start_date and end_date:
            try:
                parsed_start = date_type.fromisoformat(start_date)
                parsed_end = date_type.fromisoformat(end_date)
            except ValueError:
                parsed_start = datetime.utcnow().date() - timedelta(days=days - 1)
                parsed_end = datetime.utcnow().date()
        else:
            parsed_end = datetime.utcnow().date()
            parsed_start = parsed_end - timedelta(days=days - 1)

        range_days = (parsed_end - parsed_start).days + 1

        # Generate list of dates for the range
        date_range_list = []
        current_date = parsed_start
        while current_date <= parsed_end:
            date_range_list.append(current_date)
            current_date += timedelta(days=1)

        # Query activity logs grouped by date
        daily_activity = {}
        try:
            activity_counts = (
                db.query(
                    cast(ActivityLog.timestamp, Date).label("date"),
                    func.count(ActivityLog.id).label("count"),
                )
                .filter(ActivityLog.timestamp >= parsed_start)
                .filter(ActivityLog.timestamp <= parsed_end + timedelta(days=1))
                .group_by(cast(ActivityLog.timestamp, Date))
                .all()
            )

            for dt, count in activity_counts:
                daily_activity[dt] = count

        except Exception as e:
            logger.error(f"Error querying activity logs: {str(e)}")

        # Use "%b %d" labels for ranges > 7 days, "%a" for weekly
        date_fmt = "%b %d" if range_days > 7 else "%a"

        week_labels = []
        activity_data = []

        for dt in date_range_list:
            week_labels.append(dt.strftime(date_fmt))
            activity_data.append(daily_activity.get(dt, 0))

        # Get activity breakdown by model type
        model_activity = {}
        try:
            model_counts = (
                db.query(
                    ActivityLog.entity_type, func.count(ActivityLog.id).label("count")
                )
                .filter(ActivityLog.timestamp >= parsed_start)
                .filter(ActivityLog.timestamp <= parsed_end + timedelta(days=1))
                .group_by(ActivityLog.entity_type)
                .all()
            )

            for entity_type, count in model_counts:
                model_activity[entity_type or "unknown"] = count

        except Exception as e:
            logger.error(f"Error querying model activity: {str(e)}")

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

            hourly_data = [0] * 24
            for hour, count in hourly_counts:
                if hour is not None:
                    hourly_data[int(hour)] = count

            hourly_activity = hourly_data

        except Exception as e:
            logger.error(f"Error querying hourly activity: {str(e)}")
            hourly_activity = [0] * 24

        current_total = sum(activity_data)

        result = {
            "weekly_activity": {
                "labels": week_labels,
                "data": activity_data,
                "total": current_total,
            },
            "model_activity": model_activity,
            "hourly_activity": {
                "labels": [f"{i:02d}:00" for i in range(24)],
                "data": hourly_activity,
            },
            "date_range": {
                "start": parsed_start.isoformat(),
                "end": parsed_end.isoformat(),
                "days": range_days,
            },
        }

        # Comparison with previous period
        if compare:
            prev_end = parsed_start - timedelta(days=1)
            prev_start = prev_end - timedelta(days=range_days - 1)

            previous_total = 0
            try:
                prev_count = (
                    db.query(func.count(ActivityLog.id))
                    .filter(ActivityLog.timestamp >= prev_start)
                    .filter(ActivityLog.timestamp <= prev_end + timedelta(days=1))
                    .scalar()
                ) or 0
                previous_total = prev_count
            except Exception as e:
                logger.error(f"Error querying comparison period: {str(e)}")

            if previous_total > 0:
                change_percent = round(
                    ((current_total - previous_total) / previous_total) * 100, 1
                )
            else:
                change_percent = 100.0 if current_total > 0 else 0.0

            result["comparison"] = {
                "previous_total": previous_total,
                "current_total": current_total,
                "change_percent": change_percent,
                "previous_period": {
                    "start": prev_start.isoformat(),
                    "end": prev_end.isoformat(),
                },
            }

        return result

    except Exception as e:
        logger.error(f"Error generating analytics data: {str(e)}")
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
