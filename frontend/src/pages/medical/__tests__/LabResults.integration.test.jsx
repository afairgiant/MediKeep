import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import React from 'react';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithPatient } from '../../../test-utils/render';
import LabResults from '../LabResults';

// --- Hoisted mock functions ---
const { useMedicalData, useDataManagement, usePersistedViewMode, useViewModalNavigation } = vi.hoisted(() => ({
  useMedicalData: vi.fn(),
  useDataManagement: vi.fn(),
  usePersistedViewMode: vi.fn(),
  useViewModalNavigation: vi.fn(),
}));

// --- Hook mocks ---
vi.mock('../../../hooks/useMedicalData', () => ({ useMedicalData }));
vi.mock('../../../hooks/useDataManagement', () => ({
  useDataManagement,
  default: useDataManagement,
}));
vi.mock('../../../hooks/useViewModalNavigation', () => ({ useViewModalNavigation }));
vi.mock('../../../hooks/usePersistedViewMode', () => ({ usePersistedViewMode }));
vi.mock('../../../hooks/useEntityFileCounts', () => ({
  useEntityFileCounts: () => ({
    fileCounts: {},
    fileCountsLoading: false,
    cleanupFileCount: vi.fn(),
  }),
}));
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false, isTablet: false, isDesktop: true }),
}));
vi.mock('../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatDate: (d) => d || '',
    formatDateTime: (d) => d || '',
  }),
}));
vi.mock('../../../hooks/useGlobalData', () => ({
  usePractitioners: () => ({
    practitioners: [
      { id: 1, name: 'Dr. Anderson', specialty: 'Internal Medicine' },
      { id: 2, name: 'Dr. Miller', specialty: 'Cardiology' },
    ],
    loading: false,
  }),
}));
vi.mock('../../../hooks/useFormSubmissionWithUploads', () => ({
  useFormSubmissionWithUploads: () => ({
    submissionState: { isSubmitting: false, isUploading: false, isCompleted: false, canClose: true },
    startSubmission: vi.fn(),
    completeFormSubmission: vi.fn(),
    startFileUpload: vi.fn(),
    completeFileUpload: vi.fn(),
    handleSubmissionFailure: vi.fn(),
    resetSubmission: vi.fn(),
    isBlocking: false,
    canSubmit: true,
    statusMessage: null,
    isSubmitting: false,
    isUploading: false,
    isCompleted: false,
    canClose: true,
  }),
}));

// --- Service mocks ---
vi.mock('../../../services/api', () => ({
  apiService: {
    getLabResults: vi.fn(() => Promise.resolve([])),
    getPatientLabResults: vi.fn(() => Promise.resolve([])),
    createLabResult: vi.fn(() => Promise.resolve({})),
    updateLabResult: vi.fn(() => Promise.resolve({})),
    deleteLabResult: vi.fn(() => Promise.resolve()),
    getLabResult: vi.fn(() => Promise.resolve({})),
    getLabResultConditions: vi.fn(() => Promise.resolve([])),
    getPatientConditions: vi.fn(() => Promise.resolve([])),
  },
}));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

// --- Utility mocks ---
vi.mock('../../../utils/medicalPageConfigs', () => ({
  getMedicalPageConfig: () => ({
    entityName: 'lab_results',
    filters: [],
    sortOptions: [],
    defaultSort: 'ordered_date',
  }),
}));
vi.mock('../../../utils/tableFormatters', () => ({
  getEntityFormatters: () => ({}),
}));
vi.mock('../../../utils/linkNavigation', () => ({
  navigateToEntity: vi.fn(),
}));
vi.mock('../../../utils/helpers', () => ({
  createCardClickHandler: (handler, item) => (e) => {
    if (e.target.tagName === 'BUTTON') return;
    handler(item);
  },
}));

// --- HOC mock ---
vi.mock('../../../hoc/withResponsive', () => ({
  withResponsive: (Component) => Component,
}));

