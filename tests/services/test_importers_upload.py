"""
Tests for upload handling in the health record importers: zip limits, content
hashing, the FHIR bundle importer and format detection.
"""

import io
import json
import zipfile
from datetime import date, datetime
from decimal import Decimal

import pytest

from app.services.importers import (
    FhirBundleImporter,
    ImportFormatError,
    health_record_importer_registry,
    upload,
)
from app.services.importers.provenance import content_hash


def _zip(members: dict) -> bytes:
    """Build a zip in memory from {name: content}."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, content in members.items():
            zf.writestr(name, content)
    return buf.getvalue()


class TestZipMembers:
    """Test iter_zip_members limits."""

    def test_yields_matching_members_only(self):
        """Test that only members with a wanted suffix are returned."""
        data = _zip({"a/DOC0001.XML": "<a/>", "a/README.TXT": "x", "b/": ""})
        members = list(upload.iter_zip_members(data, (".xml",)))
        assert members == [("a/DOC0001.XML", b"<a/>")]

    def test_rejects_path_traversal(self):
        """Test that a member path with .. is rejected before anything is read."""
        data = _zip({"../escape.xml": "<a/>"})
        with pytest.raises(ImportFormatError, match="Unsafe path"):
            list(upload.iter_zip_members(data, (".xml",)))

    def test_rejects_absolute_and_drive_paths(self):
        """Test that absolute and drive-letter member paths are rejected."""
        for name in ("/etc/x.xml", "C:\\x.xml"):
            with pytest.raises(ImportFormatError, match="Unsafe path"):
                list(upload.iter_zip_members(_zip({name: "<a/>"}), (".xml",)))

    def test_rejects_too_many_members(self, monkeypatch):
        """Test that the member count cap applies."""
        monkeypatch.setattr(upload, "MAX_ZIP_MEMBERS", 2)
        data = _zip({f"{i}.xml": "<a/>" for i in range(3)})
        with pytest.raises(ImportFormatError, match="entries"):
            list(upload.iter_zip_members(data, (".xml",)))

    def test_rejects_oversized_member(self, monkeypatch):
        """Test that a member over the size cap is rejected from its header."""
        monkeypatch.setattr(upload, "MAX_ZIP_MEMBER_BYTES", 10)
        data = _zip({"big.xml": "x" * 11})
        with pytest.raises(ImportFormatError, match="over the"):
            list(upload.iter_zip_members(data, (".xml",)))

    def test_rejects_total_over_cap(self, monkeypatch):
        """Test that the cap on the total expanded size applies."""
        monkeypatch.setattr(upload, "MAX_ZIP_TOTAL_BYTES", 15)
        data = _zip({"a.xml": "x" * 10, "b.xml": "x" * 10})
        with pytest.raises(ImportFormatError, match="expands past"):
            list(upload.iter_zip_members(data, (".xml",)))

    def test_catches_header_that_understates_size(self, monkeypatch):
        """Test that a member larger than its header claims is rejected on read."""
        monkeypatch.setattr(upload, "MAX_ZIP_MEMBER_BYTES", 10)
        data = bytearray(_zip({"lie.xml": "x" * 11}))
        # Overwrite the uncompressed size in the central directory with a small value
        cd = data.rfind(b"PK\x01\x02")
        data[cd + 24 : cd + 28] = (5).to_bytes(4, "little")
        with pytest.raises(ImportFormatError, match="corrupt"):
            list(upload.iter_zip_members(bytes(data), (".xml",)))

    def test_rejects_non_zip(self):
        """Test that a non-zip payload raises ImportFormatError."""
        with pytest.raises(ImportFormatError, match="not a valid zip"):
            list(upload.iter_zip_members(b"not a zip", (".xml",)))


class TestContentHash:
    """Test content_hash."""

    def test_stable_and_whitespace_insensitive(self):
        """Test that the same parts hash the same way regardless of spacing and case."""
        assert content_hash(["I10", "2019-03-02", None]) == content_hash(
            ["  i10 ", "2019-03-02", ""]
        )

    def test_dates_hash_like_iso_strings(self):
        """Test that date and datetime parts hash the same as their ISO strings."""
        day = date(2019, 3, 2)
        moment = datetime(2019, 3, 2, 14, 30)
        assert content_hash([day]) == content_hash(["2019-03-02"])
        assert content_hash([moment]) == content_hash([moment.isoformat()])

    def test_order_and_values_matter(self):
        """Test that reordered or changed parts hash differently."""
        base = content_hash(["a", "b"])
        assert base != content_hash(["b", "a"])
        assert base != content_hash(["a", "c"])

    def test_numbers_hash_by_value(self):
        """Test that the same number hashes the same whatever its type or spelling."""
        for same in (
            [120, 120.0, Decimal("120.00"), "120", "120.0", "1.2e2"],
            [0, -0.0, Decimal("-0"), "0.000"],
            [7.5, "7.50", Decimal("7.5")],
        ):
            hashes = {content_hash([value]) for value in same}
            assert len(hashes) == 1, same
        assert content_hash([120]) != content_hash([121])
        assert content_hash(["2019-03-02"]) != content_hash(["2019-03-03"])
        assert content_hash(["I10"]) == content_hash(["i10"])


class TestFhirBundleImporter:
    """Test the FHIR bundle importer."""

    def test_accepts_bundle(self):
        """Test that a Bundle JSON validates and converts."""
        data = json.dumps({"resourceType": "Bundle", "entry": []}).encode()
        importer = FhirBundleImporter()
        assert importer.validate_format(data, "export.json")
        assert importer.to_bundle(data, "export.json")["entry"] == []

    def test_rejects_wrong_resource_type(self):
        """Test that a non-Bundle resource is rejected."""
        data = json.dumps({"resourceType": "Patient"}).encode()
        importer = FhirBundleImporter()
        assert not importer.validate_format(data, "patient.json")
        with pytest.raises(ImportFormatError, match="not a FHIR Bundle"):
            importer.to_bundle(data, "patient.json")

    def test_rejects_invalid_json_and_non_object(self):
        """Test that malformed JSON is rejected without echoing the parser error."""
        importer = FhirBundleImporter()
        with pytest.raises(ImportFormatError, match="^File is not valid JSON$"):
            importer.to_bundle(b"{", "x.json")
        with pytest.raises(ImportFormatError, match="not an object"):
            importer.to_bundle(b"[]", "x.json")

    def test_rejects_deeply_nested_json(self):
        """Test that JSON nested past the parser's limit is rejected, not a crash."""
        data = b"[" * 100000 + b"]" * 100000
        importer = FhirBundleImporter()
        assert not importer.validate_format(data, "deep.json")
        with pytest.raises(ImportFormatError, match="nested too deeply"):
            importer.to_bundle(data, "deep.json")

    def test_detection_sniffs_the_head_without_parsing(self):
        """Test that validate_format reads the first bytes only and tolerates spacing."""
        importer = FhirBundleImporter()
        assert importer.validate_format(
            b'{ "resourceType" :\n "Bundle", "entry": [', "a.json"
        )
        # Not JSON at all, but the header is there and parsing is to_bundle's job
        assert importer.validate_format(b'{"resourceType": "Bundle" garbage', "a.json")
        late = b'{"id": "' + b"x" * 5000 + b'", "resourceType": "Bundle"}'
        assert not importer.validate_format(late, "a.json")
        assert not importer.validate_format(b'{"resourceType": "Patient"}', "a.json")

    def test_rejects_entries_that_are_not_objects(self):
        """Test that a non-object entry or resource names its index in the error."""
        importer = FhirBundleImporter()
        data = json.dumps({"resourceType": "Bundle", "entry": [{}, 3]}).encode()
        with pytest.raises(ImportFormatError, match="entry 1 is not an object"):
            importer.to_bundle(data, "x.json")
        data = json.dumps(
            {"resourceType": "Bundle", "entry": [{"resource": []}]}
        ).encode()
        with pytest.raises(ImportFormatError, match="entry 0 resource"):
            importer.to_bundle(data, "x.json")

    def test_rejects_entry_that_is_not_a_list(self):
        """Test that a Bundle whose entry is not a list is rejected."""
        data = json.dumps({"resourceType": "Bundle", "entry": {}}).encode()
        with pytest.raises(ImportFormatError, match="entry"):
            FhirBundleImporter().to_bundle(data, "x.json")


class TestRegistry:
    """Test the importer registry."""

    def test_detects_fhir_bundle(self):
        """Test that detect picks the FHIR importer for a Bundle and nothing for text."""
        data = json.dumps({"resourceType": "Bundle", "entry": []}).encode()
        assert health_record_importer_registry.detect(data, "a.json").FORMAT_KEY == (
            "fhir_bundle"
        )
        assert health_record_importer_registry.detect(b"hello", "a.txt") is None

    def test_lists_formats_and_extensions(self):
        """Test that the registry reports its formats and extensions."""
        formats = health_record_importer_registry.get_available_formats()
        assert {f["key"] for f in formats} >= {"fhir_bundle"}
        assert "json" in health_record_importer_registry.allowed_extensions()
