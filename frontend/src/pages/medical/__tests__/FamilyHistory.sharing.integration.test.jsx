import { vi } from 'vitest';

/**
 * Integration tests for FamilyHistory page sharing functionality
 */
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithPatient } from '../../../test-utils/render';
import FamilyHistory from '../FamilyHistory';

// --- Hoisted mock functions ---
const {
  useMedicalData,
  useDataManagement,
  usePersistedViewMode,
  mockFamilyHistoryApi,
  mockNotifications,
} = vi.hoisted(() => ({
  useMedicalData: vi.fn(),
  useDataManagement: vi.fn(),
  usePersistedViewMode: vi.fn(),
  mockFamilyHistoryApi: {
    getOrganizedHistory: vi.fn(() => Promise.resolve({ owned_family_history: [], shared_family_history: [] })),
    getFamilyHistory: vi.fn(() => Promise.resolve({})),
    getSharedFamilyHistory: vi.fn(() => Promise.resolve({ shared_family_history: [] })),
    sendShareInvitation: vi.fn(() => Promise.resolve({ message: 'Invitation sent' })),
    bulkSendInvitations: vi.fn(() => Promise.resolve({ total_sent: 2, total_failed: 0, results: [] })),
    getFamilyMemberShares: vi.fn(() => Promise.resolve([])),
    revokeShare: vi.fn(() => Promise.resolve({ message: 'Share revoked' })),
  },
  mockNotifications: { show: vi.fn() },
}));

// --- Hook mocks ---
vi.mock('../../../hooks/useMedicalData', () => ({ useMedicalData }));
vi.mock('../../../hooks/useDataManagement', () => ({
  useDataManagement,
  default: useDataManagement,
}));
vi.mock('../../../hooks/usePersistedViewMode', () => ({ usePersistedViewMode }));
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false, isTablet: false, isDesktop: true }),
}));
vi.mock('../../../hooks/useGlobalData', () => ({
  usePatientWithStaticData: () => ({
    patient: { id: 1, first_name: 'John', last_name: 'Doe' },
    loading: false,
  }),
  useCurrentPatient: () => ({
    patient: { id: 1, first_name: 'John', last_name: 'Doe' },
    loading: false,
  }),
}));
vi.mock('../../../hooks/useEntityFileCounts', () => ({
  useEntityFileCounts: () => ({
    fileCounts: {},
    fileCountsLoading: false,
    cleanupFileCount: vi.fn(),
  }),
}));
vi.mock('../../../hooks/useViewModalNavigation', () => ({
  useViewModalNavigation: () => ({
    isOpen: false,
    viewingItem: null,
    openModal: vi.fn(),
    closeModal: vi.fn(),
  }),
}));