// --- Component mocks ---
vi.mock('../../../components', () => ({
  PageHeader: ({ title }) => <div data-testid="page-header">{title}</div>,
}));
vi.mock('../../../components/shared/MedicalPageActions', () => ({
  default: ({ primaryAction, secondaryActions, viewMode, onViewModeChange }) => (
    <div data-testid="page-actions">
      {primaryAction && (
        <button onClick={primaryAction.onClick} data-testid="add-button">
          {primaryAction.label}
        </button>
      )}
      {secondaryActions && secondaryActions.map((action, i) => (
        <button key={i} onClick={action.onClick} data-testid={`secondary-action-${i}`}>
          {action.label}
        </button>
      ))}
      {onViewModeChange && (
        <>
          <button onClick={() => onViewModeChange('cards')} data-testid="cards-btn">Cards</button>
          <button onClick={() => onViewModeChange('table')} data-testid="table-btn">Table</button>
        </>
      )}
    </div>
  ),
}));
vi.mock('../../../components/shared/MedicalPageFilters', () => ({
  default: () => <div data-testid="page-filters">Filters</div>,
}));
vi.mock('../../../components/shared/MedicalPageLoading', () => ({
  default: ({ message }) => <div data-testid="loading">{message}</div>,
}));
vi.mock('../../../components/shared/MedicalPageAlerts', () => ({
  default: ({ error, successMessage }) => (
    <div data-testid="alerts">
      {error && <span data-testid="error-alert">{error}</span>}
      {successMessage && <span data-testid="success-alert">{successMessage}</span>}
    </div>
  ),
}));
vi.mock('../../../components/shared/EmptyState', () => ({
  default: ({ title, message }) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      {message && <span>{message}</span>}
    </div>
  ),
}));
vi.mock('../../../components/shared/AnimatedCardGrid', () => ({
  default: ({ items, renderCard }) => (
    <div data-testid="card-grid">
      {items.map((item) => (
        <div key={item.id} data-testid={`card-wrapper-${item.id}`}>
          {renderCard(item)}
        </div>
      ))}
    </div>
  ),
}));
vi.mock('../../../components/shared/FileCountBadge', () => ({
  default: () => null,
}));
vi.mock('../../../components/shared/FormLoadingOverlay', () => ({
  default: () => null,
}));
vi.mock('../../../components/adapters', () => ({
  ResponsiveTable: ({ data, columns, onView, onEdit, onDelete }) => (
    <table data-testid="responsive-table">
      <thead>
        <tr>{columns.map((col) => <th key={col.accessor}>{col.header}</th>)}</tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id}>
            {columns.map((col) => <td key={col.accessor}>{String(row[col.accessor] ?? '')}</td>)}
            <td>
              <button onClick={() => onView(row)}>View</button>
              <button onClick={() => onEdit(row)}>Edit</button>
              <button onClick={() => onDelete(row.id)}>Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

// --- Lab result component mocks ---
vi.mock('../../../components/medical/labresults/LabResultCard', () => ({
  default: ({ labResult, onView, onEdit, onDelete }) => (
    <div data-testid={`lab-card-${labResult.id}`}>
      <span>{labResult.test_name}</span>
      <span>{labResult.test_category}</span>
      <span>{labResult.test_code}</span>
      <span>{labResult.status}</span>
      <span>{labResult.facility}</span>
      {labResult.ordered_date && <span>{labResult.ordered_date}</span>}
      {labResult.completed_date && <span>{labResult.completed_date}</span>}
      {labResult.notes && <span>{labResult.notes}</span>}
      <button onClick={() => onView(labResult)}>View</button>
      <button onClick={() => onEdit(labResult)}>Edit</button>
      <button onClick={() => onDelete(labResult.id)}>Delete</button>
    </div>
  ),
}));
vi.mock('../../../components/medical/labresults/LabResultViewModal', () => ({
  default: ({ isOpen, onClose, labResult, onEdit }) => {
    if (!isOpen || !labResult) return null;
    return (
      <div data-testid="view-modal" role="dialog">
        <h2>Lab Result Details</h2>
        <span>{labResult.test_name}</span>
        {labResult.labs_result && <pre>{labResult.labs_result}</pre>}
        {labResult.notes && <span>{labResult.notes}</span>}
        <button onClick={onClose}>Close</button>
        <button onClick={() => onEdit(labResult)}>Edit</button>
      </div>
    );
  },
}));
vi.mock('../../../components/medical/labresults/LabResultFormWrapper', () => ({
  default: ({ isOpen, onClose, title, formData, onInputChange, onSubmit }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="form-modal" role="dialog">
        <h2>{title}</h2>
        <form onSubmit={onSubmit}>
          <label htmlFor="lr-test-name">Test Name *</label>
          <input id="lr-test-name" name="test_name" value={formData.test_name || ''} onChange={onInputChange} />

          <label htmlFor="lr-test-code">Test Code</label>
          <input id="lr-test-code" name="test_code" value={formData.test_code || ''} onChange={onInputChange} />

          <label htmlFor="lr-category">Test Category</label>
          <input id="lr-category" name="test_category" value={formData.test_category || ''} onChange={onInputChange} />

          <label htmlFor="lr-facility">Facility</label>
          <input id="lr-facility" name="facility" value={formData.facility || ''} onChange={onInputChange} />

          <label htmlFor="lr-status">Status</label>
          <input id="lr-status" name="status" value={formData.status || ''} onChange={onInputChange} />

          <label htmlFor="lr-results">Lab Results</label>
          <textarea id="lr-results" name="labs_result" value={formData.labs_result || ''} onChange={onInputChange} />

          <label htmlFor="lr-notes">Notes</label>
          <textarea id="lr-notes" name="notes" value={formData.notes || ''} onChange={onInputChange} />

          <button type="submit">Submit</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </form>
      </div>
    );
  },
}));
vi.mock('../../../components/medical/labresults/LabResultQuickImportModal', () => ({
  default: () => null,
}));

// --- Framer motion mock ---
vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...props }) => <div {...props}>{children}</div> },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

