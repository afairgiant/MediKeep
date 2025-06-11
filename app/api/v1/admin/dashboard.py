"""
Admin Dashboard API - Overview statistics and recent activity

Provides endpoints for the admin dashboard overview with statistics,
recent activity, and system health information.
"""

from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
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


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Get dashboard statistics for admin overview"""

    try:
        # Get counts for all models
        stats = DashboardStats(
            total_users=db.query(User).count(),
            total_patients=db.query(Patient).count(),
            total_practitioners=db.query(Practitioner).count(),
            total_medications=db.query(Medication).count(),
            total_lab_results=db.query(LabResult).count(),
            total_conditions=db.query(Condition).count(),
            total_allergies=db.query(Allergy).count(),
            total_immunizations=db.query(Immunization).count(),
            total_procedures=db.query(Procedure).count(),
            total_treatments=db.query(Treatment).count(),
            total_encounters=db.query(
                Encounter
            ).count(),  # Calculate derived statistics - Fix SQL error
            recent_registrations=db.query(User)
            .order_by(desc(User.id))
            .limit(10)
            .count(),
            active_medications=db.query(Medication)
            .filter(Medication.status == "active")
            .count(),
            pending_lab_results=db.query(LabResult)
            .filter(LabResult.status.in_(["ordered", "in-progress"]))
            .count(),
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

    try:  # Recent users (simplified - in real app you'd have an audit log)
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
            )  # Recent patients
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
    """Get system health information"""

    try:
        # Calculate total records across all models
        total_records = (
            db.query(User).count()
            + db.query(Patient).count()
            + db.query(Practitioner).count()
            + db.query(Medication).count()
            + db.query(LabResult).count()
            + db.query(Condition).count()
            + db.query(Allergy).count()
            + db.query(Immunization).count()
            + db.query(Procedure).count()
            + db.query(Treatment).count()
            + db.query(Encounter).count()
        )

        return SystemHealth(
            database_status="healthy",
            total_records=total_records,
            last_backup=datetime.utcnow() - timedelta(hours=6),  # Placeholder
            system_uptime="3 days, 14 hours",  # Placeholder
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching system health: {str(e)}",
        )
