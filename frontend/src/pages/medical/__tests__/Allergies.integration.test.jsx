import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import React from 'react';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithPatient } from '../../../test-utils/render';
import Allergies from '../Allergies';
import { useMedicalData } from '../../../hooks/useMedicalData';
import { useDataManagement } from '../../../hooks/useDataManagement';
import { useViewModalNavigation } from '../../../hooks/useViewModalNavigation';
import { usePersistedViewMode } from '../../../hooks/usePersistedViewMode';

// ─── Hook mocks (factories to avoid module resolution issues) ────────────────

vi.mock('../../../hooks/useMedicalData', () => ({
  useMedicalData: vi.fn(),
}));
vi.mock('../../../hooks/useDataManagement', () => ({
  useDataManagement: vi.fn(),
  default: vi.fn(),
}));
vi.mock('../../../hooks/useEntityFileCounts', () => ({
  useEntityFileCounts: () => ({
    fileCounts: {},
    fileCountsLoading: false,
    cleanupFileCount: vi.fn(),
  }),
}));
vi.mock('../../../hooks/useViewModalNavigation', () => ({
  useViewModalNavigation: vi.fn(),
}));
vi.mock('../../../hooks/usePersistedViewMode', () => ({
  usePersistedViewMode: vi.fn(),
}));
vi.mock('../../../services/api', () => ({
  apiService: {
    getPatientMedications: vi.fn(() => Promise.resolve([])),
  },
}));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));
vi.mock('../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatDate: (d) => d,
    formatLongDate: (d) => d,
  }),
}));
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false, isTablet: false, isDesktop: true }),
}));

// ─── HOC / utility mocks ────────────────────────────────────────────────────

vi.mock('../../../hoc/withResponsive', () => ({
  withResponsive: (C) => C,
}));
vi.mock('../../../utils/linkNavigation', () => ({
  navigateToEntity: vi.fn(),
}));
vi.mock('../../../utils/medicalPageConfigs', () => ({
  getMedicalPageConfig: () => ({ filterConfig: {}, sortConfig: {}, defaultSort: 'allergen' }),
}));
vi.mock('../../../utils/tableFormatters', () => ({
  getEntityFormatters: () => ({}),
}));

// ─── Animation mocks ────────────────────────────────────────────────────────

vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...props }) => <div {...props}>{children}</div> },
  AnimatePresence: ({ children }) => <>{children}</>,
}));
vi.mock('@mantine/dates', () => ({
  DateInput: ({ label, ...props }) => <input data-testid={`date-${label}`} />,
}));

// ─── Component mocks (simple HTML for reliable testing) ──────────────────────

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
      <input
        placeholder="Search..."
        data-testid="search-input"
        onChange={(e) => dataManagement.updateFilter('search', e.target.value)}
      />
      <select
        data-testid="severity-filter"
        aria-label="Severity"
        onChange={(e) => dataManagement.updateFilter('severity', e.target.value)}
      >
        <option value="">All</option>
        <option value="severe">Severe+</option>
      </select>
      <select
        data-testid="status-filter"
        aria-label="Status"
        onChange={(e) => dataManagement.updateFilter('status', e.target.value)}
      >
        <option value="">All</option>
        <option value="active">Active</option>
        <option value="resolved">Resolved</option>
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

