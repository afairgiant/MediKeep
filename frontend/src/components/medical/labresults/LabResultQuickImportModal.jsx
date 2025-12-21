import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Stack,
  TextInput,
  Button,
  Group,
  Text,
  Paper,
  Alert,
  Stepper,
} from '@mantine/core';
import {
  IconFileUpload,
  IconAlertCircle,
  IconCheck,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import TestComponentBulkEntry from './TestComponentBulkEntry';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import { apiService } from '../../../services/api';
import logger from '../../../services/logger';

const LabResultQuickImportModal = ({
  isOpen,
  onClose,
  onSuccess,
  patientId,
}) => {
  const { t } = useTranslation('common');

  // Stage management
  const [stage, setStage] = useState('form'); // 'form' | 'parsing'
  const [testName, setTestName] = useState('');
  const [createdLabResultId, setCreatedLabResultId] = useState(null);
  const [componentsAdded, setComponentsAdded] = useState(false);
  const [parsedComponentCount, setParsedComponentCount] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showDataLossWarning, setShowDataLossWarning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // TODO: Cleanup on unmount removed due to timing issues
  // User can manually delete empty lab results if needed

  // Handle creating the minimal lab result
  const handleCreateLabResult = useCallback(async () => {
    const MIN_TEST_NAME_LENGTH = 2;
    const MAX_TEST_NAME_LENGTH = 255;

    // Validate required fields
    if (!patientId) {
      setError('Patient ID is required. Please select a patient first.');
      return;
    }

    if (!testName.trim()) {
      setError(t('labResults.testNameRequired', 'Test name is required'));
      return;
    }

    if (testName.trim().length < MIN_TEST_NAME_LENGTH) {
      setError(
        t('labResults.testNameTooShort', 'Test name must be at least {{minLength}} characters', {
          minLength: MIN_TEST_NAME_LENGTH,
        })
      );
      return;
    }

    if (testName.trim().length > MAX_TEST_NAME_LENGTH) {
      setError(
        t('labResults.testNameTooLong', 'Test name cannot exceed {{maxLength}} characters', {
          maxLength: MAX_TEST_NAME_LENGTH,
        })
      );
      return;
    }

    // Sanitize test name - strip all HTML-related characters
    // Using simple character removal instead of regex to avoid bypasses
    const sanitizedTestName = testName.trim().replace(/[<>]/g, '');

    setIsCreating(true);
    setError(null);

    try {
      // Create minimal lab result with defaults
      // Dates will be set by PDF parser based on the actual test date
      const labResultData = {
        patient_id: patientId,
        test_name: sanitizedTestName,
        status: 'completed',  // We have results, so it's completed
        ordered_date: null,   // Will be set from PDF or defaulted
        completed_date: null, // Will be set from PDF
        facility: null,
        practitioner_id: null,
        result: null,
        category: null,
        notes: null,
        tags: [],
      };

      logger.info('quick_import_creating_lab_result', {
        message: 'Creating minimal lab result for quick PDF import',
        patientId,
        testName: testName.trim(),
        component: 'LabResultQuickImportModal',
      });

      const response = await apiService.createLabResult(labResultData);

      // Handle both response formats: response.data or response directly
      const createdResult = response?.data || response;

      if (createdResult && createdResult.id) {
        setCreatedLabResultId(createdResult.id);
        setStage('parsing');

        logger.info('quick_import_lab_result_created', {
          message: 'Lab result created successfully for quick import',
          labResultId: createdResult.id,
          component: 'LabResultQuickImportModal',
        });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      logger.error('quick_import_create_failed', {
        message: 'Failed to create lab result for quick import',
        error: err.message,
        component: 'LabResultQuickImportModal',
      });

      // Parse backend validation errors for specific field messages
      let errorMessage = err.message;

      // Check if it's a validation error from the backend
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;

        // Handle array of validation errors (FastAPI format)
        if (Array.isArray(detail)) {
          const fieldErrors = detail.map(error => {
            const field = error.loc?.[error.loc.length - 1] || 'field';
            const message = error.msg || error.message || 'Invalid value';

            // Map field names to user-friendly names
            const fieldName = field === 'test_name'
              ? t('labResults.testNameLabel', 'Test name')
              : field.replace(/_/g, ' ');

            return `${fieldName}: ${message}`;
          });

          errorMessage = fieldErrors.join(', ');
        }
        // Handle string error message
        else if (typeof detail === 'string') {
          errorMessage = detail;
        }
      }
      // Detect network errors for better user messaging
      else if (err instanceof TypeError && !navigator.onLine) {
        errorMessage = t('labResults.networkError', 'Network error. Please check your connection and try again.');
      } else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || err.message?.toLowerCase().includes('timeout')) {
        errorMessage = t('labResults.timeoutError', 'Request timed out. Please try again.');
      } else if (err instanceof TypeError || err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
        errorMessage = t('labResults.networkError', 'Network error. Please check your connection and try again.');
      }

      setError(errorMessage || t('labResults.createFailedTryAgain', 'Failed to create lab result. Please try again.'));

      notifications.show({
        title: t('labResults.error', 'Error'),
        message: errorMessage || t('labResults.createFailed', 'Failed to create lab result'),
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setIsCreating(false);
    }
  }, [testName, patientId, t]);

  // Handle when components are parsed (for data loss warning)
  const handleComponentsParsed = useCallback(
    componentCount => {
      setParsedComponentCount(componentCount);

      if (componentCount > 0) {
        logger.info('quick_import_components_parsed', {
          message: 'Test components parsed in quick import',
          labResultId: createdLabResultId,
          count: componentCount,
          component: 'LabResultQuickImportModal',
        });
      }
    },
    [createdLabResultId]
  );

  // Handle when components are successfully added
  const handleComponentsAdded = useCallback(
    newComponents => {
      setComponentsAdded(true);
      setParsedComponentCount(0); // Reset parsed count

      logger.info('quick_import_components_added', {
        message: 'Test components added via quick import',
        labResultId: createdLabResultId,
        count: newComponents.length,
        component: 'LabResultQuickImportModal',
      });

      notifications.show({
        title: t('labResults.success', 'Success'),
        message: t(
          'labResults.quickImportSuccess',
          'Lab result and test components imported successfully'
        ),
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      // Call onSuccess callback
      if (onSuccess) {
        onSuccess(createdLabResultId);
      }
    },
    [createdLabResultId, onSuccess, t]
  );

  // Reset all state
  const resetState = useCallback(() => {
    setStage('form');
    setTestName('');
    setCreatedLabResultId(null);
    setComponentsAdded(false);
    setParsedComponentCount(0);
    setIsCreating(false);
    setError(null);
  }, []);

  // Handle modal close - check if we need to cleanup
  const handleClose = useCallback(() => {
    // Priority 1: If components are parsed but not added, warn about data loss
    if (parsedComponentCount > 0 && !componentsAdded) {
      setShowDataLossWarning(true);
    }
    // Priority 2: If we created a lab result but didn't add components, prompt to delete
    else if (createdLabResultId && !componentsAdded) {
      setShowDeleteConfirmation(true);
    } else {
      // Clean close
      resetState();
      onClose();
    }
  }, [createdLabResultId, componentsAdded, parsedComponentCount, onClose, resetState]);

  // Handle delete confirmation
  const handleConfirmDelete = useCallback(async () => {
    if (isDeleting) return; // Prevent double submission

    setIsDeleting(true);
    try {
      await apiService.deleteLabResult(createdLabResultId);

      logger.info('quick_import_empty_deleted', {
        message: 'Empty lab result deleted after quick import cancellation',
        labResultId: createdLabResultId,
        component: 'LabResultQuickImportModal',
      });

      notifications.show({
        title: t('labResults.success', 'Success'),
        message: t('labResults.labResultDeleted', 'Lab result deleted'),
        color: 'green',
      });
    } catch (err) {
      logger.error('quick_import_delete_failed', {
        message: 'Failed to delete empty lab result',
        labResultId: createdLabResultId,
        error: err.message,
        component: 'LabResultQuickImportModal',
      });

      notifications.show({
        title: t('labResults.error', 'Error'),
        message: t('labResults.deleteFailed', 'Failed to delete lab result'),
        color: 'red',
      });
    } finally {
      setIsDeleting(false);
    }

    // Reset state and close modal
    setShowDeleteConfirmation(false);
    resetState();
    onClose();
  }, [createdLabResultId, onClose, t, isDeleting, resetState]);

  // Handle cancel delete (keep lab result)
  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirmation(false);
    resetState();
    onClose();
  }, [onClose, resetState]);

  // Handle data loss warning - user wants to continue despite losing parsed data
  const handleConfirmDataLoss = useCallback(() => {
    setShowDataLossWarning(false);
    // Now check if we need to show delete confirmation
    if (createdLabResultId && !componentsAdded) {
      setShowDeleteConfirmation(true);
    } else {
      resetState();
      onClose();
    }
  }, [createdLabResultId, componentsAdded, onClose, resetState]);

  // Handle cancel data loss warning - return to modal
  const handleCancelDataLoss = useCallback(() => {
    setShowDataLossWarning(false);
  }, []);

  // Get current step number for stepper
  const activeStep = stage === 'form' ? 0 : 1;

  return (
    <>
      <Modal
        opened={isOpen}
        onClose={handleClose}
        title={t(
          'labResults.quickImportModalTitle',
          'Quick PDF Import - Step {{step}} of 2',
          { step: activeStep + 1 }
        )}
        size={stage === 'parsing' ? 'calc(95vw)' : 'md'}
        centered
        zIndex={3000}
        closeOnClickOutside={false}
        closeOnEscape={false}
      >
        <Stack gap="md">
          {/* Stepper */}
          <Stepper active={activeStep} size="sm">
            <Stepper.Step
              label={t('labResults.stepperLabels.labResultInfo', 'Lab Result Info')}
              description={t('labResults.stepperLabels.enterTestName', 'Enter test name')}
            />
            <Stepper.Step
              label={t('labResults.stepperLabels.uploadParse', 'Upload & Parse')}
              description={t('labResults.stepperLabels.importFromPdf', 'Import from PDF')}
            />
          </Stepper>

          {/* Stage 1: Form */}
          {stage === 'form' && (
            <Stack gap="md">
              <Paper withBorder p="md" bg="blue.0">
                <Text size="sm" c="dimmed">
                  {t(
                    'labResults.quickFormInstructions',
                    "Enter a name for this lab result, then you'll be able to upload and parse your PDF."
                  )}
                </Text>
              </Paper>

              {error && (
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  title={t('labResults.error', 'Error')}
                  color="red"
                  onClose={() => setError(null)}
                  role="alert"
                  aria-live="assertive"
                >
                  <Stack gap="xs">
                    <Text size="sm">{error}</Text>
                    <Group gap="xs">
                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        onClick={handleCreateLabResult}
                        disabled={!testName.trim() || isCreating}
                      >
                        {t('buttons.retry', 'Retry')}
                      </Button>
                    </Group>
                  </Stack>
                </Alert>
              )}

              <TextInput
                label={t('labResults.testNameLabel', 'Lab Test Name')}
                placeholder={t(
                  'labResults.testNamePlaceholder',
                  'Endocrine Bloodwork etc.'
                )}
                description={t(
                  'labResults.testNameDescription',
                  'This is the only required field - you can add more details later'
                )}
                value={testName}
                onChange={e => {
                  setTestName(e.target.value);
                  // Clear error when user starts typing
                  if (error) setError(null);
                }}
                required
                autoFocus
                error={
                  error && !testName.trim()
                    ? t('labResults.testNameRequired', 'Test name is required')
                    : null
                }
              />

              <Group justify="flex-end" mt="md">
                <Button variant="subtle" onClick={onClose}>
                  {t('buttons.cancel', 'Cancel')}
                </Button>
                <Button
                  leftSection={<IconFileUpload size={16} />}
                  onClick={handleCreateLabResult}
                  loading={isCreating}
                  disabled={!testName.trim()}
                >
                  {t('labResults.createAndContinue', 'Create & Upload PDF')}
                </Button>
              </Group>

              <FormLoadingOverlay
                visible={isCreating}
                message={t('labResults.creatingLabResult', 'Creating lab result...')}
              />
            </Stack>
          )}

          {/* Stage 2: PDF Parsing */}
          {stage === 'parsing' && createdLabResultId && (
            <Stack gap="md">
              <Alert
                icon={<IconCheck size={16} />}
                title={t('labResults.success', 'Success')}
                color="green"
                role="status"
                aria-live="polite"
              >
                {t(
                  'labResults.labResultCreated',
                  'Lab result "{{testName}}" has been created. Now you can upload and parse your PDF.',
                  { testName }
                )}
              </Alert>

              <TestComponentBulkEntry
                labResultId={createdLabResultId}
                onComponentsAdded={handleComponentsAdded}
                onComponentsParsed={handleComponentsParsed}
                onError={error => {
                  logger.error('quick_import_bulk_entry_error', {
                    message: 'Error in bulk entry during quick import',
                    labResultId: createdLabResultId,
                    error: error.message,
                    component: 'LabResultQuickImportModal',
                  });

                  notifications.show({
                    title: t('labResults.error', 'Error'),
                    message: error.message || t('labResults.errorOccurred', 'An error occurred'),
                    color: 'red',
                  });
                }}
              />
            </Stack>
          )}
        </Stack>
      </Modal>

      {/* Data Loss Warning Modal */}
      <Modal
        opened={showDataLossWarning}
        onClose={handleCancelDataLoss}
        title={t(
          'labResults.unsavedDataWarning',
          'Unsaved Parsed Data'
        )}
        size="md"
        centered
        zIndex={3002}
        role="alertdialog"
        aria-describedby="data-loss-warning-description"
      >
        <Stack gap="md">
          <Alert icon={<IconAlertCircle size={16} />} color="orange" role="alert">
            <Text size="sm" id="data-loss-warning-description">
              {t(
                'labResults.unsavedDataMessage',
                'You have {{count}} parsed test component(s) that haven\'t been added yet. If you close now, you\'ll lose this parsed data.',
                { count: parsedComponentCount }
              )}
            </Text>
          </Alert>

          <Text size="sm" c="dimmed">
            {t(
              'labResults.unsavedDataInstructions',
              'Click "Add Components" in the Preview tab to save your parsed data before closing.'
            )}
          </Text>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={handleCancelDataLoss}>
              {t('labResults.continueEditing', 'Continue Editing')}
            </Button>
            <Button color="orange" onClick={handleConfirmDataLoss}>
              {t('labResults.discardParsedData', 'Discard Parsed Data')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={showDeleteConfirmation}
        onClose={handleCancelDelete}
        title={t(
          'labResults.emptyLabResultWarning',
          'Lab Result Created But Empty'
        )}
        size="md"
        centered
        zIndex={3001}
        role="alertdialog"
        aria-describedby="delete-confirmation-description"
      >
        <Stack gap="md">
          <Text size="sm" id="delete-confirmation-description">
            {t(
              'labResults.emptyLabResultMessage',
              "You created a lab result but didn't add any test components. Would you like to delete this lab result?"
            )}
          </Text>

          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={handleCancelDelete}
              disabled={isDeleting}
            >
              {t('labResults.keepEmptyLabResult', 'Keep Lab Result')}
            </Button>
            <Button
              color="red"
              onClick={handleConfirmDelete}
              loading={isDeleting}
              disabled={isDeleting}
            >
              {t('labResults.deleteEmptyLabResult', 'Delete Lab Result')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

export default LabResultQuickImportModal;
