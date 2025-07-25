/**
 * Medical Records Search Service
 * Provides comprehensive search functionality across all medical record types
 */

import { apiService } from './api';

class SearchService {
  /**
   * Search across all medical record types for a patient
   * @param {string} query - Search query string
   * @param {number} patientId - Patient ID to search records for
   * @returns {Promise<Array>} Array of formatted search results
   */
  async searchPatientRecords(query, patientId) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    if (!patientId) {
      return [];
    }

    try {
      // Search across all medical record types
      const searchPromises = [
        apiService.get('/allergies/', { params: { patient_id: patientId } }),
        apiService.get('/conditions/', { params: { patient_id: patientId } }),
        apiService.get('/medications/', { params: { patient_id: patientId } }),
        apiService.get('/immunizations/', {
          params: { patient_id: patientId },
        }),
        apiService.get('/procedures/', { params: { patient_id: patientId } }),
        apiService.get('/treatments/', { params: { patient_id: patientId } }),
        apiService.get('/vitals/', { params: { patient_id: patientId } }),
        apiService.get('/encounters/', { params: { patient_id: patientId } }),
        apiService.get('/lab-results/', { params: { patient_id: patientId } }),
      ];

      const results = await Promise.all(searchPromises);
      const [
        allergies,
        conditions,
        medications,
        immunizations,
        procedures,
        treatments,
        vitals,
        encounters,
        labResults,
      ] = results;

      // Filter and format results based on search query
      const queryLower = query.toLowerCase();
      const matchedResults = [];

      // Helper function to check if any field matches the query
      const matchesQuery = (item, searchFields) => {
        return searchFields.some(field => {
          const value = item[field];
          return value?.toString()?.toLowerCase()?.includes(queryLower);
        });
      };

      // Search allergies
      allergies.forEach(item => {
        if (matchesQuery(item, ['allergen', 'reaction', 'severity', 'notes'])) {
          matchedResults.push({
            type: 'allergy',
            id: item.id,
            title: item.allergen,
            subtitle: `${item.severity} - ${item.reaction}`,
            description: item.notes,
            date: item.created_at,
            icon: 'IconAlertTriangle',
            color: 'red',
            data: item,
          });
        }
      });

      // Search conditions
      conditions.forEach(item => {
        if (matchesQuery(item, ['condition_name', 'status', 'notes'])) {
          matchedResults.push({
            type: 'condition',
            id: item.id,
            title: item.condition_name,
            subtitle: item.status,
            description: item.notes,
            date: item.created_at,
            icon: 'IconStethoscope',
            color: 'blue',
            data: item,
          });
        }
      });

      // Search medications
      medications.forEach(item => {
        if (
          matchesQuery(item, [
            'medication_name',
            'dosage',
            'frequency',
            'notes',
          ])
        ) {
          matchedResults.push({
            type: 'medication',
            id: item.id,
            title: item.medication_name,
            subtitle: `${item.dosage} - ${item.frequency}`,
            description: item.notes,
            date: item.created_at,
            icon: 'IconPill',
            color: 'green',
            data: item,
          });
        }
      });

      // Search immunizations
      immunizations.forEach(item => {
        if (
          matchesQuery(item, [
            'vaccine_name',
            'manufacturer',
            'lot_number',
            'notes',
          ])
        ) {
          matchedResults.push({
            type: 'immunization',
            id: item.id,
            title: item.vaccine_name,
            subtitle: item.manufacturer,
            description: item.notes,
            date: item.date_administered,
            icon: 'IconVaccine',
            color: 'purple',
            data: item,
          });
        }
      });

      // Search procedures
      procedures.forEach(item => {
        if (matchesQuery(item, ['procedure_name', 'provider', 'notes'])) {
          matchedResults.push({
            type: 'procedure',
            id: item.id,
            title: item.procedure_name,
            subtitle: item.provider,
            description: item.notes,
            date: item.date_performed,
            icon: 'IconMedicalCross',
            color: 'orange',
            data: item,
          });
        }
      });

      // Search treatments
      treatments.forEach(item => {
        if (
          matchesQuery(item, ['treatment_name', 'provider', 'status', 'notes'])
        ) {
          matchedResults.push({
            type: 'treatment',
            id: item.id,
            title: item.treatment_name,
            subtitle: `${item.provider} - ${item.status}`,
            description: item.notes,
            date: item.start_date,
            icon: 'IconHeartbeat',
            color: 'pink',
            data: item,
          });
        }
      });

      // Search vitals
      vitals.forEach(item => {
        if (
          matchesQuery(item, ['notes']) ||
          (item.blood_pressure &&
            `${item.systolic}/${item.diastolic}`.includes(queryLower)) ||
          (item.heart_rate && item.heart_rate.toString().includes(queryLower))
        ) {
          matchedResults.push({
            type: 'vital',
            id: item.id,
            title: 'Vital Signs',
            subtitle: `BP: ${item.systolic}/${item.diastolic}, HR: ${item.heart_rate}`,
            description: item.notes,
            date: item.recorded_date,
            icon: 'IconHeartbeat',
            color: 'teal',
            data: item,
          });
        }
      });

      // Search encounters
      encounters.forEach(item => {
        if (
          matchesQuery(item, [
            'encounter_type',
            'provider',
            'chief_complaint',
            'diagnosis',
            'notes',
          ])
        ) {
          matchedResults.push({
            type: 'encounter',
            id: item.id,
            title: item.encounter_type,
            subtitle: item.provider,
            description: item.chief_complaint || item.diagnosis,
            date: item.encounter_date,
            icon: 'IconCalendarEvent',
            color: 'indigo',
            data: item,
          });
        }
      });

      // Search lab results
      labResults.forEach(item => {
        if (
          matchesQuery(item, ['test_name', 'result_value', 'unit', 'notes'])
        ) {
          matchedResults.push({
            type: 'lab_result',
            id: item.id,
            title: item.test_name,
            subtitle: `${item.result_value} ${item.unit}`,
            description: item.notes,
            date: item.test_date,
            icon: 'IconFlask',
            color: 'yellow',
            data: item,
          });
        }
      });

      // Sort results by date (newest first)
      matchedResults.sort((a, b) => new Date(b.date) - new Date(a.date));

      return matchedResults;
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  /**
   * Get the route path for viewing a specific record with modal
   * @param {string} type - Record type
   * @param {number} id - Record ID
   * @returns {string} Route path with view query parameter
   */
  getRecordRoute(type, id) {
    const routes = {
      allergy: '/allergies',
      condition: '/conditions',
      medication: '/medications',
      immunization: '/immunizations',
      procedure: '/procedures',
      treatment: '/treatments',
      vital: '/vitals',
      encounter: '/encounters',
      lab_result: '/lab-results',
    };

    const basePath = routes[type] || '/medical';
    return `${basePath}?view=${id}`;
  }
}

export const searchService = new SearchService();
export default searchService;
