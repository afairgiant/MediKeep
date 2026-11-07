"""
Synlab-specific PDF parser.

Handles the German Synlab "Labor-Bericht" layout, a table with the columns
``Test | Beschreibung | +/- | Ergebnis | Einheit | Normalwert``. pdfplumber
yields one result per line, for example::

    GPT GPT (ALT) + 55.0 U/l <50.0
    LEUK Leukozyten 6.40 10^9/l 3.90-10.2
    CRP C-reak.Protein <0.15 mg/dl <0.50

The first token is Synlab's internal test code, which is far more stable
across report versions than the German description, so it is used to map
each result to the English canonical test name from the test library. Tests
with an unknown code fall back to matching the German description, and then
to the description itself.

Values and units are kept as reported. Unit spellings are normalized so the
Bulk Entry parser recognizes them (e.g. ``10^9/l`` -> ``K/uL``, which is the
same quantity). The only numeric change is cell counts reported per
microliter, which are scaled to K/uL.
"""

import re
from typing import Dict, List, Optional, Tuple

from app.core.constants import LAB_TEST_COMPONENT_LIMITS
from app.core.logging.config import get_logger
from app.core.logging.constants import LogFields

from .base_parser import BaseLabParser, LabTestResult

logger = get_logger(__name__, "app")


# Synlab test code -> canonical test name (shared/data/test_library.json).
CODE_TO_TEST: Dict[str, str] = {
    # Blood count
    "LEUK": "White Blood Cell Count",
    "LEU": "White Blood Cell Count",
    "ERY": "Red Blood Cell Count",
    "HB": "Hemoglobin",
    "HK": "Hematocrit",
    "HT": "Hematocrit",
    "MCV": "Mean Corpuscular Volume",
    "MCH": "Mean Corpuscular Hemoglobin",
    "MCHC": "Mean Corpuscular Hemoglobin Concentration",
    "THROM": "Platelet Count",
    "THR": "Platelet Count",
    "ERYVB": "Red Cell Distribution Width",
    "RDW": "Red Cell Distribution Width",
    "MPV": "Mean Platelet Volume",
    "BSG": "Erythrocyte Sedimentation Rate",
    # Liver, pancreas, muscle
    "GOT": "Aspartate Aminotransferase",
    "GPT": "Alanine Aminotransferase",
    "GGT": "Gamma-glutamyl Transferase",
    "AP": "Alkaline Phosphatase",
    "BIL": "Total Bilirubin",
    "LDH": "Lactate Dehydrogenase",
    "CK": "Creatine Kinase",
    "LIP": "Lipase",
    # Glucose and lipids
    "GLUN": "Glucose",
    "GLS": "Glucose",
    "HBA1C": "Hemoglobin A1c",
    "CHOL": "Total Cholesterol",
    "CHO": "Total Cholesterol",
    "TRI": "Triglycerides",
    "NEF": "Triglycerides",
    "HDL": "HDL Cholesterol",
    "LDL": "LDL Cholesterol",
    "LDLD": "LDL Cholesterol",
    "NHDL": "Non-HDL Cholesterol",
    "LDLHDL": "LDL/HDL Ratio",
    "CHQ": "Total Cholesterol/HDL Ratio",
    # Kidney
    "KREA": "Creatinine",
    "KRE": "Creatinine",
    "CKDEPI": "Estimated GFR",
    "GFRKM": "Estimated GFR",
    "GFRKW": "Estimated GFR",
    "HS": "Uric Acid",
    "HAS": "Uric Acid",
    "HST": "Urea",
    # Electrolytes and minerals
    "CA": "Calcium",
    "K": "Potassium",
    "NA": "Sodium",
    "CL": "Chloride",
    "MG": "Magnesium",
    # Iron and vitamins
    "FE": "Iron",
    "FERR": "Ferritin",
    "TRF": "Transferrin",
    "VITB12": "Vitamin B12",
    "B12": "Vitamin B12",
    "FOLS": "Folate (Folic Acid)",
    "FOLM": "Folate (Folic Acid)",
    "VITDE": "Vitamin D",
    "VITDL": "Vitamin D",
    # Thyroid
    "TSH": "Thyroid Stimulating Hormone",
    "TSHM": "Thyroid Stimulating Hormone",
    "FT3": "Free T3",
    "FT3M": "Free T3",
    "FT4": "Free T4",
    "FT4M": "Free T4",
    # Inflammation, serology, autoantibodies
    "CRP": "C-Reactive Protein",
    "HBS": "Hepatitis B Surface Antigen",
    "HEPC": "Hepatitis C Antibody",
    "AKBELE": "Parietal Cell Antibody",
    "AKIN": "Intrinsic Factor Antibody",
}

