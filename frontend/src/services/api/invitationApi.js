import { apiService } from './index';

class InvitationApi {
    
    async getPendingInvitations(invitationType = null) {
        const params = new URLSearchParams();
        if (invitationType) {
            params.append('invitation_type', invitationType);
        }
        
        const response = await apiService.get(`/invitations/pending?${params.toString()}`);
        return response;
    }
    
    async getSentInvitations(invitationType = null) {
        const params = new URLSearchParams();
        if (invitationType) {
            params.append('invitation_type', invitationType);
        }
        
        const response = await apiService.get(`/invitations/sent?${params.toString()}`);
        return response;
    }
    
    async respondToInvitation(invitationId, response, responseNote = null) {
        const response_data = await apiService.post(`/invitations/${invitationId}/respond`, {
            response,
            response_note: responseNote
        });
        return response_data;
    }
    
    async cancelInvitation(invitationId) {
        const response = await apiService.delete(`/invitations/${invitationId}`);
        return response;
    }
    
    async revokeInvitation(invitationId) {
        const response = await apiService.post(`/invitations/${invitationId}/revoke`);
        return response;
    }
    
    async getInvitationSummary() {
        const response = await apiService.get('/invitations/summary');
        return response;
    }
    
    async cleanupExpiredInvitations() {
        const response = await apiService.post('/invitations/cleanup');
        return response;
    }
}

export default new InvitationApi();