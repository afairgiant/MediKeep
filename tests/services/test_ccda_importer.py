"""
Tests for the C-CDA importer: format detection, conversion through
healthrecord-bridge, zip handling and the missing-library message.
"""

import io
import sys
import zipfile
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services import importers
from app.services.importers import (
    CcdaImporter,
    HealthRecordImporterRegistry,
    ImportFormatError,
    ccda_available,
    health_record_importer_registry,
)
from app.services.importers.ccda_importer import (
    INVALID_DOCUMENT_MESSAGE,
    MAX_NOTE_TEXT,
    MAX_NOTES,
    MISSING_LIBRARY_MESSAGE,
    UNSAFE_DOCUMENT_MESSAGE,
    _report_notes,
)

# Conversion needs the optional library; without it these tests are skipped
needs_library = pytest.mark.skipif(
    not ccda_available(), reason="healthrecord-bridge is not installed"
)

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures" / "health_record_import"
MYCHART_CCD = FIXTURES / "mychart_like_ccd.xml"


def _zip(members: dict) -> bytes:
    """Build a zip in memory from {name: content}."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, content in members.items():
            zf.writestr(name, content)
    return buf.getvalue()


def _xdm_zip(xml: bytes, second: bytes = None) -> bytes:
    """Wrap one or two C-CDAs in the folder layout MyChart's download produces."""
    members = {
        "MachineReadable_XDMFormat/IHE_XDM/SUBSET01/DOC0001.XML": xml,
        "MachineReadable_XDMFormat/IHE_XDM/SUBSET01/METADATA.XML": "<x/>",
        "MachineReadable_XDMFormat/INDEX.HTM": "<html></html>",
        "MachineReadable_XDMFormat/README.TXT": "stub",
    }
    if second is not None:
        members["MachineReadable_XDMFormat/IHE_XDM/SUBSET02/DOC0001.XML"] = second
    return _zip(members)


def _resource_types(bundle: dict) -> set:
    return {e["resource"]["resourceType"] for e in bundle["entry"]}


class TestValidateFormat:
    """Test validate_format."""

    def test_accepts_ccda_xml(self):
        """Test that a ClinicalDocument in the CDA namespace is accepted."""
        assert CcdaImporter().validate_format(MYCHART_CCD.read_bytes(), "ccd.xml")

    def test_accepts_utf16_ccda_xml(self):
        """Test that a UTF-16 C-CDA, which XML marks with a byte order mark, is accepted."""
        text = MYCHART_CCD.read_text(encoding="utf-8").replace(
            'encoding="UTF-8"', 'encoding="UTF-16"', 1
        )
        for codec in ("utf-16", "utf-16-be"):
            data = text.encode(codec)
            if codec == "utf-16-be":
                data = b"\xfe\xff" + data
            assert CcdaImporter().validate_format(data, "ccd.xml")

    def test_rejects_other_xml(self):
        """Test that XML without the CDA namespace is not claimed."""
        data = b'<?xml version="1.0"?><root><ClinicalDocument/></root>'
        assert not CcdaImporter().validate_format(data, "other.xml")

    def test_accepts_zip_with_a_document(self):
        """Test that an XDM zip holding a C-CDA is accepted."""
        data = _xdm_zip(MYCHART_CCD.read_bytes())
        assert CcdaImporter().validate_format(data, "export.zip")

    def test_rejects_zip_without_documents_and_non_zip(self):
        """Test that a zip of other XML and a non-zip extension are not claimed."""
        importer = CcdaImporter()
        assert not importer.validate_format(_zip({"a.xml": "<a/>"}), "a.zip")
        assert not importer.validate_format(MYCHART_CCD.read_bytes(), "ccd.txt")

    @needs_library
    def test_claims_unreadable_zip_so_the_reason_is_reported(self):
        """Test that a damaged .zip is claimed and to_bundle names the problem."""
        importer = CcdaImporter()
        assert importer.validate_format(b"PK not really", "a.zip")
        with pytest.raises(
            ImportFormatError, match="^File is not a valid zip archive$"
        ):
            importer.to_bundle(b"PK not really", "a.zip")

    @needs_library
    def test_registry_detects_ccda(self):
        """Test that detect picks the C-CDA importer for XML and for the zip."""
        xml = MYCHART_CCD.read_bytes()
        assert health_record_importer_registry.detect(xml, "a.xml").FORMAT_KEY == "ccda"
        assert (
            health_record_importer_registry.detect(_xdm_zip(xml), "a.zip").FORMAT_KEY
            == "ccda"
        )


class TestReportNotes:
    """Test the notes made from the library's conversion report."""

    def test_report_notes_skip_empty_sections(self):
        """Test that an unconverted section with no entries makes no note."""
        unknown = [
            SimpleNamespace(title="Care Teams", code=None, entries=1),
            SimpleNamespace(title="Medical Devices", code=None, entries=0),
            SimpleNamespace(title="Goals", code=None, entries=2),
        ]
        document = SimpleNamespace(unknown_sections=unknown, sections=[])
        report = SimpleNamespace(documents=[document])
        assert _report_notes(report) == [
            "Section 'Care Teams' is not converted yet (1 entry)",
            "Section 'Goals' is not converted yet (2 entries)",
        ]

    def test_text_from_the_file_is_clipped(self):
        """Test that titles, values and reasons from the file cannot make a long note."""
        long = "x" * 5000
        unknown = [SimpleNamespace(title=long, code=None, entries=1)]
        section = SimpleNamespace(
            name="Medications",
            null_flavor=long,
            skipped=[SimpleNamespace(reason=long)],
        )
        document = SimpleNamespace(unknown_sections=unknown, sections=[section])
        notes = _report_notes(SimpleNamespace(documents=[document]), prefix=long)
        clipped = "x" * (MAX_NOTE_TEXT - 1) + "\u2026"
        assert notes == [
            f"{clipped}: Section '{clipped}' is not converted yet (1 entry)",
            f"{clipped}: Section 'Medications' is marked {clipped}",
            f"{clipped}: Medications: 1 skipped ({clipped})",
        ]


