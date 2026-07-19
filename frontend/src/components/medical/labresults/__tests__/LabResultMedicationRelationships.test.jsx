import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import render, {
  screen,
  waitFor,
} from '../../../../test-utils/render';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import LabResultMedicationRelationships from '../LabResultMedicationRelationships';

// Mock apiService
vi.mock('../../../../services/api', () => ({
  apiService: {
    createLabResultMedication: vi.fn(() =>
      Promise.resolve({
        id: 10,
        medication_id: 2,
        relevance_note: '',
      })
    ),
    updateLabResultMedication: vi.fn(() => Promise.resolve()),
    deleteLabResultMedication: vi.fn(() => Promise.resolve()),
  },
}));

// Mock @tabler/icons-react
vi.mock('@tabler/icons-react', () => ({
  IconPlus: props => <span data-testid="icon-plus" {...props} />,
  IconTrash: props => <span data-testid="icon-trash" {...props} />,
  IconEdit: props => <span data-testid="icon-edit" {...props} />,
  IconCheck: props => <span data-testid="icon-check" {...props} />,
  IconX: props => <span data-testid="icon-x" {...props} />,
  IconPill: props => <span data-testid="icon-pill" {...props} />,
  IconInfoCircle: props => <span data-testid="icon-info" {...props} />,
}));

// Mock scrollIntoView for Mantine Select
Element.prototype.scrollIntoView = vi.fn();

describe('LabResultMedicationRelationships Component', () => {
  const mockMedications = [
    { id: 1, medication_name: 'Metformin', dosage: '500mg' },
    { id: 2, medication_name: 'Lisinopril', dosage: '10mg' },
    { id: 3, medication_name: 'Atorvastatin', dosage: '20mg' },
  ];

  const mockRelationships = [
    {
      id: 201,
      medication_id: 1,
      medication: { id: 1, medication_name: 'Metformin', dosage: '500mg' },
      relevance_note: 'Ordered to monitor kidney function',
    },
  ];

  const mockFetchLabResultMedications = vi.fn(() => Promise.resolve());
  const mockNavigate = vi.fn();

  const defaultProps = {
    labResultId: 42,
    labResultMedications: { 42: mockRelationships },
    medications: mockMedications,
    fetchLabResultMedications: mockFetchLabResultMedications,
    navigate: mockNavigate,
    isViewMode: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  describe('Rendering', () => {
    it('should render linked medications with name', () => {
      render(<LabResultMedicationRelationships {...defaultProps} />);

      expect(screen.getByText('Metformin')).toBeInTheDocument();
    });

    it('should show empty state when no relationships exist', () => {
      const propsNoRelationships = {
        ...defaultProps,
        labResultMedications: { 42: [] },
      };
      render(<LabResultMedicationRelationships {...propsNoRelationships} />);

      expect(
        screen.getByText('No medications linked to this lab result')
      ).toBeInTheDocument();
    });

    it('should show Add button in edit mode when available medications exist', () => {
      render(<LabResultMedicationRelationships {...defaultProps} />);

      expect(screen.getByText('Link Medication')).toBeInTheDocument();
    });

    it('should not show Add button in view mode', () => {
      render(
        <LabResultMedicationRelationships
          {...defaultProps}
          isViewMode={true}
        />
      );

      expect(screen.queryByText('Link Medication')).not.toBeInTheDocument();
    });

    it('should display relevance note when present', () => {
      render(<LabResultMedicationRelationships {...defaultProps} />);

      expect(
        screen.getByText('Ordered to monitor kidney function')
      ).toBeInTheDocument();
    });

    it('should show no relevance note message when note is empty in edit mode', () => {
      const propsNoNote = {
        ...defaultProps,
        labResultMedications: {
          42: [
            {
              id: 201,
              medication_id: 1,
              medication: { id: 1, medication_name: 'Metformin' },
              relevance_note: null,
            },
          ],
        },
      };
      render(<LabResultMedicationRelationships {...propsNoNote} />);

      expect(
        screen.getByText('No relevance note provided')
      ).toBeInTheDocument();
    });

    it('should show fallback text when medication details are missing', () => {
      const propsNoDetails = {
        ...defaultProps,
        labResultMedications: {
          42: [
            {
              id: 201,
              medication_id: 1,
              medication: null,
              relevance_note: null,
            },
          ],
        },
      };
      render(<LabResultMedicationRelationships {...propsNoDetails} />);

      expect(screen.getByText('Medication #1')).toBeInTheDocument();
    });
  });

  describe('View Mode', () => {
    it('should not show edit or delete buttons in view mode', () => {
      render(
        <LabResultMedicationRelationships
          {...defaultProps}
          isViewMode={true}
        />
      );

      expect(screen.queryByTestId('icon-edit')).not.toBeInTheDocument();
      expect(screen.queryByTestId('icon-trash')).not.toBeInTheDocument();
    });

    it('should navigate when medication name is clicked in view mode', async () => {
      render(
        <LabResultMedicationRelationships
          {...defaultProps}
          isViewMode={true}
        />
      );

      const medicationLink = screen.getByText('Metformin');
      await userEvent.click(medicationLink);

      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('Edit Mode', () => {
    it('should show edit and delete action buttons in edit mode', () => {
      render(<LabResultMedicationRelationships {...defaultProps} />);

      expect(screen.getByTestId('icon-edit')).toBeInTheDocument();
      expect(screen.getByTestId('icon-trash')).toBeInTheDocument();
    });

    it('should not show Add button when all medications are already linked', () => {
      const allLinkedProps = {
        ...defaultProps,
        labResultMedications: {
          42: mockMedications.map((med, i) => ({
            id: 200 + i,
            medication_id: med.id,
            medication: med,
            relevance_note: null,
          })),
        },
      };
      render(<LabResultMedicationRelationships {...allLinkedProps} />);

      expect(screen.queryByText('Link Medication')).not.toBeInTheDocument();
    });
  });

  describe('Modal Functionality', () => {
    it('should open modal when Add button is clicked', async () => {
      render(<LabResultMedicationRelationships {...defaultProps} />);

      const addButton = screen.getByText('Link Medication');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(
          screen.getByText('Link Medication to Lab Result')
        ).toBeInTheDocument();
      });
    });

    it('should display cancel button in modal', async () => {
      render(<LabResultMedicationRelationships {...defaultProps} />);

      const addButton = screen.getByText('Link Medication');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading', () => {
    it('should call fetchLabResultMedications on mount', () => {
      render(<LabResultMedicationRelationships {...defaultProps} />);

      expect(mockFetchLabResultMedications).toHaveBeenCalledWith(42);
    });

    it('should handle missing labResultMedications key gracefully', () => {
      const propsEmpty = {
        ...defaultProps,
        labResultMedications: {},
      };

      expect(() => {
        render(<LabResultMedicationRelationships {...propsEmpty} />);
      }).not.toThrow();

      expect(
        screen.getByText('No medications linked to this lab result')
      ).toBeInTheDocument();
    });

    it('should handle empty medications array gracefully', () => {
      expect(() => {
        render(
          <LabResultMedicationRelationships
            {...defaultProps}
            medications={[]}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should render without errors with valid props', () => {
      expect(() => {
        render(<LabResultMedicationRelationships {...defaultProps} />);
      }).not.toThrow();
    });

    it('should render without errors in view mode', () => {
      expect(() => {
        render(
          <LabResultMedicationRelationships
            {...defaultProps}
            isViewMode={true}
          />
        );
      }).not.toThrow();
    });
  });
});
