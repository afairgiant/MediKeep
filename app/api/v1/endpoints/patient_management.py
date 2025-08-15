"""
V1 Patient Management API Endpoints - Netflix-style patient switching and management
"""

from typing import Any, List, Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, Request
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field, validator, root_validator
from sqlalchemy.orm import Session

from app.api import deps
from app.core.logging_config import get_logger
from app.core.error_handling import (
    NotFoundException,
    ForbiddenException,
    BusinessLogicException,
    handle_database_errors,
    DatabaseException
)
from app.services.patient_management import PatientManagementService
from app.services.patient_access import PatientAccessService
from app.schemas.patient import PatientCreate, PatientUpdate
from app.models.models import User, Patient

router = APIRouter()
logger = get_logger(__name__, "app")


# Note: Validation error handling is now managed globally in app/main.py
# The global handler provides consistent error responses across all endpoints


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
    height: Optional[float] = Field(None, gt=0, le=108, description="Height in inches (1-9 feet)")
    weight: Optional[float] = Field(None, gt=0, le=992, description="Weight in pounds (1-992 lbs)")
    address: Optional[str] = Field(None, max_length=500)
    physician_id: Optional[int] = Field(None, gt=0, description="Primary care physician ID")

    @root_validator(pre=True)
    def convert_empty_strings_to_none(cls, values):
        """Convert empty strings to None for optional fields to prevent validation errors"""
        if isinstance(values, dict):
            for field in [
                "first_name", "last_name", "birth_date", "gender", 
                "blood_type", "height", "weight", "address", "physician_id"
            ]:
                if field in values and values[field] == "":
                    values[field] = None
        return values

    @validator("birth_date")
    def validate_birth_date(cls, v):
        """Validate birth date is reasonable"""
        if v is not None:
            today = date.today()
            if v > today:
                raise ValueError("Birth date cannot be in the future")
            if today.year - v.year > 150:
                raise ValueError("Birth date cannot be more than 150 years ago")
        return v

    @validator("address")
    def validate_address(cls, v):
        """Validate address minimum length if provided"""
        if v is not None and v.strip() and len(v.strip()) < 5:
            raise ValueError("Address must be at least 5 characters long")
        return v.strip() if v else v

    @validator("blood_type")
    def validate_blood_type(cls, v):
        """Validate blood type format"""
        if v is not None and v.strip():
            valid_types = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
            blood_type_upper = v.upper().strip()
            if blood_type_upper not in valid_types:
                raise ValueError(f"Blood type must be one of: {', '.join(valid_types)}")
            return blood_type_upper
        return v

    @validator("gender")
    def validate_gender(cls, v):
        """Validate gender"""
        if v is not None and v.strip():
            allowed = ["M", "F", "MALE", "FEMALE", "OTHER", "U", "UNKNOWN"]
            gender_upper = v.upper()
            if gender_upper not in allowed:
                raise ValueError(f"Gender must be one of: {', '.join(allowed)}")
            # Normalize common values
            gender_map = {"MALE": "M", "FEMALE": "F", "UNKNOWN": "U"}
            return gender_map.get(gender_upper, gender_upper)
        return v


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
    
    with handle_database_errors(request=request):
        service = PatientManagementService(db)
        
        # Check for self-record duplication
        if patient_in.is_self_record:
            existing_self = service.get_self_record(current_user)
            if existing_self:
                raise BusinessLogicException(
                    message="You already have a self-record. Only one self-record per user is allowed.",
                    request=request
                )
        
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


