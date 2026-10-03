import { Component, type ErrorInfo, type ReactNode } from 'react';

import logger from '../../services/logger';
import { notifyError } from '../../utils/notifyTranslated';

interface Props {
  /** Closes the create dialog */
  onClose: () => void;
  children: ReactNode;
}

/**
 * Keeps a failure inside a create dialog (a chunk that fails to load after a deploy,
 * or a render error) from reaching the app-level error boundary, which would unmount
 * the dialog behind it along with its unsaved edits. The failed dialog is closed and
 * the user is told; everything else stays as it was.
 */
class InlineCreateErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('inline_create_dialog_failed', {
      message: 'The create dialog failed to load or render',
      error: error.message,
      componentStack: info.componentStack,
      component: 'InlineCreateErrorBoundary',
    });
    notifyError('common:inlineCreate.loadError');
    this.props.onClose();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default InlineCreateErrorBoundary;
