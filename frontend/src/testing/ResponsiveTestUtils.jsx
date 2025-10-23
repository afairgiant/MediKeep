import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { ResponsiveProvider } from '../providers/ResponsiveProvider';
import { BREAKPOINTS } from '../config/responsive.config';

/**
 * ResponsiveTestUtils
 * Testing utilities for responsive components
 * 
 * Provides helpers for:
 * - Rendering components at specific breakpoints
 * - Simulating viewport changes
 * - Testing all breakpoints automatically
 * - Performance testing
 */

/**
 * Render component with ResponsiveProvider at specific breakpoint
 * 
 * @param {ReactElement} component - Component to render
 * @param {string} breakpoint - Target breakpoint (xs, sm, md, lg, xl, xxl)
 * @param {Object} options - Additional options
 * @param {Object} options.providerProps - Props to pass to ResponsiveProvider
 * @param {Object} options.renderOptions - Options to pass to render()
 * @returns {Object} Render result from testing library
 * 
 * @example
 * const { getByTestId } = renderWithBreakpoint(
 *   <MyComponent data-testid="my-component" />,
 *   'xs'
 * );
 */
export function renderWithBreakpoint(component, breakpoint, options = {}) {
  const { providerProps = {}, renderOptions = {} } = options;
  
  // Validate breakpoint
  if (!Object.keys(BREAKPOINTS).includes(breakpoint)) {
    throw new Error(`Invalid breakpoint: ${breakpoint}. Must be one of: ${Object.keys(BREAKPOINTS).join(', ')}`);
  }
  
  // Set up mock dimensions for the breakpoint
  const width = getBreakpointWidth(breakpoint);
  const height = 768; // Standard height for testing
  
  // Mock window dimensions
  mockWindowDimensions(width, height);
  
  return render(
    <ResponsiveProvider 
      initialBreakpoint={breakpoint}
      debugMode={false}
      {...providerProps}
    >
      {component}
    </ResponsiveProvider>,
    renderOptions
  );
}

/**
 * Simulate viewport resize
 * 
 * @param {number} width - New viewport width
 * @param {number} height - New viewport height
 * @returns {Promise} Promise that resolves when resize is complete
 * 
 * @example
 * await resizeTo(768, 1024); // Tablet size
 */
export async function resizeTo(width, height) {
  await act(async () => {
    // Mock the new dimensions
    mockWindowDimensions(width, height);
    
    // Dispatch resize event
    global.dispatchEvent(new Event('resize'));
    
    // Wait for debounced updates
    await new Promise(resolve => setTimeout(resolve, 200));
  });
  
  // Wait for any resulting DOM updates
  await waitFor(() => {
    expect(global.innerWidth).toBe(width);
    expect(global.innerHeight).toBe(height);
  });
}

/**
 * Mock window dimensions
 * 
 * @param {number} width - Viewport width
 * @param {number} height - Viewport height
 */
