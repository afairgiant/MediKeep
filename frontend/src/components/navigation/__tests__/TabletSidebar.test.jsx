import { vi, describe, test, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import TabletSidebar from '../TabletSidebar';

const TestWrapper = ({ children }) => (
  <BrowserRouter>
    <MantineProvider>
      {children}
    </MantineProvider>
  </BrowserRouter>
);

describe('TabletSidebar', () => {
  const defaultProps = {
    isOpen: false,
    onToggle: vi.fn(),
    onClose: vi.fn(),
    onLinkClick: vi.fn(),
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
        <TabletSidebar {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  test('renders navigation toggle', () => {
    render(
      <TestWrapper>
        <TabletSidebar {...defaultProps} />
      </TestWrapper>
    );

    const toggle = screen.getByRole('button', { name: /navigation menu/i });
    expect(toggle).toBeInTheDocument();
  });

  test('shows sidebar when isOpen is true', () => {
    render(
      <TestWrapper>
        <TabletSidebar {...defaultProps} isOpen={true} />
      </TestWrapper>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Patients')).toBeInTheDocument();
  });
});
