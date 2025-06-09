from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Any

from app.api import deps
from app.crud.patient import patient
from app.schemas.patient import Patient, PatientCreate, PatientUpdate
from app.core.logging_config import get_logger, log_medical_access
from app.core.security_audit import security_audit
from app.core.medical_audit import medical_auditor

router = APIRouter()

# Initialize loggers
logger = get_logger(__name__, "app")
medical_logger = get_logger(__name__, "medical")


@router.get("/me", response_model=Patient)
def get_my_patient_record(
    request: Request,
    db: Session = Depends(deps.get_db),
    user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get current user's patient record.

    Returns the patient record with all basic information:
    - first_name, last_name
    - birthDate
    - gender
    - address    """
    client_ip = request.client.host if request.client else "unknown"

    patient_record = patient.get_by_user_id(db, user_id=user_id)
    if not patient_record:
        # Enhanced logging for missing patient record using medical auditor
        medical_auditor.log_patient_data_access(
            user_id=user_id,
            patient_id=0,  # No patient ID since record doesn't exist
            action="read",
            ip_address=client_ip,
            resource_type="patient_record",
            success=False,
            error_message="Patient record not found"
        )
        
        # Also log through existing systems for backwards compatibility
        security_audit.log_data_access(
            user_id=user_id,
            username="unknown",  # Would need to get from token
            ip_address=client_ip,
            resource_type="patient_record",
            resource_id=None,
            action="read",
            success=False,
            details={"reason": "patient_record_not_found"},
        )

        logger.warning(
            f"Patient record not found for user {user_id}",
            extra={
                "category": "medical",
                "event": "patient_record_not_found",
                "user_id": user_id,
                "ip": client_ip,
            },
        )
        raise HTTPException(status_code=404, detail="Patient record not found")    # Enhanced logging for successful patient record access
    patient_id = getattr(patient_record, "id", 0)
    
    # Comprehensive medical audit logging
    fields_accessed = ["first_name", "last_name", "birthDate", "gender", "address"]
    medical_auditor.log_patient_data_access(
        user_id=user_id,
        patient_id=patient_id,
        action="read",
        ip_address=client_ip,
        resource_type="patient_record",
        resource_id=patient_id,
        fields_accessed=fields_accessed,
        success=True
    )

    # Log medical data access for audit trail (existing system)
    security_audit.log_data_access(
        user_id=user_id,
        username="unknown",  # Would need to get from token for full audit
        ip_address=client_ip,
        resource_type="patient_record",
        resource_id=patient_id,
        action="read",
        success=True,
        details={
            "fields_accessed": fields_accessed
        },
    )    # Log successful patient record access
    log_medical_access(
        medical_logger,
        event="patient_record_accessed",
        user_id=user_id,
        patient_id=patient_id,
        ip_address=client_ip,
        message=f"User {user_id} accessed their patient record"
    )

    return patient_record


@router.post("/me", response_model=Patient)
def create_my_patient_record(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_in: PatientCreate,
    user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create patient record for current user.

    Required fields:
    - first_name
    - last_name
    - birthDate (YYYY-MM-DD format)
    - gender
    - address
    """
    client_ip = request.client.host if request.client else "unknown"
    
    # Check if user already has a patient record
    existing_patient = patient.get_by_user_id(db, user_id=user_id)
    if existing_patient:
        # Log failed creation attempt
        existing_patient_id = getattr(existing_patient, "id", 0)
        medical_auditor.log_patient_data_access(
            user_id=user_id,
            patient_id=existing_patient_id,
            action="create",
            ip_address=client_ip,
            resource_type="patient_record",
            success=False,
            error_message="Patient record already exists"
        )
        raise HTTPException(status_code=400, detail="Patient record already exists")

    try:
        # Create patient record
        new_patient = patient.create_for_user(db, user_id=user_id, patient_data=patient_in)
        patient_id = getattr(new_patient, "id", None)
        
        # Log successful patient record creation
        if patient_id:
            medical_auditor.log_patient_data_access(
                user_id=user_id,
                patient_id=int(patient_id),
                action="create",
                ip_address=client_ip,
                resource_type="patient_record",
                resource_id=int(patient_id),
                fields_accessed=["first_name", "last_name", "birthDate", "gender", "address"],
                success=True,
                new_values=patient_in.dict()
            )
        
        return new_patient
        
    except Exception as e:
        # Log failed patient record creation
        medical_auditor.log_patient_data_access(
            user_id=user_id,
            patient_id=0,
            action="create",
            ip_address=client_ip,
            resource_type="patient_record",
            success=False,
            error_message=str(e),
            new_values=patient_in.dict()
        )
        raise


@router.put("/me", response_model=Patient)
def update_my_patient_record(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_in: PatientUpdate,
    user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Update current user's patient record.

    All fields are optional for updates:
    - first_name
    - last_name
    - birthDate
    - gender
    - address
    """
    client_ip = request.client.host if request.client else "unknown"
    
    # Get existing patient record for audit
    existing_patient = patient.get_by_user_id(db, user_id=user_id)
    if not existing_patient:
        # Log failed update attempt
        medical_auditor.log_patient_data_access(
            user_id=user_id,
            patient_id=0,
            action="update",
            ip_address=client_ip,
            resource_type="patient_record",
            success=False,
            error_message="Patient record not found"
        )
        raise HTTPException(status_code=404, detail="Patient record not found")
    
    # Get previous values for audit
    patient_id = getattr(existing_patient, "id", None)
    previous_data = {
        "first_name": getattr(existing_patient, "first_name", None),
        "last_name": getattr(existing_patient, "last_name", None),
        "birthDate": str(getattr(existing_patient, "birthDate", None)),
        "gender": getattr(existing_patient, "gender", None),
        "address": getattr(existing_patient, "address", None),
    }
    
    try:
        updated_patient = patient.update_for_user(
            db, user_id=user_id, patient_data=patient_in
        )
        
        # Log successful patient record update
        if patient_id:
            fields_updated = list(patient_in.dict(exclude_unset=True).keys())
            medical_auditor.log_patient_data_access(
                user_id=user_id,
                patient_id=int(patient_id),
                action="update",
                ip_address=client_ip,
                resource_type="patient_record",
                resource_id=int(patient_id),
                fields_accessed=fields_updated,
                success=True,
                previous_values=previous_data,
                new_values=patient_in.dict(exclude_unset=True)
            )
        
        return updated_patient
        
    except Exception as e:
        # Log failed patient record update
        if patient_id:
            medical_auditor.log_patient_data_access(
                user_id=user_id,
                patient_id=int(patient_id),
                action="update",
                ip_address=client_ip,
                resource_type="patient_record",
                resource_id=int(patient_id),
                success=False,
                error_message=str(e),
                previous_values=previous_data,
                new_values=patient_in.dict(exclude_unset=True)
            )
        raise


@router.delete("/me")
def delete_my_patient_record(
    request: Request,
    db: Session = Depends(deps.get_db), 
    user_id: int = Depends(deps.get_current_user_id)
) -> Any:
    """
    Delete current user's patient record.

    Warning: This will also delete all associated medical records:
    - medications, encounters, lab_results
    - immunizations, conditions, procedures, treatments
    """
    client_ip = request.client.host if request.client else "unknown"
    
    # Get existing patient record for audit
    existing_patient = patient.get_by_user_id(db, user_id=user_id)
    if not existing_patient:
        # Log failed deletion attempt
        medical_auditor.log_patient_data_access(
            user_id=user_id,
            patient_id=0,
            action="delete",
            ip_address=client_ip,
            resource_type="patient_record",
            success=False,
            error_message="Patient record not found"
        )
        raise HTTPException(status_code=404, detail="Patient record not found")
    
    # Get patient data for audit before deletion
    patient_id = getattr(existing_patient, "id", None)
    patient_data = {
        "first_name": getattr(existing_patient, "first_name", None),
        "last_name": getattr(existing_patient, "last_name", None),
        "birthDate": str(getattr(existing_patient, "birthDate", None)),
        "gender": getattr(existing_patient, "gender", None),
        "address": getattr(existing_patient, "address", None),
    }
    
    try:
        deleted_patient = patient.delete_for_user(db, user_id=user_id)
        
        # Log successful patient record deletion
        if patient_id:
            medical_auditor.log_patient_data_access(
                user_id=user_id,
                patient_id=int(patient_id),
                action="delete",
                ip_address=client_ip,
                resource_type="patient_record",
                resource_id=int(patient_id),
                fields_accessed=["complete_record"],
                success=True,
                previous_values=patient_data
            )
        
        return {"message": "Patient record deleted successfully"}
        
    except Exception as e:
        # Log failed patient record deletion
        if patient_id:
            medical_auditor.log_patient_data_access(
                user_id=user_id,
                patient_id=int(patient_id),
                action="delete",
                ip_address=client_ip,
                resource_type="patient_record",
                resource_id=int(patient_id),
                success=False,
                error_message=str(e),
                previous_values=patient_data
            )
        raise
