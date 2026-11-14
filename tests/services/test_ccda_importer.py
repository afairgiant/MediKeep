"""
Tests for the C-CDA importer: format detection, conversion through
healthrecord-bridge, zip handling and the missing-library message.
"""

import io
import sys
import time
import zipfile
from datetime import date, datetime, timezone
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
    PATIENT_ID_BIRTH_DATES_MESSAGE,
    SHARED_RECORD_IDS_MESSAGE,
    UNSAFE_DOCUMENT_MESSAGE,
    _conflict_notes,
    _keep_exact_birth_dates,
    _patient_birth_dates,
    _report_notes,
    looks_like_ccda,
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
        """Test that a dated copy replacing an undated one counts as decided by date."""
        notes = self._notes((0, self._bundle(a="x")), (1, self._bundle(a="y")))
        assert len(notes) == 1
        assert "newest" in notes[0]

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
    def test_birth_date_that_does_not_differ_is_merged(self, birth):
        """Test that a missing, unreadable or less exact birth date is no reason to refuse."""
        for bundles in (
            [self._bundle("jane"), self._bundle("jane-2", birth=birth)],
            [self._bundle("jane-2", birth=birth), self._bundle("jane")],
        ):
            _patient_birth_dates(bundles)

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
        bundles.extend([robin, self._bundle("sam", birth=None)])
        assert _patient_birth_dates(bundles) == {
            "jane": (1984, 7, 22),
            "robin": (1975,),
        }

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
