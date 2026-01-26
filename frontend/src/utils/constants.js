// Medical Records System Constants

// API Endpoints - Now using entity relationship system for most endpoints
// Only keeping specific endpoints that aren't covered by the generic entity system
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    LOGOUT: '/api/v1/auth/logout',
    REFRESH: '/api/v1/auth/refresh',
  },
  // Special endpoints that don't follow the standard entity pattern
  // NOTE: Lab results files now use the generic entity file system
  // via ApiService.uploadLabResultFile() -> uploadEntityFile()
};

// Form Validation Rules
export const VALIDATION_RULES = {
  REQUIRED: 'This field is required',
  EMAIL: 'Please enter a valid email address',
  PHONE: 'Please enter a valid phone number',
  DATE: 'Please enter a valid date',
  MIN_LENGTH: length => `Minimum ${length} characters required`,
  MAX_LENGTH: length => `Maximum ${length} characters allowed`,
};

// Status Options
export const STATUS_OPTIONS = {
  LAB_RESULT: ['ordered', 'in-progress', 'completed', 'cancelled'],
  MEDICATION: ['active', 'stopped', 'on-hold', 'completed', 'cancelled'],
  GENERAL: ['active', 'inactive', 'pending', 'completed'],
};

// Medical Categories
export const MEDICAL_CATEGORIES = {
  LAB_RESULTS: [
    'hematology',
    'chemistry',
    'microbiology',
    'pathology',
    'radiology',
    'cardiology',
    'endocrinology',
    'immunology',
    'toxicology',
    'other',
  ],
  MEDICATION_ROUTES: [
    'oral',
    'injection',
    'topical',
    'intravenous',
    'intramuscular',
    'subcutaneous',
    'inhalation',
    'nasal',
    'rectal',
    'sublingual',
  ],
};

// File Upload Settings
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/tiff',
    'image/bmp',
    'image/gif',
  ],
  ALLOWED_EXTENSIONS: [
    '.pdf',
    '.jpg',
    '.jpeg',
    '.png',
    '.tiff',
    '.bmp',
    '.gif',
  ],
};

// UI Constants
export const UI_CONSTANTS = {
  DEBOUNCE_DELAY: 300,
  PAGINATION_SIZE: 10,
  TOAST_DURATION: 5000,
  MODAL_ANIMATION_DURATION: 200,
};

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'MMM DD, YYYY',
  DISPLAY_LONG: 'MMMM DD, YYYY', // For Patient Info page
  DISPLAY_WITH_TIME: 'MMM DD, YYYY HH:mm',
  INPUT: 'YYYY-MM-DD',
  INPUT_WITH_TIME: 'YYYY-MM-DDTHH:mm',
  API: 'YYYY-MM-DDTHH:mm:ss',
};

// User-selectable date format preferences
// mdy = MM/DD/YYYY (US), dmy = DD/MM/YYYY (European), ymd = YYYY-MM-DD (ISO)
export const DATE_FORMAT_OPTIONS = {
  mdy: {
    code: 'mdy',
    label: 'MM/DD/YYYY (US)',
    locale: 'en-US',
    pattern: 'MM/DD/YYYY',
    example: '01/25/2026',
  },
  dmy: {
    code: 'dmy',
    label: 'DD/MM/YYYY (European)',
    locale: 'en-GB',
    pattern: 'DD/MM/YYYY',
    example: '25/01/2026',
  },
  ymd: {
    code: 'ymd',
    label: 'YYYY-MM-DD (ISO)',
    // Swedish locale (sv-SE) uses ISO 8601 format (YYYY-MM-DD) by default.
    // This is a reliable workaround since no browser locale explicitly outputs ISO format.
    // If browser implementations change, consider implementing custom formatting logic.
    locale: 'sv-SE',
    pattern: 'YYYY-MM-DD',
    example: '2026-01-25',
  },
};

export const DEFAULT_DATE_FORMAT = 'mdy';
