/**
 * Medical Records Search Service
 * Provides comprehensive search functionality across all medical record types
 * Updated to use unified backend search API
 */

import { apiService } from './api';
import logger from './logger';

class SearchService {
  /**
   * Search across all medical record types for a patient using unified API
   * @param {string} query - Search query string
   * @param {number} patientId - Patient ID to search records for
   * @param {Object} options - Search options
   * @param {Array<string>} options.types - Filter by record types
   * @param {number} options.limit - Results limit (default: 20)
   * @param {number} options.skip - Results offset (default: 0)
   * @param {string} options.sort - Sort order (default: 'relevance')
   * @returns {Promise<Array>} Array of formatted search results
   */
  async searchPatientRecords(query, patientId, options = {}) {
    logger.debug('search_called', 'searchPatientRecords called', {
      query,
      patientId,
      options,
      component: 'SearchService'
    });

    if (!query || query.trim().length < 2) {
      logger.debug('search_query_short', 'Query too short, returning empty results', {
        component: 'SearchService'
      });
      return [];
    }

    if (!patientId) {
      logger.debug('search_no_patient', 'No patient ID provided, returning empty results', {
        patientId,
        component: 'SearchService'
      });
      return [];
    }

    const {
      types = null,
      limit = 20,
      skip = 0,
      sort = 'relevance'
    } = options;

    try {
      logger.debug('search_api_call', 'Making API call to search endpoint', {
        component: 'SearchService'
      });

      logger.info('search_request', 'Searching patient records', {
        component: 'SearchService',
        query,
        patientId,
        options
      });

      // Use new unified search endpoint
      const params = {
        q: query,
        limit,
        skip,
        sort
      };

      // Add patient_id as query parameter if provided
      if (patientId) {
        params.patient_id = patientId;
      }

      if (types && types.length > 0) {
        params.types = types;
      }

      logger.debug('search_api_params', 'API request parameters', {
        params,
        component: 'SearchService'
      });

      const searchData = await apiService.get('/search/', { params });
      logger.debug('search_api_response', 'API response received', {
        hasData: !!searchData,
        component: 'SearchService'
      });

      logger.info('search_response', 'Search completed successfully', {
        component: 'SearchService',
        totalResults: searchData?.total_count || 0,
        typesFound: Object.keys(searchData?.results || {})
      });

      // Convert backend response to frontend format
      const matchedResults = this.formatSearchResults(searchData?.results || {});

      // Sort by date (newest first) for consistency with old behavior
      if (sort === 'relevance') {
        matchedResults.sort((a, b) => new Date(b.date) - new Date(a.date));
      }

      return matchedResults;

    } catch (error) {
      logger.error('search_api_error', 'API request failed', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        component: 'SearchService'
      });

      logger.error('search_error', 'Search request failed', {
        component: 'SearchService',
        error: error.message,
        query,
        patientId
      });
      return [];
    }
  }

  /**
   * Format backend search results to frontend format
   * @param {Object} results - Backend search results grouped by type
   * @returns {Array} Formatted results array
   */
  formatSearchResults(results) {
    const matchedResults = [];

    // Process each record type
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
   * Format individual result item based on type
   * @param {string} recordType - Type of record
   * @param {Object} item - Individual result item
   * @returns {Object} Formatted result item
   */
  formatResultItem(recordType, item) {
    const baseItem = {
      type: item.type,
      id: item.id,
      tags: item.tags || [],
      data: item
    };

    switch (recordType) {
      case 'medications':
        return {
          ...baseItem,
          title: item.medication_name,
          subtitle: item.dosage ? `${item.dosage} - ${item.status}` : item.status,
          description: item.notes || '',
          date: item.start_date || item.created_at,
          icon: 'IconPill',
          color: 'green'
        };

      case 'conditions':
        return {
          ...baseItem,
          title: item.condition_name,
          subtitle: item.status,
          description: item.diagnosis || item.notes || '',
          date: item.diagnosed_date || item.created_at,
          icon: 'IconStethoscope',
          color: 'blue'
        };

      case 'lab_results':
        return {
          ...baseItem,
          title: item.test_name,
          subtitle: item.result ? `Result: ${item.result}` : item.status,
          description: item.notes || '',
          date: item.test_date || item.created_at,
          icon: 'IconFlask',
          color: 'indigo'
        };

      case 'procedures':
        return {
          ...baseItem,
          title: item.name,
          subtitle: item.status,
          description: item.description || item.notes || '',
          date: item.procedure_date || item.created_at,
          icon: 'IconMedicalCross',
          color: 'violet'
        };

      case 'immunizations':
        return {
          ...baseItem,
          title: item.vaccine_name,
          subtitle: item.dose_number ? `Dose ${item.dose_number} - ${item.status}` : item.status,
          description: item.notes || '',
          date: item.administered_date || item.created_at,
          icon: 'IconVaccine',
          color: 'orange'
        };

      case 'treatments':
        return {
          ...baseItem,
          title: item.treatment_name,
          subtitle: item.treatment_type ? `${item.treatment_type} - ${item.status}` : item.status,
          description: item.description || item.notes || '',
          date: item.start_date || item.created_at,
          icon: 'IconHeartbeat',
          color: 'pink'
        };

      case 'encounters':
        return {
          ...baseItem,
          title: item.visit_type || item.reason,
          subtitle: item.reason,
          description: item.chief_complaint || item.notes || '',
          date: item.encounter_date || item.created_at,
          icon: 'IconCalendarEvent',
          color: 'teal'
        };

      case 'allergies':
        return {
          ...baseItem,
          title: item.allergen,
          subtitle: `${item.severity} - ${item.reaction}`,
          description: item.notes || '',
          date: item.identified_date || item.created_at,
          icon: 'IconAlertTriangle',
          color: 'red'
        };

      case 'vitals':
        return {
          ...baseItem,
          title: 'Vital Signs',
          subtitle: this.formatVitalSigns(item),
          description: item.notes || '',
          date: item.recorded_date || item.created_at,
          icon: 'IconHeartbeat',
          color: 'cyan'
        };

      default:
        logger.warn('unknown_record_type', 'Unknown record type in search results', {
          component: 'SearchService',
          recordType,
          item
        });
        return null;
    }
  }

  /**
   * Format vital signs for display
   * @param {Object} vital - Vital signs data
   * @returns {string} Formatted vital signs string
   */
  formatVitalSigns(vital) {
    const signs = [];

    if (vital.systolic_bp && vital.diastolic_bp) {
      signs.push(`BP: ${vital.systolic_bp}/${vital.diastolic_bp}`);
    }
    if (vital.heart_rate) {
      signs.push(`HR: ${vital.heart_rate}`);
    }
    if (vital.temperature) {
      signs.push(`Temp: ${vital.temperature}°F`);
    }
    if (vital.weight) {
      signs.push(`Weight: ${vital.weight} lbs`);
    }

    return signs.length > 0 ? signs.join(', ') : 'Vital Signs';
  }

  /**
   * Get route for opening a specific record
   * @param {string} type - Record type
   * @param {number} id - Record ID
   * @returns {string} Route URL
   */
  getRecordRoute(type, id) {
    const routeMap = {
      allergy: `/allergies?view=${id}`,
      condition: `/conditions?view=${id}`,
      medication: `/medications?view=${id}`,
      immunization: `/immunizations?view=${id}`,
      procedure: `/procedures?view=${id}`,
      treatment: `/treatments?view=${id}`,
      vital: `/vitals?view=${id}`,
      encounter: `/visits?view=${id}`,
      lab_result: `/lab-results?view=${id}`
    };

    return routeMap[type] || `/dashboard`;
  }

  /**
   * Search with pagination support
   * @param {string} query - Search query
   * @param {number} patientId - Patient ID
   * @param {Object} paginationOptions - Pagination options
   * @returns {Promise<Object>} Search results with pagination info
   */
  async searchWithPagination(query, patientId, paginationOptions = {}) {
    if (!query || query.trim().length < 2) {
      return {
        results: [],
        totalCount: 0,
        pagination: { skip: 0, limit: 20, hasMore: false }
      };
    }

    if (!patientId) {
      return {
        results: [],
        totalCount: 0,
        pagination: { skip: 0, limit: 20, hasMore: false }
      };
    }

    try {
      const params = {
        q: query,
        ...paginationOptions
      };

      // Add patient_id as query parameter if provided
      if (patientId) {
        params.patient_id = patientId;
      }

      const searchData = await apiService.get('/search/', { params });

      const formattedResults = this.formatSearchResults(searchData?.results || {});

      return {
        results: formattedResults,
        totalCount: searchData?.total_count || 0,
        pagination: searchData?.pagination || { skip: 0, limit: 20, hasMore: false },
        resultsByType: searchData?.results || {}
      };

    } catch (error) {
      logger.error('paginated_search_error', 'Paginated search failed', {
        component: 'SearchService',
        error: error.message,
        query,
        patientId
      });

      return {
        results: [],
        totalCount: 0,
        pagination: { skip: 0, limit: 20, hasMore: false }
      };
    }
  }
}

// Export singleton instance
export const searchService = new SearchService();
export default searchService;