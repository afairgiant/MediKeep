from typing import List, Optional
from pydantic import BaseModel, field_validator


class TaggedEntityMixin(BaseModel):
    """Mixin for entities that support tagging"""
    tags: Optional[List[str]] = []
    
    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v):
        if v is None:
            return []
        
        # User-defined tags - no validation against predefined list
        # Users can create whatever tags make sense for their organization
        
        # Basic validation only
        if len(v) > 15:
            raise ValueError("Maximum 15 tags per record")
            
        # Normalize tags
        normalized_tags = []
        for tag in v:
            if not isinstance(tag, str):
                raise ValueError("Tags must be strings")
            normalized = tag.lower().strip().replace(" ", "-")
            if len(normalized) > 50:
                raise ValueError("Tag length must be 50 characters or less")
            normalized_tags.append(normalized)
        
        return list(set(normalized_tags))  # Remove duplicates