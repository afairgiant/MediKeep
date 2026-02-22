import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import React from 'react';
import render, { screen, fireEvent, waitFor } from '../../../test-utils/render';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ConditionRelationshipsForMedication from '../ConditionRelationshipsForMedication';

// --- Mocked API functions (hoisted so vi.mock factories can reference them) ---
const {
  mockGetMedicationConditions,
  mockCreateConditionMedication,
  mockDeleteConditionMedication,
  mockGetCondition,
} = vi.hoisted(() => ({
  mockGetMedicationConditions: vi.fn(),
  mockCreateConditionMedication: vi.fn(),
  mockDeleteConditionMedication: vi.fn(),
  mockGetCondition: vi.fn(),
}));

vi.mock('../../../services/api', () => ({
  apiService: {
    getMedicationConditions: mockGetMedicationConditions,
    createConditionMedication: mockCreateConditionMedication,
    deleteConditionMedication: mockDeleteConditionMedication,
    getCondition: mockGetCondition,
  },
}));

vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../utils/linkNavigation', () => ({
  navigateToEntity: vi.fn(),
}));

// Mock Tabler icons
vi.mock('@tabler/icons-react', () => ({
  IconStethoscope: (props) => <span data-testid="icon-stethoscope" {...props} />,
  IconInfoCircle: (props) => <span data-testid="icon-info" {...props} />,
  IconPlus: (props) => <span data-testid="icon-plus" {...props} />,
  IconTrash: (props) => <span data-testid="icon-trash" {...props} />,
}));

// Needed for Mantine Select
Element.prototype.scrollIntoView = vi.fn();

// ============================================================
// Test data
// ============================================================

const mockConditions = [
  { id: 1, diagnosis: 'Hypertension', status: 'active', severity: 'moderate' },
  { id: 2, diagnosis: 'Diabetes', status: 'chronic', severity: 'moderate' },
  { id: 3, diagnosis: 'Asthma', status: 'resolved', severity: 'mild' },
];

const mockRelationships = [
  {
    id: 101,
    condition_id: 1,
    medication_id: 10,
    condition: { id: 1, diagnosis: 'Hypertension', status: 'active', severity: 'moderate' },
  },
];

const defaultProps = {
  medicationId: 10,
  conditions: mockConditions,
  navigate: vi.fn(),
  viewOnly: false,
};

// In the test environment, i18n returns translation keys (e.g. 'buttons.linkCondition')
// rather than the English fallback. Use these constants for assertions.
const I18N = {
  noLinked: 'medications.conditions.noLinked',
  linkCondition: 'buttons.linkCondition',
  availableToLink: 'medications.conditions.availableToLink',
  linkToMedication: 'medications.conditions.linkToMedication',
  selectCondition: 'medications.conditions.selectCondition',
  cancel: 'buttons.cancel',
};

// ============================================================
// Tests
// ============================================================

