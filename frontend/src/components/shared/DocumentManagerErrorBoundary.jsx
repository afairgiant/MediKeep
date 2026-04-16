import React from 'react';
import { Alert, Stack, Text, Button, Group, ThemeIcon } from '@mantine/core';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';
import i18n from '../../i18n/config';
import logger from '../../services/logger';
import { env } from '../../config/env';

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
      componentName: props.componentName || 'DocumentManager Component',
    };
  }

  static getDerivedStateFromError(_error) {
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
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
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
          icon={
            <ThemeIcon color="red" size="lg" variant="light">
              <IconAlertTriangle size={20} />
            </ThemeIcon>
          }
        >
          <Stack gap="md">
            <Text size="sm">
              {i18n.t('documents:errorBoundary.documentErrorDescription')}
            </Text>
            <Text
              size="xs"
              c="dimmed"
              component="ul"
              style={{ margin: 0, paddingLeft: '1rem' }}
            >
              <li>{i18n.t('documents:errorBoundary.networkIssues')}</li>
              <li>{i18n.t('documents:errorBoundary.invalidData')}</li>
              <li>{i18n.t('documents:errorBoundary.browserCompat')}</li>
              <li>{i18n.t('documents:errorBoundary.tempIssues')}</li>
            </Text>

            {this.state.error && env.DEV && (
              <details style={{ marginTop: '0.5rem' }}>
                <summary
                  style={{
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    color: 'var(--mantine-color-dimmed)',
                  }}
                >
                  {i18n.t('documents:errorBoundary.errorDetails')}
                </summary>
                <Text
                  size="xs"
                  c="red"
                  ff="monospace"
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem',
                    backgroundColor: 'var(--mantine-color-red-0)',
                    borderRadius: 'var(--mantine-radius-sm)',
                    whiteSpace: 'pre-wrap',
                    overflow: 'auto',
                    maxHeight: '200px',
                  }}
                >
                  {this.state.error.message}
                  {this.state.error.stack &&
                    `\n\nStack Trace:\n${this.state.error.stack}`}
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
                {i18n.t('documents:errorBoundary.tryAgain')}
              </Button>
              {this.props.onError && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => this.props.onError(this.state.error)}
                >
                  {i18n.t('documents:errorBoundary.errorDetails')}
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
