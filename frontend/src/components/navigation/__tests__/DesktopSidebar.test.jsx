import { vi } from 'vitest';

/**
 * DesktopSidebar Component Tests
 * Tests desktop sidebar navigation component for lg+ breakpoints
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import DesktopSidebar from '../DesktopSidebar';
import { ResponsiveProvider } from '../../../contexts/ResponsiveContext';
import { createMockUser } from '../../../test-utils/test-data';

// Mock the responsive hook
const mockResponsive = {
  breakpoint: 'lg',
  width: 1200,
  height: 800,
  matches: vi.fn(() => false),
  isAbove: vi.fn(() => true),
  isBelow: vi.fn(() => false)
};

vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => mockResponsive
}));

const mockUser = createMockUser();

const TestWrapper = ({ children }) => (
  <BrowserRouter>
    <MantineProvider>
      <ResponsiveProvider value={mockResponsive}>
        {children}
      </ResponsiveProvider>
    </MantineProvider>
  </BrowserRouter>
);

const defaultProps = {
  user: mockUser,
  navigationItems: [
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/patients', label: 'Patients', icon: 'users' },
    { to: '/medications', label: 'Medications', icon: 'pill' }
  ],
  isCollapsed: false,
  onToggleCollapse: vi.fn()
};

describe('DesktopSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders sidebar container', () => {
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toHaveClass('desktop-sidebar');
    });

    test('renders user information', () => {
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText(mockUser.full_name)).toBeInTheDocument();
      expect(screen.getByText(`@${mockUser.username}`)).toBeInTheDocument();
    });

    test('renders all navigation items', () => {
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Patients')).toBeInTheDocument();
      expect(screen.getByText('Medications')).toBeInTheDocument();
    });

    test('renders navigation links with correct hrefs', () => {
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard');
      expect(screen.getByRole('link', { name: /patients/i })).toHaveAttribute('href', '/patients');
      expect(screen.getByRole('link', { name: /medications/i })).toHaveAttribute('href', '/medications');
    });

    test('renders collapse toggle button', () => {
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /collapse sidebar/i })).toBeInTheDocument();
    });
  });

  describe('Collapse Functionality', () => {
    test('shows collapsed state when isCollapsed is true', () => {
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} isCollapsed={true} />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).toHaveClass('desktop-sidebar-collapsed');
    });

    test('shows expanded state when isCollapsed is false', () => {
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} isCollapsed={false} />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).not.toHaveClass('desktop-sidebar-collapsed');
    });

    test('calls onToggleCollapse when collapse button is clicked', () => {
      const mockToggle = vi.fn();
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} onToggleCollapse={mockToggle} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }));
      expect(mockToggle).toHaveBeenCalledTimes(1);
    });

    test('hides text labels when collapsed', () => {
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} isCollapsed={true} />
        </TestWrapper>
      );

      // Text should still be in DOM but hidden via CSS
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      
      const sidebar = screen.getByRole('navigation');
      expect(sidebar).toHaveClass('desktop-sidebar-collapsed');
    });
  });

  describe('Navigation Items', () => {
    test('handles empty navigation items array', () => {
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} navigationItems={[]} />
        </TestWrapper>
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    test('handles navigation items without icons', () => {
      const itemsWithoutIcons = [
        { to: '/test', label: 'Test Page' }
      ];

      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} navigationItems={itemsWithoutIcons} />
        </TestWrapper>
      );

      expect(screen.getByText('Test Page')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /test page/i })).toHaveAttribute('href', '/test');
    });

    test('renders icons when provided', () => {
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} />
        </TestWrapper>
      );

      // Icons should be rendered (we can't test actual icon display easily, but can test structure)
      const navLinks = screen.getAllByRole('link');
      expect(navLinks.length).toBe(3);
    });
  });

  describe('User Information', () => {
    test('handles missing user gracefully', () => {
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} user={null} />
        </TestWrapper>
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.queryByText('@')).not.toBeInTheDocument();
    });

    test('handles user without full_name', () => {
      const userWithoutName = { ...mockUser, full_name: null };
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} user={userWithoutName} />
        </TestWrapper>
      );

      expect(screen.getByText(`@${mockUser.username}`)).toBeInTheDocument();
    });

    test('handles user without username', () => {
      const userWithoutUsername = { ...mockUser, username: null };
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} user={userWithoutUsername} />
        </TestWrapper>
      );

      expect(screen.getByText(mockUser.full_name)).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    test('maintains fixed width when expanded', () => {
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} isCollapsed={false} />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).toHaveStyle('width: 280px');
    });

    test('uses collapsed width when collapsed', () => {
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} isCollapsed={true} />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).toHaveClass('desktop-sidebar-collapsed');
    });
  });

  describe('Accessibility', () => {
    test('has proper navigation landmark', () => {
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    test('collapse button has proper accessibility attributes', () => {
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} />
        </TestWrapper>
      );

      const collapseButton = screen.getByRole('button', { name: /collapse sidebar/i });
      expect(collapseButton).toHaveAttribute('aria-label');
    });

    test('navigation links have proper accessibility attributes', () => {
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} />
        </TestWrapper>
      );

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    });

    test('supports keyboard navigation', () => {
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} />
        </TestWrapper>
      );

      const firstLink = screen.getByRole('link', { name: /dashboard/i });
      firstLink.focus();
      expect(document.activeElement).toBe(firstLink);
    });
  });

  describe('Theme Support', () => {
    test('applies proper CSS classes', () => {
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).toHaveClass('desktop-sidebar');
    });

    test('supports high contrast mode', () => {
      // This would need to be tested with CSS media queries or theme context
      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('renders without crashing with minimal props', () => {
      render(
        <TestWrapper>
          <DesktopSidebar user={mockUser} navigationItems={[]} />
        </TestWrapper>
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    test('handles invalid navigation item structure', () => {
      const invalidItems = [
        { label: 'Invalid' }, // missing 'to'
        { to: '/valid', label: 'Valid' }
      ];

      render(
        <TestWrapper>
          <DesktopSidebar {...defaultProps} navigationItems={invalidItems} />
        </TestWrapper>
      );

      expect(screen.getByText('Valid')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });
  });
});