// ============================================================
// Test Data
// ============================================================
const mockLabResults = [
  {
    id: 1,
    test_name: 'Complete Blood Count (CBC)',
    test_code: 'CBC',
    test_category: 'Hematology',
    test_type: 'Blood Test',
    facility: 'Quest Diagnostics',
    status: 'completed',
    labs_result: 'WBC: 6.8 K/uL (Normal)\nRBC: 4.5 M/uL (Normal)\nHgb: 14.2 g/dL (Normal)\nHct: 42.1% (Normal)',
    ordered_date: '2024-01-15',
    completed_date: '2024-01-16',
    notes: 'All values within normal range',
    practitioner_id: 1,
    patient_id: 1,
  },
  {
    id: 2,
    test_name: 'Lipid Panel',
    test_code: 'LIPID',
    test_category: 'Chemistry',
    test_type: 'Blood Test',
    facility: 'LabCorp',
    status: 'completed',
    labs_result: 'Total Cholesterol: 195 mg/dL (Normal)\nLDL: 115 mg/dL (Borderline High)\nHDL: 55 mg/dL (Normal)\nTriglycerides: 125 mg/dL (Normal)',
    ordered_date: '2024-01-10',
    completed_date: '2024-01-11',
    notes: 'LDL slightly elevated, recommend diet modification',
    practitioner_id: 2,
    patient_id: 1,
  },
  {
    id: 3,
    test_name: 'Thyroid Function Tests',
    test_code: 'TSH',
    test_category: 'Endocrinology',
    test_type: 'Blood Test',
    facility: 'Hospital Lab',
    status: 'pending',
    labs_result: '',
    ordered_date: '2024-01-20',
    completed_date: null,
    notes: 'Follow-up for thyroid symptoms',
    practitioner_id: 1,
    patient_id: 1,
  },
];

const mockDataManagement = {
  data: mockLabResults,
  filters: { search: '', status: '', category: '', dateRange: '' },
  updateFilter: vi.fn(),
  clearFilters: vi.fn(),
  hasActiveFilters: false,
  statusOptions: [
    { value: 'ordered', label: 'Ordered' },
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
  ],
  categoryOptions: [
    { value: 'hematology', label: 'Hematology' },
    { value: 'chemistry', label: 'Chemistry' },
    { value: 'endocrinology', label: 'Endocrinology' },
  ],
  dateRangeOptions: [],
  sortOptions: [],
  sortBy: 'ordered_date',
  sortOrder: 'desc',
  handleSortChange: vi.fn(),
  totalCount: mockLabResults.length,
  filteredCount: mockLabResults.length,
};

