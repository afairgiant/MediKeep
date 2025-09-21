import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Query,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.api import deps
from app.core.error_handling import (
    NotFoundException,
    ForbiddenException,
    BusinessLogicException,
    DatabaseException,
    handle_database_errors
)
from app.api.v1.endpoints.utils import (
    ensure_directory_with_permissions,
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
)
from app.core.config import settings
from app.core.database import get_db
from app.crud.condition import condition as condition_crud
from app.crud.lab_result import lab_result, lab_result_condition
from app.crud.lab_result_file import lab_result_file
from app.models.activity_log import EntityType
from app.models.models import EntityFile, User
from app.services.generic_entity_file_service import GenericEntityFileService
from app.schemas.lab_result import (
    LabResultConditionCreate,
    LabResultConditionResponse,
    LabResultConditionUpdate,
    LabResultConditionWithDetails,
    LabResultCreate,
    LabResultResponse,
    LabResultUpdate,
    LabResultWithRelations,
)
from app.schemas.lab_result_file import LabResultFileCreate, LabResultFileResponse

router = APIRouter()


# Lab Result Endpoints
@router.get("/", response_model=List[LabResultWithRelations])
def get_lab_results(
    *,
    request: Request,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    tag_match_all: bool = Query(False, description="Match all tags (AND) vs any tag (OR)"),
    db: Session = Depends(get_db),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
):
    """Get lab results for the current user or accessible patient."""

    with handle_database_errors(request=request):
        # Filter lab results by the target patient_id with practitioner relationship loaded
        if tags:
            # Use tag filtering with patient constraint
            results = lab_result.get_multi_with_tag_filters(
                db,
                tags=tags,
                tag_match_all=tag_match_all,
                patient_id=target_patient_id,
                skip=skip,
                limit=limit,
            )
            # Load relationships manually for tag-filtered results
            for result in results:
                if hasattr(result, 'practitioner_id') and result.practitioner_id:
                    db.refresh(result, ["practitioner"])
                if hasattr(result, 'patient_id') and result.patient_id:
                    db.refresh(result, ["patient"])
        else:
            # Use regular patient filtering
            results = lab_result.get_by_patient(
                db,
                patient_id=target_patient_id,
                skip=skip,
                limit=limit,
                load_relations=["practitioner", "patient"],
            )

    # Convert to response format with practitioner names
    # NOTE: Manual dictionary building is required here because LabResultWithRelations
    # expects computed string fields (practitioner_name, patient_name) that aren't 
    # actual database columns. Other endpoints avoid this by returning nested objects.
    response_results = []
    for result in results:
        result_dict = {
            "id": result.id,
            "patient_id": result.patient_id,
            "practitioner_id": result.practitioner_id,
            "test_name": result.test_name,
            "test_code": result.test_code,
            "test_category": result.test_category,
            "test_type": result.test_type,
            "facility": result.facility,
            "status": result.status,
            "labs_result": result.labs_result,
            "ordered_date": result.ordered_date,
            "completed_date": result.completed_date,
            "notes": result.notes,
            "tags": result.tags or [],
            "created_at": result.created_at,
            "updated_at": result.updated_at,
            "practitioner_name": (
                result.practitioner.name if result.practitioner else None
            ),
            "patient_name": (
                f"{result.patient.first_name} {result.patient.last_name}"
                if result.patient
                else None
            ),
            "files": [],  # Files will be loaded separately if needed
        }
        response_results.append(result_dict)

    return response_results


