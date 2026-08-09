"""
Epic MyChart "Test Details" card/gauge PDF parser.

Handles the rich Epic MyChart export whose native text retains a card-based,
frequently two-column layout with visual gauge bars. Compared to the simple
single-column stream handled by ``EpicMyChartSingleColumnParser``, this format
adds several wrinkles that the single-column parser cannot handle:

- Two cards rendered side by side, so test names, "Normal range/value:" lines,
  and values are merged onto shared text lines.
- "Normal value:" anchors (qualitative or "Not Estab.") in addition to the
  numeric "Normal range:" anchors.
- Value and flag on one line (e.g. "9.9 High").
- Non-numeric values ("Negative", "None seen", "Trace", "3+", ">60").
- Gauge endpoint numbers rendered with every character doubled, e.g.
  "110000 220000" for the range 100 - 200, or "44..88 55..66" for 4.8 - 5.6.

To recover columns reliably this parser consumes layout-preserved text
(pdfplumber ``extract_text(layout=True)``) so horizontal positions survive as
whitespace. The column gutter is derived from the character position of the
second "Normal range/value:" anchor on two-column lines, which names and values
share. Single-column exports (no such lines) are parsed as one column.
"""

import re
from typing import List, Optional, Tuple

from app.core.logging.config import get_logger

from .base_parser import LabTestResult
from .epic_mychart_base_parser import EpicMyChartBaseParser

logger = get_logger(__name__, "app")


