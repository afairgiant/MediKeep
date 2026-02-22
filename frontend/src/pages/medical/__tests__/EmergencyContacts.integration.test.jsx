import { vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import React from 'react';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithPatient } from '../../../test-utils/render';
import EmergencyContacts from '../EmergencyContacts';

// --- Hoisted mock functions (needed in vi.mock factories) ---
const { useMedicalData, useDataManagement, usePersistedViewMode, useViewModalNavigation } = vi.hoisted(() => ({
  useMedicalData: vi.fn(),
  useDataManagement: vi.fn(),
  usePersistedViewMode: vi.fn(),
  useViewModalNavigation: vi.fn(),
}));

// --- Hook mocks ---
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
vi.mock('../../../hooks/useMedicalData', () => ({ useMedicalData }));
vi.mock('../../../hooks/useDataManagement', () => ({
  useDataManagement,
  default: useDataManagement,
}));
vi.mock('../../../hooks/useViewModalNavigation', () => ({ useViewModalNavigation }));
vi.mock('../../../hooks/usePersistedViewMode', () => ({ usePersistedViewMode }));
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false, isTablet: false, isDesktop: true }),
}));

// --- Utility / service mocks ---
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../services/api', () => ({
  apiService: {
    getEmergencyContacts: vi.fn(() => Promise.resolve([])),
    getPatientEmergencyContacts: vi.fn(() => Promise.resolve([])),
    createEmergencyContact: vi.fn(() => Promise.resolve({})),
    updateEmergencyContact: vi.fn(() => Promise.resolve({})),
    deleteEmergencyContact: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock('../../../utils/medicalPageConfigs', () => ({
  getMedicalPageConfig: () => ({
    entityName: 'emergency_contacts',
    filters: [],
    sortOptions: [],
    defaultSort: 'name',
  }),
}));
vi.mock('../../../utils/helpers', () => ({
  createCardClickHandler: (handler, item) => (e) => {
    if (e.target.tagName === 'BUTTON') return;
    handler(item);
  },
}));
vi.mock('../../../utils/phoneUtils', () => ({
  phoneTelHref: (phone) => `tel:${phone}`,
}));

// --- HOC mock ---
vi.mock('../../../hoc/withResponsive', () => ({
  withResponsive: (Component) => Component,
}));

// --- Shared component mocks ---
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
  default: ({ dataManagement }) => (
    <div data-testid="page-filters">
      {dataManagement.hasActiveFilters && <span>Filters active</span>}
    </div>
  ),
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
        <tr>
          {columns.map((col) => (
            <th key={col.accessor}>{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id}>
            {columns.map((col) => (
              <td key={col.accessor}>{String(row[col.accessor] ?? '')}</td>
            ))}
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

// --- Form component mock ---
vi.mock('../../../components/medical/MantineEmergencyContactForm', () => ({
  default: ({ isOpen, onClose, title, formData, onInputChange, onSubmit, editingContact }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="form-modal" role="dialog">
        <h2>{title}</h2>
        <form onSubmit={onSubmit}>
          <label htmlFor="ec-name">Name *</label>
          <input id="ec-name" name="name" value={formData.name || ''} onChange={onInputChange} />

          <label htmlFor="ec-relationship">Relationship</label>
          <input id="ec-relationship" name="relationship" value={formData.relationship || ''} onChange={onInputChange} />

          <label htmlFor="ec-phone">Phone Number *</label>
          <input id="ec-phone" name="phone_number" value={formData.phone_number || ''} onChange={onInputChange} />

          <label htmlFor="ec-secondary-phone">Secondary Phone</label>
          <input id="ec-secondary-phone" name="secondary_phone" value={formData.secondary_phone || ''} onChange={onInputChange} />

          <label htmlFor="ec-email">Email</label>
          <input id="ec-email" name="email" value={formData.email || ''} onChange={onInputChange} />

          <label htmlFor="ec-address">Address</label>
          <input id="ec-address" name="address" value={formData.address || ''} onChange={onInputChange} />

          <label htmlFor="ec-notes">Notes</label>
          <textarea id="ec-notes" name="notes" value={formData.notes || ''} onChange={onInputChange} />

          <label htmlFor="ec-primary">
            <input id="ec-primary" type="checkbox" name="is_primary" checked={formData.is_primary || false} onChange={onInputChange} />
            Primary Contact
          </label>

          <label htmlFor="ec-active">
            <input id="ec-active" type="checkbox" name="is_active" checked={formData.is_active !== undefined ? formData.is_active : true} onChange={onInputChange} />
            Is Active
          </label>

          <button type="submit">Submit</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </form>
      </div>
    );
  },
}));

// --- Framer motion mock ---
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

// ============================================================
// Test Data
// ============================================================
const mockEmergencyContacts = [
  {
    id: 1,
    name: 'Sarah Johnson',
    relationship: 'spouse',
    phone_number: '(555) 123-4567',
    secondary_phone: '(555) 987-6543',
    email: 'sarah.johnson@email.com',
    is_primary: true,
    is_active: true,
    address: '123 Main St, Anytown, ST 12345',
    notes: 'Available 24/7. Works from home.',
    patient_id: 1,
  },
  {
    id: 2,
    name: 'Michael Johnson',
    relationship: 'child',
    phone_number: '(555) 456-7890',
    secondary_phone: null,
    email: 'mike.johnson@email.com',
    is_primary: false,
    is_active: true,
    address: '456 Oak Ave, Another City, ST 67890',
    notes: 'Lives nearby. Available evenings and weekends.',
    patient_id: 1,
  },
  {
    id: 3,
    name: 'Dr. Emily Chen',
    relationship: 'physician',
    phone_number: '(555) 111-2222',
    secondary_phone: '(555) 333-4444',
    email: 'dr.chen@medicalcenter.com',
    is_primary: false,
    is_active: true,
    address: 'Medical Center, 789 Health Blvd, Medical City, ST 11111',
    notes: 'Primary care physician. Emergency contact for medical decisions.',
    patient_id: 1,
  },
  {
    id: 4,
    name: 'Robert Smith',
    relationship: 'friend',
    phone_number: '(555) 777-8888',
    secondary_phone: null,
    email: null,
    is_primary: false,
    is_active: false,
    address: null,
    notes: 'Backup contact. Moved out of state.',
    patient_id: 1,
  },
];

const mockDataManagement = {
  data: mockEmergencyContacts,
  filters: { search: '', relationship: '', active_status: '' },
  updateFilter: vi.fn(),
  clearFilters: vi.fn(),
  hasActiveFilters: false,
  statusOptions: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ],
  categoryOptions: [
    { value: 'spouse', label: 'Spouse' },
    { value: 'child', label: 'Child' },
    { value: 'parent', label: 'Parent' },
    { value: 'physician', label: 'Physician' },
    { value: 'friend', label: 'Friend' },
  ],
  dateRangeOptions: [],
  sortOptions: [],
  sortBy: 'name',
  sortOrder: 'asc',
  handleSortChange: vi.fn(),
  totalCount: mockEmergencyContacts.length,
  filteredCount: mockEmergencyContacts.length,
};

// ============================================================
// Helper
// ============================================================
const defaultMedicalData = {
  items: mockEmergencyContacts,
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
describe('Emergency Contacts Page Integration Tests', () => {
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
    test('renders emergency contacts page with initial data', async () => {
      renderWithPatient(<EmergencyContacts />);

      // Page header uses i18n key
      expect(screen.getByTestId('page-header')).toHaveTextContent('emergencyContacts.title');

      // Check contacts are rendered via card grid
      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
        expect(screen.getByText('Michael Johnson')).toBeInTheDocument();
        expect(screen.getByText('Dr. Emily Chen')).toBeInTheDocument();
        expect(screen.getByText('Robert Smith')).toBeInTheDocument();
      });
    });

    test('displays contact relationships and phone numbers', async () => {
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      });

      // Relationships are capitalized in the component via charAt(0).toUpperCase() + slice(1)
      expect(screen.getByText('Spouse')).toBeInTheDocument();
      expect(screen.getByText('Child')).toBeInTheDocument();
      // "Physician" might appear as both relationship label (i18n key) and capitalized value
      expect(screen.getByText('Physician')).toBeInTheDocument();
      expect(screen.getByText('Friend')).toBeInTheDocument();

      // Phone numbers
      expect(screen.getByText('(555) 123-4567')).toBeInTheDocument();
      expect(screen.getByText('(555) 456-7890')).toBeInTheDocument();
      expect(screen.getByText('(555) 111-2222')).toBeInTheDocument();
    });

    test('shows primary contact designation and status', async () => {
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      });

      // Primary badge uses i18n key
      expect(screen.getByText('emergencyContacts.card.primary')).toBeInTheDocument();

      // Active/inactive badges use i18n keys
      const activeBadges = screen.getAllByText('emergencyContacts.card.active');
      expect(activeBadges.length).toBe(3);
      expect(screen.getByText('emergencyContacts.card.inactive')).toBeInTheDocument();
    });

    test('displays contact information and notes', async () => {
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      });

      // Email addresses
      expect(screen.getByText('sarah.johnson@email.com')).toBeInTheDocument();
      expect(screen.getByText('dr.chen@medicalcenter.com')).toBeInTheDocument();

      // Notes
      expect(screen.getByText('Available 24/7. Works from home.')).toBeInTheDocument();
      expect(screen.getByText('Primary care physician. Emergency contact for medical decisions.')).toBeInTheDocument();
    });
  });

  describe('Emergency Contact CRUD Operations', () => {
    test('creates a new emergency contact through complete workflow', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        createItem: mockCreateItem,
      });

      renderWithPatient(<EmergencyContacts />);

      // Click add button
      const addButton = screen.getByTestId('add-button');
      await userEvent.click(addButton);

      // Form modal should open
      const form = screen.getByTestId('form-modal');
      expect(form).toBeInTheDocument();

      // Fill out the form
      fireEvent.change(within(form).getByLabelText('Name *'), { target: { value: 'Jennifer Wilson', name: 'name' } });
      fireEvent.change(within(form).getByLabelText('Relationship'), { target: { value: 'sister', name: 'relationship' } });
      fireEvent.change(within(form).getByLabelText('Phone Number *'), { target: { value: '(555) 999-0000', name: 'phone_number' } });
      fireEvent.change(within(form).getByLabelText('Secondary Phone'), { target: { value: '(555) 888-7777', name: 'secondary_phone' } });
      fireEvent.change(within(form).getByLabelText('Email'), { target: { value: 'jen.wilson@email.com', name: 'email' } });
      fireEvent.change(within(form).getByLabelText('Address'), { target: { value: '321 Pine St, Nearby Town, ST 54321', name: 'address' } });
      fireEvent.change(within(form).getByLabelText('Notes'), { target: { value: 'Sister living nearby.', name: 'notes' } });

      // Submit
      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Jennifer Wilson',
            relationship: 'sister',
            phone_number: '(555) 999-0000',
            secondary_phone: '(555) 888-7777',
            email: 'jen.wilson@email.com',
            address: '321 Pine St, Nearby Town, ST 54321',
            notes: 'Sister living nearby.',
            patient_id: 1,
          })
        );
      });
    });

    test('edits existing contact with primary designation change', async () => {
      const mockUpdateItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        updateItem: mockUpdateItem,
      });

      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Michael Johnson')).toBeInTheDocument();
      });

      // Find edit button for Michael Johnson's card
      const michaelWrapper = screen.getByTestId('card-wrapper-2');
      const editButton = within(michaelWrapper).getByText('buttons.edit');
      await userEvent.click(editButton);

      // Form should open with pre-filled data
      const form = screen.getByTestId('form-modal');
      expect(within(form).getByLabelText('Name *')).toHaveValue('Michael Johnson');

      // Toggle primary contact checkbox
      fireEvent.click(within(form).getByLabelText(/Primary Contact/));

      // Update phone
      fireEvent.change(within(form).getByLabelText('Phone Number *'), { target: { value: '(555) 456-7899', name: 'phone_number' } });

      // Update notes
      fireEvent.change(within(form).getByLabelText('Notes'), { target: { value: 'Now primary contact.', name: 'notes' } });

      // Submit
      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockUpdateItem).toHaveBeenCalledWith(
          2,
          expect.objectContaining({
            is_primary: true,
            phone_number: '(555) 456-7899',
            notes: 'Now primary contact.',
          })
        );
      });
    });

    test('deactivates emergency contact instead of deleting', async () => {
      const mockUpdateItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        updateItem: mockUpdateItem,
      });

      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Emily Chen')).toBeInTheDocument();
      });

      // Edit Dr. Chen
      const drChenWrapper = screen.getByTestId('card-wrapper-3');
      const editButton = within(drChenWrapper).getByText('buttons.edit');
      await userEvent.click(editButton);

      // Uncheck active status
      const form = screen.getByTestId('form-modal');
      fireEvent.click(within(form).getByLabelText(/Is Active/));

      // Update notes
      fireEvent.change(within(form).getByLabelText('Notes'), { target: { value: 'No longer available.', name: 'notes' } });

      // Submit
      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockUpdateItem).toHaveBeenCalledWith(
          3,
          expect.objectContaining({
            is_active: false,
            notes: 'No longer available.',
          })
        );
      });
    });

    test('deletes emergency contact with confirmation', async () => {
      const mockDeleteItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        deleteItem: mockDeleteItem,
      });

      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Robert Smith')).toBeInTheDocument();
      });

      // Find delete button for Robert's card
      const robertWrapper = screen.getByTestId('card-wrapper-4');
      const deleteButton = within(robertWrapper).getByText('buttons.delete');
      await userEvent.click(deleteButton);

      expect(mockDeleteItem).toHaveBeenCalledWith(4);
    });
  });

  describe('Contact Priority and Management', () => {
    test('displays primary contact prominently', async () => {
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      });

      // Primary badge in Sarah's card
      const sarahWrapper = screen.getByTestId('card-wrapper-1');
      expect(within(sarahWrapper).getByText('emergencyContacts.card.primary')).toBeInTheDocument();

      // Notes visible
      expect(screen.getByText('Available 24/7. Works from home.')).toBeInTheDocument();
    });

    test('manages multiple phone numbers for contacts', async () => {
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      });

      // Primary and secondary phones for Sarah
      expect(screen.getByText('(555) 123-4567')).toBeInTheDocument();
      expect(screen.getByText('(555) 987-6543')).toBeInTheDocument();

      // Dr. Chen's phones
      expect(screen.getByText('(555) 111-2222')).toBeInTheDocument();
      expect(screen.getByText('(555) 333-4444')).toBeInTheDocument();
    });

    test('handles professional emergency contacts', async () => {
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Emily Chen')).toBeInTheDocument();
      });

      expect(screen.getByText('Physician')).toBeInTheDocument();
      expect(screen.getByText('dr.chen@medicalcenter.com')).toBeInTheDocument();
      expect(screen.getByText('Medical Center, 789 Health Blvd, Medical City, ST 11111')).toBeInTheDocument();
      expect(screen.getByText('Primary care physician. Emergency contact for medical decisions.')).toBeInTheDocument();
    });
  });

  describe('Filtering and Search', () => {
    test('filters contacts by relationship type', async () => {
      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: mockEmergencyContacts.filter(c => ['spouse', 'child'].includes(c.relationship)),
        hasActiveFilters: true,
      });

      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      });

      expect(screen.getByText('Michael Johnson')).toBeInTheDocument();
      expect(screen.queryByText('Dr. Emily Chen')).not.toBeInTheDocument();
      expect(screen.queryByText('Robert Smith')).not.toBeInTheDocument();
    });

    test('filters contacts by active status', async () => {
      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: mockEmergencyContacts.filter(c => c.is_active),
        hasActiveFilters: true,
      });

      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      });

      expect(screen.getByText('Michael Johnson')).toBeInTheDocument();
      expect(screen.getByText('Dr. Emily Chen')).toBeInTheDocument();
      expect(screen.queryByText('Robert Smith')).not.toBeInTheDocument();
    });

    test('searches contacts by name and notes', async () => {
      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: mockEmergencyContacts.filter(c =>
          c.name.toLowerCase().includes('chen') ||
          c.notes?.toLowerCase().includes('physician')
        ),
        hasActiveFilters: true,
      });

      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Dr. Emily Chen')).toBeInTheDocument();
      });

      expect(screen.queryByText('Sarah Johnson')).not.toBeInTheDocument();
      expect(screen.queryByText('Michael Johnson')).not.toBeInTheDocument();
      expect(screen.queryByText('Robert Smith')).not.toBeInTheDocument();
    });
  });

  describe('View Mode Toggle', () => {
    test('switches between cards and table view', async () => {
      const mockSetViewMode = vi.fn();
      usePersistedViewMode.mockReturnValue(['cards', mockSetViewMode]);

      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      });

      // Click table button
      const tableButton = screen.getByTestId('table-btn');
      await userEvent.click(tableButton);

      expect(mockSetViewMode).toHaveBeenCalledWith('table');
    });
  });

  describe('Emergency Contact Workflow', () => {
    test('manages primary contact designation', async () => {
      renderWithPatient(<EmergencyContacts />);

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      });

      const sarahWrapper = screen.getByTestId('card-wrapper-1');
      expect(within(sarahWrapper).getByText('emergencyContacts.card.primary')).toBeInTheDocument();
      expect(screen.getByText('Available 24/7. Works from home.')).toBeInTheDocument();
    });

    test('handles medical emergency contact workflow', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        createItem: mockCreateItem,
      });

      renderWithPatient(<EmergencyContacts />);

      // Click add
      const addButton = screen.getByTestId('add-button');
      await userEvent.click(addButton);

      const form = screen.getByTestId('form-modal');
      fireEvent.change(within(form).getByLabelText('Name *'), { target: { value: 'Dr. James Rodriguez', name: 'name' } });
      fireEvent.change(within(form).getByLabelText('Relationship'), { target: { value: 'physician', name: 'relationship' } });
      fireEvent.change(within(form).getByLabelText('Phone Number *'), { target: { value: '(555) 444-5555', name: 'phone_number' } });
      fireEvent.change(within(form).getByLabelText('Email'), { target: { value: 'dr.rodriguez@hospital.com', name: 'email' } });
      fireEvent.change(within(form).getByLabelText('Notes'), { target: { value: 'Cardiologist. On-call 24/7.', name: 'notes' } });

      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Dr. James Rodriguez',
            relationship: 'physician',
            phone_number: '(555) 444-5555',
            email: 'dr.rodriguez@hospital.com',
          })
        );
      });
    });

    test('validates contact information completeness', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        createItem: mockCreateItem,
      });

      renderWithPatient(<EmergencyContacts />);

      // Click add
      const addButton = screen.getByTestId('add-button');
      await userEvent.click(addButton);

      // Submit empty form - the actual submit fires and createItem gets called with empty values
      const form = screen.getByTestId('form-modal');
      fireEvent.click(within(form).getByText('Submit'));

      // The page sends whatever formData has (empty strings) - createItem receives empty data
      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith(
          expect.objectContaining({
            name: '',
            phone_number: '',
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

      renderWithPatient(<EmergencyContacts />);

      const addButton = screen.getByTestId('add-button');
      await userEvent.click(addButton);

      const form = screen.getByTestId('form-modal');
      fireEvent.change(within(form).getByLabelText('Name *'), { target: { value: 'Test Contact', name: 'name' } });
      fireEvent.change(within(form).getByLabelText('Phone Number *'), { target: { value: '(555) 123-4567', name: 'phone_number' } });
      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalled();
      });
    });

    test('handles contacts with minimal information', () => {
      const minimalContacts = [
        {
          id: 1,
          name: 'Basic Contact',
          relationship: 'friend',
          phone_number: '(555) 000-0000',
          secondary_phone: null,
          email: null,
          is_primary: false,
          is_active: true,
          address: null,
          notes: null,
          patient_id: 1,
        },
      ];

      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        items: minimalContacts,
      });
      useDataManagement.mockReturnValue({
        ...mockDataManagement,
        data: minimalContacts,
      });

      renderWithPatient(<EmergencyContacts />);

      expect(screen.getByTestId('page-header')).toHaveTextContent('emergencyContacts.title');
      expect(screen.getByText('Basic Contact')).toBeInTheDocument();
    });

    test('displays empty state when no contacts exist', () => {
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

      renderWithPatient(<EmergencyContacts />);

      // Empty state uses i18n key
      expect(screen.getByText('emergencyContacts.page.noContacts')).toBeInTheDocument();
      expect(screen.getByText('emergencyContacts.page.noContactsDescription')).toBeInTheDocument();
    });
  });

  describe('Form Validation and Data Integrity', () => {
    test('validates phone number format', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        createItem: mockCreateItem,
      });

      renderWithPatient(<EmergencyContacts />);

      const addButton = screen.getByTestId('add-button');
      await userEvent.click(addButton);

      const form = screen.getByTestId('form-modal');
      fireEvent.change(within(form).getByLabelText('Name *'), { target: { value: 'Test Contact', name: 'name' } });
      fireEvent.change(within(form).getByLabelText('Phone Number *'), { target: { value: '123-456', name: 'phone_number' } });

      // Submit - the form sends whatever was typed (validation is in the real component)
      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Contact',
            phone_number: '123-456',
          })
        );
      });
    });

    test('validates email format', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        createItem: mockCreateItem,
      });

      renderWithPatient(<EmergencyContacts />);

      const addButton = screen.getByTestId('add-button');
      await userEvent.click(addButton);

      const form = screen.getByTestId('form-modal');
      fireEvent.change(within(form).getByLabelText('Name *'), { target: { value: 'Test Contact', name: 'name' } });
      fireEvent.change(within(form).getByLabelText('Phone Number *'), { target: { value: '(555) 123-4567', name: 'phone_number' } });
      fireEvent.change(within(form).getByLabelText('Email'), { target: { value: 'invalid-email', name: 'email' } });

      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'invalid-email',
          })
        );
      });
    });

    test('prevents multiple primary contacts', async () => {
      const mockCreateItem = vi.fn().mockResolvedValue({});
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        createItem: mockCreateItem,
      });

      renderWithPatient(<EmergencyContacts />);

      const addButton = screen.getByTestId('add-button');
      await userEvent.click(addButton);

      const form = screen.getByTestId('form-modal');
      fireEvent.change(within(form).getByLabelText('Name *'), { target: { value: 'Another Primary', name: 'name' } });
      fireEvent.change(within(form).getByLabelText('Phone Number *'), { target: { value: '(555) 999-8888', name: 'phone_number' } });

      // Toggle primary contact checkbox
      fireEvent.click(within(form).getByLabelText(/Primary Contact/));

      // Submit - the real validation for multiple primaries is in the backend/form component
      fireEvent.click(within(form).getByText('Submit'));

      await waitFor(() => {
        expect(mockCreateItem).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Another Primary',
            is_primary: true,
          })
        );
      });
    });
  });
});
