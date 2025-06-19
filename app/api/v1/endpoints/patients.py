from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from typing import Any, List
from datetime import datetime
from sqlalchemy import desc

from app.api import deps
from app.crud.patient import patient
from app.schemas.patient import Patient, PatientCreate, PatientUpdate
from app.schemas.medication import MedicationCreate, MedicationResponse
from app.core.logging_config import get_logger
from app.models.activity_log import ActivityLog
from pydantic import BaseModel

router = APIRouter()

# Initialize loggers
logger = get_logger(__name__, "app")
medical_logger = get_logger(__name__, "medical")


class UserRecentActivity(BaseModel):
    """Recent activity item schema for regular users"""

    id: int
    type: str
    action: str
    description: str
    timestamp: datetime


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
    - address"""
    user_ip = request.client.host if request.client else "unknown"

    patient_record = patient.get_by_user_id(db, user_id=user_id)
    if not patient_record:
        logger.warning(
            f"Patient record not found for user {user_id}",
            extra={
                "category": "app",
                "event": "patient_record_not_found",
                "user_id": user_id,
                "ip": user_ip,
            },
        )
        raise HTTPException(status_code=404, detail="Patient record not found")

    # Log successful patient record access
    patient_id = getattr(patient_record, "id", 0)

    logger.info(
        f"User {user_id} accessed their patient record",
        extra={
            "category": "app",
            "event": "patient_record_accessed",
            "user_id": user_id,
            "patient_id": patient_id,
            "ip": user_ip,
        },
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
    user_ip = (
        request.client.host if request.client else "unknown"
    )  # Check if user already has a patient record
    existing_patient = patient.get_by_user_id(db, user_id=user_id)
    if existing_patient:
        logger.warning(
            f"Attempt to create duplicate patient record for user {user_id}",
            extra={
                "category": "app",
                "event": "duplicate_patient_record_attempt",
                "user_id": user_id,
                "ip": user_ip,
            },
        )
        raise HTTPException(status_code=400, detail="Patient record already exists")

    try:
        # Create patient record
        new_patient = patient.create_for_user(
            db, user_id=user_id, patient_data=patient_in
        )
        patient_id = getattr(new_patient, "id", None)

        # Log successful patient record creation
        logger.info(
            f"Patient record created successfully for user {user_id}",
            extra={
                "category": "app",
                "event": "patient_record_created",
                "user_id": user_id,
                "patient_id": patient_id,
                "ip": user_ip,
            },
        )

        return new_patient

    except Exception as e:
        # Log failed patient record creation
        logger.error(
            f"Failed to create patient record for user {user_id}: {str(e)}",
            extra={
                "category": "app",
                "event": "patient_record_creation_failed",
                "user_id": user_id,
                "ip": user_ip,
                "error": str(e),
            },
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
    user_ip = (
        request.client.host if request.client else "unknown"
    )  # Get existing patient record for audit
    existing_patient = patient.get_by_user_id(db, user_id=user_id)
    if not existing_patient:
        logger.warning(
            f"Patient record not found for update by user {user_id}",
            extra={
                "category": "app",
                "event": "patient_record_update_not_found",
                "user_id": user_id,
                "ip": user_ip,
            },
        )
        raise HTTPException(status_code=404, detail="Patient record not found")

    patient_id = getattr(existing_patient, "id", None)

    try:
        updated_patient = patient.update_for_user(
            db, user_id=user_id, patient_data=patient_in
        )

        # Log successful patient record update
        logger.info(
            f"Patient record updated successfully for user {user_id}",
            extra={
                "category": "app",
                "event": "patient_record_updated",
                "user_id": user_id,
                "patient_id": patient_id,
                "ip": user_ip,
            },
        )

        return updated_patient

    except Exception as e:
        # Log failed patient record update
        logger.error(
            f"Failed to update patient record for user {user_id}: {str(e)}",
            extra={
                "category": "app",
                "event": "patient_record_update_failed",
                "user_id": user_id,
                "patient_id": patient_id,
                "ip": user_ip,
                "error": str(e),
            },
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
    user_ip = (
        request.client.host if request.client else "unknown"
    )  # Get existing patient record for audit
    existing_patient = patient.get_by_user_id(db, user_id=user_id)
    if not existing_patient:
        logger.warning(
            f"Patient record not found for deletion by user {user_id}",
            extra={
                "category": "app",
                "event": "patient_record_delete_not_found",
                "user_id": user_id,
                "ip": user_ip,
            },
        )
        raise HTTPException(status_code=404, detail="Patient record not found")

    patient_id = getattr(existing_patient, "id", None)

    try:
        patient.delete_for_user(db, user_id=user_id)

        # Log successful patient record deletion
        logger.info(
            f"Patient record deleted successfully for user {user_id}",
            extra={
                "category": "app",
                "event": "patient_record_deleted",
                "user_id": user_id,
                "patient_id": patient_id,
                "ip": user_ip,
            },
        )

        return {"message": "Patient record deleted successfully"}

    except Exception as e:
        # Log failed patient record deletion
        logger.error(
            f"Failed to delete patient record for user {user_id}: {str(e)}",
            extra={
                "category": "app",
                "event": "patient_record_deletion_failed",
                "user_id": user_id,
                "patient_id": patient_id,
                "ip": user_ip,
                "error": str(e),
            },
        )
        raise


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
    patient_id: int,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """Get medications for a specific patient"""
    from app.crud.medication import medication

    return medication.get_by_patient(db=db, patient_id=patient_id)


@router.post("/{patient_id}/medications/", response_model=MedicationResponse)
def create_patient_medication(
    patient_id: int,
    medication_in: MedicationCreate,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """Create a new medication for a specific patient"""
    # Debug logging - REMOVE THIS LATER
    logger.info(
        f"🔍 CREATE MEDICATION ENDPOINT CALLED: patient_id={patient_id}, user_id={current_user_id}"
    )

    from app.crud.medication import medication

    # Ensure the medication is associated with the correct patient
    medication_data = medication_in.dict()
    medication_data["patient_id"] = patient_id

    # Create the medication record
    medication_obj = medication.create(
        db=db, obj_in=MedicationCreate(**medication_data)
    )

    logger.info(f"✅ MEDICATION CREATED: id={medication_obj.id}")
    return medication_obj


@router.get("/{patient_id}/conditions/")
def get_patient_conditions(
    patient_id: int,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """Get conditions for a specific patient"""
    from app.crud.condition import condition

    return condition.get_by_patient(db=db, patient_id=patient_id)


@router.get("/{patient_id}/allergies/")
def get_patient_allergies(
    patient_id: int,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """Get allergies for a specific patient"""
    from app.crud.allergy import allergy

    return allergy.get_by_patient(db=db, patient_id=patient_id)


@router.get("/{patient_id}/immunizations/")
def get_patient_immunizations(
    patient_id: int,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """Get immunizations for a specific patient"""
    from app.crud.immunization import immunization

    return immunization.get_by_patient(db=db, patient_id=patient_id)


@router.get("/{patient_id}/procedures/")
def get_patient_procedures(
    patient_id: int,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """Get procedures for a specific patient"""
    from app.crud.procedure import procedure

    return procedure.get_by_patient(db=db, patient_id=patient_id)


@router.get("/{patient_id}/treatments/")
def get_patient_treatments(
    patient_id: int,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """Get treatments for a specific patient"""
    from app.crud.treatment import treatment

    return treatment.get_by_patient(db=db, patient_id=patient_id)


@router.get("/{patient_id}/lab-results/")
def get_patient_lab_results(
    patient_id: int,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """Get lab results for a specific patient"""
    from app.crud.lab_result import lab_result

    return lab_result.get_by_patient(db=db, patient_id=patient_id)


@router.get("/{patient_id}/encounters/")
def get_patient_encounters(
    patient_id: int,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """Get encounters for a specific patient"""
    from app.crud.encounter import encounter

    return encounter.get_by_patient(db=db, patient_id=patient_id)


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

    Each activity includes a brief description and timestamp.
    """
    user_ip = request.client.host if request.client else "unknown"

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
        logger.info(
            f"User {user_id} retrieved their recent activity",
            extra={
                "category": "app",
                "event": "recent_activity_retrieved",
                "user_id": user_id,
                "ip": user_ip,
                "activity_count": len(activities),
            },
        )

        return activities

    except Exception as e:
        # Log failed activity retrieval
        logger.error(
            f"Failed to retrieve recent activity for user {user_id}: {str(e)}",
            extra={
                "category": "app",
                "event": "recent_activity_retrieval_failed",
                "user_id": user_id,
                "ip": user_ip,
                "error": str(e),
            },
        )
        raise


