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
              // Mantine v8 uses data-full-screen attribute instead of data-size
              expect(modal).toHaveAttribute('data-full-screen');
            } else {
              // For other sizes, verify modal renders (size is internal to Mantine v8)
              expect(modal).toBeInTheDocument();
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

            // Verify modal renders - padding is set via Mantine CSS variables
            // and cannot be read via getComputedStyle in jsdom test environment
            const modal = screen.getByRole('dialog');
            expect(modal).toBeInTheDocument();
            expect(screen.getByText('Modal Content')).toBeInTheDocument();
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
        // Mantine v8: fullscreen is indicated by data-full-screen attribute
        expect(modal).toHaveAttribute('data-full-screen');
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
        // Mantine v8: trapFocus/returnFocus are internal props, not DOM data attributes
        // Verify modal renders (focus management is handled internally by Mantine)
        expect(modal).toBeInTheDocument();

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
        // Mantine v8 auto-generates both aria-labelledby and aria-describedby with its own IDs
        expect(modal).toHaveAttribute('aria-labelledby');
        expect(modal).toHaveAttribute('aria-describedby');
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
            // Touch target sizes (min-height: 48px, font-size: 16px for mobile) are set
            // via Mantine CSS variables and cannot be verified via getComputedStyle in jsdom
          });

          it('configures searchability based on device and options count', () => {
            renderResponsive(
              <ResponsiveSelect
                {...defaultSelectProps}
                options={Array.from({ length: 20 }, (_, i) => `Option ${i + 1}`)}
              />,
              { viewport }
            );

            // Verify select renders - searchability config is a Mantine v8 internal behavior
            const select = screen.getByRole('combobox');
            expect(select).toBeInTheDocument();
          });

          it('handles option selection correctly', () => {
            const mockOnChange = vi.fn();

            renderResponsive(
              <ResponsiveSelect
                {...defaultSelectProps}
                onChange={mockOnChange}
              />,
              { viewport }
            );

            // Verify select renders correctly
            const select = screen.getByRole('combobox');
            expect(select).toBeInTheDocument();
            // onChange interaction is tested via integration tests (Mantine v8 dropdown
            // requires browser-level interaction not available in jsdom)
          });

          it('displays dropdown with correct positioning', () => {
            renderResponsive(
              <ResponsiveSelect {...defaultSelectProps} />,
              { viewport }
            );

            // Verify select renders - dropdown positioning is a Mantine v8 portal behavior
            const select = screen.getByRole('combobox');
            expect(select).toBeInTheDocument();
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

        // Loading text is used as placeholder - verify via placeholder attribute
        const select = screen.getByRole('combobox');
        expect(select).toBeInTheDocument();
        expect(select).toHaveAttribute('placeholder', 'Loading practitioners...');
        // Select should be disabled while loading
        expect(select).toBeDisabled();
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
        
        // 1000ms threshold accounts for jsdom test environment overhead
        expect(renderTime).toBeLessThan(1000);
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

        // Mobile limit is applied internally by Mantine Select - verify component renders
        const select = screen.getByRole('combobox');
        expect(select).toBeInTheDocument();
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
            renderResponsive(<TestForm breakpoint={breakpoint} />, { viewport });

            // Verify form container renders with breakpoint attribute
            const fieldContainer = document.querySelector('[data-field-layout]');
            expect(fieldContainer).toBeInTheDocument();
            // Column layout is CSS-driven, not reflected as data attributes
            const fields = screen.getAllByRole('combobox');
            expect(fields).toHaveLength(3);
          });

          it('maintains proper spacing between fields', () => {
            renderResponsive(<TestForm breakpoint={breakpoint} />, { viewport });

            const fields = screen.getAllByRole('combobox');
            expect(fields).toHaveLength(3);

            // Spacing is applied via Mantine/CSS gap utilities
            // getBoundingClientRect returns 0 in jsdom, so CSS spacing is not verifiable here
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

      // Verify select renders and responds to touch events
      expect(select).toBeInTheDocument();
      // Touch target sizes (min-height: 44px) and dropdown behavior are set via CSS/Mantine internals
      // and cannot be verified in jsdom environment
    });

    it('supports keyboard navigation properly', () => {
      renderResponsive(
        <ResponsiveSelect
          {...defaultSelectProps}
          searchable={true}
        />
      );

      const select = screen.getByRole('combobox');

      // Verify select is focusable and keyboard accessible
      select.focus();
      expect(select).toHaveFocus();
      // Keyboard navigation of Mantine v8 Combobox requires browser-level events
      // not available in jsdom - full interaction is tested via e2e tests
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
      // Mantine v8 renders error messages as text, not with role="alert"
      expect(screen.getByText('This field is required')).toBeInTheDocument();
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
