import { vi, describe, test, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import ResponsiveNavigation from '../ResponsiveNavigation';

// Mock useResponsive hook
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    breakpoint: 'lg',
    width: 1200,
    height: 800,
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isAbove: () => true,
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

describe('ResponsiveNavigation (Basic)', () => {
  const menuItems = [
    {
      section: 'Main',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: '📊' }
      ]
    }
  ];

  test('renders basic navigation', () => {
    render(
      <TestWrapper>
        <ResponsiveNavigation
          currentPath="/dashboard"
          menuItems={menuItems}
          userInfo={{ username: 'test', fullName: 'Test User', role: 'User' }}
          onLogout={vi.fn()}
        />
      </TestWrapper>
    );

    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
