import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';

/* ------------------------------------------------------------------ */
/*  vi.hoisted – declare every mock reference used inside vi.mock()    */
/* ------------------------------------------------------------------ */
const {
  useMedicalData,
  useViewModalNavigation,
  usePersistedViewMode,
  getBloodDonationEligibility,
  createItem,
  updateItem,
  deleteItem,
  refreshData,
  clearError,
  setError,
  unitSystemRef,
} = vi.hoisted(() => ({
  useMedicalData: vi.fn(),
  useViewModalNavigation: vi.fn(),
  usePersistedViewMode: vi.fn(),
  getBloodDonationEligibility: vi.fn(),
  createItem: vi.fn(() => Promise.resolve({ id: 99 })),
  updateItem: vi.fn(() => Promise.resolve(true)),
  deleteItem: vi.fn(() => Promise.resolve(true)),
  refreshData: vi.fn(() => Promise.resolve()),
  clearError: vi.fn(),
  setError: vi.fn(),
  unitSystemRef: { current: 'imperial' },
}));

/* ------------------------------------------------------------------ */
/*  vi.mock – every import the page touches                           */
/* ------------------------------------------------------------------ */
vi.mock('../../../hooks/useMedicalData', () => ({ useMedicalData }));
vi.mock('../../../hooks/useViewModalNavigation', () => ({
  useViewModalNavigation,
}));
vi.mock('../../../hooks/usePersistedViewMode', () => ({
  usePersistedViewMode,
}));
vi.mock('../../../hooks/usePagination', () => ({
  usePagination: () => ({
    page: 1,
    setPage: vi.fn(),
    pageSize: 20,
    handlePageSizeChange: vi.fn(),
    paginateData: data => data,
    totalPages: () => 1,
    resetPage: vi.fn(),
    clampPage: vi.fn(),
    PAGE_SIZE_OPTIONS: [{ value: '20', label: '20' }],
  }),
}));
vi.mock('../../../hooks/usePatientPermissions', () => ({
  usePatientPermissions: () => ({
    isViewOnly: false,
    viewOnlyTooltip: undefined,
  }),
}));
vi.mock('../../../contexts/UserPreferencesContext', () => ({
  useUserPreferences: () => ({ unitSystem: unitSystemRef.current }),
}));
vi.mock('../../../services/api', () => ({
  apiService: {
    getBloodDonations: vi.fn(() => Promise.resolve([])),
    getPatientBloodDonations: vi.fn(() => Promise.resolve([])),
    createBloodDonation: vi.fn(() => Promise.resolve({})),
    updateBloodDonation: vi.fn(() => Promise.resolve({})),
    deleteBloodDonation: vi.fn(() => Promise.resolve({})),
    getBloodDonationEligibility,
  },
}));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../hoc/withResponsive', () => ({
  withResponsive: Component => Component,
}));
vi.mock('../../../components', () => ({
  PageHeader: ({ title }) => <div data-testid="page-header">{title}</div>,
}));
vi.mock('../../../components/shared/PaginationControls', () => ({
  default: () => <div data-testid="pagination-controls" />,
}));
vi.mock('../../../components/shared/MedicalPageFilters', () => ({
  default: () => <div data-testid="filters">Filters</div>,
}));
vi.mock('../../../components/shared/MedicalPageActions', () => ({
  default: ({ primaryAction }) => (
    <div data-testid="page-actions">
      <button
        onClick={primaryAction?.onClick}
        disabled={primaryAction?.disabled}
      >
        {primaryAction?.label}
      </button>
    </div>
  ),
}));
vi.mock('../../../components/shared/EmptyState', () => ({
  default: ({ title, actionButton }) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      {actionButton}
    </div>
  ),
}));
vi.mock('../../../components/shared/MedicalPageAlerts', () => ({
  default: ({ error, successMessage }) => (
    <div data-testid="alerts">
      {error && <span data-testid="error-alert">{error}</span>}
      {successMessage && (
        <span data-testid="success-alert">{successMessage}</span>
      )}
    </div>
  ),
}));
vi.mock('../../../components/shared/MedicalPageLoading', () => ({
  default: ({ message }) => <div data-testid="loading">{message}</div>,
}));
vi.mock('../../../components/shared/AnimatedCardGrid', () => ({
  default: ({ items, renderCard }) => (
    <div data-testid="card-grid">
      {items.map(item => (
        <div key={item.id} data-testid={`card-wrapper-${item.id}`}>
          {renderCard(item)}
        </div>
      ))}
    </div>
  ),
}));