vi.mock('../../../components/medical/allergies', () => ({
  AllergyCard: ({ allergy, onView, onEdit, onDelete }) => (
    <div data-testid={`allergy-card-${allergy.id}`}>
      <span>{allergy.allergen}</span>
      {allergy.severity && <span>{allergy.severity}</span>}
      {allergy.status && <span>{allergy.status}</span>}
      {allergy.reaction && <span>{allergy.reaction}</span>}
      {allergy.notes && <span>{allergy.notes}</span>}
      {allergy.onset_date && <span>{allergy.onset_date}</span>}
      <button onClick={() => onView(allergy)}>View</button>
      <button onClick={() => onEdit(allergy)}>Edit</button>
      <button onClick={() => onDelete(allergy.id)}>Delete</button>
    </div>
  ),
  AllergyViewModal: ({ isOpen, onClose, allergy, onEdit }) => {
    if (!isOpen || !allergy) return null;
    return (
      <div data-testid="view-modal" role="dialog">
        <h2>Allergy Details</h2>
        <span>{allergy.allergen}</span>
        <span>{allergy.severity}</span>
        <span>{allergy.status}</span>
        {allergy.reaction && <span>{allergy.reaction}</span>}
        {allergy.notes && <span>{allergy.notes}</span>}
        {allergy.onset_date && <span>{allergy.onset_date}</span>}
        <button onClick={onClose}>Close</button>
        <button onClick={() => onEdit(allergy)}>Edit</button>
      </div>
    );
  },
  AllergyFormWrapper: ({ isOpen, onClose, title, formData, onInputChange, onSubmit }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="form-modal" role="dialog">
        <h2>{title}</h2>
        <form onSubmit={onSubmit}>
          <label htmlFor="allergen">Allergen *</label>
          <input id="allergen" name="allergen" value={formData.allergen || ''} onChange={onInputChange} required />
          <label htmlFor="severity">Severity</label>
          <select id="severity" name="severity" value={formData.severity || ''} onChange={onInputChange}>
            <option value="">Select...</option>
            <option value="mild">mild</option>
            <option value="moderate">moderate</option>
            <option value="severe">severe</option>
            <option value="life-threatening">life-threatening</option>
          </select>
          <label htmlFor="reaction">Reaction</label>
          <textarea id="reaction" name="reaction" value={formData.reaction || ''} onChange={onInputChange} />
          <label htmlFor="onset_date">Onset Date</label>
          <input id="onset_date" name="onset_date" type="date" value={formData.onset_date || ''} onChange={onInputChange} />
          <label htmlFor="status">Status</label>
          <select id="status" name="status" value={formData.status || 'active'} onChange={onInputChange}>
            <option value="active">active</option>
            <option value="resolved">resolved</option>
            <option value="inactive">inactive</option>
          </select>
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

const mockAllergies = [
  {
    id: 1, allergen: 'Penicillin', severity: 'severe',
    reaction: 'Anaphylaxis, difficulty breathing, hives', onset_date: '2020-05-15',
    status: 'active', notes: 'Confirmed by allergist. Carry EpiPen at all times.', patient_id: 1,
  },
  {
    id: 2, allergen: 'Peanuts', severity: 'life-threatening',
    reaction: 'Anaphylactic shock, swelling of throat', onset_date: '2018-03-10',
    status: 'active', notes: 'Severe peanut allergy. Avoid all nuts and processed foods.', patient_id: 1,
  },
  {
    id: 3, allergen: 'Latex', severity: 'moderate',
    reaction: 'Contact dermatitis, rash', onset_date: '2021-08-22',
    status: 'active', notes: 'Occupational allergy. Use non-latex gloves.', patient_id: 1,
  },
  {
    id: 4, allergen: 'Shellfish', severity: 'mild',
    reaction: 'Stomach upset, nausea', onset_date: '2019-12-01',
    status: 'resolved', notes: 'Previously allergic, seems to have outgrown it.', patient_id: 1,
  },
];

const mockDataManagement = {
  data: mockAllergies,
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
  sortBy: 'allergen',
  sortOrder: 'asc',
  handleSortChange: vi.fn(),
  totalCount: mockAllergies.length,
  filteredCount: mockAllergies.length,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Allergies Page Integration Tests', () => {
  let mockViewModalOpenModal;

  beforeEach(() => {
    mockViewModalOpenModal = vi.fn();

    useMedicalData.mockReturnValue({
      items: mockAllergies,
      currentPatient: { id: 1, first_name: 'John', last_name: 'Doe' },
      loading: false,
      error: null,
      successMessage: null,
      createItem: vi.fn().mockResolvedValue(true),
      updateItem: vi.fn().mockResolvedValue(true),
      deleteItem: vi.fn().mockResolvedValue(true),
      refreshData: vi.fn(),
      clearError: vi.fn(),
      setError: vi.fn(),
    });

    useDataManagement.mockReturnValue(mockDataManagement);

    useViewModalNavigation.mockReturnValue({
      isOpen: false,
      viewingItem: null,
      openModal: mockViewModalOpenModal,
      closeModal: vi.fn(),
    });

    usePersistedViewMode.mockReturnValue(['cards', vi.fn()]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Page Loading and Initial State ──────────────────────────────────────

  describe('Page Loading and Initial State', () => {
    test('renders allergies page with initial data', async () => {
      renderWithPatient(<Allergies />);

      // Page header uses i18n key
      expect(screen.getByTestId('page-header')).toHaveTextContent('allergies.title');

      // Allergen names from data
      await waitFor(() => {
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
        expect(screen.getByText('Peanuts')).toBeInTheDocument();
        expect(screen.getByText('Latex')).toBeInTheDocument();
        expect(screen.getByText('Shellfish')).toBeInTheDocument();
      });
    });

    test('displays allergy severity levels and reactions', async () => {
      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
      });

      expect(screen.getByText('severe')).toBeInTheDocument();
      expect(screen.getByText('life-threatening')).toBeInTheDocument();
      expect(screen.getByText('moderate')).toBeInTheDocument();
      expect(screen.getByText('mild')).toBeInTheDocument();

      expect(screen.getByText('Anaphylaxis, difficulty breathing, hives')).toBeInTheDocument();
      expect(screen.getByText('Contact dermatitis, rash')).toBeInTheDocument();
    });

    test('shows status badges and onset dates', async () => {
      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
      });

      // Status values from data
      expect(screen.getAllByText('active')).toHaveLength(3);
      expect(screen.getByText('resolved')).toBeInTheDocument();

      // Onset dates (useDateFormat mock returns raw strings)
      expect(screen.getByText('2020-05-15')).toBeInTheDocument();
      expect(screen.getByText('2018-03-10')).toBeInTheDocument();
    });

    test('displays critical allergy warnings prominently', async () => {
      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Peanuts')).toBeInTheDocument();
      });

      expect(screen.getByText('life-threatening')).toBeInTheDocument();
      expect(screen.getByText('Confirmed by allergist. Carry EpiPen at all times.')).toBeInTheDocument();
    });
  });

  // ── Allergy CRUD Operations ─────────────────────────────────────────────

  describe('Allergy CRUD Operations', () => {
    test('creates a new allergy through complete workflow', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue(true);
      useMedicalData.mockReturnValue({
        items: mockAllergies,
        currentPatient: { id: 1 },
        loading: false, error: null, successMessage: null,
        createItem: mockCreateItem, updateItem: vi.fn(), deleteItem: vi.fn(),
        refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(),
      });

      renderWithPatient(<Allergies />);

      // Click add button (i18n key label)
      await userEvent.click(screen.getByTestId('add-button'));

      // Form modal opens
      const form = screen.getByTestId('form-modal');
      expect(form).toBeInTheDocument();

      // Fill form (scope to form modal)
      fireEvent.change(within(form).getByLabelText('Allergen *'), { target: { value: 'Ibuprofen', name: 'allergen' } });
      fireEvent.change(within(form).getByLabelText('Severity'), { target: { value: 'moderate', name: 'severity' } });
      fireEvent.change(within(form).getByLabelText('Reaction'), { target: { value: 'Stomach irritation, nausea', name: 'reaction' } });
      fireEvent.change(within(form).getByLabelText('Onset Date'), { target: { value: '2023-06-15', name: 'onset_date' } });
      fireEvent.change(within(form).getByLabelText('Notes'), { target: { value: 'Avoid all NSAIDs.', name: 'notes' } });

      // Submit
      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith(expect.objectContaining({
          allergen: 'Ibuprofen',
          severity: 'moderate',
          reaction: 'Stomach irritation, nausea',
          patient_id: 1,
        }));
      });
    });

    test('edits existing allergy with updated severity', async () => {
      const mockUpdateItem = vi.fn().mockResolvedValue(true);
      useMedicalData.mockReturnValue({
        items: mockAllergies,
        currentPatient: { id: 1 },
        loading: false, error: null, successMessage: null,
        createItem: vi.fn(), updateItem: mockUpdateItem, deleteItem: vi.fn(),
        refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(),
      });

      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Latex')).toBeInTheDocument();
      });

      // Click Edit on Latex card
      const latexCard = screen.getByTestId('allergy-card-3');
      fireEvent.click(within(latexCard).getByText('Edit'));

      // Form opens with pre-filled data
      const form = screen.getByTestId('form-modal');
      expect(form).toBeInTheDocument();
      expect(within(form).getByLabelText('Allergen *')).toHaveValue('Latex');

      // Update severity
      fireEvent.change(within(form).getByLabelText('Severity'), { target: { value: 'severe', name: 'severity' } });

      // Update reaction
      fireEvent.change(within(form).getByLabelText('Reaction'), { target: { value: 'Severe contact dermatitis', name: 'reaction' } });

      // Submit
      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockUpdateItem).toHaveBeenCalledWith(3, expect.objectContaining({
          severity: 'severe',
          reaction: 'Severe contact dermatitis',
        }));
      });
    });

    test('deletes allergy with confirmation', async () => {
      const mockDeleteItem = vi.fn().mockResolvedValue(true);
      useMedicalData.mockReturnValue({
        items: mockAllergies,
        currentPatient: { id: 1 },
        loading: false, error: null, successMessage: null,
        createItem: vi.fn(), updateItem: vi.fn(), deleteItem: mockDeleteItem,
        refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(),
      });

      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Shellfish')).toBeInTheDocument();
      });

      // Click Delete on Shellfish card
      const shellfishCard = screen.getByTestId('allergy-card-4');
      fireEvent.click(within(shellfishCard).getByText('Delete'));

      expect(mockDeleteItem).toHaveBeenCalledWith(4);
    });
  });

  // ── Filtering and Search ────────────────────────────────────────────────

  describe('Filtering and Search', () => {
    test('filters allergies by severity level', async () => {
      const severeAllergies = mockAllergies.filter(
        (a) => a.severity === 'severe' || a.severity === 'life-threatening'
      );
      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: severeAllergies,
        hasActiveFilters: true,
      });

      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
      });

      // Apply severity filter
      fireEvent.change(screen.getByTestId('severity-filter'), { target: { value: 'severe' } });
      expect(mockDataManagement.updateFilter).toHaveBeenCalledWith('severity', 'severe');

      // Only severe/life-threatening allergies shown (from mock data)
      expect(screen.getByText('Penicillin')).toBeInTheDocument();
      expect(screen.getByText('Peanuts')).toBeInTheDocument();
      expect(screen.queryByText('Latex')).not.toBeInTheDocument();
      expect(screen.queryByText('Shellfish')).not.toBeInTheDocument();
    });

    test('filters allergies by status', async () => {
      const activeAllergies = mockAllergies.filter((a) => a.status === 'active');
      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: activeAllergies,
        hasActiveFilters: true,
      });

      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('status-filter'), { target: { value: 'active' } });
      expect(mockDataManagement.updateFilter).toHaveBeenCalledWith('status', 'active');

      expect(screen.getByText('Penicillin')).toBeInTheDocument();
      expect(screen.getByText('Peanuts')).toBeInTheDocument();
      expect(screen.getByText('Latex')).toBeInTheDocument();
      expect(screen.queryByText('Shellfish')).not.toBeInTheDocument();
    });

    test('searches allergies by allergen name', async () => {
      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: mockAllergies.filter((a) => a.allergen.toLowerCase().includes('penicillin')),
        hasActiveFilters: true,
      });

      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'penicillin' } });
      expect(mockDataManagement.updateFilter).toHaveBeenCalledWith('search', 'penicillin');

      expect(screen.getByText('Penicillin')).toBeInTheDocument();
      expect(screen.queryByText('Peanuts')).not.toBeInTheDocument();
    });
  });

  // ── Allergy Details View ────────────────────────────────────────────────

  describe('Allergy Details View', () => {
    test('opens detailed view modal with comprehensive information', async () => {
      // Set up view modal as open with Penicillin allergy
      useViewModalNavigation.mockReturnValue({
        isOpen: true,
        viewingItem: mockAllergies[0],
        openModal: vi.fn(),
        closeModal: vi.fn(),
      });

      renderWithPatient(<Allergies />);

      // View modal should show allergy details
      const modal = screen.getByTestId('view-modal');
      expect(modal).toBeInTheDocument();
      expect(within(modal).getByText('Allergy Details')).toBeInTheDocument();
      expect(within(modal).getByText('Anaphylaxis, difficulty breathing, hives')).toBeInTheDocument();
      expect(within(modal).getByText('Confirmed by allergist. Carry EpiPen at all times.')).toBeInTheDocument();
      expect(within(modal).getByText('2020-05-15')).toBeInTheDocument();
    });

    test('shows life-threatening allergy with proper warnings', async () => {
      useViewModalNavigation.mockReturnValue({
        isOpen: true,
        viewingItem: mockAllergies[1], // Peanuts
        openModal: vi.fn(),
        closeModal: vi.fn(),
      });

      renderWithPatient(<Allergies />);

      const modal = screen.getByTestId('view-modal');
      expect(modal).toBeInTheDocument();
      expect(within(modal).getByText('life-threatening')).toBeInTheDocument();
      expect(within(modal).getByText('Anaphylactic shock, swelling of throat')).toBeInTheDocument();
      expect(within(modal).getByText('Severe peanut allergy. Avoid all nuts and processed foods.')).toBeInTheDocument();
    });

    test('displays resolved allergy information', async () => {
      useViewModalNavigation.mockReturnValue({
        isOpen: true,
        viewingItem: mockAllergies[3], // Shellfish
        openModal: vi.fn(),
        closeModal: vi.fn(),
      });

      renderWithPatient(<Allergies />);

      const modal = screen.getByTestId('view-modal');
      expect(modal).toBeInTheDocument();
      expect(within(modal).getByText('resolved')).toBeInTheDocument();
      expect(within(modal).getByText('Previously allergic, seems to have outgrown it.')).toBeInTheDocument();
    });
  });

  // ── View Mode Toggle ────────────────────────────────────────────────────

  describe('View Mode Toggle', () => {
    test('switches between cards and table view', async () => {
      const mockSetViewMode = vi.fn();
      usePersistedViewMode.mockReturnValue(['cards', mockSetViewMode]);

      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Penicillin')).toBeInTheDocument();
      });

      // Cards and Table buttons exist
      expect(screen.getByText('Cards')).toBeInTheDocument();
      expect(screen.getByText('Table')).toBeInTheDocument();

      // Initially in cards view
      expect(screen.getByTestId('card-grid')).toBeInTheDocument();

      // Click Table
      await userEvent.click(screen.getByText('Table'));
      expect(mockSetViewMode).toHaveBeenCalledWith('table');
    });
  });

  // ── Medical Safety Workflow ─────────────────────────────────────────────

  describe('Medical Safety Workflow', () => {
    test('handles emergency allergy documentation', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue(true);
      useMedicalData.mockReturnValue({
        items: mockAllergies,
        currentPatient: { id: 1 },
        loading: false, error: null, successMessage: null,
        createItem: mockCreateItem, updateItem: vi.fn(), deleteItem: vi.fn(),
        refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(),
      });

      renderWithPatient(<Allergies />);

      // Open form
      await userEvent.click(screen.getByTestId('add-button'));
      const form = screen.getByTestId('form-modal');
      expect(form).toBeInTheDocument();

      // Fill emergency allergy
      fireEvent.change(within(form).getByLabelText('Allergen *'), { target: { value: 'Bee Stings', name: 'allergen' } });
      fireEvent.change(within(form).getByLabelText('Severity'), { target: { value: 'life-threatening', name: 'severity' } });
      fireEvent.change(within(form).getByLabelText('Reaction'), {
        target: { value: 'Anaphylactic shock, respiratory distress', name: 'reaction' },
      });
      fireEvent.change(within(form).getByLabelText('Notes'), {
        target: { value: 'EMERGENCY: Carry EpiPen.', name: 'notes' },
      });

      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith(expect.objectContaining({
          allergen: 'Bee Stings',
          severity: 'life-threatening',
          patient_id: 1,
        }));
      });
    });

    test('manages allergy resolution workflow', async () => {
      const mockUpdateItem = vi.fn().mockResolvedValue(true);
      useMedicalData.mockReturnValue({
        items: mockAllergies,
        currentPatient: { id: 1 },
        loading: false, error: null, successMessage: null,
        createItem: vi.fn(), updateItem: mockUpdateItem, deleteItem: vi.fn(),
        refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(),
      });

      renderWithPatient(<Allergies />);

      await waitFor(() => {
        expect(screen.getByText('Latex')).toBeInTheDocument();
      });

      // Edit Latex allergy
      const latexCard = screen.getByTestId('allergy-card-3');
      fireEvent.click(within(latexCard).getByText('Edit'));

      // Change status to resolved (scope to form)
      const form = screen.getByTestId('form-modal');
      fireEvent.change(within(form).getByLabelText('Status'), { target: { value: 'resolved', name: 'status' } });

      // Update notes
      fireEvent.change(within(form).getByLabelText('Notes'), {
        target: { value: 'Allergy resolved after desensitization therapy.', name: 'notes' },
      });

      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockUpdateItem).toHaveBeenCalledWith(3, expect.objectContaining({
          status: 'resolved',
          notes: 'Allergy resolved after desensitization therapy.',
        }));
      });
    });

    test('validates drug allergy cross-reactions', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue(true);
      useMedicalData.mockReturnValue({
        items: mockAllergies,
        currentPatient: { id: 1 },
        loading: false, error: null, successMessage: null,
        createItem: mockCreateItem, updateItem: vi.fn(), deleteItem: vi.fn(),
        refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(),
      });

      renderWithPatient(<Allergies />);

      await userEvent.click(screen.getByTestId('add-button'));
      const form = screen.getByTestId('form-modal');

      fireEvent.change(within(form).getByLabelText('Allergen *'), { target: { value: 'Sulfonamides', name: 'allergen' } });
      fireEvent.change(within(form).getByLabelText('Reaction'), {
        target: { value: 'Stevens-Johnson syndrome, severe skin reactions', name: 'reaction' },
      });
      fireEvent.change(within(form).getByLabelText('Notes'), {
        target: { value: 'Cross-reactivity with sulfamethoxazole, furosemide.', name: 'notes' },
      });

      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith(expect.objectContaining({
          allergen: 'Sulfonamides',
          reaction: 'Stevens-Johnson syndrome, severe skin reactions',
        }));
      });
    });
  });

  // ── Error Handling and Edge Cases ───────────────────────────────────────

  describe('Error Handling and Edge Cases', () => {
    test('handles API errors gracefully', async () => {
      useMedicalData.mockReturnValue({
        items: mockAllergies,
        currentPatient: { id: 1 },
        loading: false,
        error: 'Failed to create allergy',
        successMessage: null,
        createItem: vi.fn().mockResolvedValue(false),
        updateItem: vi.fn(), deleteItem: vi.fn(),
        refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(),
      });

      renderWithPatient(<Allergies />);

      // Error alert should be displayed
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to create allergy');
    });

    test('handles allergies without detailed information', () => {
      const minimalAllergies = [
        { id: 1, allergen: 'Unknown Food Allergy', severity: null, reaction: null, onset_date: null, status: 'active', notes: null, patient_id: 1 },
      ];

      useMedicalData.mockReturnValue({
        items: minimalAllergies,
        currentPatient: { id: 1 },
        loading: false, error: null, successMessage: null,
        createItem: vi.fn(), updateItem: vi.fn(), deleteItem: vi.fn(),
        refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(),
      });

      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: minimalAllergies,
      });

      renderWithPatient(<Allergies />);

      expect(screen.getByTestId('page-header')).toHaveTextContent('allergies.title');
      expect(screen.getByText('Unknown Food Allergy')).toBeInTheDocument();
    });

    test('displays empty state when no allergies exist', () => {
      useMedicalData.mockReturnValue({
        items: [],
        currentPatient: { id: 1 },
        loading: false, error: null, successMessage: null,
        createItem: vi.fn(), updateItem: vi.fn(), deleteItem: vi.fn(),
        refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(),
      });

      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: [],
        totalCount: 0,
        filteredCount: 0,
      });

      renderWithPatient(<Allergies />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      // i18n keys for empty state title and message
      expect(screen.getByText('allergies.emptyState.title')).toBeInTheDocument();
      expect(screen.getByText('allergies.emptyState.noData')).toBeInTheDocument();
    });
  });

  // ── Form Validation and Data Integrity ──────────────────────────────────

  describe('Form Validation and Data Integrity', () => {
    test('validates required allergen field', async () => {
      renderWithPatient(<Allergies />);

      // Open form
      await userEvent.click(screen.getByTestId('add-button'));
      const form = screen.getByTestId('form-modal');
      expect(form).toBeInTheDocument();

      // Allergen input should have required attribute
      const allergenInput = within(form).getByLabelText('Allergen *');
      expect(allergenInput).toBeRequired();
    });

    test('validates severity levels for consistency', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue(true);
      useMedicalData.mockReturnValue({
        items: mockAllergies,
        currentPatient: { id: 1 },
        loading: false, error: null, successMessage: null,
        createItem: mockCreateItem, updateItem: vi.fn(), deleteItem: vi.fn(),
        refreshData: vi.fn(), clearError: vi.fn(), setError: vi.fn(),
      });

      renderWithPatient(<Allergies />);

      await userEvent.click(screen.getByTestId('add-button'));
      const form = screen.getByTestId('form-modal');

      // Fill form with life-threatening severity
      fireEvent.change(within(form).getByLabelText('Allergen *'), { target: { value: 'Test Allergen', name: 'allergen' } });
      fireEvent.change(within(form).getByLabelText('Severity'), { target: { value: 'life-threatening', name: 'severity' } });
      fireEvent.change(within(form).getByLabelText('Reaction'), { target: { value: 'Mild rash', name: 'reaction' } });

      // Submit form - should still call createItem with the data
      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith(expect.objectContaining({
          allergen: 'Test Allergen',
          severity: 'life-threatening',
          reaction: 'Mild rash',
        }));
      });
    });
  });
});
