"""
Tests for the C-CDA importer: format detection, conversion through
healthrecord-bridge, zip handling and the missing-library message.
"""

import io
import re
import sys
import time
import zipfile
from datetime import date, datetime, timezone
from itertools import permutations
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.services import importers
from app.services.importers import (
    CcdaImporter,
    HealthRecordImporterRegistry,
    ImportFormatError,
    ccda_available,
    ccda_importer,
    health_record_importer_registry,
    upload,
)
from app.services.importers.ccda_importer import (
    INVALID_DOCUMENT_MESSAGE,
    MAX_NOTE_TEXT,
    MAX_NOTES,
    MISSING_LIBRARY_MESSAGE,
    PATIENT_ID_BIRTH_DATES_MESSAGE,
    SHARED_RECORD_IDS_MESSAGE,
    UNSAFE_DOCUMENT_MESSAGE,
    _conflict_notes,
    _document_date,
    _keep_exact_birth_dates,
    _patient_birth_dates,
    _referred,
    _report_notes,
    looks_like_ccda,
)
from app.services.importers.mappers import (
    BaseResourceMapper,
    resource_mapper_registry,
)
from app.services.importers.patient_match import compare_patient

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


def _with_prolog(xml: bytes, prolog: bytes) -> bytes:
    """The fixture with its XML declaration followed by extra prolog text."""
    declaration, rest = xml.split(b"?>", 1)
    return declaration + b"?>" + prolog + rest


def _same_person_under_another_id(xml: bytes) -> bytes:
    """The fixture as a second document of the same person, whose Patient gets another id.

    The converter takes the Patient id from the first patientRole id, so the
    two are swapped. The entry ids stay the fixture's own.
    """
    first = b'      <id root="1.2.840.114350.1.13.999.2.7.5.737384.14" extension="E1234567"/>\n'
    second = b'      <id root="1.2.840.114350.1.13.999.2.7.3.688884.100" extension="MRN00042"/>\n'
    assert first + second in xml
    return xml.replace(first + second, second + first).replace(
        b'extension="CCD-2024-000042"', b'extension="CCD-2024-000043"'
    )


def _without_patient_ids(xml: bytes, document_id: bytes) -> bytes:
    """The fixture with a patientRole id of nullFlavor, so the Patient id comes from the document id."""
    first = b'      <id root="1.2.840.114350.1.13.999.2.7.5.737384.14" extension="E1234567"/>\n'
    second = b'      <id root="1.2.840.114350.1.13.999.2.7.3.688884.100" extension="MRN00042"/>\n'
    assert first + second in xml
    return xml.replace(first + second, b'      <id nullFlavor="UNK"/>\n').replace(
        b'extension="CCD-2024-000042"', b'extension="' + document_id + b'"'
    )


def _patients(bundle: dict) -> list:
    return [
        e["resource"]
        for e in bundle["entry"]
        if e["resource"]["resourceType"] == "Patient"
    ]


def _count(bundle: dict, resource_type: str) -> int:
    return sum(e["resource"]["resourceType"] == resource_type for e in bundle["entry"])


def _later_copy(xml: bytes) -> bytes:
    """A newer version of the fixture: later document date, one problem's onset corrected."""
    return xml.replace(
        b'<effectiveTime value="20240315143000-0500"/>',
        b'<effectiveTime value="20240601090000-0500"/>',
        1,
    ).replace(b'<low value="20180214"/>', b'<low value="20180301"/>')


# Entries and resources no converter should produce, one per way of being malformed
MALFORMED_ENTRIES = [
    None,
    "entry",
    [],
    {},
    {"resource": None},
    {"resource": "Patient"},
    {"resource": ["Patient"]},
    {"resource": {}},
    {"resource": {"id": "jane"}},
    {"resource": {"resourceType": None, "id": "jane"}},
    {"resource": {"resourceType": ["Patient"], "id": "jane"}},
    {"resource": {"resourceType": "Patient"}},
    {"resource": {"resourceType": "Patient", "id": None}},
    {"resource": {"resourceType": "Patient", "id": ["jane"]}},
    {"resource": {"resourceType": "Patient", "id": {"value": "jane"}}},
    {"resource": {"resourceType": "Condition"}},
    {"resource": {"resourceType": "Condition", "id": ["c1"], "subject": "jane"}},
    {"resource": {"resourceType": "DocumentReference", "date": ["2024"]}},
]
MALFORMED_BUNDLES = [{}, {"entry": None}, {"entry": "entries"}, {"entry": {"a": 1}}]


def _fake_converter(monkeypatch, bundles: dict):
    """Make the converter return the given bundle for each document name."""
    import healthrecord_bridge.ccda

    def convert(data, name):
        return bundles[name], SimpleNamespace(documents=[])

    monkeypatch.setattr(healthrecord_bridge.ccda, "convert_bytes", convert)


def _stub_zip(*names: str) -> bytes:
    """A zip of empty C-CDA documents under the given names."""
    return _zip({name: '<ClinicalDocument xmlns="urn:hl7-org:v3"/>' for name in names})


class TestLooksLikeCcda:
    """Test the root element check used to pick documents out of an upload."""

    def test_long_comment_before_the_root_element(self):
        """Test that a comment longer than any fixed sniff window does not hide the root."""
        data = _with_prolog(
            MYCHART_CCD.read_bytes(), b"<!-- " + b"x" * 100_000 + b" -->"
        )
        assert looks_like_ccda(data)
        assert CcdaImporter().validate_format(_xdm_zip(data), "export.zip")

    def test_utf8_byte_order_mark(self):
        """Test that a UTF-8 byte order mark before the declaration is accepted."""
        assert looks_like_ccda(b"\xef\xbb\xbf" + MYCHART_CCD.read_bytes())

    def test_utf16_with_long_comment(self):
        """Test that the UTF-16 check also reads past a long comment."""
        text = MYCHART_CCD.read_text(encoding="utf-8").replace(
            'encoding="UTF-8"', 'encoding="UTF-16"', 1
        )
        text = text.replace("?>", "?><!-- " + "x" * 100_000 + " -->", 1)
        assert looks_like_ccda(text.encode("utf-16"))

    def test_processing_instruction_and_doctype_are_skipped(self):
        """Test that a stylesheet instruction or a DOCTYPE before the root is read past."""
        xml = MYCHART_CCD.read_bytes()
        assert looks_like_ccda(
            _with_prolog(xml, b'<?xml-stylesheet type="text/xsl" href="cda.xsl"?>')
        )
        assert looks_like_ccda(
            _with_prolog(xml, b"<!DOCTYPE ClinicalDocument [<!ENTITY a 'b'>]>")
        )

    def test_root_must_be_clinical_document(self):
        """Test that the words appearing inside another root element do not count."""
        data = b'<root xmlns="urn:hl7-org:v3"><ClinicalDocument/></root>'
        assert not looks_like_ccda(data)
        assert not looks_like_ccda(b'<ClinicalDocumentation xmlns="urn:hl7-org:v3"/>')
        assert not looks_like_ccda(b'<ClinicalDocument xmlns="urn:other"/>')

    def test_namespace_prefix_on_the_root(self):
        """Test that a prefixed root element is accepted."""
        data = (
            b'<cda:ClinicalDocument xmlns:cda="urn:hl7-org:v3"></cda:ClinicalDocument>'
        )
        assert looks_like_ccda(data)

    def test_namespace_must_be_bound_to_the_root(self):
        """Test that a CDA namespace declared for another prefix does not qualify the root."""
        assert not looks_like_ccda(
            b'<ClinicalDocument xmlns="urn:other" xmlns:cda="urn:hl7-org:v3"/>'
        )
        assert not looks_like_ccda(
            b'<cda:ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:cda="urn:other"/>'
        )
        assert not looks_like_ccda(b'<ClinicalDocument xmlns:cda="urn:hl7-org:v3"/>')
        assert not looks_like_ccda(
            b"<ClinicalDocument note=\"xmlns='urn:hl7-org:v3'\" xmlns='urn:other'/>"
        )
        assert not looks_like_ccda(b"<ClinicalDocument/>")

    def test_root_attributes_in_any_legal_form(self):
        """Test single quotes, spaces round the equals sign and a '>' inside a value."""
        assert looks_like_ccda(b"<x:ClinicalDocument xmlns:x='urn:hl7-org:v3'/>")
        assert looks_like_ccda(b'<ClinicalDocument xmlns = "urn:hl7-org:v3">')
        assert looks_like_ccda(
            b'<ClinicalDocument\n  title="a > b"\n  xmlns="urn:hl7-org:v3">'
        )

    def test_long_root_tag_is_read_in_linear_time(self):
        """Test that many attributes or an unclosed value on the root cost linear time."""
        tags = (
            b"<ClinicalDocument" + b' a="b"' * 200_000,
            b'<ClinicalDocument a="' + b"x" * (4 * 1024 * 1024),
            b"<ClinicalDocument" + b" " * (4 * 1024 * 1024),
            b"<ClinicalDocument " + b"a" * (4 * 1024 * 1024),
        )
        for tag in tags:
            start = time.monotonic()
            assert not looks_like_ccda(tag)
            assert time.monotonic() - start < 2.0

    def test_unclosed_prolog_is_rejected_quickly(self):
        """Test that megabytes of unterminated comment or instruction cost linear time."""
        heads = (
            b"<!--",
            b"<?",
            b"<!DOCTYPE x [",
            b"<!--" * 200_000,
            b"<!DOCTYPE a>" * 200_000,
            b"<?a?>" * 200_000,
        )
        for head in heads:
            data = head + b" " * (20 * 1024 * 1024)
            start = time.monotonic()
            assert not looks_like_ccda(data)
            assert time.monotonic() - start < 1.0