export function mockWindowDimensions(width, height) {
  Object.defineProperty(global, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  
  Object.defineProperty(global, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
}

/**
 * Test component at all breakpoints
 * 
 * @param {ReactElement} component - Component to test
 * @param {Function} testFn - Test function to run for each breakpoint
 * @param {Object} options - Additional options
 * @returns {void}
 * 
 * @example
 * testAllBreakpoints(<MyComponent />, (rendered, breakpoint) => {
 *   expect(rendered.container).toBeInTheDocument();
 *   
 *   if (breakpoint === 'xs') {
 *     expect(rendered.getByTestId('mobile-view')).toBeVisible();
 *   }
 * });
 */
export function testAllBreakpoints(component, testFn, options = {}) {
  Object.entries(BREAKPOINTS).forEach(([breakpoint, minWidth]) => {
    it(`renders correctly at ${breakpoint} breakpoint (${minWidth}px+)`, () => {
      const rendered = renderWithBreakpoint(component, breakpoint, options);
      testFn(rendered, breakpoint, minWidth);
    });
  });
}

/**
 * Create a test suite for responsive component
 * 
 * @param {string} componentName - Name of component being tested
 * @param {Function} componentFactory - Function that returns component to test
 * @param {Object} testCases - Test cases per breakpoint
 * @returns {void}
 * 
 * @example
 * createResponsiveTestSuite('MyComponent', () => <MyComponent />, {
 *   xs: (rendered) => expect(rendered.getByTestId('mobile')).toBeVisible(),
 *   lg: (rendered) => expect(rendered.getByTestId('desktop')).toBeVisible()
 * });
 */
export function createResponsiveTestSuite(componentName, componentFactory, testCases) {
  describe(`${componentName} - Responsive Behavior`, () => {
    Object.entries(testCases).forEach(([breakpoint, testFn]) => {
      it(`behaves correctly at ${breakpoint} breakpoint`, () => {
        const component = componentFactory();
        const rendered = renderWithBreakpoint(component, breakpoint);
        testFn(rendered, breakpoint);
      });
    });
  });
}

/**
 * Get typical width for a breakpoint (for testing)
 * 
 * @param {string} breakpoint - Breakpoint name
 * @returns {number} Width in pixels
 */
export function getBreakpointWidth(breakpoint) {
  const widths = {
    xs: 375,   // iPhone width
    sm: 640,   // Small tablet
    md: 768,   // iPad width
    lg: 1024,  // Small desktop
    xl: 1280,  // Desktop
    xxl: 1536  // Large desktop
  };
  
  return widths[breakpoint] || widths.lg;
}

/**
 * Assert that component renders differently at different breakpoints
 * 
 * @param {ReactElement} component - Component to test
 * @param {string} breakpoint1 - First breakpoint
 * @param {string} breakpoint2 - Second breakpoint
 * @param {string} selector - CSS selector or test ID to compare
 * @returns {Promise} Promise that resolves when assertion is complete
 * 
 * @example
 * await assertBreakpointDifference(
 *   <MyComponent />,
 *   'xs',
 *   'lg',
 *   '[data-testid="layout"]'
 * );
 */
export async function assertBreakpointDifference(component, breakpoint1, breakpoint2, selector) {
  const render1 = renderWithBreakpoint(component, breakpoint1);
  const render2 = renderWithBreakpoint(component, breakpoint2);
  
  await waitFor(() => {
    const element1 = render1.container.querySelector(selector);
    const element2 = render2.container.querySelector(selector);
    
    expect(element1).not.toEqual(element2);
  });
  
  // Cleanup
  render1.unmount();
  render2.unmount();
}

/**
 * Performance testing helper for responsive components
 * 
 * @param {ReactElement} component - Component to test
 * @param {Object} options - Performance test options
 * @returns {Object} Performance metrics
 * 
 * @example
 * const metrics = await measureResponsivePerformance(<MyComponent />);
 * expect(metrics.resizeTime).toBeLessThan(100);
 */
export async function measureResponsivePerformance(component, options = {}) {
  const { iterations = 5, breakpoints = ['xs', 'md', 'lg'] } = options;
  
  const metrics = {
    renderTimes: [],
    resizeTimes: [],
    memoryUsage: []
  };
  
  for (let i = 0; i < iterations; i++) {
    for (const breakpoint of breakpoints) {
      // Measure render time
      const renderStart = performance.now();
      const rendered = renderWithBreakpoint(component, breakpoint);
      const renderEnd = performance.now();
      
      metrics.renderTimes.push(renderEnd - renderStart);
      
      // Measure resize time
      const resizeStart = performance.now();
      await resizeTo(getBreakpointWidth('lg'), 768);
      const resizeEnd = performance.now();
      
      metrics.resizeTimes.push(resizeEnd - resizeStart);
      
      // Memory usage (if available)
      if (performance.memory) {
        metrics.memoryUsage.push(performance.memory.usedJSHeapSize);
      }
      
      rendered.unmount();
    }
  }
  
  return {
    avgRenderTime: metrics.renderTimes.reduce((a, b) => a + b, 0) / metrics.renderTimes.length,
    avgResizeTime: metrics.resizeTimes.reduce((a, b) => a + b, 0) / metrics.resizeTimes.length,
    maxMemoryUsage: Math.max(...metrics.memoryUsage),
    rawMetrics: metrics
  };
}

/**
 * Setup and teardown helpers for responsive tests
 */
export const ResponsiveTestHelpers = {
  /**
   * Setup responsive test environment
   */
  beforeEach() {
    // Mock IntersectionObserver
    global.IntersectionObserver = jest.fn(() => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
      unobserve: jest.fn()
    }));
    
    // Mock ResizeObserver
    global.ResizeObserver = jest.fn(() => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
      unobserve: jest.fn()
    }));
    
    // Set default window dimensions
    mockWindowDimensions(1024, 768);
  },
  
  /**
   * Cleanup after responsive tests
   */
  afterEach() {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset window dimensions
    delete global.innerWidth;
    delete global.innerHeight;
    delete global.IntersectionObserver;
    delete global.ResizeObserver;
  }
};

export default {
  renderWithBreakpoint,
  resizeTo,
  testAllBreakpoints,
  createResponsiveTestSuite,
  getBreakpointWidth,
  assertBreakpointDifference,
  measureResponsivePerformance,
  ResponsiveTestHelpers
};