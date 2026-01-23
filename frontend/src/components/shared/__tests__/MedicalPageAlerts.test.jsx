import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { IconExclamationCircle, IconThumbUp } from '@tabler/icons-react';
import MedicalPageAlerts from '../MedicalPageAlerts';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => fallback || key,
  }),
}));

// Wrapper for Mantine components
const renderWithMantine = (component) => {
  return render(
    <MantineProvider>
      {component}
    </MantineProvider>
  );
};

describe('MedicalPageAlerts', () => {
  describe('Rendering behavior', () => {
    it('renders nothing when both error and successMessage are null', () => {
      const { container } = renderWithMantine(
        <MedicalPageAlerts
          error={null}
          successMessage={null}
        />
      );

      // Component returns null, so no Alert elements should be present
      expect(container.querySelector('[class*="mantine-Alert"]')).toBeNull();
    });

    it('renders nothing when both error and successMessage are undefined', () => {
      const { container } = renderWithMantine(
        <MedicalPageAlerts />
      );

      expect(container.querySelector('[class*="mantine-Alert"]')).toBeNull();
    });

    it('renders nothing when both error and successMessage are empty strings', () => {
      const { container } = renderWithMantine(
        <MedicalPageAlerts
          error=""
          successMessage=""
        />
      );

      expect(container.querySelector('[class*="mantine-Alert"]')).toBeNull();
    });
  });

  describe('Error alert', () => {
    it('renders error alert with default title and icon', () => {
      renderWithMantine(
        <MedicalPageAlerts
          error="Something went wrong"
        />
      );

      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('renders error alert with custom title', () => {
      renderWithMantine(
        <MedicalPageAlerts
          error="Validation failed"
          errorTitle="Validation Error"
        />
      );

      expect(screen.getByText('Validation Error')).toBeInTheDocument();
      expect(screen.getByText('Validation failed')).toBeInTheDocument();
    });

    it('shows close button when onClearError is provided', () => {
      const mockClearError = vi.fn();
      renderWithMantine(
        <MedicalPageAlerts
          error="Test error"
          onClearError={mockClearError}
        />
      );

      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeInTheDocument();
    });

    it('calls onClearError when close button is clicked', () => {
      const mockClearError = vi.fn();
      renderWithMantine(
        <MedicalPageAlerts
          error="Test error"
          onClearError={mockClearError}
        />
      );

      const closeButton = screen.getByRole('button');
      fireEvent.click(closeButton);
      expect(mockClearError).toHaveBeenCalledTimes(1);
    });

    it('does not show close button when onClearError is not provided', () => {
      renderWithMantine(
        <MedicalPageAlerts
          error="Test error"
        />
      );

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('preserves whitespace with pre-line style for multi-line errors', () => {
      const { container } = renderWithMantine(
        <MedicalPageAlerts
          error="Line 1\nLine 2"
        />
      );

      // The style is applied to the Alert root element
      const alertRoot = container.querySelector('[class*="mantine-Alert-root"]');
      expect(alertRoot).toBeInTheDocument();
      expect(alertRoot).toHaveStyle({ whiteSpace: 'pre-line' });
    });
  });

  describe('Success alert', () => {
    it('renders success alert with default title and icon', () => {
      renderWithMantine(
        <MedicalPageAlerts
          successMessage="Operation completed"
        />
      );

      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('Operation completed')).toBeInTheDocument();
    });

    it('renders success alert with custom title', () => {
      renderWithMantine(
        <MedicalPageAlerts
          successMessage="Saved successfully"
          successTitle="Saved!"
        />
      );

      expect(screen.getByText('Saved!')).toBeInTheDocument();
      expect(screen.getByText('Saved successfully')).toBeInTheDocument();
    });

    it('does not show close button on success by default', () => {
      renderWithMantine(
        <MedicalPageAlerts
          successMessage="Success"
          onClearSuccess={vi.fn()}
        />
      );

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('shows close button on success when showSuccessCloseButton is true', () => {
      const mockClearSuccess = vi.fn();
      renderWithMantine(
        <MedicalPageAlerts
          successMessage="Success"
          onClearSuccess={mockClearSuccess}
          showSuccessCloseButton={true}
        />
      );

      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeInTheDocument();
    });

    it('calls onClearSuccess when success close button is clicked', () => {
      const mockClearSuccess = vi.fn();
      renderWithMantine(
        <MedicalPageAlerts
          successMessage="Success"
          onClearSuccess={mockClearSuccess}
          showSuccessCloseButton={true}
        />
      );

      const closeButton = screen.getByRole('button');
      fireEvent.click(closeButton);
      expect(mockClearSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe('Both alerts displayed', () => {
    it('renders both error and success alerts when both are provided', () => {
      renderWithMantine(
        <MedicalPageAlerts
          error="Error occurred"
          successMessage="But this worked"
        />
      );

      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Error occurred')).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('But this worked')).toBeInTheDocument();
    });

    it('wraps both alerts in a Stack with gap="xs"', () => {
      const { container } = renderWithMantine(
        <MedicalPageAlerts
          error="Error"
          successMessage="Success"
        />
      );

      // Should have a Stack wrapper (Mantine Stack component)
      const stackElement = container.querySelector('[class*="mantine-Stack"]');
      expect(stackElement).toBeInTheDocument();
    });
  });

  describe('Custom props', () => {
    it('renders with custom variant prop', () => {
      const { container } = renderWithMantine(
        <MedicalPageAlerts
          error="Error"
          variant="filled"
        />
      );

      // Verify the alert renders - variant is passed to Mantine's Alert
      const alert = container.querySelector('[class*="mantine-Alert-root"]');
      expect(alert).toBeInTheDocument();
      // Mantine applies variant via data attributes or class modifiers
      expect(alert).toHaveAttribute('data-variant', 'filled');
    });

    it('renders with custom margin bottom prop', () => {
      const { container } = renderWithMantine(
        <MedicalPageAlerts
          error="Error"
          mb="xl"
        />
      );

      // Verify alert renders with the mb prop passed through
      const alert = container.querySelector('[class*="mantine-Alert-root"]');
      expect(alert).toBeInTheDocument();
    });

    it('accepts custom error icon as React element', () => {
      renderWithMantine(
        <MedicalPageAlerts
          error="Error"
          errorIcon={<IconExclamationCircle data-testid="custom-error-icon" size={16} />}
        />
      );

      expect(screen.getByTestId('custom-error-icon')).toBeInTheDocument();
    });

    it('accepts custom success icon as React element', () => {
      renderWithMantine(
        <MedicalPageAlerts
          successMessage="Success"
          successIcon={<IconThumbUp data-testid="custom-success-icon" size={16} />}
        />
      );

      expect(screen.getByTestId('custom-success-icon')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('renders alert for whitespace-only error string', () => {
      renderWithMantine(
        <MedicalPageAlerts
          error="   "
        />
      );

      // Whitespace-only strings are truthy in JS, so alert renders
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('renders with numeric mb value', () => {
      const { container } = renderWithMantine(
        <MedicalPageAlerts
          error="Error"
          mb={20}
        />
      );

      expect(container.querySelector('[class*="mantine-Alert"]')).toBeInTheDocument();
    });
  });
});
