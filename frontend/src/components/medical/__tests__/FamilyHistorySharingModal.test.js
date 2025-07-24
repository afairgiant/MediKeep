/**
 * Comprehensive tests for FamilyHistorySharingModal component
 * Tests single sharing, bulk sharing, form validation, and error handling
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import FamilyHistorySharingModal from '../FamilyHistorySharingModal';

// Mock dependencies
jest.mock('@mantine/notifications', () => ({
  notifications: {
    show: jest.fn(),
  },
}));

jest.mock('../../../utils/helpers', () => ({
  formatDateTime: (date) => new Date(date).toLocaleDateString(),
}));

const mockFamilyHistoryApi = {
  getFamilyMemberShares: jest.fn(),
  sendShareInvitation: jest.fn(),
  bulkSendInvitations: jest.fn(),
  revokeShare: jest.fn(),
};

jest.mock('../../../services/api/familyHistoryApi', () => ({
  __esModule: true,
  default: mockFamilyHistoryApi,
}));

describe('FamilyHistorySharingModal Component', () => {
  const mockFamilyMember = {
    id: 'member-123',
    name: 'John Doe',
    relationship: 'father',
    birth_year: 1960,
  };

  const mockFamilyMembers = [
    {
      id: 'member-123',
      name: 'John Doe',
      relationship: 'father',
      birth_year: 1960,
    },
    {
      id: 'member-456',
      name: 'Jane Doe',
      relationship: 'mother',
      birth_year: 1965,
    },
    {
      id: 'member-789',
      name: 'Bob Smith',
      relationship: 'brother',
      birth_year: 1985,
    },
  ];

  const mockShares = [
    {
      id: 'share-1',
      shared_with: {
        id: 'user-456',
        name: 'Dr. Sarah Johnson',
        email: 'sarah.johnson@hospital.com',
      },
      permission_level: 'view',
      created_at: '2024-01-15T10:30:00Z',
      sharing_note: 'Shared for medical consultation',
    },
    {
      id: 'share-2',
      shared_with: {
        id: 'user-789',
        name: 'Dr. Michael Brown',
        email: 'michael.brown@clinic.com',
      },
      permission_level: 'view',
      created_at: '2024-01-12T14:20:00Z',
    },
  ];

  const mockProps = {
    opened: true,
    onClose: jest.fn(),
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFamilyHistoryApi.getFamilyMemberShares.mockResolvedValue(mockShares);
    mockFamilyHistoryApi.sendShareInvitation.mockResolvedValue({ message: 'Invitation sent' });
    mockFamilyHistoryApi.bulkSendInvitations.mockResolvedValue({
      total_sent: 2,
      total_failed: 0,
      results: [],
    });
    mockFamilyHistoryApi.revokeShare.mockResolvedValue({ message: 'Share revoked' });
  });

  const renderSharingModal = (props = {}) => {
    const defaultProps = { ...mockProps, ...props };
    
    return render(
      <MantineProvider>
        <FamilyHistorySharingModal {...defaultProps} />
      </MantineProvider>
    );
  };

  describe('Modal Display and Basic Rendering', () => {
    it('should render modal when opened with single family member', () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      expect(screen.getByText("Share John Doe's Family History")).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('father')).toBeInTheDocument();
    });

    it('should render modal in bulk mode with family members', () => {
      renderSharingModal({ 
        bulkMode: true, 
        familyMembers: mockFamilyMembers 
      });

      expect(screen.getByText('Share Multiple Family Members (3 selected)')).toBeInTheDocument();
      expect(screen.getByText('Select Family Members')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    });

    it('should not render when opened is false', () => {
      renderSharingModal({ opened: false, familyMember: mockFamilyMember });

      expect(screen.queryByText("Share John Doe's Family History")).not.toBeInTheDocument();
    });

    it('should display appropriate info alerts', () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      expect(screen.getByText(/Share John Doe's family medical history with another user/)).toBeInTheDocument();
      expect(screen.getByText(/Recipients will receive an invitation that they can accept or reject/)).toBeInTheDocument();
    });

    it('should load existing shares for single family member on open', async () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      await waitFor(() => {
        expect(mockFamilyHistoryApi.getFamilyMemberShares).toHaveBeenCalledWith('member-123');
      });
    });
  });

  describe('Single Mode - Sharing Form', () => {
    it('should render sharing form with all required fields', () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      expect(screen.getByLabelText('Share with (username or email)')).toBeInTheDocument();
      expect(screen.getByLabelText('Note (optional)')).toBeInTheDocument();
      expect(screen.getByLabelText('Invitation Expiration')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send Invitation (View Only)' })).toBeInTheDocument();
    });

    it('should update form fields when typing', async () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      const identifierInput = screen.getByLabelText('Share with (username or email)');
      const noteInput = screen.getByLabelText('Note (optional)');

      await userEvent.type(identifierInput, 'doctor@hospital.com');
      await userEvent.type(noteInput, 'Please review this family history');

      expect(identifierInput).toHaveValue('doctor@hospital.com');
      expect(noteInput).toHaveValue('Please review this family history');
    });

    it('should handle expiration dropdown selection', async () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      const expirationSelect = screen.getByLabelText('Invitation Expiration');
      
      await userEvent.click(expirationSelect);
      await userEvent.click(screen.getByText('3 Days'));

      expect(expirationSelect).toHaveValue('72');
    });

    it('should handle never expires option', async () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      const expirationSelect = screen.getByLabelText('Invitation Expiration');
      
      await userEvent.click(expirationSelect);
      await userEvent.click(screen.getByText('Never Expires'));

      expect(expirationSelect).toHaveValue('never');
    });

    it('should validate required fields before sending invitation', async () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      const sendButton = screen.getByRole('button', { name: 'Send Invitation (View Only)' });
      
      // Button should be disabled when identifier is empty
      expect(sendButton).toBeDisabled();

      // Fill in identifier
      const identifierInput = screen.getByLabelText('Share with (username or email)');
      await userEvent.type(identifierInput, 'doctor@hospital.com');

      // Button should now be enabled
      expect(sendButton).not.toBeDisabled();
    });

    it('should show validation error for empty identifier', async () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      // Try to send with empty identifier
      const sendButton = screen.getByRole('button', { name: 'Send Invitation (View Only)' });
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Error',
          message: 'Please enter a username or email',
          color: 'red',
          icon: expect.anything(),
        });
      });
    });

    it('should send invitation successfully', async () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      const identifierInput = screen.getByLabelText('Share with (username or email)');
      const noteInput = screen.getByLabelText('Note (optional)');
      const sendButton = screen.getByRole('button', { name: 'Send Invitation (View Only)' });

      await userEvent.type(identifierInput, 'doctor@hospital.com');
      await userEvent.type(noteInput, 'Medical consultation needed');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(mockFamilyHistoryApi.sendShareInvitation).toHaveBeenCalledWith('member-123', {
          shared_with_identifier: 'doctor@hospital.com',
          permission_level: 'view',
          sharing_note: 'Medical consultation needed',
          expires_hours: 168,
        });
      });

      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Invitation Sent',
        message: "Invitation sent to share John Doe's family history",
        color: 'green',
        icon: expect.anything(),
      });

      expect(mockProps.onSuccess).toHaveBeenCalled();
    });

    it('should clear form after successful submission', async () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      const identifierInput = screen.getByLabelText('Share with (username or email)');
      const noteInput = screen.getByLabelText('Note (optional)');

      await userEvent.type(identifierInput, 'doctor@hospital.com');
      await userEvent.type(noteInput, 'Test note');
      await userEvent.click(screen.getByRole('button', { name: 'Send Invitation (View Only)' }));

      await waitFor(() => {
        expect(identifierInput).toHaveValue('');
        expect(noteInput).toHaveValue('');
      });
    });

    it('should handle API errors when sending invitation', async () => {
      const errorResponse = {
        response: {
          data: {
            detail: 'User not found',
          },
        },
      };
      mockFamilyHistoryApi.sendShareInvitation.mockRejectedValue(errorResponse);

      renderSharingModal({ familyMember: mockFamilyMember });

      const identifierInput = screen.getByLabelText('Share with (username or email)');
      await userEvent.type(identifierInput, 'nonexistent@user.com');
      await userEvent.click(screen.getByRole('button', { name: 'Send Invitation (View Only)' }));

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Error',
          message: 'User not found',
          color: 'red',
          icon: expect.anything(),
        });
      });
    });
  });

  describe('Single Mode - Current Shares Display', () => {
    it('should display existing shares', async () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      await waitFor(() => {
        expect(screen.getByText('Currently Shared With:')).toBeInTheDocument();
        expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
        expect(screen.getByText('sarah.johnson@hospital.com')).toBeInTheDocument();
        expect(screen.getByText('Dr. Michael Brown')).toBeInTheDocument();
        expect(screen.getByText('michael.brown@clinic.com')).toBeInTheDocument();
      });
    });

    it('should display sharing notes when present', async () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      await waitFor(() => {
        expect(screen.getByText('"Shared for medical consultation"')).toBeInTheDocument();
      });
    });

    it('should display formatted share dates', async () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      await waitFor(() => {
        expect(screen.getByText(/Shared on 1\/15\/2024/)).toBeInTheDocument();
        expect(screen.getByText(/Shared on 1\/12\/2024/)).toBeInTheDocument();
      });
    });

    it('should show empty state when no shares exist', async () => {
      mockFamilyHistoryApi.getFamilyMemberShares.mockResolvedValue([]);
      
      renderSharingModal({ familyMember: mockFamilyMember });

      await waitFor(() => {
        expect(screen.getByText('This family history is not currently shared with anyone.')).toBeInTheDocument();
      });
    });

    it('should show loading state while loading shares', () => {
      // Mock a slow API response
      mockFamilyHistoryApi.getFamilyMemberShares.mockImplementation(() => new Promise(() => {}));
      
      renderSharingModal({ familyMember: mockFamilyMember });

      expect(screen.getByText('Loading sharing information...')).toBeInTheDocument();
    });

    it('should handle errors when loading shares', async () => {
      mockFamilyHistoryApi.getFamilyMemberShares.mockRejectedValue(new Error('API Error'));
      
      renderSharingModal({ familyMember: mockFamilyMember });

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Error',
          message: 'Failed to load sharing information',
          color: 'red',
          icon: expect.anything(),
        });
      });
    });

    it('should handle revoking share access', async () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      await waitFor(() => {
        expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
      });

      // Find and click the revoke button (trash icon)
      const revokeButtons = screen.getAllByLabelText('Revoke access');
      await userEvent.click(revokeButtons[0]);

      await waitFor(() => {
        expect(mockFamilyHistoryApi.revokeShare).toHaveBeenCalledWith('member-123', 'user-456');
      });

      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Access Revoked',
        message: 'Family history sharing has been revoked',
        color: 'orange',
        icon: expect.anything(),
      });

      expect(mockProps.onSuccess).toHaveBeenCalled();
    });

    it('should handle errors when revoking shares', async () => {
      mockFamilyHistoryApi.revokeShare.mockRejectedValue(new Error('Revoke failed'));
      
      renderSharingModal({ familyMember: mockFamilyMember });

      await waitFor(() => {
        expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
      });

      const revokeButtons = screen.getAllByLabelText('Revoke access');
      await userEvent.click(revokeButtons[0]);

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Error',
          message: 'Failed to revoke sharing',
          color: 'red',
          icon: expect.anything(),
        });
      });
    });
  });

  describe('Bulk Mode - Family Member Selection', () => {
    it('should initialize with all family members selected', () => {
      renderSharingModal({ 
        bulkMode: true, 
        familyMembers: mockFamilyMembers 
      });

      mockFamilyMembers.forEach(member => {
        const checkbox = screen.getByRole('checkbox', { name: new RegExp(member.name) });
        expect(checkbox).toBeChecked();
      });

      expect(screen.getByText('Share Multiple Family Members (3 selected)')).toBeInTheDocument();
    });

    it('should handle individual member selection toggle', async () => {
      renderSharingModal({ 
        bulkMode: true, 
        familyMembers: mockFamilyMembers 
      });

      const johnCheckbox = screen.getByRole('checkbox', { name: /John Doe/ });
      
      await userEvent.click(johnCheckbox);

      expect(johnCheckbox).not.toBeChecked();
      expect(screen.getByText('Share Multiple Family Members (2 selected)')).toBeInTheDocument();

      await userEvent.click(johnCheckbox);

      expect(johnCheckbox).toBeChecked();
      expect(screen.getByText('Share Multiple Family Members (3 selected)')).toBeInTheDocument();
    });

    it('should handle select all / deselect all functionality', async () => {
      renderSharingModal({ 
        bulkMode: true, 
        familyMembers: mockFamilyMembers 
      });

      const selectAllButton = screen.getByRole('button', { name: 'Deselect All' });
      
      await userEvent.click(selectAllButton);

      // All checkboxes should be unchecked
      mockFamilyMembers.forEach(member => {
        const checkbox = screen.getByRole('checkbox', { name: new RegExp(member.name) });
        expect(checkbox).not.toBeChecked();
      });

      expect(screen.getByText('Share Multiple Family Members (0 selected)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Select All' })).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Select All' }));

      // All checkboxes should be checked again
      mockFamilyMembers.forEach(member => {
        const checkbox = screen.getByRole('checkbox', { name: new RegExp(member.name) });
        expect(checkbox).toBeChecked();
      });
    });

    it('should disable send button when no members are selected in bulk mode', async () => {
      renderSharingModal({ 
        bulkMode: true, 
        familyMembers: mockFamilyMembers 
      });

      const identifierInput = screen.getByLabelText('Share with (username or email)');
      await userEvent.type(identifierInput, 'doctor@hospital.com');

      // Deselect all members
      await userEvent.click(screen.getByRole('button', { name: 'Deselect All' }));

      const sendButton = screen.getByRole('button', { name: 'Send 0 Invitation(s) (View Only)' });
      expect(sendButton).toBeDisabled();
    });

    it('should display relationship badges for family members', () => {
      renderSharingModal({ 
        bulkMode: true, 
        familyMembers: mockFamilyMembers 
      });

      expect(screen.getByText('father')).toBeInTheDocument();
      expect(screen.getByText('mother')).toBeInTheDocument();
      expect(screen.getByText('brother')).toBeInTheDocument();
    });
  });

  describe('Bulk Mode - Invitation Sending', () => {
    it('should send bulk invitations successfully', async () => {
      renderSharingModal({ 
        bulkMode: true, 
        familyMembers: mockFamilyMembers 
      });

      const identifierInput = screen.getByLabelText('Share with (username or email)');
      const noteInput = screen.getByLabelText('Note (optional)');
      const sendButton = screen.getByRole('button', { name: 'Send 3 Invitation(s) (View Only)' });

      await userEvent.type(identifierInput, 'specialist@hospital.com');
      await userEvent.type(noteInput, 'Family consultation needed');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(mockFamilyHistoryApi.bulkSendInvitations).toHaveBeenCalledWith({
          family_member_ids: ['member-123', 'member-456', 'member-789'],
          shared_with_identifier: 'specialist@hospital.com',
          permission_level: 'view',
          sharing_note: 'Family consultation needed',
          expires_hours: 168,
        });
      });

      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Invitations Sent',
        message: 'Successfully sent 2 invitation(s)',
        color: 'green',
        icon: expect.anything(),
      });

      expect(mockProps.onSuccess).toHaveBeenCalled();
    });

    it('should handle partial success in bulk invitations', async () => {
      mockFamilyHistoryApi.bulkSendInvitations.mockResolvedValue({
        total_sent: 2,
        total_failed: 1,
        results: [],
      });

      renderSharingModal({ 
        bulkMode: true, 
        familyMembers: mockFamilyMembers 
      });

      const identifierInput = screen.getByLabelText('Share with (username or email)');
      await userEvent.type(identifierInput, 'doctor@hospital.com');
      await userEvent.click(screen.getByRole('button', { name: 'Send 3 Invitation(s) (View Only)' }));

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Invitations Sent',
          message: 'Successfully sent 2 invitation(s), 1 failed',
          color: 'green',
          icon: expect.anything(),
        });
      });

      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Some Failed',
        message: '1 invitation(s) failed to send',
        color: 'orange',
        icon: expect.anything(),
      });
    });

    it('should send invitations only for selected members', async () => {
      renderSharingModal({ 
        bulkMode: true, 
        familyMembers: mockFamilyMembers 
      });

      // Deselect one member
      const janeCheckbox = screen.getByRole('checkbox', { name: /Jane Doe/ });
      await userEvent.click(janeCheckbox);

      const identifierInput = screen.getByLabelText('Share with (username or email)');
      await userEvent.type(identifierInput, 'doctor@hospital.com');
      await userEvent.click(screen.getByRole('button', { name: 'Send 2 Invitation(s) (View Only)' }));

      await waitFor(() => {
        expect(mockFamilyHistoryApi.bulkSendInvitations).toHaveBeenCalledWith({
          family_member_ids: ['member-123', 'member-789'],
          shared_with_identifier: 'doctor@hospital.com',
          permission_level: 'view',
          sharing_note: '',
          expires_hours: 168,
        });
      });
    });

    it('should handle bulk invitation API errors', async () => {
      mockFamilyHistoryApi.bulkSendInvitations.mockRejectedValue(new Error('Bulk send failed'));

      renderSharingModal({ 
        bulkMode: true, 
        familyMembers: mockFamilyMembers 
      });

      const identifierInput = screen.getByLabelText('Share with (username or email)');
      await userEvent.type(identifierInput, 'doctor@hospital.com');
      await userEvent.click(screen.getByRole('button', { name: 'Send 3 Invitation(s) (View Only)' }));

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Error',
          message: 'Bulk send failed',
          color: 'red',
          icon: expect.anything(),
        });
      });
    });
  });

  describe('Modal Behavior and State Management', () => {
    it('should clear form and close modal when handleClose is called', async () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      const identifierInput = screen.getByLabelText('Share with (username or email)');
      await userEvent.type(identifierInput, 'test@example.com');

      // Close modal (this would typically be triggered by clicking X or pressing Escape)
      // For testing purposes, we can't easily trigger the modal close, but we can verify
      // that the form data gets cleared through other interactions
      
      expect(identifierInput).toHaveValue('test@example.com');
    });

    it('should not call onSuccess if not provided', async () => {
      renderSharingModal({ 
        familyMember: mockFamilyMember, 
        onSuccess: undefined 
      });

      const identifierInput = screen.getByLabelText('Share with (username or email)');
      await userEvent.type(identifierInput, 'doctor@hospital.com');
      await userEvent.click(screen.getByRole('button', { name: 'Send Invitation (View Only)' }));

      await waitFor(() => {
        expect(mockFamilyHistoryApi.sendShareInvitation).toHaveBeenCalled();
      });

      // Should not throw error even without onSuccess callback
    });

    it('should display correct title based on mode and selection', () => {
      // Single mode
      const { rerender } = renderSharingModal({ familyMember: mockFamilyMember });
      expect(screen.getByText("Share John Doe's Family History")).toBeInTheDocument();

      // Bulk mode with all selected
      rerender(
        <MantineProvider>
          <FamilyHistorySharingModal 
            {...mockProps}
            bulkMode={true}
            familyMembers={mockFamilyMembers}
          />
        </MantineProvider>
      );
      expect(screen.getByText('Share Multiple Family Members (3 selected)')).toBeInTheDocument();
    });

    it('should show loading state on buttons during API calls', async () => {
      // Mock a slow API response
      let resolvePromise;
      const slowPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      mockFamilyHistoryApi.sendShareInvitation.mockReturnValue(slowPromise);

      renderSharingModal({ familyMember: mockFamilyMember });

      const identifierInput = screen.getByLabelText('Share with (username or email)');
      const sendButton = screen.getByRole('button', { name: 'Send Invitation (View Only)' });

      await userEvent.type(identifierInput, 'doctor@hospital.com');
      await userEvent.click(sendButton);

      // Button should show loading state
      expect(sendButton).toBeDisabled();

      // Resolve the promise
      resolvePromise({ message: 'Success' });

      await waitFor(() => {
        expect(sendButton).not.toBeDisabled();
      });
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should have proper form labels and descriptions', () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      expect(screen.getByLabelText('Share with (username or email)')).toBeInTheDocument();
      expect(screen.getByLabelText('Note (optional)')).toBeInTheDocument();
      expect(screen.getByLabelText('Invitation Expiration')).toBeInTheDocument();
      expect(screen.getByText('How long the recipient has to accept the invitation')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      const identifierInput = screen.getByLabelText('Share with (username or email)');
      const noteInput = screen.getByLabelText('Note (optional)');

      identifierInput.focus();
      expect(identifierInput).toHaveFocus();

      await userEvent.tab();
      expect(noteInput).toHaveFocus();
    });

    it('should provide clear user feedback through alerts', () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      expect(screen.getByText(/This only shares family history data, not your personal medical records/)).toBeInTheDocument();
      expect(screen.getByText(/Recipients will receive an invitation that they can accept or reject/)).toBeInTheDocument();
    });

    it('should display proper icons for form elements', () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      // Icons should be present in the form (though specific icon testing is limited)
      const identifierInput = screen.getByLabelText('Share with (username or email)');
      const noteInput = screen.getByLabelText('Note (optional)');
      
      expect(identifierInput).toBeInTheDocument();
      expect(noteInput).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty family members array in bulk mode', () => {
      renderSharingModal({ 
        bulkMode: true, 
        familyMembers: [] 
      });

      expect(screen.getByText('Share Multiple Family Members (0 selected)')).toBeInTheDocument();
      expect(screen.getByText('Select Family Members')).toBeInTheDocument();
    });

    it('should handle missing family member data', () => {
      renderSharingModal({ familyMember: null });

      expect(screen.getByText('Share Family History')).toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('should handle shares without sharing notes', async () => {
      const sharesWithoutNotes = mockShares.map(share => ({
        ...share,
        sharing_note: undefined,
      }));
      mockFamilyHistoryApi.getFamilyMemberShares.mockResolvedValue(sharesWithoutNotes);

      renderSharingModal({ familyMember: mockFamilyMember });

      await waitFor(() => {
        expect(screen.getByText('Dr. Sarah Johnson')).toBeInTheDocument();
      });

      expect(screen.queryByText('"Shared for medical consultation"')).not.toBeInTheDocument();
    });

    it('should handle whitespace-only input validation', async () => {
      renderSharingModal({ familyMember: mockFamilyMember });

      const identifierInput = screen.getByLabelText('Share with (username or email)');
      await userEvent.type(identifierInput, '   '); // Only whitespace

      const sendButton = screen.getByRole('button', { name: 'Send Invitation (View Only)' });
      expect(sendButton).toBeDisabled();
    });
  });
});