@needs_library
class TestToBundle:
    """Test conversion through the library."""

    def test_converts_document(self):
        """Test that the fixture becomes a Bundle with a Patient and clinical resources."""
        bundle, notes = CcdaImporter().to_bundle(MYCHART_CCD.read_bytes(), "ccd.xml")
        assert bundle["resourceType"] == "Bundle"
        assert {
            "Patient",
            "Condition",
            "AllergyIntolerance",
            "MedicationStatement",
        } <= (_resource_types(bundle))
        assert any("Plan of Treatment" in n for n in notes)

    def test_zip_merges_without_duplicate_ids(self):
        """Test that two copies of a document in one zip yield each resource once."""
        xml = MYCHART_CCD.read_bytes()
        single, _ = CcdaImporter().to_bundle(xml, "ccd.xml")
        merged, notes = CcdaImporter().to_bundle(_xdm_zip(xml, xml), "export.zip")
        ids = [
            (e["resource"]["resourceType"], e["resource"]["id"])
            for e in merged["entry"]
        ]
        assert len(ids) == len(set(ids)) == len(single["entry"])
        # Notes from both documents are kept apart by member name
        assert any(
            n.startswith("MachineReadable_XDMFormat/IHE_XDM/SUBSET02") for n in notes
        )

    def test_notes_past_the_cap_are_counted(self):
        """Test that notes over the limit end with a count instead of vanishing."""
        xml = MYCHART_CCD.read_bytes()
        _, single = CcdaImporter().to_bundle(xml, "ccd.xml")
        copies = MAX_NOTES // len(single) + 1
        members = {f"SUBSET{i:02d}/DOC0001.XML": xml for i in range(copies)}
        _, notes = CcdaImporter().to_bundle(_zip(members), "export.zip")
        hidden = copies * len(single) - MAX_NOTES
        assert len(notes) == MAX_NOTES + 1
        assert notes[-1] == f"{hidden} more conversion notes not shown"

    def test_zip_without_documents(self):
        """Test that a zip with no C-CDA inside is rejected."""
        with pytest.raises(ImportFormatError, match="no C-CDA documents"):
            CcdaImporter().to_bundle(_zip({"a.xml": "<a/>"}), "a.zip")

    def test_rejects_traversal_name(self):
        """Test that an unsafe member path is rejected before conversion."""
        data = _zip({"../DOC0001.XML": MYCHART_CCD.read_bytes()})
        with pytest.raises(ImportFormatError, match="Unsafe path"):
            CcdaImporter().to_bundle(data, "a.zip")

    def test_invalid_document(self):
        """Test that a file the library cannot parse gives a readable error."""
        with pytest.raises(ImportFormatError, match="Not a valid C-CDA"):
            CcdaImporter().to_bundle(
                b"<ClinicalDocument xmlns='urn:hl7-org:v3'>", "x.xml"
            )

    def test_invalid_document_error_has_no_parser_text(self):
        """Test that the error names neither the file nor what the parser saw."""
        data = b"<ClinicalDocument xmlns='urn:hl7-org:v3'><given>Jane</giv>"
        with pytest.raises(ImportFormatError) as excinfo:
            CcdaImporter().to_bundle(data, "smith-record.xml")
        assert str(excinfo.value) == INVALID_DOCUMENT_MESSAGE

    def test_unexpected_converter_error_is_a_format_error(self, monkeypatch):
        """Test that a converter failure other than CcdaError gives the fixed message."""
        import healthrecord_bridge.ccda

        def broken(data, name):
            raise RuntimeError("smith-record.xml: converter bug")

        monkeypatch.setattr(healthrecord_bridge.ccda, "convert_bytes", broken)
        with pytest.raises(ImportFormatError) as excinfo:
            CcdaImporter().to_bundle(MYCHART_CCD.read_bytes(), "smith-record.xml")
        assert str(excinfo.value) == INVALID_DOCUMENT_MESSAGE

    def test_unsafe_document_error_has_no_parser_text(self):
        """Test that a DOCTYPE gets its own fixed message."""
        data = (
            b"<!DOCTYPE ClinicalDocument [<!ENTITY name 'Jane'>]>"
            b"<ClinicalDocument xmlns='urn:hl7-org:v3'/>"
        )
        with pytest.raises(ImportFormatError) as excinfo:
            CcdaImporter().to_bundle(_xdm_zip(data), "smith-record.zip")
        assert str(excinfo.value) == UNSAFE_DOCUMENT_MESSAGE


class TestOptionalLibrary:
    """Test behaviour when healthrecord-bridge is not installed."""

    def test_format_absent_without_library(self, monkeypatch):
        """Test that the registry leaves C-CDA out when the package is missing."""
        monkeypatch.setattr(importers, "find_spec", lambda name: None)
        registry = HealthRecordImporterRegistry()
        assert {f["key"] for f in registry.get_available_formats()} == {"fhir_bundle"}
        assert "xml" not in registry.allowed_extensions()

    def test_to_bundle_names_the_install_step(self, monkeypatch):
        """Test that converting without the package says how to install it."""
        monkeypatch.setitem(sys.modules, "healthrecord_bridge.ccda", None)
        with pytest.raises(ImportFormatError, match="requirements-import.txt"):
            CcdaImporter().to_bundle(MYCHART_CCD.read_bytes(), "ccd.xml")
        assert "healthrecord-bridge" in MISSING_LIBRARY_MESSAGE
