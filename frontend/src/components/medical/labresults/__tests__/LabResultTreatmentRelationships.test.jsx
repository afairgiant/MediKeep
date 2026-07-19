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
import LabResultTreatmentRelationships from '../LabResultTreatmentRelationships';

// Mock apiService
vi.mock('../../../../services/api', () => ({
  apiService: {
    createLabResultTreatment: vi.fn(() =>
      Promise.resolve({
        id: 10,
        treatment_id: 2,
        purpose: 'monitoring',
        expected_frequency: null,
        relevance_note: '',
      })
    ),
    updateLabResultTreatment: vi.fn(() => Promise.resolve()),
    deleteLabResultTreatment: vi.fn(() => Promise.resolve()),
  },
}));

// Mock @tabler/icons-react
vi.mock('@tabler/icons-react', () => ({
  IconPlus: props => <span data-testid="icon-plus" {...props} />,
  IconTrash: props => <span data-testid="icon-trash" {...props} />,
  IconEdit: props => <span data-testid="icon-edit" {...props} />,
  IconCheck: props => <span data-testid="icon-check" {...props} />,
  IconX: props => <span data-testid="icon-x" {...props} />,
  IconClipboardHeart: props => (
    <span data-testid="icon-clipboard-heart" {...props} />
  ),
  IconInfoCircle: props => <span data-testid="icon-info" {...props} />,
}));

// Mock scrollIntoView for Mantine Select
Element.prototype.scrollIntoView = vi.fn();

