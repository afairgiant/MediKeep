from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.api.activity_logging import log_create, log_delete, log_update
from app.crud.pharmacy import pharmacy
from app.models.activity_log import EntityType
from app.schemas.pharmacy import Pharmacy, PharmacyCreate, PharmacyUpdate

router = APIRouter()


@router.post("/", response_model=Pharmacy)
def create_pharmacy(
    *,
    db: Session = Depends(deps.get_db),
    pharmacy_in: PharmacyCreate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Create new pharmacy.
    """
    pharmacy_obj = pharmacy.create(db=db, obj_in=pharmacy_in)

    # Log the creation activity using centralized logging
    log_create(
        db=db,
        entity_type="pharmacy",
        entity_obj=pharmacy_obj,
        user_id=current_user_id,
    )

    return pharmacy_obj


@router.get("/", response_model=List[Pharmacy])
def read_pharmacies(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Retrieve pharmacies.
    """
    pharmacies = pharmacy.get_multi(db, skip=skip, limit=limit)
    return pharmacies


@router.get("/{id}", response_model=Pharmacy)
def read_pharmacy(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Get pharmacy by ID.
    """
    pharmacy_obj = pharmacy.get(db=db, id=id)
    if not pharmacy_obj:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    return pharmacy_obj


@router.put("/{id}", response_model=Pharmacy)
def update_pharmacy(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    pharmacy_in: PharmacyUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Update a pharmacy.
    """
    pharmacy_obj = pharmacy.get(db=db, id=id)
    if not pharmacy_obj:
        raise HTTPException(status_code=404, detail="Pharmacy not found")

    pharmacy_obj = pharmacy.update(db=db, db_obj=pharmacy_obj, obj_in=pharmacy_in)

    # Log the update activity using centralized logging
    log_update(
        db=db,
        entity_type="pharmacy",
        entity_obj=pharmacy_obj,
        user_id=current_user_id,
    )

    return pharmacy_obj


@router.delete("/{id}")
def delete_pharmacy(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """
    Delete a pharmacy.
    """
    from app.models.models import Medication

    pharmacy_obj = pharmacy.get(db=db, id=id)
    if not pharmacy_obj:
        raise HTTPException(status_code=404, detail="Pharmacy not found")

    # First, check how many medications reference this pharmacy
    medication_count = db.query(Medication).filter(Medication.pharmacy_id == id).count()

    # Set pharmacy_id to NULL for all medications that reference this pharmacy
    if medication_count > 0:
        db.query(Medication).filter(Medication.pharmacy_id == id).update(
            {"pharmacy_id": None}
        )
        db.commit()

    # Log the deletion activity BEFORE deleting using centralized logging
    # Create custom description for pharmacy deletion with medication info
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
        entity_type="pharmacy",
        entity_obj=pharmacy_obj,
        user_id=current_user_id,
        description=description,
    )

    # Now delete the pharmacy
    pharmacy.delete(db=db, id=id)

    return {"ok": True}