# Descriptions more specific than the test code ("BIL Bilirubin direkt").
SPECIFIC_TO_TEST: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"LDL/HDL", re.IGNORECASE), "LDL/HDL Ratio"),
    (re.compile(r"chol\.?/HDL", re.IGNORECASE), "Total Cholesterol/HDL Ratio"),
    (
        re.compile(r"bilirubin.*\bdirekt|\bdirekt.*bilirubin", re.IGNORECASE),
        "Direct Bilirubin",
    ),
]

# Tests that name a blood analyte but measure something else. They keep their
# own name rather than landing on that analyte's trend, even if Synlab reuses
# the analyte's code ("LEU Leukozyten im Urin").
_OTHER_SPECIMEN_RE = re.compile(
    r"clearance|urin\b|\bim harn\b|\bi\.\s?U\b|\bindirekt", re.IGNORECASE
)
# The same for descriptions with an unknown code. A known code wins here, as the
# description may only be a variant ("CHQ Quotient").
_RELATED_TEST_RE = re.compile(r"quotient|rezeptor|glyko|\b1[,.]25\b", re.IGNORECASE)

# German description -> canonical name, for codes not listed above.
# Checked in order, so more specific patterns come first.
DESCRIPTION_TO_TEST: List[Tuple[re.Pattern, str]] = [
    (re.compile(p, re.IGNORECASE), name)
    for p, name in [
        (r"leukozyten", "White Blood Cell Count"),
        (r"erythrozyten.*verteilung|\bRDW\b", "Red Cell Distribution Width"),
        (r"erythrozyten", "Red Blood Cell Count"),
        (r"h[äa]moglobin(?!.*a1c)", "Hemoglobin"),
        (r"h[äa]matokrit", "Hematocrit"),
        (r"thrombozyten", "Platelet Count"),
        (r"alkalische phosphatase", "Alkaline Phosphatase"),
        (r"bilirubin", "Total Bilirubin"),
        (r"\bGOT\b|\bAST\b", "Aspartate Aminotransferase"),
        (r"\bGPT\b|\bALT\b", "Alanine Aminotransferase"),
        (r"g-?GT|gamma-?GT", "Gamma-glutamyl Transferase"),
        (r"hba1c", "Hemoglobin A1c"),
        (r"gluc?kose|glucose", "Glucose"),
        (r"non-?HDL", "Non-HDL Cholesterol"),
        (r"\bHDL", "HDL Cholesterol"),
        (r"\bLDL", "LDL Cholesterol"),
        (r"cholesterin", "Total Cholesterol"),
        (r"triglyceride", "Triglycerides"),
        (r"kreatinin", "Creatinine"),
        (r"\bGFR\b", "Estimated GFR"),
        (r"harns[äa]ure", "Uric Acid"),
        (r"harnstoff", "Urea"),
        (r"calcium|kalzium", "Calcium"),
        (r"kalium", "Potassium"),
        (r"natrium", "Sodium"),
        (r"chlorid", "Chloride"),
        (r"magnesium", "Magnesium"),
        (r"ferritin", "Ferritin"),
        (r"transferrin(?!s[äa]tt)", "Transferrin"),
        (r"\beisen\b", "Iron"),
        (r"vitamin b ?12", "Vitamin B12"),
        (r"fols[äa]ure", "Folate (Folic Acid)"),
        (r"vitamin d|25-OH", "Vitamin D"),
        (r"freies T3", "Free T3"),
        (r"freies T4", "Free T4"),
        (r"\bTSH\b", "Thyroid Stimulating Hormone"),
        (r"\bCRP\b|c-reak", "C-Reactive Protein"),
        (r"HBs-?Antigen|HBsAg", "Hepatitis B Surface Antigen"),
        (r"anti-?HCV", "Hepatitis C Antibody"),
        (r"parietal", "Parietal Cell Antibody"),
        (r"intrinsic", "Intrinsic Factor Antibody"),
    ]
]

