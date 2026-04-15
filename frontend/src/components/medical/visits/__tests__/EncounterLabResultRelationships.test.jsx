import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import React from 'react';
import render, { screen, waitFor } from '../../../../test-utils/render';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import EncounterLabResultRelationships from '../EncounterLabResultRelationships';

// Mock apiService
vi.mock('../../../../services/api', () => ({
  apiService: {
    linkEncounterLabResult: vi.fn(() =>
      Promise.resolve({
        id: 10,
        lab_result_id: 2,
        purpose: 'ordered_during',
        relevance_note: '',
      })
    ),
    updateEncounterLabResult: vi.fn(() => Promise.resolve()),
    unlinkEncounterLabResult: vi.fn(() => Promise.resolve()),
  },
}));

// Mock @tabler/icons-react
vi.mock('@tabler/icons-react', () => ({
  IconPlus: props => <span data-testid="icon-plus" {...props} />,
  IconTrash: props => <span data-testid="icon-trash" {...props} />,
  IconEdit: props => <span data-testid="icon-edit" {...props} />,
  IconCheck: props => <span data-testid="icon-check" {...props} />,
  IconX: props => <span data-testid="icon-x" {...props} />,
  IconFlask: props => <span data-testid="icon-flask" {...props} />,
  IconInfoCircle: props => <span data-testid="icon-info" {...props} />,
}));

// Mock scrollIntoView for Mantine Select/MultiSelect
Element.prototype.scrollIntoView = vi.fn();