@router.get("/", response_model=PatientListResponse)
def get_accessible_patients(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    permission: str = Query("view", description="Required permission level"),
) -> Any:
    """
    Get all patients accessible to the current user.
    
    Returns both owned patients and patients shared with the user.
    """
    with handle_database_errors(request=request):
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


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    patient_id: int,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get a specific patient by ID.
    
    User must have access to this patient.
    """
    with handle_database_errors(request=request):
        service = PatientManagementService(db)
        patient = service.get_patient(current_user, patient_id)
        
        if not patient:
            raise NotFoundException(
                resource="Patient",
                message=f"Patient with ID {patient_id} not found",
                request=request
            )
        
        return PatientResponse.model_validate(patient)


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
    
    Common validation errors (422):
    - Height must be between 1-108 inches (1-9 feet)
    - Weight must be between 1-992 pounds
    - Birth date cannot be in the future or >150 years ago
    - Address must be at least 5 characters if provided
    - Blood type must be valid (A+, A-, B+, B-, AB+, AB-, O+, O-)
    - Gender must be valid (M, F, MALE, FEMALE, OTHER, U, UNKNOWN)
    """
    user_ip = request.client.host if request.client else "unknown"
    
    # Log the incoming request without sensitive data
    logger.debug(
        f"Patient update request for patient {patient_id}",
        extra={
            "category": "app",
            "event": "patient_update_request",
            "user_id": current_user.id,
            "patient_id": patient_id,
            "fields_provided": list(patient_in.dict(exclude_unset=True).keys()),
            "ip": user_ip,
        }
    )
    
    with handle_database_errors(request=request):
        service = PatientManagementService(db)
        
        # Check if patient exists first
        existing_patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not existing_patient:
            raise NotFoundException(
                resource="Patient",
                message=f"Patient with ID {patient_id} not found",
                request=request
            )
        
        # Check permissions
        from app.services.patient_access import PatientAccessService
        access_service = PatientAccessService(db)
        if not access_service.can_access_patient(current_user, existing_patient, 'edit'):
            raise ForbiddenException(
                message="You don't have permission to edit this patient",
                request=request
            )
        
        # Filter out None values
        patient_data = {k: v for k, v in patient_in.dict().items() if v is not None}
        
        # Log fields being updated without sensitive values
        if patient_data:
            logger.debug(
                f"Updating patient {patient_id} fields",
                extra={
                    "category": "app",
                    "event": "patient_update_data_filtered",
                    "user_id": current_user.id,
                    "patient_id": patient_id,
                    "fields_updated": list(patient_data.keys()),
                }
            )
        
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
    
    with handle_database_errors(request=request):
        service = PatientManagementService(db)
        
        # Check if patient exists
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise NotFoundException(
                resource="Patient",
                message=f"Patient with ID {patient_id} not found",
                request=request
            )
        
        # Check ownership
        if patient.owner_user_id != current_user.id:
            raise ForbiddenException(
                message="Only the patient owner can delete this record",
                request=request
            )
        
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
            raise DatabaseException(
                message="Failed to delete patient record",
                request=request
            )


@router.get("/owned/list", response_model=List[PatientResponse])
def get_owned_patients(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get all patients owned by the current user.
    """
    with handle_database_errors(request=request):
        service = PatientManagementService(db)
        patients = service.get_owned_patients(current_user)
        
        return [PatientResponse.model_validate(p) for p in patients]


@router.get("/self-record", response_model=Optional[PatientResponse])
def get_self_record(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get the user's self-record patient.
    
    Returns null if the user doesn't have a self-record.
    """
    with handle_database_errors(request=request):
        service = PatientManagementService(db)
        patient = service.get_self_record(current_user)
        
        if patient:
            return PatientResponse.model_validate(patient)
        else:
            return None


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
    
    with handle_database_errors(request=request):
        service = PatientManagementService(db)
        
        # Check if target patient exists and user has access
        target_patient = db.query(Patient).filter(Patient.id == switch_request.patient_id).first()
        if not target_patient:
            raise NotFoundException(
                resource="Patient",
                message=f"Patient with ID {switch_request.patient_id} not found",
                request=request
            )
        
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


@router.get("/active/current", response_model=Optional[PatientResponse])
def get_active_patient(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get the user's currently active patient.
    
    Returns null if no active patient is set or if the active patient is no longer accessible.
    """
    with handle_database_errors(request=request):
        service = PatientManagementService(db)
        patient = service.get_active_patient(current_user)
        
        if patient:
            return PatientResponse.model_validate(patient)
        else:
            return None


@router.get("/stats")
def get_patient_statistics(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get statistics about the user's patients.
    
    Returns counts and metadata about accessible patients.
    """
    with handle_database_errors(request=request):
        service = PatientManagementService(db)
        stats = service.get_patient_statistics(current_user)
        
        return {
            'owned_count': stats['owned_count'],
            'accessible_count': stats['accessible_count'],
            'has_self_record': stats['has_self_record'],
            'active_patient_id': stats['active_patient_id'],
            'sharing_stats': stats['sharing_stats']
        }