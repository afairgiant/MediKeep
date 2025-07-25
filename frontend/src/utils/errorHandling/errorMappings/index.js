/**
 * Modular error mappings - each domain has its own error definitions
 * This allows for better organization and easier maintenance as the app grows
 */

// Import domain-specific error mappings
import { sharingErrors } from './sharing';
import { authErrors } from './auth';
import { networkErrors } from './network';
import { validationErrors } from './validation';
import { generalErrors } from './general';

/**
 * Combined error mappings from all domains
 * Each domain contributes its own error patterns and configurations
 */
export const errorMappings = {
    ...sharingErrors,
    ...authErrors,
    ...networkErrors,
    ...validationErrors,
    ...generalErrors
};

/**
 * Get error mapping by pattern
 * 
 * @param {string} pattern - Error pattern to match
 * @returns {Object|null} Error configuration or null if not found
 */
export const getErrorMapping = (pattern) => {
    const lowerPattern = pattern.toLowerCase();
    
    // Exact match first
    if (errorMappings[lowerPattern]) {
        return errorMappings[lowerPattern];
    }
    
    // Partial match
    for (const [key, config] of Object.entries(errorMappings)) {
        if (lowerPattern.includes(key)) {
            return config;
        }
    }
    
    return null;
};

/**
 * Get all error patterns for a specific domain
 * 
 * @param {string} domain - Domain name (sharing, auth, network, etc.)
 * @returns {Object} Error mappings for the domain
 */
export const getErrorsByDomain = (domain) => {
    const domainMappings = {
        sharing: sharingErrors,
        auth: authErrors,
        network: networkErrors,
        validation: validationErrors,
        general: generalErrors
    };
    
    return domainMappings[domain] || {};
};