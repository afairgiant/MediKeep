import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

/* ------------------------------------------------------------------ */
/*  vi.hoisted – declare every mock reference used inside vi.mock()   */
/* ------------------------------------------------------------------ */
const {
  useMedicalData,
  useDataManagement,
  useEntityFileCounts,
  useViewModalNavigation,
  usePersistedViewMode,
  usePatientWithStaticData,
  useDateFormat,
  useResponsive,
  useFormSubmissionWithUploads,
  lastResponsiveTableProps,
} = vi.hoisted(() => ({
  useMedicalData: vi.fn(),
  useDataManagement: vi.fn(),
  useEntityFileCounts: vi.fn(),
  useViewModalNavigation: vi.fn(),
  usePersistedViewMode: vi.fn(),
  usePatientWithStaticData: vi.fn(),
  useDateFormat: vi.fn(),
  useResponsive: vi.fn(),
  useFormSubmissionWithUploads: vi.fn(),
  lastResponsiveTableProps: { current: null },
}));

/* ------------------------------------------------------------------ */
/*  vi.mock – every import the component touches                      */
/* ------------------------------------------------------------------ */
vi.mock('../../../hooks/useMedicalData', () => ({ useMedicalData }));
vi.mock('../../../hooks/useDataManagement', () => ({
  useDataManagement,
  default: useDataManagement,
}));
vi.mock('../../../hooks/useEntityFileCounts', () => ({ useEntityFileCounts }));
vi.mock('../../../hooks/useViewModalNavigation', () => ({
  useViewModalNavigation,
  default: useViewModalNavigation,
}));
vi.mock('../../../hooks/usePersistedViewMode', () => ({
  usePersistedViewMode,
}));
vi.mock('../../../hooks/useGlobalData', () => ({
  usePatientWithStaticData,
  useCurrentPatient: () => ({
    patient: { id: 1, owner_user_id: 1, permission_level: 'full' },
    loading: false,
  }),
}));
vi.mock('../../../hooks/usePatientPermissions', () => ({
  usePatientPermissions: () => ({
    isOwner: true,
    permissionLevel: 'full',
    canCreate: true,
    canEdit: true,
    canDelete: true,
    isViewOnly: false,
    viewOnlyTooltip: undefined,
  }),
}));
vi.mock('../../../hooks/useDateFormat', () => ({ useDateFormat }));
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive,
  default: useResponsive,
}));
vi.mock('../../../hooks/useFormSubmissionWithUploads', () => ({
  useFormSubmissionWithUploads,
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

vi.mock('../../../services/api', () => ({
  apiService: {
    getTreatments: vi.fn(() => Promise.resolve([])),
    getPatientTreatments: vi.fn(() => Promise.resolve([])),
    createTreatment: vi.fn(() => Promise.resolve({})),
    updateTreatment: vi.fn(() => Promise.resolve({})),
    deleteTreatment: vi.fn(() => Promise.resolve({})),
    getConditions: vi.fn(() => Promise.resolve([])),
    getPatientConditions: vi.fn(() => Promise.resolve([])),
  },
}));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn(), clean: vi.fn() },
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, _fallback) => key,
    i18n: { language: 'en' },
  }),
}));
vi.mock('../../../utils/tableFormatters', () => ({
  getEntityFormatters: vi.fn(() => ({})),
}));
vi.mock('../../../hoc/withResponsive', () => ({
  withResponsive: Component => Component,
}));
vi.mock('@mantine/core', () => ({
  MantineProvider: ({ children }) => <div>{children}</div>,
  Button: ({ children, onClick, disabled, ...rest }) => (
    <button onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
  Stack: ({ children }) => <div>{children}</div>,
  Text: ({ children }) => <span>{children}</span>,
  Container: ({ children }) => <div>{children}</div>,
  Card: ({ children }) => <div>{children}</div>,
  Paper: ({ children }) => <div>{children}</div>,
  Alert: ({ children }) => <div>{children}</div>,
  createTheme: () => ({}),
  useMantineColorScheme: () => ({
    colorScheme: 'light',
    setColorScheme: vi.fn(),
  }),
}));
vi.mock('../../../components/shared/PaginationControls', () => ({
  default: () => <div data-testid="pagination-controls" />,
}));
vi.mock('../../../components', () => ({
  PageHeader: ({ title }) => <div data-testid="page-header">{title}</div>,
}));
vi.mock('../../../components/shared/MedicalPageFilters', () => ({
  default: () => <div data-testid="filters">Filters</div>,
}));
vi.mock('../../../components/shared/MedicalPageActions', () => ({
  default: ({ primaryAction, viewMode }) => (
    <div data-testid="page-actions">
      <button onClick={primaryAction?.onClick}>{primaryAction?.label}</button>
      <span data-testid="view-mode">{viewMode}</span>
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
// ResponsiveTable — captures the props Treatments.jsx passes it (sortBy/
// sortDirection/onSort) so tests can exercise the practitioner<->
// practitioner_name column alias without needing a real Mantine table.
vi.mock('../../../components/adapters', () => ({
  ResponsiveTable: props => {
    lastResponsiveTableProps.current = props;
    return <div data-testid="responsive-table">Table</div>;
  },
}));
vi.mock('../../../components/medical/treatments/TreatmentCard', () => ({
  default: ({ treatment }) => (
    <div data-testid={`treatment-card-${treatment.id}`}>
      {treatment.treatment_name}
    </div>
  ),
}));
vi.mock('../../../components/medical/treatments/TreatmentViewModal', () => ({
  default: ({ isOpen, treatment }) =>
    isOpen && treatment ? (
      <div data-testid="view-modal">{treatment.treatment_name}</div>
    ) : null,
}));
vi.mock('../../../components/medical/treatments/TreatmentFormWrapper', () => ({
  default: ({ isOpen }) =>
    isOpen ? <div data-testid="form-wrapper">Form</div> : null,
}));

import render from '../../../test-utils/render';
import Treatments from '../Treatments';

/* ------------------------------------------------------------------ */
/*  Test data                                                          */
/* ------------------------------------------------------------------ */
const mockTreatments = [
  {
    id: 1,
    treatment_name: 'Physical Therapy',
    treatment_type: 'therapy',
    status: 'active',
    start_date: '2024-01-01',
    end_date: null,
    practitioner_id: 1,
    condition_id: null,
    patient_id: 1,
  },
  {
    id: 2,
    treatment_name: 'Chemotherapy',
    treatment_type: 'medication',
    status: 'completed',
    start_date: '2023-11-01',
    end_date: '2024-01-01',
    practitioner_id: 2,
    condition_id: null,
    patient_id: 1,
  },
];

const mockPractitioners = [
  { id: 1, name: 'Dr. Wilson', specialty: 'Oncology' },
  { id: 2, name: 'Dr. Martinez', specialty: 'Physical Medicine' },
];

const mockDataManagement = {
  data: mockTreatments,
  filters: {},
  updateFilter: vi.fn(),
  clearFilters: vi.fn(),
  hasActiveFilters: false,
  statusOptions: [],
  categoryOptions: [],
  practitionerOptions: [],
  sortOptions: [],
  sortBy: 'start_date',
  sortOrder: 'desc',
  handleSortChange: vi.fn(),
  totalCount: mockTreatments.length,
  filteredCount: mockTreatments.length,
};

function setupDefaults({
  items = mockTreatments,
  dataManagementOverrides = {},
} = {}) {
  useMedicalData.mockImplementation(options => {
    if (options.entityName === 'conditionsDropdown') {
      return {
        items: [],
        loading: false,
        error: null,
      };
    }
    return {
      items,
      currentPatient: { id: 1, first_name: 'John', last_name: 'Doe' },
      loading: false,
      error: null,
      successMessage: null,
      createItem: vi.fn(() => Promise.resolve({ id: 99 })),
      updateItem: vi.fn(() => Promise.resolve(true)),
      deleteItem: vi.fn(() => Promise.resolve(true)),
      refreshData: vi.fn(),
      clearError: vi.fn(),
      setError: vi.fn(),
    };
  });

  useDataManagement.mockReturnValue({
    ...mockDataManagement,
    data: items,
    ...dataManagementOverrides,
  });

  useEntityFileCounts.mockReturnValue({
    fileCounts: {},
    fileCountsLoading: {},
    cleanupFileCount: vi.fn(),
    refreshFileCount: vi.fn(),
  });

  useViewModalNavigation.mockReturnValue({
    isOpen: false,
    viewingItem: null,
    openModal: vi.fn(),
    closeModal: vi.fn(),
  });

  usePersistedViewMode.mockReturnValue(['table', vi.fn()]);

  usePatientWithStaticData.mockReturnValue({
    practitioners: { practitioners: mockPractitioners },
    pharmacies: { pharmacies: [] },
  });

  useDateFormat.mockReturnValue({ formatDate: d => d || '' });

  useResponsive.mockReturnValue({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  });

  useFormSubmissionWithUploads.mockReturnValue({
    startSubmission: vi.fn(),
    completeFormSubmission: vi.fn(),
    startFileUpload: vi.fn(),
    completeFileUpload: vi.fn(),
    handleSubmissionFailure: vi.fn(),
    resetSubmission: vi.fn(),
    isBlocking: false,
    canSubmit: true,
    statusMessage: null,
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */
describe('Treatments Page Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastResponsiveTableProps.current = null;
    setupDefaults();
  });

  it('renders the treatments page in table view', () => {
    render(<Treatments />);

    expect(screen.getByTestId('page-header')).toHaveTextContent(
      'shared:categories.treatments'
    );
    expect(screen.getByTestId('responsive-table')).toBeInTheDocument();
  });

  describe('Practitioner Name Enrichment (filtering/sorting)', () => {
    function getEnrichedDataPassedToDataManagement() {
      const calls = useDataManagement.mock.calls;
      return calls[calls.length - 1][0];
    }

    it('prefers a nested practitioner object over a practitioner_id lookup', () => {
      setupDefaults({
        items: [
          {
            ...mockTreatments[0],
            practitioner: { id: 99, name: 'Dr. Nested' },
            practitioner_id: 1,
          },
        ],
      });

      render(<Treatments />);

      const enriched = getEnrichedDataPassedToDataManagement();
      expect(enriched[0].practitioner_name).toBe('Dr. Nested');
    });

    it('falls back to a practitioner_id lookup when there is no nested object', () => {
      setupDefaults({
        items: [
          { ...mockTreatments[1], practitioner: undefined, practitioner_id: 2 },
        ],
      });

      render(<Treatments />);

      const enriched = getEnrichedDataPassedToDataManagement();
      expect(enriched[0].practitioner_name).toBe('Dr. Martinez');
    });

    it('resolves to an empty string when neither a nested object nor a matching practitioner_id is present', () => {
      setupDefaults({
        items: [
          {
            ...mockTreatments[0],
            practitioner: undefined,
            practitioner_id: null,
          },
        ],
      });

      render(<Treatments />);

      const enriched = getEnrichedDataPassedToDataManagement();
      expect(enriched[0].practitioner_name).toBe('');
    });
  });

  describe('Table column <-> sort field alias (practitioner column)', () => {
    it('maps the practitioner column key to practitioner_name when a header is clicked', () => {
      const handleSortChange = vi.fn();
      setupDefaults({
        dataManagementOverrides: { handleSortChange, sortBy: 'start_date' },
      });

      render(<Treatments />);

      expect(lastResponsiveTableProps.current.onSort).toBeInstanceOf(Function);
      lastResponsiveTableProps.current.onSort('practitioner');

      expect(handleSortChange).toHaveBeenCalledWith('practitioner_name');
    });

    it('maps practitioner_name back to the practitioner column for the table sortBy prop', () => {
      setupDefaults({
        dataManagementOverrides: { sortBy: 'practitioner_name' },
      });

      render(<Treatments />);

      expect(lastResponsiveTableProps.current.sortBy).toBe('practitioner');
    });

    it('passes non-aliased sort fields straight through', () => {
      const handleSortChange = vi.fn();
      setupDefaults({
        dataManagementOverrides: { handleSortChange, sortBy: 'treatment_name' },
      });

      render(<Treatments />);

      expect(lastResponsiveTableProps.current.sortBy).toBe('treatment_name');

      lastResponsiveTableProps.current.onSort('status');
      expect(handleSortChange).toHaveBeenCalledWith('status');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  treatmentsPageConfig — imported directly (not through any mocked  */
/*  barrel) so this checks the real config object that powers         */
/*  Advanced Filters/Sort in production.                              */
/* ------------------------------------------------------------------ */
describe('treatmentsPageConfig — practitioner filtering/sorting', () => {
  it('wires up practitioner_name for filtering, search, and sorting', async () => {
    const { treatmentsPageConfig } =
      await import('../../../utils/medicalPageConfigs/treatments');

    expect(treatmentsPageConfig.filtering.practitionerField).toBe(
      'practitioner_name'
    );
    expect(treatmentsPageConfig.filtering.searchFields).toContain(
      'practitioner_name'
    );
    expect(treatmentsPageConfig.sorting.sortOptions).toContainEqual({
      value: 'practitioner_name',
      label: 'medical:treatments.filters.sort.practitioner',
    });
    expect(treatmentsPageConfig.filterControls.showPractitioner).toBe(true);
  });
});
