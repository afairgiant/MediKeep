from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.services.tag_service import tag_service
from app.api import deps
from app.models.models import User
from app.core.logging_config import get_logger
from app.core.logging_helpers import log_endpoint_access, log_data_access

logger = get_logger(__name__, "app")

router = APIRouter()


class TagCreateRequest(BaseModel):
    tag: str


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
    
    # First sync any tags from medical records that aren't in user_tags yet
    tag_service.sync_tags_from_records(db, user_id=current_user.id)
    
    return tag_service.get_popular_tags_across_entities(
        db, entity_types=entity_types, limit=limit
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
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Search across entity types by tags"""
    
    log_endpoint_access(
        logger, request, current_user.id, "tags_search_performed",
        tags=tags,
        entity_types=entity_types,
        limit_per_entity=limit_per_entity
    )
    
    return tag_service.search_across_entities_by_tags(
        db, tags=tags, entity_types=entity_types, 
        limit_per_entity=limit_per_entity
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
        limit=limit
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
    """Rename a tag across all entities"""
    
    log_data_access(
        logger, request, current_user.id, "update", "Tag",
        old_tag=old_tag,
        new_tag=new_tag
    )
    
    result = tag_service.rename_tag_across_entities(
        db, old_tag=old_tag, new_tag=new_tag
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
    """Delete a tag from all entities"""
    
    log_data_access(
        logger, request, current_user.id, "delete", "Tag",
        tag=tag
    )
    
    result = tag_service.delete_tag_across_entities(db, tag=tag)
    
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
    """Replace one tag with another across all entities"""
    
    log_data_access(
        logger, request, current_user.id, "update", "Tag",
        old_tag=old_tag,
        new_tag=new_tag,
        operation_type="replace"
    )
    
    result = tag_service.replace_tag_across_entities(
        db, old_tag=old_tag, new_tag=new_tag
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