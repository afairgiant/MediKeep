import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import React from 'react';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithPatient } from '../../../test-utils/render';
import Conditions from '../Conditions';

// Hoisted mock functions (available to vi.mock factories which are hoisted)
const { useMedicalData, useDataManagement, useViewModalNavigation, usePersistedViewMode } = vi.hoisted(() => ({
  useMedicalData: vi.fn(),
  useDataManagement: vi.fn(),
  useViewModalNavigation: vi.fn(),
  usePersistedViewMode: vi.fn(),
}));

// ─── Hook mocks (factory functions to avoid module resolution chains) ────────

vi.mock('../../../hooks', () => ({
  useMedicalData,
  useDataManagement,
  useEntityFileCounts: () => ({
    fileCounts: {},
    fileCountsLoading: false,
    cleanupFileCount: vi.fn(),
  }),
  useViewModalNavigation,
}));
vi.mock('../../../hooks/useMedicalData', () => ({
  useMedicalData,
}));
vi.mock('../../../hooks/useDataManagement', () => {
  return { useDataManagement, default: useDataManagement };
});
vi.mock('../../../hooks/useGlobalData', () => ({
  useGlobalData: () => ({ patients: [], loading: false }),
  useCacheManager: () => ({ invalidatePatientList: vi.fn() }),
}));
vi.mock('../../../hooks/usePersistedViewMode', () => ({
  usePersistedViewMode,
}));
vi.mock('../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({ formatDate: (d) => d, formatLongDate: (d) => d }),
}));
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false, isTablet: false, isDesktop: true }),
}));
vi.mock('../../../services/api', () => ({
  apiService: {
    getPatientMedications: vi.fn(() => Promise.resolve([])),
    getPractitioners: vi.fn(() => Promise.resolve([])),
    getConditionMedications: vi.fn(() => Promise.resolve([])),
    createConditionMedicationsBulk: vi.fn(() => Promise.resolve([])),
  },
}));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));
vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}));

// ─── HOC / utility mocks ────────────────────────────────────────────────────

vi.mock('../../../hoc/withResponsive', () => ({
  withResponsive: (C) => C,
}));
vi.mock('../../../utils/linkNavigation', () => ({
  navigateToEntity: vi.fn(),
}));
vi.mock('../../../utils/medicalPageConfigs', () => ({
  getMedicalPageConfig: () => ({ filterConfig: {}, sortConfig: {}, defaultSort: 'diagnosis' }),
}));
vi.mock('../../../utils/tableFormatters', () => ({
  getEntityFormatters: () => ({}),
}));
vi.mock('../../../utils/dateUtils', () => ({
  formatDateForAPI: (d) => d,
  getTodayString: () => '2026-02-19',
  isDateInFuture: () => false,
  isEndDateBeforeStartDate: () => false,
  parseDateInput: (d) => d,
  getTodayEndOfDay: () => new Date(),
  formatDateInputChange: (d) => d,
}));

// ─── Animation mocks ────────────────────────────────────────────────────────

vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...props }) => <div {...props}>{children}</div> },
  AnimatePresence: ({ children }) => <>{children}</>,
}));
vi.mock('@mantine/dates', () => ({
  DateInput: ({ label }) => <input data-testid={`date-${label}`} />,
}));

// ─── Component mocks ────────────────────────────────────────────────────────

vi.mock('../../../components', () => ({
  PageHeader: ({ title }) => <h1 data-testid="page-header">{title}</h1>,
}));

vi.mock('../../../components/adapters', () => ({
  ResponsiveTable: ({ data = [], columns = [], onView, onEdit, onDelete }) => (
    <table data-testid="responsive-table">
      <thead>
        <tr>{columns.map((c) => <th key={c.accessor}>{c.header}</th>)}</tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr key={item.id}>
            {columns.map((c) => <td key={c.accessor}>{item[c.accessor]}</td>)}
            <td>
              <button onClick={() => onView(item)}>View</button>
              <button onClick={() => onEdit(item)}>Edit</button>
              <button onClick={() => onDelete(item.id)}>Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
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
          <button onClick={() => onViewModeChange('cards')}>Cards</button>
          <button onClick={() => onViewModeChange('table')}>Table</button>
        </>
      )}
    </div>
  ),
}));

