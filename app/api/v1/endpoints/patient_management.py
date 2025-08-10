"""
V1 Patient Management API Endpoints - Netflix-style patient switching and management
"""

from typing import Any, List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api import deps
from app.core.logging_config import get_logger
from app.services.patient_management import PatientManagementService
from app.services.patient_access import PatientAccessService
from app.schemas.patient import Patient, PatientCreate, PatientUpdate
from app.models.models import User

router = APIRouter()
logger = get_logger(__name__, "app")


class PatientCreateRequest(BaseModel):
    """Request model for creating a new patient"""
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    birth_date: date = Field(..., description="Birth date")
    gender: Optional[str] = Field(None, max_length=20)
    blood_type: Optional[str] = Field(None, max_length=5)
    height: Optional[float] = Field(None, gt=0, description="Height in inches")
    weight: Optional[float] = Field(None, gt=0, description="Weight in pounds")
    address: Optional[str] = Field(None, max_length=500)
    physician_id: Optional[int] = Field(None, description="Primary care physician ID")
    is_self_record: bool = Field(False, description="Whether this is the user's own medical record")


class PatientUpdateRequest(BaseModel):
    """Request model for updating a patient"""
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    birth_date: Optional[date] = Field(None, description="Birth date")
    gender: Optional[str] = Field(None, max_length=20)
    blood_type: Optional[str] = Field(None, max_length=5)
    height: Optional[float] = Field(None, gt=0, description="Height in inches")
    weight: Optional[float] = Field(None, gt=0, description="Weight in pounds")
    address: Optional[str] = Field(None, max_length=500)
    physician_id: Optional[int] = Field(None, description="Primary care physician ID")


class PatientResponse(BaseModel):
    """Response model for patient data"""
    id: int
    first_name: str
    last_name: str
    birth_date: date
    gender: Optional[str]
    blood_type: Optional[str]
    height: Optional[float]
    weight: Optional[float]
    address: Optional[str]
    physician_id: Optional[int]
    owner_user_id: int
    is_self_record: bool
    privacy_level: str

    class Config:
        from_attributes = True


class PatientListResponse(BaseModel):
    """Response model for patient list"""
    patients: List[PatientResponse]
    total_count: int
    owned_count: int
    shared_count: int


class SharingStatsResponse(BaseModel):
    """Response model for sharing statistics"""
    owned: int
    shared_with_me: int
    total_accessible: int


class PatientStatsResponse(BaseModel):
    """Response model for patient statistics"""
    owned_count: int
    accessible_count: int
    has_self_record: bool
    active_patient_id: Optional[int]
    sharing_stats: dict


class SwitchPatientRequest(BaseModel):
    """Request model for switching active patient"""
    patient_id: int = Field(..., description="ID of the patient to switch to")


