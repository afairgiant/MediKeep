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

    Provides fuzzy matching capabilities to handle various test name formats,
    abbreviations, and alternative spellings from different lab sources.
    """

    def __init__(self):
        """Initialize the canonical test matching service."""
        self._test_library: List[Dict[str, Any]] = get_tests()
        logger.info("Canonical test matching service initialized", extra={
            LogFields.CATEGORY: "app",
            LogFields.EVENT: "canonical_matching_initialized",
            LogFields.COUNT: len(self._test_library),
        })

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

        for test in self.test_library:
            canonical_name = test["test_name"]
            abbreviation = test.get("abbreviation")
            common_names = test.get("common_names", [])

            if canonical_name.lower() == normalized_input:
                logger.debug("Matched on test_name", extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "canonical_match_found",
                    "input": test_name,
                    "canonical_name": canonical_name,
                    "match_type": "test_name",
                })
                return canonical_name

            if abbreviation and abbreviation.lower() == normalized_input:
                logger.debug("Matched on abbreviation", extra={
                    LogFields.CATEGORY: "app",
                    LogFields.EVENT: "canonical_match_found",
                    "input": test_name,
                    "canonical_name": canonical_name,
                    "match_type": "abbreviation",
                })
                return canonical_name

            for common_name in common_names:
                if common_name.lower() == normalized_input:
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

        for test in self.test_library:
            if test["test_name"].lower() == normalized_input:
                return test

        return None

    def get_all_canonical_names(self) -> List[str]:
        """Get list of all canonical test names in the library."""
        return get_all_canonical_names()


# Create singleton instance
canonical_test_matching = CanonicalTestMatchingService()
