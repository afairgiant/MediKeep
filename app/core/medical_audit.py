"""
Medical Data Audit Logging Module for Medical Records Management System.

This module provides comprehensive audit logging for all medical data operations
to ensure HIPAA compliance and detailed tracking of patient data access.

Features:
- Patient record access logging
- Medical data modification tracking
- CRUD operation audit trails
- User attribution for all medical actions
- HIPAA-compliant logging format
"""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from app.core.logging_config import get_logger, log_medical_access
from app.core.security_audit import security_audit


class MedicalDataAuditor:
    """
    Comprehensive medical data audit logging system.

    Provides detailed audit trails for all medical data operations including
    patient records, medications, lab results, treatments, and more.
    """

    def __init__(self):
        self.medical_logger = get_logger("medical_auditor", "medical")
        self.security_logger = get_logger("medical_auditor", "security")

    def log_patient_data_access(
        self,
        user_id: int,
        patient_id: int,
        action: str,
        ip_address: str,
        resource_type: str = "patient_record",
        resource_id: Optional[int] = None,
        fields_accessed: Optional[List[str]] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        previous_values: Optional[Dict] = None,
        new_values: Optional[Dict] = None,
        username: Optional[str] = None,
    ):
        """
        Log patient data access with comprehensive audit information.

        Args:
            user_id: ID of the user performing the action
            patient_id: ID of the patient whose data is being accessed
            action: Type of action (read, create, update, delete)
            ip_address: Client IP address
            resource_type: Type of medical data (patient_record, medication, lab_result, etc.)
            resource_id: ID of the specific resource being accessed
            fields_accessed: List of fields that were accessed/modified
            success: Whether the operation was successful
            error_message: Error message if operation failed
            previous_values: Previous values for update operations
            new_values: New values for update operations
            username: Username of the person accessing data
        """
        audit_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "patient_id": patient_id,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "ip_address": ip_address,
            "success": success,
            "fields_accessed": fields_accessed or [],
            "username": username or "unknown",
        }

        if error_message:
            audit_data["error_message"] = error_message

        if previous_values:
            audit_data["previous_values"] = previous_values

        if new_values:
            audit_data["new_values"] = new_values
        # Log to medical audit log
        log_medical_access(
            self.medical_logger,
            event=f"medical_data_{action}",
            user_id=user_id,
            patient_id=patient_id,
            ip_address=ip_address,
            message=f"Medical data {action}: {resource_type}",
            resource_type=resource_type,
            resource_id=resource_id,
            fields_accessed=fields_accessed or [],
            success=success,
            error_message=error_message,
            timestamp=datetime.utcnow().isoformat(),
        )

        # Also log to security audit system
        security_audit.log_data_access(
            user_id=user_id,
            username=username or "unknown",
            ip_address=ip_address,
            resource_type=resource_type,
            resource_id=resource_id,
            action=action,
            success=success,
            details={
                "patient_id": patient_id,
                "fields_accessed": fields_accessed,
                "error_message": error_message,
                "has_changes": bool(previous_values or new_values),
            },
        )

    def log_medication_operation(
        self,
        user_id: int,
        patient_id: int,
        medication_id: Optional[int],
        action: str,
        ip_address: str,
        medication_data: Optional[Dict] = None,
        previous_data: Optional[Dict] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        username: Optional[str] = None,
    ):
        """Log medication-specific operations."""
        fields_accessed = []
        if medication_data:
            fields_accessed = list(medication_data.keys())

        self.log_patient_data_access(
            user_id=user_id,
            patient_id=patient_id,
            action=action,
            ip_address=ip_address,
            resource_type="medication",
            resource_id=medication_id,
            fields_accessed=fields_accessed,
            success=success,
            error_message=error_message,
            previous_values=previous_data,
            new_values=medication_data,
            username=username,
        )

    def log_lab_result_operation(
        self,
        user_id: int,
        patient_id: int,
        lab_result_id: Optional[int],
        action: str,
        ip_address: str,
        lab_data: Optional[Dict] = None,
        previous_data: Optional[Dict] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        username: Optional[str] = None,
    ):
        """Log lab result specific operations."""
        fields_accessed = []
        if lab_data:
            fields_accessed = list(lab_data.keys())

        self.log_patient_data_access(
            user_id=user_id,
            patient_id=patient_id,
            action=action,
            ip_address=ip_address,
            resource_type="lab_result",
            resource_id=lab_result_id,
            fields_accessed=fields_accessed,
            success=success,
            error_message=error_message,
            previous_values=previous_data,
            new_values=lab_data,
            username=username,
        )

    def log_treatment_operation(
        self,
        user_id: int,
        patient_id: int,
        treatment_id: Optional[int],
        action: str,
        ip_address: str,
        treatment_data: Optional[Dict] = None,
        previous_data: Optional[Dict] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        username: Optional[str] = None,
    ):
        """Log treatment specific operations."""
        fields_accessed = []
        if treatment_data:
            fields_accessed = list(treatment_data.keys())

        self.log_patient_data_access(
            user_id=user_id,
            patient_id=patient_id,
            action=action,
            ip_address=ip_address,
            resource_type="treatment",
            resource_id=treatment_id,
            fields_accessed=fields_accessed,
            success=success,
            error_message=error_message,
            previous_values=previous_data,
            new_values=treatment_data,
            username=username,
        )

    def log_file_operation(
        self,
        user_id: int,
        patient_id: int,
        file_id: Optional[int],
        action: str,
        ip_address: str,
        filename: Optional[str] = None,
        file_type: Optional[str] = None,
        file_size: Optional[int] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        username: Optional[str] = None,
    ):
        """Log file upload/download/delete operations."""
        file_data = {}
        if filename:
            file_data["filename"] = filename
        if file_type:
            file_data["file_type"] = file_type
        if file_size:
            file_data["file_size"] = file_size

        self.log_patient_data_access(
            user_id=user_id,
            patient_id=patient_id,
            action=action,
            ip_address=ip_address,
            resource_type="medical_file",
            resource_id=file_id,
            fields_accessed=list(file_data.keys()) if file_data else [],
            success=success,
            error_message=error_message,
            new_values=file_data if file_data else None,
            username=username,
        )

    def log_bulk_operation(
        self,
        user_id: int,
        patient_id: int,
        action: str,
        ip_address: str,
        resource_type: str,
        affected_records: int,
        operation_details: Optional[Dict] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        username: Optional[str] = None,
    ):
        """Log bulk operations affecting multiple records."""
        bulk_data = {
            "affected_records": affected_records,
            "operation_type": "bulk_operation",
        }
        if operation_details:
            bulk_data.update(operation_details)

        self.log_patient_data_access(
            user_id=user_id,
            patient_id=patient_id,
            action=f"bulk_{action}",
            ip_address=ip_address,
            resource_type=resource_type,
            resource_id=None,
            fields_accessed=["bulk_operation"],
            success=success,
            error_message=error_message,
            new_values=bulk_data,
            username=username,
        )

    def log_medical_history_access(
        self,
        user_id: int,
        patient_id: int,
        ip_address: str,
        history_types: List[str],
        date_range: Optional[Dict] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        username: Optional[str] = None,
    ):
        """Log comprehensive medical history access."""
        history_data = {"history_types": history_types, "comprehensive_access": True}
        if date_range:
            history_data["date_range"] = date_range

        self.log_patient_data_access(
            user_id=user_id,
            patient_id=patient_id,
            action="read_comprehensive_history",
            ip_address=ip_address,
            resource_type="medical_history",
            resource_id=patient_id,
            fields_accessed=history_types,
            success=success,
            error_message=error_message,
            new_values=history_data,
            username=username,
        )


# Create global instance
medical_auditor = MedicalDataAuditor()
