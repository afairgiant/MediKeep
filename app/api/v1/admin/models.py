"""
Admin Models API - Django-style model management

Provides generic CRUD operations for all models in the system,
with automatic discovery of model metadata, relationships, and validation.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Type

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import inspect as sql_inspect
from sqlalchemy.orm import Session

from app.api import deps
from app.core.datetime_utils import convert_date_fields, convert_datetime_fields
from app.crud import (
    allergy,
    condition,
    encounter,
    immunization,
    lab_result,
    lab_result_file,
    medication,
    patient,
    practitioner,
    procedure,
    treatment,
    user,
    vitals,
)
from app.models.activity_log import ActivityLog, get_utc_now
from app.models.models import (
    Allergy,
    Condition,
    Encounter,
    Immunization,
    LabResult,
    LabResultFile,
    Medication,
    Patient,
    Practitioner,
    Procedure,
    Treatment,
    User,
    Vitals,
)
from app.schemas.allergy import AllergyCreate
from app.schemas.condition import ConditionCreate
from app.schemas.encounter import EncounterCreate
from app.schemas.immunization import ImmunizationCreate
from app.schemas.lab_result import LabResultCreate
from app.schemas.lab_result_file import LabResultFileCreate
from app.schemas.medication import MedicationCreate
from app.schemas.patient import PatientCreate
from app.schemas.practitioner import PractitionerCreate
from app.schemas.procedure import ProcedureCreate
from app.schemas.treatment import TreatmentCreate
from app.schemas.user import UserCreate
from app.schemas.vitals import VitalsCreate

router = APIRouter()

# Model registry mapping model names to their classes and CRUD instances
MODEL_REGISTRY = {
    "user": {"model": User, "crud": user, "create_schema": UserCreate},
    "patient": {"model": Patient, "crud": patient, "create_schema": PatientCreate},
    "practitioner": {
        "model": Practitioner,
        "crud": practitioner,
        "create_schema": PractitionerCreate,
    },
    "medication": {
        "model": Medication,
        "crud": medication,
        "create_schema": MedicationCreate,
    },
    "lab_result": {
        "model": LabResult,
        "crud": lab_result,
        "create_schema": LabResultCreate,
    },
    "lab_result_file": {
        "model": LabResultFile,
        "crud": lab_result_file,
        "create_schema": LabResultFileCreate,
    },
    "vitals": {
        "model": Vitals,
        "crud": vitals,
        "create_schema": VitalsCreate,
    },
    "condition": {
        "model": Condition,
        "crud": condition,
        "create_schema": ConditionCreate,
    },
    "allergy": {"model": Allergy, "crud": allergy, "create_schema": AllergyCreate},
    "immunization": {
        "model": Immunization,
        "crud": immunization,
        "create_schema": ImmunizationCreate,
    },
    "procedure": {
        "model": Procedure,
        "crud": procedure,
        "create_schema": ProcedureCreate,
    },
    "treatment": {
        "model": Treatment,
        "crud": treatment,
        "create_schema": TreatmentCreate,
    },
    "encounter": {
        "model": Encounter,
        "crud": encounter,
        "create_schema": EncounterCreate,
    },
}


class ModelField(BaseModel):
    """Schema for model field metadata"""

    name: str
    type: str
    nullable: bool
    primary_key: bool
    foreign_key: Optional[str] = None
    max_length: Optional[int] = None
    choices: Optional[List[str]] = None


class ModelMetadata(BaseModel):
    """Schema for model metadata"""

    name: str
    table_name: str
    fields: List[ModelField]
    relationships: Dict[str, str]
    display_name: str
    verbose_name_plural: str


class ModelListResponse(BaseModel):
    """Schema for model list response"""

    items: List[Dict[str, Any]]
    total: int
    page: int
    per_page: int
    total_pages: int


def get_model_metadata(model_class: Type[Any]) -> ModelMetadata:
    """Extract metadata from a SQLAlchemy model class"""

    inspector = sql_inspect(model_class)
    fields = []
    relationships = {}

    # Get column information
    for column in inspector.columns:
        field_type = str(column.type)
        if "VARCHAR" in field_type:
            field_type = "string"
        elif "INTEGER" in field_type:
            field_type = "integer"
        elif "DATE" in field_type:
            field_type = "date"
        elif "DATETIME" in field_type:
            field_type = "datetime"
        elif "TEXT" in field_type:
            field_type = "text"
        else:
            field_type = "string"

        # Check for foreign keys
        foreign_key = None
        if column.foreign_keys:
            foreign_key = list(column.foreign_keys)[
                0
            ].target_fullname  # Check for predefined choices for specific fields
        choices = None
        if column.name == "status":
            # Define status choices based on model type
            model_name = model_class.__name__.lower()
            if model_name == "labresult":
                choices = ["ordered", "in-progress", "completed", "cancelled"]
            elif model_name == "medication":
                choices = ["active", "stopped", "on-hold", "completed", "cancelled"]
            elif model_name == "allergy":
                choices = ["active", "inactive", "resolved", "unconfirmed"]
            elif model_name == "condition":
                choices = [
                    "active",
                    "resolved",
                    "chronic",
                    "inactive",
                    "recurrence",
                    "relapse",
                ]
            elif model_name == "treatment":
                choices = ["active", "inactive", "completed", "paused"]
            elif model_name == "immunization":
                choices = ["completed", "pending", "refused", "contraindicated"]
            elif model_name == "procedure":
                choices = [
                    "scheduled",
                    "in-progress",
                    "completed",
                    "cancelled",
                    "postponed",
                ]
            elif model_name == "encounter":
                choices = ["scheduled", "in-progress", "completed", "cancelled"]
            else:
                choices = ["active", "inactive", "completed", "cancelled"]
        elif column.name == "severity":
            choices = ["mild", "moderate", "severe", "life-threatening"]
        elif column.name == "labs_result":
            choices = [
                "normal",
                "abnormal",
                "critical",
                "high",
                "low",
                "borderline",
                "inconclusive",
            ]
        elif column.name == "gender":
            choices = ["M", "F", "OTHER", "U"]
        elif column.name == "role":
            choices = ["patient", "admin", "staff"]

        fields.append(
            ModelField(
                name=column.name,
                type=field_type,
                nullable=column.nullable,
                primary_key=column.primary_key,
                foreign_key=foreign_key,
                max_length=getattr(column.type, "length", None),
                choices=choices,
            )
        )

    # Get relationships
    for rel_name, relationship in inspector.relationships.items():
        target_class = relationship.mapper.class_.__name__
        relationships[rel_name] = target_class

    # Generate display names
    model_name = model_class.__name__.lower()
    display_name = model_class.__name__
    verbose_name_plural = f"{display_name}s"

    return ModelMetadata(
        name=model_name,
        table_name=model_class.__tablename__,
        fields=fields,
        relationships=relationships,
        display_name=display_name,
        verbose_name_plural=verbose_name_plural,
    )


@router.get("/", response_model=List[str])
def list_available_models(current_user: User = Depends(deps.get_current_admin_user)):
    """Get list of all available models for admin management"""
    return list(MODEL_REGISTRY.keys())


@router.get("/{model_name}/metadata", response_model=ModelMetadata)
def get_model_info(
    model_name: str, current_user: User = Depends(deps.get_current_admin_user)
):
    """Get metadata for a specific model"""

    if model_name not in MODEL_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{model_name}' not found",
        )

    model_class = MODEL_REGISTRY[model_name]["model"]
    return get_model_metadata(model_class)


@router.get("/{model_name}/", response_model=ModelListResponse)
def list_model_records(
    model_name: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Get paginated list of records for a specific model"""

    if model_name not in MODEL_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{model_name}' not found",
        )

    model_info = MODEL_REGISTRY[model_name]
    crud_instance = model_info["crud"]

    try:
        # Calculate pagination
        skip = (page - 1) * per_page

        # Get records using CRUD instance
        if hasattr(crud_instance, "get_multi"):
            records = crud_instance.get_multi(db, skip=skip, limit=per_page)
            total = db.query(model_info["model"]).count()
        else:
            # Fallback for CRUD instances without get_multi
            records = db.query(model_info["model"]).offset(skip).limit(per_page).all()
            total = db.query(model_info["model"]).count()

        # Convert to dictionaries for JSON response
        items = []
        for record in records:
            item = {}
            # Get all column values
            for column in model_info["model"].__table__.columns:
                value = getattr(record, column.name, None)
                if isinstance(value, datetime):
                    value = value.isoformat()
                item[column.name] = value
            items.append(item)

        total_pages = (total + per_page - 1) // per_page

        return ModelListResponse(
            items=items,
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching {model_name} records: {str(e)}",
        )


