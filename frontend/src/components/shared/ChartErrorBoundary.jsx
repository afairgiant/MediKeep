import React from 'react';
import { Alert, Stack, Button, Text } from '@mantine/core';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import logger from '../../services/logger';

class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('chart_rendering_error', 'Chart rendering failed', {
      component: 'ChartErrorBoundary',
      error: error.message,
      errorInfo: errorInfo.componentStack,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Chart Error"
          color="red"
          variant="light"
        >
          <Stack gap="sm">
            <Text size="sm">
              Unable to render chart. This may be due to invalid data or a
              temporary issue.
            </Text>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconRefresh size={14} />}
              onClick={this.handleReset}
            >
              Try Again
            </Button>
          </Stack>
        </Alert>
      );
    }

    return this.props.children;
  }
}

export default ChartErrorBoundary;