vi.mock('../../../components/shared/MedicalPageFilters', () => ({
  default: ({ dataManagement }) => (
    <div data-testid="page-filters">
      <input placeholder="Search..." data-testid="search-input" onChange={(e) => dataManagement.updateFilter('search', e.target.value)} />
      <select data-testid="severity-filter" aria-label="Severity" onChange={(e) => dataManagement.updateFilter('severity', e.target.value)}>
        <option value="">All</option><option value="moderate">Moderate</option>
      </select>
      <select data-testid="status-filter" aria-label="Status" onChange={(e) => dataManagement.updateFilter('status', e.target.value)}>
        <option value="">All</option><option value="active">Active</option><option value="resolved">Resolved</option>
      </select>
    </div>
  ),
}));

vi.mock('../../../components/shared/EmptyState', () => ({
  default: ({ title, hasActiveFilters, filteredMessage, noDataMessage }) => (
    <div data-testid="empty-state">
      <h2>{title}</h2>
      <p>{hasActiveFilters ? filteredMessage : noDataMessage}</p>
    </div>
  ),
}));

vi.mock('../../../components/shared/MedicalPageAlerts', () => ({
  default: ({ error, successMessage }) => (
    <div data-testid="page-alerts">
      {error && <div role="alert">{error}</div>}
      {successMessage && <div data-testid="success-msg">{successMessage}</div>}
    </div>
  ),
}));

vi.mock('../../../components/shared/MedicalPageLoading', () => ({
  default: ({ message }) => <div data-testid="loading">{message}</div>,
}));

vi.mock('../../../components/shared/AnimatedCardGrid', () => ({
  default: ({ items, renderCard }) => (
    <div data-testid="card-grid">
      {items.map((item) => <div key={item.id}>{renderCard(item)}</div>)}
    </div>
  ),
}));