describe('LabResultTreatmentRelationships Component', () => {
  const mockTreatments = [
    { id: 1, treatment_name: 'Physical Therapy' },
    { id: 2, treatment_name: 'Chemotherapy' },
    { id: 3, treatment_name: 'Insulin Therapy' },
  ];

  const mockRelationships = [
    {
      id: 201,
      treatment_id: 1,
      treatment: { id: 1, treatment_name: 'Physical Therapy' },
      purpose: 'baseline',
      expected_frequency: 'Monthly',
      relevance_note: 'Baseline labs before starting therapy',
    },
  ];

  const mockFetchLabResultTreatments = vi.fn(() => Promise.resolve());
  const mockNavigate = vi.fn();

  const defaultProps = {
    labResultId: 42,
    labResultTreatments: { 42: mockRelationships },
    treatments: mockTreatments,
    fetchLabResultTreatments: mockFetchLabResultTreatments,
    navigate: mockNavigate,
    isViewMode: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  describe('Rendering', () => {
    it('should render linked treatments with name', () => {
      render(<LabResultTreatmentRelationships {...defaultProps} />);

      expect(screen.getByText('Physical Therapy')).toBeInTheDocument();
    });

    it('should show empty state when no relationships exist', () => {
      const propsNoRelationships = {
        ...defaultProps,
        labResultTreatments: { 42: [] },
      };
      render(<LabResultTreatmentRelationships {...propsNoRelationships} />);

      expect(
        screen.getByText('No treatments linked to this lab result')
      ).toBeInTheDocument();
    });

    it('should show purpose badge for linked relationships', () => {
      render(<LabResultTreatmentRelationships {...defaultProps} />);

      expect(screen.getByText('Baseline')).toBeInTheDocument();
    });

    it('should show expected frequency when present', () => {
      render(<LabResultTreatmentRelationships {...defaultProps} />);

      expect(screen.getByText(/Monthly/)).toBeInTheDocument();
    });

    it('should show Add button in edit mode when available treatments exist', () => {
      render(<LabResultTreatmentRelationships {...defaultProps} />);

      expect(screen.getByText('Link Treatment')).toBeInTheDocument();
    });

    it('should not show Add button in view mode', () => {
      render(
        <LabResultTreatmentRelationships {...defaultProps} isViewMode={true} />
      );

      expect(screen.queryByText('Link Treatment')).not.toBeInTheDocument();
    });

    it('should display relevance note when present', () => {
      render(<LabResultTreatmentRelationships {...defaultProps} />);

      expect(
        screen.getByText('Baseline labs before starting therapy')
      ).toBeInTheDocument();
    });

    it('should show fallback text when treatment details are missing', () => {
      const propsNoDetails = {
        ...defaultProps,
        labResultTreatments: {
          42: [
            {
              id: 201,
              treatment_id: 1,
              treatment: null,
              purpose: null,
              expected_frequency: null,
              relevance_note: null,
            },
          ],
        },
      };
      render(<LabResultTreatmentRelationships {...propsNoDetails} />);

      expect(screen.getByText('Treatment #1')).toBeInTheDocument();
    });
  });

  describe('View Mode', () => {
    it('should not show edit or delete buttons in view mode', () => {
      render(
        <LabResultTreatmentRelationships {...defaultProps} isViewMode={true} />
      );

      expect(screen.queryByTestId('icon-edit')).not.toBeInTheDocument();
      expect(screen.queryByTestId('icon-trash')).not.toBeInTheDocument();
    });

    it('should navigate when treatment name is clicked in view mode', async () => {
      render(
        <LabResultTreatmentRelationships {...defaultProps} isViewMode={true} />
      );

      const treatmentLink = screen.getByText('Physical Therapy');
      await userEvent.click(treatmentLink);

      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('Edit Mode', () => {
    it('should show edit and delete action buttons in edit mode', () => {
      render(<LabResultTreatmentRelationships {...defaultProps} />);

      expect(screen.getByTestId('icon-edit')).toBeInTheDocument();
      expect(screen.getByTestId('icon-trash')).toBeInTheDocument();
    });

    it('should not show Add button when all treatments are already linked', () => {
      const allLinkedProps = {
        ...defaultProps,
        labResultTreatments: {
          42: mockTreatments.map((tr, i) => ({
            id: 200 + i,
            treatment_id: tr.id,
            treatment: tr,
            purpose: null,
            expected_frequency: null,
            relevance_note: null,
          })),
        },
      };
      render(<LabResultTreatmentRelationships {...allLinkedProps} />);

      expect(screen.queryByText('Link Treatment')).not.toBeInTheDocument();
    });
  });

  describe('Modal Functionality', () => {
    it('should open modal when Add button is clicked', async () => {
      render(<LabResultTreatmentRelationships {...defaultProps} />);

      const addButton = screen.getByText('Link Treatment');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(
          screen.getByText('Link Treatment to Lab Result')
        ).toBeInTheDocument();
      });
    });

    it('should display cancel button in modal', async () => {
      render(<LabResultTreatmentRelationships {...defaultProps} />);

      const addButton = screen.getByText('Link Treatment');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading', () => {
    it('should call fetchLabResultTreatments on mount', () => {
      render(<LabResultTreatmentRelationships {...defaultProps} />);

      expect(mockFetchLabResultTreatments).toHaveBeenCalledWith(42);
    });

    it('should handle missing labResultTreatments key gracefully', () => {
      const propsEmpty = {
        ...defaultProps,
        labResultTreatments: {},
      };

      expect(() => {
        render(<LabResultTreatmentRelationships {...propsEmpty} />);
      }).not.toThrow();

      expect(
        screen.getByText('No treatments linked to this lab result')
      ).toBeInTheDocument();
    });

    it('should handle empty treatments array gracefully', () => {
      expect(() => {
        render(
          <LabResultTreatmentRelationships {...defaultProps} treatments={[]} />
        );
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should render without errors with valid props', () => {
      expect(() => {
        render(<LabResultTreatmentRelationships {...defaultProps} />);
      }).not.toThrow();
    });

    it('should render without errors in view mode', () => {
      expect(() => {
        render(
          <LabResultTreatmentRelationships
            {...defaultProps}
            isViewMode={true}
          />
        );
      }).not.toThrow();
    });
  });
});
