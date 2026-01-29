/**
 * Notification API Service
 *
 * Handles all notification-related API calls including:
 * - Channel management (CRUD)
 * - Channel testing
 * - Preference management
 * - Notification history
 */

import BaseApiService from './baseApi';

class NotificationApiService extends BaseApiService {
  constructor() {
    super('/notifications');
  }

  // =========================================================================
  // Event Types
  // =========================================================================

  /**
   * Get available notification event types
   * @returns {Promise<Object>} Event types with labels and descriptions
   */
  getEventTypes() {
    return this.get('/event-types');
  }

  // =========================================================================
  // Channel Management
  // =========================================================================

  /**
   * Get all notification channels for the current user
   * @returns {Promise<Array>} List of channels
   */
  getChannels() {
    return this.get('/channels');
  }

  /**
   * Get a specific channel with masked config
   * @param {number} channelId - Channel ID
   * @returns {Promise<Object>} Channel with masked configuration
   */
  getChannel(channelId) {
    return this.get(`/channels/${channelId}`);
  }

  /**
   * Create a new notification channel
   * @param {Object} data - Channel data
   * @param {string} data.name - Channel name
   * @param {string} data.channel_type - Channel type (discord, email, gotify, webhook)
   * @param {Object} data.config - Channel-specific configuration
   * @param {boolean} [data.is_enabled=true] - Whether channel is enabled
   * @returns {Promise<Object>} Created channel
   */
  createChannel(data) {
    return this.post('/channels', data, 'Failed to create notification channel');
  }

  /**
   * Update a notification channel
   * @param {number} channelId - Channel ID
   * @param {Object} data - Update data
   * @param {string} [data.name] - New channel name
   * @param {Object} [data.config] - New configuration
   * @param {boolean} [data.is_enabled] - New enabled state
   * @returns {Promise<Object>} Updated channel
   */
  updateChannel(channelId, data) {
    return this.put(`/channels/${channelId}`, data, 'Failed to update notification channel');
  }

  /**
   * Delete a notification channel
   * @param {number} channelId - Channel ID
   * @returns {Promise<void>}
   */
  deleteChannel(channelId) {
    return this.delete(`/channels/${channelId}`, 'Failed to delete notification channel');
  }

  /**
   * Send a test notification to a channel
   * @param {number} channelId - Channel ID
   * @param {string} [message] - Custom test message
   * @returns {Promise<Object>} Test result
   */
  testChannel(channelId, message = null) {
    const data = message ? { message } : {};
    return this.post(`/channels/${channelId}/test`, data, 'Failed to send test notification');
  }

  // =========================================================================
  // Preference Management
  // =========================================================================

  /**
   * Get all notification preferences for the current user
   * @returns {Promise<Array>} List of preferences
   */
  getPreferences() {
    return this.get('/preferences');
  }

  /**
   * Get the preference matrix (events x channels)
   * @returns {Promise<Object>} Matrix with channels, events, and preferences
   */
  getPreferenceMatrix() {
    return this.get('/preferences/matrix');
  }

  /**
   * Set or update a notification preference
   * @param {Object} data - Preference data
   * @param {number} data.channel_id - Channel ID
   * @param {string} data.event_type - Event type
   * @param {boolean} data.is_enabled - Whether enabled
   * @param {number} [data.remind_before_minutes] - Reminder time
   * @returns {Promise<Object>} Updated preference
   */
  setPreference(data) {
    return this.post('/preferences', data, 'Failed to update notification preference');
  }

  /**
   * Bulk update preferences for a channel
   * @param {number} channelId - Channel ID
   * @param {Object} eventStates - Map of event_type to is_enabled
   * @returns {Promise<Array>} Updated preferences
   */
  async bulkUpdatePreferences(channelId, eventStates) {
    const promises = Object.entries(eventStates).map(([eventType, isEnabled]) =>
      this.setPreference({
        channel_id: channelId,
        event_type: eventType,
        is_enabled: isEnabled,
      })
    );
    return Promise.all(promises);
  }

  // =========================================================================
  // History
  // =========================================================================

  /**
   * Get notification history with pagination
   * @param {Object} [params] - Query parameters
   * @param {number} [params.page=1] - Page number
   * @param {number} [params.page_size=20] - Items per page
   * @param {string} [params.status_filter] - Filter by status
   * @param {string} [params.event_type] - Filter by event type
   * @returns {Promise<Object>} Paginated history
   */
  getHistory(params = {}) {
    const queryParams = {
      page: params.page || 1,
      page_size: params.page_size || 20,
    };

    if (params.status_filter) {
      queryParams.status_filter = params.status_filter;
    }

    if (params.event_type) {
      queryParams.event_type = params.event_type;
    }

    return this.get('/history', { params: queryParams });
  }
}

export const notificationApi = new NotificationApiService();
export default notificationApi;
