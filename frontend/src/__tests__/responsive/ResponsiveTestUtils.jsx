import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import ResponsiveContext from '../../contexts/ResponsiveContext';
import logger from '../../services/logger';

/**
 * ResponsiveTestUtils
 * 
 * Comprehensive testing utilities for responsive components and behavior.
 * Provides viewport simulation, breakpoint testing, and medical form testing helpers.
 */

// Breakpoint definitions matching the app's responsive system
export const BREAKPOINTS = {
  xs: { min: 0, max: 575 },
  sm: { min: 576, max: 767 },
  md: { min: 768, max: 1023 },
  lg: { min: 1024, max: 1279 },
  xl: { min: 1280, max: 1535 },
  xxl: { min: 1536, max: Infinity }
};

// Device type mappings
export const DEVICE_TYPES = {
  mobile: ['xs', 'sm'],
  tablet: ['md'],
  desktop: ['lg', 'xl', 'xxl']
};

// Common test viewports
export const TEST_VIEWPORTS = {
  mobile: { width: 375, height: 667 },     // iPhone SE
  mobileLarge: { width: 414, height: 896 }, // iPhone XR
  tablet: { width: 768, height: 1024 },     // iPad
  tabletLarge: { width: 1024, height: 768 }, // iPad landscape
  desktop: { width: 1280, height: 720 },    // Desktop
  desktopLarge: { width: 1920, height: 1080 } // Large desktop
};

/**
 * Mock viewport dimensions
 * @param {number} width - Viewport width
 * @param {number} height - Viewport height
 */
export const mockViewport = (width, height) => {
  // Mock window.innerWidth and window.innerHeight
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width
  });

  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height
  });

  // Mock window.matchMedia
  window.matchMedia = vi.fn((query) => {
    const digits = query.match(/\d+/);
    const match = digits
      ? (query.includes('max-width')
        ? width <= parseInt(digits[0])
        : width >= parseInt(digits[0]))
      : false;

    return {
      matches: match,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    };
  });

  // Fire resize event
  fireEvent(window, new Event('resize'));
};

/**
 * Get breakpoint for width
 * @param {number} width - Viewport width
 * @returns {string} Breakpoint name
 */
export const getBreakpointForWidth = (width) => {
  for (const [breakpoint, { min, max }] of Object.entries(BREAKPOINTS)) {
    if (width >= min && width <= max) {
      return breakpoint;
    }
  }
  return 'xl'; // Default fallback
};

/**
 * Get device type for breakpoint
 * @param {string} breakpoint - Breakpoint name
 * @returns {string} Device type
 */
export const getDeviceTypeForBreakpoint = (breakpoint) => {
  for (const [deviceType, breakpoints] of Object.entries(DEVICE_TYPES)) {
    if (breakpoints.includes(breakpoint)) {
      return deviceType;
    }
  }
  return 'desktop'; // Default fallback
};

/**
 * Custom render function with responsive provider
 * @param {React.Component} ui - Component to render
 * @param {Object} options - Render options
 * @returns {Object} Render result with additional utilities
 */
