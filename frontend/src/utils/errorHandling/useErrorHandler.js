/**
 * React hook for centralized error handling
 * Provides a consistent way to handle, display, and manage errors across components
 */

import { useState, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import { formatError, getNotificationAutoClose } from './formatError';
import { ErrorIcon } from './ErrorIcon';
import logger from '../../services/logger';

/**
 * Custom hook for error handling
 * @param {string} componentName - Name of the component using this hook (for logging)
 * @param {Object} options - Configuration options
 * @returns {Object} Error handling utilities
 */
export const useErrorHandler = (componentName, options = {}) => {
    const [currentError, setCurrentError] = useState(null);
    
    const {
        showNotifications = true,
        logErrors = true,
        autoCloseNotifications = true,
        defaultSeverity = 'medium'
    } = options;

    /**
     * Handle an error - format it, display it, and log it
     * @param {string|Error} error - The error to handle
     * @param {Object} context - Additional context information
     * @returns {Object} Formatted error object
     */
    const handleError = useCallback((error, context = {}) => {
        const formattedError = formatError(error, {
            ...context,
            component: componentName
        });

        // Set current error state
        setCurrentError(formattedError);

        // Log the error if enabled
        if (logErrors) {
            logger.error(`Error in ${componentName}`, {
                component: componentName,
                originalError: error,
                formattedError,
                context,
                timestamp: new Date().toISOString()
            });
        }

        // Show notification if enabled
        if (showNotifications) {
            const autoClose = autoCloseNotifications 
                ? getNotificationAutoClose(formattedError.severity)
                : false;

            notifications.show({
                title: formattedError.title,
                message: formattedError.message,
                color: formattedError.color,
                icon: <ErrorIcon icon={formattedError.icon} />,
                autoClose,
                withCloseButton: true
            });
        }

        return formattedError;
    }, [componentName, showNotifications, logErrors, autoCloseNotifications]);

    /**
     * Handle API errors specifically
     * @param {Error} error - API error object
     * @param {Object} context - Additional context
     * @returns {Object} Formatted error object
     */
    const handleApiError = useCallback((error, context = {}) => {
        return handleError(error, {
            ...context,
            type: 'api',
            endpoint: context.endpoint,
            method: context.method
        });
    }, [handleError]);

    /**
     * Handle form validation errors
     * @param {string|Object} error - Validation error
     * @param {string} fieldName - Name of the field with error
     * @returns {Object} Formatted error object
     */
    const handleValidationError = useCallback((error, fieldName) => {
        return handleError(error, {
            type: 'validation',
            fieldName,
            showInline: true
        });
    }, [handleError]);

    /**
     * Clear the current error
     */
    const clearError = useCallback(() => {
        setCurrentError(null);
    }, []);

    /**
     * Check if there's currently an error
     * @returns {boolean} Whether there's an active error
     */
    const hasError = useCallback(() => {
        return currentError !== null;
    }, [currentError]);

    /**
     * Get error for a specific field (useful for form validation)
     * @param {string} fieldName - Field name to check
     * @returns {Object|null} Error for the field or null
     */
    const getFieldError = useCallback((fieldName) => {
        if (currentError && currentError.fieldName === fieldName) {
            return currentError;
        }
        return null;
    }, [currentError]);

    /**
     * Show a success notification (for consistency with error handling)
     * @param {string} title - Success title
     * @param {string} message - Success message
     * @param {Object} options - Additional options
     */
    const showSuccess = useCallback((title, message, options = {}) => {
        notifications.show({
            title,
            message,
            color: 'green',
            icon: <ErrorIcon icon="check" />,
            autoClose: 4000,
            ...options
        });
    }, []);

    /**
     * Show a warning notification
     * @param {string} title - Warning title
     * @param {string} message - Warning message
     * @param {Object} options - Additional options
     */
    const showWarning = useCallback((title, message, options = {}) => {
        notifications.show({
            title,
            message,
            color: 'orange',
            icon: <ErrorIcon icon="warning" />,
            autoClose: 6000,
            ...options
        });
    }, []);

    /**
     * Show an info notification
     * @param {string} title - Info title
     * @param {string} message - Info message
     * @param {Object} options - Additional options
     */
    const showInfo = useCallback((title, message, options = {}) => {
        notifications.show({
            title,
            message,
            color: 'blue',
            icon: <ErrorIcon icon="info" />,
            autoClose: 5000,
            ...options
        });
    }, []);

    return {
        // Main error handling
        handleError,
        handleApiError,
        handleValidationError,
        
        // Error state management
        currentError,
        clearError,
        hasError,
        getFieldError,
        
        // Utility notifications
        showSuccess,
        showWarning,
        showInfo
    };
};