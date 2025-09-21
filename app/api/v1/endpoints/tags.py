from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from app.core.database import get_db
from app.services.tag_service import tag_service
from app.api import deps
from app.models.models import User
from app.core.logging_config import get_logger

logger = get_logger(__name__, "app")

router = APIRouter()


@router.get("/popular", response_model=List[Dict[str, Any]])
async def get_popular_tags_across_entities(
    entity_types: List[str] = Query(
        default=["lab_result", "medication", "condition", "procedure", "immunization", "treatment", "encounter", "allergy"],
        description="Entity types to search"
    ),
    limit: int = Query(default=20, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get most popular tags across multiple entity types"""
    
    logger.info("Retrieving popular tags across entities", extra={
        "user_id": current_user.id,
        "entity_types": entity_types,
        "limit": limit
    })
    
    return tag_service.get_popular_tags_across_entities(
        db, entity_types=entity_types, limit=limit
    )


@router.get("/search", response_model=Dict[str, List[Any]])
async def search_by_tags_across_entities(
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
    
    logger.info("Searching across entities by tags", extra={
        "user_id": current_user.id,
        "tags": tags,
        "entity_types": entity_types,
        "limit_per_entity": limit_per_entity
    })
    
    return tag_service.search_across_entities_by_tags(
        db, tags=tags, entity_types=entity_types, 
        limit_per_entity=limit_per_entity
    )


@router.get("/autocomplete", response_model=List[str])
async def autocomplete_tags(
    q: str = Query(..., min_length=1, max_length=50),
    limit: int = Query(default=10, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get tag suggestions for autocomplete"""
    
    logger.debug("Generating tag autocomplete", extra={
        "user_id": current_user.id,
        "query": q,
        "limit": limit
    })
    
    return tag_service.autocomplete_tags(db, query=q, limit=limit)


@router.get("/suggestions", response_model=List[str])
async def get_tag_suggestions(
    entity_type: Optional[str] = Query(None, description="Suggest tags for specific entity type"),
    limit: int = Query(default=20, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get tag suggestions based on what users have actually created"""
    
    logger.debug("Generating tag suggestions", extra={
        "user_id": current_user.id,
        "entity_type": entity_type,
        "limit": limit
    })
    
    # Return most popular user-created tags, optionally filtered by entity type
    result = tag_service.get_popular_tags_across_entities(
        db, 
        entity_types=[entity_type] if entity_type else None,
        limit=limit
    )
    
    # Extract just the tag names for suggestions
    return [item["tag"] for item in result]