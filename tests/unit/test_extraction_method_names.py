"""Regression: a successful lab-specific parse must produce valid PDFExtractionMetadata."""

import pytest

from app.schemas.lab_result import PDFExtractionMetadata
from app.services.pdf_text_extraction_service import pdf_extraction_service
from tests.fixtures.lab_text_samples import (
    EPIC_MYCHART_RENAL_PANEL,
    SYNLAB_REPORT_TEXT,
)


@pytest.mark.parametrize(
    "extraction_method,expected_method",
    [("native", "epic_mychart_parser"), ("ocr", "epic_mychart_parser_ocr")],
)
def test_epic_parse_builds_metadata(extraction_method, expected_method):
    result = pdf_extraction_service._try_lab_specific_parsing(
        EPIC_MYCHART_RENAL_PANEL, extraction_method=extraction_method
    )

    metadata = PDFExtractionMetadata(
        method=result["method"],
        confidence=result["confidence"],
        page_count=result["page_count"],
        char_count=result["char_count"],
        filename="report.pdf",
        lab_name=result["lab_name"],
        test_count=result["test_count"],
        test_date=result["test_date"],
    )

    assert metadata.method == expected_method
    assert metadata.test_count == 3


def test_synlab_parse_builds_metadata():
    result = pdf_extraction_service._try_lab_specific_parsing(
        SYNLAB_REPORT_TEXT, extraction_method="native"
    )

    metadata = PDFExtractionMetadata(
        method=result["method"],
        confidence=result["confidence"],
        page_count=result["page_count"],
        char_count=result["char_count"],
        filename="report.pdf",
        lab_name=result["lab_name"],
        test_count=result["test_count"],
        test_date=result["test_date"],
    )

    assert metadata.method == "synlab_parser"
    assert metadata.lab_name == "Synlab"
    assert metadata.test_date is not None
