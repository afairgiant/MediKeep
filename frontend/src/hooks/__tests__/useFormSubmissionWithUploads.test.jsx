import { vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useFormSubmissionWithUploads } from '../useFormSubmissionWithUploads';
import logger from '../../services/logger';

// Mock dependencies
vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

vi.mock('../../services/logger', () => ({
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
}));

// Mock error messages
vi.mock('../../constants/errorMessages', () => ({
  ERROR_MESSAGES: {
    FORM_SUBMISSION_FAILED: 'Form submission failed',
    UPLOAD_FAILED: 'Upload failed',
  },
  SUCCESS_MESSAGES: {
    FORM_SAVED: 'Form saved successfully!',
  },
  WARNING_MESSAGES: {},
  getUserFriendlyError: vi.fn((error, context) => `User friendly: ${error}`),
}));

// Wrapper component for Mantine provider
const wrapper = ({ children }) => (
  <MantineProvider>
    {children}
  </MantineProvider>
);

describe('useFormSubmissionWithUploads Hook', () => {
  const mockOnSuccess = vi.fn();
  const mockOnError = vi.fn();

  const defaultProps = {
    entityType: 'test-entity',
    onSuccess: mockOnSuccess,
    onError: mockOnError,
    component: 'TestComponent',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    jest.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    test('should initialize with default state', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      expect(result.current.submissionState).toEqual({
        isSubmitting: false,
        isUploading: false,
        isCompleted: false,
        hasErrors: false,
        submitSuccess: false,
        uploadSuccess: false,
        canClose: true,
      });

      expect(result.current.isBlocking).toBe(false);
      expect(result.current.canSubmit).toBe(true);
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.isUploading).toBe(false);
      expect(result.current.isCompleted).toBe(false);
      expect(result.current.canClose).toBe(true);
      expect(result.current.statusMessage).toBeNull();
    });
  });

  describe('Form Submission Flow', () => {
    test('should handle complete successful form submission with uploads', async () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      // Start submission
      act(() => {
        result.current.startSubmission();
      });

      expect(result.current.submissionState.isSubmitting).toBe(true);
      expect(result.current.submissionState.canClose).toBe(false);
      expect(result.current.isBlocking).toBe(true);
      expect(result.current.canSubmit).toBe(false);

      // Complete form submission successfully
      act(() => {
        const success = result.current.completeFormSubmission(true, 'entity-123');
      });

      expect(result.current.submissionState.isSubmitting).toBe(false);
      expect(result.current.submissionState.submitSuccess).toBe(true);

      // Start file upload
      act(() => {
        result.current.startFileUpload();
      });

      expect(result.current.submissionState.isUploading).toBe(true);
      expect(result.current.submissionState.canClose).toBe(false);

      // Complete file upload successfully
      act(() => {
        result.current.completeFileUpload(true, 3, 0);
      });

      expect(result.current.submissionState.isUploading).toBe(false);
      expect(result.current.submissionState.uploadSuccess).toBe(true);
      expect(result.current.submissionState.isCompleted).toBe(true);
      expect(result.current.submissionState.canClose).toBe(true);

      // Verify onSuccess callback is triggered
      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });

      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Success!',
          color: 'green',
        })
      );
    });

    test('should handle form submission failure', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.startSubmission();
      });

      act(() => {
        result.current.completeFormSubmission(false);
      });

      expect(result.current.submissionState.submitSuccess).toBe(false);
      expect(result.current.submissionState.hasErrors).toBe(true);
      expect(mockOnError).toHaveBeenCalledWith('Form submission failed');
    });

    test('should handle partial upload success (some files failed)', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      // Complete successful form submission
      act(() => {
        result.current.startSubmission();
        result.current.completeFormSubmission(true, 'entity-123');
        result.current.startFileUpload();
      });

      // Complete upload with some failures
      act(() => {
        result.current.completeFileUpload(false, 2, 1); // 2 successful, 1 failed
      });

      expect(result.current.submissionState.uploadSuccess).toBe(false);
      expect(result.current.submissionState.hasErrors).toBe(true);
      expect(result.current.submissionState.isCompleted).toBe(true);

      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Partially Successful',
          color: 'orange',
        })
      );
    });

    test('should handle complete upload failure', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      // Complete successful form submission but upload fails
      act(() => {
        result.current.startSubmission();
        result.current.completeFormSubmission(true, 'entity-123');
        result.current.startFileUpload();
        result.current.completeFileUpload(false, 0, 3); // All failed
      });

      expect(result.current.submissionState.uploadSuccess).toBe(false);
      expect(result.current.submissionState.hasErrors).toBe(true);

      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Partially Successful',
          color: 'orange',
        })
      );
    });
  });

  describe('Status Messages', () => {
    test('should return correct status message for form submission', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.startSubmission();
      });

      const statusMessage = result.current.statusMessage;
      expect(statusMessage).toEqual({
        title: 'Saving Form...',
        message: 'Please wait while your information is being saved.',
        type: 'loading',
      });
    });

    test('should return correct status message for file upload', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.startSubmission();
        result.current.completeFormSubmission(true);
        result.current.startFileUpload();
      });

      const statusMessage = result.current.statusMessage;
      expect(statusMessage).toEqual({
        title: 'Uploading Files...',
        message: 'Your form has been saved, now uploading files...',
        type: 'loading',
      });
    });

    test('should return correct status message for successful completion', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.startSubmission();
        result.current.completeFormSubmission(true);
        result.current.startFileUpload();
        result.current.completeFileUpload(true, 2, 0);
      });

      const statusMessage = result.current.statusMessage;
      expect(statusMessage).toEqual({
        title: 'Success!',
        message: 'Form and files saved successfully.',
        type: 'success',
      });
    });

    test('should return correct status message for partial success', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.startSubmission();
        result.current.completeFormSubmission(true);
        result.current.startFileUpload();
        result.current.completeFileUpload(false, 1, 1);
      });

      const statusMessage = result.current.statusMessage;
      expect(statusMessage).toEqual({
        title: 'Partially Complete',
        message: 'Form saved, but some files failed to upload.',
        type: 'warning',
      });
    });

    test('should return correct status message for form failure', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.startSubmission();
      });
      
      act(() => {
        result.current.completeFormSubmission(false);
      });
      
      act(() => {
        result.current.completeFileUpload(false, 0, 0);
      });

      const statusMessage = result.current.statusMessage;
      expect(statusMessage).toEqual({
        title: 'Failed',
        message: 'Form submission failed.',
        type: 'error',
      });
    });

    test('should return null status message when not active', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      const statusMessage = result.current.statusMessage;
      expect(statusMessage).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('should handle form submission failure with error details', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      const testError = new Error('Network connection failed');

      act(() => {
        result.current.handleSubmissionFailure(testError, 'form');
      });

      expect(result.current.submissionState.hasErrors).toBe(true);
      expect(result.current.submissionState.isCompleted).toBe(true);
      expect(result.current.submissionState.canClose).toBe(true);

      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Form Submission Failed',
          color: 'red',
        })
      );

      expect(mockOnError).toHaveBeenCalledWith('Connection error. Please check your network and try again.');
    });

    test('should handle upload failure with error details', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      const testError = { message: 'File size too large' };

      act(() => {
        result.current.handleSubmissionFailure(testError, 'upload');
      });

      expect(result.current.submissionState.hasErrors).toBe(true);
      expect(result.current.submissionState.isUploading).toBe(false);

      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'File Upload Failed',
          color: 'red',
        })
      );

      expect(mockOnError).toHaveBeenCalledWith('File size exceeds the maximum limit.');
    });

    test('should handle unknown error gracefully', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.handleSubmissionFailure(null, 'form');
      });

      expect(result.current.submissionState.hasErrors).toBe(true);
      expect(mockOnError).toHaveBeenCalledWith('An unexpected error occurred. Please try again.');
    });
  });

  describe('Reset Functionality', () => {
    test('should reset submission state correctly', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      // Start and complete a submission
      act(() => {
        result.current.startSubmission();
        result.current.completeFormSubmission(true);
        result.current.startFileUpload();
        result.current.completeFileUpload(true, 2, 0);
      });

      expect(result.current.submissionState.isCompleted).toBe(true);

      // Reset
      act(() => {
        result.current.resetSubmission();
      });

      expect(result.current.submissionState).toEqual({
        isSubmitting: false,
        isUploading: false,
        isCompleted: false,
        hasErrors: false,
        submitSuccess: false,
        uploadSuccess: false,
        canClose: true,
      });

      expect(logger.info).toHaveBeenCalledWith('form_submission_reset', expect.any(Object));
    });
  });

  describe('Coordination Between Form and Upload', () => {
    test('should coordinate form submission success with upload start', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.startSubmission();
      });

      expect(result.current.submissionState.isSubmitting).toBe(true);
      expect(result.current.submissionState.isUploading).toBe(false);

      act(() => {
        result.current.completeFormSubmission(true, 'entity-123');
      });

      expect(result.current.submissionState.isSubmitting).toBe(false);
      expect(result.current.submissionState.submitSuccess).toBe(true);

      // Now start upload
      act(() => {
        result.current.startFileUpload();
      });

      expect(result.current.submissionState.isUploading).toBe(true);
      expect(result.current.isBlocking).toBe(true);
    });

    test('should prevent submission when already submitting or uploading', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.startSubmission();
      });

      expect(result.current.canSubmit).toBe(false);

      act(() => {
        result.current.completeFormSubmission(true);
        result.current.startFileUpload();
      });

      expect(result.current.canSubmit).toBe(false);
    });

    test('should handle race condition between form completion and upload start', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.startSubmission();
      });

      // Simulate rapid succession of form completion and upload start
      act(() => {
        result.current.completeFormSubmission(true, 'entity-123');
        result.current.startFileUpload();
        result.current.completeFileUpload(true, 1, 0);
      });

      expect(result.current.submissionState.submitSuccess).toBe(true);
      expect(result.current.submissionState.uploadSuccess).toBe(true);
      expect(result.current.submissionState.isCompleted).toBe(true);
    });
  });

  describe('Callback Integration', () => {
    test('should call onSuccess only when both form and upload succeed', async () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.startSubmission();
        result.current.completeFormSubmission(true, 'entity-123');
        result.current.startFileUpload();
        result.current.completeFileUpload(true, 2, 0);
      });

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      });
    });

    test('should not call onSuccess when form fails', async () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.startSubmission();
        result.current.completeFormSubmission(false);
      });

      // Wait a bit to ensure onSuccess is not called
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    test('should not call onSuccess when upload fails', async () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.startSubmission();
        result.current.completeFormSubmission(true, 'entity-123');
        result.current.startFileUpload();
        result.current.completeFileUpload(false, 0, 3);
      });

      // Wait a bit to ensure onSuccess is not called
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    test('should handle missing onSuccess callback gracefully', async () => {
      const propsWithoutCallback = { ...defaultProps, onSuccess: undefined };
      const { result } = renderHook(() => useFormSubmissionWithUploads(propsWithoutCallback), { wrapper });

      act(() => {
        result.current.startSubmission();
        result.current.completeFormSubmission(true, 'entity-123');
        result.current.startFileUpload();
        result.current.completeFileUpload(true, 2, 0);
      });

      // Should not throw error
      await waitFor(() => {
        expect(result.current.submissionState.isCompleted).toBe(true);
      });
    });

    test('should handle missing onError callback gracefully', () => {
      const propsWithoutCallback = { ...defaultProps, onError: undefined };
      const { result } = renderHook(() => useFormSubmissionWithUploads(propsWithoutCallback), { wrapper });

      act(() => {
        result.current.handleSubmissionFailure(new Error('Test error'), 'form');
      });

      // Should not throw error
      expect(result.current.submissionState.hasErrors).toBe(true);
    });
  });

  describe('Logging', () => {
    test('should log all major state transitions', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.startSubmission();
      });

      expect(logger.info).toHaveBeenCalledWith('form_submission_started', expect.any(Object));

      act(() => {
        result.current.completeFormSubmission(true, 'entity-123');
      });

      expect(logger.info).toHaveBeenCalledWith('form_submission_completed', expect.any(Object));

      act(() => {
        result.current.startFileUpload();
      });

      expect(logger.info).toHaveBeenCalledWith('form_file_upload_started', expect.any(Object));

      act(() => {
        result.current.completeFileUpload(true, 2, 0);
      });

      expect(logger.info).toHaveBeenCalledWith('form_file_upload_completed', expect.any(Object));
    });

    test('should log errors with appropriate context', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      const testError = new Error('Test error message');

      act(() => {
        result.current.handleSubmissionFailure(testError, 'upload');
      });

      expect(logger.error).toHaveBeenCalledWith('form_submission_failure', 
        expect.objectContaining({
          entityType: 'test-entity',
          stage: 'upload',
          error: 'Test error message',
          component: 'TestComponent',
        })
      );
    });
  });

  describe('Notification Handling', () => {
    test('should show appropriate notification for single file success', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.startSubmission();
        result.current.completeFormSubmission(true);
        result.current.startFileUpload();
        result.current.completeFileUpload(true, 1, 0);
      });

      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Success!',
          message: expect.stringContaining('1 file(s) uploaded successfully'),
          color: 'green',
        })
      );
    });

    test('should show appropriate notification for multiple files success', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.startSubmission();
        result.current.completeFormSubmission(true);
        result.current.startFileUpload();
        result.current.completeFileUpload(true, 5, 0);
      });

      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Success!',
          message: expect.stringContaining('5 file(s) uploaded successfully'),
          color: 'green',
        })
      );
    });

    test('should show form only success when no files uploaded', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.startSubmission();
        result.current.completeFormSubmission(true);
        result.current.startFileUpload();
        result.current.completeFileUpload(true, 0, 0);
      });

      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Success!',
          message: 'Form saved successfully!',
          color: 'green',
        })
      );
    });
  });

  describe('Edge Cases', () => {
    test('should handle multiple start submission calls', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.startSubmission();
        result.current.startSubmission(); // Second call
      });

      // Should maintain consistent state
      expect(result.current.submissionState.isSubmitting).toBe(true);
      expect(result.current.submissionState.canClose).toBe(false);
    });

    test('should handle upload start before form completion', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.startSubmission();
        result.current.startFileUpload(); // Start upload before form completion
      });

      expect(result.current.submissionState.isSubmitting).toBe(true);
      expect(result.current.submissionState.isUploading).toBe(true);
    });

    test('should handle completion calls without start', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.completeFormSubmission(true, 'entity-123');
      });

      expect(result.current.submissionState.submitSuccess).toBe(true);
      expect(result.current.submissionState.isSubmitting).toBe(false);
    });

    test('should handle very large numbers of completed/failed files', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      act(() => {
        result.current.startSubmission();
        result.current.completeFormSubmission(true);
        result.current.startFileUpload();
        result.current.completeFileUpload(false, 1000, 500); // Large numbers
      });

      expect(result.current.submissionState.uploadSuccess).toBe(false);
      expect(result.current.submissionState.hasErrors).toBe(true);

      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('1000'),
        })
      );
    });
  });

  describe('State Consistency', () => {
    test('should maintain consistent blocking state throughout workflow', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      // Initial state - not blocking
      expect(result.current.isBlocking).toBe(false);

      // During form submission - blocking
      act(() => {
        result.current.startSubmission();
      });
      expect(result.current.isBlocking).toBe(true);

      // Form completed but upload not started - not blocking (transition state)
      act(() => {
        result.current.completeFormSubmission(true);
      });
      expect(result.current.isBlocking).toBe(false);

      // During upload - blocking
      act(() => {
        result.current.startFileUpload();
      });
      expect(result.current.isBlocking).toBe(true);

      // Upload completed - not blocking
      act(() => {
        result.current.completeFileUpload(true, 1, 0);
      });
      expect(result.current.isBlocking).toBe(false);
    });

    test('should maintain consistent canSubmit state', () => {
      const { result } = renderHook(() => useFormSubmissionWithUploads(defaultProps), { wrapper });

      expect(result.current.canSubmit).toBe(true);

      act(() => {
        result.current.startSubmission();
      });
      expect(result.current.canSubmit).toBe(false);

      act(() => {
        result.current.completeFormSubmission(true);
      });
      expect(result.current.canSubmit).toBe(true);

      act(() => {
        result.current.startFileUpload();
      });
      expect(result.current.canSubmit).toBe(false);

      act(() => {
        result.current.completeFileUpload(true, 1, 0);
      });
      expect(result.current.canSubmit).toBe(true);
    });
  });
});
