import React from 'react';
import { Alert, Stack, Text, Button, Group, ThemeIcon } from '@mantine/core';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';
import logger from '../../services/logger';

/**
 * Error Boundary for DocumentManager sub-components
 * Provides graceful error handling and recovery options
 */
class DocumentManagerErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      componentName: props.componentName || 'DocumentManager Component'
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error
    logger.error('document_manager_error_boundary', {
      message: 'Error caught by DocumentManager error boundary',
      componentName: this.state.componentName,
      error: error.message,
      stack: error.stack,
      errorInfo,
    });

    this.setState({
      error,
      errorInfo
    });
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <Alert
          variant="light"
          color="red"
          title={`${this.state.componentName} Error`}
          icon={<ThemeIcon color="red" size="lg" variant="light">
            <IconAlertTriangle size={20} />
          </ThemeIcon>}
        >
          <Stack gap="md">
            <Text size="sm">
              An error occurred while rendering this component. This may be due to:
            </Text>
            <Text size="xs" c="dimmed" component="ul" style={{ margin: 0, paddingLeft: '1rem' }}>
              <li>Network connectivity issues</li>
              <li>Invalid data from the server</li>
              <li>Browser compatibility problems</li>
              <li>Temporary system issues</li>
            </Text>
            
            {this.state.error && process.env.NODE_ENV === 'development' && (
              <details style={{ marginTop: '0.5rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--mantine-color-dimmed)' }}>
                  Technical Details (Development Mode)
                </summary>
                <Text size="xs" c="red" ff="monospace" style={{ 
                  marginTop: '0.5rem', 
                  padding: '0.5rem', 
                  backgroundColor: 'var(--mantine-color-red-0)',
                  borderRadius: 'var(--mantine-radius-sm)',
                  whiteSpace: 'pre-wrap',
                  overflow: 'auto',
                  maxHeight: '200px'
                }}>
                  {this.state.error.message}
                  {this.state.error.stack && `\n\nStack Trace:\n${this.state.error.stack}`}
                </Text>
              </details>
            )}

            <Group gap="sm" mt="md">
              <Button
                variant="light"
                color="red"
                size="sm"
                leftSection={<IconRefresh size={16} />}
                onClick={this.handleRetry}
              >
                Try Again
              </Button>
              {this.props.onError && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => this.props.onError(this.state.error)}
                >
                  Report Issue
                </Button>
              )}
            </Group>
          </Stack>
        </Alert>
      );
    }

    return this.props.children;
  }
}

export default DocumentManagerErrorBoundary;