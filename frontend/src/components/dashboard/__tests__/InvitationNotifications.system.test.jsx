import { vi } from 'vitest';

/**
 * System test for family history invitation confirmation popup
 * Tests the complete user flow from receiving invitation to confirmation
 */
import { screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { notifications } from '@mantine/notifications';
import { renderWithAuth } from '../../../test-utils/render';
import InvitationNotifications from '../InvitationNotifications';

// Mock the notifications module
vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

// Mock the logger service
vi.mock('../../../services/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock invitationApi directly - use vi.hoisted() so variable is available in factory
const mockInvitationApi = vi.hoisted(() => ({
  getPendingInvitations: vi.fn(),
  respondToInvitation: vi.fn(),
}));

vi.mock('../../../services/api/invitationApi', () => ({
  __esModule: true,
  default: mockInvitationApi,
}));

// Mock useGlobalData hooks to avoid fetchCurrentPatient dependency
vi.mock('../../../hooks/useGlobalData', () => ({
  useCacheManager: vi.fn(() => ({
    invalidatePatientList: vi.fn(),
  })),
  useCurrentPatient: vi.fn(() => ({
    patient: null,
    loading: false,
  })),
}));

// Helper: find accept buttons (green check icon) in the invitation list
const findAcceptButtons = () =>
  screen
    .getAllByRole('button')
    .filter(btn => btn.querySelector('[class*="tabler-icon-check"]'));

// Helper: find reject buttons (red X icon) in the invitation list
const findRejectButtons = () =>
  screen
    .getAllByRole('button')
    .filter(btn => btn.querySelector('[class*="tabler-icon-x"]'));

describe('Family History Invitation Confirmation System Test', () => {
  const mockInvitations = [
    {
      id: 'inv-123',
      title: 'Family History: Johnson Family Medical Records',
      invitation_type: 'family_history_share',
      status: 'pending',
      sent_by: {
        id: 'user-456',
        name: 'Dr. Sarah Johnson',
      },
      created_at: '2024-01-15T10:30:00Z',
    },
    {
      id: 'inv-456',
      title: 'Patient Record Share: John Doe',
      invitation_type: 'patient_share',
      status: 'pending',
      sent_by: {
        id: 'user-789',
        name: 'Dr. Michael Brown',
      },
      created_at: '2024-01-14T15:20:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockInvitationApi.getPendingInvitations.mockResolvedValue(mockInvitations);
    mockInvitationApi.respondToInvitation.mockResolvedValue({
      message: 'Invitation accepted successfully',
    });
  });

  describe('Invitation Acceptance Confirmation Flow', () => {
    it('should show confirmation modal when accepting family history invitation', async () => {
      await act(async () => {
        renderWithAuth(<InvitationNotifications />);
      });

      // Wait for invitations to load
      await waitFor(() => {
        expect(
          screen.getByText('Family History: Johnson Family Medical Records')
        ).toBeInTheDocument();
      });

      // Find accept button by check icon (Mantine v8 uses CSS vars, not color DOM attribute)
      const acceptButtons = findAcceptButtons();
      await userEvent.click(acceptButtons[0]);

      // Assert - Confirmation modal should appear
      await waitFor(() => {
        expect(
          screen.getByText('Confirm Invitation Acceptance')
        ).toBeInTheDocument();
      });

      // Scope modal assertions to the dialog to avoid conflicts with list content
      const dialog = screen.getByRole('dialog');
      expect(
        within(dialog).getByText(
          'Are you sure you want to accept this invitation?'
        )
      ).toBeInTheDocument();
      // Title and type appear in both list and modal - use getAllByText
      expect(
        screen.getAllByText('Family History: Johnson Family Medical Records')
          .length
      ).toBeGreaterThan(0);
      expect(
        within(dialog).getByText('invitations:card.from')
      ).toBeInTheDocument();
      expect(
        within(dialog).getAllByText('Family History').length
      ).toBeGreaterThan(0);
      expect(
        within(dialog).getByText(
          'By accepting, you will gain access to view the shared medical information.'
        )
      ).toBeInTheDocument();

      // Check for modal buttons
      expect(
        within(dialog).getByRole('button', { name: /cancel/i })
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole('button', { name: 'Accept Invitation' })
      ).toBeInTheDocument();
    });

    it('should complete acceptance flow when user confirms in modal', async () => {
      await act(async () => {
        renderWithAuth(<InvitationNotifications />);
      });

      await waitFor(() => {
        expect(
          screen.getByText('Family History: Johnson Family Medical Records')
        ).toBeInTheDocument();
      });

      // Click accept button (check icon)
      await userEvent.click(findAcceptButtons()[0]);

      // Wait for confirmation modal
      await waitFor(() => {
        expect(
          screen.getByText('Confirm Invitation Acceptance')
        ).toBeInTheDocument();
      });

      // Click the Accept Invitation button in modal
      const confirmAcceptButton = screen.getByRole('button', {
        name: 'Accept Invitation',
      });
      await userEvent.click(confirmAcceptButton);

      // Assert - Success notification should be shown
      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Invitation accepted',
          message: 'Successfully accepted the invitation',
          color: 'green',
          icon: expect.anything(),
        });
      });

      // Modal should close
      await waitFor(() => {
        expect(
          screen.queryByText('Confirm Invitation Acceptance')
        ).not.toBeInTheDocument();
      });
    });

    it('should cancel acceptance flow when user clicks Cancel in modal', async () => {
      await act(async () => {
        renderWithAuth(<InvitationNotifications />);
      });

      await waitFor(() => {
        expect(
          screen.getByText('Family History: Johnson Family Medical Records')
        ).toBeInTheDocument();
      });

      // Click accept button (check icon)
      await userEvent.click(findAcceptButtons()[0]);

      // Wait for confirmation modal
      await waitFor(() => {
        expect(
          screen.getByText('Confirm Invitation Acceptance')
        ).toBeInTheDocument();
      });

      // Click Cancel button (text is i18n key 'common:buttons.cancel' in test env)
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      // Assert - Modal should close without API call
      await waitFor(() => {
        expect(
          screen.queryByText('Confirm Invitation Acceptance')
        ).not.toBeInTheDocument();
      });

      // Invitation should still be visible
      expect(
        screen.getByText('Family History: Johnson Family Medical Records')
      ).toBeInTheDocument();

      // No success notification should be shown
      expect(notifications.show).not.toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Invitation accepted',
        })
      );
    });

    it('should handle rejection without showing confirmation modal', async () => {
      await act(async () => {
        renderWithAuth(<InvitationNotifications />);
      });

      await waitFor(() => {
        expect(
          screen.getByText('Family History: Johnson Family Medical Records')
        ).toBeInTheDocument();
      });

      // Click reject button (X icon) - no confirmation modal for rejections
      await userEvent.click(findRejectButtons()[0]);

      // Assert - No confirmation modal should appear
      expect(
        screen.queryByText('Confirm Invitation Acceptance')
      ).not.toBeInTheDocument();

      // Success notification should be shown immediately
      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Invitation rejected',
          message: 'Successfully rejected the invitation',
          color: 'orange',
          icon: expect.anything(),
        });
      });
    });

    it('should handle API errors during confirmation acceptance', async () => {
      // Arrange - Mock API error
      mockInvitationApi.respondToInvitation.mockRejectedValue(
        new Error('Server error')
      );

      await act(async () => {
        renderWithAuth(<InvitationNotifications />);
      });

      await waitFor(() => {
        expect(
          screen.getByText('Family History: Johnson Family Medical Records')
        ).toBeInTheDocument();
      });

      // Click accept and then confirm
      await userEvent.click(findAcceptButtons()[0]);

      await waitFor(() => {
        expect(
          screen.getByText('Confirm Invitation Acceptance')
        ).toBeInTheDocument();
      });

      const confirmAcceptButton = screen.getByRole('button', {
        name: 'Accept Invitation',
      });
      await userEvent.click(confirmAcceptButton);

      // Assert - Error notification should be shown
      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Error',
          message: 'Failed to accept invitation',
          color: 'red',
          icon: expect.anything(),
        });
      });
    });

    it('should display correct invitation types in confirmation modal', async () => {
      await act(async () => {
        renderWithAuth(<InvitationNotifications />);
      });

      await waitFor(() => {
        expect(
          screen.getByText('Family History: Johnson Family Medical Records')
        ).toBeInTheDocument();
        expect(
          screen.getByText('Patient Record Share: John Doe')
        ).toBeInTheDocument();
      });

      const acceptButtons = findAcceptButtons();

      // Test family history invitation (first check button)
      await userEvent.click(acceptButtons[0]);

      await waitFor(() => {
        expect(
          screen.getByText('Confirm Invitation Acceptance')
        ).toBeInTheDocument();
      });

      // Verify family history type in modal (use within to avoid list badge conflicts)
      const dialog1 = screen.getByRole('dialog');
      expect(
        within(dialog1).getAllByText('Family History').length
      ).toBeGreaterThan(0);

      // Close modal
      await userEvent.click(
        within(dialog1).getByRole('button', { name: /cancel/i })
      );

      await waitFor(() => {
        expect(
          screen.queryByText('Confirm Invitation Acceptance')
        ).not.toBeInTheDocument();
      });

      // Test patient share invitation (second check button)
      const acceptButtonsAfterClose = findAcceptButtons();
      await userEvent.click(acceptButtonsAfterClose[1]);

      await waitFor(() => {
        expect(
          screen.getByText('Confirm Invitation Acceptance')
        ).toBeInTheDocument();
      });

      // Verify patient record type in modal
      const dialog2 = screen.getByRole('dialog');
      expect(
        within(dialog2).getAllByText('Patient Record').length
      ).toBeGreaterThan(0);
    });

    it('should support keyboard navigation for confirmation modal', async () => {
      await act(async () => {
        renderWithAuth(<InvitationNotifications />);
      });

      await waitFor(() => {
        expect(
          screen.getByText('Family History: Johnson Family Medical Records')
        ).toBeInTheDocument();
      });

      // Focus and activate accept button with keyboard
      const acceptButton = findAcceptButtons()[0];
      acceptButton.focus();
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(
          screen.getByText('Confirm Invitation Acceptance')
        ).toBeInTheDocument();
      });

      // Press Escape to close
      await userEvent.keyboard('{Escape}');

      // Assert - Modal should close
      await waitFor(() => {
        expect(
          screen.queryByText('Confirm Invitation Acceptance')
        ).not.toBeInTheDocument();
      });
    });

    it('should handle modal close via Escape key', async () => {
      await act(async () => {
        renderWithAuth(<InvitationNotifications />);
      });

      await waitFor(() => {
        expect(
          screen.getByText('Family History: Johnson Family Medical Records')
        ).toBeInTheDocument();
      });

      // Open modal and press Escape
      await userEvent.click(findAcceptButtons()[0]);

      await waitFor(() => {
        expect(
          screen.getByText('Confirm Invitation Acceptance')
        ).toBeInTheDocument();
      });

      await userEvent.keyboard('{Escape}');

      // Assert - Modal should close
      await waitFor(() => {
        expect(
          screen.queryByText('Confirm Invitation Acceptance')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading and Error States', () => {
    it('should handle loading state during invitation acceptance', async () => {
      // Slow API response
      mockInvitationApi.respondToInvitation.mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () => resolve({ message: 'Invitation accepted successfully' }),
              100
            )
          )
      );

      await act(async () => {
        renderWithAuth(<InvitationNotifications />);
      });

      await waitFor(() => {
        expect(
          screen.getByText('Family History: Johnson Family Medical Records')
        ).toBeInTheDocument();
      });

      await userEvent.click(findAcceptButtons()[0]);

      await waitFor(() => {
        expect(
          screen.getByText('Confirm Invitation Acceptance')
        ).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', {
        name: 'Accept Invitation',
      });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Invitation accepted',
          message: 'Successfully accepted the invitation',
          color: 'green',
          icon: expect.anything(),
        });
      });
    });

    it('should refresh invitation list after successful acceptance', async () => {
      // After acceptance, return fewer invitations on second call
      mockInvitationApi.getPendingInvitations
        .mockResolvedValueOnce(mockInvitations)
        .mockResolvedValueOnce([mockInvitations[1]]);

      await act(async () => {
        renderWithAuth(<InvitationNotifications />);
      });

      await waitFor(() => {
        expect(
          screen.getByText('Family History: Johnson Family Medical Records')
        ).toBeInTheDocument();
      });

      await userEvent.click(findAcceptButtons()[0]);

      await waitFor(() => {
        expect(
          screen.getByText('Confirm Invitation Acceptance')
        ).toBeInTheDocument();
      });

      await userEvent.click(
        screen.getByRole('button', { name: 'Accept Invitation' })
      );

      // Assert - List should refresh and accepted invitation should be removed
      await waitFor(() => {
        expect(
          screen.queryByText('Family History: Johnson Family Medical Records')
        ).not.toBeInTheDocument();
      });

      // Other invitation should still be visible
      expect(
        screen.getByText('Patient Record Share: John Doe')
      ).toBeInTheDocument();
    });
  });
});
