import { renderHook, act, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useUploadProgress } from '../useUploadProgress';
import logger from '../../services/logger';

// Mock dependencies
jest.mock('@mantine/notifications', () => ({
  notifications: {
    show: jest.fn(),
  },
}));

jest.mock('../../services/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
}));

// Mock error messages
jest.mock('../../constants/errorMessages', () => ({
  ERROR_MESSAGES: {
    UPLOAD_FAILED: 'Upload failed',
  },
  SUCCESS_MESSAGES: {
    UPLOAD_SUCCESS: 'Upload successful',
    UPLOAD_MULTIPLE_SUCCESS: 'All files uploaded successfully',
  },
  WARNING_MESSAGES: {},
  getUserFriendlyError: jest.fn((error) => error),
  formatErrorWithContext: jest.fn((error) => error),
}));

// Wrapper component for Mantine provider
const wrapper = ({ children }) => (
  <MantineProvider>
    {children}
  </MantineProvider>
);

describe('useUploadProgress Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Initial State', () => {
    test('should initialize with default state', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });

      expect(result.current.uploadState).toEqual({
        isUploading: false,
        files: [],
        overallProgress: 0,
        isCompleted: false,
        hasErrors: false,
        canClose: false,
        startTime: null,
        endTime: null,
      });

      expect(result.current.isModalOpen).toBe(false);
      expect(result.current.canRetry).toBe(false);
      expect(result.current.completedCount).toBe(0);
      expect(result.current.failedCount).toBe(0);
      expect(result.current.uploadingCount).toBe(0);
    });

    test('should initialize derived state values', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });

      expect(result.current.estimatedTimeRemaining).toBeNull();
      expect(result.current.uploadSpeed).toBeNull();
      expect(result.current.completedBytes).toBe(0);
      expect(result.current.totalBytes).toBe(0);
    });
  });

  describe('startUpload', () => {
    test('should initialize upload with files', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [
        { id: 'file-1', name: 'test1.pdf', size: 1000, description: 'Test file 1' },
        { id: 'file-2', name: 'test2.pdf', size: 2000, description: 'Test file 2' },
      ];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      expect(result.current.uploadState.isUploading).toBe(true);
      expect(result.current.uploadState.files).toHaveLength(2);
      expect(result.current.uploadState.files[0]).toMatchObject({
        id: 'file-1',
        name: 'test1.pdf',
        size: 1000,
        description: 'Test file 1',
        status: 'pending',
        progress: 0,
        error: null,
      });
      expect(result.current.uploadState.startTime).toBeGreaterThan(0);
      expect(logger.info).toHaveBeenCalledWith('upload_progress_started', expect.any(Object));
    });

    test('should generate file IDs when not provided', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [
        { name: 'test1.pdf', size: 1000 },
        { name: 'test2.pdf', size: 2000 },
      ];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      expect(result.current.uploadState.files[0].id).toMatch(/^file-0-\d+$/);
      expect(result.current.uploadState.files[1].id).toMatch(/^file-1-\d+$/);
    });

    test('should handle empty files array', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });

      act(() => {
        result.current.startUpload([]);
      });

      expect(result.current.uploadState.isUploading).toBe(true);
      expect(result.current.uploadState.files).toHaveLength(0);
      expect(result.current.uploadState.overallProgress).toBe(0);
    });
  });

  describe('updateFileProgress - Race Condition Testing', () => {
    test('should handle rapid progress updates without data corruption', async () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [
        { id: 'file-1', name: 'test1.pdf', size: 1000 },
      ];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      // Simulate rapid progress updates (race condition scenario)
      const progressUpdates = [10, 25, 30, 50, 75, 90, 100];
      
      act(() => {
        progressUpdates.forEach((progress, index) => {
          // Simulate multiple concurrent updates
          setTimeout(() => {
            result.current.updateFileProgress('file-1', progress, 'uploading');
          }, index * 10);
        });
      });

      // Fast-forward timers to execute all updates
      act(() => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        const file = result.current.uploadState.files[0];
        expect(file.progress).toBe(100);
        expect(file.status).toBe('uploading');
        expect(file.lastUpdate).toBeDefined();
      });
    });

    test('should prevent progress from exceeding bounds (0-100)', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [{ id: 'file-1', name: 'test1.pdf', size: 1000 }];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      // Test progress bounds
      act(() => {
        result.current.updateFileProgress('file-1', -10, 'uploading');
      });

      expect(result.current.uploadState.files[0].progress).toBe(0);

      act(() => {
        result.current.updateFileProgress('file-1', 150, 'uploading');
      });

      expect(result.current.uploadState.files[0].progress).toBe(100);
    });

    test('should handle invalid progress values gracefully', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [{ id: 'file-1', name: 'test1.pdf', size: 1000 }];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      // Test various invalid inputs
      const invalidInputs = [null, undefined, NaN, 'invalid', {}, []];

      invalidInputs.forEach((invalidInput, index) => {
        act(() => {
          result.current.updateFileProgress('file-1', invalidInput, 'uploading');
        });

        expect(result.current.uploadState.files[0].progress).toBe(0);
      });
    });

    test('should correctly update overall progress with multiple files', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [
        { id: 'file-1', name: 'test1.pdf', size: 1000 },
        { id: 'file-2', name: 'test2.pdf', size: 2000 },
        { id: 'file-3', name: 'test3.pdf', size: 1500 },
      ];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      // Update progress for each file
      act(() => {
        result.current.updateFileProgress('file-1', 50, 'uploading');
        result.current.updateFileProgress('file-2', 75, 'uploading');
        result.current.updateFileProgress('file-3', 25, 'uploading');
      });

      // Overall progress should be (50 + 75 + 25) / 3 = 50
      expect(result.current.uploadState.overallProgress).toBe(50);
    });

    test('should set timestamps correctly for file status changes', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [{ id: 'file-1', name: 'test1.pdf', size: 1000 }];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      const beforeUploadTime = Date.now();

      act(() => {
        result.current.updateFileProgress('file-1', 50, 'uploading');
      });

      const file = result.current.uploadState.files[0];
      expect(file.startTime).toBeGreaterThanOrEqual(beforeUploadTime);
      expect(file.endTime).toBeNull();

      act(() => {
        result.current.updateFileProgress('file-1', 100, 'completed');
      });

      const completedFile = result.current.uploadState.files[0];
      expect(completedFile.endTime).toBeGreaterThanOrEqual(completedFile.startTime);
    });
  });

  describe('updateMultipleFiles - Batch Operations', () => {
    test('should handle batch updates correctly', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [
        { id: 'file-1', name: 'test1.pdf', size: 1000 },
        { id: 'file-2', name: 'test2.pdf', size: 2000 },
      ];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      const updates = [
        { fileId: 'file-1', progress: 50, status: 'uploading' },
        { fileId: 'file-2', progress: 75, status: 'uploading' },
      ];

      act(() => {
        result.current.updateMultipleFiles(updates);
      });

      expect(result.current.uploadState.files[0].progress).toBe(50);
      expect(result.current.uploadState.files[1].progress).toBe(75);
      expect(result.current.uploadState.overallProgress).toBe(62.5); // (50 + 75) / 2
    });

    test('should handle empty updates array', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [{ id: 'file-1', name: 'test1.pdf', size: 1000 }];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      act(() => {
        result.current.updateMultipleFiles([]);
      });

      expect(result.current.uploadState.files[0].progress).toBe(0);
      expect(result.current.uploadState.overallProgress).toBe(0);
    });

    test('should ignore updates for non-existent files', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [{ id: 'file-1', name: 'test1.pdf', size: 1000 }];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      const updates = [
        { fileId: 'file-1', progress: 50, status: 'uploading' },
        { fileId: 'non-existent', progress: 100, status: 'completed' },
      ];

      act(() => {
        result.current.updateMultipleFiles(updates);
      });

      expect(result.current.uploadState.files).toHaveLength(1);
      expect(result.current.uploadState.files[0].progress).toBe(50);
    });
  });

  describe('Memory Leak Prevention', () => {
    test('should properly unmount without memory leaks', () => {
      const { result, unmount } = renderHook(() => useUploadProgress(), { wrapper });

      // Start upload and perform operations
      act(() => {
        result.current.startUpload([{ id: 'file-1', name: 'test.pdf', size: 1000 }]);
        result.current.updateFileProgress('file-1', 50, 'uploading');
      });

      // Unmount should not throw errors
      expect(() => unmount()).not.toThrow();
    });

    test('should clean up state on resetUpload', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });

      act(() => {
        result.current.startUpload([{ id: 'file-1', name: 'test.pdf', size: 1000 }]);
      });

      act(() => {
        result.current.resetUpload();
      });

      expect(result.current.uploadState.isUploading).toBe(false);
      expect(result.current.uploadState.files).toHaveLength(0);
      expect(result.current.uploadState.overallProgress).toBe(0);
    });

    test('should handle multiple reset calls without errors', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });

      act(() => {
        result.current.startUpload([{ id: 'file-1', name: 'test.pdf', size: 1000 }]);
      });

      // Multiple reset calls should not cause errors
      act(() => {
        result.current.resetUpload();
        result.current.resetUpload();
        result.current.resetUpload();
      });

      expect(result.current.uploadState.isUploading).toBe(false);
    });
  });

  describe('completeUpload', () => {
    test('should complete upload successfully with notifications', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [
        { id: 'file-1', name: 'test1.pdf', size: 1000 },
        { id: 'file-2', name: 'test2.pdf', size: 2000 },
      ];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      // Mark files as completed
      act(() => {
        result.current.updateFileProgress('file-1', 100, 'completed');
        result.current.updateFileProgress('file-2', 100, 'completed');
      });

      act(() => {
        result.current.completeUpload(true, 'Custom success message');
      });

      expect(result.current.uploadState.isCompleted).toBe(true);
      expect(result.current.uploadState.canClose).toBe(true);
      expect(result.current.uploadState.endTime).toBeGreaterThan(0);
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Upload Successful',
          message: 'Custom success message',
          color: 'green',
        })
      );
    });

    test('should handle partial upload success with appropriate notifications', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [
        { id: 'file-1', name: 'test1.pdf', size: 1000 },
        { id: 'file-2', name: 'test2.pdf', size: 2000 },
      ];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      // Mark one file as completed, one as failed
      act(() => {
        result.current.updateFileProgress('file-1', 100, 'completed');
        result.current.updateFileProgress('file-2', 50, 'failed');
      });

      act(() => {
        result.current.completeUpload(false);
      });

      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Upload Completed with Errors',
          color: 'orange',
        })
      );
    });

    test('should handle complete upload failure', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [{ id: 'file-1', name: 'test1.pdf', size: 1000 }];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      act(() => {
        result.current.updateFileProgress('file-1', 0, 'failed');
      });

      act(() => {
        result.current.completeUpload(false);
      });

      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Upload Completed with Errors',
          color: 'orange',
        })
      );
    });
  });

  describe('Derived State Calculations', () => {
    test('should calculate time remaining correctly', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [{ id: 'file-1', name: 'test.pdf', size: 10000 }];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      // Simulate time passing and progress
      act(() => {
        jest.advanceTimersByTime(1000); // 1 second
        result.current.updateFileProgress('file-1', 10, 'uploading'); // 10% in 1 second
      });

      const derivedState = result.current;
      // With 10% in 1 second, estimated time for remaining 90% should be ~9 seconds
      expect(derivedState.estimatedTimeRemaining).toBeTruthy();
    });

    test('should calculate upload speed correctly', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [{ id: 'file-1', name: 'test.pdf', size: 1000000 }]; // 1MB

      act(() => {
        result.current.startUpload(mockFiles);
      });

      // Simulate 50% progress (500KB) in 1 second
      act(() => {
        jest.advanceTimersByTime(1000);
        result.current.updateFileProgress('file-1', 50, 'uploading');
      });

      expect(result.current.uploadSpeed).toBeTruthy();
      expect(result.current.completedBytes).toBe(500000); // 50% of 1MB
    });

    test('should handle zero progress gracefully in calculations', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [{ id: 'file-1', name: 'test.pdf', size: 1000 }];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      expect(result.current.estimatedTimeRemaining).toBeNull();
      expect(result.current.uploadSpeed).toBeNull();
      expect(result.current.completedBytes).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle file errors correctly', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [{ id: 'file-1', name: 'test.pdf', size: 1000 }];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      const error = 'Upload failed due to network error';

      act(() => {
        result.current.updateFileProgress('file-1', 50, 'failed', error);
      });

      expect(result.current.uploadState.files[0].status).toBe('failed');
      expect(result.current.uploadState.files[0].error).toBe(error);
      expect(result.current.uploadState.hasErrors).toBe(true);
    });

    test('should track error state correctly across multiple files', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [
        { id: 'file-1', name: 'test1.pdf', size: 1000 },
        { id: 'file-2', name: 'test2.pdf', size: 2000 },
      ];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      act(() => {
        result.current.updateFileProgress('file-1', 100, 'completed');
        result.current.updateFileProgress('file-2', 25, 'failed', 'Network error');
      });

      expect(result.current.uploadState.hasErrors).toBe(true);
      expect(result.current.completedCount).toBe(1);
      expect(result.current.failedCount).toBe(1);
    });
  });

  describe('Logging', () => {
    test('should log state changes appropriately', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [{ id: 'file-1', name: 'test.pdf', size: 1000 }];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      expect(logger.info).toHaveBeenCalledWith('upload_progress_started', expect.any(Object));

      act(() => {
        result.current.updateFileProgress('file-1', 100, 'completed');
      });

      expect(logger.info).toHaveBeenCalledWith('upload_progress_state_change', expect.any(Object));

      act(() => {
        result.current.completeUpload(true);
      });

      expect(logger.info).toHaveBeenCalledWith('upload_progress_completed', expect.any(Object));
    });

    test('should throttle debug logging for frequent updates', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [{ id: 'file-1', name: 'test.pdf', size: 1000 }];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      // Rapid progress updates should be throttled
      act(() => {
        for (let i = 1; i <= 10; i++) {
          result.current.updateFileProgress('file-1', i * 10, 'uploading');
          jest.advanceTimersByTime(100); // 100ms between updates
        }
      });

      // Should not log debug for every update due to throttling
      const debugCalls = logger.debug.mock.calls.filter(
        call => call[0] === 'upload_progress_update'
      );
      expect(debugCalls.length).toBeLessThan(10);
    });
  });

  describe('Edge Cases', () => {
    test('should handle concurrent startUpload calls', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles1 = [{ id: 'file-1', name: 'test1.pdf', size: 1000 }];
      const mockFiles2 = [{ id: 'file-2', name: 'test2.pdf', size: 2000 }];

      act(() => {
        result.current.startUpload(mockFiles1);
        result.current.startUpload(mockFiles2); // Second call should override
      });

      expect(result.current.uploadState.files).toHaveLength(1);
      expect(result.current.uploadState.files[0].id).toBe('file-2');
    });

    test('should handle forceClose correctly', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [{ id: 'file-1', name: 'test.pdf', size: 1000 }];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      expect(result.current.uploadState.canClose).toBe(false);

      act(() => {
        result.current.forceClose();
      });

      expect(result.current.uploadState.canClose).toBe(true);
    });

    test('should handle update progress for non-existent files gracefully', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [{ id: 'file-1', name: 'test.pdf', size: 1000 }];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      // Try to update non-existent file
      act(() => {
        result.current.updateFileProgress('non-existent', 50, 'uploading');
      });

      // Should not throw error and state should remain consistent
      expect(result.current.uploadState.files).toHaveLength(1);
      expect(result.current.uploadState.files[0].progress).toBe(0);
    });

    test('should handle files without size property', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [
        { id: 'file-1', name: 'test1.pdf' }, // No size
        { id: 'file-2', name: 'test2.pdf', size: 0 }, // Zero size
      ];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      expect(result.current.uploadState.files[0].size).toBe(0);
      expect(result.current.uploadState.files[1].size).toBe(0);
      expect(result.current.totalBytes).toBe(0);

      act(() => {
        result.current.updateFileProgress('file-1', 50, 'uploading');
      });

      expect(result.current.completedBytes).toBe(0);
    });
  });

  describe('Performance Testing', () => {
    test('should handle large number of files efficiently', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = Array.from({ length: 100 }, (_, i) => ({
        id: `file-${i}`,
        name: `test${i}.pdf`,
        size: 1000,
      }));

      const startTime = performance.now();

      act(() => {
        result.current.startUpload(mockFiles);
      });

      // Update all files
      act(() => {
        mockFiles.forEach((file, index) => {
          result.current.updateFileProgress(file.id, (index + 1), 'uploading');
        });
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.current.uploadState.files).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle rapid state changes without performance degradation', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const mockFiles = [{ id: 'file-1', name: 'test.pdf', size: 1000 }];

      act(() => {
        result.current.startUpload(mockFiles);
      });

      const startTime = performance.now();

      // Perform many rapid updates
      act(() => {
        for (let i = 0; i < 1000; i++) {
          result.current.updateFileProgress('file-1', i % 101, 'uploading');
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500); // Should handle 1000 updates quickly
      expect(result.current.uploadState.files[0].progress).toBeDefined();
    });
  });
});