import { renderHook, act } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { useUploadProgress } from '../useUploadProgress';
import { useFormSubmissionWithUploads } from '../useFormSubmissionWithUploads';

// Mock dependencies for performance testing
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

jest.mock('../../constants/errorMessages', () => ({
  ERROR_MESSAGES: {
    UPLOAD_FAILED: 'Upload failed',
    FORM_SUBMISSION_FAILED: 'Form submission failed',
  },
  SUCCESS_MESSAGES: {
    UPLOAD_SUCCESS: 'Upload successful',
    UPLOAD_MULTIPLE_SUCCESS: 'All files uploaded successfully',
    FORM_SAVED: 'Form saved successfully!',
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

// Performance test utilities
const measureExecutionTime = (fn) => {
  const start = performance.now();
  fn();
  const end = performance.now();
  return end - start;
};

const createLargeFileSet = (count) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `file-${i}`,
    name: `test-file-${i}.pdf`,
    size: Math.floor(Math.random() * 10000) + 1000, // Random size between 1-11KB
    description: `Test file ${i} for performance testing`,
  }));
};

describe('Upload Progress Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Large File Set Performance', () => {
    test('should handle 100 files initialization efficiently', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const largeFileSet = createLargeFileSet(100);

      const duration = measureExecutionTime(() => {
        act(() => {
          result.current.startUpload(largeFileSet);
        });
      });

      expect(duration).toBeLessThan(500); // Should initialize within 500ms
      expect(result.current.uploadState.files).toHaveLength(100);
      expect(result.current.uploadState.isUploading).toBe(true);
    });

    test('should handle 500 files initialization with acceptable performance', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const veryLargeFileSet = createLargeFileSet(500);

      const duration = measureExecutionTime(() => {
        act(() => {
          result.current.startUpload(veryLargeFileSet);
        });
      });

      expect(duration).toBeLessThan(2000); // Should initialize within 2 seconds
      expect(result.current.uploadState.files).toHaveLength(500);
    });

    test('should handle 1000 files with memory-conscious approach', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const massiveFileSet = createLargeFileSet(1000);

      const memoryBefore = performance.memory ? performance.memory.usedJSHeapSize : 0;
      
      const duration = measureExecutionTime(() => {
        act(() => {
          result.current.startUpload(massiveFileSet);
        });
      });

      const memoryAfter = performance.memory ? performance.memory.usedJSHeapSize : 0;
      const memoryIncrease = memoryAfter - memoryBefore;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.current.uploadState.files).toHaveLength(1000);
      
      // Memory increase should be reasonable (less than 50MB for 1000 file objects)
      if (performance.memory) {
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      }
    });
  });

  describe('Rapid State Update Performance', () => {
    test('should handle 1000 rapid progress updates efficiently', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const testFiles = createLargeFileSet(10);

      act(() => {
        result.current.startUpload(testFiles);
      });

      const duration = measureExecutionTime(() => {
        act(() => {
          // Perform 1000 updates across 10 files
          for (let i = 0; i < 1000; i++) {
            const fileIndex = i % 10;
            const progress = (i % 101); // Progress from 0-100
            result.current.updateFileProgress(
              testFiles[fileIndex].id, 
              progress, 
              'uploading'
            );
          }
        });
      });

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.current.uploadState.files).toHaveLength(10);
    });

    test('should handle concurrent file updates without performance degradation', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const testFiles = createLargeFileSet(50);

      act(() => {
        result.current.startUpload(testFiles);
      });

      const duration = measureExecutionTime(() => {
        act(() => {
          // Update all 50 files simultaneously multiple times
          for (let round = 0; round < 20; round++) {
            testFiles.forEach((file, index) => {
              const progress = Math.min(100, (round + 1) * 5);
              result.current.updateFileProgress(file.id, progress, 'uploading');
            });
          }
        });
      });

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.current.uploadState.overallProgress).toBeGreaterThan(95);
    });

    test('should maintain consistent performance with batch updates', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const testFiles = createLargeFileSet(100);

      act(() => {
        result.current.startUpload(testFiles);
      });

      const batchUpdates = testFiles.map((file, index) => ({
        fileId: file.id,
        progress: (index + 1),
        status: 'uploading',
      }));

      const duration = measureExecutionTime(() => {
        act(() => {
          result.current.updateMultipleFiles(batchUpdates);
        });
      });

      expect(duration).toBeLessThan(500); // Batch updates should be faster
      expect(result.current.uploadState.files).toHaveLength(100);
    });
  });

  describe('Memory Leak Prevention', () => {
    test('should not accumulate memory with repeated upload cycles', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      
      const memoryBefore = performance.memory ? performance.memory.usedJSHeapSize : 0;

      // Perform 10 upload cycles
      for (let cycle = 0; cycle < 10; cycle++) {
        const testFiles = createLargeFileSet(50);
        
        act(() => {
          result.current.startUpload(testFiles);
        });

        // Simulate upload progress
        act(() => {
          testFiles.forEach((file, index) => {
            result.current.updateFileProgress(file.id, 100, 'completed');
          });
        });

        act(() => {
          result.current.completeUpload(true);
          result.current.resetUpload();
        });
      }

      const memoryAfter = performance.memory ? performance.memory.usedJSHeapSize : 0;
      const memoryIncrease = memoryAfter - memoryBefore;

      // Memory should not increase significantly after multiple cycles
      if (performance.memory) {
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
      }

      expect(result.current.uploadState.files).toHaveLength(0);
    });

    test('should clean up intervals on repeated start/stop operations', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const { result } = renderHook(() => useUploadProgress(), { wrapper });

      // Perform multiple start/reset cycles rapidly
      for (let i = 0; i < 20; i++) {
        act(() => {
          result.current.startUpload([{ id: `file-${i}`, name: 'test.pdf', size: 1000 }]);
          result.current.resetUpload();
        });
      }

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    test('should handle unmount during high-activity upload', () => {
      const { result, unmount } = renderHook(() => useUploadProgress(), { wrapper });
      const testFiles = createLargeFileSet(100);

      act(() => {
        result.current.startUpload(testFiles);
      });

      // Start rapid updates
      const updateInterval = setInterval(() => {
        act(() => {
          testFiles.forEach(file => {
            result.current.updateFileProgress(file.id, Math.random() * 100, 'uploading');
          });
        });
      }, 10);

      // Unmount during active updates
      setTimeout(() => {
        unmount();
        clearInterval(updateInterval);
      }, 100);

      act(() => {
        jest.advanceTimersByTime(150);
      });

      // Should not throw errors or cause memory leaks
    });
  });

  describe('Form-Upload Coordination Performance', () => {
    test('should handle rapid form-upload state transitions efficiently', () => {
      const { result } = renderHook(() => 
        useFormSubmissionWithUploads({
          entityType: 'performance-test',
          onSuccess: jest.fn(),
          onError: jest.fn(),
        }), { wrapper }
      );

      const duration = measureExecutionTime(() => {
        act(() => {
          // Rapid state transitions
          for (let i = 0; i < 100; i++) {
            result.current.startSubmission();
            result.current.completeFormSubmission(true, `entity-${i}`);
            result.current.startFileUpload();
            result.current.completeFileUpload(true, i % 5, 0);
            result.current.resetSubmission();
          }
        });
      });

      expect(duration).toBeLessThan(1000); // Should handle rapid transitions efficiently
      expect(result.current.isCompleted).toBe(false); // Should be reset
    });

    test('should maintain performance with concurrent hook operations', () => {
      const { result: formResult } = renderHook(() => 
        useFormSubmissionWithUploads({
          entityType: 'concurrent-test',
          onSuccess: jest.fn(),
          onError: jest.fn(),
        }), { wrapper }
      );

      const { result: uploadResult } = renderHook(() => useUploadProgress(), { wrapper });

      const testFiles = createLargeFileSet(25);

      const duration = measureExecutionTime(() => {
        act(() => {
          // Start form submission
          formResult.current.startSubmission();
          
          // Simultaneously start upload
          uploadResult.current.startUpload(testFiles);
          
          // Rapidly update both
          for (let i = 0; i < 50; i++) {
            uploadResult.current.updateFileProgress(
              testFiles[i % testFiles.length].id, 
              i * 2, 
              'uploading'
            );
          }
          
          // Complete both
          formResult.current.completeFormSubmission(true, 'entity-concurrent');
          formResult.current.startFileUpload();
          uploadResult.current.completeUpload(true);
          formResult.current.completeFileUpload(true, testFiles.length, 0);
        });
      });

      expect(duration).toBeLessThan(1500); // Should handle concurrent operations efficiently
      expect(formResult.current.isCompleted).toBe(true);
      expect(uploadResult.current.uploadState.isCompleted).toBe(true);
    });
  });

  describe('Stress Testing', () => {
    test('should handle extreme file count (10,000 files) gracefully', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const extremeFileSet = createLargeFileSet(10000);

      // This might be slow, but should not crash
      const duration = measureExecutionTime(() => {
        act(() => {
          result.current.startUpload(extremeFileSet);
        });
      });

      expect(result.current.uploadState.files).toHaveLength(10000);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    });

    test('should handle pathological update patterns', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const testFiles = createLargeFileSet(10);

      act(() => {
        result.current.startUpload(testFiles);
      });

      // Pathological pattern: update same file repeatedly with random values
      const duration = measureExecutionTime(() => {
        act(() => {
          for (let i = 0; i < 10000; i++) {
            result.current.updateFileProgress(
              testFiles[0].id, 
              Math.random() * 100, 
              'uploading'
            );
          }
        });
      });

      expect(duration).toBeLessThan(2000); // Should handle pathological patterns
      expect(result.current.uploadState.files[0].progress).toBeDefined();
    });

    test('should handle rapid error state changes without performance impact', () => {
      const { result } = renderHook(() => 
        useFormSubmissionWithUploads({
          entityType: 'error-stress-test',
          onSuccess: jest.fn(),
          onError: jest.fn(),
        }), { wrapper }
      );

      const duration = measureExecutionTime(() => {
        act(() => {
          // Rapid error-recovery cycles
          for (let i = 0; i < 1000; i++) {
            result.current.startSubmission();
            result.current.handleSubmissionFailure(new Error(`Error ${i}`), 'form');
            result.current.resetSubmission();
          }
        });
      });

      expect(duration).toBeLessThan(2000); // Should handle error cycles efficiently
      expect(result.current.isCompleted).toBe(false);
    });
  });

  describe('Resource Usage Optimization', () => {
    test('should optimize memory usage with large progress updates', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const testFiles = createLargeFileSet(100);

      act(() => {
        result.current.startUpload(testFiles);
      });

      const memoryBefore = performance.memory ? performance.memory.usedJSHeapSize : 0;

      // Perform extensive updates
      act(() => {
        for (let round = 0; round < 100; round++) {
          testFiles.forEach((file, index) => {
            result.current.updateFileProgress(file.id, round, 'uploading');
          });
        }
      });

      const memoryAfter = performance.memory ? performance.memory.usedJSHeapSize : 0;
      const memoryIncrease = memoryAfter - memoryBefore;

      // Memory increase should be minimal despite many updates
      if (performance.memory) {
        expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // Less than 20MB
      }
    });

    test('should maintain CPU efficiency under sustained load', () => {
      const { result } = renderHook(() => useUploadProgress(), { wrapper });
      const testFiles = createLargeFileSet(50);

      act(() => {
        result.current.startUpload(testFiles);
      });

      const iterations = 1000;
      const startTime = performance.now();

      act(() => {
        for (let i = 0; i < iterations; i++) {
          const fileIndex = i % testFiles.length;
          result.current.updateFileProgress(
            testFiles[fileIndex].id, 
            (i % 101), 
            'uploading'
          );
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;
      const operationsPerSecond = (iterations / duration) * 1000;

      // Should maintain reasonable throughput
      expect(operationsPerSecond).toBeGreaterThan(100); // At least 100 ops/second
    });
  });

  describe('Real-world Simulation', () => {
    test('should handle realistic upload workflow with 20 mixed-size files', () => {
      const { result: uploadResult } = renderHook(() => useUploadProgress(), { wrapper });
      const { result: formResult } = renderHook(() => 
        useFormSubmissionWithUploads({
          entityType: 'realistic-test',
          onSuccess: jest.fn(),
          onError: jest.fn(),
        }), { wrapper }
      );

      // Realistic file sizes (some small, some large)
      const realisticFiles = [
        { id: 'small-1', name: 'document.pdf', size: 1024 * 50 }, // 50KB
        { id: 'small-2', name: 'image.jpg', size: 1024 * 200 }, // 200KB
        { id: 'medium-1', name: 'presentation.pptx', size: 1024 * 1024 * 2 }, // 2MB
        { id: 'medium-2', name: 'video.mp4', size: 1024 * 1024 * 5 }, // 5MB
        { id: 'large-1', name: 'backup.zip', size: 1024 * 1024 * 10 }, // 10MB
        ...createLargeFileSet(15) // Additional smaller files
      ];

      const totalDuration = measureExecutionTime(() => {
        act(() => {
          // Start form submission
          formResult.current.startSubmission();
          
          // Complete form
          formResult.current.completeFormSubmission(true, 'realistic-entity');
          
          // Start uploads
          formResult.current.startFileUpload();
          uploadResult.current.startUpload(realisticFiles);
          
          // Simulate realistic progress updates (not all files progress equally)
          for (let progress = 0; progress <= 100; progress += 5) {
            realisticFiles.forEach((file, index) => {
              // Some files upload faster than others
              const adjustedProgress = Math.min(100, progress + (index % 3) * 2);
              const status = adjustedProgress === 100 ? 'completed' : 'uploading';
              uploadResult.current.updateFileProgress(file.id, adjustedProgress, status);
            });
          }
          
          // Complete the workflow
          uploadResult.current.completeUpload(true);
          formResult.current.completeFileUpload(true, realisticFiles.length, 0);
        });
      });

      expect(totalDuration).toBeLessThan(3000); // Realistic workflow should complete quickly
      expect(formResult.current.isCompleted).toBe(true);
      expect(uploadResult.current.uploadState.isCompleted).toBe(true);
      expect(uploadResult.current.uploadState.overallProgress).toBe(100);
    });
  });
});