import { vi, describe, test, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import DesktopSidebar from '../DesktopSidebar';

const TestWrapper = ({ children }) => (
  <BrowserRouter>
    <MantineProvider>
      {children}
    </MantineProvider>
  </BrowserRouter>
);

describe('DesktopSidebar', () => {
  const defaultProps = {
    isOpen: true,
    onToggle: vi.fn(),
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
        <DesktopSidebar {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  test('renders menu items when open', () => {
    render(
      <TestWrapper>
        <DesktopSidebar {...defaultProps} isOpen={true} />
      </TestWrapper>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Patients')).toBeInTheDocument();
  });

  test('renders collapsed sidebar when not open', () => {
    render(
      <TestWrapper>
        <DesktopSidebar {...defaultProps} isOpen={false} />
      </TestWrapper>
    );

    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
