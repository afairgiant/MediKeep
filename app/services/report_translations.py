"""
Report Translations Module

Loads translations from the frontend locale JSON files (reportPdf.json namespace)
so there is a single source of truth for all translated strings.

The module reads from: frontend/public/locales/{lang}/reportPdf.json

Translation keys use camelCase to match the frontend i18next convention.
Interpolation uses {{variable}} syntax matching i18next.

Supports 13 languages: en, fr, de, es, it, pt, ru, sv, nl, pl, zh, el, th
"""

import json
import re
import sys
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Optional, Union

from app.core.logging.config import get_logger
from app.schemas.user_preferences import SUPPORTED_LANGUAGES as _SUPPORTED_LANGUAGES

logger = get_logger(__name__, "app")

# Single source of truth lives in the preferences schema, so the two cannot drift.
SUPPORTED_LANGUAGES = tuple(_SUPPORTED_LANGUAGES)


def _resolve_locales_dir() -> Path:
    """Resolve the locales directory, handling PyInstaller EXE bundles."""
    candidates = []

    # PyInstaller EXE: files bundled under _MEIPASS/frontend/build/
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        candidates.append(Path(sys._MEIPASS) / "frontend" / "build" / "locales")

    project_root = Path(__file__).resolve().parents[2]
    # Production build
    candidates.append(project_root / "frontend" / "build" / "locales")
    # Dev mode
    candidates.append(project_root / "frontend" / "public" / "locales")

    for candidate in candidates:
        if candidate.is_dir() and (candidate / "en" / "reportPdf.json").exists():
            return candidate

    return candidates[-1]


_LOCALES_DIR = _resolve_locales_dir()

# In-memory cache: language -> parsed JSON dict
_cache: Dict[str, Dict[str, Any]] = {}


def _load_locale(language: str) -> Dict[str, Any]:
    """Load and cache a reportPdf.json locale file."""
    if language in _cache:
        return _cache[language]

    locale_path = _LOCALES_DIR / language / "reportPdf.json"
    if not locale_path.exists():
        logger.warning(
            "reportPdf.json not found for language '%s', falling back to en", language
        )
        if language != "en":
            return _load_locale("en")
        return {}

    try:
        data = json.loads(locale_path.read_text(encoding="utf-8"))
        _cache[language] = data
        return data
    except (json.JSONDecodeError, OSError) as e:
        logger.error("Failed to load reportPdf.json for '%s': %s", language, e)
        if language != "en":
            return _load_locale("en")
        return {}


# --- Date format patterns ---

_DATE_FORMATS = {
    "mdy": "%m/%d/%Y",
    "dmy": "%d/%m/%Y",
    "dmy_dot": "%d.%m.%Y",
    "ymd": "%Y-%m-%d",
}

# Day/month only (chart axis ticks within a single year)
_SHORT_DATE_FORMATS = {
    "mdy": "%m/%d",
    "dmy": "%d/%m",
    "dmy_dot": "%d.%m.",
    "ymd": "%m-%d",
}

_DATETIME_FORMATS = {
    "mdy": "%m/%d/%Y %H:%M",
    "dmy": "%d/%m/%Y %H:%M",
    "dmy_dot": "%d.%m.%Y %H:%M",
    "ymd": "%Y-%m-%d %H:%M",
}

# Regex to convert i18next {{var}} to Python {var}
_INTERPOLATION_RE = re.compile(r"\{\{(\w+)\}\}")

# Separators used inside stored values ('on-hold', 'blood work', 'in_progress')
_VALUE_SEPARATOR_RE = re.compile(r"[\s_-]+")


