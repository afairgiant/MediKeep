import { apiService } from './index';

/**
 * Papra API service
 * Handles Papra document management integration API calls including
 * connection testing, settings management, and organization retrieval.
 */

/**
 * Test connection to a Papra instance
 * @param {Object} data - Connection test payload
 * @param {string} data.papra_url - Papra instance URL
 * @param {string} data.papra_api_token - Bearer token for authentication
 * @returns {Promise} Connection test results
 */
export const testConnection = async (data) => {
  return apiService.post('/papra/test-connection', {
    papra_url: data.papra_url,
    papra_api_token: data.papra_api_token,
  });
};

/**
 * Get Papra settings for the current user
 * @returns {Promise} Current Papra settings
 */
export const getSettings = async () => {
  return apiService.get('/papra/settings');
};

/**
 * Save Papra settings for the current user
 * @param {Object} data - Settings to save
 * @param {string} data.papra_url - Papra instance URL
 * @param {string} data.papra_api_token - Bearer token for authentication
 * @param {string} data.papra_organization_id - Selected organization ID
 * @param {boolean} data.papra_enabled - Enable/disable Papra integration
 * @returns {Promise} Updated settings
 */
export const saveSettings = async (data) => {
  // Only send fields that are actually defined to avoid overwriting with null
  const payload = {};
  if (data.papra_url !== undefined) payload.papra_url = data.papra_url;
  if (data.papra_api_token !== undefined) payload.papra_api_token = data.papra_api_token;
  if (data.papra_organization_id !== undefined) payload.papra_organization_id = data.papra_organization_id;
  if (data.papra_enabled !== undefined) payload.papra_enabled = data.papra_enabled;
  return apiService.put('/papra/settings', payload);
};

/**
 * Retrieve available organizations from the connected Papra instance
 * @returns {Promise} List of organizations the authenticated user belongs to
 */
export const getOrganizations = async () => {
  return apiService.get('/papra/organizations');
};

/**
 * Search documents in connected Papra instance
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {number} options.page - Page number (0-indexed)
 * @param {number} options.pageSize - Results per page
 * @returns {Promise} Search results with results array and count
 */
export const searchPapraDocuments = async (query = '', { page = 0, pageSize = 20 } = {}) => {
  const params = new URLSearchParams();
  if (query) params.append('query', query);
  params.append('page', page.toString());
  params.append('page_size', pageSize.toString());
  return apiService.get(`/papra/documents/search?${params.toString()}`);
};

/**
 * Link an existing Papra document to a MediKeep entity
 * @param {string} entityType - Type of entity (e.g., 'visit', 'lab-result')
 * @param {number} entityId - ID of the entity
 * @param {Object} data - Link data
 * @param {string} data.papra_document_id - Papra document ID (e.g., "doc_xxx")
 * @param {string} [data.description] - Optional description for the linked document
 * @returns {Promise} Created file record
 */
export const linkPapraDocument = async (entityType, entityId, data) => {
  return apiService.post(`/entity-files/${entityType}/${entityId}/link-papra`, data);
};

export default {
  testConnection,
  getSettings,
  saveSettings,
  getOrganizations,
  searchPapraDocuments,
  linkPapraDocument,
};