class TestConflictNotes:
    """Test the notes about records that documents in one upload describe differently."""

    WHEN = (
        None,
        datetime(2024, 3, 15, tzinfo=timezone.utc),
        datetime(2024, 6, 1, tzinfo=timezone.utc),
    )

    @staticmethod
    def _bundle(**conditions):
        return {
            "entry": [
                {"resource": {"resourceType": "Condition", "id": key, "code": value}}
                for key, value in conditions.items()
            ]
        }

    def _notes(self, *documents):
        """Notes for (index into WHEN, bundle) pairs, given oldest first."""
        return _conflict_notes([(self.WHEN[i], bundle) for i, bundle in documents])

    def test_identical_copies_give_no_note(self):
        """Test that the same content in two documents is not a conflict."""
        assert self._notes((1, self._bundle(a="x")), (2, self._bundle(a="x"))) == []

    def test_newer_document_decides(self):
        """Test that a later date is what the note credits."""
        notes = self._notes((1, self._bundle(a="x")), (2, self._bundle(a="y")))
        assert notes == [
            "1 record appears in more than one document with different content; "
            "the newest document's copy was kept"
        ]

    def test_undated_documents_do_not_claim_a_newest(self):
        """Test that two undated documents are reported as kept by position."""
        notes = self._notes((0, self._bundle(a="x")), (0, self._bundle(a="y")))
        assert len(notes) == 1
        assert "same date or no date" in notes[0]
        assert "newest" not in notes[0]

    def test_dated_document_beats_an_undated_one(self):
        """Test that a dated copy replacing an undated one is not called the newest."""
        notes = self._notes((0, self._bundle(a="x")), (1, self._bundle(a="y")))
        assert notes == [
            "1 record appears in more than one document with different content, "
            "and one of the documents has no date; "
            "the copy from the latest dated document was kept"
        ]

    def test_undated_copy_among_older_dated_ones_is_not_settled_by_date(self):
        """Test that one undated copy that differs is enough, wherever the dated ones are."""
        notes = self._notes(
            (0, self._bundle(a="w", b="w")),
            (1, self._bundle(a="x", b="x")),
            (2, self._bundle(a="y", b="y")),
        )
        assert notes == [
            "2 records appear in more than one document with different content, "
            "and one of the documents has no date; "
            "the copy from the latest dated document was kept"
        ]

    def test_undated_copy_equal_to_the_kept_one_does_not_decide(self):
        """Test that an undated copy with the kept content leaves the record settled by date."""
        notes = self._notes(
            (0, self._bundle(a="y")),
            (1, self._bundle(a="x")),
            (2, self._bundle(a="y")),
        )
        assert len(notes) == 1
        assert "newest" in notes[0]

    def test_same_date_comes_before_an_undated_copy(self):
        """Test that a record with a same-date copy and an undated one is counted once, by position."""
        notes = self._notes(
            (0, self._bundle(a="w")),
            (2, self._bundle(a="x")),
            (2, self._bundle(a="y")),
        )
        assert len(notes) == 1
        assert notes[0].startswith("1 record appears")
        assert "later in the zip" in notes[0]

    def test_each_record_is_counted_in_one_note(self):
        """Test the three notes together, in order, with every record in exactly one."""
        notes = self._notes(
            (0, self._bundle(b="w", c="w", d="w", e="w")),
            (0, self._bundle(e="x")),
            (1, self._bundle(a="x", b="x", c="x", d="w")),
            (2, self._bundle(a="y", b="y", c="x", d="y")),
            (2, self._bundle(c="z")),
        )
        assert notes == [
            "1 record appears in more than one document with different content; "
            "the newest document's copy was kept",
            "2 records appear in more than one document with different content, "
            "and one of the documents has no date; "
            "the copy from the latest dated document was kept",
            "2 records appear in more than one document with different content, "
            "and the documents have the same date or no date; "
            "the copy from the document later in the zip was kept",
        ]

    def test_both_kinds_are_counted_apart(self):
        """Test that records settled by date and by position each get their own count."""
        notes = self._notes(
            (1, self._bundle(a="x", b="x", c="x")),
            (2, self._bundle(a="y", b="y", c="x")),
            (2, self._bundle(c="z")),
        )
        assert notes == [
            "2 records appear in more than one document with different content; "
            "the newest document's copy was kept",
            "1 record appears in more than one document with different content, "
            "and the documents have the same date or no date; "
            "the copy from the document later in the zip was kept",
        ]

    def test_older_copy_equal_to_the_kept_one_is_not_a_tie(self):
        """Test that only copies that differ from the kept one decide the wording."""
        notes = self._notes(
            (1, self._bundle(a="x")),
            (2, self._bundle(a="y")),
            (2, self._bundle(a="y")),
        )
        assert len(notes) == 1
        assert "newest" in notes[0]

    @pytest.mark.parametrize("entry", MALFORMED_ENTRIES)
    def test_malformed_entry_is_skipped(self, entry):
        """Test that an entry without a usable resource, type or id is passed over."""
        older = self._bundle(a="x")
        newer = self._bundle(a="y")
        for bundle in (older, newer):
            bundle["entry"].insert(0, entry)
        assert self._notes((1, older), (2, newer)) == [
            "1 record appears in more than one document with different content; "
            "the newest document's copy was kept"
        ]

    @pytest.mark.parametrize("bundle", MALFORMED_BUNDLES)
    def test_bundle_without_an_entry_list_gives_no_note(self, bundle):
        """Test that a bundle whose entry is missing or not a list is read as empty."""
        assert self._notes((1, bundle), (2, self._bundle(a="x"))) == []


class TestDocumentDate:
    """Test reading the document date from a converted bundle."""

    @pytest.mark.parametrize("entry", MALFORMED_ENTRIES)
    def test_malformed_entry_is_skipped(self, entry):
        """Test that the date is still found past an entry that is malformed."""
        document = {
            "resource": {
                "resourceType": "DocumentReference",
                "id": "doc",
                "date": "2024-03-15T00:00:00Z",
            }
        }
        expected = datetime(2024, 3, 15, tzinfo=timezone.utc)
        if isinstance(entry, dict) and "date" in (entry.get("resource") or {}):
            expected = None
        assert _document_date({"entry": [entry, document]}) == expected

    @pytest.mark.parametrize("bundle", MALFORMED_BUNDLES)
    def test_bundle_without_an_entry_list_has_no_date(self, bundle):
        """Test that a bundle whose entry is missing or not a list has no date."""
        assert _document_date(bundle) is None


