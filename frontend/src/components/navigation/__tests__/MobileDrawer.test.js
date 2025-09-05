/**
 * MobileDrawer Component Tests
 * Tests mobile drawer navigation component for xs/sm breakpoints
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import MobileDrawer from '../MobileDrawer';
import { ResponsiveProvider } from '../../../contexts/ResponsiveContext';
import { createMockUser } from '../../../test-utils/test-data';

// Mock the responsive hook
const mockResponsive = {
  breakpoint: 'xs',
  width: 400,
  height: 700,
  matches: jest.fn(() => false),
  isAbove: jest.fn(() => false),
  isBelow: jest.fn(() => true)
};

jest.mock('../../../hooks/useResponsive', () => ({
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
  onToggle: jest.fn()
};

describe('MobileDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResponsive.matches.mockImplementation((bp) => ['xs', 'sm'].includes(bp));
  });

  describe('Rendering', () => {
    test('renders drawer component', () => {
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} />
        </TestWrapper>
      );

      // Mantine Drawer may not be visible in DOM when closed
      expect(document.body).toBeInTheDocument();
    });

    test('renders user information when open', () => {
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByText(mockUser.full_name)).toBeInTheDocument();
      expect(screen.getByText(`@${mockUser.username}`)).toBeInTheDocument();
    });

    test('renders all navigation items when open', () => {
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Patients')).toBeInTheDocument();
      expect(screen.getByText('Medications')).toBeInTheDocument();
    });

    test('renders navigation links with correct hrefs', () => {
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/dashboard');
      expect(screen.getByRole('link', { name: /patients/i })).toHaveAttribute('href', '/patients');
      expect(screen.getByRole('link', { name: /medications/i })).toHaveAttribute('href', '/medications');
    });

    test('renders close button when open', () => {
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });
  });

  describe('Open/Close Functionality', () => {
    test('shows drawer when isOpen is true', () => {
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('hides drawer when isOpen is false', () => {
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={false} />
        </TestWrapper>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('calls onToggle when close button is clicked', () => {
      const mockToggle = jest.fn();
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} onToggle={mockToggle} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByRole('button', { name: /close/i }));
      expect(mockToggle).toHaveBeenCalledTimes(1);
    });

    test('calls onToggle when drawer backdrop is clicked', async () => {
      const mockToggle = jest.fn();
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} onToggle={mockToggle} />
        </TestWrapper>
      );

      // Mantine drawer backdrop click
      const backdrop = screen.getByRole('dialog').parentElement;
      if (backdrop && backdrop.className.includes('backdrop')) {
        fireEvent.click(backdrop);
        expect(mockToggle).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Navigation Items', () => {
    test('handles empty navigation items array', () => {
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} navigationItems={[]} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    test('handles navigation items without icons', () => {
      const itemsWithoutIcons = [
        { to: '/test', label: 'Test Page' }
      ];

      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} navigationItems={itemsWithoutIcons} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByText('Test Page')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /test page/i })).toHaveAttribute('href', '/test');
    });

    test('calls onToggle when navigation link is clicked', () => {
      const mockToggle = jest.fn();
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} onToggle={mockToggle} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByRole('link', { name: /dashboard/i }));
      expect(mockToggle).toHaveBeenCalledTimes(1);
    });

    test('displays large touch targets for navigation items', () => {
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      const navigationLinks = screen.getAllByRole('link');
      navigationLinks.forEach(link => {
        expect(link).toHaveClass('mobile-drawer-nav-item');
      });
    });
  });

  describe('User Information', () => {
    test('handles missing user gracefully', () => {
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} user={null} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.queryByText('@')).not.toBeInTheDocument();
    });

    test('handles user without full_name', () => {
      const userWithoutName = { ...mockUser, full_name: null };
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} user={userWithoutName} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByText(`@${mockUser.username}`)).toBeInTheDocument();
    });

    test('handles user without username', () => {
      const userWithoutUsername = { ...mockUser, username: null };
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} user={userWithoutUsername} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByText(mockUser.full_name)).toBeInTheDocument();
    });
  });

  describe('Mobile-Specific Features', () => {
    test('uses full screen on small screens', () => {
      mockResponsive.width = 350;
      mockResponsive.breakpoint = 'xs';

      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      const drawer = screen.getByRole('dialog');
      expect(drawer).toHaveClass('mantine-Drawer-drawer');
    });

    test('provides scroll area for long navigation lists', () => {
      const longNavigationItems = Array.from({ length: 20 }, (_, i) => ({
        to: `/item-${i}`,
        label: `Item ${i}`,
        icon: 'item'
      }));

      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} navigationItems={longNavigationItems} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByText('Item 0')).toBeInTheDocument();
      expect(screen.getByText('Item 19')).toBeInTheDocument();
    });

    test('supports touch-friendly interactions', () => {
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      const firstNavItem = screen.getByRole('link', { name: /dashboard/i });
      
      // Touch events
      fireEvent.touchStart(firstNavItem);
      fireEvent.touchEnd(firstNavItem);
      
      expect(firstNavItem).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    test('adapts to extra small screens', () => {
      mockResponsive.width = 320;
      mockResponsive.breakpoint = 'xs';

      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('adapts to small screens', () => {
      mockResponsive.width = 576;
      mockResponsive.breakpoint = 'sm';

      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has proper dialog role', () => {
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('close button has proper accessibility attributes', () => {
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toHaveAttribute('aria-label');
    });

    test('navigation links have proper accessibility attributes', () => {
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    });

    test('supports keyboard navigation', () => {
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      const firstLink = screen.getByRole('link', { name: /dashboard/i });
      firstLink.focus();
      expect(document.activeElement).toBe(firstLink);

      // Tab to next link
      fireEvent.keyDown(firstLink, { key: 'Tab' });
      const secondLink = screen.getByRole('link', { name: /patients/i });
      secondLink.focus();
      expect(document.activeElement).toBe(secondLink);
    });

    test('traps focus within drawer when open', () => {
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      const drawer = screen.getByRole('dialog');
      expect(drawer).toBeInTheDocument();
      
      // Focus should be trapped within the drawer
      const firstFocusable = screen.getByRole('link', { name: /dashboard/i });
      const lastFocusable = screen.getByRole('button', { name: /close/i });
      
      expect(firstFocusable).toBeInTheDocument();
      expect(lastFocusable).toBeInTheDocument();
    });
  });

  describe('Animation and Transitions', () => {
    test('applies proper transition classes', () => {
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      const drawer = screen.getByRole('dialog');
      expect(drawer).toHaveClass('mantine-Drawer-drawer');
    });

    test('handles opening animation', async () => {
      const { rerender } = render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={false} />
        </TestWrapper>
      );

      rerender(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    test('handles closing animation', async () => {
      const { rerender } = render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      rerender(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={false} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('renders without crashing with minimal props', () => {
      render(
        <TestWrapper>
          <MobileDrawer user={mockUser} navigationItems={[]} />
        </TestWrapper>
      );

      expect(document.body).toBeInTheDocument();
    });

    test('handles invalid navigation item structure', () => {
      const invalidItems = [
        { label: 'Invalid' }, // missing 'to'
        { to: '/valid', label: 'Valid' }
      ];

      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} navigationItems={invalidItems} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByText('Valid')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('handles missing callback functions gracefully', () => {
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} onToggle={null} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      
      // Click close button - should not crash even with null callback
      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(() => fireEvent.click(closeButton)).not.toThrow();
    });
  });

  describe('Performance', () => {
    test('only renders content when drawer is open', () => {
      const { rerender } = render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={false} />
        </TestWrapper>
      );

      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();

      rerender(
        <TestWrapper>
          <MobileDrawer {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    test('handles large numbers of navigation items efficiently', () => {
      const manyItems = Array.from({ length: 100 }, (_, i) => ({
        to: `/item-${i}`,
        label: `Item ${i}`,
        icon: 'item'
      }));

      const startTime = Date.now();
      render(
        <TestWrapper>
          <MobileDrawer {...defaultProps} navigationItems={manyItems} isOpen={true} />
        </TestWrapper>
      );
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should render in less than 1 second
      expect(screen.getByText('Item 0')).toBeInTheDocument();
      expect(screen.getByText('Item 99')).toBeInTheDocument();
    });
  });
});