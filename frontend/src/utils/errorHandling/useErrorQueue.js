/**
 * Enhanced error handling hook with error queue support
 * Addresses reviewer feedback about implementing error queue instead of single error state
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import { formatError, getNotificationAutoClose } from './formatError';
import { ErrorIcon } from './ErrorIcon';
import { ERROR_QUEUE_CONFIG, ERROR_SEVERITY } from './constants';
import logger from '../../services/logger';

/**
 * Enhanced error handling hook with queue support
 * @param {string} componentName - Name of the component using this hook
 * @param {Object} options - Configuration options
 * @returns {Object} Error handling utilities with queue support
 */
export const useErrorQueue = (componentName, options = {}) => {
    const [errorQueue, setErrorQueue] = useState([]);
    const [currentError, setCurrentError] = useState(null); // Most recent/important error for display
    const errorIdCounter = useRef(0);
    const clearTimers = useRef(new Map());
    
    const {
        showNotifications = true,
        logErrors = true,
        autoCloseNotifications = true,
        maxErrors = ERROR_QUEUE_CONFIG.MAX_ERRORS,
        autoClearAfter = ERROR_QUEUE_CONFIG.AUTO_CLEAR_AFTER,
        showMultipleNotifications = ERROR_QUEUE_CONFIG.SHOW_MULTIPLE_NOTIFICATIONS
    } = options;

    /**
     * Generate unique error ID
     */
    const generateErrorId = useCallback(() => {
        return `error_${componentName}_${++errorIdCounter.current}_${Date.now()}`;
    }, [componentName]);

    /**
     * Add error to queue with automatic cleanup
     */
    const addToQueue = useCallback((formattedError) => {
        const errorWithId = {
            ...formattedError,
            id: generateErrorId(),
            timestamp: Date.now(),
            component: componentName
        };

        setErrorQueue(prevQueue => {
            // Remove oldest errors if queue is full
            const newQueue = prevQueue.length >= maxErrors 
                ? prevQueue.slice(-(maxErrors - 1))
                : prevQueue;
            
            return [...newQueue, errorWithId];
        });

        // Set as current error if it's high severity or no current error
        setCurrentError(prevCurrent => {
            if (!prevCurrent || 
                formattedError.severity === ERROR_SEVERITY.HIGH ||
                (formattedError.severity === ERROR_SEVERITY.MEDIUM && prevCurrent.severity === ERROR_SEVERITY.LOW)) {
                return errorWithId;
            }
            return prevCurrent;
        });

        // Set up auto-clear timer
        if (autoClearAfter > 0) {
            const timerId = setTimeout(() => {
                removeFromQueue(errorWithId.id);
            }, autoClearAfter);
            
            clearTimers.current.set(errorWithId.id, timerId);
        }

        return errorWithId;
    }, [componentName, maxErrors, autoClearAfter, generateErrorId]);

    /**
     * Remove error from queue - race condition eliminated with cleaner approach
     */
    const removeFromQueue = useCallback((errorId) => {
        // Clear associated timer first
        const timer = clearTimers.current.get(errorId);
        if (timer) {
            clearTimeout(timer);
            clearTimers.current.delete(errorId);
        }

        // Store current error state to determine if we need to find a replacement
        let wasCurrentError = false;
        setCurrentError(prevCurrent => {
            wasCurrentError = prevCurrent?.id === errorId;
            return wasCurrentError ? null : prevCurrent;
        });

        // Update queue and find next error if needed
        setErrorQueue(prevQueue => {
            const remainingQueue = prevQueue.filter(error => error.id !== errorId);
            
            // If the removed error was current, find next highest priority
            if (wasCurrentError && remainingQueue.length > 0) {
                const nextError = remainingQueue
                    .sort((a, b) => {
                        const severityOrder = { high: 3, medium: 2, low: 1 };
                        const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
                        if (severityDiff !== 0) return severityDiff;
                        return b.timestamp - a.timestamp; // Newer first within same severity
                    })[0];
                
                // Set new current error
                setCurrentError(nextError);
            }
            
            return remainingQueue;
        });
    }, []);

    /**
     * Clear all errors
     */
    const clearAllErrors = useCallback(() => {
        setErrorQueue([]);
        setCurrentError(null);
        
        // Clear all timers
        clearTimers.current.forEach(timer => clearTimeout(timer));
        clearTimers.current.clear();
    }, []);

    /**
     * Handle an error - format it, add to queue, display it, and log it
     */
    const handleError = useCallback((error, context = {}) => {
        const formattedError = formatError(error, {
            ...context,
            component: componentName
        });

        // Add to queue
        const errorWithId = addToQueue(formattedError);

        // Log the error if enabled
        if (logErrors) {
            logger.error(`Error in ${componentName}`, {
                component: componentName,
                errorId: errorWithId.id,
                originalError: error,
                formattedError,
                context,
                queueSize: errorQueue.length + 1,
                timestamp: new Date().toISOString()
            });
        }

        // Show notification if enabled
        if (showNotifications) {
            const shouldShowNotification = showMultipleNotifications || 
                !notifications.notifications.some(n => n.title === formattedError.title);

            if (shouldShowNotification) {
                const autoClose = autoCloseNotifications 
                    ? getNotificationAutoClose(formattedError.severity)
                    : false;

                notifications.show({
                    id: errorWithId.id, // Use error ID as notification ID
                    title: formattedError.title,
                    message: formattedError.message,
                    color: formattedError.color,
                    icon: <ErrorIcon icon={formattedError.icon} />,
                    autoClose,
                    withCloseButton: true,
                    onClose: () => removeFromQueue(errorWithId.id)
                });
            }
        }

        return formattedError;
    }, [componentName, addToQueue, logErrors, showNotifications, autoCloseNotifications, 
        showMultipleNotifications, removeFromQueue, errorQueue.length]);

    /**
     * Handle API errors specifically
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
     */
    const handleValidationError = useCallback((error, fieldName) => {
        return handleError(error, {
            type: 'validation',
            fieldName,
            showInline: true
        });
    }, [handleError]);

    /**
     * Get errors by severity
     */
    const getErrorsBySeverity = useCallback((severity) => {
        return errorQueue.filter(error => error.severity === severity);
    }, [errorQueue]);

    /**
     * Get errors by type
     */
    const getErrorsByType = useCallback((type) => {
        return errorQueue.filter(error => error.type === type);
    }, [errorQueue]);

    /**
     * Check if there are errors of specific severity
     */
    const hasErrorsOfSeverity = useCallback((severity) => {
        return errorQueue.some(error => error.severity === severity);
    }, [errorQueue]);

    /**
     * Get error statistics
     */
    const getErrorStats = useCallback(() => {
        return {
            total: errorQueue.length,
            high: getErrorsBySeverity(ERROR_SEVERITY.HIGH).length,
            medium: getErrorsBySeverity(ERROR_SEVERITY.MEDIUM).length,
            low: getErrorsBySeverity(ERROR_SEVERITY.LOW).length,
            oldest: errorQueue.length > 0 ? errorQueue[0] : null,
            newest: errorQueue.length > 0 ? errorQueue[errorQueue.length - 1] : null
        };
    }, [errorQueue, getErrorsBySeverity]);

    /**
     * Success/Warning/Info helpers remain the same
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

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            clearTimers.current.forEach(timer => clearTimeout(timer));
            clearTimers.current.clear();
        };
    }, []);

    return {
        // Main error handling
        handleError,
        handleApiError,
        handleValidationError,
        
        // Error queue management
        errorQueue,
        currentError,
        removeFromQueue,
        clearAllErrors,
        
        // Error querying
        getErrorsBySeverity,
        getErrorsByType,
        hasErrorsOfSeverity,
        getErrorStats,
        
        // Legacy compatibility (for single error workflows)
        clearError: () => currentError && removeFromQueue(currentError.id),
        hasError: () => currentError !== null,
        getFieldError: (fieldName) => {
            const fieldErrors = errorQueue.filter(error => error.fieldName === fieldName);
            return fieldErrors.length > 0 ? fieldErrors[fieldErrors.length - 1] : null;
        },
        
        // Utility notifications
        showSuccess,
        showWarning,
        showInfo
    };
};