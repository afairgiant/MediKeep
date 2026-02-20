import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import React from 'react';
import render, { screen, fireEvent, waitFor } from '../../../test-utils/render';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ConditionRelationships from '../ConditionRelationships';

// Mock apiService
vi.mock('../../../services/api', () => ({
  apiService: {
    createLabResultCondition: vi.fn(() => Promise.resolve({ id: 10, condition_id: 2, relevance_note: '' })),
    updateLabResultCondition: vi.fn(() => Promise.resolve()),
    deleteLabResultCondition: vi.fn(() => Promise.resolve()),
  },
}));

// Mock @tabler/icons-react
vi.mock('@tabler/icons-react', () => ({
  IconPlus: (props) => <span data-testid="icon-plus" {...props} />,
  IconTrash: (props) => <span data-testid="icon-trash" {...props} />,
  IconEdit: (props) => <span data-testid="icon-edit" {...props} />,
  IconCheck: (props) => <span data-testid="icon-check" {...props} />,
  IconX: (props) => <span data-testid="icon-x" {...props} />,
  IconStethoscope: (props) => <span data-testid="icon-stethoscope" {...props} />,
  IconInfoCircle: (props) => <span data-testid="icon-info" {...props} />,
}));

// Mock scrollIntoView for Mantine Select/MultiSelect
Element.prototype.scrollIntoView = vi.fn();

