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
from app.services.importers.provenance import _normalize, content_hash


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
        with pytest.raises(ImportFormatError, match="^Unsafe path in archive$"):
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
        with pytest.raises(
            ImportFormatError,
            match="^An archive entry is 11 bytes, over the 10 byte limit$",
        ):
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
        with pytest.raises(
            ImportFormatError,
            match="^An archive entry is corrupt or larger than its header claims$",
        ):
            list(upload.iter_zip_members(bytes(data), (".xml",)))

    def test_rejects_compression_methods_other_than_deflate(self):
        """Test that bzip2, LZMA and Zstandard members are refused before being read.

        zipfile expands a whole bzip2 or LZMA chunk at once, so a small member of
        those kinds can cost gigabytes; MyChart zips use deflate.
        """
        methods = [zipfile.ZIP_BZIP2, zipfile.ZIP_LZMA]
        if hasattr(zipfile, "ZIP_ZSTANDARD"):  # Python 3.14+
            methods.append(zipfile.ZIP_ZSTANDARD)
        for method in methods:
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, "w", method) as zf:
                zf.writestr("DOC0001.XML", "<a/>" * 50)
            with pytest.raises(
                ImportFormatError,
                match="^An archive entry is encrypted or uses an unsupported format$",
            ):
                list(upload.iter_zip_members(buf.getvalue(), (".xml",)))

    def test_understated_header_does_not_expand_the_whole_stream(self):
        """Test that a member is read in bounded pieces, not expanded in full first.

        The caps compare the header's file_size, which the uploader writes. With
        the size understated, zipfile truncates to it, so the read must stop there
        instead of inflating the whole stream and then cutting it.
        """
        import tracemalloc
        import zlib

        payload = b"\0" * (64 * 1024 * 1024)
        claimed = 100
        data = bytearray(_zip({"DOC0001.XML": payload}))
        # Say the member is 100 bytes, with the CRC those 100 bytes would have, in
        # both the local header and the central directory
        crc = zlib.crc32(payload[:claimed])
        for offset in (data.find(b"PK\x03\x04") + 14, data.rfind(b"PK\x01\x02") + 16):
            data[offset : offset + 4] = crc.to_bytes(4, "little")
            data[offset + 8 : offset + 12] = claimed.to_bytes(4, "little")
        tracemalloc.start()
        try:
            members = list(upload.iter_zip_members(bytes(data), (".xml",)))
            _, peak = tracemalloc.get_traced_memory()
        finally:
            tracemalloc.stop()
        assert members == [("DOC0001.XML", payload[:claimed])]
        assert peak < 8 * 1024 * 1024, f"peak {peak // 1048576} MB"

    def test_rejects_encrypted_member(self):
        """Test that an encrypted member is rejected without naming it."""
        data = bytearray(_zip({"Smith_John/DOC0001.XML": "<a/>"}))
        # Set the encryption flag in the local and central headers
        data[6] |= 1
        cd = data.rfind(b"PK\x01\x02")
        data[cd + 8] |= 1
        with pytest.raises(
            ImportFormatError,
            match="^An archive entry is encrypted or uses an unsupported format$",
        ):
            list(upload.iter_zip_members(bytes(data), (".xml",)))

    def test_rejects_unsupported_compression(self):
        """Test that a compression method zipfile cannot read is rejected."""
        data = bytearray(_zip({"DOC0001.XML": "<a/>"}))
        # Method 9 is Deflate64, which zipfile does not implement
        data[8] = 9
        cd = data.rfind(b"PK\x01\x02")
        data[cd + 10] = 9
        with pytest.raises(
            ImportFormatError,
            match="^An archive entry is encrypted or uses an unsupported format$",
        ):
            list(upload.iter_zip_members(bytes(data), (".xml",)))

    def test_rejects_zip_needing_a_newer_version(self):
        """Test that a zip needing a newer version than zipfile reads is rejected."""
        data = bytearray(_zip({"DOC0001.XML": "<a/>"}))
        cd = data.rfind(b"PK\x01\x02")
        data[cd + 6] = 0xFF
        with pytest.raises(
            ImportFormatError,
            match="^The zip file uses a format that is not supported$",
        ):
            list(upload.iter_zip_members(bytes(data), (".xml",)))

    def test_rejects_undecodable_member_name(self):
        """Test that a central directory zipfile cannot parse is not a valid zip."""
        data = bytearray(_zip({"a.xml": "<a/>"}))
        # Flag the name as UTF-8 and make it invalid UTF-8
        cd = data.rfind(b"PK\x01\x02")
        data[cd + 9] |= 0x08
        data[cd + 46] = 0xFF
        with pytest.raises(
            ImportFormatError, match="^File is not a valid zip archive$"
        ):
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
        assert content_hash(["007"]) != content_hash(["7"])
        assert content_hash(["0.5"]) == content_hash([0.5])

    def test_extreme_numbers_hash_as_text(self):
        """Test that values past the decimal context fall back to text instead of raising."""
        for value in ("1e1000000", "-1E999999", float("inf"), float("nan")):
            assert content_hash([value]) == content_hash([str(value).lower()])
        assert content_hash(["1e1000000"]) != content_hash(["1e1000001"])

    def test_extreme_exponents_are_not_written_out(self):
        """Test that 1e-999990 is hashed by value in a short form, not as a million digits."""
        same = ["1e-999990", "0.1e-999989", Decimal("1e-999990"), "10e-999991"]
        assert len({content_hash([value]) for value in same}) == 1
        assert content_hash(["1e-999990"]) != content_hash(["1e-999991"])
        assert content_hash(["1e60"]) != content_hash(["1e61"])
        for value in ("1e-999990", "1e60", "-2.5e-70"):
            assert len(_normalize(value)) < 20, value
        # Numbers in the everyday range keep the plain form
        assert _normalize("1.2e2") == "120"
        assert _normalize("1e-50") == "0." + "0" * 49 + "1"


class TestFhirBundleImporter:
    """Test the FHIR bundle importer."""

    def test_accepts_bundle(self):
        """Test that a Bundle JSON validates and converts."""
        data = json.dumps({"resourceType": "Bundle", "entry": []}).encode()
        importer = FhirBundleImporter()
        assert importer.validate_format(data, "export.json")
        bundle, notes = importer.to_bundle(data, "export.json")
        assert (bundle["entry"], notes) == ([], [])

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
        assert not importer.validate_format(b'{"resourceType": "Patient"}', "a.json")

    def test_detection_parses_when_the_header_is_late(self):
        """Test that a Bundle whose resourceType follows a large entry list is detected."""
        importer = FhirBundleImporter()
        entries = [{"resource": {"resourceType": "Condition", "id": "x" * 100}}] * 100
        data = json.dumps(
            {"resourceType": "Bundle", "entry": entries}, sort_keys=True
        ).encode()
        assert data.index(b'"resourceType": "Bundle"') > 4096
        assert importer.validate_format(data, "a.json")
        late_patient = json.dumps(
            {"entry": entries, "resourceType": "Patient"}
        ).encode()
        assert not importer.validate_format(late_patient, "a.json")
        assert not importer.validate_format(b"not json" + b" " * 5000, "a.json")

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