describe('EncounterLabResultRelationships Component', () => {
  const mockLabResults = [
    {
      id: 1,
      test_name: 'Complete Blood Count',
      status: 'final',
      ordered_date: '2025-01-10',
    },
    {
      id: 2,
      test_name: 'Lipid Panel',
      status: 'preliminary',
      ordered_date: '2025-02-15',
    },
    {
      id: 3,
      test_name: 'Thyroid Function',
      status: 'final',
      ordered_date: '2025-03-01',
    },
  ];

  const mockRelationships = [
    {
      id: 101,
      lab_result_id: 1,
      lab_result_name: 'Complete Blood Count',
      lab_result_status: 'final',
      purpose: 'ordered_during',
      relevance_note: 'Ordered to evaluate anemia',
    },
  ];

  const mockFetchEncounterLabResults = vi.fn(() => Promise.resolve());
  const mockNavigate = vi.fn();

  const defaultProps = {
    encounterId: 55,
    encounterLabResults: { 55: mockRelationships },
    labResults: mockLabResults,
    fetchEncounterLabResults: mockFetchEncounterLabResults,
    navigate: mockNavigate,
    isViewMode: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  describe('Rendering', () => {
    it('should render linked lab results with test name', () => {
      render(<EncounterLabResultRelationships {...defaultProps} />);

      expect(screen.getByText('Complete Blood Count')).toBeInTheDocument();
    });

    it('should show empty state when no relationships exist', () => {
      const propsNoRelationships = {
        ...defaultProps,
        encounterLabResults: { 55: [] },
      };
      render(<EncounterLabResultRelationships {...propsNoRelationships} />);

      expect(
        screen.getByText('No lab results linked to this visit')
      ).toBeInTheDocument();
    });

    it('should show purpose badge for linked relationships', () => {
      render(<EncounterLabResultRelationships {...defaultProps} />);

      expect(screen.getByText('Ordered During Visit')).toBeInTheDocument();
    });

    it('should show Add button in edit mode when available lab results exist', () => {
      render(<EncounterLabResultRelationships {...defaultProps} />);

      expect(screen.getByText('Link Lab Result')).toBeInTheDocument();
    });

    it('should not show Add button in view mode', () => {
      render(
        <EncounterLabResultRelationships {...defaultProps} isViewMode={true} />
      );

      expect(screen.queryByText('Link Lab Result')).not.toBeInTheDocument();
    });

    it('should show lab result status badge', () => {
      render(<EncounterLabResultRelationships {...defaultProps} />);

      expect(screen.getByText('final')).toBeInTheDocument();
    });

    it('should display relevance note when present', () => {
      render(<EncounterLabResultRelationships {...defaultProps} />);

      expect(
        screen.getByText('Ordered to evaluate anemia')
      ).toBeInTheDocument();
    });

    it('should show no relevance note message when note is empty in edit mode', () => {
      const propsNoNote = {
        ...defaultProps,
        encounterLabResults: {
          55: [
            {
              id: 101,
              lab_result_id: 1,
              lab_result_name: 'Complete Blood Count',
              lab_result_status: 'final',
              purpose: 'ordered_during',
              relevance_note: null,
            },
          ],
        },
      };
      render(<EncounterLabResultRelationships {...propsNoNote} />);

      expect(
        screen.getByText('No relevance note provided')
      ).toBeInTheDocument();
    });
  });

  describe('View Mode', () => {
    it('should not show edit or delete buttons in view mode', () => {
      render(
        <EncounterLabResultRelationships {...defaultProps} isViewMode={true} />
      );

      expect(screen.queryByTestId('icon-edit')).not.toBeInTheDocument();
      expect(screen.queryByTestId('icon-trash')).not.toBeInTheDocument();
    });

    it('should navigate when lab result name is clicked in view mode', async () => {
      render(
        <EncounterLabResultRelationships {...defaultProps} isViewMode={true} />
      );

      const labResultLink = screen.getByText('Complete Blood Count');
      await userEvent.click(labResultLink);

      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('Edit Mode', () => {
    it('should show edit and delete action buttons in edit mode', () => {
      render(<EncounterLabResultRelationships {...defaultProps} />);

      expect(screen.getByTestId('icon-edit')).toBeInTheDocument();
      expect(screen.getByTestId('icon-trash')).toBeInTheDocument();
    });

    it('should not show Add button when all lab results are already linked', () => {
      const allLinkedProps = {
        ...defaultProps,
        encounterLabResults: {
          55: mockLabResults.map((lr, i) => ({
            id: 100 + i,
            lab_result_id: lr.id,
            lab_result_name: lr.test_name,
            lab_result_status: lr.status,
            purpose: null,
            relevance_note: null,
          })),
        },
      };
      render(<EncounterLabResultRelationships {...allLinkedProps} />);

      expect(screen.queryByText('Link Lab Result')).not.toBeInTheDocument();
    });
  });

  describe('Modal Functionality', () => {
    it('should open modal when Add button is clicked', async () => {
      render(<EncounterLabResultRelationships {...defaultProps} />);

      const addButton = screen.getByText('Link Lab Result');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(
          screen.getByText('Link Lab Result to Visit')
        ).toBeInTheDocument();
      });
    });

    it('should display cancel button in modal', async () => {
      render(<EncounterLabResultRelationships {...defaultProps} />);

      const addButton = screen.getByText('Link Lab Result');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading', () => {
    it('should call fetchEncounterLabResults on mount', () => {
      render(<EncounterLabResultRelationships {...defaultProps} />);

      expect(mockFetchEncounterLabResults).toHaveBeenCalledWith(55);
    });

    it('should handle missing encounterLabResults key gracefully', () => {
      const propsEmpty = {
        ...defaultProps,
        encounterLabResults: {},
      };

      expect(() => {
        render(<EncounterLabResultRelationships {...propsEmpty} />);
      }).not.toThrow();

      expect(
        screen.getByText('No lab results linked to this visit')
      ).toBeInTheDocument();
    });

    it('should handle empty labResults array gracefully', () => {
      expect(() => {
        render(
          <EncounterLabResultRelationships {...defaultProps} labResults={[]} />
        );
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should render without errors with valid props', () => {
      expect(() => {
        render(<EncounterLabResultRelationships {...defaultProps} />);
      }).not.toThrow();
    });

    it('should render without errors in view mode', () => {
      expect(() => {
        render(
          <EncounterLabResultRelationships
            {...defaultProps}
            isViewMode={true}
          />
        );
      }).not.toThrow();
    });
  });
});
