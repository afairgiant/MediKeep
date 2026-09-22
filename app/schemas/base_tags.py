from typing import List, Optional

from pydantic import BaseModel, field_validator

_ALLOWED_TAG_PUNCTUATION = {".", "-", ":"}


def normalize_and_validate_tag(tag: str) -> str:
    """Normalize and validate a single tag string.

    This is the one place the tag allowlist is enforced - letters, digits,
    and . - : only, which blocks HTML markup and entity-decode characters
    (< > & # ; " ' ` $) so a tag can never break out of a text-content
    context when rendered. Used both for entity ``tags`` lists (below) and
    for the standalone tag-registry endpoints in
    ``app/api/v1/endpoints/tags.py`` (create/rename/replace), which write
    tag values directly and must not bypass this check.
    """
    if not isinstance(tag, str):
        raise ValueError("Tags must be strings")
    normalized = tag.lower().strip().replace(" ", "-")
    if len(normalized) > 50:
        raise ValueError("Tag length must be 50 characters or less")
    if not all(c.isalnum() or c in _ALLOWED_TAG_PUNCTUATION for c in normalized):
        raise ValueError("Tags may only contain letters, numbers, and . - :")
    return normalized


def _normalize_and_validate_tags(v: List[str]) -> List[str]:
    """Normalize and validate a non-None list of tags.

    Shared by TaggedEntityMixin (create/response schemas, where a missing
    tags list means "no tags") and TaggedEntityUpdateMixin (update schemas,
    where None means "not being changed" and must stay None - only a
    non-None list reaches this function there).
    """
    # User-defined tags - no validation against predefined list
    # Users can create whatever tags make sense for their organization

    # Basic validation only
    if len(v) > 15:
        raise ValueError("Maximum 15 tags per record")

    normalized_tags = [normalize_and_validate_tag(tag) for tag in v]
    return list(set(normalized_tags))  # Remove duplicates


class TaggedEntityMixin(BaseModel):
    """Mixin for entities that support tagging"""

    tags: Optional[List[str]] = []

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v):
        if v is None:
            return []
        return _normalize_and_validate_tags(v)


class TaggedEntityUpdateMixin(BaseModel):
    """Mixin for *Update schemas of taggable entities.

    Unlike TaggedEntityMixin, ``tags`` defaults to and preserves None here,
    since these schemas are partial updates where None means "not being
    changed" rather than "clear the tags".
    """

    tags: Optional[List[str]] = None

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v):
        if v is None:
            return None
        return _normalize_and_validate_tags(v)
