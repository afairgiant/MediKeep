import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import React from 'react';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithPatient } from '../../../test-utils/render';
import Medication from '../Medication';

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
  usePatientWithStaticData: () => ({
    practitioners: { practitioners: [
      { id: 1, name: 'Dr. Smith', specialty: 'Family Medicine' },
      { id: 2, name: 'Dr. Johnson', specialty: 'Endocrinology' },
    ]},
    pharmacies: { pharmacies: [
      { id: 1, name: 'CVS Pharmacy - Main St' },
      { id: 2, name: 'Walgreens - Downtown' },
    ]},
  }),
}));

// --- Service mocks ---
vi.mock('../../../services/api', () => ({
  apiService: {
    getMedications: vi.fn(() => Promise.resolve([])),
    getPatientMedications: vi.fn(() => Promise.resolve([])),
    createMedication: vi.fn(() => Promise.resolve({})),
    updateMedication: vi.fn(() => Promise.resolve({})),
    deleteMedication: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

// --- Utility mocks ---
vi.mock('../../../utils/medicalPageConfigs', () => ({
  getMedicalPageConfig: () => ({
    entityName: 'medications',
    filters: [],
    sortOptions: [],
    defaultSort: 'medication_name',
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
vi.mock('../../../constants/medicationTypes', () => ({
  MEDICATION_TYPES: {},
  MEDICATION_TYPE_LABELS: {},
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
  default: ({ primaryAction, viewMode, onViewModeChange }) => (
    <div data-testid="page-actions">
      {primaryAction && (
        <button onClick={primaryAction.onClick} data-testid="add-button">
          {primaryAction.label}
        </button>
      )}
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

// --- Medication component mocks ---
vi.mock('../../../components/medical/medications', () => ({
  MedicationCard: ({ medication, onView, onEdit, onDelete }) => (
    <div data-testid={`med-card-${medication.id}`}>
      <span>{medication.medication_name}</span>
      <span>{medication.dosage}</span>
      <span>{medication.frequency}</span>
      <span>{medication.status}</span>
      {medication.indication && <span>{medication.indication}</span>}
      <button onClick={() => onView(medication)}>View</button>
      <button onClick={() => onEdit(medication)}>Edit</button>
      <button onClick={() => onDelete(medication.id)}>Delete</button>
    </div>
  ),
  MedicationViewModal: ({ isOpen, onClose, medication, onEdit }) => {
    if (!isOpen || !medication) return null;
    return (
      <div data-testid="view-modal" role="dialog">
        <h2>Medication Details</h2>
        <span>{medication.medication_name}</span>
        <span>{medication.dosage}</span>
        <span>{medication.frequency}</span>
        {medication.indication && <span>{medication.indication}</span>}
        <button onClick={onClose}>Close</button>
        <button onClick={() => onEdit(medication)}>Edit</button>
      </div>
    );
  },
  MedicationFormWrapper: ({ isOpen, onClose, title, formData, onInputChange, onSubmit }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="form-modal" role="dialog">
        <h2>{title}</h2>
        <form onSubmit={onSubmit}>
          <label htmlFor="med-name">Medication Name *</label>
          <input id="med-name" name="medication_name" value={formData.medication_name || ''} onChange={onInputChange} />

          <label htmlFor="med-dosage">Dosage</label>
          <input id="med-dosage" name="dosage" value={formData.dosage || ''} onChange={onInputChange} />

          <label htmlFor="med-frequency">Frequency</label>
          <input id="med-frequency" name="frequency" value={formData.frequency || ''} onChange={onInputChange} />

          <label htmlFor="med-indication">Indication</label>
          <input id="med-indication" name="indication" value={formData.indication || ''} onChange={onInputChange} />

          <label htmlFor="med-notes">Notes</label>
          <textarea id="med-notes" name="notes" value={formData.notes || ''} onChange={onInputChange} />

          <button type="submit">Submit</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </form>
      </div>
    );
  },
}));

// --- Framer motion mock ---
vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...props }) => <div {...props}>{children}</div> },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

// ============================================================
// Test Data
// ============================================================
const mockMedications = [
  {
    id: 1,
    medication_name: 'Lisinopril',
    dosage: '10mg',
    frequency: 'Daily',
    route: 'Oral',
    indication: 'High blood pressure',
    effective_period_start: '2024-01-01',
    effective_period_end: null,
    status: 'active',
    practitioner_id: 1,
    pharmacy_id: 1,
    patient_id: 1,
  },
  {
    id: 2,
    medication_name: 'Metformin',
    dosage: '500mg',
    frequency: 'Twice daily',
    route: 'Oral',
    indication: 'Type 2 diabetes',
    effective_period_start: '2023-12-15',
    effective_period_end: null,
    status: 'active',
    practitioner_id: 2,
    pharmacy_id: 1,
    patient_id: 1,
  },
  {
    id: 3,
    medication_name: 'Ibuprofen',
    dosage: '200mg',
    frequency: 'As needed',
    route: 'Oral',
    indication: 'Pain relief',
    effective_period_start: '2024-01-10',
    effective_period_end: '2024-01-20',
    status: 'completed',
    practitioner_id: 1,
    pharmacy_id: 2,
    patient_id: 1,
  },
];

const mockDataManagement = {
  data: mockMedications,
  filters: { search: '', status: '' },
  updateFilter: vi.fn(),
  clearFilters: vi.fn(),
  hasActiveFilters: false,
  statusOptions: [
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
  ],
  categoryOptions: [],
  dateRangeOptions: [],
  sortOptions: [],
  sortBy: 'medication_name',
  sortOrder: 'asc',
  handleSortChange: vi.fn(),
  totalCount: mockMedications.length,
  filteredCount: mockMedications.length,
};

const defaultMedicalData = {
  items: mockMedications,
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
describe('Medication Page Integration Tests', () => {
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
    test('renders medication page with initial data', async () => {
      renderWithPatient(<Medication />);

      expect(screen.getByTestId('page-header')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
        expect(screen.getByText('Metformin')).toBeInTheDocument();
        expect(screen.getByText('Ibuprofen')).toBeInTheDocument();
      });
    });

    test('displays loading state initially', () => {
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        items: [],
        loading: true,
      });

      renderWithPatient(<Medication />);

      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });

    test('displays error state when there is an error', () => {
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        error: 'Failed to load medications',
      });

      renderWithPatient(<Medication />);

      expect(screen.getByTestId('error-alert')).toHaveTextContent('Failed to load medications');
    });
  });

  describe('View Mode Toggle', () => {
    test('switches between cards and table view', async () => {
      const mockSetViewMode = vi.fn();
      usePersistedViewMode.mockReturnValue(['cards', mockSetViewMode]);

      renderWithPatient(<Medication />);

      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      });

      const tableButton = screen.getByTestId('table-btn');
      await userEvent.click(tableButton);

      expect(mockSetViewMode).toHaveBeenCalledWith('table');
    });
  });

  describe('Medication CRUD Operations', () => {
    test('creates a new medication through the complete workflow', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        createItem: mockCreateItem,
      });

      renderWithPatient(<Medication />);

      const addButton = screen.getByTestId('add-button');
      await userEvent.click(addButton);

      const form = screen.getByTestId('form-modal');
      fireEvent.change(within(form).getByLabelText('Medication Name *'), { target: { value: 'Aspirin', name: 'medication_name' } });
      fireEvent.change(within(form).getByLabelText('Dosage'), { target: { value: '81mg', name: 'dosage' } });
      fireEvent.change(within(form).getByLabelText('Frequency'), { target: { value: 'Daily', name: 'frequency' } });
      fireEvent.change(within(form).getByLabelText('Indication'), { target: { value: 'Blood thinner', name: 'indication' } });

      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith(
          expect.objectContaining({
            medication_name: 'Aspirin',
            dosage: '81mg',
            frequency: 'Daily',
            indication: 'Blood thinner',
          })
        );
      });
    });

    test('edits an existing medication', async () => {
      const mockUpdateItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        updateItem: mockUpdateItem,
      });

      renderWithPatient(<Medication />);

      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      });

      // Click edit for first medication
      const medWrapper = screen.getByTestId('card-wrapper-1');
      const editButton = within(medWrapper).getByText('Edit');
      await userEvent.click(editButton);

      const form = screen.getByTestId('form-modal');
      expect(within(form).getByLabelText('Medication Name *')).toHaveValue('Lisinopril');
      expect(within(form).getByLabelText('Dosage')).toHaveValue('10mg');

      // Modify dosage
      fireEvent.change(within(form).getByLabelText('Dosage'), { target: { value: '20mg', name: 'dosage' } });
      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockUpdateItem).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ dosage: '20mg' })
        );
      });
    });

    test('deletes a medication with confirmation', async () => {
      const mockDeleteItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        deleteItem: mockDeleteItem,
      });

      renderWithPatient(<Medication />);

      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      });

      const medWrapper = screen.getByTestId('card-wrapper-1');
      const deleteButton = within(medWrapper).getByText('Delete');
      await userEvent.click(deleteButton);

      expect(mockDeleteItem).toHaveBeenCalledWith(1);
    });
  });

  describe('Filtering and Search', () => {
    test('filters medications by status', async () => {
      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: mockMedications.filter(m => m.status === 'active'),
        hasActiveFilters: true,
      });

      renderWithPatient(<Medication />);

      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      });

      expect(screen.getByText('Metformin')).toBeInTheDocument();
      expect(screen.queryByText('Ibuprofen')).not.toBeInTheDocument();
    });

    test('searches medications by name', async () => {
      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: mockMedications.filter(m => m.medication_name.toLowerCase().includes('lisinopril')),
        hasActiveFilters: true,
      });

      renderWithPatient(<Medication />);

      await waitFor(() => {
        expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      });

      expect(screen.queryByText('Metformin')).not.toBeInTheDocument();
      expect(screen.queryByText('Ibuprofen')).not.toBeInTheDocument();
    });
  });

  describe('Medication Details View', () => {
    test('opens detailed view modal', async () => {
      useViewModalNavigation.mockReturnValue({
        isOpen: true,
        viewingItem: mockMedications[0],
        openModal: vi.fn(),
        closeModal: vi.fn(),
      });

      renderWithPatient(<Medication />);

      const modal = screen.getByTestId('view-modal');
      expect(within(modal).getByText('Medication Details')).toBeInTheDocument();
      expect(within(modal).getByText('Lisinopril')).toBeInTheDocument();
      expect(within(modal).getByText('10mg')).toBeInTheDocument();
      expect(within(modal).getByText('Daily')).toBeInTheDocument();
      expect(within(modal).getByText('High blood pressure')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    test('validates required fields', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        createItem: mockCreateItem,
      });

      renderWithPatient(<Medication />);

      const addButton = screen.getByTestId('add-button');
      await userEvent.click(addButton);

      // Form should open
      const form = screen.getByTestId('form-modal');
      expect(form).toBeInTheDocument();
      expect(within(form).getByText('Submit')).toBeInTheDocument();
    });

    test('validates date fields', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        createItem: mockCreateItem,
      });

      renderWithPatient(<Medication />);

      const addButton = screen.getByTestId('add-button');
      await userEvent.click(addButton);

      // Form should open with date fields
      const form = screen.getByTestId('form-modal');
      expect(form).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    test('handles API errors gracefully', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue(false);
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        createItem: mockCreateItem,
      });

      renderWithPatient(<Medication />);

      const addButton = screen.getByTestId('add-button');
      await userEvent.click(addButton);

      const form = screen.getByTestId('form-modal');
      fireEvent.change(within(form).getByLabelText('Medication Name *'), { target: { value: 'Test Med', name: 'medication_name' } });
      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalled();
      });
    });
  });

  describe('Success Messages', () => {
    test('displays success message after successful operation', async () => {
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        successMessage: 'Medication created successfully',
      });

      renderWithPatient(<Medication />);

      expect(screen.getByTestId('success-alert')).toHaveTextContent('Medication created successfully');
    });
  });

  describe('Responsive Behavior', () => {
    test('adapts to mobile view', () => {
      renderWithPatient(<Medication />);

      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });
  });
});