// Blood-donation specific components: stub with lightweight, interactive
// stand-ins so the page's own wiring (eligibility fetch, submit validation,
// payload building) can be exercised without pulling in the full Mantine
// form internals (those are covered by the component-level tests already).
vi.mock('../../../components/medical/blood-donations', () => ({
  BloodDonationCard: ({ donation, onEdit }) => (
    <div data-testid={`donation-card-${donation.id}`}>
      {donation.donation_type}
      <button onClick={() => onEdit(donation)}>edit-{donation.id}</button>
    </div>
  ),
  BloodDonationViewModal: ({ isOpen, donation }) =>
    isOpen && donation ? (
      <div data-testid="view-modal">{donation.donation_type}</div>
    ) : null,
  BloodDonationEligibilityCard: ({ eligibility, error }) => {
    if (error) return <div data-testid="eligibility-error">load-error</div>;
    if (!eligibility) return null;
    return (
      <div data-testid="eligibility-card">
        {eligibility.is_eligible
          ? 'eligible-now'
          : `next:${eligibility.next_eligible_date}:days:${eligibility.days_remaining}`}
      </div>
    );
  },
  BloodDonationFormWrapper: ({ isOpen, formData, onInputChange, onSubmit }) => {
    if (!isOpen) return null;
    const setField = (name, value) =>
      onInputChange({ target: { name, value } });
    return (
      <form data-testid="form-wrapper" onSubmit={onSubmit}>
        <input
          data-testid="input-donation_date"
          value={formData.donation_date || ''}
          onChange={e => setField('donation_date', e.target.value)}
        />
        <input
          data-testid="input-donation_type"
          value={formData.donation_type || ''}
          onChange={e => setField('donation_type', e.target.value)}
        />
        <input
          data-testid="input-systolic_bp"
          value={formData.systolic_bp ?? ''}
          onChange={e => setField('systolic_bp', e.target.value)}
        />
        <input
          data-testid="input-diastolic_bp"
          value={formData.diastolic_bp ?? ''}
          onChange={e => setField('diastolic_bp', e.target.value)}
        />
        <input
          data-testid="input-temperature"
          value={formData.temperature ?? ''}
          onChange={e => setField('temperature', e.target.value)}
        />
        <input
          data-testid="input-hemoglobin"
          value={formData.hemoglobin ?? ''}
          onChange={e => setField('hemoglobin', e.target.value)}
        />
        <button type="submit">submit</button>
      </form>
    );
  },
}));

import BloodDonations from '../BloodDonations';

/* ------------------------------------------------------------------ */
/*  Test data / helpers                                                */
/* ------------------------------------------------------------------ */
const mockDonations = [
  {
    id: 1,
    donation_date: '2026-01-01',
    donation_type: 'whole_blood',
    location: 'Red Cross',
    systolic_bp: 120,
    diastolic_bp: 80,
    temperature: 98.6,
    hemoglobin: 14,
    notes: '',
    tags: [],
  },
];

function renderPage() {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <BloodDonations />
      </MemoryRouter>
    </MantineProvider>
  );
}

function setupDefaults({ items = mockDonations } = {}) {
  useMedicalData.mockReturnValue({
    items,
    currentPatient: { id: 1, first_name: 'John', last_name: 'Doe' },
    loading: false,
    error: null,
    successMessage: null,
    createItem,
    updateItem,
    deleteItem,
    refreshData,
    clearError,
    setError,
  });

  useViewModalNavigation.mockReturnValue({
    isOpen: false,
    viewingItem: null,
    openModal: vi.fn(),
    closeModal: vi.fn(),
  });

  usePersistedViewMode.mockReturnValue(['cards', vi.fn()]);

  getBloodDonationEligibility.mockResolvedValue({
    is_eligible: false,
    last_donation_date: '2025-11-01',
    last_donation_type: 'whole_blood',
    interval_days: 56,
    next_eligible_date: '2026-01-27',
    days_remaining: 5,
  });
}

