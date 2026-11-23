"""Small synthetic DICOM files for import tests; never real patient data."""

import io
import zipfile
from pathlib import Path
from typing import Dict, Optional, Union

from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import CTImageStorage, ExplicitVRLittleEndian

STUDY_UID = "1.2.826.0.1.3680043.8.498.1"
SERIES_UID = f"{STUDY_UID}.1"


def dicom_bytes(
    *,
    study_uid: str = STUDY_UID,
    series_uid: str = SERIES_UID,
    sop_uid: Optional[str] = None,
    instance_number: int = 1,
    patient_name: str = "User^Test",  # matches the user_with_patient fixture
    birth_date: str = "19900101",
    modality: str = "CT",
    series_number: int = 1,
    image: bool = True,
) -> bytes:
    """A valid Part 10 file; image=False leaves out the pixel module, like a report."""
    sop_uid = sop_uid or f"{series_uid}.{instance_number}"
    meta = FileMetaDataset()
    meta.MediaStorageSOPClassUID = CTImageStorage
    meta.MediaStorageSOPInstanceUID = sop_uid
    meta.TransferSyntaxUID = ExplicitVRLittleEndian

    ds = FileDataset("test.dcm", {}, file_meta=meta, preamble=b"\x00" * 128)
    ds.SOPClassUID = CTImageStorage
    ds.SOPInstanceUID = sop_uid
    ds.StudyInstanceUID = study_uid
    ds.SeriesInstanceUID = series_uid
    ds.Modality = modality
    ds.SeriesNumber = series_number
    ds.InstanceNumber = instance_number
    ds.PatientName = patient_name
    ds.PatientBirthDate = birth_date
    ds.StudyDate = "20260115"
    ds.StudyDescription = "CT CHEST"
    ds.BodyPartExamined = "CHEST"
    if image:
        ds.Rows = 2
        ds.Columns = 2
        ds.SamplesPerPixel = 1
        ds.PhotometricInterpretation = "MONOCHROME2"
        ds.BitsAllocated = 16
        ds.BitsStored = 12
        ds.HighBit = 11
        ds.PixelRepresentation = 0
        ds.PixelData = b"\x00" * 8

    buffer = io.BytesIO()
    ds.save_as(buffer, enforce_file_format=True)
    return buffer.getvalue()


def zip_bytes(entries: Dict[str, Union[bytes, str]]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in entries.items():
            zf.writestr(name, data)
    return buffer.getvalue()


def write(path: Path, data: bytes) -> Path:
    path.write_bytes(data)
    return path


def compression_bomb() -> bytes:
    """A ZIP whose content unpacks far past the allowed compression ratio."""
    return zip_bytes({"zeros": b"\x00" * (5 * 1024 * 1024)})
