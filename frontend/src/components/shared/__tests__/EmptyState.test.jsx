import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { IconAlertTriangle, IconPill } from '@tabler/icons-react';
import EmptyState from '../EmptyState';

// Wrapper for Mantine components
const renderWithMantine = (component) => {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  );
};

describe('EmptyState', () => {
  describe('Icon variant (default)', () => {
    it('renders with required props', () => {
      renderWithMantine(
        <EmptyState
          title="No items found"
        />
      );

      expect(screen.getByText('No items found')).toBeInTheDocument();
    });

    it('renders with custom icon', () => {
      renderWithMantine(
        <EmptyState
          icon={IconPill}
          title="No medications"
        />
      );

      expect(screen.getByText('No medications')).toBeInTheDocument();
    });

    it('shows static message when provided', () => {
      renderWithMantine(
        <EmptyState
          title="No items"
          message="This is a static message"
        />
      );

      expect(screen.getByText('This is a static message')).toBeInTheDocument();
    });

    it('shows filtered message when hasActiveFilters is true', () => {
      renderWithMantine(
        <EmptyState
          title="No results"
          hasActiveFilters={true}
          filteredMessage="Try adjusting your filters"
          noDataMessage="Click Add to get started"
        />
      );

      expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument();
      expect(screen.queryByText('Click Add to get started')).not.toBeInTheDocument();
    });

    it('shows noData message when hasActiveFilters is false', () => {
      renderWithMantine(
        <EmptyState
          title="No results"
          hasActiveFilters={false}
          filteredMessage="Try adjusting your filters"
          noDataMessage="Click Add to get started"
        />
      );

      expect(screen.getByText('Click Add to get started')).toBeInTheDocument();
      expect(screen.queryByText('Try adjusting your filters')).not.toBeInTheDocument();
    });

    it('does not render message when none provided', () => {
      const { container } = renderWithMantine(
        <EmptyState
          title="No items"
        />
      );

      // Should only have the title, no additional Text for message
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('No items');
    });

    it('uses default icon when none provided', () => {
      renderWithMantine(
        <EmptyState
          title="No items"
        />
      );

      // Should render without errors (default IconAlertTriangle)
      expect(screen.getByText('No items')).toBeInTheDocument();
    });
  });

  describe('Emoji variant', () => {
    it('renders emoji instead of icon when emoji prop is provided', () => {
      renderWithMantine(
        <EmptyState
          emoji="🧪"
          title="No Lab Results"
        />
      );

      expect(screen.getByText('🧪')).toBeInTheDocument();
      expect(screen.getByText('No Lab Results')).toBeInTheDocument();
    });

    it('shows action button when provided and no filters active', () => {
      const mockClick = vi.fn();
      renderWithMantine(
        <EmptyState
          emoji="🔬"
          title="No Procedures"
          hasActiveFilters={false}
          noDataMessage="Start adding procedures"
          actionButton={
            <button onClick={mockClick}>Add First Procedure</button>
          }
        />
      );

      expect(screen.getByRole('button', { name: 'Add First Procedure' })).toBeInTheDocument();
    });

    it('hides action button when filters are active', () => {
      const mockClick = vi.fn();
      renderWithMantine(
        <EmptyState
          emoji="🔬"
          title="No Procedures"
          hasActiveFilters={true}
          filteredMessage="Adjust your filters"
          actionButton={
            <button onClick={mockClick}>Add First Procedure</button>
          }
        />
      );

      expect(screen.queryByRole('button', { name: 'Add First Procedure' })).not.toBeInTheDocument();
      expect(screen.getByText('Adjust your filters')).toBeInTheDocument();
    });

    it('renders emoji variant with all props', () => {
      renderWithMantine(
        <EmptyState
          emoji="🏥"
          title="No Insurance Found"
          hasActiveFilters={false}
          filteredMessage="Try adjusting filters"
          noDataMessage="Start by adding insurance"
          actionButton={<button>Add Insurance</button>}
        />
      );

      expect(screen.getByText('🏥')).toBeInTheDocument();
      expect(screen.getByText('No Insurance Found')).toBeInTheDocument();
      expect(screen.getByText('Start by adding insurance')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add Insurance' })).toBeInTheDocument();
    });
  });

  describe('Variant selection', () => {
    it('uses icon variant when no emoji provided', () => {
      const { container } = renderWithMantine(
        <EmptyState
          icon={IconAlertTriangle}
          title="Icon Variant"
        />
      );

      // Icon variant uses Paper component
      expect(container.querySelector('[class*="mantine-Paper"]')).toBeInTheDocument();
    });

    it('uses emoji variant when emoji provided', () => {
      const { container } = renderWithMantine(
        <EmptyState
          emoji="🎯"
          title="Emoji Variant"
        />
      );

      // Emoji variant uses Card component
      expect(container.querySelector('[class*="mantine-Card"]')).toBeInTheDocument();
    });

    it('emoji takes precedence over icon', () => {
      renderWithMantine(
        <EmptyState
          icon={IconAlertTriangle}
          emoji="🎯"
          title="Test"
        />
      );

      // Should show emoji, not icon
      expect(screen.getByText('🎯')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('handles empty string messages gracefully', () => {
      renderWithMantine(
        <EmptyState
          title="No items"
          message=""
        />
      );

      expect(screen.getByText('No items')).toBeInTheDocument();
    });

    it('handles undefined hasActiveFilters', () => {
      renderWithMantine(
        <EmptyState
          title="No items"
          filteredMessage="Filtered"
          noDataMessage="No data"
        />
      );

      // Should default to false, showing noDataMessage
      expect(screen.getByText('No data')).toBeInTheDocument();
    });

    it('renders action button as any valid React node', () => {
      renderWithMantine(
        <EmptyState
          emoji="📦"
          title="Empty"
          hasActiveFilters={false}
          actionButton={<span data-testid="custom-action">Custom Action</span>}
        />
      );

      expect(screen.getByTestId('custom-action')).toBeInTheDocument();
    });
  });
});
