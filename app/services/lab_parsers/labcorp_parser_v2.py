"""
LabCorp-specific PDF parser - Version 2
Better handling of LabCorp's actual table format from pdfplumber extraction.
"""

import re
from typing import List, Optional
from .base_parser import BaseLabParser, LabTestResult
from app.core.logging.config import get_logger

logger = get_logger(__name__, "app")


class LabCorpParserV2(BaseLabParser):
    """Improved parser for LabCorp lab results."""

    LAB_NAME = "LabCorp"

    def can_parse(self, text: str) -> bool:
        """Detect LabCorp format by looking for signature elements."""
        indicators = [
            r'Laboratory Corporation of America',
            r'©\d{4} Laboratory Corporation',
            r'labcorp',
            r'Date Created and Stored.*Final Report'
        ]

        return any(re.search(pattern, text, re.IGNORECASE) for pattern in indicators)

    def parse(self, text: str) -> List[LabTestResult]:
        """
        Parse LabCorp results using pattern matching.

        LabCorp lines look like:
        TestName 01 5.4 5.6 05/13/2022 x10E3/uL 3.4-10.8

        Pattern: TestName [01/02/etc] CurrentValue [Flag] PreviousValue Date Unit RefRange
        """
        results = []
        lines = text.split('\n')

        # Extract date from PDF header (applies to all tests)
        test_date = self.extract_date_from_text(text)
        if test_date:
            logger.info(f"📅 Extracted test date: {test_date}")
        else:
            logger.warning("⚠️  No test date found in PDF")

        logger.info("="*80)
        logger.info("LABCORP PARSER V2 - PROCESSING LINES")
        logger.info("="*80)

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Try to parse this line
            result = self._parse_line(line, test_date=test_date)
            if result:
                logger.info(f"✓ PARSED: {result.test_name} = {result.value} {result.unit}")
                results.append(result)
            else:
                logger.info(f"✗ SKIPPED: {line[:80]}")

        logger.info("="*80)
        logger.info(f"TOTAL PARSED: {len(results)} components")
        logger.info("="*80)

        return results

    def _parse_line(self, line: str, test_date: str = None) -> Optional[LabTestResult]:
        """
        Parse a single line looking for lab result pattern.

        Pattern: TestName [superscript] Value [Flag] ... Unit ... Range
        """
        # Skip obvious noise first
        if self._is_noise(line):
            return None

        # Pattern to match lab results:
        # Group 1: Test name (letters, spaces, commas, parentheses, slashes, hyphens, NUMBERS for B12, etc.)
        # Group 2: Optional superscript (01, 02, 03, etc.)
        # Group 3: Numeric value (can have decimal)
        # Group 4: Optional flag (High, Low, etc.)
        # Rest: previous results, unit, range (we'll extract separately)

        # Try pattern WITH superscript first (more specific)
        # Allow % at start for tests like "% Free Testosterone"
        pattern_with_super = r'^([\%A-Za-z][A-Za-z0-9\s,\(\)/\-\%]+?)\s+(\d{2})\s+(\d+\.?\d*)\s*(High|Low|Critical|H|L)?\s+'
        match = re.match(pattern_with_super, line)

        # If no match, try pattern WITHOUT superscript
        if not match:
            pattern_no_super = r'^([A-Za-z][A-Za-z0-9\s,\(\)/\-\%]+?)\s+(\d+\.?\d*)\s+(High|Low|Critical|H|L)?\s*(\d+\.?\d*)\s+'
            match = re.match(pattern_no_super, line)
            if match:
                # Reorder groups to match expected structure (name, None, value, flag)
                # In this pattern: group1=name, group2=value, group3=flag, group4=previous_value
                # We need to pretend group2 is the superscript (None) and group2 is value
                test_name = match.group(1).strip()
                value_str = match.group(2)
                flag = match.group(3) or ""

                # Validate and create result with adjusted groups
                if not self._is_valid_test_name(test_name):
                    return None

                try:
                    value = float(value_str)
                except ValueError:
                    return None

                remainder = line[match.end():].strip()
                unit = self._extract_unit(remainder)
                ref_range = self._extract_range(remainder)

                return LabTestResult(
                    test_name=test_name,
                    value=value,
                    unit=unit,
                    reference_range=ref_range,
                    flag=flag,
                    confidence=0.9,  # Slightly lower confidence without superscript
                    test_date=test_date
                )

        if not match:
            return None

        test_name = match.group(1).strip()
        value_str = match.group(3)
        flag = match.group(4) or ""

        # Validate test name - reject if it's likely not a real test
        if not self._is_valid_test_name(test_name):
            return None

        # Parse value
        try:
            value = float(value_str)
        except ValueError:
            return None

        # Extract unit and reference range from the rest of the line
        remainder = line[match.end():].strip()

        unit = self._extract_unit(remainder)
        ref_range = self._extract_range(remainder)

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

        LabCorp format: "Value PreviousValue Date Unit RefRange"
        Example: "391 373 05/13/2022 ng/dL 264-916"

        Strategy: Look for unit after the date pattern but before reference range.
        """
        # Try to extract the unit between date and reference range
        # Pattern: after date (MM/DD/YYYY), look for unit
        date_pattern = r'\d{2}/\d{2}/\d{4}\s+'
        match = re.search(date_pattern, text)

        if match:
            # Get text after the date
            after_date = text[match.end():].strip()

            # Unit should be at the start of this text, before the reference range
            # Common unit patterns - ORDER MATTERS (most specific first)
            unit_patterns = [
                r'^(x10E\d+/[µu]L)',           # x10E3/uL, x10E6/uL
                r'^(mL/min/[\d\.]+)',          # mL/min/1.73
                r'^(ng/dL)',                   # ng/dL
                r'^(pg/mL)',                   # pg/mL
                r'^(ng/mL)',                   # ng/mL
                r'^(mg/dL)',                   # mg/dL
                r'^(mmol/L)',                  # mmol/L
                r'^(mEq/L)',                   # mEq/L
                r'^(g/dL)',                    # g/dL
                r'^(IU/L)',                    # IU/L
                r'^(U/L)',                     # U/L
                r'^(fL)',                      # fL
                r'^(pg)\s',                    # pg (with space after)
                r'^(ratio)\b',                 # ratio (word boundary)
                r'^(%)',                       # %
            ]

            for pattern in unit_patterns:
                unit_match = re.search(pattern, after_date, re.IGNORECASE)
                if unit_match:
                    return unit_match.group(1)

        # Fallback: search anywhere in text (old behavior)
        unit_patterns_fallback = [
            r'(x10E\d+/[µu]L)',
            r'(ng/dL)',
            r'(pg/mL)',
            r'(ng/mL)',
            r'(mg/dL)',
            r'(mmol/L)',
            r'(mEq/L)',
            r'(g/dL)',
            r'(IU/L)',
            r'(U/L)',
            r'(fL)',
            r'(pg)(?!\s*/)',
            r'\b(ratio)\b',
            r'(%)',
        ]

        for pattern in unit_patterns_fallback:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1)

        return ""

    def _extract_range(self, text: str) -> str:
        """Extract reference range from text."""
        # Patterns: "3.4-10.8", ">39", "<5", "Not Estab."
        range_patterns = [
            r'(\d+\.?\d*\s*-\s*\d+\.?\d*)',  # "3.4-10.8"
            r'([><≤≥]\s*\d+\.?\d*)',  # ">39"
            r'(Not\s+Estab\.?)',  # "Not Estab."
        ]

        for pattern in range_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()

        return ""

    def _is_valid_test_name(self, name: str) -> bool:
        """
        Validate that a test name looks legitimate.
        Reject single words, common section headers, and descriptive phrases.
        """
        name_lower = name.lower().strip()

        # Reject common false positives
        invalid_names = [
            'interpretation', 'note', 'pdf', 'the', 'a', 'an', 'and', 'or',
            'for', 'with', 'this', 'that', 'from', 'by', 'at', 'in',
            'performing lab', 'performing', 'lab', 'labs', 'value',
            'optimal', 'reference', 'range', 'test', 'result',
            'men', 'women', 'avg.risk', 'avg risk',
        ]

        if name_lower in invalid_names:
            return False

        # Reject if starts with common articles/prepositions (likely descriptive text)
        if re.match(r'^(a|an|the|for|with|this|that)\s+', name_lower):
            return False

        # Reject if it's too long (likely a sentence fragment)
        if len(name) > 60:
            return False

        # Require at least one letter (catches pure numbers)
        if not re.search(r'[A-Za-z]', name):
            return False

        return True

    def _is_noise(self, line: str) -> bool:
        """Quick check if line is obvious noise."""
        line_lower = line.lower()

        noise_keywords = [
            'patient', 'specimen', 'date collected', 'ordering physician',
            'test.*current result', 'reference interval',
            'cbc with differential', 'metabolic panel', 'lipid panel',
            'final report', 'page \\d+ of', 'labcorp', 'enterprise report',
            'all rights reserved', 'confidential', 'pmid', 'et\\.?\\s*al',
            'please note', 'disclaimer', 'reference range:', 'adult males',
            'this test was', 'fda', 'supplemental report', 'performing labs',
            'for inquiries', r'\d{2}:\s*[A-Z]{2}\s*-',  # "01: BN -"
            'date created', 'date stored', 'travison', 'jcem',
            'nonobese males', 'bmi\\s*[<>]',
            # Section headers (not test names)
            r'^interpretation\s+\d{2}',
            r'^note\s+\d{2}',
            r'^pdf\s+\d{2}',
            'performing\\s+lab',
            # Explanatory text
            'psa\\s+value.*between',
            'serum\\s+folate\\s+concentration',
            'optimal.*range',
            'a\\s+serum\\s+',
            'the\\s+reference\\s+',
        ]

        for keyword in noise_keywords:
            if re.search(keyword, line_lower):
                return True

        # Skip very short lines
        if len(line) < 5:
            return True

        # Skip lines with no numbers
        if not re.search(r'\d', line):
            return True

        return False
