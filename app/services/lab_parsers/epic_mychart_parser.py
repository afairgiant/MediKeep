"""
Epic MyChart-specific PDF parser.
Handles lab results downloaded from Epic MyChart patient portals.

Epic MyChart uses a card-based visual layout with gauge bars.
Each test shows: test name, "Normal range: X - Y unit", a value with a
visual gauge, and gauge endpoint numbers. This is very different from the
tabular formats of LabCorp/Quest.
"""

import re
from datetime import datetime
from typing import List, Optional, Set, Tuple

from app.core.logging.config import get_logger

from .base_parser import BaseLabParser, LabTestResult

logger = get_logger(__name__, "app")


class EpicMyChartParser(BaseLabParser):
    """Parser for Epic MyChart lab results."""

    LAB_NAME = "Epic MyChart"

    # Lines that are metadata/noise and should never be test names
    _NOISE_PATTERNS = [
        r"(?i)^patient\b",
        r"(?i)^date of birth",
        r"(?i)^dob\b",
        r"(?i)^sex\b",
        r"(?i)^age\b",
        r"(?i)^mrn\b",
        r"(?i)^authorizing provider",
        r"(?i)^result status",
        r"(?i)^resulting lab",
        r"(?i)^ordering provider",
        r"(?i)^collected on\b",
        r"(?i)^collection date",
        r"(?i)^reported on\b",
        r"(?i)^specimen\b",
        r"(?i)^normal range:",
        r"(?i)^reference range",
        r"(?i)^component\b",
        r"(?i)^value\s*$",
        r"(?i)^flag\b",
        r"(?i)^units?\s*$",
        r"(?i)^copyright",
        r"(?i)licensed from epic",
        r"(?i)mychart",
        r"(?i)epic systems",
        r"(?i)^page\s+\d+",
        r"(?i)all rights reserved",
        r"(?i)^interpretive data",
        r"(?i)^standard range",
        r"(?i)^\d+\s*-\s*\d+\s*$",  # Bare range like "0 - 100"
    ]

    def can_parse(self, text: str) -> bool:
        """
        Detect Epic MyChart format by matching 2+ indicators.

        Uses multiple indicators to avoid false positives.
        """
        if not text or not text.strip():
            return False

        score = 0

        # Strong indicators
        if re.search(r"(?i)mychart.*epic\s*systems", text):
            score += 1
        if re.search(r"(?i)licensed from epic systems corporation", text):
            score += 1

        # Epic-specific date format: "Collected on Apr 10, 2025"
        if re.search(
            r"(?i)collected on\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}", text
        ):
            score += 1

        # "Normal range:" is the key anchor appearing multiple times
        normal_range_count = len(re.findall(r"(?i)normal range:", text))
        if normal_range_count >= 2:
            score += 1

        # Epic-specific metadata fields
        if re.search(r"(?i)authorizing provider:", text):
            score += 1
        if re.search(r"(?i)result status:", text):
            score += 1
        if re.search(r"(?i)resulting lab:", text):
            score += 1

        return score >= 2

    def parse(self, text: str) -> List[LabTestResult]:
        """
        Parse Epic MyChart results by anchoring on "Normal range:" lines.

        Strategy:
        - Find each "Normal range: ..." line
        - Look backward for test name
        - Look forward for value
        - Determine flag by comparing value to range bounds
        """
        if not text or not text.strip():
            return []

        lines = text.split("\n")
        results = []
        consumed_indices: Set[int] = set()

        test_date = self.extract_date_from_text(text)
        if test_date:
            logger.info(
                "epic_mychart_date_extracted",
                extra={"date": test_date},
            )

        logger.info("epic_mychart_parser_start")

        for i, line in enumerate(lines):
            stripped = line.strip()
            if not re.search(r"(?i)^normal range:", stripped):
                continue

            # Parse the normal range line
            ref_range, unit = self._parse_normal_range(stripped)
            if not ref_range:
                continue

            # Look backward for test name
            test_name = self._find_test_name_before(lines, i, consumed_indices)
            if not test_name:
                continue

            # Look forward for value
            value = self._find_value_after(lines, i, ref_range)
            if value is None:
                continue

            # Determine flag from value vs range
            flag = self._determine_flag(value, ref_range)

            result = LabTestResult(
                test_name=test_name,
                value=value,
                unit=unit,
                reference_range=ref_range,
                flag=flag,
                confidence=0.93,
                test_date=test_date,
            )
            results.append(result)

            logger.info(
                "epic_mychart_test_parsed",
                extra={
                    "test_name": test_name,
                    "value": value,
                    "unit": unit,
                    "ref_range": ref_range,
                    "flag": flag,
                },
            )

        # Deduplicate by test name (card layout can cause double parsing)
        results = self._deduplicate(results)

        logger.info(
            "epic_mychart_parser_complete",
            extra={"total_parsed": len(results)},
        )

        return results

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _parse_normal_range(self, text: str) -> Tuple[str, str]:
        """
        Parse a "Normal range: ..." line into (reference_range, unit).

        Handles formats:
        - "Normal range: 0.50 - 0.90 mg/dL"
        - "Normal range: above >=90 mL/min/1.73m2"
        - "Normal range: <150 mg/dL"
        - "Normal range: 3.5 - 5.0 g/dL"
        """
        # Strip the "Normal range:" prefix
        match = re.match(r"(?i)normal range:\s*(.*)", text)
        if not match:
            return ("", "")

        content = match.group(1).strip()
        if not content:
            return ("", "")

        # Pattern: "above >=N unit" or "above >= N unit"
        above_match = re.match(
            r"(?i)above\s*>=?\s*(\d+\.?\d*)\s*(.*)", content
        )
        if above_match:
            num = above_match.group(1)
            unit = above_match.group(2).strip()
            return (f">={num}", unit)

        # Pattern: "<N unit" or ">N unit"
        ineq_match = re.match(
            r"([<>]=?\s*\d+\.?\d*)\s*(.*)", content
        )
        if ineq_match:
            ref_range = ineq_match.group(1).replace(" ", "")
            unit = ineq_match.group(2).strip()
            return (ref_range, unit)

        # Pattern: "X - Y unit" (the most common)
        range_match = re.match(
            r"(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*(.*)", content
        )
        if range_match:
            low = range_match.group(1)
            high = range_match.group(2)
            unit = range_match.group(3).strip()
            return (f"{low} - {high}", unit)

        return ("", "")

    def _find_test_name_before(
        self, lines: List[str], anchor_idx: int, consumed: Set[int]
    ) -> Optional[str]:
        """
        Search backward from the anchor line to find the test name.

        Looks at the 1-3 lines above the "Normal range:" line, skipping
        blank lines and noise.
        """
        for offset in range(1, 4):
            idx = anchor_idx - offset
            if idx < 0:
                break

            candidate = lines[idx].strip()
            if not candidate:
                continue

            if idx in consumed:
                continue

            if self._is_noise(candidate):
                continue

            if self._is_valid_epic_test_name(candidate):
                consumed.add(idx)
                return self.clean_test_name(candidate)

        return None

    def _find_value_after(
        self, lines: List[str], anchor_idx: int, ref_range: str
    ) -> Optional[float]:
        """
        Search forward from the anchor line to find the test value.

        Skips gauge endpoint pairs (two numbers on the same line that
        match the range bounds) and looks for a standalone single number.
        """
        # Extract range bounds for filtering gauge endpoints
        low_bound, high_bound = self._extract_range_bounds(ref_range)

        for offset in range(1, 6):
            idx = anchor_idx + offset
            if idx >= len(lines):
                break

            candidate = lines[idx].strip()
            if not candidate:
                continue

            # Stop if we hit another "Normal range:" line (next test)
            if re.search(r"(?i)^normal range:", candidate):
                break

            # Stop if we hit a valid test name (next card)
            if self._is_valid_epic_test_name(candidate) and not re.match(
                r"^[\d.<>=]+$", candidate
            ):
                break

            # Skip the "Value" label that sometimes appears
            if candidate.lower() == "value":
                continue

            # Skip noise lines
            if self._is_noise(candidate):
                continue

            # Try to extract a numeric value from this line
            value = self._try_extract_value(candidate, low_bound, high_bound)
            if value is not None:
                return value

        return None

    def _try_extract_value(
        self,
        line: str,
        low_bound: Optional[float],
        high_bound: Optional[float],
    ) -> Optional[float]:
        """
        Try to extract a test value from a line, filtering gauge endpoints.

        Gauge endpoint lines typically have two numbers matching the range
        bounds (e.g., "0.50    0.90" for range "0.50 - 0.90").
        """
        # Check for two numbers on one line (gauge endpoints)
        two_nums = re.findall(r"(\d+\.?\d*)", line)
        if len(two_nums) == 2:
            try:
                n1, n2 = float(two_nums[0]), float(two_nums[1])
            except ValueError:
                pass
            else:
                # If both numbers match the range bounds, skip (gauge endpoints)
                if low_bound is not None and high_bound is not None:
                    if self._numbers_match(n1, low_bound) and self._numbers_match(
                        n2, high_bound
                    ):
                        return None

        # Single number on the line (the actual value)
        single_match = re.match(r"^\s*(\d+\.?\d*)\s*$", line)
        if single_match:
            try:
                return float(single_match.group(1))
            except ValueError:
                return None

        return None

    @staticmethod
    def _numbers_match(a: float, b: float, tolerance: float = 0.001) -> bool:
        """Check if two numbers are approximately equal."""
        return abs(a - b) < tolerance

    def _extract_range_bounds(
        self, ref_range: str
    ) -> Tuple[Optional[float], Optional[float]]:
        """
        Extract numeric bounds from a reference range string.

        Returns (low, high) or (None, None) for non-standard ranges.
        """
        # Standard range: "X - Y"
        range_match = re.match(r"(\d+\.?\d*)\s*-\s*(\d+\.?\d*)", ref_range)
        if range_match:
            return float(range_match.group(1)), float(range_match.group(2))

        return None, None

    def _determine_flag(self, value: float, ref_range: str) -> str:
        """
        Determine flag (High/Low/"") by comparing value to range bounds.

        Epic MyChart does not include explicit H/L flags in the PDF text,
        so we compute them from the value and reference range.
        """
        # Handle >=N ranges (e.g., ">=90")
        gte_match = re.match(r">=?\s*(\d+\.?\d*)", ref_range)
        if gte_match:
            threshold = float(gte_match.group(1))
            return "Low" if value < threshold else ""

        # Handle <N ranges
        lt_match = re.match(r"<\s*(\d+\.?\d*)", ref_range)
        if lt_match:
            threshold = float(lt_match.group(1))
            return "High" if value >= threshold else ""

        # Standard range: "X - Y"
        range_match = re.match(r"(\d+\.?\d*)\s*-\s*(\d+\.?\d*)", ref_range)
        if range_match:
            low = float(range_match.group(1))
            high = float(range_match.group(2))
            if value < low:
                return "Low"
            if value > high:
                return "High"
            return ""

        return ""

    def _is_valid_epic_test_name(self, name: str) -> bool:
        """
        Validate a candidate test name for Epic MyChart format.

        Epic test names are typically Title Case (e.g., "Creatinine Level",
        "Blood Urea Nitrogen (BUN)").
        """
        if not name or len(name) < 3 or len(name) > 80:
            return False

        # Reject lines that are all uppercase (section headers like "RENAL PANEL")
        alpha_chars = [c for c in name if c.isalpha()]
        if alpha_chars and all(c.isupper() for c in alpha_chars):
            # Allow short all-caps abbreviations like "BUN" or "EGFR"
            if len(alpha_chars) > 5:
                return False

        # Must start with a letter
        if not name[0].isalpha():
            return False

        # Must contain at least one letter
        if not re.search(r"[A-Za-z]", name):
            return False

        # Reject if it looks like a pure number line
        if re.match(r"^[\d\s.]+$", name):
            return False

        # Reject if it's noise
        if self._is_noise(name):
            return False

        return True

    def _is_noise(self, line: str) -> bool:
        """Check if a line is metadata/noise that should be skipped."""
        if not line or len(line.strip()) < 2:
            return True

        for pattern in self._NOISE_PATTERNS:
            if re.search(pattern, line.strip()):
                return True

        return False

    @staticmethod
    def _deduplicate(results: List[LabTestResult]) -> List[LabTestResult]:
        """Deduplicate results by test name, keeping the first occurrence."""
        seen: Set[str] = set()
        unique = []
        for result in results:
            key = result.test_name.lower()
            if key not in seen:
                seen.add(key)
                unique.append(result)
        return unique

    def extract_date_from_text(self, text: str) -> Optional[str]:
        """
        Extract lab test date from Epic MyChart PDF text.

        Epic uses month-name date format:
        - "Collected on Apr 10, 2025"
        - "Collection date: Apr 10, 2025"
        - "Collected on April 10, 2025"
        """
        # Epic-specific date patterns with month names
        date_patterns = [
            r"(?i)collected on\s+([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})",
            r"(?i)collection date:?\s+([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})",
            r"(?i)reported on\s+([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})",
        ]

        for pattern in date_patterns:
            match = re.search(pattern, text)
            if match:
                month_str = match.group(1)
                day = match.group(2)
                year = match.group(3)
                date_str = f"{month_str} {day}, {year}"

                # Try full month name first, then abbreviated
                for fmt in ("%B %d, %Y", "%b %d, %Y"):
                    try:
                        date_obj = datetime.strptime(date_str, fmt)
                        return date_obj.strftime("%Y-%m-%d")
                    except ValueError:
                        continue

        # Fallback to base class method for numeric dates
        return super().extract_date_from_text(text)
