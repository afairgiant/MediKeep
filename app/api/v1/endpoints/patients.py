from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, File, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload

from app.api import deps
from app.api.activity_logging import log_create, log_delete, log_update
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.logging.helpers import (
    log_endpoint_access,
    log_endpoint_error,
    log_data_access,
    log_security_event
)
from app.crud.patient import patient
from app.models.activity_log import ActivityLog
from app.models.activity_log import EntityType as ActivityEntityType
from app.models.models import Patient as PatientModel
from app.models.models import User
from app.schemas.medication import MedicationCreate, MedicationResponse
from app.schemas.patient import Patient, PatientCreate, PatientUpdate
from app.schemas.patient_photo import PatientPhotoResponse, PatientPhotoWithUrl
from app.services.patient_photo_service import patient_photo_service

router = APIRouter()

# Initialize logger
logger = get_logger(__name__, "app")


class UserRecentActivity(BaseModel):
    """Recent activity item schema for regular users"""

    id: int = Field(..., description="The ID of the record")
    model_name: str = Field(..., description="The type of medical record")
    action: str = Field(..., description="The action performed")
    description: str = Field(..., description="Description of the activity")
    timestamp: datetime = Field(..., description="When the activity occurred")


class PatientDashboardStats(BaseModel):
    """Dashboard statistics for a patient"""

    patient_id: int
    total_records: int
    active_medications: int
    total_lab_results: int
    total_procedures: int
    total_treatments: int
    total_conditions: int
    total_allergies: int
    total_immunizations: int
    total_encounters: int
    total_vitals: int


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
    - birth_date
    - gender
    - address"""
    patient_record = patient.get_by_user_id(db, user_id=user_id)
    if not patient_record:
        log_endpoint_access(
            logger, request, user_id, "patient_record_not_found",
            message="Patient record not found"
        )
        raise HTTPException(status_code=404, detail="Patient record not found")

    # Log successful access using helper
    log_endpoint_access(
        logger, request, user_id, "patient_record_accessed",
        patient_id=patient_record.id
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
    - birth_date (YYYY-MM-DD format)
    - gender
    - address
    """
    # Check if user already has a patient record
    existing_patient = patient.get_by_user_id(db, user_id=user_id)
    if existing_patient:
        log_security_event(
            logger, "duplicate_patient_record_attempt", request,
            f"Attempt to create duplicate patient record for user {user_id}",
            user_id=user_id
        )
        raise HTTPException(status_code=400, detail="Patient record already exists")

    try:
        # Create patient record
        new_patient = patient.create_for_user(
            db, user_id=user_id, patient_data=patient_in
        )

        # Log successful patient record creation using helper
        log_endpoint_access(
            logger, request, user_id, "patient_record_created",
            patient_id=new_patient.id
        )

        return new_patient

    except Exception as e:
        # Log failed patient record creation using helper
        log_endpoint_error(
            logger, request, "Failed to create patient record",
            e, user_id=user_id
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
    - birth_date
    - gender
    - address
    """
    # Get existing patient record for audit
    existing_patient = patient.get_by_user_id(db, user_id=user_id)
    if not existing_patient:
        log_endpoint_access(
            logger, request, user_id, "patient_record_update_not_found",
            message=f"Patient record not found for update by user {user_id}"
        )
        raise HTTPException(status_code=404, detail="Patient record not found")

    patient_id = getattr(existing_patient, "id", None)

    try:
        # Log update attempt without sensitive data
        log_endpoint_access(
            logger, request, user_id, "patient_record_update_attempt",
            patient_id=patient_id
        )

        updated_patient = patient.update_for_user(
            db, user_id=user_id, patient_data=patient_in
        )

        if not updated_patient:
            log_endpoint_error(
                logger, request, "Patient record update returned None",
                Exception("Update returned None"),
                user_id=user_id,
                patient_id=patient_id
            )
            raise HTTPException(status_code=500, detail="Failed to update patient record")

        # Log successful patient record update
        log_endpoint_access(
            logger, request, user_id, "patient_record_updated",
            patient_id=patient_id,
            message=f"Patient record updated successfully for user {user_id}",
            updated_id=updated_patient.id
        )

        return updated_patient

    except Exception as e:
        # Log failed patient record update
        log_endpoint_error(
            logger, request, f"Failed to update patient record for user {user_id}",
            e, user_id=user_id, patient_id=patient_id
        )
        raise


@router.delete("/me")
def delete_my_patient_record(
    request: Request,
    db: Session = Depends(deps.get_db),
    user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Delete current user's patient record.

    Warning: This will also delete all associated medical records:
    - medications, encounters, lab_results
    - immunizations, conditions, procedures, treatments
    """
    # Get existing patient record for audit
    existing_patient = patient.get_by_user_id(db, user_id=user_id)
    if not existing_patient:
        log_endpoint_access(
            logger, request, user_id, "patient_record_delete_not_found",
            message=f"Patient record not found for deletion by user {user_id}"
        )
        raise HTTPException(status_code=404, detail="Patient record not found")

    patient_id = getattr(existing_patient, "id", None)

    try:
        patient.delete_for_user(db, user_id=user_id)

        # Log successful patient record deletion
        log_endpoint_access(
            logger, request, user_id, "patient_record_deleted",
            patient_id=patient_id,
            message=f"Patient record deleted successfully for user {user_id}"
        )

        return {
            "message": "Patient record and all associated medical records deleted successfully"
        }

    except Exception as e:
        # Log failed patient record deletion
        log_endpoint_error(
            logger, request, f"Failed to delete patient record for user {user_id}",
            e, user_id=user_id, patient_id=patient_id
        )
        # Re-raise with more specific error message for the user
        raise HTTPException(
            status_code=500,
            detail="Failed to delete patient record and associated medical data. Please try again.",
        )


@router.get("/current", response_model=Patient)
def get_current_patient_record(
    request: Request,
    db: Session = Depends(deps.get_db),
    user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get current user's patient record (alias for /me endpoint).
    """
    return get_my_patient_record(request, db, user_id)


# Patient-specific medical record routes
# These provide convenient access to medical records via patient ID


@router.get("/{patient_id}/medications/")
def get_patient_medications(
    patient_id: int = Depends(deps.verify_patient_access),
    db: Session = Depends(deps.get_db),
):
    """Get medications for a specific patient"""
    from app.crud.medication import medication

    return medication.get_by_patient(
        db=db, patient_id=patient_id, load_relations=["practitioner", "pharmacy"]
    )


@router.post("/{patient_id}/medications/", response_model=MedicationResponse)
def create_patient_medication(
    medication_in: MedicationCreate,
    patient_id: int = Depends(deps.verify_patient_access),
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """Create a new medication for a specific patient"""
    from app.crud.medication import medication

    # Ensure the medication is associated with the correct patient
    medication_data = medication_in.model_dump()
    medication_data["patient_id"] = patient_id

    # Create the medication record
    medication_obj = medication.create(
        db=db, obj_in=MedicationCreate(**medication_data)
    )

    # Note: Request object not available in this endpoint, using structured logging
    logger.info(
        "Medication created for patient",
        extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "medication_created",
            LogFields.PATIENT_ID: patient_id,
            LogFields.RECORD_ID: medication_obj.id,
            LogFields.USER_ID: current_user_id
        }
    )
    return medication_obj


@router.get("/{patient_id}/conditions/")
def get_patient_conditions(
    patient_id: int = Depends(deps.verify_patient_access),
    db: Session = Depends(deps.get_db),
):
    """Get conditions for a specific patient"""
    from app.crud.condition import condition

    return condition.get_by_patient(
        db=db, patient_id=patient_id, load_relations=["practitioner"]
    )


@router.get("/{patient_id}/allergies/")
def get_patient_allergies(
    patient_id: int = Depends(deps.verify_patient_access),
    db: Session = Depends(deps.get_db),
):
    """Get allergies for a specific patient"""
    from app.crud.allergy import allergy

    return allergy.get_by_patient(db=db, patient_id=patient_id)


@router.get("/{patient_id}/immunizations/")
def get_patient_immunizations(
    patient_id: int = Depends(deps.verify_patient_access),
    db: Session = Depends(deps.get_db),
):
    """Get immunizations for a specific patient"""
    from app.crud.immunization import immunization

    return immunization.get_by_patient(
        db=db, patient_id=patient_id, load_relations=["practitioner"]
    )


@router.get("/{patient_id}/procedures/")
def get_patient_procedures(
    patient_id: int = Depends(deps.verify_patient_access),
    db: Session = Depends(deps.get_db),
):
    """Get procedures for a specific patient"""
    from app.crud.procedure import procedure

    return procedure.get_by_patient(
        db=db, patient_id=patient_id, load_relations=["practitioner"]
    )


@router.get("/{patient_id}/treatments/")
def get_patient_treatments(
    patient_id: int = Depends(deps.verify_patient_access),
    db: Session = Depends(deps.get_db),
):
    """Get treatments for a specific patient"""
    from app.crud.treatment import treatment

    return treatment.get_by_patient(
        db=db, patient_id=patient_id, load_relations=["practitioner", "condition"]
    )


@router.get("/{patient_id}/lab-results/")
def get_patient_lab_results(
    patient_id: int = Depends(deps.verify_patient_access),
    db: Session = Depends(deps.get_db),
):
    """Get lab results for a specific patient"""
    from app.crud.lab_result import lab_result

    return lab_result.get_by_patient(
        db=db, patient_id=patient_id, load_relations=["practitioner"]
    )


@router.get("/{patient_id}/encounters/")
def get_patient_encounters(
    patient_id: int = Depends(deps.verify_patient_access),
    db: Session = Depends(deps.get_db),
):
    """Get encounters for a specific patient"""
    from app.crud.encounter import encounter

    return encounter.get_by_patient(
        db=db, patient_id=patient_id, load_relations=["practitioner"]
    )


@router.get("/me/recent-activity", response_model=List[UserRecentActivity])
def get_my_recent_activity(
    request: Request,
    db: Session = Depends(deps.get_db),
    user_id: int = Depends(deps.get_current_user_id),
    limit: int = Query(10, le=100),
) -> Any:
    """
    Get recent medical-related activities for the current user.

    Returns a list of recent activities, including:
    - medication updates
    - lab results
    - immunizations
    - allergies
    - conditions
    - procedures
    - treatments
    - encounters
    - insurance

    Each activity includes a brief description and timestamp.
    """
    try:
        # Query the activity log for the user's recent activities
        activities = (
            db.query(ActivityLog)
            .filter(ActivityLog.user_id == user_id)
            .order_by(desc(ActivityLog.timestamp))
            .limit(limit)
            .all()
        )

        # Log successful activity retrieval
        log_endpoint_access(
            logger, request, user_id, "recent_activity_retrieved",
            message=f"User {user_id} retrieved their recent activity",
            activity_count=len(activities)
        )

        return activities

    except Exception as e:
        # Log failed activity retrieval
        log_endpoint_error(
            logger, request, f"Failed to retrieve recent activity for user {user_id}",
            e, user_id=user_id
        )
        raise


@router.get("/me/dashboard-stats", response_model=PatientDashboardStats)
async def get_my_dashboard_stats(
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    patient_id: Optional[int] = Query(
        None, description="Patient ID for Phase 1 patient switching"
    ),
) -> Any:
    """
    Get dashboard statistics for the specified patient.

    Returns counts of all medical records for the patient:
    - Total records count
    - Active medications count
    - Lab results count
    - Procedures count
    - Treatments count
    - Conditions count
    - Allergies count
    - Immunizations count
    - Encounters count
    - Vitals count

    Supports Phase 1 patient switching with patient_id parameter.
    """
    try:
        # Import ExportService here to avoid circular imports
        from app.services.export_service import ExportService

        # Get the target patient ID
        if patient_id:
            # Phase 1: Use provided patient_id with access control
            from app.services.patient_access import PatientAccessService

            access_service = PatientAccessService(db)

            # Get the patient record
            patient_record = (
                db.query(PatientModel).filter(PatientModel.id == patient_id).first()
            )
            if not patient_record:
                raise HTTPException(status_code=404, detail="Patient not found")

            # Check if user has access to this patient
            if not access_service.can_access_patient(
                current_user, patient_record, "view"
            ):
                raise HTTPException(status_code=403, detail="Access denied to patient")

            target_patient_id = patient_id
        else:
            # Legacy: Get user's patient record ID
            user_patient = (
                db.query(PatientModel)
                .filter(PatientModel.owner_user_id == current_user.id)
                .first()
            )
            if not user_patient:
                raise HTTPException(
                    status_code=404, detail="No patient record found for user"
                )
            target_patient_id = user_patient.id

        # Initialize export service and get summary
        export_service = ExportService(db)
        summary = await export_service.get_export_summary_by_patient_id(
            target_patient_id
        )

        counts = summary.get("counts", {})

        # Calculate total records
        total_records = sum(counts.values())

        # For active medications, we can use the medications count as a placeholder
        # since we don't have a status field yet. This can be refined later.
        active_medications = counts.get("medications", 0)

        return PatientDashboardStats(
            patient_id=summary["patient_id"],
            total_records=total_records,
            active_medications=active_medications,
            total_lab_results=counts.get("lab_results", 0),
            total_procedures=counts.get("procedures", 0),
            total_treatments=counts.get("treatments", 0),
            total_conditions=counts.get("conditions", 0),
            total_allergies=counts.get("allergies", 0),
            total_immunizations=counts.get("immunizations", 0),
            total_encounters=counts.get("encounters", 0),
            total_vitals=counts.get("vitals", 0),
        )

    except Exception as e:
        log_endpoint_error(
            logger, request, "Error fetching dashboard stats",
            e, user_id=current_user.id
        )
        raise HTTPException(
            status_code=500, detail="Error fetching dashboard statistics"
        )


@router.get("/recent-activity/", response_model=List[UserRecentActivity])
def get_user_recent_activity(
    request: Request,
    limit: int = Query(default=10, le=50),
    patient_id: int = Query(None, description="Filter by specific patient ID"),
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get recent medical activity for the current user.

    Returns recent activities related to all medical records including:
    - Medications
    - Lab Results & Lab Result Files
    - Vitals
    - Conditions
    - Allergies
    - Immunizations
    - Procedures
    - Treatments
    - Visits/Encounters
    - Insurance
    - Patient Info updates
    - Doctor/Practitioner interactions

    Excludes user management activities like creation/deletion.
    Includes both user actions and medical activities that affect the patient.
    """
    try:
        # Get the target patient record
        if patient_id:
            # Validate patient access using patient_access service
            from app.crud.user import user as user_crud
            from app.services.patient_access import PatientAccessService

            # Get user and patient objects
            user_obj = user_crud.get(db, id=current_user_id)
            if not user_obj:
                raise HTTPException(status_code=404, detail="User not found")

            access_service = PatientAccessService(db)

            # Get the specific patient record
            patient_record = patient.get(db, id=patient_id)
            if not patient_record:
                raise HTTPException(status_code=404, detail="Patient record not found")

            # Validate that the user has access to this patient
            if not access_service.can_access_patient(user_obj, patient_record):
                raise HTTPException(
                    status_code=403, detail="Access denied to this patient record"
                )
        else:
            # Default to user's own patient record
            patient_record = patient.get_by_user_id(db, user_id=current_user_id)
            if not patient_record:
                return []

        # Define medical entity types we want to include (all medical pages + doctors)
        medical_entity_types = [
            "medication",
            "lab_result",
            "vitals",
            "condition",
            "allergy",
            "immunization",
            "procedure",
            "treatment",
            "encounter",
            "emergency_contact",  # Emergency contacts page
            "patient",
            "practitioner",  # Doctors/practitioners page
            "pharmacy",  # Pharmacies page
            "lab_result_file",  # Lab result file uploads
            "insurance",  # Insurance page
        ]

        # Define universal entity types that should be shown regardless of patient
        universal_entity_types = ["practitioner", "pharmacy"]

        # Query activity logs for this patient's medical activities
        # Include activities that relate to this specific patient
        # Also include universal activities (practitioners, pharmacies) for all patients

        # Build the main filter condition
        main_filter = (ActivityLog.patient_id == patient_record.id) | (
            ActivityLog.entity_type.in_(universal_entity_types)
        )

        # For requests without specific patient_id, also include activities by this user
        if not patient_id:
            main_filter = main_filter | (ActivityLog.user_id == current_user_id)

        activity_logs = (
            db.query(ActivityLog)
            .options(joinedload(ActivityLog.user), joinedload(ActivityLog.patient))
            .filter(ActivityLog.entity_type.in_(medical_entity_types), main_filter)
            .order_by(desc(ActivityLog.timestamp))
            .limit(limit)
            .all()
        )

        recent_activities = []

        for log in activity_logs:
            entity_type = getattr(log, "entity_type", "")
            action = getattr(log, "action", "unknown")
            entity_id = getattr(log, "entity_id", None)
            description = getattr(log, "description", "Activity recorded")

            # Skip user creation/deletion activities
            if entity_type == "user" or action in ["user_created", "user_deleted"]:
                continue  # Map entity types to user-friendly names
            type_mapping = {
                "medication": "Medication",
                "lab_result": "Lab Result",
                "vitals": "Vital Signs",
                "condition": "Medical Condition",
                "allergy": "Allergy",
                "immunization": "Immunization",
                "procedure": "Procedure",
                "treatment": "Treatment",
                "encounter": "Visit",
                "emergency_contact": "Emergency Contact",
                "patient": "Patient Information",
                "practitioner": "Doctor",
                "pharmacy": "Pharmacy",
                "lab_result_file": "Lab Result File",
            }

            activity_type = type_mapping.get(entity_type, entity_type.title())

            # Clean up description for user display using format "Action Type: Item Name"
            if description:
                # Try to extract item name from the original description
                item_name = None

                if ":" in description:
                    # Extract name after colon and before "for" if present
                    name_part = description.split(":", 1)[1]
                    if " for " in name_part:
                        item_name = name_part.split(" for ")[0].strip()
                    else:
                        item_name = name_part.strip()

                # Create description in format "Action Type: Item Name"
                if entity_type == "patient" and action == "updated":
                    description = "Updated Patient Information"
                elif action == "created":
                    if item_name:
                        description = f"Created {activity_type}: {item_name}"
                    else:
                        description = f"Created {activity_type}"
                elif action == "updated":
                    if item_name:
                        description = f"Updated {activity_type}: {item_name}"
                    else:
                        description = f"Updated {activity_type}"
                elif action == "deleted":
                    if item_name:
                        description = f"Deleted {activity_type}: {item_name}"
                    else:
                        description = f"Deleted {activity_type}"
                else:
                    # For other actions, use title case
                    if item_name:
                        description = f"{action.title()} {activity_type}: {item_name}"
                    else:
                        description = f"{action.title()} {activity_type}"
            else:
                # Fallback if no description
                description = f"{action.title()} {activity_type}"

            recent_activities.append(
                UserRecentActivity(
                    id=entity_id or 0,
                    model_name=activity_type,
                    action=action,
                    description=description,
                    timestamp=getattr(log, "timestamp", datetime.utcnow()),
                )
            )

        return recent_activities

    except Exception as e:
        log_endpoint_error(
            logger, request, "Error fetching user recent activity",
            e, user_id=current_user_id
        )
        raise HTTPException(status_code=500, detail="Error fetching recent activity")


# Patient Photo Endpoints
@router.post("/{patient_id}/photo", response_model=PatientPhotoResponse)
async def upload_patient_photo(
    request: Request,
    patient_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Upload a photo for a patient.

    - Accepts JPEG, PNG, GIF, BMP formats
    - Maximum file size: 15MB
    - Automatically replaces existing photo
    - Processes image (resize, rotate, convert to JPEG)
    """
    log_endpoint_access(
        logger, request, current_user.id, "patient_photo_upload_request",
        patient_id=patient_id,
        file_name=file.filename
    )

    # Verify patient ownership
    patient_obj = patient.get(db, id=patient_id)
    if not patient_obj:
        raise HTTPException(status_code=404, detail="Patient not found")

    if patient_obj.owner_user_id != current_user.id:
        # Check if user has access via sharing
        from app.crud.patient_share import patient_share as share_crud
        if not share_crud.user_has_access(db, patient_id, current_user.id):
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to update this patient's photo"
            )

    try:
        # Upload and process the photo
        photo = await patient_photo_service.upload_photo(
            db=db,
            patient_id=patient_id,
            file=file,
            user_id=current_user.id
        )

        # Log the activity
        log_create(
            db=db,
            entity_type=ActivityEntityType.PATIENT,
            entity_obj=patient_obj,
            user_id=current_user.id
        )

        log_endpoint_access(
            logger, request, current_user.id, "patient_photo_uploaded",
            patient_id=patient_id,
            photo_id=photo.id
        )

        return photo

    except HTTPException:
        raise
    except Exception as e:
        log_endpoint_error(
            logger, request, "Failed to upload patient photo",
            e,
            user_id=current_user.id,
            patient_id=patient_id,
            file_name=file.filename if file else "unknown"
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to upload photo. Please try again."
        )


@router.get("/{patient_id}/photo", response_class=FileResponse)
async def get_patient_photo(
    patient_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Get the photo file for a patient.
    Returns the actual image file.
    """
    # Verify patient ownership/access
    patient_obj = patient.get(db, id=patient_id)
    if not patient_obj:
        raise HTTPException(status_code=404, detail="Patient not found")

    if patient_obj.owner_user_id != current_user.id:
        from app.crud.patient_share import patient_share as share_crud
        if not share_crud.user_has_access(db, patient_id, current_user.id):
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to view this patient's photo"
            )

    # Get the photo file
    photo_path = await patient_photo_service.get_photo_file(db, patient_id)

    if not photo_path:
        raise HTTPException(status_code=404, detail="No photo found for this patient")

    return FileResponse(
        path=photo_path,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "max-age=3600",  # Cache for 1 hour
        }
    )


@router.get("/{patient_id}/photo/info", response_model=Optional[PatientPhotoResponse])
async def get_patient_photo_info(
    patient_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> Any:
    """
    Get metadata about a patient's photo.
    Returns photo information without the actual file.
    """
    # Verify patient ownership/access
    patient_obj = patient.get(db, id=patient_id)
    if not patient_obj:
        raise HTTPException(status_code=404, detail="Patient not found")

    if patient_obj.owner_user_id != current_user.id:
        from app.crud.patient_share import patient_share as share_crud
        if not share_crud.user_has_access(db, patient_id, current_user.id):
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to view this patient's photo"
            )

    # Get photo metadata
    photo = await patient_photo_service.get_photo(db, patient_id)
    return photo


@router.delete("/{patient_id}/photo", status_code=status.HTTP_204_NO_CONTENT)
async def delete_patient_photo(
    request: Request,
    patient_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
) -> None:
    """
    Delete a patient's photo.
    Removes both the file and database record.
    """
    log_endpoint_access(
        logger, request, current_user.id, "patient_photo_delete_request",
        patient_id=patient_id
    )

    # Verify patient ownership (only owner can delete)
    patient_obj = patient.get(db, id=patient_id)
    if not patient_obj:
        raise HTTPException(status_code=404, detail="Patient not found")

    if patient_obj.owner_user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the patient owner can delete the photo"
        )

    try:
        # Delete the photo
        deleted = await patient_photo_service.delete_photo(
            db=db,
            patient_id=patient_id,
            user_id=current_user.id
        )

        if not deleted:
            raise HTTPException(status_code=404, detail="No photo found for this patient")

        # Log the activity
        log_delete(
            db=db,
            entity_type=ActivityEntityType.PATIENT,
            entity_obj=patient_obj,
            user_id=current_user.id
        )

        log_endpoint_access(
            logger, request, current_user.id, "patient_photo_deleted",
            patient_id=patient_id
        )

    except HTTPException:
        raise
    except Exception as e:
        log_endpoint_error(
            logger, request, "Failed to delete patient photo",
            e,
            user_id=current_user.id,
            patient_id=patient_id
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to delete photo. Please try again."
        )
