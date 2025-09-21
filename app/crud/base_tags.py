from typing import List, Optional
from sqlalchemy import or_
from sqlalchemy.orm import Session


class TagFilterMixin:
    """Mixin for CRUD classes that support tag filtering"""
    
    def get_by_tags(
        self, db: Session, *, 
        tags: List[str], 
        tag_match_all: bool = False,
        skip: int = 0, 
        limit: int = 100
    ) -> List:
        """Get records that contain specified tags"""
        if not tags:
            return []
        
        query = db.query(self.model)
        
        if tag_match_all:
            # AND logic - result must have ALL specified tags
            for tag in tags:
                query = query.filter(self.model.tags.contains([tag]))
        else:
            # OR logic - result must have ANY of the specified tags
            tag_conditions = [self.model.tags.contains([tag]) for tag in tags]
            query = query.filter(or_(*tag_conditions))
        
        return query.offset(skip).limit(limit).all()

    def get_multi_with_tag_filters(
        self, db: Session, *, 
        tags: Optional[List[str]] = None,
        tag_match_all: bool = False,
        skip: int = 0,
        limit: int = 100,
        **kwargs
    ) -> List:
        """Enhanced filtering with tag support"""
        query = db.query(self.model)
        
        # Apply existing filters
        for key, value in kwargs.items():
            if hasattr(self.model, key) and value is not None:
                query = query.filter(getattr(self.model, key) == value)
        
        # Tag filtering
        if tags:
            if tag_match_all:
                # AND logic - result must have ALL specified tags
                for tag in tags:
                    query = query.filter(self.model.tags.contains([tag]))
            else:
                # OR logic - result must have ANY of the specified tags
                tag_conditions = [self.model.tags.contains([tag]) for tag in tags]
                query = query.filter(or_(*tag_conditions))
        
        return query.offset(skip).limit(limit).all()