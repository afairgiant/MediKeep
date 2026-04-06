import React from 'react';
import i18n from '../../i18n/config';
import logger from '../../services/logger';
import { isDevelopment } from '../../config/env';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Generate unique error ID for tracking
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Update state with error details
    this.setState({
      errorInfo,
      errorId,
    }); // Log error to our frontend logging system
    logger.error(`React Error Boundary: ${error.message}`, {
      component: this.props.componentName || 'Unknown Component',
      errorId,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      props: this.props.logProps ? this.props : undefined,
      category: 'react_error',
    });

    logger.error('Error caught by boundary:', error, errorInfo);
  }

  handleRetry = () => {
    // Log retry attempt
    logger.userAction(
      'error_boundary_retry',
      this.props.componentName || 'ErrorBoundary',
      {
        errorId: this.state.errorId,
        retryAttempt: true,
      }
    );

    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-content">
            <h1>{i18n.t('errors:boundary.somethingWentWrong')}</h1>
            <p>
              {i18n.t('errors:boundary.unexpectedError')}
            </p>

            <div className="error-details">
              {this.state.errorId && (
                <p>
                  <strong>{i18n.t('errors:boundary.errorIdLabel')}</strong> {this.state.errorId}
                </p>
              )}
              {this.props.componentName && (
                <p>
                  <strong>{i18n.t('errors:boundary.componentLabel')}</strong> {this.props.componentName}
                </p>
              )}
            </div>

            <details>
              <summary>{i18n.t('errors:boundary.errorDetails')}</summary>
              <pre>{this.state.error?.toString()}</pre>
              {isDevelopment() &&
                this.state.error?.stack && <pre>{this.state.error.stack}</pre>}
            </details>

            <div className="error-actions">
              <button
                onClick={this.handleRetry}
                className="retry-button"
                type="button"
                style={{ marginRight: '10px' }}
              >
                {i18n.t('errors:boundary.tryAgain')}
              </button>
              <button
                onClick={() => window.location.reload()}
                className="reload-button"
              >
                {i18n.t('errors:boundary.reloadPage')}
              </button>
            </div>

            <p style={{ marginTop: '20px', fontSize: '0.9em', color: 'var(--mantine-color-gray-6)' }}>
              {i18n.t('errors:boundary.errorLogged')}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component to wrap components with error boundary
export const withErrorBoundary = (WrappedComponent, componentName) => {
  return function WithErrorBoundaryComponent(props) {
    return (
      <ErrorBoundary
        componentName={
          componentName || WrappedComponent.displayName || WrappedComponent.name
        }
        logProps={false} // Set to true to log props (be careful with sensitive data)
      >
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
};

// Hook for manual error reporting
export const useErrorHandler = () => {
  const reportError = React.useCallback(
    (error, componentName, additionalData = {}) => {
      logger.error(`Manual Error Report: ${error.message}`, {
        component: componentName,
        stack: error.stack,
        category: 'manual_error',
        ...additionalData,
        manualReport: true,
        timestamp: new Date().toISOString(),
      });
    },
    []
  );

  return { reportError };
};

export default ErrorBoundary;
