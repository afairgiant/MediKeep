import { vi } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useUploadProgress } from '../useUploadProgress';
import { useFormSubmissionWithUploads } from '../useFormSubmissionWithUploads';
import UploadProgressErrorBoundary from '../../components/shared/UploadProgressErrorBoundary';

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

vi.mock('../../constants/errorMessages', () => ({
  ERROR_MESSAGES: {
    FORM_SUBMISSION_FAILED: 'Form submission failed',
    UPLOAD_FAILED: 'Upload failed',
  },
  SUCCESS_MESSAGES: {
    FORM_SAVED: 'Form saved successfully!',
    UPLOAD_SUCCESS: 'Upload successful',
    UPLOAD_MULTIPLE_SUCCESS: 'All files uploaded successfully',
  },
  WARNING_MESSAGES: {},
  getUserFriendlyError: vi.fn((error) => `User friendly: ${error}`),
  formatErrorWithContext: vi.fn((error) => error),
}));

// Wrapper component for Mantine provider
const wrapper = ({ children }) => (
  <MantineProvider>
    {children}
  </MantineProvider>
);

// Integration test component that combines both hooks
const UploadProgressSystem = ({ 
  onSuccess, 
  onError, 
  entityType = 'test-entity',
  simulateErrors = false,
  simulatePartialFailure = false,
  files = []
}) => {
  const formHook = useFormSubmissionWithUploads({
    entityType,
    onSuccess,
    onError,
    component: 'IntegrationTest',
  });

  const uploadHook = useUploadProgress();

  // Simulate form submission and upload coordination
  const handleSubmit = React.useCallback(async () => {
    try {
      // Start form submission
      formHook.startSubmission();

      // Simulate form processing time
      await new Promise(resolve => setTimeout(resolve, 100));

      if (simulateErrors) {
        formHook.handleSubmissionFailure(new Error('Form submission failed'), 'form');
        return;
      }

      // Complete form submission
      const entityId = formHook.completeFormSubmission(true, 'entity-123');

      if (files.length > 0) {
        // Start file upload process
        formHook.startFileUpload();
        uploadHook.startUpload(files);

        // Simulate upload progress
        for (const file of files) {
          for (let progress = 0; progress <= 100; progress += 25) {
            await new Promise(resolve => setTimeout(resolve, 50));
            
            if (simulatePartialFailure && file.id === 'file-2' && progress === 50) {
              uploadHook.updateFileProgress(file.id, progress, 'failed', 'Simulated upload error');
              break;
            } else if (progress === 100) {
              uploadHook.updateFileProgress(file.id, progress, 'completed');
            } else {
              uploadHook.updateFileProgress(file.id, progress, 'uploading');
            }
          }
        }

        // Complete upload process
        const completedCount = uploadHook.completedCount;
        const failedCount = uploadHook.failedCount;
        const uploadSuccess = failedCount === 0;

        uploadHook.completeUpload(uploadSuccess);
        formHook.completeFileUpload(uploadSuccess, completedCount, failedCount);
      } else {
        // No files to upload, complete immediately
        formHook.completeFileUpload(true, 0, 0);
      }
    } catch (error) {
      formHook.handleSubmissionFailure(error, 'form');
    }
  }, [formHook, uploadHook, simulateErrors, simulatePartialFailure, files]);

  return (
    <div data-testid="upload-progress-system">
      <div data-testid="form-state">
        {JSON.stringify({
          isSubmitting: formHook.isSubmitting,
          isUploading: formHook.isUploading,
          isCompleted: formHook.isCompleted,
          canClose: formHook.canClose,
        })}
      </div>
      <div data-testid="upload-state">
        {JSON.stringify({
          isUploading: uploadHook.uploadState.isUploading,
          overallProgress: uploadHook.uploadState.overallProgress,
          isCompleted: uploadHook.uploadState.isCompleted,
          hasErrors: uploadHook.uploadState.hasErrors,
        })}
      </div>
      <div data-testid="status-message">
        {formHook.statusMessage ? JSON.stringify(formHook.statusMessage) : 'null'}
      </div>
      <button onClick={handleSubmit} data-testid="submit-button">
        Submit
      </button>
    </div>
  );
};