@router.get("/{lab_result_id}", response_model=LabResultWithRelations)
def get_lab_result(
    *,
    request: Request,
    lab_result_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """Get a specific lab result by ID with related data."""
    with handle_database_errors(request=request):
        db_lab_result = lab_result.get_with_relations(
            db=db, record_id=lab_result_id, relations=["patient", "practitioner"]
        )
        handle_not_found(db_lab_result, "Lab result", request)
    assert (
        db_lab_result is not None
    )  # Type checker hint - handle_not_found raises if None

    # Convert to response format with practitioner name
    result_dict = {
        "id": db_lab_result.id,
        "patient_id": db_lab_result.patient_id,
        "practitioner_id": db_lab_result.practitioner_id,
        "test_name": db_lab_result.test_name,
        "test_code": db_lab_result.test_code,
        "test_category": db_lab_result.test_category,
        "test_type": db_lab_result.test_type,
        "facility": db_lab_result.facility,
        "status": db_lab_result.status,
        "labs_result": db_lab_result.labs_result,
        "ordered_date": db_lab_result.ordered_date,
        "completed_date": db_lab_result.completed_date,
        "notes": db_lab_result.notes,
        "tags": db_lab_result.tags or [],
        "created_at": db_lab_result.created_at,
        "updated_at": db_lab_result.updated_at,
        "practitioner_name": (
            db_lab_result.practitioner.name if db_lab_result.practitioner else None
        ),
        "patient_name": (
            f"{db_lab_result.patient.first_name} {db_lab_result.patient.last_name}"
            if db_lab_result.patient
            else None
        ),
        "files": db_lab_result.files or [],
    }

    return result_dict


@router.post("/", response_model=LabResultResponse, status_code=status.HTTP_201_CREATED)
def create_lab_result(
    *,
    lab_result_in: LabResultCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """Create a new lab result."""
    return handle_create_with_logging(
        db=db,
        crud_obj=lab_result,
        obj_in=lab_result_in,
        entity_type=EntityType.LAB_RESULT,
        user_id=current_user_id,
        entity_name="Lab result",
        request=request,
    )


@router.put("/{lab_result_id}", response_model=LabResultResponse)
def update_lab_result(
    *,
    lab_result_id: int,
    lab_result_in: LabResultUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """Update an existing lab result."""
    return handle_update_with_logging(
        db=db,
        crud_obj=lab_result,
        entity_id=lab_result_id,
        obj_in=lab_result_in,
        entity_type=EntityType.LAB_RESULT,
        user_id=current_user_id,
        entity_name="Lab result",
        request=request,
    )


@router.delete("/{lab_result_id}")
def delete_lab_result(
    *,
    lab_result_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """Delete a lab result and associated files."""
    with handle_database_errors(request=request):
        # Custom deletion logic to handle associated files
        db_lab_result = lab_result.get(db, id=lab_result_id)
        handle_not_found(db_lab_result, "Lab result", request)
        # Log the deletion activity BEFORE deleting
        from app.api.activity_logging import log_delete
        from app.core.logging_config import get_logger
        
        logger = get_logger(__name__)

        log_delete(
            db=db,
            entity_type=EntityType.LAB_RESULT,
            entity_obj=db_lab_result,
            user_id=current_user_id,
            request=request,
        )

        # Delete associated files from both old and new systems
        # 1. Delete old system files (LabResultFile table)
        lab_result_file.delete_by_lab_result(db, lab_result_id=lab_result_id)
        
        # 2. Delete new system files (EntityFile table) with selective deletion
        entity_file_service = GenericEntityFileService()
        file_cleanup_stats = entity_file_service.cleanup_entity_files_on_deletion(
            db=db,
            entity_type="lab-result",
            entity_id=lab_result_id,
            preserve_paperless=True
        )
        
        deleted_local_files = file_cleanup_stats.get("files_deleted", 0)
        preserved_paperless_files = file_cleanup_stats.get("files_preserved", 0)
        
        logger.info(f"EntityFile cleanup completed: {deleted_local_files} local files deleted, {preserved_paperless_files} Paperless files preserved")

        # Delete the lab result
        lab_result.delete(db, id=lab_result_id)
        
        return {
            "message": "Lab result and associated files deleted successfully",
            "files_deleted": deleted_local_files,
            "files_preserved": preserved_paperless_files
        }


# Patient-specific endpoints
@router.get("/patient/{patient_id}", response_model=List[LabResultResponse])
def get_lab_results_by_patient(
    *,
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    tags: Optional[List[str]] = Query(None, description="Filter by tags"),
    tag_match_all: bool = Query(False, description="Match all tags (AND) vs any tag (OR)"),
    db: Session = Depends(get_db),
    patient_id: int = Depends(deps.verify_patient_access),
):
    """Get all lab results for a specific patient."""
    with handle_database_errors(request=request):
        if tags:
            # Use tag filtering with patient constraint
            results = lab_result.get_multi_with_tag_filters(
                db,
                tags=tags,
                tag_match_all=tag_match_all,
                patient_id=patient_id,
                skip=skip,
                limit=limit,
            )
        else:
            # Use regular patient filtering
            results = lab_result.get_by_patient(
                db, patient_id=patient_id, skip=skip, limit=limit
            )
        return results


@router.get("/patient/{patient_id}/code/{code}", response_model=List[LabResultResponse])
def get_lab_results_by_patient_and_code(
    *,
    request: Request,
    code: str,
    db: Session = Depends(get_db),
    patient_id: int = Depends(deps.verify_patient_access),
):
    """Get lab results for a specific patient and test code."""
    with handle_database_errors(request=request):
        # Get all results for the patient first, then filter by code
        patient_results = lab_result.get_by_patient(db, patient_id=patient_id)
        results = [result for result in patient_results if result.code == code]
        return results


# Practitioner-specific endpoints
@router.get("/practitioner/{practitioner_id}", response_model=List[LabResultResponse])
def get_lab_results_by_practitioner(
    *,
    request: Request,
    practitioner_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """Get all lab results ordered by a specific practitioner."""
    with handle_database_errors(request=request):
        results = lab_result.get_by_practitioner(
            db, practitioner_id=practitioner_id, skip=skip, limit=limit
        )
        return results


# Search endpoints
@router.get("/search/code/{code}", response_model=List[LabResultResponse])
def search_lab_results_by_code(
    *,
    request: Request,
    code: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """Search lab results by test code."""
    with handle_database_errors(request=request):
        # Get all results and filter by code - replace with proper CRUD method if available
        all_results = lab_result.get_multi(db, skip=0, limit=10000)
        filtered_results = [result for result in all_results if result.code == code]
        # Apply pagination
        paginated_results = (
            filtered_results[skip : skip + limit] if limit else filtered_results[skip:]
        )
        return paginated_results


@router.get(
    "/search/code-pattern/{code_pattern}", response_model=List[LabResultResponse]
)
def search_lab_results_by_code_pattern(
    *,
    request: Request,
    code_pattern: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """Search lab results by code pattern (partial match)."""
    with handle_database_errors(request=request):
        # Get all results and filter by code pattern - replace with proper CRUD method if available
        all_results = lab_result.get_multi(db, skip=0, limit=10000)
        filtered_results = [
            result for result in all_results if code_pattern.lower() in result.code.lower()
        ]
        # Apply pagination
        paginated_results = (
            filtered_results[skip : skip + limit] if limit else filtered_results[skip:]
        )
        return paginated_results


# File Management Endpoints
@router.get("/{lab_result_id}/files", response_model=List[LabResultFileResponse])
def get_lab_result_files(*, request: Request, lab_result_id: int, db: Session = Depends(get_db)):
    """Get all files for a specific lab result."""
    with handle_database_errors(request=request):
        # Verify lab result exists
        db_lab_result = lab_result.get(db, id=lab_result_id)
        handle_not_found(db_lab_result, "Lab result", request)

        files = lab_result_file.get_by_lab_result(db, lab_result_id=lab_result_id)
        return files


@router.post("/{lab_result_id}/files", response_model=LabResultFileResponse)
async def upload_lab_result_file(
    *,
    request: Request,
    lab_result_id: int,
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
):
    """Upload a new file for a lab result."""
    # Verify lab result exists
    db_lab_result = lab_result.get(db, id=lab_result_id)
    handle_not_found(db_lab_result, "Lab result", request)

    # Validate file
    if not file.filename:
        raise BusinessLogicException(
            message="No file provided",
            request=request
        )

    # Configuration
    UPLOAD_DIRECTORY = settings.UPLOAD_DIR / "lab_result_files"
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    ALLOWED_EXTENSIONS = {
        ".pdf",
        ".jpg",
        ".jpeg",
        ".png",
        ".tiff",
        ".bmp",
        ".gif",
        ".txt",
        ".csv",
        ".xml",
        ".json",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".dcm",
    }

    # Check file extension
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ALLOWED_EXTENSIONS:
        raise BusinessLogicException(
            message=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}",
            request=request
        )

    # Check file size
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise BusinessLogicException(
            message=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024 * 1024)}MB",
            request=request
        )

    # Create upload directory if it doesn't exist with proper error handling
    ensure_directory_with_permissions(UPLOAD_DIRECTORY, "lab result file upload")

    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = UPLOAD_DIRECTORY / unique_filename

    # Save file with proper error handling
    with handle_database_errors(request=request):
        try:
            with open(file_path, "wb") as buffer:
                buffer.write(file_content)
        except PermissionError as e:
            raise DatabaseException(
                message=f"Permission denied writing file. This may be a Docker bind mount permission issue. Please ensure the container has write permissions to the upload directory: {str(e)}",
                request=request,
                original_error=e
            )
        except OSError as e:
            raise DatabaseException(
                message=f"Failed to save file: {str(e)}",
                request=request,
                original_error=e
            )
        except Exception as e:
            raise DatabaseException(
                message=f"Error saving file: {str(e)}",
                request=request,
                original_error=e
            )

    # Create file entry in database
    file_create = LabResultFileCreate(
        lab_result_id=lab_result_id,
        file_name=file.filename,
        file_path=str(file_path),
        file_type=file.content_type,
        file_size=len(file_content),
        description=description,
        uploaded_at=datetime.utcnow(),
    )

    # Create file entry in database  
    with handle_database_errors(request=request):
        try:
            db_file = lab_result_file.create(db, obj_in=file_create)
            return db_file
        except Exception as e:
            # Clean up the uploaded file if database operation fails
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception:
                pass
            raise DatabaseException(
                message=f"Error creating file record: {str(e)}",
                request=request,
                original_error=e
            )


@router.delete("/{lab_result_id}/files/{file_id}")
def delete_lab_result_file(
    *, request: Request, lab_result_id: int, file_id: int, db: Session = Depends(get_db)
):
    """Delete a specific file from a lab result."""
    with handle_database_errors(request=request):
        # Verify lab result exists
        db_lab_result = lab_result.get(db, id=lab_result_id)
        handle_not_found(db_lab_result, "Lab result", request)

        # Verify file exists and belongs to this lab result
        db_file = lab_result_file.get(db, id=file_id)
        handle_not_found(db_file, "File", request)

        if getattr(db_file, "lab_result_id") != lab_result_id:
            raise BusinessLogicException(
                message="File does not belong to this lab result",
                request=request
            )

        try:
            lab_result_file.delete(db, id=file_id)
            return {"message": "File deleted successfully"}
        except Exception as e:
            raise DatabaseException(
                message=f"Error deleting file: {str(e)}",
                request=request,
                original_error=e
            )


# Statistics endpoints
@router.get("/stats/patient/{patient_id}/count")
def get_patient_lab_result_count(
    *,
    request: Request,
    db: Session = Depends(get_db),
    patient_id: int = Depends(deps.verify_patient_access),
):
    """Get count of lab results for a patient."""
    with handle_database_errors(request=request):
        results = lab_result.get_by_patient(db, patient_id=patient_id)
        return {"patient_id": patient_id, "lab_result_count": len(results)}


@router.get("/stats/practitioner/{practitioner_id}/count")
def get_practitioner_lab_result_count(
    *, request: Request, practitioner_id: int, db: Session = Depends(get_db)
):
    """Get count of lab results ordered by a practitioner."""
    with handle_database_errors(request=request):
        results = lab_result.get_by_practitioner(db, practitioner_id=practitioner_id)
        return {"practitioner_id": practitioner_id, "lab_result_count": len(results)}


@router.get("/stats/code/{code}/count")
def get_code_usage_count(*, request: Request, code: str, db: Session = Depends(get_db)):
    """Get count of how many times a specific test code has been used."""
    with handle_database_errors(request=request):
        all_results = lab_result.get_multi(db, skip=0, limit=10000)
        results = [result for result in all_results if result.code == code]
        return {"code": code, "usage_count": len(results)}


# Lab Result - Condition Relationship Endpoints


@router.get(
    "/{lab_result_id}/conditions", response_model=List[LabResultConditionWithDetails]
)
def get_lab_result_conditions(
    *,
    request: Request,
    lab_result_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get all condition relationships for a specific lab result."""
    with handle_database_errors(request=request):
        # Verify lab result exists
        db_lab_result = lab_result.get(db, id=lab_result_id)
        handle_not_found(db_lab_result, "Lab result", request)

        # Verify user has access to this lab result's patient
        from app.services.patient_access import PatientAccessService
        from app.models.models import Patient
        
        patient_record = db.query(Patient).filter(Patient.id == db_lab_result.patient_id).first()
        if not patient_record:
            raise NotFoundException(
                resource="Patient",
                message="Patient record not found for this lab result",
                request=request
            )
        
        access_service = PatientAccessService(db)
        if not access_service.can_access_patient(current_user, patient_record, "view"):
            raise ForbiddenException(
                message="Access denied to this lab result",
                request=request
            )

        # Get condition relationships
        relationships = lab_result_condition.get_by_lab_result(
            db, lab_result_id=lab_result_id
        )

        # Enhance with condition details
        from app.crud.condition import condition as condition_crud

        enhanced_relationships = []
        for rel in relationships:
            condition_obj = condition_crud.get(db, id=rel.condition_id)
            rel_dict = {
                "id": rel.id,
                "lab_result_id": rel.lab_result_id,
                "condition_id": rel.condition_id,
                "relevance_note": rel.relevance_note,
                "created_at": rel.created_at,
                "updated_at": rel.updated_at,
                "condition": (
                    {
                        "id": condition_obj.id,
                        "diagnosis": condition_obj.diagnosis,
                        "status": condition_obj.status,
                        "severity": condition_obj.severity,
                    }
                    if condition_obj
                    else None
                ),
            }
            enhanced_relationships.append(rel_dict)

        return enhanced_relationships


@router.post("/{lab_result_id}/conditions", response_model=LabResultConditionResponse)
def create_lab_result_condition(
    *,
    request: Request,
    lab_result_id: int,
    condition_in: LabResultConditionCreate,
    db: Session = Depends(get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
):
    """Create a new lab result condition relationship."""
    with handle_database_errors(request=request):
        # Verify lab result exists and belongs to user
        db_lab_result = lab_result.get(db, id=lab_result_id)
        handle_not_found(db_lab_result, "Lab result", request)

        if db_lab_result.patient_id != current_user_patient_id:
            raise ForbiddenException(
                message="Access denied to this lab result",
                request=request
            )

        # Verify condition exists and belongs to the same patient
        db_condition = condition_crud.get(db, id=condition_in.condition_id)
        handle_not_found(db_condition, "Condition", request)

        # Ensure condition belongs to the same patient as the lab result
        if db_condition.patient_id != current_user_patient_id:
            raise BusinessLogicException(
                message="Cannot link condition that doesn't belong to the same patient",
                request=request
            )

        # Check if relationship already exists
        existing = lab_result_condition.get_by_lab_result_and_condition(
            db, lab_result_id=lab_result_id, condition_id=condition_in.condition_id
        )
        if existing:
            raise BusinessLogicException(
                message="Relationship between this lab result and condition already exists",
                request=request
            )

        # Override lab_result_id to ensure consistency
        condition_in.lab_result_id = lab_result_id

        # Create relationship
        relationship = lab_result_condition.create(db, obj_in=condition_in)
        return relationship


@router.put(
    "/{lab_result_id}/conditions/{relationship_id}",
    response_model=LabResultConditionResponse,
)
def update_lab_result_condition(
    *,
    request: Request,
    lab_result_id: int,
    relationship_id: int,
    condition_in: LabResultConditionUpdate,
    db: Session = Depends(get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
):
    """Update a lab result condition relationship."""
    with handle_database_errors(request=request):
        # Verify lab result exists and belongs to user
        db_lab_result = lab_result.get(db, id=lab_result_id)
        handle_not_found(db_lab_result, "Lab result", request)

        if db_lab_result.patient_id != current_user_patient_id:
            raise ForbiddenException(
                message="Access denied to this lab result",
                request=request
            )

        # Verify relationship exists
        relationship = lab_result_condition.get(db, id=relationship_id)
        handle_not_found(relationship, "Lab result condition relationship", request)

        if relationship.lab_result_id != lab_result_id:
            raise BusinessLogicException(
                message="Relationship does not belong to this lab result",
                request=request
            )

        # Update relationship
        updated_relationship = lab_result_condition.update(
            db, db_obj=relationship, obj_in=condition_in
        )
        return updated_relationship


@router.delete("/{lab_result_id}/conditions/{relationship_id}")
def delete_lab_result_condition(
    *,
    request: Request,
    lab_result_id: int,
    relationship_id: int,
    db: Session = Depends(get_db),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
):
    """Delete a lab result condition relationship."""
    with handle_database_errors(request=request):
        # Verify lab result exists and belongs to user
        db_lab_result = lab_result.get(db, id=lab_result_id)
        handle_not_found(db_lab_result, "Lab result", request)

        if db_lab_result.patient_id != current_user_patient_id:
            raise ForbiddenException(
                message="Access denied to this lab result",
                request=request
            )

        # Verify relationship exists
        relationship = lab_result_condition.get(db, id=relationship_id)
        handle_not_found(relationship, "Lab result condition relationship", request)

        if relationship.lab_result_id != lab_result_id:
            raise BusinessLogicException(
                message="Relationship does not belong to this lab result",
                request=request
            )

        # Delete relationship
        lab_result_condition.delete(db, id=relationship_id)
        return {"message": "Lab result condition relationship deleted successfully"}
