import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MedicalPageActions from './MedicalPageActions';

// Mock Mantine components to avoid MantineProvider requirement
vi.mock('@mantine/core', () => ({
  Group: ({ children, ...props }) => <div data-testid="mantine-group" {...props}>{children}</div>,
  Button: ({ children, onClick, disabled, leftSection, ...props }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {leftSection}
      {children}
    </button>
  ),
}));

// Mock ViewToggle component
vi.mock('./ViewToggle', () => ({
  default: ({ viewMode, onViewModeChange, showPrint }) => (
    <div data-testid="view-toggle">
      <span data-testid="view-mode">{viewMode}</span>
      <button
        data-testid="toggle-cards"
        onClick={() => onViewModeChange('cards')}
      >
        Cards
      </button>
      <button
        data-testid="toggle-table"
        onClick={() => onViewModeChange('table')}
      >
        Table
      </button>
      {showPrint && <span data-testid="print-enabled">Print</span>}
    </div>
  ),
}));

describe('MedicalPageActions', () => {
  describe('Primary Action', () => {
    it('renders primary action button with label', () => {
      const onClick = vi.fn();

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Add New Allergy',
            onClick,
          }}
          showViewToggle={false}
        />
      );

      expect(screen.getByText('Add New Allergy')).toBeInTheDocument();
    });

    it('calls onClick when primary action is clicked', () => {
      const onClick = vi.fn();

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Add New Item',
            onClick,
          }}
          showViewToggle={false}
        />
      );

      fireEvent.click(screen.getByText('Add New Item'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('renders primary action with leftSection icon', () => {
      const onClick = vi.fn();
      const Icon = () => <span data-testid="plus-icon">+</span>;

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Add Item',
            onClick,
            leftSection: <Icon />,
          }}
          showViewToggle={false}
        />
      );

      expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
    });

    it('does not render primary action when visible is false', () => {
      const onClick = vi.fn();

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Hidden Button',
            onClick,
            visible: false,
          }}
          showViewToggle={false}
        />
      );

      expect(screen.queryByText('Hidden Button')).not.toBeInTheDocument();
    });

    it('renders disabled primary action when disabled is true', () => {
      const onClick = vi.fn();

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Disabled Button',
            onClick,
            disabled: true,
          }}
          showViewToggle={false}
        />
      );

      const button = screen.getByText('Disabled Button');
      expect(button).toBeDisabled();
    });
  });

  describe('Secondary Actions', () => {
    it('renders secondary action buttons', () => {
      const primaryClick = vi.fn();
      const secondaryClick = vi.fn();

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Primary',
            onClick: primaryClick,
          }}
          secondaryActions={[
            {
              label: 'Quick Import',
              onClick: secondaryClick,
            },
          ]}
          showViewToggle={false}
        />
      );

      expect(screen.getByText('Primary')).toBeInTheDocument();
      expect(screen.getByText('Quick Import')).toBeInTheDocument();
    });

    it('renders multiple secondary actions', () => {
      const onClick = vi.fn();

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Primary',
            onClick,
          }}
          secondaryActions={[
            { label: 'Action 1', onClick },
            { label: 'Action 2', onClick },
            { label: 'Action 3', onClick },
          ]}
          showViewToggle={false}
        />
      );

      expect(screen.getByText('Action 1')).toBeInTheDocument();
      expect(screen.getByText('Action 2')).toBeInTheDocument();
      expect(screen.getByText('Action 3')).toBeInTheDocument();
    });

    it('filters out secondary actions with visible: false', () => {
      const onClick = vi.fn();

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Primary',
            onClick,
          }}
          secondaryActions={[
            { label: 'Visible Action', onClick, visible: true },
            { label: 'Hidden Action', onClick, visible: false },
          ]}
          showViewToggle={false}
        />
      );

      expect(screen.getByText('Visible Action')).toBeInTheDocument();
      expect(screen.queryByText('Hidden Action')).not.toBeInTheDocument();
    });

    it('calls secondary action onClick when clicked', () => {
      const primaryClick = vi.fn();
      const secondaryClick = vi.fn();

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Primary',
            onClick: primaryClick,
          }}
          secondaryActions={[
            {
              label: 'Secondary',
              onClick: secondaryClick,
            },
          ]}
          showViewToggle={false}
        />
      );

      fireEvent.click(screen.getByText('Secondary'));
      expect(secondaryClick).toHaveBeenCalledTimes(1);
      expect(primaryClick).not.toHaveBeenCalled();
    });
  });

  describe('ViewToggle', () => {
    it('renders ViewToggle when viewMode and onViewModeChange are provided', () => {
      const onClick = vi.fn();
      const onViewModeChange = vi.fn();

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Add Item',
            onClick,
          }}
          viewMode="cards"
          onViewModeChange={onViewModeChange}
        />
      );

      expect(screen.getByTestId('view-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('view-mode')).toHaveTextContent('cards');
    });

    it('does not render ViewToggle when showViewToggle is false', () => {
      const onClick = vi.fn();
      const onViewModeChange = vi.fn();

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Add Item',
            onClick,
          }}
          viewMode="cards"
          onViewModeChange={onViewModeChange}
          showViewToggle={false}
        />
      );

      expect(screen.queryByTestId('view-toggle')).not.toBeInTheDocument();
    });

    it('does not render ViewToggle when viewMode is not provided', () => {
      const onClick = vi.fn();
      const onViewModeChange = vi.fn();

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Add Item',
            onClick,
          }}
          onViewModeChange={onViewModeChange}
        />
      );

      expect(screen.queryByTestId('view-toggle')).not.toBeInTheDocument();
    });

    it('does not render ViewToggle when onViewModeChange is not provided', () => {
      const onClick = vi.fn();

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Add Item',
            onClick,
          }}
          viewMode="cards"
        />
      );

      expect(screen.queryByTestId('view-toggle')).not.toBeInTheDocument();
    });

    it('calls onViewModeChange when ViewToggle is clicked', () => {
      const onClick = vi.fn();
      const onViewModeChange = vi.fn();

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Add Item',
            onClick,
          }}
          viewMode="cards"
          onViewModeChange={onViewModeChange}
        />
      );

      fireEvent.click(screen.getByTestId('toggle-table'));
      expect(onViewModeChange).toHaveBeenCalledWith('table');
    });

    it('passes showPrint prop to ViewToggle', () => {
      const onClick = vi.fn();
      const onViewModeChange = vi.fn();

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Add Item',
            onClick,
          }}
          viewMode="cards"
          onViewModeChange={onViewModeChange}
          showPrint={true}
        />
      );

      expect(screen.getByTestId('print-enabled')).toBeInTheDocument();
    });

    it('does not show print when showPrint is false', () => {
      const onClick = vi.fn();
      const onViewModeChange = vi.fn();

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Add Item',
            onClick,
          }}
          viewMode="cards"
          onViewModeChange={onViewModeChange}
          showPrint={false}
        />
      );

      expect(screen.queryByTestId('print-enabled')).not.toBeInTheDocument();
    });
  });

  describe('Children', () => {
    it('renders children in the left section', () => {
      const onClick = vi.fn();

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Add Item',
            onClick,
          }}
          showViewToggle={false}
        >
          <span data-testid="custom-child">Custom Content</span>
        </MedicalPageActions>
      );

      expect(screen.getByTestId('custom-child')).toBeInTheDocument();
    });

    it('renders children alongside buttons', () => {
      const onClick = vi.fn();

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Add Item',
            onClick,
          }}
          secondaryActions={[
            { label: 'Secondary', onClick },
          ]}
          showViewToggle={false}
        >
          <span data-testid="custom-child">Custom</span>
        </MedicalPageActions>
      );

      expect(screen.getByText('Add Item')).toBeInTheDocument();
      expect(screen.getByText('Secondary')).toBeInTheDocument();
      expect(screen.getByTestId('custom-child')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('returns null when primary action is hidden and no secondary actions', () => {
      const onClick = vi.fn();

      const { container } = render(
        <MedicalPageActions
          primaryAction={{
            label: 'Hidden',
            onClick,
            visible: false,
          }}
          showViewToggle={false}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders when primary is hidden but secondary actions exist', () => {
      const onClick = vi.fn();

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Hidden Primary',
            onClick,
            visible: false,
          }}
          secondaryActions={[
            { label: 'Visible Secondary', onClick },
          ]}
          showViewToggle={false}
        />
      );

      expect(screen.queryByText('Hidden Primary')).not.toBeInTheDocument();
      expect(screen.getByText('Visible Secondary')).toBeInTheDocument();
    });

    it('renders when primary is hidden but ViewToggle should show', () => {
      const onClick = vi.fn();
      const onViewModeChange = vi.fn();

      render(
        <MedicalPageActions
          primaryAction={{
            label: 'Hidden Primary',
            onClick,
            visible: false,
          }}
          viewMode="cards"
          onViewModeChange={onViewModeChange}
        />
      );

      expect(screen.queryByText('Hidden Primary')).not.toBeInTheDocument();
      expect(screen.getByTestId('view-toggle')).toBeInTheDocument();
    });
  });
});
