/**
 * Shared constants and utilities for medical page configurations
 */

import logger from '../../services/logger.js';

// Constants for search functionality
// Maximum length for search terms to prevent performance issues with large text inputs.
// 100 characters is sufficient for most medical search queries while avoiding:
// - Excessive memory usage during string operations
// - Poor UI performance with very long search strings
// - Potential DoS attacks through extremely large input
export const SEARCH_TERM_MAX_LENGTH = 100;

// Re-export logger for convenience
export { logger };