class TestPatientBirthDates:
    """Test the pass over the documents before the merge: ids reused for different people and the birth date of each Patient id."""

    JANE_BORN = "1984-07-22"
    ROBIN_BORN = "1975-01-01"

    @staticmethod
    def _bundle(patient, by="subject", birth=JANE_BORN, **extra):
        """One document: a Patient, a condition c1 that points at it and an organization."""
        condition = {"resourceType": "Condition", "id": "c1", **extra}
        if patient:
            condition[by] = {"reference": f"Patient/{patient}"}
        person = {"resourceType": "Patient", "id": patient or "nobody"}
        if birth:
            person["birthDate"] = birth
        resources = [
            person,
            condition,
            {"resourceType": "Organization", "id": "org"},
            {
                "resourceType": "DocumentReference",
                "id": "doc",
                "subject": {"reference": f"Patient/{patient}"},
            },
            {"resourceType": "Provenance", "id": "prov"},
        ]
        return {"entry": [{"resource": resource} for resource in resources]}

    def test_same_id_for_two_people_is_refused(self):
        """Test that one record id pointing at Patients born on different days stops the merge."""
        for by in ("subject", "patient"):
            with pytest.raises(ImportFormatError) as raised:
                _patient_birth_dates(
                    [
                        self._bundle("jane", by),
                        self._bundle("robin", by, birth=self.ROBIN_BORN),
                    ]
                )
            assert str(raised.value) == SHARED_RECORD_IDS_MESSAGE

    def test_one_person_under_two_patient_ids_is_merged(self):
        """Test that documents that give one person different Patient ids are not taken for two people."""
        _patient_birth_dates([self._bundle("jane"), self._bundle("jane-2")])

    @pytest.mark.parametrize("birth", ["1984", "1984-07", None, "soon", 1984])
    def test_other_patient_id_without_the_full_birth_date_is_refused(self, birth):
        """Test that a missing, unreadable or less exact birth date does not show that two Patient ids are one person."""
        for bundles in (
            [self._bundle("jane"), self._bundle("jane-2", birth=birth)],
            [self._bundle("jane-2", birth=birth), self._bundle("jane")],
        ):
            with pytest.raises(ImportFormatError) as raised:
                _patient_birth_dates(bundles)
            assert str(raised.value) == SHARED_RECORD_IDS_MESSAGE

    @pytest.mark.parametrize("birth", ["1975", "1984-08", "1984-07-23"])
    def test_birth_date_that_differs_in_any_part_is_refused(self, birth):
        """Test that a year or year and month is compared as far as it goes."""
        with pytest.raises(ImportFormatError) as raised:
            _patient_birth_dates(
                [self._bundle("jane"), self._bundle("robin", birth=birth)]
            )
        assert str(raised.value) == SHARED_RECORD_IDS_MESSAGE

    def test_patient_missing_from_its_document_is_merged(self):
        """Test that a record whose Patient is not in its own document is not refused."""
        other = self._bundle("robin", birth=self.ROBIN_BORN)
        other["entry"][1]["resource"]["subject"] = {"reference": "Patient/elsewhere"}
        _patient_birth_dates([self._bundle("jane"), other])

    def test_reference_is_looked_up_in_its_own_document(self):
        """Test that a record goes by the Patient its reference names, not by the first Patient of its document."""
        robin = self._bundle("jane", birth=None)
        robin["entry"][1]["resource"]["subject"] = {"reference": "Patient/robin"}
        robin["entry"].append(
            {
                "resource": {
                    "resourceType": "Patient",
                    "id": "robin",
                    "birthDate": self.ROBIN_BORN,
                }
            }
        )
        with pytest.raises(ImportFormatError) as raised:
            _patient_birth_dates([self._bundle("jane"), robin])
        assert str(raised.value) == SHARED_RECORD_IDS_MESSAGE

    def test_patient_id_read_in_another_document_does_not_decide(self):
        """Test that a reference is not followed to a Patient that only another document has."""
        sam = self._bundle("sam", birth=None)
        sam["entry"][1]["resource"]["subject"] = {"reference": "Patient/robin"}
        other = self._bundle("robin", birth=self.ROBIN_BORN)
        other["entry"][1]["resource"]["id"] = "other"
        # c1 is jane's in the first document; in the third nothing says whose it is
        _patient_birth_dates([self._bundle("jane"), other, sam])

    def test_copy_without_a_birth_date_does_not_hide_a_later_difference(self):
        """Test that every copy with a birth date is compared, whatever lies between them."""
        with pytest.raises(ImportFormatError) as raised:
            _patient_birth_dates(
                [
                    self._bundle("a", birth="1984"),
                    self._bundle("b", birth=None),
                    self._bundle("c", birth="1984-07-22"),
                    self._bundle("d", birth="1984-08"),
                ]
            )
        assert str(raised.value) == SHARED_RECORD_IDS_MESSAGE

    def test_one_patient_id_with_two_birth_dates_is_refused(self):
        """Test that two people under one Patient id are not merged into one."""
        for first, second in (
            (self.JANE_BORN, self.ROBIN_BORN),
            (self.ROBIN_BORN, self.JANE_BORN),
            ("1975", self.JANE_BORN),
        ):
            other = self._bundle("jane", birth=second)
            # No record id is shared: the Patient alone is the collision
            other["entry"][1]["resource"]["id"] = "c2"
            with pytest.raises(ImportFormatError) as raised:
                _patient_birth_dates([self._bundle("jane", birth=first), other])
            assert str(raised.value) == PATIENT_ID_BIRTH_DATES_MESSAGE

    @pytest.mark.parametrize("birth", [JANE_BORN, "1984", None, "soon"])
    def test_one_patient_id_with_birth_dates_that_agree_is_merged(self, birth):
        """Test that one Patient id is merged when no document gives it another birth date."""
        _patient_birth_dates([self._bundle("jane"), self._bundle("jane", birth=birth)])

    def test_patient_copy_without_a_birth_date_does_not_hide_a_later_difference(self):
        """Test that a Patient id is checked against every earlier copy with a birth date."""
        with pytest.raises(ImportFormatError) as raised:
            _patient_birth_dates(
                [
                    self._bundle("jane", birth="1975"),
                    self._bundle("jane", birth=None),
                    self._bundle("jane", birth="1975-01-01"),
                    self._bundle("jane", birth="1975-02"),
                ]
            )
        assert str(raised.value) == PATIENT_ID_BIRTH_DATES_MESSAGE

    def test_less_exact_copy_between_two_months_does_not_hide_the_difference(self):
        """Test that a year after one month does not let another month of that year pass."""
        with pytest.raises(ImportFormatError) as raised:
            _patient_birth_dates(
                [
                    self._bundle("a", birth="1984-07"),
                    self._bundle("b", birth="1984"),
                    self._bundle("c", birth="1984-08"),
                ]
            )
        assert str(raised.value) == SHARED_RECORD_IDS_MESSAGE

    def test_less_exact_patient_copy_between_two_months_does_not_hide_the_difference(
        self,
    ):
        """Test that a Patient id is held to the most exact birth date given for it so far."""
        bundles = []
        for i, birth in enumerate(("1984-07", "1984", "1984-08")):
            bundle = self._bundle("jane", birth=birth)
            # No record id is shared: the Patient alone is the collision
            bundle["entry"][1]["resource"]["id"] = f"c{i}"
            bundles.append(bundle)
        with pytest.raises(ImportFormatError) as raised:
            _patient_birth_dates(bundles)
        assert str(raised.value) == PATIENT_ID_BIRTH_DATES_MESSAGE

    @pytest.mark.parametrize(
        "births",
        [
            ("1984-07-22", "1984"),
            ("1984", "1984-07-22"),
            ("1984-07", "1984-07-22", None, "1984", "soon"),
        ],
    )
    def test_most_exact_birth_date_of_each_patient_id_is_returned(self, births):
        """Test that the result holds, per Patient id, the birth date with the most parts, in any order."""
        bundles = [self._bundle("jane", birth=birth) for birth in births]
        robin = self._bundle("robin", birth="1975")
        # Another person, so with a record id of their own
        robin["entry"][1]["resource"]["id"] = "c2"
        sam = self._bundle("sam", birth=None)
        sam["entry"][1]["resource"]["id"] = "c3"
        bundles.extend([robin, sam])
        assert _patient_birth_dates(bundles) == {
            "jane": (1984, 7, 22),
            "robin": (1975,),
        }

    def _shared_record(self, partial, other):
        """Three documents: jane in full, jane as partial with c2, another Patient id with c2."""
        documents = [
            self._bundle("jane"),
            self._bundle("jane", birth=partial),
            self._bundle("robin", birth=other),
        ]
        for document in documents[1:]:
            document["entry"][1]["resource"]["id"] = "c2"
        return documents

    @pytest.mark.parametrize("partial", ["1984", None, "soon"])
    @pytest.mark.parametrize("other", ["1984-08-01", "1984-07", "1984", None])
    @pytest.mark.parametrize("order", list(permutations(range(3))))
    def test_record_is_held_to_the_birth_date_another_document_gives_its_patient(
        self, order, other, partial
    ):
        """Test that a record of a Patient id goes by the full birth date, wherever the document that gives it comes."""
        documents = self._shared_record(partial, other)
        with pytest.raises(ImportFormatError) as raised:
            _patient_birth_dates([documents[i] for i in order])
        assert str(raised.value) == SHARED_RECORD_IDS_MESSAGE

    @pytest.mark.parametrize("partial", ["1984", None, "soon"])
    @pytest.mark.parametrize("order", list(permutations(range(3))))
    def test_record_of_one_person_is_merged_with_the_full_birth_date_known(
        self, order, partial
    ):
        """Test that the full birth date from another document lets a Patient id with the same one share the record."""
        documents = self._shared_record(partial, self.JANE_BORN)
        assert _patient_birth_dates([documents[i] for i in order])["jane"] == (
            1984,
            7,
            22,
        )

    def _reused_record(self, birth):
        """Three documents: x with c1 and only `birth`, y born another day with c1, x's person in full as z with c2."""
        again = self._bundle("z")
        again["entry"][1]["resource"]["id"] = "c2"
        return [
            self._bundle("x", birth=birth),
            self._bundle("y", birth="1984-08-01"),
            again,
        ]

    @pytest.mark.parametrize("birth", ["1984", "1984-07", None, "soon"])
    @pytest.mark.parametrize("order", list(permutations(range(3))))
    def test_record_of_a_patient_id_without_the_full_birth_date_is_not_replaced(
        self, order, birth
    ):
        """Test that another Patient id cannot share a record of one whose birth date is not given in full."""
        documents = self._reused_record(birth)
        with pytest.raises(ImportFormatError) as raised:
            _patient_birth_dates([documents[i] for i in order])
        assert str(raised.value) == SHARED_RECORD_IDS_MESSAGE

    @pytest.mark.parametrize(
        "births", [(None, None), ("soon", None), ("1984", "1984"), ("1984-07", "1984")]
    )
    def test_two_patient_ids_without_full_birth_dates_are_refused(self, births):
        """Test that nothing shows two Patient ids to be one person when neither has a full birth date."""
        for first, second in (births, births[::-1]):
            with pytest.raises(ImportFormatError) as raised:
                _patient_birth_dates(
                    [self._bundle("x", birth=first), self._bundle("y", birth=second)]
                )
            assert str(raised.value) == SHARED_RECORD_IDS_MESSAGE

    @pytest.mark.parametrize(
        "births, known",
        [
            ((None, None), None),
            (("1984", None), (1984,)),
            (("1984", "1984-07"), (1984, 7)),
            (("soon", "1984"), (1984,)),
        ],
    )
    def test_one_patient_id_without_a_full_birth_date_is_merged(self, births, known):
        """Test that copies under one Patient id need no birth date to be merged."""
        for first, second in (births, births[::-1]):
            born = _patient_birth_dates(
                [self._bundle("x", birth=first), self._bundle("x", birth=second)]
            )
            assert born.get("x") == known

    @pytest.mark.parametrize("order", list(permutations(range(3))))
    def test_three_patient_ids_with_one_full_birth_date_are_merged(self, order):
        """Test that any number of Patient ids share a record when all have the same full birth date."""
        documents = [self._bundle(patient) for patient in ("x", "y", "z")]
        _patient_birth_dates([documents[i] for i in order])

    @pytest.mark.parametrize("birth", ["1984", None, "1984-07-23"])
    @pytest.mark.parametrize("order", list(permutations(range(3))))
    def test_third_patient_id_without_the_same_full_birth_date_is_refused(
        self, order, birth
    ):
        """Test that every Patient id of a record is checked, wherever its document comes."""
        documents = [
            self._bundle("x"),
            self._bundle("z"),
            self._bundle("y", birth=birth),
        ]
        with pytest.raises(ImportFormatError) as raised:
            _patient_birth_dates([documents[i] for i in order])
        assert str(raised.value) == SHARED_RECORD_IDS_MESSAGE

    def test_many_patient_ids_of_one_record_are_checked_in_linear_time(self):
        """Test that a record is not compared with every earlier copy."""
        documents = [self._bundle(f"p{i}") for i in range(20_000)]
        start = time.monotonic()
        _patient_birth_dates(documents)
        assert time.monotonic() - start < 5.0

    def test_same_id_for_one_person_is_merged(self):
        """Test that two versions of one person's record are left to the merge."""
        _patient_birth_dates(
            [self._bundle("jane", code="x"), self._bundle("jane", code="y")]
        )

    def test_copy_without_a_patient_is_ignored(self):
        """Test that a copy with no subject does not count as another person's."""
        _patient_birth_dates(
            [self._bundle("jane"), self._bundle(None), self._bundle("jane")]
        )

    def test_same_id_under_another_type_is_not_a_collision(self):
        """Test that the resource type is part of what has to be shared."""
        other = self._bundle("robin", birth=self.ROBIN_BORN)
        other["entry"][1]["resource"]["resourceType"] = "Observation"
        _patient_birth_dates([self._bundle("jane"), other])

    def test_many_documents_are_checked_in_linear_time(self):
        """Test that the check walks each document once."""
        bundle = {
            "entry": [
                {
                    "resource": {
                        "resourceType": "Patient",
                        "id": "jane",
                        "birthDate": self.JANE_BORN,
                    }
                },
                *(
                    {
                        "resource": {
                            "resourceType": "Condition",
                            "id": f"c{i}",
                            "subject": {"reference": "Patient/jane"},
                        }
                    }
                    for i in range(2_000)
                ),
            ]
        }
        start = time.monotonic()
        _patient_birth_dates([bundle] * 200)
        assert time.monotonic() - start < 5.0

    @pytest.mark.parametrize("entry", MALFORMED_ENTRIES)
    def test_malformed_entry_is_skipped(self, entry):
        """Test that an entry without a usable resource, type or id is passed over and the rest is still checked."""
        jane = self._bundle("jane")
        jane["entry"].insert(0, entry)
        assert _patient_birth_dates([jane, self._bundle("jane")]) == {
            "jane": (1984, 7, 22)
        }
        with pytest.raises(ImportFormatError) as raised:
            _patient_birth_dates([jane, self._bundle("robin", birth=self.ROBIN_BORN)])
        assert str(raised.value) == SHARED_RECORD_IDS_MESSAGE

    @pytest.mark.parametrize("bundle", MALFORMED_BUNDLES)
    def test_bundle_without_an_entry_list_is_read_as_empty(self, bundle):
        """Test that a bundle whose entry is missing or not a list holds nothing to check."""
        assert _patient_birth_dates([bundle, self._bundle("jane")]) == {
            "jane": (1984, 7, 22)
        }

    def test_patient_field_of_a_mapper_is_read(self):
        """Test that a record's person is found through the field its mapper declares."""

        class CoverageMapper(BaseResourceMapper):
            RESOURCE_TYPE = "Coverage"
            PATIENT_REFERENCE_FIELD = "beneficiary"
            map = hash_parts_for_row = None

        def coverage(patient, birth):
            bundle = self._bundle(patient, by="beneficiary", birth=birth)
            bundle["entry"][1]["resource"]["resourceType"] = "Coverage"
            return bundle

        documents = [
            coverage("jane", self.JANE_BORN),
            coverage("robin", self.ROBIN_BORN),
        ]
        _patient_birth_dates(documents)
        resource_mapper_registry.register(CoverageMapper())
        try:
            with pytest.raises(ImportFormatError) as raised:
                _patient_birth_dates(documents)
        finally:
            resource_mapper_registry.unregister("Coverage")
        assert str(raised.value) == SHARED_RECORD_IDS_MESSAGE