describe('ConditionRelationships Component', () => {
  const mockConditions = [
    { id: 1, diagnosis: 'Hypertension', status: 'active', severity: 'moderate' },
    { id: 2, diagnosis: 'Diabetes', status: 'chronic', severity: 'moderate' },
    { id: 3, diagnosis: 'Asthma', status: 'resolved', severity: 'mild' },
  ];

  const mockRelationships = [
    {
      id: 101,
      condition_id: 1,
      condition: { id: 1, diagnosis: 'Hypertension', status: 'active' },
      relevance_note: 'Elevated blood pressure readings',
    },
  ];

  const mockFetchLabResultConditions = vi.fn(() => Promise.resolve());
  const mockNavigate = vi.fn();

  const defaultProps = {
    labResultId: 42,
    labResultConditions: { 42: mockRelationships },
    conditions: mockConditions,
    fetchLabResultConditions: mockFetchLabResultConditions,
    navigate: mockNavigate,
    isViewMode: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.confirm mock
    window.confirm = vi.fn(() => true);
  });

  describe('Rendering', () => {
    it('should render linked conditions', () => {
      render(<ConditionRelationships {...defaultProps} />);

      // Should display condition diagnosis
      expect(screen.getByText('Hypertension')).toBeInTheDocument();
    });

    it('should display linked condition with relevance note', () => {
      render(<ConditionRelationships {...defaultProps} />);

      expect(screen.getByText('Hypertension')).toBeInTheDocument();
      expect(screen.getByText('Elevated blood pressure readings')).toBeInTheDocument();
    });

    it('should show condition status badge', () => {
      render(<ConditionRelationships {...defaultProps} />);

      expect(screen.getByText('active')).toBeInTheDocument();
    });

    it('should show message when no conditions linked', () => {
      const propsNoRelationships = {
        ...defaultProps,
        labResultConditions: { 42: [] },
      };
      render(<ConditionRelationships {...propsNoRelationships} />);

      expect(screen.getByText('labels.noConditionsLinked')).toBeInTheDocument();
    });

    it('should show link condition button', () => {
      render(<ConditionRelationships {...defaultProps} />);

      expect(screen.getByText('buttons.linkCondition')).toBeInTheDocument();
    });

    it('should not show link button when no available conditions', () => {
      // All conditions are already linked
      const propsAllLinked = {
        ...defaultProps,
        labResultConditions: {
          42: mockConditions.map((c, i) => ({
            id: 100 + i,
            condition_id: c.id,
            condition: c,
            relevance_note: '',
          })),
        },
      };
      render(<ConditionRelationships {...propsAllLinked} />);

      expect(screen.queryByText('buttons.linkCondition')).not.toBeInTheDocument();
    });
  });

  describe('Modal Functionality', () => {
    it('should open modal when link condition button clicked', async () => {
      render(<ConditionRelationships {...defaultProps} />);

      const linkButton = screen.getByText('buttons.linkCondition');
      await userEvent.click(linkButton);

      await waitFor(() => {
        expect(screen.getByText('modals.linkConditionToLabResult')).toBeInTheDocument();
      });
    });

    it('should display cancel button in modal', async () => {
      render(<ConditionRelationships {...defaultProps} />);

      const linkButton = screen.getByText('buttons.linkCondition');
      await userEvent.click(linkButton);

      await waitFor(() => {
        expect(screen.getByText('buttons.cancel')).toBeInTheDocument();
      });
    });

    it('should show relevance note textarea in modal', async () => {
      render(<ConditionRelationships {...defaultProps} />);

      const linkButton = screen.getByText('buttons.linkCondition');
      await userEvent.click(linkButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/modals\.relevanceNote/)).toBeInTheDocument();
      });
    });

    it('should show condition select label in modal', async () => {
      render(<ConditionRelationships {...defaultProps} />);

      const linkButton = screen.getByText('buttons.linkCondition');
      await userEvent.click(linkButton);

      await waitFor(() => {
        expect(screen.getByText('modals.selectCondition')).toBeInTheDocument();
      });
    });
  });

  describe('View Mode', () => {
    it('should show condition as clickable text in view mode', () => {
      render(<ConditionRelationships {...defaultProps} isViewMode={true} />);

      expect(screen.getByText('Hypertension')).toBeInTheDocument();
    });

    it('should not show edit/delete buttons in view mode', () => {
      render(<ConditionRelationships {...defaultProps} isViewMode={true} />);

      expect(screen.queryByTestId('icon-edit')).not.toBeInTheDocument();
      expect(screen.queryByTestId('icon-trash')).not.toBeInTheDocument();
    });

    it('should not show link button in view mode', () => {
      render(<ConditionRelationships {...defaultProps} isViewMode={true} />);

      // In view mode, the "Link Condition" button should not appear
      // because !isViewMode is a condition in the JSX
      const buttons = screen.queryAllByText('buttons.linkCondition');
      expect(buttons.length).toBe(0);
    });
  });

  describe('Edit Actions', () => {
    it('should show edit and delete action buttons', () => {
      render(<ConditionRelationships {...defaultProps} />);

      expect(screen.getByTestId('icon-edit')).toBeInTheDocument();
      expect(screen.getByTestId('icon-trash')).toBeInTheDocument();
    });

    it('should show no relevance note message when note is empty', () => {
      const propsNoNote = {
        ...defaultProps,
        labResultConditions: {
          42: [
            {
              id: 101,
              condition_id: 1,
              condition: { id: 1, diagnosis: 'Hypertension', status: 'active' },
              relevance_note: null,
            },
          ],
        },
      };
      render(<ConditionRelationships {...propsNoNote} />);

      expect(screen.getByText('modals.noRelevanceNoteProvided')).toBeInTheDocument();
    });
  });

  describe('Data Loading', () => {
    it('should call fetchLabResultConditions on mount', () => {
      render(<ConditionRelationships {...defaultProps} />);

      expect(mockFetchLabResultConditions).toHaveBeenCalledWith(42);
    });

    it('should handle missing labResultConditions gracefully', () => {
      const propsEmpty = {
        ...defaultProps,
        labResultConditions: {},
      };

      expect(() => {
        render(<ConditionRelationships {...propsEmpty} />);
      }).not.toThrow();

      expect(screen.getByText('labels.noConditionsLinked')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should render without errors', () => {
      expect(() => {
        render(<ConditionRelationships {...defaultProps} />);
      }).not.toThrow();
    });

    it('should handle null conditions gracefully', () => {
      expect(() => {
        render(<ConditionRelationships {...defaultProps} conditions={[]} />);
      }).not.toThrow();
    });
  });
});
