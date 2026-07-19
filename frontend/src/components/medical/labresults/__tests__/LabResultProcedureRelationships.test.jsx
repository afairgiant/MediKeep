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
import LabResultProcedureRelationships from '../LabResultProcedureRelationships';

// Mock apiService
vi.mock('../../../../services/api', () => ({
  apiService: {
    createLabResultProcedure: vi.fn(() =>
      Promise.resolve({
        id: 10,
        procedure_id: 2,
        relevance_note: '',
      })
    ),
    updateLabResultProcedure: vi.fn(() => Promise.resolve()),
    deleteLabResultProcedure: vi.fn(() => Promise.resolve()),
  },
}));

// Mock @tabler/icons-react
vi.mock('@tabler/icons-react', () => ({
  IconPlus: props => <span data-testid="icon-plus" {...props} />,
  IconTrash: props => <span data-testid="icon-trash" {...props} />,
  IconEdit: props => <span data-testid="icon-edit" {...props} />,
  IconCheck: props => <span data-testid="icon-check" {...props} />,
  IconX: props => <span data-testid="icon-x" {...props} />,
  IconMedicalCross: props => <span data-testid="icon-medical-cross" {...props} />,
  IconInfoCircle: props => <span data-testid="icon-info" {...props} />,
}));

// Mock scrollIntoView for Mantine Select
Element.prototype.scrollIntoView = vi.fn();

describe('LabResultProcedureRelationships Component', () => {
  const mockProcedures = [
    { id: 1, procedure_name: 'Colonoscopy', date: '2025-01-15' },
    { id: 2, procedure_name: 'Endoscopy', date: '2025-02-20' },
    { id: 3, procedure_name: 'Biopsy', date: '2025-03-05' },
  ];

  const mockRelationships = [
    {
      id: 201,
      procedure_id: 1,
      procedure: { id: 1, procedure_name: 'Colonoscopy', date: '2025-01-15' },
      relevance_note: 'Pre-operative labs for this procedure',
    },
  ];

  const mockFetchLabResultProcedures = vi.fn(() => Promise.resolve());
  const mockNavigate = vi.fn();

  const defaultProps = {
    labResultId: 42,
    labResultProcedures: { 42: mockRelationships },
    procedures: mockProcedures,
    fetchLabResultProcedures: mockFetchLabResultProcedures,
    navigate: mockNavigate,
    isViewMode: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  describe('Rendering', () => {
    it('should render linked procedures with name', () => {
      render(<LabResultProcedureRelationships {...defaultProps} />);

      expect(screen.getByText('Colonoscopy')).toBeInTheDocument();
    });

    it('should show empty state when no relationships exist', () => {
      const propsNoRelationships = {
        ...defaultProps,
        labResultProcedures: { 42: [] },
      };
      render(<LabResultProcedureRelationships {...propsNoRelationships} />);

      expect(
        screen.getByText('No procedures linked to this lab result')
      ).toBeInTheDocument();
    });

    it('should show Add button in edit mode when available procedures exist', () => {
      render(<LabResultProcedureRelationships {...defaultProps} />);

      expect(screen.getByText('Link Procedure')).toBeInTheDocument();
    });

    it('should not show Add button in view mode', () => {
      render(
        <LabResultProcedureRelationships {...defaultProps} isViewMode={true} />
      );

      expect(screen.queryByText('Link Procedure')).not.toBeInTheDocument();
    });

    it('should display relevance note when present', () => {
      render(<LabResultProcedureRelationships {...defaultProps} />);

      expect(
        screen.getByText('Pre-operative labs for this procedure')
      ).toBeInTheDocument();
    });

    it('should show no relevance note message when note is empty in edit mode', () => {
      const propsNoNote = {
        ...defaultProps,
        labResultProcedures: {
          42: [
            {
              id: 201,
              procedure_id: 1,
              procedure: { id: 1, procedure_name: 'Colonoscopy' },
              relevance_note: null,
            },
          ],
        },
      };
      render(<LabResultProcedureRelationships {...propsNoNote} />);

      expect(
        screen.getByText('No relevance note provided')
      ).toBeInTheDocument();
    });

    it('should show fallback text when procedure details are missing', () => {
      const propsNoDetails = {
        ...defaultProps,
        labResultProcedures: {
          42: [
            {
              id: 201,
              procedure_id: 1,
              procedure: null,
              relevance_note: null,
            },
          ],
        },
      };
      render(<LabResultProcedureRelationships {...propsNoDetails} />);

      expect(screen.getByText('Procedure #1')).toBeInTheDocument();
    });
  });

  describe('View Mode', () => {
    it('should not show edit or delete buttons in view mode', () => {
      render(
        <LabResultProcedureRelationships {...defaultProps} isViewMode={true} />
      );

      expect(screen.queryByTestId('icon-edit')).not.toBeInTheDocument();
      expect(screen.queryByTestId('icon-trash')).not.toBeInTheDocument();
    });

    it('should navigate when procedure name is clicked in view mode', async () => {
      render(
        <LabResultProcedureRelationships {...defaultProps} isViewMode={true} />
      );

      const procedureLink = screen.getByText('Colonoscopy');
      await userEvent.click(procedureLink);

      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('Edit Mode', () => {
    it('should show edit and delete action buttons in edit mode', () => {
      render(<LabResultProcedureRelationships {...defaultProps} />);

      expect(screen.getByTestId('icon-edit')).toBeInTheDocument();
      expect(screen.getByTestId('icon-trash')).toBeInTheDocument();
    });

    it('should not show Add button when all procedures are already linked', () => {
      const allLinkedProps = {
        ...defaultProps,
        labResultProcedures: {
          42: mockProcedures.map((proc, i) => ({
            id: 200 + i,
            procedure_id: proc.id,
            procedure: proc,
            relevance_note: null,
          })),
        },
      };
      render(<LabResultProcedureRelationships {...allLinkedProps} />);

      expect(screen.queryByText('Link Procedure')).not.toBeInTheDocument();
    });
  });

  describe('Modal Functionality', () => {
    it('should open modal when Add button is clicked', async () => {
      render(<LabResultProcedureRelationships {...defaultProps} />);

      const addButton = screen.getByText('Link Procedure');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(
          screen.getByText('Link Procedure to Lab Result')
        ).toBeInTheDocument();
      });
    });

    it('should display cancel button in modal', async () => {
      render(<LabResultProcedureRelationships {...defaultProps} />);

      const addButton = screen.getByText('Link Procedure');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading', () => {
    it('should call fetchLabResultProcedures on mount', () => {
      render(<LabResultProcedureRelationships {...defaultProps} />);

      expect(mockFetchLabResultProcedures).toHaveBeenCalledWith(42);
    });

    it('should handle missing labResultProcedures key gracefully', () => {
      const propsEmpty = {
        ...defaultProps,
        labResultProcedures: {},
      };

      expect(() => {
        render(<LabResultProcedureRelationships {...propsEmpty} />);
      }).not.toThrow();

      expect(
        screen.getByText('No procedures linked to this lab result')
      ).toBeInTheDocument();
    });

    it('should handle empty procedures array gracefully', () => {
      expect(() => {
        render(
          <LabResultProcedureRelationships {...defaultProps} procedures={[]} />
        );
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should render without errors with valid props', () => {
      expect(() => {
        render(<LabResultProcedureRelationships {...defaultProps} />);
      }).not.toThrow();
    });

    it('should render without errors in view mode', () => {
      expect(() => {
        render(
          <LabResultProcedureRelationships
            {...defaultProps}
            isViewMode={true}
          />
        );
      }).not.toThrow();
    });
  });
});
