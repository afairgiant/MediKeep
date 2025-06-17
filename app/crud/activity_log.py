from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, and_
from datetime import datetime, timedelta

from app.crud.base import CRUDBase
from app.models.activity_log import ActivityLog, EntityType, ActionType


class CRUDActivityLog(CRUDBase[ActivityLog, Dict[str, Any], Dict[str, Any]]):
    """
    CRUD operations for ActivityLog model.

    Provides specialized methods for activity tracking including
    user-specific activity queries, patient activity filtering,
    and system-wide activity monitoring.
    """

    def get_by_user(
        self, 
        db: Session, 
        *, 
        user_id: int, 
        skip: int = 0, 
        limit: int = 50
    ) -> List[ActivityLog]:
        """
        Get all activities for a specific user.

        Args:
            db: Database session
            user_id: User ID to filter by
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of activities for the user

        Example:
            activities = activity_log.get_by_user(db, user_id=current_user.id, limit=20)
        """
        return (
            db.query(self.model)
            .filter(self.model.user_id == user_id)
            .order_by(desc(self.model.timestamp))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_patient(
        self, 
        db: Session, 
        *, 
        patient_id: int, 
        skip: int = 0, 
        limit: int = 50
    ) -> List[ActivityLog]:
        """
        Get all activities related to a specific patient.

        Args:
            db: Database session
            patient_id: Patient ID to filter by
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of activities related to the patient

        Example:
            activities = activity_log.get_by_patient(db, patient_id=patient.id, limit=20)
        """
        return (
            db.query(self.model)
            .filter(self.model.patient_id == patient_id)
            .order_by(desc(self.model.timestamp))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_recent_activity(
        self, 
        db: Session, 
        *, 
        hours: int = 24, 
        limit: int = 100
    ) -> List[ActivityLog]:
        """
        Get recent system-wide activity within specified time range.

        Args:
            db: Database session
            hours: Number of hours to look back (default: 24)
            limit: Maximum number of records to return

        Returns:
            List of recent activities across the system

        Example:
            recent = activity_log.get_recent_activity(db, hours=48, limit=50)
        """
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        return (
            db.query(self.model)
            .filter(self.model.timestamp >= cutoff_time)
            .order_by(desc(self.model.timestamp))
            .limit(limit)
            .all()
        )

    def get_by_entity(
        self, 
        db: Session, 
        *, 
        entity_type: str, 
        entity_id: int,
        skip: int = 0, 
        limit: int = 50
    ) -> List[ActivityLog]:
        """
        Get all activities for a specific entity (e.g., a specific medication, lab result).

        Args:
            db: Database session
            entity_type: Type of entity (use EntityType constants)
            entity_id: ID of the specific entity
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of activities for the entity

        Example:
            activities = activity_log.get_by_entity(
                db, 
                entity_type=EntityType.MEDICATION, 
                entity_id=medication.id
            )
        """
        return (
            db.query(self.model)
            .filter(
                and_(
                    self.model.entity_type == entity_type,
                    self.model.entity_id == entity_id
                )
            )
            .order_by(desc(self.model.timestamp))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_action_type(
        self, 
        db: Session, 
        *, 
        action: str,
        user_id: Optional[int] = None,
        skip: int = 0, 
        limit: int = 50
    ) -> List[ActivityLog]:
        """
        Get activities by action type, optionally filtered by user.

        Args:
            db: Database session
            action: Action type to filter by (use ActionType constants)
            user_id: Optional user ID to filter by
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of activities matching the action type

        Example:
            # Get all deletion activities
            deletions = activity_log.get_by_action_type(db, action=ActionType.DELETED)
            
            # Get login activities for specific user
            logins = activity_log.get_by_action_type(
                db, 
                action=ActionType.LOGIN, 
                user_id=user.id
            )
        """
        query = db.query(self.model).filter(self.model.action == action)
        
        if user_id:
            query = query.filter(self.model.user_id == user_id)
            
        return (
            query
            .order_by(desc(self.model.timestamp))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_with_relations(
        self, 
        db: Session, 
        *, 
        activity_id: int
    ) -> Optional[ActivityLog]:
        """
        Get activity log with user and patient relationships loaded.

        Args:
            db: Database session
            activity_id: ID of the activity log

        Returns:
            ActivityLog with relationships loaded, or None if not found

        Example:
            activity = activity_log.get_with_relations(db, activity_id=log.id)
            user_info = activity.user
            patient_info = activity.patient
        """
        return (
            db.query(self.model)
            .options(
                joinedload(self.model.user),
                joinedload(self.model.patient)
            )
            .filter(self.model.id == activity_id)
            .first()
        )

    def search_activities(
        self,
        db: Session,
        *,
        user_id: Optional[int] = None,
        patient_id: Optional[int] = None,
        entity_type: Optional[str] = None,
        action: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        description_search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[ActivityLog]:
        """
        Advanced search for activities with multiple filter criteria.

        Args:
            db: Database session
            user_id: Filter by user ID
            patient_id: Filter by patient ID
            entity_type: Filter by entity type
            action: Filter by action type
            start_date: Filter activities after this date
            end_date: Filter activities before this date
            description_search: Search in description text
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of activities matching the search criteria

        Example:
            activities = activity_log.search_activities(
                db,
                user_id=user.id,
                entity_type=EntityType.LAB_RESULT,
                action=ActionType.CREATED,
                start_date=datetime.now() - timedelta(days=7)
            )
        """
        query = db.query(self.model)

        # Apply filters
        if user_id:
            query = query.filter(self.model.user_id == user_id)
        
        if patient_id:
            query = query.filter(self.model.patient_id == patient_id)
            
        if entity_type:
            query = query.filter(self.model.entity_type == entity_type)
            
        if action:
            query = query.filter(self.model.action == action)
            
        if start_date:
            query = query.filter(self.model.timestamp >= start_date)
            
        if end_date:
            query = query.filter(self.model.timestamp <= end_date)
            
        if description_search:
            query = query.filter(
                self.model.description.ilike(f"%{description_search}%")
            )

        return (
            query
            .order_by(desc(self.model.timestamp))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_activity_summary(
        self, 
        db: Session, 
        *, 
        user_id: Optional[int] = None,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get activity summary statistics for a user or system-wide.

        Args:
            db: Database session
            user_id: User ID to filter by (None for system-wide)
            days: Number of days to look back

        Returns:
            Dictionary with activity summary statistics

        Example:
            summary = activity_log.get_activity_summary(db, user_id=user.id, days=7)
            print(f"Created: {summary['actions']['created']}")
            print(f"Total activities: {summary['total_activities']}")
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        query = db.query(self.model).filter(self.model.timestamp >= cutoff_date)
        
        if user_id:
            query = query.filter(self.model.user_id == user_id)
        
        activities = query.all()
        
        # Count by action type
        action_counts = {}
        for action in ActionType.get_all_actions():
            action_counts[action] = sum(1 for a in activities if a.action == action)
        
        # Count by entity type
        entity_counts = {}
        for entity in EntityType.get_all_types():
            entity_counts[entity] = sum(1 for a in activities if a.entity_type == entity)
        
        return {
            "total_activities": len(activities),
            "actions": action_counts,
            "entities": entity_counts,
            "date_range": {
                "start": cutoff_date.isoformat(),
                "end": datetime.utcnow().isoformat()
            },
            "user_id": user_id
        }

    def log_activity(
        self,
        db: Session,
        *,
        action: str,
        entity_type: str,
        description: str,
        user_id: Optional[int] = None,
        patient_id: Optional[int] = None,
        entity_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ActivityLog:
        """
        Convenience method to create and save an activity log.

        Args:
            db: Database session
            action: Action performed (use ActionType constants)
            entity_type: Type of entity (use EntityType constants)
            description: Human-readable description
            user_id: ID of user who performed the action
            patient_id: ID of patient whose data was affected
            entity_id: ID of the specific record affected
            metadata: Additional context data
            ip_address: Client IP address
            user_agent: Client user agent string

        Returns:
            Created ActivityLog instance

        Example:
            activity = activity_log.log_activity(
                db,
                action=ActionType.CREATED,
                entity_type=EntityType.MEDICATION,
                description="Added new medication: Aspirin 325mg",
                user_id=current_user.id,
                patient_id=patient.id,
                entity_id=medication.id,
                metadata={"dosage": "325mg", "frequency": "daily"}
            )
        """
        activity = ActivityLog.create_activity(            action=action,
            entity_type=entity_type,
            description=description,
            user_id=user_id,
            patient_id=patient_id,
            entity_id=entity_id,
            metadata=metadata,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        
        db.add(activity)
        db.commit()
        db.refresh(activity)
        
        return activity


# Create instance of the CRUD class
activity_log = CRUDActivityLog(ActivityLog)
