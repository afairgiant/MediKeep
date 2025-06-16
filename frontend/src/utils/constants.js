// Medical Records System Constants

// API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    LOGOUT: '/api/v1/auth/logout',
    REFRESH: '/api/v1/auth/refresh'
  },
  PATIENTS: {
    BASE: '/api/v1/patients',
    CURRENT: '/api/v1/patients/me'
  },
  MEDICATIONS: {
    BASE: '/api/v1/medications',
    BY_PATIENT: (patientId) => `/api/v1/patients/${patientId}/medications`
  },  
  LAB_RESULTS: {
    BASE: '/api/v1/lab-results',
    FILES: (labResultId) => `/api/v1/lab-results/${labResultId}/files`,
    FILE_DOWNLOAD: (fileId) => `/api/v1/lab-result-files/${fileId}/download`
  }
};

// Form Validation Rules
export const VALIDATION_RULES = {
  REQUIRED: 'This field is required',
  EMAIL: 'Please enter a valid email address',
  PHONE: 'Please enter a valid phone number',
  DATE: 'Please enter a valid date',
  MIN_LENGTH: (length) => `Minimum ${length} characters required`,
  MAX_LENGTH: (length) => `Maximum ${length} characters allowed`
};

// Status Options
export const STATUS_OPTIONS = {
  LAB_RESULT: ['ordered', 'in-progress', 'completed', 'cancelled'],
  MEDICATION: ['active', 'stopped', 'on-hold', 'completed', 'cancelled'],
  GENERAL: ['active', 'inactive', 'pending', 'completed']
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
    'other'
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
    'sublingual'
  ]
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
    'image/gif'
  ],
  ALLOWED_EXTENSIONS: ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.gif']
};

// UI Constants
export const UI_CONSTANTS = {
  DEBOUNCE_DELAY: 300,
  PAGINATION_SIZE: 10,
  TOAST_DURATION: 5000,
  MODAL_ANIMATION_DURATION: 200
};

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'MMM DD, YYYY',
  DISPLAY_LONG: 'MMMM DD, YYYY', // For Patient Info page
  DISPLAY_WITH_TIME: 'MMM DD, YYYY HH:mm',
  INPUT: 'YYYY-MM-DD',
  INPUT_WITH_TIME: 'YYYY-MM-DDTHH:mm',
  API: 'YYYY-MM-DDTHH:mm:ss'
};
