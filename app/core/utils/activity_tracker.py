"""
Activity Tracker for the Medical Records Management System.

This module provides SQLAlchemy event listeners to automatically track
CRUD operations across all models, creating activity logs for audit trails
and user activity feeds.
"""

import contextvars
from typing import Optional, Dict, Any, Type
from sqlalchemy import event
from datetime import datetime

from app.models.activity_log import ActivityLog, EntityType, ActionType, ActivityPriority
from app.core.logging.config import get_logger

# Context variables for tracking user context across requests
current_user_id_var: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar(
    "current_user_id", default=None
)
current_patient_id_var: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar(
    "current_patient_id", default=None
)
current_ip_address_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "current_ip_address", default=None
)
current_user_agent_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "current_user_agent", default=None
)
activity_tracking_disabled_var: contextvars.ContextVar[bool] = contextvars.ContextVar(
    "activity_tracking_disabled", default=False
)
# Track if we're currently logging an activity to prevent recursive logging
activity_logging_in_progress_var: contextvars.ContextVar[bool] = contextvars.ContextVar(
    "activity_logging_in_progress", default=False
)

# Logger for activity tracking
activity_logger = get_logger(__name__, "app")


class ActivityTracker:
    """
    Centralized activity tracking system using SQLAlchemy event listeners.
    
    This class automatically captures CRUD operations on all registered models
    and creates appropriate activity log entries for audit trails and user feeds.
    """

    def __init__(self):
        """Initialize the activity tracker."""
        self._registered_models = set()
        self._entity_type_mapping = {}
        self._setup_entity_mappings()

    def _setup_entity_mappings(self) -> None:
        """
        Set up mapping between SQLAlchemy model classes and entity type constants.
        """
        # Import models locally to avoid circular imports
        try:
            from app.models.models import (
                User, Patient, Practitioner, Medication, LabResult, LabResultFile,
                Condition, Treatment, Immunization, Allergy, Procedure, Encounter, Insurance
            )

            self._entity_type_mapping = {
                User: EntityType.USER,
                Patient: EntityType.PATIENT,
                Practitioner: EntityType.PRACTITIONER,
                Medication: EntityType.MEDICATION,
                LabResult: EntityType.LAB_RESULT,
                LabResultFile: EntityType.LAB_RESULT_FILE,
                Condition: EntityType.CONDITION,
                Treatment: EntityType.TREATMENT,
                Immunization: EntityType.IMMUNIZATION,
                Allergy: EntityType.ALLERGY,
                Procedure: EntityType.PROCEDURE,
                Encounter: EntityType.ENCOUNTER,
                Insurance: EntityType.INSURANCE,
            }
        except ImportError as e:
            activity_logger.warning(f"Could not import all models for activity tracking: {e}")

    def register_model(self, model_class: Type) -> None:
        """
        Register a model class for activity tracking.
        
        Args:
            model_class: SQLAlchemy model class to track
        """
        if model_class in self._registered_models:
            return
            
        # Register event listeners
        event.listen(model_class, 'after_insert', self._handle_after_insert)
        event.listen(model_class, 'after_update', self._handle_after_update)
        event.listen(model_class, 'after_delete', self._handle_after_delete)
        
        self._registered_models.add(model_class)
        activity_logger.info(f"Registered activity tracking for model: {model_class.__name__}")

    def register_all_models(self) -> None:
        """
        Register all known models for activity tracking.
        """
        for model_class in self._entity_type_mapping.keys():
            self.register_model(model_class)

    def _get_entity_type(self, instance) -> str:
        """
        Get the entity type string for a model instance.
        
        Args:
            instance: SQLAlchemy model instance
            
        Returns:
            Entity type string
        """
        model_class = type(instance)
        return self._entity_type_mapping.get(model_class, model_class.__name__.lower())

    def _get_patient_id_from_instance(self, instance) -> Optional[int]:
        """
        Extract patient ID from a model instance if available.
        
        Args:
            instance: SQLAlchemy model instance
            
        Returns:
            Patient ID if available, None otherwise
        """
        # Check for direct patient_id attribute
        if hasattr(instance, 'patient_id'):
            return getattr(instance, 'patient_id', None)
        
        # For Patient model, use the instance ID
        if self._get_entity_type(instance) == EntityType.PATIENT:
            return getattr(instance, 'id', None)
        
        # For User model, try to get patient through relationship
        if self._get_entity_type(instance) == EntityType.USER:
            try:
                patient = getattr(instance, 'patient', None)
                if patient:
                    return getattr(patient, 'id', None)
            except Exception:
                pass
        
        # Try current context
        return current_patient_id_var.get()

    def _get_entity_description(self, instance, action: str) -> str:
        """
        Generate a human-readable description for an activity.
        
        Args:
            instance: SQLAlchemy model instance
            action: Action performed
            
        Returns:
            Human-readable description
        """
        entity_type = self._get_entity_type(instance)
        entity_id = getattr(instance, 'id', 'unknown')
        
        # Customize descriptions based on entity type
        if entity_type == EntityType.PATIENT:
            name = f"{getattr(instance, 'first_name', '')} {getattr(instance, 'last_name', '')}".strip()
            return f"{action.title()} patient: {name or f'ID {entity_id}'}"
        
        elif entity_type == EntityType.MEDICATION:
            med_name = getattr(instance, 'medication_name', f'ID {entity_id}')
            return f"{action.title()} medication: {med_name}"
        
        elif entity_type == EntityType.LAB_RESULT:
            test_name = getattr(instance, 'test_name', f'ID {entity_id}')
            return f"{action.title()} lab result: {test_name}"
        
        elif entity_type == EntityType.LAB_RESULT_FILE:
            file_name = getattr(instance, 'file_name', f'ID {entity_id}')
            return f"{action.title()} lab result file: {file_name}"
        
        elif entity_type == EntityType.CONDITION:
            diagnosis = getattr(instance, 'diagnosis', f'ID {entity_id}')
            return f"{action.title()} condition: {diagnosis}"
        
        elif entity_type == EntityType.TREATMENT:
            treatment_name = getattr(instance, 'treatment_name', f'ID {entity_id}')
            return f"{action.title()} treatment: {treatment_name}"
        
        elif entity_type == EntityType.IMMUNIZATION:
            vaccine_name = getattr(instance, 'vaccine_name', f'ID {entity_id}')
            return f"{action.title()} immunization: {vaccine_name}"
        
        elif entity_type == EntityType.ALLERGY:
            allergen = getattr(instance, 'allergen', f'ID {entity_id}')
            return f"{action.title()} allergy: {allergen}"
        
        elif entity_type == EntityType.PROCEDURE:
            procedure_name = getattr(instance, 'procedure_name', f'ID {entity_id}')
            return f"{action.title()} procedure: {procedure_name}"
        
        elif entity_type == EntityType.ENCOUNTER:
            reason = getattr(instance, 'reason', f'ID {entity_id}')
            return f"{action.title()} encounter: {reason}"
        
        elif entity_type == EntityType.USER:
            username = getattr(instance, 'username', f'ID {entity_id}')
            return f"{action.title()} user: {username}"
        
        elif entity_type == EntityType.PRACTITIONER:
            name = getattr(instance, 'name', f'ID {entity_id}')
            return f"{action.title()} practitioner: {name}"

        elif entity_type == EntityType.INSURANCE:
            company_name = getattr(instance, 'company_name', f'ID {entity_id}')
            return f"{action.title()} insurance: {company_name}"

        # Default description
        return f"{action.title()} {entity_type}: {entity_id}"

    def _create_activity_metadata(self, instance, action: str) -> Dict[str, Any]:
        """
        Create metadata dictionary for an activity log.
        
        Args:
            instance: SQLAlchemy model instance
            action: Action performed
            
        Returns:
            Metadata dictionary
        """
        metadata = {
            "entity_type": self._get_entity_type(instance),
            "action": action,
            "timestamp": datetime.utcnow().isoformat(),
        }        # Add entity-specific metadata
        entity_type = self._get_entity_type(instance)
        
        if entity_type == EntityType.MEDICATION:
            med_name = getattr(instance, 'medication_name', None)
            if med_name:
                metadata["medication_name"] = str(med_name)
            dosage = getattr(instance, 'dosage', None)
            if dosage:
                metadata["dosage"] = str(dosage)
            status = getattr(instance, 'status', None)
            if status:
                metadata["status"] = str(status)
        
        elif entity_type == EntityType.LAB_RESULT:
            test_name = getattr(instance, 'test_name', None)
            if test_name:
                metadata["test_name"] = str(test_name)
            status = getattr(instance, 'status', None)
            if status:
                metadata["status"] = str(status)
            test_category = getattr(instance, 'test_category', None)
            if test_category:
                metadata["test_category"] = str(test_category)
        
        elif entity_type == EntityType.CONDITION:
            diagnosis = getattr(instance, 'diagnosis', None)
            if diagnosis:
                metadata["diagnosis"] = str(diagnosis)
            status = getattr(instance, 'status', None)
            if status:
                metadata["status"] = str(status)

        elif entity_type == EntityType.INSURANCE:
            company_name = getattr(instance, 'company_name', None)
            if company_name:
                metadata["company_name"] = str(company_name)
            insurance_type = getattr(instance, 'insurance_type', None)
            if insurance_type:
                metadata["insurance_type"] = str(insurance_type)
            status = getattr(instance, 'status', None)
            if status:
                metadata["status"] = str(status)

        # Add common fields
        if hasattr(instance, 'status'):
            metadata["status"] = getattr(instance, 'status')
        
        return metadata

    def _handle_after_insert(self, mapper, connection, target) -> None:
        """
        Handle after_insert SQLAlchemy event.
        
        Args:
            mapper: SQLAlchemy mapper
            connection: Database connection
            target: The inserted instance
        """
        self._log_activity(target, ActionType.CREATED)

    def _handle_after_update(self, mapper, connection, target) -> None:
        """
        Handle after_update SQLAlchemy event.
        
        Args:
            mapper: SQLAlchemy mapper
            connection: Database connection
            target: The updated instance
        """
        self._log_activity(target, ActionType.UPDATED)

    def _handle_after_delete(self, mapper, connection, target) -> None:
        """
        Handle after_delete SQLAlchemy event.
        
        Args:
            mapper: SQLAlchemy mapper
            connection: Database connection
            target: The deleted instance
        """
        self._log_activity(target, ActionType.DELETED)

    def _log_activity(self, instance, action: str) -> None:
        """
        Create an activity log entry for a model instance.
        
        Args:
            instance: SQLAlchemy model instance
            action: Action performed (created, updated, deleted)
        """
        try:
            # Skip logging for ActivityLog itself to prevent infinite recursion
            if isinstance(instance, ActivityLog):
                return
            
            # Skip logging if activity tracking is disabled
            if activity_tracking_disabled_var.get():
                return
                
            # Skip logging if we're already in the process of logging an activity
            if activity_logging_in_progress_var.get():
                activity_logger.debug("Skipping activity logging - already in progress")
                return

            # Debug logging to track duplicate activity creation
            entity_type = self._get_entity_type(instance)
            entity_id = getattr(instance, 'id', None)
            activity_logger.debug(
                f"Creating activity log: {action} {entity_type} {entity_id}",
                extra={
                    "category": "activity_tracking_debug",
                    "action": action,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                }
            )

            # Get context information
            user_id = current_user_id_var.get()
            patient_id = self._get_patient_id_from_instance(instance)
            ip_address = current_ip_address_var.get()
            user_agent = current_user_agent_var.get()
            
            # Create activity log entry
            entity_type = self._get_entity_type(instance)
            entity_id = getattr(instance, 'id', None)
            description = self._get_entity_description(instance, action)
            metadata = self._create_activity_metadata(instance, action)
            
            
            # Create the activity log using the model's factory method
            activity = ActivityLog.create_activity(
                action=action,
                entity_type=entity_type,
                description=description,
                user_id=user_id,
                patient_id=patient_id,
                entity_id=entity_id,
                metadata=metadata,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            
            # Set the flag to prevent recursive activity logging
            activity_logging_in_progress_var.set(True)
            
            try:
                # Get a new session to save the activity log
                # This prevents issues with the current transaction
                from app.core.database.database import SessionLocal
                with SessionLocal() as db:
                    db.add(activity)
                    db.commit()
            finally:
                # Always clear the flag
                activity_logging_in_progress_var.set(False)
                
            # Log to application logger as well
            priority = ActivityPriority.get_priority_for_action(action, entity_type)
            activity_logger.info(
                f"Activity logged: {description}",
                extra={
                    "category": "activity_tracking",
                    "action": action,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "user_id": user_id,
                    "patient_id": patient_id,
                    "priority": priority,
                }
            )
            
        except Exception as e:
            # Don't let activity logging break the main operation
            activity_logger.error(
                f"Failed to log activity for {type(instance).__name__}: {e}",
                extra={
                    "category": "activity_tracking_error",
                    "entity_type": self._get_entity_type(instance),
                    "action": action,
                    "error": str(e),
                }
            )


# Global activity tracker instance
activity_tracker = ActivityTracker()

# Track if activity tracking has been initialized
_activity_tracking_initialized = False


def set_current_user_context(
    user_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    """
    Set the current user context for activity tracking.
    
    This should be called at the beginning of each request to provide
    context for automatic activity logging.
    
    Args:
        user_id: Current user ID
        patient_id: Current patient ID (if applicable)
        ip_address: Client IP address
        user_agent: Client user agent string
    """
    current_user_id_var.set(user_id)
    current_patient_id_var.set(patient_id)
    current_ip_address_var.set(ip_address)
    current_user_agent_var.set(user_agent)


def clear_current_user_context() -> None:
    """
    Clear the current user context.
    
    This should be called at the end of each request to clean up context.
    """
    current_user_id_var.set(None)
    current_patient_id_var.set(None)
    current_ip_address_var.set(None)
    current_user_agent_var.set(None)


def get_current_user_context() -> Dict[str, Any]:
    """
    Get the current user context for debugging purposes.
    
    Returns:
        Dictionary with current context values
    """
    return {
        "user_id": current_user_id_var.get(),
        "patient_id": current_patient_id_var.get(),
        "ip_address": current_ip_address_var.get(),
        "user_agent": current_user_agent_var.get(),
    }


def initialize_activity_tracking() -> None:
    """
    Initialize activity tracking by registering all models.
    
    This should be called during application startup.
    """
    global _activity_tracking_initialized
    
    if _activity_tracking_initialized:
        activity_logger.warning("Activity tracking already initialized, skipping duplicate initialization")
        return
        
    activity_tracker.register_all_models()
    _activity_tracking_initialized = True
    activity_logger.info("Activity tracking initialized for all models")


def register_model_for_tracking(model_class: Type) -> None:
    """
    Register a specific model class for activity tracking.
    
    Args:
        model_class: SQLAlchemy model class to track
    """
    activity_tracker.register_model(model_class)
