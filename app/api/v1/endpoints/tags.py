import re
import time

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, field_validator

from app.core.database.database import get_db
from app.services.tag_service import tag_service
from app.api import deps
from app.models.models import User
from app.core.logging.config import get_logger
from app.core.logging.helpers import log_endpoint_access, log_data_access

logger = get_logger(__name__, "app")

router = APIRouter()

HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

# Simple in-memory time-gate for sync_tags_from_records per user.
# Maps user_id -> last sync timestamp (epoch seconds).
_sync_timestamps: Dict[int, float] = {}
_SYNC_INTERVAL_SECONDS = 300  # 5 minutes


class TagCreateRequest(BaseModel):
    tag: str


class TagColorUpdateRequest(BaseModel):
    color: Optional[str] = None

    @field_validator("color")
    @classmethod
    def validate_color(cls, v):
        if v is not None and not HEX_COLOR_RE.match(v):
            raise ValueError("Color must be a valid hex color (e.g. #228be6)")
        return v


@router.get("/popular", response_model=List[Dict[str, Any]])
async def get_popular_tags_across_entities(
    request: Request,
    entity_types: List[str] = Query(
        default=["lab_result", "medication", "condition", "procedure", "immunization", "treatment", "encounter", "allergy"],
        description="Entity types to search"
    ),
    limit: int = Query(default=20, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get most popular tags across multiple entity types"""

    log_endpoint_access(
        logger, request, current_user.id, "popular_tags_retrieved",
        entity_types=entity_types,
        limit=limit
    )

    # Time-gated sync: only re-sync if >5 min since last sync for this user
    now = time.monotonic()
    last_sync = _sync_timestamps.get(current_user.id, 0)
    if now - last_sync > _SYNC_INTERVAL_SECONDS:
        tag_service.sync_tags_from_records(db, user_id=current_user.id)
        _sync_timestamps[current_user.id] = now

    return tag_service.get_popular_tags_across_entities(
        db, entity_types=entity_types, limit=limit, user_id=current_user.id
    )


@router.get("/search", response_model=Dict[str, List[Any]])
async def search_by_tags_across_entities(
    request: Request,
    tags: List[str] = Query(..., description="Tags to search for"),
    entity_types: List[str] = Query(
        default=["lab_result", "medication", "condition", "procedure", "immunization", "treatment", "encounter", "allergy"],
        description="Entity types to search"
    ),
    limit_per_entity: int = Query(default=10, le=20),
    match_mode: str = Query(
        default="any",
        description="Tag matching mode: 'any' (OR) or 'all' (AND)"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
):
    """Search across entity types by tags, scoped to an accessible patient"""

    if match_mode not in ("any", "all"):
        match_mode = "any"

    log_endpoint_access(
        logger, request, current_user.id, "tags_search_performed",
        tags=tags,
        entity_types=entity_types,
        limit_per_entity=limit_per_entity,
        match_mode=match_mode,
        patient_id=target_patient_id
    )

    return tag_service.search_across_entities_by_tags(
        db, tags=tags, entity_types=entity_types,
        limit_per_entity=limit_per_entity,
        match_mode=match_mode,
        patient_id=target_patient_id
    )


@router.get("/autocomplete", response_model=List[str])
async def autocomplete_tags(
    request: Request,
    q: str = Query(..., min_length=1, max_length=50),
    limit: int = Query(default=10, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get tag suggestions for autocomplete"""

    log_endpoint_access(
        logger, request, current_user.id, "tag_autocomplete_requested",
        query=q,
        limit=limit
    )

    return tag_service.autocomplete_tags(db, query=q, limit=limit)


@router.get("/suggestions", response_model=List[str])
async def get_tag_suggestions(
    request: Request,
    entity_type: Optional[str] = Query(None, description="Suggest tags for specific entity type"),
    limit: int = Query(default=20, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get tag suggestions based on what users have actually created"""

    log_endpoint_access(
        logger, request, current_user.id, "tag_suggestions_requested",
        entity_type=entity_type,
        limit=limit
    )

    # Return most popular user-created tags, optionally filtered by entity type
    result = tag_service.get_popular_tags_across_entities(
        db,
        entity_types=[entity_type] if entity_type else None,
        limit=limit,
        user_id=current_user.id
    )

    # Extract just the tag names for suggestions
    return [item["tag"] for item in result]


@router.put("/rename", response_model=Dict[str, Any])
async def rename_tag(
    request: Request,
    old_tag: str = Query(..., description="Current tag name to rename"),
    new_tag: str = Query(..., description="New tag name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Rename a tag across all entities owned by the current user"""

    log_data_access(
        logger, request, current_user.id, "update", "Tag",
        old_tag=old_tag,
        new_tag=new_tag
    )

    result = tag_service.rename_tag_across_entities(
        db, old_tag=old_tag, new_tag=new_tag, user_id=current_user.id
    )

    return {
        "message": f"Successfully renamed '{old_tag}' to '{new_tag}'",
        "records_updated": result
    }


@router.delete("/delete", response_model=Dict[str, Any])
async def delete_tag(
    request: Request,
    tag: str = Query(..., description="Tag name to delete"),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Delete a tag from all entities owned by the current user"""

    log_data_access(
        logger, request, current_user.id, "delete", "Tag",
        tag=tag
    )

    result = tag_service.delete_tag_across_entities(
        db, tag=tag, user_id=current_user.id
    )

    return {
        "message": f"Successfully deleted tag '{tag}'",
        "records_updated": result
    }


@router.put("/replace", response_model=Dict[str, Any])
async def replace_tag(
    request: Request,
    old_tag: str = Query(..., description="Tag to replace"),
    new_tag: str = Query(..., description="Replacement tag"),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Replace one tag with another across all entities owned by the current user"""

    log_data_access(
        logger, request, current_user.id, "update", "Tag",
        old_tag=old_tag,
        new_tag=new_tag,
        operation_type="replace"
    )

    result = tag_service.replace_tag_across_entities(
        db, old_tag=old_tag, new_tag=new_tag, user_id=current_user.id
    )

    return {
        "message": f"Successfully replaced '{old_tag}' with '{new_tag}'",
        "records_updated": result
    }


@router.post("/create", response_model=Dict[str, Any])
async def create_tag(
    req: Request,
    request: TagCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Create a new tag in the user tags registry"""

    log_data_access(
        logger, req, current_user.id, "create", "Tag",
        tag=request.tag
    )

    result = tag_service.create_tag(db, tag=request.tag, user_id=current_user.id)

    return {
        "message": f"Successfully created tag '{request.tag}'",
        "tag": request.tag
    }


@router.patch("/{tag_id}/color", response_model=Dict[str, Any])
async def update_tag_color(
    req: Request,
    tag_id: int,
    request: TagColorUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Update the color of a tag"""

    log_data_access(
        logger, req, current_user.id, "update", "Tag",
        tag_id=tag_id,
        color=request.color
    )

    success = tag_service.update_tag_color(
        db, tag_id=tag_id, user_id=current_user.id, color=request.color
    )

    if not success:
        raise HTTPException(status_code=404, detail="Tag not found")

    return {
        "message": "Tag color updated successfully",
        "tag_id": tag_id,
        "color": request.color
    }
