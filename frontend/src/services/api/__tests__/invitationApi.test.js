import { vi } from 'vitest';

/**
 * Tests for InvitationApi service
 * Tests all invitation-related API operations including error handling
 */
import invitationApi from '../invitationApi';
import { apiService } from '../index';

// Mock the apiService
vi.mock('../index', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('InvitationApi Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPendingInvitations', () => {
    it('should fetch pending invitations without filter', async () => {
      const mockInvitations = [
        { id: 'inv-1', title: 'Test Invitation 1', status: 'pending' },
        { id: 'inv-2', title: 'Test Invitation 2', status: 'pending' },
      ];
      apiService.get.mockResolvedValue(mockInvitations);

      const result = await invitationApi.getPendingInvitations();

      expect(apiService.get).toHaveBeenCalledWith('/invitations/pending?');
      expect(result).toEqual(mockInvitations);
    });

    it('should fetch pending invitations with invitation type filter', async () => {
      const mockInvitations = [
        { id: 'inv-1', title: 'Family History Invitation', type: 'family_history_share' },
      ];
      apiService.get.mockResolvedValue(mockInvitations);

      const result = await invitationApi.getPendingInvitations('family_history_share');

      expect(apiService.get).toHaveBeenCalledWith('/invitations/pending?invitation_type=family_history_share');
      expect(result).toEqual(mockInvitations);
    });

    it('should handle API errors', async () => {
      const error = new Error('Network error');
      apiService.get.mockRejectedValue(error);

      await expect(invitationApi.getPendingInvitations()).rejects.toThrow('Network error');
      expect(apiService.get).toHaveBeenCalledWith('/invitations/pending?');
    });

    it('should handle null invitation type parameter', async () => {
      const mockInvitations = [];
      apiService.get.mockResolvedValue(mockInvitations);

      const result = await invitationApi.getPendingInvitations(null);

      expect(apiService.get).toHaveBeenCalledWith('/invitations/pending?');
      expect(result).toEqual(mockInvitations);
    });
  });

  describe('getSentInvitations', () => {
    it('should fetch sent invitations without filter', async () => {
      const mockInvitations = [
        { id: 'inv-3', title: 'Test Sent Invitation', status: 'sent' },
      ];
      apiService.get.mockResolvedValue(mockInvitations);

      const result = await invitationApi.getSentInvitations();

      expect(apiService.get).toHaveBeenCalledWith('/invitations/sent?');
      expect(result).toEqual(mockInvitations);
    });

    it('should fetch sent invitations with invitation type filter', async () => {
      const mockInvitations = [
        { id: 'inv-3', title: 'Patient Share Invitation', type: 'patient_share' },
      ];
      apiService.get.mockResolvedValue(mockInvitations);

      const result = await invitationApi.getSentInvitations('patient_share');

      expect(apiService.get).toHaveBeenCalledWith('/invitations/sent?invitation_type=patient_share');
      expect(result).toEqual(mockInvitations);
    });

    it('should handle empty response', async () => {
      apiService.get.mockResolvedValue([]);

      const result = await invitationApi.getSentInvitations();

      expect(result).toEqual([]);
    });

    it('should propagate API errors', async () => {
      const error = new Error('Unauthorized');
      apiService.get.mockRejectedValue(error);

      await expect(invitationApi.getSentInvitations()).rejects.toThrow('Unauthorized');
    });
  });

  describe('respondToInvitation', () => {
    it('should respond to invitation with accepted status', async () => {
      const mockResponse = { message: 'Invitation accepted successfully' };
      apiService.post.mockResolvedValue(mockResponse);

      const result = await invitationApi.respondToInvitation('inv-123', 'accepted');

      expect(apiService.post).toHaveBeenCalledWith('/invitations/inv-123/respond', {
        response: 'accepted',
        response_note: null,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should respond to invitation with rejected status and note', async () => {
      const mockResponse = { message: 'Invitation rejected successfully' };
      apiService.post.mockResolvedValue(mockResponse);

      const result = await invitationApi.respondToInvitation(
        'inv-456',
        'rejected',
        'Cannot accept at this time'
      );

      expect(apiService.post).toHaveBeenCalledWith('/invitations/inv-456/respond', {
        response: 'rejected',
        response_note: 'Cannot accept at this time',
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle response note as null when not provided', async () => {
      const mockResponse = { message: 'Success' };
      apiService.post.mockResolvedValue(mockResponse);

      await invitationApi.respondToInvitation('inv-789', 'accepted');

      expect(apiService.post).toHaveBeenCalledWith('/invitations/inv-789/respond', {
        response: 'accepted',
        response_note: null,
      });
    });

    it('should handle API errors during response', async () => {
      const error = new Error('Invitation already responded to');
      apiService.post.mockRejectedValue(error);

      await expect(
        invitationApi.respondToInvitation('inv-invalid', 'accepted')
      ).rejects.toThrow('Invitation already responded to');
    });

    it('should handle different response types', async () => {
      const responseTypes = ['accepted', 'rejected', 'maybe'];
      
      for (const responseType of responseTypes) {
        apiService.post.mockResolvedValue({ message: `Invitation ${responseType}` });
        
        await invitationApi.respondToInvitation('inv-test', responseType);
        
        expect(apiService.post).toHaveBeenCalledWith('/invitations/inv-test/respond', {
          response: responseType,
          response_note: null,
        });
      }
    });
  });

  describe('cancelInvitation', () => {
    it('should cancel invitation successfully', async () => {
      const mockResponse = { message: 'Invitation cancelled successfully' };
      apiService.delete.mockResolvedValue(mockResponse);

      const result = await invitationApi.cancelInvitation('inv-123');

      expect(apiService.delete).toHaveBeenCalledWith('/invitations/inv-123');
      expect(result).toEqual(mockResponse);
    });

    it('should handle cancel errors', async () => {
      const error = new Error('Invitation cannot be cancelled');
      apiService.delete.mockRejectedValue(error);

      await expect(invitationApi.cancelInvitation('inv-invalid')).rejects.toThrow(
        'Invitation cannot be cancelled'
      );
    });

    it('should handle non-existent invitation', async () => {
      const error = new Error('Invitation not found');
      apiService.delete.mockRejectedValue(error);

      await expect(invitationApi.cancelInvitation('non-existent')).rejects.toThrow(
        'Invitation not found'
      );
    });
  });

  describe('revokeInvitation', () => {
    it('should revoke invitation successfully', async () => {
      const mockResponse = { message: 'Invitation access revoked successfully' };
      apiService.post.mockResolvedValue(mockResponse);

      const result = await invitationApi.revokeInvitation('inv-123');

      expect(apiService.post).toHaveBeenCalledWith('/invitations/inv-123/revoke');
      expect(result).toEqual(mockResponse);
    });

    it('should handle revoke errors', async () => {
      const error = new Error('Cannot revoke invitation');
      apiService.post.mockRejectedValue(error);

      await expect(invitationApi.revokeInvitation('inv-invalid')).rejects.toThrow(
        'Cannot revoke invitation'
      );
    });

    it('should handle already revoked invitations', async () => {
      const error = new Error('Invitation already revoked');
      apiService.post.mockRejectedValue(error);

      await expect(invitationApi.revokeInvitation('inv-revoked')).rejects.toThrow(
        'Invitation already revoked'
      );
    });
  });

  describe('getInvitationSummary', () => {
    it('should fetch invitation summary successfully', async () => {
      const mockSummary = {
        pending_count: 3,
        sent_count: 5,
        accepted_count: 10,
        rejected_count: 2,
      };
      apiService.get.mockResolvedValue(mockSummary);

      const result = await invitationApi.getInvitationSummary();

      expect(apiService.get).toHaveBeenCalledWith('/invitations/summary');
      expect(result).toEqual(mockSummary);
    });

    it('should handle empty summary', async () => {
      const emptySummary = {
        pending_count: 0,
        sent_count: 0,
        accepted_count: 0,
        rejected_count: 0,
      };
      apiService.get.mockResolvedValue(emptySummary);

      const result = await invitationApi.getInvitationSummary();

      expect(result).toEqual(emptySummary);
    });

    it('should handle summary API errors', async () => {
      const error = new Error('Summary not available');
      apiService.get.mockRejectedValue(error);

      await expect(invitationApi.getInvitationSummary()).rejects.toThrow(
        'Summary not available'
      );
    });
  });

  describe('cleanupExpiredInvitations', () => {
    it('should cleanup expired invitations successfully', async () => {
      const mockResponse = { 
        message: 'Cleanup completed',
        cleaned_count: 5,
      };
      apiService.post.mockResolvedValue(mockResponse);

      const result = await invitationApi.cleanupExpiredInvitations();

      expect(apiService.post).toHaveBeenCalledWith('/invitations/cleanup');
      expect(result).toEqual(mockResponse);
    });

    it('should handle cleanup with no expired invitations', async () => {
      const mockResponse = { 
        message: 'No expired invitations found',
        cleaned_count: 0,
      };
      apiService.post.mockResolvedValue(mockResponse);

      const result = await invitationApi.cleanupExpiredInvitations();

      expect(result).toEqual(mockResponse);
    });

    it('should handle cleanup errors', async () => {
      const error = new Error('Cleanup failed');
      apiService.post.mockRejectedValue(error);

      await expect(invitationApi.cleanupExpiredInvitations()).rejects.toThrow(
        'Cleanup failed'
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.code = 'TIMEOUT';
      apiService.get.mockRejectedValue(timeoutError);

      await expect(invitationApi.getPendingInvitations()).rejects.toThrow('Network timeout');
    });

    it('should handle malformed responses', async () => {
      apiService.get.mockResolvedValue(null);

      const result = await invitationApi.getPendingInvitations();

      expect(result).toBeNull();
    });

    it('should handle authentication errors', async () => {
      const authError = new Error('Authentication required');
      authError.status = 401;
      apiService.get.mockRejectedValue(authError);

      await expect(invitationApi.getSentInvitations()).rejects.toThrow(
        'Authentication required'
      );
    });

    it('should handle server errors', async () => {
      const serverError = new Error('Internal server error');
      serverError.status = 500;
      apiService.post.mockRejectedValue(serverError);

      await expect(
        invitationApi.respondToInvitation('inv-123', 'accepted')
      ).rejects.toThrow('Internal server error');
    });

    it('should handle validation errors', async () => {
      const validationError = new Error('Invalid invitation response');
      validationError.status = 400;
      apiService.post.mockRejectedValue(validationError);

      await expect(
        invitationApi.respondToInvitation('inv-123', 'invalid_response')
      ).rejects.toThrow('Invalid invitation response');
    });
  });

  describe('Parameter Validation', () => {
    it('should handle empty invitation ID', async () => {
      const mockResponse = { message: 'Success' };
      apiService.post.mockResolvedValue(mockResponse);

      const result = await invitationApi.respondToInvitation('', 'accepted');

      expect(apiService.post).toHaveBeenCalledWith('/invitations//respond', {
        response: 'accepted',
        response_note: null,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle undefined invitation ID', async () => {
      const mockResponse = { message: 'Success' };
      apiService.post.mockResolvedValue(mockResponse);

      const result = await invitationApi.respondToInvitation(undefined, 'accepted');

      expect(apiService.post).toHaveBeenCalledWith('/invitations/undefined/respond', {
        response: 'accepted',
        response_note: null,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle null invitation ID', async () => {
      const mockResponse = { message: 'Success' };
      apiService.post.mockResolvedValue(mockResponse);

      const result = await invitationApi.respondToInvitation(null, 'accepted');

      expect(apiService.post).toHaveBeenCalledWith('/invitations/null/respond', {
        response: 'accepted',
        response_note: null,
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle very long response notes', async () => {
      const longNote = 'a'.repeat(10000);
      const mockResponse = { message: 'Success' };
      apiService.post.mockResolvedValue(mockResponse);

      await invitationApi.respondToInvitation('inv-123', 'accepted', longNote);

      expect(apiService.post).toHaveBeenCalledWith('/invitations/inv-123/respond', {
        response: 'accepted',
        response_note: longNote,
      });
    });

    it('should handle special characters in invitation IDs', async () => {
      const specialId = 'inv-123@#$%';
      const mockResponse = { message: 'Success' };
      apiService.post.mockResolvedValue(mockResponse);

      await invitationApi.respondToInvitation(specialId, 'accepted');

      expect(apiService.post).toHaveBeenCalledWith(`/invitations/${specialId}/respond`, {
        response: 'accepted',
        response_note: null,
      });
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple simultaneous requests', async () => {
      const mockResponse = { message: 'Success' };
      apiService.get.mockResolvedValue(mockResponse);

      const promises = [
        invitationApi.getPendingInvitations(),
        invitationApi.getSentInvitations(),
        invitationApi.getInvitationSummary(),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toEqual(mockResponse);
      });

      expect(apiService.get).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure in concurrent requests', async () => {
      apiService.get
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ success: true });

      const promises = [
        invitationApi.getPendingInvitations(),
        invitationApi.getSentInvitations(),
        invitationApi.getInvitationSummary(),
      ];

      const results = await Promise.allSettled(promises);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });
});