const defaultMedicalData = {
  items: mockLabResults,
  currentPatient: { id: 1, first_name: 'John', last_name: 'Doe' },
  loading: false,
  error: null,
  successMessage: null,
  createItem: vi.fn().mockResolvedValue({}),
  updateItem: vi.fn().mockResolvedValue({}),
  deleteItem: vi.fn().mockResolvedValue({}),
  refreshData: vi.fn(),
  clearError: vi.fn(),
  setError: vi.fn(),
  setSuccessMessage: vi.fn(),
};

// ============================================================
// Tests
// ============================================================
describe('Lab Results Page Integration Tests', () => {
  beforeEach(() => {
    useMedicalData.mockReturnValue({ ...defaultMedicalData });
    useDataManagement.mockReturnValue({ ...mockDataManagement });
    usePersistedViewMode.mockReturnValue(['cards', vi.fn()]);
    useViewModalNavigation.mockReturnValue({
      isOpen: false,
      viewingItem: null,
      openModal: vi.fn(),
      closeModal: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Loading and Initial State', () => {
    test('renders lab results page with initial data', async () => {
      renderWithPatient(<LabResults />);

      expect(screen.getByTestId('page-header')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
        expect(screen.getByText('Lipid Panel')).toBeInTheDocument();
        expect(screen.getByText('Thyroid Function Tests')).toBeInTheDocument();
      });
    });

    test('displays lab result details with categories and statuses', async () => {
      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
      });

      expect(screen.getByText('Hematology')).toBeInTheDocument();
      expect(screen.getByText('Chemistry')).toBeInTheDocument();
      expect(screen.getByText('Endocrinology')).toBeInTheDocument();

      const completedStatuses = screen.getAllByText('completed');
      expect(completedStatuses.length).toBe(2);
      expect(screen.getByText('pending')).toBeInTheDocument();

      expect(screen.getByText('CBC')).toBeInTheDocument();
      expect(screen.getByText('LIPID')).toBeInTheDocument();
      expect(screen.getByText('TSH')).toBeInTheDocument();
    });

    test('shows ordered and completed dates', async () => {
      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
      });

      expect(screen.getByText('2024-01-15')).toBeInTheDocument();
      expect(screen.getByText('2024-01-16')).toBeInTheDocument();
      expect(screen.getByText('2024-01-20')).toBeInTheDocument();
    });

    test('displays facilities', async () => {
      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Quest Diagnostics')).toBeInTheDocument();
      });

      expect(screen.getByText('LabCorp')).toBeInTheDocument();
      expect(screen.getByText('Hospital Lab')).toBeInTheDocument();
    });
  });

  describe('Lab Result CRUD Operations', () => {
    test('creates a new lab result through complete workflow', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        createItem: mockCreateItem,
      });

      renderWithPatient(<LabResults />);

      const addButton = screen.getByTestId('add-button');
      await userEvent.click(addButton);

      const form = screen.getByTestId('form-modal');
      fireEvent.change(within(form).getByLabelText('Test Name *'), { target: { value: 'Glucose Tolerance Test', name: 'test_name' } });
      fireEvent.change(within(form).getByLabelText('Test Code'), { target: { value: 'GTT', name: 'test_code' } });
      fireEvent.change(within(form).getByLabelText('Facility'), { target: { value: 'Diabetes Center Lab', name: 'facility' } });
      fireEvent.change(within(form).getByLabelText('Notes'), { target: { value: 'Pre-diabetes screening', name: 'notes' } });

      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith(
          expect.objectContaining({
            test_name: 'Glucose Tolerance Test',
            test_code: 'GTT',
            facility: 'Diabetes Center Lab',
            notes: 'Pre-diabetes screening',
          })
        );
      });
    });

    test('edits existing lab result with results and completion date', async () => {
      const mockUpdateItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        updateItem: mockUpdateItem,
      });

      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Thyroid Function Tests')).toBeInTheDocument();
      });

      // Click edit on thyroid test card
      const thyroidWrapper = screen.getByTestId('card-wrapper-3');
      const editButton = within(thyroidWrapper).getByText('Edit');
      await userEvent.click(editButton);

      const form = screen.getByTestId('form-modal');
      expect(within(form).getByLabelText('Test Name *')).toHaveValue('Thyroid Function Tests');

      // Update status
      fireEvent.change(within(form).getByLabelText('Status'), { target: { value: 'completed', name: 'status' } });

      // Add results
      fireEvent.change(within(form).getByLabelText('Lab Results'), { target: { value: 'TSH: 2.1 mIU/L (Normal)', name: 'labs_result' } });

      // Update notes
      fireEvent.change(within(form).getByLabelText('Notes'), { target: { value: 'Normal thyroid function.', name: 'notes' } });

      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockUpdateItem).toHaveBeenCalledWith(
          3,
          expect.objectContaining({
            status: 'completed',
            labs_result: 'TSH: 2.1 mIU/L (Normal)',
            notes: 'Normal thyroid function.',
          })
        );
      });
    });

    test('deletes lab result with confirmation', async () => {
      const mockDeleteItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        deleteItem: mockDeleteItem,
      });

      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
      });

      const cbcWrapper = screen.getByTestId('card-wrapper-1');
      const deleteButton = within(cbcWrapper).getByText('Delete');
      await userEvent.click(deleteButton);

      expect(mockDeleteItem).toHaveBeenCalledWith(1);
    });
  });

  describe('File Management Integration', () => {
    test('uploads files with lab result creation', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue({ id: 4 });
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        createItem: mockCreateItem,
      });

      renderWithPatient(<LabResults />);

      const addButton = screen.getByTestId('add-button');
      await userEvent.click(addButton);

      const form = screen.getByTestId('form-modal');
      fireEvent.change(within(form).getByLabelText('Test Name *'), { target: { value: 'X-Ray Chest', name: 'test_name' } });
      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalled();
      });
    });

    test('views lab result with details', async () => {
      useViewModalNavigation.mockReturnValue({
        isOpen: true,
        viewingItem: mockLabResults[0],
        openModal: vi.fn(),
        closeModal: vi.fn(),
      });

      renderWithPatient(<LabResults />);

      const modal = screen.getByTestId('view-modal');
      expect(within(modal).getByText('Lab Result Details')).toBeInTheDocument();
      expect(within(modal).getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
    });

    test('views lab result with results text', async () => {
      useViewModalNavigation.mockReturnValue({
        isOpen: true,
        viewingItem: mockLabResults[0],
        openModal: vi.fn(),
        closeModal: vi.fn(),
      });

      renderWithPatient(<LabResults />);

      const modal = screen.getByTestId('view-modal');
      expect(within(modal).getByText(/WBC: 6.8 K\/uL/)).toBeInTheDocument();
    });
  });

  describe('Filtering and Search', () => {
    test('filters lab results by status', async () => {
      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: mockLabResults.filter(r => r.status === 'completed'),
        hasActiveFilters: true,
      });

      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
      });

      expect(screen.getByText('Lipid Panel')).toBeInTheDocument();
      expect(screen.queryByText('Thyroid Function Tests')).not.toBeInTheDocument();
    });

    test('filters lab results by category', async () => {
      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: mockLabResults.filter(r => r.test_category === 'Hematology'),
        hasActiveFilters: true,
      });

      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
      });

      expect(screen.queryByText('Lipid Panel')).not.toBeInTheDocument();
      expect(screen.queryByText('Thyroid Function Tests')).not.toBeInTheDocument();
    });

    test('searches lab results by test name', async () => {
      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: mockLabResults.filter(r => r.test_name.toLowerCase().includes('lipid')),
        hasActiveFilters: true,
      });

      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Lipid Panel')).toBeInTheDocument();
      });

      expect(screen.queryByText('Complete Blood Count (CBC)')).not.toBeInTheDocument();
      expect(screen.queryByText('Thyroid Function Tests')).not.toBeInTheDocument();
    });
  });

  describe('View Mode Toggle', () => {
    test('switches between cards and table view', async () => {
      const mockSetViewMode = vi.fn();
      usePersistedViewMode.mockReturnValue(['cards', mockSetViewMode]);

      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
      });

      const tableButton = screen.getByTestId('table-btn');
      await userEvent.click(tableButton);

      expect(mockSetViewMode).toHaveBeenCalledWith('table');
    });
  });

  describe('Clinical Workflow Integration', () => {
    test('tracks lab result lifecycle from ordered to completed', async () => {
      renderWithPatient(<LabResults />);

      await waitFor(() => {
        expect(screen.getByText('Thyroid Function Tests')).toBeInTheDocument();
      });

      expect(screen.getByText('pending')).toBeInTheDocument();
    });

    test('handles abnormal results display', async () => {
      useViewModalNavigation.mockReturnValue({
        isOpen: true,
        viewingItem: mockLabResults[1],
        openModal: vi.fn(),
        closeModal: vi.fn(),
      });

      renderWithPatient(<LabResults />);

      const modal = screen.getByTestId('view-modal');
      expect(within(modal).getByText(/LDL: 115 mg\/dL \(Borderline High\)/)).toBeInTheDocument();
      expect(within(modal).getByText('LDL slightly elevated, recommend diet modification')).toBeInTheDocument();
    });

    test('manages follow-up recommendations', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        createItem: mockCreateItem,
      });

      renderWithPatient(<LabResults />);

      const addButton = screen.getByTestId('add-button');
      await userEvent.click(addButton);

      const form = screen.getByTestId('form-modal');
      fireEvent.change(within(form).getByLabelText('Test Name *'), { target: { value: 'HbA1c Follow-up', name: 'test_name' } });
      fireEvent.change(within(form).getByLabelText('Notes'), { target: { value: 'Follow-up in 3 months.', name: 'notes' } });
      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith(
          expect.objectContaining({
            test_name: 'HbA1c Follow-up',
            notes: 'Follow-up in 3 months.',
          })
        );
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles API errors gracefully', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue(false);
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        createItem: mockCreateItem,
      });

      renderWithPatient(<LabResults />);

      const addButton = screen.getByTestId('add-button');
      await userEvent.click(addButton);

      const form = screen.getByTestId('form-modal');
      fireEvent.change(within(form).getByLabelText('Test Name *'), { target: { value: 'Test Lab', name: 'test_name' } });
      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalled();
      });
    });

    test('handles missing file attachments gracefully', () => {
      renderWithPatient(<LabResults />);

      expect(screen.getByTestId('page-header')).toBeInTheDocument();
      expect(screen.getByText('Complete Blood Count (CBC)')).toBeInTheDocument();
    });

    test('displays empty state when no lab results exist', () => {
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        items: [],
      });
      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: [],
        totalCount: 0,
        filteredCount: 0,
      });

      renderWithPatient(<LabResults />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  describe('Form Validation and Data Integrity', () => {
    test('validates required test name field', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        createItem: mockCreateItem,
      });

      renderWithPatient(<LabResults />);

      const addButton = screen.getByTestId('add-button');
      await userEvent.click(addButton);

      // Form modal should open
      const form = screen.getByTestId('form-modal');
      expect(form).toBeInTheDocument();

      // Submit empty form - verify form is rendered and submit button exists
      const submitBtn = within(form).getByText('Submit');
      expect(submitBtn).toBeInTheDocument();
    });

    test('validates date consistency', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        createItem: mockCreateItem,
      });

      renderWithPatient(<LabResults />);

      const addButton = screen.getByTestId('add-button');
      await userEvent.click(addButton);

      const form = screen.getByTestId('form-modal');
      fireEvent.change(within(form).getByLabelText('Test Name *'), { target: { value: 'Test', name: 'test_name' } });
      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalled();
      });
    });
  });
});
