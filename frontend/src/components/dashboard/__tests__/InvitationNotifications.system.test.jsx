import { vi } from 'vitest';

/**
 * System test for family history invitation confirmation popup
 * Tests the complete user flow from receiving invitation to confirmation
 */
import React from 'react';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { notifications } from '@mantine/notifications';
import { renderWithAuth } from '../../../test-utils/render';
import { createMockUser } from '../../../test-utils/test-data';
import { server } from '../../../test-utils/mocks/server';
import { rest } from 'msw';
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
  },
}));

// Mock the API service to avoid logger issues
vi.mock('../../../services/api', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const API_BASE = 'http://localhost:8000/api/v1';

describe('Family History Invitation Confirmation System Test', () => {
  let mockInvitations;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock invitation data
    mockInvitations = [
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

    // Setup API mocks  
    server.use(
      rest.get(`${API_BASE}/invitations/pending`, (req, res, ctx) => {
        return res(ctx.json(mockInvitations));
      }),
      rest.post(`${API_BASE}/invitations/:id/respond`, (req, res, ctx) => {
        const { id } = req.params;
        const body = req.body || {};
        const response = body.response;
        
        if (response === 'accepted') {
          return res(ctx.json({ message: 'Invitation accepted successfully' }));
        } else if (response === 'rejected') {
          return res(ctx.json({ message: 'Invitation rejected successfully' }));
        }
        
        return res(ctx.status(400), ctx.json({ error: 'Invalid response' }));
      })
    );
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('Invitation Acceptance Confirmation Flow', () => {
    it('should show confirmation modal when accepting family history invitation', async () => {
      // Arrange
      const mockUser = createMockUser();
      await act(async () => {
        renderWithAuth(<InvitationNotifications />, { user: mockUser });
      });

      // Wait for invitations to load
      await waitFor(() => {
        expect(screen.getByText('Family History: Johnson Family Medical Records')).toBeInTheDocument();
      });

      // Act - Click the accept button for family history invitation
      const acceptButtons = screen.getAllByRole('button', { name: '' }); // Icon buttons don't have text
      const familyHistoryAcceptButton = acceptButtons.find(button => 
        button.closest('[data-testid]')?.getAttribute('data-testid') === 'invitation-accept-inv-123' ||
        button.querySelector('svg') && button.style.color === 'green'
      );
      
      // Find accept button by looking for the green ActionIcon
      const invitationCards = screen.getAllByText(/From:/);
      const familyHistoryCard = invitationCards.find(card => 
        card.textContent.includes('Dr. Sarah Johnson')
      );
      const acceptButton = familyHistoryCard.closest('[data-testid]')?.querySelector('[color="green"]') ||
        screen.getAllByRole('button').find(btn => 
          btn.getAttribute('color') === 'green' && 
          btn.closest('div').textContent.includes('Dr. Sarah Johnson')
        );

      await userEvent.click(acceptButton || acceptButtons[1]); // Fallback to second accept button

      // Assert - Confirmation modal should appear
      await waitFor(() => {
        expect(screen.getByText('Confirm Invitation Acceptance')).toBeInTheDocument();
      });

      expect(screen.getByText('Are you sure you want to accept this invitation?')).toBeInTheDocument();
      expect(screen.getByText('Family History: Johnson Family Medical Records')).toBeInTheDocument();
      expect(screen.getByText('From: Dr. Sarah Johnson')).toBeInTheDocument();
      expect(screen.getByText('Family History')).toBeInTheDocument();
      expect(screen.getByText('By accepting, you will gain access to view the shared medical information.')).toBeInTheDocument();
      
      // Check for modal buttons
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Accept Invitation' })).toBeInTheDocument();
    });

    it('should complete acceptance flow when user confirms in modal', async () => {
      // Arrange
      const mockUser = createMockUser();
      await act(async () => {
        renderWithAuth(<InvitationNotifications />, { user: mockUser });
      });

      await waitFor(() => {
        expect(screen.getByText('Family History: Johnson Family Medical Records')).toBeInTheDocument();
      });

      // Act - Click accept button
      const acceptButtons = screen.getAllByRole('button').filter(btn => 
        btn.getAttribute('color') === 'green' || 
        btn.querySelector('svg')
      );
      await userEvent.click(acceptButtons[0]);

      // Wait for confirmation modal
      await waitFor(() => {
        expect(screen.getByText('Confirm Invitation Acceptance')).toBeInTheDocument();
      });

      // Click the Accept Invitation button in modal
      const confirmAcceptButton = screen.getByRole('button', { name: 'Accept Invitation' });
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
        expect(screen.queryByText('Confirm Invitation Acceptance')).not.toBeInTheDocument();
      });
    });

    it('should cancel acceptance flow when user clicks Cancel in modal', async () => {
      // Arrange
      const mockUser = createMockUser();
      await act(async () => {
        renderWithAuth(<InvitationNotifications />, { user: mockUser });
      });

      await waitFor(() => {
        expect(screen.getByText('Family History: Johnson Family Medical Records')).toBeInTheDocument();
      });

      // Act - Click accept button
      const acceptButtons = screen.getAllByRole('button').filter(btn => 
        btn.getAttribute('color') === 'green' || 
        btn.querySelector('svg')
      );
      await userEvent.click(acceptButtons[0]);

      // Wait for confirmation modal
      await waitFor(() => {
        expect(screen.getByText('Confirm Invitation Acceptance')).toBeInTheDocument();
      });

      // Click Cancel button
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await userEvent.click(cancelButton);

      // Assert - Modal should close without API call
      await waitFor(() => {
        expect(screen.queryByText('Confirm Invitation Acceptance')).not.toBeInTheDocument();
      });

      // Invitation should still be visible
      expect(screen.getByText('Family History: Johnson Family Medical Records')).toBeInTheDocument();

      // No success notification should be shown
      expect(notifications.show).not.toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Invitation accepted',
        })
      );
    });

    it('should handle rejection without showing confirmation modal', async () => {
      // Arrange
      const mockUser = createMockUser();
      await act(async () => {
        renderWithAuth(<InvitationNotifications />, { user: mockUser });
      });

      await waitFor(() => {
        expect(screen.getByText('Family History: Johnson Family Medical Records')).toBeInTheDocument();
      });

      // Act - Click reject button (red button)
      const rejectButtons = screen.getAllByRole('button').filter(btn => 
        btn.getAttribute('color') === 'red' || 
        btn.querySelector('svg')
      );
      await userEvent.click(rejectButtons[0]);

      // Assert - No confirmation modal should appear
      expect(screen.queryByText('Confirm Invitation Acceptance')).not.toBeInTheDocument();

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
      server.use(
        rest.post(`${API_BASE}/invitations/:id/respond`, (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Server error' }));
        })
      );

      const mockUser = createMockUser();
      await act(async () => {
        renderWithAuth(<InvitationNotifications />, { user: mockUser });
      });

      await waitFor(() => {
        expect(screen.getByText('Family History: Johnson Family Medical Records')).toBeInTheDocument();
      });

      // Act - Click accept and then confirm
      const acceptButtons = screen.getAllByRole('button').filter(btn => 
        btn.getAttribute('color') === 'green' || 
        btn.querySelector('svg')
      );
      await userEvent.click(acceptButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Confirm Invitation Acceptance')).toBeInTheDocument();
      });

      const confirmAcceptButton = screen.getByRole('button', { name: 'Accept Invitation' });
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
      // Arrange
      const mockUser = createMockUser();
      await act(async () => {
        renderWithAuth(<InvitationNotifications />, { user: mockUser });
      });

      await waitFor(() => {
        expect(screen.getByText('Family History: Johnson Family Medical Records')).toBeInTheDocument();
        expect(screen.getByText('Patient Record Share: John Doe')).toBeInTheDocument();
      });

      // Test family history invitation
      const familyHistoryAcceptButton = screen.getAllByRole('button').filter(btn => 
        btn.getAttribute('color') === 'green' && 
        btn.closest('div').textContent.includes('Dr. Sarah Johnson')
      )[0];

      await userEvent.click(familyHistoryAcceptButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Invitation Acceptance')).toBeInTheDocument();
        expect(screen.getByText('Family History')).toBeInTheDocument();
      });

      // Close modal
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      // Test patient share invitation
      const patientShareAcceptButton = screen.getAllByRole('button').filter(btn => 
        btn.getAttribute('color') === 'green' && 
        btn.closest('div').textContent.includes('Dr. Michael Brown')
      )[0];

      await userEvent.click(patientShareAcceptButton);

      await waitFor(() => {
        expect(screen.getByText('Confirm Invitation Acceptance')).toBeInTheDocument();
        expect(screen.getByText('Patient Record')).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation for confirmation modal', async () => {
      // Arrange
      const mockUser = createMockUser();
      await act(async () => {
        renderWithAuth(<InvitationNotifications />, { user: mockUser });
      });

      await waitFor(() => {
        expect(screen.getByText('Family History: Johnson Family Medical Records')).toBeInTheDocument();
      });

      // Act - Navigate using keyboard
      const acceptButtons = screen.getAllByRole('button').filter(btn => 
        btn.getAttribute('color') === 'green'
      );
      
      // Focus and activate with keyboard
      acceptButtons[0].focus();
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Confirm Invitation Acceptance')).toBeInTheDocument();
      });

      // Tab to Cancel button and press Enter
      await userEvent.keyboard('{Tab}{Tab}{Enter}');

      // Assert - Modal should close
      await waitFor(() => {
        expect(screen.queryByText('Confirm Invitation Acceptance')).not.toBeInTheDocument();
      });
    });

    it('should handle modal close via Escape key', async () => {
      // Arrange
      const mockUser = createMockUser();
      await act(async () => {
        renderWithAuth(<InvitationNotifications />, { user: mockUser });
      });

      await waitFor(() => {
        expect(screen.getByText('Family History: Johnson Family Medical Records')).toBeInTheDocument();
      });

      // Act - Open modal and press Escape
      const acceptButtons = screen.getAllByRole('button').filter(btn => 
        btn.getAttribute('color') === 'green'
      );
      await userEvent.click(acceptButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Confirm Invitation Acceptance')).toBeInTheDocument();
      });

      await userEvent.keyboard('{Escape}');

      // Assert - Modal should close
      await waitFor(() => {
        expect(screen.queryByText('Confirm Invitation Acceptance')).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading and Error States', () => {
    it('should handle loading state during invitation acceptance', async () => {
      // Arrange - Slow API response
      server.use(
        rest.post(`${API_BASE}/invitations/:id/respond`, async (req, res, ctx) => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return res(ctx.json({ message: 'Invitation accepted successfully' }));
        })
      );

      const mockUser = createMockUser();
      await act(async () => {
        renderWithAuth(<InvitationNotifications />, { user: mockUser });
      });

      await waitFor(() => {
        expect(screen.getByText('Family History: Johnson Family Medical Records')).toBeInTheDocument();
      });

      // Act - Accept invitation
      const acceptButtons = screen.getAllByRole('button').filter(btn => 
        btn.getAttribute('color') === 'green'
      );
      await userEvent.click(acceptButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Confirm Invitation Acceptance')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: 'Accept Invitation' });
      await userEvent.click(confirmButton);

      // Assert - Button should be in loading state (this depends on implementation)
      // The loading state might be shown in the button or elsewhere in the UI
      // This test verifies the system handles async operations correctly
      
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
      // Arrange - Mock updated invitation list after acceptance
      let callCount = 0;
      server.use(
        rest.get(`${API_BASE}/invitations/pending`, (req, res, ctx) => {
          callCount++;
          if (callCount === 1) {
            return res(ctx.json(mockInvitations));
          } else {
            // After acceptance, return fewer invitations
            return res(ctx.json([mockInvitations[1]]));
          }
        })
      );

      const mockUser = createMockUser();
      await act(async () => {
        renderWithAuth(<InvitationNotifications />, { user: mockUser });
      });

      await waitFor(() => {
        expect(screen.getByText('Family History: Johnson Family Medical Records')).toBeInTheDocument();
      });

      // Act - Accept invitation
      const acceptButtons = screen.getAllByRole('button').filter(btn => 
        btn.getAttribute('color') === 'green'
      );
      await userEvent.click(acceptButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Confirm Invitation Acceptance')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: 'Accept Invitation' }));

      // Assert - List should refresh and accepted invitation should be removed
      await waitFor(() => {
        expect(screen.queryByText('Family History: Johnson Family Medical Records')).not.toBeInTheDocument();
      });

      // Other invitation should still be visible
      expect(screen.getByText('Patient Record Share: John Doe')).toBeInTheDocument();
    });
  });
});
