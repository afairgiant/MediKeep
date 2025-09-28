/**
 * Shared file type configuration for patient photo uploads
 * Keep this in sync with backend ALLOWED_TYPES in patient_photo_service.py
 */

export const ALLOWED_PHOTO_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/heic',
  'image/heif'
];

export const PHOTO_MAX_SIZE = 15 * 1024 * 1024; // 15MB in bytes

export const PHOTO_TYPE_DISPLAY_NAMES = {
  'image/jpeg': 'JPEG',
  'image/jpg': 'JPEG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'image/bmp': 'BMP',
  'image/heic': 'HEIC',
  'image/heif': 'HEIF'
};

// Human-readable list for error messages
export const ALLOWED_PHOTO_TYPES_DISPLAY = 'JPEG, PNG, GIF, BMP, HEIC, or HEIF';