class ReportTranslator:
    """Translator for PDF report generation.

    Reads translations from the frontend reportPdf.json locale files,
    using the same key schema as the rest of the app (camelCase, nested sections).
    Falls back to English for any missing key or unsupported language.
    """

    def __init__(self, language: str = "en", date_format: str = "mdy"):
        self._language = language if language in SUPPORTED_LANGUAGES else "en"
        self._date_format = date_format if date_format in _DATE_FORMATS else "mdy"
        self._data = _load_locale(self._language)
        self._en_data = _load_locale("en") if self._language != "en" else self._data

    @property
    def language(self) -> str:
        return self._language

    @property
    def date_format_code(self) -> str:
        return self._date_format

    def category(self, key: str) -> str:
        """Get translated category display name.

        key uses snake_case to match backend category identifiers
        (e.g., 'lab_results', 'emergency_contacts').
        """
        result = self._data.get("categories", {}).get(key) or self._en_data.get(
            "categories", {}
        ).get(key)
        return result or key.replace("_", " ").title()

    def field(self, key: str) -> str:
        """Get translated field label.

        key uses snake_case from the backend; mapped to camelCase for lookup
        (e.g., 'blood_pressure' -> 'bloodPressure').
        """
        camel_key = self._to_camel_case(key)
        result = self._data.get("fields", {}).get(camel_key) or self._en_data.get(
            "fields", {}
        ).get(camel_key)
        return result or key.replace("_", " ").title()

    def insurance_detail(self, key: str) -> str:
        """Get translated label for an insurance coverage/contact detail key.

        key is the snake_case key stored in coverage_details / contact_info
        (e.g., 'deductible_individual'); unknown keys fall back to a
        title-cased version ('Deductible Individual').
        """
        camel_key = self._to_camel_case(key)
        result = self._data.get("insuranceDetails", {}).get(
            camel_key
        ) or self._en_data.get("insuranceDetails", {}).get(camel_key)
        return result or key.replace("_", " ").title()

    def value(self, raw: Any) -> str:
        """Get translated display text for a stored enum/choice value.

        Handles hyphenated, spaced and mixed-case values ('on-hold',
        'Blood Work', 'IN_PROGRESS') by normalizing to snake_case before the
        lookup. Unknown values (including free text) are returned exactly as
        stored so user-entered text is never altered.
        """
        text = str(raw).strip() if raw is not None else ""
        if not text:
            return ""
        key = _VALUE_SEPARATOR_RE.sub("_", text.lower())
        camel_key = self._to_camel_case(key)
        result = self._data.get("values", {}).get(camel_key) or self._en_data.get(
            "values", {}
        ).get(camel_key)
        return result or text

    def relationship(self, key: str) -> str:
        """Get translated family relationship label.

        key is the backend enum value (e.g., 'paternal_grandfather'); unknown
        values fall back to a title-cased version ('Paternal Grandfather').
        """
        camel_key = self._to_camel_case(key)
        result = self._data.get("relationships", {}).get(
            camel_key
        ) or self._en_data.get("relationships", {}).get(camel_key)
        return result or key.replace("_", " ").title()

    def text(self, key: str, **kwargs) -> str:
        """Get translated report text with optional interpolation.

        key uses snake_case from the backend; mapped to camelCase for lookup.
        Interpolation uses Python kwargs: translator.text("records_summary", total=42, categories=5)
        """
        camel_key = self._to_camel_case(key)
        template = self._data.get("report", {}).get(camel_key) or self._en_data.get(
            "report", {}
        ).get(camel_key)
        if not template:
            # Never show a raw snake_case key in a report
            return key.replace("_", " ").title()

        if kwargs:
            # Convert i18next {{var}} syntax to Python {var} then format
            python_template = _INTERPOLATION_RE.sub(r"{\1}", template)
            try:
                return python_template.format(**kwargs)
            except (KeyError, IndexError):
                return template
        return template

    def format_date(
        self, value: Optional[Union[str, date, datetime]], include_time: bool = False
    ) -> str:
        """Format a date/datetime according to the user's date_format preference.

        Handles ISO date strings, date objects, and datetime objects.
        Returns '--' for None or unparseable values.
        """
        if value is None:
            return "--"

        dt = None
        if isinstance(value, datetime):
            dt = value
        elif isinstance(value, date):
            dt = datetime(value.year, value.month, value.day)
        elif isinstance(value, str):
            for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
                try:
                    dt = datetime.strptime(value.split("+")[0].split("Z")[0], fmt)
                    break
                except ValueError:
                    continue

        if dt is None:
            return str(value) if value else "--"

        if include_time:
            pattern = _DATETIME_FORMATS.get(self._date_format, _DATETIME_FORMATS["mdy"])
        else:
            pattern = _DATE_FORMATS.get(self._date_format, _DATE_FORMATS["mdy"])

        return dt.strftime(pattern)

    def format_short_date(self, value: Union[date, datetime]) -> str:
        """Format a date without the year, per the user's date_format preference."""
        return value.strftime(_SHORT_DATE_FORMATS[self._date_format])

    @staticmethod
    @lru_cache(maxsize=256)
    def _to_camel_case(snake_str: str) -> str:
        """Convert snake_case to camelCase (e.g., 'blood_pressure' -> 'bloodPressure')."""
        parts = snake_str.split("_")
        return parts[0] + "".join(p.capitalize() for p in parts[1:])


def get_translator(language: str = "en", date_format: str = "mdy") -> ReportTranslator:
    """Create a ReportTranslator for the given language and date format.

    Args:
        language: ISO 639-1 language code (en, fr, de, es, it, pt, ru, sv, nl, pl, zh, el, th)
        date_format: Date format preference (mdy, dmy, ymd)

    Returns:
        ReportTranslator backed by the frontend reportPdf.json locale files.
    """
    return ReportTranslator(language=language, date_format=date_format)
