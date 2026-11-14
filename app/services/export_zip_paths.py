"""Unique, filesystem-safe paths for the files placed in an export ZIP.

Paths look like ``{root}/{folder}/{file}``. A folder stands for one record (for
example one lab result) and holds that record's files under their original names.
"""

import os
import unicodedata
from typing import Dict, Set

# Windows cannot create files or folders with these names, with or without an extension
_WINDOWS_RESERVED_NAMES = frozenset(
    {"CON", "PRN", "AUX", "NUL"}
    | {f"{device}{number}" for device in ("COM", "LPT") for number in "0123456789¹²³"}
)

MAX_FOLDER_LENGTH = 60
MAX_STEM_LENGTH = 80
MAX_EXTENSION_LENGTH = 10

# Unicode categories kept in names: letters, marks (Thai vowel signs, accents), numbers
_KEPT_CATEGORIES = "LMN"


def _is_kept(char: str) -> bool:
    return unicodedata.category(char)[0] in _KEPT_CATEGORIES


def clean_name(text: object, max_length: int) -> str:
    """Name part safe to use in a path: spaces become ``_``, anything but letters,
    marks, numbers and ``._-`` is dropped, and leading or trailing dots are removed so
    the result is never ``..`` or a hidden or Windows-invalid name.
    """
    cleaned = "".join(
        c for c in str(text or "").replace(" ", "_") if c in "._-" or _is_kept(c)
    )
    return cleaned.strip(".")[:max_length].rstrip(".")


def _avoid_reserved_name(name: str) -> str:
    """Prefix ``_`` when the part of ``name`` before its first dot is a Windows device
    name (``CON``, ``nul.txt``, ``COM1.tar.gz``)."""
    if name.split(".")[0].upper() in _WINDOWS_RESERVED_NAMES:
        return f"_{name}"
    return name


class ZipPathAllocator:
    """Hands out ZIP paths that never repeat.

    Names are compared case-insensitively because ZIPs are often extracted onto
    case-insensitive filesystems. A repeated name gets ``_2``, ``_3``... in the
    order paths are requested, so request them in a stable order.
    """

    def __init__(self, root: str = "lab_files"):
        self._root = root
        self._folders: Set[str] = set()
        self._files: Dict[str, Set[str]] = {}

    def folder(self, label: str) -> str:
        """A folder path, named after ``label``, that has not been handed out yet."""
        base = _avoid_reserved_name(clean_name(label, MAX_FOLDER_LENGTH) or "files")
        name, number = base, 1
        while name.casefold() in self._folders:
            number += 1
            name = f"{base}_{number}"
        self._folders.add(name.casefold())
        path = f"{self._root}/{name}"
        self._files[path] = set()
        return path

    def file(self, folder: str, file_name: str) -> str:
        """A file path inside ``folder`` that has not been handed out yet.

        The original extension is kept; ``folder`` must come from :meth:`folder`.
        """
        stem, extension = os.path.splitext(str(file_name or ""))
        base = _avoid_reserved_name(clean_name(stem, MAX_STEM_LENGTH) or "file")
        extension_body = "".join(c for c in extension if _is_kept(c))
        extension = (
            f".{extension_body[:MAX_EXTENSION_LENGTH]}" if extension_body else ""
        )

        used = self._files[folder]
        name, number = f"{base}{extension}", 1
        while name.casefold() in used:
            number += 1
            name = f"{base}_{number}{extension}"
        used.add(name.casefold())
        return f"{folder}/{name}"
