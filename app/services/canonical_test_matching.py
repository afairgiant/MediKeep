"""
Canonical Test Name Matching Service

Provides standardized test name matching for lab results.
Maps various test name variations (abbreviations, common names, alternative spellings)
to canonical standardized test names from the test library.

This ensures consistency across lab results from different sources.
"""

from typing import List, Dict, Any, Optional
import re

from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields
from app.services.test_library_loader import get_tests, get_all_canonical_names

logger = get_logger(__name__, "app")


class CanonicalTestMatchingService:
    """
    Service for matching lab test names to canonical standardized names.

    Uses pre-built lookup dictionaries for O(1) matching instead of
    iterating the full test library on every call.

    Matching priority:
    1. Exact match on test_name (case-insensitive)
    2. Exact match on abbreviation (case-insensitive)
    3. Exact match on any common_names entry (case-insensitive)
    """

    def __init__(self):
        """Initialize the canonical test matching service and build lookup indices."""
        self._test_library: List[Dict[str, Any]] = get_tests()
        self._build_lookup_indices()
        logger.info("Canonical test matching service initialized", extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "canonical_matching_initialized",
            LogFields.COUNT: len(self._test_library),
        })

    def _build_lookup_indices(self):
        """
        Build lookup dictionaries from the test library for O(1) matching.

        Three separate dicts are used to preserve matching priority:
        test_name matches take precedence over abbreviation matches,
        which take precedence over common_name matches.
        """
        # Maps lowercased key -> (canonical_name, match_type)
        self._by_test_name: Dict[str, str] = {}
        self._by_abbreviation: Dict[str, str] = {}
        self._by_common_name: Dict[str, str] = {}
        # Maps lowercased canonical name -> full test dict
        self._info_by_name: Dict[str, Dict[str, Any]] = {}

        for test in self._test_library:
            canonical_name = test["test_name"]
            canonical_lower = canonical_name.lower()

            self._by_test_name[canonical_lower] = canonical_name
            self._info_by_name[canonical_lower] = test

            abbreviation = test.get("abbreviation")
            if abbreviation:
                self._by_abbreviation[abbreviation.lower()] = canonical_name

            for common_name in test.get("common_names", []):
                self._by_common_name[common_name.lower()] = canonical_name

    @property
    def test_library(self) -> List[Dict[str, Any]]:
        """Get the test library."""
        return self._test_library

    def _normalize_input(self, test_name: str) -> str:
        """Normalize test name by stripping whitespace and trailing punctuation."""
        normalized = test_name.strip()
        return re.sub(r'[,;:]+$', '', normalized)

    def find_canonical_match(self, test_name: str) -> Optional[str]:
        """
        Find canonical test name for a given test name input.

        Matching priority:
        1. Exact match on test_name (case-insensitive)
        2. Exact match on abbreviation (case-insensitive)
        3. Exact match on any common_names entry (case-insensitive)

        Returns:
            Canonical test_name if match found, None otherwise
        """
        if not test_name:
            return None

        normalized_input = self._normalize_input(test_name).lower()

        # Priority 1: test_name match
        canonical_name = self._by_test_name.get(normalized_input)
        if canonical_name:
            logger.debug("Matched on test_name", extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "canonical_match_found",
                "input": test_name,
                "canonical_name": canonical_name,
                "match_type": "test_name",
            })
            return canonical_name

        # Priority 2: abbreviation match
        canonical_name = self._by_abbreviation.get(normalized_input)
        if canonical_name:
            logger.debug("Matched on abbreviation", extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "canonical_match_found",
                "input": test_name,
                "canonical_name": canonical_name,
                "match_type": "abbreviation",
            })
            return canonical_name

        # Priority 3: common_name match
        canonical_name = self._by_common_name.get(normalized_input)
        if canonical_name:
            logger.debug("Matched on common_name", extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "canonical_match_found",
                "input": test_name,
                "canonical_name": canonical_name,
                "match_type": "common_name",
            })
            return canonical_name

        logger.debug("No canonical match found", extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "canonical_match_not_found",
            "input": test_name,
        })
        return None

    def get_test_info(self, test_name: str) -> Optional[Dict[str, Any]]:
        """Get full test information for a canonical test name."""
        normalized_input = self._normalize_input(test_name).lower()
        return self._info_by_name.get(normalized_input)

    def get_all_canonical_names(self) -> List[str]:
        """Get list of all canonical test names in the library."""
        return get_all_canonical_names()


# Create singleton instance
canonical_test_matching = CanonicalTestMatchingService()
