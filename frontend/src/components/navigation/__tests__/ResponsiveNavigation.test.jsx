import { vi, describe, test, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import ResponsiveNavigation from '../ResponsiveNavigation';

// Mock useResponsive hook with desktop breakpoint
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    breakpoint: 'lg',
    width: 1200,
    height: 800,
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isAbove: (bp) => bp === 'md' || bp === 'sm' || bp === 'xs',
    matches: (bp) => bp === 'lg'
  })
}));

const TestWrapper = ({ children }) => (
  <BrowserRouter>
    <MantineProvider>
      {children}
    </MantineProvider>
  </BrowserRouter>
);

describe('ResponsiveNavigation', () => {
  const defaultProps = {
    currentPath: '/dashboard',
    menuItems: [
      {
        section: 'Main',
        items: [
          { path: '/dashboard', label: 'Dashboard', icon: '📊', exact: true },
          { path: '/patients', label: 'Patients', icon: '👤' }
        ]
      }
    ],
    userInfo: {
      username: 'testuser',
      fullName: 'Test User',
      role: 'User'
    },
    onLogout: vi.fn()
  };

  test('renders without crashing', () => {
    render(
      <TestWrapper>
        <ResponsiveNavigation {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  test('renders navigation with menu items', () => {
    render(
      <TestWrapper>
        <ResponsiveNavigation {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Patients')).toBeInTheDocument();
  });

  test('accepts user prop as alternative to userInfo', () => {
    const propsWithUser = {
      ...defaultProps,
      user: {
        username: 'altuser',
        full_name: 'Alt User',
        role: 'user'
      },
      userInfo: undefined
    };

    render(
      <TestWrapper>
        <ResponsiveNavigation {...propsWithUser} />
      </TestWrapper>
    );

    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
