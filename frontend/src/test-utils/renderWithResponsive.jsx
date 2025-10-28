/**
 * Test utility for rendering components with ResponsiveProvider
 * Provides mock responsive context for component testing
 */

import React from 'react';
import { vi } from 'vitest';
import { render as rtlRender } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import ResponsiveProvider from '../providers/ResponsiveProvider';
import ResponsiveContext from '../contexts/ResponsiveContext';

// Default responsive context for testing
const defaultResponsiveContext = {
  breakpoint: 'lg',
  width: 1200,
  height: 800,
  deviceType: 'desktop',
  matches: vi.fn(() => false),
  isAbove: vi.fn(() => false),
  isBelow: vi.fn(() => false),
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isLandscape: true,
  isPortrait: false,
  isTouch: false,
  lastUpdate: Date.now(),
  updateCount: 0
};

/**
 * Custom render function with responsive context
 */
function renderWithResponsive(
  ui,
  {
    // Responsive context overrides
    responsiveValue = {},
    // Whether to use mock context or real provider
    useMockContext = true,
    // Router options
    initialEntries = ['/'],
    skipRouter = false,
    // Mantine theme overrides
    mantineTheme = {},
    // RTL render options
    ...renderOptions
  } = {}
) {
  const mergedResponsiveContext = { ...defaultResponsiveContext, ...responsiveValue };

  function Wrapper({ children }) {
    const content = (
      <MantineProvider theme={mantineTheme}>
        {useMockContext ? (
          <ResponsiveContext.Provider value={mergedResponsiveContext}>
            {children}
          </ResponsiveContext.Provider>
        ) : (
          <ResponsiveProvider initialBreakpoint={responsiveValue.breakpoint}>
            {children}
          </ResponsiveProvider>
        )}
      </MantineProvider>
    );

    if (skipRouter) {
      return content;
    }

    return (
      <BrowserRouter>
        {content}
      </BrowserRouter>
    );
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Render with mobile responsive context
 */
export function renderMobile(ui, options = {}) {
  return renderWithResponsive(ui, {
    responsiveValue: {
      breakpoint: 'xs',
      width: 375,
      height: 667,
      deviceType: 'mobile',
      matches: vi.fn((bp) => bp === 'xs'),
      isAbove: vi.fn(() => false),
      isBelow: vi.fn((bp) => ['sm', 'md', 'lg', 'xl'].includes(bp)),
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isLandscape: false,
      isPortrait: true
    },
    ...options
  });
}

/**
 * Render with tablet responsive context
 */
export function renderTablet(ui, options = {}) {
  return renderWithResponsive(ui, {
    responsiveValue: {
      breakpoint: 'md',
      width: 768,
      height: 1024,
      deviceType: 'tablet',
      matches: vi.fn((bp) => bp === 'md'),
      isAbove: vi.fn((bp) => ['xs', 'sm'].includes(bp)),
      isBelow: vi.fn((bp) => ['lg', 'xl'].includes(bp)),
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      isLandscape: false,
      isPortrait: true
    },
    ...options
  });
}

/**
 * Render with desktop responsive context
 */
export function renderDesktop(ui, options = {}) {
  return renderWithResponsive(ui, {
    responsiveValue: {
      breakpoint: 'lg',
      width: 1200,
      height: 800,
      deviceType: 'desktop',
      matches: vi.fn((bp) => bp === 'lg'),
      isAbove: vi.fn((bp) => ['xs', 'sm', 'md'].includes(bp)),
      isBelow: vi.fn((bp) => bp === 'xl'),
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isLandscape: true,
      isPortrait: false
    },
    ...options
  });
}

/**
 * Create mock responsive context for specific breakpoint
 */
export function createMockResponsive(breakpoint = 'lg', overrides = {}) {
  const breakpointSettings = {
    xs: {
      width: 375,
      height: 667,
      deviceType: 'mobile',
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isLandscape: false,
      isPortrait: true
    },
    sm: {
      width: 576,
      height: 1024,
      deviceType: 'mobile',
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isLandscape: false,
      isPortrait: true
    },
    md: {
      width: 768,
      height: 1024,
      deviceType: 'tablet',
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      isLandscape: false,
      isPortrait: true
    },
    lg: {
      width: 1200,
      height: 800,
      deviceType: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isLandscape: true,
      isPortrait: false
    },
    xl: {
      width: 1400,
      height: 1000,
      deviceType: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isLandscape: true,
      isPortrait: false
    }
  };

  const settings = breakpointSettings[breakpoint] || breakpointSettings.lg;
  const breakpointOrder = ['xs', 'sm', 'md', 'lg', 'xl'];
  const currentIndex = breakpointOrder.indexOf(breakpoint);

  return {
    ...defaultResponsiveContext,
    breakpoint,
    ...settings,
    matches: vi.fn((bp) => bp === breakpoint),
    isAbove: vi.fn((bp) => {
      const targetIndex = breakpointOrder.indexOf(bp);
      return currentIndex > targetIndex;
    }),
    isBelow: vi.fn((bp) => {
      const targetIndex = breakpointOrder.indexOf(bp);
      return currentIndex < targetIndex;
    }),
    ...overrides
  };
}

// Re-export RTL utilities
export * from '@testing-library/react';

// Main export
export { renderWithResponsive as default };