export const renderResponsive = (ui, options = {}) => {
  const {
    viewport = TEST_VIEWPORTS.desktop,
    breakpoint,
    initialProps = {},
    ...renderOptions
  } = options;

  // Set viewport dimensions
  mockViewport(viewport.width, viewport.height);

  const bp = breakpoint || getBreakpointForWidth(viewport.width);
  const deviceType = getDeviceTypeForBreakpoint(bp);
  const responsiveValue = {
    width: viewport.width,
    height: viewport.height,
    breakpoint: bp,
    deviceType,
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
    isAbove: () => false,
    isBelow: () => false,
    matches: () => false,
    isLandscape: viewport.width > viewport.height,
    isPortrait: viewport.height >= viewport.width,
    isTouch: deviceType === 'mobile',
    lastUpdate: Date.now(),
    updateCount: 0,
  };

  const ResponsiveWrapper = ({ children }) => (
    <MantineProvider>
      <ResponsiveContext.Provider value={responsiveValue}>
        {children}
      </ResponsiveContext.Provider>
    </MantineProvider>
  );

  const result = render(ui, {
    wrapper: (props) => <ResponsiveWrapper {...initialProps} {...props} />,
    ...renderOptions
  });

  return {
    ...result,
    viewport,
    mockViewport: (width, height) => {
      mockViewport(width, height);
      return result.rerender(ui);
    },
    setBreakpoint: (newBreakpoint) => {
      const newViewport = TEST_VIEWPORTS[newBreakpoint] || 
        { width: BREAKPOINTS[newBreakpoint].min + 50, height: 600 };
      mockViewport(newViewport.width, newViewport.height);
      return result.rerender(ui);
    }
  };
};

/**
 * Test component at all breakpoints
 * @param {React.Component} component - Component to test
 * @param {Function} testFn - Test function called for each breakpoint
 * @param {Object} options - Test options
 */
export const testAtAllBreakpoints = async (component, testFn, options = {}) => {
  const { skip = [], only = [] } = options;
  const breakpointsToTest = only.length > 0 ? only : 
    Object.keys(BREAKPOINTS).filter(bp => !skip.includes(bp));

  for (const breakpoint of breakpointsToTest) {
    const viewport = TEST_VIEWPORTS[breakpoint] || {
      width: BREAKPOINTS[breakpoint].min + 50,
      height: 600
    };

    describe(`at ${breakpoint} breakpoint (${viewport.width}x${viewport.height})`, () => {
      beforeEach(() => {
        mockViewport(viewport.width, viewport.height);
      });

      testFn(breakpoint, viewport);
    });
  }
};

/**
 * Simulate responsive form submission
 * @param {Object} formData - Form data to submit
 * @param {string} submitButtonText - Submit button text
 * @param {Object} options - Submission options
 */
export const simulateFormSubmission = async (formData = {}, submitButtonText = 'Submit', options = {}) => {
  const { waitForValidation = true, clearFirst = false } = options;
  const user = userEvent.setup();

  // Fill form fields
  for (const [fieldName, value] of Object.entries(formData)) {
    const field = screen.getByRole('textbox', { name: new RegExp(fieldName, 'i') }) ||
                  screen.getByRole('combobox', { name: new RegExp(fieldName, 'i') }) ||
                  screen.getByLabelText(new RegExp(fieldName, 'i'));

    if (field) {
      if (clearFirst) {
        await user.clear(field);
      }
      
      if (field.tagName === 'SELECT' || field.getAttribute('role') === 'combobox') {
        await user.selectOptions(field, value);
      } else {
        await user.type(field, value.toString());
      }
    }
  }

  // Wait for validation if enabled
  if (waitForValidation) {
    await waitFor(() => {
      // Check if any validation errors are present
      const errors = screen.queryAllByRole('alert');
      expect(errors).toHaveLength(0);
    }, { timeout: 2000 });
  }

  // Submit form
  const submitButton = screen.getByRole('button', { name: new RegExp(submitButtonText, 'i') });
  await user.click(submitButton);
};

/**
 * Test responsive table behavior
 * @param {Object} options - Test options
 */
export const testResponsiveTable = async (options = {}) => {
  const {
    data = [],
    columns = [],
    breakpoint = 'desktop'
  } = options;

  const viewport = TEST_VIEWPORTS[breakpoint] || TEST_VIEWPORTS.desktop;
  mockViewport(viewport.width, viewport.height);

  if (DEVICE_TYPES.mobile.includes(getBreakpointForWidth(viewport.width))) {
    // Mobile: Should show card view
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/card/i)).toHaveLength(data.length);
  } else if (DEVICE_TYPES.tablet.includes(getBreakpointForWidth(viewport.width))) {
    // Tablet: Should show table with horizontal scroll
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(table.closest('[data-scrollable]')).toBeInTheDocument();
  } else {
    // Desktop: Should show full table
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    
    // Check all columns are visible
    columns.forEach(column => {
      expect(screen.getByRole('columnheader', { name: column.title })).toBeInTheDocument();
    });
  }
};

