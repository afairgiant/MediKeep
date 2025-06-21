// Debug version of export service to see what's actually being downloaded
import { apiClient } from './apiClient';

export const debugExportService = {
  async downloadExportDebug(params) {
    try {
      console.log('Starting export with params:', params);

      // First, try to get the response as text to see what we're actually getting
      const textResponse = await apiClient.get('/export/data', {
        params: params,
        responseType: 'text',
      });

      console.log('Text response:', textResponse.data);
      console.log('Text response headers:', textResponse.headers);

      // Now try as blob
      const blobResponse = await apiClient.get('/export/data', {
        params: params,
        responseType: 'blob',
      });

      console.log('Blob response:', blobResponse.data);
      console.log('Blob response headers:', blobResponse.headers);
      console.log('Blob size:', blobResponse.data.size);
      console.log('Blob type:', blobResponse.data.type);

      // Convert blob to text to see content
      const blobText = await blobResponse.data.text();
      console.log('Blob as text:', blobText);

      return { success: true, textData: textResponse.data, blobText: blobText };
    } catch (error) {
      console.error('Debug export failed:', error);
      throw error;
    }
  },
};

// Add this to window for testing in browser console
window.debugExportService = debugExportService;
