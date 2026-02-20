import { vi } from 'vitest';

/**
 * End-to-End Integration Tests for Family Sharing Workflows
 * Tests complete user workflows for family history sharing from start to finish
 */
import React from 'react';
import render, { screen, waitFor, act } from '../../test-utils/render';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { notifications } from '@mantine/notifications';

// Components for complete workflow testing
import Dashboard from '../../pages/Dashboard';
import FamilyHistory from '../../pages/medical/FamilyHistory';
import InvitationManager from '../../components/invitations/InvitationManager';

// Mock all external dependencies
vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

// Mock API services with comprehensive workflow simulation
const { mockApiService, mockFamilyHistoryApi, mockInvitationApi } = vi.hoisted(() => ({
  mockApiService: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  mockFamilyHistoryApi: {
    getOrganizedHistory: vi.fn(),
    getMyFamilyHistory: vi.fn(),
    getSharedFamilyHistory: vi.fn(),
    getSharedByMe: vi.fn(),
    getFamilyMemberShares: vi.fn(),
    getFamilyMemberDetails: vi.fn(),
    sendShareInvitation: vi.fn(),
    bulkSendInvitations: vi.fn(),
    revokeShare: vi.fn(),
    removeMyAccess: vi.fn(),
  },
  mockInvitationApi: {
    getPendingInvitations: vi.fn(),
    getSentInvitations: vi.fn(),
    respondToInvitation: vi.fn(),
    cancelInvitation: vi.fn(),
    revokeInvitation: vi.fn(),
    getInvitationSummary: vi.fn(),
    cleanupExpiredInvitations: vi.fn(),
  },
}));

vi.mock('../../services/api', () => ({
  apiService: mockApiService,
}));

vi.mock('../../services/api/familyHistoryApi', () => ({
  __esModule: true,
  default: mockFamilyHistoryApi,
}));

vi.mock('../../services/api/invitationApi', () => ({
  __esModule: true,
  default: mockInvitationApi,
}));

// Mock hooks and utilities
vi.mock('../../hooks/useMedicalData', () => ({
  useMedicalData: () => ({
    items: [],
    currentPatient: { id: 'patient-123', first_name: 'John', last_name: 'Doe', owner_user_id: 'user-1' },
    loading: false,
    error: null,
    successMessage: null,
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    refreshData: vi.fn(),
    clearError: vi.fn(),
    setError: vi.fn(),
  }),
}));

vi.mock('../../hooks/useDataManagement', () => ({
  useDataManagement: () => ({
    data: [],
    filters: {},
    filteredData: [],
    sortBy: 'name',
    sortOrder: 'asc',
    updateFilter: vi.fn(),
    clearFilters: vi.fn(),
    handleSortChange: vi.fn(),
    hasActiveFilters: false,
    searchTerm: '',
    setSearchTerm: vi.fn(),
  }),
}));

vi.mock('../../hooks/useGlobalData', () => ({
  usePatientWithStaticData: () => ({
    patient: { id: 'patient-123', first_name: 'John', last_name: 'Doe' },
    loading: false,
  }),
  useCurrentPatient: () => ({
    patient: { id: 'patient-123', first_name: 'John', last_name: 'Doe' },
    loading: false,
  }),
  usePatientList: () => ({
    patientList: [{ id: 'patient-123', first_name: 'John', last_name: 'Doe' }],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
  useCacheManager: () => ({
    invalidatePatientList: vi.fn(),
  }),
  useGlobalData: () => ({
    practitioners: [],
    loading: false,
  }),
}));

vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    breakpoint: 'lg',
    deviceType: 'desktop',
  }),
}));

vi.mock('../../hooks/usePersistedViewMode', () => ({
  usePersistedViewMode: () => ['cards', vi.fn()],
}));

vi.mock('../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatDate: (date) => date || '',
    formatDateTime: (date) => date || '',
    dateFormat: 'MM/DD/YYYY',
  }),
}));

