/**
 * Error handling constants
 * Centralized constants to prevent typos and improve maintainability
 */

// Error severity levels
export const ERROR_SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium', 
    HIGH: 'high'
};

// Error types
export const ERROR_TYPES = {
    MAPPED_ERROR: 'mapped_error',
    BULK_ALREADY_SHARED: 'bulk_already_shared',
    NETWORK_ERROR: 'network_error',
    TIMEOUT_ERROR: 'timeout_error',
    HTTP_STATUS: 'http_status',
    VALIDATION_ERROR: 'validation_error',
    AUTH_ERROR: 'auth_error',
    USER_NOT_FOUND: 'user_not_found',
    PERMISSION_ERROR: 'permission_error',
    INVITATION_EXPIRED: 'invitation_expired',
    INVITATION_NOT_FOUND: 'invitation_not_found',
    SHARING_ERROR: 'sharing_error',
    GENERIC: 'generic',
    UNKNOWN: 'unknown'
};

// Error domains
export const ERROR_DOMAINS = {
    SHARING: 'sharing',
    AUTH: 'auth',
    NETWORK: 'network',
    VALIDATION: 'validation',
    GENERAL: 'general',
    MEDICAL: 'medical',
    PATIENT: 'patient'
};

// Error colors (Mantine color scheme)
export const ERROR_COLORS = {
    RED: 'red',
    ORANGE: 'orange',
    YELLOW: 'yellow',
    BLUE: 'blue',
    GREEN: 'green'
};

// Notification auto-close times (milliseconds)
export const NOTIFICATION_DURATIONS = {
    [ERROR_SEVERITY.LOW]: 4000,
    [ERROR_SEVERITY.MEDIUM]: 6000,
    [ERROR_SEVERITY.HIGH]: 10000,
    DEFAULT: 5000
};

// Common error patterns (to prevent typos)
export const ERROR_PATTERNS = {
    // Network errors
    NETWORK_ERROR: 'network error',
    FAILED_TO_FETCH: 'failed to fetch',
    TIMEOUT: 'timeout',
    
    // Auth errors
    INVALID_CREDENTIALS: 'invalid credentials',
    SESSION_EXPIRED: 'session expired',
    UNAUTHORIZED: 'unauthorized',
    
    // Sharing errors
    ALREADY_SHARED: 'already shared',
    USER_NOT_FOUND: 'user not found',
    INVITATION_EXPIRED: 'invitation expired',
    
    // Validation errors
    REQUIRED_FIELD: 'required field',
    INVALID_EMAIL: 'invalid email',
    INVALID_FORMAT: 'invalid format'
};

// Robust regex patterns for error message matching
export const ERROR_REGEX_PATTERNS = {
    // Bulk sharing errors - flexible pattern matching
    BULK_ALREADY_SHARED: /(?:family\s*history\s*)?already\s*shared\s*(?:for|with)?:?\s*(.+)$/i,
    
    // Network errors - catch variations
    NETWORK_ERRORS: /(?:network\s*(?:error|failure|issue)|failed\s*to\s*fetch|connection\s*(?:error|failed|lost|timeout)|unable\s*to\s*(?:reach|connect))/i,
    
    // Timeout errors - various timeout patterns
    TIMEOUT_ERRORS: /(?:timeout|timed?\s*out|request\s*timeout|connection\s*timeout|server\s*timeout)/i,
    
    // HTTP status code extraction
    HTTP_STATUS: /(?:http\s*)?(\d{3})(?:\s*error)?/i,
    
    // Authentication errors - flexible auth patterns
    AUTH_ERRORS: /(?:unauthorized|unauthenticated|authentication\s*(?:failed|error|required)|invalid\s*(?:token|credentials|login)|session\s*(?:expired|invalid)|access\s*denied)/i,
    
    // User not found errors - flexible user matching
    USER_NOT_FOUND: /(?:user|account|profile)\s*(?:not\s*found|does\s*not\s*exist|cannot\s*be\s*found)/i,
    
    // Permission errors - flexible permission patterns
    PERMISSION_ERRORS: /(?:permission\s*denied|access\s*denied|forbidden|not\s*authorized|insufficient\s*(?:permissions|privileges))/i,
    
    // Validation errors - flexible validation patterns
    VALIDATION_ERRORS: /(?:validation\s*(?:error|failed)|invalid\s*(?:input|data|format)|required\s*field|missing\s*(?:field|parameter))/i,
    
    // Invitation specific errors
    INVITATION_EXPIRED: /invitation\s*(?:has\s*)?(?:expired|is\s*no\s*longer\s*valid)/i,
    INVITATION_NOT_FOUND: /invitation\s*(?:not\s*found|does\s*not\s*exist)/i,
    
    // Generic sharing patterns
    SHARING_ERRORS: /(?:share|sharing)\s*(?:error|failed|not\s*allowed)/i
};

// Icon names (semantic mapping)
export const ERROR_ICONS = {
    // User/Auth icons
    USER_NOT_FOUND: 'user-not-found',
    USER_X: 'user-x',
    INVALID_USER: 'invalid-user',
    
    // Permission/Access icons
    LOCK: 'lock',
    ACCESS_DENIED: 'access-denied',
    PERMISSION_DENIED: 'permission-denied',
    UNAUTHORIZED: 'unauthorized',
    
    // Network icons
    NETWORK_ERROR: 'network-error',
    WIFI_OFF: 'wifi-off',
    SERVER_OFF: 'server-off',
    CLOUD_OFF: 'cloud-off',
    
    // Time/Expiration icons
    CLOCK: 'clock',
    EXPIRED: 'expired',
    TIMEOUT: 'timeout',
    
    // General error icons
    ALERT_CIRCLE: 'alert-circle',
    ALERT_TRIANGLE: 'alert-triangle',
    WARNING: 'warning',
    INFO: 'info',
    
    // Sharing icons
    USERS: 'users',
    SHARING_ERROR: 'sharing-error',
    
    // Mail icons
    MAIL_ERROR: 'mail-error',
    MAIL_X: 'mail-x',
    
    // Validation icons
    VALIDATION_ERROR: 'validation-error',
    DATA_ERROR: 'data-error',
    
    // Default
    DEFAULT: 'default'
};

// Error queue configuration
export const ERROR_QUEUE_CONFIG = {
    MAX_ERRORS: 5, // Maximum number of errors to keep in queue
    AUTO_CLEAR_AFTER: 30000, // Auto-clear errors after 30 seconds
    SHOW_MULTIPLE_NOTIFICATIONS: false // Whether to show multiple notifications at once
};