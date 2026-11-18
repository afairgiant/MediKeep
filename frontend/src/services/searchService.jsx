/**
 * Medical Records Search Service
 * Provides comprehensive search functionality across all medical record types
 * Updated to use unified backend search API
 */

import { apiService } from './api';
import logger from './logger';
import { RECORD_TYPE_BY_VALUE } from '../constants/searchRecordTypes';

class SearchService {
  /**
   * Flatten backend search results (grouped by record type) into rows.
   * @param {Object} results - Backend `results`, keyed by record type group
   * @returns {Array} `{type, id, tags, data}` rows; groups of unknown record types are skipped
   */
  formatSearchResults(results) {
    const matchedResults = [];

    Object.entries(results).forEach(([recordType, typeResults]) => {
      if (!typeResults.items || typeResults.items.length === 0) {
        return;
      }

      typeResults.items.forEach(item => {
        const formattedItem = this.formatResultItem(recordType, item);
        if (formattedItem) {
          matchedResults.push(formattedItem);
        }
      });
    });

    return matchedResults;
  }

  /**
   * Wrap one backend search item; display text is built where it is rendered.
   * @param {string} recordType - Backend group key, e.g. `blood_donations`
   * @param {Object} item - Item from that group
   * @returns {Object|null} `{type, id, tags, data}`, or null for an unknown group
   */
  formatResultItem(recordType, item) {
    const config = RECORD_TYPE_BY_VALUE[recordType];
    if (!config) {
      logger.warn(
        'unknown_record_type',
        'Unknown record type in search results',
        {
          component: 'SearchService',
          recordType,
        }
      );
      return null;
    }

    return {
      type: config.itemType,
      id: item.id,
      tags: item.tags || [],
      data: item,
    };
  }

  /**
   * Search with pagination support
   * @param {string} query - Search query
   * @param {number} patientId - Patient ID
   * @param {Object} paginationOptions - Pagination options
   * @returns {Promise<Object>} Search results with pagination info
   */
  async searchWithPagination(query, patientId, paginationOptions = {}) {
    if (!patientId) {
      return {
        results: [],
        totalCount: 0,
        pagination: { skip: 0, limit: 20, hasMore: false },
      };
    }

    try {
      const params = {
        ...paginationOptions,
      };

      if (query && query.trim().length > 0) {
        params.q = query;
      }

      // Add patient_id as query parameter if provided
      if (patientId) {
        params.patient_id = patientId;
      }

      const searchData = await apiService.get('/search/', { params });

      const formattedResults = this.formatSearchResults(
        searchData?.results || {}
      );

      return {
        results: formattedResults,
        totalCount: searchData?.total_count || 0,
        pagination: searchData?.pagination || {
          skip: 0,
          limit: 20,
          hasMore: false,
        },
        resultsByType: searchData?.results || {},
      };
    } catch (error) {
      logger.error('paginated_search_error', 'Paginated search failed', {
        component: 'SearchService',
        error: error.message,
        query,
        patientId,
      });

      return {
        results: [],
        totalCount: 0,
        pagination: { skip: 0, limit: 20, hasMore: false },
      };
    }
  }
}

// Export singleton instance
export const searchService = new SearchService();
export default searchService;
