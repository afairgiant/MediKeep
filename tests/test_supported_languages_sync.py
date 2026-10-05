"""Keep the supported-language lists in sync across backend, frontend and locales."""

import re
from pathlib import Path

from app.schemas.user_preferences import SUPPORTED_LANGUAGES as SCHEMA_LANGUAGES
from app.services.report_translations import SUPPORTED_LANGUAGES as REPORT_LANGUAGES

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES_TS = ROOT / "frontend" / "src" / "constants" / "languages.ts"
LOCALES_DIR = ROOT / "frontend" / "public" / "locales"


def _frontend_languages():
    source = LANGUAGES_TS.read_text(encoding="utf-8")
    return re.findall(r"\{\s*value:\s*'([a-z]{2,3})'", source)


class TestSupportedLanguagesSync:
    def test_report_languages_match_schema_languages(self):
        assert list(REPORT_LANGUAGES) == list(SCHEMA_LANGUAGES)

    def test_frontend_languages_match_backend(self):
        assert sorted(_frontend_languages()) == sorted(SCHEMA_LANGUAGES)

    def test_frontend_list_has_no_duplicates(self):
        codes = _frontend_languages()
        assert len(codes) == len(set(codes))

    def test_every_supported_language_has_report_locale(self):
        for lang in SCHEMA_LANGUAGES:
            assert (LOCALES_DIR / lang / "reportPdf.json").exists(), lang

    def test_unlisted_locale_directories_are_allowed(self):
        # A locale may exist on disk before it is exposed in the UI.
        on_disk = {p.name for p in LOCALES_DIR.iterdir() if p.is_dir()}
        assert set(SCHEMA_LANGUAGES) <= on_disk
