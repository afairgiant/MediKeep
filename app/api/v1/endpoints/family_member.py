from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api import deps
from app.core.http.error_handling import (
    BusinessLogicException,
    handle_database_errors
)
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
    verify_patient_ownership,
)
from app.crud.family_member import family_member
from app.crud.family_condition import family_condition
from app.models.activity_log import EntityType
from app.models.models import User
from app.schemas.family_member import (
    FamilyMemberCreate,
    FamilyMemberDropdownOption,
    FamilyMemberResponse,
    FamilyMemberSummary,
    FamilyMemberUpdate,
)
from app.schemas.family_condition import (
    FamilyConditionCreate,
    FamilyConditionResponse,
    FamilyConditionUpdate,
)

router = APIRouter()


@router.post("/", response_model=FamilyMemberResponse)
def create_family_member(
    *,
    family_member_in: FamilyMemberCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
) -> Any:
    """Create new family member."""
    return handle_create_with_logging(
        db=db,
        crud_obj=family_member,
        obj_in=family_member_in,
        entity_type=EntityType.FAMILY_MEMBER,
        user_id=current_user_id,
        entity_name="Family Member",
        request=request,
    )


@router.get("/", response_model=List[FamilyMemberResponse])
def read_family_members(
    *,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = Query(default=100, le=100),
    relationship: Optional[str] = Query(None),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Retrieve family members for the current user or accessible patient."""
    
    if relationship:
        family_members = family_member.get_by_relationship(
            db, patient_id=target_patient_id, relationship=relationship
        )
    else:
        family_members = family_member.get_by_patient_with_conditions(
            db, patient_id=target_patient_id
        )
    return family_members


@router.get("/dropdown", response_model=List[FamilyMemberDropdownOption])
def get_family_members_for_dropdown(
    *,
    db: Session = Depends(deps.get_db),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Get family members formatted for dropdown selection in forms."""
    family_members = family_member.get_by_patient(db, patient_id=target_patient_id)
    return family_members


@router.get("/{family_member_id}", response_model=FamilyMemberResponse)
def read_family_member(
    *,
    db: Session = Depends(deps.get_db),
    family_member_id: int,
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Get family member by ID with conditions - supports patient switching."""
    family_member_obj = family_member.get_with_relations(
        db=db,
        record_id=family_member_id,
        relations=["family_conditions"],
    )
    handle_not_found(family_member_obj, "Family Member", request)
    verify_patient_ownership(family_member_obj, target_patient_id, "family_member")
    return family_member_obj


@router.put("/{family_member_id}", response_model=FamilyMemberResponse)
def update_family_member(
    *,
    family_member_id: int,
    family_member_in: FamilyMemberUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Update a family member - supports patient switching."""
    return handle_update_with_logging(
        db=db,
        crud_obj=family_member,
        entity_id=family_member_id,
        obj_in=family_member_in,
        entity_type=EntityType.FAMILY_MEMBER,
        user_id=current_user_id,
        entity_name="Family Member",
        request=request,
        current_user=current_user,
        current_user_patient_id=current_user_patient_id,
    )


@router.delete("/{family_member_id}")
def delete_family_member(
    *,
    family_member_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Delete a family member - supports patient switching."""
    return handle_delete_with_logging(
        db=db,
        crud_obj=family_member,
        entity_id=family_member_id,
        entity_type=EntityType.FAMILY_MEMBER,
        user_id=current_user_id,
        entity_name="Family Member",
        request=request,
        current_user=current_user,
        current_user_patient_id=current_user_patient_id,
    )


@router.get("/search/", response_model=List[FamilyMemberResponse])
def search_family_members(
    *,
    request: Request,
    db: Session = Depends(deps.get_db),
    name: str = Query(..., min_length=2),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Search family members by name - supports patient switching."""
    with handle_database_errors(request=request):
        family_members = family_member.search_by_name(
            db, patient_id=target_patient_id, name_term=name
        )
        return family_members


# Family Condition Endpoints

@router.get("/{family_member_id}/conditions", response_model=List[FamilyConditionResponse])
def get_family_member_conditions(
    *,
    request: Request,
    family_member_id: int,
    db: Session = Depends(deps.get_db),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Get all conditions for a specific family member - supports patient switching."""
    with handle_database_errors(request=request):
        # Verify family member exists and belongs to the accessible patient
        family_member_obj = family_member.get(db, id=family_member_id)
        handle_not_found(family_member_obj, "Family Member", request)
        verify_patient_ownership(family_member_obj, target_patient_id, "family_member")
        
        # Get conditions
        conditions = family_condition.get_by_family_member(db, family_member_id=family_member_id)
        return conditions


@router.post("/{family_member_id}/conditions", response_model=FamilyConditionResponse)
def create_family_condition(
    *,
    family_member_id: int,
    condition_in: FamilyConditionCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Create a new condition for a family member - supports patient switching."""
    with handle_database_errors(request=request):
        # Verify family member exists and belongs to the accessible patient
        family_member_obj = family_member.get(db, id=family_member_id)
        handle_not_found(family_member_obj, "Family Member", request)
        verify_patient_ownership(family_member_obj, target_patient_id, "family_member")
        
        # Set family_member_id
        condition_in.family_member_id = family_member_id
        
        return handle_create_with_logging(
            db=db,
            crud_obj=family_condition,
            obj_in=condition_in,
            entity_type=EntityType.FAMILY_CONDITION,
            user_id=current_user_id,
            entity_name="Family Condition",
            request=request,
        )


@router.put("/{family_member_id}/conditions/{condition_id}", response_model=FamilyConditionResponse)
def update_family_condition(
    *,
    family_member_id: int,
    condition_id: int,
    condition_in: FamilyConditionUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Update a family member condition - supports patient switching."""
    with handle_database_errors(request=request):
        # Verify family member exists and belongs to the accessible patient
        family_member_obj = family_member.get(db, id=family_member_id)
        handle_not_found(family_member_obj, "Family Member", request)
        verify_patient_ownership(family_member_obj, current_user_patient_id, "family_member", db=db, current_user=current_user, permission='edit')

        # Get the condition
        condition_obj = family_condition.get(db, id=condition_id)
        handle_not_found(condition_obj, "Family Condition", request)

        # Verify the condition belongs to the specified family member
        if condition_obj.family_member_id != family_member_id:
            raise BusinessLogicException(
                message="Condition does not belong to the specified family member",
                request=request
            )

        return handle_update_with_logging(
            db=db,
            crud_obj=family_condition,
            entity_id=condition_id,
            obj_in=condition_in,
            entity_type=EntityType.FAMILY_CONDITION,
            user_id=current_user_id,
            entity_name="Family Condition",
            request=request,
            current_user=current_user,
            # current_user_patient_id is intentionally omitted here because ownership 
            # is verified via the parent FamilyMember object above.
            # FamilyCondition objects do not have a direct patient_id link.
        )


@router.delete("/{family_member_id}/conditions/{condition_id}")
def delete_family_condition(
    *,
    family_member_id: int,
    condition_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user_id: int = Depends(deps.get_current_user_id),
    current_user: User = Depends(deps.get_current_user),
    current_user_patient_id: int = Depends(deps.get_current_user_patient_id),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
) -> Any:
    """Delete a family member condition - supports patient switching."""
    with handle_database_errors(request=request):
        # Verify family member exists and belongs to the accessible patient
        family_member_obj = family_member.get(db, id=family_member_id)
        handle_not_found(family_member_obj, "Family Member", request)
        verify_patient_ownership(family_member_obj, current_user_patient_id, "family_member", db=db, current_user=current_user, permission='edit')

        # Get the condition
        condition_obj = family_condition.get(db, id=condition_id)
        handle_not_found(condition_obj, "Family Condition", request)

        # Verify the condition belongs to the specified family member
        if condition_obj.family_member_id != family_member_id:
            raise BusinessLogicException(
                message="Condition does not belong to the specified family member",
                request=request
            )

        return handle_delete_with_logging(
            db=db,
            crud_obj=family_condition,
            entity_id=condition_id,
            entity_type=EntityType.FAMILY_CONDITION,
            user_id=current_user_id,
            entity_name="Family Condition",
            request=request,
            current_user=current_user,
            # current_user_patient_id is intentionally omitted here because ownership 
            # is verified via the parent FamilyMember object above.
        )