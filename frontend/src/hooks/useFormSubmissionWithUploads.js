import { useState, useCallback, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconExclamationMark } from '@tabler/icons-react';
import logger from '../services/logger';
import { 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES, 
  WARNING_MESSAGES, 
  getUserFriendlyError
} from '../constants/errorMessages';

/**
 * Hook for handling form submissions that include file uploads
 * Manages the complete flow from form submission to file upload completion
 */
export const useFormSubmissionWithUploads = ({
  entityType,
  onSuccess,
  onError,
  component = 'FormWithUploads',
}) => {
  const [submissionState, setSubmissionState] = useState({
    isSubmitting: false,
    isUploading: false,
    isCompleted: false,
    hasErrors: false,
    submitSuccess: false,
    uploadSuccess: false,
    canClose: true,
  });
  
  const [overallSuccess, setOverallSuccess] = useState(false);

  // Handle success callback when submission is complete and successful
  useEffect(() => {
    if (submissionState.isCompleted && submissionState.canClose && overallSuccess && onSuccess) {
      onSuccess();
    }
  }, [submissionState.isCompleted, submissionState.canClose, overallSuccess, onSuccess]);

  // Start form submission process
  const startSubmission = useCallback(() => {
    setSubmissionState({
      isSubmitting: true,
      isUploading: false,
      isCompleted: false,
      hasErrors: false,
      submitSuccess: false,
      uploadSuccess: false,
      canClose: false,
    });
    
    setOverallSuccess(false);

    logger.info('form_submission_started', {
      message: 'Form submission with uploads started',
      entityType,
      component,
    });
  }, [entityType, component]);

  // Mark form submission as completed (entity created/updated)
  const completeFormSubmission = useCallback((success, entityId = null) => {
    setSubmissionState(prev => ({
      ...prev,
      isSubmitting: false,
      submitSuccess: success,
      hasErrors: prev.hasErrors || !success,
    }));

    logger.info('form_submission_completed', {
      message: 'Form submission completed',
      entityType,
      entityId,
      success,
      component,
    });

    if (!success && onError) {
      onError(ERROR_MESSAGES.FORM_SUBMISSION_FAILED);
    }

    return success;
  }, [entityType, component, onError]);

  // Start file upload process
  const startFileUpload = useCallback(() => {
    setSubmissionState(prev => ({
      ...prev,
      isUploading: true,
      canClose: false,
    }));

    logger.info('form_file_upload_started', {
      message: 'File upload process started',
      entityType,
      component,
    });
  }, [entityType, component]);

  // Complete file upload process
  const completeFileUpload = useCallback((success, completedCount = 0, failedCount = 0) => {
    const hasUploadErrors = failedCount > 0 || !success;
    
    setSubmissionState(prev => {
      const updatedState = {
        ...prev,
        isUploading: false,
        uploadSuccess: success,
        hasErrors: prev.hasErrors || hasUploadErrors,
        isCompleted: true,
        canClose: true,
      };

      // Calculate overall success using current state
      const currentOverallSuccess = prev.submitSuccess && success;
      setOverallSuccess(currentOverallSuccess);

      // Show appropriate notifications based on overall success
      if (currentOverallSuccess && failedCount === 0) {
        notifications.show({
          title: 'Success!',
          message: completedCount > 0 
            ? `${SUCCESS_MESSAGES.FORM_SAVED.replace('successfully!', 'and')} ${completedCount} file(s) uploaded successfully!`
            : SUCCESS_MESSAGES.FORM_SAVED,
          color: 'green',
          icon: <IconCheck size={16} />,
          autoClose: 5000,
        });
      } else if (prev.submitSuccess && failedCount > 0) {
        notifications.show({
          title: 'Partially Successful',
          message: `Form saved successfully, but ${failedCount} file(s) failed to upload. ${completedCount} file(s) uploaded successfully.`,
          color: 'orange',
          icon: <IconExclamationMark size={16} />,
          autoClose: 7000,
        });
      } else if (!prev.submitSuccess) {
        notifications.show({
          title: 'Submission Failed',
          message: ERROR_MESSAGES.FORM_SUBMISSION_FAILED,
          color: 'red',
          icon: <IconX size={16} />,
          autoClose: 7000,
        });
      }

      return updatedState;
    });

    logger.info('form_file_upload_completed', {
      message: 'File upload process completed',
      entityType,
      success,
      completedCount,
      failedCount,
      component,
    });

    return true;
  }, [entityType, component]);

  // Handle submission failure
  const handleSubmissionFailure = useCallback((error, stage = 'form') => {
    setSubmissionState(prev => ({
      ...prev,
      isSubmitting: stage === 'form' ? false : prev.isSubmitting,
      isUploading: stage === 'upload' ? false : prev.isUploading,
      hasErrors: true,
      isCompleted: true,
      canClose: true,
    }));

    const errorMessage = getUserFriendlyError(error, stage === 'form' ? 'save' : 'upload');
    
    logger.error('form_submission_failure', {
      message: 'Form submission failed',
      entityType,
      stage,
      error: error?.message || error || 'Unknown error',
      userFriendlyError: errorMessage,
      component,
    });

    notifications.show({
      title: stage === 'form' ? 'Form Submission Failed' : 'File Upload Failed',
      message: errorMessage,
      color: 'red',
      icon: <IconX size={16} />,
      autoClose: 7000,
    });

    if (onError) {
      onError(errorMessage);
    }
  }, [entityType, component, onError]);

  // Reset submission state
  const resetSubmission = useCallback(() => {
    setSubmissionState({
      isSubmitting: false,
      isUploading: false,
      isCompleted: false,
      hasErrors: false,
      submitSuccess: false,
      uploadSuccess: false,
      canClose: true,
    });
    
    setOverallSuccess(false);

    logger.info('form_submission_reset', {
      message: 'Form submission state reset',
      entityType,
      component,
    });
  }, [entityType, component]);

  // Get current status message for UI
  const getStatusMessage = useCallback(() => {
    if (submissionState.isSubmitting && !submissionState.isUploading) {
      return {
        title: 'Saving Form...',
        message: 'Please wait while your information is being saved.',
        type: 'loading',
      };
    }
    
    if (submissionState.isUploading) {
      return {
        title: 'Uploading Files...',
        message: 'Your form has been saved, now uploading files...',
        type: 'loading',
      };
    }
    
    if (submissionState.isCompleted) {
      if (submissionState.submitSuccess && submissionState.uploadSuccess) {
        return {
          title: 'Success!',
          message: 'Form and files saved successfully.',
          type: 'success',
        };
      } else if (submissionState.submitSuccess && !submissionState.uploadSuccess) {
        return {
          title: 'Partially Complete',
          message: 'Form saved, but some files failed to upload.',
          type: 'warning',
        };
      } else {
        return {
          title: 'Failed',
          message: 'Form submission failed.',
          type: 'error',
        };
      }
    }
    
    return null;
  }, [submissionState]);

  return {
    // State
    submissionState,
    
    // Actions
    startSubmission,
    completeFormSubmission,
    startFileUpload,
    completeFileUpload,
    handleSubmissionFailure,
    resetSubmission,
    
    // Derived state
    isBlocking: submissionState.isSubmitting || submissionState.isUploading,
    canSubmit: !submissionState.isSubmitting && !submissionState.isUploading,
    statusMessage: getStatusMessage(),
    
    // State booleans for convenience
    isSubmitting: submissionState.isSubmitting,
    isUploading: submissionState.isUploading,
    isCompleted: submissionState.isCompleted,
    canClose: submissionState.canClose,
  };
};

export default useFormSubmissionWithUploads;