# Differential counts come as a percentage or an absolute count with the
# same German name; the unit decides which canonical test applies. Only used
# for codes missing from CODE_TO_TEST. Band cells ("stabkernige") are listed
# before the generic pattern so they don't collapse into Neutrophils;
# segmented ("segmentkernige") neutrophils are the mature neutrophils.
DIFFERENTIAL = [
    (re.compile(r"stabkernig", re.I), "Band form Neutrophils"),
    (re.compile(r"neutrophile", re.I), "Neutrophils"),
    (re.compile(r"lymphozyten", re.I), "Lymphocytes"),
    (re.compile(r"monozyten", re.I), "Monocytes"),
    (re.compile(r"eosinophile", re.I), "Eosinophils"),
    (re.compile(r"basophile", re.I), "Basophils"),
]

# Panel headers that carry no result of their own.
PANEL_CODES = {"KBBX", "KBBM", "GBBX", "GBBM", "HEPSC", "AKMA", "DIFF"}

QUALITATIVE = {
    "negativ": "Negative",
    "positiv": "Positive",
    "nicht nachweisbar": "Not Detected",
    "nachweisbar": "Detected",
}

_NUM = r"\d+(?:[.,]\d+)?"
# Qualitative words match in any case ("Negativ"); the code group in the row
# pattern stays uppercase-only so prose lines are not taken for results.
_VALUE = (
    rf"(?:[<>]\s?{_NUM}|-?{_NUM}|(?i:nicht nachweisbar|nachweisbar|negativ|positiv))"
)
_RANGE = rf"(?:[<>]=?\s*{_NUM}|-?{_NUM}\s*[-–]\s*-?{_NUM})"
# A unit never starts with a digit (except powers of ten such as "10^9/l")
# and never contains a colon, which marks a labelled range.
_UNIT = r"(?:10\^\d+/\S+|[^\s\d<>+\-:][^\s:]*)"
# Range column: a plain range, or a labelled tier ("optimal: < 100",
# "Empfohlene Spiegel:") whose other tiers follow on the next lines.
_RANGE_COL = rf"(?:{_RANGE}|[A-Za-zÄÖÜäöü][^:\d]*:.*)"
_TAIL = rf"(?:\s+(?P<unit>{_UNIT}))?(?:\s+(?P<range>{_RANGE_COL}))?\s*$"

