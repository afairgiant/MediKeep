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
import LabResultEncounterRelationships from '../LabResultEncounterRelationships';

// Mock apiService
vi.mock('../../../../services/api', () => ({
  apiService: {
    createLabResultEncounter: vi.fn(() =>
      Promise.resolve({
        id: 10,
        encounter_id: 2,
        purpose: 'results_reviewed',
        relevance_note: '',
      })
    ),
    updateLabResultEncounter: vi.fn(() => Promise.resolve()),
    deleteLabResultEncounter: vi.fn(() => Promise.resolve()),
  },
}));

// Mock @tabler/icons-react
vi.mock('@tabler/icons-react', () => ({
  IconPlus: props => <span data-testid="icon-plus" {...props} />,
  IconTrash: props => <span data-testid="icon-trash" {...props} />,
  IconEdit: props => <span data-testid="icon-edit" {...props} />,
  IconCheck: props => <span data-testid="icon-check" {...props} />,
  IconX: props => <span data-testid="icon-x" {...props} />,
  IconStethoscope: props => <span data-testid="icon-stethoscope" {...props} />,
  IconInfoCircle: props => <span data-testid="icon-info" {...props} />,
}));

// Mock scrollIntoView for Mantine Select/MultiSelect
Element.prototype.scrollIntoView = vi.fn();

