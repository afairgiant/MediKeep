"""Upload limits and zip handling shared by the health record importers."""

import io
import re
import zipfile
import zlib
from typing import Iterable, Iterator, Tuple

from fastapi import Request, UploadFile

from app.api.deps import ValidationException

from .base_importer import ImportFormatError

MAX_IMPORT_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

# Caps on what a zip may expand to, checked before any member is read
MAX_ZIP_MEMBERS = 500
MAX_ZIP_MEMBER_BYTES = 100 * 1024 * 1024
MAX_ZIP_TOTAL_BYTES = 200 * 1024 * 1024

_DRIVE_LETTER = re.compile(r"^[A-Za-z]:")


def read_upload(
    file: UploadFile, request: Request, allowed_extensions: Iterable[str]
) -> bytes:
    """Read and validate an upload, returning its bytes."""
    if not file or not file.filename:
        raise ValidationException(message="No file provided", request=request)

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    allowed = sorted({e.lower().lstrip(".") for e in allowed_extensions})
    if ext not in allowed:
        raise ValidationException(
            message=f"Unsupported file type: expected {', '.join(allowed)}",
            request=request,
        )

    # Read one byte past the limit so an oversized file is caught without buffering it all
    raw = file.file.read(MAX_IMPORT_FILE_SIZE + 1)
    if len(raw) > MAX_IMPORT_FILE_SIZE:
        raise ValidationException(
            message=f"File exceeds {MAX_IMPORT_FILE_SIZE // (1024 * 1024)} MB limit",
            request=request,
        )
    return raw


def _is_unsafe_name(name: str) -> bool:
    """Reject member names that could escape a directory if ever written out."""
    normalized = name.replace("\\", "/")
    return (
        normalized.startswith("/")
        or bool(_DRIVE_LETTER.match(normalized))
        or ".." in normalized.split("/")
    )


def iter_zip_members(
    data: bytes, suffixes: Iterable[str]
) -> Iterator[Tuple[str, bytes]]:
    """Yield (name, bytes) for zip members with one of the suffixes, from memory."""
    wanted = tuple(s.lower() for s in suffixes)
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise ImportFormatError("File is not a valid zip archive") from exc

    with zf:
        infos = zf.infolist()
        if len(infos) > MAX_ZIP_MEMBERS:
            raise ImportFormatError(
                f"Archive has {len(infos)} entries, over the {MAX_ZIP_MEMBERS} limit"
            )
        total = 0
        for info in infos:
            if _is_unsafe_name(info.filename):
                raise ImportFormatError(f"Unsafe path in archive: {info.filename}")
            if info.is_dir() or not info.filename.lower().endswith(wanted):
                continue
            if info.file_size > MAX_ZIP_MEMBER_BYTES:
                raise ImportFormatError(
                    f"{info.filename} is {info.file_size} bytes, over the "
                    f"{MAX_ZIP_MEMBER_BYTES} byte limit"
                )
            total += info.file_size
            if total > MAX_ZIP_TOTAL_BYTES:
                raise ImportFormatError(
                    f"Archive expands past the {MAX_ZIP_TOTAL_BYTES} byte limit"
                )
            # zipfile stops at the header's file_size and checks the CRC, so a
            # header that understates the size surfaces as BadZipFile
            try:
                with zf.open(info) as fh:
                    content = fh.read()
            except (zipfile.BadZipFile, EOFError, zlib.error) as exc:
                raise ImportFormatError(
                    f"{info.filename} is corrupt or larger than its header claims"
                ) from exc
            yield info.filename, content
