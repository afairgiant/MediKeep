"""
Shared base for the Epic MyChart parsers.

Both the single-column parser (``EpicMyChartSingleColumnParser``) and the
two-column card parser (``EpicMyChartCardParser``) are Epic MyChart exports and
share the same month-name collection-date format. Behavior common to both lives
here so it does not drift between the two implementations.
"""

import re
from datetime import datetime
from typing import Optional

from .base_parser import BaseLabParser


class EpicMyChartBaseParser(BaseLabParser):
    """Common Epic MyChart behavior shared by the layout-specific parsers."""

    LAB_NAME = "Epic MyChart"

    # Epic uses month-name dates ("Collected on Jul 07, 2026 3:10 PM").
    _MONTH_NAME_DATE_PATTERNS = (
        r"(?i)collected on\s+([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})",
        r"(?i)collection date:?\s+([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})",
        r"(?i)reported on\s+([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})",
    )

    def extract_date_from_text(self, text: str) -> Optional[str]:
        """
        Extract the collection date from Epic month-name date fields.

        e.g. "Collected on Jul 07, 2026 3:10 PM" or "Collection date: ...".
        Falls back to the base numeric (MM/DD/YYYY) extraction.
        """
        for pattern in self._MONTH_NAME_DATE_PATTERNS:
            match = re.search(pattern, text)
            if match:
                date_str = f"{match.group(1)} {match.group(2)}, {match.group(3)}"
                for fmt in ("%B %d, %Y", "%b %d, %Y"):
                    try:
                        return datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
                    except ValueError:
                        continue
        return super().extract_date_from_text(text)
