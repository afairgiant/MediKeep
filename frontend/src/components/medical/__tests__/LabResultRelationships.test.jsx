/**
 * @jest-environment jsdom
 */
import { vi } from 'vitest';
import render, { screen, waitFor } from '../../../test-utils/render';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import LabResultRelationships from '../LabResultRelationships';

vi.mock('../../../services/api', () => ({
  apiService: {
    getConditionLabResults: vi.fn(),
    createLabResultCondition: vi.fn(),
    updateLabResultCondition: vi.fn(),
    deleteLabResultCondition: vi.fn(),
  },
}));

vi.mock('../../../utils/linkNavigation', () => ({
  navigateToEntity: vi.fn(),
}));

vi.mock('@tabler/icons-react', () => ({
  IconInfoCircle: props => <span data-testid="icon-info" {...props} />,
  IconFlask: props => <span data-testid="icon-flask" {...props} />,
  IconPlus: props => <span data-testid="icon-plus" {...props} />,
  IconTrash: props => <span data-testid="icon-trash" {...props} />,
  IconEdit: props => <span data-testid="icon-edit" {...props} />,
  IconCheck: props => <span data-testid="icon-check" {...props} />,
  IconX: props => <span data-testid="icon-x" {...props} />,
}));

// Mantine MultiSelect needs scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

import { apiService } from '../../../services/api';
import { navigateToEntity } from '../../../utils/linkNavigation';

const mockRelationships = [
  {
    id: 1,
    lab_result_id: 101,
    condition_id: 5,
    relevance_note: 'Elevated glucose indicates poor control',
    lab_result: {
      id: 101,
      test_name: 'Fasting Glucose',
      test_category: 'blood work',
      status: 'completed',
      labs_result: 'abnormal',
      completed_date: '2024-06-01',
    },
  },
  {
    id: 2,
    lab_result_id: 102,
    condition_id: 5,
    relevance_note: null,
    lab_result: {
      id: 102,
      test_name: 'HbA1c',
      test_category: 'blood work',
      status: 'completed',
      labs_result: 'normal',
      completed_date: '2024-01-10',
    },
  },
];

const defaultProps = {
  conditionId: 5,
  navigate: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  apiService.getConditionLabResults.mockResolvedValue(mockRelationships);
});

