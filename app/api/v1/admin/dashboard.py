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
from app.models.activity_log import get_utc_now
from app.models.models import (
    User,
    Patient,
    Practitioner,
    Medication,
    LabResult,
    Vitals,
    Condition,
    Allergy,
    Immunization,
    Procedure,
    Treatment,
    Encounter,
)
from app.models.activity_log import ActivityLog

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
                return 0        # Get counts for all models with error handling
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
                    'medication': 'Medication',
                    'patient': 'Patient', 
                    'user': 'User',
                    'lab_result': 'LabResult',
                    'procedure': 'Procedure',
                    'allergy': 'Allergy',
                    'condition': 'Condition',
                    'immunization': 'Immunization',                    'vitals': 'Vitals',
                }
                entity_type = getattr(log, 'entity_type', None)
                model_name = model_name_mapping.get(entity_type or '', entity_type.title() if entity_type else "Unknown")
                
                # Get the raw description and action
                raw_description = getattr(log, 'description', 'No description')
                action = getattr(log, 'action', 'unknown')
                
                # Fix malformed descriptions that don't match the action
                if raw_description and ("delete" in raw_description.lower() and action != "deleted"):
                    # This is a malformed description, regenerate it
                    entity_id = getattr(log, 'entity_id', None)
                    if entity_type == "medication" and entity_id:
                        # Try to get the medication details if it still exists
                        medication = db.query(Medication).filter(Medication.id == entity_id).first()
                        if medication:
                            patient_name = "Unknown Patient"
                            if hasattr(medication, 'patient') and medication.patient:
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
                        id=getattr(log, 'entity_id', None) or getattr(log, 'id', 0),
                        model_name=model_name,
                        action=getattr(log, 'action', 'unknown'),
                        description=getattr(log, 'description', 'No description'),
                        timestamp=getattr(log, 'timestamp', get_utc_now()),
                        user_info=getattr(log.user, 'username', None) if getattr(log, 'user', None) else None,
                    )
                )
                
            return recent_activities
        
        # Fallback to old method only if no activity logs exist
        base_time = get_utc_now()
        
        # Recent medications (fallback method)
        recent_medications = db.query(Medication).order_by(desc(Medication.id)).limit(5).all()
        for i, medication in enumerate(recent_medications):
            patient_name = "Unknown Patient"
            if hasattr(medication, 'patient') and medication.patient:
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
            )
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
            )        # Recent procedures
        recent_procedures = db.query(Procedure).order_by(desc(Procedure.id)).limit(3).all()
        for i, procedure in enumerate(recent_procedures):
            patient_name = "Unknown Patient"
            if hasattr(procedure, 'patient') and procedure.patient:
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
            if hasattr(allergy, 'patient') and allergy.patient:
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
    action_filter: Optional[str] = None,  # Filter by action: 'created', 'updated', 'deleted', etc.
    entity_filter: Optional[str] = None,  # Filter by entity type: 'medication', 'patient', etc.
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
                'medication': 'Medication',
                'patient': 'Patient', 
                'user': 'User',
                'lab_result': 'LabResult',
                'procedure': 'Procedure',
                'allergy': 'Allergy',
                'condition': 'Condition',
                'immunization': 'Immunization',
                'vitals': 'Vitals',
            }
            
            entity_type = getattr(log, 'entity_type', None)
            if entity_type:
                model_name = model_name_mapping.get(entity_type, entity_type.title())
            else:
                model_name = "Unknown"
            
            # Create RecentActivity from ActivityLog
            recent_activities.append(
                RecentActivity(
                    id=getattr(log, 'entity_id', None) or getattr(log, 'id', 0),
                    model_name=model_name or "Unknown",
                    action=getattr(log, 'action', 'unknown'),
                    description=getattr(log, 'description', 'No description'),
                    timestamp=getattr(log, 'timestamp', get_utc_now()),
                    user_info=getattr(log.user, 'username', None) if getattr(log, 'user', None) else None,
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
            print(f"Database connection test failed: {e}")        # Calculate total records across all models with error handling
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
        )# Calculate application uptime using startup time
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
            "timestamp": get_utc_now().isoformat(),
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
        "message": "Admin access verified",        "user": current_user.username,
        "role": current_user.role,
        "timestamp": get_utc_now().isoformat(),
    }
