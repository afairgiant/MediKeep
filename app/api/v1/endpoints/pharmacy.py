from typing import Any, List

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.core.http.error_handling import (
    handle_database_errors
)
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.core.logging.helpers import log_data_access
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_not_found,
    handle_update_with_logging,
)
from app.crud.pharmacy import pharmacy
from app.models.activity_log import EntityType
from app.schemas.pharmacy import Pharmacy, PharmacyCreate, PharmacyUpdate

router = APIRouter()

# Initialize logger
logger = get_logger(__name__, "app")


@router.post("/", response_model=Pharmacy)
def create_pharmacy(
    *,
    pharmacy_in: PharmacyCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create new pharmacy."""
    return handle_create_with_logging(
        db=db,
        crud_obj=pharmacy,
        obj_in=pharmacy_in,
        entity_type=EntityType.PHARMACY,
        user_id=current_user_id,
        entity_name="Pharmacy",
        request=request,
    )


@router.get("/", response_model=List[Pharmacy])
def read_pharmacies(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Retrieve pharmacies."""
    with handle_database_errors(request=request):
        pharmacies = pharmacy.get_multi(db, skip=skip, limit=limit)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Pharmacy",
            count=len(pharmacies)
        )

        return pharmacies


@router.get("/{id}", response_model=Pharmacy)
def read_pharmacy(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Get pharmacy by ID."""
    with handle_database_errors(request=request):
        pharmacy_obj = pharmacy.get(db=db, id=id)
        handle_not_found(pharmacy_obj, "Pharmacy", request)

        log_data_access(
            logger,
            request,
            current_user_id,
            "read",
            "Pharmacy",
            record_id=id
        )

        return pharmacy_obj


@router.put("/{id}", response_model=Pharmacy)
def update_pharmacy(
    *,
    id: int,
    pharmacy_in: PharmacyUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Update a pharmacy."""
    return handle_update_with_logging(
        db=db,
        crud_obj=pharmacy,
        entity_id=id,
        obj_in=pharmacy_in,
        entity_type=EntityType.PHARMACY,
        user_id=current_user_id,
        entity_name="Pharmacy",
        request=request,
    )


@router.delete("/{id}")
def delete_pharmacy(
    *,
    id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Delete a pharmacy."""
    with handle_database_errors(request=request):
        from app.models.models import Medication

        pharmacy_obj = pharmacy.get(db=db, id=id)
        handle_not_found(pharmacy_obj, "Pharmacy", request)

        # Check how many medications reference this pharmacy
        medication_count = db.query(Medication).filter(Medication.pharmacy_id == id).count()

        # Set pharmacy_id to NULL for all medications that reference this pharmacy
        if medication_count > 0:
            db.query(Medication).filter(Medication.pharmacy_id == id).update(
                {"pharmacy_id": None}
            )
            db.commit()

        # Log the deletion activity BEFORE deleting with custom description
        base_description = (
            f"Deleted pharmacy: {getattr(pharmacy_obj, 'name', 'Unknown pharmacy')}"
        )
        if medication_count > 0:
            description = f"{base_description}. Updated {medication_count} medication(s) to remove pharmacy reference."
        else:
            description = base_description

        from app.api.activity_logging import safe_log_activity
        from app.models.activity_log import ActionType

        safe_log_activity(
            db=db,
            action=ActionType.DELETED,
            entity_type=EntityType.PHARMACY,
            entity_obj=pharmacy_obj,
            user_id=current_user_id,
            description=description,
            request=request,
        )

        # Delete the pharmacy
        pharmacy.delete(db=db, id=id)

        return {"ok": True}
