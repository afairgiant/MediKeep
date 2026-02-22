import { vi } from 'vitest';
import render, { screen, waitFor } from '../../../test-utils/render';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MedicationRelationships from '../MedicationRelationships';

// --- Mocked API functions (hoisted so vi.mock factories can reference them) ---
const {
  mockGetMedicationConditions,
  mockCreateConditionMedication,
  mockDeleteConditionMedication,
  mockUpdateConditionMedication,
  mockGetCondition,
} = vi.hoisted(() => ({
  mockGetMedicationConditions: vi.fn(),
  mockCreateConditionMedication: vi.fn(),
  mockDeleteConditionMedication: vi.fn(),
  mockUpdateConditionMedication: vi.fn(),
  mockGetCondition: vi.fn(),
}));

vi.mock('../../../services/api', () => ({
  apiService: {
    getMedicationConditions: mockGetMedicationConditions,
    createConditionMedication: mockCreateConditionMedication,
    deleteConditionMedication: mockDeleteConditionMedication,
    updateConditionMedication: mockUpdateConditionMedication,
    getCondition: mockGetCondition,
  },
}));

vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../utils/linkNavigation', () => ({
  navigateToEntity: vi.fn(),
}));

vi.mock('@tabler/icons-react', () => ({
  IconStethoscope: (props) => <span data-testid="icon-stethoscope" {...props} />,
  IconInfoCircle: (props) => <span data-testid="icon-info" {...props} />,
  IconPlus: (props) => <span data-testid="icon-plus" {...props} />,
  IconTrash: (props) => <span data-testid="icon-trash" {...props} />,
  IconEdit: (props) => <span data-testid="icon-edit" {...props} />,
  IconCheck: (props) => <span data-testid="icon-check" {...props} />,
  IconX: (props) => <span data-testid="icon-x" {...props} />,
  IconPill: (props) => <span data-testid="icon-pill" {...props} />,
}));

// Needed for Mantine Select/MultiSelect
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
  direction: 'medication',
  medicationId: 10,
  conditions: mockConditions,
  navigate: vi.fn(),
  isViewMode: false,
};

// In the test environment, i18n returns translation keys (e.g. 'buttons.linkCondition')
// rather than the English fallback. Use these constants for assertions.
const I18N = {
  noLinked: 'labels.noConditionsLinkedToMedication',
  linkCondition: 'buttons.linkCondition',
  linkConditions: 'buttons.linkConditions',
  availableToLink: 'labels.conditionsAvailableToLink',
  modalTitle: 'modals.linkConditionsToMedication',
  selectConditions: 'modals.selectConditions',
  cancel: 'buttons.cancel',
  confirmRemove: 'messages.confirmRemoveConditionRelationship',
};

// Wait for relationships to load, then click the Link Condition button to open the modal
async function openAddModal() {
  await waitFor(() => {
    expect(screen.getByText(I18N.linkCondition)).toBeInTheDocument();
  });

  const linkButtons = screen.getAllByText(I18N.linkCondition);
  const enabledBtn = linkButtons.find((btn) => !btn.disabled && btn.tagName === 'BUTTON');
  await userEvent.click(enabledBtn || linkButtons[0]);

  await waitFor(() => {
    expect(screen.getByText(I18N.modalTitle)).toBeInTheDocument();
  });
}

// ============================================================
// Tests
// ============================================================