describe('LabResultEncounterRelationships Component', () => {
  const mockEncounters = [
    {
      id: 1,
      reason: 'Annual checkup',
      date: '2025-01-15',
      visit_type: 'routine',
    },
    {
      id: 2,
      reason: 'Follow-up visit',
      date: '2025-02-20',
      visit_type: 'follow-up',
    },
    { id: 3, reason: 'Urgent care', date: '2025-03-05', visit_type: 'urgent' },
  ];

  const mockRelationships = [
    {
      id: 201,
      encounter_id: 1,
      encounter_reason: 'Annual checkup',
      encounter_date: '2025-01-15',
      purpose: 'results_reviewed',
      relevance_note: 'Results discussed at visit',
    },
  ];

  const mockFetchLabResultEncounters = vi.fn(() => Promise.resolve());
  const mockNavigate = vi.fn();

  const defaultProps = {
    labResultId: 42,
    labResultEncounters: { 42: mockRelationships },
    encounters: mockEncounters,
    fetchLabResultEncounters: mockFetchLabResultEncounters,
    navigate: mockNavigate,
    isViewMode: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  describe('Rendering', () => {
    it('should render linked encounters with reason', () => {
      render(<LabResultEncounterRelationships {...defaultProps} />);

      expect(screen.getByText('Annual checkup')).toBeInTheDocument();
    });

    it('should show empty state when no relationships exist', () => {
      const propsNoRelationships = {
        ...defaultProps,
        labResultEncounters: { 42: [] },
      };
      render(<LabResultEncounterRelationships {...propsNoRelationships} />);

      expect(
        screen.getByText('No visits linked to this lab result')
      ).toBeInTheDocument();
    });

    it('should show purpose badge for linked relationships', () => {
      render(<LabResultEncounterRelationships {...defaultProps} />);

      expect(screen.getByText('Results Reviewed')).toBeInTheDocument();
    });

    it('should show Add button in edit mode when available encounters exist', () => {
      render(<LabResultEncounterRelationships {...defaultProps} />);

      expect(screen.getByText('Link Visit')).toBeInTheDocument();
    });

    it('should not show Add button in view mode', () => {
      render(
        <LabResultEncounterRelationships {...defaultProps} isViewMode={true} />
      );

      expect(screen.queryByText('Link Visit')).not.toBeInTheDocument();
    });

    it('should display relevance note when present', () => {
      render(<LabResultEncounterRelationships {...defaultProps} />);

      expect(
        screen.getByText('Results discussed at visit')
      ).toBeInTheDocument();
    });

    it('should show no relevance note message when note is empty in edit mode', () => {
      const propsNoNote = {
        ...defaultProps,
        labResultEncounters: {
          42: [
            {
              id: 201,
              encounter_id: 1,
              encounter_reason: 'Annual checkup',
              encounter_date: '2025-01-15',
              purpose: 'results_reviewed',
              relevance_note: null,
            },
          ],
        },
      };
      render(<LabResultEncounterRelationships {...propsNoNote} />);

      expect(
        screen.getByText('No relevance note provided')
      ).toBeInTheDocument();
    });

    it('should show fallback text when encounter has no reason', () => {
      const propsNoReason = {
        ...defaultProps,
        labResultEncounters: {
          42: [
            {
              id: 201,
              encounter_id: 1,
              encounter_reason: null,
              encounter_date: '2025-01-15',
              purpose: 'ordered_during',
              relevance_note: null,
            },
          ],
        },
      };
      render(<LabResultEncounterRelationships {...propsNoReason} />);

      expect(screen.getByText('Visit #1')).toBeInTheDocument();
    });
  });

  describe('View Mode', () => {
    it('should not show edit or delete buttons in view mode', () => {
      render(
        <LabResultEncounterRelationships {...defaultProps} isViewMode={true} />
      );

      expect(screen.queryByTestId('icon-edit')).not.toBeInTheDocument();
      expect(screen.queryByTestId('icon-trash')).not.toBeInTheDocument();
    });

    it('should navigate when encounter reason is clicked in view mode', async () => {
      render(
        <LabResultEncounterRelationships {...defaultProps} isViewMode={true} />
      );

      const encounterLink = screen.getByText('Annual checkup');
      await userEvent.click(encounterLink);

      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('Edit Mode', () => {
    it('should show edit and delete action buttons in edit mode', () => {
      render(<LabResultEncounterRelationships {...defaultProps} />);

      expect(screen.getByTestId('icon-edit')).toBeInTheDocument();
      expect(screen.getByTestId('icon-trash')).toBeInTheDocument();
    });

    it('should not show Add button when all encounters are already linked', () => {
      const allLinkedProps = {
        ...defaultProps,
        labResultEncounters: {
          42: mockEncounters.map((enc, i) => ({
            id: 200 + i,
            encounter_id: enc.id,
            encounter_reason: enc.reason,
            encounter_date: enc.date,
            purpose: null,
            relevance_note: null,
          })),
        },
      };
      render(<LabResultEncounterRelationships {...allLinkedProps} />);

      expect(screen.queryByText('Link Visit')).not.toBeInTheDocument();
    });
  });

  describe('Modal Functionality', () => {
    it('should open modal when Add button is clicked', async () => {
      render(<LabResultEncounterRelationships {...defaultProps} />);

      const addButton = screen.getByText('Link Visit');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(
          screen.getByText('Link Visit to Lab Result')
        ).toBeInTheDocument();
      });
    });

    it('should display cancel button in modal', async () => {
      render(<LabResultEncounterRelationships {...defaultProps} />);

      const addButton = screen.getByText('Link Visit');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading', () => {
    it('should call fetchLabResultEncounters on mount', () => {
      render(<LabResultEncounterRelationships {...defaultProps} />);

      expect(mockFetchLabResultEncounters).toHaveBeenCalledWith(42);
    });

    it('should handle missing labResultEncounters key gracefully', () => {
      const propsEmpty = {
        ...defaultProps,
        labResultEncounters: {},
      };

      expect(() => {
        render(<LabResultEncounterRelationships {...propsEmpty} />);
      }).not.toThrow();

      expect(
        screen.getByText('No visits linked to this lab result')
      ).toBeInTheDocument();
    });

    it('should handle empty encounters array gracefully', () => {
      expect(() => {
        render(
          <LabResultEncounterRelationships {...defaultProps} encounters={[]} />
        );
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should render without errors with valid props', () => {
      expect(() => {
        render(<LabResultEncounterRelationships {...defaultProps} />);
      }).not.toThrow();
    });

    it('should render without errors in view mode', () => {
      expect(() => {
        render(
          <LabResultEncounterRelationships
            {...defaultProps}
            isViewMode={true}
          />
        );
      }).not.toThrow();
    });
  });
});
