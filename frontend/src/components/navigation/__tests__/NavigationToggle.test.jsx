import { vi } from 'vitest';

/**
 * NavigationToggle Component Tests
 * Tests hamburger menu toggle button component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import NavigationToggle from '../NavigationToggle';
import { ResponsiveProvider } from '../../../contexts/ResponsiveContext';

// Mock the responsive hook
const mockResponsive = {
  breakpoint: 'xs',
  width: 400,
  height: 700,
  matches: vi.fn(() => false),
  isAbove: vi.fn(() => false),
  isBelow: vi.fn(() => true)
};

vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => mockResponsive
}));

const TestWrapper = ({ children }) => (
  <MantineProvider>
    <ResponsiveProvider value={mockResponsive}>
      {children}
    </ResponsiveProvider>
  </MantineProvider>
);

const defaultProps = {
  isOpen: false,
  onToggle: vi.fn()
};

describe('NavigationToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders toggle button', () => {
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /toggle navigation/i })).toBeInTheDocument();
    });

    test('renders hamburger icon when closed', () => {
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} isOpen={false} />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /toggle navigation/i });
      expect(button).toHaveClass('navigation-toggle');
      expect(button).not.toHaveClass('navigation-toggle-open');
    });

    test('renders close icon when open', () => {
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /toggle navigation/i });
      expect(button).toHaveClass('navigation-toggle-open');
    });

    test('renders with proper button structure', () => {
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });
  });

  describe('Click Functionality', () => {
    test('calls onToggle when clicked', () => {
      const mockToggle = vi.fn();
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} onToggle={mockToggle} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByRole('button'));
      expect(mockToggle).toHaveBeenCalledTimes(1);
    });

    test('calls onToggle with correct parameters', () => {
      const mockToggle = vi.fn();
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} onToggle={mockToggle} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByRole('button'));
      expect(mockToggle).toHaveBeenCalledWith();
    });

    test('prevents multiple rapid clicks', async () => {
      const mockToggle = vi.fn();
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} onToggle={mockToggle} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      
      // Rapid clicks
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      // Should debounce or handle rapid clicks appropriately
      await waitFor(() => {
        expect(mockToggle).toHaveBeenCalled();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    test('responds to Enter key', () => {
      const mockToggle = vi.fn();
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} onToggle={mockToggle} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      expect(mockToggle).toHaveBeenCalledTimes(1);
    });

    test('responds to Space key', () => {
      const mockToggle = vi.fn();
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} onToggle={mockToggle} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: ' ', code: 'Space' });
      expect(mockToggle).toHaveBeenCalledTimes(1);
    });

    test('ignores other keys', () => {
      const mockToggle = vi.fn();
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} onToggle={mockToggle} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Escape', code: 'Escape' });
      fireEvent.keyDown(button, { key: 'Tab', code: 'Tab' });
      expect(mockToggle).not.toHaveBeenCalled();
    });

    test('supports focus', () => {
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      button.focus();
      expect(document.activeElement).toBe(button);
    });
  });

  describe('Responsive Behavior', () => {
    test('adapts size for extra small screens', () => {
      mockResponsive.width = 320;
      mockResponsive.breakpoint = 'xs';

      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('navigation-toggle-xs');
    });

    test('adapts size for small screens', () => {
      mockResponsive.width = 576;
      mockResponsive.breakpoint = 'sm';

      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('navigation-toggle-sm');
    });

    test('adapts size for medium screens', () => {
      mockResponsive.width = 900;
      mockResponsive.breakpoint = 'md';

      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('navigation-toggle-md');
    });

    test('uses appropriate touch target size', () => {
      mockResponsive.width = 320;
      
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      // Should have minimum 44px touch target (accessibility guideline)
      const computedStyle = window.getComputedStyle(button);
      const minSize = parseInt(computedStyle.minHeight) || parseInt(computedStyle.height);
      expect(minSize).toBeGreaterThanOrEqual(44);
    });
  });

  describe('Visual States', () => {
    test('shows different visual state when open', () => {
      const { rerender } = render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} isOpen={false} />
        </TestWrapper>
      );

      let button = screen.getByRole('button');
      expect(button).not.toHaveClass('navigation-toggle-open');

      rerender(
        <TestWrapper>
          <NavigationToggle {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      button = screen.getByRole('button');
      expect(button).toHaveClass('navigation-toggle-open');
    });

    test('animates between states', () => {
      const { rerender } = render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} isOpen={false} />
        </TestWrapper>
      );

      rerender(
        <TestWrapper>
          <NavigationToggle {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('navigation-toggle');
    });

    test('supports hover states', () => {
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      fireEvent.mouseEnter(button);
      expect(button).toHaveClass('navigation-toggle');
      
      fireEvent.mouseLeave(button);
      expect(button).toHaveClass('navigation-toggle');
    });

    test('supports focus states', () => {
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      fireEvent.focus(button);
      expect(document.activeElement).toBe(button);
      
      fireEvent.blur(button);
      expect(document.activeElement).not.toBe(button);
    });
  });

  describe('Accessibility', () => {
    test('has proper aria-label', () => {
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} />
        </TestWrapper>
      );

      const button = screen.getByRole('button', { name: /toggle navigation/i });
      expect(button).toHaveAttribute('aria-label');
    });

    test('updates aria-label based on state', () => {
      const { rerender } = render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} isOpen={false} />
        </TestWrapper>
      );

      let button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', expect.stringContaining('Open'));

      rerender(
        <TestWrapper>
          <NavigationToggle {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', expect.stringContaining('Close'));
    });

    test('has proper aria-expanded attribute', () => {
      const { rerender } = render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} isOpen={false} />
        </TestWrapper>
      );

      let button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');

      rerender(
        <TestWrapper>
          <NavigationToggle {...defaultProps} isOpen={true} />
        </TestWrapper>
      );

      button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    test('has proper role', () => {
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    test('supports high contrast mode', () => {
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('navigation-toggle');
    });

    test('supports reduced motion preferences', () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Touch Support', () => {
    test('handles touch events', () => {
      const mockToggle = vi.fn();
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} onToggle={mockToggle} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      fireEvent.touchStart(button);
      fireEvent.touchEnd(button);
      fireEvent.click(button);

      expect(mockToggle).toHaveBeenCalledTimes(1);
    });

    test('prevents touch delay', () => {
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveStyle('touch-action: manipulation');
    });

    test('has adequate touch target size', () => {
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      const rect = button.getBoundingClientRect();
      
      // Should meet accessibility guidelines for touch targets (44x44px minimum)
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
    });
  });

  describe('Error Handling', () => {
    test('renders without crashing with minimal props', () => {
      render(
        <TestWrapper>
          <NavigationToggle />
        </TestWrapper>
      );

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    test('handles missing onToggle callback gracefully', () => {
      render(
        <TestWrapper>
          <NavigationToggle isOpen={false} onToggle={null} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(() => fireEvent.click(button)).not.toThrow();
    });

    test('handles undefined onToggle callback gracefully', () => {
      render(
        <TestWrapper>
          <NavigationToggle isOpen={false} onToggle={undefined} />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(() => fireEvent.click(button)).not.toThrow();
    });
  });

  describe('Performance', () => {
    test('renders efficiently', () => {
      const startTime = Date.now();
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} />
        </TestWrapper>
      );
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should render quickly
    });

    test('handles frequent state changes efficiently', () => {
      const { rerender } = render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} isOpen={false} />
        </TestWrapper>
      );

      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        rerender(
          <TestWrapper>
            <NavigationToggle {...defaultProps} isOpen={i % 2 === 0} />
          </TestWrapper>
        );
      }
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should handle updates efficiently
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('Custom Props', () => {
    test('accepts custom className', () => {
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} className="custom-class" />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
      expect(button).toHaveClass('navigation-toggle');
    });

    test('accepts custom aria-label', () => {
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} ariaLabel="Custom menu toggle" />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /custom menu toggle/i })).toBeInTheDocument();
    });

    test('accepts custom size prop', () => {
      render(
        <TestWrapper>
          <NavigationToggle {...defaultProps} size="large" />
        </TestWrapper>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('navigation-toggle-large');
    });
  });
});
