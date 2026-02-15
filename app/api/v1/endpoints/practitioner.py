from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.core.http.error_handling import (
    handle_database_errors
)
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
)
from app.crud.practitioner import practitioner
from app.models.activity_log import EntityType
from app.schemas.practitioner import (
    Practitioner,
    PractitionerCreate,
    PractitionerUpdate,
)

router = APIRouter()


@router.post("/", response_model=Practitioner)
def create_practitioner(
    *,
    practitioner_in: PractitionerCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create new practitioner."""
    return handle_create_with_logging(
        db=db,
        crud_obj=practitioner,
        obj_in=practitioner_in,
        entity_type=EntityType.PRACTITIONER,
        user_id=current_user_id,
        entity_name="Practitioner",
        request=request,
    )


@router.get("/", response_model=List[Practitioner])
def read_practitioners(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    specialty: Optional[str] = Query(None),
    practice_id: Optional[int] = Query(None),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Retrieve practitioners with optional filtering by specialty or practice."""
    with handle_database_errors(request=request):
        if practice_id:
            practitioners_list = practitioner.query(
                db, filters={"practice_id": practice_id},
                skip=skip, limit=limit, load_relations=["practice_rel"],
            )
        elif specialty:
            practitioners_list = practitioner.query(
                db, filters={"specialty": specialty},
                skip=skip, limit=limit, load_relations=["practice_rel"],
            )
        else:
            practitioners_list = practitioner.query(
                db, skip=skip, limit=limit, load_relations=["practice_rel"],
            )

        # Populate practice_name from eagerly-loaded relationship
        for p in practitioners_list:
            if p.practice_rel:
                p.practice_name = p.practice_rel.name

        return practitioners_list


@router.get("/{practitioner_id}", response_model=Practitioner)
def read_practitioner(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    practitioner_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get practitioner by ID with related information."""
    with handle_database_errors(request=request):
        practitioner_obj = practitioner.get_with_relations(
            db=db, record_id=practitioner_id, relations=["patients", "conditions", "treatments", "medications", "procedures", "encounters", "lab_results", "immunizations", "vitals", "practice_rel"]
        )
        handle_not_found(practitioner_obj, "Practitioner", request)

        # Populate practice_name from relationship
        if practitioner_obj.practice_rel:
            practitioner_obj.practice_name = practitioner_obj.practice_rel.name

        return practitioner_obj


@router.put("/{practitioner_id}", response_model=Practitioner)
def update_practitioner(
    *,
    practitioner_id: int,
    practitioner_in: PractitionerUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Update a practitioner."""
    return handle_update_with_logging(
        db=db,
        crud_obj=practitioner,
        entity_id=practitioner_id,
        obj_in=practitioner_in,
        entity_type=EntityType.PRACTITIONER,
        user_id=current_user_id,
        entity_name="Practitioner",
        request=request,
    )


@router.delete("/{practitioner_id}")
def delete_practitioner(
    *,
    practitioner_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Delete a practitioner."""
    return handle_delete_with_logging(
        db=db,
        crud_obj=practitioner,
        entity_id=practitioner_id,
        entity_type=EntityType.PRACTITIONER,
        user_id=current_user_id,
        entity_name="Practitioner",
        request=request,
    )


@router.get("/search/by-name", response_model=List[Practitioner])
def search_practitioners_by_name(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    name: str = Query(..., min_length=2),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Search practitioners by name."""
    with handle_database_errors(request=request):
        practitioners = practitioner.search_by_name(db, name=name)
        return practitioners


@router.get("/specialties")
def get_all_specialties(
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get all unique medical specialties from the database."""
    specialties = practitioner.get_all_specialties(db)
    return {"specialties": specialties}