/**
 * Test responsive modal behavior
 * @param {Object} options - Test options
 */
export const testResponsiveModal = async (options = {}) => {
  const {
    breakpoint = 'desktop',
    isForm = false,
    complexity = 'medium'
  } = options;

  const viewport = TEST_VIEWPORTS[breakpoint] || TEST_VIEWPORTS.desktop;
  mockViewport(viewport.width, viewport.height);

  const modal = screen.getByRole('dialog');
  expect(modal).toBeInTheDocument();

  const deviceType = getDeviceTypeForBreakpoint(getBreakpointForWidth(viewport.width));

  if (deviceType === 'mobile' && (complexity === 'high' || isForm)) {
    // Mobile: Should be full screen
    expect(modal).toHaveAttribute('data-size', 'full');
  } else if (deviceType === 'tablet') {
    // Tablet: Should be large
    expect(modal).toHaveAttribute('data-size', 'lg');
  } else {
    // Desktop: Should be extra large
    expect(modal).toHaveAttribute('data-size', 'xl');
  }
};

/**
 * Measure component render performance
 * @param {React.Component} component - Component to measure
 * @param {Object} options - Measurement options
 * @returns {Object} Performance metrics
 */
export const measureRenderPerformance = async (component, options = {}) => {
  const { iterations = 5, breakpoints = ['mobile', 'desktop'] } = options;
  const results = {};

  for (const breakpoint of breakpoints) {
    const viewport = TEST_VIEWPORTS[breakpoint];
    const times = [];

    for (let i = 0; i < iterations; i++) {
      mockViewport(viewport.width, viewport.height);
      
      const start = performance.now();
      const { unmount } = renderResponsive(component, { viewport });
      const end = performance.now();
      
      times.push(end - start);
      unmount();
    }

    results[breakpoint] = {
      average: times.reduce((a, b) => a + b) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      times
    };
  }

  return results;
};

/**
 * Test breakpoint transitions
 * @param {React.Component} component - Component to test
 * @param {Array} breakpoints - Breakpoints to test transitions between
 */
export const testBreakpointTransitions = async (component, breakpoints = ['mobile', 'tablet', 'desktop']) => {
  const { rerender } = renderResponsive(component);
  
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const fromBreakpoint = breakpoints[i];
    const toBreakpoint = breakpoints[i + 1];
    
    const fromViewport = TEST_VIEWPORTS[fromBreakpoint];
    const toViewport = TEST_VIEWPORTS[toBreakpoint];
    
    // Set initial breakpoint
    mockViewport(fromViewport.width, fromViewport.height);
    rerender(component);
    
    const startTime = performance.now();
    
    // Transition to new breakpoint
    mockViewport(toViewport.width, toViewport.height);
    rerender(component);
    
    const endTime = performance.now();
    const transitionTime = endTime - startTime;
    
    // Assert transition is fast enough (< 100ms)
    expect(transitionTime).toBeLessThan(100);
    
    logger.debug(`Breakpoint transition ${fromBreakpoint} -> ${toBreakpoint}`, {
      component: 'ResponsiveTestUtils',
      transitionTime: `${transitionTime.toFixed(2)}ms`,
      fromViewport,
      toViewport
    });
  }
};

/**
 * Mock medical form data generators
 */