describe('Upload Progress System Integration Tests', () => {
  const mockOnSuccess = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    jest.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Complete Successful Workflow', () => {
    test('should handle form submission without files successfully', async () => {
      render(
        <MantineProvider>
          <UploadProgressSystem 
            onSuccess={mockOnSuccess}
            onError={mockOnError}
          />
        </MantineProvider>
      );

      const button = screen.getByTestId('submit-button');
      fireEvent.click(button);

      // Fast-forward through form submission
      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        const formState = JSON.parse(screen.getByTestId('form-state').textContent);
        expect(formState.isCompleted).toBe(true);
        expect(formState.canClose).toBe(true);
      });

      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Success!',
          color: 'green',
        })
      );
    });

    test('should handle form submission with single file upload successfully', async () => {
      const testFiles = [
        { id: 'file-1', name: 'test.pdf', size: 1000, description: 'Test file' }
      ];

      render(
        <MantineProvider>
          <UploadProgressSystem 
            onSuccess={mockOnSuccess}
            onError={mockOnError}
            files={testFiles}
          />
        </MantineProvider>
      );

      fireEvent.click(screen.getByTestId('submit-button'));

      // Fast-forward through entire process
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        const formState = JSON.parse(screen.getByTestId('form-state').textContent);
        const uploadState = JSON.parse(screen.getByTestId('upload-state').textContent);
        
        expect(formState.isCompleted).toBe(true);
        expect(uploadState.isCompleted).toBe(true);
        expect(uploadState.hasErrors).toBe(false);
      });

      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });

    test('should handle form submission with multiple files successfully', async () => {
      const testFiles = [
        { id: 'file-1', name: 'test1.pdf', size: 1000, description: 'Test file 1' },
        { id: 'file-2', name: 'test2.pdf', size: 2000, description: 'Test file 2' },
        { id: 'file-3', name: 'test3.pdf', size: 1500, description: 'Test file 3' },
      ];

      render(
        <MantineProvider>
          <UploadProgressSystem 
            onSuccess={mockOnSuccess}
            onError={mockOnError}
            files={testFiles}
          />
        </MantineProvider>
      );

      fireEvent.click(screen.getByTestId('submit-button'));

      // Monitor progress during upload
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Check intermediate state
      await waitFor(() => {
        const uploadState = JSON.parse(screen.getByTestId('upload-state').textContent);
        expect(uploadState.isUploading).toBe(true);
        expect(uploadState.overallProgress).toBeGreaterThan(0);
      });

      // Complete the process
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      await waitFor(() => {
        const formState = JSON.parse(screen.getByTestId('form-state').textContent);
        const uploadState = JSON.parse(screen.getByTestId('upload-state').textContent);
        
        expect(formState.isCompleted).toBe(true);
        expect(uploadState.isCompleted).toBe(true);
        expect(uploadState.overallProgress).toBe(100);
      });

      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Scenarios', () => {
    test('should handle form submission failure', async () => {
      render(
        <MantineProvider>
          <UploadProgressSystem 
            onSuccess={mockOnSuccess}
            onError={mockOnError}
            simulateErrors={true}
          />
        </MantineProvider>
      );

      fireEvent.click(screen.getByTestId('submit-button'));

      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        const formState = JSON.parse(screen.getByTestId('form-state').textContent);
        expect(formState.isCompleted).toBe(true);
        expect(formState.isSubmitting).toBe(false);
      });

      expect(mockOnError).toHaveBeenCalledWith('User friendly: Form submission failed');
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    test('should handle partial upload failure', async () => {
      const testFiles = [
        { id: 'file-1', name: 'test1.pdf', size: 1000, description: 'Test file 1' },
        { id: 'file-2', name: 'test2.pdf', size: 2000, description: 'Test file 2' },
      ];

      render(
        <MantineProvider>
          <UploadProgressSystem 
            onSuccess={mockOnSuccess}
            onError={mockOnError}
            files={testFiles}
            simulatePartialFailure={true}
          />
        </MantineProvider>
      );

      fireEvent.click(screen.getByTestId('submit-button'));

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        const formState = JSON.parse(screen.getByTestId('form-state').textContent);
        const uploadState = JSON.parse(screen.getByTestId('upload-state').textContent);
        
        expect(formState.isCompleted).toBe(true);
        expect(uploadState.hasErrors).toBe(true);
      });

      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Partially Successful',
          color: 'orange',
        })
      );
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });

  describe('State Coordination', () => {
    test('should properly coordinate state transitions between form and upload', async () => {
      const testFiles = [
        { id: 'file-1', name: 'test.pdf', size: 1000, description: 'Test file' }
      ];

      render(
        <MantineProvider>
          <UploadProgressSystem 
            onSuccess={mockOnSuccess}
            onError={mockOnError}
            files={testFiles}
          />
        </MantineProvider>
      );

      fireEvent.click(screen.getByTestId('submit-button'));

      // Check initial form submission state
      act(() => {
        jest.advanceTimersByTime(50);
      });

      await waitFor(() => {
        const formState = JSON.parse(screen.getByTestId('form-state').textContent);
        expect(formState.isSubmitting).toBe(true);
        expect(formState.isUploading).toBe(false);
      });

      // Check transition to upload state
      act(() => {
        jest.advanceTimersByTime(100);
      });

      await waitFor(() => {
        const formState = JSON.parse(screen.getByTestId('form-state').textContent);
        const uploadState = JSON.parse(screen.getByTestId('upload-state').textContent);
        
        expect(formState.isSubmitting).toBe(false);
        expect(formState.isUploading).toBe(true);
        expect(uploadState.isUploading).toBe(true);
      });

      // Check final completion state
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        const formState = JSON.parse(screen.getByTestId('form-state').textContent);
        const uploadState = JSON.parse(screen.getByTestId('upload-state').textContent);
        
        expect(formState.isUploading).toBe(false);
        expect(formState.isCompleted).toBe(true);
        expect(uploadState.isCompleted).toBe(true);
      });
    });

    test('should show appropriate status messages during workflow', async () => {
      const testFiles = [
        { id: 'file-1', name: 'test.pdf', size: 1000, description: 'Test file' }
      ];

      render(
        <MantineProvider>
          <UploadProgressSystem 
            onSuccess={mockOnSuccess}
            onError={mockOnError}
            files={testFiles}
          />
        </MantineProvider>
      );

      fireEvent.click(screen.getByTestId('submit-button'));

      // Check form submission status
      act(() => {
        jest.advanceTimersByTime(50);
      });

      await waitFor(() => {
        const statusMessage = JSON.parse(screen.getByTestId('status-message').textContent);
        expect(statusMessage.title).toBe('Saving Form...');
        expect(statusMessage.type).toBe('loading');
      });

      // Check upload status
      act(() => {
        jest.advanceTimersByTime(150);
      });

      await waitFor(() => {
        const statusMessage = JSON.parse(screen.getByTestId('status-message').textContent);
        expect(statusMessage.title).toBe('Uploading Files...');
        expect(statusMessage.type).toBe('loading');
      });

      // Check completion status
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        const statusMessage = JSON.parse(screen.getByTestId('status-message').textContent);
        expect(statusMessage.title).toBe('Success!');
        expect(statusMessage.type).toBe('success');
      });
    });
  });

  describe('Error Boundary Integration', () => {
    test('should handle errors in upload progress with error boundary', () => {
      const ErrorProneUploadSystem = () => {
        // Simulate an error in the upload progress component
        throw new Error('Upload progress component crashed');
      };

      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <ErrorProneUploadSystem />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(screen.getByText('Upload Progress Error')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong with progress tracking. Your upload may still be processing.')).toBeInTheDocument();
    });

    test('should allow recovery from upload progress errors', () => {
      let hasError = true;
      
      const RecoverableUploadSystem = () => {
        if (hasError) {
          throw new Error('Recoverable error');
        }
        return <div data-testid="recovered-system">System recovered</div>;
      };

      const { rerender } = render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <RecoverableUploadSystem />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(screen.getByText('Upload Progress Error')).toBeInTheDocument();

      // Click Continue to attempt recovery
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

      // Simulate error being fixed
      hasError = false;
      
      rerender(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <RecoverableUploadSystem />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(screen.getByTestId('recovered-system')).toBeInTheDocument();
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle multiple simultaneous hook operations', async () => {
      const { result: formResult } = renderHook(() => 
        useFormSubmissionWithUploads({
          entityType: 'test-entity',
          onSuccess: mockOnSuccess,
          onError: mockOnError,
        }), { wrapper }
      );

      const { result: uploadResult } = renderHook(() => useUploadProgress(), { wrapper });

      const testFiles = [
        { id: 'file-1', name: 'test1.pdf', size: 1000 },
        { id: 'file-2', name: 'test2.pdf', size: 2000 },
      ];

      // Start both operations simultaneously
      act(() => {
        formResult.current.startSubmission();
        uploadResult.current.startUpload(testFiles);
      });

      expect(formResult.current.isSubmitting).toBe(true);
      expect(uploadResult.current.uploadState.isUploading).toBe(true);

      // Update file progress while form is still submitting
      act(() => {
        uploadResult.current.updateFileProgress('file-1', 50, 'uploading');
        uploadResult.current.updateFileProgress('file-2', 25, 'uploading');
      });

      expect(uploadResult.current.uploadState.overallProgress).toBe(37.5);

      // Complete form submission
      act(() => {
        formResult.current.completeFormSubmission(true, 'entity-123');
        formResult.current.startFileUpload();
      });

      expect(formResult.current.isSubmitting).toBe(false);
      expect(formResult.current.isUploading).toBe(true);

      // Complete uploads
      act(() => {
        uploadResult.current.updateFileProgress('file-1', 100, 'completed');
        uploadResult.current.updateFileProgress('file-2', 100, 'completed');
        uploadResult.current.completeUpload(true);
        formResult.current.completeFileUpload(true, 2, 0);
      });

      await waitFor(() => {
        expect(formResult.current.isCompleted).toBe(true);
        expect(uploadResult.current.uploadState.isCompleted).toBe(true);
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Memory Management', () => {
    test('should clean up resources when components unmount during upload', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      const { result, unmount } = renderHook(() => useUploadProgress(), { wrapper });

      const testFiles = [{ id: 'file-1', name: 'test.pdf', size: 1000 }];

      act(() => {
        result.current.startUpload(testFiles);
      });

      // Unmount during active upload
      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    test('should handle reset operations during active uploads', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });

      const testFiles = [
        { id: 'file-1', name: 'test1.pdf', size: 1000 },
        { id: 'file-2', name: 'test2.pdf', size: 2000 },
      ];

      act(() => {
        result.current.startUpload(testFiles);
        result.current.updateFileProgress('file-1', 50, 'uploading');
      });

      expect(result.current.uploadState.files).toHaveLength(2);

      act(() => {
        result.current.resetUpload();
      });

      expect(result.current.uploadState.files).toHaveLength(0);
      expect(result.current.uploadState.isUploading).toBe(false);
      expect(result.current.uploadState.overallProgress).toBe(0);
    });
  });

  describe('Performance Under Load', () => {
    test('should handle large numbers of files efficiently', async () => {
      const largeFileSet = Array.from({ length: 50 }, (_, i) => ({
        id: `file-${i}`,
        name: `test${i}.pdf`,
        size: 1000 + i * 100,
        description: `Test file ${i}`,
      }));

      const { result } = renderHook(() => useUploadProgress(), { wrapper });

      const startTime = performance.now();

      act(() => {
        result.current.startUpload(largeFileSet);
      });

      // Update all files rapidly
      act(() => {
        largeFileSet.forEach((file, index) => {
          result.current.updateFileProgress(file.id, (index + 1) * 2, 'uploading');
        });
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.current.uploadState.files).toHaveLength(50);
      expect(duration).toBeLessThan(1000); // Should handle large sets efficiently
    });

    test('should maintain performance during rapid state updates', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });

      const testFiles = [{ id: 'file-1', name: 'test.pdf', size: 1000 }];

      act(() => {
        result.current.startUpload(testFiles);
      });

      const startTime = performance.now();

      // Perform many rapid updates
      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.updateFileProgress('file-1', i, 'uploading');
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(200); // Should handle rapid updates efficiently
      expect(result.current.uploadState.files[0].progress).toBe(99); // Last update should be preserved
    });
  });
});
