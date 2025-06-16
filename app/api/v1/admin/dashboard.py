"""
Admin Dashboard API - Overview statistics and recent activity

Provides endpoints for the admin dashboard overview with statistics,
recent activity, and system health information.
"""

from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, text
from pydantic import BaseModel

from app.api import deps
from app.models.models import (
    User,
    Patient,
    Practitioner,
    Medication,
    LabResult,
    Condition,
    Allergy,
    Immunization,
    Procedure,
    Treatment,
    Encounter,
)

router = APIRouter()


class DashboardStats(BaseModel):
    """Dashboard statistics schema"""

    total_users: int
    total_patients: int
    total_practitioners: int
    total_medications: int
    total_lab_results: int
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
            total_conditions=safe_count(db.query(Condition)),
            total_allergies=safe_count(db.query(Allergy)),
            total_immunizations=safe_count(db.query(Immunization)),
            total_procedures=safe_count(db.query(Procedure)),
            total_treatments=safe_count(db.query(Treatment)),
            total_encounters=safe_count(db.query(Encounter)),
            # Calculate derived statistics
            recent_registrations=safe_count(
                db.query(User).filter(
                    User.created_at >= datetime.now() - timedelta(days=30)
                )
            ),
            active_medications=safe_count(
                db.query(Medication).filter(Medication.status == "active")
            ),
            pending_lab_results=safe_count(
                db.query(LabResult).filter(
                    LabResult.status.in_(["ordered", "in-progress"])
                )
            ),
        )

        return stats

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching dashboard stats: {str(e)}",
        )


@router.get("/recent-activity", response_model=List[RecentActivity])
def get_recent_activity(
    limit: int = 20,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Get recent activity across all models"""

    recent_activities = []

    try:
        # Recent users (simplified - in real app you'd have an audit log)
        recent_users = db.query(User).order_by(desc(User.id)).limit(5).all()
        for user in recent_users:
            recent_activities.append(
                RecentActivity(
                    id=getattr(user, "id"),
                    model_name="User",
                    action="created",
                    description=f"New user registered: {getattr(user, 'full_name', 'Unknown')}",
                    timestamp=datetime.utcnow() - timedelta(days=1),  # Placeholder
                    user_info=getattr(user, "username", None),
                )
            )

        # Recent patients
        recent_patients = db.query(Patient).order_by(desc(Patient.id)).limit(5).all()
        for patient in recent_patients:
            recent_activities.append(
                RecentActivity(
                    id=getattr(patient, "id"),
                    model_name="Patient",
                    action="created",
                    description=f"New patient: {getattr(patient, 'first_name', '')} {getattr(patient, 'last_name', '')}",
                    timestamp=datetime.utcnow() - timedelta(hours=2),  # Placeholder
                    user_info=None,
                )
            )

        # Recent lab results
        recent_labs = db.query(LabResult).order_by(desc(LabResult.id)).limit(5).all()
        for lab in recent_labs:
            recent_activities.append(
                RecentActivity(
                    id=getattr(lab, "id"),
                    model_name="LabResult",
                    action="created",
                    description=f"Lab result: {getattr(lab, 'test_name', 'Unknown')}",
                    timestamp=datetime.utcnow() - timedelta(hours=3),  # Placeholder
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
            print(f"Database connection test failed: {e}")

        # Calculate total records across all models with error handling
        total_records = (
            safe_count(db.query(User))
            + safe_count(db.query(Patient))
            + safe_count(db.query(Practitioner))
            + safe_count(db.query(Medication))
            + safe_count(db.query(LabResult))
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
            import os
            import glob

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
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Get detailed system performance metrics"""

    try:
        metrics = {
            "timestamp": datetime.utcnow().isoformat(),
            "database": {
                "connection_pool_size": "Available",
                "active_connections": 1,  # Placeholder
                "query_performance": "Normal",
            },
            "application": {
                "memory_usage": "Normal",
                "cpu_usage": "Low",
                "response_time": "< 100ms",
            },
            "storage": {
                "database_size": None,
                "upload_directory_size": None,
                "available_space": "Available",
            },
            "security": {
                "ssl_enabled": True,
                "authentication_method": "JWT",
                "last_security_scan": None,  # Changed to None to indicate no scan has been run
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
        "timestamp": datetime.utcnow().isoformat(),
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
        "timestamp": datetime.utcnow().isoformat(),
    }
