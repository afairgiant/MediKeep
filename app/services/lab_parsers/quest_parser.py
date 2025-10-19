"""
Quest Diagnostics-specific PDF parser.
Handles Quest Diagnostics lab result format.
"""

import re
from typing import List, Optional
from .base_parser import BaseLabParser, LabTestResult
from app.core.logging.config import get_logger

logger = get_logger(__name__, "app")


class QuestParser(BaseLabParser):
    """Parser for Quest Diagnostics lab results."""

    LAB_NAME = "Quest Diagnostics"

    def can_parse(self, text: str) -> bool:
        """Detect Quest Diagnostics format by looking for signature elements."""
        indicators = [
            r'Quest Diagnostics',
            r'Quest,\s*Quest Diagnostics',
            r'questdiagnostics\.com',
            r'MyQuest',
            r'Quest Diagnostics Incorporated',
        ]

        return any(re.search(pattern, text, re.IGNORECASE) for pattern in indicators)

    def parse(self, text: str) -> List[LabTestResult]:
        """
        Parse Quest Diagnostics results using pattern matching.

        Quest formats:
        1. Single-line: "CHOLESTEROL, TOTAL 170 Reference Range: <200 mg/dL"
        2. Multi-line: "CHOLESTEROL, TOTAL\n170\nReference Range: <200"
        3. Table: "CHOLESTEROL, TOTAL 170 <200 mg/dL LL3"
        """
        results = []
        lines = text.split('\n')

        test_date = self.extract_date_from_text(text)
        if test_date:
            logger.info(f"Extracted test date: {test_date}")
        else:
            logger.warning("No test date found in PDF")

        logger.info("="*80)
        logger.info("QUEST DIAGNOSTICS PARSER - PROCESSING LINES")
        logger.info("="*80)

        i = 0
        while i < len(lines):
            line = lines[i].strip()
            i += 1

            if not line:
                continue

            # Try single-line format first
            result = self._parse_line(line, test_date=test_date)
            if result:
                flag_str = f" [{result.flag}]" if result.flag else ""
                range_str = f" (Ref: {result.reference_range})" if result.reference_range else ""
                logger.info(f"PARSED: {result.test_name} = {result.value} {result.unit}{flag_str}{range_str}")
                results.append(result)
                continue

            # Try multi-line format: test name on one line, value on next
            result = self._parse_multiline(line, lines, i, test_date)
            if result:
                flag_str = f" [{result.flag}]" if result.flag else ""
                range_str = f" (Ref: {result.reference_range})" if result.reference_range else ""
                logger.info(f"PARSED (multiline): {result.test_name} = {result.value} {result.unit}{flag_str}{range_str}")
                results.append(result)
                i += result.lines_consumed  # Skip the lines we consumed
                continue

            logger.debug(f"SKIPPED: {line[:80]}")

        logger.info("="*80)
        logger.info(f"TOTAL PARSED: {len(results)} components")
        logger.info("="*80)

        return results

    def _parse_multiline(self, line: str, lines: List[str], current_index: int, test_date: str = None) -> Optional[LabTestResult]:
        """
        Parse multi-line format where test name is on one line and value on the next.

        Format:
        CHOLESTEROL, TOTAL
        170
        Reference Range: <200
        mg/dL
        """
        # Skip lines that are chart labels or descriptive text (from graph axes)
        if line.startswith(('From', 'lbs', 'in ', 'mg/dL')):
            return None

        # Skip lines that contain date ranges (chart x-axis labels)
        if 'From' in line and 'To' in line:
            return None

        # Check if this line looks like a valid test name
        if not self._is_valid_test_name(line):
            return None

        # Line is potentially a test name - check if next line has a numeric value
        if current_index >= len(lines):
            return None

        next_line = lines[current_index].strip()

        # Try to extract value and optional flag from next line
        # Patterns: "170", "102 H", "3.6"
        value_pattern = r'^(\d+\.?\d*)\s*([HLhl])?\s*$'
        match = re.match(value_pattern, next_line)

        if not match:
            return None

        value_str = match.group(1)
        flag = match.group(2) or ""

        try:
            value = float(value_str)
        except ValueError:
            return None

        # Look ahead for reference range and unit in next few lines
        unit = ""
        ref_range = ""
        lines_consumed = 1  # We consumed the value line

        # Check next 3-4 lines for reference range and unit
        for i in range(current_index + 1, min(current_index + 5, len(lines))):
            look_line = lines[i].strip()

            # Skip empty lines
            if not look_line:
                continue

            # Extract reference range if found
            if not ref_range and 'Reference Range:' in look_line:
                ref_range = self._extract_range(look_line)

            # Extract unit if found
            if not unit:
                potential_unit = self._extract_unit(look_line)
                if potential_unit:
                    unit = potential_unit

            # Stop if we hit another test name or non-related content
            if self._looks_like_test_name(look_line) or 'From' in look_line:
                break

        # Normalize flag
        if flag:
            flag = "High" if flag.upper() == "H" else "Low"

        result = LabTestResult(
            test_name=line,
            value=value,
            unit=unit,
            reference_range=ref_range,
            flag=flag,
            confidence=0.92,  # Slightly lower confidence for multi-line
            test_date=test_date
        )

        # Attach lines_consumed so caller knows how many lines to skip
        result.lines_consumed = lines_consumed
        return result

    def _looks_like_test_name(self, line: str) -> bool:
        """Quick check if a line looks like it could be a test name."""
        # All caps, reasonable length, no "From" or chart data
        if not line:
            return False
        if 'From' in line or 'Sep' in line or 'Jan' in line or 'May' in line:
            return False
        # Must have some letters
        if not re.search(r'[A-Za-z]{3,}', line):
            return False
        # Check if it's mostly uppercase letters
        letter_count = sum(1 for c in line if c.isalpha())
        if letter_count == 0:
            return False
        upper_count = sum(1 for c in line if c.isupper())
        return upper_count / letter_count > 0.7  # >70% uppercase

    def _parse_line(self, line: str, test_date: str = None) -> Optional[LabTestResult]:
        """
        Parse a single line looking for lab result pattern.

        Quest patterns:
        1. "CHOLESTEROL, TOTAL 170 Reference Range: <200 mg/dL"
        2. "LDL-CHOLESTEROL 102 H mg/dL (calc)"
        3. "GLUCOSE 111 H Reference Range: 65-99 mg/dL"
        """
        if self._is_noise(line):
            return None

        # Pattern 1: Test name followed by value, optional flag, then reference range or unit
        # Handles: "CHOLESTEROL, TOTAL 170 Reference Range: <200 mg/dL"
        # Handles: "LDL-CHOLESTEROL 102 H mg/dL (calc)"
        # Handles: "GLUCOSE 111 H Reference Range: 65-99 mg/dL"

        pattern = r'^([A-Z][A-Z0-9\s,\-\(\)/]+?)\s+(\d+\.?\d*)\s*([HLhl])?\s*(.*)$'
        match = re.match(pattern, line)

        if not match:
            return None

        test_name = match.group(1).strip()
        value_str = match.group(2)
        flag = match.group(3) or ""
        remainder = match.group(4).strip()

        # Validate test name
        if not self._is_valid_test_name(test_name):
            return None

        # Parse value
        try:
            value = float(value_str)
        except ValueError:
            return None

        # Extract unit and reference range from remainder
        unit = self._extract_unit(remainder)
        ref_range = self._extract_range(remainder)

        # Normalize flag
        if flag:
            flag = "High" if flag.upper() == "H" else "Low"

        return LabTestResult(
            test_name=test_name,
            value=value,
            unit=unit,
            reference_range=ref_range,
            flag=flag,
            confidence=0.95,
            test_date=test_date
        )

    def _extract_unit(self, text: str) -> str:
        """
        Extract unit from text.

        Quest format examples:
        - "Reference Range: <200 mg/dL"
        - "mg/dL (calc)"
        - "> OR = 40 mg/dL"
        """
        # Common unit patterns - order matters (most specific first)
        unit_patterns = [
            r'(mg/dL)',
            r'(mmol/L)',
            r'(mEq/L)',
            r'(g/dL)',
            r'(ng/dL)',
            r'(pg/mL)',
            r'(ng/mL)',
            r'(IU/L)',
            r'(U/L)',
            r'(fL)',
            r'(pg)\b',
            r'(mmHg)',
            r'(lbs)',
            r'\b(in)\b',
            r'(%)',
        ]

        for pattern in unit_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1)

        return ""

    def _extract_range(self, text: str) -> str:
        """
        Extract reference range from text.

        Quest patterns:
        - "Reference Range: <200 mg/dL" -> "<200"
        - "Reference Range: 65-99 mg/dL" -> "65-99"
        - "Reference Range: > OR = 40 mg/dL" -> ">40"
        - "Reference range: <100" -> "<100"
        """
        # Look for "Reference Range:" or "Reference range:" followed by the range
        ref_range_pattern = r'Reference\s+[Rr]ange:\s*([<>≤≥=\s\d\.\-OR]+?)(?:\s+[a-zA-Z/]+|$)'
        match = re.search(ref_range_pattern, text, re.IGNORECASE)

        if match:
            range_str = match.group(1).strip()
            # Clean up "OR =" style ranges to just the operator
            range_str = re.sub(r'>\s*OR\s*=', '>=', range_str)
            range_str = re.sub(r'<\s*OR\s*=', '<=', range_str)
            range_str = re.sub(r'\s+', ' ', range_str).strip()
            return range_str

        # Fallback: look for common range patterns
        range_patterns = [
            r'(\d+\.?\d*\s*-\s*\d+\.?\d*)',  # "65-99"
            r'([<>≤≥]\s*\d+\.?\d*)',         # "<200", ">40"
        ]

        for pattern in range_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()

        return ""

    def _is_valid_test_name(self, name: str) -> bool:
        """
        Validate that a test name looks legitimate.
        Quest test names are typically ALL CAPS or Title Case.
        """
        name_lower = name.lower().strip()

        # Reject common false positives
        invalid_names = [
            'analyte', 'value', 'reference', 'range', 'result',
            'fasting', 'status', 'clinic', 'id', 'height', 'weight',
            'collected', 'received', 'reported', 'specimen',
            'patient', 'sex', 'phone', 'dob', 'age',
            'performing sites', 'key', 'priority', 'copies sent to',
            'clinic id', 'fasting status',
        ]

        if name_lower in invalid_names:
            return False

        # Reject city/state patterns (LENEXA, KS)
        if re.match(r'^[A-Z]+,\s*[A-Z]{2}$', name):
            return False

        # Reject names with patient identifiers or codes in parentheses
        if re.search(r'\([A-Z0-9]+\)$', name):
            return False

        # Reject measurement labels (HEIGHT (FT), HEIGHT (IN), etc.)
        if re.match(r'^(HEIGHT|WEIGHT|BP|WAIST)\s*\(', name, re.IGNORECASE):
            return False

        # Reject company/organization names
        if name_lower.startswith(('steadymd', 'quest', 'labcorp')):
            return False

        # Reject if too short (likely not a real test name)
        if len(name) < 3:
            return False

        # Reject if too long (likely a sentence fragment)
        if len(name) > 60:
            return False

        # Require at least one letter
        if not re.search(r'[A-Za-z]', name):
            return False

        # Reject common section headers
        if name_lower.startswith(('note', 'interpretation', 'for patients')):
            return False

        return True

    def _is_noise(self, line: str) -> bool:
        """Quick check if line is obvious noise."""
        line_lower = line.lower()

        noise_keywords = [
            r'^patient\b', r'^specimen\b', 'collected:', 'received:', 'reported:',
            r'^analyte\s*$', r'^value\s*$', 'fasting reference interval',
            'desirable range', 'for patients', 'ldl-c is now calculated',
            'martin ss et al', 'jama', 'http://', 'https://',
            'quest diagnostics', 'laboratory director', 'performing sites',
            'copies sent to', 'privacy policy', 'all rights reserved',
            r'page \d+ of', 'final', 'see report', 'client #',
            r'^phone:', r'^fax:', r'^dob:', r'^sex:', r'^age:', 'requisition:',
            'your receipt of these', 'should not be viewed',
            'myquest', 'registered trademark', 'property of their',
            # Address patterns
            r'\bblvd\b', r'\bave\b.*\d{5}',
            # Panel names without values (section headers)
            r'^lipid panel', r'^metabolic panel', r'^cbc\s*$',
            # Explanatory text patterns
            'treating to a non-hdl',
            'considered a therapeutic',
            'glucose value between',
            'consistent with prediabetes',
            'should be confirmed',
        ]

        for keyword in noise_keywords:
            if re.search(keyword, line_lower):
                return True

        # Skip very short lines
        if len(line) < 3:
            return True

        return False

    def extract_date_from_text(self, text: str) -> str:
        """
        Extract lab test date from Quest PDF text.

        Quest uses patterns like:
        - Collected: 06/12/2024 08:40
        - Received: 06/13/2024 04:30
        - Reported: 06/13/2024 09:03
        """
        from datetime import datetime

        # Quest-specific date patterns (prioritize collected > received > reported)
        date_patterns = [
            r'Collected:\s*(\d{2}/\d{2}/\d{4})',
            r'Received:\s*(\d{2}/\d{2}/\d{4})',
            r'Reported:\s*(\d{2}/\d{2}/\d{4})',
        ]

        for pattern in date_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                date_str = match.group(1)
                try:
                    date_obj = datetime.strptime(date_str, '%m/%d/%Y')
                    return date_obj.strftime('%Y-%m-%d')
                except ValueError:
                    continue

        # Fallback to base class method
        return super().extract_date_from_text(text)
