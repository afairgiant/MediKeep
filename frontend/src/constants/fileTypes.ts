/**
 * Shared file type configuration for file uploads
 * Keep this in sync with backend ALLOWED_EXTENSIONS in lab_result_file.py and lab_result.py
 */

// ========================================
// TYPE DEFINITIONS
// ========================================

/**
 * Configuration for file upload zones
 */
export interface FileUploadConfig {
  acceptedTypes: readonly string[];
  maxSize: number;
  maxFiles: number;
}

/**
 * MIME type mapping for file extensions
 */
export type MimeTypeMapping = Record<string, string>;

// ========================================
// PATIENT PHOTO UPLOADS (Profile Pictures)
// ========================================
export const ALLOWED_PHOTO_TYPES: readonly string[] = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/heic',
  'image/heif'
] as const;

export const PHOTO_MAX_SIZE: number = 15 * 1024 * 1024; // 15MB in bytes

export const PHOTO_TYPE_DISPLAY_NAMES: Record<string, string> = {
  'image/jpeg': 'JPEG',
  'image/jpg': 'JPEG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'image/bmp': 'BMP',
  'image/heic': 'HEIC',
  'image/heif': 'HEIF'
};

// Human-readable list for error messages
export const ALLOWED_PHOTO_TYPES_DISPLAY: string = 'JPEG, PNG, GIF, BMP, HEIC, or HEIF';

// ========================================
// MEDICAL RECORD DOCUMENT UPLOADS (All Medical Entities)
// ========================================

/**
 * Comprehensive file extensions for medical record uploads
 * Includes medical imaging, documents, archives, video, audio, and 3D models
 */
export const MEDICAL_DOCUMENT_EXTENSIONS: readonly string[] = [
  // Documents
  '.pdf', '.txt', '.csv', '.xml', '.json',
  '.doc', '.docx', '.xls', '.xlsx',

  // Images
  '.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.gif',

  // Medical Imaging
  '.dcm',  // DICOM medical imaging

  // Archives (Medical imaging CDs/DVDs often come in these formats)
  '.zip',  // ZIP archives for medical imaging packages
  '.iso',  // CD/DVD image format
  '.7z', '.rar',  // Additional archive formats

  // Video (Ultrasound, procedures, surgical recordings)
  '.avi', '.mp4', '.mov', '.webm',

  // 3D Models (Surgical planning, prosthetics)
  '.stl',

  // Research Imaging Formats
  '.nii',   // NIfTI - Neuroimaging format
  '.nrrd',  // Nearly Raw Raster Data

  // Audio (Respiratory sounds, cardiac auscultation)
  '.mp3', '.wav', '.m4a'
] as const;

/**
 * MIME type mappings for medical document uploads
 * Used for frontend file input accept attribute and validation
 */
export const MEDICAL_DOCUMENT_MIME_TYPES: MimeTypeMapping = {
  // Documents
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.xml': 'application/xml',
  '.json': 'application/json',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.tiff': 'image/tiff',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',

  // Medical Imaging
  '.dcm': 'application/dicom',

  // Archives
  '.zip': 'application/zip',
  '.iso': 'application/x-iso9660-image',
  '.7z': 'application/x-7z-compressed',
  '.rar': 'application/vnd.rar',

  // Video
  '.avi': 'video/x-msvideo',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',

  // 3D Models
  '.stl': 'model/stl',

  // Research Imaging
  '.nii': 'application/octet-stream',
  '.nrrd': 'application/octet-stream',

  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4'
};

/**
 * Default configuration for medical document uploads
 * Used by all medical entity types (lab results, procedures, visits, etc.)
 */
export const MEDICAL_DOCUMENT_CONFIG: FileUploadConfig = {
  acceptedTypes: MEDICAL_DOCUMENT_EXTENSIONS,
  maxSize: 1024 * 1024 * 1024, // 1GB (increased for archive support)
  maxFiles: 10
};

/**
 * Human-readable display of accepted medical file types
 */
export const MEDICAL_DOCUMENT_TYPES_DISPLAY: string =
  'PDF, Images, DICOM, ZIP/ISO archives, Videos, 3D models, and more';
