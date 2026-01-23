import PropTypes from 'prop-types';
import { Alert, Stack } from '@mantine/core';
import { IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

/**
 * MedicalPageAlerts - A reusable component for displaying error and success alerts
 *
 * Consolidates the repetitive Alert patterns used across 14+ medical pages.
 * Supports both error and success alerts with customizable titles, icons, and close buttons.
 *
 * @example
 * // Basic usage
 * <MedicalPageAlerts
 *   error={error}
 *   successMessage={successMessage}
 *   onClearError={clearError}
 * />
 *
 * @example
 * // With custom titles and success close button
 * <MedicalPageAlerts
 *   error={error}
 *   successMessage={successMessage}
 *   onClearError={clearError}
 *   onClearSuccess={clearSuccess}
 *   errorTitle="Validation Error"
 *   successTitle="Saved!"
 *   showSuccessCloseButton={true}
 * />
 */
function MedicalPageAlerts({
  error,
  successMessage,
  onClearError,
  onClearSuccess,
  errorTitle,
  successTitle,
  errorIcon,
  successIcon,
  variant = 'light',
  mb = 'md',
  showSuccessCloseButton = false,
}) {
  const { t } = useTranslation('common');

  if (!error && !successMessage) {
    return null;
  }

  const resolvedErrorIcon = errorIcon || <IconAlertTriangle size={16} />;
  const resolvedSuccessIcon = successIcon || <IconCheck size={16} />;
  const resolvedErrorTitle = errorTitle || t('labels.error', 'Error');
  const resolvedSuccessTitle = successTitle || t('labels.success', 'Success');

  // If both alerts are present, wrap them in a Stack
  const hasMultipleAlerts = error && successMessage;

  const errorAlert = error ? (
    <Alert
      variant={variant}
      color="red"
      title={resolvedErrorTitle}
      icon={resolvedErrorIcon}
      withCloseButton={!!onClearError}
      onClose={onClearError}
      mb={hasMultipleAlerts ? 0 : mb}
      style={{ whiteSpace: 'pre-line' }}
    >
      {error}
    </Alert>
  ) : null;

  const successAlert = successMessage ? (
    <Alert
      variant={variant}
      color="green"
      title={resolvedSuccessTitle}
      icon={resolvedSuccessIcon}
      withCloseButton={showSuccessCloseButton && !!onClearSuccess}
      onClose={onClearSuccess}
      mb={hasMultipleAlerts ? 0 : mb}
    >
      {successMessage}
    </Alert>
  ) : null;

  if (hasMultipleAlerts) {
    return (
      <Stack gap="xs" mb={mb}>
        {errorAlert}
        {successAlert}
      </Stack>
    );
  }

  return errorAlert || successAlert;
}

MedicalPageAlerts.propTypes = {
  /** Error message to display in a red alert */
  error: PropTypes.string,
  /** Success message to display in a green alert */
  successMessage: PropTypes.string,
  /** Callback when error alert close button is clicked */
  onClearError: PropTypes.func,
  /** Callback when success alert close button is clicked (requires showSuccessCloseButton) */
  onClearSuccess: PropTypes.func,
  /** Custom title for the error alert (defaults to i18n 'Error') */
  errorTitle: PropTypes.string,
  /** Custom title for the success alert (defaults to i18n 'Success') */
  successTitle: PropTypes.string,
  /** Custom icon element for error alert (defaults to IconAlertTriangle) */
  errorIcon: PropTypes.node,
  /** Custom icon element for success alert (defaults to IconCheck) */
  successIcon: PropTypes.node,
  /** Mantine Alert variant (defaults to 'light') */
  variant: PropTypes.string,
  /** Margin bottom for the alert container (defaults to 'md') */
  mb: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  /** Whether to show close button on success alert (defaults to false) */
  showSuccessCloseButton: PropTypes.bool,
};

export default MedicalPageAlerts;