describe('LabResultRelationships', () => {
  describe('Loading state', () => {
    it('shows a loading message while fetching', () => {
      // Keep the promise pending so the loading state is visible
      apiService.getConditionLabResults.mockReturnValue(new Promise(() => {}));

      render(<LabResultRelationships {...defaultProps} />);

      expect(screen.getByText('Loading lab results...')).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('shows the empty message when no lab results are linked', async () => {
      apiService.getConditionLabResults.mockResolvedValue([]);

      render(<LabResultRelationships {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText('No lab results linked to this condition')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Rendering linked lab results', () => {
    it('renders all linked lab results', async () => {
      render(<LabResultRelationships {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fasting Glucose')).toBeInTheDocument();
        expect(screen.getByText('HbA1c')).toBeInTheDocument();
      });
    });

    it('displays the labs_result badge', async () => {
      render(<LabResultRelationships {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('abnormal')).toBeInTheDocument();
        expect(screen.getByText('normal')).toBeInTheDocument();
      });
    });

    it('displays the status badge', async () => {
      render(<LabResultRelationships {...defaultProps} />);

      await waitFor(() => {
        const completedBadges = screen.getAllByText('completed');
        expect(completedBadges.length).toBeGreaterThan(0);
      });
    });

    it('displays the test category', async () => {
      render(<LabResultRelationships {...defaultProps} />);

      await waitFor(() => {
        const categoryLabels = screen.getAllByText('blood work');
        expect(categoryLabels.length).toBeGreaterThan(0);
      });
    });

    it('displays the relevance note when present', async () => {
      render(<LabResultRelationships {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText('Elevated glucose indicates poor control')
        ).toBeInTheDocument();
      });
    });

    it('does not render a relevance note section when relevance_note is null', async () => {
      apiService.getConditionLabResults.mockResolvedValue([
        {
          id: 1,
          lab_result_id: 101,
          condition_id: 5,
          relevance_note: null,
          lab_result: {
            id: 101,
            test_name: 'CBC',
            test_category: null,
            status: 'completed',
            labs_result: 'normal',
            completed_date: '2024-06-01',
          },
        },
      ]);

      render(<LabResultRelationships {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('CBC')).toBeInTheDocument();
      });
      // No italic relevance note text should be present
      expect(
        screen.queryByText(/Elevated|relevance|note/i)
      ).not.toBeInTheDocument();
    });
  });

  describe('API call', () => {
    it('fetches lab results for the given conditionId on mount', async () => {
      render(<LabResultRelationships {...defaultProps} />);

      await waitFor(() => {
        expect(apiService.getConditionLabResults).toHaveBeenCalledWith(
          5,
          expect.any(AbortSignal)
        );
      });
    });

    it('re-fetches when conditionId changes', async () => {
      const { rerender } = render(<LabResultRelationships {...defaultProps} />);

      await waitFor(() => {
        expect(apiService.getConditionLabResults).toHaveBeenCalledTimes(1);
      });

      rerender(<LabResultRelationships conditionId={99} navigate={vi.fn()} />);

      await waitFor(() => {
        expect(apiService.getConditionLabResults).toHaveBeenCalledWith(
          99,
          expect.any(AbortSignal)
        );
      });
    });
  });

  describe('Navigation', () => {
    it('calls navigateToEntity with lab_result type when a test name is clicked', async () => {
      render(<LabResultRelationships {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fasting Glucose')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Fasting Glucose'));

      expect(navigateToEntity).toHaveBeenCalledWith(
        'lab_result',
        101,
        defaultProps.navigate
      );
    });
  });

  describe('Error handling', () => {
    it('displays an error alert when the API call fails', async () => {
      apiService.getConditionLabResults.mockRejectedValue(
        new Error('Network error')
      );

      render(<LabResultRelationships {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('does not show an error when the request is aborted', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      apiService.getConditionLabResults.mockRejectedValue(abortError);

      render(<LabResultRelationships {...defaultProps} />);

      // Abort errors should be swallowed silently
      await waitFor(() => {
        expect(screen.queryByTestId('icon-info')).not.toBeInTheDocument();
      });
    });

    it('renders without crashing when lab_result is null on a relationship', async () => {
      apiService.getConditionLabResults.mockResolvedValue([
        {
          id: 1,
          lab_result_id: 999,
          condition_id: 5,
          relevance_note: null,
          lab_result: null,
        },
      ]);

      render(<LabResultRelationships {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Lab Result ID: 999')).toBeInTheDocument();
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Edit mode tests
// ---------------------------------------------------------------------------

const mockAvailableLabResults = [
  { id: 201, test_name: 'Lipid Panel', completed_date: '2024-09-01', status: 'completed' },
  { id: 202, test_name: 'Thyroid Panel', completed_date: null, status: 'ordered' },
];

const editModeProps = {
  conditionId: 5,
  navigate: vi.fn(),
  isViewMode: false,
  labResults: mockAvailableLabResults,
};

describe('LabResultRelationships – edit mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    apiService.getConditionLabResults.mockResolvedValue(mockRelationships);
    apiService.createLabResultCondition.mockResolvedValue({ id: 99 });
    apiService.updateLabResultCondition.mockResolvedValue({});
    apiService.deleteLabResultCondition.mockResolvedValue({});
  });

  describe('Edit / delete controls', () => {
    it('shows edit and delete action buttons for each relationship', async () => {
      render(<LabResultRelationships {...editModeProps} />);

      await waitFor(() => {
        expect(screen.getByText('Fasting Glucose')).toBeInTheDocument();
      });

      expect(screen.getAllByTestId('icon-edit').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('icon-trash').length).toBeGreaterThan(0);
    });

    it('does NOT show edit/delete buttons in view mode', async () => {
      render(<LabResultRelationships {...editModeProps} isViewMode={true} />);

      await waitFor(() => {
        expect(screen.getByText('Fasting Glucose')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('icon-edit')).not.toBeInTheDocument();
      expect(screen.queryByTestId('icon-trash')).not.toBeInTheDocument();
    });

    it('shows inline save/cancel buttons when edit is clicked', async () => {
      render(<LabResultRelationships {...editModeProps} />);

      await waitFor(() => {
        expect(screen.getAllByTestId('icon-edit')[0]).toBeInTheDocument();
      });

      await userEvent.click(screen.getAllByTestId('icon-edit')[0]);

      expect(screen.getByTestId('icon-check')).toBeInTheDocument();
      expect(screen.getByTestId('icon-x')).toBeInTheDocument();
    });

    it('calls updateLabResultCondition when save is confirmed', async () => {
      render(<LabResultRelationships {...editModeProps} />);

      await waitFor(() => {
        expect(screen.getAllByTestId('icon-edit')[0]).toBeInTheDocument();
      });

      await userEvent.click(screen.getAllByTestId('icon-edit')[0]);
      await userEvent.click(screen.getByTestId('icon-check'));

      await waitFor(() => {
        expect(apiService.updateLabResultCondition).toHaveBeenCalledWith(
          mockRelationships[0].lab_result_id,
          mockRelationships[0].id,
          expect.objectContaining({ relevance_note: expect.anything() })
        );
      });
    });

    it('cancels edit without calling update', async () => {
      render(<LabResultRelationships {...editModeProps} />);

      await waitFor(() => {
        expect(screen.getAllByTestId('icon-edit')[0]).toBeInTheDocument();
      });

      await userEvent.click(screen.getAllByTestId('icon-edit')[0]);
      await userEvent.click(screen.getByTestId('icon-x'));

      expect(screen.queryByTestId('icon-check')).not.toBeInTheDocument();
      expect(apiService.updateLabResultCondition).not.toHaveBeenCalled();
    });

    it('calls deleteLabResultCondition after confirm dialog', async () => {
      render(<LabResultRelationships {...editModeProps} />);

      await waitFor(() => {
        expect(screen.getAllByTestId('icon-trash')[0]).toBeInTheDocument();
      });

      await userEvent.click(screen.getAllByTestId('icon-trash')[0]);

      await waitFor(() => {
        expect(apiService.deleteLabResultCondition).toHaveBeenCalledWith(
          mockRelationships[0].lab_result_id,
          mockRelationships[0].id
        );
      });
    });

    it('skips delete when user cancels the confirm dialog', async () => {
      window.confirm = vi.fn(() => false);
      render(<LabResultRelationships {...editModeProps} />);

      await waitFor(() => {
        expect(screen.getAllByTestId('icon-trash')[0]).toBeInTheDocument();
      });

      await userEvent.click(screen.getAllByTestId('icon-trash')[0]);

      expect(apiService.deleteLabResultCondition).not.toHaveBeenCalled();
    });
  });

  describe('Add new relationship', () => {
    it('shows the Link Lab Result button in edit mode', async () => {
      render(<LabResultRelationships {...editModeProps} />);

      await waitFor(() => {
        expect(screen.getByText('Link Lab Result')).toBeInTheDocument();
      });
    });

    it('does NOT show the Link Lab Result button in view mode', async () => {
      render(<LabResultRelationships {...editModeProps} isViewMode={true} />);

      await waitFor(() => {
        expect(screen.queryByText('Link Lab Result')).not.toBeInTheDocument();
      });
    });

    it('opens the add modal when Link Lab Result is clicked', async () => {
      render(<LabResultRelationships {...editModeProps} />);

      await waitFor(() => {
        expect(screen.getByText('Link Lab Result')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Link Lab Result'));

      await waitFor(() => {
        expect(
          screen.getByText('Link Lab Results to Condition')
        ).toBeInTheDocument();
      });
    });

    it('Link button in modal is disabled until a lab result is selected', async () => {
      apiService.getConditionLabResults.mockResolvedValue([]);

      render(<LabResultRelationships {...editModeProps} />);

      await waitFor(() => {
        expect(screen.getByText('Link Lab Result')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Link Lab Result'));

      await waitFor(() => {
        expect(
          screen.getByText('Link Lab Results to Condition')
        ).toBeInTheDocument();
      });

      // The modal submit button is disabled when nothing is selected
      const allLinkButtons = screen
        .getAllByRole('button', { name: /link lab result/i });
      const disabledButton = allLinkButtons.find(btn => btn.disabled);
      expect(disabledButton).toBeDefined();
    });
  });
});
