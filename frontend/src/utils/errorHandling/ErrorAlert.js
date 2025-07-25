/**
 * Reusable error alert component
 * Displays formatted errors with consistent styling and suggestions
 */

import React from 'react';
import { Alert, Text, Stack, List } from '@mantine/core';
import { ErrorIcon } from './ErrorIcon';

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