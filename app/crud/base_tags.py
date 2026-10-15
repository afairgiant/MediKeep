import json
from typing import List, Optional

from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session


class TagFilterMixin:
    """Mixin for CRUD classes that support tag filtering"""

    def _has_tag(self, tag: str):
        """Condition matching a single tag as its own JSON string token.

        Matches both the raw UTF-8 and ``json.dumps``-escaped forms a tag can
        be stored in. Uses ``autoescape=True`` so a search term containing
        ``%``/``_`` is treated literally rather than as a SQL LIKE wildcard.
        The search term is lower-cased to match how tags are stored.
        """
        tag = tag.strip().lower()
        column_text = cast(self.model.tags, String)
        quoted_raw = f'"{tag}"'
        quoted_escaped = json.dumps(tag)
        if quoted_raw == quoted_escaped:
            # Same bytes either way for an all-ASCII tag - one condition.
            return column_text.contains(quoted_raw, autoescape=True)
        return or_(
            column_text.contains(quoted_raw, autoescape=True),
            column_text.contains(quoted_escaped, autoescape=True),
        )

    def _apply_tag_filter(
        self,
        query,
        *,
        tags: Optional[List[str]],
        tag_match_all: bool = False,
    ):
        """Apply a tags filter to ``query``, or return it unchanged if no tags given.

        Shared by ``get_by_tags``/``get_multi_with_tag_filters`` below and by
        subclasses that need tag filtering combined with their own
        ordering/other filters.
        """
        if not tags:
            return query

        if tag_match_all:
            # AND logic - result must have ALL specified tags
            for tag in tags:
                query = query.filter(self._has_tag(tag))
        else:
            # OR logic - result must have ANY of the specified tags
            query = query.filter(or_(*[self._has_tag(tag) for tag in tags]))

        return query

    def get_by_tags(
        self,
        db: Session,
        *,
        tags: List[str],
        tag_match_all: bool = False,
        skip: int = 0,
        limit: int = 100
    ) -> List:
        """Get records that contain specified tags"""
        if not tags:
            return []

        query = self._apply_tag_filter(
            db.query(self.model), tags=tags, tag_match_all=tag_match_all
        )
        return query.offset(skip).limit(limit).all()

    def get_multi_with_tag_filters(
        self,
        db: Session,
        *,
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

        query = self._apply_tag_filter(query, tags=tags, tag_match_all=tag_match_all)

        return query.offset(skip).limit(limit).all()
