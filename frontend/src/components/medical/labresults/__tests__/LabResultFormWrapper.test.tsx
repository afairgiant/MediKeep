import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import render, { screen, fireEvent } from '../../../../test-utils/render';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import LabResultFormWrapper from '../LabResultFormWrapper';

// Paths are relative to this test file (src/components/medical/labresults/__tests__/)

vi.mock('../InlineTestComponentEntry', () => ({
  default: ({ onRef }) => {
    if (onRef) onRef({ getComponents: () => [] });
    return <div data-testid="inline-test-component" />;
  },
}));
vi.mock('../../../shared/DocumentManagerWithProgress', () => ({
  default: () => <div data-testid="document-manager" />,
}));
vi.mock('../../ConditionRelationships', () => ({
  default: () => <div data-testid="condition-relationships" />,
}));
vi.mock('../LabResultEncounterRelationships', () => ({
  default: () => <div data-testid="encounter-relationships" />,
}));

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    dateInputFormat: 'MM/DD/YYYY',
    dateParser: s => new Date(s),
  }),
}));
vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));


const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  title: 'Add Lab Result',
  formData: {
    test_name: '',
    test_code: '',
    test_category: '',
    test_type: '',
    facility: '',
    practitioner_id: '',
    ordered_date: '',
    completed_date: '',
    status: '',
    labs_result: '',
    notes: '',
    tags: [],
  },
  onInputChange: vi.fn(),
  onSubmit: vi.fn(),
  editingItem: null,
  practitioners: [{ id: 1, name: 'Dr. Smith', specialty: 'Internal Medicine' }],
};

describe('LabResultFormWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Info tab (default)', () => {
    test('renders the form when open', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      expect(screen.getByText('Add Lab Result')).toBeInTheDocument();
    });

    test('does not render when closed', () => {
      render(<LabResultFormWrapper {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Add Lab Result')).not.toBeInTheDocument();
    });

    test('shows Ordered Date on the Basic Info tab without switching tabs', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      // Basic Info is the default active tab — dates must be immediately visible
      expect(screen.getByText('shared:labels.orderedDate')).toBeInTheDocument();
    });

    test('shows Completed Date on the Basic Info tab without switching tabs', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      expect(
        screen.getByText('shared:labels.completedDate')
      ).toBeInTheDocument();
    });

    test('shows Tags field on the Basic Info tab', () => {
      render(<LabResultFormWrapper {...defaultProps} />);
      // Use getAllByText since "tags" may appear in multiple places (e.g. navigation)
      const tagLabels = screen.getAllByText('shared:labels.tags');
      expect(tagLabels.length).toBeGreaterThan(0);
    });
  });

  describe('Results & Status tab', () => {
    // Helper: find the Results & Status tab by its exact i18n key text
    function getResultsTab() {
      return screen.getByRole('tab', { name: 'labresults:tabs.resultsStatus' });
    }

    test('shows Status and Lab Result selects', () => {
      render(<LabResultFormWrapper {...defaultProps} />);

      fireEvent.click(getResultsTab());

      expect(
        screen.getByText('labresults:testStatus.label')
      ).toBeInTheDocument();
      expect(screen.getByText('shared:labels.labResult')).toBeInTheDocument();
    });

    test('Ordered Date and Completed Date are not visible on Results & Status tab', () => {
      render(<LabResultFormWrapper {...defaultProps} />);

      fireEvent.click(getResultsTab());

      // Mantine keeps all panels mounted but hides inactive ones with CSS
      const orderedLabel = screen.queryByText('shared:labels.orderedDate');
      const completedLabel = screen.queryByText('shared:labels.completedDate');
      if (orderedLabel) expect(orderedLabel).not.toBeVisible();
      if (completedLabel) expect(completedLabel).not.toBeVisible();
    });
  });

  describe('Form submission', () => {
    test('calls onClose when Cancel is clicked', async () => {
      const mockClose = vi.fn();
      render(<LabResultFormWrapper {...defaultProps} onClose={mockClose} />);

      // i18n keys are rendered as-is in the test environment
      const cancelButton = screen.getByRole('button', {
        name: 'shared:fields.cancel',
      });
      await userEvent.click(cancelButton);

      expect(mockClose).toHaveBeenCalled();
    });

    test('Submit button is disabled when test_name is empty', () => {
      render(<LabResultFormWrapper {...defaultProps} />);

      // Button text: "common:buttons.create shared:categories.lab_results"
      const submitButtons = screen.getAllByRole('button');
      const submitButton = submitButtons.find(btn =>
        btn.textContent.includes('common:buttons.create')
      );
      expect(submitButton).toBeDefined();
      expect(submitButton).toBeDisabled();
    });

    test('Submit button is enabled when test_name is provided', () => {
      render(
        <LabResultFormWrapper
          {...defaultProps}
          formData={{ ...defaultProps.formData, test_name: 'CBC' }}
        />
      );

      const submitButtons = screen.getAllByRole('button');
      const submitButton = submitButtons.find(btn =>
        btn.textContent.includes('common:buttons.create')
      );
      expect(submitButton).toBeDefined();
      expect(submitButton).not.toBeDisabled();
    });
  });
});
