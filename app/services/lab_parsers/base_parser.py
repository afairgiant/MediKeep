"""
Base class for lab-specific PDF parsers.
Each lab (LabCorp, Quest, etc.) will have its own parser implementation.
"""

from abc import ABC, abstractmethod
from typing import Dict, List
import re


class LabTestResult:
    """Structured lab test result."""

    def __init__(
        self,
        test_name: str,
        value: float,
        unit: str = "",
        reference_range: str = "",
        flag: str = "",
        confidence: float = 1.0,
        test_date: str = None  # Date in YYYY-MM-DD format
    ):
        self.test_name = test_name
        self.value = value
        self.unit = unit
        self.reference_range = reference_range
        self.flag = flag
        self.confidence = confidence
        self.test_date = test_date

    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization."""
        return {
            "test_name": self.test_name,
            "value": self.value,
            "unit": self.unit,
            "reference_range": self.reference_range,
            "flag": self.flag,
            "confidence": self.confidence,
            "test_date": self.test_date
        }


class BaseLabParser(ABC):
    """
    Base class for lab-specific parsers.
    Each lab implementation should override these methods.
    """

    LAB_NAME = "Generic"

    # OCR corruption patterns and their corrections
    # These handle common OCR errors found in scanned lab reports
    OCR_CORRUPTION_PATTERNS = {
        # Leading character corruption
        r'^\^([a-z])': r'B\1',   # ^asos → Basos
        r'^h([A-Z])': r'\1',     # hNeutrophils → Neutrophils (remove h before uppercase)
        r'^hl([a-z])': r'N\1',   # hleutrophils → Neutrophils (hl -> N before lowercase)

        # Trailing artifacts - remove quotes and apostrophes
        # Match quotes/apostrophes after any word character or closing parenthesis
        r'(\w|\))"\'*': r'\1',   # Remove quotes after word chars or )
        r'(\w|\))"': r'\1',      # Single double quote
        r'(\w|\))\'': r'\1',     # Single apostrophe

        # Special character cleanup in test names
        r'([A-Za-z]+)<"': r'\1',  # RBC<" → RBC
        r'([A-Za-z]+)<': r'\1',   # RBC< → RBC
        r'([A-Za-z]+)>"': r'\1',  # TEST>" → TEST
        r'([A-Za-z]+)>': r'\1',   # TEST> → TEST

        # Unicode/OCR character misreads
        r'^lijn': 'Im',  # lijnmature → Immature (lijn -> Im)
    }

    @abstractmethod
    def can_parse(self, text: str) -> bool:
        """
        Determine if this parser can handle the given text.

        Args:
            text: Extracted PDF text

        Returns:
            True if this parser recognizes the lab format
        """
        pass

    @abstractmethod
    def parse(self, text: str) -> List[LabTestResult]:
        """
        Parse lab results from text.

        Args:
            text: Extracted PDF text

        Returns:
            List of structured lab test results
        """
        pass

    def clean_ocr_artifacts(self, text: str, aggressive: bool = False) -> str:
        """
        Clean common OCR artifacts from text.

        This method handles OCR errors commonly found in scanned lab reports,
        such as quote marks, special characters, and character corruption.

        Args:
            text: Text to clean
            aggressive: If True, apply more aggressive cleanup (may affect accuracy)

        Returns:
            Cleaned text with OCR artifacts removed

        Examples:
            >>> parser.clean_ocr_artifacts('WBC"')
            'WBC'
            >>> parser.clean_ocr_artifacts('^asos')
            'Basos'
            >>> parser.clean_ocr_artifacts('hleutrophils')
            'Nleutrophils'
            >>> parser.clean_ocr_artifacts('RBC<"')
            'RBC'
        """
        cleaned = text

        # Apply all corruption patterns
        for pattern, replacement in self.OCR_CORRUPTION_PATTERNS.items():
            cleaned = re.sub(pattern, replacement, cleaned)

        if aggressive:
            # More aggressive cleanup for badly corrupted OCR
            # Remove multiple spaces
            cleaned = re.sub(r'\s{2,}', ' ', cleaned)
            # Normalize quotes (remove all remaining quotes)
            cleaned = cleaned.replace('"', '').replace("'", '')

        return cleaned.strip()

    def clean_test_name(self, name: str) -> str:
        """
        Remove superscript numbers, OCR artifacts, and clean test name.

        Updated to handle OCR corruption before other cleanup steps.

        Args:
            name: Test name to clean

        Returns:
            Cleaned test name

        Examples:
            >>> parser.clean_test_name('WBC" 01')
            'WBC'
            >>> parser.clean_test_name('^asos" 02')
            'Basos'
            >>> parser.clean_test_name('RBC<" 03')
            'RBC'
        """
        # First apply OCR cleanup to handle artifacts
        name = self.clean_ocr_artifacts(name)

        # Remove superscript patterns (01, 02, etc.)
        name = re.sub(r'\d{2}$', '', name)
        name = re.sub(r'\s+\d{2}\s+', ' ', name)

        # Remove extra whitespace
        name = ' '.join(name.split())

        return name.strip()

    def parse_value(self, value_str: str) -> tuple:
        """
        Parse value and flag from string like "103 High" or "5.4".

        Returns:
            (value: float, flag: str)
        """
        parts = value_str.strip().split()

        try:
            value = float(parts[0].replace(',', ''))
            flag = ' '.join(parts[1:]) if len(parts) > 1 else ""
            return value, flag
        except (ValueError, IndexError):
            return None, ""

    def parse_reference_range(self, range_str: str) -> str:
        """Clean and standardize reference range."""
        # Remove extra whitespace and common prefixes
        range_str = range_str.strip()
        range_str = re.sub(r'^(Ref\.?\s*Range:?|Reference:?)\s*', '', range_str, flags=re.IGNORECASE)
        return range_str

    def extract_date_from_text(self, text: str) -> str:
        """
        Extract lab test date from PDF text.

        Looks for common date patterns like:
        - Date Collected: 10/12/2022
        - Date Received: 10/12/2022
        - Date Reported: 10/22/2022
        - Collection Date: 10/12/2022

        Returns:
            Date in YYYY-MM-DD format, or None if not found
        """
        from datetime import datetime

        # Common date field patterns (prioritize collected > received > reported)
        date_patterns = [
            r'Date\s+Collected[:\s]+(\d{1,2}/\d{1,2}/\d{4})',
            r'Collection\s+Date[:\s]+(\d{1,2}/\d{1,2}/\d{4})',
            r'Date\s+Received[:\s]+(\d{1,2}/\d{1,2}/\d{4})',
            r'Date\s+Reported[:\s]+(\d{1,2}/\d{1,2}/\d{4})',
            r'Test\s+Date[:\s]+(\d{1,2}/\d{1,2}/\d{4})',
            r'Specimen\s+Collected[:\s]+(\d{1,2}/\d{1,2}/\d{4})',
        ]

        for pattern in date_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                date_str = match.group(1)
                try:
                    # Parse MM/DD/YYYY format
                    date_obj = datetime.strptime(date_str, '%m/%d/%Y')
                    # Return in YYYY-MM-DD format
                    return date_obj.strftime('%Y-%m-%d')
                except ValueError:
                    continue

        return None