@router.get("/recent-activity/", response_model=List[UserRecentActivity])
def get_user_recent_activity(
    limit: int = Query(default=10, le=50),
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
    - Patient Info updates
    - Doctor/Practitioner interactions

    Excludes user management activities like creation/deletion.
    Includes both user actions and medical activities that affect the patient.
    """
    try:
        # Get the user's patient record
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
            "patient",
            "practitioner",  # Doctors/practitioners page
            "lab_result_file",  # Lab result file uploads
        ]        # Query activity logs for this patient's medical activities
        # Include activities by the user AND activities that affect this patient
        activity_logs = (
            db.query(ActivityLog)
            .filter(
                ActivityLog.entity_type.in_(medical_entity_types),
                # Show activities by this user OR activities that relate to this patient
                # This captures both user actions and doctor actions affecting the patient
                (ActivityLog.user_id == current_user_id) | 
                (ActivityLog.description.like(f"%patient {patient_record.id}%")) |
                (ActivityLog.description.like(f"%{patient_record.first_name}%")) |
                (ActivityLog.description.like(f"%{patient_record.last_name}%"))
            )
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
                continue            # Map entity types to user-friendly names
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
                "patient": "Patient Information",
                "practitioner": "Doctor",
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
                    type=activity_type,
                    action=action,
                    description=description,
                    timestamp=getattr(log, "timestamp", datetime.utcnow()),
                )
            )

        return recent_activities

    except Exception as e:
        logger.error(f"Error fetching user recent activity: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Error fetching recent activity"
        )
