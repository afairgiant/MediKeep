"""
Admin Models API - Django-style model management

Provides generic CRUD operations for all models in the system,
with automatic discovery of model metadata, relationships, and validation.
"""

from typing import Dict, List, Any, Optional, Type
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import inspect as sql_inspect
from pydantic import BaseModel
from datetime import datetime

from app.api import deps
from app.core.datetime_utils import convert_datetime_fields, convert_date_fields
from app.models.models import (
    User,
    Patient,
    Practitioner,
    Medication,
    LabResult,
    LabResultFile,
    Condition,
    Allergy,
    Immunization,
    Procedure,
    Treatment,
    Encounter,
)
from app.crud import (
    user,
    patient,
    practitioner,
    medication,
    lab_result,
    lab_result_file,
    condition,
    allergy,
    immunization,
    procedure,
    treatment,
    encounter,
)

router = APIRouter()

# Model registry mapping model names to their classes and CRUD instances
MODEL_REGISTRY = {
    "user": {"model": User, "crud": user},
    "patient": {"model": Patient, "crud": patient},
    "practitioner": {"model": Practitioner, "crud": practitioner},
    "medication": {"model": Medication, "crud": medication},
    "lab_result": {"model": LabResult, "crud": lab_result},
    "lab_result_file": {"model": LabResultFile, "crud": lab_result_file},
    "condition": {"model": Condition, "crud": condition},
    "allergy": {"model": Allergy, "crud": allergy},
    "immunization": {"model": Immunization, "crud": immunization},
    "procedure": {"model": Procedure, "crud": procedure},
    "treatment": {"model": Treatment, "crud": treatment},
    "encounter": {"model": Encounter, "crud": encounter},
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
            foreign_key = list(column.foreign_keys)[0].target_fullname

        fields.append(
            ModelField(
                name=column.name,
                type=field_type,
                nullable=column.nullable,
                primary_key=column.primary_key,
                foreign_key=foreign_key,
                max_length=getattr(column.type, "length", None),
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

        # Delete the record
        deleted_record = crud_instance.delete(db, id=record_id)

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
            "immunization": ["administration_date", "created_at", "updated_at"],
            "procedure": ["procedure_date", "created_at", "updated_at"],
            "treatment": ["start_date", "end_date", "created_at", "updated_at"],
            "encounter": ["encounter_date", "created_at", "updated_at"],
        }

        # Define date-only fields for each model (fields that should be Date objects, not DateTime)
        date_field_map = {
            "patient": ["birthDate"],
            "immunization": ["date_administered", "expiration_date"],
            "procedure": ["date"],
            "treatment": ["start_date", "end_date"],
            "encounter": ["encounter_date"],
        }

        # Convert date fields first (these need to be Date objects)
        if model_name in date_field_map:
            update_data = convert_date_fields(update_data, date_field_map[model_name])

        # Convert datetime fields if they exist for this model
        if model_name in datetime_field_map:
            update_data = convert_datetime_fields(
                update_data, datetime_field_map[model_name]
            )

        # Update the record using CRUD update method
        updated_record = crud_instance.update(db, db_obj=record, obj_in=update_data)

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

    try:  # Define datetime fields for each model
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
            "immunization": ["administration_date", "created_at", "updated_at"],
            "procedure": ["procedure_date", "created_at", "updated_at"],
            "treatment": ["start_date", "end_date", "created_at", "updated_at"],
            "encounter": ["encounter_date", "created_at", "updated_at"],
        }

        # Define date-only fields for each model (fields that should be Date objects, not DateTime)
        date_field_map = {
            "patient": ["birthDate"],
            "immunization": ["date_administered", "expiration_date"],
            "procedure": ["date"],
            "treatment": ["start_date", "end_date"],
            "encounter": ["encounter_date"],
        }

        # Convert date fields first (these need to be Date objects)
        if model_name in date_field_map:
            create_data = convert_date_fields(create_data, date_field_map[model_name])

        # Convert datetime fields if they exist for this model
        if model_name in datetime_field_map:
            create_data = convert_datetime_fields(
                create_data, datetime_field_map[model_name]
            )

        # Create the record using CRUD create method
        created_record = crud_instance.create(db, obj_in=create_data)

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