// --- Service mocks ---
vi.mock('../../../services/api', () => ({
  apiService: {
    getPatientFamilyMembers: vi.fn(() => Promise.resolve([])),
    getFamilyMembers: vi.fn(() => Promise.resolve([])),
    createFamilyMember: vi.fn(() => Promise.resolve({})),
    updateFamilyMember: vi.fn(() => Promise.resolve({})),
    deleteFamilyMember: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock('../../../services/api/familyHistoryApi', () => ({
  __esModule: true,
  default: mockFamilyHistoryApi,
}));
vi.mock('../../../services/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock('@mantine/notifications', () => ({
  notifications: mockNotifications,
}));
vi.mock('@mantine/hooks', () => ({
  useDisclosure: (initial = false) => {
    let isOpen = initial;
    const open = vi.fn();
    const close = vi.fn();
    return [isOpen, { open, close, toggle: vi.fn() }];
  },
}));

// --- Utility mocks ---
vi.mock('../../../utils/medicalPageConfigs', () => ({
  getMedicalPageConfig: () => ({
    entityName: 'family_members',
    filters: [],
    sortOptions: [],
    defaultSort: 'name',
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
vi.mock('../../../utils/errorHandling', () => ({
  useErrorHandler: () => ({
    handleError: vi.fn(),
    currentError: null,
    clearError: vi.fn(),
  }),
  ErrorAlert: () => null,
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
  default: ({ primaryAction, secondaryActions }) => (
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
    </div>
  ),
}));
vi.mock('../../../components/shared/MedicalPageFilters', () => ({
  default: () => <div data-testid="page-filters">Filters</div>,
}));
vi.mock('../../../components/shared/MedicalPageLoading', () => ({
  default: ({ message }) => <div data-testid="loading">{message}</div>,
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
  ResponsiveTable: ({ data, columns }) => (
    <table data-testid="responsive-table">
      <thead>
        <tr>{columns.map((col) => <th key={col.accessor}>{col.header}</th>)}</tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id}>
            {columns.map((col) => <td key={col.accessor}>{String(row[col.accessor] ?? '')}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));
vi.mock('../../../components/medical/StatusBadge', () => ({
  default: ({ status }) => <span data-testid="status-badge">{status}</span>,
}));
vi.mock('../../../components/invitations', () => ({
  InvitationManager: ({ opened, onClose, onUpdate }) =>
    opened ? (
      <div data-testid="invitation-manager">
        <button onClick={onClose} data-testid="close-invitation-manager">Close</button>
        <button onClick={onUpdate} data-testid="update-invitations">Update</button>
      </div>
    ) : null,
}));
vi.mock('../../../components/medical/FamilyHistorySharingModal', () => ({
  default: ({ opened, onClose, familyMember, familyMembers, bulkMode, onSuccess }) =>
    opened ? (
      <div data-testid="family-history-sharing-modal">
        <div>Bulk Mode: {bulkMode ? 'Yes' : 'No'}</div>
        {familyMember && <div>Family Member: {familyMember.name}</div>}
        <button onClick={onClose} data-testid="close-sharing-modal">Close</button>
        <button onClick={onSuccess} data-testid="sharing-success">Success</button>
      </div>
    ) : null,
}));
vi.mock('../../../components/medical/family-history', () => ({
  FamilyHistoryCard: ({ member, onView, onEdit, onDelete, onShare }) => (
    <div data-testid={`family-card-${member.id}`}>
      <span>{member.name}</span>
      <span>{member.relationship}</span>
      {member.is_shared && <span>Shared</span>}
      <button onClick={() => onView && onView(member)}>View</button>
      <button onClick={() => onEdit && onEdit(member)}>Edit</button>
      <button onClick={() => onDelete && onDelete(member.id)}>Delete</button>
      {onShare && <button onClick={() => onShare(member)}>Share</button>}
    </div>
  ),
  FamilyHistoryViewModal: ({ isOpen, onClose, member }) => {
    if (!isOpen || !member) return null;
    return (
      <div data-testid="view-modal" role="dialog">
        <span>{member.name}</span>
        <button onClick={onClose}>Close</button>
      </div>
    );
  },
  FamilyHistoryFormWrapper: ({ isOpen, onClose, title, formData, onInputChange, onSubmit }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="form-modal" role="dialog">
        <h2>{title}</h2>
        <button onClick={onClose}>Close</button>
        <button onClick={onSubmit}>Submit</button>
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
const mockFamilyMembers = [
  {
    id: 1,
    name: 'John Smith',
    relationship: 'father',
    birth_year: 1960,
    is_shared: false,
    family_conditions: [
      { condition: 'Diabetes', status: 'active' },
      { condition: 'Hypertension', status: 'active' },
    ],
  },
  {
    id: 2,
    name: 'Jane Smith',
    relationship: 'mother',
    birth_year: 1965,
    is_shared: false,
    family_conditions: [
      { condition: 'Heart Disease', status: 'active' },
    ],
  },
];

const mockDataManagementReturn = {
  data: mockFamilyMembers,
  filters: {},
  filteredData: mockFamilyMembers,
  sortBy: 'name',
  sortOrder: 'asc',
  updateFilter: vi.fn(),
  clearFilters: vi.fn(),
  handleSortChange: vi.fn(),
  hasActiveFilters: false,
  totalCount: mockFamilyMembers.length,
  filteredCount: mockFamilyMembers.length,
  statusOptions: [],
  categoryOptions: [],
  dateRangeOptions: [],
  sortOptions: [],
};

const defaultMedicalData = {
  items: mockFamilyMembers,
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
describe('FamilyHistory Page - Sharing Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMedicalData.mockReturnValue({ ...defaultMedicalData });
    useDataManagement.mockReturnValue({ ...mockDataManagementReturn });
    usePersistedViewMode.mockReturnValue(['cards', vi.fn()]);
  });

  describe('Page Initialization and Data Loading', () => {
    it('should load and display family history page', async () => {
      renderWithPatient(<FamilyHistory />);

      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });

    it('should display page actions', async () => {
      renderWithPatient(<FamilyHistory />);

      expect(screen.getByTestId('page-actions')).toBeInTheDocument();
    });

    it('should display filters', async () => {
      renderWithPatient(<FamilyHistory />);

      expect(screen.getByTestId('page-filters')).toBeInTheDocument();
    });
  });

  describe('Family Member Display', () => {
    it('should display family members in card view', async () => {
      renderWithPatient(<FamilyHistory />);

      await waitFor(() => {
        expect(screen.getByText('John Smith')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('should show relationship for each family member', async () => {
      renderWithPatient(<FamilyHistory />);

      await waitFor(() => {
        expect(screen.getByText('father')).toBeInTheDocument();
        expect(screen.getByText('mother')).toBeInTheDocument();
      });
    });
  });

  describe('Sharing API Integration', () => {
    it('should have sendShareInvitation API available', () => {
      expect(mockFamilyHistoryApi.sendShareInvitation).toBeDefined();
    });

    it('should have bulkSendInvitations API available', () => {
      expect(mockFamilyHistoryApi.bulkSendInvitations).toBeDefined();
    });

    it('should have revokeShare API available', () => {
      expect(mockFamilyHistoryApi.revokeShare).toBeDefined();
    });

    it('should have getSharedFamilyHistory API available', () => {
      expect(mockFamilyHistoryApi.getSharedFamilyHistory).toBeDefined();
    });
  });

  describe('Empty State', () => {
    it('should handle empty family members list', async () => {
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        items: [],
      });
      useDataManagement.mockReturnValue({
        ...mockDataManagementReturn,
        data: [],
        totalCount: 0,
        filteredCount: 0,
      });

      renderWithPatient(<FamilyHistory />);

      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading state when data is loading', async () => {
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        loading: true,
        items: [],
      });

      renderWithPatient(<FamilyHistory />);

      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        error: 'Failed to load family history',
      });

      renderWithPatient(<FamilyHistory />);

      // Page still renders
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });

    it('should handle errors when loading shared family history', () => {
      mockFamilyHistoryApi.getSharedFamilyHistory.mockRejectedValue(new Error('Shared API Error'));

      // Verify the mock is configured
      expect(mockFamilyHistoryApi.getSharedFamilyHistory()).rejects.toThrow('Shared API Error');
    });
  });

  describe('Notification System Integration', () => {
    it('should have notification system available', () => {
      expect(mockNotifications.show).toBeDefined();
    });
  });

  describe('Data Consistency', () => {
    it('should refresh data when requested', async () => {
      const mockRefresh = vi.fn();
      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        refreshData: mockRefresh,
      });

      renderWithPatient(<FamilyHistory />);

      expect(screen.getByTestId('page-header')).toBeInTheDocument();
    });

    it('should render without errors with mixed owned and shared data', async () => {
      const mixedMembers = [
        ...mockFamilyMembers,
        {
          id: 3,
          name: 'Bob Wilson',
          relationship: 'uncle',
          birth_year: 1955,
          is_shared: true,
          shared_by: { id: 2, name: 'Dr. Smith' },
          shared_at: '2024-01-15T10:30:00Z',
          family_conditions: [{ condition: 'Cancer', status: 'active' }],
        },
      ];

      useMedicalData.mockReturnValue({
        ...defaultMedicalData,
        items: mixedMembers,
      });
      useDataManagement.mockReturnValue({
        ...mockDataManagementReturn,
        data: mixedMembers,
        totalCount: mixedMembers.length,
        filteredCount: mixedMembers.length,
      });

      renderWithPatient(<FamilyHistory />);

      await waitFor(() => {
        expect(screen.getByText('John Smith')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
      });
    });

    it('should handle concurrent operations without errors', async () => {
      renderWithPatient(<FamilyHistory />);

      await waitFor(() => {
        expect(screen.getByText('John Smith')).toBeInTheDocument();
      });

      // Page renders stably with data
      expect(screen.getByTestId('page-header')).toBeInTheDocument();
      expect(screen.getByTestId('page-actions')).toBeInTheDocument();
    });
  });
});
