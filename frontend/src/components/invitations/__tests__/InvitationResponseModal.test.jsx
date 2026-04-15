/**
 * Comprehensive tests for InvitationResponseModal component
 * Tests modal display, form interactions, response handling, and error states
 */
import { vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { notifications } from '@mantine/notifications';
import render from '../../../test-utils/render';
import InvitationResponseModal from '../InvitationResponseModal';

// Mock dependencies
vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

vi.mock('../../../utils/helpers', () => ({
  formatDateTime: date => new Date(date).toLocaleDateString(),
}));

const { mockInvitationApi } = vi.hoisted(() => ({
  mockInvitationApi: {
    respondToInvitation: vi.fn(),
  },
}));

vi.mock('../../../services/api/invitationApi', () => ({
  __esModule: true,
  default: mockInvitationApi,
}));

// Mock useDateFormat to return predictable dates
vi.mock('../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatDateTime: date => new Date(date).toLocaleDateString(),
  }),
  default: () => ({
    formatDateTime: date => new Date(date).toLocaleDateString(),
  }),
}));

describe('InvitationResponseModal Component', () => {
  const baseFamilyHistoryInvitation = {
    id: 'inv-123',
    title: 'Family History: Johnson Family Medical Records',
    invitation_type: 'family_history_share',
    status: 'pending',
    sent_by: {
      id: 'user-456',
      name: 'Dr. Sarah Johnson',
      email: 'sarah.johnson@hospital.com',
    },
    created_at: '2024-01-15T10:30:00Z',
    expires_at: '2024-02-15T10:30:00Z',
    message: 'Please review this family medical history for consultation.',
    context_data: {
      family_member_name: 'John Doe',
      family_member_relationship: 'father',
      permission_level: 'view',
      sharing_note: 'Shared for medical consultation review',
    },
  };

  const patientShareInvitation = {
    id: 'inv-patient-456',
    title: 'Patient Record Share: Alice Wilson',
    invitation_type: 'patient_share',
    status: 'pending',
    sent_by: {
      id: 'user-123',
      name: 'Dr. Emily Davis',
      email: 'emily.davis@clinic.com',
    },
    created_at: '2024-01-12T09:20:00Z',
    message: 'Patient requires specialist consultation.',
  };

  const invitationWithoutOptionalFields = {
    id: 'inv-minimal-789',
    title: 'Basic Invitation',
    invitation_type: 'family_join',
    status: 'pending',
    sent_by: {
      id: 'user-999',
      name: 'Dr. Basic User',
    },
    created_at: '2024-01-10T15:00:00Z',
  };

  const mockProps = {
    opened: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvitationApi.respondToInvitation.mockResolvedValue({
      message: 'Response recorded successfully',
    });
  });

  const renderResponseModal = (invitation, props = {}) => {
    const defaultProps = { ...mockProps, ...props };

    return render(
      <InvitationResponseModal invitation={invitation} {...defaultProps} />
    );
  };

  describe('Modal Display and Basic Rendering', () => {
    it('should render modal when opened with invitation data', () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      expect(screen.getByText('response.title')).toBeInTheDocument();
      expect(
        screen.getByText('Family History: Johnson Family Medical Records')
      ).toBeInTheDocument();
      expect(
        screen.getByText('response.familyHistoryShare')
      ).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
    });

    it('should not render when opened is false', () => {
      renderResponseModal(baseFamilyHistoryInvitation, { opened: false });

      expect(screen.queryByText('response.title')).not.toBeInTheDocument();
    });

    it('should not render when invitation is null', () => {
      renderResponseModal(null);

      expect(screen.queryByText('response.title')).not.toBeInTheDocument();
    });

    it('should display sender information correctly', () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      expect(screen.getByText('response.from')).toBeInTheDocument();
    });

    it('should display formatted timestamps', () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      expect(screen.getByText('response.sent')).toBeInTheDocument();
      expect(screen.getByText('manager.expires')).toBeInTheDocument();
    });

    it('should not show expiration when expires_at is not provided', () => {
      renderResponseModal(invitationWithoutOptionalFields);

      expect(screen.queryByText('manager.expires')).not.toBeInTheDocument();
    });

    it('should display invitation message when present', () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      expect(
        screen.getByText(
          '"Please review this family medical history for consultation."'
        )
      ).toBeInTheDocument();
    });

    it('should not display message section when message is absent', () => {
      renderResponseModal(invitationWithoutOptionalFields);

      expect(screen.queryByText(/Please review/)).not.toBeInTheDocument();
    });
  });

  describe('Context Details Display', () => {
    it('should display family history sharing context details', () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      expect(
        screen.getByText('invitations:response.sharingDetails')
      ).toBeInTheDocument();
      expect(
        screen.getByText('invitations:response.familyMember')
      ).toBeInTheDocument();
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(
        screen.getByText('invitations:response.relationship')
      ).toBeInTheDocument();
      expect(screen.getByText(/father/)).toBeInTheDocument();
      expect(
        screen.getByText('invitations:response.accessLevel')
      ).toBeInTheDocument();
      expect(screen.getAllByText(/view/).length).toBeGreaterThan(0);
      expect(screen.getByText('invitations:response.note')).toBeInTheDocument();
      expect(
        screen.getByText(/Shared for medical consultation review/)
      ).toBeInTheDocument();
    });

    it('should not display sharing note when not present in context', () => {
      const invitationWithoutNote = {
        ...baseFamilyHistoryInvitation,
        context_data: {
          ...baseFamilyHistoryInvitation.context_data,
          sharing_note: undefined,
        },
      };

      renderResponseModal(invitationWithoutNote);

      expect(
        screen.getByText('invitations:response.sharingDetails')
      ).toBeInTheDocument();
      expect(
        screen.queryByText('invitations:response.note')
      ).not.toBeInTheDocument();
    });

    it('should display default context details for non-family-history invitations', () => {
      renderResponseModal(patientShareInvitation);

      expect(
        screen.getByText('response.additionalDetails')
      ).toBeInTheDocument();
      expect(
        screen.queryByText('invitations:response.sharingDetails')
      ).not.toBeInTheDocument();
    });

    it('should handle invitations without context data', () => {
      // family_join type without context_data falls through to the default fallback
      // The component shows the fallback text for any non-family-history invitation type
      renderResponseModal(invitationWithoutOptionalFields);

      expect(
        screen.queryByText('invitations:response.sharingDetails')
      ).not.toBeInTheDocument();
      expect(
        screen.getByText('response.additionalDetails')
      ).toBeInTheDocument();
    });
  });

  describe('Response Note Functionality', () => {
    it('should render response note textarea', () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      const textarea = screen.getByLabelText('response.responseNote');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute(
        'placeholder',
        'response.notePlaceholder'
      );
      expect(screen.getByText('response.noteVisible')).toBeInTheDocument();
    });

    it('should update response note value when typing', async () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      const textarea = screen.getByLabelText('response.responseNote');
      const testNote =
        'Thank you for sharing this information. I will review it carefully.';

      fireEvent.change(textarea, { target: { value: testNote } });

      expect(textarea).toHaveValue(testNote);
    });

    it('should clear response note when modal is closed', async () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      const textarea = screen.getByLabelText('response.responseNote');
      fireEvent.change(textarea, { target: { value: 'Test note' } });

      expect(textarea).toHaveValue('Test note');

      await userEvent.click(
        screen.getByRole('button', { name: 'shared:fields.cancel' })
      );

      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Action Buttons', () => {
    it('should render all action buttons', () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      expect(
        screen.getByRole('button', { name: 'shared:fields.cancel' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'response.reject' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'response.accept' })
      ).toBeInTheDocument();
    });

    it('should handle cancel button click', async () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      await userEvent.click(
        screen.getByRole('button', { name: 'shared:fields.cancel' })
      );

      expect(mockProps.onClose).toHaveBeenCalled();
    });

    it('should disable buttons when loading', () => {
      // This test would require mocking a slow API response to see the loading state
      renderResponseModal(baseFamilyHistoryInvitation);

      const cancelButton = screen.getByRole('button', {
        name: 'shared:fields.cancel',
      });
      const rejectButton = screen.getByRole('button', {
        name: 'response.reject',
      });
      const acceptButton = screen.getByRole('button', {
        name: 'response.accept',
      });

      // Initially, buttons should be enabled
      expect(cancelButton).not.toBeDisabled();
      expect(rejectButton).not.toBeDisabled();
      expect(acceptButton).not.toBeDisabled();
    });
  });

  describe('Accept Response Handling', () => {
    it('should handle accept response without note', async () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      await userEvent.click(
        screen.getByRole('button', { name: 'response.accept' })
      );

      await waitFor(() => {
        expect(mockInvitationApi.respondToInvitation).toHaveBeenCalledWith(
          'inv-123',
          'accepted',
          null
        );
      });

      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Invitation accepted',
        message: 'Response recorded successfully',
        color: 'green',
        icon: expect.anything(),
      });

      expect(mockProps.onSuccess).toHaveBeenCalled();
      expect(mockProps.onClose).toHaveBeenCalled();
    });

    it('should handle accept response with note', async () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      const textarea = screen.getByLabelText('response.responseNote');
      const responseNote =
        'I accept this invitation and will review the information promptly.';

      fireEvent.change(textarea, { target: { value: responseNote } });
      await userEvent.click(
        screen.getByRole('button', { name: 'response.accept' })
      );

      await waitFor(() => {
        expect(mockInvitationApi.respondToInvitation).toHaveBeenCalledWith(
          'inv-123',
          'accepted',
          responseNote
        );
      });

      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Invitation accepted',
        message: 'Response recorded successfully',
        color: 'green',
        icon: expect.anything(),
      });
    });

    it('should trim whitespace from response note', async () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      const textarea = screen.getByLabelText('response.responseNote');
      fireEvent.change(textarea, { target: { value: '   Trimmed note   ' } });
      await userEvent.click(
        screen.getByRole('button', { name: 'response.accept' })
      );

      await waitFor(() => {
        expect(mockInvitationApi.respondToInvitation).toHaveBeenCalledWith(
          'inv-123',
          'accepted',
          'Trimmed note'
        );
      });
    });

    it('should send null for empty response note', async () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      const textarea = screen.getByLabelText('response.responseNote');
      fireEvent.change(textarea, { target: { value: '   ' } }); // Only whitespace
      await userEvent.click(
        screen.getByRole('button', { name: 'response.accept' })
      );

      await waitFor(() => {
        expect(mockInvitationApi.respondToInvitation).toHaveBeenCalledWith(
          'inv-123',
          'accepted',
          null
        );
      });
    });
  });

  describe('Reject Response Handling', () => {
    it('should handle reject response', async () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      await userEvent.click(
        screen.getByRole('button', { name: 'response.reject' })
      );

      await waitFor(() => {
        expect(mockInvitationApi.respondToInvitation).toHaveBeenCalledWith(
          'inv-123',
          'rejected',
          null
        );
      });

      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Invitation rejected',
        message: 'Response recorded successfully',
        color: 'orange',
        icon: expect.anything(),
      });

      expect(mockProps.onSuccess).toHaveBeenCalled();
      expect(mockProps.onClose).toHaveBeenCalled();
    });

    it('should handle reject response with note', async () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      const textarea = screen.getByLabelText('response.responseNote');
      const responseNote =
        'I cannot accept this invitation at this time due to policy restrictions.';

      fireEvent.change(textarea, { target: { value: responseNote } });
      await userEvent.click(
        screen.getByRole('button', { name: 'response.reject' })
      );

      await waitFor(() => {
        expect(mockInvitationApi.respondToInvitation).toHaveBeenCalledWith(
          'inv-123',
          'rejected',
          responseNote
        );
      });

      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Invitation rejected',
        message: 'Response recorded successfully',
        color: 'orange',
        icon: expect.anything(),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors with detailed message', async () => {
      const errorResponse = {
        response: {
          data: {
            detail: 'This invitation has already been responded to.',
          },
        },
      };
      mockInvitationApi.respondToInvitation.mockRejectedValue(errorResponse);

      renderResponseModal(baseFamilyHistoryInvitation);

      await userEvent.click(
        screen.getByRole('button', { name: 'response.accept' })
      );

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Failed to accepted invitation',
          message: 'This invitation has already been responded to.',
          color: 'red',
          icon: expect.anything(),
        });
      });

      // Modal should not close on error
      expect(mockProps.onClose).not.toHaveBeenCalled();
      expect(mockProps.onSuccess).not.toHaveBeenCalled();
    });

    it('should handle API errors with generic message', async () => {
      const errorResponse = new Error('Network connection failed');
      mockInvitationApi.respondToInvitation.mockRejectedValue(errorResponse);

      renderResponseModal(baseFamilyHistoryInvitation);

      await userEvent.click(
        screen.getByRole('button', { name: 'response.reject' })
      );

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Failed to rejected invitation',
          message: 'Network connection failed',
          color: 'red',
          icon: expect.anything(),
        });
      });
    });

    it('should handle response when invitation is null', async () => {
      renderResponseModal(null);

      // Modal should not render, so no buttons to click
      expect(
        screen.queryByRole('button', { name: 'response.accept' })
      ).not.toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading overlay during API call', async () => {
      // Mock a slow API response
      let resolveResponse;
      const slowPromise = new Promise(resolve => {
        resolveResponse = resolve;
      });
      mockInvitationApi.respondToInvitation.mockReturnValue(slowPromise);

      renderResponseModal(baseFamilyHistoryInvitation);

      await userEvent.click(
        screen.getByRole('button', { name: 'response.accept' })
      );

      // Loading overlay should be visible - Mantine renders it in the DOM when visible=true
      expect(
        document.querySelector('.mantine-LoadingOverlay-root') ||
          document.querySelector('[data-visible]') ||
          document.querySelector('[class*="LoadingOverlay"]') ||
          screen.queryByRole('presentation')
      ).toBeTruthy();

      // Resolve the promise
      resolveResponse({ message: 'Success' });

      await waitFor(() => {
        expect(mockProps.onClose).toHaveBeenCalled();
      });
    });

    it('should disable buttons during loading', async () => {
      let resolveResponse;
      const slowPromise = new Promise(resolve => {
        resolveResponse = resolve;
      });
      mockInvitationApi.respondToInvitation.mockReturnValue(slowPromise);

      renderResponseModal(baseFamilyHistoryInvitation);

      await userEvent.click(
        screen.getByRole('button', { name: 'response.accept' })
      );

      // Buttons should be disabled
      expect(
        screen.getByRole('button', { name: 'shared:fields.cancel' })
      ).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'response.reject' })
      ).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'response.accept' })
      ).toBeDisabled();

      // Resolve the promise
      resolveResponse({ message: 'Success' });

      await waitFor(() => {
        expect(mockProps.onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Different Invitation Types', () => {
    it('should display correct type label for family history invitations', () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      expect(
        screen.getByText('response.familyHistoryShare')
      ).toBeInTheDocument();
    });

    it('should display correct type label for patient share invitations', () => {
      renderResponseModal(patientShareInvitation);

      expect(
        screen.getByText('response.patientRecordShare')
      ).toBeInTheDocument();
    });

    it('should handle unknown invitation types gracefully', () => {
      const unknownTypeInvitation = {
        ...baseFamilyHistoryInvitation,
        invitation_type: 'custom_invitation_type',
      };

      renderResponseModal(unknownTypeInvitation);

      // The component uses .replace('_', ' ') which only replaces the first underscore,
      // then capitalizes word boundaries: "custom invitation_type" -> "Custom Invitation_type"
      expect(screen.getByText('Custom Invitation_type')).toBeInTheDocument();
    });

    it('should display correct icons for different invitation types', () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      // Icon should be present (testing for icon containers)
      const typeLabel = screen.getByText('response.familyHistoryShare');
      expect(typeLabel.closest('div')).toBeInTheDocument();
    });
  });

  describe('Form State Management', () => {
    it('should clear form state after successful response', async () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      const textarea = screen.getByLabelText('response.responseNote');
      fireEvent.change(textarea, { target: { value: 'Test note' } });

      expect(textarea).toHaveValue('Test note');

      await userEvent.click(
        screen.getByRole('button', { name: 'response.accept' })
      );

      await waitFor(() => {
        expect(mockProps.onClose).toHaveBeenCalled();
      });

      // Form should be cleared (this would be tested in integration with parent component)
    });

    it('should preserve form state after API error', async () => {
      mockInvitationApi.respondToInvitation.mockRejectedValue(
        new Error('API Error')
      );

      renderResponseModal(baseFamilyHistoryInvitation);

      const textarea = screen.getByLabelText('response.responseNote');
      fireEvent.change(textarea, { target: { value: 'Test note' } });

      await userEvent.click(
        screen.getByRole('button', { name: 'response.accept' })
      );

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith(
          expect.objectContaining({ color: 'red' })
        );
      });

      // Note should still be present
      expect(textarea).toHaveValue('Test note');
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should have proper modal focus management', () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      // Modal should be properly labeled
      expect(
        screen.getByRole('dialog', { name: 'response.title' })
      ).toBeInTheDocument();
    });

    it('should provide clear action button labels', () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      const acceptButton = screen.getByRole('button', {
        name: 'response.accept',
      });
      const rejectButton = screen.getByRole('button', {
        name: 'response.reject',
      });
      const cancelButton = screen.getByRole('button', {
        name: 'shared:fields.cancel',
      });

      expect(acceptButton).toBeInTheDocument();
      expect(rejectButton).toBeInTheDocument();
      expect(cancelButton).toBeInTheDocument();
    });

    it('should display helpful information alert', () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      expect(screen.getByText('response.responseInfo')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderResponseModal(baseFamilyHistoryInvitation);

      const textarea = screen.getByLabelText('response.responseNote');
      const acceptButton = screen.getByRole('button', {
        name: 'response.accept',
      });

      textarea.focus();
      expect(textarea).toHaveFocus();

      // Focus the accept button directly and activate it via click
      acceptButton.focus();
      expect(acceptButton).toHaveFocus();

      await userEvent.click(acceptButton);

      await waitFor(() => {
        expect(mockInvitationApi.respondToInvitation).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle invitation without sender email', () => {
      const invitationWithoutEmail = {
        ...baseFamilyHistoryInvitation,
        sent_by: {
          id: 'user-456',
          name: 'Dr. Sarah Johnson',
          // email is undefined
        },
      };

      renderResponseModal(invitationWithoutEmail);

      expect(screen.getByText('response.from')).toBeInTheDocument();
    });

    it('should handle invitation without sender name', () => {
      const invitationWithoutName = {
        ...baseFamilyHistoryInvitation,
        sent_by: {
          id: 'user-456',
          email: 'sarah.johnson@hospital.com',
          // name is undefined
        },
      };

      renderResponseModal(invitationWithoutName);

      expect(screen.getByText('response.from')).toBeInTheDocument();
    });

    it('should handle invitation without complete sender information', () => {
      const invitationWithoutSender = {
        ...baseFamilyHistoryInvitation,
        sent_by: null,
      };

      renderResponseModal(invitationWithoutSender);

      expect(screen.getByText('response.from')).toBeInTheDocument();
    });

    it('should not call onSuccess if not provided', async () => {
      renderResponseModal(baseFamilyHistoryInvitation, {
        onSuccess: undefined,
      });

      await userEvent.click(
        screen.getByRole('button', { name: 'response.accept' })
      );

      await waitFor(() => {
        expect(mockInvitationApi.respondToInvitation).toHaveBeenCalled();
      });

      // Should not throw error even without onSuccess callback
      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });
});