async function openAddForm(user) {
  await user.click(screen.getByText('+ Add Donation'));
  expect(await screen.findByTestId('form-wrapper')).toBeInTheDocument();
}

describe('BloodDonations page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unitSystemRef.current = 'imperial';
    setupDefaults();
  });

  it('renders the eligibility card from the data apiService.getBloodDonationEligibility resolves', async () => {
    renderPage();

    expect(getBloodDonationEligibility).toHaveBeenCalledWith(
      1,
      expect.anything()
    );

    expect(await screen.findByTestId('eligibility-card')).toHaveTextContent(
      'next:2026-01-27:days:5'
    );
  });

  it('shows the eligibility load error state when the eligibility fetch rejects', async () => {
    getBloodDonationEligibility.mockReset();
    getBloodDonationEligibility.mockRejectedValue(new Error('boom'));

    renderPage();

    expect(await screen.findByTestId('eligibility-error')).toBeInTheDocument();
  });

  it('shows an out-of-range error and does not call createItem when systolic is 300', async () => {
    const user = userEvent.setup();
    renderPage();

    await openAddForm(user);

    await user.type(screen.getByTestId('input-donation_date'), '2026-01-15');
    await user.type(screen.getByTestId('input-systolic_bp'), '300');

    await user.click(screen.getByText('submit'));

    await waitFor(() => {
      expect(setError).toHaveBeenCalledWith(
        'Systolic (mmHg) must be between 60 and 250'
      );
    });
    expect(createItem).not.toHaveBeenCalled();
  });

  it('calls createItem with temperature converted to Fahrenheit for a metric user', async () => {
    unitSystemRef.current = 'metric';
    const user = userEvent.setup();
    renderPage();

    await openAddForm(user);

    await user.type(screen.getByTestId('input-donation_date'), '2026-01-15');
    await user.type(screen.getByTestId('input-temperature'), '37');

    await user.click(screen.getByText('submit'));

    await waitFor(() => {
      expect(createItem).toHaveBeenCalledTimes(1);
    });

    expect(setError).not.toHaveBeenCalled();
    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        donation_date: '2026-01-15',
        donation_type: 'whole_blood',
        systolic_bp: null,
        diastolic_bp: null,
        hemoglobin: null,
        temperature: 98.6,
        patient_id: 1,
      })
    );
  });

  it('pre-fills the edit form with a converted temperature for a metric user', async () => {
    unitSystemRef.current = 'metric';
    const user = userEvent.setup();
    setupDefaults({
      items: [
        {
          ...mockDonations[0],
          temperature: 98.6, // stored in Fahrenheit; 98.6F == 37C
        },
      ],
    });
    renderPage();

    await user.click(screen.getByText('edit-1'));

    expect(await screen.findByTestId('form-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('input-temperature')).toHaveValue('37');
  });

  it('clears the previous patient eligibility card when the patient changes, until the new one resolves', async () => {
    getBloodDonationEligibility.mockImplementation(patientId => {
      if (patientId === 1) {
        return Promise.resolve({
          is_eligible: false,
          last_donation_date: '2025-11-01',
          last_donation_type: 'whole_blood',
          interval_days: 56,
          next_eligible_date: '2026-01-27',
          days_remaining: 5,
        });
      }
      // Patient 2's request never resolves within this test, so the
      // assertions below only hold if the page clears the old state up
      // front rather than waiting on the new response.
      return new Promise(() => {});
    });

    const { rerender } = renderPage();

    expect(await screen.findByTestId('eligibility-card')).toHaveTextContent(
      'next:2026-01-27:days:5'
    );

    useMedicalData.mockReturnValue({
      items: mockDonations,
      currentPatient: { id: 2, first_name: 'Jane', last_name: 'Roe' },
      loading: false,
      error: null,
      successMessage: null,
      createItem,
      updateItem,
      deleteItem,
      refreshData,
      clearError,
      setError,
    });

    rerender(
      <MantineProvider>
        <MemoryRouter>
          <BloodDonations />
        </MemoryRouter>
      </MantineProvider>
    );

    expect(screen.queryByTestId('eligibility-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('eligibility-error')).not.toBeInTheDocument();
    expect(getBloodDonationEligibility).toHaveBeenLastCalledWith(
      2,
      expect.anything()
    );
  });
});