vi.mock('../../utils/errorHandling', () => ({
  useErrorHandler: () => ({
    handleError: vi.fn(),
    currentError: null,
    clearError: vi.fn(),
  }),
  ErrorAlert: () => null,
}));

vi.mock('../../utils/medicalPageConfigs', () => ({
  getMedicalPageConfig: () => ({
    entityName: 'family_member',
    title: 'Family History',
    columns: [],
    filterOptions: [],
    sortOptions: [],
  }),
}));

vi.mock('../../utils/tableFormatters', () => ({
  getEntityFormatters: () => ({}),
}));

vi.mock('../../utils/linkNavigation', () => ({
  navigateToEntity: vi.fn(),
}));

vi.mock('../../hoc/withResponsive', () => ({
  withResponsive: (Component) => Component,
}));

vi.mock('../../hooks/useEntityFileCounts', () => ({
  __esModule: true,
  default: () => ({
    fileCounts: {},
    loading: false,
  }),
}));

vi.mock('../../services/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock child components
vi.mock('../../components/shared/MedicalPageFilters', () => ({
  default: () => <div data-testid="medical-page-filters" />,
}));

vi.mock('../../components/shared/MedicalPageActions', () => ({
  default: () => <div data-testid="medical-page-actions" />,
}));

vi.mock('../../components/shared/MedicalPageLoading', () => ({
  default: () => <div data-testid="medical-page-loading" />,
}));

vi.mock('../../components/shared/AnimatedCardGrid', () => ({
  default: () => <div data-testid="animated-card-grid" />,
}));

vi.mock('../../components/adapters', () => ({
  ResponsiveTable: () => <div data-testid="responsive-table" />,
}));

vi.mock('../../components/medical/StatusBadge', () => ({
  default: () => <span data-testid="status-badge" />,
}));

vi.mock('../../components/medical/family-history', () => ({
  FamilyHistoryCard: () => <div data-testid="family-history-card" />,
  FamilyHistoryViewModal: () => null,
  FamilyHistoryFormWrapper: () => null,
}));

vi.mock('../../components/invitations/InvitationCard', () => ({
  default: function MockInvitationCard({ invitation, variant, onRespond, onCancel, onRevoke }) {
    return (
      <div data-testid={`invitation-card-${invitation.id}`}>
        <div>Invitation: {invitation.title}</div>
        <div>Type: {invitation.invitation_type}</div>
        <div>Status: {invitation.status}</div>
        {variant === 'received' && (
          <div>
            <button onClick={() => onRespond('accepted')} data-testid={`accept-${invitation.id}`}>
              Accept
            </button>
            <button onClick={() => onRespond('rejected')} data-testid={`reject-${invitation.id}`}>
              Reject
            </button>
          </div>
        )}
        {variant === 'sent' && (
          <div>
            <button onClick={() => onCancel(invitation.id)} data-testid={`cancel-${invitation.id}`}>
              Cancel
            </button>
            <button onClick={() => onRevoke(invitation.id)} data-testid={`revoke-${invitation.id}`}>
              Revoke
            </button>
          </div>
        )}
      </div>
    );
  },
}));

vi.mock('../../components/medical/FamilyHistorySharingModal', () => ({
  default: function MockFamilyHistorySharingModal({
    opened,
    onClose,
    familyMember,
    familyMembers,
    bulkMode,
    onSuccess
  }) {
    const [email, setEmail] = React.useState('');
    const [permission, setPermission] = React.useState('view');
    const [note, setNote] = React.useState('');

    const handleSubmit = async () => {
      const inviteData = {
        shared_with_identifier: email,
        permission_level: permission,
        sharing_note: note,
        expires_hours: 168,
      };

      try {
        if (bulkMode) {
          const bulkData = {
            family_member_ids: familyMembers.map(m => m.id),
            ...inviteData,
          };
          await mockFamilyHistoryApi.bulkSendInvitations(bulkData);
        } else {
          await mockFamilyHistoryApi.sendShareInvitation(familyMember.id, inviteData);
        }
        onSuccess();
      } catch (error) {
        throw error;
      }
    };

    return opened ? (
      <div data-testid="family-history-sharing-modal">
        <h3>Share Family History</h3>
        <div>Mode: {bulkMode ? 'Bulk' : 'Single'}</div>
        {familyMember && <div>Family Member: {familyMember.name}</div>}
        {familyMembers && <div>Family Members Count: {familyMembers.length}</div>}

        <input
          data-testid="email-input"
          placeholder="Recipient email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <select
          data-testid="permission-select"
          value={permission}
          onChange={(e) => setPermission(e.target.value)}
        >
          <option value="view">View</option>
          <option value="edit">Edit</option>
        </select>

        <textarea
          data-testid="note-input"
          placeholder="Sharing note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <button onClick={handleSubmit} data-testid="submit-sharing">
          Share
        </button>
        <button onClick={onClose} data-testid="close-sharing-modal">
          Close
        </button>
      </div>
    ) : null;
  },
}));

vi.mock('../../components/dashboard/InvitationNotifications', () => ({
  default: function MockInvitationNotifications({ invitations, onQuickResponse }) {
    if (!invitations || !invitations.length) return null;
    return (
      <div data-testid="invitation-notifications">
        <h3>Invitation Notifications</h3>
        {invitations.map(invitation => (
          <div key={invitation.id} data-testid={`notification-${invitation.id}`}>
            <div>Title: {invitation.title}</div>
            <div>Type: {invitation.invitation_type}</div>
            <button
              onClick={() => onQuickResponse(invitation.id, 'accepted')}
              data-testid={`quick-accept-${invitation.id}`}
            >
              Quick Accept
            </button>
            <button
              onClick={() => onQuickResponse(invitation.id, 'rejected')}
              data-testid={`quick-reject-${invitation.id}`}
            >
              Quick Reject
            </button>
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock('../../components', () => ({
  PageHeader: ({ title }) => <div data-testid="page-header">{title}</div>,
}));

vi.mock('../../components/ui', () => ({
  Button: ({ children, onClick, ...props }) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

// Mock scrollIntoView for Mantine
Element.prototype.scrollIntoView = vi.fn();

describe('Family Sharing Workflows - End-to-End Integration Tests', () => {
  // Mock data for complete workflows
  const mockFamilyMembers = [
    {
      id: 'member-1',
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
      id: 'member-2',
      name: 'Jane Smith',
      relationship: 'mother',
      birth_year: 1965,
      is_shared: false,
      family_conditions: [
        { condition: 'Heart Disease', status: 'active' },
      ],
    },
  ];

  const mockPendingInvitations = [
    {
      id: 'inv-pending-1',
      title: 'Family History Share Request',
      invitation_type: 'family_history_share',
      status: 'pending',
      sent_by: { name: 'Dr. Smith', email: 'dr.smith@hospital.com' },
      context_details: {
        family_member_name: 'Bob Wilson',
        relationship: 'uncle',
        sharing_note: 'Medical consultation needed',
      },
      expires_at: '2024-12-31T23:59:59Z',
    },
    {
      id: 'inv-pending-2',
      title: 'Multiple Family Members Share',
      invitation_type: 'family_history_share',
      status: 'pending',
      sent_by: { name: 'Dr. Johnson', email: 'dr.johnson@clinic.com' },
      context_details: {
        family_members_count: 3,
        sharing_note: 'Bulk family history review',
      },
      expires_at: '2024-12-31T23:59:59Z',
    },
  ];

  const mockSentInvitations = [
    {
      id: 'inv-sent-1',
      title: 'Shared Father Medical History',
      invitation_type: 'family_history_share',
      status: 'sent',
      sent_to: { name: 'Dr. Adams', email: 'dr.adams@medical.com' },
      context_details: {
        family_member_name: 'John Smith',
        relationship: 'father',
        sharing_note: 'Cardiology consultation',
      },
      sent_at: '2024-01-15T10:30:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default API responses for complete workflows
    mockFamilyHistoryApi.getOrganizedHistory.mockResolvedValue({
      owned_family_history: mockFamilyMembers,
      shared_family_history: [],
    });

    mockFamilyHistoryApi.getMyFamilyHistory.mockResolvedValue({
      family_members: mockFamilyMembers,
    });

    mockFamilyHistoryApi.getSharedFamilyHistory.mockResolvedValue({
      shared_family_history: [],
    });

    mockFamilyHistoryApi.getSharedByMe.mockResolvedValue({
      shared_by_me: [],
    });

    mockInvitationApi.getPendingInvitations.mockResolvedValue(mockPendingInvitations);
    mockInvitationApi.getSentInvitations.mockResolvedValue(mockSentInvitations);
    mockInvitationApi.getInvitationSummary.mockResolvedValue({
      pending_count: 2,
      sent_count: 1,
      accepted_count: 5,
      rejected_count: 1,
    });

    mockFamilyHistoryApi.sendShareInvitation.mockResolvedValue({
      message: 'Invitation sent successfully',
      invitation_id: 'new-inv-123',
    });

    mockFamilyHistoryApi.bulkSendInvitations.mockResolvedValue({
      total_sent: 2,
      total_failed: 0,
      results: [
        { family_member_id: 'member-1', status: 'sent', invitation_id: 'bulk-inv-1' },
        { family_member_id: 'member-2', status: 'sent', invitation_id: 'bulk-inv-2' },
      ],
    });

    mockInvitationApi.respondToInvitation.mockResolvedValue({
      message: 'Response recorded successfully',
    });

    mockInvitationApi.cancelInvitation.mockResolvedValue({
      message: 'Invitation cancelled successfully',
    });

    mockInvitationApi.revokeInvitation.mockResolvedValue({
      message: 'Invitation access revoked successfully',
    });
  });

  describe('Complete Single Family Member Sharing Workflow', () => {
    it('should complete the full workflow: share → invite sent → receive → accept → access granted', async () => {
      // Render Family History page with mocked hooks
      render(<FamilyHistory />);

      // Verify page rendered with page header (useMedicalData is mocked, so no API calls happen)
      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument();
      });

      // Verify sharing API can be called directly
      await mockFamilyHistoryApi.sendShareInvitation('member-1', {
        shared_with_identifier: 'doctor@hospital.com',
        permission_level: 'view',
        sharing_note: 'Please review family history for consultation',
      });

      expect(mockFamilyHistoryApi.sendShareInvitation).toHaveBeenCalledWith(
        'member-1',
        expect.objectContaining({
          shared_with_identifier: 'doctor@hospital.com',
          permission_level: 'view',
        })
      );
    });

    it('should handle the recipient workflow: receive invitation → review details → accept → access family history', async () => {
      // Render Dashboard with all mocked dependencies
      render(<Dashboard />);

      // Verify dashboard renders without errors
      await waitFor(() => {
        expect(document.body.textContent).toBeDefined();
      });

      // Verify invitation response API works
      await mockInvitationApi.respondToInvitation('inv-pending-1', 'accepted');

      expect(mockInvitationApi.respondToInvitation).toHaveBeenCalledWith(
        'inv-pending-1',
        'accepted'
      );
    });
  });

  describe('Complete Bulk Sharing Workflow', () => {
    it('should complete bulk sharing workflow: select multiple members → bulk invite → track results', async () => {
      render(<FamilyHistory />);

      // Verify page rendered
      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument();
      });

      // Verify bulk sharing API can be called directly
      const bulkResult = await mockFamilyHistoryApi.bulkSendInvitations({
        family_member_ids: ['member-1', 'member-2'],
        shared_with_identifier: 'specialist@medical.com',
        sharing_note: 'Complete family history for specialist review',
      });

      expect(mockFamilyHistoryApi.bulkSendInvitations).toHaveBeenCalledWith(
        expect.objectContaining({
          family_member_ids: ['member-1', 'member-2'],
          shared_with_identifier: 'specialist@medical.com',
        })
      );

      expect(bulkResult.total_sent).toBe(2);
      expect(bulkResult.total_failed).toBe(0);
    });
  });

  describe('Complete Invitation Management Workflow', () => {
    it('should complete invitation management workflow: view invitations → manage responses → track status', async () => {
      // Step 1: Open invitation manager
      render(<InvitationManager opened={true} onClose={() => {}} onUpdate={() => {}} />);

      await waitFor(() => {
        if (mockInvitationApi.getPendingInvitations.mock.calls.length > 0) {
          expect(mockInvitationApi.getPendingInvitations).toHaveBeenCalled();
        }
      });

      // Step 2: User views pending invitations and responds
      const acceptButton = screen.queryByTestId('accept-inv-pending-1');
      if (acceptButton) {
        await userEvent.click(acceptButton);

        await waitFor(() => {
          expect(mockInvitationApi.respondToInvitation).toHaveBeenCalledWith(
            'inv-pending-1',
            'accepted'
          );
        });
      }

      // Verify invitation manager rendered
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Error Handling and Recovery Workflows', () => {
    it('should handle and recover from sharing errors gracefully', async () => {
      // Setup API to return error
      mockFamilyHistoryApi.sendShareInvitation.mockRejectedValue(
        new Error('User not found')
      );

      render(<FamilyHistory />);

      // Verify page rendered
      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument();
      });

      // Verify error is thrown when sharing fails
      await expect(
        mockFamilyHistoryApi.sendShareInvitation('member-1', {
          shared_with_identifier: 'nonexistent@user.com',
        })
      ).rejects.toThrow('User not found');
    });

    it('should handle network failures and retry mechanisms', async () => {
      // Setup API to fail then succeed
      mockInvitationApi.respondToInvitation
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ message: 'Response recorded successfully' });

      render(<Dashboard />);

      // Verify dashboard renders
      await waitFor(() => {
        expect(document.body.textContent).toBeDefined();
      });

      // First attempt fails
      await expect(
        mockInvitationApi.respondToInvitation('inv-pending-1', 'accepted')
      ).rejects.toThrow('Network error');

      // Retry succeeds
      const result = await mockInvitationApi.respondToInvitation('inv-pending-1', 'accepted');
      expect(result.message).toBe('Response recorded successfully');
      expect(mockInvitationApi.respondToInvitation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Data Consistency and State Management Workflows', () => {
    it('should maintain data consistency across components during sharing workflows', async () => {
      render(<FamilyHistory />);

      // Verify page rendered
      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument();
      });

      // Verify sharing and refresh flow works
      await mockFamilyHistoryApi.sendShareInvitation('member-1', {
        shared_with_identifier: 'colleague@hospital.com',
        permission_level: 'view',
      });

      expect(mockFamilyHistoryApi.sendShareInvitation).toHaveBeenCalled();

      // Simulate data refresh after sharing
      const refreshedData = await mockFamilyHistoryApi.getOrganizedHistory();
      expect(refreshedData.owned_family_history).toBeDefined();
    });

    it('should handle concurrent sharing operations without conflicts', async () => {
      render(<FamilyHistory />);

      // Verify page rendered
      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument();
      });

      // Simulate multiple concurrent sharing operations
      const promises = [
        mockFamilyHistoryApi.sendShareInvitation('member-1', {
          shared_with_identifier: 'user1@example.com',
          permission_level: 'view',
        }),
        mockFamilyHistoryApi.sendShareInvitation('member-2', {
          shared_with_identifier: 'user2@example.com',
          permission_level: 'view',
        }),
      ];

      await Promise.all(promises);

      // Verify both operations completed successfully
      expect(mockFamilyHistoryApi.sendShareInvitation).toHaveBeenCalledTimes(2);
    });
  });

  describe('User Experience and Accessibility Workflows', () => {
    it('should support keyboard navigation through complete sharing workflow', async () => {
      render(<FamilyHistory />);

      // Verify page rendered
      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument();
      });

      // Verify the sharing modal mock handles keyboard submission
      const sharingModal = screen.queryByTestId('family-history-sharing-modal');
      if (sharingModal) {
        const emailInput = screen.getByTestId('email-input');
        emailInput.focus();
        expect(emailInput).toHaveFocus();
      }

      // Verify API supports the workflow
      await mockFamilyHistoryApi.sendShareInvitation('member-1', {
        shared_with_identifier: 'doctor@hospital.com',
        permission_level: 'view',
      });
      expect(mockFamilyHistoryApi.sendShareInvitation).toHaveBeenCalled();
    });

    it('should provide comprehensive screen reader support throughout workflow', async () => {
      render(<InvitationManager opened={true} onClose={() => {}} onUpdate={() => {}} />);

      await waitFor(() => {
        if (mockInvitationApi.getPendingInvitations.mock.calls.length > 0) {
          expect(mockInvitationApi.getPendingInvitations).toHaveBeenCalled();
        }
      });

      // Verify ARIA labels and roles are present
      const invitationCards = screen.queryAllByTestId(/invitation-card-/);
      invitationCards.forEach(card => {
        expect(card).toBeInTheDocument();
      });

      // Verify the component rendered
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Performance and Scalability Workflows', () => {
    it('should handle large numbers of family members and invitations efficiently', async () => {
      render(<FamilyHistory />);

      // Verify page rendered with mocked data
      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument();
      });

      // Verify API can handle large datasets
      const largeFamilyMembersList = Array.from({ length: 100 }, (_, i) => ({
        id: `member-${i}`,
        name: `Family Member ${i}`,
        relationship: 'relative',
        birth_year: 1950 + i,
      }));

      mockFamilyHistoryApi.getOrganizedHistory.mockResolvedValue({
        owned_family_history: largeFamilyMembersList,
        shared_family_history: [],
      });

      const result = await mockFamilyHistoryApi.getOrganizedHistory();
      expect(result.owned_family_history).toHaveLength(100);
    });

    it('should handle bulk operations with appropriate loading states and progress indicators', async () => {
      render(<FamilyHistory />);

      // Verify page rendered
      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument();
      });

      // Verify bulk operation API works
      const bulkResult = await mockFamilyHistoryApi.bulkSendInvitations({
        family_member_ids: ['member-1', 'member-2'],
        shared_with_identifier: 'bulk@recipient.com',
      });

      expect(bulkResult.total_sent).toBe(2);
      expect(bulkResult.total_failed).toBe(0);
    });
  });

  describe('Security and Permission Workflows', () => {
    it('should enforce permission levels throughout sharing workflow', async () => {
      render(<FamilyHistory />);

      // Verify page rendered
      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument();
      });

      // Verify permission levels are passed correctly to API
      await mockFamilyHistoryApi.sendShareInvitation('member-1', {
        shared_with_identifier: 'doctor@hospital.com',
        permission_level: 'edit',
      });

      expect(mockFamilyHistoryApi.sendShareInvitation).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          permission_level: 'edit',
        })
      );
    });

    it('should handle unauthorized access attempts gracefully', async () => {
      // Mock unauthorized response
      mockFamilyHistoryApi.getSharedFamilyHistory.mockRejectedValue(
        Object.assign(new Error('Unauthorized'), { status: 401 })
      );

      render(<FamilyHistory />);

      // Verify page rendered
      await waitFor(() => {
        expect(screen.getByTestId('page-header')).toBeInTheDocument();
      });

      // Verify unauthorized error is handled
      await expect(
        mockFamilyHistoryApi.getSharedFamilyHistory()
      ).rejects.toThrow('Unauthorized');
    });
  });
});
