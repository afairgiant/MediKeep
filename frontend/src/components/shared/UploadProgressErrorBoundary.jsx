import React from 'react';
import { Alert, Button } from '@mantine/core';
import i18n from '../../i18n/config';
import logger from '../../services/logger';

/**
 * Error boundary specifically for upload progress components
 * Prevents progress tracking errors from crashing the entire form
 */
class UploadProgressErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    logger.error('upload_progress_error_boundary', {
      error: error.message,
      errorInfo,
      component: 'UploadProgressErrorBoundary',
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <Alert color="red" title={i18n.t('documents:errorBoundary.uploadError')}>
          {i18n.t('documents:errorBoundary.uploadErrorDescription')}
          <Button
            onClick={() => this.setState({ hasError: false, error: null })}
            variant="light"
            size="sm"
            style={{ marginTop: '8px' }}
          >
            {i18n.t('documents:errorBoundary.tryAgain')}
          </Button>
        </Alert>
      );
    }
    
    return this.props.children;
  }
}

export default UploadProgressErrorBoundary;