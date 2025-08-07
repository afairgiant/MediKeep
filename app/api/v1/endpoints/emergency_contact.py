from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api import deps
from app.api.activity_logging import log_create, log_delete, log_update
from app.crud.emergency_contact import emergency_contact
from app.models.activity_log import EntityType
from app.models.models import EmergencyContact
from app.schemas.emergency_contact import (
    EmergencyContactCreate,
    EmergencyContactResponse,
    EmergencyContactUpdate,
    EmergencyContactWithRelations,
)

router = APIRouter()


@router.post("/", response_model=EmergencyContactResponse)
def create_emergency_contact(
    *,
    db: Session = Depends(deps.get_db),
    emergency_contact_in: EmergencyContactCreate,
    current_user_id: int = Depends(deps.get_current_user_id),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Create new emergency contact."""
    # Use the specialized method that handles patient_id properly
    emergency_contact_obj = emergency_contact.create_for_patient(
        db=db, patient_id=target_patient_id, obj_in=emergency_contact_in
    )

    # Log the creation activity using centralized logging
    log_create(
        db=db,
        entity_type=EntityType.EMERGENCY_CONTACT,
        entity_obj=emergency_contact_obj,
        user_id=current_user_id,
    )

    return emergency_contact_obj


@router.get("/", response_model=List[EmergencyContactResponse])
def read_emergency_contacts(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    is_active: Optional[bool] = Query(None),
    is_primary: Optional[bool] = Query(None),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Retrieve emergency contacts for the current user or accessible patient."""

    # Start with base query
    query = db.query(EmergencyContact).filter(
        EmergencyContact.patient_id == target_patient_id
    )

    # Apply optional filters
    if is_active is not None:
        query = query.filter(EmergencyContact.is_active == is_active)

    if is_primary is not None:
        query = query.filter(EmergencyContact.is_primary == is_primary)

    # Order by primary first, then by name
    query = query.order_by(EmergencyContact.is_primary.desc(), EmergencyContact.name)

    # Apply pagination
    contacts = query.offset(skip).limit(limit).all()

    return contacts


@router.get("/{emergency_contact_id}", response_model=EmergencyContactWithRelations)
def read_emergency_contact(
    emergency_contact_id: int,
    db: Session = Depends(deps.get_db),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Get emergency contact by ID with related information - only allows access to user's own contacts."""
    # Use direct query with joinedload for relations
    from sqlalchemy.orm import joinedload

    contact_obj = (
        db.query(EmergencyContact)
        .options(joinedload(EmergencyContact.patient))
        .filter(EmergencyContact.id == emergency_contact_id)
        .first()
    )

    if not contact_obj:
        raise HTTPException(status_code=404, detail="Emergency Contact not found")

    # Security check: ensure the contact belongs to the current user
    deps.verify_patient_record_access(
        getattr(contact_obj, "patient_id"), target_patient_id, "emergency contact"
    )
    return contact_obj


@router.put("/{emergency_contact_id}", response_model=EmergencyContactResponse)
def update_emergency_contact(
    *,
    db: Session = Depends(deps.get_db),
    emergency_contact_id: int,
    emergency_contact_in: EmergencyContactUpdate,
    current_user_id: int = Depends(deps.get_current_user_id),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Update an emergency contact."""
    emergency_contact_obj = emergency_contact.get(db=db, id=emergency_contact_id)
    if not emergency_contact_obj:
        raise HTTPException(status_code=404, detail="Emergency Contact not found")

    # Security check: ensure the contact belongs to the current user
    deps.verify_patient_record_access(
        getattr(emergency_contact_obj, "patient_id"),
        target_patient_id,
        "emergency contact",
    )

    emergency_contact_obj = emergency_contact.update(
        db=db, db_obj=emergency_contact_obj, obj_in=emergency_contact_in
    )

    # Log the update activity using centralized logging
    log_update(
        db=db,
        entity_type=EntityType.EMERGENCY_CONTACT,
        entity_obj=emergency_contact_obj,
        user_id=current_user_id,
    )

    return emergency_contact_obj


@router.delete("/{emergency_contact_id}")
def delete_emergency_contact(
    *,
    db: Session = Depends(deps.get_db),
    emergency_contact_id: int,
    current_user_id: int = Depends(deps.get_current_user_id),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Delete an emergency contact."""
    emergency_contact_obj = emergency_contact.get(db=db, id=emergency_contact_id)
    if not emergency_contact_obj:
        raise HTTPException(status_code=404, detail="Emergency Contact not found")

    # Security check: ensure the contact belongs to the current user
    deps.verify_patient_record_access(
        getattr(emergency_contact_obj, "patient_id"),
        target_patient_id,
        "emergency contact",
    )

    # Log the deletion activity BEFORE deleting using centralized logging
    log_delete(
        db=db,
        entity_type=EntityType.EMERGENCY_CONTACT,
        entity_obj=emergency_contact_obj,
        user_id=current_user_id,
    )

    emergency_contact.delete(db=db, id=emergency_contact_id)
    return {"message": "Emergency Contact deleted successfully"}


@router.get("/patient/{patient_id}/primary", response_model=EmergencyContactResponse)
def get_primary_emergency_contact(
    *,
    db: Session = Depends(deps.get_db),
    patient_id: int = Depends(deps.verify_patient_access),
) -> Any:
    """Get the primary emergency contact for a patient."""
    primary_contact = emergency_contact.get_primary_contact(db, patient_id=patient_id)
    if not primary_contact:
        raise HTTPException(
            status_code=404, detail="Primary Emergency Contact not found"
        )
    return primary_contact


@router.post(
    "/{emergency_contact_id}/set-primary", response_model=EmergencyContactResponse
)
def set_primary_emergency_contact(
    *,
    db: Session = Depends(deps.get_db),
    emergency_contact_id: int,
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
) -> Any:
    """Set an emergency contact as the primary contact."""
    # Verify the contact belongs to the current user
    contact_obj = emergency_contact.get(db, id=emergency_contact_id)
    if not contact_obj:
        raise HTTPException(status_code=404, detail="Emergency Contact not found")

    # Security check: ensure the contact belongs to the current user
    deps.verify_patient_record_access(
        getattr(contact_obj, "patient_id"), current_user_patient_id, "emergency contact"
    )

    # Set as primary
    updated_contact = emergency_contact.set_primary_contact(
        db, contact_id=emergency_contact_id, patient_id=current_user_patient_id
    )
    return updated_contact