# CODE  description  [+|-]  value  [unit]  [range]
_ROW_RE = re.compile(
    rf"^(?P<code>[A-Z][A-Z0-9]{{0,7}})\.?\s+"
    rf"(?P<desc>.*?)\s+"
    rf"(?:(?P<flag>\+\+?|--?)\s+)?"
    rf"(?P<value>{_VALUE})" + _TAIL,
)
# The same row with any text in the range column ("3.5 bis 5.1", "≤ 5.1"), for
# when _ROW_RE only matches by taking a later number or word as the value.
_ROW_ANY_RANGE_RE = re.compile(
    rf"^(?P<code>[A-Z][A-Z0-9]{{0,7}})\.?\s+"
    rf"(?P<desc>.*?)\s+"
    rf"(?:(?P<flag>\+\+?|--?)\s+)?"
    rf"(?P<value>{_VALUE})\s+(?P<unit>{_UNIT})\s+(?P<range>\S.*)$"
)
# Unit and range on the row, and only the value on the next line:
# "CRP CRP quantitativ mg/dl < 0.5" followed by "< 0.1".
_ROW_VALUE_BELOW_RE = re.compile(
    rf"^(?P<code>[A-Z][A-Z0-9]{{0,7}})\.?\s+(?P<desc>.*?)\s+"
    rf"(?P<unit>[^\s\d<>+\-:]*/[^\s:]*)\s+(?P<range>{_RANGE})\s*$"
)
_VALUE_ALONE_RE = re.compile(
    rf"^(?:(?P<flag>\+\+?|--?)\s+)?(?P<value>{_VALUE})\s*$", re.IGNORECASE
)
# A test whose value is printed on the following line ("HBS. HBs-Antigen").
# The description may hold digits ("Vitamin B12") but no colon, which marks a
# hint or a labelled range ("ESC 2019: LDL").
_ROW_NO_VALUE_RE = re.compile(r"^(?P<code>[A-Z][A-Z0-9]{0,7})\.?\s+(?P<desc>[^:]+)$")
_VALUE_ONLY_RE = re.compile(
    rf"^(?:(?P<flag>\+\+?|--?)\s+)?(?P<value>{_VALUE})" + _TAIL, re.IGNORECASE
)
# A continuation of a tiered range: an optional label, then the range and perhaps
# more text ("fast optimal: 100 - 129", "gesamt 20 - 70 bei Jüngeren", "< 10 Mangel").
_TIER_RE = re.compile(rf"^(?:[A-Za-zÄÖÜäöü][^:\d]*:?\s*)?{_RANGE}(?:\s+.*)?$")
_HINT_RE = re.compile(r"^Hinweis", re.IGNORECASE)
_DATE_RE = re.compile(r"Bericht(?:\s+\d+)?\s+vom\s+(\d{2})\.(\d{2})\.(\d{4})")
_SKIP_RE = re.compile(
    r"^(Seite \d|Laborwerte von|Labor-Bericht|LG-Bericht|Synlab$|Test\s+Beschreibung|"
    r"Tel\.|E-Mail|Hinweis)",
    re.IGNORECASE,
)

# Unit spellings -> what the Bulk Entry parser understands.
# (unit, factor) where factor scales the value and the range.
_UNITS: Dict[str, Tuple[str, float]] = {
    "10^9/l": ("K/uL", 1),
    "giga/l": ("K/uL", 1),
    "/nl": ("K/uL", 1),
    "n/µl": ("K/uL", 0.001),
    "/µl": ("K/uL", 0.001),
    "10^3/µl": ("K/uL", 1),
    "10^3/ul": ("K/uL", 1),
    "10^6/µl": ("M/uL", 1),
    "10^6/ul": ("M/uL", 1),
    "10^12/l": ("M/uL", 1),
    "tera/l": ("M/uL", 1),
    "mio./µl": ("M/uL", 1),
    "mio/µl": ("M/uL", 1),
    "/pl": ("M/uL", 1),
    "g/dl": ("g/dL", 1),
    "mg/dl": ("mg/dL", 1),
    "µg/dl": ("ug/dL", 1),
    "ng/dl": ("ng/dL", 1),
    "u/l": ("U/L", 1),
    "u/ml": ("U/mL", 1),
    "fl": ("fL", 1),
    "mmol/l": ("mmol/L", 1),
    "µmol/l": ("umol/L", 1),
    "nmol/l": ("nmol/L", 1),
    "pmol/l": ("pmol/L", 1),
    "ng/ml": ("ng/mL", 1),
    "pg/ml": ("pg/mL", 1),
    "µg/l": ("ug/L", 1),
    "mg/l": ("mg/L", 1),
    "mu/l": ("mIU/L", 1),
    "µu/ml": ("mIU/L", 1),
    "µiu/ml": ("mIU/L", 1),
    "ka": ("ratio", 1),
    "mm/h": ("mm/hr", 1),
    "ml/min": ("mL/min", 1),
}

