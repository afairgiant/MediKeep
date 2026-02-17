from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, desc, func
from sqlalchemy.orm import Session, joinedload

from app.crud.base import CRUDBase
from app.models.activity_log import ActionType, ActivityLog, EntityType


class CRUDActivityLog(CRUDBase[ActivityLog, Dict[str, Any], Dict[str, Any]]):
    """
    CRUD operations for ActivityLog model.

    Provides specialized methods for activity tracking including
    user-specific activity queries, patient activity filtering,
    and system-wide activity monitoring.
    """

    def get_by_user(
        self, db: Session, *, user_id: int, skip: int = 0, limit: int = 50
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
        return self.query(
            db=db,
            filters={"user_id": user_id},
            skip=skip,
            limit=limit,
            order_by="timestamp",
            order_desc=True,
        )

    def get_by_patient(
        self, db: Session, *, patient_id: int, skip: int = 0, limit: int = 50
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
        return self.query(
            db=db,
            filters={"patient_id": patient_id},
            skip=skip,
            limit=limit,
            order_by="timestamp",
            order_desc=True,
        )

    def get_recent_activity(
        self, db: Session, *, hours: int = 24, limit: int = 100
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
        limit: int = 50,
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
        return self.query(
            db=db,
            filters={"entity_type": entity_type, "entity_id": entity_id},
            skip=skip,
            limit=limit,
            order_by="timestamp",
            order_desc=True,
        )

    def get_by_action_type(
        self,
        db: Session,
        *,
        action: str,
        user_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 50,
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
        filters: Dict[str, Any] = {"action": action}
        if user_id:
            filters["user_id"] = user_id

        return self.query(
            db=db,
            filters=filters,
            skip=skip,
            limit=limit,
            order_by="timestamp",
            order_desc=True,
        )

    def get_with_relations(
        self, db: Session, *, activity_id: int
    ) -> Optional[ActivityLog]:
        """
        Get an activity log entry with user and patient relationships loaded.

        Args:
            db: Database session
            activity_id: ID of the activity log entry

        Returns:
            ActivityLog with relationships loaded, or None if not found

        Example:
            activity = activity_log.get_with_relations(db, activity_id=log.id)
            user_name = activity.user.username if activity.user else "System"
        """
        return super().get_with_relations(
            db=db, record_id=activity_id, relations=["user", "patient"]
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
        limit: int = 50,
    ) -> List[ActivityLog]:
        """
        Search activities with multiple filter options.

        Args:
            db: Database session
            user_id: Optional user ID filter
            patient_id: Optional patient ID filter
            entity_type: Optional entity type filter
            action: Optional action type filter
            start_date: Optional start date filter
            end_date: Optional end date filter
            description_search: Optional text search in description
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of activities matching the search criteria

        Example:
            activities = activity_log.search_activities(
                db,
                user_id=user.id,
                action=ActionType.CREATED,
                start_date=datetime(2023, 1, 1),
                description_search="medication"
            )
        """
        # Build filters dictionary
        filters = {}
        if user_id:
            filters["user_id"] = user_id
        if patient_id:
            filters["patient_id"] = patient_id
        if entity_type:
            filters["entity_type"] = entity_type
        if action:
            filters["action"] = action

        # Handle description search or date filters with custom query
        if description_search or start_date or end_date:
            query = db.query(self.model)

            # Apply filters
            for field_name, field_value in filters.items():
                if hasattr(self.model, field_name):
                    field = getattr(self.model, field_name)
                    query = query.filter(field == field_value)

            # Apply description search
            if description_search:
                query = query.filter(
                    self.model.description.ilike(f"%{description_search}%")
                )

            # Apply date filters
            if start_date:
                query = query.filter(self.model.timestamp >= start_date)
            if end_date:
                query = query.filter(self.model.timestamp <= end_date)

            return (
                query.order_by(desc(self.model.timestamp))
                .offset(skip)
                .limit(limit)
                .all()
            )
        elif filters:
            # Use the new query method for simple field filters
            return self.query(
                db=db,
                filters=filters,
                skip=skip,
                limit=limit,
                order_by="timestamp",
                order_desc=True,
            )
        else:
            # No filters, return recent activities
            return self.get_multi(db, skip=skip, limit=limit)

    def get_activity_summary(
        self, db: Session, *, user_id: Optional[int] = None, days: int = 30
    ) -> Dict[str, Any]:
        """
        Get activity summary statistics.

        Args:
            db: Database session
            user_id: Optional user ID to filter by
            days: Number of days to look back

        Returns:
            Dictionary with activity statistics

        Example:
            summary = activity_log.get_activity_summary(db, user_id=user.id, days=7)
            total_activities = summary["total_activities"]
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        # Base query
        query = db.query(self.model).filter(self.model.timestamp >= cutoff_date)

        if user_id:
            query = query.filter(self.model.user_id == user_id)

        # Get total count
        total_activities = query.count()

        # Get counts by action type
        action_counts = (
            query.with_entities(self.model.action, func.count(self.model.id))
            .group_by(self.model.action)
            .all()
        )

        # Get counts by entity type
        entity_counts = (
            query.with_entities(self.model.entity_type, func.count(self.model.id))
            .group_by(self.model.entity_type)
            .all()
        )

        return {
            "total_activities": total_activities,
            "days_covered": days,
            "actions": {action: count for action, count in action_counts},
            "entities": {entity: count for entity, count in entity_counts},
            "start_date": cutoff_date,
            "end_date": datetime.utcnow(),
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
        Log a new activity entry.

        Args:
            db: Database session
            action: Action performed (use ActionType constants)
            entity_type: Type of entity (use EntityType constants)
            description: Human-readable description
            user_id: Optional user who performed the action
            patient_id: Optional patient related to the action
            entity_id: Optional ID of the specific entity
            metadata: Optional additional metadata
            ip_address: Optional IP address
            user_agent: Optional user agent string

        Returns:
            Created ActivityLog object

        Example:
            log_entry = activity_log.log_activity(
                db,
                action=ActionType.CREATED,
                entity_type=EntityType.MEDICATION,
                description="Created new medication record",
                user_id=current_user.id,
                patient_id=patient.id,
                entity_id=medication.id
            )
        """
        activity_data = {
            "action": action,
            "entity_type": entity_type,
            "description": description,
            "timestamp": datetime.utcnow(),
            "user_id": user_id,
            "patient_id": patient_id,
            "entity_id": entity_id,
            "event_metadata": metadata,
            "ip_address": ip_address,
            "user_agent": user_agent,
        }

        db_obj = self.model(**activity_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


# Create the activity log CRUD instance
activity_log = CRUDActivityLog(ActivityLog)
