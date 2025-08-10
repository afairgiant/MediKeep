/**
 * Error handling configuration and utilities
 * Centralized configuration for error handling behavior
 */

import { errorMappings, getErrorMapping } from './errorMappings';

/**
 * Default error handling configuration
 */
export const DEFAULT_CONFIG = {
    // Notification settings
    notifications: {
        enabled: true,
        autoClose: true,
        position: 'top-right',
        maxNotifications: 5
    },
    
    // Logging settings
    logging: {
        enabled: true,
        level: 'error', // 'error', 'warn', 'info', 'debug'
        includeContext: true,
        includeStack: true
    },
    
    // Display settings
    display: {
        showSuggestions: true,
        showIcons: true,
        compactMode: false
    },
    
    // Retry settings
    retry: {
        enabled: false,
        maxAttempts: 3,
        delay: 1000 // milliseconds
    }
};

/**
 * Get error configuration by pattern or domain
 * @param {string} pattern - Error pattern or domain
 * @returns {Object|null} Error configuration
 */
export const getErrorConfig = (pattern) => {
    return getErrorMapping(pattern);
};

/**
 * Get all error patterns for debugging/development
 * @returns {string[]} Array of all error patterns
 */
export const getAllErrorPatterns = () => {
    return Object.keys(errorMappings);
};

/**
 * Get errors by severity level
 * @param {string} severity - Severity level ('low', 'medium', 'high')
 * @returns {Object} Errors matching the severity level
 */
export const getErrorsBySeverity = (severity) => {
    const filtered = {};
    
    Object.entries(errorMappings).forEach(([key, config]) => {
        if (config.severity === severity) {
            filtered[key] = config;
        }
    });
    
    return filtered;
};

/**
 * Get errors by domain
 * @param {string} domain - Domain name ('sharing', 'auth', 'network', etc.)
 * @returns {Object} Errors matching the domain
 */
export const getErrorsByDomain = (domain) => {
    const filtered = {};
    
    Object.entries(errorMappings).forEach(([key, config]) => {
        if (config.domain === domain) {
            filtered[key] = config;
        }
    });
    
    return filtered;
};

/**
 * Validate error configuration
 * @param {Object} config - Error configuration to validate
 * @returns {boolean} Whether configuration is valid
 */
export const validateErrorConfig = (config) => {
    const required = ['title', 'message', 'color', 'icon', 'severity'];
    
    return required.every(field => 
        config.hasOwnProperty(field) && config[field] !== null && config[field] !== undefined
    );
};

/**
 * Environment-specific configuration
 */
export const getEnvironmentConfig = () => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return {
        ...DEFAULT_CONFIG,
        logging: {
            ...DEFAULT_CONFIG.logging,
            level: isDevelopment ? 'debug' : 'error',
            includeStack: isDevelopment
        },
        display: {
            ...DEFAULT_CONFIG.display,
            showDetailedErrors: isDevelopment
        }
    };
};