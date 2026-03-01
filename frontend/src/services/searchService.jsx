/**
 * Medical Records Search Service
 * Provides comprehensive search functionality across all medical record types
 * Updated to use unified backend search API
 */

import { apiService } from './api';
import logger from './logger';

class SearchService {
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
          title: this.formatVitalSigns(item),
          subtitle: item.notes || '',
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
    if (!patientId) {
      return {
        results: [],
        totalCount: 0,
        pagination: { skip: 0, limit: 20, hasMore: false }
      };
    }

    try {
      const params = {
        ...paginationOptions
      };

      if (query && query.trim().length > 0) {
        params.q = query;
      }

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