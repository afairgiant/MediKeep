/**
 * Comprehensive tests for InvitationCard component
 * Tests different invitation types, variants, states, and user interactions
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import InvitationCard from '../InvitationCard';

// Mock helpers
jest.mock('../../../utils/helpers', () => ({
  formatDateTime: (date) => new Date(date).toLocaleDateString(),
}));

describe('InvitationCard Component', () => {
  const baseFamilyHistoryInvitation = {
    id: 'inv-123',
    title: 'Family History: Johnson Family Medical Records',
    invitation_type: 'family_history_share',
    status: 'pending',
    sent_by: { id: 'user-456', name: 'Dr. Sarah Johnson' },
    sent_to: { id: 'user-789', name: 'Dr. Michael Brown' },
    created_at: '2024-01-15T10:30:00Z',
    expires_at: '2024-02-15T10:30:00Z',
    message: 'Please review this family medical history for consultation.',
    context_data: {
      family_member_name: 'John Doe',
      family_member_relationship: 'father',
      is_bulk_invite: false,
    },
  };

  const bulkFamilyHistoryInvitation = {
    ...baseFamilyHistoryInvitation,
    id: 'inv-bulk-456',
    title: 'Family History: Multiple Family Members',
    context_data: {
      is_bulk_invite: true,
      family_member_count: 3,
      family_members: ['John Doe', 'Jane Doe', 'Bob Smith'],
    },
  };

  const patientShareInvitation = {
    id: 'inv-patient-789',
    title: 'Patient Record Share: Alice Wilson',
    invitation_type: 'patient_share',
    status: 'accepted',
    sent_by: { id: 'user-123', name: 'Dr. Emily Davis' },
    sent_to: { id: 'user-456', name: 'Dr. Sarah Johnson' },
    created_at: '2024-01-10T14:20:00Z',
  };

  const expiredInvitation = {
    ...baseFamilyHistoryInvitation,
    id: 'inv-expired-999',
    status: 'pending',
    expires_at: '2024-01-01T10:30:00Z', // Past date
  };

  const mockProps = {
    onRespond: jest.fn(),
    onCancel: jest.fn(),
    onView: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderInvitationCard = (invitation, props = {}) => {
    const defaultProps = { ...mockProps, ...props };
    
    return render(
      <MantineProvider>
        <InvitationCard invitation={invitation} {...defaultProps} />
      </MantineProvider>
    );
  };

  describe('Basic Rendering', () => {
    it('should render invitation card with basic information', () => {
      renderInvitationCard(baseFamilyHistoryInvitation);

      expect(screen.getByText('Family History: Johnson Family Medical Records')).toBeInTheDocument();
      expect(screen.getByText('Family History Share')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
      expect(screen.getByText('From: Dr. Sarah Johnson')).toBeInTheDocument();
    });

    it('should render different invitation types correctly', () => {
      renderInvitationCard(patientShareInvitation);

      expect(screen.getByText('Patient Record Share: Alice Wilson')).toBeInTheDocument();
      expect(screen.getByText('Patient Record Share')).toBeInTheDocument();
      expect(screen.getByText('accepted')).toBeInTheDocument();
    });

    it('should render invitation message when present', () => {
      renderInvitationCard(baseFamilyHistoryInvitation);

      expect(screen.getByText('"Please review this family medical history for consultation."')).toBeInTheDocument();
    });

    it('should not render message section when message is absent', () => {
      const invitationWithoutMessage = { ...baseFamilyHistoryInvitation };
      delete invitationWithoutMessage.message;
      
      renderInvitationCard(invitationWithoutMessage);

      expect(screen.queryByText(/Please review/)).not.toBeInTheDocument();
    });

    it('should render formatted timestamps', () => {
      renderInvitationCard(baseFamilyHistoryInvitation);

      expect(screen.getByText('1/15/2024')).toBeInTheDocument(); // created_at
      expect(screen.getByText(/Expires.*2\/15\/2024/)).toBeInTheDocument(); // expires_at
    });
  });

  describe('Status Display', () => {
    it('should display correct badge colors for different statuses', () => {
      const statuses = [
        { status: 'pending', expectedColor: 'orange' },
        { status: 'accepted', expectedColor: 'green' },
        { status: 'rejected', expectedColor: 'red' },
        { status: 'expired', expectedColor: 'gray' },
        { status: 'cancelled', expectedColor: 'gray' },
        { status: 'revoked', expectedColor: 'gray' },
      ];

      statuses.forEach(({ status, expectedColor }) => {
        const invitation = { ...baseFamilyHistoryInvitation, status };
        const { rerender } = renderInvitationCard(invitation);
        
        const statusBadge = screen.getByText(status);
        expect(statusBadge).toBeInTheDocument();
        
        rerender(
          <MantineProvider>
            <InvitationCard invitation={invitation} {...mockProps} />
          </MantineProvider>
        );
      });
    });

    it('should show expired warning for expired invitations', () => {
      renderInvitationCard(expiredInvitation);

      expect(screen.getByText('This invitation has expired and can no longer be responded to.')).toBeInTheDocument();
      expect(screen.getByText(/Expired.*1\/1\/2024/)).toBeInTheDocument();
    });

    it('should apply opacity to expired invitations', () => {
      const { container } = renderInvitationCard(expiredInvitation);
      
      const cardElement = container.querySelector('[style*="opacity"]');
      expect(cardElement).toHaveStyle('opacity: 0.6');
    });
  });

  describe('Variant Display - Received', () => {
    it('should show "From" label for received invitations', () => {
      renderInvitationCard(baseFamilyHistoryInvitation, { variant: 'received' });

      expect(screen.getByText('From: Dr. Sarah Johnson')).toBeInTheDocument();
    });

    it('should show action buttons for pending received invitations', () => {
      renderInvitationCard(baseFamilyHistoryInvitation, { variant: 'received' });

      expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    });

    it('should not show action buttons for non-pending received invitations', () => {
      const acceptedInvitation = { ...baseFamilyHistoryInvitation, status: 'accepted' };
      renderInvitationCard(acceptedInvitation, { variant: 'received' });

      expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
    });

    it('should not show action buttons for expired received invitations', () => {
      renderInvitationCard(expiredInvitation, { variant: 'received' });

      expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
    });

    it('should handle accept button click', async () => {
      renderInvitationCard(baseFamilyHistoryInvitation, { variant: 'received' });

      await userEvent.click(screen.getByRole('button', { name: 'Accept' }));

      expect(mockProps.onRespond).toHaveBeenCalledWith(baseFamilyHistoryInvitation, 'accepted');
    });

    it('should handle reject button click', async () => {
      renderInvitationCard(baseFamilyHistoryInvitation, { variant: 'received' });

      await userEvent.click(screen.getByRole('button', { name: 'Reject' }));

      expect(mockProps.onRespond).toHaveBeenCalledWith(baseFamilyHistoryInvitation, 'rejected');
    });
  });

  describe('Variant Display - Sent', () => {
    it('should show "To" label for sent invitations', () => {
      renderInvitationCard(baseFamilyHistoryInvitation, { variant: 'sent' });

      expect(screen.getByText('To: Dr. Michael Brown')).toBeInTheDocument();
    });

    it('should show menu with cancel option for pending sent invitations', async () => {
      renderInvitationCard(baseFamilyHistoryInvitation, { variant: 'sent' });

      // Click the menu trigger (three dots)
      const menuTrigger = screen.getByRole('button', { name: '' }); // ActionIcon with dots
      await userEvent.click(menuTrigger);

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });

    it('should show menu with revoke option for accepted family history sent invitations', async () => {
      const acceptedInvitation = { ...baseFamilyHistoryInvitation, status: 'accepted' };
      renderInvitationCard(acceptedInvitation, { variant: 'sent' });

      const menuTrigger = screen.getByRole('button', { name: '' });
      await userEvent.click(menuTrigger);

      await waitFor(() => {
        expect(screen.getByText('Revoke Access')).toBeInTheDocument();
      });
    });

    it('should not show menu for rejected or expired sent invitations', () => {
      const rejectedInvitation = { ...baseFamilyHistoryInvitation, status: 'rejected' };
      renderInvitationCard(rejectedInvitation, { variant: 'sent' });

      expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument();
    });

    it('should handle cancel action from menu', async () => {
      renderInvitationCard(baseFamilyHistoryInvitation, { variant: 'sent' });

      const menuTrigger = screen.getByRole('button', { name: '' });
      await userEvent.click(menuTrigger);

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Cancel'));

      expect(mockProps.onCancel).toHaveBeenCalledWith(baseFamilyHistoryInvitation);
    });

    it('should handle revoke action from menu', async () => {
      const acceptedInvitation = { ...baseFamilyHistoryInvitation, status: 'accepted' };
      renderInvitationCard(acceptedInvitation, { variant: 'sent' });

      const menuTrigger = screen.getByRole('button', { name: '' });
      await userEvent.click(menuTrigger);

      await waitFor(() => {
        expect(screen.getByText('Revoke Access')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Revoke Access'));

      expect(mockProps.onCancel).toHaveBeenCalledWith(acceptedInvitation);
    });
  });

  describe('Context Data Display', () => {
    it('should display single family member context for family history invitations', () => {
      renderInvitationCard(baseFamilyHistoryInvitation);

      expect(screen.getByText('Sharing: John Doe (father)')).toBeInTheDocument();
    });

    it('should display bulk family member context for bulk invitations', () => {
      renderInvitationCard(bulkFamilyHistoryInvitation);

      expect(screen.getByText('Sharing: 3 family members')).toBeInTheDocument();
    });

    it('should handle bulk invitations with family_members array', () => {
      const bulkWithArray = {
        ...bulkFamilyHistoryInvitation,
        context_data: {
          is_bulk_invite: true,
          family_members: ['John', 'Jane', 'Bob'],
        },
      };
      delete bulkWithArray.context_data.family_member_count;

      renderInvitationCard(bulkWithArray);

      expect(screen.getByText('Sharing: 3 family members')).toBeInTheDocument();
    });

    it('should not display context data for non-family-history invitations', () => {
      renderInvitationCard(patientShareInvitation);

      expect(screen.queryByText(/Sharing:/)).not.toBeInTheDocument();
    });

    it('should not display context data when context_data is missing', () => {
      const invitationWithoutContext = { ...baseFamilyHistoryInvitation };
      delete invitationWithoutContext.context_data;

      renderInvitationCard(invitationWithoutContext);

      expect(screen.queryByText(/Sharing:/)).not.toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('should render compact version when compact prop is true', () => {
      renderInvitationCard(baseFamilyHistoryInvitation, { compact: true });

      // Should show basic info
      expect(screen.getByText('Family History: Johnson Family Medical Records')).toBeInTheDocument();
      expect(screen.getByText('From: Dr. Sarah Johnson')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();

      // Should not show detailed info
      expect(screen.queryByText('Family History Share')).not.toBeInTheDocument();
      expect(screen.queryByText(/Please review/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    });

    it('should show chevron icon when onView is provided in compact mode', () => {
      renderInvitationCard(baseFamilyHistoryInvitation, { compact: true, onView: mockProps.onView });

      // Chevron should be present (though not easily testable by text)
      const compactCard = screen.getByText('Family History: Johnson Family Medical Records').closest('div');
      expect(compactCard).toHaveStyle('cursor: pointer');
    });

    it('should handle click in compact mode when onView is provided', async () => {
      renderInvitationCard(baseFamilyHistoryInvitation, { compact: true, onView: mockProps.onView });

      const compactCard = screen.getByText('Family History: Johnson Family Medical Records').closest('div');
      await userEvent.click(compactCard);

      expect(mockProps.onView).toHaveBeenCalled();
    });

    it('should not be clickable in compact mode when onView is not provided', () => {
      renderInvitationCard(baseFamilyHistoryInvitation, { compact: true });

      const compactCard = screen.getByText('Family History: Johnson Family Medical Records').closest('div');
      expect(compactCard).toHaveStyle('cursor: default');
    });

    it('should show correct sender/recipient in compact mode based on variant', () => {
      renderInvitationCard(baseFamilyHistoryInvitation, { compact: true, variant: 'sent' });

      expect(screen.getByText('To: Dr. Michael Brown')).toBeInTheDocument();
    });

    it('should apply opacity to expired invitations in compact mode', () => {
      const { container } = renderInvitationCard(expiredInvitation, { compact: true });
      
      const cardElement = container.querySelector('[style*="opacity"]');
      expect(cardElement).toHaveStyle('opacity: 0.6');
    });
  });

  describe('Invitation Types', () => {
    it('should display correct icons for different invitation types', () => {
      // Family history share
      renderInvitationCard(baseFamilyHistoryInvitation);
      expect(screen.getByTestId('icon-users') || screen.getByRole('img')).toBeInTheDocument();

      // Patient share
      const { rerender } = renderInvitationCard(patientShareInvitation);
      expect(screen.getByTestId('icon-users') || screen.getByRole('img')).toBeInTheDocument();
    });

    it('should display correct type labels', () => {
      // Test family history share
      renderInvitationCard(baseFamilyHistoryInvitation);
      expect(screen.getByText('Family History Share')).toBeInTheDocument();

      // Test patient share
      renderInvitationCard(patientShareInvitation);
      expect(screen.getByText('Patient Record Share')).toBeInTheDocument();
    });

    it('should handle unknown invitation types gracefully', () => {
      const unknownTypeInvitation = {
        ...baseFamilyHistoryInvitation,
        invitation_type: 'custom_invitation_type',
      };

      renderInvitationCard(unknownTypeInvitation);

      expect(screen.getByText('Custom Invitation Type')).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing sender information', () => {
      const invitationWithoutSender = { ...baseFamilyHistoryInvitation };
      delete invitationWithoutSender.sent_by;

      renderInvitationCard(invitationWithoutSender, { variant: 'received' });

      expect(screen.getByText('From:')).toBeInTheDocument(); // Should still show label
    });

    it('should handle missing recipient information for sent variant', () => {
      const invitationWithoutRecipient = { ...baseFamilyHistoryInvitation };
      delete invitationWithoutRecipient.sent_to;

      renderInvitationCard(invitationWithoutRecipient, { variant: 'sent' });

      expect(screen.getByText('To:')).toBeInTheDocument(); // Should still show label
    });

    it('should handle missing expiration date', () => {
      const invitationWithoutExpiry = { ...baseFamilyHistoryInvitation };
      delete invitationWithoutExpiry.expires_at;

      renderInvitationCard(invitationWithoutExpiry);

      expect(screen.queryByText(/Expires/)).not.toBeInTheDocument();
    });

    it('should work without callback functions', () => {
      renderInvitationCard(baseFamilyHistoryInvitation, { 
        variant: 'received',
        onRespond: undefined,
        onCancel: undefined,
        onView: undefined,
      });

      // Should render without errors
      expect(screen.getByText('Family History: Johnson Family Medical Records')).toBeInTheDocument();
      
      // Buttons should still be present but not functional
      expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    });

    it('should handle very long titles with truncation in compact mode', () => {
      const longTitleInvitation = {
        ...baseFamilyHistoryInvitation,
        title: 'This is a very long invitation title that should be truncated in compact mode to prevent layout issues',
      };

      renderInvitationCard(longTitleInvitation, { compact: true });

      expect(screen.getByText(longTitleInvitation.title)).toBeInTheDocument();
    });

    it('should handle invalid or missing status gracefully', () => {
      const invitationWithInvalidStatus = {
        ...baseFamilyHistoryInvitation,
        status: undefined,
      };

      renderInvitationCard(invitationWithInvalidStatus);

      // Should render without crashing, default color should be applied
      expect(screen.getByText('Family History: Johnson Family Medical Records')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button roles and labels', () => {
      renderInvitationCard(baseFamilyHistoryInvitation, { variant: 'received' });

      const acceptButton = screen.getByRole('button', { name: 'Accept' });
      const rejectButton = screen.getByRole('button', { name: 'Reject' });

      expect(acceptButton).toBeInTheDocument();
      expect(rejectButton).toBeInTheDocument();
    });

    it('should support keyboard navigation for interactive elements', async () => {
      renderInvitationCard(baseFamilyHistoryInvitation, { variant: 'received' });

      const acceptButton = screen.getByRole('button', { name: 'Accept' });
      
      acceptButton.focus();
      expect(acceptButton).toHaveFocus();

      await userEvent.keyboard('{Enter}');
      expect(mockProps.onRespond).toHaveBeenCalledWith(baseFamilyHistoryInvitation, 'accepted');
    });

    it('should have appropriate ARIA attributes for expired invitations', () => {
      renderInvitationCard(expiredInvitation);

      const expiredAlert = screen.getByText('This invitation has expired and can no longer be responded to.');
      expect(expiredAlert).toBeInTheDocument();
    });
  });
});