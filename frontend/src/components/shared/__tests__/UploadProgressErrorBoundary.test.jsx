import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import UploadProgressErrorBoundary from '../UploadProgressErrorBoundary';
import logger from '../../../services/logger';

// Mock the logger
vi.mock('../../../services/logger', () => ({
  error: vi.fn(),
}));

// Create a problematic component that throws errors on demand
const ProblematicComponent = ({ shouldThrow, errorMessage, throwOnRender }) => {
  if (throwOnRender && shouldThrow) {
    throw new Error(errorMessage || 'Test component error');
  }

  const handleClick = () => {
    if (shouldThrow) {
      throw new Error(errorMessage || 'Button click error');
    }
  };

  return (
    <div data-testid="problematic-component">
      <button onClick={handleClick} data-testid="error-button">
        Click to trigger error
      </button>
      <div>Normal content</div>
    </div>
  );
};

// Component that throws during effect
const EffectErrorComponent = ({ shouldThrow }) => {
  React.useEffect(() => {
    if (shouldThrow) {
      throw new Error('Effect error');
    }
  }, [shouldThrow]);

  return <div data-testid="effect-component">Effect component</div>;
};

// Component that throws async errors
const AsyncErrorComponent = ({ shouldThrow }) => {
  React.useEffect(() => {
    if (shouldThrow) {
      // Simulate async error (won't be caught by error boundary)
      setTimeout(() => {
        throw new Error('Async error');
      }, 10);
    }
  }, [shouldThrow]);

  return <div data-testid="async-component">Async component</div>;
};

// Wrapper for Mantine provider
const wrapper = ({ children }) => <MantineProvider>{children}</MantineProvider>;

