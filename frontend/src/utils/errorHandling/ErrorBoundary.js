/**
 * React Error Boundary component
 * Catches JavaScript errors anywhere in the component tree and displays fallback UI
 */

import React from 'react';
import { ErrorBoundaryFallback } from './ErrorAlert';
import logger from '../../services/logger';

/**
 * Error Boundary component using class component syntax (required by React)
 */
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log the error
        logger.error('Error caught by ErrorBoundary', {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString()
        });

        // Update state with error details
        this.setState({
            error,
            errorInfo
        });

        // Call onError callback if provided
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    resetError = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        
        // Call onReset callback if provided
        if (this.props.onReset) {
            this.props.onReset();
        }
    };

    render() {
        if (this.state.hasError) {
            // Use custom fallback component if provided, otherwise use default
            if (this.props.fallback) {
                return this.props.fallback(this.state.error, this.resetError);
            }

            // Use ErrorBoundaryFallback component
            return (
                <ErrorBoundaryFallback 
                    error={this.state.error} 
                    resetError={this.resetError}
                />
            );
        }

        return this.props.children;
    }
}

/**
 * Higher-order component to wrap components with error boundary
 * @param {React.Component} Component - Component to wrap
 * @param {Object} errorBoundaryProps - Props to pass to ErrorBoundary
 * @returns {React.Component} Wrapped component
 */
export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
    const WrappedComponent = (props) => (
        <ErrorBoundary {...errorBoundaryProps}>
            <Component {...props} />
        </ErrorBoundary>
    );

    WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
    
    return WrappedComponent;
};

/**
 * Hook to manually trigger error boundary (for function components)
 * @returns {Function} Function to throw error that will be caught by boundary
 */
export const useErrorHandler = () => {
    return (error) => {
        throw error;
    };
};