vi.mock('../../../components/medical/conditions', () => ({
  ConditionCard: ({ condition, onView, onEdit, onDelete }) => (
    <div data-testid={`condition-card-${condition.id}`}>
      <span>{condition.diagnosis}</span>
      {condition.severity && <span>{condition.severity}</span>}
      {condition.status && <span>{condition.status}</span>}
      {condition.icd10_code && <span>ICD-10: {condition.icd10_code}</span>}
      {condition.snomed_code && <span>SNOMED: {condition.snomed_code}</span>}
      {condition.code_description && <span>{condition.code_description}</span>}
      {condition.notes && <span>{condition.notes}</span>}
      {condition.onset_date && <span>{condition.onset_date}</span>}
      {condition.end_date && <span>{condition.end_date}</span>}
      <button onClick={() => onView(condition)}>View</button>
      <button onClick={() => onEdit(condition)}>Edit</button>
      <button onClick={() => onDelete(condition.id)}>Delete</button>
    </div>
  ),
  ConditionViewModal: ({ isOpen, onClose, condition, onEdit }) => {
    if (!isOpen || !condition) return null;
    return (
      <div data-testid="view-modal" role="dialog">
        <h2>Condition Details</h2>
        <span>{condition.diagnosis}</span>
        {condition.severity && <span>{condition.severity}</span>}
        {condition.status && <span>{condition.status}</span>}
        {condition.icd10_code && <span>{condition.icd10_code}</span>}
        {condition.snomed_code && <span>{condition.snomed_code}</span>}
        {condition.code_description && <span>{condition.code_description}</span>}
        {condition.notes && <span>{condition.notes}</span>}
        {condition.onset_date && <span>{condition.onset_date}</span>}
        {condition.end_date && <span>{condition.end_date}</span>}
        <button onClick={onClose}>Close</button>
        <button onClick={() => onEdit(condition)}>Edit</button>
      </div>
    );
  },
  ConditionFormWrapper: ({ isOpen, onClose, title, formData, onInputChange, onSubmit }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="form-modal" role="dialog">
        <h2>{title}</h2>
        <form onSubmit={onSubmit}>
          <label htmlFor="diagnosis">Diagnosis *</label>
          <input id="diagnosis" name="diagnosis" value={formData.diagnosis || ''} onChange={onInputChange} required />
          <label htmlFor="severity">Severity</label>
          <select id="severity" name="severity" value={formData.severity || ''} onChange={onInputChange}>
            <option value="">Select...</option>
            <option value="mild">mild</option>
            <option value="moderate">moderate</option>
            <option value="severe">severe</option>
          </select>
          <label htmlFor="status">Status</label>
          <select id="status" name="status" value={formData.status || 'active'} onChange={onInputChange}>
            <option value="active">active</option>
            <option value="resolved">resolved</option>
            <option value="chronic">chronic</option>
          </select>
          <label htmlFor="icd10_code">ICD-10 Code</label>
          <input id="icd10_code" name="icd10_code" value={formData.icd10_code || ''} onChange={onInputChange} />
          <label htmlFor="snomed_code">SNOMED Code</label>
          <input id="snomed_code" name="snomed_code" value={formData.snomed_code || ''} onChange={onInputChange} />
          <label htmlFor="code_description">Code Description</label>
          <input id="code_description" name="code_description" value={formData.code_description || ''} onChange={onInputChange} />
          <label htmlFor="onset_date">Onset Date</label>
          <input id="onset_date" name="onset_date" type="date" value={formData.onset_date || ''} onChange={onInputChange} />
          <label htmlFor="end_date">End Date</label>
          <input id="end_date" name="end_date" type="date" value={formData.end_date || ''} onChange={onInputChange} />
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" value={formData.notes || ''} onChange={onInputChange} />
          <button type="submit">Submit</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </form>
      </div>
    );
  },
}));

// ─── Test Data ───────────────────────────────────────────────────────────────

const mockConditions = [
  {
    id: 1, diagnosis: 'Type 2 Diabetes', status: 'active', severity: 'moderate',
    icd10_code: 'E11.9', snomed_code: '44054006',
    code_description: 'Type 2 diabetes mellitus without complications',
    onset_date: '2020-03-15', end_date: null,
    notes: 'Well controlled with medication', patient_id: 1,
  },
  {
    id: 2, diagnosis: 'Hypertension', status: 'active', severity: 'mild',
    icd10_code: 'I10', snomed_code: '38341003',
    code_description: 'Essential hypertension',
    onset_date: '2019-08-20', end_date: null,
    notes: 'Managed with ACE inhibitor', patient_id: 1,
  },
  {
    id: 3, diagnosis: 'Seasonal Allergies', status: 'resolved', severity: 'mild',
    icd10_code: 'J30.1', snomed_code: '21719001',
    code_description: 'Allergic rhinitis due to pollen',
    onset_date: '2023-04-01', end_date: '2023-06-30',
    notes: 'Resolved after allergy season', patient_id: 1,
  },
];