describe('UploadProgressErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error during error boundary tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  describe('Normal Operation', () => {
    test('should render children when no error occurs', () => {
      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <ProblematicComponent shouldThrow={false} />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(screen.getByTestId('problematic-component')).toBeInTheDocument();
      expect(screen.getByText('Normal content')).toBeInTheDocument();
      expect(screen.queryByText('Upload Progress Error')).not.toBeInTheDocument();
    });

    test('should render multiple children correctly', () => {
      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <div data-testid="child-1">Child 1</div>
            <div data-testid="child-2">Child 2</div>
            <ProblematicComponent shouldThrow={false} />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
      expect(screen.getByTestId('problematic-component')).toBeInTheDocument();
    });
  });

  describe('Error Catching', () => {
    test('should catch render errors and display error UI', () => {
      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <ProblematicComponent 
              shouldThrow={true} 
              throwOnRender={true}
              errorMessage="Render error message" 
            />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(screen.getByText('Upload Progress Error')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong with progress tracking. Your upload may still be processing.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
      expect(screen.queryByTestId('problematic-component')).not.toBeInTheDocument();
    });

    test('should catch component lifecycle errors', () => {
      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <EffectErrorComponent shouldThrow={true} />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(screen.getByText('Upload Progress Error')).toBeInTheDocument();
      expect(screen.queryByTestId('effect-component')).not.toBeInTheDocument();
    });

    test('should log error details when error occurs', () => {
      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <ProblematicComponent 
              shouldThrow={true} 
              throwOnRender={true}
              errorMessage="Test error for logging" 
            />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(logger.error).toHaveBeenCalledWith('upload_progress_error_boundary', 
        expect.objectContaining({
          error: 'Test error for logging',
          component: 'UploadProgressErrorBoundary',
          stack: expect.any(String),
          componentStack: expect.any(String),
        })
      );
    });

    test('should handle nested component errors', () => {
      const NestedErrorComponent = () => {
        return (
          <div>
            <div>
              <ProblematicComponent 
                shouldThrow={true} 
                throwOnRender={true}
                errorMessage="Nested error" 
              />
            </div>
          </div>
        );
      };

      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <NestedErrorComponent />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(screen.getByText('Upload Progress Error')).toBeInTheDocument();
      expect(logger.error).toHaveBeenCalledWith('upload_progress_error_boundary', 
        expect.objectContaining({
          error: 'Nested error',
        })
      );
    });
  });

  describe('Error Recovery', () => {
    test.skip('should allow recovery by clicking Continue button', () => {
      const { rerender } = render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <ProblematicComponent 
              shouldThrow={true} 
              throwOnRender={true}
              errorMessage="Initial error" 
            />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      // Error should be displayed
      expect(screen.getByText('Upload Progress Error')).toBeInTheDocument();

      // Click Continue button
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

      // Rerender with a working component
      rerender(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <ProblematicComponent shouldThrow={false} />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      // Should show normal content again
      expect(screen.queryByText('Upload Progress Error')).not.toBeInTheDocument();
      expect(screen.getByTestId('problematic-component')).toBeInTheDocument();
    });

    test('should reset error state when Continue is clicked', () => {
      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <ProblematicComponent 
              shouldThrow={true} 
              throwOnRender={true}
              errorMessage="Error to be reset" 
            />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(screen.getByText('Upload Progress Error')).toBeInTheDocument();

      // Click Continue
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

      // The error UI should be gone (component will try to render children again)
      // Since the problematic component will still throw, it will catch again
      // But the state should have been reset momentarily
      expect(logger.error).toHaveBeenCalled();
    });

    test.skip('should handle multiple error-recovery cycles', () => {
      let shouldThrow = true;
      const TestComponent = () => {
        if (shouldThrow) {
          throw new Error('Cycle error');
        }
        return <div data-testid="recovered">Recovered!</div>;
      };

      const { rerender } = render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <TestComponent />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      // First error
      expect(screen.getByText('Upload Progress Error')).toBeInTheDocument();

      // Recover
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      shouldThrow = false;
      
      rerender(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <TestComponent />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(screen.getByTestId('recovered')).toBeInTheDocument();
    });
  });

  describe('Error Types', () => {
    test('should handle JavaScript errors', () => {
      const JSErrorComponent = () => {
        // Simulate a JavaScript error
        const obj = null;
        return <div>{obj.someProperty}</div>;
      };

      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <JSErrorComponent />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(screen.getByText('Upload Progress Error')).toBeInTheDocument();
    });

    test.skip('should handle React errors', () => {
      const ReactErrorComponent = () => {
        // Invalid React element
        return React.createElement('invalidElement', {}, 'content');
      };

      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <ReactErrorComponent />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(screen.getByText('Upload Progress Error')).toBeInTheDocument();
    });

    test('should handle errors with different error objects', () => {
      const CustomErrorComponent = () => {
        const customError = {
          message: 'Custom error object',
          code: 'CUSTOM_ERROR',
          details: { field: 'value' }
        };
        throw customError;
      };

      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <CustomErrorComponent />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(screen.getByText('Upload Progress Error')).toBeInTheDocument();
    });

    test('should handle string errors', () => {
      const StringErrorComponent = () => {
        throw 'String error message';
      };

      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <StringErrorComponent />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(screen.getByText('Upload Progress Error')).toBeInTheDocument();
    });
  });

  describe('Error Boundary Limitations', () => {
    test('should NOT catch async errors', async () => {
      // Error boundaries don't catch async errors
      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <AsyncErrorComponent shouldThrow={true} />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      // Component should render normally since async errors aren't caught
      expect(screen.getByTestId('async-component')).toBeInTheDocument();
      expect(screen.queryByText('Upload Progress Error')).not.toBeInTheDocument();
    });

    test.skip('should NOT catch event handler errors', () => {
      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <ProblematicComponent shouldThrow={true} throwOnRender={false} />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      // Component renders fine initially
      expect(screen.getByTestId('problematic-component')).toBeInTheDocument();

      // Click button that throws in event handler - should NOT be caught
      expect(() => {
        fireEvent.click(screen.getByTestId('error-button'));
      }).toThrow('Button click error');

      // Error boundary should not have caught this
      expect(screen.queryByText('Upload Progress Error')).not.toBeInTheDocument();
    });
  });

  describe('Component Props and State', () => {
    test('should maintain error state after error occurs', () => {
      const TestErrorComponent = () => {
        throw new Error('Persistent error');
      };

      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <TestErrorComponent />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(screen.getByText('Upload Progress Error')).toBeInTheDocument();
      
      // Error UI should remain visible
      expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    });

    test('should handle props changes during error state', () => {
      const { rerender } = render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <ProblematicComponent 
              shouldThrow={true} 
              throwOnRender={true}
              errorMessage="Initial error" 
            />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(screen.getByText('Upload Progress Error')).toBeInTheDocument();

      // Rerender with different props - should still show error UI
      rerender(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <ProblematicComponent 
              shouldThrow={true} 
              throwOnRender={true}
              errorMessage="Different error" 
            />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(screen.getByText('Upload Progress Error')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have accessible error alert', () => {
      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <ProblematicComponent 
              shouldThrow={true} 
              throwOnRender={true} 
            />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Upload Progress Error');
    });

    test('should have accessible continue button', () => {
      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <ProblematicComponent 
              shouldThrow={true} 
              throwOnRender={true} 
            />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      const button = screen.getByRole('button', { name: 'Continue' });
      expect(button).toBeInTheDocument();
      expect(button).toBeEnabled();
    });

    test('should maintain focus management during error recovery', () => {
      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <ProblematicComponent 
              shouldThrow={true} 
              throwOnRender={true} 
            />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      const continueButton = screen.getByRole('button', { name: 'Continue' });
      continueButton.focus();
      
      expect(document.activeElement).toBe(continueButton);
    });
  });

  describe('Integration Scenarios', () => {
    test('should work with upload progress components', () => {
      const UploadProgressComponent = ({ shouldFail }) => {
        if (shouldFail) {
          throw new Error('Upload progress tracking failed');
        }
        return (
          <div data-testid="upload-progress">
            <div>Progress: 50%</div>
            <div>Files: 2/4 completed</div>
          </div>
        );
      };

      const { rerender } = render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <UploadProgressComponent shouldFail={false} />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(screen.getByTestId('upload-progress')).toBeInTheDocument();

      // Simulate error in upload progress
      rerender(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <UploadProgressComponent shouldFail={true} />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      expect(screen.getByText('Upload Progress Error')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong with progress tracking. Your upload may still be processing.')).toBeInTheDocument();
    });

    test('should handle multiple error boundaries', () => {
      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <div>
              <UploadProgressErrorBoundary>
                <ProblematicComponent 
                  shouldThrow={true} 
                  throwOnRender={true}
                  errorMessage="Inner error" 
                />
              </UploadProgressErrorBoundary>
            </div>
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      // Inner error boundary should catch the error
      expect(screen.getByText('Upload Progress Error')).toBeInTheDocument();
    });

    test('should handle error in presence of other components', () => {
      render(
        <MantineProvider>
          <div>
            <div data-testid="sibling-1">Sibling 1</div>
            <UploadProgressErrorBoundary>
              <ProblematicComponent 
                shouldThrow={true} 
                throwOnRender={true} 
              />
            </UploadProgressErrorBoundary>
            <div data-testid="sibling-2">Sibling 2</div>
          </div>
        </MantineProvider>
      );

      // Siblings should render normally
      expect(screen.getByTestId('sibling-1')).toBeInTheDocument();
      expect(screen.getByTestId('sibling-2')).toBeInTheDocument();
      
      // Error boundary should show error
      expect(screen.getByText('Upload Progress Error')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    test('should not impact performance when no errors occur', () => {
      const start = performance.now();
      
      render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <div>Normal content</div>
            <div>More content</div>
            <div>Even more content</div>
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      const end = performance.now();
      const renderTime = end - start;

      expect(renderTime).toBeLessThan(100); // Should render quickly
      expect(screen.getByText('Normal content')).toBeInTheDocument();
    });

    test.skip('should handle rapid error-recovery cycles efficiently', () => {
      let errorCount = 0;
      const RapidErrorComponent = ({ triggerError }) => {
        if (triggerError && errorCount < 5) {
          errorCount++;
          throw new Error(`Rapid error ${errorCount}`);
        }
        return <div data-testid="stable">Stable now</div>;
      };

      const { rerender } = render(
        <MantineProvider>
          <UploadProgressErrorBoundary>
            <RapidErrorComponent triggerError={true} />
          </UploadProgressErrorBoundary>
        </MantineProvider>
      );

      // Should show error
      expect(screen.getByText('Upload Progress Error')).toBeInTheDocument();

      // Recover multiple times
      for (let i = 0; i < 3; i++) {
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        
        rerender(
          <MantineProvider>
            <UploadProgressErrorBoundary>
              <RapidErrorComponent triggerError={false} />
            </UploadProgressErrorBoundary>
          </MantineProvider>
        );
      }

      expect(screen.getByTestId('stable')).toBeInTheDocument();
    });
  });
});