@router.get("/{model_name}/{record_id}")
def get_model_record(
    model_name: str,
    record_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Get a specific record by ID"""

    if model_name not in MODEL_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{model_name}' not found",
        )

    model_info = MODEL_REGISTRY[model_name]
    crud_instance = model_info["crud"]

    try:
        record = crud_instance.get(db, id=record_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{model_name} record with id {record_id} not found",
            )

        # Convert to dictionary
        result = {}
        for column in model_info["model"].__table__.columns:
            value = getattr(record, column.name, None)
            if isinstance(value, datetime):
                value = value.isoformat()
            result[column.name] = value

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching {model_name} record: {str(e)}",
        )


@router.delete("/{model_name}/{record_id}")
def delete_model_record(
    model_name: str,
    record_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Delete a specific record by ID"""
    if model_name not in MODEL_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{model_name}' not found",
        )

    model_info = MODEL_REGISTRY[model_name]
    crud_instance = model_info["crud"]

    try:
        # Check if record exists first
        record = crud_instance.get(db, id=record_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{model_name} record with id {record_id} not found",
            )

        # Special protection for users - prevent deleting the last user
        if model_name == "user":
            total_users = db.query(User).count()
            if total_users <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot delete the last remaining user in the system",
                )

            # Prevent self-deletion
            if hasattr(record, "id") and record.id == current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot delete your own user account",
                )

            # Also check if we're trying to delete the last admin user
            if (
                hasattr(record, "role")
                and record.role
                and record.role.lower() in ["admin", "administrator"]
            ):
                admin_users = (
                    db.query(User)
                    .filter(
                        User.role.in_(
                            ["admin", "Admin", "administrator", "Administrator"]
                        )
                    )
                    .count()
                )
                if admin_users <= 1:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Cannot delete the last remaining admin user in the system",
                    )

                    # Handle cascading deletion of patient and medical data
            # Note: SQLAlchemy cascade="all, delete-orphan" relationships automatically
            # handle deletion of all medical data when patient is deleted
            from app.crud.patient import patient as patient_crud
            from app.models.activity_log import ActivityLog

            user_patient = patient_crud.get_by_user_id(db, user_id=record.id)
            if user_patient:
                # Preserve audit trail by nullifying patient_id in activity logs
                db.query(ActivityLog).filter(
                    ActivityLog.patient_id == user_patient.id
                ).update({"patient_id": None}, synchronize_session=False)

                # Delete patient record (automatically cascades to all medical data)
                patient_crud.delete(db, id=int(user_patient.id))

        # Log the deletion BEFORE actually deleting (to preserve record details)
        description = get_record_description(record, model_name, "deleted")
        log_activity(
            db=db,
            user_id=getattr(current_user, "id", None),
            action="deleted",
            entity_type=model_name,
            entity_id=record_id,
            description=description,
            patient_id=(
                getattr(record, "patient_id", None)
                if hasattr(record, "patient_id")
                else None
            ),
        )

        # Delete the record
        crud_instance.delete(db, id=record_id)

        return {
            "message": f"{model_name} record {record_id} deleted successfully",
            "deleted_id": record_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting {model_name} record: {str(e)}",
        )


