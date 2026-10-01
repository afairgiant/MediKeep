"""Regression tests for #1093: report sections must print ordered by name, not in
the order the user selected them."""

import asyncio

import pytest

from app.services.custom_report_pdf_generator import CustomReportPDFGenerator
from app.services.report_translations import SUPPORTED_LANGUAGES, get_translator


@pytest.fixture
def generator():
    gen = CustomReportPDFGenerator()
    gen.translator = get_translator("en", "mdy")
    return gen


class TestSortedCategories:
    def test_orders_by_displayed_name(self, generator):
        keys = ["treatments", "practitioners", "allergies"]
        assert generator._sorted_categories(keys) == [
            "allergies",
            "practitioners",
            "treatments",
        ]

    def test_ignores_case_and_selection_order(self, generator):
        assert generator._sorted_categories(["vitals", "Allergies"]) == [
            "Allergies",
            "vitals",
        ]

    def test_accepts_a_dict_and_empty_input(self, generator):
        assert generator._sorted_categories({"b_cat": 1, "a_cat": 2}) == [
            "a_cat",
            "b_cat",
        ]
        assert generator._sorted_categories([]) == []


class TestReportSectionOrder:
    def test_sections_are_generated_in_name_order(self, generator, monkeypatch):
        order = []

        def fake_section(category, records):
            order.append(category)
            return []

        monkeypatch.setattr(generator, "_create_category_section", fake_section)
        asyncio.run(
            generator.generate_pdf(
                {
                    "report_title": "Report",
                    "data": {
                        "treatments": [{"id": 1}],
                        "practitioners": [{"id": 2}],
                        "allergies": [{"id": 3}],
                        "empty_category": [],
                    },
                }
            )
        )

        assert order == ["allergies", "practitioners", "treatments"]


ALL_CATEGORIES = [
    "medications",
    "lab_results",
    "allergies",
    "conditions",
    "immunizations",
    "procedures",
    "treatments",
    "encounters",
    "vitals",
    "emergency_contacts",
    "practitioners",
    "pharmacies",
    "family_history",
    "symptoms",
    "injuries",
    "insurance",
    "medical_equipment",
]


class TestSortByTranslatedName:
    @pytest.mark.parametrize("lang", list(SUPPORTED_LANGUAGES))
    def test_every_category_has_a_translated_name(self, lang):
        translator = get_translator(lang, "mdy")
        for category in ALL_CATEGORIES:
            name = translator.category(category)
            assert name and "_" not in name

    @pytest.mark.parametrize("lang", list(SUPPORTED_LANGUAGES))
    def test_sections_follow_the_translated_names(self, lang):
        gen = CustomReportPDFGenerator()
        gen.translator = get_translator(lang, "mdy")
        ordered = gen._sorted_categories(reversed(ALL_CATEGORIES))
        keys = [gen._sort_key(gen.translator.category(c)) for c in ordered]
        assert keys == sorted(keys)

    def test_french_order_follows_translated_names_not_keys(self):
        gen = CustomReportPDFGenerator()
        gen.translator = get_translator("fr", "dmy")
        # By key "symptoms" < "vitals", but in French "Signes vitaux" sorts
        # before "Symptômes".
        ordered = gen._sorted_categories(["symptoms", "vitals"])
        assert ordered == ["vitals", "symptoms"]

    def test_sort_key_ignores_accents_and_case(self):
        sort_key = CustomReportPDFGenerator._sort_key
        assert sort_key("Étude") < sort_key("Zèbre")
        assert sort_key("Édith") > sort_key("Ebène")
        assert sort_key("ABC") == sort_key("abc")
