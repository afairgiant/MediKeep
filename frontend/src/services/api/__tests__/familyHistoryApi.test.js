import { vi } from 'vitest';

/**
 * Tests for FamilyHistoryApi service
 * Tests all family history sharing API operations including error handling
 */
import familyHistoryApi from '../familyHistoryApi';
import { apiService } from '../index';

// Mock the apiService
vi.mock('../index', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('FamilyHistoryApi Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrganizedHistory', () => {
    it('should fetch organized family history successfully', async () => {
      const mockHistory = {
        family_members: [
          { id: 'member-1', name: 'John Doe', relationship: 'father' },
          { id: 'member-2', name: 'Jane Doe', relationship: 'mother' },
        ],
        shared_family_history: [
          { family_member: { id: 'shared-1', name: 'Bob Smith' } },
        ],
      };
      apiService.get.mockResolvedValue(mockHistory);

      const result = await familyHistoryApi.getOrganizedHistory();

      expect(apiService.get).toHaveBeenCalledWith('/family-history-sharing/mine');
      expect(result).toEqual(mockHistory);
    });

    it('should handle empty organized history', async () => {
      const emptyHistory = {
        family_members: [],
        shared_family_history: [],
      };
      apiService.get.mockResolvedValue(emptyHistory);

      const result = await familyHistoryApi.getOrganizedHistory();

      expect(result).toEqual(emptyHistory);
    });

    it('should handle API errors', async () => {
      const error = new Error('Failed to fetch organized history');
      apiService.get.mockRejectedValue(error);

      await expect(familyHistoryApi.getOrganizedHistory()).rejects.toThrow(
        'Failed to fetch organized history'
      );
    });
  });

  describe('getMyFamilyHistory', () => {
    it('should fetch own family history successfully', async () => {
      const mockOwnHistory = {
        family_members: [
          { id: 'member-1', name: 'John Doe', relationship: 'father', is_owned: true },
        ],
      };
      apiService.get.mockResolvedValue(mockOwnHistory);

      const result = await familyHistoryApi.getMyFamilyHistory();

      expect(apiService.get).toHaveBeenCalledWith('/family-history-sharing/my-own');
      expect(result).toEqual(mockOwnHistory);
    });

    it('should handle unauthorized access', async () => {
      const error = new Error('Unauthorized');
      error.status = 401;
      apiService.get.mockRejectedValue(error);

      await expect(familyHistoryApi.getMyFamilyHistory()).rejects.toThrow('Unauthorized');
    });
  });

  describe('getSharedFamilyHistory', () => {
    it('should fetch shared family history successfully', async () => {
      const mockSharedHistory = {
        shared_family_history: [
          {
            family_member: { id: 'shared-1', name: 'Alice Wilson', relationship: 'aunt' },
            share_details: { shared_by: { name: 'Dr. Smith' } },
          },
        ],
      };
      apiService.get.mockResolvedValue(mockSharedHistory);

      const result = await familyHistoryApi.getSharedFamilyHistory();

      expect(apiService.get).toHaveBeenCalledWith('/family-history-sharing/shared-with-me');
      expect(result).toEqual(mockSharedHistory);
    });

    it('should handle empty shared history', async () => {
      const emptyShared = { shared_family_history: [] };
      apiService.get.mockResolvedValue(emptyShared);

      const result = await familyHistoryApi.getSharedFamilyHistory();

      expect(result).toEqual(emptyShared);
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network connection failed');
      apiService.get.mockRejectedValue(networkError);

      await expect(familyHistoryApi.getSharedFamilyHistory()).rejects.toThrow(
        'Network connection failed'
      );
    });
  });

  describe('getSharedByMe', () => {
    it('should fetch family history shared by current user', async () => {
      const mockSharedByMe = {
        shared_by_me: [
          {
            family_member: { id: 'member-1', name: 'John Doe' },
            shared_with: [
              { user: { name: 'Dr. Smith' }, permission_level: 'view' },
            ],
          },
        ],
      };
      apiService.get.mockResolvedValue(mockSharedByMe);

      const result = await familyHistoryApi.getSharedByMe();

      expect(apiService.get).toHaveBeenCalledWith('/family-history-sharing/shared-by-me');
      expect(result).toEqual(mockSharedByMe);
    });

    it('should handle no shared items', async () => {
      const emptySharedByMe = { shared_by_me: [] };
      apiService.get.mockResolvedValue(emptySharedByMe);

      const result = await familyHistoryApi.getSharedByMe();

      expect(result).toEqual(emptySharedByMe);
    });
  });

  describe('getFamilyMemberShares', () => {
    it('should fetch shares for specific family member', async () => {
      const mockShares = [
        {
          id: 'share-1',
          shared_with: { id: 'user-123', name: 'Dr. Johnson', email: 'dr.johnson@hospital.com' },
          permission_level: 'view',
          created_at: '2024-01-15T10:30:00Z',
        },
      ];
      apiService.get.mockResolvedValue(mockShares);

      const result = await familyHistoryApi.getFamilyMemberShares('member-123');

      expect(apiService.get).toHaveBeenCalledWith('/family-history-sharing/member-123/shares');
      expect(result).toEqual(mockShares);
    });

    it('should handle family member with no shares', async () => {
      apiService.get.mockResolvedValue([]);

      const result = await familyHistoryApi.getFamilyMemberShares('member-456');

      expect(result).toEqual([]);
    });

    it('should handle invalid family member ID', async () => {
      const error = new Error('Family member not found');
      error.status = 404;
      apiService.get.mockRejectedValue(error);

      await expect(
        familyHistoryApi.getFamilyMemberShares('invalid-id')
      ).rejects.toThrow('Family member not found');
    });

    it('should handle null or undefined family member ID', async () => {
      const mockResponse = [];
      apiService.get.mockResolvedValue(mockResponse);

      const resultWithNull = await familyHistoryApi.getFamilyMemberShares(null);
      const resultWithUndefined = await familyHistoryApi.getFamilyMemberShares(undefined);

      expect(apiService.get).toHaveBeenCalledWith('/family-history-sharing/null/shares');
      expect(apiService.get).toHaveBeenCalledWith('/family-history-sharing/undefined/shares');
      expect(resultWithNull).toEqual(mockResponse);
      expect(resultWithUndefined).toEqual(mockResponse);
    });
  });

  describe('sendShareInvitation', () => {
    it('should send share invitation successfully', async () => {
      const inviteData = {
        shared_with_identifier: 'doctor@hospital.com',
        permission_level: 'view',
        sharing_note: 'Medical consultation needed',
        expires_hours: 168,
      };
      const mockResponse = { 
        message: 'Invitation sent successfully',
        invitation_id: 'inv-123',
      };
      apiService.post.mockResolvedValue(mockResponse);

      const result = await familyHistoryApi.sendShareInvitation('member-123', inviteData);

      expect(apiService.post).toHaveBeenCalledWith(
        '/family-history-sharing/member-123/shares',
        inviteData
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle invitation with minimal data', async () => {
      const minimalData = {
        shared_with_identifier: 'user@example.com',
        permission_level: 'view',
      };
      const mockResponse = { message: 'Invitation sent' };
      apiService.post.mockResolvedValue(mockResponse);

      const result = await familyHistoryApi.sendShareInvitation('member-456', minimalData);

      expect(apiService.post).toHaveBeenCalledWith(
        '/family-history-sharing/member-456/shares',
        minimalData
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle user not found error', async () => {
      const inviteData = {
        shared_with_identifier: 'nonexistent@user.com',
        permission_level: 'view',
      };
      const error = new Error('User not found');
      error.status = 404;
      apiService.post.mockRejectedValue(error);

      await expect(
        familyHistoryApi.sendShareInvitation('member-123', inviteData)
      ).rejects.toThrow('User not found');
    });

    it('should handle validation errors', async () => {
      const invalidData = {
        shared_with_identifier: '',
        permission_level: 'invalid',
      };
      const error = new Error('Invalid invitation data');
      error.status = 400;
      apiService.post.mockRejectedValue(error);

      await expect(
        familyHistoryApi.sendShareInvitation('member-123', invalidData)
      ).rejects.toThrow('Invalid invitation data');
    });

    it('should handle already shared error', async () => {
      const inviteData = {
        shared_with_identifier: 'already.shared@user.com',
        permission_level: 'view',
      };
      const error = new Error('Family history already shared with this user');
      error.status = 409;
      apiService.post.mockRejectedValue(error);

      await expect(
        familyHistoryApi.sendShareInvitation('member-123', inviteData)
      ).rejects.toThrow('Family history already shared with this user');
    });
  });

  describe('revokeShare', () => {
    it('should revoke share successfully', async () => {
      const mockResponse = { 
        message: 'Share revoked successfully',
        revoked_at: '2024-01-15T12:00:00Z',
      };
      apiService.delete.mockResolvedValue(mockResponse);

      const result = await familyHistoryApi.revokeShare('member-123', 'user-456');

      expect(apiService.delete).toHaveBeenCalledWith(
        '/family-history-sharing/member-123/shares/user-456'
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle non-existent share', async () => {
      const error = new Error('Share not found');
      error.status = 404;
      apiService.delete.mockRejectedValue(error);

      await expect(
        familyHistoryApi.revokeShare('member-456', 'user-789')
      ).rejects.toThrow('Share not found');
    });

    it('should handle unauthorized revoke attempt', async () => {
      const error = new Error('Not authorized to revoke this share');
      error.status = 403;
      apiService.delete.mockRejectedValue(error);

      await expect(
        familyHistoryApi.revokeShare('member-123', 'user-456')
      ).rejects.toThrow('Not authorized to revoke this share');
    });

    it('should handle invalid parameters', async () => {
      const mockResponse = { message: 'Share revoked successfully' };
      apiService.delete.mockResolvedValue(mockResponse);

      const result1 = await familyHistoryApi.revokeShare('', 'user-456');
      const result2 = await familyHistoryApi.revokeShare('member-123', '');
      const result3 = await familyHistoryApi.revokeShare(null, 'user-456');
      const result4 = await familyHistoryApi.revokeShare('member-123', null);

      expect(apiService.delete).toHaveBeenCalledWith('/family-history-sharing//shares/user-456');
      expect(apiService.delete).toHaveBeenCalledWith('/family-history-sharing/member-123/shares/');
      expect(apiService.delete).toHaveBeenCalledWith('/family-history-sharing/null/shares/user-456');
      expect(apiService.delete).toHaveBeenCalledWith('/family-history-sharing/member-123/shares/null');
      expect(result1).toEqual(mockResponse);
      expect(result2).toEqual(mockResponse);
      expect(result3).toEqual(mockResponse);
      expect(result4).toEqual(mockResponse);
    });
  });

  describe('bulkSendInvitations', () => {
    it('should send bulk invitations successfully', async () => {
      const bulkData = {
        family_member_ids: ['member-1', 'member-2', 'member-3'],
        shared_with_identifier: 'specialist@hospital.com',
        permission_level: 'view',
        sharing_note: 'Family consultation needed',
        expires_hours: 168,
      };
      const mockResponse = {
        total_sent: 3,
        total_failed: 0,
        results: [
          { family_member_id: 'member-1', status: 'sent', invitation_id: 'inv-1' },
          { family_member_id: 'member-2', status: 'sent', invitation_id: 'inv-2' },
          { family_member_id: 'member-3', status: 'sent', invitation_id: 'inv-3' },
        ],
      };
      apiService.post.mockResolvedValue(mockResponse);

      const result = await familyHistoryApi.bulkSendInvitations(bulkData);

      expect(apiService.post).toHaveBeenCalledWith('/family-history-sharing/bulk-invite', bulkData);
      expect(result).toEqual(mockResponse);
    });

    it('should handle partial success in bulk invitations', async () => {
      const bulkData = {
        family_member_ids: ['member-1', 'member-2', 'invalid-member'],
        shared_with_identifier: 'doctor@clinic.com',
        permission_level: 'view',
      };
      const mockResponse = {
        total_sent: 2,
        total_failed: 1,
        results: [
          { family_member_id: 'member-1', status: 'sent', invitation_id: 'inv-1' },
          { family_member_id: 'member-2', status: 'sent', invitation_id: 'inv-2' },
          { family_member_id: 'invalid-member', status: 'failed', error: 'Member not found' },
        ],
      };
      apiService.post.mockResolvedValue(mockResponse);

      const result = await familyHistoryApi.bulkSendInvitations(bulkData);

      expect(result.total_sent).toBe(2);
      expect(result.total_failed).toBe(1);
      expect(result.results).toHaveLength(3);
    });

    it('should handle empty family member IDs array', async () => {
      const bulkData = {
        family_member_ids: [],
        shared_with_identifier: 'doctor@example.com',
        permission_level: 'view',
      };
      const error = new Error('No family members specified');
      error.status = 400;
      apiService.post.mockRejectedValue(error);

      await expect(familyHistoryApi.bulkSendInvitations(bulkData)).rejects.toThrow(
        'No family members specified'
      );
    });

    it('should handle bulk invitation validation errors', async () => {
      const invalidBulkData = {
        family_member_ids: ['member-1'],
        shared_with_identifier: '',
        permission_level: 'invalid',
      };
      const error = new Error('Invalid bulk invitation data');
      error.status = 400;
      apiService.post.mockRejectedValue(error);

      await expect(familyHistoryApi.bulkSendInvitations(invalidBulkData)).rejects.toThrow(
        'Invalid bulk invitation data'
      );
    });

    it('should handle user not found in bulk invitations', async () => {
      const bulkData = {
        family_member_ids: ['member-1', 'member-2'],
        shared_with_identifier: 'nonexistent@user.com',
        permission_level: 'view',
      };
      const error = new Error('Recipient user not found');
      error.status = 404;
      apiService.post.mockRejectedValue(error);

      await expect(familyHistoryApi.bulkSendInvitations(bulkData)).rejects.toThrow(
        'Recipient user not found'
      );
    });
  });

  describe('getFamilyMemberDetails', () => {
    it('should fetch family member details successfully', async () => {
      const mockDetails = {
        id: 'member-123',
        name: 'John Doe',
        relationship: 'father',
        birth_year: 1960,
        family_conditions: [
          { condition: 'Diabetes', status: 'active' },
          { condition: 'Hypertension', status: 'active' },
        ],
        sharing_info: {
          is_shared: true,
          shared_with_count: 2,
          shared_by_count: 0,
        },
      };
      apiService.get.mockResolvedValue(mockDetails);

      const result = await familyHistoryApi.getFamilyMemberDetails('member-123');

      expect(apiService.get).toHaveBeenCalledWith('/family-history-sharing/member-123/details');
      expect(result).toEqual(mockDetails);
    });

    it('should handle member not found', async () => {
      const error = new Error('Family member not found');
      error.status = 404;
      apiService.get.mockRejectedValue(error);

      await expect(
        familyHistoryApi.getFamilyMemberDetails('non-existent')
      ).rejects.toThrow('Family member not found');
    });

    it('should handle unauthorized access to member details', async () => {
      const error = new Error('Not authorized to view member details');
      error.status = 403;
      apiService.get.mockRejectedValue(error);

      await expect(
        familyHistoryApi.getFamilyMemberDetails('restricted-member')
      ).rejects.toThrow('Not authorized to view member details');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'TIMEOUT';
      apiService.get.mockRejectedValue(timeoutError);

      await expect(familyHistoryApi.getOrganizedHistory()).rejects.toThrow('Request timeout');
    });

    it('should handle server errors', async () => {
      const serverError = new Error('Internal server error');
      serverError.status = 500;
      apiService.get.mockRejectedValue(serverError);

      await expect(familyHistoryApi.getSharedFamilyHistory()).rejects.toThrow(
        'Internal server error'
      );
    });

    it('should handle malformed responses', async () => {
      apiService.get.mockResolvedValue(null);

      const result = await familyHistoryApi.getMyFamilyHistory();

      expect(result).toBeNull();
    });

    it('should handle authentication errors', async () => {
      const authError = new Error('Authentication required');
      authError.status = 401;
      apiService.get.mockRejectedValue(authError);

      await expect(familyHistoryApi.getSharedByMe()).rejects.toThrow(
        'Authentication required'
      );
    });

    it('should handle rate limiting', async () => {
      const rateLimitError = new Error('Too many requests');
      rateLimitError.status = 429;
      apiService.post.mockRejectedValue(rateLimitError);

      const inviteData = {
        shared_with_identifier: 'user@example.com',
        permission_level: 'view',
      };

      await expect(
        familyHistoryApi.sendShareInvitation('member-123', inviteData)
      ).rejects.toThrow('Too many requests');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple simultaneous API calls', async () => {
      const mockResponse = { success: true };
      apiService.get.mockResolvedValue(mockResponse);

      const promises = [
        familyHistoryApi.getOrganizedHistory(),
        familyHistoryApi.getMyFamilyHistory(),
        familyHistoryApi.getSharedFamilyHistory(),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toEqual(mockResponse);
      });

      expect(apiService.get).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent share operations', async () => {
      const inviteData = {
        shared_with_identifier: 'user@example.com',
        permission_level: 'view',
      };
      const mockResponse = { message: 'Success' };
      apiService.post.mockResolvedValue(mockResponse);

      const promises = [
        familyHistoryApi.sendShareInvitation('member-1', inviteData),
        familyHistoryApi.sendShareInvitation('member-2', inviteData),
        familyHistoryApi.sendShareInvitation('member-3', inviteData),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(apiService.post).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure in concurrent operations', async () => {
      apiService.get
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ success: true });

      const promises = [
        familyHistoryApi.getOrganizedHistory(),
        familyHistoryApi.getSharedFamilyHistory(),
        familyHistoryApi.getMyFamilyHistory(),
      ];

      const results = await Promise.allSettled(promises);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });

  describe('Data Integrity and Consistency', () => {
    it('should maintain data structure consistency across methods', async () => {
      const consistentMemberStructure = {
        id: 'member-123',
        name: 'John Doe',
        relationship: 'father',
        birth_year: 1960,
      };

      apiService.get
        .mockResolvedValueOnce({ family_members: [consistentMemberStructure] })
        .mockResolvedValueOnce({ family_members: [consistentMemberStructure] });

      const organizedResult = await familyHistoryApi.getOrganizedHistory();
      const ownResult = await familyHistoryApi.getMyFamilyHistory();

      expect(organizedResult.family_members[0]).toEqual(consistentMemberStructure);
      expect(ownResult.family_members[0]).toEqual(consistentMemberStructure);
    });

    it('should handle pagination parameters consistently', async () => {
      // Note: This test assumes the API might support pagination in the future
      const paginatedResponse = {
        family_members: [],
        pagination: { page: 1, total: 0 },
      };
      apiService.get.mockResolvedValue(paginatedResponse);

      const result = await familyHistoryApi.getOrganizedHistory();

      expect(result).toEqual(paginatedResponse);
    });
  });
});
