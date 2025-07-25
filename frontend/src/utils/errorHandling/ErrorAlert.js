/**
 * Reusable error alert component
 * Displays formatted errors with consistent styling and suggestions
 * Enhanced to support error queues as suggested by reviewer feedback
 */

import React from 'react';
import { Alert, Text, Stack, List, Badge, Group, Collapse, Button } from '@mantine/core';
import { ErrorIcon } from './ErrorIcon';
import { ERROR_SEVERITY } from './constants';

/**
 * ErrorAlert component - displays formatted errors consistently
 * @param {Object} props
 * @param {Object} props.error - Formatted error object
 * @param {boolean} props.showSuggestions - Whether to show suggestions (default: true)
 * @param {boolean} props.showIcon - Whether to show icon (default: true)
 * @param {string} props.variant - Alert variant (default: 'light')
 * @param {Object} props.style - Additional styles
 * @param {Function} props.onClose - Close handler (optional)
 * @returns {JSX.Element|null} Error alert component or null if no error
 */
export const ErrorAlert = ({ 
    error, 
    showSuggestions = true,
    showIcon = true,
    variant = 'light',
    style = {},
    onClose,
    ...props 
}) => {
    if (!error) {
        return null;
    }

    return (
        <Alert
            color={error.color}
            title={error.title}
            icon={showIcon ? <ErrorIcon icon={error.icon} /> : null}
            variant={variant}
            withCloseButton={!!onClose}
            onClose={onClose}
            style={style}
            {...props}
        >
            <Text size="sm">{error.message}</Text>
            
            {showSuggestions && error.suggestions && error.suggestions.length > 0 && (
                <Stack gap="xs" mt="sm">
                    <Text size="sm" fw={500} c="dimmed">
                        Suggestions:
                    </Text>
                    <List size="sm" spacing="xs">
                        {error.suggestions.map((suggestion, index) => (
                            <List.Item key={index}>
                                <Text size="sm" c="dimmed">{suggestion}</Text>
                            </List.Item>
                        ))}
                    </List>
                </Stack>
            )}
        </Alert>
    );
};

/**
 * Compact error alert for inline display (e.g., form fields)
 * @param {Object} props
 * @param {Object} props.error - Formatted error object
 * @param {boolean} props.showIcon - Whether to show icon (default: false for compact)
 * @returns {JSX.Element|null} Compact error alert or null if no error
 */
export const CompactErrorAlert = ({ error, showIcon = false, ...props }) => {
    if (!error) {
        return null;
    }

    return (
        <Alert
            color={error.color}
            icon={showIcon ? <ErrorIcon icon={error.icon} size="0.9rem" /> : null}
            variant="filled"
            size="sm"
            {...props}
        >
            <Text size="xs">{error.message}</Text>
        </Alert>
    );
};

/**
 * Error queue alert - displays multiple errors with priority (addresses reviewer feedback)
 * @param {Object} props
 * @param {Array} props.errorQueue - Array of errors to display
 * @param {Function} props.onDismiss - Function to dismiss a specific error
 * @param {Function} props.onClearAll - Function to clear all errors
 * @param {boolean} props.showCount - Whether to show error count (default: true)
 * @param {number} props.maxVisible - Maximum errors to show expanded (default: 3)
 * @returns {JSX.Element|null} Error queue alert or null if no errors
 */
export const ErrorQueueAlert = ({ 
    errorQueue = [], 
    onDismiss, 
    onClearAll,
    showCount = true,
    maxVisible = 3,
    ...props 
}) => {
    const [expanded, setExpanded] = React.useState(false);
    
    if (!errorQueue || errorQueue.length === 0) {
        return null;
    }

    // Sort errors by severity (high -> medium -> low) and then by timestamp
    const sortedErrors = [...errorQueue].sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
        if (severityDiff !== 0) return severityDiff;
        return b.timestamp - a.timestamp; // Newer errors first within same severity
    });

    const visibleErrors = expanded ? sortedErrors : sortedErrors.slice(0, maxVisible);
    const hiddenCount = sortedErrors.length - maxVisible;

    return (
        <Stack gap="xs" {...props}>
            {/* Error count header */}
            {showCount && sortedErrors.length > 1 && (
                <Group justify="space-between">
                    <Group gap="xs">
                        <Badge color="red" variant="light">
                            {sortedErrors.length} Error{sortedErrors.length !== 1 ? 's' : ''}
                        </Badge>
                        <Text size="sm" c="dimmed">
                            {sortedErrors.filter(e => e.severity === ERROR_SEVERITY.HIGH).length} high priority
                        </Text>
                    </Group>
                    {onClearAll && (
                        <Button size="xs" variant="subtle" color="red" onClick={onClearAll}>
                            Clear All
                        </Button>
                    )}
                </Group>
            )}

            {/* Display visible errors */}
            {visibleErrors.map((error) => (
                <ErrorAlert
                    key={error.id}
                    error={error}
                    onClose={onDismiss ? () => onDismiss(error.id) : undefined}
                    showSuggestions={error.severity === ERROR_SEVERITY.HIGH}
                />
            ))}

            {/* Show more/less button */}
            {hiddenCount > 0 && (
                <Button
                    variant="subtle"
                    size="xs"
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? 'Show Less' : `Show ${hiddenCount} More Error${hiddenCount !== 1 ? 's' : ''}`}
                </Button>
            )}
        </Stack>
    );
};

/**
 * Error boundary fallback component using ErrorAlert
 * @param {Object} props
 * @param {Error} props.error - Error that was caught
 * @param {Function} props.resetError - Function to reset the error boundary
 * @returns {JSX.Element} Error boundary fallback UI
 */
export const ErrorBoundaryFallback = ({ error, resetError }) => {
    const formattedError = {
        title: 'Something Went Wrong',
        message: 'An unexpected error occurred. The error has been logged and will be investigated.',
        color: 'red',
        icon: 'alert-circle',
        suggestions: [
            'Try refreshing the page',
            'Go back to the previous page',
            'Contact support if the problem persists'
        ],
        severity: 'high'
    };

    return (
        <Stack gap="md" p="xl">
            <ErrorAlert error={formattedError} />
            {resetError && (
                <div>
                    <button onClick={resetError} style={{ 
                        padding: '8px 16px', 
                        backgroundColor: '#1976d2', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}>
                        Try Again
                    </button>
                </div>
            )}
        </Stack>
    );
};