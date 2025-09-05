/**
 * Basic ResponsiveNavigation Component Tests
 * Simple tests to verify navigation component behavior
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import ResponsiveContext from '../../../contexts/ResponsiveContext';
import { createMockUser } from '../../../test-utils/test-data';

// Mock child components
jest.mock('../DesktopSidebar', () => {
  return function MockDesktopSidebar() {
    return <div data-testid="desktop-sidebar">Desktop Sidebar</div>;
  };
});

jest.mock('../TabletSidebar', () => {
  return function MockTabletSidebar() {
    return <div data-testid="tablet-sidebar">Tablet Sidebar</div>;
  };
});

jest.mock('../MobileDrawer', () => {
  return function MockMobileDrawer() {
    return <div data-testid="mobile-drawer">Mobile Drawer</div>;
  };
});

// Import after mocking
const ResponsiveNavigation = require('../ResponsiveNavigation').default;

const mockUser = createMockUser();

const defaultProps = {
  user: mockUser,
  navigationItems: [
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/patients', label: 'Patients', icon: 'users' }
  ],
  isOpen: false,
  onToggle: jest.fn()
};

const TestWrapper = ({ children, responsiveValue }) => (
  <BrowserRouter>
    <MantineProvider>
      <ResponsiveContext.Provider value={responsiveValue}>
        {children}
      </ResponsiveContext.Provider>
    </MantineProvider>
  </BrowserRouter>
);

describe('ResponsiveNavigation Basic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders DesktopSidebar on large screens', () => {
    const responsiveValue = {
      breakpoint: 'lg',
      width: 1200,
      height: 800,
      matches: jest.fn((bp) => bp === 'lg'),
      isAbove: jest.fn((bp) => bp === 'md'),
      isBelow: jest.fn(() => false),
      isMobile: false,
      isTablet: false,
      isDesktop: true
    };

    render(
      <TestWrapper responsiveValue={responsiveValue}>
        <ResponsiveNavigation {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('desktop-sidebar')).toBeInTheDocument();
    expect(screen.queryByTestId('tablet-sidebar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-drawer')).not.toBeInTheDocument();
  });

  test('renders TabletSidebar on medium screens', () => {
    const responsiveValue = {
      breakpoint: 'md',
      width: 768,
      height: 1024,
      matches: jest.fn((bp) => bp === 'md'),
      isAbove: jest.fn((bp) => ['xs', 'sm'].includes(bp)),
      isBelow: jest.fn((bp) => ['lg', 'xl'].includes(bp)),
      isMobile: false,
      isTablet: true,
      isDesktop: false
    };

    render(
      <TestWrapper responsiveValue={responsiveValue}>
        <ResponsiveNavigation {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('tablet-sidebar')).toBeInTheDocument();
    expect(screen.queryByTestId('desktop-sidebar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-drawer')).not.toBeInTheDocument();
  });

  test('renders MobileDrawer on small screens', () => {
    const responsiveValue = {
      breakpoint: 'xs',
      width: 375,
      height: 667,
      matches: jest.fn((bp) => bp === 'xs'),
      isAbove: jest.fn(() => false),
      isBelow: jest.fn((bp) => ['sm', 'md', 'lg', 'xl'].includes(bp)),
      isMobile: true,
      isTablet: false,
      isDesktop: false
    };

    render(
      <TestWrapper responsiveValue={responsiveValue}>
        <ResponsiveNavigation {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('mobile-drawer')).toBeInTheDocument();
    expect(screen.queryByTestId('desktop-sidebar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tablet-sidebar')).not.toBeInTheDocument();
  });

  test('handles missing props gracefully', () => {
    const responsiveValue = {
      breakpoint: 'lg',
      width: 1200,
      height: 800,
      matches: jest.fn((bp) => bp === 'lg'),
      isAbove: jest.fn((bp) => bp === 'md'),
      isBelow: jest.fn(() => false),
      isMobile: false,
      isTablet: false,
      isDesktop: true
    };

    render(
      <TestWrapper responsiveValue={responsiveValue}>
        <ResponsiveNavigation user={mockUser} navigationItems={[]} />
      </TestWrapper>
    );

    expect(screen.getByTestId('desktop-sidebar')).toBeInTheDocument();
  });
});