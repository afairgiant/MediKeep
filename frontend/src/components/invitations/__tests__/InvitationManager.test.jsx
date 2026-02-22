import { vi } from 'vitest';

/**
 * Comprehensive tests for InvitationManager component
 * Tests the complete invitation management workflow including tabs, data loading, and user interactions
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import InvitationManager from '../InvitationManager';
import invitationApi from '../../../services/api/invitationApi';
import familyHistoryApi from '../../../services/api/familyHistoryApi';

// Mock dependencies
vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-123', name: 'Test User' },
  }),
}));

vi.mock('../../../services/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../hooks/useGlobalData', () => ({
  useCacheManager: () => ({
    invalidatePatientList: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatDate: (date) => date ? new Date(date).toLocaleDateString() : '',
  }),
  default: () => ({
    formatDate: (date) => date ? new Date(date).toLocaleDateString() : '',
  }),
}));

vi.mock('../../../services/api/patientSharingApi', () => ({
  __esModule: true,
  default: {
    getSharesReceived: vi.fn().mockResolvedValue([]),
    getSharesCreated: vi.fn().mockResolvedValue([]),
    removeMyAccess: vi.fn().mockResolvedValue({ message: 'Access removed' }),
    revokePatientShare: vi.fn().mockResolvedValue({ message: 'Share revoked' }),
  },
}));

// Mock API services
vi.mock('../../../services/api/invitationApi', () => ({
  __esModule: true,
  default: {
    getPendingInvitations: vi.fn(),
    getSentInvitations: vi.fn(),
    respondToInvitation: vi.fn(),
    cancelInvitation: vi.fn(),
    revokeInvitation: vi.fn(),
  },
}));

vi.mock('../../../services/api/familyHistoryApi', () => ({
  __esModule: true,
  default: {
    getSharedFamilyHistory: vi.fn(),
    revokeShare: vi.fn(),
    removeMyAccess: vi.fn(),
  },
}));

// Mock child components
vi.mock('../InvitationCard', () => ({
  default: function MockInvitationCard({ invitation, variant, onCancel, onRespond, showStatus }) {
    return (
      <div data-testid={`invitation-card-${invitation.id}`}>
        <div>Title: {invitation.title}</div>
        <div>From: {invitation.sent_by?.name}</div>
        <div>Status: {invitation.status}</div>
        <div>Variant: {variant}</div>
        {showStatus && <div>Show Status: true</div>}
        {onCancel && (
          <button onClick={() => onCancel(invitation)} data-testid={`cancel-${invitation.id}`}>
            Cancel
          </button>
        )}
        {onRespond && (
          <>
            <button onClick={() => onRespond(invitation, 'accepted')} data-testid={`accept-${invitation.id}`}>
              Accept
            </button>
            <button onClick={() => onRespond(invitation, 'rejected')} data-testid={`reject-${invitation.id}`}>
              Reject
            </button>
          </>
        )}
      </div>
    );
  },
}));

vi.mock('../InvitationResponseModal', () => ({
  default: function MockInvitationResponseModal({ opened, onClose, invitation, onSuccess }) {
    return opened ? (
      <div data-testid="invitation-response-modal">
        <div>Response Modal for: {invitation?.title}</div>
        <button onClick={onClose} data-testid="response-modal-close">Close</button>
        <button onClick={onSuccess} data-testid="response-modal-success">Success</button>
      </div>
    ) : null;
  },
}));

describe('InvitationManager Component', () => {
  const mockSentInvitations = [
    {
      id: 'sent-1',
      title: 'Family History: Johnson Family',
      invitation_type: 'family_history_share',
      status: 'pending',
      sent_by: { id: 'user-123', name: 'Test User' },
      sent_to: { id: 'user-456', name: 'Dr. Smith' },
      created_at: '2024-01-15T10:30:00Z',
    },
    {
      id: 'sent-2', 
      title: 'Family History: Brown Family',
      invitation_type: 'family_history_share',
      status: 'accepted',
      sent_by: { id: 'user-123', name: 'Test User' },
      sent_to: { id: 'user-789', name: 'Dr. Jones' },
      created_at: '2024-01-14T15:20:00Z',
    },
  ];

  const mockReceivedInvitations = [
    {
      id: 'received-1',
      title: 'Family History: Wilson Family',
      invitation_type: 'family_history_share',
      status: 'pending',
      sent_by: { id: 'user-456', name: 'Dr. Smith' },
      sent_to: { id: 'user-123', name: 'Test User' },
      created_at: '2024-01-13T09:15:00Z',
    },
  ];

  const mockSharedFamilyHistory = [
    {
      family_member: {
        id: 'member-1',
        name: 'John Wilson',
        relationship: 'father',
        birth_year: 1960,
        family_conditions: [
          { condition: 'Diabetes', status: 'active' },
          { condition: 'Hypertension', status: 'active' },
        ],
      },
      share_details: {
        shared_by: { id: 'user-456', name: 'Dr. Smith' },
        shared_at: '2024-01-10T12:00:00Z',
        permission_level: 'view',
        sharing_note: 'Shared for consultation',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default API responses
    invitationApi.getPendingInvitations.mockResolvedValue(mockReceivedInvitations);
    invitationApi.getSentInvitations.mockResolvedValue(mockSentInvitations);
    familyHistoryApi.getSharedFamilyHistory.mockResolvedValue({
      shared_family_history: mockSharedFamilyHistory,
    });
    invitationApi.respondToInvitation.mockResolvedValue({ message: 'Success' });
    invitationApi.cancelInvitation.mockResolvedValue({ message: 'Cancelled' });
    invitationApi.revokeInvitation.mockResolvedValue({ message: 'Revoked' });
    familyHistoryApi.revokeShare.mockResolvedValue({ message: 'Access revoked' });
    familyHistoryApi.removeMyAccess.mockResolvedValue({ message: 'Access removed' });
  });

  const renderInvitationManager = (props = {}) => {
    const defaultProps = {
      opened: true,
      onClose: vi.fn(),
      onUpdate: vi.fn(),
    };

    return render(
      <MantineProvider>
        <InvitationManager {...defaultProps} {...props} />
      </MantineProvider>
    );
  };

  describe('Component Rendering and Initial State', () => {
    it('should render the invitation manager modal when opened', async () => {
      renderInvitationManager();

      expect(screen.getByText('Invitation Manager')).toBeInTheDocument();
      expect(screen.getByText('Sent by Me')).toBeInTheDocument();
      expect(screen.getByText('Shared with Me')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderInvitationManager({ opened: false });

      expect(screen.queryByText('Invitation Manager')).not.toBeInTheDocument();
    });

    it('should load all data on mount', async () => {
      renderInvitationManager();

      await waitFor(() => {
        expect(invitationApi.getPendingInvitations).toHaveBeenCalled();
        expect(invitationApi.getSentInvitations).toHaveBeenCalled();
        expect(familyHistoryApi.getSharedFamilyHistory).toHaveBeenCalled();
      });
    });

    it('should display loading state initially', async () => {
      // Mock slow API responses
      invitationApi.getPendingInvitations.mockImplementation(() => new Promise(() => {}));
      
      renderInvitationManager();

      expect(screen.getByText('Loading sent invitations...')).toBeInTheDocument();
    });

    it('should display correct badge counts for each tab', async () => {
      renderInvitationManager();

      await waitFor(() => {
        // Both tabs should have badge counts rendered
        const badges = screen.getAllByText('2');
        expect(badges.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Sent by Me Tab', () => {
    it('should display sent invitations correctly', async () => {
      renderInvitationManager();

      await waitFor(() => {
        expect(screen.getByTestId('invitation-card-sent-1')).toBeInTheDocument();
        expect(screen.getByTestId('invitation-card-sent-2')).toBeInTheDocument();
      });

      expect(screen.getByText('Title: Family History: Johnson Family')).toBeInTheDocument();
      expect(screen.getAllByText('Status: pending').length).toBeGreaterThan(0);
      expect(screen.getByText('Status: accepted')).toBeInTheDocument();
    });

    it('should show info alert about sent invitations', async () => {
      renderInvitationManager();

      await waitFor(() => {
        expect(screen.getByText(/You have sent 2 invitation/)).toBeInTheDocument();
        expect(screen.getByText(/1 are still pending/)).toBeInTheDocument();
      });
    });

    it('should handle cancelling a pending invitation', async () => {
      renderInvitationManager();

      await waitFor(() => {
        expect(screen.getByTestId('cancel-sent-1')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('cancel-sent-1'));

      await waitFor(() => {
        expect(invitationApi.cancelInvitation).toHaveBeenCalledWith('sent-1');
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Invitation Cancelled',
          message: 'The invitation has been cancelled',
          color: 'orange',
          icon: expect.anything(),
        });
      });
    });

    it('should handle revoking an accepted invitation', async () => {
      renderInvitationManager();

      await waitFor(() => {
        expect(screen.getByTestId('cancel-sent-2')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('cancel-sent-2'));

      await waitFor(() => {
        expect(invitationApi.revokeInvitation).toHaveBeenCalledWith('sent-2');
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Access Revoked',
          message: 'Family history sharing has been revoked',
          color: 'orange',
          icon: expect.anything(),
        });
      });
    });

    it('should show empty state when no sent invitations', async () => {
      invitationApi.getSentInvitations.mockResolvedValue([]);
      
      renderInvitationManager();

      await waitFor(() => {
        expect(screen.getByText('No Sent Invitations')).toBeInTheDocument();
        expect(screen.getByText("You haven't sent any invitations or shared any patients yet.")).toBeInTheDocument();
      });
    });

    it('should handle API errors when cancelling invitations', async () => {
      invitationApi.cancelInvitation.mockRejectedValue(new Error('API Error'));
      
      renderInvitationManager();

      await waitFor(() => {
        expect(screen.getByTestId('cancel-sent-1')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('cancel-sent-1'));

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Error',
          message: 'Failed to cancel invitation',
          color: 'red',
          icon: expect.anything(),
        });
      });
    });
  });

  describe('Shared with Me Tab', () => {
    it('should switch to shared with me tab and display content', async () => {
      renderInvitationManager();

      await waitFor(() => {
        expect(screen.getByText('Sent by Me')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Shared with Me'));

      await waitFor(() => {
        expect(screen.getByText('Pending Invitations (1)')).toBeInTheDocument();
        expect(screen.getByText('Family History Shares (1)')).toBeInTheDocument();
      });
    });

    it('should display pending invitations section correctly', async () => {
      renderInvitationManager();

      await userEvent.click(screen.getByText('Shared with Me'));

      await waitFor(() => {
        expect(screen.getByTestId('invitation-card-received-1')).toBeInTheDocument();
        expect(screen.getByText('Title: Family History: Wilson Family')).toBeInTheDocument();
        expect(screen.getByText('Variant: received')).toBeInTheDocument();
      });

      expect(screen.getByText(/You have 1 pending invitation/)).toBeInTheDocument();
    });

    it('should display active shares section correctly', async () => {
      renderInvitationManager();

      await userEvent.click(screen.getByText('Shared with Me'));

      await waitFor(() => {
        expect(screen.getByText('John Wilson')).toBeInTheDocument();
        // CSS capitalize is applied but DOM text is lowercase
        expect(screen.getByText('father • Born 1960')).toBeInTheDocument();
        expect(screen.getByText(/Shared by.*Dr\. Smith/)).toBeInTheDocument();
        expect(screen.getByText('view')).toBeInTheDocument();
        expect(screen.getByText('"Shared for consultation"')).toBeInTheDocument();
        expect(screen.getByText('2 condition(s)')).toBeInTheDocument();
      });
    });

    it('should handle accepting a pending invitation with detailed response', async () => {
      renderInvitationManager();

      await userEvent.click(screen.getByText('Shared with Me'));

      await waitFor(() => {
        expect(screen.getByTestId('accept-received-1')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('accept-received-1'));

      // Should open detailed response modal
      await waitFor(() => {
        expect(screen.getByTestId('invitation-response-modal')).toBeInTheDocument();
        expect(screen.getByText('Response Modal for: Family History: Wilson Family')).toBeInTheDocument();
      });
    });

    it('should handle rejecting a pending invitation directly', async () => {
      renderInvitationManager();

      await userEvent.click(screen.getByText('Shared with Me'));

      await waitFor(() => {
        expect(screen.getByTestId('reject-received-1')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('reject-received-1'));

      await waitFor(() => {
        expect(invitationApi.respondToInvitation).toHaveBeenCalledWith('received-1', 'rejected');
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Invitation rejected',
          message: 'Successfully rejected the invitation',
          color: 'orange',
          icon: expect.anything(),
        });
      });
    });

    it('should handle revoking access to shared family history', async () => {
      renderInvitationManager();

      await userEvent.click(screen.getByText('Shared with Me'));

      await waitFor(() => {
        expect(screen.getByText('Remove Access')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Remove Access'));

      await waitFor(() => {
        expect(familyHistoryApi.removeMyAccess).toHaveBeenCalledWith('member-1');
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Access Removed',
          message: 'You no longer have access to this family history',
          color: 'orange',
          icon: expect.anything(),
        });
      });
    });

    it('should show empty state when no shared content', async () => {
      invitationApi.getPendingInvitations.mockResolvedValue([]);
      familyHistoryApi.getSharedFamilyHistory.mockResolvedValue({ shared_family_history: [] });
      
      renderInvitationManager();

      await userEvent.click(screen.getByText('Shared with Me'));

      await waitFor(() => {
        expect(screen.getByText('No Shared Records')).toBeInTheDocument();
        expect(screen.getByText('No medical records or family history has been shared with you yet.')).toBeInTheDocument();
      });
    });
  });

  describe('Response Modal Integration', () => {
    it('should open response modal when accepting invitation with detailed response', async () => {
      renderInvitationManager();

      await userEvent.click(screen.getByText('Shared with Me'));

      await waitFor(() => {
        expect(screen.getByTestId('accept-received-1')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('accept-received-1'));

      await waitFor(() => {
        expect(screen.getByTestId('invitation-response-modal')).toBeInTheDocument();
      });
    });

    it('should close response modal and refresh data on success', async () => {
      renderInvitationManager();

      await userEvent.click(screen.getByText('Shared with Me'));
      await userEvent.click(screen.getByTestId('accept-received-1'));

      await waitFor(() => {
        expect(screen.getByTestId('response-modal-success')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('response-modal-success'));

      await waitFor(() => {
        expect(screen.queryByTestId('invitation-response-modal')).not.toBeInTheDocument();
        // Should refresh data
        expect(invitationApi.getPendingInvitations).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors when loading data', async () => {
      invitationApi.getPendingInvitations.mockRejectedValue(new Error('API Error'));
      
      renderInvitationManager();

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Error',
          message: 'Failed to load invitations and shares',
          color: 'red',
          icon: expect.anything(),
        });
      });
    });

    it('should handle errors when responding to invitations', async () => {
      invitationApi.respondToInvitation.mockRejectedValue(new Error('Response failed'));
      
      renderInvitationManager();

      await userEvent.click(screen.getByText('Shared with Me'));

      await waitFor(() => {
        expect(screen.getByTestId('reject-received-1')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('reject-received-1'));

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Error',
          message: 'Failed to rejected invitation',
          color: 'red',
          icon: expect.anything(),
        });
      });
    });

    it('should handle errors when revoking shared access', async () => {
      familyHistoryApi.removeMyAccess.mockRejectedValue(new Error('Remove access failed'));
      
      renderInvitationManager();

      await userEvent.click(screen.getByText('Shared with Me'));

      await waitFor(() => {
        expect(screen.getByText('Remove Access')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Remove Access'));

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Error',
          message: 'Failed to remove access',
          color: 'red',
          icon: expect.anything(),
        });
      });
    });
  });

  describe('User Interface and Interactions', () => {
    it('should refresh data when refresh button is clicked', async () => {
      renderInvitationManager();

      // Wait for initial load
      await waitFor(() => {
        expect(invitationApi.getPendingInvitations).toHaveBeenCalledTimes(1);
      });

      // Click refresh button
      await userEvent.click(screen.getByText('Refresh'));

      await waitFor(() => {
        expect(invitationApi.getPendingInvitations).toHaveBeenCalledTimes(2);
        expect(invitationApi.getSentInvitations).toHaveBeenCalledTimes(2);
        expect(familyHistoryApi.getSharedFamilyHistory).toHaveBeenCalledTimes(2);
      });
    });

    it('should call onClose when close button is clicked', async () => {
      const mockOnClose = vi.fn();
      renderInvitationManager({ onClose: mockOnClose });

      await userEvent.click(screen.getByText('Close'));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onUpdate after successful operations', async () => {
      const mockOnUpdate = vi.fn();
      renderInvitationManager({ onUpdate: mockOnUpdate });

      await waitFor(() => {
        expect(screen.getByTestId('cancel-sent-1')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('cancel-sent-1'));

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalled();
      });
    });

    it('should display correct summary statistics', async () => {
      renderInvitationManager();

      await waitFor(() => {
        expect(screen.getByText(/2 sent.*1 pending.*1 active shares/)).toBeInTheDocument();
      });
    });

    it('should maintain tab state during operations', async () => {
      renderInvitationManager();

      // Switch to shared tab
      await userEvent.click(screen.getByText('Shared with Me'));

      await waitFor(() => {
        expect(screen.getByTestId('reject-received-1')).toBeInTheDocument();
      });

      // Perform operation
      await userEvent.click(screen.getByTestId('reject-received-1'));

      // Should remain on shared tab after operation
      await waitFor(() => {
        expect(screen.getByText(/Pending Invitations/)).toBeInTheDocument();
      });
    });
  });

  describe('Data Integration', () => {
    it('should filter out revoked and cancelled invitations from sent list', async () => {
      const sentWithRevoked = [
        ...mockSentInvitations,
        {
          id: 'sent-revoked',
          status: 'revoked',
          title: 'Revoked Invitation',
          invitation_type: 'family_history_share',
        },
        {
          id: 'sent-cancelled',
          status: 'cancelled',
          title: 'Cancelled Invitation', 
          invitation_type: 'family_history_share',
        },
      ];

      invitationApi.getSentInvitations.mockResolvedValue(sentWithRevoked);
      
      renderInvitationManager();

      await waitFor(() => {
        // Should only show non-revoked/cancelled invitations
        expect(screen.getByTestId('invitation-card-sent-1')).toBeInTheDocument();
        expect(screen.getByTestId('invitation-card-sent-2')).toBeInTheDocument();
        expect(screen.queryByTestId('invitation-card-sent-revoked')).not.toBeInTheDocument();
        expect(screen.queryByTestId('invitation-card-sent-cancelled')).not.toBeInTheDocument();
      });
    });

    it('should only show pending invitations in received section', async () => {
      const receivedWithAccepted = [
        ...mockReceivedInvitations,
        {
          id: 'received-accepted',
          status: 'accepted',
          title: 'Already Accepted',
          invitation_type: 'family_history_share',
        },
      ];

      invitationApi.getPendingInvitations.mockResolvedValue(receivedWithAccepted);
      
      renderInvitationManager();

      await userEvent.click(screen.getByText('Shared with Me'));

      await waitFor(() => {
        // Should only show pending invitations
        expect(screen.getByTestId('invitation-card-received-1')).toBeInTheDocument();
        expect(screen.queryByTestId('invitation-card-received-accepted')).not.toBeInTheDocument();
      });
    });
  });
});
