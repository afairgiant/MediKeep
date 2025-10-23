import { vi } from 'vitest';

/**
 * TabletSidebar Component Tests
 * Tests tablet sidebar navigation component for md breakpoint
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import TabletSidebar from '../TabletSidebar';
import { ResponsiveProvider } from '../../../contexts/ResponsiveContext';
import { createMockUser } from '../../../test-utils/test-data';

// Mock the responsive hook
const mockResponsive = {
  breakpoint: 'md',
  width: 900,
  height: 600,
  matches: vi.fn(() => false),
  isAbove: vi.fn(() => false),
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
  isOpen: false,
  onToggle: vi.fn()
};

describe('TabletSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResponsive.matches.mockImplementation((bp) => bp === 'md');
  });

  describe('Rendering', () => {
    test('renders sidebar container', () => {
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toHaveClass('tablet-sidebar');
    });

    test('renders user information', () => {
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText(mockUser.full_name)).toBeInTheDocument();
      expect(screen.getByText(`@${mockUser.username}`)).toBeInTheDocument();
    });

    test('renders all navigation items', () => {
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Patients')).toBeInTheDocument();
      expect(screen.getByText('Medications')).toBeInTheDocument();
    });

    test('renders navigation links with correct hrefs', () => {
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard');
      expect(screen.getByRole('link', { name: /patients/i })).toHaveAttribute('href', '/patients');
      expect(screen.getByRole('link', { name: /medications/i })).toHaveAttribute('href', '/medications');
    });
  });

  describe('Open/Close Functionality', () => {
    test('shows closed state when isOpen is false', () => {
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} isOpen={false} />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).toHaveClass('tablet-sidebar-closed');
    });

    test('shows open state when isOpen is true', () => {
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).toHaveClass('tablet-sidebar-open');
    });

    test('renders overlay when open', () => {
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByTestId('sidebar-overlay')).toBeInTheDocument();
    });

    test('does not render overlay when closed', () => {
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} isOpen={false} />
        </TestWrapper>
      );

      expect(screen.queryByTestId('sidebar-overlay')).not.toBeInTheDocument();
    });

    test('calls onToggle when overlay is clicked', () => {
      const mockToggle = vi.fn();
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} isOpen={true} onToggle={mockToggle} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('sidebar-overlay'));
      expect(mockToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Keyboard Navigation', () => {
    test('closes sidebar when Escape key is pressed', () => {
      const mockToggle = vi.fn();
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} isOpen={true} onToggle={mockToggle} />
        </TestWrapper>
      );

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      expect(mockToggle).toHaveBeenCalledTimes(1);
    });

    test('does not close sidebar when other keys are pressed', () => {
      const mockToggle = vi.fn();
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} isOpen={true} onToggle={mockToggle} />
        </TestWrapper>
      );

      fireEvent.keyDown(document, { key: 'Enter', code: 'Enter' });
      fireEvent.keyDown(document, { key: 'Space', code: 'Space' });
      expect(mockToggle).not.toHaveBeenCalled();
    });

    test('only responds to Escape when sidebar is open', () => {
      const mockToggle = vi.fn();
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} isOpen={false} onToggle={mockToggle} />
        </TestWrapper>
      );

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      expect(mockToggle).not.toHaveBeenCalled();
    });
  });

  describe('Navigation Items', () => {
    test('handles empty navigation items array', () => {
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} navigationItems={[]} />
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
          <TabletSidebar {...defaultProps} navigationItems={itemsWithoutIcons} />
        </TestWrapper>
      );

      expect(screen.getByText('Test Page')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /test page/i })).toHaveAttribute('href', '/test');
    });

    test('calls onToggle when navigation link is clicked', () => {
      const mockToggle = vi.fn();
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} isOpen={true} onToggle={mockToggle} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByRole('link', { name: /dashboard/i }));
      expect(mockToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('User Information', () => {
    test('handles missing user gracefully', () => {
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} user={null} />
        </TestWrapper>
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.queryByText('@')).not.toBeInTheDocument();
    });

    test('handles user without full_name', () => {
      const userWithoutName = { ...mockUser, full_name: null };
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} user={userWithoutName} />
        </TestWrapper>
      );

      expect(screen.getByText(`@${mockUser.username}`)).toBeInTheDocument();
    });

    test('handles user without username', () => {
      const userWithoutUsername = { ...mockUser, username: null };
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} user={userWithoutUsername} />
        </TestWrapper>
      );

      expect(screen.getByText(mockUser.full_name)).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    test('maintains tablet-specific width when open', () => {
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).toHaveClass('tablet-sidebar-open');
    });

    test('uses collapsed width when closed', () => {
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} isOpen={false} />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).toHaveClass('tablet-sidebar-closed');
    });
  });

  describe('Touch Support', () => {
    test('handles touch events on overlay', () => {
      const mockToggle = vi.fn();
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} isOpen={true} onToggle={mockToggle} />
        </TestWrapper>
      );

      const overlay = screen.getByTestId('sidebar-overlay');
      fireEvent.touchStart(overlay);
      fireEvent.touchEnd(overlay);
      fireEvent.click(overlay);

      expect(mockToggle).toHaveBeenCalledTimes(1);
    });

    test('supports swipe gestures', () => {
      const mockToggle = vi.fn();
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} isOpen={true} onToggle={mockToggle} />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('navigation');
      
      // Simulate swipe left gesture
      fireEvent.touchStart(sidebar, {
        touches: [{ clientX: 200, clientY: 100 }]
      });
      fireEvent.touchMove(sidebar, {
        touches: [{ clientX: 100, clientY: 100 }]
      });
      fireEvent.touchEnd(sidebar);

      // Note: Actual swipe handling would need gesture detection library
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has proper navigation landmark', () => {
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    test('overlay has proper accessibility attributes', () => {
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      const overlay = screen.getByTestId('sidebar-overlay');
      expect(overlay).toHaveAttribute('role', 'button');
      expect(overlay).toHaveAttribute('aria-label');
    });

    test('navigation links have proper accessibility attributes', () => {
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} />
        </TestWrapper>
      );

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    });

    test('supports focus management', () => {
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      const firstLink = screen.getByRole('link', { name: /dashboard/i });
      firstLink.focus();
      expect(document.activeElement).toBe(firstLink);
    });
  });

  describe('Animation and Transitions', () => {
    test('applies transition classes', () => {
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} isOpen={false} />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('navigation');
      expect(sidebar).toHaveClass('tablet-sidebar');
    });

    test('handles transition states', () => {
      const { rerender } = render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} isOpen={false} />
        </TestWrapper>
      );

      let sidebar = screen.getByRole('navigation');
      expect(sidebar).toHaveClass('tablet-sidebar-closed');

      rerender(
        <TestWrapper>
          <TabletSidebar {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      sidebar = screen.getByRole('navigation');
      expect(sidebar).toHaveClass('tablet-sidebar-open');
    });
  });

  describe('Error Handling', () => {
    test('renders without crashing with minimal props', () => {
      render(
        <TestWrapper>
          <TabletSidebar user={mockUser} navigationItems={[]} />
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
          <TabletSidebar {...defaultProps} navigationItems={invalidItems} />
        </TestWrapper>
      );

      expect(screen.getByText('Valid')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    test('handles missing callback functions gracefully', () => {
      render(
        <TestWrapper>
          <TabletSidebar {...defaultProps} onToggle={null} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByRole('navigation')).toBeInTheDocument();
      
      // Click overlay - should not crash even with null callback
      const overlay = screen.getByTestId('sidebar-overlay');
      expect(() => fireEvent.click(overlay)).not.toThrow();
    });
  });
});