describe('ConditionRelationshipsForMedication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    mockGetMedicationConditions.mockResolvedValue(mockRelationships);
  });

  // ----------------------------------------------------------
  // Rendering
  // ----------------------------------------------------------
  describe('Rendering', () => {
    it('renders without crashing', async () => {
      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
      });
    });

    it('shows related condition name', async () => {
      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
      });
    });

    it('shows condition status badge', async () => {
      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('active')).toBeInTheDocument();
      });
    });

    it('shows condition severity badge', async () => {
      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('moderate')).toBeInTheDocument();
      });
    });

    it('shows empty message when no conditions are linked', async () => {
      mockGetMedicationConditions.mockResolvedValue([]);
      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(I18N.noLinked)).toBeInTheDocument();
      });
    });

    it('shows Link Condition button when not viewOnly and conditions are available', async () => {
      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(I18N.linkCondition)).toBeInTheDocument();
      });
    });

    it('shows available count text element', async () => {
      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        // The available count text uses i18n key
        expect(screen.getByText(I18N.availableToLink)).toBeInTheDocument();
      });
    });
  });

  // ----------------------------------------------------------
  // Data loading
  // ----------------------------------------------------------
  describe('Data loading', () => {
    it('fetches medication conditions on mount', async () => {
      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(mockGetMedicationConditions).toHaveBeenCalledWith(10);
      });
    });

    it('does not fetch when medicationId is not provided', () => {
      render(<ConditionRelationshipsForMedication {...defaultProps} medicationId={null} />);
      expect(mockGetMedicationConditions).not.toHaveBeenCalled();
    });

    it('fetches individual condition details for relationships missing condition data', async () => {
      const relWithoutCondition = [
        { id: 102, condition_id: 2, medication_id: 10 }, // no `condition` property
      ];
      mockGetMedicationConditions.mockResolvedValue(relWithoutCondition);
      mockGetCondition.mockResolvedValue({
        id: 2,
        diagnosis: 'Diabetes',
        status: 'chronic',
        severity: 'moderate',
      });

      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(mockGetCondition).toHaveBeenCalledWith(2);
        expect(screen.getByText('Diabetes')).toBeInTheDocument();
      });
    });

    it('shows orphaned condition label when condition fetch fails', async () => {
      const relWithoutCondition = [
        { id: 103, condition_id: 99, medication_id: 10 },
      ];
      mockGetMedicationConditions.mockResolvedValue(relWithoutCondition);
      mockGetCondition.mockRejectedValue(new Error('Not found'));

      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(/Deleted Condition/)).toBeInTheDocument();
      });
    });

    it('shows error message when fetch fails', async () => {
      mockGetMedicationConditions.mockRejectedValue(new Error('Network error'));
      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(
          screen.getByText(/failed to load related conditions/i)
        ).toBeInTheDocument();
      });
    });
  });

  // ----------------------------------------------------------
  // viewOnly mode
  // ----------------------------------------------------------
  describe('viewOnly mode', () => {
    it('does not show Link Condition button in viewOnly mode', async () => {
      render(<ConditionRelationshipsForMedication {...defaultProps} viewOnly={true} />);
      await waitFor(() => {
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
      });
      expect(screen.queryByText(I18N.linkCondition)).not.toBeInTheDocument();
    });

    it('does not show delete (trash) icon in viewOnly mode', async () => {
      render(<ConditionRelationshipsForMedication {...defaultProps} viewOnly={true} />);
      await waitFor(() => {
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('icon-trash')).not.toBeInTheDocument();
    });

    it('shows condition name in viewOnly mode', async () => {
      render(<ConditionRelationshipsForMedication {...defaultProps} viewOnly={true} />);
      await waitFor(() => {
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
      });
    });
  });

  // ----------------------------------------------------------
  // Edit mode (viewOnly=false)
  // ----------------------------------------------------------
  describe('Edit mode', () => {
    it('shows delete icon for each linked condition', async () => {
      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('icon-trash')).toBeInTheDocument();
      });
    });

    it('shows Link Condition button', async () => {
      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(I18N.linkCondition)).toBeInTheDocument();
      });
    });

    it('disables Link Condition button when all conditions are already linked', async () => {
      // All 3 conditions are linked
      mockGetMedicationConditions.mockResolvedValue(
        mockConditions.map((c, i) => ({
          id: 200 + i,
          condition_id: c.id,
          medication_id: 10,
          condition: c,
        }))
      );

      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: I18N.linkCondition })).toBeDisabled();
      });
    });
  });

  // ----------------------------------------------------------
  // Add relationship modal
  // ----------------------------------------------------------
  describe('Add relationship modal', () => {
    it('opens modal when Link Condition button is clicked', async () => {
      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(I18N.linkCondition)).toBeInTheDocument();
      });

      // Click the Link Condition button (not disabled)
      const linkButtons = screen.getAllByText(I18N.linkCondition);
      const enabledBtn = linkButtons.find((btn) => !btn.disabled && btn.tagName === 'BUTTON');
      await userEvent.click(enabledBtn || linkButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(I18N.linkToMedication)).toBeInTheDocument();
      });
    });

    it('shows Select Condition label in modal', async () => {
      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(I18N.linkCondition)).toBeInTheDocument();
      });

      const linkButtons = screen.getAllByText(I18N.linkCondition);
      const enabledBtn = linkButtons.find((btn) => !btn.disabled && btn.tagName === 'BUTTON');
      await userEvent.click(enabledBtn || linkButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(I18N.selectCondition)).toBeInTheDocument();
      });
    });

    it('shows Cancel button in modal', async () => {
      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(I18N.linkCondition)).toBeInTheDocument();
      });

      const linkButtons = screen.getAllByText(I18N.linkCondition);
      const enabledBtn = linkButtons.find((btn) => !btn.disabled && btn.tagName === 'BUTTON');
      await userEvent.click(enabledBtn || linkButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(I18N.cancel)).toBeInTheDocument();
      });
    });

    it('closes modal when Cancel is clicked', async () => {
      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(I18N.linkCondition)).toBeInTheDocument();
      });

      const linkButtons = screen.getAllByText(I18N.linkCondition);
      const enabledBtn = linkButtons.find((btn) => !btn.disabled && btn.tagName === 'BUTTON');
      await userEvent.click(enabledBtn || linkButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(I18N.cancel)).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText(I18N.cancel));

      await waitFor(() => {
        expect(screen.queryByText(I18N.linkToMedication)).not.toBeInTheDocument();
      });
    });
  });

  // ----------------------------------------------------------
  // handleAddRelationship
  // ----------------------------------------------------------
  describe('handleAddRelationship', () => {
    it('does not call createConditionMedication without a selection', async () => {
      mockCreateConditionMedication.mockResolvedValue({});
      render(<ConditionRelationshipsForMedication {...defaultProps} />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
      });

      // Open modal
      const linkButtons = screen.getAllByText(I18N.linkCondition);
      const enabledBtn = linkButtons.find((btn) => !btn.disabled && btn.tagName === 'BUTTON');
      await userEvent.click(enabledBtn || linkButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(I18N.linkToMedication)).toBeInTheDocument();
      });

      // createConditionMedication should not be called yet (no condition selected)
      expect(mockCreateConditionMedication).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // handleDeleteRelationship
  // ----------------------------------------------------------
  describe('handleDeleteRelationship', () => {
    it('calls deleteConditionMedication after confirm', async () => {
      mockDeleteConditionMedication.mockResolvedValue({});
      mockGetMedicationConditions
        .mockResolvedValueOnce(mockRelationships)
        .mockResolvedValueOnce([]);

      render(<ConditionRelationshipsForMedication {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('icon-trash')).toBeInTheDocument();
      });

      const trashBtn = screen.getByTestId('icon-trash').closest('button');
      await userEvent.click(trashBtn);

      await waitFor(() => {
        expect(mockDeleteConditionMedication).toHaveBeenCalledWith(
          1,   // condition_id
          101  // relationship id
        );
      });
    });

    it('does not call deleteConditionMedication when user cancels confirm', async () => {
      window.confirm = vi.fn(() => false);

      render(<ConditionRelationshipsForMedication {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('icon-trash')).toBeInTheDocument();
      });

      const trashBtn = screen.getByTestId('icon-trash').closest('button');
      await userEvent.click(trashBtn);

      expect(mockDeleteConditionMedication).not.toHaveBeenCalled();
    });

    it('shows error alert when deleteConditionMedication fails', async () => {
      mockDeleteConditionMedication.mockRejectedValue(
        Object.assign(new Error('Delete failed'), {
          response: { data: { detail: 'Cannot delete' } },
        })
      );

      render(<ConditionRelationshipsForMedication {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('icon-trash')).toBeInTheDocument();
      });

      const trashBtn = screen.getByTestId('icon-trash').closest('button');
      await userEvent.click(trashBtn);

      await waitFor(() => {
        expect(screen.getByText('Cannot delete')).toBeInTheDocument();
      });
    });

    it('re-fetches relationships after successful delete', async () => {
      mockDeleteConditionMedication.mockResolvedValue({});
      mockGetMedicationConditions
        .mockResolvedValueOnce(mockRelationships)
        .mockResolvedValueOnce([]);

      render(<ConditionRelationshipsForMedication {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('icon-trash')).toBeInTheDocument();
      });

      const trashBtn = screen.getByTestId('icon-trash').closest('button');
      await userEvent.click(trashBtn);

      await waitFor(() => {
        // Should have been called twice: once on mount, once after delete
        expect(mockGetMedicationConditions).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ----------------------------------------------------------
  // Condition option filtering
  // ----------------------------------------------------------
  describe('Condition option filtering', () => {
    it('excludes already-linked conditions from available count', async () => {
      // condition id=1 is already linked, so 2 remain available (Diabetes, Asthma)
      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
      });
      // Available count text element should be present
      expect(screen.getByText(I18N.availableToLink)).toBeInTheDocument();
      // Button should be enabled because there are still conditions to link
      expect(screen.getByText(I18N.linkCondition)).not.toBeDisabled();
    });

    it('disables Link Condition button when all conditions linked', async () => {
      mockGetMedicationConditions.mockResolvedValue(
        mockConditions.map((c, i) => ({
          id: 200 + i,
          condition_id: c.id,
          medication_id: 10,
          condition: c,
        }))
      );

      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: I18N.linkCondition })).toBeDisabled();
    });

    it('enables Link Condition button when no conditions are yet linked', async () => {
      mockGetMedicationConditions.mockResolvedValue([]);

      render(<ConditionRelationshipsForMedication {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(I18N.noLinked)).toBeInTheDocument();
      });
      expect(screen.getByText(I18N.linkCondition)).not.toBeDisabled();
    });
  });

  // ----------------------------------------------------------
  // Navigation
  // ----------------------------------------------------------
  describe('Navigation', () => {
    it('calls navigateToEntity when condition name is clicked', async () => {
      const { navigateToEntity } = await import('../../../utils/linkNavigation');
      const mockNavigate = vi.fn();

      render(
        <ConditionRelationshipsForMedication
          {...defaultProps}
          navigate={mockNavigate}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Hypertension'));

      expect(navigateToEntity).toHaveBeenCalledWith('condition', 1, mockNavigate);
    });
  });
});
