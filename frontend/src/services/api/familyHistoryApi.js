import { apiService } from './index';

class FamilyHistoryApi {
    
    async getOrganizedHistory() {
        const response = await apiService.get('/family-history-sharing/mine');
        return response;
    }
    
    async getMyFamilyHistory() {
        const response = await apiService.get('/family-history-sharing/my-own');
        return response;
    }
    
    async getSharedFamilyHistory() {
        const response = await apiService.get('/family-history-sharing/shared-with-me');
        return response;
    }
    
    async getSharedByMe() {
        const response = await apiService.get('/family-history-sharing/shared-by-me');
        return response;
    }
    
    async getFamilyMemberShares(familyMemberId) {
        const response = await apiService.get(`/family-history-sharing/${familyMemberId}/shares`);
        return response;
    }
    
    async sendShareInvitation(familyMemberId, inviteData) {
        const response = await apiService.post(`/family-history-sharing/${familyMemberId}/shares`, inviteData);
        return response;
    }
    
    async revokeShare(familyMemberId, userId) {
        const response = await apiService.delete(`/family-history-sharing/${familyMemberId}/shares/${userId}`);
        return response;
    }
    
    async bulkSendInvitations(inviteData) {
        const response = await apiService.post('/family-history-sharing/bulk-invite', inviteData);
        return response;
    }
    
    async getFamilyMemberDetails(familyMemberId) {
        const response = await apiService.get(`/family-history-sharing/${familyMemberId}/details`);
        return response;
    }
}

export default new FamilyHistoryApi();