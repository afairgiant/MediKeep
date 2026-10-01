"""Regression tests for #1093: the default report title was not localized."""

import pytest

from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.report_translations import SUPPORTED_LANGUAGES, get_translator


def _generator(lang):
    gen = CustomReportPDFGenerator()
    gen.translator = get_translator(lang, "mdy")
    return gen


class TestReportTitle:
    @pytest.mark.parametrize("lang", list(SUPPORTED_LANGUAGES))
    def test_default_title_is_localized(self, lang):
        title = _generator(lang)._resolve_report_title("Custom Medical Report")
        expected = get_translator(lang, "mdy").text("report_title")
        assert title == expected
        assert "_" not in title

    def test_french_default_title(self):
        gen = _generator("fr")
        assert gen._resolve_report_title("Custom Medical Report") == (
            "Rapport médical personnalisé"
        )

    def test_missing_or_blank_title_uses_localized_default(self):
        gen = _generator("de")
        expected = "Benutzerdefinierter medizinischer Bericht"
        assert gen._resolve_report_title(None) == expected
        assert gen._resolve_report_title("") == expected
        assert gen._resolve_report_title("  custom medical report ") == expected

    def test_user_typed_title_is_kept(self):
        gen = _generator("fr")
        assert gen._resolve_report_title("Dossier de Marie") == "Dossier de Marie"