class EpicMyChartCardParser(EpicMyChartBaseParser):
    """Parser for the two-column Epic MyChart "Test Details" card layout."""

    LAB_NAME = "Epic MyChart"

    # This parser relies on retained column positions.
    prefers_layout_text = True

    # Matches the start of an anchor line ("Normal range:" / "Normal value:").
    _ANCHOR_RE = re.compile(r"(?i)normal (?:range|value):")

    # Anchor line with its trailing content captured (used per line in parsing).
    _ANCHOR_CAPTURE_RE = re.compile(r"(?i)\s*normal (?:range|value):\s*(.*)")

    # Whitespace / segmentation helpers used per line in the hot parse loop.
    _MULTISPACE_RE = re.compile(r"\s{2,}")
    _NAME_SPLIT_RE = re.compile(r"\s{3,}")

    # Numeric-line helpers for gauge detection and name validation.
    _NUMERIC_LINE_RE = re.compile(r"^[\d.]+$")
    _NUMBER_RE = re.compile(r"\d+\.?\d*")
    _DIGITS_ONLY_NAME_RE = re.compile(r"^[\d\s.]+$")
    _ALPHA_RE = re.compile(r"[A-Za-z]")

    # A value line: a number optionally followed by a flag word.
    _VALUE_FLAG_RE = re.compile(
        r"(?i)^(-?\d+\.?\d*)\s*(high|low|critical|abnormal|h|l)?$"
    )

    # An inequality value such as ">60" or "<5".
    _VALUE_INEQ_RE = re.compile(r"^[<>]=?\s*\d+\.?\d*$")

    # Recognised qualitative result tokens.
    _QUAL_RE = re.compile(
        r"(?i)^(negative|positive|detected|undetected|reactive|non-?reactive|"
        r"not detected|none seen|none|trace|few|normal|abnormal|\d\+|"
        r"<?\d+\s*-\s*\d+)$"
    )

    # Labels that sit between an anchor and its value; skipped, never a name.
    _STOP_LABELS = {"value", "results", "result"}

    # Substrings that mark a line as metadata/footer noise.
    _NOISE_SUBSTRINGS = (
        "mychart",
        "licensed from epic",
        "epic systems",
        "authorizing provider",
        "collection date",
        "collected on",
        "result date",
        "result status",
        "resulting lab",
        "ordering provider",
        "performed at",
        "test performed",
        "lab director",
        "specimens:",
        "specimen",
        "https://",
        "http://",
        "www.",
        "for specimens sent",
        "additional information",
        "enter test",
        "reference ranges",
        "risk category",
        "risk factor",
        "risk equivalent",
        "guidelines",
        "goals depend",
        "more complete",
        "definitions of",
        "prediabetes",
        "diabetes:",
        "glycemic",
        "moderately increased",
        "severely increased",
        "clia#",
        "all rights reserved",
        "copyright",
        "page ",
    )

    def can_parse(self, text: str) -> bool:
        """
        Detect the Epic MyChart "Test Details" card layout.

        Requires generic Epic indicators plus at least one signature specific to
        the card/gauge export, so single-column Epic text routes to the
        single-column parser instead.
        """
        if not text or not text.strip():
            return False

        if not self._looks_like_epic(text):
            return False

        return self._has_card_signature(text)

    def _looks_like_epic(self, text: str) -> bool:
        """Generic Epic MyChart indicators (mirrors the single-column parser)."""
        score = 0
        if re.search(r"(?i)licensed from epic systems corporation", text):
            score += 1
        if re.search(r"(?i)mychart", text):
            score += 1
        if re.search(r"(?i)collected on\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}", text):
            score += 1
        if self._ANCHOR_RE.search(text):
            score += 1
        if re.search(r"(?i)authorizing provider:", text):
            score += 1
        if re.search(r"(?i)result status:", text):
            score += 1
        return score >= 2

    def _has_card_signature(self, text: str) -> bool:
        """At least one signal unique to the card/gauge "Test Details" export."""
        # "Test Details" page header or the details URL.
        if re.search(r"(?i)mychart\s*-\s*test details", text):
            return True
        if re.search(r"(?i)/test-results/details", text):
            return True
        # "Normal value:" anchors (single-column parser only handles "range").
        if re.search(r"(?i)normal value:", text):
            return True
        for line in text.split("\n"):
            # Two anchors on one line => two-column layout.
            if len(self._ANCHOR_RE.findall(line)) >= 2:
                return True
            # A doubled-digit gauge line.
            if self._is_doubled_gauge(line.replace(" ", "")):
                return True
        return False

    def parse(self, text: str) -> List[LabTestResult]:
        """
        Parse Epic MyChart card results from layout-preserved text.

        Splits the page into columns, parses each column independently by
        anchoring on "Normal range/value:" lines, then deduplicates.
        """
        if not text or not text.strip():
            return []

        test_date = self.extract_date_from_text(text)
        if test_date:
            logger.info("Extracted test date from Epic MyChart card PDF")

        results: List[LabTestResult] = []
        for column in self._split_columns(text):
            results.extend(self._parse_column(column, test_date))

        results = self.deduplicate(results)
        logger.info(
            "Epic MyChart card parsing complete",
            extra={"component": "EpicMyChartCardParser", "test_count": len(results)},
        )
        return results

    # ------------------------------------------------------------------
    # Column reconstruction
    # ------------------------------------------------------------------

    def _find_gutter(self, lines: List[str]) -> Optional[int]:
        """
        Locate the column gutter as the smallest character index of a second
        anchor on any line. Returns None for single-column layouts.
        """
        candidates = []
        for line in lines:
            matches = list(self._ANCHOR_RE.finditer(line))
            if len(matches) >= 2:
                candidates.append(matches[1].start())
        return min(candidates) if candidates else None

    def _split_columns(self, layout_text: str) -> List[List[str]]:
        """
        Split layout text into columns of raw (un-collapsed) lines.

        Returns a single column when no gutter is detected.
        """
        lines = layout_text.split("\n")
        gutter = self._find_gutter(lines)
        if gutter is None:
            return [lines]
        left = [line[:gutter] for line in lines]
        right = [line[gutter:] for line in lines]
        return [left, right]

    # ------------------------------------------------------------------
    # Per-column card parsing
    # ------------------------------------------------------------------

    def _parse_column(
        self, lines: List[str], test_date: Optional[str]
    ) -> List[LabTestResult]:
        results = []
        for i, line in enumerate(lines):
            anchor = self._ANCHOR_CAPTURE_RE.match(line)
            if not anchor:
                continue

            ref_range, unit, low, high = self._parse_anchor(
                self._normspace(anchor.group(1))
            )

            test_name = self._find_name_before(lines, i)
            if not test_name:
                continue

            value, flag, qualitative = self._find_value_after(lines, i, low, high)
            if value is None and not qualitative:
                continue

            if value is not None and not flag:
                flag = self._compute_flag(value, ref_range, low, high)

            # Strip spurious trailing punctuation from names like "Monocytes:".
            clean_name = self.clean_test_name(test_name).rstrip(" :;,")

            results.append(
                LabTestResult(
                    test_name=clean_name,
                    value=value,
                    unit=unit,
                    reference_range=ref_range,
                    flag=flag,
                    confidence=0.9,
                    test_date=test_date,
                    qualitative_value=qualitative or "",
                )
            )
        return results

    def _find_name_before(self, lines: List[str], anchor_idx: int) -> Optional[str]:
        """Search upward from the anchor for the test name."""
        for offset in range(1, 5):
            idx = anchor_idx - offset
            if idx < 0:
                break
            raw = lines[idx]
            if not raw.strip():
                continue
            candidate = self._name_from_raw(raw)
            if self._ANCHOR_RE.search(candidate):
                break
            if candidate.lower() in self._STOP_LABELS:
                continue
            if self._is_noise(candidate):
                continue
            if self._is_valid_name(candidate):
                return candidate
        return None

    def _find_value_after(
        self,
        lines: List[str],
        anchor_idx: int,
        low: Optional[float],
        high: Optional[float],
    ) -> Tuple[Optional[float], str, Optional[str]]:
        """
        Search downward from the anchor for the value.

        Returns (numeric_value, flag, qualitative_value). Stops only at the next
        card's anchor so qualitative values (which resemble names) are not
        mistaken for the following test.
        """
        for offset in range(1, 8):
            idx = anchor_idx + offset
            if idx >= len(lines):
                break
            candidate = self._normspace(lines[idx])
            if not candidate:
                continue
            if self._ANCHOR_RE.search(candidate):
                break
            if candidate.lower() in self._STOP_LABELS:
                continue
            if self._is_gauge(candidate, low, high):
                continue

            value_flag = self._VALUE_FLAG_RE.match(candidate)
            if value_flag:
                try:
                    value = float(value_flag.group(1))
                except ValueError:
                    continue
                flag = value_flag.group(2).capitalize() if value_flag.group(2) else ""
                return value, flag, None

            if self._VALUE_INEQ_RE.match(candidate):
                return None, "", candidate.replace(" ", "")

            if self._QUAL_RE.match(candidate):
                return None, "", candidate

        return None, "", None

    # ------------------------------------------------------------------
    # Anchor / value helpers
    # ------------------------------------------------------------------

    def _parse_anchor(
        self, content: str
    ) -> Tuple[str, str, Optional[float], Optional[float]]:
        """
        Parse the text after "Normal range/value:" into
        (reference_range, unit, low_bound, high_bound).
        """
        content = content.strip()
        if not content:
            return ("", "", None, None)

        # "Not Estab." (no numeric range; value follows separately).
        not_estab = re.match(r"(?i)not\s+estab\.?\s*(.*)", content)
        if not_estab:
            return ("Not Estab.", not_estab.group(1).strip(), None, None)

        # "above >=N unit".
        above = re.match(r"(?i)above\s*>=?\s*(\d+\.?\d*)\s*(.*)", content)
        if above:
            return (f">={above.group(1)}", above.group(2).strip(), None, None)

        # "<N unit" or ">N unit".
        ineq = re.match(r"([<>]=?\s*\d+\.?\d*)\s*(.*)", content)
        if ineq:
            return (ineq.group(1).replace(" ", ""), ineq.group(2).strip(), None, None)

        # "X - Y unit" (the common numeric range).
        rng = re.match(r"(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*(.*)", content)
        if rng:
            low, high = float(rng.group(1)), float(rng.group(2))
            return (f"{rng.group(1)} - {rng.group(2)}", rng.group(3).strip(), low, high)

        # Qualitative expected value (e.g. "Negative", "None seen/Few").
        return (content, "", None, None)

    def _compute_flag(
        self, value: float, ref_range: str, low: Optional[float], high: Optional[float]
    ) -> str:
        """Derive a High/Low flag from the value and reference range."""
        gte = re.match(r">=?\s*(\d+\.?\d*)", ref_range)
        if gte:
            return "Low" if value < float(gte.group(1)) else ""
        lte = re.match(r"<=?\s*(\d+\.?\d*)", ref_range)
        if lte:
            return "High" if value > float(lte.group(1)) else ""
        if low is not None and high is not None:
            if value < low:
                return "Low"
            if value > high:
                return "High"
        return ""

    # ------------------------------------------------------------------
    # Gauge-artifact detection
    # ------------------------------------------------------------------

    def _is_doubled_gauge(self, compact: str) -> bool:
        """True if a space-free line is a doubled-digit gauge (all chars paired).

        e.g. "110000220000" (range 100 - 200) or "44..8855..66" (4.8 - 5.6).
        """
        if len(compact) < 4 or len(compact) % 2 != 0:
            return False
        if not self._NUMERIC_LINE_RE.match(compact):
            return False
        return all(compact[i] == compact[i + 1] for i in range(0, len(compact), 2))

    def _is_gauge(self, line: str, low: Optional[float], high: Optional[float]) -> bool:
        """
        True if the line is a gauge endpoint rendering rather than a value.

        Recognises the doubled-digit form and the plain "low high" form
        (single-column exports, whose two numbers match the range bounds).
        """
        compact = line.replace(" ", "")
        if not compact or not self._NUMERIC_LINE_RE.match(compact):
            return False

        if self._is_doubled_gauge(compact):
            return True

        if low is not None and high is not None:
            nums = [float(n) for n in self._NUMBER_RE.findall(line)]
            if (
                len(nums) >= 2
                and self._approx(nums[0], low)
                and self._approx(nums[-1], high)
            ):
                return True
        return False

    @staticmethod
    def _approx(a: float, b: float, tolerance: float = 0.05) -> bool:
        return abs(a - b) < tolerance

    # ------------------------------------------------------------------
    # Text helpers
    # ------------------------------------------------------------------

    def _normspace(self, text: str) -> str:
        """Collapse runs of whitespace to single spaces and strip."""
        return self._MULTISPACE_RE.sub(" ", text).strip()

    def _name_from_raw(self, raw: str) -> str:
        """
        Return the left-most segment of a raw layout line as a name.

        When two column names share a line but no anchor gutter is available,
        the wide gap between them separates the segments; keeping the first
        avoids fusing two names.
        """
        segment = self._NAME_SPLIT_RE.split(raw.strip())[0]
        return self._normspace(segment)

    def _is_valid_name(self, name: str) -> bool:
        """Validate a candidate test name."""
        if not name or len(name) < 2 or len(name) > 80:
            return False
        if not name[0].isalpha():
            return False
        if not self._ALPHA_RE.search(name):
            return False
        if self._DIGITS_ONLY_NAME_RE.match(name):
            return False
        if self._is_noise(name):
            return False
        return True

    def _is_noise(self, line: str) -> bool:
        """True if the line is metadata/footer noise."""
        if not line or len(line.strip()) < 2:
            return True
        lowered = line.lower()
        return any(sub in lowered for sub in self._NOISE_SUBSTRINGS)