@router.put("/{model_name}/{record_id}")
def update_model_record(
    model_name: str,
    record_id: int,
    update_data: Dict[str, Any],
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Update a specific record by ID"""
    if model_name not in MODEL_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{model_name}' not found",
        )

    model_info = MODEL_REGISTRY[model_name]
    crud_instance = model_info["crud"]

    try:
        # Check if record exists first
        record = crud_instance.get(db, id=record_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{model_name} record with id {record_id} not found",
            )  # Define datetime fields for each model
        datetime_field_map = {
            "user": ["created_at", "updated_at", "last_login"],
            "patient": ["created_at", "updated_at"],
            "practitioner": ["created_at", "updated_at"],
            "lab_result": [
                "ordered_date",
                "completed_date",
                "created_at",
                "updated_at",
            ],
            "lab_result_file": ["uploaded_at", "created_at", "updated_at"],
            "medication": ["created_at", "updated_at"],
            "condition": ["created_at", "updated_at"],
            "allergy": ["created_at", "updated_at"],
            "immunization": ["created_at", "updated_at"],
            "procedure": ["created_at", "updated_at"],
            "treatment": ["created_at", "updated_at"],
            "encounter": ["created_at", "updated_at"],
        }

        # Define date-only fields for each model (fields that should be Date objects, not DateTime)
        date_field_map = {
            "patient": ["birthDate"],
            "immunization": ["date_administered", "expiration_date"],
            "procedure": ["date"],
            "treatment": ["start_date", "end_date"],
            "encounter": ["date"],
            "condition": ["onsetDate"],
            "allergy": ["onset_date"],
        }

        # Convert date fields first (these need to be Date objects)
        if model_name in date_field_map:
            update_data = convert_date_fields(update_data, date_field_map[model_name])

        # Convert datetime fields if they exist for this model
        if model_name in datetime_field_map:
            update_data = convert_datetime_fields(
                update_data, datetime_field_map[model_name]
            )  # Update the record using CRUD update method
        updated_record = crud_instance.update(
            db, db_obj=record, obj_in=update_data
        )  # Log the update activity
        description = get_record_description(updated_record, model_name, "updated")
        log_activity(
            db=db,
            user_id=getattr(current_user, "id", None),
            action="updated",
            entity_type=model_name,
            entity_id=record_id,
            description=description,
            patient_id=(
                getattr(updated_record, "patient_id", None)
                if hasattr(updated_record, "patient_id")
                else None
            ),
        )

        # Convert to dictionary for JSON response
        result = {}
        for column in model_info["model"].__table__.columns:
            value = getattr(updated_record, column.name, None)
            if isinstance(value, datetime):
                value = value.isoformat()
            result[column.name] = value

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating {model_name} record: {str(e)}",
        )


@router.post("/{model_name}/")
def create_model_record(
    model_name: str,
    create_data: Dict[str, Any],
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin_user),
):
    """Create a new record for a specific model"""
    if model_name not in MODEL_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{model_name}' not found",
        )

    model_info = MODEL_REGISTRY[model_name]
    crud_instance = model_info["crud"]

    try:
        # Define datetime fields for each model
        datetime_field_map = {
            "user": ["created_at", "updated_at", "last_login"],
            "patient": ["created_at", "updated_at"],
            "practitioner": ["created_at", "updated_at"],
            "lab_result": [
                "ordered_date",
                "completed_date",
                "created_at",
                "updated_at",
            ],
            "lab_result_file": ["uploaded_at", "created_at", "updated_at"],
            "medication": ["created_at", "updated_at"],
            "condition": ["created_at", "updated_at"],
            "allergy": ["created_at", "updated_at"],
            "immunization": ["created_at", "updated_at"],
            "procedure": ["created_at", "updated_at"],
            "treatment": ["created_at", "updated_at"],
            "encounter": ["created_at", "updated_at"],
        }

        # Define date-only fields for each model (fields that should be Date objects, not DateTime)
        date_field_map = {
            "patient": ["birthDate"],
            "immunization": ["date_administered", "expiration_date"],
            "procedure": ["date"],
            "treatment": ["start_date", "end_date"],
            "encounter": ["date"],
            "condition": ["onsetDate"],
            "allergy": ["onset_date"],
        }

        # Convert date fields first (these need to be Date objects)
        if model_name in date_field_map:
            create_data = convert_date_fields(create_data, date_field_map[model_name])

        # Convert datetime fields if they exist for this model
        if model_name in datetime_field_map:
            create_data = convert_datetime_fields(
                create_data, datetime_field_map[model_name]
            )  # Create Pydantic schema object from the processed data
        create_schema = model_info["create_schema"]
        create_obj = create_schema(
            **create_data
        )  # Create the record using CRUD create method
        created_record = crud_instance.create(
            db, obj_in=create_obj
        )  # Log the creation activity
        description = get_record_description(created_record, model_name, "created")
        log_activity(
            db=db,
            user_id=getattr(current_user, "id", None),
            action="created",
            entity_type=model_name,
            entity_id=getattr(created_record, "id", 0),
            description=description,
            patient_id=(
                getattr(created_record, "patient_id", None)
                if hasattr(created_record, "patient_id")
                else None
            ),
        )

        # Convert to dictionary for JSON response
        result = {}
        for column in model_info["model"].__table__.columns:
            value = getattr(created_record, column.name, None)
            if isinstance(value, datetime):
                value = value.isoformat()
            result[column.name] = value

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating {model_name} record: {str(e)}",
        )


def log_activity(
    db: Session,
    user_id: Optional[int],
    action: str,
    entity_type: str,
    entity_id: int,
    description: str,
    patient_id: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
):
    """
    Log an activity to the activity log table.
    This preserves historical information even after records are deleted.
    """
    try:
        activity_log = ActivityLog(
            user_id=user_id,
            patient_id=patient_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            description=description,
            event_metadata=metadata,
            timestamp=get_utc_now(),
        )
        db.add(activity_log)
        db.commit()
    except Exception as e:
        print(f"Error logging activity: {e}")
        # Don't fail the main operation if logging fails
        db.rollback()


def get_record_description(record, model_name: str, action: str = "created") -> str:
    """
    Generate a human-readable description for a record with action context.
    This captures the essential information and action performed.
    """
    # Action prefixes
    action_prefixes = {
        "created": "New",
        "updated": "Updated",
        "deleted": "Deleted",
        "viewed": "Viewed",
    }

    prefix = action_prefixes.get(action, action.title())

    if model_name == "medication":
        patient_name = "Unknown Patient"
        if hasattr(record, "patient") and record.patient:
            patient_name = f"{getattr(record.patient, 'first_name', '')} {getattr(record.patient, 'last_name', '')}".strip()
        medication_name = getattr(record, "medication_name", "Unknown")
        return f"{prefix} medication: {medication_name} for {patient_name}"

    elif model_name == "patient":
        patient_name = f"{getattr(record, 'first_name', '')} {getattr(record, 'last_name', '')}".strip()
        return f"{prefix} patient: {patient_name}"

    elif model_name == "user":
        user_name = getattr(record, "full_name", getattr(record, "username", "Unknown"))
        return f"{prefix} user: {user_name}"

    elif model_name == "lab_result":
        test_name = getattr(record, "test_name", "Unknown")
        return f"{prefix} lab result: {test_name}"

    elif model_name == "procedure":
        procedure_name = getattr(record, "procedure_name", "Unknown")
        return f"{prefix} procedure: {procedure_name}"

    elif model_name == "allergy":
        allergen = getattr(record, "allergen", "Unknown")
        return f"{prefix} allergy: {allergen}"

    elif model_name == "condition":
        condition_name = getattr(record, "condition_name", "Unknown")
        return f"{prefix} condition: {condition_name}"

    else:
        # Generic fallback
        name_field = (
            getattr(record, "name", None)
            or getattr(record, "title", None)
            or f"ID {getattr(record, 'id', 'Unknown')}"
        )
        return f"{prefix} {model_name}: {name_field}"