export const mockMedicalData = {
  medication: (overrides = {}) => ({
    medication_name: 'Test Medication',
    dosage: '10mg',
    frequency: 'Once daily',
    start_date: '2024-01-01',
    prescribing_practitioner: '1',
    notes: 'Test notes',
    ...overrides
  }),

  allergy: (overrides = {}) => ({
    allergen: 'Penicillin',
    reaction_type: 'Skin rash',
    severity: 'Moderate',
    notes: 'Test allergy notes',
    ...overrides
  }),

  condition: (overrides = {}) => ({
    condition_name: 'Test Condition',
    diagnosis_date: '2024-01-01',
    status: 'Active',
    notes: 'Test condition notes',
    ...overrides
  }),

  immunization: (overrides = {}) => ({
    vaccine_name: 'COVID-19 Vaccine',
    date_administered: '2024-01-01',
    practitioner: 'Dr. Test',
    location: 'Test Clinic',
    lot_number: 'LOT123',
    ...overrides
  })
};

/**
 * Test medical form at all breakpoints
 * @param {React.Component} formComponent - Form component to test
 * @param {Object} formData - Data to fill in form
 * @param {Object} options - Test options
 */
export const testMedicalFormAtAllBreakpoints = async (formComponent, formData = {}, options = {}) => {
  const { submitButtonText = 'Save', expectedSubmissionData = {} } = options;
  
  await testAtAllBreakpoints(formComponent, async (breakpoint, viewport) => {
    it('renders form correctly', async () => {
      renderResponsive(formComponent, { viewport });
      
      // Form should be rendered
      expect(screen.getByRole('form') || screen.getByTestId('medical-form')).toBeInTheDocument();
      
      // Submit button should be present
      expect(screen.getByRole('button', { name: new RegExp(submitButtonText, 'i') })).toBeInTheDocument();
    });

    it('handles form submission', async () => {
      const onSubmit = vi.fn();
      const FormWithSubmit = React.cloneElement(formComponent, { onSubmit });
      
      renderResponsive(FormWithSubmit, { viewport });
      
      await simulateFormSubmission(formData, submitButtonText);
      
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining(expectedSubmissionData)
        );
      });
    });

    it('maintains data integrity across breakpoints', async () => {
      const { rerender } = renderResponsive(formComponent, { viewport });
      
      // Fill form at current breakpoint
      await simulateFormSubmission(formData, '', { waitForValidation: false });
      
      // Switch to different breakpoint
      const nextBreakpoint = breakpoint === 'mobile' ? 'desktop' : 'mobile';
      const nextViewport = TEST_VIEWPORTS[nextBreakpoint];
      
      mockViewport(nextViewport.width, nextViewport.height);
      rerender(formComponent);
      
      // Verify data is still there
      for (const [fieldName, value] of Object.entries(formData)) {
        const field = screen.queryByDisplayValue(value.toString());
        expect(field).toBeInTheDocument();
      }
    });
  });
};

/**
 * Custom matchers for responsive testing
 */
export const customMatchers = {
  toBeAtBreakpoint: (received, expected) => {
    const currentBreakpoint = getBreakpointForWidth(window.innerWidth);
    const pass = currentBreakpoint === expected;
    
    return {
      message: () => `Expected breakpoint to be ${expected}, but got ${currentBreakpoint}`,
      pass
    };
  },

  toBeResponsive: (received) => {
    // Check if element has responsive classes or data attributes
    const hasResponsiveClasses = received.className?.includes('responsive') ||
                                received.className?.includes('mantine-') ||
                                received.hasAttribute('data-responsive');
    
    return {
      message: () => `Expected element to be responsive`,
      pass: hasResponsiveClasses
    };
  }
};

// Extend Jest matchers
if (expect.extend) {
  expect.extend(customMatchers);
}

export default {
  mockViewport,
  renderResponsive,
  testAtAllBreakpoints,
  simulateFormSubmission,
  testResponsiveTable,
  testResponsiveModal,
  measureRenderPerformance,
  testBreakpointTransitions,
  mockMedicalData,
  testMedicalFormAtAllBreakpoints,
  TEST_VIEWPORTS,
  BREAKPOINTS,
  DEVICE_TYPES
};