describe('MedicationRelationships (direction="medication")', () => {
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
      render(<MedicationRelationships {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
      });
    });

    it('shows related condition name', async () => {
      render(<MedicationRelationships {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
      });
    });

    it('shows condition status badge', async () => {
      render(<MedicationRelationships {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('active')).toBeInTheDocument();
      });
    });

    it('shows condition severity badge', async () => {
      render(<MedicationRelationships {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('moderate')).toBeInTheDocument();
      });
    });

    it('shows empty message when no conditions are linked', async () => {
      mockGetMedicationConditions.mockResolvedValue([]);
      render(<MedicationRelationships {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(I18N.noLinked)).toBeInTheDocument();
      });
    });

    it('shows Link Condition button when not isViewMode and conditions are available', async () => {
      render(<MedicationRelationships {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(I18N.linkCondition)).toBeInTheDocument();
      });
    });

    it('shows available count text element', async () => {
      render(<MedicationRelationships {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(I18N.availableToLink)).toBeInTheDocument();
      });
    });
  });

  // ----------------------------------------------------------
  // Data loading
  // ----------------------------------------------------------
  describe('Data loading', () => {
    it('fetches medication conditions on mount', async () => {
      render(<MedicationRelationships {...defaultProps} />);
      await waitFor(() => {
        expect(mockGetMedicationConditions).toHaveBeenCalledWith(10);
      });
    });

    it('does not fetch when medicationId is not provided', () => {
      render(<MedicationRelationships {...defaultProps} medicationId={null} />);
      expect(mockGetMedicationConditions).not.toHaveBeenCalled();
    });

    it('fetches individual condition details for relationships missing condition data', async () => {
      const relWithoutCondition = [
        { id: 102, condition_id: 2, medication_id: 10 },
      ];
      mockGetMedicationConditions.mockResolvedValue(relWithoutCondition);
      mockGetCondition.mockResolvedValue({
        id: 2,
        diagnosis: 'Diabetes',
        status: 'chronic',
        severity: 'moderate',
      });

      render(<MedicationRelationships {...defaultProps} />);
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

      render(<MedicationRelationships {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(/Deleted Condition/)).toBeInTheDocument();
      });
    });

    it('shows error message when fetch fails', async () => {
      mockGetMedicationConditions.mockRejectedValue(new Error('Network error'));
      render(<MedicationRelationships {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });
  });

  // ----------------------------------------------------------
  // isViewMode
  // ----------------------------------------------------------
  describe('isViewMode', () => {
    it('does not show Link Condition button in isViewMode', async () => {
      render(<MedicationRelationships {...defaultProps} isViewMode={true} />);
      await waitFor(() => {
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
      });
      expect(screen.queryByText(I18N.linkCondition)).not.toBeInTheDocument();
    });

    it('does not show delete (trash) icon in isViewMode', async () => {
      render(<MedicationRelationships {...defaultProps} isViewMode={true} />);
      await waitFor(() => {
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('icon-trash')).not.toBeInTheDocument();
    });

    it('does not show edit icon in isViewMode', async () => {
      render(<MedicationRelationships {...defaultProps} isViewMode={true} />);
      await waitFor(() => {
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('icon-edit')).not.toBeInTheDocument();
    });

    it('shows condition name in isViewMode', async () => {
      render(<MedicationRelationships {...defaultProps} isViewMode={true} />);
      await waitFor(() => {
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
      });
    });
  });

  // ----------------------------------------------------------
  // Edit mode (isViewMode=false)
  // ----------------------------------------------------------
  describe('Edit mode', () => {
    it('shows delete icon for each linked condition', async () => {
      render(<MedicationRelationships {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('icon-trash')).toBeInTheDocument();
      });
    });

    it('shows edit icon for each linked condition', async () => {
      render(<MedicationRelationships {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByTestId('icon-edit')).toBeInTheDocument();
      });
    });

    it('shows Link Condition button', async () => {
      render(<MedicationRelationships {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(I18N.linkCondition)).toBeInTheDocument();
      });
    });

    it('disables Link Condition button when all conditions are already linked', async () => {
      mockGetMedicationConditions.mockResolvedValue(
        mockConditions.map((c, i) => ({
          id: 200 + i,
          condition_id: c.id,
          medication_id: 10,
          condition: c,
        }))
      );

      render(<MedicationRelationships {...defaultProps} />);
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
      render(<MedicationRelationships {...defaultProps} />);
      await openAddModal();

      expect(screen.getByText(I18N.modalTitle)).toBeInTheDocument();
    });

    it('shows Select Conditions label in modal', async () => {
      render(<MedicationRelationships {...defaultProps} />);
      await openAddModal();

      expect(screen.getByText(I18N.selectConditions)).toBeInTheDocument();
    });

    it('shows Cancel button in modal', async () => {
      render(<MedicationRelationships {...defaultProps} />);
      await openAddModal();

      expect(screen.getByText(I18N.cancel)).toBeInTheDocument();
    });

    it('closes modal when Cancel is clicked', async () => {
      render(<MedicationRelationships {...defaultProps} />);
      await openAddModal();

      await userEvent.click(screen.getByText(I18N.cancel));

      await waitFor(() => {
        expect(screen.queryByText(I18N.modalTitle)).not.toBeInTheDocument();
      });
    });
  });

  // ----------------------------------------------------------
  // handleAddRelationship
  // ----------------------------------------------------------
  describe('handleAddRelationship', () => {
    it('does not call createConditionMedication without a selection', async () => {
      mockCreateConditionMedication.mockResolvedValue({});
      render(<MedicationRelationships {...defaultProps} />);
      await openAddModal();

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

      render(<MedicationRelationships {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('icon-trash')).toBeInTheDocument();
      });

      const trashBtn = screen.getByTestId('icon-trash').closest('button');
      await userEvent.click(trashBtn);

      await waitFor(() => {
        expect(mockDeleteConditionMedication).toHaveBeenCalledWith(
          1,   // condition_id from the relationship
          101  // relationship id
        );
      });
    });

    it('does not call deleteConditionMedication when user cancels confirm', async () => {
      window.confirm = vi.fn(() => false);

      render(<MedicationRelationships {...defaultProps} />);

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

      render(<MedicationRelationships {...defaultProps} />);

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

      render(<MedicationRelationships {...defaultProps} />);

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
      render(<MedicationRelationships {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
      });
      expect(screen.getByText(I18N.availableToLink)).toBeInTheDocument();
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

      render(<MedicationRelationships {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: I18N.linkCondition })).toBeDisabled();
    });

    it('enables Link Condition button when no conditions are yet linked', async () => {
      mockGetMedicationConditions.mockResolvedValue([]);

      render(<MedicationRelationships {...defaultProps} />);
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
        <MedicationRelationships
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