@router.post("/", response_model=PatientResponse)
def create_patient(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_in: PatientCreateRequest,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Create a new patient record.
    
    The user will own this patient record and can manage it.
    Only one self-record per user is allowed.
    """
    user_ip = request.client.host if request.client else "unknown"
    
    try:
        service = PatientManagementService(db)
        patient = service.create_patient(
            user=current_user,
            patient_data=patient_in.dict(),
            is_self_record=patient_in.is_self_record
        )
        
        logger.info(
            f"User {current_user.id} created patient {patient.id}",
            extra={
                "category": "app",
                "event": "patient_created",
                "user_id": current_user.id,
                "patient_id": patient.id,
                "is_self_record": patient_in.is_self_record,
                "ip": user_ip,
            }
        )
        
        return PatientResponse.model_validate(patient)
        
    except Exception as e:
        logger.error(
            f"Failed to create patient for user {current_user.id}: {str(e)}",
            extra={
                "category": "app",
                "event": "patient_creation_failed",
                "user_id": current_user.id,
                "error": str(e),
                "ip": user_ip,
            }
        )
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=PatientListResponse)
def get_accessible_patients(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    permission: str = Query("view", description="Required permission level"),
) -> Any:
    """
    Get all patients accessible to the current user.
    
    Returns both owned patients and patients shared with the user.
    """
    try:
        service = PatientManagementService(db)
        access_service = PatientAccessService(db)
        
        # Get accessible patients
        accessible_patients = access_service.get_accessible_patients(current_user, permission)
        
        # Get owned patients for statistics
        owned_patients = service.get_owned_patients(current_user)
        
        # Calculate statistics
        total_count = len(accessible_patients)
        owned_count = len(owned_patients)
        shared_count = total_count - owned_count
        
        # Convert to response format
        patient_responses = [PatientResponse.model_validate(p) for p in accessible_patients]
        
        return PatientListResponse(
            patients=patient_responses,
            total_count=total_count,
            owned_count=owned_count,
            shared_count=shared_count
        )
        
    except Exception as e:
        logger.error(f"Failed to get accessible patients for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve patients")


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get a specific patient by ID.
    
    User must have access to this patient.
    """
    try:
        service = PatientManagementService(db)
        patient = service.get_patient(current_user, patient_id)
        
        return PatientResponse.model_validate(patient)
        
    except Exception as e:
        logger.error(f"Failed to get patient {patient_id} for user {current_user.id}: {str(e)}")
        
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        elif "permission" in str(e).lower():
            raise HTTPException(status_code=403, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail="Failed to retrieve patient")


@router.put("/{patient_id}", response_model=PatientResponse)
def update_patient(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    patient_in: PatientUpdateRequest,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Update a patient record.
    
    User must have edit permission for this patient.
    """
    user_ip = request.client.host if request.client else "unknown"
    
    try:
        service = PatientManagementService(db)
        
        # Filter out None values
        patient_data = {k: v for k, v in patient_in.dict().items() if v is not None}
        
        patient = service.update_patient(current_user, patient_id, patient_data)
        
        logger.info(
            f"User {current_user.id} updated patient {patient_id}",
            extra={
                "category": "app",
                "event": "patient_updated",
                "user_id": current_user.id,
                "patient_id": patient_id,
                "ip": user_ip,
            }
        )
        
        return PatientResponse.model_validate(patient)
        
    except Exception as e:
        logger.error(
            f"Failed to update patient {patient_id} for user {current_user.id}: {str(e)}",
            extra={
                "category": "app",
                "event": "patient_update_failed",
                "user_id": current_user.id,
                "patient_id": patient_id,
                "error": str(e),
                "ip": user_ip,
            }
        )
        
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        elif "permission" in str(e).lower():
            raise HTTPException(status_code=403, detail=str(e))
        else:
            raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{patient_id}")
def delete_patient(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Delete a patient record.
    
    Only the patient owner can delete the record.
    This will also delete all associated medical records.
    """
    user_ip = request.client.host if request.client else "unknown"
    
    try:
        service = PatientManagementService(db)
        success = service.delete_patient(current_user, patient_id)
        
        if success:
            logger.info(
                f"User {current_user.id} deleted patient {patient_id}",
                extra={
                    "category": "app",
                    "event": "patient_deleted",
                    "user_id": current_user.id,
                    "patient_id": patient_id,
                    "ip": user_ip,
                }
            )
            
            return {"message": "Patient record and all associated medical records deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete patient")
            
    except Exception as e:
        logger.error(
            f"Failed to delete patient {patient_id} for user {current_user.id}: {str(e)}",
            extra={
                "category": "app",
                "event": "patient_deletion_failed",
                "user_id": current_user.id,
                "patient_id": patient_id,
                "error": str(e),
                "ip": user_ip,
            }
        )
        
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        elif "permission" in str(e).lower():
            raise HTTPException(status_code=403, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail="Failed to delete patient")


@router.get("/owned/list", response_model=List[PatientResponse])
def get_owned_patients(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get all patients owned by the current user.
    """
    try:
        service = PatientManagementService(db)
        patients = service.get_owned_patients(current_user)
        
        return [PatientResponse.model_validate(p) for p in patients]
        
    except Exception as e:
        logger.error(f"Failed to get owned patients for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve owned patients")


@router.get("/self-record", response_model=Optional[PatientResponse])
def get_self_record(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get the user's self-record patient.
    
    Returns null if the user doesn't have a self-record.
    """
    try:
        service = PatientManagementService(db)
        patient = service.get_self_record(current_user)
        
        if patient:
            return PatientResponse.model_validate(patient)
        else:
            return None
            
    except Exception as e:
        logger.error(f"Failed to get self-record for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve self-record")


@router.post("/switch", response_model=PatientResponse)
def switch_active_patient(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    switch_request: SwitchPatientRequest,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Switch the user's active patient context (Netflix-style switching).
    
    The user must have access to the specified patient.
    """
    user_ip = request.client.host if request.client else "unknown"
    
    try:
        service = PatientManagementService(db)
        patient = service.switch_active_patient(current_user, switch_request.patient_id)
        
        logger.info(
            f"User {current_user.id} switched to patient {switch_request.patient_id}",
            extra={
                "category": "app",
                "event": "patient_switched",
                "user_id": current_user.id,
                "patient_id": switch_request.patient_id,
                "ip": user_ip,
            }
        )
        
        return PatientResponse.model_validate(patient)
        
    except Exception as e:
        logger.error(
            f"Failed to switch patient for user {current_user.id}: {str(e)}",
            extra={
                "category": "app",
                "event": "patient_switch_failed",
                "user_id": current_user.id,
                "patient_id": switch_request.patient_id,
                "error": str(e),
                "ip": user_ip,
            }
        )
        
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        elif "permission" in str(e).lower():
            raise HTTPException(status_code=403, detail=str(e))
        else:
            raise HTTPException(status_code=400, detail=str(e))


@router.get("/active/current", response_model=Optional[PatientResponse])
def get_active_patient(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get the user's currently active patient.
    
    Returns null if no active patient is set or if the active patient is no longer accessible.
    """
    try:
        service = PatientManagementService(db)
        patient = service.get_active_patient(current_user)
        
        if patient:
            return PatientResponse.model_validate(patient)
        else:
            return None
            
    except Exception as e:
        logger.error(f"Failed to get active patient for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve active patient")


@router.get("/stats")
def get_patient_statistics(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get statistics about the user's patients.
    
    Returns counts and metadata about accessible patients.
    """
    try:
        service = PatientManagementService(db)
        stats = service.get_patient_statistics(current_user)
        
        return {
            'owned_count': stats['owned_count'],
            'accessible_count': stats['accessible_count'],
            'has_self_record': stats['has_self_record'],
            'active_patient_id': stats['active_patient_id'],
            'sharing_stats': stats['sharing_stats']
        }
        
    except Exception as e:
        logger.error(f"Failed to get patient statistics for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve patient statistics")