class TestSharedMedication:
    """Test the check of records that name no patient and that a stored record reads through a reference."""

    JANE = ("jane", "1984-07-22")
    ROBIN = ("robin", "1975-01-01")

    @staticmethod
    def _document(patient, birth, drug, source="a", patients=None, **medication):
        """One document: its Patient, a statement of theirs and the Medication med-1 it refers to."""
        people = [
            {
                "resourceType": "Patient",
                "id": key,
                **({"birthDate": born} if born else {}),
            }
            for key, born in (patients if patients is not None else [(patient, birth)])
        ]
        resources = [
            *people,
            {
                "resourceType": "MedicationStatement",
                "id": f"{patient}-statement",
                "subject": {"reference": f"Patient/{patient}"},
                "medicationReference": {"reference": "Medication/med-1"},
            },
            {
                "resourceType": "Medication",
                "id": "med-1",
                "meta": {"source": source},
                "code": {"text": drug},
                **medication,
            },
        ]
        return {"entry": [{"resource": resource} for resource in resources]}

    def _refused(self, *documents):
        for order in permutations(documents):
            with pytest.raises(ImportFormatError) as raised:
                _patient_birth_dates(list(order))
            assert str(raised.value) == SHARED_RECORD_IDS_MESSAGE

    def _merged(self, *documents):
        for order in permutations(documents):
            _patient_birth_dates(list(order))

    def test_differing_copies_of_two_people_are_refused(self):
        """Test that one person's statement cannot end up pointing at another person's drug."""
        self._refused(
            self._document(*self.JANE, "lisinopril"),
            self._document(*self.ROBIN, "metformin"),
        )

    def test_identical_copies_of_two_people_are_merged(self):
        """Test that the same content under one id is shared, whatever document it was converted from."""
        self._merged(
            self._document(*self.JANE, "lisinopril", source="a"),
            self._document(*self.ROBIN, "lisinopril", source="b"),
        )

    def test_differing_copies_of_one_patient_id_are_merged(self):
        """Test that two versions of one person's medication are left to the merge."""
        self._merged(
            self._document(*self.JANE, "lisinopril"),
            self._document(*self.JANE, "lisinopril 10 mg"),
        )

    def test_differing_copies_under_two_patient_ids_of_one_person_are_merged(self):
        """Test that the same full birth date is enough, as for records that name their patient."""
        self._merged(
            self._document(*self.JANE, "lisinopril"),
            self._document("jane-2", "1984-07-22", "lisinopril 10 mg"),
        )

    @pytest.mark.parametrize("birth", ["1984", "1984-07", None, "1984-07-23"])
    def test_differing_copies_under_patient_ids_not_known_to_be_one_person_are_refused(
        self, birth
    ):
        """Test that a year, a year and month, no birth date or another day does not confirm one person."""
        self._refused(
            self._document(*self.JANE, "lisinopril"),
            self._document("jane-2", birth, "metformin"),
        )

    def test_person_whose_copy_is_the_same_as_the_first_is_still_checked(self):
        """Test that everyone with a copy has to be one person once any two copies differ."""
        self._refused(
            self._document(*self.JANE, "lisinopril"),
            self._document(*self.ROBIN, "lisinopril"),
            self._document("jane-2", "1984-07-22", "metformin"),
        )

    def test_any_field_but_meta_is_a_difference(self):
        """Test that the whole content is compared, not the name alone."""
        self._refused(
            self._document(*self.JANE, "lisinopril"),
            self._document(*self.ROBIN, "lisinopril", form={"text": "tablet"}),
        )

    @pytest.mark.parametrize(
        "patients", [[], [("jane", "1984-07-22"), ("sam", "1984-07-22")]]
    )
    def test_document_without_exactly_one_patient(self, patients):
        """Test that a document of nobody or of several people shares only identical copies."""
        jane = self._document(*self.JANE, "lisinopril")
        self._merged(
            jane, self._document("robin", None, "lisinopril", patients=patients)
        )
        self._refused(
            jane, self._document("robin", None, "metformin", patients=patients)
        )

    def test_two_documents_without_a_patient(self):
        """Test that differing copies in documents of nobody are refused too."""
        self._refused(
            self._document("a", None, "lisinopril", patients=[]),
            self._document("b", None, "metformin", patients=[]),
        )

    def test_repeat_of_the_patient_in_one_document_is_one_patient(self):
        """Test that a document that lists its one Patient twice is still that person's."""
        twice = [self.JANE, self.JANE]
        self._merged(
            self._document(*self.JANE, "lisinopril"),
            self._document(*self.JANE, "lisinopril 10 mg", patients=twice),
        )

    def test_copies_within_one_document_are_not_compared(self):
        """Test that the check is between documents: one document alone is never refused."""
        document = self._document(*self.JANE, "lisinopril", patients=[])
        document["entry"].append(
            {"resource": {"resourceType": "Medication", "id": "med-1", "code": {}}}
        )
        self._merged(document)

    def test_differing_organizations_of_two_people_are_merged(self):
        """Test that a record no stored record reads from, such as the custodian, is not held to this."""

        def with_organization(document, name):
            document["entry"].append(
                {
                    "resource": {
                        "resourceType": "Organization",
                        "id": "org",
                        "name": name,
                    }
                }
            )
            return document

        self._merged(
            with_organization(self._document(*self.JANE, "lisinopril"), "Clinic"),
            with_organization(self._document(*self.ROBIN, "lisinopril"), "Clinic East"),
        )

    def test_medication_that_names_a_patient_goes_by_that_patient(self):
        """Test that a subject on such a record is checked as on any other record."""
        jane = self._document(*self.JANE, "lisinopril")
        robin = self._document(*self.ROBIN, "lisinopril")
        for document, patient in ((jane, "jane"), (robin, "robin")):
            document["entry"][-1]["resource"]["subject"] = {
                "reference": f"Patient/{patient}"
            }
        self._refused(jane, robin)

    @staticmethod
    def _subject(patient):
        return {"reference": f"Patient/{patient}"}

    def test_copy_that_names_its_patient_is_compared_with_one_that_does_not(self):
        """Test that differing copies of two people are refused when only one copy has a subject."""
        self._refused(
            self._document(*self.JANE, "aspirin", subject=self._subject("jane")),
            self._document(*self.ROBIN, "warfarin"),
        )
        self._refused(
            self._document(*self.JANE, "aspirin"),
            self._document(*self.ROBIN, "warfarin", subject=self._subject("robin")),
        )

    def test_copies_with_and_without_a_subject_in_three_documents(self):
        """Test that every copy is checked, whichever of three documents names its patient."""
        for named in range(3):
            people = [self.JANE, ("jane-2", "1984-07-22"), self.ROBIN]
            documents = [
                self._document(
                    *person,
                    f"drug {place}",
                    **({"subject": self._subject(person[0])} if place == named else {}),
                )
                for place, person in enumerate(people)
            ]
            self._refused(*documents)
            self._merged(*documents[:2])

    def test_copies_of_one_person_with_and_without_a_subject_are_merged(self):
        """Test that a subject on one copy does not make another person of the same patient."""
        named = self._document(*self.JANE, "aspirin", subject=self._subject("jane"))
        self._merged(named, self._document(*self.JANE, "aspirin 81 mg"))
        self._merged(
            named,
            self._document("jane-2", "1984-07-22", "aspirin 81 mg"),
            self._document(*self.JANE, "aspirin"),
        )

    def test_copy_goes_by_the_patient_it_names_among_several(self):
        """Test that a subject says whose a copy is in a document of several people."""
        both = [self.JANE, self.ROBIN]
        other = self._document(*self.JANE, "aspirin 81 mg")
        self._merged(
            self._document(
                *self.JANE, "aspirin", patients=both, subject=self._subject("jane")
            ),
            other,
        )
        self._refused(
            self._document(
                *self.JANE, "aspirin", patients=both, subject=self._subject("robin")
            ),
            other,
        )

    def test_subject_that_names_no_patient_of_its_document_does_not_decide(self):
        """Test that a copy whose subject is not in its document goes by the document's one Patient."""
        stray = self._subject("sam")
        self._refused(
            self._document(*self.JANE, "aspirin", subject=stray),
            self._document(*self.ROBIN, "warfarin"),
        )
        self._merged(
            self._document(*self.JANE, "aspirin", subject=stray),
            self._document(*self.JANE, "warfarin"),
        )

    REFERENCE_FORMS = (
        "Medication/med-1",
        " Medication/med-1 ",
        "urn:uuid:med-1",
        "#med-1",
        "https://x.example/Medication/med-1",
    )

    def _referring(self, patient, birth, reference="Medication/med-1", **fields):
        """One document: its Patient and a statement that refers to a Medication the document does not hold."""
        document = self._document(patient, birth, "unused", **fields)
        del document["entry"][-1]
        document["entry"][-1]["resource"]["medicationReference"] = reference and {
            "reference": reference
        }
        return document

    @pytest.mark.parametrize("reference", REFERENCE_FORMS)
    def test_reference_to_a_medication_of_another_persons_document_is_refused(
        self, reference
    ):
        """Test that a statement cannot take its drug from a document of someone else."""
        self._refused(
            self._referring(*self.JANE, reference),
            self._document(*self.ROBIN, "metformin"),
        )

    def test_reference_by_full_url_to_an_id_with_a_slash_is_refused(self):
        """Test that urn:uuid:<id> counts as a reference to that whole id."""
        robin = self._document(*self.ROBIN, "metformin")
        robin["entry"][-1]["resource"]["id"] = "a/b"
        self._refused(self._referring(*self.JANE, "urn:uuid:a/b"), robin)

    @pytest.mark.parametrize("reference", REFERENCE_FORMS)
    def test_reference_to_a_medication_of_the_same_person_is_merged(self, reference):
        """Test that the same Patient id or the same full birth date lets the reference through."""
        self._merged(
            self._referring(*self.JANE, reference),
            self._document(*self.JANE, "lisinopril"),
        )
        self._merged(
            self._referring(*self.JANE, reference),
            self._document("jane-2", "1984-07-22", "lisinopril"),
            self._document(*self.JANE, "lisinopril 10 mg"),
        )

    @pytest.mark.parametrize("birth", ["1984", "1984-07", None, "1984-07-23"])
    def test_reference_to_a_medication_of_someone_not_known_to_be_the_same_is_refused(
        self, birth
    ):
        """Test that the reference is held to the rule for differing copies."""
        self._refused(
            self._referring(*self.JANE),
            self._document("jane-2", birth, "lisinopril"),
        )

    def test_reference_among_identical_copies_of_two_people_is_refused(self):
        """Test that a document without the Medication counts as a differing copy in three documents."""
        self._refused(
            self._referring(*self.JANE),
            self._document(*self.JANE, "lisinopril"),
            self._document(*self.ROBIN, "lisinopril"),
        )
        self._refused(
            self._referring("jane-2", "1984-07-22"),
            self._document(*self.JANE, "lisinopril"),
            self._referring(*self.ROBIN),
        )

    @pytest.mark.parametrize(
        "patients", [[], [("jane", "1984-07-22"), ("sam", "1984-07-22")]]
    )
    def test_reference_from_a_document_without_exactly_one_patient(self, patients):
        """Test that a statement goes by the Patient it names in its document, else by nobody."""
        referring = self._referring(*self.JANE, patients=patients)
        self._refused(referring, self._document(*self.ROBIN, "lisinopril"))
        if patients:
            self._merged(referring, self._document(*self.JANE, "lisinopril"))
        else:
            self._refused(referring, self._document(*self.JANE, "lisinopril"))

    def test_reference_to_a_medication_in_no_document_is_merged(self):
        """Test that documents of two people may refer to an id none of them holds."""
        self._merged(self._referring(*self.JANE), self._referring(*self.ROBIN))
        self._merged(
            self._referring(*self.JANE, "Medication/med-2"),
            self._document(*self.ROBIN, "metformin"),
        )

    def test_reference_to_a_contained_medication_is_merged(self):
        """Test that a statement that holds its own Medication refers to no other document."""
        jane = self._referring(*self.JANE, "#med-1")
        jane["entry"][-1]["resource"]["contained"] = [
            {"resourceType": "Medication", "id": "med-1", "code": {"text": "aspirin"}}
        ]
        self._merged(jane, self._document(*self.ROBIN, "metformin"))

    @pytest.mark.parametrize(
        "reference",
        [None, "", "Medication/", "urn:uuid:", "#", 5, ["Medication/med-1"], {}],
    )
    def test_malformed_reference_is_no_reference(self, reference):
        """Test that a reference value of the wrong type or without an id is passed over."""
        jane = self._referring(*self.JANE, None)
        statement = jane["entry"][-1]["resource"]
        robin = self._document(*self.ROBIN, "metformin")
        for value in (reference, {"reference": reference}):
            statement["medicationReference"] = value
            for contained in (None, "x", [5, {"id": ["med-1"]}]):
                statement["contained"] = contained
                self._merged(jane, robin)

    VERSIONED_FORMS = (
        "Medication/med-1/_history/2",
        "https://x.example/Medication/med-1/_history/2",
    )

    @pytest.mark.parametrize("reference", VERSIONED_FORMS)
    def test_versioned_reference_is_checked_by_its_id(self, reference):
        """Test that /_history/<version> is not read as the id referred to."""
        jane = self._referring(*self.JANE, reference)
        statement = jane["entry"][-1]["resource"]
        assert list(_referred(statement)) == [("Medication", "med-1")]
        self._refused(jane, self._document(*self.ROBIN, "metformin"))
        robin = self._document(*self.ROBIN, "metformin")
        robin["entry"][-1]["resource"]["id"] = "2"
        self._merged(jane, robin)

    def test_reference_to_an_id_another_type_also_has_is_checked(self):
        """Test that an Organization with the Medication's id changes nothing."""
        organization = {"resource": {"resourceType": "Organization", "id": "med-1"}}
        for reference in self.REFERENCE_FORMS:
            jane = self._referring(*self.JANE, reference)
            robin = self._document(*self.ROBIN, "metformin")
            for document in (jane, robin):
                document["entry"].insert(1, organization)
            self._refused(jane, robin)
            del robin["entry"][-1]
            self._merged(jane, robin)

    @needs_library
    @pytest.mark.parametrize(
        "reference",
        [
            *REFERENCE_FORMS,
            *VERSIONED_FORMS,
            "urn:uuid:a/b",
            "urn:uuid:Medication/med-1",
            "urn:uuid:med-1/_history/2",
            "Medication/_history",
            "Medication/2",
            "urn:uuid:2",
            "Medication/a/b",
            "Organization/med-1",
            "Medication/none",
        ],
    )
    def test_resolved_medication_is_among_the_keys_checked(self, reference):
        """Test that whatever the merged bundle resolves a reference to is a key _referred gives."""
        from healthrecord_bridge.fhir.bundle import merge_bundles

        from app.services.importers.mappers._fhir import BundleIndex

        ids = ("med-1", "2", "a/b", "b", "_history", "Medication/med-1")
        jane = self._referring(*self.JANE, reference)
        statement = jane["entry"][-1]["resource"]
        keys = list(_referred(statement))
        resolved = set()
        for held in range(1, 2 ** len(ids)):
            robin = self._document(*self.ROBIN, "metformin")
            del robin["entry"][-1]
            for place, key in enumerate(ids):
                organization = {"resourceType": "Organization", "id": key}
                medication = {"resourceType": "Medication", "id": key}
                robin["entry"].insert(0, {"resource": organization})
                if held >> place & 1:
                    robin["entry"].append({"resource": medication})
            for documents in ([jane, robin], [robin, jane]):
                merged = merge_bundles(documents)
                found, ambiguous = BundleIndex(merged).target(
                    "Medication", statement["medicationReference"]
                )
                assert not ambiguous
                if found is None:
                    self._merged_once(documents, keys, robin)
                    continue
                assert ("Medication", found["id"]) in keys
                resolved.add(found["id"])
                with pytest.raises(ImportFormatError):
                    _patient_birth_dates(documents)
        assert resolved == {key for kind, key in keys if key in ids}

    @staticmethod
    def _merged_once(documents, keys, robin):
        """The check passes unless a key it reports is held."""
        held = {
            (entry["resource"]["resourceType"], entry["resource"]["id"])
            for entry in robin["entry"]
        }
        if held.isdisjoint(keys):
            _patient_birth_dates(documents)

    def test_reference_of_a_statement_without_an_id_is_checked(self):
        """Test that the statement's own id plays no part."""
        jane = self._referring(*self.JANE)
        del jane["entry"][-1]["resource"]["id"]
        self._refused(jane, self._document(*self.ROBIN, "metformin"))

    def test_many_references_are_checked_in_linear_time(self):
        """Test that documents referring to one id are each walked once."""
        documents = [
            self._referring(f"p{i}", "1984-07-22", "urn:uuid:med-1")
            for i in range(20_000)
        ]
        documents.append(self._document("p0", "1984-07-22", "lisinopril"))
        start = time.monotonic()
        _patient_birth_dates(documents)
        assert time.monotonic() - start < 5.0

    def test_many_copies_are_checked_in_linear_time(self):
        """Test that the check walks each document once."""
        documents = [
            self._document(f"p{i}", "1984-07-22", f"drug {i}") for i in range(20_000)
        ]
        start = time.monotonic()
        _patient_birth_dates(documents)
        assert time.monotonic() - start < 5.0