const mockDataManagement = {
  data: mockConditions,
  filters: { search: '', status: '', severity: '' },
  updateFilter: vi.fn(),
  clearFilters: vi.fn(),
  hasActiveFilters: false,
  statusOptions: [
    { value: 'active', label: 'Active' },
    { value: 'resolved', label: 'Resolved' },
  ],
  categoryOptions: [],
  dateRangeOptions: [],
  sortOptions: [],
  sortBy: 'diagnosis',
  sortOrder: 'asc',
  handleSortChange: vi.fn(),
  totalCount: mockConditions.length,
  filteredCount: mockConditions.length,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Conditions Page Integration Tests', () => {
  beforeEach(() => {
    useMedicalData.mockReturnValue({
      items: mockConditions,
      currentPatient: { id: 1, first_name: 'John', last_name: 'Doe' },
      loading: false, error: null, successMessage: null,
      createItem: vi.fn().mockResolvedValue(true),
      updateItem: vi.fn().mockResolvedValue(true),
      deleteItem: vi.fn().mockResolvedValue(true),
      refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(),
      setSuccessMessage: vi.fn(),
    });
    useDataManagement.mockReturnValue(mockDataManagement);
    useViewModalNavigation.mockReturnValue({
      isOpen: false, viewingItem: null, openModal: vi.fn(), closeModal: vi.fn(),
    });
    usePersistedViewMode.mockReturnValue(['cards', vi.fn()]);
  });

  afterEach(() => { vi.clearAllMocks(); });

  describe('Page Loading and Initial State', () => {
    test('renders conditions page with initial data', async () => {
      renderWithPatient(<Conditions />);
      // Page header uses i18n key
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
        expect(screen.getByText('Hypertension')).toBeInTheDocument();
        expect(screen.getByText('Seasonal Allergies')).toBeInTheDocument();
      });
    });

    test('displays condition details with medical codes and severity', async () => {
      renderWithPatient(<Conditions />);
      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });
      expect(screen.getByText('ICD-10: E11.9')).toBeInTheDocument();
      expect(screen.getByText('SNOMED: 44054006')).toBeInTheDocument();
      expect(screen.getByText('moderate')).toBeInTheDocument();
      expect(screen.getAllByText('mild')).toHaveLength(2);
      expect(screen.getAllByText('active')).toHaveLength(2);
      expect(screen.getByText('resolved')).toBeInTheDocument();
    });

    test('shows onset dates and notes', async () => {
      renderWithPatient(<Conditions />);
      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });
      // Onset dates (useDateFormat mock returns raw strings)
      expect(screen.getByText('2020-03-15')).toBeInTheDocument();
      expect(screen.getByText('2019-08-20')).toBeInTheDocument();
      expect(screen.getByText('Well controlled with medication')).toBeInTheDocument();
    });
  });

  describe('Condition CRUD Operations', () => {
    test('creates a new condition through complete workflow', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue(true);
      useMedicalData.mockReturnValue({
        items: mockConditions, currentPatient: { id: 1 },
        loading: false, error: null, successMessage: null,
        createItem: mockCreateItem, updateItem: vi.fn(), deleteItem: vi.fn(),
        refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(), setSuccessMessage: vi.fn(),
      });

      renderWithPatient(<Conditions />);
      await userEvent.click(screen.getByTestId('add-button'));
      const form = screen.getByTestId('form-modal');
      expect(form).toBeInTheDocument();

      fireEvent.change(within(form).getByLabelText('Diagnosis *'), { target: { value: 'Migraine Headache', name: 'diagnosis' } });
      fireEvent.change(within(form).getByLabelText('Severity'), { target: { value: 'moderate', name: 'severity' } });
      fireEvent.change(within(form).getByLabelText('Status'), { target: { value: 'active', name: 'status' } });
      fireEvent.change(within(form).getByLabelText('ICD-10 Code'), { target: { value: 'G43.9', name: 'icd10_code' } });
      fireEvent.change(within(form).getByLabelText('SNOMED Code'), { target: { value: '37796009', name: 'snomed_code' } });
      fireEvent.change(within(form).getByLabelText('Code Description'), { target: { value: 'Migraine without aura', name: 'code_description' } });
      fireEvent.change(within(form).getByLabelText('Notes'), { target: { value: 'Chronic migraine, responds well to triptans', name: 'notes' } });

      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith(expect.objectContaining({
          diagnosis: 'Migraine Headache',
          severity: 'moderate',
          icd10_code: 'G43.9',
          patient_id: 1,
        }));
      });
    });

    test('edits existing condition with updated severity and notes', async () => {
      const mockUpdateItem = vi.fn().mockResolvedValue(true);
      useMedicalData.mockReturnValue({
        items: mockConditions, currentPatient: { id: 1 },
        loading: false, error: null, successMessage: null,
        createItem: vi.fn(), updateItem: mockUpdateItem, deleteItem: vi.fn(),
        refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(), setSuccessMessage: vi.fn(),
      });

      renderWithPatient(<Conditions />);
      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });

      // Click Edit on Type 2 Diabetes card
      const card = screen.getByTestId('condition-card-1');
      fireEvent.click(within(card).getByText('Edit'));

      const form = screen.getByTestId('form-modal');
      expect(within(form).getByLabelText('Diagnosis *')).toHaveValue('Type 2 Diabetes');

      fireEvent.change(within(form).getByLabelText('Severity'), { target: { value: 'severe', name: 'severity' } });
      fireEvent.change(within(form).getByLabelText('Notes'), { target: { value: 'Diabetes now requiring insulin therapy', name: 'notes' } });
      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockUpdateItem).toHaveBeenCalledWith(1, expect.objectContaining({
          severity: 'severe',
          notes: 'Diabetes now requiring insulin therapy',
        }));
      });
    });

    test('deletes condition with confirmation', async () => {
      const mockDeleteItem = vi.fn().mockResolvedValue(true);
      useMedicalData.mockReturnValue({
        items: mockConditions, currentPatient: { id: 1 },
        loading: false, error: null, successMessage: null,
        createItem: vi.fn(), updateItem: vi.fn(), deleteItem: mockDeleteItem,
        refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(), setSuccessMessage: vi.fn(),
      });

      renderWithPatient(<Conditions />);
      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });

      const card = screen.getByTestId('condition-card-1');
      fireEvent.click(within(card).getByText('Delete'));
      expect(mockDeleteItem).toHaveBeenCalledWith(1);
    });
  });

  describe('Filtering and Search', () => {
    test('filters conditions by status', async () => {
      const activeConditions = mockConditions.filter((c) => c.status === 'active');
      useDataManagement.mockReturnValue({ ...mockDataManagement, data: activeConditions, hasActiveFilters: true });

      renderWithPatient(<Conditions />);
      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('status-filter'), { target: { value: 'active' } });
      expect(mockDataManagement.updateFilter).toHaveBeenCalledWith('status', 'active');

      expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      expect(screen.getByText('Hypertension')).toBeInTheDocument();
      expect(screen.queryByText('Seasonal Allergies')).not.toBeInTheDocument();
    });

    test('filters conditions by severity', async () => {
      const moderateConditions = mockConditions.filter((c) => c.severity === 'moderate');
      useDataManagement.mockReturnValue({ ...mockDataManagement, data: moderateConditions, hasActiveFilters: true });

      renderWithPatient(<Conditions />);
      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('severity-filter'), { target: { value: 'moderate' } });
      expect(mockDataManagement.updateFilter).toHaveBeenCalledWith('severity', 'moderate');

      expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      expect(screen.queryByText('Hypertension')).not.toBeInTheDocument();
    });

    test('searches conditions by diagnosis name', async () => {
      const diabetesOnly = mockConditions.filter((c) => c.diagnosis.toLowerCase().includes('diabetes'));
      useDataManagement.mockReturnValue({ ...mockDataManagement, data: diabetesOnly, hasActiveFilters: true });

      renderWithPatient(<Conditions />);
      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'diabetes' } });
      expect(mockDataManagement.updateFilter).toHaveBeenCalledWith('search', 'diabetes');

      expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      expect(screen.queryByText('Hypertension')).not.toBeInTheDocument();
    });
  });

  describe('Condition Details View', () => {
    test('opens detailed view modal with comprehensive information', async () => {
      useViewModalNavigation.mockReturnValue({
        isOpen: true, viewingItem: mockConditions[0], openModal: vi.fn(), closeModal: vi.fn(),
      });

      renderWithPatient(<Conditions />);
      const modal = screen.getByTestId('view-modal');
      expect(modal).toBeInTheDocument();
      expect(within(modal).getByText('Condition Details')).toBeInTheDocument();
      expect(within(modal).getByText('Type 2 diabetes mellitus without complications')).toBeInTheDocument();
      expect(within(modal).getByText('E11.9')).toBeInTheDocument();
      expect(within(modal).getByText('44054006')).toBeInTheDocument();
      expect(within(modal).getByText('Well controlled with medication')).toBeInTheDocument();
    });

    test('shows timeline information with onset date', async () => {
      useViewModalNavigation.mockReturnValue({
        isOpen: true, viewingItem: mockConditions[0], openModal: vi.fn(), closeModal: vi.fn(),
      });

      renderWithPatient(<Conditions />);
      const modal = screen.getByTestId('view-modal');
      expect(within(modal).getByText('2020-03-15')).toBeInTheDocument();
    });

    test('displays resolved condition with end date', async () => {
      useViewModalNavigation.mockReturnValue({
        isOpen: true, viewingItem: mockConditions[2], openModal: vi.fn(), closeModal: vi.fn(),
      });

      renderWithPatient(<Conditions />);
      const modal = screen.getByTestId('view-modal');
      expect(within(modal).getByText('2023-06-30')).toBeInTheDocument();
      expect(within(modal).getByText('resolved')).toBeInTheDocument();
    });
  });

  describe('View Mode Toggle', () => {
    test('switches between cards and table view', async () => {
      const mockSetViewMode = vi.fn();
      usePersistedViewMode.mockReturnValue(['cards', mockSetViewMode]);

      renderWithPatient(<Conditions />);
      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });

      expect(screen.getByText('Cards')).toBeInTheDocument();
      expect(screen.getByTestId('card-grid')).toBeInTheDocument();

      await userEvent.click(screen.getByText('Table'));
      expect(mockSetViewMode).toHaveBeenCalledWith('table');
    });
  });

  describe('Medical Workflow Integration', () => {
    test('manages chronic condition lifecycle', async () => {
      const mockUpdateItem = vi.fn().mockResolvedValue(true);
      useMedicalData.mockReturnValue({
        items: mockConditions, currentPatient: { id: 1 },
        loading: false, error: null, successMessage: null,
        createItem: vi.fn(), updateItem: mockUpdateItem, deleteItem: vi.fn(),
        refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(), setSuccessMessage: vi.fn(),
      });

      renderWithPatient(<Conditions />);
      await waitFor(() => {
        expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
      });

      const card = screen.getByTestId('condition-card-1');
      fireEvent.click(within(card).getByText('Edit'));

      const form = screen.getByTestId('form-modal');
      fireEvent.change(within(form).getByLabelText('Status'), { target: { value: 'chronic', name: 'status' } });
      fireEvent.change(within(form).getByLabelText('Notes'), {
        target: { value: 'Chronic diabetes managed with metformin.', name: 'notes' },
      });
      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockUpdateItem).toHaveBeenCalledWith(1, expect.objectContaining({
          status: 'chronic',
        }));
      });
    });

    test('handles condition resolution workflow', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue(true);
      useMedicalData.mockReturnValue({
        items: mockConditions, currentPatient: { id: 1 },
        loading: false, error: null, successMessage: null,
        createItem: mockCreateItem, updateItem: vi.fn(), deleteItem: vi.fn(),
        refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(), setSuccessMessage: vi.fn(),
      });

      renderWithPatient(<Conditions />);
      await userEvent.click(screen.getByTestId('add-button'));
      const form = screen.getByTestId('form-modal');

      fireEvent.change(within(form).getByLabelText('Diagnosis *'), { target: { value: 'Acute Bronchitis', name: 'diagnosis' } });
      fireEvent.change(within(form).getByLabelText('Severity'), { target: { value: 'mild', name: 'severity' } });
      fireEvent.change(within(form).getByLabelText('Notes'), { target: { value: 'Acute bronchitis with productive cough', name: 'notes' } });
      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith(expect.objectContaining({
          diagnosis: 'Acute Bronchitis',
          severity: 'mild',
        }));
      });
    });

    test('validates medical coding integrity', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue(true);
      useMedicalData.mockReturnValue({
        items: mockConditions, currentPatient: { id: 1 },
        loading: false, error: null, successMessage: null,
        createItem: mockCreateItem, updateItem: vi.fn(), deleteItem: vi.fn(),
        refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(), setSuccessMessage: vi.fn(),
      });

      renderWithPatient(<Conditions />);
      await userEvent.click(screen.getByTestId('add-button'));
      const form = screen.getByTestId('form-modal');

      fireEvent.change(within(form).getByLabelText('Diagnosis *'), { target: { value: 'Atrial Fibrillation', name: 'diagnosis' } });
      fireEvent.change(within(form).getByLabelText('ICD-10 Code'), { target: { value: 'I48.0', name: 'icd10_code' } });
      fireEvent.change(within(form).getByLabelText('SNOMED Code'), { target: { value: '49436004', name: 'snomed_code' } });
      fireEvent.change(within(form).getByLabelText('Code Description'), { target: { value: 'Paroxysmal atrial fibrillation', name: 'code_description' } });
      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith(expect.objectContaining({
          diagnosis: 'Atrial Fibrillation',
          icd10_code: 'I48.0',
          snomed_code: '49436004',
        }));
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('handles API errors gracefully', async () => {
      useMedicalData.mockReturnValue({
        items: mockConditions, currentPatient: { id: 1 },
        loading: false, error: 'Failed to create condition', successMessage: null,
        createItem: vi.fn().mockResolvedValue(false), updateItem: vi.fn(), deleteItem: vi.fn(),
        refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(), setSuccessMessage: vi.fn(),
      });

      renderWithPatient(<Conditions />);
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to create condition');
    });

    test('handles conditions without medical codes', () => {
      const minimalConditions = [
        { id: 1, diagnosis: 'General Fatigue', status: 'active', severity: null,
          icd10_code: null, snomed_code: null, code_description: null,
          onset_date: '2024-01-01', end_date: null, notes: 'Patient reports general fatigue', patient_id: 1 },
      ];
      useMedicalData.mockReturnValue({
        items: minimalConditions, currentPatient: { id: 1 },
        loading: false, error: null, successMessage: null,
        createItem: vi.fn(), updateItem: vi.fn(), deleteItem: vi.fn(),
        refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(), setSuccessMessage: vi.fn(),
      });
      useDataManagement.mockReturnValue({ ...mockDataManagement, data: minimalConditions });

      renderWithPatient(<Conditions />);
      expect(screen.getByText('General Fatigue')).toBeInTheDocument();
    });

    test('displays empty state when no conditions exist', () => {
      useMedicalData.mockReturnValue({
        items: [], currentPatient: { id: 1 },
        loading: false, error: null, successMessage: null,
        createItem: vi.fn(), updateItem: vi.fn(), deleteItem: vi.fn(),
        refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(), setSuccessMessage: vi.fn(),
      });
      useDataManagement.mockReturnValue({ ...mockDataManagement, data: [], totalCount: 0, filteredCount: 0 });

      renderWithPatient(<Conditions />);
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  describe('Form Validation and Data Integrity', () => {
    test('validates required diagnosis field', async () => {
      renderWithPatient(<Conditions />);
      await userEvent.click(screen.getByTestId('add-button'));
      const form = screen.getByTestId('form-modal');
      expect(within(form).getByLabelText('Diagnosis *')).toBeRequired();
    });

    test('validates date fields are present in form', async () => {
      renderWithPatient(<Conditions />);
      await userEvent.click(screen.getByTestId('add-button'));
      const form = screen.getByTestId('form-modal');
      expect(within(form).getByLabelText('Onset Date')).toBeInTheDocument();
      expect(within(form).getByLabelText('End Date')).toBeInTheDocument();
    });
  });
});
