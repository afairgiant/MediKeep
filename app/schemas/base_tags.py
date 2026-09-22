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

    Raises on write paths only - see ``TaggedEntityResponseMixin`` below for
    the read-path counterpart, which sanitizes instead.
    """
    if not isinstance(tag, str):
        raise ValueError("Tags must be strings")
    normalized = tag.lower().strip().replace(" ", "-")
    if len(normalized) > 50:
        raise ValueError("Tag length must be 50 characters or less")
    if not all(c.isalnum() or c in _ALLOWED_TAG_PUNCTUATION for c in normalized):
        raise ValueError("Tags may only contain letters, numbers, and . - :")
    # A blank, whitespace-only, or punctuation-only tag (e.g. "   " or "...")
    # passes both checks above - all() over "" is vacuously True, the length
    # check is an upper bound only, and "." is itself allowed punctuation -
    # which would let e.g. "   " create a blank tag, or a blank/punctuation
    # `new_tag` on the rename/replace endpoints blank a tag across every
    # record it appears on via the raw-SQL path in tag_service. Require at
    # least one alphanumeric character survives normalization.
    if not any(c.isalnum() for c in normalized):
        raise ValueError("Tag must contain at least one letter or number")
    return normalized


def _sanitize_tag(tag) -> Optional[str]:
    """Best-effort clean of a single legacy tag value; never raises.

    Same normalization as ``normalize_and_validate_tag`` but strips
    disallowed characters instead of rejecting the whole tag, and returns
    None (drop it) if nothing usable is left. Used only on the read path -
    see ``TaggedEntityResponseMixin``.
    """
    if not isinstance(tag, str):
        return None
    normalized = tag.lower().strip().replace(" ", "-")
    cleaned = "".join(
        c for c in normalized if c.isalnum() or c in _ALLOWED_TAG_PUNCTUATION
    )
    cleaned = cleaned[:50]
    # Drop it if nothing alphanumeric survived (e.g. the tag was "..." or
    # became "" once markup was stripped) - a punctuation-only tag carries
    # no information worth displaying.
    if not any(c.isalnum() for c in cleaned):
        return None
    return cleaned


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


def _sanitize_tags(v) -> List[str]:
    """Best-effort clean of a tag list read back from storage; never raises.

    Order-preserving de-dup (nicer for display than the write path's
    ``set()``, which is fine there since order doesn't matter for what gets
    stored).
    """
    if not isinstance(v, list):
        return []
    seen: dict = {}
    for tag in v:
        cleaned = _sanitize_tag(tag)
        if cleaned is not None:
            seen[cleaned] = None
    return list(seen)


class TaggedEntityResponseMixin(BaseModel):
    """Mixin for *Response (read) schemas of taggable entities.

    TaggedEntityMixin.validate_tags is also what response schemas inherit
    through *Base (AllergyResponse(AllergyBase), Insurance(InsuranceBase),
    etc.), since raising on read means any record already holding a tag
    written before the character allowlist existed - e.g. "crohn's",
    "covid_19", "a/b", all valid before this fix - fails model_validate on
    the ORM object, turning "list" and "get" for that record into a 500.

    This mixin overrides ``validate_tags`` (Pydantic v2 lets a subclass
    redefine a parent's field_validator) to sanitize instead: strip
    disallowed characters, drop anything left empty. The hard rejection
    stays in effect on create/update input via TaggedEntityMixin /
    TaggedEntityUpdateMixin - only the read path is lenient. See the
    ``20260922_*_sanitize_existing_tag_values`` Alembic migration for the
    one-time cleanup of already-stored tags; this mixin is what keeps a read
    safe regardless of whether that migration has run yet.
    """

    tags: Optional[List[str]] = []

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v):
        if v is None:
            return []
        return _sanitize_tags(v)