class TestKeepExactBirthDates:
    """Test that the merged Patient gets the most exact birth date known for its id."""

    @staticmethod
    def _merged(*resources):
        return {"entry": [{"fullUrl": "urn:x", "resource": r} for r in resources]}

    @pytest.mark.parametrize(
        "merged_birth, known, expected",
        [
            ("1984", (1984, 7, 22), "1984-07-22"),
            ("1984", (1984, 7), "1984-07"),
            ("1984-07", (1984, 7, 22), "1984-07-22"),
            (None, (1984,), "1984"),
            ("soon", (1984, 7, 22), "1984-07-22"),
            ("1984-07-22", (1984, 7, 22), "1984-07-22"),
            ("1984-07-22", (1984,), "1984-07-22"),
        ],
    )
    def test_birth_date_is_set_only_when_the_known_one_is_more_exact(
        self, merged_birth, known, expected
    ):
        """Test the forms written and that an equal or less exact known value changes nothing."""
        patient = {"resourceType": "Patient", "id": "jane", "gender": "female"}
        if merged_birth:
            patient["birthDate"] = merged_birth
        merged = self._merged(patient)
        _keep_exact_birth_dates(merged, {"jane": known})
        assert merged == self._merged({**patient, "birthDate": expected})

    def test_only_the_birth_date_of_the_named_patient_is_touched(self):
        """Test that other fields, other Patients and other resource types stay as merged."""
        jane = {
            "resourceType": "Patient",
            "id": "jane",
            "birthDate": "1984",
            "name": [{"family": "Sampleton"}],
        }
        robin = {"resourceType": "Patient", "id": "robin", "birthDate": "1975"}
        nameless = {"resourceType": "Patient", "id": "sam"}
        condition = {"resourceType": "Condition", "id": "jane", "birthDate": "1984"}
        merged = self._merged(jane, robin, nameless, condition)
        _keep_exact_birth_dates(merged, {"jane": (1984, 7, 22)})
        assert merged == self._merged(
            {**jane, "birthDate": "1984-07-22"}, robin, nameless, condition
        )
        # The document's own copy is not written to
        assert jane["birthDate"] == "1984"
        assert merged["entry"][1]["resource"] is robin

    def test_documents_in_either_order_give_the_same_patient(self):
        """Test the two steps together on hand-built documents, last copy winning as in the merge."""
        full = TestPatientBirthDates._bundle("jane", birth="1984-07-22")
        year = TestPatientBirthDates._bundle("jane", birth="1984")
        for documents in ([full, year], [year, full]):
            born = _patient_birth_dates(documents)
            merged = self._merged(documents[-1]["entry"][0]["resource"])
            _keep_exact_birth_dates(merged, born)
            assert [e["resource"]["birthDate"] for e in merged["entry"]] == [
                "1984-07-22"
            ]

    def test_many_patients_are_walked_once(self):
        """Test that the pass over the merged bundle is linear."""
        count = 200_000
        merged = self._merged(
            *(
                {"resourceType": "Patient", "id": str(i), "birthDate": "1984"}
                for i in range(count)
            )
        )
        born = {str(i): (1984, 7, 22) for i in range(count)}
        start = time.monotonic()
        _keep_exact_birth_dates(merged, born)
        assert time.monotonic() - start < 5.0
        assert {e["resource"]["birthDate"] for e in merged["entry"]} == {"1984-07-22"}

    @pytest.mark.parametrize("entry", MALFORMED_ENTRIES)
    def test_malformed_entry_is_left_as_it_is(self, entry):
        """Test that an entry without a usable resource, type or id is passed over."""
        patient = {"resourceType": "Patient", "id": "jane", "birthDate": "1984"}
        merged = {"entry": [entry, {"resource": patient}]}
        _keep_exact_birth_dates(merged, {"jane": (1984, 7, 22)})
        assert merged == {
            "entry": [entry, {"resource": {**patient, "birthDate": "1984-07-22"}}]
        }

    @pytest.mark.parametrize("bundle", MALFORMED_BUNDLES)
    def test_bundle_without_an_entry_list_is_left_as_it_is(self, bundle):
        """Test that a bundle whose entry is missing or not a list is not touched."""
        before = dict(bundle)
        _keep_exact_birth_dates(bundle, {"jane": (1984, 7, 22)})
        assert bundle == before


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

    def test_claims_zip_without_documents_and_rejects_non_zip(self):
        """Test that a zip of other XML is claimed, for to_bundle to explain, and a non-zip extension is not."""
        importer = CcdaImporter()
        assert importer.validate_format(_zip({"a.xml": "<a/>"}), "a.zip")
        assert not importer.validate_format(MYCHART_CCD.read_bytes(), "ccd.txt")
        assert not importer.validate_format(_zip({"a.xml": "<a/>"}), "a.json")

    def test_zip_is_claimed_without_reading_it(self, monkeypatch):
        """Test that detection does not inflate the archive, which to_bundle reads once."""

        def read(data, suffixes):
            raise AssertionError("the zip was read")

        monkeypatch.setattr(ccda_importer, "iter_zip_members", read)
        data = _xdm_zip(MYCHART_CCD.read_bytes())
        assert CcdaImporter().validate_format(data, "export.ZIP")

    @needs_library
    def test_zip_without_documents_is_detected_and_explained(self):
        """Test that auto-detection leads to the message about the missing documents."""
        data = _zip({"a.xml": "<a/>", "notes.txt": "x"})
        importer = health_record_importer_registry.detect(data, "a.zip")
        assert importer.FORMAT_KEY == "ccda"
        with pytest.raises(
            ImportFormatError, match="^The zip file contains no C-CDA documents$"
        ):
            importer.to_bundle(data, "a.zip")

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
        assert not any("different content" in n for n in notes)
        # Notes from both documents are kept apart by member name
        assert any(
            n.startswith("MachineReadable_XDMFormat/IHE_XDM/SUBSET02") for n in notes
        )

    def test_newest_document_wins_and_conflicts_are_counted(self):
        """Test that an entry two documents share comes from the newer one, whatever the zip order."""
        older = MYCHART_CCD.read_bytes()
        newer = _later_copy(older)
        newer_bundle, _ = CcdaImporter().to_bundle(newer, "ccd.xml")
        corrected = [
            e["resource"]
            for e in newer_bundle["entry"]
            if e["resource"].get("onsetDateTime") == "2018-03-01"
        ]
        assert len(corrected) == 1
        # Newer document first in the archive, older second: last-wins would keep the old one
        merged, notes = CcdaImporter().to_bundle(_xdm_zip(newer, older), "export.zip")
        kept = [
            e["resource"]
            for e in merged["entry"]
            if e["resource"]["id"] == corrected[0]["id"]
        ]
        assert kept == corrected
        assert notes[0] == (
            "1 record appears in more than one document with different content; "
            "the newest document's copy was kept"
        )

    def test_other_xml_with_an_unused_cda_namespace_is_skipped(self):
        """Test that a zip member whose root is in another namespace does not stop the import."""
        other = b'<ClinicalDocument xmlns="urn:other" xmlns:cda="urn:hl7-org:v3"/>'
        data = _xdm_zip(MYCHART_CCD.read_bytes(), other)
        alone, _ = CcdaImporter().to_bundle(MYCHART_CCD.read_bytes(), "ccd.xml")
        merged, _ = CcdaImporter().to_bundle(data, "export.zip")
        assert len(merged["entry"]) == len(alone["entry"])

    def test_same_date_conflict_does_not_claim_a_newest_document(self):
        """Test that two versions with one date are reported as kept by position, not by age."""
        first = MYCHART_CCD.read_bytes()
        second = first.replace(b'<low value="20180214"/>', b'<low value="20180301"/>')
        assert second != first
        merged, notes = CcdaImporter().to_bundle(_xdm_zip(first, second), "export.zip")
        onsets = [e["resource"].get("onsetDateTime") for e in merged["entry"]]
        assert "2018-03-01" in onsets and "2018-02-14" not in onsets
        assert notes[0] == (
            "1 record appears in more than one document with different content, "
            "and the documents have the same date or no date; "
            "the copy from the document later in the zip was kept"
        )
        assert not any("newest" in n for n in notes)

    def test_same_entries_in_two_documents_are_not_conflicts(self):
        """Test that a second visit summary repeating the same entries adds no conflict note."""
        first = MYCHART_CCD.read_bytes()
        # A different document id and date, the same clinical content
        second = first.replace(
            b'extension="CCD-2024-000042"', b'extension="CCD-2024-000043"'
        ).replace(
            b'<effectiveTime value="20240315143000-0500"/>',
            b'<effectiveTime value="20240601090000-0500"/>',
            1,
        )
        assert second != first
        _, notes = CcdaImporter().to_bundle(_xdm_zip(first, second), "export.zip")
        assert not any("different content" in n for n in notes)

    def test_documents_of_two_people_with_the_same_record_ids_are_refused(self):
        """Test that one person's records cannot replace another's in the merge."""
        jane = MYCHART_CCD.read_bytes()
        # Another person's document from the same template: every entry id is reused
        robin = (
            jane.replace(b"<given>Jane</given>", b"<given>Robin</given>")
            .replace(b'<birthTime value="19840722"/>', b'<birthTime value="19750101"/>')
            .replace(b'extension="E1234567"', b'extension="E7654321"')
            .replace(b'extension="MRN00042"', b'extension="MRN00043"')
            .replace(b'extension="CCD-2024-000042"', b'extension="CCD-2024-000043"')
        )
        for first, second in ((jane, robin), (robin, jane)):
            with pytest.raises(ImportFormatError) as raised:
                CcdaImporter().to_bundle(_xdm_zip(first, second), "export.zip")
            assert str(raised.value) == SHARED_RECORD_IDS_MESSAGE

    def test_documents_of_one_person_with_different_patient_ids_are_merged(self):
        """Test that one person's documents merge when each gives the Patient another id."""
        jane = MYCHART_CCD.read_bytes()
        single, _ = CcdaImporter().to_bundle(jane, "ccd.xml")
        pairs = [
            (jane, _same_person_under_another_id(jane)),
            (
                _without_patient_ids(jane, b"CCD-2024-000042"),
                _without_patient_ids(jane, b"CCD-2024-000043"),
            ),
        ]
        for first, second in pairs:
            merged, _ = CcdaImporter().to_bundle(_xdm_zip(first, second), "export.zip")
            people = _patients(merged)
            assert len({p["id"] for p in people}) == 2
            assert {p["birthDate"] for p in people} == {"1984-07-22"}
            # Each problem, allergy and medication once, not once per document
            for kind in ("Condition", "AllergyIntolerance", "MedicationStatement"):
                assert _count(merged, kind) == _count(single, kind) > 0

    def test_shared_medication_of_two_people_is_refused(self, monkeypatch):
        """Test that the zip is refused when documents of two people give one Medication id different drugs."""
        jane = TestSharedMedication._document("jane", "1984-07-22", "lisinopril")
        robin = TestSharedMedication._document("robin", "1975-01-01", "metformin")
        _fake_converter(monkeypatch, {"a.xml": jane, "b.xml": robin})
        for names in (("a.xml", "b.xml"), ("b.xml", "a.xml")):
            with pytest.raises(ImportFormatError) as raised:
                CcdaImporter().to_bundle(_stub_zip(*names), "export.zip")
            assert str(raised.value) == SHARED_RECORD_IDS_MESSAGE

    @pytest.mark.parametrize("reference", TestSharedMedication.REFERENCE_FORMS)
    def test_reference_to_another_persons_medication_is_refused(
        self, monkeypatch, reference
    ):
        """Test that the zip is refused when one person's statement would resolve to a Medication only another person's document holds."""
        from healthrecord_bridge.fhir.bundle import merge_bundles

        shared = TestSharedMedication()
        jane = shared._referring("jane", "1984-07-22", reference)
        robin = shared._document("robin", "1975-01-01", "metformin")
        # Merged without the check, the statement takes the other document's drug
        statement = jane["entry"][-1]["resource"]
        mapper = resource_mapper_registry.get_mapper("MedicationStatement")
        mapped = mapper.map(statement, merge_bundles([jane, robin]))
        assert mapped.data["medication_name"] == "metformin"
        _fake_converter(monkeypatch, {"a.xml": jane, "b.xml": robin})
        for names in (("a.xml", "b.xml"), ("b.xml", "a.xml")):
            with pytest.raises(ImportFormatError) as raised:
                CcdaImporter().to_bundle(_stub_zip(*names), "export.zip")
            assert str(raised.value) == SHARED_RECORD_IDS_MESSAGE

    def test_reference_to_the_same_persons_medication_is_merged(self, monkeypatch):
        """Test that a statement resolves to the Medication of another document of the same person."""
        shared = TestSharedMedication()
        jane = shared._referring("jane", "1984-07-22")
        other = shared._document("jane-2", "1984-07-22", "lisinopril")
        _fake_converter(monkeypatch, {"a.xml": jane, "b.xml": other})
        for names in (("a.xml", "b.xml"), ("b.xml", "a.xml")):
            merged, _ = CcdaImporter().to_bundle(_stub_zip(*names), "export.zip")
            mapper = resource_mapper_registry.get_mapper("MedicationStatement")
            mapped = mapper.map(jane["entry"][-1]["resource"], merged)
            assert mapped.data["medication_name"] == "lisinopril"

    @pytest.mark.parametrize("named", ["jane", "robin"])
    def test_shared_medication_with_a_subject_on_one_copy_is_refused(
        self, monkeypatch, named
    ):
        """Test that the zip is refused when only one of the differing Medication copies names its patient."""
        documents = {
            "jane": TestSharedMedication._document("jane", "1984-07-22", "aspirin"),
            "robin": TestSharedMedication._document("robin", "1975-01-01", "warfarin"),
        }
        documents[named]["entry"][-1]["resource"]["subject"] = {
            "reference": f"Patient/{named}"
        }
        _fake_converter(
            monkeypatch, {"a.xml": documents["jane"], "b.xml": documents["robin"]}
        )
        for names in (("a.xml", "b.xml"), ("b.xml", "a.xml")):
            with pytest.raises(ImportFormatError) as raised:
                CcdaImporter().to_bundle(_stub_zip(*names), "export.zip")
            assert str(raised.value) == SHARED_RECORD_IDS_MESSAGE

    def test_shared_medication_with_the_same_content_is_merged(self, monkeypatch):
        """Test that two people's documents with the same Medication still merge, each statement kept."""
        jane = TestSharedMedication._document("jane", "1984-07-22", "lisinopril")
        robin = TestSharedMedication._document(
            "robin", "1975-01-01", "lisinopril", source="b"
        )
        _fake_converter(monkeypatch, {"a.xml": jane, "b.xml": robin})
        merged, notes = CcdaImporter().to_bundle(_stub_zip("a.xml", "b.xml"), "x.zip")
        assert notes == []
        assert _count(merged, "Medication") == 1
        assert _count(merged, "MedicationStatement") == 2

    def test_custodian_that_differs_between_two_people_does_not_stop_the_merge(self):
        """Test that documents of two people from one hospital merge when the organization's details differ."""
        jane = MYCHART_CCD.read_bytes()
        robin = (
            jane.replace(b"<given>Jane</given>", b"<given>Robin</given>")
            .replace(b'<birthTime value="19840722"/>', b'<birthTime value="19750101"/>')
            .replace(b'extension="E1234567"', b'extension="E7654321"')
            .replace(b'extension="MRN00042"', b'extension="MRN00043"')
            .replace(b'extension="CCD-2024-000042"', b'extension="CCD-2024-000043"')
            .replace(
                b"<name>Example Health System</name>", b"<name>Example Health</name>"
            )
        )
        # Her entries get ids of their own; the custodian keeps its id
        robin = re.sub(
            rb'extension="([A-Z]+-\d+(?:-[A-Z0-9]+)?)"', rb'extension="R-\1"', robin
        )
        for documents in ((jane, robin), (robin, jane)):
            merged, _ = CcdaImporter().to_bundle(_xdm_zip(*documents), "export.zip")
            assert len(_patients(merged)) == 2
            assert _count(merged, "Organization") == 1

    @pytest.mark.parametrize("entry", MALFORMED_ENTRIES)
    def test_malformed_converter_output_is_a_format_error(self, monkeypatch, entry):
        """Test that an entry the converter should never produce gives the fixed message, alone and in a zip."""
        good, _ = CcdaImporter().to_bundle(MYCHART_CCD.read_bytes(), "ccd.xml")
        bad = {**good, "entry": [*good["entry"], entry]}
        _fake_converter(monkeypatch, {"a.xml": good, "b.xml": bad})
        for data, name in ((b"<x/>", "b.xml"), (_stub_zip("a.xml", "b.xml"), "x.zip")):
            with pytest.raises(ImportFormatError) as raised:
                CcdaImporter().to_bundle(data, name)
            assert str(raised.value) == INVALID_DOCUMENT_MESSAGE

    @pytest.mark.parametrize("bundle", [None, [], "bundle", *MALFORMED_BUNDLES])
    def test_converter_output_that_is_no_bundle_is_a_format_error(
        self, monkeypatch, bundle
    ):
        """Test that a result without an entry list gives the fixed message."""
        _fake_converter(monkeypatch, {"b.xml": bundle})
        with pytest.raises(ImportFormatError) as raised:
            CcdaImporter().to_bundle(b"<x/>", "b.xml")
        assert str(raised.value) == INVALID_DOCUMENT_MESSAGE

    def test_one_patient_id_for_two_people_is_refused(self):
        """Test that a document cannot replace the Patient of another person's document."""
        jane = MYCHART_CCD.read_bytes()
        # The same patientRole ids, so the same Patient id, for someone born another day
        robin = (
            jane.replace(b"<given>Jane</given>", b"<given>Robin</given>")
            .replace(b'<birthTime value="19840722"/>', b'<birthTime value="19750101"/>')
            .replace(b'extension="CCD-2024-000042"', b'extension="CCD-2024-000043"')
        )
        for first, second in ((jane, robin), (robin, jane)):
            with pytest.raises(ImportFormatError) as raised:
                CcdaImporter().to_bundle(_xdm_zip(first, second), "export.zip")
            assert str(raised.value) == PATIENT_ID_BIRTH_DATES_MESSAGE

    @pytest.mark.parametrize("year_copy_last", [True, False])
    def test_patient_in_two_documents_keeps_the_most_exact_birth_date(
        self, year_copy_last
    ):
        """Test that a copy with only the birth year does not replace the full date, whatever the zip order."""
        full = MYCHART_CCD.read_bytes()
        # The same person and patientRole ids in another document of the same date
        year = full.replace(
            b'<birthTime value="19840722"/>', b'<birthTime value="1984"/>'
        ).replace(b'extension="CCD-2024-000042"', b'extension="CCD-2024-000043"')
        assert year.count(b'<birthTime value="1984"/>') == 1
        documents = (full, year) if year_copy_last else (year, full)
        merged, _ = CcdaImporter().to_bundle(_xdm_zip(*documents), "export.zip")
        people = _patients(merged)
        assert [p["birthDate"] for p in people] == ["1984-07-22"]
        # Everything else is the last copy's, as the merge left it
        last, _ = CcdaImporter().to_bundle(documents[-1], "ccd.xml")
        assert {**people[0], "birthDate": None} == {
            **_patients(last)[0],
            "birthDate": None,
        }
        selected = SimpleNamespace(
            first_name="Jane", last_name="Sampleton", birth_date=date(1984, 7, 22)
        )
        match = compare_patient(merged, selected)
        assert match.birth_date == date(1984, 7, 22)
        assert match.warnings == []

    def test_birth_date_given_as_a_year_is_compared_with_the_selected_patient(self):
        """Test that a document whose birthTime is only a year is told from the selected patient."""
        other = MYCHART_CCD.read_bytes().replace(
            b'<birthTime value="19840722"/>', b'<birthTime value="1975"/>'
        )
        bundle, _ = CcdaImporter().to_bundle(other, "ccd.xml")
        assert [p["birthDate"] for p in _patients(bundle)] == ["1975"]
        selected = SimpleNamespace(
            first_name="Jane", last_name="Sampleton", birth_date=date(1984, 7, 22)
        )
        assert compare_patient(bundle, selected).warnings == [
            "The file's birth date 1975 differs from the selected patient's "
            "1984-07-22."
        ]

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

    @staticmethod
    def _record_steps(monkeypatch, invalid=()):
        """Record each member read from the zip and each conversion, in order."""
        import healthrecord_bridge.ccda

        steps = []
        read_members = ccda_importer.iter_zip_members

        def members(data, suffixes):
            for name, content in read_members(data, suffixes):
                steps.append(("read", name))
                yield name, content

        def convert(data, name):
            steps.append(("convert", name))
            if name in invalid:
                raise ValueError(f"{name}: not a document")
            patient = {"resourceType": "Patient", "id": "p1"}
            bundle = {"resourceType": "Bundle", "entry": [{"resource": patient}]}
            return bundle, SimpleNamespace(documents=[])

        monkeypatch.setattr(ccda_importer, "iter_zip_members", members)
        monkeypatch.setattr(healthrecord_bridge.ccda, "convert_bytes", convert)
        return steps

    def test_each_document_is_converted_before_the_next_is_read(self, monkeypatch):
        """Test that the zip's documents are not all read before the first is converted."""
        steps = self._record_steps(monkeypatch)
        data = _zip(
            {
                "a.xml": '<ClinicalDocument xmlns="urn:hl7-org:v3"/>',
                "METADATA.XML": "<x/>",
                "b.xml": '<ClinicalDocument xmlns="urn:hl7-org:v3"/>',
            }
        )
        merged, notes = CcdaImporter().to_bundle(data, "export.zip")
        assert steps == [
            ("read", "a.xml"),
            ("convert", "a.xml"),
            ("read", "METADATA.XML"),
            ("read", "b.xml"),
            ("convert", "b.xml"),
        ]
        assert _count(merged, "Patient") == 1
        assert notes == []

    @pytest.mark.parametrize(
        "name, content, method, message",
        [
            ("../c.xml", "<a/>", zipfile.ZIP_DEFLATED, "Unsafe path in archive"),
            (
                "c.xml",
                "x" * 101,
                zipfile.ZIP_DEFLATED,
                "An archive entry is 101 bytes, over the 100 byte limit",
            ),
            (
                "c.xml",
                "x" * 70,
                zipfile.ZIP_DEFLATED,
                "Archive expands past the 150 byte limit",
            ),
            (
                "c.xml",
                "<a/>",
                zipfile.ZIP_BZIP2,
                "An archive entry is encrypted or uses an unsupported format",
            ),
        ],
        ids=["unsafe path", "member size", "total size", "method"],
    )
    def test_zip_with_a_refused_later_member_is_not_converted(
        self, monkeypatch, name, content, method, message
    ):
        """Test that no document is read or converted when a later member's header is refused."""
        steps = self._record_steps(monkeypatch)
        monkeypatch.setattr(upload, "MAX_ZIP_MEMBER_BYTES", 100)
        monkeypatch.setattr(upload, "MAX_ZIP_TOTAL_BYTES", 150)
        document = '<ClinicalDocument xmlns="urn:hl7-org:v3"/>'
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("a.xml", document)
            zf.writestr("b.xml", document)
            zf.writestr(name, content, compress_type=method)
        with pytest.raises(ImportFormatError) as raised:
            CcdaImporter().to_bundle(buf.getvalue(), "export.zip")
        assert str(raised.value) == message
        assert steps == []

    def test_corrupt_member_after_an_invalid_document_is_the_error(self, monkeypatch):
        """Test that a member that fails to read after an invalid document is the error given."""
        steps = self._record_steps(monkeypatch, invalid=("a.xml",))
        data = bytearray(_stub_zip("a.xml", "b.xml"))
        # Change b.xml's CRC in the central directory, so reading it fails the check
        crc = data.rfind(b"PK\x01\x02") + 16
        data[crc] ^= 0xFF
        with pytest.raises(ImportFormatError) as raised:
            CcdaImporter().to_bundle(bytes(data), "export.zip")
        assert (
            str(raised.value)
            == "An archive entry is corrupt or larger than its header claims"
        )
        assert steps == [("read", "a.xml"), ("convert", "a.xml")]

    def test_first_invalid_document_is_the_error_and_ends_conversion(self, monkeypatch):
        """Test that nothing is converted after a document that is not valid."""
        steps = self._record_steps(monkeypatch, invalid=("b.xml",))
        with pytest.raises(ImportFormatError) as raised:
            CcdaImporter().to_bundle(_stub_zip("a.xml", "b.xml", "c.xml"), "x.zip")
        assert str(raised.value) == INVALID_DOCUMENT_MESSAGE
        assert [name for step, name in steps if step == "convert"] == [
            "a.xml",
            "b.xml",
        ]
        assert [name for step, name in steps if step == "read"] == [
            "a.xml",
            "b.xml",
            "c.xml",
        ]


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