# Units without a "/" that may stand before a labelled range, besides _UNITS.
_BARE_UNITS = {"pg"}


def _first_match(patterns: List[Tuple[re.Pattern, str]], text: str) -> Optional[str]:
    """Return the name of the first pattern found in ``text``."""
    return next((name for pattern, name in patterns if pattern.search(text)), None)


def _looks_like_unit(word: str) -> bool:
    """True for a word that is a unit rather than part of a label or a name."""
    key = word.replace("μ", "µ").lower()
    return any(c in key for c in "/%^") or key in _UNITS or key in _BARE_UNITS


class SynlabParser(BaseLabParser):
    """Parser for Synlab (Germany) lab reports."""

    LAB_NAME = "Synlab"

    _HEADER_RE = re.compile(
        r"Test\s+Beschreibung\s+\+/-\s+Ergebnis\s+Einheit\s+Normalwert", re.IGNORECASE
    )

    def can_parse(self, text: str) -> bool:
        """Synlab reports name the lab and carry the German results header."""
        return bool(
            re.search(r"\bsynlab\b", text, re.IGNORECASE)
            and self._HEADER_RE.search(text)
        )

    def parse(self, text: str) -> List[LabTestResult]:
        """Parse every result row of a Synlab report.

        Rows look like ``CODE description [+|-] value [unit] [range]``. A test
        whose value sits on the following line is joined with that line, and
        a labelled, tiered range is joined with its continuation lines.
        """
        test_date = self.extract_date_from_text(text)
        lines = [line.strip() for line in text.split("\n")]
        results: List[LabTestResult] = []
        # Page breaks can repeat the last row of a page verbatim. Skip exact
        # repeats of a source row only: different tests that map to the same
        # canonical name (e.g. CKD-EPI and MDRD eGFR) must both be kept.
        # Maps each source row to the index of its result (None if no result).
        seen_rows: Dict[object, Optional[int]] = {}

        in_hint_block = False
        i = 0
        while i < len(lines):
            line = lines[i]
            i += 1
            if not line:
                continue
            if _HINT_RE.match(line):
                in_hint_block = True
                continue
            if in_hint_block:
                next_line = lines[i] if i < len(lines) else ""
                if not self._ends_hint_block(line, next_line):
                    continue
                in_hint_block = False
            if _SKIP_RE.match(line):
                continue

            fields, row_key, i = self._read_row(line, lines, i)
            if fields is None:
                continue
            # Collect the tiers before the duplicate check: when a page break
            # splits a tiered row, the repeated row is followed by the tiers
            # the first copy did not reach.
            tiers, i = self._read_tiers(fields, lines, i)
            if row_key in seen_rows:
                self._merge_tiers(results, seen_rows[row_key], tiers)
                continue
            if tiers:
                fields["tiers"] = self._join_tiers(tiers)

            result = self._build(fields, test_date)
            seen_rows[row_key] = len(results) if result else None
            if result:
                results.append(result)

        logger.info(
            "synlab_parse_completed",
            extra={
                LogFields.CATEGORY: "app",
                LogFields.EVENT: "synlab_parse_completed",
                LogFields.COUNT: len(results),
            },
        )
        return results

    def extract_date_from_text(self, text: str) -> Optional[str]:
        """Synlab prints 'Labor-Bericht <nr> vom DD.MM.YYYY'."""
        match = _DATE_RE.search(text)
        if match:
            day, month, year = match.groups()
            return f"{year}-{month}-{day}"
        return super().extract_date_from_text(text)

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _match_row(line: str) -> Optional[re.Match]:
        """Match a result row, reading the first measurement as its value.

        Without a range _ROW_RE knows, it can only match by moving the measured
        value into the description, which then reports a number from the range
        column as the result. Vitamin B 12 has a number in its name, so the
        earlier match only counts if it really is a value with a unit.
        """
        row = _ROW_RE.match(line)
        any_range = _ROW_ANY_RANGE_RE.match(line)
        if not any_range or (row and len(row["desc"]) <= len(any_range["desc"])):
            return row
        hides_a_word = row and row["value"].lower() in QUALITATIVE
        if hides_a_word or _looks_like_unit(any_range["unit"]):
            return any_range
        return row

    @staticmethod
    def _match_value_below(line: str, next_line: str) -> Optional[Dict]:
        """Return the columns of a row whose next line holds only the value."""
        row = _ROW_VALUE_BELOW_RE.match(line)
        value = _VALUE_ALONE_RE.match(next_line)
        return {**row.groupdict(), **value.groupdict()} if row and value else None

    def _ends_hint_block(self, line: str, next_line: str) -> bool:
        """True if a line after a "Hinweise" line is a real row again.

        Hint text can look like a row ("CV Risiko Zielwert < 116"), so a row only
        ends the block if it looks like a result rather than a target value.
        """
        if _SKIP_RE.match(line) or self._match_value_below(line, next_line):
            return True
        row = self._match_row(line)
        if row and not self._number_is_part_of_name(row, next_line):
            return self._row_is_a_result(row)
        pending = self._match_row_without_value(line)
        if not pending:
            return False
        if pending.group("code") in PANEL_CODES:
            return True
        nxt = _VALUE_ONLY_RE.match(next_line)
        return nxt is not None and bool(
            nxt.group("unit") or nxt.group("value").lower() in QUALITATIVE
        )

    @staticmethod
    def _row_is_a_result(row: re.Match) -> bool:
        """Tell a result row from a target value in hint text."""
        code, value, desc = row.group("code"), row.group("value"), row.group("desc")
        if code in PANEL_CODES or value.lower() in QUALITATIVE:
            return True
        if ":" in desc or "ziel" in desc.lower() or not re.search(r"[^\W\d]", desc):
            return False
        if value[0] in "<>":
            return bool(row.group("unit") and row.group("range"))
        return bool(code in CODE_TO_TEST or row.group("unit") or row.group("range"))

    def _read_row(
        self, line: str, lines: List[str], i: int
    ) -> Tuple[Optional[Dict], object, int]:
        """Return the columns of the row at ``line``, its key and the next index.

        ``lines[i]`` is the line after ``line``. A row whose value is printed on
        that line uses both lines. The columns are None if this is not a result.
        """
        next_line = lines[i] if i < len(lines) else ""
        value_below = self._match_value_below(line, next_line)
        if value_below:
            return value_below, (line, next_line), i + 1
        match = self._match_row(line)
        if match and not self._number_is_part_of_name(match, next_line):
            if match.group("code").upper() in PANEL_CODES:
                return None, line, i
            return match.groupdict(), line, i

        pending = self._match_row_without_value(line)
        if not pending or pending.group("code").upper() in PANEL_CODES:
            return None, line, i
        nxt = _VALUE_ONLY_RE.match(next_line)
        if not nxt:
            return None, line, i
        return {**pending.groupdict(), **nxt.groupdict()}, (line, next_line), i + 1

    def _read_tiers(
        self, fields: Dict, lines: List[str], i: int
    ) -> Tuple[List[str], int]:
        """Return the scaled tiers of a labelled range and the index after them."""
        fields["unit"], fields["range"] = self._separate_label_from_unit(
            fields.get("unit") or "", fields.get("range") or ""
        )
        if ":" not in fields["range"]:
            return [], i
        tiers, i = self._collect_tiers(lines, i, fields["range"])
        _, factor = self._normalize_unit(fields["unit"])
        return [self._scale_tier(tier, factor) for tier in tiers], i

    def _build(self, fields: Dict, test_date: Optional[str]) -> Optional[LabTestResult]:
        """Turn the matched columns of one row into a LabTestResult.

        Qualitative words become qualitative results, ``<``/``>`` values become
        text results with their unit and range, and numbers keep their reported
        unit (spelling normalized, counts per microliter scaled to K/uL).
        """
        code = fields["code"].upper()
        desc = " ".join((fields.get("desc") or "").split())
        raw_value = fields["value"].strip()
        unit, factor = self._normalize_unit(fields.get("unit") or "")
        range_raw = fields.get("range") or ""

        test_name = self._test_name(code, desc, unit)

        flag = ""
        if fields.get("flag"):
            flag = "High" if fields["flag"].startswith("+") else "Low"

        if fields.get("tiers"):
            reference_range = fields["tiers"]
        else:
            reference_range = self._scale_range(range_raw, factor)

        lower = raw_value.lower()
        if lower in QUALITATIVE:
            return LabTestResult(
                test_name=test_name,
                value=None,
                qualitative_value=QUALITATIVE[lower],
                confidence=0.95,
                test_date=test_date,
            )
        if raw_value[0] in "<>":
            # Below/above the measuring range: a text result, as the exact value
            # isn't known, that still needs its unit, range and flag.
            digits = raw_value[1:].strip().replace(",", ".")
            if factor != 1:
                digits = self._fmt(float(digits) * factor)
            return LabTestResult(
                test_name=test_name,
                value=None,
                qualitative_value=f"{raw_value[0]}{digits}",
                unit=unit,
                reference_range=reference_range,
                flag=flag,
                confidence=0.95,
                test_date=test_date,
            )

        value = float(raw_value.replace(",", ".")) * factor
        return LabTestResult(
            test_name=test_name,
            value=round(value, 4),
            unit=unit,
            reference_range=reference_range,
            flag=flag,
            confidence=0.95,
            test_date=test_date,
        )

    def _test_name(self, code: str, desc: str, unit: str) -> str:
        """Canonical test name: Synlab code first, then the German description."""
        specific = _first_match(SPECIFIC_TO_TEST, desc)
        if specific:
            return specific
        if _OTHER_SPECIMEN_RE.search(desc):
            return desc or code
        if code in CODE_TO_TEST:
            return CODE_TO_TEST[code]
        if _RELATED_TEST_RE.search(desc):
            return desc or code
        differential = _first_match(DIFFERENTIAL, desc)
        if differential:
            return differential if unit == "%" else f"{differential} (Absolute)"
        return _first_match(DESCRIPTION_TO_TEST, desc) or desc or code

    def _collect_tiers(
        self, lines: List[str], i: int, first: str
    ) -> Tuple[List[str], int]:
        """Return the tiers of a labelled range and the index after them."""
        tiers = [" ".join(first.split())]
        while i < len(lines) and self._is_tier_line(lines[i]):
            tiers.append(" ".join(lines[i].split()))
            i += 1
        return tiers, i

    @staticmethod
    def _join_tiers(tiers: List[str]) -> str:
        """Join tiers, leaving out those over the backend's reference range limit.

        A range over the limit would get the whole Bulk Entry save rejected.
        """
        limit = LAB_TEST_COMPONENT_LIMITS["MAX_REF_RANGE_TEXT_LENGTH"]
        joined = ""
        for tier in tiers:
            candidate = f"{joined}; {tier}" if joined else tier
            if len(candidate) > limit:
                break
            joined = candidate
        return joined

    @staticmethod
    def _merge_tiers(
        results: List[LabTestResult], index: Optional[int], tiers: List[str]
    ) -> None:
        """Add tiers from a repeated row to the earlier result of that row.

        Qualitative results have no reference range, so nothing is merged into
        them.
        """
        if index is None or not tiers:
            return
        result = results[index]
        if not result.reference_range:
            return
        known = result.reference_range.split("; ")
        result.reference_range = SynlabParser._join_tiers(
            known + [t for t in tiers if t not in known]
        )

    @staticmethod
    def _number_is_part_of_name(row: re.Match, next_line: str) -> bool:
        """True if a row's "value" is really the end of its name ("Vitamin B 12").

        The row then has nothing after a whole number, and the next line holds
        the real value with a unit.
        """
        if row.group("flag") or row.group("unit") or row.group("range"):
            return False
        if not row.group("value").isdigit():
            return False
        nxt = _VALUE_ONLY_RE.match(next_line)
        return bool(
            nxt
            and nxt.group("value")[0] not in "<>"
            and nxt.group("unit")
            and _looks_like_unit(nxt.group("unit"))
        )

    @staticmethod
    def _match_row_without_value(line: str) -> Optional[re.Match]:
        """Match a row whose value is on the next line.

        A one-letter first word is only a code if Synlab uses it ("K Kalium");
        otherwise any line of prose followed by a number would become a result.
        """
        match = _ROW_NO_VALUE_RE.match(line)
        if match and len(match.group("code")) == 1:
            return match if match.group("code") in CODE_TO_TEST else None
        return match

    @staticmethod
    def _is_tier_line(line: str) -> bool:
        """True for a continuation line of a tiered range ("fast optimal: 100 - 129")."""
        return (
            _TIER_RE.match(line) is not None
            and not _SKIP_RE.match(line)
            and not SynlabParser._match_row(line)
        )

    @staticmethod
    def _separate_label_from_unit(unit: str, range_text: str) -> Tuple[str, str]:
        """Return a word to the range column if it was read as the unit.

        In "3.9 Risiko erhöht: > 5" there is no unit, but the pattern can't tell
        "Risiko erhöht:" from "mg/dl optimal:", so check what the word looks like.
        The same goes for a qualitative range: "0.3 negativ".
        """
        if unit.lower() in QUALITATIVE and not range_text:
            return "", unit
        if not unit or ":" not in range_text or _looks_like_unit(unit):
            return unit, range_text
        return "", f"{unit} {range_text}"

    @staticmethod
    def _normalize_unit(unit: str) -> Tuple[str, float]:
        """Map a Synlab unit to its Bulk Entry spelling and a value scale factor."""
        if not unit:
            return "", 1
        if unit == "G/l":  # Giga per liter (cell counts); "g/l" is grams
            return "K/uL", 1
        key = unit.replace("μ", "µ").lower()
        if re.match(r"ml/min/1[.,]7", key):  # Printed cut off, e.g. "ml/min/1,7"
            return "mL/min/1.73m2", 1
        if key in _UNITS:
            return _UNITS[key]
        return unit, 1

    def _scale_range(self, rng: str, factor: float) -> str:
        """Normalize a range ("3,90 - 10,2", "< 50") and scale it by ``factor``."""
        if not rng:
            return ""
        rng = rng.replace(",", ".").replace("–", "-")
        if re.search(r"[^\W\d]", rng):  # Words: "3.5 bis 5.1", "0.27 - 4.2 (Erw.)"
            return self._scale_tier(rng, factor)
        if factor == 1:
            return rng.replace(" ", "")
        m = re.match(r"^([<>]=?)\s*([\d.]+)$", rng)
        if m:
            return f"{m.group(1)}{self._fmt(float(m.group(2)) * factor)}"
        m = re.match(r"^(-?[\d.]+)\s*-\s*(-?[\d.]+)$", rng)
        if m is None:
            return self._scale_tier(rng, factor)
        low, high = (float(x) * factor for x in m.groups())
        return f"{self._fmt(low)}-{self._fmt(high)}"

    def _scale_tier(self, tier: str, factor: float) -> str:
        """Scale the numbers after a tier's label ("normal: 3900 - 10200")."""
        if factor == 1:
            return tier
        label, colon, numbers = tier.rpartition(":")
        scaled = re.sub(
            _NUM,
            lambda m: self._fmt(float(m.group().replace(",", ".")) * factor),
            numbers,
        )
        return f"{label}{colon}{scaled}"

    @staticmethod
    def _fmt(number: float) -> str:
        """Format a number without trailing zeros (4.6700 -> "4.67")."""
        return f"{number:.4f}".rstrip("0").rstrip(".")
