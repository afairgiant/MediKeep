import { vi } from 'vitest';
import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Import components to test
import ResponsiveModal from '../../components/adapters/ResponsiveModal';
import ResponsiveSelect from '../../components/adapters/ResponsiveSelect';

// Import test utilities
import {
  renderResponsive,
  testAtAllBreakpoints,
  TEST_VIEWPORTS,
  mockViewport,
  DEVICE_TYPES,
  getBreakpointForWidth,
  getDeviceTypeForBreakpoint
} from './ResponsiveTestUtils';

import logger from '../../services/logger';
import { useResponsive } from '../../hooks/useResponsive';

// Mock logger
vi.mock('../../services/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock useResponsive hook
vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: vi.fn(() => ({
    breakpoint: 'lg',
    deviceType: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    width: 1280,
    height: 720
  }))
}));

describe('Responsive Modal and Layout Tests', () => {
  const mockOnClose = vi.fn();
  const mockOnOpen = vi.fn();

  // Define defaultSelectProps at the top level so it's available to all tests
  const selectOptions = [
    'Option 1',
    'Option 2',
    'Option 3'
  ];

  const defaultSelectProps = {
    options: selectOptions,
    placeholder: 'Select an option',
    onChange: vi.fn(),
    value: ''
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ResponsiveModal Component', () => {
    const defaultModalProps = {
      opened: true,
      onClose: mockOnClose,
      onOpen: mockOnOpen,
      title: 'Test Modal'
    };

    testAtAllBreakpoints(
      <ResponsiveModal {...defaultModalProps}>
        <div>Modal Content</div>
      </ResponsiveModal>,
      (breakpoint, viewport) => {
        const deviceType = getDeviceTypeForBreakpoint(getBreakpointForWidth(viewport.width));

        describe(`Modal at ${breakpoint}`, () => {
          beforeEach(() => {
            useResponsive.mockReturnValue({
              breakpoint,
              deviceType,
              isMobile: deviceType === 'mobile',
              isTablet: deviceType === 'tablet',
              isDesktop: deviceType === 'desktop',
              width: viewport.width,
              height: viewport.height
            });
          });

          it('renders with correct size for breakpoint', () => {
            renderResponsive(
              <ResponsiveModal {...defaultModalProps}>
                <div>Modal Content</div>
              </ResponsiveModal>,
              { viewport }
            );

            const modal = screen.getByRole('dialog');
            expect(modal).toBeInTheDocument();

            if (deviceType === 'mobile' && viewport.width < 480) {
              // Mobile should be full screen for very small screens
              expect(modal).toHaveAttribute('data-size', 'full');
            } else if (deviceType === 'mobile') {
              // Regular mobile should be large
              expect(modal).toHaveAttribute('data-size', 'lg');
            } else if (deviceType === 'tablet') {
              // Tablet should be large
              expect(modal).toHaveAttribute('data-size', 'lg');
            } else {
              // Desktop should be extra large
              expect(modal).toHaveAttribute('data-size', 'xl');
            }
          });

          it('handles modal open/close correctly', async () => {
            const user = userEvent.setup();
            
            const { rerender } = renderResponsive(
              <ResponsiveModal {...defaultModalProps} opened={false}>
                <div>Modal Content</div>
              </ResponsiveModal>,
              { viewport }
            );

            // Modal should not be visible when closed
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

            // Open modal
            rerender(
              <ResponsiveModal {...defaultModalProps} opened={true}>
                <div>Modal Content</div>
              </ResponsiveModal>
            );

            await waitFor(() => {
              expect(screen.getByRole('dialog')).toBeInTheDocument();
              expect(mockOnOpen).toHaveBeenCalled();
            });

            // Close modal
            const closeButton = screen.getByRole('button', { name: /close/i });
            await user.click(closeButton);

            await waitFor(() => {
              expect(mockOnClose).toHaveBeenCalled();
            });
          });

          it('applies correct padding based on device type', () => {
            renderResponsive(
              <ResponsiveModal {...defaultModalProps}>
                <div>Modal Content</div>
              </ResponsiveModal>,
              { viewport }
            );

            const modalContent = screen.getByText('Modal Content').closest('[data-mantine-modal-content]');
            const computedStyle = getComputedStyle(modalContent);

            if (deviceType === 'mobile') {
              // Mobile should have smaller padding
              expect(parseInt(computedStyle.padding)).toBeLessThanOrEqual(16);
            } else if (deviceType === 'desktop') {
              // Desktop can have larger padding
              expect(parseInt(computedStyle.padding)).toBeGreaterThanOrEqual(16);
            }
          });

          it('handles scroll behavior appropriately', () => {
            const longContent = Array.from({ length: 50 }, (_, i) => (
              <p key={i}>Long content paragraph {i}</p>
            ));

            renderResponsive(
              <ResponsiveModal 
                {...defaultModalProps}
                withScrollArea={true}
              >
                <div>{longContent}</div>
              </ResponsiveModal>,
              { viewport }
            );

            const modal = screen.getByRole('dialog');
            expect(modal).toBeInTheDocument();

            if (deviceType === 'mobile') {
              // Mobile should use native scroll (no custom scrollbar)
              const scrollArea = modal.querySelector('[data-scrollable]');
              if (scrollArea) {
                expect(scrollArea).toHaveAttribute('data-scrollbar-size', '0');
              }
            }
          });
        });
      }
    );

    describe('Medical Form Modal Configuration', () => {
      const medicalFormProps = {
        ...defaultModalProps,
        isForm: true,
        medicalContext: 'medications',
        formType: 'medication',
        fieldCount: 8,
        complexity: 'medium'
      };

      it('adapts size based on form complexity', () => {
        
        // Test high complexity form on mobile
        useResponsive.mockReturnValue({
          breakpoint: 'xs',
          deviceType: 'mobile',
          isMobile: true,
          isTablet: false,
          isDesktop: false,
          width: 375,
          height: 667
        });

        renderResponsive(
          <ResponsiveModal 
            {...medicalFormProps}
            complexity="high"
            fieldCount={15}
          >
            <div>Complex Form</div>
          </ResponsiveModal>,
          { viewport: TEST_VIEWPORTS.mobile }
        );

        const modal = screen.getByRole('dialog');
        expect(modal).toHaveAttribute('data-size', 'full');
      });

      it('applies medical form specific attributes', () => {
        renderResponsive(
          <ResponsiveModal {...medicalFormProps}>
            <div>Medical Form Content</div>
          </ResponsiveModal>
        );

        const modalContainer = screen.getByText('Medical Form Content').closest('[data-medical-form]');
        expect(modalContainer).toHaveAttribute('data-medical-form', 'true');
        expect(modalContainer).toHaveAttribute('data-form-type', 'medication');
        expect(modalContainer).toHaveAttribute('data-complexity', 'medium');
      });

      it('handles emergency form type with enhanced focus', () => {
        renderResponsive(
          <ResponsiveModal 
            {...medicalFormProps}
            formType="emergency"
          >
            <div>Emergency Form</div>
          </ResponsiveModal>
        );

        const modal = screen.getByRole('dialog');
        expect(modal).toHaveAttribute('data-trap-focus', 'true');
        expect(modal).toHaveAttribute('data-return-focus', 'true');

        // Emergency forms should have stronger visual styling
        const title = screen.getByText(defaultModalProps.title);
        const titleStyle = getComputedStyle(title);
        expect(parseInt(titleStyle.fontWeight)).toBeGreaterThanOrEqual(700);
      });
    });

    describe('Modal Accessibility', () => {
      it('has correct ARIA attributes', () => {
        renderResponsive(
          <ResponsiveModal 
            {...defaultModalProps}
            aria-labelledby="modal-title"
            aria-describedby="modal-description"
          >
            <div id="modal-description">Modal description</div>
          </ResponsiveModal>
        );

        const modal = screen.getByRole('dialog');
        expect(modal).toHaveAttribute('aria-labelledby', 'modal-title');
        expect(modal).toHaveAttribute('aria-describedby', 'modal-description');
      });

      it('manages focus correctly', async () => {
        const user = userEvent.setup();
        
        renderResponsive(
          <ResponsiveModal {...defaultModalProps} trapFocus={true}>
            <button>First Button</button>
            <button>Second Button</button>
          </ResponsiveModal>
        );

        // Focus should be trapped within modal
        await user.tab();
        
        const firstButton = screen.getByText('First Button');
        expect(firstButton).toHaveFocus();

        await user.tab();
        
        const secondButton = screen.getByText('Second Button');
        expect(secondButton).toHaveFocus();

        // Tab should cycle back to close button or first focusable element
        await user.tab();
        
        const closeButton = screen.getByRole('button', { name: /close/i });
        expect(closeButton).toHaveFocus();
      });
    });
  });

  describe('ResponsiveSelect Component', () => {
    testAtAllBreakpoints(
      <ResponsiveSelect {...defaultSelectProps} />,
      (breakpoint, viewport) => {
        const deviceType = getDeviceTypeForBreakpoint(getBreakpointForWidth(viewport.width));

        describe(`Select at ${breakpoint}`, () => {
          beforeEach(() => {
            useResponsive.mockReturnValue({
              breakpoint,
              deviceType,
              isMobile: deviceType === 'mobile',
              isTablet: deviceType === 'tablet',
              isDesktop: deviceType === 'desktop',
              width: viewport.width,
              height: viewport.height
            });
          });

          it('renders with appropriate size', () => {
            renderResponsive(
              <ResponsiveSelect {...defaultSelectProps} />,
              { viewport }
            );

            const select = screen.getByRole('combobox');
            expect(select).toBeInTheDocument();

            if (deviceType === 'mobile') {
              const style = getComputedStyle(select);
              expect(parseInt(style.minHeight)).toBeGreaterThanOrEqual(48); // Touch target
              expect(parseInt(style.fontSize)).toBeGreaterThanOrEqual(16); // Prevent zoom
            }
          });

          it('configures searchability based on device and options count', async () => {
            const user = userEvent.setup();
            
            renderResponsive(
              <ResponsiveSelect 
                {...defaultSelectProps}
                options={Array.from({ length: 20 }, (_, i) => `Option ${i + 1}`)}
              />,
              { viewport }
            );

            const select = screen.getByRole('combobox');
            await user.click(select);

            if (deviceType === 'mobile') {
              // Mobile should always have search for usability
              expect(screen.getByRole('searchbox')).toBeInTheDocument();
            } else if (deviceType === 'desktop') {
              // Desktop should have search when > 5 options
              expect(screen.getByRole('searchbox')).toBeInTheDocument();
            }
          });

          it('handles option selection correctly', async () => {
            const user = userEvent.setup();
            const mockOnChange = vi.fn();
            
            renderResponsive(
              <ResponsiveSelect 
                {...defaultSelectProps}
                onChange={mockOnChange}
              />,
              { viewport }
            );

            const select = screen.getByRole('combobox');
            await user.click(select);

            await waitFor(() => {
              expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('option', { name: 'Option 1' }));

            await waitFor(() => {
              expect(mockOnChange).toHaveBeenCalledWith('Option 1');
            });
          });

          it('displays dropdown with correct positioning', async () => {
            const user = userEvent.setup();
            
            renderResponsive(
              <ResponsiveSelect {...defaultSelectProps} />,
              { viewport }
            );

            const select = screen.getByRole('combobox');
            await user.click(select);

            const dropdown = screen.getByRole('listbox');
            expect(dropdown).toBeInTheDocument();

            if (deviceType === 'mobile') {
              // Mobile dropdown should be within portal for better positioning
              expect(dropdown.closest('[data-portal]')).toBeInTheDocument();
            }
          });
        });
      }
    );

    describe('Medical Context Select', () => {
      const practitionerOptions = [
        { value: '1', label: 'Dr. Smith', specialty: 'Cardiology' },
        { value: '2', label: 'Dr. Johnson', specialty: 'Neurology' }
      ];

      it('enhances options for medical contexts', () => {
        renderResponsive(
          <ResponsiveSelect 
            {...defaultSelectProps}
            options={practitionerOptions}
            medicalContext="practitioners"
          />
        );

        const select = screen.getByRole('combobox');
        expect(select).toHaveAttribute('aria-label', expect.stringContaining('practitioners'));
      });

      it('handles loading state correctly', () => {
        renderResponsive(
          <ResponsiveSelect 
            {...defaultSelectProps}
            loading={true}
            loadingText="Loading practitioners..."
          />
        );

        expect(screen.getByText('Loading practitioners...')).toBeInTheDocument();
        expect(screen.getByTestId('loader')).toBeInTheDocument();
      });

      it('shows option count when enabled', async () => {
        const user = userEvent.setup();
        
        renderResponsive(
          <ResponsiveSelect 
            {...defaultSelectProps}
            options={practitionerOptions}
            showCount={true}
          />
        );

        const select = screen.getByRole('combobox');
        await user.click(select);

        await waitFor(() => {
          expect(screen.getByText(/2 options available/i)).toBeInTheDocument();
        });
      });
    });

    describe('Select Performance', () => {
      it('handles large option lists efficiently', () => {
        const largeOptionList = Array.from({ length: 500 }, (_, i) => ({
          value: i.toString(),
          label: `Option ${i + 1}`
        }));

        const startTime = performance.now();
        
        const { unmount } = renderResponsive(
          <ResponsiveSelect 
            {...defaultSelectProps}
            options={largeOptionList}
          />
        );
        
        const renderTime = performance.now() - startTime;
        
        expect(renderTime).toBeLessThan(100);
        unmount();
      });

      it('applies appropriate limits based on device type', () => {
        
        // Test mobile with large dataset
        useResponsive.mockReturnValue({
          breakpoint: 'xs',
          deviceType: 'mobile',
          isMobile: true,
          isTablet: false,
          isDesktop: false,
          width: 375,
          height: 667
        });

        const largeOptions = Array.from({ length: 100 }, (_, i) => `Option ${i + 1}`);
        
        renderResponsive(
          <ResponsiveSelect 
            {...defaultSelectProps}
            options={largeOptions}
          />,
          { viewport: TEST_VIEWPORTS.mobile }
        );

        // Mobile should limit options for performance
        const select = screen.getByRole('combobox');
        expect(select).toHaveAttribute('data-limit', '25');
      });
    });
  });

  describe('Field Layout Strategy Tests', () => {
    const TestForm = ({ breakpoint }) => (
      <form>
        <div data-field-layout={breakpoint}>
          <ResponsiveSelect
            label="Medication"
            options={['Med 1', 'Med 2']}
            name="medication"
          />
          <ResponsiveSelect
            label="Practitioner" 
            options={['Dr. A', 'Dr. B']}
            name="practitioner"
          />
          <ResponsiveSelect
            label="Frequency"
            options={['Daily', 'Weekly']}
            name="frequency"
          />
        </div>
      </form>
    );

    testAtAllBreakpoints(
      <TestForm />,
      (breakpoint, viewport) => {
        describe(`Form Layout at ${breakpoint}`, () => {
          it('applies correct field layout strategy', () => {
            const deviceType = getDeviceTypeForBreakpoint(getBreakpointForWidth(viewport.width));
            
            renderResponsive(<TestForm breakpoint={breakpoint} />, { viewport });

            const fieldContainer = screen.getByTestId('field-layout') || 
                                 document.querySelector('[data-field-layout]');

            if (deviceType === 'mobile') {
              // Mobile: 1 column layout
              expect(fieldContainer).toHaveAttribute('data-columns', '1');
            } else if (deviceType === 'tablet') {
              // Tablet: 2 column layout
              expect(fieldContainer).toHaveAttribute('data-columns', '2');
            } else {
              // Desktop: 3 column layout
              expect(fieldContainer).toHaveAttribute('data-columns', '3');
            }
          });

          it('maintains proper spacing between fields', () => {
            renderResponsive(<TestForm breakpoint={breakpoint} />, { viewport });

            const fields = screen.getAllByRole('combobox');
            expect(fields).toHaveLength(3);

            // Check spacing between fields
            fields.forEach((field, index) => {
              if (index > 0) {
                const previousField = fields[index - 1];
                const fieldRect = field.getBoundingClientRect();
                const prevRect = previousField.getBoundingClientRect();
                
                const spacing = fieldRect.top - prevRect.bottom;
                expect(spacing).toBeGreaterThanOrEqual(8); // Minimum spacing
              }
            });
          });
        });
      }
    );
  });

  describe('Touch and Keyboard Navigation', () => {
    it('handles touch interactions on mobile', async () => {
      useResponsive.mockReturnValue({
        breakpoint: 'xs',
        deviceType: 'mobile',
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        width: 375,
        height: 667
      });

      const user = userEvent.setup();
      
      renderResponsive(
        <ResponsiveSelect 
          {...defaultSelectProps}
          options={['Touch Option 1', 'Touch Option 2']}
        />,
        { viewport: TEST_VIEWPORTS.mobile }
      );

      const select = screen.getByRole('combobox');
      
      // Simulate touch event
      fireEvent.touchStart(select);
      fireEvent.touchEnd(select);
      
      await user.click(select);

      await waitFor(() => {
        const dropdown = screen.getByRole('listbox');
        expect(dropdown).toBeInTheDocument();
        
        // Options should have adequate touch targets
        const options = screen.getAllByRole('option');
        options.forEach(option => {
          const style = getComputedStyle(option);
          expect(parseInt(style.minHeight)).toBeGreaterThanOrEqual(44);
        });
      });
    });

    it('supports keyboard navigation properly', async () => {
      const user = userEvent.setup();
      
      renderResponsive(
        <ResponsiveSelect 
          {...defaultSelectProps}
          searchable={true}
        />
      );

      const select = screen.getByRole('combobox');
      
      // Focus select
      select.focus();
      expect(select).toHaveFocus();

      // Open with Enter
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Navigate with arrows
      await user.keyboard('{ArrowDown}');
      
      const firstOption = screen.getByRole('option', { name: 'Option 1' });
      expect(firstOption).toHaveAttribute('aria-selected', 'true');

      // Select with Enter
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(select).toHaveValue('Option 1');
      });
    });
  });

  describe('Error States and Validation', () => {
    it('displays validation errors responsively', () => {
      renderResponsive(
        <ResponsiveSelect 
          {...defaultSelectProps}
          error="This field is required"
          required={true}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent('This field is required');
    });

    it('handles empty options gracefully', () => {
      renderResponsive(
        <ResponsiveSelect 
          {...defaultSelectProps}
          options={[]}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(select).toBeEnabled();
    });

    it('handles malformed options data', () => {
      const malformedOptions = [
        null,
        undefined,
        { label: 'Valid Option', value: '1' },
        'String Option',
        { value: '2' }, // Missing label
        { label: 'No Value' } // Missing value
      ];

      // Should not crash
      const { container } = renderResponsive(
        <ResponsiveSelect 
          {...defaultSelectProps}
          options={malformedOptions}
        />
      );

      expect(container.firstChild).toBeInTheDocument();
      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
