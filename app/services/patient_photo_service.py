"""
Patient Photo Service for managing profile photos.
Handles upload, processing, storage, and deletion of patient photos.
"""

import os
import shutil
from pathlib import Path
from typing import Optional, Tuple
from datetime import datetime

from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from PIL import Image
from PIL.ExifTags import TAGS

from app.core.config import settings
from app.core.logging_config import get_logger
from app.models.models import PatientPhoto, Patient
from app.schemas.patient_photo import PatientPhotoCreate, PatientPhotoResponse

logger = get_logger(__name__, "app")


class PatientPhotoService:
    """Service for managing patient profile photos"""

    # Configuration constants
    MAX_FILE_SIZE = 15 * 1024 * 1024  # 15MB
    ALLOWED_TYPES = [
        'image/jpeg', 'image/jpg', 'image/png',
        'image/gif', 'image/bmp', 'image/heic', 'image/heif'
    ]
    MAX_DIMENSION = 1000  # Max width/height after processing
    JPEG_QUALITY = 90  # Quality for JPEG compression

    def __init__(self):
        """Initialize the service and ensure storage directory exists"""
        self.storage_base = Path(settings.UPLOAD_DIR) / "photos" / "patients"
        self.storage_base.mkdir(parents=True, exist_ok=True)
        logger.info("PatientPhotoService initialized", extra={
            "storage_path": str(self.storage_base)
        })

    async def upload_photo(
        self,
        db: Session,
        patient_id: int,
        file: UploadFile,
        user_id: int
    ) -> PatientPhotoResponse:
        """
        Upload and process a patient photo with automatic cleanup of old photo.

        Args:
            db: Database session
            patient_id: ID of the patient
            file: Uploaded file
            user_id: ID of the user uploading

        Returns:
            PatientPhotoResponse with photo details
        """
        logger.info("Starting photo upload", extra={
            "patient_id": patient_id,
            "user_id": user_id,
            "file_name": file.filename,
            "content_type": file.content_type
        })

        # Validate the uploaded file
        await self.validate_image(file)

        # Check patient exists and user has permission
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")

        # Delete old photo if exists
        self._delete_old_photo(db, patient_id)

        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"patient_{patient_id}_{timestamp}.jpg"
        file_path = self.storage_base / filename

        # Save temporary file
        temp_path = file_path.with_suffix('.tmp')
        try:
            # Save uploaded file temporarily
            with open(temp_path, 'wb') as f:
                content = await file.read()
                f.write(content)

            # Process the image (resize, rotate, convert to JPEG)
            await file.seek(0)  # Reset file pointer
            width, height = await self.process_image(temp_path, file_path)

            # Remove temp file
            if temp_path.exists():
                temp_path.unlink()

            # Create database record
            logger.debug("Creating database record for photo", extra={
                "patient_id": patient_id,
                "file_name": filename,
                "file_size": file_path.stat().st_size
            })

            photo_data = PatientPhotoCreate(
                patient_id=patient_id,
                file_name=filename,
                file_path=str(file_path),
                file_size=file_path.stat().st_size,
                mime_type="image/jpeg",  # Always JPEG after processing
                original_name=file.filename,
                width=width,
                height=height,
                uploaded_by=user_id
            )

            try:
                photo = PatientPhoto(**photo_data.model_dump())
                logger.debug("Adding photo to database session", extra={
                    "patient_id": patient_id,
                    "file_name": filename
                })
                db.add(photo)

                logger.debug("Committing photo to database", extra={
                    "patient_id": patient_id,
                    "file_name": filename
                })
                db.commit()

                logger.debug("Refreshing photo record from database", extra={
                    "patient_id": patient_id,
                    "file_name": filename
                })
                db.refresh(photo)

                logger.debug("Database record created successfully", extra={
                    "patient_id": patient_id,
                    "photo_id": photo.id,
                    "file_name": filename
                })

            except Exception as db_error:
                logger.error("Database operation failed during photo upload", extra={
                    "patient_id": patient_id,
                    "file_name": filename,
                    "error": str(db_error),
                    "error_type": type(db_error).__name__
                })
                # Re-raise the error so the outer except block handles cleanup
                raise

            logger.info("Photo uploaded successfully", extra={
                "patient_id": patient_id,
                "photo_id": photo.id,
                "file_size": photo.file_size,
                "dimensions": f"{width}x{height}"
            })

            return PatientPhotoResponse.from_orm(photo)

        except Exception as e:
            # Clean up on error
            cleanup_errors = []

            if temp_path.exists():
                try:
                    temp_path.unlink()
                    logger.debug("Cleaned up temp file", extra={
                        "temp_path": str(temp_path),
                        "patient_id": patient_id
                    })
                except Exception as cleanup_err:
                    cleanup_errors.append(f"temp file: {cleanup_err}")

            if file_path.exists():
                try:
                    file_path.unlink()
                    logger.debug("Cleaned up final file", extra={
                        "file_path": str(file_path),
                        "patient_id": patient_id
                    })
                except Exception as cleanup_err:
                    cleanup_errors.append(f"final file: {cleanup_err}")

            # Log comprehensive error information
            logger.error("Photo upload failed", extra={
                "patient_id": patient_id,
                "user_id": user_id,
                "file_name": file.filename,
                "error": str(e),
                "error_type": type(e).__name__,
                "cleanup_errors": cleanup_errors if cleanup_errors else None
            })

            # Log full traceback for debugging
            import traceback
            logger.error("Photo upload error traceback", extra={
                "patient_id": patient_id,
                "traceback": traceback.format_exc()
            })

            raise HTTPException(status_code=500, detail="Failed to upload photo")

    async def get_photo(
        self,
        db: Session,
        patient_id: int
    ) -> Optional[PatientPhotoResponse]:
        """
        Retrieve patient photo metadata.

        Args:
            db: Database session
            patient_id: ID of the patient

        Returns:
            PatientPhotoResponse or None if no photo exists
        """
        photo = db.query(PatientPhoto).filter(
            PatientPhoto.patient_id == patient_id
        ).first()

        if photo:
            return PatientPhotoResponse.from_orm(photo)
        return None

    async def get_photo_file(
        self,
        db: Session,
        patient_id: int
    ) -> Optional[Path]:
        """
        Get the actual photo file path for serving.

        Args:
            db: Database session
            patient_id: ID of the patient

        Returns:
            Path to photo file or None
        """
        photo = db.query(PatientPhoto).filter(
            PatientPhoto.patient_id == patient_id
        ).first()

        if photo and Path(photo.file_path).exists():
            return Path(photo.file_path)
        return None

    async def delete_photo(
        self,
        db: Session,
        patient_id: int,
        user_id: int
    ) -> bool:
        """
        Delete patient photo and clean up files.

        Args:
            db: Database session
            patient_id: ID of the patient
            user_id: ID of the user deleting (for logging)

        Returns:
            True if deleted, False if no photo existed
        """
        photo = db.query(PatientPhoto).filter(
            PatientPhoto.patient_id == patient_id
        ).first()

        if not photo:
            return False

        # Delete file from disk
        file_path = Path(photo.file_path)
        if file_path.exists():
            file_path.unlink()
            logger.info("Photo file deleted", extra={
                "patient_id": patient_id,
                "file_path": str(file_path),
                "deleted_by": user_id
            })

        # Delete database record
        db.delete(photo)
        db.commit()

        logger.info("Photo record deleted", extra={
            "patient_id": patient_id,
            "photo_id": photo.id,
            "deleted_by": user_id
        })

        return True

    async def validate_image(self, file: UploadFile) -> None:
        """
        Validate uploaded image file.

        Args:
            file: Uploaded file to validate

        Raises:
            HTTPException if validation fails
        """
        logger.info("Validating image file", extra={
            "file_name": file.filename,
            "content_type": file.content_type,
            "allowed_types": self.ALLOWED_TYPES
        })

        # Check file size
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to beginning

        logger.info("File size check", extra={
            "file_size": file_size,
            "max_size": self.MAX_FILE_SIZE
        })

        if file_size > self.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"Photo must be less than {self.MAX_FILE_SIZE // (1024*1024)}MB"
            )

        # Check content type with strict matching
        if file.content_type and file.content_type not in self.ALLOWED_TYPES:
            logger.error("Content type validation failed", extra={
                "content_type": file.content_type,
                "allowed_types": self.ALLOWED_TYPES
            })
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {file.content_type}. Please upload a JPEG, PNG, GIF, BMP, or HEIC image"
            )

        # Verify image can be opened
        try:
            img = Image.open(file.file)
            img.verify()
            await file.seek(0)  # Reset file pointer
            logger.info("Image validation successful", extra={
                "format": img.format,
                "size": img.size
            })
        except Exception as e:
            logger.error("Image validation failed", extra={
                "error": str(e),
                "file_name": file.filename
            })
            raise HTTPException(
                status_code=400,
                detail=f"Unable to process image: {str(e)}. Please try a different photo"
            )

    async def process_image(
        self,
        input_path: Path,
        output_path: Path
    ) -> Tuple[int, int]:
        """
        Process image: resize, rotate based on EXIF, convert to JPEG.

        Args:
            input_path: Path to input image
            output_path: Path to save processed image

        Returns:
            Tuple of (width, height) after processing
        """
        img = Image.open(input_path)

        # Auto-rotate based on EXIF data (important for phone photos)
        try:
            exif = img.getexif()
            if exif:
                orientation = next(
                    (v for k, v in exif.items() if TAGS.get(k) == 'Orientation'),
                    None
                )
                if orientation:
                    rotate_values = {
                        3: 180,
                        6: 270,
                        8: 90
                    }
                    if orientation in rotate_values:
                        img = img.rotate(rotate_values[orientation], expand=True)
                        logger.debug(f"Rotated image {rotate_values[orientation]} degrees")
        except Exception as e:
            logger.debug(f"No EXIF rotation needed: {e}")

        # Resize if larger than max dimensions
        max_size = (self.MAX_DIMENSION, self.MAX_DIMENSION)
        img.thumbnail(max_size, Image.Resampling.LANCZOS)

        # Convert to RGB if necessary (for PNG with transparency, etc.)
        if img.mode not in ('RGB', 'L'):
            img = img.convert('RGB')

        # Save as JPEG with good quality
        img.save(str(output_path), 'JPEG', quality=self.JPEG_QUALITY, optimize=True)

        return img.size

    def _delete_old_photo(self, db: Session, patient_id: int) -> None:
        """
        Internal method to clean up existing photo before uploading new one.

        Args:
            db: Database session
            patient_id: ID of the patient
        """
        existing = db.query(PatientPhoto).filter(
            PatientPhoto.patient_id == patient_id
        ).first()

        if existing:
            # Delete file from disk
            file_path = Path(existing.file_path)
            if file_path.exists():
                file_path.unlink()
                logger.debug(f"Deleted old photo file: {file_path}")

            # Delete database record
            db.delete(existing)
            db.flush()  # Flush but don't commit yet
            logger.debug(f"Deleted old photo record for patient {patient_id}")


# Singleton instance
patient_photo_service = PatientPhotoService()