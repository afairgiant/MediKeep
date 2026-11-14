"""ZipPathAllocator: unique, safe paths for files in an export ZIP."""

import pytest

from app.services.export_zip_paths import (
    MAX_EXTENSION_LENGTH,
    MAX_FOLDER_LENGTH,
    MAX_STEM_LENGTH,
    ZipPathAllocator,
    clean_name,
)


class TestFolders:
    def test_folder_is_under_root(self):
        assert ZipPathAllocator().folder("2026-01-05_CBC") == "lab_files/2026-01-05_CBC"

    def test_repeated_label_gets_a_counter(self):
        paths = ZipPathAllocator()

        assert [paths.folder("CBC") for _ in range(3)] == [
            "lab_files/CBC",
            "lab_files/CBC_2",
            "lab_files/CBC_3",
        ]

    def test_labels_differing_only_in_case_do_not_share_a_folder(self):
        paths = ZipPathAllocator()

        assert paths.folder("CBC") == "lab_files/CBC"
        assert paths.folder("cbc") == "lab_files/cbc_2"

    def test_labels_that_clean_to_the_same_name_do_not_share_a_folder(self):
        paths = ZipPathAllocator()

        assert paths.folder("a b") == "lab_files/a_b"
        assert paths.folder("a_b") == "lab_files/a_b_2"

    @pytest.mark.parametrize("label", ["", None, "///", "..", "***"])
    def test_unusable_label_falls_back(self, label):
        assert ZipPathAllocator().folder(label) == "lab_files/files"

    def test_long_label_is_shortened(self):
        folder = ZipPathAllocator().folder("x" * 500)

        assert folder == "lab_files/" + "x" * MAX_FOLDER_LENGTH


class TestFiles:
    def test_file_keeps_its_name(self):
        paths = ZipPathAllocator()
        folder = paths.folder("r")

        assert paths.file(folder, "report.pdf") == f"{folder}/report.pdf"

    def test_repeated_name_gets_a_counter_before_the_extension(self):
        paths = ZipPathAllocator()
        folder = paths.folder("r")

        assert [paths.file(folder, "scan.pdf") for _ in range(3)] == [
            f"{folder}/scan.pdf",
            f"{folder}/scan_2.pdf",
            f"{folder}/scan_3.pdf",
        ]

    def test_names_differing_only_in_case_do_not_collide(self):
        paths = ZipPathAllocator()
        folder = paths.folder("r")

        assert paths.file(folder, "scan.pdf") == f"{folder}/scan.pdf"
        assert paths.file(folder, "Scan.PDF") == f"{folder}/Scan_2.PDF"

    def test_names_that_clean_to_the_same_name_do_not_collide(self):
        paths = ZipPathAllocator()
        folder = paths.folder("r")

        assert paths.file(folder, "a b.pdf") == f"{folder}/a_b.pdf"
        assert paths.file(folder, "a_b.pdf") == f"{folder}/a_b_2.pdf"

    def test_same_name_in_different_folders_is_not_renamed(self):
        paths = ZipPathAllocator()
        first, second = paths.folder("r"), paths.folder("s")

        assert paths.file(first, "scan.pdf") == f"{first}/scan.pdf"
        assert paths.file(second, "scan.pdf") == f"{second}/scan.pdf"

    def test_name_that_looks_like_an_earlier_suffix_stays_unique(self):
        paths = ZipPathAllocator()
        folder = paths.folder("r")

        names = [paths.file(folder, n) for n in ("scan.pdf", "scan.pdf", "scan_2.pdf")]

        assert len(set(names)) == 3

    @pytest.mark.parametrize("file_name", ["", None, "***", "."])
    def test_unusable_name_falls_back(self, file_name):
        paths = ZipPathAllocator()
        folder = paths.folder("r")

        assert paths.file(folder, file_name) == f"{folder}/file"

    def test_name_without_extension(self):
        paths = ZipPathAllocator()
        folder = paths.folder("r")

        assert paths.file(folder, "report") == f"{folder}/report"
        assert paths.file(folder, "report") == f"{folder}/report_2"

    def test_long_name_and_extension_are_shortened(self):
        paths = ZipPathAllocator()
        folder = paths.folder("r")

        path = paths.file(folder, "n" * 500 + "." + "e" * 50)

        assert path == (
            f"{folder}/" + "n" * MAX_STEM_LENGTH + "." + "e" * MAX_EXTENSION_LENGTH
        )

    @pytest.mark.parametrize(
        "file_name",
        [
            "..",
            "...",
            "../evil.pdf",
            "..\\evil.pdf",
            "/etc/passwd",
            "C:\\Windows\\win.ini",
            "..%2f..%2fevil.pdf",
            ".hidden",
        ],
    )
    def test_name_cannot_leave_its_folder(self, file_name):
        paths = ZipPathAllocator()
        folder = paths.folder("r")

        parts = paths.file(folder, file_name).split("/")

        assert parts[:2] == ["lab_files", "r"]
        assert len(parts) == 3
        assert not parts[2].startswith(".")
        assert "\\" not in parts[2] and ":" not in parts[2]


class TestCleanName:
    def test_keeps_letters_marks_and_numbers_from_any_script(self):
        # Thai vowel signs and tone marks are combining marks, not letters
        assert clean_name("ผลตรวจเลือด ก็", 50) == "ผลตรวจเลือด_ก็"
        assert clean_name("血常规 2026", 50) == "血常规_2026"
        assert clean_name("Zażółć gęślą", 50) == "Zażółć_gęślą"

    def test_drops_path_and_control_characters(self):
        assert clean_name("a/b\\c:d*e?f\nn\x00", 50) == "abcdefn"

    def test_trims_dots_but_keeps_inner_ones(self):
        assert clean_name("..a.b..", 50) == "a.b"
