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

# Caps on what a zip may expand to, checked against each member's header before it
# is read. A zip may expand to no more than a bare upload could carry
MAX_ZIP_MEMBERS = 500
MAX_ZIP_MEMBER_BYTES = MAX_IMPORT_FILE_SIZE
MAX_ZIP_TOTAL_BYTES = MAX_IMPORT_FILE_SIZE
# Only these are read: zipfile inflates deflate in bounded pieces, but expands a
# whole bzip2 or LZMA chunk at once, so a tiny member of those could cost gigabytes
ZIP_METHODS = (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)
ZIP_READ_CHUNK = 1024 * 1024

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
    except (zipfile.BadZipFile, ValueError, OSError, EOFError) as exc:
        # ValueError covers a member name that is not valid UTF-8
        raise ImportFormatError("File is not a valid zip archive") from exc
    except NotImplementedError as exc:
        # A member that needs a newer zip version than zipfile reads
        raise ImportFormatError(
            "The zip file uses a format that is not supported"
        ) from exc

    with zf:
        infos = zf.infolist()
        if len(infos) > MAX_ZIP_MEMBERS:
            raise ImportFormatError(
                f"Archive has {len(infos)} entries, over the {MAX_ZIP_MEMBERS} limit"
            )
        total = 0
        # Messages leave out member names, which can name the patient and reach the log
        for info in infos:
            if _is_unsafe_name(info.filename):
                raise ImportFormatError("Unsafe path in archive")
            if info.is_dir() or not info.filename.lower().endswith(wanted):
                continue
            if info.file_size > MAX_ZIP_MEMBER_BYTES:
                raise ImportFormatError(
                    f"An archive entry is {info.file_size} bytes, over the "
                    f"{MAX_ZIP_MEMBER_BYTES} byte limit"
                )
            total += info.file_size
            if total > MAX_ZIP_TOTAL_BYTES:
                raise ImportFormatError(
                    f"Archive expands past the {MAX_ZIP_TOTAL_BYTES} byte limit"
                )
            if info.compress_type not in ZIP_METHODS:
                raise ImportFormatError(
                    "An archive entry is encrypted or uses an unsupported format"
                )
            # The header's sizes are the uploader's claim. zipfile truncates the
            # member to file_size (already under the cap) and checks the CRC, so
            # reading in pieces keeps memory bounded whatever the stream holds
            try:
                with zf.open(info) as fh:
                    content = b"".join(iter(lambda: fh.read(ZIP_READ_CHUNK), b""))
            except (
                zipfile.BadZipFile,
                EOFError,
                zlib.error,
                ValueError,
                OSError,
            ) as exc:
                raise ImportFormatError(
                    "An archive entry is corrupt or larger than its header claims"
                ) from exc
            except (RuntimeError, NotImplementedError) as exc:
                # zipfile raises these for encryption or a deflate variant it
                # cannot read; the RuntimeError text names the member
                raise ImportFormatError(
                    "An archive entry is encrypted or uses an unsupported format"
                ) from exc
            yield info.filename, content
